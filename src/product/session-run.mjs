import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { callNativeMcpTool } from "./native-mcp.mjs";

const KILL_SWITCH_ENV = "THEOREMS_HARNESS_SESSION_RUN";
const STATE_DIR = ".theorems-harness";
const REQUEST_ID = "session-run";
const TIMEOUT_MS = 2000;
const ACTOR = "claude-code";
const BUDGET_TOKENS = 200000;

export async function openSessionRun(hookInput = {}) {
  try {
    if (!sessionRunEnabled()) return;
    const sessionId = sessionIdFrom(hookInput);
    const statePath = stateFilePath(hookInput);
    if (!sessionId || !statePath) return;
<<<<<<< HEAD
=======
    const tenant = tenantSlug();
    if (!tenant) return;
>>>>>>> origin/main

    const runId = `harnessrun:cc-${sessionId}`;
    const task = String(hookInput.prompt ?? "").trim() || "claude-code session";
    const artifactId = `cc-context-${sessionId}`;
    const openedAt = new Date().toISOString();
<<<<<<< HEAD
=======
    const baseState = {
      run_id: runId,
      status: "open",
      opened_at: openedAt,
      tenant_slug: tenant,
      tool_events: 0,
    };
>>>>>>> origin/main
    const transitions = [
      {
        step: "run-created",
        type: "RUN.CREATED",
        payload: {
          task,
          actor: ACTOR,
          scope: {
<<<<<<< HEAD
            tenant_slug: tenantSlug(),
=======
            tenant_slug: tenant,
>>>>>>> origin/main
            surface: "claude-code",
            agent_host: "claude-code",
            workstream_id: "cc-session",
          },
        },
      },
      {
        step: "task-resolved",
        type: "TASK.RESOLVED",
        payload: {
          task_signature: createHash("sha256").update(task).digest("hex"),
        },
      },
      {
        step: "profile-selected",
        type: "PROFILE.SELECTED",
        payload: {
          profile_id: "claude-code-session",
          profile_version: "1",
          policy_hash: "cc-default",
        },
      },
      {
        step: "toolkit-compiled",
        type: "TOOLKIT.COMPILED",
        payload: {
          selected_tools: [],
          selected_plugins: [],
          excluded_tools: [],
          permission_reasons: [],
        },
      },
      {
        step: "context-planned",
        type: "CONTEXT.PLANNED",
        payload: {
          budget_tokens: BUDGET_TOKENS,
          plan_hash: "cc-session",
          candidate_token_count: 0,
        },
      },
      {
        step: "context-packed",
        type: "CONTEXT.PACKED",
        payload: {
          artifact_id: artifactId,
          capsule_tokens: 0,
          budget_tokens: BUDGET_TOKENS,
          included_atom_count: 0,
          excluded_atom_count: 0,
          token_ledger: {},
        },
      },
      {
        step: "context-injected",
        type: "CONTEXT.INJECTED",
        payload: {
          artifact_id: artifactId,
          adapter: "claude-code",
          target: "session",
        },
      },
      {
        step: "agent-acting",
        type: "AGENT.ACTING",
        payload: {
          adapter: "claude-code",
          started_at: new Date().toISOString(),
        },
      },
    ];

<<<<<<< HEAD
    for (const { step, type, payload } of transitions) {
      const accepted = await appendTransition({ type, runId, step, payload });
      if (!accepted) {
        await writeState(statePath, { run_id: runId, status: "degraded", opened_at: openedAt });
        return;
      }
    }
    await writeState(statePath, {
      run_id: runId,
      status: "open",
      opened_at: openedAt,
      tool_events: 0,
    });
=======
    let runCreated = false;
    for (const { step, type, payload } of transitions) {
      const accepted = await appendTransition({ type, runId, step, payload, tenant });
      if (!accepted) {
        if (!runCreated) {
          await writeState(statePath, {
            ...baseState,
            status: "degraded",
            failed_step: step,
            failed_transition: type,
          });
          return;
        }
        const failed = await failSessionRun({
          runId,
          tenant,
          step: "open-failed",
          errorCode: "session_open_degraded",
          message: `${type} was rejected while opening the Claude Code session run.`,
        });
        await writeState(statePath, {
          ...baseState,
          status: failed ? "failed" : "open",
          open_degraded: true,
          failed_step: step,
          failed_transition: type,
        });
        return;
      }
      if (type === "RUN.CREATED") {
        runCreated = true;
      }
    }
    await writeState(statePath, baseState);
>>>>>>> origin/main
  } catch {
    // The session-run driver must never break the host session.
  }
}

