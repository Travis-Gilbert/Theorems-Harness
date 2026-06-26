import { createHash } from "node:crypto";

const GRAPHQL_TOOL = "graphql_query";
const DEFAULT_MCP_PATH = "/mcp";
const DEFAULT_LIMIT = 8;
const DEFAULT_PREVIEW_CHARS = 800;
const DEFAULT_CACHE_TTL_MS = 60_000;
const RRF_K = 60;
const REMOTE_URL_ENV = Object.freeze([
  "THEOREMS_HARNESS_MCP_URL",
  "THEOREM_HARNESS_MCP_URL",
  "THEOREM_MCP_URL",
  "THEOREMS_HARNESS_REMOTE_URL",
  "THEOREM_HARNESS_REMOTE_URL",
  "THEOREM_REMOTE_URL",
]);
const CONFIG_KEYS = new Set([
  "cache",
  "cache_policy",
  "cachePolicy",
  "cache_ttl_ms",
  "cacheTtlMs",
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
const SOURCE_WEIGHTS = Object.freeze({
  memory: 1.25,
  context_view: 0.85,
  query_receipt: 0.75,
  map_artifact: 0.65,
});
const INDEX_CONTEXT_QUERY = `
query TheoremsHarnessIndexContext($query: String!, $limit: Int!, $previewChars: Int!) {
  indexSpineOverview {
    ok
    counts
    reliability
    routes
    limit
  }
  memory(
    query: $query
    limit: $limit
    includeLowFitness: true
    contentPreviewChars: $previewChars
  ) {
    id
    kind
    title
    summary
    contentPreview
    tags
    fitness
    updatedAt
  }
  queryReceipts(limit: $limit) {
    nodeId
    labels
    version
    properties
  }
  contextViews(limit: $limit) {
    nodeId
    labels
    version
    properties
  }
  mapArtifacts(limit: $limit) {
    nodeId
    labels
    version
    properties
  }
  trainingExportValidation(limit: $limit) {
    ok
    totalRecords
    statusCounts
    blockedRecordIds
  }
}
`;

const CACHE = new Map();

export async function queryIndexContext(input = {}) {
  const remoteUrl = remoteUrlFrom(input);
  const timeoutMs = Number(input.timeout_ms ?? input.timeoutMs ?? process.env.THEOREMS_HARNESS_REMOTE_TIMEOUT_MS ?? 2500);
  const limit = clampPositive(input.limit, DEFAULT_LIMIT, 50);
  const previewChars = clampPositive(input.content_preview_chars ?? input.contentPreviewChars, DEFAULT_PREVIEW_CHARS, 4_000);
  const query = String(input.query ?? input.prompt ?? input.task ?? "").trim();
  const cacheKey = cacheKeyFor({ remoteUrl, query, limit, previewChars });
  const cachePolicy = String(input.cache_policy ?? input.cachePolicy ?? input.cache ?? "read_write");
  const cacheTtlMs = Number(input.cache_ttl_ms ?? input.cacheTtlMs ?? process.env.THEOREMS_HARNESS_INDEX_CACHE_TTL_MS ?? DEFAULT_CACHE_TTL_MS);

  if (!query) {
    return degraded("empty_query", {
      message: "index_context requires a non-empty query, prompt, or task.",
    });
  }

  if (!remoteUrl) {
    return degraded("remote_unavailable", {
      requested: { query, limit, preview_chars: previewChars },
      env: REMOTE_URL_ENV,
      cache: cacheState("bypass", cacheKey, cacheTtlMs),
    });
  }

  if (!["bypass", "write_only"].includes(cachePolicy)) {
    const hit = readCache(cacheKey);
    if (hit) {
      return {
        ...hit,
        cache: cacheState("hit", cacheKey, hit.cache?.ttl_ms ?? cacheTtlMs),
      };
    }
  }

  const graphql = await callRemoteMcpTool({
    remoteUrl,
    tool: GRAPHQL_TOOL,
    arguments: {
      query: INDEX_CONTEXT_QUERY,
      variables: {
        query,
        limit,
        previewChars,
      },
    },
    input,
    timeoutMs,
    requestId: "index-context",
  });

  if (!graphql.ok) {
    return {
      ...degraded(graphql.reason, {
        native_tool: GRAPHQL_TOOL,
        error: graphql.error,
        http_status: graphql.http_status,
        cache: cacheState("miss", cacheKey, cacheTtlMs),
      }),
      remote_url: graphql.remote_url,
    };
  }

  const response = unwrapMcpResult(graphql.result);
  if (Array.isArray(response?.errors) && response.errors.length) {
    return {
      ...degraded("contract_missing", {
        native_tool: GRAPHQL_TOOL,
        errors: response.errors,
        cache: cacheState("miss", cacheKey, cacheTtlMs),
      }),
      remote_url: graphql.remote_url,
    };
  }

  const packet = buildContextPacket({
    query,
    limit,
    previewChars,
    remoteUrl: graphql.remote_url,
    data: response?.data ?? {},
    cache: cacheState("miss", cacheKey, cacheTtlMs),
  });

  if (!["bypass", "read_only"].includes(cachePolicy) && cacheTtlMs > 0) {
    writeCache(cacheKey, packet, cacheTtlMs);
  }

  return packet;
}

function buildContextPacket({ query, limit, previewChars, remoteUrl, data, cache }) {
  const candidates = [
    ...memoryCandidates(data.memory ?? []),
    ...recordCandidates("query_receipt", data.queryReceipts ?? []),
    ...recordCandidates("context_view", data.contextViews ?? []),
    ...recordCandidates("map_artifact", data.mapArtifacts ?? []),
  ];
  const ranked = rankCandidates(query, candidates).slice(0, limit);

  return {
    schema_version: 1,
    ok: true,
    status: "ok",
    product_tool: "index_context",
    mode: "graphql-index-context",
    remote_url: remoteUrl,
    query,
    top_context: ranked.map(toContextItem),
    index: {
      overview: data.indexSpineOverview ?? {},
      training_export_validation: data.trainingExportValidation ?? {},
    },
    fusion: {
      mode: "weighted_rrf",
      rrf_k: RRF_K,
      source_weights: SOURCE_WEIGHTS,
      reranker: {
        status: "fallback_not_model_reranked",
        handoff: "A substrate reranker can replace weighted_rrf behind this contract without changing the MCP tool shape.",
      },
    },
    cache,
    limits: {
      top_k: limit,
      content_preview_chars: previewChars,
    },
  };
}

function memoryCandidates(items) {
  return items.map((item, index) => ({
    id: String(item.id ?? ""),
    source: "memory",
    rank: index + 1,
    labels: [String(item.kind ?? "memory")],
    title: item.title ?? item.summary ?? item.gist ?? "",
    summary: item.summary ?? item.gist ?? "",
    content_preview: item.contentPreview ?? item.content_preview ?? "",
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    score_hint: numberOrZero(item.fitness),
    properties: {
      updated_at: item.updatedAt ?? item.updated_at ?? "",
    },
  }));
}

function recordCandidates(source, items) {
  return items.map((item, index) => {
    const properties = item.properties ?? {};
    return {
      id: String(item.nodeId ?? item.node_id ?? ""),
      source,
      rank: index + 1,
      labels: Array.isArray(item.labels) ? item.labels.map(String) : [],
      title: stringFrom(properties, ["title", "name", "label", "query", "view_id", "map_id"]),
      summary: stringFrom(properties, ["summary", "description", "reason", "purpose"]),
      content_preview: stringFrom(properties, ["content_preview", "preview", "body", "query"]),
      tags: arrayFrom(properties, ["tags", "signals", "rank_signals"]),
      score_hint: numberOrZero(properties.score ?? properties.fitness ?? properties.confidence),
      properties,
    };
  });
}

function rankCandidates(query, candidates) {
  const queryTokens = tokenSet(query);
  return candidates
    .map((candidate) => {
      const sourceWeight = SOURCE_WEIGHTS[candidate.source] ?? 0.5;
      const rrf = sourceWeight / (RRF_K + candidate.rank);
      const textScore = lexicalScore(queryTokens, candidate);
      const scoreHint = Math.max(0, Math.min(1, candidate.score_hint));
      return {
        ...candidate,
        score: Number((rrf + (0.035 * textScore) + (0.015 * scoreHint)).toFixed(6)),
        rank_signals: [
          `source:${candidate.source}`,
          `rrf:${rrf.toFixed(5)}`,
          `lexical:${textScore.toFixed(3)}`,
        ],
      };
    })
    .sort((left, right) => right.score - left.score || left.rank - right.rank || left.id.localeCompare(right.id));
}

function toContextItem(candidate) {
  return {
    id: candidate.id,
    source: candidate.source,
    score: candidate.score,
    labels: candidate.labels,
    title: candidate.title,
    summary: candidate.summary,
    content_preview: candidate.content_preview,
    tags: candidate.tags,
    rank_signals: candidate.rank_signals,
    properties: candidate.properties,
  };
}

async function callRemoteMcpTool({ remoteUrl, tool, arguments: args, input, timeoutMs, requestId }) {
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
      return remoteFailure("remote_unavailable", endpoint, response.status, body ?? text);
    }
    if (body?.error) {
      const reason = body.error.code === -32602 || body.error.code === -32601
        ? "contract_missing"
        : "remote_unavailable";
      return remoteFailure(reason, endpoint, response.status, body.error);
    }
    return {
      ok: true,
      remote_url: redactUrl(endpoint),
      result: body?.result,
    };
  } catch (caught) {
    return remoteFailure(
      "remote_unavailable",
      endpoint,
      0,
      caught instanceof Error ? caught.message : String(caught),
    );
  } finally {
    clearTimeout(timeout);
  }
}

