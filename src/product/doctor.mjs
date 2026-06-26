import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { adapterContract, adapterStatus } from "../adapters/contract.mjs";
import { createLocalAdapter } from "../adapters/local-adapter.mjs";
import { buildReceiptEvents } from "./receipts.mjs";
import { scorecardSummary } from "./scorecards.mjs";

export async function runDoctor(input = {}) {
  const cwd = String(input.cwd ?? process.cwd());
  const adapter = createLocalAdapter();
  const checks = [];

  addCheck(checks, "adapter-contract", "ok", adapterStatus(adapter));
  addCheck(checks, "adapter-verbs", "ok", adapterContract());

  const compiled = await adapter.prepareContext({
    prompt: "Edit Rust code in the harness crate",
    cwd,
    changed_files: ["src/lib.rs"],
    hookEvent: "UserPromptSubmit",
  });
  const rustVisible = compiled.packet.active_capabilities.some((item) => item.id === "rust-engineering");
  addCheck(checks, "rust-engineering-visible", rustVisible ? "ok" : "fail", {
    active_capabilities: compiled.packet.active_capabilities.map((item) => item.id),
  });

  const neighborhood = await adapter.readCodeNeighborhood({ cwd });
  addCheck(checks, "code-neighborhood", neighborhood.ok ? "ok" : "degraded", neighborhood);

  const scorecards = await adapter.scorecards();
  addCheck(checks, "capability-scorecards", "ok", scorecardSummary(scorecards));

  const tempDir = await mkdtemp(join(tmpdir(), "theorems-harness-doctor-"));
  try {
    const events = buildReceiptEvents(compiled.packet, { hookEvent: "Doctor" });
    const receiptWrite = await adapter.writeReceipts(events, {
      cwd: tempDir,
      path: "receipts.jsonl",
    });
    addCheck(checks, "receipt-write", receiptWrite.ok ? "ok" : "fail", {
      count: receiptWrite.count,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  return {
    schema_version: 1,
    status: overallStatus(checks),
    cwd,
    adapter: adapterStatus(adapter),
    checks,
  };
}

export function formatDoctor(result) {
  const lines = [
    `Theorems Harness doctor: ${result.status}`,
    `Adapter: ${result.adapter.id} (${result.adapter.mode})`,
    "",
    "Checks:",
    ...result.checks.map((check) => `- ${check.status} ${check.name}`),
  ];
  return `${lines.join("\n")}\n`;
}

function addCheck(checks, name, status, details = {}) {
  checks.push({ name, status, details });
}

function overallStatus(checks) {
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }
  if (checks.some((check) => check.status === "degraded")) {
    return "degraded";
  }
  return "ok";
}
