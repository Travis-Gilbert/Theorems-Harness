#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";

import { createLocalAdapter } from "../adapters/local-adapter.mjs";
import { compileContext } from "../product/compile-context.mjs";
import { queryCompoundEngineering } from "../product/compound-engineering.mjs";
import { runDoctor } from "../product/doctor.mjs";
import { queryGrep, querySemanticGrep } from "../product/grep.mjs";
import { queryIndexContext } from "../product/index-context.mjs";
import { queryIndexSpine } from "../product/index-spine.mjs";
import { loadCapabilityManifest } from "../product/load-manifest.mjs";
import { callNativeMcpTool, nativeMcpConfigSchemaProperties } from "../product/native-mcp.mjs";
import { runRemoteDoctor } from "../product/remote-doctor.mjs";
import { loadCapabilityScorecards } from "../product/scorecards.mjs";
import { reconstructBinaryFromSource } from "../product/binary-from-source.mjs";

const PACKAGE_VERSION = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
).version;

const NATIVE_TOOL_ALIASES = Object.freeze({
  code_ingest: "code_ingest",
  datawave_ingest: "datawave_ingest",
  graphql_introspect: "graphql_introspect",
  graphql_mutate: "graphql_mutate",
  graphql_query: "graphql_query",
  reconstruct_binary: "reconstruct_binary",
  reverse_engineer_compose: "reverse_engineer_compose",
});
const DATA_API_PRODUCT_TOOLS = new Set([
  "query_data",
  "retrieve_memory",
  "turn_start",
  "evidence_bundle",
  "understand_code",
  "impact",
  "oracle",
  "observe_web",
  "harness_run",
  "harness_prepare",
  "harness_append_transition",
  "composed_agent_run",
  "multihead_run",
  "spawn_session",
]);
const GREP_NATIVE_BACKENDS = new Set([
  "native",
  "remote",
  "code_graph",
  "code-graph",
  "compute_code",
  "compute-code",
]);
const MEMORY_GREP_SOURCES = new Set([
  "memory",
  "memory_docs",
  "memory-docs",
  "records",
  "data",
  "data_api",
  "data-api",
]);
const WEB_GREP_SOURCES = new Set([
  "web",
  "url",
  "urls",
  "docs",
  "api",
]);
const COMPOUND_CONFIG_KEYS = new Set([
  "args",
  "arguments",
  "kind",
  "mcp_path",
  "mcpPath",
  "mcp_url",
  "mcpUrl",
  "mode",
  "native_tool",
  "nativeTool",
  "remote_token",
  "remoteToken",
  "remote_url",
  "remoteUrl",
  "surface",
  "timeout_ms",
  "timeoutMs",
  "token",
  "tool",
]);
const RECONSTRUCT_COMPOSE_MODES = new Set([
  "compose",
  "repo",
  "source",
  "source_repo",
  "source-repo",
  "reverse_engineer_compose",
  "reverse-engineer-compose",
]);
const RECONSTRUCT_BINARY_MODES = new Set([
  "binary",
  "binary_from_source",
  "binary-from-source",
  "ghidra",
  "reconstruct_binary",
  "reconstruct-binary",
  "load",
  "analyze",
  "lift",
  "plan",
  "instruction",
  "instruction_get",
  "instruction-get",
  "validate",
]);
const RECONSTRUCT_DATAWAVE_MODES = new Set([
  "datawave",
  "datawave_ingest",
  "datawave-ingest",
  "describe",
  "record",
  "ingest_record",
  "ingest-record",
  "batch",
  "ingest_batch",
  "ingest-batch",
  "lookup",
  "intersect",
]);
const CODE_INGEST_MODES = new Set([
  "code_ingest",
  "code-ingest",
  "ingest",
  "reindex",
  "session_reingest",
  "session-reingest",
]);
const SELECTION_ONLY_OPERATIONS = new Set([
  "binary",
  "binary_from_source",
  "binary-from-source",
  "code_ingest",
  "code-ingest",
  "compose",
  "compute_code",
  "compute-code",
  "datawave",
  "datawave_ingest",
  "datawave-ingest",
  "ghidra",
  "reconstruct_binary",
  "reconstruct-binary",
  "repo",
  "reverse_engineer_compose",
  "reverse-engineer-compose",
  "source",
  "source_repo",
  "source-repo",
]);

