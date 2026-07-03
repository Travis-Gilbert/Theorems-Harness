---
name: affordance-router
description: Use when the user asks a graph or tabular question with an exact answer (reachability, transitive closure, shortest or weighted paths, counts, aggregations, set operations, joins), or mentions connectors, external tools, invoke, affordances, or "which tool". Route exact symbolic work to compute_offload.route_operation before reasoning, and keep connector spokes behind tool_search and invoke.
version: 0.1.0
---

# Affordance Router

Connectors and exact-compute engines are affordances, not flat model tools. Keep
connector details behind `tool_search` and `invoke` instead of advertising every
spoke as a model tool, and route exact symbolic work to the CPU executors before
reasoning over it.

## Route symbolic work before reasoning

Before you reason over a graph or tabular question that has an exact answer, call
`route_operation` (compute_offload) and reason only over the facts it returns. It
routes the work to exact CPU executors and returns a compact, token-budgeted fact
block plus a receipt digest and a residual synthesis instruction. Question shapes
that must be routed: reachability, shortest and weighted paths, transitive
closure, counts, aggregations, set operations, and joins over graph or tabular
facts.

Compact-return contract: `route_operation` returns
`{ facts, receipt_digest, residual_instruction, injected_token_estimate,
truncated, total_available }`. `facts` is the canonical one-fact-per-line block,
capped at the 800-token budget; pass `detail: "full"` to expand it. Inject
`facts` into your prompt and follow `residual_instruction`; do not recompute the
pairs. The exact work never touches the model: it is computed once, priced by a
receipt, and reused.

### Worked triggers

1. Multi-hop reachability. "Which nodes are reachable from A in this graph?"
   Route a `datalog_derivation` over the edges, then reason over the returned
   reachable pairs.
2. Weighted path. "What is the cheapest route from A to Z?"
   Route a `graph_shortest_path` operation, then read the path and cost from the
   returned facts.
3. Aggregate count. "How many records match this predicate, grouped by kind?"
   Route a `predicate_filter` (with a downstream count), then reason over the
   returned counts, not the raw rows.

## Discover and invoke other affordances

For connector-backed tools, walk `tool_search` to find the affordance, then
`invoke` it. Do not surface every connector spoke as a flat model tool; the
router selects and scopes the affordance, and every selection and invocation
emits an `AffordanceSelected` or `AffordanceInvoked` receipt.
