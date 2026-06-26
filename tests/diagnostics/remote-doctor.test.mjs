import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";

import {
  evaluateDependencyContract,
  evaluateQueueContract,
  evaluateTenantContract,
  runRemoteDoctor,
} from "../../src/product/remote-doctor.mjs";

test("remote doctor degrades cleanly when no remote URL is configured", async () => {
  const result = await runRemoteDoctor({ remoteUrl: "" });

  assert.equal(result.status, "degraded");
  assert.equal(result.checks[0].name, "remote-config");
  assert.equal(result.checks[0].details.reason, "remote_unavailable");
});

test("queue contract requires heavy work to be async, durable, leased, and public-call safe", () => {
  const result = evaluateQueueContract({
    categories: {
      agent_runs: queueOk(),
      code_indexing: queueOk(),
      recall_hydration: queueOk(),
      graph_compilation: queueOk(),
      provider_calls: {
        ...queueOk(),
        heartbeats: false,
      },
    },
  });

  assert.equal(result.status, "fail");
  assert.deepEqual(result.failing_categories, [
    {
      kind: "provider_calls",
      missing: ["heartbeats"],
    },
  ]);
});

test("dependency contract allows feature-level degraded states but rejects broad blast radius", () => {
  const degraded = evaluateDependencyContract({
    dependencies: {
      deepseek: { status: "missing_token", isolated: true },
      valkey: { status: "unavailable", blast_radius: "feature_only" },
      rustyred: { status: "ready", isolated: true },
      recall_index: { status: "cold", isolated: true },
    },
  });

  assert.equal(degraded.status, "degraded");
  assert.equal(degraded.degraded_dependencies.length, 3);

  const failing = evaluateDependencyContract({
    dependencies: {
      deepseek: { status: "missing_token", isolated: false, blast_radius: "service" },
      valkey: { status: "ok", isolated: true },
      rustyred: { status: "ready", isolated: true },
      recall_index: { status: "ok", isolated: true },
    },
  });

  assert.equal(failing.status, "fail");
});

test("tenant contract requires multiuser guardrails", () => {
  const result = evaluateTenantContract({
    default_policy: {
      quotas: true,
      concurrency_limits: true,
      queue_isolation: true,
      rate_limits: false,
      storage_namespaces: true,
      noisy_neighbor_protection: true,
    },
  });

  assert.equal(result.status, "fail");
  assert.deepEqual(result.missing_guards, ["rate_limits"]);
});

test("remote doctor accepts a complete live probe contract", async () => {
  const server = createServer((request, response) => {
    writeJson(response, route(request.url));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const result = await runRemoteDoctor({
      remoteUrl: `http://127.0.0.1:${port}`,
      timeoutMs: 500,
    });

    assert.equal(result.status, "ok");
    assert.equal(result.checks.find((check) => check.name === "remote-health").status, "ok");
    assert.equal(result.checks.find((check) => check.name === "queue-contract").status, "ok");
    assert.equal(result.checks.find((check) => check.name === "dependency-isolation").status, "ok");
    assert.equal(result.checks.find((check) => check.name === "tenant-isolation").status, "ok");
  } finally {
    server.close();
    await once(server, "close");
  }
});

function route(url) {
  if (url === "/.well-known/theorems-harness/doctor.json") {
    return {
      product: "theorems-harness",
      service: "mock",
      endpoints: {
        health: "/health",
        ready: "/ready",
        queue: "/diagnostics/queue",
        dependencies: "/diagnostics/dependencies",
        tenants: "/diagnostics/tenants",
      },
    };
  }
  if (url === "/health") {
    return { ok: true, status: "alive" };
  }
  if (url === "/ready") {
    return { ok: true, status: "ready" };
  }
  if (url === "/diagnostics/queue") {
    return {
      categories: {
        agent_runs: queueOk(),
        code_indexing: queueOk(),
        recall_hydration: queueOk(),
        graph_compilation: queueOk(),
        provider_calls: queueOk(),
      },
    };
  }
  if (url === "/diagnostics/dependencies") {
    return {
      dependencies: {
        deepseek: { status: "ok", isolated: true },
        valkey: { status: "ok", isolated: true },
        rustyred: { status: "ready", isolated: true },
        recall_index: { status: "ok", isolated: true },
      },
    };
  }
  if (url === "/diagnostics/tenants") {
    return {
      active_tenants: 2,
      default_policy: {
        quotas: true,
        concurrency_limits: true,
        queue_isolation: true,
        rate_limits: true,
        storage_namespaces: true,
        noisy_neighbor_protection: true,
      },
    };
  }
  return { status: "not_found" };
}

function queueOk() {
  return {
    async_default: true,
    durable_queue: true,
    leases: true,
    heartbeats: true,
    retries: true,
    reaper: true,
    public_contract: "202_job_id",
  };
}

function writeJson(response, value) {
  response.writeHead(value.status === "not_found" ? 404 : 200, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(value));
}
