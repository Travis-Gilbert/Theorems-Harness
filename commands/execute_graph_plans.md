---
description: Traverse a compiled plan graph on the Theorem substrate, one move per turn, until fixpoint or a parked reason. The execution surface for /compute_graph_plans output.
argument-hint: "[plan id | resume | task to execute]"
---

# /execute_graph_plans

Execute a compiled plan graph as a head moving through a **board**, one move per turn, until fixpoint (no rewrite applies and every obligation is discharged) or a parked reason.

Load and follow `skills/execute-graph-plans/SKILL.md` (harness binding) and its sibling `GLOSSARY.md`. The skill is the behavior contract; this command is the entrypoint.

## Inputs

`$ARGUMENTS` is any of:

- a plan id or digest — the contract. Reference it by id; never re-encode plan content into messages, coordination records, or reflections
- `resume` — resume from the **continuation**: `continuity_pack`, `plan reenter`, `plan what_changed` since the anchor
- a task, bug report, or planning artifact to execute directly (a plan is created first when the shape warrants it)

## Loop

Per the skill: arrive → next-moves → contest or accept → occupy → work one program per turn → obligation gate → traverse with handoff. One move per turn; the tick runs in the substrate. On fault, the five-rung repair ladder; on question, the four-rung resolve ladder; on external wait, suspend into a trigger and release the executor.

The plan substrate is the reconciliation target. `.harness/checklist.json` is a projection of the plan, not the contract — reconcile by substrate task ids.

## Exit

Stop at fixpoint (`plan close` refuses until every task is accepted or superseded and every obligation verified) or **park** with a reason when the budget clock expires. Report the terminal state truthfully: partial, blocked, or parked are real answers. A parked node with a reason is resumable; a hollow completion is not.

## Degraded routing

If the `plan` tool is unavailable, say so, then use the portable binding of the skill (same doctrine, file-native board). The vocabulary is the contract.

## Output

Return: terminal state (fixpoint or parked reason), plan id, and the reconciled obligations with their discharge evidence.
