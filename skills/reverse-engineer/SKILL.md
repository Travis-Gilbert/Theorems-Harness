---
name: reverse-engineer
description: Use when the user asks to reverse engineer a repository, URL, website, codebase, product surface, feature, API, workflow, or binary artifact into a grounded map, behavior spec, parity checks, or rebuild plan.
---

# Reverse Engineer

Start from the supplied repo, path, artifact, or URL. If the target is missing,
ask for it before doing broad research.

Reverse engineering means reconstructing observable structure and behavior from
evidence. Do not infer from vibe, screenshots alone, or training memory when
the source can be read, cloned, crawled, run, or queried.

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
