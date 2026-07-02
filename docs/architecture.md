# Architecture

Theorems Harness product is the membrane between agents and the Theorem/RustyRed
substrate.

## Layers

1. **Substrate**: Theorem and RustyRed crates own storage, runtime, memory,
   code compiler artifacts, ensemble learning, skill-pack persistence, and
   affordance routing.
2. **Adapters**: this repo owns product calls into those systems through stable
   verbs such as `harness_prepare`, `coordination_context`, `skill_apply`,
   `context_pack`, `tool_search`, and `invoke`.
3. **Capability compiler**: `capabilities/capability-manifest.json` maps abilities
   to triggers, delivery tier, fallback, backing verbs, and receipts.
4. **Host delivery**: hooks compile model-visible context before Claude/Codex
   acts and lifecycle packets after tool/session boundaries. The MCP facade
   exposes the same compiler for explicit diagnostics.

## Delivery Tiers

- `ambient`: injected automatically before the model acts.
- `jit`: injected immediately before relevant tool use or after failure signals.
- `explicit`: available as a tool, command, or user-invoked operation.
- `background`: runs receipt and learning loops without bloating context.

`compound-engineering` is the canonical background lifecycle capability. Host
hooks activate it on `PostToolUse` and `Stop`, while the MCP facade and native
HTTP summary keep the same signal inspectable when Theorem runs locally.

## Acceptance Rule

An ability is not considered delivered until it reaches the model context or
writes a receipt.

## Adapter Contract

The host-facing adapter verbs are:

- `prepareContext`
- `applySkill`
- `readCodeNeighborhood`
- `writeReceipt`
- `selectAffordance`

The local adapter is intentionally small and deterministic. It proves that the
product layer can compile visibility packets, scorecards, and receipts without a
live RustyRed connection. Remote adapters should implement the same verbs and
return explicit degraded reasons instead of silent nulls.

Product MCP tools can also be thin proxies over native Theorem/RustyRed MCP
tools when the affordance is already substrate-owned. The Data API tools are the
records membrane from Theorem PR-103: `query_data` queries records with
deterministic filters, cursoring, provenance, rank signals, and link hydration;
`retrieve_memory` narrows memory through the same records API; `turn_start`
assembles the compact work packet; `evidence_bundle` hydrates cited records; and
`observe_web` turns URL/API/docs evidence into Data API records. `index_context`
is the query-start path: it calls native GraphQL memory plus index-spine fields,
fuses candidate memories, context views, query receipts, and map artifacts
outside the model context with learned rerankers before falling back to weighted
RRF, and exposes cache metadata. `index_spine` is the lower-level inspection
path: the product tool keeps the host-facing name stable, forwards to native
`rustyred_thg_index_spine`, and reports `remote_unavailable` or
`contract_missing` when the remote MCP endpoint cannot satisfy the contract.
The ranking order is listwise learned reranker, cross-encoder learned reranker,
then weighted RRF fallback. Process-memory TTL caching uses a stable key that
includes the reranker identity; the same key can back a Valkey cache-aside store
when the product MCP runs as a long-lived service.

The GraphQL and reconstruction surfaces follow the same membrane rule. This repo
owns the host-visible product names (`graphql_query`, `graphql_mutate`,
`graphql_introspect`, `reconstruct`, `compute_code`, `understand_code`,
`impact`, `oracle`, and diagnostic `native_mcp_call`), while Theorem owns the
Rust handlers and graph writes.
`reconstruct` is the compound reconstruction front door: source-repo mode routes
to native `reverse_engineer_compose`, binary mode routes to native
`reconstruct_binary`, Datawave mode routes to native `datawave_ingest`, and
`binary_from_source` is the product-local bridge for the source-to-binary oracle:
copy source to a temporary sandbox, run confirmed build commands, hash the
selected artifact, run Ghidra headless when configured, and optionally ingest the
Ghidra JSON facts through native Datawave.
`compute_code` is the compound code front door: search/context/explain-style
operations route to native `compute_code`, while ingest/reindex operations route
to native `code_ingest`. `understand_code`, `impact`, and `oracle` keep their
own flat names because agents look for those verbs directly, but they still
route to native Theorem tools.

`THEOREMS_HARNESS_REMOTE_READY=1` is the product-side readiness gate for remote
abilities without a local fallback. Leave it unset when the MCP registration,
gateway, token, or runtime is unavailable; the capability compiler will report
`remote_unavailable`.

## Remote Service Reliability Contract

The remote doctor is the service-side acceptance contract. It deliberately
checks for product failure modes rather than implementation details:

- Heavy work goes through durable queues with leases, heartbeats, retries, and a
  reaper. Public requests return `202 job_id` or a structured timeout.
- Dependency failures are feature scoped. A missing model token, cold recall
  index, unavailable Valkey, or warming RustyRed store must not take down the
  whole service.
- Multiuser guardrails are explicit per tenant: quotas, concurrency limits,
  queue isolation, rate limits, storage namespaces, and noisy-neighbor
  protection.

The conventional probe paths are `/health`, `/ready`, `/diagnostics/queue`,
`/diagnostics/dependencies`, and `/diagnostics/tenants`. A remote service can
override paths by serving `/.well-known/theorems-harness/doctor.json`.
