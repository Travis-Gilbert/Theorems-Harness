---
name: rust-engineering
description: This skill should be used when the user asks to "write Rust", "debug Rust", "review Rust", "fix Cargo", "work on a Rust MCP server", "improve a Rust crate", or needs help with Cargo workspaces, Rust validators, PyO3/FFI bridges, async Rust services, parsers/macros, systems code, Ensemble pack selection, affordance charters, or Rust skill-pack corpus work.
version: 0.1.4
---

# Rust Engineering

Start from the live crate/workspace shape. Rust repos often have nested
workspaces, standalone crates, examples, generated bindings, and target-dir
constraints; do not assume a root `Cargo.toml` owns everything.

Prefer local crate patterns over generic Rust advice. Match error types, async
runtime choices, serialization style, feature gates, tracing, and test
organization already present.

Treat compiler errors as design feedback. If the third workaround appears in
the same module, stop and ask whether the dependency edge, trait boundary, or
runtime layer is wrong.

Validate narrowly first, then widen:

- `cargo test -p <crate> <test_name>`
- `cargo test --manifest-path <path>`
- `cargo check -p <crate>`
- `cargo clippy -p <crate> --all-targets --no-deps -- -D warnings`
- `git diff --check`

Anti-patterns:

- Assuming a repo-level Cargo workspace when the project has standalone crates.
- Adding a dependency to code without adding the manifest edge.
- Replacing typed Rust APIs with ad hoc string parsing.
- Treating `node --check`, `cargo fmt`, or a successful grep as runtime proof.
