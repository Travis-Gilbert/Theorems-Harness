# Glossary: Graph Plans

The domain model for plans as traversable graphs. The doctrine is substrate-agnostic; each **binding** expresses it on a concrete surface. This is the disclosed reference for `compute-graph-plans` and `execute-graph-plans` in both bindings. The canonical copy lives beside the harness pair in Theorems-Harness; every copy beside a skill must be kept in sync with it.

Authoritative contracts, where they exist: **SPEC-THEOREM-GRAPH-TRAVERSAL-1.0** (the surface, the four motions, the membrane, the render), **SPEC-THEOREM-EDGE-LEARNING-1.0** (the lesson ontology, seal proposals, the engagement gate, promotion), **SPEC-THEOREM-SPECIALIST-DELEGATION-1.0** (delegation and the continuation handle). Where this glossary or a skill disagrees with a spec, the spec governs.

Terms are grouped by axis: **The Binding** (how the doctrine touches a surface), **The Board** (what a plan is made of), **Motion** (how a head moves), **The Membrane** (how context is assembled), **Learning** (what crossing an edge deposits), **Blocking** (what to do when stuck), and **Copresence** (how heads share a workspace).

**Bold terms** in any definition are themselves defined here.

## The Binding

### Binding

The surface-specific expression of a motion. The doctrine is binding-agnostic; each binding maps the motions and supporting verbs to concrete forms. Two bindings ship with this doctrine — the **harness binding** and the **portable binding** — chosen at routing time by tool presence, never hedged inside a binding.

_Avoid_: mode, flavor, variant

### Harness Binding

Expresses motions through the Theorem MCP surface. The native forms (`(occupy ...)`, `(traverse ...)`, `(park ...)`, `(attend ...)`) evaluate as one program per turn (`board.eval`); for heads that cannot evaluate programs the same four surface as actions on the `plan` tool beside `claim`, `release`, and `transition`, which remain the primitives the motions compile to (SPEC-THEOREM-GRAPH-TRAVERSAL-1.0 S2). Reads are forms: `(next-moves)`, `(fact-sheet ...)`, `(select ...)`, `(query-plan ...)`, `(overlaps ...)`, `(dependents node)`. Engine-enforced: traverse refuses without dispositions, and `close` is refused until every task is accepted or superseded and every obligation verified.

_Avoid_: MCP mode, server mode

### Portable Binding

Expresses the same motions as file operations over a plan directory: `manifest.md`, `nodes/*.md`, `edges.md`, `lessons.md`, `disagreements.md`, `replay.md`, `CONTINUITY.md`. No engine: the head is the enforcement. For agents without harness MCP access.

_Avoid_: offline mode, file mode

### Routing Rule

Decide the binding once at arrival: if the `plan` tool is present, use the **harness binding**; otherwise the **portable binding**. A session does not switch bindings mid-plan. A plan charted under one binding can be executed under the other — the vocabulary is the contract.

_Avoid_: fallback logic, if-else

## The Board

### Board

The plan graph itself, durable in the substrate, outliving every head that works it. Set against the **window**: the board holds structure, the window holds only what a head is currently thinking with. The governing instruction of both skills follows from the pair: carry in context only what the substrate cannot carry in structure.

_Avoid_: workspace, canvas, plan document

### Window

One head's context. Disposable by design, because the board survives its loss. A head that ends is not a loss of state; it is a loss of a view.

_Avoid_: session, memory, conversation

### Node

A context boundary and a unit of work. Kinds: work, decision, verify, probe, **weather**. Every node carries a controller annotation, a type that resolves its **palette**, a **scope**, and three **membrane** tiers.

_Avoid_: task, step, ticket

### Edge

The transition between nodes and the commit point of the run. Crossing one is an atomic that seals outputs, applies or stages rewrites, folds learning, commits a revision, and deposits a **handoff**. Edges carry context; they are not merely control flow.

_Avoid_: link, arrow, dependency

### Weather

A node whose outcome the world resolves rather than the agent choosing: a compiler, an API, a flaky test, a queued job. Uncertain and indifferent. Distinguished from an adversary node, which needs a named party with an interest in your failure, or a worst-case policy chosen on purpose. Treating weather as an adversary produces plans that are pessimistic everywhere and wrong about where risk sits.

_Avoid_: chance node, risk, failure mode

### Verify Sibling

The verification node attached to a work node, rendered dashed in the projection. Its presence is checked at charting: a work node without one has no path to discharge.

_Avoid_: test, check, validation step

### Obligation

An authoritative requirement compiled from an acceptance criterion. A node's obligations gate its **merge path**: the **gate** holds until each has replayable discharge evidence. Obligations are what make **fixpoint** unfakeable, since a head cannot assert its way past them.

_Avoid_: requirement, todo, criterion

