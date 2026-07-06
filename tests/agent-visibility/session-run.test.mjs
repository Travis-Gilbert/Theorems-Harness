import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const OPEN_SEQUENCE = [
  "RUN.CREATED",
  "TASK.RESOLVED",
  "PROFILE.SELECTED",
  "TOOLKIT.COMPILED",
  "CONTEXT.PLANNED",
  "CONTEXT.PACKED",
  "CONTEXT.INJECTED",
  "AGENT.ACTING",
];

test("session-run driver opens, records tools for, and closes a harness run", async () => {
  const captured = [];
  const server = createServer(async (request, response) => {
    const body = JSON.parse(await readBody(request));
    captured.push(body);
    const result = body.params.name === "harness_run"
      ? { run: { run_id: body.params.arguments.run_id, status: "acting" } }
      : { ok: true, applied: true };
    writeJson(response, {
      jsonrpc: "2.0",
      id: body.id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result) }],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const env = mockEnv(port);
  const dir = await mkdtemp(join(tmpdir(), "theorems-harness-session-run-"));

  try {
    const prompt = "  Wire the session-as-run hook driver  ";
    const openResponse = await runHook("src/bin/session-run-open.mjs", {
      hook_event_name: "SessionStart",
      session_id: "t1",
      cwd: dir,
      prompt,
    }, env);
    assert.equal(openResponse.continue, true);
    assert.equal(openResponse.suppressOutput, true);

    assert.equal(captured.length, OPEN_SEQUENCE.length);
    assert.deepEqual(
      captured.map((body) => body.params.arguments.type),
      OPEN_SEQUENCE,
    );
    for (const body of captured) {
      assert.equal(body.params.name, "harness_append_transition");
      assert.equal(body.params.arguments.actor, "claude-code");
      assert.equal(body.params.arguments.run_id, "harnessrun:cc-t1");
      assert.match(body.params.arguments.idempotency_key, /^harnessrun:cc-t1:/);
    }

    const created = captured[0].params.arguments.payload;
    assert.equal(created.task, prompt.trim());
    assert.equal(created.actor, "claude-code");
    assert.deepEqual(created.scope, {
      tenant_slug: "Travis-Gilbert",
      surface: "claude-code",
      agent_host: "claude-code",
      workstream_id: "cc-session",
    });

    const resolved = captured[1].params.arguments.payload;
    assert.equal(
      resolved.task_signature,
      createHash("sha256").update(prompt.trim()).digest("hex"),
    );

    const profile = captured[2].params.arguments.payload;
    assert.deepEqual(profile, {
      profile_id: "claude-code-session",
      profile_version: "1",
      policy_hash: "cc-default",
    });

    const toolkit = captured[3].params.arguments.payload;
    assert.deepEqual(toolkit, {
      selected_tools: [],
      selected_plugins: [],
      excluded_tools: [],
      permission_reasons: [],
    });

    const planned = captured[4].params.arguments.payload;
    assert.equal(planned.budget_tokens, 200000);
    assert.equal(planned.plan_hash, "cc-session");
    assert.equal(planned.candidate_token_count, 0);

    const packed = captured[5].params.arguments.payload;
    assert.equal(packed.artifact_id, "cc-context-t1");
    assert.equal(packed.capsule_tokens, 0);
    assert.equal(packed.budget_tokens, 200000);
    assert.equal(packed.included_atom_count, 0);
    assert.equal(packed.excluded_atom_count, 0);
    assert.deepEqual(packed.token_ledger, {});

    const injected = captured[6].params.arguments.payload;
    assert.deepEqual(injected, {
      artifact_id: "cc-context-t1",
      adapter: "claude-code",
      target: "session",
    });

    const acting = captured[7].params.arguments.payload;
    assert.equal(acting.adapter, "claude-code");
    assert.ok(acting.started_at, "AGENT.ACTING carries started_at");

    let state = await readState(dir, "t1");
    assert.equal(state.run_id, "harnessrun:cc-t1");
    assert.equal(state.status, "open");

    captured.length = 0;
    await runHook("src/bin/session-run-tool.mjs", {
      hook_event_name: "PostToolUse",
      session_id: "t1",
      cwd: dir,
      tool_name: "Bash",
    }, env);

    assert.equal(captured.length, 1);
    assert.equal(captured[0].params.name, "harness_append_transition");
    assert.equal(captured[0].params.arguments.type, "SESSION.EVENT_RECORDED");
    assert.equal(captured[0].params.arguments.idempotency_key, "harnessrun:cc-t1:tool:1");
    assert.deepEqual(captured[0].params.arguments.payload, {
      event_subtype: "tool_use",
      tools: ["Bash"],
    });
    state = await readState(dir, "t1");
    assert.equal(state.tool_events, 1);

    captured.length = 0;
    await runHook("src/bin/session-run-close.mjs", {
      hook_event_name: "SessionEnd",
      session_id: "t1",
      cwd: dir,
    }, env);

    assert.deepEqual(
      captured.map((body) => body.params.name),
      ["harness_run", "harness_append_transition", "harness_append_transition"],
    );
    assert.equal(captured[0].params.arguments.run_id, "harnessrun:cc-t1");
    assert.equal(captured[1].params.arguments.type, "OUTCOME.RECORDED");
    assert.equal(captured[1].params.arguments.payload.outcome, "neutral");
    assert.equal(captured[1].params.arguments.payload.manual_override, true);
    assert.equal(
      captured[1].params.arguments.payload.summary,
      "Claude Code session ended; outcome not explicitly recorded.",
    );
    assert.equal(captured[2].params.arguments.type, "RUN.CLOSED");
    assert.deepEqual(captured[2].params.arguments.payload, {
      summary: "Claude Code session closed by SessionEnd hook.",
      closed_by: "claude-code-hook",
    });
    state = await readState(dir, "t1");
    assert.equal(state.status, "closed");

    captured.length = 0;
    await runHook("src/bin/session-run-tool.mjs", {
      hook_event_name: "PostToolUse",
      session_id: "t1",
      cwd: dir,
      tool_name: "Edit",
    }, env);
    assert.equal(captured.length, 0, "closed session records no further tool events");
  } finally {
    server.close();
    await once(server, "close");
    await rm(dir, { recursive: true, force: true });
  }
});

test("session-run driver degrades on native failure and later hooks no-op", async () => {
  let hits = 0;
  const server = createServer(async (request, response) => {
    await readBody(request);
    hits += 1;
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "boom" }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const env = mockEnv(port);
  const dir = await mkdtemp(join(tmpdir(), "theorems-harness-session-run-degraded-"));

  try {
    const openResponse = await runHook("src/bin/session-run-open.mjs", {
      hook_event_name: "SessionStart",
      session_id: "t1",
      cwd: dir,
      prompt: "degraded path",
    }, env);
    assert.equal(openResponse.continue, true);

    assert.equal(hits, 1, "open stops at the first rejected transition");
    let state = await readState(dir, "t1");
    assert.equal(state.status, "degraded");
    assert.equal(state.run_id, "harnessrun:cc-t1");

    await runHook("src/bin/session-run-tool.mjs", {
      hook_event_name: "PostToolUse",
      session_id: "t1",
      cwd: dir,
      tool_name: "Bash",
    }, env);
    await runHook("src/bin/session-run-close.mjs", {
      hook_event_name: "SessionEnd",
      session_id: "t1",
      cwd: dir,
    }, env);

    assert.equal(hits, 1, "degraded state suppresses later session-run calls");
    state = await readState(dir, "t1");
    assert.equal(state.status, "degraded");
  } finally {
    server.close();
    await once(server, "close");
    await rm(dir, { recursive: true, force: true });
  }
});

test("session-run driver fails a partially opened native run", async () => {
  const captured = [];
  const server = createServer(async (request, response) => {
    const body = JSON.parse(await readBody(request));
    captured.push(body);
    const type = body.params.arguments.type;
    const result = type === "TASK.RESOLVED"
      ? { ok: false, status: "rejected" }
      : { ok: true, applied: true };
    writeJson(response, {
      jsonrpc: "2.0",
      id: body.id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result) }],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const env = mockEnv(port);
  const dir = await mkdtemp(join(tmpdir(), "theorems-harness-session-run-partial-"));

  try {
    const openResponse = await runHook("src/bin/session-run-open.mjs", {
      hook_event_name: "SessionStart",
      session_id: "t1",
      cwd: dir,
      prompt: "partial open",
    }, env);
    assert.equal(openResponse.continue, true);

    assert.deepEqual(
      captured.map((body) => body.params.arguments.type),
      ["RUN.CREATED", "TASK.RESOLVED", "RUN.FAILED"],
    );
    assert.equal(captured[2].params.arguments.idempotency_key, "harnessrun:cc-t1:open-failed");
    assert.deepEqual(captured[2].params.arguments.payload, {
      error_code: "session_open_degraded",
      message: "TASK.RESOLVED was rejected while opening the Claude Code session run.",
    });

    const state = await readState(dir, "t1");
    assert.equal(state.status, "failed");
    assert.equal(state.open_degraded, true);
    assert.equal(state.failed_step, "task-resolved");
    assert.equal(state.failed_transition, "TASK.RESOLVED");
  } finally {
    server.close();
    await once(server, "close");
    await rm(dir, { recursive: true, force: true });
  }
});

test("session-run driver keeps failed closes retryable", async () => {
  const captured = [];
  let rejectCloseTransitions = false;
  const server = createServer(async (request, response) => {
    const body = JSON.parse(await readBody(request));
    captured.push(body);
    if (body.params.name === "harness_run") {
      writeJson(response, {
        jsonrpc: "2.0",
        id: body.id,
        result: {
          content: [{
            type: "text",
            text: JSON.stringify({ run: { run_id: body.params.arguments.run_id } }),
          }],
        },
      });
      return;
    }

    const type = body.params.arguments.type;
    if (rejectCloseTransitions && (type === "RUN.CLOSED" || type === "RUN.FAILED")) {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "temporary outage" }));
      return;
    }

    writeJson(response, {
      jsonrpc: "2.0",
      id: body.id,
      result: {
        content: [{ type: "text", text: JSON.stringify({ ok: true, applied: true }) }],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const env = mockEnv(port);
  const dir = await mkdtemp(join(tmpdir(), "theorems-harness-session-run-close-retry-"));

  try {
    await runHook("src/bin/session-run-open.mjs", {
      hook_event_name: "SessionStart",
      session_id: "t1",
      cwd: dir,
      prompt: "retry close",
    }, env);

    rejectCloseTransitions = true;
    captured.length = 0;
    await runHook("src/bin/session-run-close.mjs", {
      hook_event_name: "SessionEnd",
      session_id: "t1",
      cwd: dir,
    }, env);

    assert.deepEqual(
      captured.map((body) => body.params.name === "harness_run"
        ? "harness_run"
        : body.params.arguments.type),
      ["harness_run", "OUTCOME.RECORDED", "RUN.CLOSED", "RUN.FAILED"],
    );
    let state = await readState(dir, "t1");
    assert.equal(state.status, "open");
    assert.equal(state.close_attempts, 1);
    assert.ok(state.close_degraded_at);

    rejectCloseTransitions = false;
    captured.length = 0;
    await runHook("src/bin/session-run-close.mjs", {
      hook_event_name: "SessionEnd",
      session_id: "t1",
      cwd: dir,
    }, env);

    assert.deepEqual(
      captured.map((body) => body.params.name === "harness_run"
        ? "harness_run"
        : body.params.arguments.type),
      ["harness_run", "OUTCOME.RECORDED", "RUN.CLOSED"],
    );
    state = await readState(dir, "t1");
    assert.equal(state.status, "closed");
    assert.ok(state.closed_at);
  } finally {
    server.close();
    await once(server, "close");
    await rm(dir, { recursive: true, force: true });
  }
});

function mockEnv(port) {
  return {
    ...process.env,
    THEOREMS_HARNESS_MCP_URL: `http://127.0.0.1:${port}/mcp`,
    THEOREM_HARNESS_TENANT: "Travis-Gilbert",
    THEOREMS_HARNESS_SESSION_RUN: "1",
  };
}

async function runHook(script, input, env) {
  const child = spawn(process.execPath, [resolve(root, script)], {
    cwd: root,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.end(JSON.stringify(input));
  const [code] = await once(child, "close");
  assert.equal(code, 0, stderr);
  return JSON.parse(stdout);
}

async function readState(dir, sessionId) {
  const text = await readFile(join(dir, ".theorems-harness", `session-run-${sessionId}.json`), "utf8");
  return JSON.parse(text);
}

function readBody(request) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function writeJson(response, value) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}
