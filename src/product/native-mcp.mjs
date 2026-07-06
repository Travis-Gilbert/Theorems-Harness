const DEFAULT_MCP_PATH = "/mcp";
const DEFAULT_LOCAL_MCP_URL = "http://127.0.0.1:8380/mcp";
const NO_LOCAL_FALLBACK_ENV = "THEOREMS_HARNESS_NO_LOCAL_FALLBACK";
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
  "native_tool",
  "nativeTool",
  "remote_token",
  "remoteToken",
  "remote_url",
  "remoteUrl",
  "timeout_ms",
  "timeoutMs",
  "token",
  "tool",
]);

export function nativeMcpConfigSchemaProperties() {
  return {
    mcp_url: { type: "string" },
    mcp_path: { type: "string" },
    remote_url: { type: "string" },
    token: { type: "string" },
    timeout_ms: { type: "number" },
  };
}

export async function callNativeMcpTool({
  input = {},
  nativeTool,
  productTool,
  requestId = productTool ?? nativeTool,
  arguments: explicitArguments,
} = {}) {
  const tool = String(nativeTool ?? input.native_tool ?? input.nativeTool ?? input.tool ?? "").trim();
  const product = String(productTool ?? tool ?? "native_mcp_call");
  const remoteUrl = remoteUrlFrom(input);
  const timeoutMs = Number(input.timeout_ms ?? input.timeoutMs ?? process.env.THEOREMS_HARNESS_REMOTE_TIMEOUT_MS ?? 2500);
  const args = explicitArguments ?? nativeArguments(input);

  if (!tool) {
    return degraded({
      reason: "contract_missing",
      productTool: product,
      nativeTool: tool,
      requested: args,
      message: "native MCP proxy requires a native tool name.",
    });
  }

  if (!remoteUrl) {
    return degraded({
      reason: "remote_unavailable",
      productTool: product,
      nativeTool: tool,
      requested: args,
      env: REMOTE_URL_ENV,
    });
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
        id: requestId,
        method: "tools/call",
        params: {
          name: tool,
          arguments: args,
        },
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    const body = parseJson(text);
    if (!response.ok) {
      return degraded({
        reason: "remote_unavailable",
        productTool: product,
        nativeTool: tool,
        remoteUrl: endpoint,
        httpStatus: response.status,
        error: body ?? text,
      });
    }
    if (body?.error) {
      return degraded({
        reason: body.error.code === -32602 || body.error.code === -32601
          ? "contract_missing"
          : "remote_unavailable",
        productTool: product,
        nativeTool: tool,
        remoteUrl: endpoint,
        httpStatus: response.status,
        error: body.error,
      });
    }
    return {
      schema_version: 1,
      ok: true,
      status: "ok",
      mode: "native-mcp-proxy",
      product_tool: product,
      native_tool: tool,
      remote_url: redactUrl(endpoint),
      result: unwrapMcpResult(body?.result),
    };
  } catch (caught) {
    return degraded({
      reason: "remote_unavailable",
      productTool: product,
      nativeTool: tool,
      remoteUrl: endpoint,
      httpStatus: 0,
      error: caught instanceof Error ? caught.message : String(caught),
    });
  } finally {
    clearTimeout(timeout);
  }
}

function nativeArguments(input) {
  const nested = input.arguments ?? input.args;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested;
  }
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

function degraded({
  reason,
  productTool,
  nativeTool,
  remoteUrl,
  httpStatus,
  error,
  requested,
  env,
  message,
}) {
  return {
    schema_version: 1,
    ok: false,
    status: "degraded",
    reason,
    product_tool: productTool,
    native_tool: nativeTool,
    remote_url: remoteUrl ? redactUrl(remoteUrl) : undefined,
    http_status: httpStatus,
    error,
    requested,
    env,
    message,
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
  const configured = String(
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
  if (configured) {
    return configured;
  }
  // An explicit empty url is a deliberate opt-out (tests and callers rely on
  // deterministic degraded states), so only fall back when nothing was set.
  if (hasExplicitRemoteUrl(input) || localFallbackSuppressed()) {
    return "";
  }
  return DEFAULT_LOCAL_MCP_URL;
}

function hasExplicitRemoteUrl(input) {
  return [input.mcp_url, input.mcpUrl, input.remote_url, input.remoteUrl]
    .some((value) => value !== undefined);
}

export function localFallbackSuppressed() {
  const raw = String(process.env[NO_LOCAL_FALLBACK_ENV] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
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
