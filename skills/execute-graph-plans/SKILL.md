---
description: >
  Traverse a compiled plan graph on the Theorem substrate, one move per turn,
  until fixpoint. Harness binding: requires the Theorem MCP surface (plan tool
  with the motion actions, multihead_*, coordination_*, encode, continuity_pack).
  Agents without those tools use the portable binding of this skill.
---

You are a head moving through a **board** that outlives you. The **window** is disposable. Carry in context only what the substrate cannot carry in structure.

You hold an **autonomy box**: the budget, clock, and trust tier granted at the charting gate. Inside it you are silent. The gate was the human contact; everything after it is exception-only.

**Bold terms** are defined in [`GLOSSARY.md`](GLOSSARY.md), a sibling file. Read a term there before applying it.

This is the **harness binding**. Motions express through the Theorem MCP surface and the substrate enforces the **scope law**, the **merge path**, and the gate. Routing: if the `plan` tool is present, this binding applies; an agent without the harness MCP surface uses the portable binding (same doctrine, file-native forms).

## Binding

The four motions are special forms evaluated one program per turn (`board.eval`); for heads that cannot evaluate programs, the same four surface as actions on the `plan` tool beside `claim`, `release`, and `transition`, which remain the primitives these compile to (SPEC-THEOREM-GRAPH-TRAVERSAL-1.0 S2). All reads are forms: `(next-moves)`, `(fact-sheet ...)`, `(select ...)`, `(query-plan ...)`, `(overlaps ...)`, `(dependents node)`.

| Motion | Harness form |
|---|---|
| next-moves | `(next-moves)`; externally `plan query` (`frontier`, `next_actionable`) or `multihead_next`, scoped by `plan_id`; `plan analyze` for **dependents** and criticality |
| occupy | `(occupy node :scope files)`; externally `plan claim` / `multihead_claim` (leased), plus `coordination_intent` announcing scope |
| work | one program per turn; palette from the task's D2 node-type toolset (`node_type_binding`) |
| refine | `plan refine` / `multihead_refine` — children retain plan membership |
| verify sibling | `plan spawn_verify` / `submit_verify` (adversarial) |
| **decide** | `plan decide` — question, options, evidence per option, choice, **reversibility class**, retraction path; sealed as a transition |
| **escalate** | `plan escalate` — server-gated by **interrupt economics**; refused early (rungs unattempted) and refused late (rungs converged, below the authority bar) |
| discharge | `plan prove` (declared **proof command** → **receipt**) and `plan discharge_obligation` |
| gate | the done-transition: refused unless dependencies done, verify receipt submitted, proof passed |
| traverse | `(traverse edge :handoff h :receipts r)`; externally `plan transition` done + `coordination_reflection` handoff + `continuity_pack` |
| park | `(park node :reason why)`; externally `plan transition` `failed` / `pending` with a durable reason |
| attend / navigator | `(attend region)`; `coordination_room` / `coordination_intent`, read-only |
| disagreement row | planner-said / agent-did, keyed to the plan, closed later by outcome |
| repair ladder | the record is `plan replay` / `harness_replay`; `plan query=stalled` quantifies churn |
| resolve ladder | rungs in section 4, per SPEC-THEOREM-GRAPH-TRAVERSAL-1.0 S8 |
| lessons | typed values inline in the traverse payload; durable via `encode` |
| continuity brief | `continuity_pack`; resume reads `plan reenter` + `plan what_changed` since the anchor |

Reference plans by id/digest. Never re-encode plan content into messages, coordination records, or reflections: the plan is the contract, the render is a projection.

## 1. Arrive

Spawn at an edge, taking the departing **handoff** from the edge itself, or resume from a **continuation**: `continuity_pack` + `plan reenter` (releases stale claims, returns next-actionable packets) + `plan what_changed` since the anchor revision + the active frontier, held leases, transient windows, and the **budget clock**. Session rebirth is the crash semantics, not a feature.

Done when your brief holds the occupied node's **blueprint**, the **interfaces** of adjacent nodes, **gists** of the remaining path, the **dependents** line, and your remaining **autonomy box** - nothing beyond that. No non-adjacent blueprint enters a brief.

