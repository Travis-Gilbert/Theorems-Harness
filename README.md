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
npm run doctor
npm run remote-doctor
node src/bin/theorems-harness.mjs doctor --json
THEOREMS_HARNESS_REMOTE_URL=https://example.internal \
  node src/bin/theorems-harness.mjs remote-doctor --json
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

## Diagnostics

This repo now exposes the same product contract three ways:

- hooks inject model-visible context
- MCP tools expose explicit diagnostics
- `npm run doctor` probes the adapter contract, Rust visibility, scorecards, and
  receipt writes

The MCP facade includes:

- `capability_manifest`
- `prepare_context`
- `capability_scorecards`
- `doctor`
- `remote_doctor`
- `index_context`
- `index_spine`
- `write_receipt`

`scorecards/capability-scorecards.json` is the measurement surface for trigger
precision, trigger recall, prompt overhead, latency, degradation rate, and host
visibility coverage.

Set `THEOREMS_HARNESS_REMOTE_READY=1` only when a remote Theorem/RustyRed adapter
is actually available. Otherwise remote-only abilities report explicit degraded
states such as `remote_unavailable`.

Set `THEOREMS_HARNESS_REMOTE_URL` to run the remote doctor. The remote doctor
requires liveness/readiness probes plus structured diagnostics for durable async
queues, feature-scoped dependency degradation, and per-tenant guardrails.

The `index_context` MCP tool is the normal query-start path for index-aware
context assembly. It calls native GraphQL memory and index-spine fields, fuses
memory, query receipts, context views, and map artifacts with weighted RRF, and
caches the compact packet by a stable key. A substrate reranker or Valkey-backed
cache can replace those internals without changing the product tool shape.

The `index_spine` MCP tool is the lower-level inspection path. It proxies the
native Theorem/RustyRed `rustyred_thg_index_spine` tool over the configured
remote MCP endpoint and returns explicit `remote_unavailable` or
`contract_missing` states instead of silently pretending the adaptive index
cannot answer.
