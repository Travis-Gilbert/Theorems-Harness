# Theorems Harness

Better code. Lower usage. Grows more intelligent with time.

This repository packages Theorem's harness capabilities for Claude Code,
Codex, and other MCP hosts. Theorem and RustyRed own capability semantics,
lifecycle normalization, tool routing, and receipts. This package owns host
installation, hook payloads, and a thin stdio MCP relay.

## Host package

The generated files are rendered by `theorem-harness-package` from
`theorem-harness-core`. They include Claude Code and Codex hook bindings, the
versioned tool route table, the native MCP client, and the relay. Run
`scripts/check-harness-package.sh <checkout>` from the Theorem repository to
check a product checkout for generated-file drift, missing relative imports,
and unclassified behavior-bearing files.

Hooks send lifecycle events and context requests to the configured Theorem MCP
endpoint. The relay gets native tool descriptions from `tools/list`, invokes
native tools through JSON-RPC, and preserves route ownership in receipts.
Product semantics do not run as a local JavaScript fallback. If the native
endpoint is absent or a request fails, the relay returns a typed degraded
result.

The package keeps four host utilities: bounded local `grep`, `doctor`,
`remote_doctor`, and the bundled capability scorecards. The optional
`binary_from_source` engine runs a confirmed local build in a temporary
sandbox and can send extracted Ghidra facts to Theorem. It is only selected by
the native route policy.

The root `.mcp.json` points the remote MCP entry at the Fly deployment. The
stdio facade starts with `node src/mcp/server.mjs` and resolves through the
plugin root when launched by Claude Code or Codex.

## Development

```bash
npm test
npm run doctor
npm run remote-doctor
```

`npm run doctor` probes the native Theorem tool catalog and summarizes the
bundled scorecards. It reports `degraded` when the native MCP endpoint is not
configured. Set `THEOREMS_HARNESS_MCP_URL` to the Theorem `/mcp` endpoint and
`THEOREM_API_TOKEN` to a valid credential. The remote doctor accepts
`THEOREMS_HARNESS_REMOTE_URL` for service health, readiness, queue,
dependencies, and tenant-guardrail probes.

The generated `tool-routes.json` is the package's route contract. Native MCP
tools are discovered from Theorem at runtime. Host utilities and HTTP routes
are declared there and may not be added by the package independently. The
`scorecards/capability-scorecards.json` file records measurement targets, not
claims that those targets have been met.
