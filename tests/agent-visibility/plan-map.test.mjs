import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

import { formatPlanMap, runPlanMap } from "../../src/product/plan-map.mjs";

const MERMAID = "%% plan:plan-fixture digest:sha256:abc\nflowchart TD\n    goal((Goal))";

test("plan map requests Mermaid plus frontier and formats one transportable map", async () => {
  const calls = [];
  const result = await runPlanMap({
    planId: "plan-fixture",
    callNative: async (call) => {
      calls.push(call);
      if (call.arguments.action === "render") {
        return {
          ok: true,
          result: { planning_projection: { mermaid: { source: MERMAID } } },
        };
      }
      return {
        ok: true,
        result: {
          count: 1,
          rows: [{ task_id: "task-frontier" }],
          query_receipt: { trace_id: "planq:fixture" },
        },
      };
    },
  });

  assert.deepEqual(
    calls.map((call) => call.arguments),
    [
      { action: "render", plan_id: "plan-fixture", format: "mermaid" },
      { action: "query", plan_id: "plan-fixture", query: "frontier" },
    ],
  );
  assert.equal(
    formatPlanMap(result),
    `${MERMAID}\nFrontier (1): task-frontier receipt:planq:fixture\n`,
  );
});

test("plan map CLI calls a live MCP-shaped endpoint", async (context) => {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    await once(request, "end");
    const message = JSON.parse(body);
    requests.push(message.params);
    const isRender = message.params.arguments.action === "render";
    const payload = isRender
      ? { planning_projection: { mermaid: { source: MERMAID } } }
      : {
          count: 2,
          rows: [{ task_id: "task-a" }, { task_id: "task-b" }],
          query_receipt: { trace_id: "planq:live-fixture" },
        };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      jsonrpc: "2.0",
      id: message.id,
      result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
    }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();

  const child = spawn(
    process.execPath,
    ["src/bin/theorems-harness.mjs", "plan", "map", "plan-fixture"],
    {
      cwd: new URL("../..", import.meta.url),
      env: {
        ...process.env,
        THEOREMS_HARNESS_MCP_URL: `http://127.0.0.1:${address.port}/mcp`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const [code] = await once(child, "close");

  assert.equal(code, 0, stderr);
  assert.equal(
    stdout,
    `${MERMAID}\nFrontier (2): task-a, task-b receipt:planq:live-fixture\n`,
  );
  assert.deepEqual(
    requests.map((entry) => entry.arguments),
    [
      { action: "render", plan_id: "plan-fixture", format: "mermaid" },
      { action: "query", plan_id: "plan-fixture", query: "frontier" },
    ],
  );
});

test("plan map CLI prints readable usage without a plan id", async () => {
  const child = spawn(process.execPath, ["src/bin/theorems-harness.mjs", "plan", "map"], {
    cwd: new URL("../..", import.meta.url),
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const [code] = await once(child, "close");

  assert.equal(code, 64);
  assert.match(stderr, /Usage: theorems-harness plan map <plan-id>/);
});
