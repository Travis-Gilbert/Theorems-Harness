import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { handleRpcMessage } from "../../src/mcp/server.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("MCP facade lists product tools", async () => {
  const response = await handleRpcMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });

  assert.equal(response.result.tools.some((tool) => tool.name === "prepare_context"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "capability_manifest"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "doctor"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "remote_doctor"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "index_context"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "index_spine"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "query_data"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "retrieve_memory"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "turn_start"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "evidence_bundle"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "compound_engineering"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "graphql_query"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "graphql_mutate"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "graphql_introspect"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "reconstruct"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "compute_code"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "understand_code"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "impact"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "oracle"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "observe_web"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "native_mcp_call"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "capability_scorecards"), true);
  assert.equal(response.result.tools.some((tool) => tool.name === "reverse_engineer_compose"), false);
  assert.equal(response.result.tools.some((tool) => tool.name === "reconstruct_binary"), false);
  assert.equal(response.result.tools.some((tool) => tool.name === "datawave_ingest"), false);
});

test("MCP stdio server responds to a single exact framed tools/list request", () => {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const frame = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
  const child = spawnSync(process.execPath, [resolve(root, "src/mcp/server.mjs")], {
    cwd: root,
    encoding: "utf8",
    input: frame,
  });

  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /Content-Length:/);
  assert.match(child.stdout, /prepare_context/);
  assert.match(child.stdout, /index_context/);
});

test("MCP facade compiles Rust context packet", async () => {
  const response = await handleRpcMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "prepare_context",
      arguments: {
        prompt: "Write Rust code",
        changed_files: ["Cargo.toml"],
      },
    },
  });

  const text = response.result.content[0].text;
  assert.match(text, /rust-engineering/);
  assert.match(text, /Theorems Harness Product Packet/);
});

test("MCP facade returns capability scorecards", async () => {
  const response = await handleRpcMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "capability_scorecards",
      arguments: {},
    },
  });

  const text = response.result.content[0].text;
  assert.match(text, /trigger_precision/);
  assert.match(text, /rust-engineering/);
});

test("MCP facade runs doctor diagnostics", async () => {
  const response = await handleRpcMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "doctor",
      arguments: {
        cwd: process.cwd(),
      },
    },
  });

  const text = response.result.content[0].text;
  assert.match(text, /rust-engineering-visible/);
  assert.match(text, /receipt-write/);
});

test("MCP facade runs remote doctor diagnostics", async () => {
  const response = await handleRpcMessage({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "remote_doctor",
      arguments: {
        remote_url: "",
      },
    },
  });

  const text = response.result.content[0].text;
  assert.match(text, /remote-config/);
  assert.match(text, /remote_unavailable/);
});

test("MCP facade degrades index spine when no remote MCP is configured", async () => {
  const response = await handleRpcMessage({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "index_spine",
      arguments: {
        remote_url: "",
        surface: "overview",
      },
    },
  });

  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload.status, "degraded");
  assert.equal(payload.reason, "remote_unavailable");
  assert.equal(payload.native_tool, "rustyred_thg_index_spine");
});

test("MCP facade degrades index context when no remote MCP is configured", async () => {
  const response = await handleRpcMessage({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: {
      name: "index_context",
      arguments: {
        remote_url: "",
        query: "adaptive index recall context",
      },
    },
  });

  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload.status, "degraded");
  assert.equal(payload.reason, "remote_unavailable");
  assert.equal(payload.product_tool, "index_context");
});

test("MCP facade degrades query_data when no remote MCP is configured", async () => {
  const response = await handleRpcMessage({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: {
      name: "query_data",
      arguments: {
        remote_url: "",
        collection: "memory_docs",
        query: "data api records",
      },
    },
  });

  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload.status, "degraded");
  assert.equal(payload.reason, "remote_unavailable");
  assert.equal(payload.product_tool, "query_data");
  assert.equal(payload.native_tool, "query_data");
});

test("MCP facade degrades compound engineering when no remote harness is configured", async () => {
  const response = await handleRpcMessage({
    jsonrpc: "2.0",
    id: 9,
    method: "tools/call",
    params: {
      name: "compound_engineering",
      arguments: {
        remote_url: "",
        tenant: "Travis-Gilbert",
      },
    },
  });

  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload.status, "degraded");
  assert.equal(payload.reason, "remote_unavailable");
  assert.equal(payload.product_tool, "compound_engineering");
});

