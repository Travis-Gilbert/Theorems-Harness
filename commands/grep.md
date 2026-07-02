---
description: Search files, code neighborhoods, memory, or web evidence through grep, semantic_grep, memory_grep, and mgrep.
argument-hint: "[exact|semantic|memory|web|all] [query or pattern]"
---

# /grep

Use the Theorems Harness Product grep MCP surface for the user's request.

Interpret `$1` as an optional mode:

- `exact`, `literal`, `regex`, or no mode: call `grep` for bounded local file
  search. Use `regex: true` only when the user asks for regex or supplies a
  clear regex pattern.
- `semantic`, `code`, `context`, or `mgrep`: call `semantic_grep` for ranked
  code/file neighborhoods. Use `backend: "native"` only when the user asks for
  the code graph or compute_code-backed search.
- `memory`, `records`, or `data`: call `memory_grep`, preserving tenant, repo,
  path, room, tag, source, status, validity, id, collection, exact filter, and
  cursor constraints.
- `web`, `docs`, or `api`: call `mgrep` with `source: "web"` so URL/API/docs
  evidence routes through `observe_web`.
- `all`: call `mgrep` with `source: "all"` to combine local semantic file
  search with memory search, reporting degraded sources separately.

Treat the rest of `$ARGUMENTS` as the query, pattern, path, glob, record filter,
URL, or source hint. Prefer exact paths and bounded limits when present. Use
local `grep` before broad semantic search when the user gives a literal symbol,
error string, filename, config key, or log line.

Prefer these product tools:

1. `grep` for exact local literal or regex matches with code-neighborhood
   formatting.
2. `semantic_grep` for ranked local file chunks or native compute_code-backed
   code search.
3. `memory_grep` for memory and Data API records.
4. `mgrep` for multi-source code, memory, web, docs, or API search.

If a remote Data API, compute_code, or observe_web route is unavailable, report
the structured degraded reason such as `remote_unavailable`,
`contract_missing`, or `empty_query`. Keep local grep results separate from
remote degraded states instead of blending them into prose.

Return:

- product tool used
- source and backend used
- query, pattern, path, filters, or URL constraints used
- top matches with file, line, symbol, score, or record id when available
- degraded reason for any unavailable source
- smallest next grep, hydration, or validation step
