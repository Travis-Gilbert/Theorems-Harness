---
name: planning-theorem
description: Chart a fuzzy ask into a durable Plan on the Theorem substrate, then work its decision frontier one decision per session. Use when an idea arrives wrapped in fog, when work spans more than one session or head, when acceptance criteria are not yet locked, when the user asks for a plan, map, spec, migration, or handoff, or when a failed execution needs a re-plan. Emits a plan id that /execute claims from; dispatches decisions to /research-theorem and /prototype-theorem.
---

# Planning Theorem

Planning finds the way to a destination; it does not walk it. The plan is a durable graph on the substrate that nobody owns and everything acts on: the plan holds the sessions, never the reverse. This skill is the hub. It charts the map and works the decision frontier; resolvers do the resolving, and /execute walks the route. The pull to start implementing is the signal that the map has reached its edge: stop and hand off the plan id.

## The three registers

Every piece of the work sits in exactly one register at any moment:

- **Decided**: recorded with `assert_facts`. A decision lives in exactly one place; everything else gists and links by id.
- **Fog**: in scope, headed at the destination, not yet sharp enough to be a task. The test is whether you can state the question precisely right now, not whether you can answer it now. Fog is never pre-sliced: one patch may graduate into several tasks or none.
- **Out of scope**: ruled beyond the destination, closed with a reason via `close_goal`. It never graduates; it returns only if the destination is redrawn, and then as a fresh effort.

The two cuts, kept sharp: fog vs task is precision of the question; fog vs out-of-scope is scope.

## The map is the plan, projected

The Plan node is the truth. Everything readable is a projection of it: the markdown render, the checklist JSON, and the mermaid DAG. The mermaid source is the transportable form of the map: paste it into an issue, a chat, a doc, and it renders anywhere. Its first line carries the anchor as a comment, `%% plan:<id> digest:<hash>`, so any copy identifies its source. Projections are read and regenerated, never edited; editing a projection as though it were the plan is editing a screenshot.

## Live map

!`node "${CLAUDE_PLUGIN_ROOT:-.}/src/bin/theorems-harness.mjs" plan map $ARGUMENTS`

If the block above shows a literal command rather than a rendered map, this surface does not run injection: call `plan render` and `plan query` (`frontier`, `progress`) yourself before proceeding, and read the mermaid source from the render.

## Chart

Invoked with a loose idea. Charting is one session's work and hand-resolves nothing.

1. **Name the destination** with `create_goal` before anything else; without a fixed edge there is no test for out-of-scope and fog expands forever. Done when reaching the end can be stated in one or two lines across user-visible, system, data, and operational terms.
2. **Fan breadth-first with the human**: surface the open decisions, the first takeable steps, and the fog, across the whole space rather than deep on any thread. If this surfaces no fog and the work fits one session, there is no Plan node: hand the work to /execute and stop. Done when every known question is either sharp enough to be a task or written down as fog.
3. **Chart against live source, not historical specs**: `plan create` with only the tasks specifiable now, each grounded in a real file path, test seam, or runtime surface, wired with dependency edges. Type each task `decision` or `build`, and `hitl` or `afk`. Declare each task's proof command and the class of evidence that proof produces at creation. The substrate does its part on create: acceptance criteria compile to obligations, and the unknowns harvest runs over the indexed repo; plan lock refuses on an uncovered spec section or an unbudgeted unknown, so treat a lock refusal as a finding about the map, never as an obstacle to route around. Done when `plan query frontier` returns at least one takeable task and the plan locks clean.
4. **Fire the research fan-out**: dispatch /research-theorem for each `decision.afk` task, in parallel. Fan-out is for open-world research; the graph carries the findings back, so no session waits on another. Done when every research task is dispatched or consciously held.
5. **Emit the map and stop**: `plan render` for the markdown and mermaid projections, then hand the plan id and digest to the user. Done when the id is in the user's hands and nothing has been implemented.

## Work the frontier

Invoked with a plan id, and optionally a task. Never resolve more than one decision per session; research tasks running AFK in parallel are the one exception.

1. **Enter through the map**: the live map above, or on cold resume `reenter`, then `what_changed` since the last known version, then `plan render` only if the full view is needed. Done when the frontier, the blocked set, and the open fog are in front of you.
2. **Choose one decision task**: the user's named task, else the frontier decision the plan's own scores mark most fragile (a goal with a single derivation researches first). Claim it before any work; the claim is what lets concurrent sessions skip it. Done when the claim is held.
3. **Resolve it by kind**, dispatching to the resolver the kind names (table below). A `hitl` task resolves only through live exchange; standing in for the human's side records an invented answer as decided and corrupts the plan silently. Done when the answer exists with the evidence class its claim requires.
4. **Record and redraw**: `assert_facts` records the answer and the task transitions; `decompose` graduates whatever fog became specifiable, clearing that patch so it lives only as its new tasks; `replan_subtree` redraws what the answer invalidated; `close_goal` retires what the answer pushed past the destination. A failed or deviating transition fires the retraction lane on its own: the falsified assumption retracts, the report appends to the plan, and re-planning reads the surviving explanations plus the replay, never prose memory. Done when no resolved question appears in both the fact sheet and the fog.
5. **Close the session**: re-render the projections, read `plan analyze` and `plan converge` at the checkpoint (refinement churn on one task is the re-plan signal as a number), and stop. When no fog remains and nothing is left to decide before someone builds, the map is done: hand the plan id to /execute.

## Resolvers

| Task kind | Question shape | Resolver |
|---|---|---|
| `decision.afk` | A fact a decision waits on, findable in docs, code, or the graph | /research-theorem, backgrounded |
| `decision.hitl` | How should it look or behave | /prototype-theorem, live with the human |
| `decision.hitl` | A judgment call, tradeoff, or preference | Live exchange, one question at a time |
| `decision.*` | The destination or a resolved decision calls for a specification | /spec-theorem, on the plan node |
| `build.*` | Nothing to decide; the route is walked | /execute, with the plan id |

## Validation defaults

- `plan query progress` and `frontier` after create, to confirm the plan is workable rather than merely written.
- `plan converge` and `plan analyze` at checkpoints.
- Every task carries a declared proof command and the evidence class that proof produces.
- Every section of a source spec maps to at least one task.
- No resolved question appears in both the fact sheet and the fog.
- `plan replay` before re-planning a failed execution: the replay is the record of what happened; a head's memory is not.

## Anti-patterns

- Charting fog you cannot phrase, producing tasks nobody can start.
- Building a Plan node for a one-file fix.
- Editing a rendered projection, markdown, JSON, or mermaid, as though it were the plan.
- Recording an invented answer on a HITL task.
- Hand-minting task ids; aliases are for prose, the substrate id is the key.
- Re-encoding plan content into coordination records, messages, or reflections instead of referencing by id and digest.
- Marking a task verified on evidence weaker than the class its claim requires.
- Batching deferrals into a quiet non-goals table instead of surfacing each one for consent.
- Adding wall-clock, compute, or cost estimates to a task.

## Reference

Verb signatures and canned queries: [PLAN-VERBS.md](PLAN-VERBS.md). Ground anything further in `docs/site/reference/mcp-tools.md` of the Theorem repo, not in prose summaries of it.
