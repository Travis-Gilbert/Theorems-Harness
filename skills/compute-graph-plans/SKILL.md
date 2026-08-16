---
name: compute-graph-plans
description: Chart a destination as a traversable plan graph on the Theorem substrate, ending at a gate. Harness binding: requires the Theorem MCP surface (plan tool, multihead_*). Agents without those tools — or with a listed-but-dead plan surface — use the portable binding of this skill.
---

**Audience:** Theorem-internal subagent and MCP-connected head. A rule that binds only one audience names it.

The output is not a document. It is a **board**: a graph whose nodes are context boundaries and whose edges will carry handoffs. A plan that cannot be traversed is a planning bug.

**Bold terms** are defined in [`GLOSSARY.md`](GLOSSARY.md), a sibling file. Read a term there before applying it.

This is the **harness binding**. Charting expresses through the `plan` tool; the substrate mints task ids, compiles **obligations**, and enforces transitions.

**Routing (once, at arrival):** if the `plan` tool is present *and answering*, this binding applies. If it is absent, auth-blocked, discovery-failed, or every call errors, switch to the **portable binding** for the rest of the charting run — same doctrine, file-native forms. A listed server that cannot run tools is not a present surface.

## Binding

| Motion | Harness form |
|---|---|
| compile obligations | `plan create` — acceptance criteria compile into obligations; `acknowledge_unknown` is the explicit carried-open transition |
| typed nodes | plan tasks; every work task gets a **verify sibling** (`spawn_verify`) |
| decision nodes | typed agent-owned; a node needing **user-held information** declares the specific fact via `requires` |
| **authority grant** | proposed by charting with concrete defaults — trust tier, allowed external effects, live provider authority, and protected state — granted at the gate and carried on the plan |
| **attempt policy** | resolved per node type at stamping; **palette drag** overrides; the verify sibling's oracle is fixed across every band |
| refine / subgraph | `plan refine` / `add_task` — children retain plan membership |
| node types / palette | D2 node-type toolsets via `node_type_binding`; **palette drag** for explicit overrides |
| membrane | `plan render` — deterministic projection (report markdown, mermaid, movetext); never hand-author |
| scopes | declared per task at create; overlaps declared; `plan lock` schedules with per-head demand constraints |
| next-moves dry run | `plan query frontier` / `next_actionable` (or `multihead_next`) over empty occupancy |
| gate | the user gates on the ranked opening moves and grants the authority grant; the plan id is handed over for execution |
| **mint** | `plan import` makes the substrate authoritative over a portably charted board; the charting laws validate at import with named refusal receipts |
| shed | the fifth motion, the window motion — during execution a full window is shed, not parked |

Charting ends at a gate. It executes nothing; `/execute_graph_plans` claims the plan id this produces.

## 1. Fix the destination and compile obligations

State the destination and its acceptance criteria, then compile the criteria into authoritative **obligations** through `plan create`. Name the unfakeable exit in the plan body: **fixpoint**, where no rewrite applies and every obligation is discharged.

**Evidence grade on every obligation.** Name what would discharge it: local unit, published tip artifact, CI job id, HITL screenshot, install path. When the destination is a usability oracle (download → open → MCP → looks normal), tip/publish obligations outrank local debug greens; write that into the obligation text so execution cannot silently substitute.

**Goal nodes that subsume maintenance.** If a destination oracle subsumes seam/unit gates, chart the goal as the ranked opening move and demote the subsumed CI/seam work to background **weather** or maintenance, with an edge that records the subsumption. Do not leave two equal "first moves" that fight.

**Source guardrails compile.** A source document's guardrail phrased as "X precedes everything" becomes a gate obligation with an evidence grade, or the plan records the reason it does not. A blocker that lives only in a preamble is a blocker execution never meets.

Done when every acceptance criterion maps to at least one obligation, and every obligation names the evidence that would discharge it — a declared **proof command** where the task is code-shaped, so the done-transition can enforce it.

## 2. Decompose into typed nodes

Work, decision, verify, probe, and **weather** nodes. Every work node gets a **verify sibling**.

Annotate control per node (F1 controller annotation). The agent controls a choice node. The world resolves a weather node. An adversary node needs a named adversary and is rare.

**Weather or adversary?** A compiler, an API, a flaky test, a queued job, a release lane, and a CI linker are weather: uncertain, indifferent, not trying to beat you. Reserve adversary for a party with an interest in your failure, or for a worst-case policy you are choosing on purpose. Treating weather as an adversary produces plans that are pessimistic everywhere and wrong about where the risk actually is.

**Decision nodes are agent-owned.** Charting never types a node as a scheduled human stop. A node that resolves a question is resolved by the head that occupies it, through the **resolve ladder**, and sealed as a **decision** carrying its **reversibility class** and retraction path. The one declaration charting may make about the human is the **user-held information** category: a node may state that it requires a specific fact only the user holds, naming the fact. State the fact, not the ceremony.

**Deferred large deltas.** Prefer-embedder / stop-and-flag / promotion-trigger constraints are **decision** nodes (or sealed decide records on the work node), not fog and not "do later" work nodes without a trigger. Chart the default path and the trigger that earns the expensive path.

**Probes pre-commit their non-conclusions.** A probe's output carries a **non-conclusions** register beside its findings: the claims the evidence does not establish, written at seal so a later head can cite the probe for what it proved and is stopped from citing it for what it didn't.

**Resolving a source term is a decision.** When charting lands an abstract source term on one concrete surface (an "IDE" resolved to a particular frontend, "the store" to one service), the landing is recorded as a **decision** with its retraction path, and the surfaces it passed over are named. A silent mapping reads as fidelity while narrowing the destination.