### Fixpoint

The terminal state of a plan: no rewrite applies and every obligation is discharged. A property the board reaches, never a message a head sends. The alternative terminal state is a **park** with a reason.

_Avoid_: done, complete, finished

### Gate

The review point at which a node's work is offered for acceptance. The **merge path** holds until every **obligation** on the node carries replayable discharge evidence. Believing the gate would pass is not the same event as the gate passing. In the **harness binding** the done-transition enforces it (dependencies done, verify receipt submitted, proof passed); in the **portable binding** it is a checklist of obligations, each with an evidence record in the node file.

_Avoid_: review, approval, sign-off

### Merge Path

The sequence a node must complete before **traverse**: every obligation discharged with replayable evidence, the **gate** passed. The merge path holds until then; traverse refuses earlier. (In the parent spec this is stated as: no merge path until every obligation has replayable discharge evidence.)

_Avoid_: workflow, pipeline

### Scope

The file set a head declares when it occupies a node, and the unit of the collision law.

_Avoid_: footprint files, working set

### Scope Law

One action adapter per scope per moment. What lets many heads share one workspace without locking: ten nodes on disjoint scopes are ten drivers and zero collisions. Overlaps that cannot be removed are declared at charting so tension surfaces at commit rather than as corruption later.

_Avoid_: locking, mutex, ownership

### Dependents

The maintained answer to what in this plan rests on a given node: direct count, transitive count, critical-path membership, downstream obligations, and how much work goes stale if this node changes. Computed by reverse masked boolean transitive closure over prerequisite and derivation edges, with min-plus for critical-path membership (SPEC-THEOREM-GRAPH-TRAVERSAL-1.0 S6). Surfaces in the occupant brief, inside move ranking so criticality prices motion, and as a badge in the render.

_Avoid_: blockers, downstream, impact

### Palette

The toolset and skill pack a node's type resolves — through D2 node-type toolsets plus `node_type_binding` in the **harness binding**, through the head's own type-to-tool mapping in the **portable binding**. Tool visibility beyond the four motions is decided by the node, never by a global tool menu. The node answers the tool question, so a plan body describes work, not tools. **Palette drag** is the explicit override when a node needs a tool outside its type default.

_Avoid_: tools, tool list

### Proof Command

The command a node declares at charting whose receipt discharges an obligation. Declared up front so the **gate** can enforce it mechanically rather than by assertion.

_Avoid_: unit test, CI job

### Receipt

Replayable discharge evidence: a proof command's output, a verify submission, a transition event, a `DischargeReceipt`. The unit the **gate** counts. Refusals persist receipts too — there are no silent no-ops.

_Avoid_: log, artifact

### Refine

