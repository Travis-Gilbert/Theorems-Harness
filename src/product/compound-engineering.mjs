import { localFallbackSuppressed } from "./native-mcp.mjs";

const NATIVE_COMPOUND_ROUTE = "/harness/compound-engineering";
const DEFAULT_LOCAL_HTTP_URL = "http://127.0.0.1:8380";
const DEFAULT_TENANT = "Travis-Gilbert";
const REMOTE_URL_ENV = Object.freeze([
  "THEOREMS_HARNESS_HTTP_URL",
  "THEOREM_HARNESS_HTTP_URL",
  "THEOREMS_HARNESS_REMOTE_URL",
  "THEOREM_HARNESS_REMOTE_URL",
  "THEOREM_REMOTE_URL",
]);
const TENANT_ENV = Object.freeze([
  "THEOREM_HARNESS_TENANT",
  "THEOREMS_HARNESS_TENANT",
  "THEOREM_TENANT_SLUG",
  "THEOREM_HARNESS_TENANT_SLUG",
  "RUSTYRED_THG_TENANT",
]);

export async function queryCompoundEngineering(input = {}) {
  const remoteUrl = remoteUrlFrom(input);
  const timeoutMs = Number(input.timeout_ms ?? input.timeoutMs ?? process.env.THEOREMS_HARNESS_REMOTE_TIMEOUT_MS ?? 2500);
  const tenant = tenantFrom(input);
  const requested = requestSummary(input, tenant);

  if (!remoteUrl) {
    return degraded({
      reason: "remote_unavailable",
      requested,
      env: REMOTE_URL_ENV,
    });
  }
  if (!tenant) {
    return degraded({
      reason: "tenant_unavailable",
      requested,
      env: TENANT_ENV,
    });
  }

  const endpoint = compoundEndpoint(remoteUrl, input, tenant);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: requestHeaders(input),
      signal: controller.signal,
    });
    const text = await response.text();
    const body = parseJson(text);
    if (!response.ok) {
      return degraded({
        reason: "remote_unavailable",
        requested,
        remoteUrl: endpoint,
        httpStatus: response.status,
        error: body ?? text,
      });
    }

    return {
      schema_version: 1,
      ok: true,
      status: "ok",
      mode: "remote-http-proxy",
      product_tool: "compound_engineering",
      native_route: NATIVE_COMPOUND_ROUTE,
      remote_url: redactUrl(endpoint),
      result: body ?? text,
    };
  } catch (caught) {
    return degraded({
      reason: "remote_unavailable",
      requested,
      remoteUrl: endpoint,
      httpStatus: 0,
      error: caught instanceof Error ? caught.message : String(caught),
    });
  } finally {
    clearTimeout(timeout);
  }
}

function compoundEndpoint(remoteUrl, input, tenant) {
  const route = String(input.http_path ?? input.httpPath ?? NATIVE_COMPOUND_ROUTE);
  const url = new URL(route, ensureTrailingSlash(remoteUrl));
  url.searchParams.set("tenant", tenant);
  for (const [inputKey, queryKey] of [
    ["cluster_key", "cluster_key"],
    ["clusterKey", "cluster_key"],
    ["since", "since"],
    ["limit", "limit"],
  ]) {
    const value = input[inputKey];
    if (value !== undefined && value !== null && String(value).trim()) {
      url.searchParams.set(queryKey, String(value).trim());
    }
  }
  return url.toString();
}

function requestHeaders(input) {
  const headers = {
    accept: "application/json",
  };
  const token = tokenFrom(input);
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

function requestSummary(input, tenant) {
  return {
    tenant: tenant || null,
    cluster_key: String(input.cluster_key ?? input.clusterKey ?? "").trim() || null,
    since: String(input.since ?? "").trim() || null,
    limit: Number(input.limit ?? 50),
  };
}

function degraded({ reason, requested, remoteUrl = "", httpStatus = 0, error = undefined, env = undefined }) {
  return {
    schema_version: 1,
    ok: false,
    status: "degraded",
    reason,
    product_tool: "compound_engineering",
    native_route: NATIVE_COMPOUND_ROUTE,
    remote_url: redactUrl(remoteUrl),
    http_status: httpStatus,
    requested,
    error,
    env,
  };
}

function remoteUrlFrom(input) {
  const configured = String(
    input.http_url
      ?? input.httpUrl
      ?? input.remote_url
      ?? input.remoteUrl
      ?? process.env.THEOREMS_HARNESS_HTTP_URL
      ?? process.env.THEOREM_HARNESS_HTTP_URL
      ?? process.env.THEOREMS_HARNESS_REMOTE_URL
      ?? process.env.THEOREM_HARNESS_REMOTE_URL
      ?? process.env.THEOREM_REMOTE_URL
      ?? "",
  ).trim();
  if (configured) {
    return configured;
  }
  // An explicit empty url is a deliberate opt-out, so only fall back when
  // nothing was set and the local fallback is not suppressed.
  if (hasExplicitRemoteUrl(input) || hasExplicitRemoteUrlEnv() || localFallbackSuppressed()) {
    return "";
  }
  return DEFAULT_LOCAL_HTTP_URL;
}

function hasExplicitRemoteUrl(input) {
  return [input.http_url, input.httpUrl, input.remote_url, input.remoteUrl]
    .some((value) => value !== undefined);
}

function hasExplicitRemoteUrlEnv() {
  return REMOTE_URL_ENV.some((key) => Object.prototype.hasOwnProperty.call(process.env, key));
}

function tenantFrom(input) {
  const configured = String(
    input.tenant
      ?? input.tenant_slug
      ?? input.tenantSlug
      ?? process.env.THEOREM_HARNESS_TENANT
      ?? process.env.THEOREMS_HARNESS_TENANT
      ?? process.env.THEOREM_TENANT_SLUG
      ?? process.env.THEOREM_HARNESS_TENANT_SLUG
      ?? process.env.RUSTYRED_THG_TENANT
      ?? "",
  ).trim();
  if (configured || localFallbackSuppressed()) {
    return configured;
  }
  return DEFAULT_TENANT;
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

function parseJson(text) {
  if (typeof text !== "string" || !text.trim()) return {};
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
