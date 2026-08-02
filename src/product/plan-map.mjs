import { callNativeMcpTool } from "./native-mcp.mjs";

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
  const tasks = taskIds.length ? taskIds.join(", ") : "empty";
  const receiptSuffix = receipt ? ` receipt:${receipt}` : "";
  return `Frontier (${count}): ${tasks}${receiptSuffix}`;
}
