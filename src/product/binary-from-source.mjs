import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  delimiter,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { callNativeMcpTool } from "./native-mcp.mjs";

const DEFAULT_BUILD_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_GHIDRA_TIMEOUT_SECONDS = 30;
const DEFAULT_MAX_FUNCTIONS = 256;
const DEFAULT_MAX_PCODE_OPS = 2000;
const MAX_LOG_CHARS = 8000;
const MAX_DATAWAVE_RECORDS = 5000;
const DEFAULT_EXPORT_SCRIPT = fileURLToPath(
  new URL("./ghidra/ExportHarnessFacts.java", import.meta.url),
);
const COPY_EXCLUDES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".cache",
  ".next",
  "build",
  "dist",
  "node_modules",
  "target",
]);

export async function reconstructBinaryFromSource(input = {}) {
  const sourcePath = sourcePathFrom(input);
  if (!sourcePath) {
    return degraded({
      reason: "target_missing",
      message: "reconstruct(mode=binary_from_source) requires source.local_path, source.repo_path, local_path, repo_path, path, or cwd.",
      input,
    });
  }

  const confirmed = Boolean(input.confirmed ?? input.build_confirmed ?? input.buildConfirmed);
  const buildCommands = buildCommandsFrom(input);
  if (buildCommands.length > 0 && !confirmed) {
    return degraded({
      reason: "confirmation_required",
      message: "Building source executes local commands. Pass confirmed: true after choosing the build command and target artifact.",
      source_path: sourcePath,
      build_commands: buildCommands.map(commandLabel),
    });
  }

  const absoluteSourcePath = resolve(sourcePath);
  const sourceStat = await statOrNull(absoluteSourcePath);
  if (!sourceStat) {
    return degraded({
      reason: "target_missing",
      message: "source path does not exist.",
      source_path: absoluteSourcePath,
    });
  }

  const tempDir = await mkdtemp(join(tmpdir(), "theorems-harness-binary-from-source-"));
  const keepSandbox = Boolean(input.keep_sandbox ?? input.keepSandbox);
  const sandboxSourcePath = join(tempDir, "source");
  const startedAt = new Date().toISOString();

  try {
    await copySourceToSandbox(absoluteSourcePath, sandboxSourcePath, sourceStat);
    const build = await runBuildCommands(buildCommands, sandboxSourcePath, input);
    const artifactPath = await resolveArtifactPath(input, {
      sourcePath: absoluteSourcePath,
      sandboxSourcePath,
    });

    if (!artifactPath) {
      return degraded({
        reason: "artifact_unavailable",
        message: "Build completed, but no artifact_path, binary_path, or artifact_glob resolved to a file.",
        source_path: absoluteSourcePath,
        sandbox_path: keepSandbox ? sandboxSourcePath : undefined,
        build,
      });
    }

    const artifact = await artifactReceipt(artifactPath, {
      sourcePath: absoluteSourcePath,
      sandboxSourcePath,
    });
    const ghidra = await runGhidraIfRequested(input, artifactPath, tempDir);
    const datawave = await maybeIngestGhidraFacts(input, artifact, ghidra);
    const status = build.status === "failed" || ghidra.status === "degraded" || datawave.status === "degraded"
      ? "degraded"
      : "ok";

    return {
      schema_version: 1,
      ok: status === "ok",
      status,
      reason: status === "degraded" ? build.reason ?? ghidra.reason ?? datawave.reason : undefined,
      mode: "binary_from_source",
      product_tool: "reconstruct",
      source: {
        path: absoluteSourcePath,
        sandbox_path: keepSandbox ? sandboxSourcePath : undefined,
      },
      build,
      artifact,
      ghidra,
      datawave,
      reconstruction_spec: reconstructionSpec({
        input,
        artifact,
        build,
        ghidra,
        datawave,
        startedAt,
      }),
    };
  } catch (caught) {
    return degraded({
      reason: "binary_from_source_failed",
      message: caught instanceof Error ? caught.message : String(caught),
      source_path: absoluteSourcePath,
      sandbox_path: keepSandbox ? sandboxSourcePath : undefined,
    });
  } finally {
    if (!keepSandbox) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

function sourcePathFrom(input) {
  const source = objectOrEmpty(input.source ?? input.source_ref ?? input.sourceRef);
  return stringValue(
    source.local_path
      ?? source.localPath
      ?? source.repo_path
      ?? source.repoPath
      ?? input.local_path
      ?? input.localPath
      ?? input.repo_path
      ?? input.repoPath
      ?? input.path
      ?? input.cwd,
  );
}

function buildCommandsFrom(input) {
  const raw = input.build_commands ?? input.buildCommands ?? input.commands ?? input.build_command ?? input.buildCommand;
  if (!raw) return [];
  const commands = Array.isArray(raw) ? raw : [raw];
  return commands
    .map((command) => {
      if (typeof command === "string") {
        return { command, shell: true };
      }
      if (Array.isArray(command)) {
        return {
          command: String(command[0] ?? ""),
          args: command.slice(1).map(String),
          shell: false,
        };
      }
      if (command && typeof command === "object") {
        return {
          command: String(command.command ?? command.cmd ?? ""),
          args: Array.isArray(command.args) ? command.args.map(String) : [],
          shell: command.shell !== false,
        };
      }
      return { command: "", shell: true };
    })
    .filter((command) => command.command.trim());
}

async function copySourceToSandbox(sourcePath, sandboxSourcePath, sourceStat) {
  await mkdir(dirname(sandboxSourcePath), { recursive: true });
  if (sourceStat.isDirectory()) {
    await cp(sourcePath, sandboxSourcePath, {
      recursive: true,
      filter: (path) => !COPY_EXCLUDES.has(basename(path)),
    });
    return;
  }

  await mkdir(sandboxSourcePath, { recursive: true });
  await cp(sourcePath, join(sandboxSourcePath, basename(sourcePath)));
}

async function runBuildCommands(commands, cwd, input) {
  const timeoutMs = Number(input.build_timeout_ms ?? input.buildTimeoutMs ?? DEFAULT_BUILD_TIMEOUT_MS);
  const receipts = [];
  for (const command of commands) {
    receipts.push(await runCommand(command, { cwd, timeoutMs }));
  }
  return {
    status: receipts.some((receipt) => receipt.status !== "ok") ? "failed" : "ok",
    reason: receipts.some((receipt) => receipt.status !== "ok") ? "build_failed" : undefined,
    cwd,
    commands: receipts,
  };
}

async function resolveArtifactPath(input, { sourcePath, sandboxSourcePath }) {
  const pathValue = stringValue(input.artifact_path ?? input.artifactPath ?? input.binary_path ?? input.binaryPath);
  if (pathValue) {
    const resolved = pathInSandbox(pathValue, { sourcePath, sandboxSourcePath });
    if (await fileExists(resolved)) return resolved;
  }

  const glob = stringValue(input.artifact_glob ?? input.artifactGlob ?? input.binary_glob ?? input.binaryGlob);
  if (!glob) return "";
  const matcher = globMatcher(glob);
  const files = await walkFiles(sandboxSourcePath);
  return files.find((file) => matcher(posixPath(relative(sandboxSourcePath, file)))) ?? "";
}

function pathInSandbox(pathValue, { sourcePath, sandboxSourcePath }) {
  if (!isAbsolute(pathValue)) {
    return resolve(sandboxSourcePath, pathValue);
  }
  const absolute = resolve(pathValue);
  const relativeToSource = relative(sourcePath, absolute);
  if (relativeToSource && !relativeToSource.startsWith("..") && !isAbsolute(relativeToSource)) {
    return resolve(sandboxSourcePath, relativeToSource);
  }
  return absolute;
}

async function artifactReceipt(path, { sandboxSourcePath }) {
  const bytes = await readFile(path);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    artifact_id: `artifact:sha256:${sha256}`,
    sha256,
    byte_len: bytes.length,
    path,
    sandbox_relative_path: posixPath(relative(sandboxSourcePath, path)),
  };
}

async function runGhidraIfRequested(input, artifactPath, tempDir) {
  if (input.ghidra === false || input.run_ghidra === false || input.runGhidra === false || input.ghidra_enabled === false) {
    return {
      status: "skipped",
      reason: "ghidra_disabled",
      facts: null,
    };
  }

  const headless = await ghidraHeadlessPath(input);
  if (!headless.path) {
    return {
      status: "degraded",
      reason: "ghidra_unavailable",
      message: "No analyzeHeadless executable was configured or found on PATH.",
      checked_env: ["GHIDRA_HEADLESS", "GHIDRA_INSTALL_DIR", "GHIDRA_HOME"],
      facts: null,
    };
  }
  if (!headless.executable) {
    return {
      status: "degraded",
      reason: "ghidra_unavailable",
      message: "Configured analyzeHeadless path is not executable.",
      path: headless.path,
      facts: null,
    };
  }

  const scriptPath = resolve(stringValue(input.ghidra_script_path ?? input.ghidraScriptPath) || DEFAULT_EXPORT_SCRIPT);
  if (!(await fileExists(scriptPath))) {
    return {
      status: "degraded",
      reason: "ghidra_script_missing",
      message: "Ghidra export script does not exist.",
      script_path: scriptPath,
      facts: null,
    };
  }

  const projectDir = join(tempDir, "ghidra-project");
  const outputPath = join(tempDir, "ghidra-facts.json");
  await mkdir(projectDir, { recursive: true });
  const args = [
    projectDir,
    "theorems-harness",
    "-import",
    artifactPath,
    "-scriptPath",
    dirname(scriptPath),
    "-postScript",
    basename(scriptPath),
    outputPath,
    String(Number(input.max_ghidra_functions ?? input.maxGhidraFunctions ?? DEFAULT_MAX_FUNCTIONS)),
    String(Number(input.ghidra_timeout_seconds ?? input.ghidraTimeoutSeconds ?? DEFAULT_GHIDRA_TIMEOUT_SECONDS)),
    String(Number(input.max_pcode_ops ?? input.maxPcodeOps ?? DEFAULT_MAX_PCODE_OPS)),
    "-deleteProject",
  ];
  const run = await runCommand(
    { command: headless.path, args, shell: false },
    {
      cwd: tempDir,
      timeoutMs: Number(input.ghidra_timeout_ms ?? input.ghidraTimeoutMs ?? DEFAULT_BUILD_TIMEOUT_MS),
    },
  );
  if (run.status !== "ok") {
    return {
      status: "degraded",
      reason: "ghidra_failed",
      command: run,
      facts: null,
    };
  }

  const facts = parseJsonOrNull(await readFile(outputPath, "utf8"));
  if (!facts) {
    return {
      status: "degraded",
      reason: "ghidra_output_unreadable",
      command: run,
      output_path: outputPath,
      facts: null,
    };
  }

  return {
    status: "ok",
    analyzer: "ghidra-analyzeHeadless",
    headless_path: headless.path,
    export_script: scriptPath,
    command: run,
    facts_summary: summarizeGhidraFacts(facts),
    facts,
  };
}

async function maybeIngestGhidraFacts(input, artifact, ghidra) {
  if (!Boolean(input.ingest_datawave ?? input.datawave_ingest ?? input.ingestDatawave)) {
    return { status: "skipped", reason: "datawave_ingest_not_requested" };
  }
  if (ghidra.status !== "ok" || !ghidra.facts) {
    return { status: "skipped", reason: "ghidra_facts_unavailable" };
  }

  const records = ghidraFactsToDatawaveRecords(artifact, ghidra.facts)
    .slice(0, Number(input.max_datawave_records ?? input.maxDatawaveRecords ?? MAX_DATAWAVE_RECORDS));
  const result = await callNativeMcpTool({
    input,
    nativeTool: "datawave_ingest",
    productTool: "reconstruct",
    requestId: "reconstruct-binary-from-source-datawave",
    arguments: {
      operation: "batch",
      records,
    },
  });
  return {
    status: result.status,
    reason: result.reason,
    records_count: records.length,
    result,
  };
}

function reconstructionSpec({ input, artifact, build, ghidra, datawave, startedAt }) {
  return {
    source_ref: objectOrEmpty(input.source ?? input.source_ref ?? input.sourceRef),
    artifact,
    build_status: build.status,
    ghidra_status: ghidra.status,
    datawave_status: datawave.status,
    facts_summary: ghidra.facts_summary ?? {},
    confidence: ghidra.status === "ok" ? "observed_binary_plus_ghidra" : "observed_build_artifact_only",
    validators: [
      "build_command_exit_status",
      "artifact_sha256",
      ghidra.status === "ok" ? "ghidra_headless_json_export" : "ghidra_unavailable_or_skipped",
      datawave.status === "ok" ? "datawave_ingest_receipt" : "datawave_not_ingested",
    ],
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  };
}

function ghidraFactsToDatawaveRecords(artifact, facts) {
  const records = [];
  const fixture = objectOrEmpty(facts.fixture);
  for (const [kind, value] of Object.entries(facts)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      records.push({
        source: "ghidra",
        fact_kind: kind,
        artifact_id: artifact.artifact_id,
        artifact_sha256: artifact.sha256,
        fixture_id: fixture.fixture_id,
        value: item,
      });
    }
  }
  return records;
}

