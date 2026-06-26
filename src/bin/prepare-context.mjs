#!/usr/bin/env node
import { compileContext } from "../product/compile-context.mjs";
import { hookResponse, printJson, readJsonFromStdin } from "../product/hook-io.mjs";

const input = await readJsonFromStdin();
const { packet, markdown } = await compileContext({
  ...input,
  hookEvent: input.hook_event_name ?? "UserPromptSubmit",
});

printJson(hookResponse(markdown, packet, "UserPromptSubmit"));
