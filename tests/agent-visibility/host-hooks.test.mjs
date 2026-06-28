import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("Claude-style prompt hook injects Rust Engineering context", () => {
  const response = runHook("src/bin/prepare-context.mjs", {
    hook_event_name: "UserPromptSubmit",
    prompt: "Please edit the Rust crate",
    cwd: root,
    changed_files: [],
  });

  assert.equal(response.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(response.hookSpecificOutput.additionalContext, /Rust Engineering/);
  assert.equal(
    response.theoremsHarness.active_capabilities.some((item) => item.id === "rust-engineering"),
    true,
  );
});

test("lifecycle hook preserves Stop and activates Compound Engineering", () => {
  const response = runHook("src/bin/prepare-context.mjs", {
    hook_event_name: "Stop",
    cwd: root,
  });

  assert.equal(response.hookSpecificOutput.hookEventName, "Stop");
  assert.equal(
    response.theoremsHarness.active_capabilities.some(
      (item) => item.id === "compound-engineering",
    ),
    true,
  );
  assert.equal(response.theoremsHarness.receipts_required.includes("CompoundActionItem"), true);
  assert.match(response.hookSpecificOutput.additionalContext, /Compound Engineering/);
});

test("post-tool hook preserves PostToolUse and activates Compound Engineering", () => {
  const response = runHook("src/bin/prepare-context.mjs", {
    hook_event_name: "PostToolUse",
    tool_name: "functions.exec_command",
    tool_input: {
      cmd: "cargo test -p theorem-harness-runtime compound_engineering",
    },
    cwd: root,
  });

  assert.equal(response.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.equal(
    response.theoremsHarness.active_capabilities.some(
      (item) => item.id === "compound-engineering",
    ),
    true,
  );
});

test("Codex-style pre-tool hook keeps PreToolUse event and activates Rust Engineering", () => {
  const response = runHook("src/bin/pretool-context.mjs", {
    tool_name: "functions.apply_patch",
    tool_input: {
      patch: "*** Update File: src/lib.rs\n",
    },
    cwd: root,
  });

  assert.equal(response.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.match(response.hookSpecificOutput.additionalContext, /Rust Engineering/);
});

test("Claude and Codex hook configs install lifecycle Compound Engineering triggers", () => {
  const claudeHooks = readJson("hooks/hooks.json");
  const codexHooks = readJson("hooks/codex-hooks.json");

  for (const config of [claudeHooks, codexHooks]) {
    assert.ok(config.hooks.Stop, "Stop hook is registered");
    assert.ok(config.hooks.PostToolUse, "PostToolUse hook is registered");
  }
});

function runHook(script, input) {
  const child = spawnSync(process.execPath, [resolve(root, script)], {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify(input),
  });

  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}
