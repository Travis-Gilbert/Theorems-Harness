---
name: compute-graph-plans
description: Chart a destination as a traversable plan graph on the Theorem substrate, ending at a gate. Harness binding: requires the Theorem MCP surface (plan tool, multihead_*). Agents without those tools use the portable binding of this skill.
disable-model-invocation: true
---

The output is not a document. It is a **board**: a graph whose nodes are context boundaries and whose edges will carry handoffs. A plan that cannot be traversed is a planning bug.

**Bold terms** are defined in [`GLOSSARY.md`](GLOSSARY.md), a sibling file. Read a term there before applying it.

This is the **harness binding**. Charting expresses through the `plan` tool; the substrate mints task ids, compiles **obligations**, and enforces transitions. Routing: if the `plan` tool is present, this binding applies; an agent without the harness MCP surface uses the portable binding (same doctrine, file-native forms).

## Binding

| Motion | Harness form |
|---|---|
| compile obligations | `plan create` — acceptance criteria compile into obligations; `acknowledge_unknown` is the explicit carried-open transition |
| typed nodes | plan tasks; every work task gets a **verify sibling** (`spawn_verify`) |
| refine / subgraph | `plan refine` / `add_task` — children retain plan membership |
| node types / palette | D2 node-type toolsets via `node_type_binding`; **palette drag** for explicit overrides |
| membrane | `plan render` — deterministic projection (report markdown, mermaid, movetext); never hand-author |
| scopes | declared per task at create; overlaps declared; `plan lock` schedules with per-head demand constraints |
| next-moves dry run | `plan query frontier` / `next_actionable` (or `multihead_next`) over empty occupancy |
| gate | the user gates on the ranked opening moves; the plan id is handed over for execution |

Charting ends at a gate. It executes nothing; `/execute_graph_plans` claims the plan id this produces.

## 1. Fix the destination and compile obligations

State the destination and its acceptance criteria, then compile the criteria into authoritative **obligations** through `plan create`. Name the unfakeable exit in the plan body: **fixpoint**, where no rewrite applies and every obligation is discharged.

Done when every acceptance criterion maps to at least one obligation, and every obligation names the evidence that would discharge it — a declared **proof command** where the task is code-shaped, so the done-transition can enforce it.

## 2. Decompose into typed nodes

Work, decision, verify, probe, and **weather** nodes. Every work node gets a **verify sibling**.

Annotate control per node (F1 controller annotation). The agent controls a choice node. The world resolves a weather node. An adversary node needs a named adversary and is rare.

**Weather or adversary?** A compiler, an API, a flaky test, and a queued job are weather: uncertain, indifferent, not trying to beat you. Reserve adversary for a party with an interest in your failure, or for a worst-case policy you are choosing on purpose. Treating weather as an adversary produces plans that are pessimistic everywhere and wrong about where the risk actually is.

Done when every node carries a controller, every adversary node names its adversary, and every work node has its verify sibling.

## 3. Check granularity before adding structure

A node whose right interior is a model, its tools, and a loop stays one node. Its iterations trace without becoming structure (K4).

**One node or a subgraph?** Ask whether a fresh head arriving at the second step would need context the first step did not produce. If it would not, that boundary is decoration and the work is one node. Where measured per-step reliability is available it governs; absent that measurement, this test governs.

Do not pre-split: **refine** exists for the mid-flight moment when a node's interior proves to be a subgraph, and children retain plan membership. A central-mode node whose interior is a `delegate_specialist` loop stays one node until measured reliability says otherwise (#493).

Done when you can name, for every edge, the context a fresh head would need across it.

## 4. Stamp node types

Node types carry default toolsets and skill packs through `node_type_binding`; **palette drag** is the override. The node answers the tool question, so the plan body describes work rather than listing tools. Tool visibility beyond the four motions is decided by the node, never by a global tool menu.

Done when every node's palette resolves from its type, and any node needing a tool outside its type default carries an explicit binding.

## 5. Author the membrane's first tier

Write the one-line **gist** for every node. Write the **interface** (consumes, produces, obligations, dependents) for every node on the main path. The **blueprints** are the node bodies already written in steps 1 and 2. `plan render` emits the projection — edit the plan, never the projection.

Done when a head could read the whole plan at gist tier in one screen.

## 6. Declare footprints

File **scopes** per node, disjoint wherever parallelism is intended. Where an overlap cannot be removed, declare it so tension surfaces at commit rather than as corruption later.

Done when the **scope law** is satisfiable across the plan: one action adapter per scope per moment.

## 7. Validate traversability, dry-run, then gate

A plan that cannot be traversed is a planning bug, so traversability is checked before the gate:

- Every node is reachable from the start, and the destination is reachable.
- Every cycle contains a decision or **weather** node with an exit; no cycle traps the traversal.
- Obligations are satisfiable in dependency order; every work node's verify sibling is present.
- The **scope law** holds across the plan (step 6).

Then dry-run the selector: `plan query frontier` / `next_actionable` (or `multihead_next`) over empty occupancy, render the ranked opening moves with their per-component evidence beside the mermaid projection (`plan render`), and present the report. The user gates on what the agent would actually do first.

Done when the structural checks pass, the gate decision is recorded, and the plan id is handed over for execution.

## Guardrails

Two prohibitions that resist positive phrasing, each paired with their alternative.

- The rendered markdown is an output of `plan render`. Edit the plan and re-render.
- The mermaid projection and the movetext appendix are generated. Hand-authoring either produces a diagram that disagrees with the board.

## References

Authoritative contracts: SPEC-THEOREM-GRAPH-TRAVERSAL-1.0 (S2 surface, S5 next-moves, S6 dependents, S7 membrane, S10 render, S12 the two skills), SPEC-THEOREM-EDGE-LEARNING-1.0 (S2 ontology, S9 skill tests), SPEC-THEOREM-SPECIALIST-DELEGATION-1.0 (S8 central mode). Ground any further signatures in these specs, not in prose summaries of them.
