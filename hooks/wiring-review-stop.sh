#!/usr/bin/env bash
# Theorems-Harness Stop hook — report-only wiring review (SPEC-CAPABILITY-WIRING D1).
# Never blocks, never exits nonzero, never gates a commit.
set -uo pipefail

# Prefer the checkout's script when the agent is in Theorem.
if [[ -n "${THEOREM_REPO_ROOT:-}" && -f "${THEOREM_REPO_ROOT}/scripts/hooks/wiring-review-stop.sh" ]]; then
  bash "${THEOREM_REPO_ROOT}/scripts/hooks/wiring-review-stop.sh" || true
  exit 0
fi

# Walk up from cwd looking for scripts/hooks/wiring-review-stop.sh
dir="$PWD"
while [[ "$dir" != "/" ]]; do
  if [[ -f "$dir/scripts/hooks/wiring-review-stop.sh" ]]; then
    bash "$dir/scripts/hooks/wiring-review-stop.sh" || true
    exit 0
  fi
  dir="$(dirname "$dir")"
done

echo "WIRING REVIEW (report-only): no checkout script found; skip." >&2
exit 0
