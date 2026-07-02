---
name: reverse-engineer
description: This skill should be used when the user asks to "reverse engineer" a repository, URL, website, codebase, product surface, feature, API, workflow, or binary artifact, or asks to "reconstruct" behavior into a grounded map, behavior spec, parity checks, or rebuild plan.
version: 0.1.2
---

# Reverse Engineer

Start from the supplied repo, path, artifact, or URL. If the target is missing,
ask for it before doing broad research.

Reverse engineering means reconstructing observable structure and behavior from
evidence. Do not infer from vibe, screenshots alone, or training memory when
the source can be read, cloned, crawled, run, or queried.

When the Theorems Harness product MCP exposes `reconstruct`, use it as the front
door for repo/path/source reverse-engineering. In source mode it asks the
Theorem substrate to ensure source evidence, compile code IR, project Datawave
facts, summarize binary artifacts when present, and return one
`ReconstructionSpec`. If the tool, or a documented GraphQL equivalent, is
unavailable, report `compose_surface_missing` or
`reconstruction_backend_missing` before falling back to manual repo inspection.

Use `reconstruct` binary mode for binary artifacts and Ghidra-style analysis.
Do not compile a source repository into a binary just to decompile it; source
evidence is richer. For a source-only repo, a null or absent binary summary is
expected, while Datawave projection should still be present through compose.
When the user explicitly wants a build-to-binary oracle, use
`reconstruct(mode: "binary_from_source")` with a local source path, an explicit
artifact path or glob, and `confirmed: true`. That mode copies source to a
temporary sandbox, runs the confirmed build command, hashes the artifact, runs
Ghidra `analyzeHeadless` when configured, and can ingest the exported Ghidra
facts into Datawave.

## Default Workflow

1. Classify the target:
   - repo/path: inspect files, manifests, routes, tests, build scripts, and docs.
   - URL/site: inspect the live surface, network/API behavior, rendered UI, and
     publicly available source references.
   - feature: identify the owning files, user flow, state/data model, APIs,
     validation rules, and tests.
   - binary/artifact: use available reconstruction/disassembly tooling; if the
     binary reconstruction engine is unavailable, report that as a degraded
     state instead of pretending source-level certainty.
2. Establish authorization and bounds. Do not bypass authentication, scrape
   private data, exfiltrate secrets, or evade rate limits. For private targets,
   use only the access the user has provided.
3. Build an evidence map:
   - entrypoints, routes, components, services, jobs, and commands
   - data stores, schemas, API contracts, event streams, and side effects
   - critical interactions, states, validations, permissions, and errors
   - dependencies, generated artifacts, build/runtime requirements, and deploy
     boundaries
4. Produce reconstruction artifacts sized to the task:
   - architecture map
   - feature behavior spec
   - data/API contract
   - parity checklist
   - implementation/rebuild plan
   - risk and unknowns ledger
5. Validate against an oracle:
   - existing tests, typecheck, lint, build, smoke route, screenshot comparison,
     API fixture, golden output, or replayed user flow
   - if no oracle exists, name the missing oracle and propose the smallest one

## Theorem Compose Mode

For repo/path/source targets, prefer:

```json
{
  "tool": "reconstruct",
  "arguments": {
    "mode": "compose",
    "source": {
      "github_url": "https://github.com/example/project.git"
    },
    "datawave_fact_limit": 1000000
  }
}
```

Expected output signals:

- `provenance.ingest_path` states whether evidence was newly ingested or loaded.
- `code_files_count` and `code_symbols_count` prove the code graph populated.
- `provenance.code_to_datawave` proves Datawave projection fired.
- `binary` is present only when binary artifacts are in scope.
- `drift` names mismatches against prior specs, not vague uncertainty.

## Binary From Source Mode

Use this only when binary evidence is the desired oracle, not as the default way
to understand source code:

```json
{
  "tool": "reconstruct",
  "arguments": {
    "mode": "binary_from_source",
    "local_path": "/path/to/source",
    "confirmed": true,
    "build_command": "cargo build --release",
    "artifact_path": "target/release/app",
    "ingest_datawave": true
  }
}
```

Expected output signals:

- `build.commands[].exit_code` proves the chosen build command ran.
- `artifact.sha256` and `artifact.byte_len` prove the exact binary artifact.
- `ghidra.status` is `ok`, `skipped`, or a degraded reason such as
  `ghidra_unavailable`.
- `ghidra.facts_summary` counts exported functions, imports, call edges, P-code,
  and decompiler facts when Ghidra ran.
- `datawave.records_count` and native ingest result prove graph projection when
  `ingest_datawave` is requested.

## Repo/Codebase Mode

Prefer local commands over memory:

- `git status --short`
- `rg --files`
- manifests such as `package.json`, `Cargo.toml`, `pyproject.toml`,
  `pnpm-workspace.yaml`, `turbo.json`, `next.config.*`, and CI files
- route directories, server entrypoints, tests, migrations, seed data, and docs
- `rg` for named feature terms before widening

Output a map from product behavior back to concrete files and functions. Avoid
claiming ownership or behavior without a path or runtime observation.

## URL/Site Mode

Use browser and web tooling to inspect:

- rendered pages and responsive states
- navigation, forms, controls, auth boundaries, and error states
- network calls, response shapes, static assets, and client bundles
- metadata, robots/sitemap where relevant, and public docs

When cloning a public reference repo is useful, bind findings to the checked-out
commit hash or URL. Keep quotes short and source-linked.

## Feature Mode

Reconstruct the feature from the outside in:

- user intent and entrypoints
- happy path, empty/loading/error states, permissions, and edge cases
- state transitions and persistence
- upstream/downstream APIs and background effects
- acceptance tests or parity checks needed to rebuild it

Deliver a buildable spec, not just a description.

## Output Shape

For small targets, answer with:

- `What it is`
- `How it works`
- `Evidence`
- `Rebuild/parity plan`
- `Unknowns`

For larger targets, create or update an implementation plan in the repo and keep
the final answer to the highest-signal summary plus file links.

## Anti-Patterns

- Treating visual similarity as behavioral parity.
- Using lexical guesses when a route, component, or API can be inspected.
- Reconstructing a private system from public fragments without naming
  uncertainty.
- Skipping the oracle because the map looks plausible.
- Mixing competitor-copying instructions with evidence-backed behavior analysis.
