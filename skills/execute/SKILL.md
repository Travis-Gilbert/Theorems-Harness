---
name: execute
description: Use when the user asks to implement, fix, ship, simplify, run tests, reconcile a checklist, or carry a bounded task through code changes and validation. This is an internal execution capability of Theorem's Harness, not a tunnel that prevents planning, diagnosis, coordination, or context refresh when needed.
---

# Execute

Execute is the Harness capability for changing reality: files, tests, runtime
state, docs, packaging, or deployment. It should feel decisive, but not blind.
The loop is simple: take a bounded action, validate it, simplify it, and reroute
if new evidence changes the task.

Prefer `/harness` for new workflows. `/execute` remains a compatibility command
for users who explicitly want implementation.

## Operating Posture

- Start from source code and current repo state, not from the plan alone.
- When a durable Plan exists, it is the reconciliation target: claim tasks from
  it, transition them, and let `.harness/checklist.json` stay a projection.
  Reference the plan by id; do not re-encode its content elsewhere.
- Infer the smallest useful checklist when no plan exists. A one-off fix does
  not need a Plan node.
- Keep the checklist alive, but right-size it. One tiny fix does not need a
  ceremony-heavy report; risky or multi-step work does.
- Validate the behavior through the most public practical seam.
- Pivot deliberately: pause for `diagnose`, `theorize`, `coordinate`,
  `compile_context`, or `peer_review` when execution evidence calls for it.
- Never hide failed validation or incomplete work.

## Inputs

Accept any of these:

- a plan id on the plan substrate (claim from it with `plan claim` or
  `multihead_next` scoped by `plan_id`)
- a planning artifact or SPEC file
- an explicit checklist
- a bug report, failing test, runtime trace, or deploy failure
- a partial implementation or diff
- a clear user task that supports an inferred plan

If the input is ambiguous but still actionable, make a short working assumption
and proceed. Ask only when the missing answer is a real product preference,
unsafe operation, access blocker, or destructive choice.

## Execution Shapes

Choose the shape that fits the risk:

| Shape | Use when | Output |
|---|---|---|
| `direct` | One or two files, obvious behavior, low risk. | Concise summary plus validation. |
| `checklist` | Multi-step or cross-module work. | Plan-task reconciliation when a plan exists; stable checklist reconciliation otherwise. |
| `diagnostic` | Failure cause is unknown. | Reproduction, hypotheses, fix, regression proof. |
| `production` | Deploy, SDK, data, auth, billing, storage, or public launch impact. | Production gate review plus rollback/risk notes. |
| `visual` | UI, renderer, graph/canvas, animation, or screenshot-sensitive flow. | UI Visual Milestone and Do Not Downgrade evidence. |

## Preflight

Before editing:

- inspect git status and avoid unrelated dirty files
- identify the target behavior, likely files, and nearby tests
- read the smallest relevant source surface
- check mentions/presence if another agent may overlap
- refresh context when the injected brief is missing, stale, or contradicted by
  source
- for UI visual work, load `../../references/UI_VISUAL_PROJECT_GATES.md`
- for SDK/product graph work, consult `codex-sdk-harness-product`
- for Redis/THG/product-state work, consult the Redis/product safety specialist

## Implementation Loop

For each bounded item:

1. State or infer the expected public behavior.
2. Identify the proof before or while editing.
3. Make the smallest coherent change.
4. Run focused validation.
5. Simplify the changed code without changing behavior.
6. Update status: for plan-backed work, transition the task on the substrate
   (`patch_proposed` → `verifying` → `done`; run `plan prove` for the declared
   proof); otherwise update the checklist or internal status.
7. Re-route if the evidence changes the mode.

This loop can pass briefly through planning or diagnosis. That is not failure;
it is execution staying honest.

## TDD and Diagnosis

Use red-green-refactor when it is cheap and meaningful:

- write or identify one failing proof
- make the smallest change that passes
- refactor after green

For bugs:

- reproduce or explain why reproduction is impossible
- reduce the failure to the smallest useful signal
- name 3 to 5 falsifiable hypotheses when the cause is unclear
- instrument one variable at a time
- fix the actual cause
- add or update a regression test at the right seam
- remove debug-only clutter

## Validation

Run the narrowest checks that prove the work:

- focused tests
- integration or smoke tests
- lint/type/build checks when relevant
- browser/screenshot/canvas checks for visible work
- migration/data/runtime checks where relevant
- deploy or API smoke when the claim crosses that boundary

If a check cannot run, say exactly why and keep whatever evidence is still
available.

## Reporting

Right-size the report:

- For small direct work: summarize the change and validation in a few lines.
- For plan-backed work: reconcile each plan task by its substrate id. The done
  transition is engine-refused unless dependencies are done, the verify
  sibling's receipt is submitted, and the declared proof passed (R3/R4/R5) —
  a refusal is a finding to report, not an obstacle to narrate around.
- For checklist work without a plan: reconcile each row as done, partial,
  blocked, skipped, failed, or not-run.
- For production or multi-agent work: include validation, residual risk,
  rollback/recovery notes, and peer-review status.
- For UI visual work: include Runtime complete, Product complete, Vision
  complete, baseline/target/after evidence, and Do Not Downgrade status.

Use this full shape only when the work needs it:

```md
# Execute Report: <title>

## Summary
- Final condition:
- Goal achieved:
- Biggest remaining risk:
- Next action:

## Checklist Reconciliation
| ID | Task | Status | Evidence | Validation | Notes |
|---|---|---|---|---|---|

## Changes Made
| Area | Files | Summary | Why |
|---|---|---|---|

## Validation
| Check | Result | Notes |
|---|---|---|

## Remaining Work
- What remains:
- Why:
- Next step:
```

## Completion Rule

Never report "done" unless the evidence supports it.

- If validation did not run, say not run.
- If the behavior is only wired, say wired.
- If runtime proof is missing, say runtime proof is missing.
- If the next step belongs to another head, leave the handoff in your footprint
  and mention it.

## Guardrails

- Do not silently rewrite checklist scope; add new rows or mark changed scope.
- Do not continue applying workarounds after the third same-layer failure; pause
  and diagnose the layer. For plan-backed work, read `plan analyze` /
  `converge` — refinement churn on the same task is the same signal,
  quantified.
- Do not treat implementation as complete when tests, simplification, or
  reporting are still material.
- Do not claim visual Product complete from typecheck or nonblank rendering
  alone.
- Do not let this skill prevent a necessary pivot to coordination, planning, or
  context refresh.
