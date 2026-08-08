#!/usr/bin/env node
/**
 * HANDOFF-CODE-AUTOINDEX-1.0 SessionStart hard trigger.
 *
 * Rides the #374 SessionStart family. Calls native MCP `compute_code` /
 * `code_ingest_ensure` directly (no local Theorem checkout required). Optional
 * fallback to session_start.sh when THEOREM_CODE_AUTOINDEX_HOOK is set.
 * Fail-open: never blocks session entry.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { join } from "node:path";
import { URL } from "node:url";

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) return "";
  return (result.stdout || "").trim();
}

function printJson(additionalContext, systemMessage, hookEventName) {
  const payload = {
    hookSpecificOutput: {
      hookEventName: hookEventName || "SessionStart",
      additionalContext: additionalContext || "",
    },
  };
  if (systemMessage) {
    payload.systemMessage = systemMessage;
  }
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function normalizeRepoId(repoUrl) {
  let repoId = repoUrl.replace(/\/$/, "").replace(/\.git$/, "");
  if (repoId.includes("://")) {
    repoId = repoId.replace(/^[^:]+:\/\//, "").replace(/^[^/]+\//, "");
  } else if (repoId.includes(":")) {
    repoId = repoId.slice(repoId.indexOf(":") + 1);
  }
  return `repo:${repoId.replace(/^\/+|\/+$/g, "")}`;
}

function resultPayload(envelope) {
  if (!envelope || typeof envelope !== "object") return {};
  if (
    ["mode", "indexed", "code_map", "markdown", "submitted", "job_id", "sha"].some(
      (key) => key in envelope,
    )
  ) {
    return envelope;
  }
  const content = envelope.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      const text = item && typeof item === "object" ? item.text : null;
      if (text) {
        try {
          return resultPayload(JSON.parse(text));
        } catch {
          return { code_map: text };
        }
      }
    }
  }
  for (const key of ["structuredContent", "output", "result", "data", "app_affordance"]) {
    const nested = envelope[key];
    if (nested && typeof nested === "object") {
      const payload = resultPayload(nested);
      if (Object.keys(payload).length) return payload;
    }
  }
  return envelope;
}

function mcpCall({ url, token, tool, operation, args, timeoutMs }) {
  const endpoint = new URL(url);
  const transport = endpoint.protocol === "http:" ? http : https;
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: operation,
    method: "tools/call",
    params: {
      name: tool,
      arguments: {
        ...args,
        operation,
        tenant: args.tenant,
        tenant_id: args.tenant,
      },
    },
  });
  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        port: endpoint.port || (endpoint.protocol === "http:" ? 80 : 443),
        path: `${endpoint.pathname}${endpoint.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("mcp timeout"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function fallbackShellHook() {
  const script = process.env.THEOREM_CODE_AUTOINDEX_HOOK;
  if (!script || !existsSync(script)) return null;
  return script;
}

async function ensureViaMcp(repoRoot) {
  const sha = git(repoRoot, ["rev-parse", "HEAD"]);
  const repoUrl = git(repoRoot, ["remote", "get-url", "origin"]);
  if (!sha || !repoUrl) return "";

  const carryEnabled = process.env.THEOREM_CARRY_ENABLED || "0";
  let tenant = process.env.THEOREM_TENANT_ID || "";
  if (!tenant && carryEnabled !== "0") {
    tenant = process.env.THEOREM_CARRY_TENANT || "local";
  }
  if (!tenant) return "";

  let mcpUrl = process.env.THEOREM_MCP_URL || "";
  if (carryEnabled !== "0" && !mcpUrl) {
    mcpUrl = process.env.THEOREM_CARRY_MCP_URL || `http://127.0.0.1:${process.env.RUSTY_RED_PORT || "8380"}/mcp`;
  }
  if (!mcpUrl) {
    mcpUrl = "https://rustyredcore-theorem-production.up.railway.app/mcp";
  }

  const repoId = normalizeRepoId(repoUrl);
  const token = process.env.THEOREM_API_TOKEN || "";
  let ensure = {};
  try {
    ensure = resultPayload(
      await mcpCall({
        url: mcpUrl,
        token,
        tool: "compute_code",
        operation: "code_ingest_ensure",
        args: { tenant, repo_url: repoUrl, repo_id: repoId, sha },
        timeoutMs: 3_000,
      }),
    );
  } catch {
    return "";
  }

  const mode = String(ensure.mode || "").trim();
  const jobId = String(ensure.job_id || "").trim();
  const reason = String(ensure.reason || ensure.code_index_error_code || "").trim();
  const lines = [
    "## Code autoindex",
    "",
    `Repo \`${repoId}\` at \`${sha.slice(0, 12)}\` — mode \`${mode || "unknown"}\`` +
      (jobId ? `, job \`${jobId}\`` : "") +
      (reason ? `, reason \`${reason}\`` : "") +
      ".",
    "",
  ];

  // AX4: push dirty working-tree files into the session overlay (fail-open).
  const sessionId =
    process.env.THEOREM_SESSION_ID ||
    process.env.CLAUDE_SESSION_ID ||
    process.env.CODEX_SESSION_ID ||
    "";
  if (sessionId) {
    const dirtyPaths = [
      ...git(repoRoot, ["diff", "--name-only", "HEAD"]).split("\n"),
      ...git(repoRoot, ["ls-files", "--others", "--exclude-standard"]).split("\n"),
    ]
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((path, index, all) => all.indexOf(path) === index)
      .slice(0, 32);
    const files = [];
    for (const rel of dirtyPaths) {
      try {
        files.push({ path: rel, text: readFileSync(join(repoRoot, rel), "utf8") });
      } catch {
        // skip unreadable paths
      }
    }
    if (files.length) {
      try {
        await mcpCall({
          url: mcpUrl,
          token,
          tool: "compute_code",
          operation: "session_reingest",
          args: {
            tenant,
            repo_id: repoId,
            session_id: sessionId,
            base_commit_sha: sha,
            files,
          },
          timeoutMs: 3_000,
        });
        lines.push(`Session overlay: ${files.length} dirty file(s) for \`${sessionId}\`.`, "");
      } catch {
        // fail-open
      }
    }
  }

  return lines.join("\n");
}

const hookEventName = process.env.HOOK_EVENT_NAME || "SessionStart";
(async () => {
  try {
    const shellHook = fallbackShellHook();
    if (shellHook) {
      const repoRoot = git(process.cwd(), ["rev-parse", "--show-toplevel"]);
      if (!repoRoot) {
        printJson("", "", hookEventName);
        process.exit(0);
      }
      const result = spawnSync("bash", [shellHook], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env },
        timeout: 20_000,
      });
      printJson((result.stdout || "").trim(), undefined, hookEventName);
      process.exit(0);
    }

    const repoRoot = git(process.cwd(), ["rev-parse", "--show-toplevel"]);
    if (!repoRoot) {
      printJson("", "", hookEventName);
      process.exit(0);
    }
    const context = await ensureViaMcp(repoRoot);
    printJson(context, undefined, hookEventName);
  } catch {
    printJson("", "code-autoindex: unexpected error (fail-open)", hookEventName);
  }
  process.exit(0);
})();
