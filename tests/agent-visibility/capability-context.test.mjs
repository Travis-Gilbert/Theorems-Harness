import assert from "node:assert/strict";
import test from "node:test";

import { compileContext } from "../../src/product/compile-context.mjs";
import { hookResponse } from "../../src/product/hook-io.mjs";

test("Rust prompt activates cached Rust Engineering context", async () => {
  const { packet, markdown } = await compileContext({
    prompt: "Please edit the Rust harness crate and run cargo test",
    cwd: process.cwd(),
    changed_files: [],
  });

  assert.equal(packet.status, "ok");
  assert.equal(packet.active_capabilities[0]?.id, "rust-engineering");
  assert.equal(packet.receipt_events.some((item) => item.type === "CapabilityActivated"), true);
  assert.match(markdown, /Rust Engineering/);
  assert.match(markdown, /cargo test -p <crate> <test_name>/);
});

test("Rust changed file activates Rust Engineering without prompt keyword", async () => {
  const { packet } = await compileContext({
    prompt: "Fix this implementation",
    cwd: process.cwd(),
    changed_files: ["src/lib.rs"],
  });

  assert.equal(packet.active_capabilities.some((item) => item.id === "rust-engineering"), true);
});

test("index prompt activates Index Context skill guidance", async () => {
  const { packet, markdown } = await compileContext({
    prompt: "Find the relevant memory and prior decision using the adaptive index",
    cwd: process.cwd(),
    changed_files: [],
  });

  assert.equal(packet.active_capabilities.some((item) => item.id === "index-context"), true);
  assert.equal(packet.receipt_events.some((item) => item.type === "CapabilityActivated"), true);
  assert.match(markdown, /Index Context/);
  assert.match(markdown, /index_context/);
});

test("reverse engineering prompt activates cached Reverse Engineer guidance", async () => {
  const { packet, markdown } = await compileContext({
    prompt: "Reverse engineer this GitHub repo into a rebuild plan and parity checklist",
    cwd: process.cwd(),
    changed_files: [],
  });

  assert.equal(packet.status, "ok");
  assert.equal(packet.active_capabilities.some((item) => item.id === "reverse-engineer"), true);
  assert.equal(packet.receipt_events.some((item) => item.type === "CapabilityActivated"), true);
  assert.match(markdown, /Reverse Engineer/);
  assert.match(markdown, /Reverse engineer from evidence/);
});

test("compound prompt activates background action-candidate receipts", async () => {
  const { packet, markdown } = await compileContext({
    prompt: "Turn this postmortem into a reusable learning signal",
    cwd: process.cwd(),
    changed_files: [],
  });

  assert.equal(packet.active_capabilities.some((item) => item.id === "compound-engineering"), true);
  assert.equal(packet.receipts_required.includes("CompoundActionItem"), true);
  assert.match(markdown, /Compound Engineering/);
  assert.match(markdown, /reviewable action candidates/);
});

test("code neighborhood reports no_manifest instead of silent null", async () => {
  const { packet, markdown } = await compileContext({
    prompt: "What is the impact of changing this code path?",
    cwd: process.cwd(),
    changed_files: [],
  });

  assert.equal(packet.degraded_capabilities.some((item) => item.reason === "no_manifest"), true);
  assert.equal(packet.receipt_events.some((item) => item.type === "CapabilityDegraded"), true);
  assert.match(markdown, /Code Neighborhood: no_manifest/);
});

test("remote-only ambient capabilities report remote_unavailable when adapter is absent", async () => {
  const { packet, markdown } = await compileContext({
    prompt: "Coordinate with the other agent in the room",
    cwd: process.cwd(),
    changed_files: [],
  });

  assert.equal(packet.active_capabilities.some((item) => item.id === "coordination-context"), false);
  assert.equal(
    packet.degraded_capabilities.some(
      (item) => item.id === "coordination-context" && item.reason === "remote_unavailable",
    ),
    true,
  );
  assert.match(markdown, /Coordination Context: remote_unavailable/);
});

test("hook response preserves the originating hook event", () => {
  const response = hookResponse("context", { status: "ok" }, "PreToolUse");

  assert.equal(response.hookSpecificOutput.hookEventName, "PreToolUse");
});
