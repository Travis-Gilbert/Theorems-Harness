import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const productRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export async function loadCapabilityScorecards(root = productRoot, options = {}) {
  const manifest = options.manifest ?? JSON.parse(
    await readFile(resolve(root, "capabilities/capability-manifest.json"), "utf8"),
  );
  const configured = JSON.parse(
    await readFile(resolve(root, "scorecards/capability-scorecards.json"), "utf8"),
  );
  const capabilityFiles = await Promise.all(manifest.capabilities.map((path) => readCapability(root, path)));
  const capabilities = Object.fromEntries(
    capabilityFiles.map((contents) => {
      const capability = JSON.parse(contents);
      const card = configured.capabilities?.[capability.id] ?? {};
      return [capability.id, {
        status: "unmeasured",
        current: {},
        targets: configured.default_targets,
        evidence: [],
        ...card,
        delivery: capability.delivery,
        must_be_visible_to_model: Boolean(capability.must_be_visible_to_model),
      }];
    }),
  );
  return {
    schema_version: configured.schema_version,
    product: manifest.product,
    metrics: configured.metrics,
    default_targets: configured.default_targets,
    capabilities,
  };
}

async function readCapability(root, path) {
  const resolved = resolve(root, "capabilities", path.replace(/^\.\//, ""));
  return readFile(resolved, "utf8");
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
