---
description: Reconstruct a repo, URL, API, feature, workflow, or binary into a grounded spec or component plan.
argument-hint: "[compose|binary|binary-from-source|datawave] [target]"
---

# /reconstruct

Use the Theorems Harness Product reconstruction MCP surface for the user's
target. The target may be a repository, local path, URL, API, workflow, feature,
binary artifact, or Datawave record set.

Interpret `$1` as an optional mode:

- `compose` or no mode: call `reconstruct` with `mode: "compose"`.
- `binary`: call `reconstruct` with `mode: "binary"`.
- `binary-from-source`, `binary_from_source`, or `build`: call `reconstruct`
  with `mode: "binary_from_source"`.
- `datawave`: call `reconstruct` with `mode: "datawave"`.

For source repositories, prefer compose mode. For binary artifacts, prefer binary
mode. Do not compile source into a binary unless the user explicitly asks for a
build-to-binary oracle; for `binary_from_source`, require an explicit build
command, artifact glob or path, and confirmation before executing local build
commands.

The product tool routes to native substrate tools:

- compose -> `reverse_engineer_compose`
- binary -> `reconstruct_binary`
- datawave -> `datawave_ingest`
- binary-from-source -> local sandbox build, optional Ghidra headless analysis,
  optional Datawave ingest

If the reconstruction MCP surface is unavailable, report the degraded reason
such as `remote_unavailable`, `contract_missing`, or
`reconstruction_backend_missing` before doing manual inspection.

Return a reconstruction result with:

- target and mode
- evidence read
- component/spec plan
- confidence and degraded reason, if any
- validators or parity checks
- next reconstruction pass
