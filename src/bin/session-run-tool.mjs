#!/usr/bin/env node
import { hookResponse, printJson, readJsonFromStdin } from "../product/hook-io.mjs";
import { recordSessionTool } from "../product/session-run.mjs";

let input = {};
try {
  input = await readJsonFromStdin();
  await recordSessionTool(input);
} catch {
  // A driver bug must never break the host session.
}

printJson(hookResponse("", { status: "ok", driver: "session-run-tool" }, input.hook_event_name ?? "PostToolUse"));
