---
name: index
description: Use when a task needs memory, context, prior decisions, code maps, query receipts, adaptive index state, or index-aware context assembly before answering or acting.
---

# Index

Use the Harness index as a query planner for context, not as a synonym for
search. Prefer GraphQL-backed index context before broad recall or ad hoc grep.

Start with `index_context` for user queries that need prior memory, project
state, context views, code maps, or the reason a previous retrieval happened.
It returns a compact packet with ranked context, provenance, index health, and
cache metadata.

Default workflow:

- Extract the task intent, concrete entities, project hints, dates, file paths,
  tool names, and exact ids from the user prompt.
- Call `index_context` with the smallest useful `limit`.
- Trust the returned ranked packet over manual list fusion. The product layer
  already fuses memory, context views, maps, and query receipts.
- Hydrate full memory only after the packet proves it is needed.
- If `index_context` degrades, call `index_spine` for a narrower diagnostic read
  and report `remote_unavailable` or `contract_missing` explicitly.

Useful calls:

- `index_context({"query":"...", "limit":8})`
- `index_context({"query":"...", "cache_policy":"bypass"})`
- `index_spine({"surface":"overview"})`
- `index_spine({"surface":"query_receipts", "limit":10})`

Do not hand-fuse many retrieval lists in the model when the index packet can do
it. If a learned substrate reranker is available, let it replace the fusion
stage behind the same product contract.
