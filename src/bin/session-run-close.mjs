#!/usr/bin/env node
import { hookResponse, printJson, readJsonFromStdin } from "../product/hook-io.mjs";
import { closeSessionRun } from "../product/session-run.mjs";

let input = {};
try {
  input = await readJsonFromStdin();
  await closeSessionRun(input);
} catch {
  // A driver bug must never break the host session.
}

printJson(hookResponse("", { status: "ok", driver: "session-run-close" }, input.hook_event_name ?? "SessionEnd"));
