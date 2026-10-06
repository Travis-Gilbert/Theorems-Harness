import { callTool } from "../generated/native-client.mjs";

async function callNativeMcpTool({ input = {}, nativeTool, arguments: args }) {
  const env = { ...process.env };
  const endpoint = input.mcp_url ?? input.mcpUrl ?? input.remote_url ?? input.remoteUrl;
  if (endpoint !== undefined) {
    for (const key of ["THEOREMS_HARNESS_MCP_URL", "THEOREM_HARNESS_MCP_URL", "THEOREM_MCP_URL",
      "THEOREMS_HARNESS_REMOTE_URL", "THEOREM_HARNESS_REMOTE_URL", "THEOREM_REMOTE_URL", "RUSTYRED_THG_MCP_URL"]) delete env[key];
    env.THEOREMS_HARNESS_MCP_URL = String(endpoint);
  }
  const token = input.token ?? input.remote_token ?? input.remoteToken;
  if (token !== undefined) {
    for (const key of ["THEOREM_API_TOKEN", "THEOREM_HARNESS_API_TOKEN",
      "THEOREMS_HARNESS_REMOTE_TOKEN", "THEOREM_HARNESS_REMOTE_TOKEN"]) delete env[key];
    env.THEOREM_API_TOKEN = String(token);
  }
  const timeout = input.timeout_ms ?? input.timeoutMs;
  const timeoutMs = timeout === undefined ? undefined : Number(timeout);
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647)) {
    throw new RangeError("timeout_ms must be a positive finite timer duration");
  }
  const answer = await callTool(nativeTool, args, { env, timeoutMs });
  return answer.ok
    ? { ok: true, status: "ok", result: answer.content }
    : { ok: false, status: "degraded", reason: answer.reason, message: answer.message };
}

export async function runPlanMap({
  planId,
  input = {},
  callNative = callNativeMcpTool,
} = {}) {
  const normalizedPlanId = String(planId ?? "").trim();
  if (!normalizedPlanId) {
    throw new PlanMapError("plan_id_required", "plan map requires a plan id");
  }

  const render = await callNative({
    input,
    nativeTool: "plan",
    productTool: "plan_map_render",
    requestId: `plan-map-render:${normalizedPlanId}`,
    arguments: {
      action: "render",
      plan_id: normalizedPlanId,
      format: "mermaid",
    },
  });
  requireNativeSuccess(render, "render", normalizedPlanId);

  const frontier = await callNative({
    input,
    nativeTool: "plan",
    productTool: "plan_map_frontier",
    requestId: `plan-map-frontier:${normalizedPlanId}`,
    arguments: {
      action: "query",
      plan_id: normalizedPlanId,
      query: "frontier",
    },
  });
  requireNativeSuccess(frontier, "frontier", normalizedPlanId);

  return {
    mermaid: mermaidSource(render.result),
    frontierLine: formatFrontier(frontier.result),
    render,
    frontier,
  };
}

export function formatPlanMap(result) {
  return `${result.mermaid.trimEnd()}\n${result.frontierLine}\n`;
}

export class PlanMapError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = "PlanMapError";
    this.code = code;
    this.detail = detail;
  }
}

function requireNativeSuccess(response, operation, planId) {
  if (response?.ok) return;
  const reason = response?.reason ?? response?.status ?? "unknown";
  throw new PlanMapError(
    `plan_map_${operation}_failed`,
    `plan map ${operation} failed for ${planId}: ${reason}`,
    response,
  );
}

function mermaidSource(result) {
  const candidates = [
    result?.mermaid,
    result?.source,
    result?.planning_projection?.mermaid?.source,
    result?.planningProjection?.mermaid?.source,
    result?.json_contract?.mermaid?.source,
    result?.jsonContract?.mermaid?.source,
  ];
  const source = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  if (!source) {
    throw new PlanMapError(
      "plan_map_mermaid_missing",
      "plan render format=mermaid returned no Mermaid source",
      result,
    );
  }
  return source;
}

function formatFrontier(result) {
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const taskIds = rows
    .map((row) => String(row?.task_id ?? row?.taskId ?? "").trim())
    .filter(Boolean);
  const count = Number.isInteger(result?.count) ? result.count : taskIds.length;
  const receipt = String(
    result?.query_receipt?.trace_id
      ?? result?.queryReceipt?.traceId
      ?? result?.query_receipt?.receipt_id
      ?? result?.queryReceipt?.receiptId
      ?? "",
  ).trim();
  const digest = String(
    result?.query_receipt?.plan_hash
      ?? result?.queryReceipt?.planHash
      ?? "",
  ).trim();
  const tasks = taskIds.length ? taskIds.join(", ") : "empty";
  const digestSuffix = digest ? ` digest:${digest}` : "";
  const receiptSuffix = receipt ? ` receipt:${receipt}` : "";
  return `Frontier (${count})${digestSuffix}: ${tasks}${receiptSuffix}`;
}
