import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function productRoot() {
  return PRODUCT_ROOT;
}

export async function loadCapabilityManifest(root = PRODUCT_ROOT) {
  const manifestPath = resolve(root, "capabilities/capability-manifest.json");
  const manifest = await readJson(manifestPath);
  const capabilities = [];

  for (const entry of manifest.capabilities ?? []) {
    const capabilityPath = resolve(dirname(manifestPath), entry);
    capabilities.push(await readJson(capabilityPath));
  }

  capabilities.sort((left, right) => {
    const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
    return priorityDelta || String(left.id).localeCompare(String(right.id));
  });

  return {
    ...manifest,
    capabilities,
    root,
  };
}

async function readJson(path) {
  const text = await readFile(path, "utf8");
  return JSON.parse(text);
}