function summarizeGhidraFacts(facts) {
  return Object.fromEntries(
    Object.entries(facts)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [`${key}_count`, value.length]),
  );
}

async function ghidraHeadlessPath(input) {
  const explicit = stringValue(input.ghidra_headless_path ?? input.ghidraHeadlessPath);
  if (explicit) {
    return {
      path: resolve(explicit),
      executable: await isExecutable(resolve(explicit)),
    };
  }

  const envCandidates = [
    process.env.GHIDRA_HEADLESS,
    process.env.GHIDRA_INSTALL_DIR ? join(process.env.GHIDRA_INSTALL_DIR, "support", "analyzeHeadless") : "",
    process.env.GHIDRA_HOME ? join(process.env.GHIDRA_HOME, "support", "analyzeHeadless") : "",
  ].filter(Boolean);
  for (const candidate of envCandidates) {
    if (await isExecutable(candidate)) {
      return { path: candidate, executable: true };
    }
  }

  const pathCandidate = await findOnPath("analyzeHeadless");
  return pathCandidate
    ? { path: pathCandidate, executable: true }
    : { path: "", executable: false };
}

async function runCommand(command, { cwd, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = new Date().toISOString();
  return new Promise((resolvePromise) => {
    const child = spawn(command.command, command.args ?? [], {
      cwd,
      env: process.env,
      shell: command.shell !== false,
      signal: controller.signal,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolvePromise({
        status: "failed",
        command: commandLabel(command),
        cwd,
        exit_code: null,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        stdout,
        stderr,
        error: error.message,
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolvePromise({
        status: code === 0 ? "ok" : "failed",
        command: commandLabel(command),
        cwd,
        exit_code: code,
        signal,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        stdout,
        stderr,
      });
    });
  });
}

function commandLabel(command) {
  return command.shell === false
    ? [command.command, ...(command.args ?? [])].join(" ")
    : command.command;
}

async function walkFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (COPY_EXCLUDES.has(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function globMatcher(pattern) {
  const normalized = posixPath(pattern);
  const regex = new RegExp(`^${globToRegexSource(normalized)}$`, "u");
  return (value) => regex.test(value);
}

async function statOrNull(path) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function fileExists(path) {
  const value = await statOrNull(path);
  return Boolean(value?.isFile());
}

async function isExecutable(path) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(binaryName) {
  for (const directory of String(process.env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, binaryName);
    if (await isExecutable(candidate)) return candidate;
  }
  return "";
}

function degraded(details) {
  return {
    schema_version: 1,
    ok: false,
    status: "degraded",
    mode: "binary_from_source",
    product_tool: "reconstruct",
    ...details,
  };
}

function appendBounded(current, chunk) {
  const next = `${current}${chunk.toString("utf8")}`;
  return next.length > MAX_LOG_CHARS ? next.slice(-MAX_LOG_CHARS) : next;
}

function parseJsonOrNull(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringValue(value) {
  const text = String(value ?? "").trim();
  return text || "";
}

function posixPath(value) {
  return String(value).split(sep).join("/");
}

function globToRegexSource(value) {
  let source = "";
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === "*" && value[index + 1] === "*") {
      source += ".*";
      index++;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += escapeRegexChar(char);
    }
  }
  return source;
}

function escapeRegexChar(value) {
  return /[|\\{}()[\]^$+?.]/u.test(value) ? `\\${value}` : value;
}
