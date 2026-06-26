import { createHash } from "node:crypto";

const GRAPHQL_TOOL = "graphql_query";
const DEFAULT_MCP_PATH = "/mcp";
const DEFAULT_LIMIT = 8;
const DEFAULT_PREVIEW_CHARS = 800;
const DEFAULT_CACHE_TTL_MS = 60_000;
const RRF_K = 60;
const JINA_RERANKER_V3 = "jinaai/jina-reranker-v3";
const GTE_RERANKER_MODERNBERT_BASE = "Alibaba-NLP/gte-reranker-modernbert-base";
const REMOTE_URL_ENV = Object.freeze([
  "THEOREMS_HARNESS_MCP_URL",
  "THEOREM_HARNESS_MCP_URL",
  "THEOREM_MCP_URL",
  "THEOREMS_HARNESS_REMOTE_URL",
  "THEOREM_HARNESS_REMOTE_URL",
  "THEOREM_REMOTE_URL",
]);
const LISTWISE_RERANKER_URL_ENV = Object.freeze([
  "THEOREMS_HARNESS_LISTWISE_RERANKER_URL",
  "THEOREM_LISTWISE_RERANKER_URL",
  "THEOREM_WEB_LISTWISE_URL",
  "RUSTYWEB_LISTWISE_RERANKER_URL",
]);
const CROSS_ENCODER_URL_ENV = Object.freeze([
  "THEOREMS_HARNESS_RERANKER_URL",
  "THEOREM_RERANKER_URL",
  "RUSTYRED_RERANKER_URL",
  "RUSTYWEB_RERANKER_URL",
]);
const CONFIG_KEYS = new Set([
  "cache",
  "cache_policy",
  "cachePolicy",
  "cache_ttl_ms",
  "cacheTtlMs",
  "cross_encoder_model",
  "cross_encoder_url",
  "crossEncoderModel",
  "crossEncoderUrl",
  "listwise_reranker_model",
  "listwise_reranker_url",
  "listwiseRerankerModel",
  "listwiseRerankerUrl",
  "mcp_path",
  "mcpPath",
  "mcp_url",
  "mcpUrl",
  "remote_token",
  "remoteToken",
  "remote_url",
  "remoteUrl",
  "reranker_kind",
  "reranker_model",
  "reranker_token",
  "reranker_url",
  "rerankerKind",
  "rerankerModel",
  "rerankerToken",
  "rerankerUrl",
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
  const rerankerConfig = rerankerConfigFrom(input);
  const cacheKey = cacheKeyFor({ remoteUrl, query, limit, previewChars, reranker: rerankerConfig.identity });
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

  const packet = await buildContextPacket({
    query,
    limit,
    previewChars,
    remoteUrl: graphql.remote_url,
    data: response?.data ?? {},
    cache: cacheState("miss", cacheKey, cacheTtlMs),
    rerankerConfig,
    timeoutMs,
  });

  if (!["bypass", "read_only"].includes(cachePolicy) && cacheTtlMs > 0) {
    writeCache(cacheKey, packet, cacheTtlMs);
  }

  return packet;
}

async function buildContextPacket({ query, limit, previewChars, remoteUrl, data, cache, rerankerConfig, timeoutMs }) {
  const candidates = contextCandidatesFromData(data);
  const { ranked, fusion } = await rankCandidatesWithReranker({
    query,
    candidates,
    limit,
    rerankerConfig,
    timeoutMs,
  });

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
    fusion,
    cache,
    limits: {
      top_k: limit,
      content_preview_chars: previewChars,
    },
  };
}

