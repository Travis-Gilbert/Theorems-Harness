#!/usr/bin/env node
import { stdin, stdout } from "node:process";

import { createLocalAdapter } from "../adapters/local-adapter.mjs";
import { compileContext } from "../product/compile-context.mjs";
import { runDoctor } from "../product/doctor.mjs";
import { queryIndexContext } from "../product/index-context.mjs";
import { queryIndexSpine } from "../product/index-spine.mjs";
import { loadCapabilityManifest } from "../product/load-manifest.mjs";
import { runRemoteDoctor } from "../product/remote-doctor.mjs";
import { loadCapabilityScorecards } from "../product/scorecards.mjs";

export async function handleRpcMessage(message) {
  if (message.method === "initialize") {
    return ok(message.id, {
      protocolVersion: "2024-11-05",
      serverInfo: {
        name: "theorems-harness-product",
        version: "0.1.0",
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
  stdin.on("data", async (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const parsed = parseFramedMessages(buffer);
    buffer = parsed.rest;
    for (const message of parsed.messages) {
      writeMessage(await handleRpcMessage(message));
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runStdio();
}