test("MCP facade degrades reconstruct compose when no remote MCP is configured", async () => {
  const response = await handleRpcMessage({
    jsonrpc: "2.0",
    id: 10,
    method: "tools/call",
    params: {
      name: "reconstruct",
      arguments: {
        remote_url: "",
        mode: "compose",
        source: {
          github_url: "https://github.com/shaochenze/calm.git",
        },
      },
    },
  });

  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload.status, "degraded");
  assert.equal(payload.reason, "remote_unavailable");
  assert.equal(payload.product_tool, "reconstruct");
  assert.equal(payload.native_tool, "reverse_engineer_compose");
});

test("MCP facade assembles and caches GraphQL index context", async () => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    const parsed = JSON.parse(body);
    requests.push({ url: request.url, body: parsed });
    if (request.url === "/rerank") {
      assert.equal(parsed.model, "jinaai/jina-reranker-v3");
      assert.equal(parsed.query, "adaptive index recall context");
      assert.equal(parsed.texts.length, 3);
      writeJson(response, {
        scores: [0.2, 0.97, 0.4],
      });
      return;
    }

    const rpc = parsed;
    assert.equal(rpc.params.name, "graphql_query");
    assert.match(rpc.params.arguments.query, /indexSpineOverview/);
    assert.match(rpc.params.arguments.query, /memory/);
    writeJson(response, {
      jsonrpc: "2.0",
      id: "index-context",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              data: {
                indexSpineOverview: {
                  ok: true,
                  counts: { MemoryDocument: 2, QueryReceipt: 1 },
                  reliability: {},
                  routes: {},
                  limit: 100,
                },
                memory: [
                  {
                    id: "mem-1",
                    kind: "decision",
                    title: "Adaptive index context assembly",
                    summary: "Use the index spine before broad recall.",
                    contentPreview: "The index context packet fuses memory and receipts.",
                    tags: ["index", "context"],
                    fitness: 0.9,
                    updatedAt: "2026-06-26T00:00:00Z",
                  },
                ],
                queryReceipts: [
                  {
                    nodeId: "receipt-1",
                    labels: ["QueryReceipt"],
                    version: 1,
                    properties: {
                      query: "adaptive index recall context",
                      summary: "Previous query selected index memory.",
                      score: 0.8,
                    },
                  },
                ],
                contextViews: [
                  {
                    nodeId: "view-1",
                    labels: ["ContextView"],
                    version: 1,
                    properties: {
                      title: "Index workflow context view",
                      summary: "Bounded working set for index-aware tasks.",
                    },
                  },
                ],
                mapArtifacts: [],
                trainingExportValidation: {
                  ok: true,
                  totalRecords: 0,
                  statusCounts: {},
                  blockedRecordIds: [],
                },
              },
            }),
          },
        ],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const args = {
    remote_url: `http://127.0.0.1:${port}`,
    listwise_reranker_url: `http://127.0.0.1:${port}`,
    query: "adaptive index recall context",
    limit: 5,
    cache_ttl_ms: 10_000,
  };

  try {
    const first = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "index_context",
        arguments: args,
      },
    });
    const second = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "index_context",
        arguments: args,
      },
    });

    const firstPayload = JSON.parse(first.result.content[0].text);
    const secondPayload = JSON.parse(second.result.content[0].text);
    assert.equal(firstPayload.status, "ok");
    assert.equal(firstPayload.mode, "graphql-index-context");
    assert.equal(firstPayload.fusion.mode, "learned_listwise_reranker");
    assert.equal(firstPayload.fusion.reranker.status, "used");
    assert.equal(firstPayload.top_context[0].id, "receipt-1");
    assert.equal(firstPayload.cache.status, "miss");
    assert.equal(secondPayload.cache.status, "hit");
    assert.equal(requests.filter((request) => request.url === "/mcp").length, 1);
    assert.equal(requests.filter((request) => request.url === "/rerank").length, 1);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("MCP facade proxies compound engineering to native HTTP summary", async () => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
    });
    writeJson(response, {
      tenant: "Travis-Gilbert",
      compound_engineering: {
        action_count: 2,
        action_items: [
          {
            action_type: "open_fix_task",
            summary: "same test failed twice",
          },
          {
            action_type: "review_promotion_proposal",
            summary: "pack passed threshold",
          },
        ],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "compound_engineering",
        arguments: {
          remote_url: `http://127.0.0.1:${port}`,
          token: "test-token",
          tenant: "Travis-Gilbert",
          cluster_key: "repeat-test",
          limit: 10,
        },
      },
    });

    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.status, "ok");
    assert.equal(payload.mode, "remote-http-proxy");
    assert.equal(payload.result.compound_engineering.action_count, 2);
    assert.equal(requests[0].method, "GET");
    assert.equal(requests[0].authorization, "Bearer test-token");
    const url = new URL(`http://127.0.0.1${requests[0].url}`);
    assert.equal(url.pathname, "/harness/compound-engineering");
    assert.equal(url.searchParams.get("tenant"), "Travis-Gilbert");
    assert.equal(url.searchParams.get("cluster_key"), "repeat-test");
    assert.equal(url.searchParams.get("limit"), "10");
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("MCP facade proxies index spine to native MCP endpoint", async () => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    requests.push({ url: request.url, body: JSON.parse(body) });
    writeJson(response, {
      jsonrpc: "2.0",
      id: "index-spine",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              surface: "overview",
              counts: {
                IndexManifest: 1,
                QueryReceipt: 2,
              },
            }),
          },
        ],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "index_spine",
        arguments: {
          remote_url: `http://127.0.0.1:${port}`,
          surface: "overview",
          limit: 3,
        },
      },
    });

    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.status, "ok");
    assert.equal(payload.mode, "remote-mcp-proxy");
    assert.equal(payload.result.counts.IndexManifest, 1);
    assert.equal(requests[0].url, "/mcp");
    assert.equal(requests[0].body.params.name, "rustyred_thg_index_spine");
    assert.deepEqual(requests[0].body.params.arguments, {
      surface: "overview",
      limit: 3,
    });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("MCP facade proxies GraphQL query to native MCP endpoint", async () => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    requests.push({ url: request.url, body: JSON.parse(body) });
    writeJson(response, {
      jsonrpc: "2.0",
      id: "graphql_query",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              data: {
                memory: [
                  {
                    id: "mem-1",
                    title: "GraphQL surface",
                  },
                ],
              },
            }),
          },
        ],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "graphql_query",
        arguments: {
          remote_url: `http://127.0.0.1:${port}`,
          query: "query { memory(query: \"graph\", limit: 1) { id title } }",
        },
      },
    });

    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.status, "ok");
    assert.equal(payload.mode, "native-mcp-proxy");
    assert.equal(payload.result.data.memory[0].id, "mem-1");
    assert.equal(requests[0].url, "/mcp");
    assert.equal(requests[0].body.params.name, "graphql_query");
    assert.match(requests[0].body.params.arguments.query, /memory/);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("MCP facade proxies reconstruct compose to native MCP endpoint", async () => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    requests.push({ url: request.url, body: JSON.parse(body) });
    writeJson(response, {
      jsonrpc: "2.0",
      id: "reverse_engineer_compose",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              operation: "reverse_engineer_compose",
              result: {
                provenance: {
                  repo_id: "repo:calm",
                  ingest_path: "FullyIngested",
                  code_to_datawave: {
                    facts_written: 1611,
                  },
                },
                code_files_count: 20,
                code_symbols_count: 213,
                datawave_facts: [],
                drift: [],
              },
            }),
          },
        ],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: {
        name: "reconstruct",
        arguments: {
          remote_url: `http://127.0.0.1:${port}`,
          mode: "compose",
          source: {
            github_url: "https://github.com/shaochenze/calm.git",
          },
          datawave_fact_limit: 1_000_000,
        },
      },
    });

    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.status, "ok");
    assert.equal(payload.mode, "native-mcp-proxy");
    assert.equal(payload.product_tool, "reconstruct");
    assert.equal(payload.native_tool, "reverse_engineer_compose");
    assert.equal(payload.result.result.provenance.repo_id, "repo:calm");
    assert.equal(payload.result.result.provenance.code_to_datawave.facts_written, 1611);
    assert.equal(requests[0].url, "/mcp");
    assert.equal(requests[0].body.params.name, "reverse_engineer_compose");
    assert.deepEqual(requests[0].body.params.arguments.source, {
      github_url: "https://github.com/shaochenze/calm.git",
    });
    assert.equal(requests[0].body.params.arguments.datawave_fact_limit, 1_000_000);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("MCP facade proxies reconstruct binary mode to native MCP endpoint", async () => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    requests.push({ url: request.url, body: JSON.parse(body) });
    writeJson(response, {
      jsonrpc: "2.0",
      id: "reconstruct",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              operation: "analyze",
              artifact_id: "bin:demo",
            }),
          },
        ],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: {
        name: "reconstruct",
        arguments: {
          remote_url: `http://127.0.0.1:${port}`,
          mode: "binary",
          operation: "analyze",
          binary_path: "/tmp/demo.bin",
        },
      },
    });

    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.status, "ok");
    assert.equal(payload.product_tool, "reconstruct");
    assert.equal(payload.native_tool, "reconstruct_binary");
    assert.equal(payload.result.artifact_id, "bin:demo");
    assert.equal(requests[0].body.params.name, "reconstruct_binary");
    assert.deepEqual(requests[0].body.params.arguments, {
      operation: "analyze",
      binary_path: "/tmp/demo.bin",
    });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("MCP facade proxies reconstruct Datawave mode to native MCP endpoint", async () => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    requests.push({ url: request.url, body: JSON.parse(body) });
    writeJson(response, {
      jsonrpc: "2.0",
      id: "reconstruct",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              operation: "record",
              facts_written: 3,
            }),
          },
        ],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 14,
      method: "tools/call",
      params: {
        name: "reconstruct",
        arguments: {
          remote_url: `http://127.0.0.1:${port}`,
          operation: "record",
          record: {
            file_path: "src/lib.rs",
          },
        },
      },
    });

    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.status, "ok");
    assert.equal(payload.product_tool, "reconstruct");
    assert.equal(payload.native_tool, "datawave_ingest");
    assert.equal(payload.result.facts_written, 3);
    assert.equal(requests[0].body.params.name, "datawave_ingest");
    assert.deepEqual(requests[0].body.params.arguments, {
      operation: "record",
      record: {
        file_path: "src/lib.rs",
      },
    });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("MCP facade runs reconstruct binary_from_source build locally without Ghidra", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "theorems-harness-bfs-"));
  try {
    await writeFile(join(fixture, "README.md"), "binary-from-source fixture\n");
    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 15,
      method: "tools/call",
      params: {
        name: "reconstruct",
        arguments: {
          mode: "binary_from_source",
          local_path: fixture,
          confirmed: true,
          ghidra_enabled: false,
          build_command: "mkdir -p build && printf 'hello-binary' > build/demo.bin",
          artifact_path: "build/demo.bin",
        },
      },
    });

    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.status, "ok");
    assert.equal(payload.mode, "binary_from_source");
    assert.equal(payload.product_tool, "reconstruct");
    assert.equal(payload.build.status, "ok");
    assert.equal(payload.artifact.byte_len, 12);
    assert.match(payload.artifact.artifact_id, /^artifact:sha256:/);
    assert.equal(payload.ghidra.status, "skipped");
    assert.equal(payload.reconstruction_spec.confidence, "observed_build_artifact_only");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("MCP facade degrades reconstruct binary_from_source when Ghidra is unavailable", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "theorems-harness-bfs-"));
  try {
    await writeFile(join(fixture, "README.md"), "binary-from-source fixture\n");
    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 16,
      method: "tools/call",
      params: {
        name: "reconstruct",
        arguments: {
          mode: "binary_from_source",
          local_path: fixture,
          confirmed: true,
          ghidra_headless_path: join(fixture, "missing-analyzeHeadless"),
          build_command: "mkdir -p build && printf 'hello-binary' > build/demo.bin",
          artifact_path: "build/demo.bin",
        },
      },
    });

    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.status, "degraded");
    assert.equal(payload.reason, "ghidra_unavailable");
    assert.equal(payload.build.status, "ok");
    assert.match(payload.artifact.artifact_id, /^artifact:sha256:/);
    assert.equal(payload.ghidra.reason, "ghidra_unavailable");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("MCP facade runs reconstruct binary_from_source through mocked Ghidra and Datawave ingest", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "theorems-harness-bfs-"));
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    requests.push({ url: request.url, body: JSON.parse(body) });
    writeJson(response, {
      jsonrpc: "2.0",
      id: "reconstruct-binary-from-source-datawave",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              operation: "batch",
              facts_written: 3,
            }),
          },
        ],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    await writeFile(join(fixture, "README.md"), "binary-from-source fixture\n");
    const fakeHeadless = join(fixture, "analyzeHeadless");
    await writeFile(fakeHeadless, `#!/bin/sh
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-postScript" ]; then
    shift
    script_name="$1"
    shift
    output_path="$1"
    cat > "$output_path" <<JSON
{
  "fixture": {
    "fixture_id": "ghidra:harness:demo",
    "source_uri": "demo.bin",
    "export_script": "$script_name",
    "program_summary": {
      "ghidra_version": "test",
      "language_id": "x86:LE:64:default",
      "compiler_spec_id": "gcc",
      "function_count": 1,
      "import_count": 1,
      "pcode_op_count": 1
    }
  },
  "functions": [{"function_id":"ghidra:function:1000","name":"main"}],
  "imports": [{"import_id":"ghidra:import:puts","name":"puts"}],
  "call_edges": [{"edge_id":"ghidra:call:1000:puts"}],
  "pcode_ops": [{"pcode_id":"ghidra:pcode:1000:0","opcode":"CALL"}],
  "decompiler_facts": [{"function_id":"ghidra:function:1000","status":"ok"}],
  "diagnostics": []
}
JSON
    exit 0
  fi
  shift
done
exit 2
`);
    await chmod(fakeHeadless, 0o755);

    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 17,
      method: "tools/call",
      params: {
        name: "reconstruct",
        arguments: {
          remote_url: `http://127.0.0.1:${port}`,
          mode: "binary_from_source",
          local_path: fixture,
          confirmed: true,
          ingest_datawave: true,
          ghidra_headless_path: fakeHeadless,
          build_command: "mkdir -p build && printf 'hello-binary' > build/demo.bin",
          artifact_path: "build/demo.bin",
        },
      },
    });

    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.status, "ok");
    assert.equal(payload.ghidra.status, "ok");
    assert.equal(payload.ghidra.facts_summary.functions_count, 1);
    assert.equal(payload.ghidra.facts_summary.pcode_ops_count, 1);
    assert.equal(payload.datawave.status, "ok");
    assert.equal(payload.datawave.records_count, 5);
    assert.equal(requests[0].body.params.name, "datawave_ingest");
    assert.equal(requests[0].body.params.arguments.operation, "batch");
    assert.equal(requests[0].body.params.arguments.records[0].source, "ghidra");
  } finally {
    server.close();
    await once(server, "close");
    await rm(fixture, { recursive: true, force: true });
  }
});

