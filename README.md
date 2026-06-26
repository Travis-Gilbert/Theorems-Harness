# Theorems Harness

Better code. Lower usage. Grows more intelligent with time.

This repo is the product delivery surface for Theorems Harness. Theorem and
RustyRed remain the substrate/runtime sources of truth; this repo decides what
Claude, Codex, and other hosts can actually experience.

## Product Boundary

The repo owns:

- capability manifests
- cached host skills
- Claude/Codex plugin manifests
- lifecycle hooks
- MCP facade contracts
- SDK/adapter routing
- agent visibility tests

Theorem/RustyRed own:

- graph storage
- runtime kernels
- code compiler artifacts
- memory and ensemble internals
- skill-pack persistence
- affordance learning

## First Slice

The first shipped capability is a local, deterministic visibility contract:

- Rust work activates the cached Rust Engineering capability without a model
  tool call.
- Hooks compile a compact context packet for Claude/Codex.
- The MCP facade exposes the same packet explicitly for diagnostics.
- Tests prove the capability reaches the agent even without a live RustyRed
  connection.

```bash
npm test
node src/bin/prepare-context.mjs <<'JSON'
{"prompt":"Edit Rust code in the harness crate","cwd":"/tmp/demo","changed_files":["src/lib.rs"]}
JSON
```

## Capability Manifest

`capabilities/capability-manifest.json` is the product contract. Each ability
declares:

- trigger conditions
- delivery tier (`ambient`, `jit`, `explicit`, or `background`)
- local fallback
- backing Theorem/RustyRed verbs
- receipt expectations
- whether it must be visible to the model

The goal is simple: an ability is not real until it reaches the model or writes
a receipt.
