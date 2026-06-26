import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

import { handleRpcMessage } from "../../src/mcp/server.mjs";

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
  assert.equal(response.result.tools.some((tool) => tool.name === "capability_scorecards"), true);
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

test("MCP facade assembles and caches GraphQL index context", async () => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    const rpc = JSON.parse(body);
    requests.push({ url: request.url, body: rpc });
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
    assert.equal(firstPayload.fusion.mode, "weighted_rrf");
    assert.equal(firstPayload.top_context[0].id, "mem-1");
    assert.equal(firstPayload.cache.status, "miss");
    assert.equal(secondPayload.cache.status, "hit");
    assert.equal(requests.length, 1);
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
