import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { runDoctor } from "../../src/product/doctor.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("doctor proves visibility and receipt writing without remote services", async () => {
  const result = await runDoctor({ cwd: process.cwd() });

  assert.equal(["ok", "degraded"].includes(result.status), true);
  assert.equal(result.checks.some((check) => check.name === "rust-engineering-visible"), true);
  assert.equal(result.checks.some((check) => check.name === "receipt-write"), true);
  assert.equal(result.checks.some((check) => check.name === "capability-scorecards"), true);
});

test("public CLI wrapper runs doctor as JSON", () => {
  const child = spawnSync(process.execPath, [resolve(root, "src/bin/theorems-harness.mjs"), "doctor", "--json"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.checks.some((check) => check.name === "adapter-contract"), true);
});
