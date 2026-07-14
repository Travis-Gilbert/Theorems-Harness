#!/usr/bin/env node
import { hookResponse, printJson, readJsonFromStdin } from "../product/hook-io.mjs";
import { sessionCodeContext } from "../product/session-code-context.mjs";

let input = {};
let result = { markdown: "", status: "degraded", reason: "hook_failure" };
try {
  input = await readJsonFromStdin();
  result = await sessionCodeContext(input);
} catch {
  // SessionStart is fail-open by contract.
}

printJson(hookResponse(
  result.markdown ?? "",
  { ...result, driver: "session-code-context" },
  input.hook_event_name ?? input.hookEvent ?? "SessionStart",
));
