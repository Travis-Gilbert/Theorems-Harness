# Execute Report

The full report shape. Use only when the work needs it: production risk, multi-head coordination, or visual gates. Smaller work reports in a few lines; plan-backed work reconciles by substrate id and lets the plan's own projections carry the detail.

```md
# Execute Report: <title>

## Summary
- Final condition:
- Goal achieved:
- Biggest remaining risk:
- Next action:

## Reconciliation
| ID | Task | Status | Evidence | Validation | Notes |
|---|---|---|---|---|---|

Status vocabulary: done, partial, blocked, skipped, failed, not-run.
For plan-backed work the ID column is the substrate task id, and a done row
means the gate accepted the transition, never that the head believes it.

## Changes Made
| Area | Files | Summary | Why |
|---|---|---|---|

## Validation
| Check | Result | Notes |
|---|---|---|

## Remaining Work
- What remains:
- Why:
- Next step (and whose):
```

## Production additions

Residual risk, rollback and recovery notes, and peer-review status.

## Visual additions

Runtime complete, Product complete, Vision complete; baseline, target, and
after evidence; Do Not Downgrade status. Product complete is never claimed from
typecheck or nonblank rendering alone; the visual gates reference carries the
full criteria.
