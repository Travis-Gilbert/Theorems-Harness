import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { loadCapabilityManifest, productRoot } from "./load-manifest.mjs";
import { buildReceiptEvents } from "./receipts.mjs";

export async function compileContext(input = {}, options = {}) {
  const root = options.root ?? productRoot();
  const manifest = options.manifest ?? (await loadCapabilityManifest(root));
  const event = normalizeInput(input);
  const activeCapabilities = [];
  const degradedCapabilities = [];

  for (const capability of manifest.capabilities) {
    if (!matchesCapability(capability, event)) {
      continue;
    }

    const degradedReason = degradedReasonFor(capability, event);
    if (degradedReason) {
      degradedCapabilities.push({
        id: capability.id,
        title: capability.title,
        reason: degradedReason,
        must_be_visible_to_model: Boolean(capability.must_be_visible_to_model),
      });
      continue;
    }

    activeCapabilities.push(toVisibleCapability(capability));
  }

  const status = degradedCapabilities.some((item) => isMustVisible(manifest, item.id))
    ? "degraded"
    : "ok";
  const packet = {
    schema_version: 1,
    status,
    product: manifest.product,
    cwd: event.cwd,
    prompt: event.prompt,
    active_capabilities: activeCapabilities,
    degraded_capabilities: degradedCapabilities,
    receipts_required: activeCapabilities.flatMap((capability) => capability.receipts_required),
  };
  packet.receipt_events = buildReceiptEvents(packet, event);

  return {
    packet,
    markdown: renderMarkdown(packet),
  };
}

export function matchesCapability(capability, event) {
  const triggers = capability.triggers ?? {};

  if (matchesRegex(triggers.prompt_regex, event.prompt)) {
    return true;
  }
  if (matchesRegex(triggers.tool_name_regex, event.toolName)) {
    if (!triggers.tool_input_regex || matchesRegex(triggers.tool_input_regex, event.toolInput)) {
      return true;
    }
  }
  if (Array.isArray(triggers.file_extensions)) {
    if (event.changedFiles.some((file) => triggers.file_extensions.includes(extensionOf(file)))) {
      return true;
    }
  }
  if (Array.isArray(triggers.file_names)) {
    if (event.changedFiles.some((file) => triggers.file_names.includes(baseName(file)))) {
      return true;
    }
  }
  if (Array.isArray(triggers.hook_events)) {
    if (triggers.hook_events.includes(event.hookEvent)) {
      return true;
    }
  }

  return false;
}

function normalizeInput(input) {
  const prompt = String(input.prompt ?? input.task ?? input.query ?? "");
  const changedFiles = normalizeFileList(
    input.changed_files ?? input.changedFiles ?? input.files ?? input.footprint ?? [],
  );
  return {
    prompt,
    cwd: String(input.cwd ?? process.cwd()),
    hookEvent: String(input.hook_event_name ?? input.hookEvent ?? ""),
    toolName: String(input.tool_name ?? input.toolName ?? input.tool?.name ?? input.tool ?? ""),
    toolInput: JSON.stringify(input.tool_input ?? input.toolInput ?? input.arguments ?? {}),
    changedFiles,
    remoteReady: Boolean(input.remote_ready ?? input.remoteReady ?? remoteReadyFromEnv()),
  };
}

function normalizeFileList(value) {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function degradedReasonFor(capability, event) {
  if (!capability.requires_remote) {
    return "";
  }
  const manifestPath = capability.backing?.manifest_path;
  if (manifestPath && !existsSync(resolve(event.cwd, manifestPath))) {
    return "no_manifest";
  }
  if (!event.remoteReady && !capability.local_fallback) {
    return "remote_unavailable";
  }
  return "";
}

function toVisibleCapability(capability) {
  return {
    id: capability.id,
    title: capability.title,
    delivery: capability.delivery,
    priority: capability.priority ?? 0,
    source: capability.local_fallback ?? null,
    directive: capability.context?.directive ?? "",
    workflow: capability.context?.workflow ?? [],
    validation_defaults: capability.context?.validation_defaults ?? [],
    anti_patterns: capability.context?.anti_patterns ?? [],
    receipts_required: Object.values(capability.receipts ?? {}).flatMap((value) => {
      if (Array.isArray(value)) {
        return value;
      }
      return value ? [String(value)] : [];
    }),
  };
}

function renderMarkdown(packet) {
  const active = packet.active_capabilities.length
    ? packet.active_capabilities.map(renderCapability).join("\n\n")
    : "(none)";
  const degraded = packet.degraded_capabilities.length
    ? packet.degraded_capabilities
        .map((capability) => `- ${capability.title}: ${capability.reason}`)
        .join("\n")
    : "(none)";

  return [
    "## Theorems Harness Product Packet",
    "",
    `Status: ${packet.status}`,
    "",
    "### Active Capabilities",
    active,
    "",
    "### Degraded Capabilities",
    degraded,
  ].join("\n");
}

function renderCapability(capability) {
  const lines = [
    `#### ${capability.title}`,
    `- id: ${capability.id}`,
    `- delivery: ${capability.delivery}`,
  ];
  if (capability.directive) {
    lines.push(`- directive: ${capability.directive}`);
  }
  if (capability.validation_defaults.length) {
    lines.push("- validation defaults:");
    lines.push(...capability.validation_defaults.map((item) => `  - ${item}`));
  }
  return lines.join("\n");
}

function matchesRegex(pattern, value) {
  if (!pattern || !value) {
    return false;
  }
  return new RegExp(pattern, "i").test(value);
}

function extensionOf(path) {
  const match = String(path).match(/(\.[^./\\]+)$/);
  return match?.[1] ?? "";
}

function baseName(path) {
  return String(path).split(/[\\/]/).pop() ?? "";
}

function isMustVisible(manifest, capabilityId) {
  return manifest.capabilities.some(
    (capability) => capability.id === capabilityId && capability.must_be_visible_to_model,
  );
}

function remoteReadyFromEnv() {
  return ["1", "true", "yes"].includes(
    String(process.env.THEOREMS_HARNESS_REMOTE_READY ?? "").toLowerCase(),
  );
}