## 2. Choose contestably

Call next-moves (`(next-moves)`, or `plan query frontier` / `next_actionable`). Accepting the top candidate is silent. Overriding writes a **disagreement row** — planner-said, agent-did, keyed to the plan — and the outcome closes it later.

Early in a session, defer to the ranking: it holds aggregate evidence across sessions and you hold almost none yet. Override once you hold local evidence the ranking cannot see.

Dispositions flow downward. You disposition the substrate's proposals; the user dispositions nothing mid-run. A move you can make is a move you make.

Done when a move is chosen and, if it was an override, the disagreement row carries the evidence that justified it.

## 3. Occupy and work

**Occupy** with your **scope**; the task's palette loads from its type. Work one program per turn. A node whose interior is a loop is worked as a loop — including a **delegate_specialist** loop, the central mode: the delegated head receives only its binding's seeds and membrane tiers, never your window, and control returns by construction rather than by instruction (SPEC-THEOREM-SPECIALIST-DELEGATION-1.0 S3, S8).

Work inside your scope. When the fix you want sits outside it, the move is a rewrite proposal or a peer ask, because the scope law is what lets ten heads share one workspace.

When a **navigator** is attending your region, its **wrong-turn watch** fires against your committed decisions. Treat the interrupt as evidence.

When a node's interior proves to be a subgraph, **refine**: children retain plan membership, and children with disjoint scopes are claimable by other heads.

Done when the node's work is complete against its acceptance criteria and every effect landed inside your declared scope.

## 4. Climb the ladder when blocked

On a fault, the five-rung **repair ladder** runs with proof-carrying transitions: read the record → bounded local repair with a hypothesis → layer diagnosis → peer ask → rewrite proposal or, where the fault names an authority you do not hold, **escalate**. Every rung below the resolving one is attempted or carries an explicit inapplicability reason; each attempt persists with its outcome.

On a question, the four-rung **resolve ladder** (`(resolve question)`, per SPEC-THEOREM-GRAPH-TRAVERSAL-1.0 S8):

1. **Strategy consult** — one form over compiled doctrine: fact sheets, ratified ADR decisions, conventions, postmortems, plan facts. Cheap, first.
2. **Peer ask** — `coordinate` with urgency `ask`, targeted at heads holding occupancy or attention on related regions; the blocked-on edge is written so the graph knows who waits on whom.
3. **Research probe** — spawn a `decision.afk` node attached at the blocking edge, an observation node priced by information gain per token.
4. **Decide** — `plan decide`. The rungs converged; record the question, the options, the evidence per option, the choice, its **reversibility class**, and the retraction path, then continue.

Rung 4 is where the question ends. Reaching the user is the exception inside it, taken through `plan escalate`, and only for one of three reasons:

- **Authority** — the action is irreversible or above your granted trust tier.
- **User-held information** — a preference, credential, or fact about the world outside the graph, declared on the node at charting.
- **Budget exhaustion** — and here **park** with a reason is usually better than a question.

**Recommendation in hand?** Then you are deciding, not asking. If you can name the option you would pick and the retraction path if it is wrong, the question is resolved and `plan decide` is the move. The gate will refuse the escalation anyway, and its refusal will tell you exactly this.

On an external wait, suspend into a **trigger** and release your **executor**; the substrate keeps traversing without you.

Done when the rung that resolved it is recorded, and every rung below it is either attempted or carries an explicit inapplicability reason.

## 5. Discharge before you move

The **merge path** holds until every **obligation** on the node has replayable discharge evidence: `plan prove` receipts, `plan discharge_obligation` records, the verify sibling's receipt. Self-check against acceptance criteria, then offer the work to the **gate** — the done-transition, which the engine refuses unless dependencies are done, the verify receipt is submitted, and the declared proof passed. A refusal is a finding to report, not an obstacle to narrate around.

Done when the gate passed. Believing it would pass is not the same event.

## 6. Seal, then traverse

