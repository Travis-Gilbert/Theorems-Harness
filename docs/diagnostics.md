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

## Remote Doctor

Run:

```bash
npm run remote-doctor
node src/bin/theorems-harness.mjs remote-doctor --json
THEOREMS_HARNESS_REMOTE_URL=https://theorem.example \
  node src/bin/theorems-harness.mjs remote-doctor --json
```

No configured remote URL is `degraded`, not `fail`; it means the local product
contract is installed but no service was supplied. A configured remote URL must
answer:

| Path | Purpose |
|---|---|
| `/.well-known/theorems-harness/doctor.json` | Optional endpoint manifest. |
| `/health` | Liveness. This should stay 200 while stores warm or recover. |
| `/ready` | Readiness. 503 with `status: "recovering"` is a structured degraded state. |
| `/diagnostics/queue` | Durable async queue contract for heavy work. |
| `/diagnostics/dependencies` | Feature-scoped dependency health. |
| `/diagnostics/tenants` | Multiuser tenant guardrails. |

The queue probe must cover `agent_runs`, `code_indexing`, `recall_hydration`,
`graph_compilation`, and `provider_calls`. Each category must be async by
default, durable, leased, heartbeating, retried, reaped, and public-call safe
(`202_job_id` or `structured_timeout`).

The dependency probe must cover `deepseek`, `valkey`, `rustyred`, and
`recall_index`. Missing tokens, cold indexes, or unavailable optional services
are allowed only when the payload proves feature-level isolation.

The tenant probe must expose per-tenant `quotas`, `concurrency_limits`,
`queue_isolation`, `rate_limits`, `storage_namespaces`, and
`noisy_neighbor_protection`.

## Scorecards

`scorecards/capability-scorecards.json` names target metrics and recorded
evidence. The generated package can report this file, but the values do not
prove that a capability was exercised in a deployed host session. Keep each
status tied to its actual evidence.
