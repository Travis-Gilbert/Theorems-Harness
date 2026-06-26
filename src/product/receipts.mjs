import { createHash } from "node:crypto";
import { mkdir, appendFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

export function buildReceiptEvents(packet, event = {}, now = new Date()) {
  const base = {
    schema_version: 1,
    product: packet.product,
    source: "theorems-harness-product",
    cwd: packet.cwd,
    prompt_sha256: sha256(packet.prompt ?? ""),
    prompt_chars: String(packet.prompt ?? "").length,
    hook_event: event.hookEvent ?? event.hook_event_name ?? "",
    created_at: now.toISOString(),
  };

  return [
    {
      ...base,
      type: "ContextPrepared",
      status: packet.status,
      active_count: packet.active_capabilities.length,
      degraded_count: packet.degraded_capabilities.length,
    },
    ...packet.active_capabilities.map((capability) => ({
      ...base,
      type: "CapabilityActivated",
      capability_id: capability.id,
      title: capability.title,
      delivery: capability.delivery,
      receipts_expected: capability.receipts_required,
    })),
    ...packet.degraded_capabilities.map((capability) => ({
      ...base,
      type: "CapabilityDegraded",
      capability_id: capability.id,
      title: capability.title,
      reason: capability.reason,
      severity: capability.must_be_visible_to_model ? "blocking" : "degraded",
    })),
  ];
}

export async function appendReceipt(event, options = {}) {
  return appendReceipts([event], options);
}

export async function appendReceipts(events, options = {}) {
  const cwd = String(options.cwd ?? process.cwd());
  const path = receiptLogPath(cwd, options.path);
  await mkdir(dirname(path), { recursive: true });
  const body = events.map((event) => `${JSON.stringify(event)}\n`).join("");
  await appendFile(path, body, "utf8");
  return {
    ok: true,
    path,
    count: events.length,
  };
}

export function receiptLogPath(cwd, path) {
  const configured = path ?? process.env.THEOREMS_HARNESS_RECEIPT_LOG;
  if (configured) {
    return isAbsolute(configured) ? configured : resolve(cwd, configured);
  }
  return resolve(cwd, ".theorems-harness/receipts.jsonl");
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
