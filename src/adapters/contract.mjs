export const ADAPTER_VERBS = Object.freeze([
  "prepareContext",
  "applySkill",
  "readCodeNeighborhood",
  "writeReceipt",
  "selectAffordance",
]);

export const DEGRADED_REASONS = Object.freeze([
  "no_manifest",
  "remote_unavailable",
  "empty_pack",
  "missing_token",
  "selector_empty",
  "contract_missing",
]);

export function adapterContract() {
  return {
    schema_version: 1,
    verbs: ADAPTER_VERBS,
    degraded_reasons: DEGRADED_REASONS,
    receipt_types: [
      "ContextPrepared",
      "CapabilityActivated",
      "CapabilityDegraded",
      "SkillUseStart",
      "SkillUseOutcome",
    ],
  };
}

export function validateAdapter(adapter) {
  const missing = ADAPTER_VERBS.filter((verb) => typeof adapter?.[verb] !== "function");
  if (missing.length) {
    throw new Error(`adapter is missing required verbs: ${missing.join(", ")}`);
  }
  return adapter;
}

export function adapterStatus(adapter) {
  return {
    id: String(adapter?.id ?? "unknown"),
    mode: String(adapter?.mode ?? "unknown"),
    verbs_supported: ADAPTER_VERBS.filter((verb) => typeof adapter?.[verb] === "function"),
    verbs_missing: ADAPTER_VERBS.filter((verb) => typeof adapter?.[verb] !== "function"),
  };
}

export function degraded(reason, details = {}) {
  return {
    ok: false,
    reason: DEGRADED_REASONS.includes(reason) ? reason : "remote_unavailable",
    ...details,
  };
}