function contextCandidatesFromData(data) {
  return [
    ...memoryCandidates(data.memory ?? []),
    ...recordCandidates("query_receipt", data.queryReceipts ?? []),
    ...recordCandidates("context_view", data.contextViews ?? []),
    ...recordCandidates("map_artifact", data.mapArtifacts ?? []),
  ].map((candidate, index) => ({
    ...candidate,
    candidate_index: index,
  }));
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

async function rankCandidatesWithReranker({ query, candidates, limit, rerankerConfig, timeoutMs }) {
  const fallbackRanked = rankCandidates(query, candidates);
  if (!candidates.length) {
    return {
      ranked: [],
      fusion: weightedRrfFusion({
        reranker: {
          status: "not_needed",
          reason: "no_candidates",
        },
      }),
    };
  }

  const failures = [];
  const listwiseEndpoint = rerankerConfig.listwiseUrl
    ? rerankerEndpoint(rerankerConfig.listwiseUrl, "rerank")
    : "";
  if (listwiseEndpoint) {
    const listwise = await scoreWithReranker({
      endpoint: listwiseEndpoint,
      token: rerankerConfig.token,
      payload: {
        query,
        texts: candidates.map(candidateText),
        model: rerankerConfig.listwiseModel,
      },
      expectedLen: candidates.length,
      timeoutMs,
    });
    if (listwise.ok) {
      return {
        ranked: rankByModelScores({
          candidates,
          fallbackRanked,
          scores: listwise.scores,
          limit,
          kind: "listwise",
          model: rerankerConfig.listwiseModel,
        }),
        fusion: learnedFusion({
          mode: "learned_listwise_reranker",
          kind: "listwise",
          model: rerankerConfig.listwiseModel,
          endpoint: redactUrl(listwiseEndpoint),
          candidateCount: candidates.length,
        }),
      };
    }
    failures.push({
      kind: "listwise",
      model: rerankerConfig.listwiseModel,
      endpoint: redactUrl(listwiseEndpoint),
      reason: listwise.reason,
      error: listwise.error,
      http_status: listwise.http_status,
    });
  }

  const crossEncoderEndpoint = rerankerConfig.crossEncoderUrl
    ? rerankerEndpoint(rerankerConfig.crossEncoderUrl, "score")
    : "";
  if (crossEncoderEndpoint) {
    const crossEncoder = await scoreWithReranker({
      endpoint: crossEncoderEndpoint,
      token: rerankerConfig.token,
      payload: {
        query,
        text: candidateText(candidates[0]),
        texts: candidates.map(candidateText),
        model: rerankerConfig.crossEncoderModel,
      },
      expectedLen: candidates.length,
      timeoutMs,
    });
    if (crossEncoder.ok) {
      return {
        ranked: rankByModelScores({
          candidates,
          fallbackRanked,
          scores: crossEncoder.scores,
          limit,
          kind: "cross_encoder",
          model: rerankerConfig.crossEncoderModel,
        }),
        fusion: learnedFusion({
          mode: "learned_cross_encoder_reranker",
          kind: "cross_encoder",
          model: rerankerConfig.crossEncoderModel,
          endpoint: redactUrl(crossEncoderEndpoint),
          candidateCount: candidates.length,
        }),
      };
    }
    failures.push({
      kind: "cross_encoder",
      model: rerankerConfig.crossEncoderModel,
      endpoint: redactUrl(crossEncoderEndpoint),
      reason: crossEncoder.reason,
      error: crossEncoder.error,
      http_status: crossEncoder.http_status,
    });
  }

  const reranker = failures.length
    ? {
        status: "fallback_after_learned_error",
        attempted: failures,
        fallback: "weighted_rrf",
      }
    : {
        status: "not_configured",
        reason: "no_learned_reranker_url",
        env: {
          listwise: LISTWISE_RERANKER_URL_ENV,
          cross_encoder: CROSS_ENCODER_URL_ENV,
        },
        fallback: "weighted_rrf",
      };

  return {
    ranked: fallbackRanked.slice(0, limit),
    fusion: weightedRrfFusion({ reranker }),
  };
}

function rankByModelScores({ candidates, fallbackRanked, scores, limit, kind, model }) {
  const fallbackRank = new Map(fallbackRanked.map((candidate, index) => [candidate.candidate_index, index]));
  return candidates
    .map((candidate, index) => {
      const score = scores[index];
      return {
        ...candidate,
        score: Number(score.toFixed(6)),
        rank_signals: [
          `source:${candidate.source}`,
          `reranker:${kind}`,
          `model:${model}`,
          `model_score:${score.toFixed(6)}`,
        ],
      };
    })
    .sort((left, right) => (
      right.score - left.score
      || (fallbackRank.get(left.candidate_index) ?? left.rank) - (fallbackRank.get(right.candidate_index) ?? right.rank)
      || left.id.localeCompare(right.id)
    ))
    .slice(0, limit);
}

async function scoreWithReranker({ endpoint, token, payload, expectedLen, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: rerankerHeaders(token),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    const body = parseJson(text);
    if (!response.ok) {
      return {
        ok: false,
        reason: "reranker_unavailable",
        http_status: response.status,
        error: body ?? text,
      };
    }
    const scores = parseRerankerScores(body, expectedLen);
    if (!scores) {
      return {
        ok: false,
        reason: "reranker_response_missing_scores",
        http_status: response.status,
        error: body ?? text,
      };
    }
    return {
      ok: true,
      scores,
    };
  } catch (caught) {
    return {
      ok: false,
      reason: "reranker_unavailable",
      http_status: 0,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseRerankerScores(value, expectedLen) {
  if (expectedLen === 0) return [];
  const indexed = parseIndexedScores(value);
  if (indexed.size) {
    const scores = Array.from({ length: expectedLen }, (_unused, index) => indexed.get(index));
    return scores.every(Number.isFinite) ? scores : null;
  }

  const directScores = scoreArrayFrom(value);
  if (directScores.length === expectedLen) {
    return directScores.map(normalizeModelScore);
  }

  const orderScores = orderScoresFrom(value, expectedLen);
  return orderScores.length === expectedLen ? orderScores : null;
}

function parseIndexedScores(value) {
  const rows = Array.isArray(value)
    ? value
    : (value?.results ?? value?.data ?? value?.scores ?? []);
  const indexed = new Map();
  if (!Array.isArray(rows)) return indexed;
  for (const row of rows) {
    const index = Number(row?.index ?? row?.document_index ?? row?.documentIndex ?? row?.candidate_index ?? row?.candidateIndex);
    const score = scoreNumber(row?.score ?? row?.relevance_score ?? row?.relevanceScore ?? row?.rerank_score ?? row?.rerankScore);
    if (Number.isInteger(index) && Number.isFinite(score)) {
      indexed.set(index, normalizeModelScore(score));
    }
  }
  return indexed;
}

function scoreArrayFrom(value) {
  const scores = Array.isArray(value)
    ? value
    : (value?.scores ?? value?.results ?? value?.data);
  if (!Array.isArray(scores)) return [];
  return scores
    .map((score) => scoreNumber(typeof score === "object" ? score?.score : score))
    .filter(Number.isFinite);
}

function orderScoresFrom(value, expectedLen) {
  const order = value?.ranked_indices ?? value?.rankedIndices ?? value?.indices ?? value?.ranking ?? value?.order;
  if (!Array.isArray(order)) return [];
  const indices = order
    .map((item) => Number(typeof item === "object" ? item?.index ?? item?.document_index ?? item?.documentIndex : item))
    .filter((index) => Number.isInteger(index) && index >= 0 && index < expectedLen);
  if (indices.length !== expectedLen) return [];
  const scores = Array(expectedLen).fill(0);
  indices.forEach((candidateIndex, rank) => {
    scores[candidateIndex] = (expectedLen - rank) / expectedLen;
  });
  return scores;
}

function weightedRrfFusion({ reranker }) {
  return {
    mode: "weighted_rrf",
    rrf_k: RRF_K,
    source_weights: SOURCE_WEIGHTS,
    reranker,
  };
}

function learnedFusion({ mode, kind, model, endpoint, candidateCount }) {
  return {
    mode,
    rrf_k: RRF_K,
    source_weights: SOURCE_WEIGHTS,
    reranker: {
      status: "used",
      kind,
      model,
      endpoint,
      candidate_count: candidateCount,
      fallback: "weighted_rrf",
    },
  };
}

function candidateText(candidate) {
  return [
    candidate.title,
    candidate.summary,
    candidate.content_preview,
    candidate.tags.join(" "),
    JSON.stringify(candidate.properties ?? {}),
  ]
    .filter(Boolean)
    .join("\n");
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

function rerankerHeaders(token) {
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
  };
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

function rerankerEndpoint(baseOrEndpoint, path) {
  const trimmed = String(baseOrEndpoint).trim().replace(/\/+$/u, "");
  if (!trimmed) return "";
  if (trimmed.endsWith("/score") || trimmed.endsWith("/rerank")) {
    return trimmed;
  }
  return `${trimmed}/${path}`;
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

function rerankerConfigFrom(input) {
  const genericRerankerUrl = String(input.reranker_url ?? input.rerankerUrl ?? "").trim();
  const rerankerKind = String(input.reranker_kind ?? input.rerankerKind ?? "").trim().toLowerCase();
  const explicitListwiseUrl = String(input.listwise_reranker_url ?? input.listwiseRerankerUrl ?? "").trim();
  const explicitCrossEncoderUrl = String(input.cross_encoder_url ?? input.crossEncoderUrl ?? "").trim();
  const listwiseUrl = explicitListwiseUrl
    || envNonempty(LISTWISE_RERANKER_URL_ENV)
    || (["listwise", "jina", "candidate_set", "candidate-set"].includes(rerankerKind) ? genericRerankerUrl : "");
  const crossEncoderUrl = explicitCrossEncoderUrl
    || envNonempty(CROSS_ENCODER_URL_ENV)
    || (listwiseUrl ? "" : genericRerankerUrl);
  const listwiseModel = String(
    input.listwise_reranker_model
      ?? input.listwiseRerankerModel
      ?? input.reranker_model
      ?? input.rerankerModel
      ?? process.env.THEOREMS_HARNESS_LISTWISE_RERANKER_MODEL
      ?? process.env.THEOREM_LISTWISE_RERANKER_MODEL
      ?? process.env.THEOREM_WEB_LISTWISE_MODEL
      ?? process.env.RUSTYWEB_LISTWISE_RERANKER_MODEL
      ?? JINA_RERANKER_V3,
  ).trim();
  const crossEncoderModel = String(
    input.cross_encoder_model
      ?? input.crossEncoderModel
      ?? input.reranker_model
      ?? input.rerankerModel
      ?? process.env.THEOREMS_HARNESS_RERANKER_MODEL
      ?? process.env.THEOREM_RERANKER_MODEL
      ?? process.env.RUSTYRED_RERANKER_MODEL
      ?? GTE_RERANKER_MODERNBERT_BASE,
  ).trim();
  const token = String(
    input.reranker_token
      ?? input.rerankerToken
      ?? process.env.THEOREMS_HARNESS_RERANKER_TOKEN
      ?? process.env.THEOREM_RERANKER_TOKEN
      ?? "",
  ).trim();
  return {
    listwiseUrl,
    crossEncoderUrl,
    listwiseModel,
    crossEncoderModel,
    token,
    identity: {
      listwise_endpoint: listwiseUrl ? redactUrl(rerankerEndpoint(listwiseUrl, "rerank")) : "",
      listwise_model: listwiseUrl ? listwiseModel : "",
      cross_encoder_endpoint: crossEncoderUrl ? redactUrl(rerankerEndpoint(crossEncoderUrl, "score")) : "",
      cross_encoder_model: crossEncoderUrl ? crossEncoderModel : "",
    },
  };
}

function envNonempty(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
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

function scoreNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeModelScore(score) {
  if (score >= 0 && score <= 1) {
    return score;
  }
  return 1 / (1 + Math.exp(-score));
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
