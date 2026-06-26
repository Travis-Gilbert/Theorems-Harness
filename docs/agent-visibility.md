# Agent Visibility Contract

The product repo tests what the agent actually sees.

## Required Checks

- A Rust prompt activates Rust Engineering without a model tool call.
- A Rust file or Cargo manifest in the changed-file set activates Rust
  Engineering.
- Missing remote code-KG state produces an explicit degraded reason.
- The MCP facade and hook compiler return the same packet shape.
- Background abilities declare receipt expectations without injecting large
  context.
- The doctor command can write receipts to a temporary log.
- Capability scorecards exist for every manifest entry.

## Degraded States

Do not return silent `null` for unavailable abilities. Use explicit reasons:

- `no_manifest`
- `remote_unavailable`
- `empty_pack`
- `missing_token`
- `selector_empty`
- `contract_missing`
- `empty_query`

This keeps product failures inspectable from Claude, Codex, and CI.

## Objective Signals

Every host integration should be judged by observable signals:

- model-visible context was injected
- an explicit MCP diagnostic returned the same packet shape
- receipts were written or intentionally skipped
- scorecards name the current evidence and target metric

This lets the product answer whether an ability improved work or reduced usage
with evidence instead of relying on a model's impression.
