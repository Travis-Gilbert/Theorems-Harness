---
name: execute
description: Carry a bounded task through code changes and validation inside a receipted run. Use when the user asks to implement, fix, ship, simplify, run tests, reconcile a plan or checklist, merge, or deploy; when a run surprises you mid-flight; or when a claim of done needs evidence. Claims from /planning-theorem's plan id; pivots to /theorize, /research-theorem, or coordination when the evidence calls for it.
---

# Execute

Execute changes reality: files, tests, runtime state, docs, packaging, deployment. It runs inside the selection closure: the plan's obligation set defines what counts as equivalent-and-done, so inside it you act decisively and search freely, and done is a derivation the substrate replays, never an assertion you make. Two disciplines organize everything here: a surprise climbs the repair ladder before it reaches a human, and evidence outranks belief at every transition.

## The run is the frame

A session is a run. The substrate does its part deterministically: the run opens with its transitions streaming, ensemble selection stamps the packs and heads it chose, the governor governs each turn, every repair and transition lands in the event log, and close fires the compound capture so this run's exhaust improves the next one. Your part is interpretation and honesty: work as if everything you do is attributed, because it is; where a named behavior has not landed on your surface yet, do it by hand through the named verbs rather than skipping it.

## The loop

1. **Enter through the work's source of truth**: claim from the plan (`plan claim`, or `multihead_next` scoped by `plan_id`) when one exists; infer the smallest useful checklist when none does, because a one-off fix needs no Plan node. Read the smallest relevant source surface, check git state for unrelated dirt, and check presence and mentions when another head may overlap. Done when the claim is held and the target behavior is stated.
2. **Recall before deriving**: consult the reasoning bank and recall for this failure shape or pattern before solving from scratch; the compound loop exists to be consumed, and a prior run may have already paid for this lesson. Done when a prior solution is in hand or its absence is known.
3. **Identify the proof, then make the smallest coherent change**: state the expected public behavior, find or write the one failing proof where red-green is cheap, change the least that passes, and simplify after green without changing behavior. Done when the change is coherent and the proof exists.
4. **Validate at the most public practical seam**: focused tests first, then the narrowest wider checks the claim crosses (integration, lint or types, browser or screenshot for visible work, migration or deploy smoke where the claim reaches them). Offload exact questions, counts, reachability, feasibility, ordering, to the substrate's exact engines instead of reasoning them. A check that cannot run is reported as exactly that, with whatever evidence remains. Done when the narrowest sufficient evidence exists.
5. **Transition with the evidence**: `patch_proposed`, then `verifying`, with `plan prove` running the task's declared proof; the done transition is engine-refused while dependencies are open, the verify sibling's receipt is missing, or an obligation is undischarged, and that refusal is the oracle working: report it as a finding and discharge what it names. Done when the gate, not you, accepted the transition.
6. **On surprise, climb the ladder**: a failing step, a contradicted assumption, or a missing dependency routes to the repair ladder below, not to the human and not to a fourth workaround.

## The repair ladder

Exhaust the rungs in order; every rung's action is a transition, so the loop learns which repairs pay. Interrupting the human is the top rung and only the top rung: waiting becomes the highest-value move only when asking beats the best surviving tactic.

1. Self-serve the missing information exactly: query the substrate and the code graph for the answer with proof, before treating it as unknown.
2. Consult what the cluster already knows: the dominant strategy for this shape and its surviving environments.
3. On broken plan shape, re-optimize rather than improvise: reorder, reassign, and feasibility-check the repaired plan through the exact engines.
4. On persistent failure, update the failure hypotheses and name the falsified assumption; the retraction lane consumes the named assumption, so retraction never guesses.
5. Interrupt with the decision the machine could not make: one question, the options priced, a recommendation attached.

The third same-layer workaround is rung 4 arriving late: stop and name the hypothesis instead. For plan-backed work, `plan analyze` and `converge` quantify the same signal as refinement churn.

## Verification is priced, not preferred

The topology that verifies a task, solo, paired with a cross-family verifier, or peer implementations with cross review, is selected by the obligation floor of the node, not by taste. Your part: submit verify receipts that report what the evidence shows; a falsification receipt against your artifact is the system catching what would have shipped, and a divergence between two passing peers is a specification gap surfacing, both findings, neither embarrassments. The evidence-class rule holds everywhere: a mock discharging a live-class requirement reads as partial mechanically, so validate at the seam the obligation names.

## Shapes

| Shape | Use when | Output |
|---|---|---|
| `direct` | One or two files, obvious behavior, low risk | Concise summary plus validation |
| `checklist` | Multi-step or cross-module, no plan node | Stable checklist reconciliation |
| `plan` | A durable Plan exists | Task-by-task reconciliation by substrate id |
| `diagnostic` | Failure cause unknown | Reproduction, hypotheses, fix, regression proof |
| `production` | Deploy, data, auth, billing, storage, launch | Gate review plus rollback and residual risk |
| `visual` | UI, renderer, canvas, screenshot-sensitive | Visual milestone and Do Not Downgrade evidence |

Diagnostic shape follows the bug discipline: reproduce or explain why reproduction is impossible, reduce to the smallest signal, three to five falsifiable hypotheses when unclear, one variable at a time, fix the cause, regression-test at the right seam, remove the debug clutter.

## Reporting

Right-size it: a few lines for direct work; per-task reconciliation by substrate id for plan work; the full report shape (disclosed in [EXECUTE-REPORT.md](EXECUTE-REPORT.md)) only when production risk, multi-head coordination, or visual gates demand it. Report the condition the evidence supports, in its own words: not run, wired, runtime-proven, done. Scope changes land as new rows or tasks with their reason. When the next step belongs to another head, the handoff lives in your footprint on the substrate, referenced by id, and the mention is sent.

A pause for diagnosis, planning, coordination, or context refresh mid-execution is execution staying honest; route there deliberately and come back through the loop.
