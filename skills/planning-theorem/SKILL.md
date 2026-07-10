---
name: planning-theorem
description: The Harness planning capability, backed by the durable plan substrate. Use when the task needs stable acceptance criteria, a multi-session plan, a migration shape, or a plan worth handing to another agent. Reachable as /harness mode=plan or, for users who explicitly want planning, the /planning-theorem compatibility command.
---

# Planning-Theorem

Planning is the Harness capability for turning a fuzzy ask into a durable Plan
another agent can execute against. It is not a license to defer real work; it
is the discipline of making acceptance criteria honest before code runs.

`plan create` is the canonical act. A plan lives on the graph substrate as a
Plan node with task nodes, dependencies, transition rules, and a durable event
log. Every file, table, or digest downstream of it is a projection: the file
mirrors the plan; the plan never mirrors the file.

Prefer `/harness` (which routes to planning when the task signals warrant it).
`/planning-theorem` remains a compatibility entrypoint for users who explicitly
want a plan as the deliverable.

## When To Plan

Use this capability when at least one is true:

- the task spans more than one bounded slice
- acceptance criteria are not yet locked
- the work crosses multiple files, modules, or systems and a plan will
  reduce risk
- a future session will pick up where this one stops
- a UI visual surface needs Vision Delta + Do Not Downgrade gating before code
- the user asked for a plan, spec, migration, retrofit, or handoff artifact

Do not plan when the work is a clear one-file fix, a typo, a renamed variable,
or anything the user obviously meant to be executed now. Right-size: a small
task needs a few internal checklist lines, not a Plan node; a launch or
migration needs the full substrate contract.

## Inputs

Any of these are valid inputs:

- a user task in plain language
- an existing SPEC, ADR, or design doc
- a prior plan that needs revision
- a failed execution that needs a re-plan — read the plan's bounded replay
  (`plan` action `replay`, or `harness_replay`) before re-planning; the replay
  is the record of what happened, not the head's memory of it. Replay first,
  re-plan second.
- a research brief or theorem brief that resolved the open questions

## Plan Verbs (grounded in the Theorem MCP `plan` tool)

One tool, `plan`, with an `action` argument:

| Action | Purpose |
|---|---|
| `create` | Mint the Plan node, its tasks, and their substrate ids. The canonical act. |
| `add_task` / `refine` | Add a task; split a claimed task into children that retain plan membership. |
| `claim` | Acquire or release a leased claim on a plan task. |
| `transition` | Move a task (`patch_proposed`, `verifying`, `done`, `failed`, `pending` also work as direct actions). Refusals are durable, replay-visible events. |
| `prove` | Run a task's declared proof command and persist the receipt. |
| `spawn_verify` / `submit_verify` | Open and submit the adversarial verify sibling for a task. |
| `render` | Emit the deterministic projection (markdown + JSON contract). |
| `import` | Lift a legacy `.harness/checklist.json` into a Plan. |
| `query` | Bounded canned queries: `next_actionable`, `frontier`, `blocked_set`, `progress`, `stale_claims`, `verify_debt`. |
| `what_changed` | Events since an anchor version, for cold resume. |
| `analyze` / `converge` | Read structural findings and convergence state for the re-plan signal. |
| `replay` | Bounded page of transition and refusal events (also exposed as `harness_replay`). |

Ground any further signatures in `docs/site/reference/mcp-tools.md` of the
Theorem repo, not in prose summaries of it.

## Operating Posture

- Ground every task in a real file path, test seam, or runtime surface. No
  abstract verbs.
- Task ids are minted by the substrate at `plan create`. Keep human aliases
  (`PT-001`) for readability in prose if you like, but the reconciliation key
  across sessions and heads is always the substrate id.
- Prefer vertical slices over horizontal staging. One real path beats a buffet
  of maybe-paths.
- Make validation, rollback, observability, and migration risk explicit per
  task. Declare the proof command at task creation so the done transition can
  enforce it.
- At checkpoints, read `plan analyze` / `plan converge`. Refinement churn on
  the same task is the re-plan signal, quantified instead of vibed. The old
  instinct — third workaround in the same layer means re-plan — is now a
  number you can read.
- Surface unresolved decisions instead of smoothing them over.
- Never produce wall-clock, compute, or cost estimates ("~2 hours", "~$5",
  "Effort: S/M/L"). Predictions about future work are not part of a plan.
- If the user said "MVP," honor it. Do NOT introduce "MVP" framing yourself.
- If a spec is the source, every spec section must have at least one plan task
  pointing at it. Zero coverage of a spec section is a planning bug, not a
  scope decision.
