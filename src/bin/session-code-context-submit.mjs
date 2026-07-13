#!/usr/bin/env node
import { submitCodeContext } from "../product/session-code-context.mjs";

try {
  const submission = JSON.parse(process.env.THEOREM_CODE_CONTEXT_SUBMIT_JSON ?? "{}");
  if (submission.repoId && submission.repoUrl && submission.sha && submission.manifestPath) {
    await submitCodeContext(submission);
  }
} catch {
  // The parent hook already returned. Submission failures remain fail-open and
  // are retried by a later SessionStart status check.
}
