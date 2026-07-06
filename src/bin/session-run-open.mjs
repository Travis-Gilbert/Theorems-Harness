#!/usr/bin/env node
import { hookResponse, printJson, readJsonFromStdin } from "../product/hook-io.mjs";
import { openSessionRun } from "../product/session-run.mjs";

let input = {};
try {
  input = await readJsonFromStdin();
  await openSessionRun(input);
} catch {
  // A driver bug must never break the host session.
}

printJson(hookResponse("", { status: "ok", driver: "session-run-open" }, input.hook_event_name ?? "SessionStart"));
