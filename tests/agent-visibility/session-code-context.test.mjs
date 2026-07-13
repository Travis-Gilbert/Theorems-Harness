import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  claimSubmission,
  normalizeCodePayload,
  sessionCodeContext,
  submitCodeContext,
} from "../../src/product/session-code-context.mjs";

const HEAD = "0123456789abcdef0123456789abcdef01234567";
const REPO_URL = "git@github.com:Travis-Gilbert/private-repository.git";

test("unknown repository schedules one asynchronous ingest with canonical identity", async () => {
  const calls = [];
  const scheduled = [];
  const result = await sessionCodeContext(hookInput("unknown-session"), lifecycleOptions({
    status: { indexed: false, head_sha: "" },
    calls,
    scheduled,
  }));

  assert.equal(result.status, "submitted_async");
  assert.equal(result.operation, "ingest");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, "kg_status");
  assert.deepEqual(scheduled, [{
    tenant: "Travis-Gilbert",
    operation: "ingest",
    repoId: "private-repository",
    repoUrl: REPO_URL,
    sha: HEAD,
    manifestPath: "/workspace/private-repository/.harness/code-kg-manifest.json",
  }]);
});

test("changed indexed SHA schedules reindex", async () => {
  const scheduled = [];
  const result = await sessionCodeContext(hookInput("changed-session"), lifecycleOptions({
    status: { indexed: true, head_sha: "older" },
    scheduled,
  }));

  assert.equal(result.operation, "reindex");
  assert.equal(scheduled[0].operation, "reindex");
});

test("current indexed SHA reads context_pack without repo_url and injects code_map", async () => {
  const calls = [];
  const result = await sessionCodeContext(hookInput("current-session"), lifecycleOptions({
    status: { result: { output: { indexed: true, head_sha: HEAD } } },
    pack: { result: { structuredContent: { code_map: "## Current map\n\n- src/current.mjs" } } },
    calls,
  }));

  assert.equal(result.status, "current");
  assert.match(result.markdown, /Current map/);
  assert.deepEqual(calls.map((call) => call.operation), ["kg_status", "context_pack"]);
  assert.equal(Object.hasOwn(calls[1].arguments, "repo_url"), false);
  assert.equal(calls[1].arguments.repo_id, "private-repository");
});

test("failed submission receipt remains retryable and never certifies ingestion", async () => {
  const directory = await mkdtemp(join(tmpdir(), "session-code-context-test-"));
  const manifestPath = join(directory, ".harness", "code-kg-manifest.json");
  const submission = {
    tenant: "Travis-Gilbert",
    operation: "ingest",
    repoId: "private-repository",
    repoUrl: REPO_URL,
    sha: HEAD,
    manifestPath,
  };

  try {
    const failed = await submitCodeContext(submission, {
      callNative: async () => ({ ok: false, status: "degraded", reason: "remote_unavailable" }),
    });
    assert.equal(failed.submission.status, "failed");
    assert.equal(failed.certifies_indexed, false);

    const accepted = await submitCodeContext(submission, {
      callNative: async () => ({
        ok: true,
        result: { result: { output: { submitted: true, state: "queued", job_id: "job-retry" } } },
      }),
    });
    assert.equal(accepted.submission.status, "accepted");
    assert.equal(accepted.submission.job_id, "job-retry");
    assert.equal(accepted.certifies_indexed, false);

    const persisted = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.deepEqual(persisted, accepted);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("same session-entry claim deduplicates co-installed plugins and later bucket retries", async () => {
  const root = await mkdtemp(join(tmpdir(), "session-code-claims-test-"));
  const base = {
    tenant: "Travis-Gilbert",
    sessionId: "shared-session",
    repoId: "private-repository",
    sha: HEAD,
  };

  try {
    assert.equal(claimSubmission({ ...base, env: claimEnv(root, "entry-one") }), true);
    assert.equal(claimSubmission({ ...base, env: claimEnv(root, "entry-one") }), false);
    assert.equal(claimSubmission({ ...base, env: claimEnv(root, "entry-two") }), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("managed installed hook owns code context without any plugin request", async () => {
  let called = false;
  const result = await sessionCodeContext(hookInput("managed-session"), {
    env: {
      THEOREM_TENANT_ID: "Travis-Gilbert",
      THEOREM_CODE_CONTEXT_OWNER: "installed",
    },
    callNative: async () => {
      called = true;
      return {};
    },
  });

  assert.equal(result.status, "managed");
  assert.equal(called, false);
});

test("response normalization accepts direct, content-text, structured, and nested shapes", () => {
  const status = { indexed: true, head_sha: HEAD };
  assert.deepEqual(normalizeCodePayload(status), status);
  assert.deepEqual(normalizeCodePayload({ content: [{ text: JSON.stringify(status) }] }), status);
  assert.deepEqual(normalizeCodePayload({ structuredContent: status }), status);
  assert.deepEqual(normalizeCodePayload({ result: { output: status } }), status);
});

test("status failure fails open without guessing that ingest is required", async () => {
  const scheduled = [];
  const result = await sessionCodeContext(hookInput("failed-status"), lifecycleOptions({
    status: { status: "degraded", reason: "remote_unavailable" },
    scheduled,
  }));

  assert.equal(result.status, "degraded");
  assert.equal(result.reason, "kg_status_unavailable");
  assert.deepEqual(scheduled, []);
});

function hookInput(sessionId) {
  return {
    cwd: "/workspace/private-repository",
    session_id: sessionId,
    hook_event_name: "SessionStart",
  };
}

function lifecycleOptions({ status, pack = {}, calls = [], scheduled = [] }) {
  return {
    env: {
      THEOREM_TENANT_ID: "Travis-Gilbert",
      THEOREM_CODE_CONTEXT_OWNER: "plugin",
      THEOREM_CODE_CONTEXT_CLAIM_BUCKET: "test-entry",
    },
    runGit: async (_cwd, args) => {
      const command = args.join(" ");
      if (command === "rev-parse --show-toplevel") return "/workspace/private-repository";
      if (command === "rev-parse HEAD") return HEAD;
      if (command === "remote get-url origin") return REPO_URL;
      throw new Error(`unexpected git command: ${command}`);
    },
    callNative: async (call) => {
      calls.push(call);
      return call.operation === "kg_status" ? status : pack;
    },
    claimSubmission: () => true,
    scheduleSubmission: (submission) => scheduled.push(submission),
  };
}

function claimEnv(root, bucket) {
  return {
    THEOREM_CODE_CONTEXT_CLAIM_ROOT: root,
    THEOREM_CODE_CONTEXT_CLAIM_BUCKET: bucket,
  };
}
