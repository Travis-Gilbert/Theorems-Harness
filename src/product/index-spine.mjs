const NATIVE_INDEX_SPINE_TOOL = "rustyred_thg_index_spine";
const DEFAULT_MCP_PATH = "/mcp";
const REMOTE_URL_ENV = Object.freeze([
  "THEOREMS_HARNESS_MCP_URL",
  "THEOREM_HARNESS_MCP_URL",
  "THEOREM_MCP_URL",
  "THEOREMS_HARNESS_REMOTE_URL",
  "THEOREM_HARNESS_REMOTE_URL",
  "THEOREM_REMOTE_URL",
]);
const CONFIG_KEYS = new Set([
  "mcp_path",
  "mcpPath",
  "mcp_url",
  "mcpUrl",
  "remote_token",
  "remoteToken",
  "remote_url",
  "remoteUrl",
  "timeout_ms",
  "timeoutMs",
  "token",
]);

export async function queryIndexSpine(input = {}) {
  const remoteUrl = remoteUrlFrom(input);
  const timeoutMs = Number(input.timeout_ms ?? input.timeoutMs ?? process.env.THEOREMS_HARNESS_REMOTE_TIMEOUT_MS ?? 2500);
  const args = nativeArguments(input);

  if (!remoteUrl) {
    return {
      schema_version: 1,
      ok: false,
      status: "degraded",
      reason: "remote_unavailable",
      product_tool: "index_spine",
      native_tool: NATIVE_INDEX_SPINE_TOOL,
      requested: args,
      env: REMOTE_URL_ENV,
    };
  }

  const endpoint = mcpEndpoint(remoteUrl, input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: requestHeaders(input),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "index-spine",
        method: "tools/call",
        params: {
          name: NATIVE_INDEX_SPINE_TOOL,
          arguments: args,
        },
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    const body = parseJson(text);
    if (!response.ok) {
      return proxyFailure({
        reason: "remote_unavailable",
        remoteUrl: endpoint,
        httpStatus: response.status,
        error: body ?? text,
      });
    }
    if (body?.error) {
      return proxyFailure({
        reason: body.error.code === -32602 || body.error.code === -32601 ? "contract_missing" : "remote_unavailable",
        remoteUrl: endpoint,
        httpStatus: response.status,
        error: body.error,
      });
    }
    return {
      schema_version: 1,
      ok: true,
      status: "ok",
      mode: "remote-mcp-proxy",
      product_tool: "index_spine",
      native_tool: NATIVE_INDEX_SPINE_TOOL,
      remote_url: redactUrl(endpoint),
      result: unwrapMcpResult(body?.result),
    };
  } catch (caught) {
    return proxyFailure({
      reason: "remote_unavailable",
      remoteUrl: endpoint,
      httpStatus: 0,
      error: caught instanceof Error ? caught.message : String(caught),
    });
  } finally {
    clearTimeout(timeout);
  }
}

function nativeArguments(input) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => !CONFIG_KEYS.has(key))
      .filter(([, value]) => value !== undefined),
  );
}

function requestHeaders(input) {
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
  };
  const token = tokenFrom(input);
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

function proxyFailure({ reason, remoteUrl, httpStatus, error }) {
  return {
    schema_version: 1,
    ok: false,
    status: "degraded",
    reason,
    product_tool: "index_spine",
    native_tool: NATIVE_INDEX_SPINE_TOOL,
    remote_url: redactUrl(remoteUrl),
    http_status: httpStatus,
    error,
  };
}

function unwrapMcpResult(result) {
  const text = result?.content?.find((item) => item?.type === "text")?.text;
  if (!text) {
    return result ?? {};
  }
  return parseJson(text) ?? text;
}

function mcpEndpoint(remoteUrl, input) {
  const path = String(input.mcp_path ?? input.mcpPath ?? DEFAULT_MCP_PATH);
  if (remoteUrl.endsWith("/mcp") || remoteUrl.includes("/mcp?")) {
    return remoteUrl;
  }
  return new URL(path, ensureTrailingSlash(remoteUrl)).toString();
}

function remoteUrlFrom(input) {
  return String(
    input.mcp_url
      ?? input.mcpUrl
      ?? input.remote_url
      ?? input.remoteUrl
      ?? process.env.THEOREMS_HARNESS_MCP_URL
      ?? process.env.THEOREM_HARNESS_MCP_URL
      ?? process.env.THEOREM_MCP_URL
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
