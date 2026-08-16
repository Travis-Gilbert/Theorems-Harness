---
name: theorize
description: Turn fuzzy intent into a named destination and a contested option space before the wrong implementation begins. Use when the task is hedged or fuzzy ("could we", "maybe", "what if"), when multiple credible approaches exist and the wrong choice causes real churn, when a design decision is contested, when repo evidence contradicts a stated assumption, or when a question is cheaper to resolve on paper than in code. Feeds /planning-theorem; the divergent half of construction.
---

**Audience:** Theorem-internal subagent and MCP-connected head. A rule that binds only one audience names it.

# Theorize

Theorize is the divergent half of construction: it builds the space of alternatives that planning will chart and selection will choose from. In construction nobody is sovereign, contest is the normal mode, and a node from a human, a model, or a detector is distinguished by its evidence grade, never by its author's rank. Divergence here is a scheduled state with a closing gate, not a personality trait: the deliverable is a destination plus the options that survived contact, handed to /planning-theorem. It is not brainstorming theater, and it is not a permanent loop.

Skip it when the user has committed to a path, the task is obvious from the repo, or exploration costs more than trying: hand those to /planning-theorem or /execute directly.

1. **Restate the current condition from live source**: code, tests, runtime seams, the graph; historical plans last. Label what the distinction matters for: `Assumption`, `Gap`, `Tension`, `Decision`. When docs and code disagree, say so plainly. Done when every load-bearing assumption has either survived contact with the source or sits on the table as a named contradiction.
2. **Diverge on destinations before solutions**: a stated goal often hides two goals, and solving the wrong one optimally is the one error class no downstream planner can catch. Name the candidate destinations in end-state terms, including the ones the user did not say. Done when at least two genuinely different destinations exist, or the single destination is confirmed against the user's intent in their words.
3. **Build the option set with competing decompositions as first-class**: two real options with concrete tradeoffs beat five fake ones with similar tradeoffs. Ground each in the narrowest relevant code or doc surface. Apply the outside view as an advisor, never an author: where have efforts shaped like this historically hidden their unknown. Done when every option names what would falsify it.
4. **Contest to the gate**: resolve upstream decisions first; ask at most one human-judgment question at a time, only when the answer cannot be discovered locally, always with a recommended answer attached. Disputes resolve by evidence grade, receipt beats score beats intuition, never by rank; a contest without evidence is recorded as dissent, not discarded. Challenge convenience options that hide deferred work. Done when the gate closes: one destination, the surviving options, and the losers with their reasons.
5. **Right-size the output and hand off**: a small clarification is two to four sentences inline; a decision worth preserving is a brief; a decision worth keeping forever is also encoded to the graph with its rationale. Surface open questions as fog in the wayfinder sense: stated precisely, not yet answerable. Then route: /planning-theorem to chart the destination with the fog and decisions attached, or /execute directly when no fog surfaced and the work fits one session. Done when the receiving skill could start without re-deriving anything said here.

## Anti-patterns

- Five options with similar tradeoffs to look thorough.
- Hiding unresolved conflict inside "recommended direction."
- Skipping repo grounding when the answer is one file away.
- Inventing repo facts; an unverified claim is labeled `Assumption`.
- Asking the user a question whose answer is in the codebase.
- Pre-slicing fog into task-shaped pieces during divergence; graduation belongs to the hub.
- Converging because the conversation is long rather than because the gate's conditions are met.
- Treating theorize as the deliverable; the brief exists to be consumed by planning or execution.