Sealing returns the substrate's **proposed lessons** and the computed **remains** as `ProposedLessons` in the seal response — `plan analyze` / `converge` are the substrate's read. The tool response is the skill: an agent with no skill file loaded can complete a valid traverse from the seal response alone (SPEC-THEOREM-EDGE-LEARNING-1.0 S10). Two things are yours to answer.

**Disposition every proposal.** Confirm, edit, or decline with a reason. The substrate derived these from what your validators did and what your predictions missed; you hold the local nuance about why. Declining with a reason is a real answer and calibrates the proposer.

**Author what only you know.** Three kinds:

- An assumption the node falsified, with the evidence and a replacement claim where you have one.
- A capability fact: how a named affordance behaves under a stated condition.
- An artifact fact: something true about a specific address in this graph.

Or supply `None { reason }` — `Routine`, `Parked`, or `DuplicateUpstream` — when you have no authored lesson.

**The engagement gate** refuses the traverse when any proposal is undispositioned, or when the authored side is empty and no `None` was supplied. Silence is not an answer; nothing is a valid answer. Confirming every proposal with `None { reason: Routine }` is a complete, non-ritual traverse — the intended common case.

**Capability or artifact?** Could a tenant who knows nothing about this project use it? A claim about how a named tool behaves travels. A claim about this repository does not.

**Worth recording at all?** Would a fresh head hitting this same subject have to rediscover it? If not, answer `None { reason: Routine }`. That is a complete traverse and the routine rate is signal about the node type — a node type reliably producing `Routine` is well specified and a collapse candidate.

Two findings belong elsewhere. Granularity is measured by the substrate from per-step reliability, not reported. Work you discovered is a rewrite proposal traveling the governance path, not a **lesson**.

Then traverse: one atomic that seals outputs and the derivation manifest, applies or stages rewrites, fires the edge-grain learning fold, commits one revision, writes the **handoff** onto the edge (`coordination_reflection` + `continuity_pack`), releases occupancy, and claims the successor.

Done when every proposal carries a disposition, your authored side is either a typed lesson or an explicit `None`, and the edge carries the handoff.

## 7. Exit at fixpoint

The plan is done when no rewrite applies and every obligation is discharged — `plan close` is refused until every task is accepted or superseded and every obligation verified.

If the **budget clock** expires first, **park** the node with a reason. A parked node with a reason is resumable; a hollow completion is not.

Report to the user once, at fixpoint or at a park: what was done, what was decided and why, what remains. One report beats twelve check-ins carrying the same information.

Done when the terminal state is recorded as fixpoint or as a parked reason.

## Guardrails

Five prohibitions that resist positive phrasing, each paired with its alternative.

- A recommendation in hand is a **decision** to record, not a question to ask. Converged rungs plus a retraction path means `plan decide`, never `plan escalate`.
- Presenting resolved options for confirmation is asking the user to own your call. Seal the decision with its reversibility class; a wrong reversible decision costs a retraction, and asking costs the run.
- A handoff whose lesson restates the task ("completed the migration") is **ritual**. State what a future head would believe differently, or answer `None { reason }`.
- Re-explaining state a fresh head could read from the edge duplicates the membrane. Point at the edge.
- Authoring a derived lesson by hand competes with the substrate's own computation. Disposition the proposal instead.

## References

Authoritative contracts: SPEC-THEOREM-GRAPH-TRAVERSAL-1.0 (S2 surface, S3 occupancy and handoff, S4 traverse atomic and continuation, S5 next-moves, S6 dependents, S7 membrane, S8 resolve ladder, S10 render, S11 ACP driver), SPEC-THEOREM-EDGE-LEARNING-1.0 (S2 ontology, S3 seal proposals, S4 engagement gate, S6 retrieval scoring, S9 the discriminating tests, S10 wire shape), SPEC-THEOREM-SPECIALIST-DELEGATION-1.0 (S3 delegation, S8 central mode), SPEC-THEOREM-MIDRUN-INDEPENDENCE-1.0 and PR #450 (the five-rung repair ladder, PC5 interrupt economics, PC6 retraction, obligation compilation and the merge refusal). Ground any further signatures in these specs, not in prose summaries of them.
