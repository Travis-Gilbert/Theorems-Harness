const WELL_KNOWN_PATH = "/.well-known/theorems-harness/doctor.json";
const DEFAULT_PROBES = Object.freeze({
  health: "/health",
  ready: "/ready",
  queue: "/diagnostics/queue",
  dependencies: "/diagnostics/dependencies",
  tenants: "/diagnostics/tenants",
});

export const HEAVY_WORK_KINDS = Object.freeze([
  "agent_runs",
  "code_indexing",
  "recall_hydration",
  "graph_compilation",
  "provider_calls",
]);

export const TENANT_GUARDS = Object.freeze([
  "quotas",
  "concurrency_limits",
  "queue_isolation",
  "rate_limits",
  "storage_namespaces",
  "noisy_neighbor_protection",
]);

export const DEPENDENCY_KINDS = Object.freeze([
  "deepseek",
  "valkey",
  "rustyred",
  "recall_index",
]);

const STRUCTURED_DEGRADED_STATUSES = new Set([
  "ok",
  "ready",
  "disabled",
  "degraded",
  "missing_token",
  "unavailable",
  "cold",
  "warming",
  "recovering",
]);

export async function runRemoteDoctor(input = {}) {
  const remoteUrl = remoteUrlFrom(input);
  const timeoutMs = Number(input.timeout_ms ?? input.timeoutMs ?? process.env.THEOREMS_HARNESS_REMOTE_TIMEOUT_MS ?? 2500);
  const checks = [];

  if (!remoteUrl) {
    addCheck(checks, "remote-config", "degraded", {
      reason: "remote_unavailable",
      env: ["THEOREMS_HARNESS_REMOTE_URL", "THEOREM_HARNESS_REMOTE_URL", "THEOREM_REMOTE_URL"],
    });
    return result("degraded", "", checks, {
      note: "Set THEOREMS_HARNESS_REMOTE_URL to run live service probes.",
    });
  }

  addCheck(checks, "remote-config", "ok", { remote_url: redactUrl(remoteUrl), timeout_ms: timeoutMs });

  const manifestProbe = await probeJson(remoteUrl, WELL_KNOWN_PATH, { ...input, timeoutMs, optional: true });
  const manifest = manifestProbe.ok && isObject(manifestProbe.body) ? manifestProbe.body : {};
  addCheck(checks, "doctor-manifest", manifestProbe.ok ? "ok" : "degraded", {
    path: WELL_KNOWN_PATH,
    reason: manifestProbe.ok ? undefined : "missing_probe",
    http_status: manifestProbe.http_status,
  });

  const endpoints = {
    ...DEFAULT_PROBES,
    ...(isObject(manifest.endpoints) ? manifest.endpoints : {}),
  };

  await addHealthCheck(checks, "remote-health", remoteUrl, endpoints.health, input, timeoutMs);
  await addReadyCheck(checks, "remote-readiness", remoteUrl, endpoints.ready, input, timeoutMs);

  const queueProbe = await probeJson(remoteUrl, endpoints.queue, { ...input, timeoutMs });
  addProbeEvaluation(checks, "queue-contract", queueProbe, evaluateQueueContract);

  const dependencyProbe = await probeJson(remoteUrl, endpoints.dependencies, { ...input, timeoutMs });
  addProbeEvaluation(checks, "dependency-isolation", dependencyProbe, evaluateDependencyContract);

  const tenantProbe = await probeJson(remoteUrl, endpoints.tenants, { ...input, timeoutMs });
  addProbeEvaluation(checks, "tenant-isolation", tenantProbe, evaluateTenantContract);

  return result(overallStatus(checks), redactUrl(remoteUrl), checks, {
    manifest: {
      ok: manifestProbe.ok,
      product: manifest.product,
      service: manifest.service,
    },
  });
}

