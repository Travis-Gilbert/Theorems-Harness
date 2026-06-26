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

## Degraded States

Do not return silent `null` for unavailable abilities. Use explicit reasons:

- `no_manifest`
- `remote_unavailable`
- `empty_pack`
- `missing_token`
- `selector_empty`

This keeps product failures inspectable from Claude, Codex, and CI.
