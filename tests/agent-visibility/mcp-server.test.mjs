import assert from "node:assert/strict";
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
