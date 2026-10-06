import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Component evidence only: the HTTP endpoint below is a strict fixture.
// This proves cold relay isolation, not deployed code-search or T7 acceptance.
test("cold stdio relay forwards native code calls with the host grep module removed (component fixture)", { timeout: 15_000 }, async () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const ssd = "/Volumes/SSD Samsung/theorem-worktrees";
  const scratch = process.env.THEOREM_TEST_SCRATCH_DIR ?? (existsSync(ssd) ? ssd : tmpdir());
  const candidate = await mkdtemp(join(scratch, "harness-grep-isolation-"));
  const marker = `component-fixture-${randomUUID()}`;
  const requests = [];
  const unexpected = [];
  const nativeResult = {
    structuredContent: { component_fixture: true, marker, results: [{ text: marker }] },
    content: [{ type: "text", text: marker }],
    _meta: { "theorem/route_receipt": { semantic_owner: "rustyred-thg-code::code_router",
      transport: "mcp", product_tool: "compute_code", evidence_class: "fixture" } },
  };
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const message = JSON.parse(body);
    requests.push(message);
    if (request.url !== "/mcp" || request.headers.authorization !== "Bearer component-fixture-token") {
      unexpected.push("wrong endpoint or credential");
      response.writeHead(400).end();
      return;
    }
    let result;
    if (message.method === "initialize") result = { protocolVersion: "2025-03-26", capabilities: {} };
    else if (message.method === "notifications/initialized") {
      response.writeHead(202).end();
      return;
    } else if (message.method === "tools/list") {
      result = { tools: [{ name: "compute_code", description: "Strict component fixture", inputSchema: { type: "object" } }] };
    } else if (message.method === "tools/call" && message.params?.name === "compute_code"
      && message.params.arguments?.query === marker) result = nativeResult;
    else {
      unexpected.push(message);
      response.writeHead(400).end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  });
  let child;
  try {
    await cp(join(root, "src"), join(candidate, "src"), { recursive: true });
    await cp(join(root, "package.json"), join(candidate, "package.json"));
    await cp(join(root, "tool-routes.json"), join(candidate, "tool-routes.json"));
    await rm(join(candidate, "src/product/grep.mjs"));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    child = spawn(process.execPath, [join(candidate, "src/mcp/server.mjs")], {
      cwd: candidate,
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin", THEOREM_API_TOKEN: "component-fixture-token",
        THEOREMS_HARNESS_MCP_URL: `http://127.0.0.1:${server.address().port}/mcp` },
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10_000,
      killSignal: "SIGKILL",
    });
    const closed = once(child, "close");
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const messages = [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {} } },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "compute_code", arguments: { query: marker } } },
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "grep", arguments: { query: marker } } },
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "compute_code", arguments: { query: marker } } },
    ];
    child.stdin.end(messages.map((message) => JSON.stringify(message)).join("\n") + "\n");
    const [exitCode, signal] = await closed;
    assert.equal(exitCode, 0, stderr);
    assert.equal(signal, null);
    const answers = stdout.trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(answers.length, 5);
    assert.equal(answers[0].result.serverInfo.name, "theorems-harness-product");
    assert.ok(answers[1].result.tools.some((tool) => tool.name === "compute_code"));
    assert.deepEqual(answers[2].result, nativeResult);
    assert.equal(answers[3].error.code, -32603);
    assert.match(answers[3].error.message, /grep\.mjs/);
    assert.deepEqual(answers[4].result, nativeResult);
    assert.deepEqual(unexpected, []);
    assert.deepEqual(requests.map((request) => request.method),
      ["initialize", "notifications/initialized", "tools/list", "tools/call", "tools/call"]);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(candidate, { recursive: true, force: true });
  }
});
