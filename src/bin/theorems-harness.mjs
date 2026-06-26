#!/usr/bin/env node
import { formatDoctor, runDoctor } from "../product/doctor.mjs";

const command = process.argv[2] ?? "doctor";

if (command === "doctor") {
  const result = await runDoctor({ cwd: process.cwd() });
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatDoctor(result));
  }
  if (result.status === "fail") {
    process.exitCode = 1;
  }
} else {
  process.stderr.write(`Unknown command: ${command}\n`);
  process.stderr.write("Usage: theorems-harness doctor [--json]\n");
  process.exitCode = 64;
}
