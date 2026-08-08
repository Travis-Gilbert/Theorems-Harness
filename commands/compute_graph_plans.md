---
description: Chart a destination as a traversable plan graph on the Theorem substrate, ending at a gate. The planning surface; supersedes /planning-theorem by name.
argument-hint: "[destination, acceptance criteria, or planning artifact]"
---

# /compute_graph_plans

Chart the user's destination as a traversable plan graph. The output is not a document — it is a **board**: a graph whose nodes are context boundaries and whose edges will carry handoffs. A plan that cannot be traversed is a planning bug.

Load and follow `skills/compute-graph-plans/SKILL.md` (harness binding) and its sibling `GLOSSARY.md`. The skill is the behavior contract; this command is the entrypoint.

## Inputs

`$ARGUMENTS` is the destination, any of:

- a plain-language goal or task
- a SPEC, ADR, or design document — every spec section must be pointed at by at least one task; zero coverage of a section is a planning bug
- a migration, retrofit, or multi-session effort

`mode=plan` or similar hints are not handcuffs: honor the explicit intent, then plan.

## Workflow

1. Ground the destination in the smallest relevant source surface — not a pile of historical specs.
2. Follow the skill's seven steps: obligations, typed nodes, granularity, node types, membrane first tier, footprints, traversability.
3. `plan create` compiles acceptance criteria into obligations and mints task ids; `acknowledge_unknown` carries open unknowns explicitly.
4. `plan render` emits the projection. Edit the plan, never the projection.

## Gate

Charting ends at a gate. Dry-run the selector (`plan query frontier` / `next_actionable`, or `multihead_next`) over empty occupancy and present the ranked opening moves with per-component evidence beside the mermaid projection. The user gates on what the agent would actually do first.

Done when the structural checks pass, the gate decision is recorded, and the plan id is handed over for execution via `/execute_graph_plans`.

## Degraded routing

If the `plan` tool is unavailable, say so, then use the portable binding of the skill (same doctrine, file-native board). The vocabulary is the contract.

## Output

Return: plan id/digest, the gated opening moves, and the handoff statement for execution.