Splitting a claimed node into children that retain plan membership. The mid-flight granularity lever: a node whose interior proves to be a subgraph keeps its identity while children with disjoint scopes become claimable by other heads. Board structure is split out of monolithic nodes from measured per-step reliability (#493); a node whose right interior is a loop — including a **delegate_specialist** loop, the central mode — stays one node and its iterations trace without reifying (SPEC-THEOREM-SPECIALIST-DELEGATION-1.0 S8). Keeps "one node, one program per turn" without forcing either premature splitting or monolithic nodes.

_Avoid_: split, restructure

### Budget Clock

The run's remaining budget. On expiry, the honest terminal state is a **park** with a reason. Part of every **continuation**.

_Avoid_: timer, deadline

## Motion

Four stateful operations, expressed natively as forms and available as tool actions on other surfaces (SPEC-THEOREM-GRAPH-TRAVERSAL-1.0 S2).

### Occupy

`(occupy node :scope files)`. A claim with a body: it takes the node, declares the scope, opens a scratchpad region, and loads the palette from the node's type. Round-trips through the existing claim/lease storage.

_Avoid_: claim, lock, assign

### Traverse

`(traverse edge :handoff h :receipts r)`. The atomic that crosses an edge — the K2 edge-fire, one transaction (SPEC-THEOREM-GRAPH-TRAVERSAL-1.0 S4, as amended by SPEC-THEOREM-EDGE-LEARNING-1.0): seal outputs and the derivation **manifest**; apply obligation-preserving rewrites and stage obligation-changing ones as proposals; fire the edge-grain learning fold; commit one revision; write the **handoff**; release occupancy; claim the successor. Motion and compounding are one operation, so a head cannot cross an edge without leaving a **lesson** on it. A traverse whose payload fails the **engagement gate** refuses with a receipt.

_Avoid_: move, advance, complete

### Park

`(park node :reason why)`. Release without traversing, writing a block record. The honest terminal state when a **budget clock** expires. Resumable, where a hollow completion is not.

_Avoid_: abandon, pause, defer

### Attend

`(attend region)`. Register as reader and commenter on a region without write authority. What a **navigator** does.

_Avoid_: watch, subscribe, observe

### Frontier

The claimable nodes given current occupancy and node states. Any claimable node is a valid destination; the ranking over them is free to learn.

_Avoid_: available, ready, next up

### Next-Moves

The whole-graph value query over the **frontier**, returning candidates with a value vector (success, cost, latency, reversibility, verification coverage, information gain, optionality), per-component evidence, and a **dependents** summary. Components are never reduced to one number server-side, so cheap-but-irreversible stays visibly different from expensive-but-verified.

_Avoid_: recommendation, ranking, suggestion

### Disagreement Row

The record written when a head overrides the **next-moves** ranking: planner-said, agent-did, keyed to the plan, closed later by outcome. The calibration corpus for when aggregate cross-session evidence beats local this-session judgement. Accepting the top candidate writes nothing.

_Avoid_: override log, exception

### Continuation

A resumable position, shaped after a chess FEN: revision root, active frontier, held capability leases, transient one-tick grants, and the **budget clock** — everything a resume needs to re-validate authority is in the position itself. `resume(continuation)` boots a fresh head from the FEN plus the **continuity brief**; session rebirth is the crash semantics, not a feature.

_Avoid_: checkpoint, snapshot, save state

### Turn

One model invocation. One move per turn: the doctrine's unit of motion. A head that ends is a lost view, not lost state, because the **board** survives.

_Avoid_: step, response

### Trigger

A suspended external wait that fires on an event. On an external wait a head suspends into a trigger and releases its **executor**; the substrate keeps traversing without the head (D3 suspension).

_Avoid_: callback, hook

### Executor

The compute a head runs on. Released during external waits so it is not held hostage by a queued world. Delegation suspends the caller and returns a `ContinuationHandle`; control returns by construction, not by instruction (SPEC-THEOREM-SPECIALIST-DELEGATION-1.0 S3).

_Avoid_: runtime, worker

## The Membrane

A node is a context boundary, and the membrane is what makes many heads affordable: per-head context cost scales with the neighbourhood rather than the plan. Three tiers per node, aligned with the substrate's recall tiers (SPEC-THEOREM-GRAPH-TRAVERSAL-1.0 S7).

### Gist

One line per node, authored at charting and revisable at traverse. The tier at which a whole plan should be readable in one screen.

_Avoid_: summary, title

### Interface

What a node consumes, produces, and owes: its obligations, its state, its **dependents** summary. The tier at which adjacent nodes enter a brief. Predecessors contribute their sealed **handoffs**; successors contribute what they will consume.

_Avoid_: signature, contract, API

### Blueprint

Full task text, acceptance criteria, bound skills and tools, incoming handoffs, relevant facts. The tier that requires occupancy or **attend**. No non-adjacent blueprint enters a brief; promotion to blueprint requires occupancy or attend.

_Avoid_: full detail, body, spec

### Handoff

What a traverse deposits on the edge it crossed: `read` (what was consulted — references the derivation **manifest** rather than duplicating it), `decided` (decisions committed inside the node), `remains` (computed from the node's obligations, presented for confirmation rather than authored), `learned` (typed lessons, inline on the wire). Context transfer is structural, so an arriving head reads the edge rather than a memory of the departure.

_Avoid_: summary, notes, context dump

### Continuity Brief

The reserved slot at session open holding the prior session's terminal state: open goals, unresolved contradictions, last footprint, parting intent. Seated deterministically rather than competing in retrieval, because the previous session should never have to win a relevance contest to be seen.

_Avoid_: recap, history, previous context

### Manifest

The derivation manifest: what a node's work read and produced. "What was read" in a **handoff** references the manifest rather than duplicating it.

_Avoid_: changelog, diff

## Learning

### Lesson

A belief a future head would hold differently, the direction it moved, and the evidence that moved it. Six kinds, split by who can author them (SPEC-THEOREM-EDGE-LEARNING-1.0 S2). A write that cannot supply all three — belief, direction, evidence — is not a lesson.

Derived by the substrate at seal, dispositioned by the head:

- **PracticeOutcome**: a bound practice helped, hindered, or was neutral, read against this node's validators.
- **EstimateMissed**: what was predicted against what was observed.

Authored by the head, because only the head holds the evidence:

- **AssumptionFalsified**: a plan assumption the node disproved, with evidence and a replacement claim where one exists.
- **CapabilityFact**: how a named affordance behaves under a stated condition. Travels between tenants; promotes to the strategy corpus.
- **ArtifactFact**: something true about a specific address in this graph. Stays local; promotes to the fact sheet.

And **None { reason }** — `Routine`, `Parked`, or `DuplicateUpstream` — which is a complete answer.

Identity is (kind discriminant, subject refs), not claim prose: the same lesson learned twice is one record with two observations. Contradiction rides existing belief revision; decay uses the same clock as #463.

Quality is measured at read rather than gated at write, because a fluent model can satisfy any write-time gate. A lesson admitted to a later brief is a retrieval; a lesson cited in a passing run scores. Lessons that are never retrieved decay. Retrieved and cited across several nodes, the fact kinds promote into the durable corpus, with retraction available when contradicted or decayed.

_Avoid_: takeaway, note, insight, learning

### Proposal and Disposition

At seal the substrate computes the derived proposals (`PracticeOutcome` and `EstimateMissed`) and the computed `remains`, and returns them as `ProposedLessons`. Each proposal takes one disposition: `Confirmed`, `Edited`, or `Declined { reason }`. The head also supplies its authored side, or `None { reason }` when it has none. **The engagement gate**: traverse refuses when any proposal is left undispositioned, or when the authored list is empty and no `None` was supplied — silence is not an answer, nothing is a valid answer. It does not refuse on the emptiness of a text field, so the gate measures engagement rather than word count. Confirming every proposal with `None { reason: Routine }` is the intended common case: a complete, non-ritual traverse.

_Avoid_: suggestion, draft, approval

### Ritual

A handoff whose lesson restates the task. The failure mode a mandatory free-text field guarantees rather than prevents, which is why the authored side has typed kinds and an explicit `None` answer. Ritual lessons are self-punishing: never retrieved, they decay, and a head whose lessons are never retrieved develops a measurable signature.

_Avoid_: boilerplate, filler

## Blocking

### Repair Ladder

Five rungs with proof-carrying transitions, climbed on a fault (merged from PR #450). Each attempt persists with its outcome, and a rung's advance carries the previous rung's proof:

1. **Read the record** — replay/events, the failing step, a reproduction.
2. **Local repair attempt** — one bounded fix inside scope with a stated hypothesis.
3. **Layer diagnosis** — when the fault persists, name the layer and produce a root-cause statement with evidence.
4. **Peer ask** — an occupied peer or **navigator** attends the node.
5. **Rewrite proposal or escalation** — the fix sits outside **scope**: a rewrite proposal on the governance path, or the user through **interrupt economics**.

A rung below the resolving one is attempted or carries an explicit inapplicability reason; nothing is skipped silently.

_Avoid_: retry, error handling

### Resolve Ladder

Four rungs, climbed on a question, each attempt persisted as a row with outcome (SPEC-THEOREM-GRAPH-TRAVERSAL-1.0 S8):

1. **Consult the strategy corpus** — one form over compiled doctrine: fact sheets, ratified ADR decisions, conventions, postmortems, plan facts. Cheap, first.
2. **Ask an occupied peer** — `coordinate` with urgency `ask`, targeted at heads holding occupancy or attention on related regions; a blocked-on edge is written so the graph knows who waits on whom.
3. **Spawn a research probe** — a `decision.afk` node attached at the blocking edge, entering the DAG as an observation node priced by information gain per token.
4. **Reach the user** — gated by the **interrupt-economics** gate; refuses unless rungs one through three were attempted or carry an explicit inapplicability reason.

A rung below the resolving one is attempted or carries an explicit inapplicability reason; nothing is skipped silently.

_Avoid_: escalation, help path

### Interrupt Economics

The gate on the user rung of the **resolve ladder**. It holds unless the earlier rungs were attempted or carry an explicit inapplicability reason, so human attention is spent where the earlier rungs could not reach. ACP permission requests are the surface of this rung only.

_Avoid_: permission, approval, ask

### Strategy Corpus

Compiled doctrine as a consultable surface; rung 1 of the **resolve ladder**. Fact sheets, ratified ADR decisions, conventions, postmortems, plan facts. **Harness binding**: skill packs and reference docs. **Portable binding**: committed reference material the head can read. Promoted **capability facts** live here — the compounding path for specialist authoring.

_Avoid_: knowledge base, docs

### Probe

A node kind for research: a `decision.afk` node spawned at a blocking edge to resolve an open question, entering the plan as an observation node priced by information gain. Not a work node; its outcome resolves the question or refines it.

_Avoid_: research task, spike

## Copresence

### Navigator

A head **attending** an occupied region: reading and commenting without write authority, running the **wrong-turn watch**. The second half of a driver-and-navigator pair.

_Avoid_: reviewer, observer, supervisor

### Wrong-Turn Watch

What a navigator runs: checking live work against the occupied node's committed decisions and interrupting on divergence. The interrupt is evidence.

_Avoid_: monitoring, oversight

### Boundary Lane

Where the dispatch job board narrows to: work for heads that cannot hold occupancy. Heads that can hold occupancy move on the board instead.

_Avoid_: queue, backlog, inbox
