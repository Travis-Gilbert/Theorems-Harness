import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { compileContext } from "../product/compile-context.mjs";
import { loadCapabilityManifest, productRoot } from "../product/load-manifest.mjs";
import { appendReceipt, appendReceipts } from "../product/receipts.mjs";
import { loadCapabilityScorecards } from "../product/scorecards.mjs";
import { degraded, validateAdapter } from "./contract.mjs";

export function createLocalAdapter(options = {}) {
  const root = options.root ?? productRoot();
  const adapter = {
    id: "theorems-harness-local",
    mode: "local-fallback",
    async prepareContext(input = {}) {
      return compileContext(input, { root });
    },
    async applySkill(input = {}) {
      const skillId = String(input.skill_id ?? input.skillId ?? "");
      if (skillId !== "rust-engineering") {
        return degraded("empty_pack", { skill_id: skillId });
      }
      return {
        ok: true,
        skill_id: skillId,
        mode: "cached-skill",
        path: resolve(root, "skills/rust-engineering/SKILL.md"),
      };
    },
    async readCodeNeighborhood(input = {}) {
      const cwd = String(input.cwd ?? process.cwd());
      const manifestPath = resolve(cwd, ".harness/code-kg-manifest.json");
      if (!existsSync(manifestPath)) {
        return degraded("no_manifest", {
          manifest_path: ".harness/code-kg-manifest.json",
        });
      }
      return {
        ok: true,
        manifest_path: manifestPath,
      };
    },
    async writeReceipt(event = {}, input = {}) {
      return appendReceipt(event, input);
    },
    async writeReceipts(events = [], input = {}) {
      return appendReceipts(events, input);
    },
    async selectAffordance(input = {}) {
      const manifest = await loadCapabilityManifest(root);
      const capabilityId = String(input.capability_id ?? input.capabilityId ?? "");
      const capability = manifest.capabilities.find((item) => item.id === capabilityId);
      if (!capability) {
        return degraded("selector_empty", { capability_id: capabilityId });
      }
      return {
        ok: true,
        capability_id: capability.id,
        delivery: capability.delivery,
        backing_verbs: capability.backing?.theorem_verbs ?? [],
      };
    },
    async scorecards() {
      return loadCapabilityScorecards(root);
    },
  };

  return validateAdapter(adapter);
}
