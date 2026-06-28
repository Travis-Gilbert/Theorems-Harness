import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { loadCapabilityManifest } from "../../src/product/load-manifest.mjs";

// The context hook can emit exactly the capabilities listed in the manifest
// (see compile-context.mjs, which iterates manifest.capabilities). A capability
// that reaches the model but is never measured is the invisible-capability risk
// the product's own scorecard ethos warns against -- the reverse-engineer gap
// that motivated this guard. These tests fail when an emittable capability lacks
// a well-formed manifest entry or a scorecard entry, and when a scorecard entry
// has no backing manifest capability.

const VALID_DELIVERY = ["ambient", "jit", "explicit", "background"];

async function loadScorecards(root) {
  const text = await readFile(resolve(root, "scorecards/capability-scorecards.json"), "utf8");
  return JSON.parse(text);
}

test("every emittable capability has a well-formed manifest entry", async () => {
  const manifest = await loadCapabilityManifest();
  assert.ok(manifest.capabilities.length > 0, "manifest declares at least one capability");
  for (const capability of manifest.capabilities) {
    assert.ok(capability.id, `capability missing id: ${JSON.stringify(capability)}`);
    assert.ok(capability.title, `${capability.id} missing title`);
    assert.ok(
      VALID_DELIVERY.includes(capability.delivery),
      `${capability.id} has invalid delivery: ${capability.delivery}`,
    );
  }
});

test("every emittable capability has a scorecard entry", async () => {
  const manifest = await loadCapabilityManifest();
  const scorecards = await loadScorecards(manifest.root);
  const tracked = new Set(Object.keys(scorecards.capabilities ?? {}));
  const missing = manifest.capabilities
    .map((capability) => capability.id)
    .filter((id) => !tracked.has(id));
  assert.deepEqual(
    missing,
    [],
    `capabilities the hook can emit but with no scorecard entry: ${missing.join(", ")}`,
  );
});

test("no scorecard entry is orphaned from the manifest", async () => {
  const manifest = await loadCapabilityManifest();
  const scorecards = await loadScorecards(manifest.root);
  const declared = new Set(manifest.capabilities.map((capability) => capability.id));
  const orphans = Object.keys(scorecards.capabilities ?? {}).filter((id) => !declared.has(id));
  assert.deepEqual(
    orphans,
    [],
    `scorecard entries with no manifest capability: ${orphans.join(", ")}`,
  );
});

test("reverse-engineer is a tracked, model-visible, Theorem-backed capability", async () => {
  const manifest = await loadCapabilityManifest();
  const re = manifest.capabilities.find((capability) => capability.id === "reverse-engineer");
  assert.ok(re, "reverse-engineer is declared in the manifest");
  assert.equal(re.delivery, "jit");
  assert.equal(re.must_be_visible_to_model, true, "reverse-engineer must remain model-visible");
  assert.ok(re.context?.directive, "reverse-engineer carries a model-visible directive");
  assert.ok(
    (re.backing?.theorem_verbs ?? []).some((verb) => /reconstruct/.test(verb)),
    "reverse-engineer declares its backing reconstruct verbs",
  );
});