test("MCP facade proxies compute_code search to native compute_code", async () => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    requests.push({ url: request.url, body: JSON.parse(body) });
    writeJson(response, {
      jsonrpc: "2.0",
      id: "compute-code",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              operation: "search",
              results: [{ path: "src/lib.rs" }],
            }),
          },
        ],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 15,
      method: "tools/call",
      params: {
        name: "compute_code",
        arguments: {
          remote_url: `http://127.0.0.1:${port}`,
          operation: "search",
          repo: "repo:demo",
          query: "routing",
        },
      },
    });

    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.status, "ok");
    assert.equal(payload.product_tool, "compute_code");
    assert.equal(payload.native_tool, "compute_code");
    assert.equal(payload.result.results[0].path, "src/lib.rs");
    assert.equal(requests[0].body.params.name, "compute_code");
    assert.deepEqual(requests[0].body.params.arguments, {
      operation: "search",
      repo: "repo:demo",
      query: "routing",
    });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("MCP facade proxies compute_code ingest to native code_ingest", async () => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    requests.push({ url: request.url, body: JSON.parse(body) });
    writeJson(response, {
      jsonrpc: "2.0",
      id: "compute-code",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              operation: "ingest",
              job_id: "job-demo",
            }),
          },
        ],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 16,
      method: "tools/call",
      params: {
        name: "compute_code",
        arguments: {
          remote_url: `http://127.0.0.1:${port}`,
          operation: "ingest",
          repo_url: "https://github.com/example/demo.git",
        },
      },
    });

    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.status, "ok");
    assert.equal(payload.product_tool, "compute_code");
    assert.equal(payload.native_tool, "code_ingest");
    assert.equal(payload.result.job_id, "job-demo");
    assert.equal(requests[0].body.params.name, "code_ingest");
    assert.deepEqual(requests[0].body.params.arguments, {
      operation: "ingest",
      repo_url: "https://github.com/example/demo.git",
    });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("MCP facade proxies Data API and PR-103 compound product tools to native MCP", async () => {
  const cases = [
    {
      name: "query_data",
      arguments: {
        collection: "memory_docs",
        filters: [{ field: "repo", op: "eq", value: "demo" }],
        limit: 2,
      },
    },
    {
      name: "retrieve_memory",
      arguments: {
        query: "data api records",
        repo: "demo",
        tags: ["decision"],
      },
    },
    {
      name: "turn_start",
      arguments: {
        prompt: "continue data api work",
        repo: "demo",
      },
    },
    {
      name: "evidence_bundle",
      arguments: {
        record_ids: ["node:a"],
        include_links: true,
      },
    },
    {
      name: "understand_code",
      arguments: {
        query: "router data api tools",
        repo: "demo",
      },
    },
    {
      name: "impact",
      arguments: {
        seed: "node:a",
        max_depth: 2,
      },
    },
    {
      name: "oracle",
      arguments: {
        claim: "query_data is advertised",
        evidence_ids: ["node:a"],
      },
    },
    {
      name: "observe_web",
      arguments: {
        url: "https://example.com/docs",
        ingest: true,
      },
    },
  ];
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    const parsed = JSON.parse(body);
    requests.push({ url: request.url, body: parsed });
    writeJson(response, {
      jsonrpc: "2.0",
      id: parsed.id,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              echoed_tool: parsed.params.name,
              echoed_arguments: parsed.params.arguments,
            }),
          },
        ],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    for (const fixture of cases) {
      const response = await handleRpcMessage({
        jsonrpc: "2.0",
        id: `pr-103-${fixture.name}`,
        method: "tools/call",
        params: {
          name: fixture.name,
          arguments: {
            remote_url: `http://127.0.0.1:${port}`,
            ...fixture.arguments,
          },
        },
      });

      const payload = JSON.parse(response.result.content[0].text);
      assert.equal(payload.status, "ok");
      assert.equal(payload.product_tool, fixture.name);
      assert.equal(payload.native_tool, fixture.name);
      assert.equal(payload.result.echoed_tool, fixture.name);
      assert.deepEqual(payload.result.echoed_arguments, fixture.arguments);
    }

    assert.deepEqual(
      requests.map((request) => request.body.params.name),
      cases.map((fixture) => fixture.name),
    );
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("MCP facade proxies generic native MCP diagnostic calls", async () => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    requests.push({ url: request.url, body: JSON.parse(body) });
    writeJson(response, {
      jsonrpc: "2.0",
      id: "native-mcp-call",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              echoed: "datawave_ingest",
            }),
          },
        ],
      },
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: {
        name: "native_mcp_call",
        arguments: {
          remote_url: `http://127.0.0.1:${port}`,
          tool: "datawave_ingest",
          arguments: {
            operation: "describe",
          },
        },
      },
    });

    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.status, "ok");
    assert.equal(payload.result.echoed, "datawave_ingest");
    assert.equal(requests[0].body.params.name, "datawave_ingest");
    assert.deepEqual(requests[0].body.params.arguments, {
      operation: "describe",
    });
  } finally {
    server.close();
    await once(server, "close");
  }
});

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function writeJson(response, value) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}