export async function handleRpcMessage(message) {
  if (message.method === "initialize") {
    return ok(message.id, {
      protocolVersion: "2024-11-05",
      serverInfo: {
        name: "theorems-harness-product",
        version: PACKAGE_VERSION,
      },
      capabilities: {
        tools: {},
      },
    });
  }

  if (message.method === "tools/list") {
    return ok(message.id, { tools: toolsList() });
  }

  if (message.method === "tools/call") {
    try {
      return await handleToolCall(message);
    } catch (caught) {
      return error(message.id, -32603, caught instanceof Error ? caught.message : String(caught));
    }
  }

  return error(message.id, -32601, `unsupported method: ${message.method}`);
}

export function toolsList() {
  return [
    {
      name: "capability_manifest",
      description: "Return the agent-visible capability manifest summary.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "prepare_context",
      description: "Compile a Theorems Harness product context packet for a prompt, files, or tool call.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          cwd: { type: "string" },
          changed_files: { type: "array", items: { type: "string" } },
          tool_name: { type: "string" },
          tool_input: { type: "object" },
        },
      },
    },
    {
      name: "capability_scorecards",
      description: "Return capability scorecards and objective measurement targets.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "doctor",
      description: "Run product diagnostics for adapter contract, visibility, scorecards, and receipt writes.",
      inputSchema: {
        type: "object",
        properties: {
          cwd: { type: "string" },
        },
      },
    },
    {
      name: "remote_doctor",
      description: "Run remote service reliability diagnostics for liveness, readiness, async queues, dependency isolation, and tenant guardrails.",
      inputSchema: {
        type: "object",
        properties: {
          remote_url: { type: "string" },
          token: { type: "string" },
          timeout_ms: { type: "number" },
        },
      },
    },
    {
      name: "index_spine",
      description: "Proxy the Adaptive Index Spine read surface from Theorem/RustyRed MCP with explicit degraded states when the remote is unavailable.",
      inputSchema: {
        type: "object",
        properties: {
          surface: {
            type: "string",
            enum: [
              "overview",
              "index_manifests",
              "query_receipts",
              "advisor_proposals",
              "context_views",
              "maps",
              "training_runs",
              "training_exports",
              "export_validation",
            ],
          },
          limit: { type: "number" },
          id_prefix: { type: "string" },
          properties: { type: "object" },
          include_records: { type: "boolean" },
          remote_url: { type: "string" },
          token: { type: "string" },
          timeout_ms: { type: "number" },
        },
      },
    },
    {
      name: "index_context",
      description: "Assemble a compact query context packet by querying GraphQL memory and index-spine surfaces, fusing candidates, and caching the result.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          prompt: { type: "string" },
          task: { type: "string" },
          limit: { type: "number" },
          content_preview_chars: { type: "number" },
          cache_policy: {
            type: "string",
            enum: ["read_write", "read_only", "write_only", "bypass"],
          },
          cache_ttl_ms: { type: "number" },
          remote_url: { type: "string" },
          token: { type: "string" },
          timeout_ms: { type: "number" },
          listwise_reranker_url: {
            type: "string",
            description: "Learned listwise reranker base URL or /rerank endpoint. Defaults to THEOREMS_HARNESS_LISTWISE_RERANKER_URL or THEOREM_LISTWISE_RERANKER_URL.",
          },
          listwise_reranker_model: {
            type: "string",
            description: "Listwise reranker model id. Defaults to jinaai/jina-reranker-v3.",
          },
          cross_encoder_url: {
            type: "string",
            description: "Learned cross-encoder base URL or /score endpoint. Defaults to THEOREMS_HARNESS_RERANKER_URL or THEOREM_RERANKER_URL.",
          },
          cross_encoder_model: {
            type: "string",
            description: "Cross-encoder reranker model id. Defaults to Alibaba-NLP/gte-reranker-modernbert-base.",
          },
          reranker_url: {
            type: "string",
            description: "Generic learned reranker URL. Use reranker_kind=listwise when the endpoint is listwise; otherwise it is treated as cross-encoder.",
          },
          reranker_kind: {
            type: "string",
            enum: ["listwise", "cross_encoder"],
          },
          reranker_model: { type: "string" },
          reranker_token: { type: "string" },
        },
      },
    },
    {
      name: "grep",
      description: "Run bounded local literal or regex search with code-neighborhood formatting over files, docs, or other text in the workspace.",
      inputSchema: {
        type: "object",
        properties: grepInputSchemaProperties(),
      },
    },
    {
      name: "semantic_grep",
      description: "Run local hybrid semantic-ish search over file chunks, or route to native compute_code when backend=native/code_graph.",
      inputSchema: {
        type: "object",
        properties: {
          ...grepInputSchemaProperties(),
          backend: {
            type: "string",
            enum: ["local", "native", "remote", "code_graph", "compute_code"],
          },
          chunk_lines: { type: "number" },
          chunk_overlap: { type: "number" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "memory_grep",
      description: "Search memory through the RustyRed Data API, preserving deterministic tenant, repo, path, tag, source, room, status, and validity filters.",
      inputSchema: {
        type: "object",
        properties: {
          tenant: { type: "string" },
          tenant_slug: { type: "string" },
          query: { type: "string" },
          pattern: { type: "string" },
          text: { type: "string" },
          project: { type: "string" },
          repo: { type: "string" },
          path: { type: "string" },
          room: { type: "string" },
          room_id: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          source: { type: "string" },
          status: { type: "string" },
          validity: { type: "string" },
          collection: { type: "string" },
          id: { type: "string" },
          record_ids: { type: "array", items: { type: "string" } },
          exact: { type: "object" },
          filters: { type: "array", items: { type: "object" } },
          cursor: { type: "string" },
          limit: { type: "number" },
          hydrate_links: { type: "boolean" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "mgrep",
      description: "Multi-source grep router. Use source=code/files for semantic_grep, source=memory/data for memory_grep, source=web/docs/api for observe_web, or source=all for code plus memory.",
      inputSchema: {
        type: "object",
        properties: {
          ...grepInputSchemaProperties(),
          source: {
            type: "string",
            enum: ["code", "files", "memory", "data", "web", "docs", "api", "all"],
          },
          backend: {
            type: "string",
            enum: ["local", "native", "remote", "code_graph", "compute_code"],
          },
          tenant: { type: "string" },
          tenant_slug: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          hydrate_links: { type: "boolean" },
          urls: { type: "array", items: { type: "string" } },
          url: { type: "string" },
          docs: { type: "array", items: { type: "string" } },
          api: { type: "object" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "query_data",
      description: "Query RustyRed Data API records by id, collection, label, exact filters, text filters, cursor, and optional link hydration.",
      inputSchema: {
        type: "object",
        properties: {
          tenant: { type: "string" },
          tenant_slug: { type: "string" },
          id: { type: "string" },
          collection: { type: "string" },
          label: { type: "string" },
          query: { type: "string" },
          exact: { type: "object" },
          filters: { type: "array", items: { type: "object" } },
          sort: { type: "array", items: { type: "object" } },
          cursor: { type: "string" },
          limit: { type: "number" },
          hydrate_links: { type: "boolean" },
          broad_scan: { type: "boolean" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "retrieve_memory",
      description: "Retrieve memory through query_data with deterministic tenant, repo, path, room, tag, source, status, and validity narrowing before ranking.",
      inputSchema: {
        type: "object",
        properties: {
          tenant: { type: "string" },
          tenant_slug: { type: "string" },
          query: { type: "string" },
          project: { type: "string" },
          repo: { type: "string" },
          path: { type: "string" },
          room: { type: "string" },
          room_id: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          source: { type: "string" },
          status: { type: "string" },
          validity: { type: "string" },
          cursor: { type: "string" },
          limit: { type: "number" },
          hydrate_links: { type: "boolean" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "turn_start",
      description: "Assemble a turn-start packet from Data API records, memory, coordination, index, code, and task context.",
      inputSchema: {
        type: "object",
        properties: {
          tenant: { type: "string" },
          tenant_slug: { type: "string" },
          prompt: { type: "string" },
          task: { type: "string" },
          cwd: { type: "string" },
          repo: { type: "string" },
          actor: { type: "string" },
          room_id: { type: "string" },
          limit: { type: "number" },
          include_memory: { type: "boolean" },
          include_code: { type: "boolean" },
          include_coordination: { type: "boolean" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "evidence_bundle",
      description: "Bundle Data API records, links, provenance, and snippets for cited evidence ids or a bounded query.",
      inputSchema: {
        type: "object",
        properties: {
          tenant: { type: "string" },
          tenant_slug: { type: "string" },
          record_ids: { type: "array", items: { type: "string" } },
          ids: { type: "array", items: { type: "string" } },
          query: { type: "string" },
          limit: { type: "number" },
          include_links: { type: "boolean" },
          hydrate_links: { type: "boolean" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "compound_engineering",
      description: "Read the Compound Engineering summary from the harness: captures, gate records, and reviewable action candidates for recurring outcomes.",
      inputSchema: {
        type: "object",
        properties: {
          tenant: { type: "string" },
          tenant_slug: { type: "string" },
          cluster_key: { type: "string" },
          since: { type: "string" },
          limit: { type: "number" },
          remote_url: { type: "string" },
          http_url: { type: "string" },
          http_path: { type: "string" },
          token: { type: "string" },
          timeout_ms: { type: "number" },
        },
      },
    },
    {
      name: "graphql_query",
      description: "Proxy a native Theorem GraphQL read query through the configured MCP endpoint.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          variables: { type: "object" },
          operation_name: { type: "string" },
          operationName: { type: "string" },
          ...nativeMcpConfigSchemaProperties(),
        },
        required: ["query"],
      },
    },
    {
      name: "graphql_mutate",
      description: "Proxy a native Theorem GraphQL mutation through the configured MCP endpoint.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          variables: { type: "object" },
          operation_name: { type: "string" },
          operationName: { type: "string" },
          ...nativeMcpConfigSchemaProperties(),
        },
        required: ["query"],
      },
    },
    {
      name: "graphql_introspect",
      description: "Proxy native Theorem GraphQL schema introspection through the configured MCP endpoint.",
      inputSchema: {
        type: "object",
        properties: nativeMcpConfigSchemaProperties(),
      },
    },
    {
      name: "reconstruct",
      description: "Compound reconstruction surface. Routes source compose, binary/Ghidra reconstruction, and Datawave ingest to the native Theorem substrate.",
      inputSchema: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["compose", "binary", "binary_from_source", "datawave"],
          },
          kind: { type: "string" },
          operation: { type: "string" },
          tenant: { type: "string" },
          tenant_slug: { type: "string" },
          tenant_id: { type: "string" },
          source: { type: "object" },
          source_ref: { type: "object" },
          github_url: { type: "string" },
          repo_url: { type: "string" },
          repo_id: { type: "string" },
          repo: { type: "string" },
          local_path: { type: "string" },
          repo_path: { type: "string" },
          binary_path: { type: "string" },
          web_url: { type: "string" },
          sha: { type: "string" },
          target: { type: "object" },
          build_command: { type: "string" },
          build_commands: { type: "array", items: { type: ["string", "object", "array"] } },
          build_timeout_ms: { type: "integer" },
          artifact_glob: { type: "string" },
          binary_glob: { type: "string" },
          confirmed: { type: "boolean" },
          build_confirmed: { type: "boolean" },
          keep_sandbox: { type: "boolean" },
          ghidra_enabled: { type: "boolean" },
          run_ghidra: { type: "boolean" },
          ghidra_headless_path: { type: "string" },
          ghidra_script_path: { type: "string" },
          ghidra_timeout_ms: { type: "integer" },
          ghidra_timeout_seconds: { type: "integer" },
          max_ghidra_functions: { type: "integer" },
          max_pcode_ops: { type: "integer" },
          ingest_datawave: { type: "boolean" },
          max_datawave_records: { type: "integer" },
          repo_label: { type: "string" },
          max_symbols: { type: "integer" },
          max_features: { type: "integer" },
          pattern_limit: { type: "integer" },
          path_prefix: { type: "string" },
          datawave_fact_limit: { type: "integer" },
          max_total_bytes: { type: "integer" },
          artifact_id: { type: "string" },
          artifact_path: { type: "string" },
          bytes_hex: { type: "string" },
          record: { type: "object" },
          records: { type: "array", items: { type: "object" } },
          helper: { type: "object" },
          field: { type: "string" },
          value: { type: "string" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "compute_code",
      description: "Compound code surface. Routes code search/context/explain operations to native compute_code and ingest/reindex operations to native code_ingest.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [
              "search",
              "context",
              "recognize",
              "explore",
              "explain",
              "list_repos",
              "kg_status",
              "context_pack",
              "record_use_receipt",
              "ingest_status",
              "ingest",
              "reindex",
              "session_reingest",
            ],
          },
          mode: { type: "string" },
          query: { type: "string" },
          repo: { type: "string" },
          repo_id: { type: "string" },
          repo_url: { type: "string" },
          repo_path: { type: "string" },
          local_path: { type: "string" },
          path: { type: "string" },
          symbol: { type: "string" },
          language: { type: "string" },
          limit: { type: "number" },
          max_results: { type: "number" },
          max_total_bytes: { type: "number" },
          confirmed: { type: "boolean" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "understand_code",
      description: "Compose code search/context/explain plus Data API evidence into a feature, component, ownership, call graph, and risk packet.",
      inputSchema: {
        type: "object",
        properties: {
          tenant: { type: "string" },
          tenant_slug: { type: "string" },
          query: { type: "string" },
          repo: { type: "string" },
          repo_id: { type: "string" },
          repo_url: { type: "string" },
          repo_path: { type: "string" },
          local_path: { type: "string" },
          path: { type: "string" },
          symbol: { type: "string" },
          language: { type: "string" },
          limit: { type: "number" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "impact",
      description: "Analyze blast radius from a Data API record, graph node, code symbol, file path, task, or feature seed.",
      inputSchema: {
        type: "object",
        properties: {
          tenant: { type: "string" },
          tenant_slug: { type: "string" },
          seed: { type: "string" },
          node_id: { type: "string" },
          record_id: { type: "string" },
          symbol: { type: "string" },
          path: { type: "string" },
          query: { type: "string" },
          max_depth: { type: "number" },
          limit: { type: "number" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "oracle",
      description: "Build or inspect validators, obligations, and evidence-backed checks for a claim, feature, reconstruction, or code change.",
      inputSchema: {
        type: "object",
        properties: {
          tenant: { type: "string" },
          tenant_slug: { type: "string" },
          claim: { type: "string" },
          target: { type: "object" },
          validators: { type: "array", items: { type: "object" } },
          evidence_ids: { type: "array", items: { type: "string" } },
          mode: { type: "string" },
          limit: { type: "number" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "observe_web",
      description: "Ingest or query URL, API, docs, and browser evidence into RustyWeb/Datawave records queryable through query_data.",
      inputSchema: {
        type: "object",
        properties: {
          tenant: { type: "string" },
          tenant_slug: { type: "string" },
          url: { type: "string" },
          urls: { type: "array", items: { type: "string" } },
          api: { type: "object" },
          docs: { type: "array", items: { type: "string" } },
          query: { type: "string" },
          ingest: { type: "boolean" },
          limit: { type: "number" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "native_mcp_call",
      description: "Generic diagnostic proxy for a native Theorem/RustyRed MCP tool. Prefer named product tools when one exists.",
      inputSchema: {
        type: "object",
        properties: {
          tool: { type: "string" },
          native_tool: { type: "string" },
          arguments: { type: "object" },
          args: { type: "object" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "harness_run",
      description: "Poll a harness run's detail and event log by run id through the native MCP endpoint.",
      inputSchema: {
        type: "object",
        properties: {
          run_id: { type: "string" },
          ...nativeMcpConfigSchemaProperties(),
        },
        required: ["run_id"],
      },
    },
    {
      name: "harness_prepare",
      description: "Prepare a harness run for a task: profile selection, toolkit compilation, and context planning through the native MCP endpoint.",
      inputSchema: {
        type: "object",
        properties: {
          task: { type: "string" },
          actor: { type: "string" },
          budget_units: { type: "number" },
          max_selected: { type: "number" },
          memory_limit: { type: "number" },
          surface: { type: "string" },
          ...nativeMcpConfigSchemaProperties(),
        },
        required: ["task"],
      },
    },
    {
      name: "harness_append_transition",
      description: "Append a typed transition to the harness run state machine. Drives the run lifecycle (RUN.CREATED through RUN.CLOSED) and fires compound-engineering capture on RUN.CLOSED and RUN.FAILED. Pass top-level fields or a full transition object.",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Event type, e.g. RUN.CREATED. Required unless a transition object is provided.",
          },
          run_id: {
            type: "string",
            description: "Run id. Required for every type except RUN.CREATED.",
          },
          payload: { type: "object" },
          actor: { type: "string" },
          idempotency_key: { type: "string" },
          created_at: { type: "string" },
          transition: { type: "object" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "composed_agent_run",
      description: "Run a composed agent for a task through the native MCP endpoint, optionally pinned to a binding and claims.",
      inputSchema: {
        type: "object",
        properties: {
          task: { type: "string" },
          binding_id: { type: "string" },
          claims: { type: "array", items: { type: "object" } },
          ...nativeMcpConfigSchemaProperties(),
        },
        required: ["task"],
      },
    },
    {
      name: "multihead_run",
      description: "Start or inspect a multihead run through the native MCP endpoint. action=status is read-only.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "start (default) or status (read-only).",
          },
          run_id: { type: "string" },
          goal: { type: "string" },
          actor: { type: "string" },
          ...nativeMcpConfigSchemaProperties(),
        },
      },
    },
    {
      name: "spawn_session",
      description: "Spawn a coordinated agent session record through the native MCP endpoint.",
      inputSchema: {
        type: "object",
        properties: {
          actor: { type: "string" },
          intent: { type: "string" },
          owner: { type: "string" },
          repo: { type: "string" },
          branch: { type: "string" },
          event_type: { type: "string" },
          metadata: { type: "object" },
          ...nativeMcpConfigSchemaProperties(),
        },
        required: ["actor", "intent"],
      },
    },
    {
      name: "write_receipt",
      description: "Append an explicit Theorems Harness receipt event for diagnostics or host integration.",
      inputSchema: {
        type: "object",
        properties: {
          cwd: { type: "string" },
          path: { type: "string" },
          event: { type: "object" },
        },
        required: ["event"],
      },
    },
  ];
}

async function handleToolCall(message) {
  const name = message.params?.name;
  const args = message.params?.arguments ?? {};

  if (name === "capability_manifest") {
    const manifest = await loadCapabilityManifest();
    return textResult(message.id, {
      product: manifest.product,
      schema_version: manifest.schema_version,
      capabilities: manifest.capabilities.map((capability) => ({
        id: capability.id,
        title: capability.title,
        delivery: capability.delivery,
        must_be_visible_to_model: Boolean(capability.must_be_visible_to_model),
      })),
    });
  }

  if (name === "prepare_context") {
    const compiled = await compileContext(args);
    return textResult(message.id, compiled);
  }

  if (name === "capability_scorecards") {
    return textResult(message.id, await loadCapabilityScorecards());
  }

  if (name === "doctor") {
    return textResult(message.id, await runDoctor(args));
  }

  if (name === "remote_doctor") {
    return textResult(message.id, await runRemoteDoctor(args));
  }

  if (name === "index_spine") {
    return textResult(message.id, await queryIndexSpine(args));
  }

  if (name === "index_context") {
    return textResult(message.id, await queryIndexContext(args));
  }

  if (name === "grep") {
    return textResult(message.id, await queryGrep(args));
  }

  if (name === "semantic_grep") {
    return textResult(message.id, await querySemanticGrepTool(args));
  }

  if (name === "memory_grep") {
    return textResult(message.id, await queryMemoryGrep(args));
  }

  if (name === "mgrep") {
    return textResult(message.id, await queryMgrep(args));
  }

  if (name === "compound_engineering") {
    return textResult(message.id, await queryCompoundEngineering(args));
  }

  if (name === "reconstruct") {
    return textResult(message.id, await queryReconstruct(args));
  }

  if (name === "compute_code") {
    return textResult(message.id, await queryComputeCode(args));
  }

  if (DATA_API_PRODUCT_TOOLS.has(name)) {
    return textResult(message.id, await queryNativeProductTool(name, args));
  }

  if (NATIVE_TOOL_ALIASES[name]) {
    return textResult(
      message.id,
      await callNativeMcpTool({
        input: args,
        nativeTool: NATIVE_TOOL_ALIASES[name],
        productTool: name,
        requestId: name,
      }),
    );
  }

  if (name === "native_mcp_call") {
    return textResult(
      message.id,
      await callNativeMcpTool({
        input: args,
        productTool: "native_mcp_call",
        requestId: "native-mcp-call",
      }),
    );
  }

  if (name === "write_receipt") {
    const adapter = createLocalAdapter();
    return textResult(
      message.id,
      await adapter.writeReceipt(args.event, {
        cwd: args.cwd,
        path: args.path,
      }),
    );
  }

  return error(message.id, -32602, `unknown tool: ${name}`);
}

function queryNativeProductTool(name, args) {
  return callNativeMcpTool({
    input: args,
    nativeTool: name,
    productTool: name,
    requestId: name,
  });
}

function querySemanticGrepTool(args) {
  const backend = normalizeRoute(args.backend);
  if (GREP_NATIVE_BACKENDS.has(backend)) {
    return callNativeMcpTool({
      input: {
        ...args,
        arguments: grepNativeArguments(args, {
          defaultOperation: "search",
        }),
      },
      nativeTool: "compute_code",
      productTool: "semantic_grep",
      requestId: "semantic-grep",
    });
  }
  return querySemanticGrep(args);
}

function queryMemoryGrep(args, { productTool = "memory_grep" } = {}) {
  const query = grepQuery(args);
  const exactRoute = Boolean(args.id || args.record_id || args.record_ids || args.ids || args.exact || args.filters || args.collection || args.label);
  if (!query && !exactRoute) {
    return {
      schema_version: 1,
      ok: false,
      status: "degraded",
      product_tool: productTool,
      reason: "empty_query",
      message: `${productTool} requires a query, pattern, record id, collection, exact filter, or Data API filter.`,
    };
  }
  const nativeTool = exactRoute ? "query_data" : "retrieve_memory";
  const nativeArgs = grepNativeArguments(args, {
    query,
    defaultLimit: 20,
  });
  if (nativeTool === "query_data" && !nativeArgs.collection) {
    nativeArgs.collection = "memory_docs";
  }
  return callNativeMcpTool({
    input: {
      ...args,
      arguments: nativeArgs,
    },
    nativeTool,
    productTool,
    requestId: productTool.replaceAll("_", "-"),
  });
}

async function queryMgrep(args) {
  const source = normalizeRoute(args.source ?? args.mode ?? "code");
  if (MEMORY_GREP_SOURCES.has(source)) {
    return queryMemoryGrep(args, { productTool: "mgrep" });
  }
  if (WEB_GREP_SOURCES.has(source)) {
    return callNativeMcpTool({
      input: {
        ...args,
        arguments: grepNativeArguments(args, {
          query: grepQuery(args),
          defaultLimit: 10,
        }),
      },
      nativeTool: "observe_web",
      productTool: "mgrep",
      requestId: "mgrep-web",
    });
  }
  if (source === "all") {
    const code = await querySemanticGrep(args, { productTool: "mgrep" });
    const memory = await queryMemoryGrep(args, { productTool: "mgrep" });
    const degradedSources = [
      code.ok ? null : { source: "code", reason: code.reason },
      memory.ok ? null : { source: "memory", reason: memory.reason },
    ].filter(Boolean);
    return {
      schema_version: 1,
      ok: Boolean(code.ok || memory.ok),
      status: degradedSources.length ? "degraded" : "ok",
      product_tool: "mgrep",
      mode: "multi-source",
      query: grepQuery(args),
      sources: {
        code,
        memory,
      },
      degraded_sources: degradedSources,
    };
  }
  return querySemanticGrep(args, { productTool: "mgrep" });
}

function queryReconstruct(args) {
  if (isBinaryFromSourceRoute(args)) {
    return reconstructBinaryFromSource(args);
  }
  const nativeTool = reconstructNativeTool(args);
  return callNativeMcpTool({
    input: {
      ...args,
      arguments: compoundArguments(args, {
        dropOperation: selectionOnlyOperation(args),
      }),
    },
    nativeTool,
    productTool: "reconstruct",
    requestId: "reconstruct",
  });
}

function queryComputeCode(args) {
  const nativeTool = computeCodeNativeTool(args);
  return callNativeMcpTool({
    input: {
      ...args,
      arguments: compoundArguments(args, {
        dropOperation: selectionOnlyOperation(args),
      }),
    },
    nativeTool,
    productTool: "compute_code",
    requestId: "compute-code",
  });
}

function grepInputSchemaProperties() {
  return {
    query: { type: "string" },
    pattern: { type: "string" },
    text: { type: "string" },
    q: { type: "string" },
    cwd: { type: "string" },
    root: { type: "string" },
    local_path: { type: "string" },
    path: { type: "string" },
    paths: { type: "array", items: { type: "string" } },
    file: { type: "string" },
    files: { type: "array", items: { type: "string" } },
    include: { type: "array", items: { type: "string" } },
    includes: { type: "array", items: { type: "string" } },
    exclude: { type: "array", items: { type: "string" } },
    excludes: { type: "array", items: { type: "string" } },
    glob: { type: "string" },
    globs: { type: "array", items: { type: "string" } },
    extension: { type: "string" },
    extensions: { type: "array", items: { type: "string" } },
    regex: { type: "boolean" },
    case_sensitive: { type: "boolean" },
    context_lines: { type: "number" },
    limit: { type: "number" },
    max_results: { type: "number" },
    max_files: { type: "number" },
    max_file_bytes: { type: "number" },
    max_total_bytes: { type: "number" },
    ignore_dirs: { type: "array", items: { type: "string" } },
  };
}

function reconstructNativeTool(args) {
  const route = routeSelector(args);
  if (RECONSTRUCT_COMPOSE_MODES.has(route)) return "reverse_engineer_compose";
  if (RECONSTRUCT_BINARY_MODES.has(route)) return "reconstruct_binary";
  if (RECONSTRUCT_DATAWAVE_MODES.has(route)) return "datawave_ingest";
  if (args.source || args.source_ref || args.github_url || args.repo_url || args.repo_id || args.repo || args.local_path || args.repo_path) {
    return "reverse_engineer_compose";
  }
  if (args.binary_path || args.artifact_path || args.artifact_id || args.bytes_hex) {
    return "reconstruct_binary";
  }
  if (args.record || args.records || args.helper || args.field || args.value) {
    return "datawave_ingest";
  }
  return "";
}

function grepNativeArguments(args, { query = grepQuery(args), defaultOperation, defaultLimit } = {}) {
  const input = compoundArguments(args);
  delete input.backend;
  delete input.source;
  if (query && !input.query) input.query = query;
  if (defaultOperation && !input.operation) input.operation = defaultOperation;
  if (defaultLimit && !input.limit) input.limit = defaultLimit;
  return input;
}

function grepQuery(args) {
  return String(args.query ?? args.pattern ?? args.text ?? args.q ?? "").trim();
}

function isBinaryFromSourceRoute(args) {
  const route = routeSelector(args);
  return route === "binary_from_source" || route === "build_binary" || route === "build_from_source";
}

function computeCodeNativeTool(args) {
  const route = routeSelector(args);
  return CODE_INGEST_MODES.has(route) ? "code_ingest" : "compute_code";
}

function routeSelector(args) {
  return normalizeRoute(
    args.mode ?? args.kind ?? args.surface ?? args.tool ?? args.native_tool ?? args.nativeTool ?? args.operation,
  );
}

function selectionOnlyOperation(args) {
  return SELECTION_ONLY_OPERATIONS.has(normalizeRoute(args.operation));
}

function compoundArguments(input, { dropOperation = false } = {}) {
  const nested = input.arguments ?? input.args;
  const source = nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested
    : input;
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !COMPOUND_CONFIG_KEYS.has(key))
      .filter(([key]) => !(dropOperation && key === "operation"))
      .filter(([, value]) => value !== undefined),
  );
}

function normalizeRoute(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.\s]+/gu, "_");
}

function ok(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function error(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function textResult(id, value) {
  return ok(id, {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  });
}

function writeMessage(message) {
  const body = JSON.stringify(message);
  stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function parseFramedMessages(buffer) {
  const messages = [];
  let rest = buffer;

  while (rest.length) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      break;
    }
    const header = rest.slice(0, headerEnd).toString("utf8");
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!lengthMatch) {
      break;
    }
    const length = Number(lengthMatch[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (rest.length < bodyEnd) {
      break;
    }
    messages.push(JSON.parse(rest.slice(bodyStart, bodyEnd).toString("utf8")));
    rest = rest.slice(bodyEnd);
  }

  return { messages, rest };
}

async function runStdio() {
  let buffer = Buffer.alloc(0);
  for await (const chunk of stdin) {
    buffer = Buffer.concat([buffer, chunk]);
    const parsed = parseFramedMessages(buffer);
    buffer = parsed.rest;
    for (const message of parsed.messages) {
      writeMessage(await handleRpcMessage(message));
    }
  }

  const parsed = parseFramedMessages(buffer);
  buffer = parsed.rest;
  for (const message of parsed.messages) {
    writeMessage(await handleRpcMessage(message));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await runStdio();
}
