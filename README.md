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

## Host Packaging

The product package installs as `theorems-harness-product`, not
`theorems-harness`. The broader `theorems-harness@codex-marketplace` package is
the workflow/control-plane pack for planning, execution, coordination, and
reporting. This package is the product facade: Data API, reconstruction, index,
capability visibility, hooks, and the local MCP membrane over Theorem/RustyRed.
The membrane exposes the native `plan` verb by name and the remote doctor fails
with `native_plan_missing` when a deployed RustyRed server has drifted behind
the planning contract.

Claude Code and Codex both discover the root `.mcp.json` when the plugin is
enabled. The MCP launcher therefore resolves the plugin root through
`${CLAUDE_PLUGIN_ROOT}` or `${PLUGIN_ROOT}` before starting
`src/mcp/server.mjs`, so the facade does not depend on the user's current shell
directory.

Both hosts also run the bounded `session-code-context` hook at SessionStart.
It treats tenant-scoped server `kg_status` as the only freshness authority:
unknown repositories enqueue `ingest`, changed indexed SHAs enqueue `reindex`,
and a current indexed SHA reads `context_pack` without passing `repo_url`.
Submission metadata in `.harness/code-kg-manifest.json` never certifies that
indexing finished. Set `THEOREM_CODE_CONTEXT_OWNER=installed` when the canonical
`~/.theorem/hooks/session_start.sh` is registered so co-installed plugins do not
repeat that lifecycle; otherwise the product and workflow plugins share an
atomic same-session submit claim.

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
- `grep`
- `semantic_grep`
- `memory_grep`
- `mgrep`
- `query_data`
- `retrieve_memory`
- `turn_start`
- `evidence_bundle`
- `compound_engineering`
- `graphql_query`
- `graphql_mutate`
- `graphql_introspect`
- `reconstruct`
- `compute_code`
- `understand_code`
- `impact`
- `oracle`
- `observe_web`
- `native_mcp_call`
- `write_receipt`

The plugin also bundles slash-command shortcuts over the most common product
surfaces:

- `/graphql` routes to `graphql_query`, `graphql_mutate`, and
  `graphql_introspect`
- `/code` routes to `compute_code`, `understand_code`, `impact`, and `oracle`
- `/reconstruct` routes to `reconstruct` compose, binary, binary-from-source,
  and Datawave modes
- `/memory` routes to `retrieve_memory`, `query_data`, `turn_start`, and
  `evidence_bundle`
- `/grep` routes to `grep`, `semantic_grep`, `memory_grep`, and `mgrep`

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
memory, query receipts, context views, and map artifacts with the learned
listwise reranker when configured, then the learned cross-encoder, and only
falls back to weighted RRF when learned ranking is unavailable. The compact
packet is cached by a stable key that includes the reranker identity, so a
Valkey-backed cache can replace the local cache without changing the product
tool shape.

The `index_spine` MCP tool is the lower-level inspection path. It proxies the
native Theorem/RustyRed `rustyred_thg_index_spine` tool over the configured
remote MCP endpoint and returns explicit `remote_unavailable` or
`contract_missing` states instead of silently pretending the adaptive index
cannot answer.

The grep tools are the flat search surface. `grep` is a bounded local literal or
regex search with code-neighborhood formatting: file, line, nearest symbol, and
before/after context. `semantic_grep` ranks local file chunks with term, phrase,
path, and symbol signals, or routes to native `compute_code` when
`backend=native` or `backend=code_graph`. `memory_grep` searches memory through
the Data API rather than scraping private local memory files. `mgrep` is the
multi-source router for code/files, memory/data, web/docs/API evidence, or
`source=all` combined searches.

The Data API tools are the records membrane from Theorem PR-103. `query_data`
queries typed records with deterministic filters, cursoring, provenance, rank
signals, and link hydration. `retrieve_memory` is memory retrieval over that
same membrane. `turn_start` asks the substrate for the compact work packet at
the start of a turn, `evidence_bundle` hydrates cited records, and `observe_web`
turns URL/API/docs evidence into records that later queries can join.

The `reverse-engineer` skill is the agent-facing wrapper for evidence-first
reconstruction work. It starts from a repo, path, URL, feature, API, workflow, or
artifact; produces grounded maps, behavior specs, parity checklists, and rebuild
plans; and routes deeper code/compiler/binary reconstruction to Theorem-owned
substrate tooling when available. Its first-class Theorem substrate entrypoint is
`reconstruct`: source-repo mode should produce a `ReconstructionSpec` with code
counts and Datawave projection receipts, while binary/Ghidra-style
reconstruction is selected only for binary artifacts or explicit
`binary_from_source` requests. `binary_from_source` copies a local source tree to
a temporary sandbox, runs confirmed build commands, hashes the selected artifact,
optionally runs Ghidra `analyzeHeadless` with the bundled exporter, and can proxy
the exported Ghidra facts into native `datawave_ingest`.