**Would this node stop the run to ask?** If yes, it is mistyped. Name what makes it stoppable: an irreversible action (authority, and that belongs on the effect, not the node), or a fact the user holds (declare the fact). If neither, the node is an ordinary decision node and the head owns it.

Done when every node carries a controller, every adversary node names its adversary, every work node has its verify sibling, and no node is typed as a human stop.

## 3. Check granularity before adding structure

A node whose right interior is a model, its tools, and a loop stays one node. Its iterations trace without becoming structure (K4).

**One node or a subgraph?** Ask whether a fresh head arriving at the second step would need context the first step did not produce. If it would not, that boundary is decoration and the work is one node. Where measured per-step reliability is available it governs; absent that measurement, this test governs.

Do not pre-split: **refine** exists for the mid-flight moment when a node's interior proves to be a subgraph, and children retain plan membership. A central-mode node whose interior is a `delegate_specialist` loop stays one node until measured reliability says otherwise (#493).

The **attempt policy** owns retries, so retry management is never a boundary: a node that will loop to green stays one node, its attempts trace without reifying, and boards chart coarser under attempt policies than without them.

Done when you can name, for every edge, the context a fresh head would need across it.

## 4. Stamp node types

Node types carry default toolsets and skill packs through `node_type_binding`; **palette drag** is the override. The node answers the tool question, so the plan body describes work rather than listing tools. Tool visibility beyond the four motions is decided by the node, never by a global tool menu.

Node types also carry a default **attempt policy**: the escalation bands and the park condition, overridable by **palette drag** like any type default. The verify sibling's oracle is fixed across every band; escalation changes strategy and head, never what passing means. Where the surface answers `cypher_query`, a verify sibling may declare its oracle as a constraint query, passing when the assertion returns zero violation rows, checked by the substrate with a receipt.

Done when every node's palette and attempt policy resolve from its type, and any node needing a tool outside its type default carries an explicit binding.

## 5. Author the membrane's first tier

Write the one-line **gist** for every node. Write the **interface** (consumes, produces, obligations, dependents) for every node on the main path. The **blueprints** are the node bodies already written in steps 1 and 2. `plan render` emits the projection — edit the plan, never the projection.

Done when a head could read the whole plan at gist tier in one screen.

## 6. Declare footprints

File **scopes** per node, disjoint wherever parallelism is intended. Where an overlap cannot be removed, declare it so tension surfaces at commit rather than as corruption later.

Where several work nodes would serialize on extending one shared contract (a proto, a node-kind enum, a generated type surface), cut a **contract seam**: one small append-only node owns the extension, the work nodes depend on it, and they run in parallel around it instead of queueing behind "may extend".

Done when the **scope law** is satisfiable across the plan: one action adapter per scope per moment.

## 7. Validate traversability, dry-run, then gate

A plan that cannot be traversed is a planning bug, so traversability is checked before the gate:

- Every node is reachable from the start, and the destination is reachable.
- Every cycle contains a decision or **weather** node with an exit; no cycle traps the traversal.
- Obligations are satisfiable in dependency order; every work node's verify sibling is present.
- The **scope law** holds across the plan (step 6).
- No node is typed as a human stop, and every declared **user-held information** requirement names its fact.
- Every tip/CI/HITL obligation names its evidence grade; no silent local-debug substitution.

Then dry-run the selector: `plan query frontier` / `next_actionable` (or `multihead_next`) over empty occupancy, render the ranked opening moves with their per-component evidence beside the mermaid projection (`plan render`), and present the report.

Charting arrives with the **authority grant** proposed: concrete defaults for trust tier, allowed external effects, live provider authority, and protected state beside the ranked moves, so the user edits a proposal rather than filling a blank. The user gates on what the agent would actually do first, and grants the authority grant. **This gate is the only planned human contact in the plan's life.** Everything after it is exception-only, through **escalate** under **interrupt economics**. Present it that way, so the grant is made knowingly. If the destination is a usability oracle, say explicitly that tip publish + install + MCP on the published binary is the gate, not local unit green.

A board charted under the portable binding ends at the gate and at a **mint**: the executing session's first act imports it, the import validates these charting laws with named refusal receipts, and from then on the substrate is authoritative with the board files regenerated as its mirror. The projection carries the board's source digest, so drift between mirror and substrate is checked, never argued.

Done when the structural checks pass, the proposed authority grant and the gate decision are recorded on the plan, and the plan id (or the pre-mint board) is handed over for execution.

## Guardrails

Five prohibitions that resist positive phrasing, each paired with their alternative.

- The rendered markdown is an output of `plan render`. Edit the plan and re-render.
- The mermaid projection and the movetext transcript are generated. Hand-authoring either produces a diagram that disagrees with the board.
- A node typed as a human stop puts the human inside the run, where interrupt economics cannot reach. Declare the **user-held information** the node needs, or let the head own the decision.
- A listed-but-dead MCP plan surface is not harness presence. Fail over to portable; do not stall the gate on server repair.
- Charting "seam CI" and "usable tip" as equal first moves without subsumption edges produces thrash. Name which oracle wins.

## References

Authoritative contracts: SPEC-THEOREM-GRAPH-TRAVERSAL-1.0 (S2 surface, S5 next-moves, S6 dependents, S7 membrane, S10 render, S12 the two skills), SPEC-THEOREM-EDGE-LEARNING-1.0 (S2 ontology, S9 skill tests), SPEC-THEOREM-SPECIALIST-DELEGATION-1.0 (S8 central mode), SPEC-THEOREM-MIDRUN-INDEPENDENCE-1.0 and PR #450 (the ladders, PC5 interrupt economics, obligation compilation). Ground any further signatures in these specs, not in prose summaries of them.
