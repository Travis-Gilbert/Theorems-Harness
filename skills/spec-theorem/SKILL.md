---
name: spec-theorem
description: Compile a specification as a method node inside a Plan; the artifact plus its obligation set, with every spec section covered by at least one plan task. Use when a Plan's destination is a spec, when a resolved decision calls for a specification deliverable, or when the user asks for a SPEC or HANDOFF document. The spec compiler is the method; this skill is its front end.
---

**Audience:** Theorem-internal subagent and MCP-connected head. A rule that binds only one audience names it.

# Spec Theorem

Producing a spec is one method node inside the plan, exceptionally well instrumented. Its inputs are the destination, the fact sheet, and the decisions already made; its output ports carry the artifact and its compiled obligation set; its receipts are the plan's evidence that the destination moved closer. A spec written from fog is fiction: the decisions it depends on resolve first, on their own tasks.

1. **Assemble the inputs from the plan, not from memory**: the destination, the fact sheet, the linked research projections and prototype verdicts. Done when every decision the spec will state maps to a fact on the plan, and anything unmapped is surfaced as an unresolved decision rather than smoothed over.
2. **Write in the execution register**: enumerated deliverables, real file paths and signatures, observable acceptance criteria, and named choices treated as requirements. State what was discussed at full strength: no conservative defaults the conversation never chose, no flags quietly flipped off, no MVP downgrades, no transitional framing for in-scope work. Done when an implementing session could start without asking a question the spec should have answered.
3. **Wire coverage back into the plan**: every section of the spec gets at least one plan task pointing at it; zero coverage of a section is a planning bug, not a scope decision. The substrate enforces this at plan lock, compiling sections and acceptance criteria to obligations and refusing the lock on an uncovered section, so a refusal here is the gate doing its job: fix the map, add the missing tasks with dependency edges, proof commands, and evidence grades, and lock again. Done when the plan locks with every section covered.
4. **Land the artifact and its anchor**: `SPEC-[SYSTEM]-[TOPIC]-[VERSION].md` (or `HANDOFF-[TOPIC]-[VERSION].md` for a handoff), carrying the plan id and digest near the top, linked from the plan node. The markdown is the human-readable view; the plan remains the executable truth. Done when the artifact exists, the plan links it, and the obligations it compiles to are on the plan.

## Anti-patterns

- Speccing over unresolved fog; the missing decision gets a task, not an adjective.
- Deliverables without file paths, or acceptance criteria nobody could observe.
- Conservative defaults contradicting the conversation.
- Wall-clock, compute, or cost estimates anywhere in the artifact.
- A spec section no plan task points at.
- Treating the markdown as the plan; edit the plan and re-render.