export async function recordSessionTool(hookInput = {}) {
  try {
    if (!sessionRunEnabled()) return;
    const statePath = stateFilePath(hookInput);
    if (!statePath) return;
    const state = await readState(statePath);
    if (!state || state.status !== "open" || !state.run_id) return;
<<<<<<< HEAD
=======
    const tenant = tenantFromState(state);
    if (!tenant) return;
>>>>>>> origin/main

    const count = Number(state.tool_events ?? 0) + 1;
    const toolName = String(hookInput.tool_name ?? "").trim() || "unknown";
    const accepted = await appendTransition({
      type: "SESSION.EVENT_RECORDED",
      runId: state.run_id,
<<<<<<< HEAD
=======
      tenant,
>>>>>>> origin/main
      idempotencyKey: `${state.run_id}:tool:${count}`,
      payload: {
        event_subtype: "tool_use",
        tools: [toolName],
      },
    });
    if (!accepted) {
<<<<<<< HEAD
      await writeState(statePath, { ...state, status: "degraded" });
=======
      await writeState(statePath, {
        ...state,
        status: "open",
        tool_event_degraded_at: new Date().toISOString(),
      });
>>>>>>> origin/main
      return;
    }
    await writeState(statePath, { ...state, tool_events: count });
  } catch {
    // The session-run driver must never break the host session.
  }
}

export async function closeSessionRun(hookInput = {}) {
  try {
    if (!sessionRunEnabled()) return;
    const statePath = stateFilePath(hookInput);
    if (!statePath) return;
    const state = await readState(statePath);
    if (!state || state.status !== "open" || !state.run_id) return;
    const runId = state.run_id;
<<<<<<< HEAD
=======
    const tenant = tenantFromState(state);
    if (!tenant) return;
>>>>>>> origin/main

    let hasOutcome = false;
    const detail = await callNativeMcpTool({
      input: { timeout_ms: TIMEOUT_MS },
      nativeTool: "harness_run",
      productTool: "harness_run",
      requestId: REQUEST_ID,
<<<<<<< HEAD
      arguments: { tenant: tenantSlug(), run_id: runId },
=======
      arguments: { tenant, run_id: runId },
>>>>>>> origin/main
    });
    if (detail?.ok === true) {
      const run = detail.result?.run ?? detail.result?.detail?.run ?? null;
      hasOutcome = Boolean(run?.outcome);
    }

    if (!hasOutcome) {
      await appendTransition({
        type: "OUTCOME.RECORDED",
        runId,
<<<<<<< HEAD
=======
        tenant,
>>>>>>> origin/main
        step: "outcome-recorded",
        payload: {
          accepted: true,
          tests_passed: false,
          manual_override: true,
          validator_results: [],
          files_changed: [],
          summary: "Claude Code session ended; outcome not explicitly recorded.",
          outcome: "neutral",
        },
      });
    }

    const closed = await appendTransition({
      type: "RUN.CLOSED",
      runId,
<<<<<<< HEAD
=======
      tenant,
>>>>>>> origin/main
      step: "run-closed",
      payload: {
        summary: "Claude Code session closed by SessionEnd hook.",
        closed_by: "claude-code-hook",
      },
    });
<<<<<<< HEAD
    if (!closed) {
      await appendTransition({
        type: "RUN.FAILED",
        runId,
        step: "run-failed",
        payload: {
          error_code: "session_close_degraded",
          message: "RUN.CLOSED was rejected by the harness run state machine.",
        },
      });
    }
    await writeState(statePath, { ...state, status: closed ? "closed" : "degraded" });
=======
    if (closed) {
      await writeState(statePath, {
        ...state,
        status: "closed",
        closed_at: new Date().toISOString(),
      });
      return;
    }

    const failed = await failSessionRun({
      runId,
      tenant,
      step: "close-failed",
      errorCode: "session_close_degraded",
      message: "RUN.CLOSED was rejected by the harness run state machine.",
    });
    if (failed) {
      await writeState(statePath, {
        ...state,
        status: "failed",
        failed_at: new Date().toISOString(),
      });
      return;
    }

    await writeState(statePath, {
      ...state,
      status: "open",
      close_degraded_at: new Date().toISOString(),
      close_attempts: Number(state.close_attempts ?? 0) + 1,
    });
>>>>>>> origin/main
  } catch {
    // The session-run driver must never break the host session.
  }
}