- Deferrals require explicit user consent. Surface candidate deferrals one at a
  time with a one-sentence justification; do not batch them into a quiet
  "non-goals" table at the end.

## Workflow

1. Reconcile the request against the live repo: read the smallest relevant
   source surface, not a pile of historical specs.
2. Define the production goal in user-visible, system, data, and operational
   terms.
3. For UI visual work, define visual baseline, target references, Vision
   Delta, and Do Not Downgrade criteria before locking the plan.
4. `plan create` with codebase-grounded tasks, acceptance criteria,
   dependencies, and proof commands. The substrate mints the ids.
5. Render the file projection where the hook layer still needs it (see Plan
   Contract below).
6. Record explicit non-goals and deferrals only with surfaced consent.
7. Execution reconciles mechanically, not by prose: heads claim from the plan
   and move tasks through CLAIM -> PATCH -> VERIFY as task transitions. There
   is nothing to define per-plan here anymore.
8. If `handoff=spark` is requested, select the first bounded slice, define
   write/validation scope, delegate it, and stay in-thread to review.

## Plan Contract

The Plan is the board. When planning from a handoff, spec, migration note, or
enumerated deliverable list:

- Compile the source into a plan definition via `plan create` (or `plan
  import` when a legacy checklist file already exists). When the source is a
  HANDOFF doc, its Build Table compiles to the plan definition: the markdown
  stays the human-readable view, the plan is the executable truth. PR #177
  demonstrated this on itself by checking in its own plan definition.
- Write `.harness/checklist.json` as a projection of the plan (`plan render`),
  kept only until the Stop hook reads the substrate directly. The file mirrors
  the plan; the plan never mirrors the file. If you edit scope, edit the plan
  and re-render.
- Reference plans by id and digest everywhere else. Never re-encode plan
  content into coordination records, messages, or reflections — the substrate
  injects a room-bound plan digest automatically and rejects digest
  re-encoding. Board-as-decision-records was a workaround; it is retired.

Completion is a substrate predicate, not an honor rule. The done transition is
refused unless every dependency is done, the verify sibling's receipt is
submitted, and the declared proof command has a passing receipt. Refusals land
in the replay. A task without a proof command or verify sibling still needs an
honest concrete deferral reason before the plan closes.

## Multi-Head Execution

Fan-out is plan-scoped. Heads claim from the plan, not from a coordination
record: `plan claim` (or `multihead_next` with `plan_id`, which restricts
routing to that plan's task subgraph). Refinements stay inside the plan —
children of a refined task retain plan membership. Progress is visible to
every head through the injected plan digest and `plan query` — do not
hand-copy status between heads.

Plans are tenant-scoped. Until ambient identity lands, a head that resolves
the wrong tenant sees no plan digest at all. Treat a missing digest for a plan
you know exists as an identity/tenant mismatch to diagnose, not as evidence
the plan is gone.

## Continuity

A future session picks up where this stops by reading the plan projection:
`plan query` (`progress`, `next_actionable`), `plan what_changed` since the
last known version, then `plan render` if it needs the full view. Continuity
packs no longer carry plan state — one less thing compaction can eat.

## Output

Right-size the deliverable:

- Small plans: a task table + an Executive Summary line, nothing more.
- Production plans: use the full template in
  `../../references/PLAN_TEMPLATE.md`.
- UI visual plans: include the UI Visual Milestone gates from
  `../../references/UI_VISUAL_PROJECT_GATES.md`.

The template is a tool, not a contract. Use only the sections the work needs.

## Routing

- Ambiguity or option pressure → `/harness mode=theorize` briefly, then back.
- SDK harness product questions → `codex-sdk-harness-product`.
- Redis/THG/product-state questions → `redis-harness-operator` /
  `redis-product-safety`.
- Implementation → `/harness mode=execute`, with the plan id as input.

## Anti-Patterns

- Pre-writing a 13-section plan template for a one-file fix.
- Hand-minting task ids and reconciling against them across sessions. Aliases
  are for prose; the substrate id is the key.
- Re-encoding plan content into coordination records, messages, reflections,
  or continuity packs. Reference by id/digest.
- Editing `.harness/checklist.json` as if it were the source of truth. It is a
  render target.
- Hiding deferred work behind elegant prose.
- Calling validation "TBD" — declare the proof command at task creation
  instead, so the engine can hold the line.
- Re-planning from memory when the plan's replay is one bounded call away.
- Treating `handoff=spark` as permission to disappear: stay in-thread to
  review what the executor built.
- Adding time/compute/cost estimates to a task. Plans describe what; observed
  runtimes describe how long.
