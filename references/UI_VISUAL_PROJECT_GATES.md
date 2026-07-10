# UI Visual Project Gates

Apply this reference when Orchestrate is planning, executing, or reviewing work
that changes a visible UI surface: frontend layout, visual design, graph/canvas
rendering, renderer architecture, screenshot-sensitive flows, dashboards,
interactive diagrams, games, animation, or a product experience the user judges
visually.

The goal is to prevent the common failure mode where a runtime slice is reported
as complete while the product surface regresses.

## Trigger Language

Load this reference when the request mentions:

- visual refactor, redesign, renderer, canvas, graph, chart, diagram, Scene OS,
  screenshot, before/after, target reference, design polish, final product,
  downgrade, unreadable, crowded, or "not what I imagined"
- replacing an existing mature UI path with a new architecture
- verifying whether a UI plan is actually complete

## Required UI Visual Milestone

Add a UI Visual Milestone to the plan/checklist before execution. The milestone
must be reconciled in the final report.

| Step | Requirement | Evidence |
|---|---|---|
| UIV-001 | Split completion labels | Runtime complete, Product complete, and Vision complete are each marked yes/no/partial. |
| UIV-002 | Visual baseline capture | Current before screenshots, target/reference screenshots, and "do not change" reference screenshots are captured or explicitly unavailable. |
| UIV-003 | Vision Delta | The gap between current implementation, target product, and larger vision is written before execution. |
| UIV-004 | Do Not Downgrade gate | The old experience is compared against the proposed or finished replacement. |
| UIV-005 | Screenshot review gate | Before/after/target screenshots are reviewed at the same meaningful viewport/data state when possible. |
| UIV-006 | Reversible product boundary | The implementation boundary preserves rollback or a baseline path until the new surface is equal-or-better. |

## Completion Labels

Use these labels instead of a single "done" for UI visual work.

- **Runtime complete**: The code path exists, compiles, mounts, responds, and
  passes focused tests or smoke checks.
- **Product complete**: The enabled user-facing surface satisfies the workflow,
  preserves or improves baseline usability, and passes the visual gates.
- **Vision complete**: The result reaches the stated ambition, not only the
  vertical slice. If the vision is larger, mark partial and name the remaining
  delta.

Do not allow Runtime complete to imply Product complete. Do not allow Product
complete to imply Vision complete.

## Visual Baseline Capture

Before changing a visual surface, capture or identify:

- current production/current-branch screenshot for the affected flow
- target reference screenshot, Figma frame, design artifact, user-provided image,
  or prior good state
- "do not change" screenshots for mature surfaces that must remain available
- viewport size, route, test data, active filters/modes, and interaction state
- the specific qualities that must be preserved: readability, density,
  hierarchy, motion, visual fidelity, data diversity, interaction affordances,
  and performance feel

If screenshots cannot be captured, state why and use the strongest available
evidence. Lack of screenshot tooling is itself a validation gap for visual work.

## Vision Delta

Every UI visual plan must include a Vision Delta section:

- target vision in user-visible terms
- current implementation condition
- what the next slice will make true
- what the next slice will still not make true
- risks that could make the result look or feel worse
- renderer/data/interaction/design gaps that remain after the slice

For ambitious renderer work, prefer saying "Part 1 is runtime complete but
vision partial" over implying the renderer system is complete.

## Do Not Downgrade Gate

Fail or block Product complete when any of these are true:

- a mature renderer or interaction is replaced by a lightweight substitute on
  the primary path
- the new surface is less readable, more crowded, or materially harder to scan
- labels, node types, colors, shapes, density, or evidence diversity collapse
  into a narrower representation
- the primary canvas loses useful controls, navigation, performance, or visual
  hierarchy
- the old path disappears before the new path is equal-or-better
- screenshots show obvious overlap, clipping, washed-out contrast, or occlusion
- no before/after/target evidence exists for a visible replacement

If the gate fails, mark Runtime complete only if the code works, mark Product
complete as no/partial, and add a follow-up item before release.

## Screenshot Review Gate

For visual work, automated nonblank rendering is a runtime smoke check, not a
product-quality proof. Review must compare:

- before screenshot
- after screenshot
- target/reference screenshot or explicit design criterion
- at least one realistic populated-data state when the UI is data-driven
- at least one constrained viewport when layout can crowd or wrap

The final report should say whether the screenshots are equal-or-better,
mixed, worse, or not reviewed, and should name the reason.

## Reversible Product Boundaries

Use reversible product boundaries for visual refactors:

1. Preserve the existing baseline route, renderer, or mode.
2. Introduce the new architecture behind an adapter or parallel surface.
3. Replace the primary path only after the new surface passes the Do Not
   Downgrade gate.
4. Keep the revert path obvious in the commit boundary or plan.
5. Do not call a disabled visual feature complete; either test it enabled or
   mark the work partial.

For large visual systems, commit architecture, data adapter, renderer parity,
and primary-path replacement as separate product boundaries when feasible.

## Report Addition

Add this section to Orchestrate reports for UI visual work:

```md
## UI Visual Milestone
| Gate | Status | Evidence | Notes |
|---|---|---|---|
| Runtime complete | yes/no/partial | | |
| Product complete | yes/no/partial | | |
| Vision complete | yes/no/partial | | |
| Baseline screenshots captured | yes/no/partial | | |
| Target references captured | yes/no/partial | | |
| Do Not Downgrade gate | pass/fail/not-run | | |
| Screenshot review | equal-or-better/mixed/worse/not-run | | |
| Reversible boundary | yes/no/partial | | |
```
