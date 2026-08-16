---
name: shed
description: Convert the disposable part of a context window into durable graph structure before compaction destroys it. Use when the window passes the fill line (roughly 45%), before any deliberate /compact, when auto-compaction is near, at any traverse in a long-running session, and whenever a head notices it is holding findings the substrate does not. Also use when the user says the session is getting long, asks to compact, asks what would survive a restart, or when a head is tempted to stop because the window is full rather than because the work is blocked.
---

**Audience:** Theorem-internal subagent and MCP-connected head. A rule that binds only one audience names it.

You are a head whose **window** is disposable and whose **board** is not. The four board motions (occupy, traverse, park, attend) all describe your relationship to the graph. **Shed** is the fifth, and it is the only one that describes your relationship to your own context.

**Bold terms** are defined in [`GLOSSARY.md`](GLOSSARY.md), a sibling file.

This is the **harness binding**. Routing: if `encode` and `continuity_pack` are present, this binding applies; a head without them uses the portable binding (same doctrine, appended to `CONTINUITY.md` and the node file).

## Binding

| Motion | Harness form |
|---|---|
| fill line | the host's own context indicator; on surfaces without one, turn count against the known window |
| classify | read the window against `plan render`, `plan fact_sheet`, and the occupied node's **blueprint**: anything already there is droppable |
| shed | `encode` per finding, with its source and its actor; `assert_facts` where the finding resolves a task's question |
| checkpoint | `continuity_pack`, which becomes the **continuation** a fresh head boots from |
| compact | the host's compaction (`/compact`, auto-compaction, or a fresh window) |
| re-enter | `plan reenter` + `plan what_changed` since the anchor revision + `recall` for the shed findings |

Shed writes to the graph and never to the board's structure. It seals no outputs, crosses no edge, and discharges no **obligation**. A shed inside an occupied node leaves the occupancy held.

## The law this rests on

A session window composes as a **transition**, not as a snapshot.

Turn 60 supersedes a claim made at turn 20. A summary of turns 40 through 80 does not know that, so two summaries of two halves cannot be merged into a summary of the whole. This is the same delete/update counterexample that V04 uses to reject snapshot merging on the Graph fold, and it has the same consequence: **a window has no lawful SegmentSummary.**

Compaction produces one anyway. It is therefore unsound by construction, and no threshold makes it sound. The only sound move is to convert what matters into **entries** before the summary happens, because ordered entries compose lawfully and summaries do not.

That gives the rule the whole skill turns on:

> **The fraction of the window shed to the graph before compaction is the fraction of the session that survives losslessly. The rest is approximated by a process that does not know which facts were load-bearing.**

Two consequences worth holding.

**A shed is a checkpoint, and checkpoints bound recompute.** When a later turn falsifies something believed earlier, the window offers no inverse: you cannot subtract a claim from a summary that already absorbed it. The outcome is `RequiresRecompute` over the interval back to the nearest checkpoint. A window carrying no shed has an unbounded interval, which means re-reading the whole session or losing it. A window shed at the fill line has a bounded one.

**Shedding is earned, not speculative.** Support state is paid for after measured demand, never before; the same discipline applies here. Shed what is load-bearing and let the rest go. A window flushed indiscriminately is as useless as one flushed not at all, and it costs more.

## 1. Watch the fill line

The line is roughly 45% of the window, and it is a checkpoint rather than a limit. Check it at every **traverse**, since the edge crossing is already the commit point and the check rides free there; check it also on arrival at a long-running session and before any deliberate compaction.

Why the line sits early, in order of weight:

1. **Shedding costs tokens.** The `encode` calls, their results, and the writing are all window. Past roughly 70% you cannot afford the flush, so the one act that would have made compaction lossless is precisely the act you skip. Headroom for durability has to be reserved before it is needed.
2. **Authorship.** A summary you did not write is a compression by a process with no view of which claims were load-bearing. A shed is you choosing what becomes a record.
3. **Bounded recompute.** Shedding at the line caps any later replay at the remaining window rather than the whole session.

Done when the fill state is known and the decision to shed or continue is made against it rather than against how the session feels.

## 2. Sort the window into three buckets

Three dispositions, and every span of the window takes exactly one.

