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

test("prompt hook activates Affordance Router for exact graph and table work", () => {
  const prompts = [
    "Which nodes are reachable from A in this graph?",
    "How many records match this predicate, grouped by kind?",
    "Join these tables and return the count by status",
    "Compute the set difference between these result sets",
  ];

  for (const prompt of prompts) {
    const response = runHook("src/bin/prepare-context.mjs", {
      hook_event_name: "UserPromptSubmit",
      prompt,
      cwd: root,
      changed_files: [],
    });

    assert.equal(
      response.theoremsHarness.active_capabilities.some(
        (item) => item.id === "affordance-router",
      ),
      true,
      prompt,
    );
    assert.match(response.hookSpecificOutput.additionalContext, /compute_offload\.route_operation/);
  }
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
    assert.ok(config.hooks.SessionStart, "SessionStart hook is registered");
    assert.ok(config.hooks.SessionEnd, "SessionEnd hook is registered");
    assert.ok(config.hooks.PostToolUse, "PostToolUse hook is registered");
    assert.match(
      hookCommands(config.hooks.SessionStart).join("\n"),
      /session-run-open\.mjs/,
      "SessionStart opens the session run",
    );
    assert.match(
      hookCommands(config.hooks.SessionStart).join("\n"),
      /session-code-context\.mjs/,
      "SessionStart checks server-owned code context freshness",
    );
    assert.match(
      hookCommands(config.hooks.SessionEnd).join("\n"),
      /session-run-close\.mjs/,
      "SessionEnd closes the session run",
    );
    assert.match(
      hookCommands(config.hooks.PostToolUse).join("\n"),
      /session-run-tool\.mjs/,
      "PostToolUse records session run tool events",
    );
    assert.ok(hookTimeoutFor(config.hooks.SessionStart, /session-run-open\.mjs/) >= 25);
    assert.ok(hookTimeoutFor(config.hooks.SessionStart, /session-code-context\.mjs/) >= 10);
    assert.ok(
      hookTimeouts(config.hooks.SessionEnd).every((timeout) => timeout >= 25),
      "SessionEnd lifecycle hook has enough budget for close/fail retry appends",
    );
  }
});

test("host package uses product identity and portable MCP launch", () => {
  const claudePlugin = readJson(".claude-plugin/plugin.json");
  const codexPlugin = readJson(".codex-plugin/plugin.json");
  const localMcp = readJson(".mcp.json");

  assert.equal(claudePlugin.name, "theorems-harness-product");
  assert.equal(codexPlugin.name, "theorems-harness-product");
  assert.equal(claudePlugin.version, "0.1.9");
  assert.equal(codexPlugin.version, "0.1.9");
  assert.equal(claudePlugin.hooks, undefined);
  assert.equal(claudePlugin.skills, undefined);
  assert.deepEqual(claudePlugin.commands, PRODUCT_COMMANDS);
  assert.deepEqual(codexPlugin.commands, PRODUCT_COMMANDS);
  assert.equal(codexPlugin.mcpServers, "./.mcp.json");
  assert.deepEqual(localMcp.mcpServers["theorems-harness-product"], {
    command: "sh",
    args: [
      "-lc",
      "cd \"${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-.}}\" && exec node src/mcp/server.mjs",
    ],
  });
});

test("marketplace manifests advertise the product plugin without colliding with workflow harness", () => {
  const claudeMarketplace = readJson(".claude-plugin/marketplace.json");
  const codexMarketplace = readJson(".codex-plugin/marketplace.json");

  for (const marketplace of [claudeMarketplace, codexMarketplace]) {
    assert.equal(marketplace.version, "0.1.9");
    assert.equal(marketplace.plugins.length, 1);
    assert.equal(marketplace.plugins[0].name, "theorems-harness-product");
    assert.equal(marketplace.plugins[0].version, "0.1.9");
    assert.notEqual(marketplace.plugins[0].name, "theorems-harness");
  }
});

test("product skills use Claude trigger metadata", () => {
  for (const skill of ["index", "reverse-engineer", "rust-engineering"]) {
    const source = readFileSync(resolve(root, "skills", skill, "SKILL.md"), "utf8");

    assert.match(source, /^description: This skill should be used when /m);
    assert.match(source, /^version: 0\.1\.4$/m);
  }
});

test("product slash commands route to GraphQL, code, reconstruction, and memory tools", () => {
  const expectations = {
    "commands/graphql.md": ["graphql_query", "graphql_mutate", "graphql_introspect"],
    "commands/code.md": ["compute_code", "understand_code", "impact", "oracle"],
    "commands/reconstruct.md": [
      "reconstruct",
      "reverse_engineer_compose",
      "reconstruct_binary",
      "datawave_ingest",
    ],
    "commands/memory.md": ["query_data", "retrieve_memory", "turn_start", "evidence_bundle"],
    "commands/grep.md": ["grep", "semantic_grep", "memory_grep", "mgrep"],
  };

  for (const [path, tools] of Object.entries(expectations)) {
    const source = readFileSync(resolve(root, path), "utf8");

    assert.match(source, /^description: /m);
    assert.match(source, /^argument-hint: /m);
    for (const tool of tools) {
      assert.match(source, new RegExp(`\\b${tool}\\b`));
    }
    assert.match(source, /degraded reason/);
  }
});

const PRODUCT_COMMANDS = [
  "./commands/graphql.md",
  "./commands/code.md",
  "./commands/reconstruct.md",
  "./commands/memory.md",
  "./commands/grep.md",
];

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

function hookCommands(entries) {
  return (entries ?? []).flatMap((entry) => (entry.hooks ?? []).map((hook) => hook.command ?? ""));
}

function hookTimeouts(entries) {
  return (entries ?? []).flatMap((entry) => (entry.hooks ?? []).map((hook) => Number(hook.timeout ?? 0)));
}

function hookTimeoutFor(entries, pattern) {
  const hook = (entries ?? [])
    .flatMap((entry) => entry.hooks ?? [])
    .find((candidate) => pattern.test(candidate.command ?? ""));
  return Number(hook?.timeout ?? 0);
}
