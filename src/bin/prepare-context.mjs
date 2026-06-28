#!/usr/bin/env node
import { compileContext } from "../product/compile-context.mjs";
import { hookResponse, printJson, readJsonFromStdin } from "../product/hook-io.mjs";

const input = await readJsonFromStdin();
const hookEvent = input.hook_event_name ?? input.hookEvent ?? "UserPromptSubmit";
const { packet, markdown } = await compileContext({
  ...input,
  hookEvent,
});

printJson(hookResponse(markdown, packet, hookEvent));
