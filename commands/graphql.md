---
description: Run Theorems GraphQL reads, mutations, or schema introspection through the product MCP facade.
argument-hint: "[query|mutation|introspect] [GraphQL or task]"
---

# /graphql

Use the Theorems Harness Product GraphQL MCP surface for the user's request.

Interpret `$1` as an optional mode:

- `query` or no mode: use `graphql_query`.
- `mutation` or `mutate`: use `graphql_mutate`.
- `introspect`, `schema`, or `introspection`: use `graphql_introspect`.

Treat the rest of `$ARGUMENTS` as the GraphQL document, operation description,
or schema question. If the user provides variables, preserve them as structured
variables. If the user provides only a natural-language task, first translate it
into the smallest useful GraphQL operation and state that translation before
calling the MCP tool.

Prefer these product tools in order:

1. `graphql_query` for reads.
2. `graphql_mutate` for writes.
3. `graphql_introspect` for schema discovery.

Do not invent schema fields. If the schema is uncertain, call
`graphql_introspect` first. If the GraphQL MCP surface is unavailable, report the
degraded reason such as `remote_unavailable` or `contract_missing`, then offer a
manual fallback only after naming that limitation.

Return:

- operation used
- variables or filters used
- important result fields
- degraded reason, if any
- follow-up query or mutation that would narrow the result
