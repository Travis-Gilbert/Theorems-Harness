# Architecture

Theorems Harness product is the membrane between agents and the Theorem/RustyRed
substrate.

## Layers

1. **Substrate**: Theorem and RustyRed crates own storage, runtime, memory,
   code compiler artifacts, ensemble learning, skill-pack persistence, and
   affordance routing.
2. **Adapters**: this repo owns product calls into those systems through stable
   verbs such as `harness_prepare`, `coordination_context`, `skill_apply`,
   `context_pack`, `tool_search`, and `invoke`.
3. **Capability compiler**: `capabilities/capability-manifest.json` maps abilities
   to triggers, delivery tier, fallback, backing verbs, and receipts.
4. **Host delivery**: hooks compile model-visible context before Claude/Codex
   acts. The MCP facade exposes the same compiler for explicit diagnostics.

## Delivery Tiers

- `ambient`: injected automatically before the model acts.
- `jit`: injected immediately before relevant tool use or after failure signals.
- `explicit`: available as a tool, command, or user-invoked operation.
- `background`: runs receipt and learning loops without bloating context.

## Acceptance Rule

An ability is not considered delivered until it reaches the model context or
writes a receipt.
