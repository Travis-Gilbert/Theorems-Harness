---
name: index
description: This skill should be used when the user asks to "index context", "query memory", "find prior decisions", "assemble context", "inspect adaptive index state", "explain retrieval receipts", or needs memory, code maps, query receipts, and index-aware context before answering or acting.
version: 0.1.4
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
  already ranks memory, context views, maps, and query receipts with the learned
  reranker when configured.
- Hydrate full memory only after the packet proves it is needed.
- If `index_context` degrades, call `index_spine` for a narrower diagnostic read
  and report `remote_unavailable` or `contract_missing` explicitly.

Useful calls:

- `index_context({"query":"...", "limit":8})`
- `index_context({"query":"...", "cache_policy":"bypass"})`
- `index_spine({"surface":"overview"})`
- `index_spine({"surface":"query_receipts", "limit":10})`

Do not hand-fuse many retrieval lists in the model when the index packet can do
it. Treat `fusion.mode: "learned_listwise_reranker"` or
`"learned_cross_encoder_reranker"` as the normal healthy path. Treat
`fusion.mode: "weighted_rrf"` as a fallback that should explain whether the
learned reranker was not configured or failed.
