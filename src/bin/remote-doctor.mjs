#!/usr/bin/env node
import { formatRemoteDoctor, runRemoteDoctor } from "../product/remote-doctor.mjs";

const args = process.argv.slice(2);
const result = await runRemoteDoctor({
  cwd: process.cwd(),
  remoteUrl: optionValue(args, "--remote-url"),
  token: optionValue(args, "--token"),
  timeoutMs: optionValue(args, "--timeout-ms"),
});

if (args.includes("--json")) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stdout.write(formatRemoteDoctor(result));
}

if (result.status === "fail") {
  process.exitCode = 1;
}

function optionValue(args, name) {
  const exact = args.indexOf(name);
  if (exact !== -1) {
    return args[exact + 1];
  }
  const prefix = `${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}
