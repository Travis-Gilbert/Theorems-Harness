# Diagnostics

The product layer treats diagnostics as part of the contract. A capability is
healthy only when the host can observe one of these outcomes:

- model-visible context was injected
- a receipt was written
- an MCP diagnostic returned a structured degraded reason

## Doctor

Run:

```bash
npm run doctor
node src/bin/theorems-harness.mjs doctor --json
```

The doctor checks:

- adapter contract verbs
- Rust Engineering visibility
- code-neighborhood degraded state
- scorecard coverage
- receipt-log writes in a temporary directory

`degraded` is acceptable when remote services are intentionally absent. `fail`
means the local product surface itself is broken.

## Remote Readiness

Leave `THEOREMS_HARNESS_REMOTE_READY` unset unless a real Theorem/RustyRed
adapter is available. When it is unset, remote-only abilities degrade with
`remote_unavailable` rather than pretending to be active.

## Receipts

Receipt events hash the prompt instead of storing it. By default explicit
receipt writes go to `.theorems-harness/receipts.jsonl` under the provided cwd,
or to `THEOREMS_HARNESS_RECEIPT_LOG` when that environment variable is set.

## Scorecards

`scorecards/capability-scorecards.json` names target metrics and current
evidence. Keep it honest: mark capabilities as `unmeasured`, `degraded`,
`measured-local`, or `below-target` rather than treating every manifest entry as
production-ready.
