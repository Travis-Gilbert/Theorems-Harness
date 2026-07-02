---
description: Retrieve memory and evidence through query_data, retrieve_memory, turn_start, and evidence_bundle.
argument-hint: "[query|turn|evidence|record] [memory query or ids]"
---

# /memory

Use the Theorems Harness Product Data API and memory MCP surface for the user's
request. Treat memory retrieval as a records query with deterministic narrowing,
not as an unbounded semantic recall.

Interpret `$1` as an optional mode:

- `query`, `search`, or no mode: call `retrieve_memory` when the target is memory
  recall, or `query_data` when the user supplies exact filters, ids, collections,
  labels, status, validity, repo, path, room, source, or tag constraints.
- `turn`, `start`, or `brief`: call `turn_start`.
- `evidence`, `bundle`, or `cite`: call `evidence_bundle`.
- `record`, `data`, or `records`: call `query_data`.

Treat the rest of `$ARGUMENTS` as the memory query, exact filters, ids, or turn
task. Preserve tenant, repo, path, source, room, status, validity, tag, and id
constraints exactly when provided.

Prefer these product tools:

1. `retrieve_memory` for memory recall inside a deterministic candidate set.
2. `query_data` for exact records, filters, cursoring, or link hydration.
3. `turn_start` for compact work packets at the beginning of a task.
4. `evidence_bundle` for cited records, provenance, links, and snippets.

If the Data API or memory MCP surface is unavailable, report the degraded reason
such as `remote_unavailable`, `contract_missing`, `tenant_unavailable`, or
`broad_scan_required` before falling back to local notes or conversation memory.

Return:

- tool used
- deterministic filters used
- top records or memories with ids
- provenance or evidence links
- cursor or follow-up query when more results are available