<<<<<<< HEAD
async function appendTransition({ type, runId, step, idempotencyKey, payload }) {
=======
async function failSessionRun({ runId, tenant, step, errorCode, message }) {
  return appendTransition({
    type: "RUN.FAILED",
    runId,
    tenant,
    step,
    payload: {
      error_code: errorCode,
      message,
    },
  });
}

async function appendTransition({ type, runId, step, idempotencyKey, payload, tenant }) {
  const requestTenant = String(tenant ?? tenantSlug()).trim();
  if (!requestTenant) return false;
>>>>>>> origin/main
  const response = await callNativeMcpTool({
    input: { timeout_ms: TIMEOUT_MS },
    nativeTool: "harness_append_transition",
    productTool: "harness_append_transition",
    requestId: REQUEST_ID,
    arguments: {
      // Request-level tenant routes the write to the same tenant store the
      // compound-engineering read queries; scope.tenant_slug alone does not.
<<<<<<< HEAD
      tenant: tenantSlug(),
=======
      tenant: requestTenant,
>>>>>>> origin/main
      type,
      run_id: runId,
      actor: ACTOR,
      idempotency_key: idempotencyKey ?? `${runId}:${step}`,
      payload,
    },
  });
  return transitionAccepted(response);
}

function transitionAccepted(response) {
  if (!response || response.ok !== true || response.status !== "ok") {
    return false;
  }
  const result = response.result;
  if (result && typeof result === "object" && !Array.isArray(result)) {
    if (result.ok === false || result.error) return false;
    const status = String(result.status ?? "").toLowerCase();
    if (status === "error" || status === "degraded" || status === "rejected") return false;
  }
  return true;
}

function sessionRunEnabled() {
  const raw = String(process.env[KILL_SWITCH_ENV] ?? "").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "no";
}

function sessionIdFrom(hookInput) {
  return String(hookInput.session_id ?? "").trim();
}

function stateFilePath(hookInput) {
  const cwd = String(hookInput.cwd ?? "").trim();
  const sessionId = sessionIdFrom(hookInput);
  if (!cwd || !sessionId) return "";
  return join(cwd, STATE_DIR, `session-run-${sessionId}.json`);
}

<<<<<<< HEAD
=======
function tenantFromState(state) {
  return String(state?.tenant_slug ?? tenantSlug()).trim();
}

>>>>>>> origin/main
function tenantSlug() {
  return String(
    process.env.THEOREM_HARNESS_TENANT
      ?? process.env.THEOREMS_HARNESS_TENANT
      ?? "",
<<<<<<< HEAD
  ).trim() || "Travis-Gilbert";
=======
  ).trim();
>>>>>>> origin/main
}

async function readState(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function writeState(path, state) {
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  } catch {
    // State persistence failures are swallowed; the driver stays quiet.
  }
}