| Bucket | Test | Disposition |
|---|---|---|
| **Already structural** | Could a fresh head read this from the board by id? Blueprints, fact sheets, rendered projections, plan state. | Drop. Keep the id, not the content. |
| **Load-bearing and unheld** | Would a fresh head have to rediscover this? Findings with sources, falsified assumptions, capability facts, decisions and their retraction paths, refusals and what they named. | **Shed.** |
| **Live working state** | Current hypothesis, the half-finished edit, what you were about to try. | Into the **continuation**, not the graph. |

The middle bucket is the whole skill. The first is the most common and the easiest to get wrong: re-narrating board state into a summary duplicates the membrane and wastes the headroom the second bucket needs.

A useful discriminator when a span is ambiguous: **a finding travels, a narration does not.** "The MCP serving tier has no query-embedding provider, per its own degraded receipt" travels. "I looked into recall and found some issues" does not.

Done when every part of the window carries one of the three dispositions and none carries two.

## 3. Shed

`encode` each load-bearing finding with the source that owns it, one record per finding. Where a finding resolves the question an occupied task was waiting on, `assert_facts` instead, so the answer lands on the task rather than beside it.

Three properties make a shed record worth its write:

- **It carries its source and its actor.** A record stating what happened without stating who claimed it reproduces the ambiguity a cold reader cannot resolve. A finding whose provenance or claimant died with the window is a claim, and a claim is what the next head has to re-verify.
- **It states what a head would believe differently**, in the shape the **lesson** kinds already use. A record restating the task is **ritual** and will never be retrieved.
- **It is addressed to a cold reader.** If it only parses next to this session's context, it did not leave the window.

A record also carries the **scope** it was found in: a finding inside the occupied node's **membrane** is attributed to the node, a finding outside it is shed with its own scope, and the record states which.

Refusals are findings. A tool that returned a named degradation, a gate that refused and said why, a query that came back empty against a corpus that should have held something: each is something a fresh head would otherwise spend a call rediscovering.

Done when a cold head could recall the findings and continue without this session's transcript.

## 4. Then compact

Only after the shed. Compaction is now an **eviction** rather than a memory event, which is what partial materialization already says about every other fold: the cold parts of the window live in the graph and upquery by `recall`.

Take `continuity_pack` last, so the continuation carries the position after the shed rather than before it.

Done when the shed records are committed and the continuation is taken.

## 5. Re-enter from structure

`plan reenter`, then `plan what_changed` since the anchor revision, then `recall` for the shed findings. Read the compaction summary as a courtesy and the graph as the source. Where they disagree, the graph wins and the disagreement is itself a finding.

Done when the fresh window holds the occupied node's blueprint, the adjacent **interfaces**, and the shed findings, and nothing beyond that.

## Shed or park?

The distinction this skill exists to enforce.

**Park is a board motion.** The node stops, and the reason is something the graph can witness: a missing credential, an unmet dependency, a verify failing at its last band, an external wait. A parked node is resumable because the reason is recorded and still true when someone returns.

**Shed is a window motion.** The node continues. The window is refreshed. Nothing about the work changed.

A full window is not a block. A head that would stop because it is deep into a session is a head that should shed and keep going, and the fact that stopping can be dressed as an honest terminal state is exactly what makes the confusion expensive. Independence is lost at the moment a window condition is reported as a work condition.

Done when the terminal state of any stop names a condition the graph can check.

## Guardrails

Four prohibitions that resist positive phrasing, each paired with its alternative.

- Compacting before shedding converts load-bearing findings into a summary nobody can cite. Shed first; the order is the whole mechanism.
- Shedding the whole window buys nothing and costs the headroom the real findings needed. Sort into three buckets and shed one of them.
- A shed record that restates the task is **ritual** and decays unretrieved. State what a future head would believe differently, or shed nothing from that span.
- Reporting a full window as a reason to stop is a **park** with no witnessable reason. Shed and continue, or name the block.

## Named risk

Shedding into a store whose retrieval is degraded produces write-only memory for as long as the degradation lasts. Ship the habit anyway: an empty corpus cannot be retrieved from no matter how good the retriever, and the corpus has to precede the provider. Check `recall`'s receipt when re-entering, and treat a degraded lane as a finding about the substrate rather than as evidence the shed failed.
