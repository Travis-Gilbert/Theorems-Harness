import { execFile as execFileCallback, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { callNativeMcpTool } from "./native-mcp.mjs";

const execFile = promisify(execFileCallback);
const DEFAULT_REMOTE_MCP_URL = "https://rustyredcore-theorem-production.up.railway.app/mcp";
const DEFAULT_BUDGET_TOKENS = 2_000;
const SUBMIT_CHILD = fileURLToPath(new URL("../bin/session-code-context-submit.mjs", import.meta.url));

export async function sessionCodeContext(input = {}, options = {}) {
  const env = options.env ?? process.env;
  if (codeContextIsManaged(env)) {
    return { markdown: "", status: "managed", owner: codeContextOwner(env) };
  }

  const tenant = resolveTenant(env);
  if (!tenant) {
    return { markdown: "", status: "disabled", reason: "tenant_missing" };
  }

  const repository = await resolveRepository(input, options);
  if (!repository) {
    return { markdown: "", status: "disabled", reason: "repository_unavailable" };
  }

  const callNative = options.callNative ?? callNativeCode;
  let statusPayload;
  try {
    statusPayload = normalizeCodePayload(await callNative({
      env,
      operation: "kg_status",
      tenant,
      arguments: {
        repo_id: repository.repoId,
        sha: repository.sha,
      },
    }));
  } catch {
    return { markdown: "", status: "degraded", reason: "kg_status_unavailable", repository };
  }

  if (typeof statusPayload.indexed !== "boolean") {
    return { markdown: "", status: "degraded", reason: "kg_status_unavailable", repository };
  }

  const operation = !statusPayload.indexed
    ? "ingest"
    : String(statusPayload.head_sha ?? statusPayload.headSha ?? "").trim() !== repository.sha
      ? "reindex"
      : "";

  if (operation) {
    const sessionId = String(input.session_id ?? input.sessionId ?? "").trim();
    const claimed = (options.claimSubmission ?? claimSubmission)({
      env,
      tenant,
      sessionId,
      repoId: repository.repoId,
      sha: repository.sha,
    });
    if (!claimed) {
      return { markdown: "", status: "deduplicated", operation, repository };
    }

    const submission = {
      tenant,
      operation,
      repoId: repository.repoId,
      repoUrl: repository.repoUrl,
      sha: repository.sha,
      manifestPath: join(repository.root, ".harness", "code-kg-manifest.json"),
    };
    (options.scheduleSubmission ?? scheduleSubmission)(submission, { env });
    return { markdown: "", status: "submitted_async", operation, repository };
  }

  const budgetTokens = positiveInteger(env.THEOREM_CONTEXT_BUDGET_TOKENS, DEFAULT_BUDGET_TOKENS);
  const task = String(env.THEOREM_CONTEXT_TASK ?? input.prompt ?? "");
  let packPayload;
  try {
    packPayload = normalizeCodePayload(await callNative({
      env,
      operation: "context_pack",
      tenant,
      arguments: {
        repo_id: repository.repoId,
        sha: repository.sha,
        session_id: String(input.session_id ?? input.sessionId ?? ""),
        prompt_text: task,
        task,
        budget_tokens: budgetTokens,
      },
    }));
  } catch {
    return { markdown: "", status: "degraded", reason: "context_pack_unavailable", repository };
  }

  return {
    markdown: String(packPayload.markdown ?? packPayload.code_map ?? ""),
    status: "current",
    repository,
  };
}

export async function submitCodeContext(submission, options = {}) {
  const env = options.env ?? process.env;
  const callNative = options.callNative ?? callNativeCode;
  const submittedAt = new Date().toISOString();
  let payload = {};
  try {
    payload = normalizeCodePayload(await callNative({
      env,
      operation: submission.operation,
      tenant: submission.tenant,
      arguments: {
        repo_id: submission.repoId,
        repo_url: submission.repoUrl,
        sha: submission.sha,
        confirmed: true,
      },
    }));
  } catch {
    // The failed receipt below remains retryable and never certifies indexing.
  }

  const accepted = payload.submitted === true
    || ["queued", "submitted", "running"].includes(String(payload.state ?? ""))
    || (payload.status === "ok" && String(payload.job_id ?? "") !== "");
  const receipt = {
    schema_version: 2,
    repo_id: submission.repoId,
    repo_url: submission.repoUrl,
    requested_head_sha: submission.sha,
    operation: submission.operation,
    submission: {
      status: accepted ? "accepted" : "failed",
      submitted_at: submittedAt,
      ...(accepted ? {
        job_id: String(payload.job_id ?? payload.job?.id ?? ""),
        state: String(payload.state ?? payload.job?.state ?? "submitted"),
      } : {}),
    },
    certifies_indexed: false,
  };
  await writeReceipt(submission.manifestPath, receipt);
  return receipt;
}

export function normalizeCodePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  if (["indexed", "code_map", "markdown", "submitted", "job_id"].some((key) => key in value)) {
    return value;
  }
  const text = value.content?.find?.((item) => typeof item?.text === "string")?.text;
  if (text) {
    try {
      return normalizeCodePayload(JSON.parse(text));
    } catch {
      return { code_map: text };
    }
  }
  for (const key of ["output", "result", "data", "structuredContent"]) {
    if (value[key] && typeof value[key] === "object") {
      return normalizeCodePayload(value[key]);
    }
  }
  return value;
}

