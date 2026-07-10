# Planning-Theorem Artifact Template

Optional template for production-scale plans. Use only the sections the work
needs. Small plans should not adopt this whole shape; that is the strictness
this template exists to avoid.

## When This Full Shape Helps

- launch plans
- migration plans
- multi-session work with a checklist a future agent will reconcile against
- plans that cross more than three subsystems
- plans where validation, rollback, or operational impact need to be explicit
  per row

For one-file fixes, a checklist table plus an executive summary line is
enough. Do not adopt this template just to look thorough.

## Template

```md
# Planning-Theorem Artifact: <title>

## Executive Summary
- Goal:
- Intent:
- Summary of work:

## Current Condition
Describe what exists now, with file/test/doc/runtime grounding.

## Intent
Explain what the user is trying to make true.

## Goal
- User-visible outcome:
- System behavior:
- Data/model changes:
- Operational impact:
- What must not regress:

## UI Visual Milestone
Include only for UI visual work. See `UI_VISUAL_PROJECT_GATES.md`.

| Gate | Requirement | Evidence/validator | Status |
|---|---|---|---|
| Runtime complete | Code path works. | Tests/smoke/build. | planned |
| Product complete | Enabled surface is equal-or-better than baseline. | Before/after/target review. | planned |
| Vision complete | Stated ambition is reached or delta is named. | Vision Delta. | planned |
| Baseline capture | Current and target visuals are captured or unavailable with reason. | Screenshots/references. | planned |
| Do Not Downgrade | Mature surface is preserved or replaced only by equal-or-better UX. | Visual gate review. | planned |
| Reversible boundary | Rollback/baseline path exists. | Route/mode/commit boundary. | planned |

## Vision Delta
Include only for UI visual work.

- Target vision:
- Current visual condition:
- This plan makes true:
- This plan does not make true:
- Visual downgrade risks:
- Remaining renderer/data/interaction/design gaps:

## Codebase Grounding
| Area | Evidence | Notes |
|---|---|---|

## Orchestration Map
| Work type | Route to | Why |
|---|---|---|

## Checklist
| ID | Task | Codebase grounding | Agent/skill route | Acceptance criteria | Validation | Risk | Status |
|---|---|---|---|---|---|---|---|

## Test Strategy
- Preflight checks:
- Focused tests:
- Integration tests:
- Regression tests:
- Type/lint/static checks:
- Manual smoke checks:
- Performance/security checks:

## Production Gates
- [ ] Tests pass or failures are explained.
- [ ] No unchecked migration or data risk.
- [ ] No secrets or destructive commands introduced.
- [ ] Error paths considered.
- [ ] Observability/logging considered.
- [ ] Rollback/revert path exists.
- [ ] Docs/ADR updated or explicitly deferred.
- [ ] UI visual work has before/after/target evidence or an explicit validation gap.
- [ ] UI visual work passes the Do Not Downgrade gate before Product complete.
- [ ] Execution report can reconcile every checklist item.

## Epistemic Ledger
| Primitive | Entry | Evidence | Confidence | Action |
|---|---|---|---|---|

## Explicit Non-Goals and Deferrals
| Item | Why deferred | Risk of deferral | Follow-up |
|---|---|---|---|

## Execution Instructions
- Start with checklist item:
- Preserve these invariants:
- Run these commands:
- Report using the format in `EXECUTE_REPORT_TEMPLATE.md` if relevant.
```

## Rules That Travel With This Template

- Every spec section must have at least one checklist row pointing at it.
  Zero coverage of a spec section is a planning bug, not a scope decision.
- Deferrals require explicit user consent. Surface candidate deferrals one
  at a time, not batched into a quiet table.
- No time, compute, or cost estimates ("~2 hours", "~$5", "Effort: S/M/L").
  Predictions about future work are not part of a plan.
- Do NOT introduce "MVP" framing yourself. Only honor it when the user used
  the word.
- Right-size: a small plan is a few lines; a launch plan is this whole shape.
  Adopting this template for a small plan IS the strictness the rewrite is
  here to avoid.