function remoteFailure(reason, remoteUrl, httpStatus, error) {
  return {
    ok: false,
    reason,
    remote_url: redactUrl(remoteUrl),
    http_status: httpStatus,
    error,
  };
}

function readCache(key) {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    CACHE.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key, value, ttlMs) {
  CACHE.set(key, {
    expiresAt: Date.now() + ttlMs,
    value: {
      ...value,
      cache: cacheState("stored", key, ttlMs),
    },
  });
}

function cacheKeyFor(value) {
  return `index-context:${createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")
    .slice(0, 24)}`;
}

function cacheState(status, key, ttlMs) {
  return {
    status,
    key,
    ttl_ms: ttlMs,
    backend: "process-memory",
    valkey_ready: "Use the same stable key with Valkey when the product MCP runs as a long-lived service.",
  };
}

function degraded(reason, details = {}) {
  return {
    schema_version: 1,
    ok: false,
    status: "degraded",
    reason,
    product_tool: "index_context",
    ...details,
  };
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

function lexicalScore(queryTokens, candidate) {
  if (!queryTokens.size) return 0;
  const candidateTokens = tokenSet([
    candidate.title,
    candidate.summary,
    candidate.content_preview,
    candidate.tags.join(" "),
    JSON.stringify(candidate.properties ?? {}),
  ].join(" "));
  let overlap = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap / queryTokens.size;
}

function tokenSet(value) {
  return new Set(
    String(value)
      .toLowerCase()
      .split(/[^a-z0-9_./:-]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length > 2),
  );
}

function stringFrom(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
}

function arrayFrom(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (Array.isArray(value)) {
      return value.map(String);
    }
  }
  return [];
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampPositive(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function parseJson(text) {
  if (typeof text !== "string" || !text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
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
