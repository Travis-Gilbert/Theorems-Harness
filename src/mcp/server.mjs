#!/usr/bin/env node
import { stdin, stdout } from "node:process";

import { compileContext } from "../product/compile-context.mjs";
import { loadCapabilityManifest } from "../product/load-manifest.mjs";

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
    return handleToolCall(message);
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
