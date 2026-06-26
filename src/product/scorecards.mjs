import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadCapabilityManifest, productRoot } from "./load-manifest.mjs";

export async function loadCapabilityScorecards(root = productRoot(), options = {}) {
  const manifest = options.manifest ?? (await loadCapabilityManifest(root));
  const configured = JSON.parse(
    await readFile(resolve(root, "scorecards/capability-scorecards.json"), "utf8"),
  );
  const configuredById = configured.capabilities ?? {};
  const capabilities = Object.fromEntries(
    manifest.capabilities.map((capability) => [
      capability.id,
      {
        status: "unmeasured",
        current: {},
        targets: configured.default_targets,
        evidence: [],
        ...(configuredById[capability.id] ?? {}),
        delivery: capability.delivery,
        must_be_visible_to_model: Boolean(capability.must_be_visible_to_model),
      },
    ]),
  );

  return {
    schema_version: configured.schema_version,
    product: manifest.product,
    metrics: configured.metrics,
    default_targets: configured.default_targets,
    capabilities,
  };
}

export function scorecardSummary(scorecards) {
  const entries = Object.entries(scorecards.capabilities);
  return {
    capability_count: entries.length,
    measured_count: entries.filter(([, card]) => card.status !== "unmeasured").length,
    below_target_count: entries.filter(([, card]) => card.status === "below-target").length,
    degraded_count: entries.filter(([, card]) => card.status === "degraded").length,
  };
}