export function claimSubmission({ env = process.env, tenant, sessionId, repoId, sha }) {
  if (!sessionId) return true;
  const bucket = String(env.THEOREM_CODE_CONTEXT_CLAIM_BUCKET ?? Math.floor(Date.now() / 30_000));
  const root = String(env.THEOREM_CODE_CONTEXT_CLAIM_ROOT ?? join(tmpdir(), "theorem-code-context-claims"));
  const key = createHash("sha256")
    .update(`${tenant}\n${sessionId}\n${repoId}\n${sha}\n${bucket}\n`)
    .digest("hex");
  try {
    // mkdir is the cross-process compare-and-set shared with the shell plugin.
    mkdirSync(root, { recursive: true });
    mkdirSync(join(root, key));
    return true;
  } catch {
    return false;
  }
}

async function resolveRepository(input, options) {
  const cwd = String(input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
  const runGit = options.runGit ?? defaultRunGit;
  try {
    const root = await runGit(cwd, ["rev-parse", "--show-toplevel"]);
    const sha = await runGit(root, ["rev-parse", "HEAD"]);
    const repoUrl = await runGit(root, ["remote", "get-url", "origin"]);
    if (!root || !sha || !repoUrl) return null;
    return { root, sha, repoUrl, repoId: basename(root) };
  } catch {
    return null;
  }
}

async function defaultRunGit(cwd, args) {
  const { stdout } = await execFile("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    timeout: 1_500,
  });
  return stdout.trim();
}

async function callNativeCode({ env, operation, tenant, arguments: args }) {
  return callNativeMcpTool({
    input: {
      mcp_url: remoteMcpUrl(env),
      token: remoteToken(env),
      timeout_ms: 3_000,
    },
    nativeTool: ["ingest", "reindex"].includes(operation) ? "code_ingest" : "compute_code",
    productTool: "compute_code",
    requestId: `session-code-context:${operation}`,
    arguments: {
      ...args,
      operation,
      tenant,
      tenant_id: tenant,
      tenant_slug: tenant,
    },
  });
}

function scheduleSubmission(submission, { env }) {
  const child = spawn(process.execPath, [SUBMIT_CHILD], {
    detached: true,
    env: {
      ...env,
      THEOREM_CODE_CONTEXT_SUBMIT_JSON: JSON.stringify(submission),
    },
    stdio: "ignore",
  });
  child.unref();
}

async function writeReceipt(path, receipt) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp.${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
}

function resolveTenant(env) {
  return String(
    env.THEOREM_TENANT_ID
      ?? env.THEOREMS_HARNESS_TENANT
      ?? env.RUSTYRED_THG_TENANT
      ?? env.THEOREM_CONTEXT_TENANT_SLUG
      ?? env.THEOREM_TENANT_SLUG
      ?? "",
  ).trim();
}

function codeContextOwner(env) {
  return String(env.THEOREM_CODE_CONTEXT_OWNER ?? env.THEOREM_CODE_CONTEXT_MANAGED ?? "").trim().toLowerCase();
}

function codeContextIsManaged(env) {
  return ["1", "true", "yes", "installed", "theorem"].includes(codeContextOwner(env));
}

function remoteMcpUrl(env) {
  return String(
    env.THEOREM_MCP_URL
      ?? env.THEOREM_HARNESS_MCP_URL
      ?? env.THEOREMS_HARNESS_MCP_URL
      ?? env.RUSTYRED_THG_MCP_URL
      ?? DEFAULT_REMOTE_MCP_URL,
  ).trim();
}

function remoteToken(env) {
  return String(
    env.THEOREM_API_TOKEN
      ?? env.THEOREM_HARNESS_API_TOKEN
      ?? env.THEOREMS_HARNESS_REMOTE_TOKEN
      ?? env.THEOREM_HARNESS_REMOTE_TOKEN
      ?? "",
  ).trim();
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
