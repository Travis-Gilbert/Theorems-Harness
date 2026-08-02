# Plan Verbs

One tool, `plan`, with an `action` argument. This file is reference; the hub's workflow decides when each verb fires.

| Action | Purpose |
|---|---|
| `create_goal` | Name the destination. Requires `intent` and an `acceptance_criteria` array. |
| `create` | Mint the Plan node, its tasks, and their substrate ids. Requires `objective` or `goal`. |
| `add_task` / `add_tasks` / `refine` | Add tasks; split a claimed task into children that retain plan membership. |
| `decompose` | Graduate fog that became specifiable into tasks. |
| `assert_facts` / `fact_sheet` | Record a resolved decision; read the decided register. |
| `claim` / `release` | Acquire or release a leased claim on a plan task. |
| `transition` | Move a task (`patch_proposed`, `verifying`, `done`, `failed`, `pending`). Refusals are durable, replay-visible events. |
| `prove` | Run a task's declared proof command and persist the receipt. |
| `spawn_verify` / `submit_verify` | Open and submit the adversarial verify sibling for a task. |
| `replan_subtree` | Redraw the part of the map an answer invalidated. |
| `close_goal` | Retire work the destination's edge rules out, with a reason. |
| `render` | Emit the deterministic projections: markdown, JSON contract, mermaid source. |
| `import` | Lift a legacy checklist projection into a Plan. The agent reads the file and passes its contents; the substrate has no filesystem handle. |
| `query` | Bounded canned queries: `next_actionable`, `frontier`, `blocked_set`, `progress`, `stale_claims`, `verify_debt`, `stalled`. |
| `what_changed` / `reenter` | Events since an anchor version; cold-session resume. |
| `analyze` / `converge` | Structural findings and convergence state: the re-plan signal as a number. |
| `replay` | Bounded page of transition and refusal events (also exposed as `harness_replay`). |

## Mutation outcomes

A degraded response is not proof the write failed; a failure after the commit point can surface as an error while the node exists. The discipline, in order: hold every creation payload in replayable JSON before sending; on any mutation error, verify before retrying (query for the entity by title or key, or `what_changed` on the plan) rather than resending blind; once an id exists, reference it and never re-create; treat a response carrying `deduplicated` or a post-effect reason (`*_after_effect`, hint `verify_then_reference`) as success to be confirmed by read, not failure to be retried. A duplicate you did create is retired through `abandon` or `supersede`, with a reason, never by attesting criteria that were not met.

## Multi-head notes

Fan-out is plan-scoped: heads claim from the plan subgraph (`plan claim`, or `multihead_next` with `plan_id`), never from a coordination record. Progress is visible through the injected plan digest and `plan query`; status is never hand-copied between heads. Plans are tenant-scoped: a missing digest for a plan you know exists is an identity or tenant mismatch to diagnose, not evidence the plan is gone.

## Mermaid projection conventions

- First line: `%% plan:<id> digest:<hash>`.
- Task status via `classDef`: `pending`, `claimed`, `frontier`, `verifying`, `done`, `failed`.
- Dependency edges as `-->`; verify siblings as dotted edges when shown.
- Fog as a dashed subgraph; the destination as a double circle.
