export async function readJsonFromStdin(stdin = process.stdin) {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    return {};
  }
  return JSON.parse(text);
}

export function hookResponse(markdown, packet, hookEventName = "UserPromptSubmit") {
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName,
      additionalContext: markdown,
    },
    theoremsHarness: packet,
  };
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
