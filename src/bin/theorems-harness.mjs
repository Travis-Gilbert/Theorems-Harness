#!/usr/bin/env node
import { formatDoctor, runDoctor } from "../product/doctor.mjs";
import { formatRemoteDoctor, runRemoteDoctor } from "../product/remote-doctor.mjs";

const command = process.argv[2] ?? "doctor";
const args = process.argv.slice(3);

if (command === "doctor") {
  const result = await runDoctor({ cwd: process.cwd() });
  if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatDoctor(result));
  }
  if (result.status === "fail") {
    process.exitCode = 1;
  }
} else if (command === "remote-doctor") {
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
} else {
  process.stderr.write(`Unknown command: ${command}\n`);
  process.stderr.write("Usage: theorems-harness doctor [--json]\n");
  process.stderr.write("       theorems-harness remote-doctor [--json] [--remote-url URL] [--timeout-ms MS]\n");
  process.exitCode = 64;
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
