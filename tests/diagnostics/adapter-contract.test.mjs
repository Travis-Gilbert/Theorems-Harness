import assert from "node:assert/strict";
import test from "node:test";

import { adapterStatus, validateAdapter } from "../../src/adapters/contract.mjs";
import { createLocalAdapter } from "../../src/adapters/local-adapter.mjs";

test("local adapter implements the product contract", () => {
  const adapter = validateAdapter(createLocalAdapter());
  const status = adapterStatus(adapter);

  assert.equal(status.verbs_missing.length, 0);
  assert.equal(status.verbs_supported.includes("prepareContext"), true);
  assert.equal(status.verbs_supported.includes("writeReceipt"), true);
});

test("local adapter reports missing code neighborhood state explicitly", async () => {
  const adapter = createLocalAdapter();
  const result = await adapter.readCodeNeighborhood({ cwd: process.cwd() });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_manifest");
});

test("local adapter resolves cached index skill from manifest", async () => {
  const adapter = createLocalAdapter();
  const result = await adapter.applySkill({ skill_id: "index" });

  assert.equal(result.ok, true);
  assert.equal(result.skill_id, "index");
  assert.equal(result.mode, "cached-skill");
  assert.match(result.path, /skills\/index\/SKILL\.md$/);
});