export function formatRemoteDoctor(result) {
  const lines = [
    `Theorems Harness remote doctor: ${result.status}`,
    `Remote: ${result.remote_url || "(not configured)"}`,
    "",
    "Checks:",
    ...result.checks.map((check) => `- ${check.status} ${check.name}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function evaluateQueueContract(payload = {}) {
  const categories = payload.categories ?? payload.heavy_work ?? payload.queues ?? {};
  const missingCategories = [];
  const failingCategories = [];

  for (const kind of HEAVY_WORK_KINDS) {
    const item = categoryFor(categories, kind);
    if (!isObject(item)) {
      missingCategories.push(kind);
      continue;
    }
    const missing = missingQueueFields(item);
    if (missing.length) {
      failingCategories.push({ kind, missing });
    }
  }

  return {
    status: missingCategories.length || failingCategories.length ? "fail" : "ok",
    required_categories: HEAVY_WORK_KINDS,
    missing_categories: missingCategories,
    failing_categories: failingCategories,
    summary: "Heavy work must be durable, async by default, leased, heartbeating, retried, reaped, and public-call safe.",
  };
}

export function evaluateDependencyContract(payload = {}) {
  const dependencies = payload.dependencies ?? payload;
  const missingDependencies = [];
  const failingDependencies = [];
  const degradedDependencies = [];

  for (const kind of DEPENDENCY_KINDS) {
    const item = categoryFor(dependencies, kind);
    if (!isObject(item)) {
      missingDependencies.push(kind);
      continue;
    }
    const status = String(item.status ?? "unknown");
    const isolated = item.isolated === true || ["feature_only", "optional", "degraded_feature"].includes(String(item.blast_radius ?? ""));
    if (!STRUCTURED_DEGRADED_STATUSES.has(status) || !isolated) {
      failingDependencies.push({
        kind,
        status,
        isolated,
        blast_radius: item.blast_radius,
      });
      continue;
    }
    if (!["ok", "ready"].includes(status)) {
      degradedDependencies.push({ kind, status });
    }
  }

  return {
    status: missingDependencies.length || failingDependencies.length
      ? "fail"
      : degradedDependencies.length
        ? "degraded"
        : "ok",
    required_dependencies: DEPENDENCY_KINDS,
    missing_dependencies: missingDependencies,
    failing_dependencies: failingDependencies,
    degraded_dependencies: degradedDependencies,
    summary: "Dependency outages must return structured feature-level degradation, not service-wide failure.",
  };
}

export function evaluateTenantContract(payload = {}) {
  const policy = payload.default_policy ?? payload.policy ?? payload.tenant_policy ?? payload;
  const missingGuards = TENANT_GUARDS.filter((guard) => truthyFlag(policy, guard) !== true);
  return {
    status: missingGuards.length ? "fail" : "ok",
    required_guards: TENANT_GUARDS,
    missing_guards: missingGuards,
    active_tenants: Number(payload.active_tenants ?? payload.active_count ?? 0),
    summary: "Multiuser readiness requires per-tenant quotas, isolation, rate limits, storage namespaces, and noisy-neighbor protection.",
  };
}

async function addHealthCheck(checks, name, remoteUrl, path, input, timeoutMs) {
  const probe = await probeJson(remoteUrl, path, { ...input, timeoutMs });
  if (!probe.ok) {
    addCheck(checks, name, "fail", missingProbeDetails(probe, path));
    return;
  }
  addCheck(checks, name, "ok", { path, http_status: probe.http_status, body_status: bodyStatus(probe.body) });
}

async function addReadyCheck(checks, name, remoteUrl, path, input, timeoutMs) {
  const probe = await probeJson(remoteUrl, path, { ...input, timeoutMs, acceptStatuses: [200, 202, 503] });
  if (!probe.ok && probe.http_status !== 503) {
    addCheck(checks, name, "fail", missingProbeDetails(probe, path));
    return;
  }
  const status = bodyStatus(probe.body);
  const recovering = probe.http_status === 503 && ["recovering", "warming", "degraded"].includes(status);
  addCheck(checks, name, recovering ? "degraded" : probe.http_status === 503 ? "fail" : "ok", {
    path,
    http_status: probe.http_status,
    body_status: status,
  });
}

function addProbeEvaluation(checks, name, probe, evaluator) {
  if (!probe.ok) {
    addCheck(checks, name, "fail", missingProbeDetails(probe, probe.path));
    return;
  }
  const evaluation = evaluator(probe.body);
  addCheck(checks, name, evaluation.status, {
    path: probe.path,
    http_status: probe.http_status,
    ...evaluation,
  });
}

async function probeJson(remoteUrl, path, input = {}) {
  const timeoutMs = Number(input.timeoutMs ?? input.timeout_ms ?? 2500);
  const url = new URL(path, ensureTrailingSlash(remoteUrl));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const acceptStatuses = new Set(input.acceptStatuses ?? [200, 202]);
  try {
    const headers = {};
    const token = tokenFrom(input);
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    const response = await fetch(url, { headers, signal: controller.signal });
    const text = await response.text();
    const body = parseJson(text);
    return {
      ok: acceptStatuses.has(response.status),
      path,
      http_status: response.status,
      body,
      text: body === null ? text : undefined,
    };
  } catch (caught) {
    return {
      ok: false,
      path,
      http_status: 0,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function missingQueueFields(item) {
  const missing = [];
  if (truthyFlag(item, "async_default") !== true) missing.push("async_default");
  if (truthyFlag(item, "durable_queue") !== true && truthyFlag(item, "durable") !== true) missing.push("durable_queue");
  if (truthyFlag(item, "leases") !== true) missing.push("leases");
  if (truthyFlag(item, "heartbeats") !== true) missing.push("heartbeats");
  if (truthyFlag(item, "retries") !== true) missing.push("retries");
  if (truthyFlag(item, "reaper") !== true) missing.push("reaper");
  if (!publicContractOk(item)) missing.push("public_contract");
  return missing;
}

function publicContractOk(item) {
  const contract = String(item.public_contract ?? item.publicContract ?? "");
  return ["202_job_id", "structured_timeout"].includes(contract)
    || truthyFlag(item, "returns_202_job_id") === true
    || truthyFlag(item, "structured_timeout") === true;
}

function categoryFor(source, key) {
  if (!isObject(source)) return undefined;
  const camel = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
  const kebab = key.replaceAll("_", "-");
  return source[key] ?? source[camel] ?? source[kebab];
}

function truthyFlag(source, key) {
  const value = categoryFor(source, key);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes", "on", "enabled"].includes(value.toLowerCase());
  return value;
}

function remoteUrlFrom(input) {
  return String(
    input.remote_url
      ?? input.remoteUrl
      ?? process.env.THEOREMS_HARNESS_REMOTE_URL
      ?? process.env.THEOREM_HARNESS_REMOTE_URL
      ?? process.env.THEOREM_REMOTE_URL
      ?? "",
  ).trim();
}

function tokenFrom(input) {
  return String(
    input.token
      ?? input.remote_token
      ?? input.remoteToken
      ?? process.env.THEOREMS_HARNESS_REMOTE_TOKEN
      ?? process.env.THEOREM_HARNESS_REMOTE_TOKEN
      ?? "",
  ).trim();
}

function addCheck(checks, name, status, details = {}) {
  checks.push({ name, status, details });
}

function overallStatus(checks) {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "degraded")) return "degraded";
  return "ok";
}

function result(status, remoteUrl, checks, details = {}) {
  return {
    schema_version: 1,
    status,
    remote_url: remoteUrl,
    checks,
    details,
  };
}

function missingProbeDetails(probe, path) {
  return {
    reason: "missing_probe",
    path,
    http_status: probe.http_status,
    error: probe.error,
    body_status: bodyStatus(probe.body),
  };
}

function bodyStatus(body) {
  return String(body?.status ?? body?.phase ?? body?.state ?? "").toLowerCase();
}

function parseJson(text) {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
