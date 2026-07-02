---
description: Query or ingest code context through compute_code, understand_code, impact, and oracle.
argument-hint: "[search|context|ingest|impact|oracle|understand] [query or path]"
---

# /code

Use the Theorems Harness Product code MCP surface for the user's request.

Interpret `$1` as an optional operation:

- `search`, `context`, `explain`, `list`, `status`: call `compute_code` with the
  matching operation.
- `grep`, `exact`, `semantic`, or `mgrep`: call `grep` for exact local matches
  or `semantic_grep` for ranked local code/file neighborhoods.
- `ingest`, `reindex`, or `session-reingest`: call `compute_code` with the ingest
  or reindex operation. Require an explicit local path, repo, or URL before
  ingesting.
- `understand`: call `understand_code`.
- `impact`: call `impact`.
- `oracle`, `validator`, or `validate`: call `oracle`.

Treat the rest of `$ARGUMENTS` as the code query, path, symbol, repo, or feature
description. Prefer exact paths and symbols when present. Use bounded limits by
default and avoid broad repository scans unless the user explicitly asks for one.

Prefer these product tools:

1. `compute_code` for search, context, status, and ingest/reindex routing.
2. `understand_code` for component, feature, ownership, or risk packets.
3. `impact` for blast-radius analysis.
4. `oracle` for validators, obligations, and evidence-backed checks.
5. `grep` or `semantic_grep` when the user needs fast local file matches before
   graph-backed code context.

If the code MCP surface is unavailable or the code KG has no manifest, report the
structured degraded reason such as `remote_unavailable`, `contract_missing`, or
`no_manifest` before falling back to local file inspection.

Return:

- product tool used
- query/path/symbol/repo used
- top evidence or code neighborhoods
- confidence and degraded reason, if any
- smallest next query or validation command
