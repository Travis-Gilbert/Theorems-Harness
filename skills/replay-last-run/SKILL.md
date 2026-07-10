---
name: replay-last-run
description: Show the event timeline of a Theorem's Harness run or the bounded replay of a plan. Use when the user asks "what did you actually do," "show me the run trace," "walk me through the run," "audit what happened," "what tools fired and in what order," "why was this task refused," or "what happened on this plan." Wraps the `harness_run` MCP tool for run timelines and the `harness_replay` MCP tool for plan-scoped transition/refusal replay.
---

# Replay Last Run

Theorem's Harness records every tool call, search, observation, decision, and
context injection into a harness run with a deterministic state hash, and every
plan transition and refusal into a durable plan event log. This skill surfaces
both timelines in human-readable form. It is the audit lens for "what actually
happened, in what order, with which evidence."

Two lenses, two verbs:

- **Run timeline** → `harness_run`: the ordered event log of one run (tool
  calls, observations, decisions, searches, context injections).
- **Plan replay** → `harness_replay`: a bounded page of durable transition and
  refusal events for one plan (`plan_id` required, `limit` default 20, max
  100). Same payload as `plan` action `replay`.

## When to use

- User asks "what did you actually do" or "show me the run trace" → run lens.
- User wants to verify a claim ("did you actually search the codebase?") → run
  lens.
- User wants to debug a result ("which tool fired right before that bad
  edit?") → run lens.
- User asks "what happened on this plan," "why is this task not done," or
  "what got refused" → plan lens. Refusal events carry the rule that fired
  (e.g. R3 dependencies, R4 verify receipt, R5 proof receipt).
- A failed execution needs a re-plan → plan lens first. Replay is the record
  of what happened, not the head's memory of it. Replay first, re-plan second.
- User wants to compare two runs (mention the state hash so they can pair it
  with `harness_compare`).
- User wants to fork from a specific step (surface the step ids so they can
  pass one to `harness_fork`).

Do not use this for: the conversation transcript (they have that already),
the file diff (use `git diff`), or live graph state (use the Theorem-side
RustyRed MCP).

## What to do

For a run timeline:

1. Call `harness_run` with the `run_id` (required). The current session's run
   id comes from `harness_begin` or the session-as-run driver; if neither is
   bound, there is no run to read.
2. Format the returned event list for the user. Group by event kind
   (`tool_call`, `observation`, `decision`, `search`, `context_injected`,
   `outcome`) and show timestamps and step ids.
3. If the user asked a focused question, filter to the relevant events instead
   of dumping the entire log. Examples:
   - "what files did you edit?" → show `tool_call` events with `tool=Edit|Write`
     and the touched paths
   - "which decisions were forks from the plan?" → show `decision` events with
     payloads referencing `deviation_from_handoff` or `decided` keys
   - "where did this run lose ~5 minutes?" → show consecutive timestamps with
     large gaps

For a plan replay:

1. Call `harness_replay` with the `plan_id` (and a larger `limit` if the
   default 20 is not enough; the response says `total_count` and `truncated`).
2. Show transitions in order: task, from → to, actor, graph version. Show
   refusals with their rule and reason — a refusal is evidence, not noise.
3. If the user is re-planning, summarize churn: which tasks transitioned
   repeatedly, which refusals repeated, where refinement split tasks. Pair
   with `plan` actions `analyze` / `converge` for the quantified re-plan
   signal.

## Output shape

`harness_run` returns:

```json
{
  "run_id": "run:...",
  "state_hash": "sha256:...",
  "events": [
    { "step_id": "step:...", "kind": "tool_call",   "payload": {...}, "created_at": "..." },
    { "step_id": "step:...", "kind": "observation", "payload": {...}, "created_at": "..." },
    { "step_id": "step:...", "kind": "decision",    "payload": {...}, "created_at": "..." },
    ...
  ]
}
```

`harness_replay` returns:

```json
{
  "tenant": "...",
  "plan_id": "plan:...",
  "count": 20,
  "total_count": 57,
  "truncated": true,
  "events": [ { "transition": "...", "node_ids": [...], "actor": "...", "refused": false, "rule": null, ... } ],
  "query_receipt": {...}
}
```

Mention the `state_hash` if the user might want to compare runs or replay
against a different model: it is the deterministic-replay key.

## When NOT to use

- The user wants the conversation transcript. That's already visible to them.
- The user wants the file diff. Use `git diff` or `git log -p`.
- No `run_id` is available (`harness_begin` was never called this session) and
  no `plan_id` is known. Tell the user the harness isn't bound to a run and
  offer to start one with `/harness` or `harness_begin`.

## Related tools

- `harness_compare`: diff two runs (state hashes, evidence overlap,
  divergence point). Reach for this when the user wants to know how two
  attempts differed.
- `harness_fork`: branch a new run through a specific step id from this
  timeline. Reach for this when the user wants to explore an alternative path.
- `harness_context`: compile the final Context Artifact for a run, rather
  than the raw event timeline.
- `plan` (`query`, `what_changed`, `analyze`, `converge`): the forward-looking
  plan reads; replay is the backward-looking one.
