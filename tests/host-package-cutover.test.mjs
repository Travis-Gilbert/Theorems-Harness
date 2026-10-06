import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { handleRpcMessage } from "../src/mcp/server.mjs";
import { runDoctor } from "../src/product/doctor.mjs";
import { loadCapabilityScorecards } from "../src/product/scorecards.mjs";
import { runPlanMap } from "../src/product/plan-map.mjs";
import { reconstructBinaryFromSource } from "../src/product/binary-from-source.mjs";
import * as hostGrep from "../src/product/grep.mjs";

const endpointVars = ["THEOREMS_HARNESS_MCP_URL", "THEOREM_HARNESS_MCP_URL", "THEOREM_MCP_URL", "THEOREMS_HARNESS_REMOTE_URL", "THEOREM_HARNESS_REMOTE_URL", "THEOREM_REMOTE_URL", "RUSTYRED_THG_MCP_URL"];

async function withoutNativeEndpoint(run) {
  const saved = new Map(endpointVars.map((key) => [key, process.env[key]]));
  for (const key of endpointVars) delete process.env[key];
  try { return await run(); }
  finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("stdio facade advertises host utilities and degrades native routes explicitly", async () => {
  await withoutNativeEndpoint(async () => {
    const listing = await handleRpcMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const names = listing.result.tools.map((tool) => tool.name);
    assert.deepEqual(names.sort(), ["capability_scorecards", "doctor", "grep", "remote_doctor"]);
    const native = await handleRpcMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "query_data", arguments: { query: "fresh native request" } },
    });
    assert.equal(native.result.isError, true);
    assert.match(native.result.structuredContent.error, /endpoint_unconfigured/);
    assert.equal(native.result._meta["theorem/route_receipt"].semantic_owner, "rustyred-thg-mcp::data_api");

    const external = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "reconstruct", arguments: { mode: "binary_from_source", path: "/definitely/missing" } },
    });
    assert.equal(external.result.structuredContent.reason, "target_missing");
    assert.notEqual(external.result.structuredContent.error, "external_engine_unavailable");
  });
});

test("host grep uses current workspace files and scorecards use bundled manifests", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "harness-package-cutover-"));
  try {
    await writeFile(join(cwd, "example.rs"), "fn unique_cutover_marker() {}\n");
    const response = await handleRpcMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "grep", arguments: { query: "unique_cutover_marker", cwd } },
    });
    assert.equal(response.result.isError, undefined);
    assert.equal(response.result.structuredContent.results.length, 1);

    const scorecards = await loadCapabilityScorecards();
    assert.equal(scorecards.product, "theorems-harness");
    assert.ok(Object.keys(scorecards.capabilities).length > 0);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("doctor reflects native endpoint availability rather than a local adapter substitute", async () => {
  await withoutNativeEndpoint(async () => {
    const result = await runDoctor();
    assert.equal(result.status, "degraded");
    assert.deepEqual(result.checks.map((check) => check.name), ["native-theorem-endpoint", "capability-scorecards"]);
  });
});

async function withConflictingEnvironment(run) {
  const keys = [...endpointVars, "THEOREM_API_TOKEN", "THEOREM_HARNESS_API_TOKEN",
    "THEOREMS_HARNESS_REMOTE_TOKEN", "THEOREM_HARNESS_REMOTE_TOKEN"];
  const saved = new Map(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) process.env[key] = endpointVars.includes(key) ? "http://127.0.0.1:1/mcp" : "wrong-env-token";
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    await run();
    assert.deepEqual(Object.fromEntries(keys.map((key) => [key, process.env[key]])), before);
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function withNativeFixture(run) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const message = JSON.parse(body);
    requests.push({ message, authorization: request.headers.authorization });
    if (message.method === "notifications/initialized") {
      response.writeHead(202).end();
      return;
    }
    let result;
    if (message.method === "initialize") result = { protocolVersion: "2025-03-26", capabilities: {} };
    else if (message.params.arguments.action === "render") result = { structuredContent: { mermaid: "graph TD; A-->B" } };
    else if (message.params.arguments.query === "frontier") result = { structuredContent: { rows: [{ task_id: "B" }], count: 1 } };
    else result = { structuredContent: { ingested: message.params.arguments.records.length } };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${server.address().port}/mcp`, requests);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("plan map honors explicit endpoint and credential over every environment alias", async () => {
  await withNativeFixture(async (endpoint, requests) => {
    await withConflictingEnvironment(async () => {
      for (const [options, expectedToken] of [
        [{ mcp_url: endpoint, remote_url: "http://127.0.0.1:1", token: "explicit-plan-token", timeout_ms: 1500 }, "Bearer explicit-plan-token"],
        [{ remote_url: endpoint, token: "", timeout_ms: "1500" }, undefined],
      ]) {
        const start = requests.length;
        const result = await runPlanMap({ planId: "fresh-plan", input: options });
        assert.equal(result.mermaid, "graph TD; A-->B");
        assert.match(result.frontierLine, /Frontier \(1\): B/);
        assert.deepEqual(requests.slice(start).map((item) => item.authorization), Array(4).fill(expectedToken));
        assert.deepEqual(requests.slice(start).filter((item) => item.message.method === "tools/call")
          .map((item) => item.message.params.name), ["plan", "plan"]);
      }
    });
  });
});

test("plan map rejects invalid explicit timeouts and empty endpoints", async () => {
  await withConflictingEnvironment(async () => {
    for (const timeout_ms of [0, -1, NaN, Infinity, "not-a-number", "", 2_147_483_648]) {
      await assert.rejects(runPlanMap({ planId: "fresh-plan", input: { timeout_ms } }), /positive finite/);
    }
    await assert.rejects(runPlanMap({ planId: "fresh-plan", input: { mcp_url: "", token: "" } }), /endpoint_unconfigured/);
  });
});

test("binary engine's optional native ingest preserves explicit endpoint and credential", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "harness-binary-transport-"));
  try {
    await writeFile(join(fixture, "artifact.bin"), "fresh component artifact");
    const analyzer = join(fixture, "fixture-analyzer.cjs");
    await writeFile(analyzer, `#!${process.execPath}\nconst fs = require('node:fs');\nconst args = process.argv.slice(2);\nfs.writeFileSync(args[args.indexOf('-postScript') + 2], JSON.stringify({ functions: [{ name: 'fresh_function' }] }));\n`);
    await chmod(analyzer, 0o755);
    await withNativeFixture(async (endpoint, requests) => {
      await withConflictingEnvironment(async () => {
        const result = await reconstructBinaryFromSource({ path: fixture, artifact_path: "artifact.bin",
          ghidra_headless_path: analyzer, ingest_datawave: true, remote_url: endpoint,
          token: "explicit-binary-token", timeout_ms: 1500 });
        assert.equal(result.status, "ok");
        assert.equal(result.datawave.records_count, 1);
        assert.equal(result.datawave.result.result.ingested, 1);
        assert.deepEqual(requests.map((item) => item.authorization), Array(3).fill("Bearer explicit-binary-token"));
        assert.equal(requests.at(-1).message.params.name, "datawave_ingest");
      });
    });
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("the host grep module exports only the literal/regex host utility", () => {
  assert.deepEqual(Object.keys(hostGrep), ["queryGrep"]);
});
