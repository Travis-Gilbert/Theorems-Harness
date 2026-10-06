import { rpc } from "../generated/native-client.mjs";
import { loadCapabilityScorecards, scorecardSummary } from "./scorecards.mjs";

export async function runDoctor() {
  const native = await rpc("tools/list");
  const scorecards = await loadCapabilityScorecards();
  const checks = [
    {
      name: "native-theorem-endpoint",
      status: native.ok ? "ok" : "degraded",
      details: native.ok ? { tools_visible: native.result.tools?.length ?? 0 } : { reason: native.reason, message: native.message },
    },
    { name: "capability-scorecards", status: "ok", details: scorecardSummary(scorecards) },
  ];
  return {
    schema_version: 1,
    status: native.ok ? "ok" : "degraded",
    adapter: { id: "generated-native-client", mode: "remote" },
    checks,
  };
}

export function formatDoctor(result) {
  return [
    `Theorems Harness doctor: ${result.status}`,
    `Adapter: ${result.adapter.id} (${result.adapter.mode})`,
    "",
    "Checks:",
    ...result.checks.map((check) => `- ${check.status} ${check.name}`),
    "",
  ].join("\n");
}
