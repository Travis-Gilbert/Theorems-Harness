#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";

import { createRelay } from "../generated/relay.mjs";
import { rpc } from "../generated/native-client.mjs";
import { queryGrep } from "../product/grep.mjs";
import { runRemoteDoctor } from "../product/remote-doctor.mjs";
import { loadCapabilityScorecards } from "../product/scorecards.mjs";
import { reconstructBinaryFromSource } from "../product/binary-from-source.mjs";

const PACKAGE_VERSION = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
).version;

const hostTools = {
  grep: {
    definition: {
      name: "grep",
      description: "Search files in the current workspace for literal or regular expression matches.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, pattern: { type: "string" }, cwd: { type: "string" } } },
    },
    run: queryGrep,
  },
  doctor: {
    definition: {
      name: "doctor",
      description: "Check native Theorem endpoint reachability and local host package scorecards.",
      inputSchema: { type: "object", properties: {} },
    },
    run: async () => {
      const native = await rpc("tools/list");
      return {
        schema_version: 1,
        status: native.ok ? "ok" : "degraded",
        checks: [{ name: "native-theorem", status: native.ok ? "ok" : "degraded", reason: native.reason, message: native.message }],
      };
    },
  },
  remote_doctor: {
    definition: {
      name: "remote_doctor",
      description: "Probe a remote Harness service's health, readiness, queue, dependencies, and tenant guardrails.",
      inputSchema: { type: "object", properties: { remote_url: { type: "string" }, token: { type: "string" }, timeout_ms: { type: "number" } } },
    },
    run: runRemoteDoctor,
  },
  capability_scorecards: {
    definition: {
      name: "capability_scorecards",
      description: "Return the package's capability measurement targets.",
      inputSchema: { type: "object", properties: {} },
    },
    run: () => loadCapabilityScorecards(),
  },
};

const relay = createRelay({
  serverInfo: { name: "theorems-harness-product", version: PACKAGE_VERSION },
  hostTools,
  engines: { "ghidra-headless+local-build-toolchain": reconstructBinaryFromSource },
});

export async function handleRpcMessage(message) {
  return relay(message);
}

let writeFraming = "newline";

function writeMessage(message) {
  const body = JSON.stringify(message);
  if (writeFraming === "lsp") stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  else stdout.write(`${body}\n`);
}

function parseFramedMessages(buffer) {
  const messages = [];
  let rest = buffer;
  while (rest.length) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;
    const header = rest.slice(0, headerEnd).toString("utf8");
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!lengthMatch) break;
    const length = Number(lengthMatch[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (rest.length < bodyEnd) break;
    messages.push({ message: JSON.parse(rest.slice(bodyStart, bodyEnd).toString("utf8")), framed: true });
    rest = rest.slice(bodyEnd);
  }
  while (rest.length) {
    const newline = rest.indexOf("\n");
    if (newline === -1) break;
    const line = rest.slice(0, newline).toString("utf8").trim();
    rest = rest.slice(newline + 1);
    if (line) messages.push({ message: JSON.parse(line), framed: false });
  }
  return { messages, rest };
}

async function runStdio() {
  let buffer = Buffer.alloc(0);
  for await (const chunk of stdin) {
    buffer = Buffer.concat([buffer, chunk]);
    const parsed = parseFramedMessages(buffer);
    buffer = parsed.rest;
    for (const entry of parsed.messages) {
      if (entry.framed) writeFraming = "lsp";
      const response = await handleRpcMessage(entry.message);
      if (response !== null) writeMessage(response);
    }
  }
  const parsed = parseFramedMessages(buffer);
  for (const entry of parsed.messages) {
    if (entry.framed) writeFraming = "lsp";
    const response = await handleRpcMessage(entry.message);
    if (response !== null) writeMessage(response);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await runStdio();
