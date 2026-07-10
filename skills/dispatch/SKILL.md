---
name: dispatch
description: The local-loop job board and session spawn surface. Use when the user wants to hand a task from a planning surface to an executing head, queue work for later, read or update the job board, close a job, wake an asleep head, or start a fresh Claude Code or Codex session locally. Triggers on "queue a job", "dispatch this", "hand this off", "put this on the board", "job board", "spawn a session", "start a head", "wake the other head", "submit a job", and "archive that job". This is the loop from a planning surface to the receiver to a running CLI head.
---

# dispatch

The job/spawn surface for the local loop: a planning surface puts a typed job
on the board, the receiver picks it up, and a real `claude` or `codex` CLI runs
it locally. There are two halves here, and conflating them is the main failure
mode:

- **The job board** (`job_submit` / `job_list` / `job_note` / `job_archive`):
  a typed `Job` node living in the GraphStore beside run state. Submitting puts
  work on the board; it does **not** start anything by itself.
- **The launchers** (`spawn_session` / `spawn_handoff_session`): start an
  executing head locally now.

Neither is the plan substrate. A Plan (`plan` verb) is the durable multi-task
work graph heads claim from and transition; the job board is the local
hand-a-CLI-a-task loop. A job may carry a `plan_id` in its payload so the
spawned head claims from the right plan, but jobs do not replace plan tasks.

What actually runs a submitted job is `theorem-receiver`: an outbound-only loop
that reads pending jobs, starts one exactly once (it writes a `start_session_ref`
note so the same job is never double-launched), and spawns the locally
authenticated `claude` / `codex` CLI in a mapped worktree. So `job_submit`
queues; the receiver executes. If no receiver is running, a submitted job sits
on the board unrun.

## When To Fire

- "Queue this for the other head to pick up" / "put it on the board"
- "Hand this plan off to Codex / to Claude Code"
- "What is on the job board?" / "what is pending"
- "Note progress on that job" / "mark it started"
- "Close / archive that job"
- "Spawn a fresh session to do X now"
- "Wake the asleep head with this handoff"

Not a fit:
- Cross-head coordination chatter (intent, presence, @mentions): use the
  coordination tools, not the job board.
- Writing a durable lesson: use `/encode`.
- Capturing a non-blocking idea: use `/surface-idea`.

## Tools

| Tool | When | Notes |
|---|---|---|
| `job_submit` | Put work on the board | Creates a typed `Job` node. Optionally `spec_ref` (pointer to a plan-shaped artifact) or `spec_inline` (the task inline), plus `priority` and `target_head`. Submitting is not running: the receiver launches it. |
| `job_list` | Read the board | Returns jobs and their derived state (pending / started / archived). Use it to answer "what is queued" before submitting a duplicate. |
| `job_note` | Append a receipt | Adds an append-only progress note or receipt to a job (start marker, status, outcome). This is how progress and the set-once start are recorded. |
| `job_archive` | Close a job | Marks a job archived (done or abandoned). Closes it on the board; does not delete history. |
| `spawn_session` | Start a fresh head now | Launches a fresh executing head locally. Use when you want execution to begin immediately rather than queueing. |
| `spawn_handoff_session` | Start a head with a handoff | Launches a head pre-loaded with a handoff packet, so the new session boots already knowing the goal, state, and next step. |

## Example Calls

Submit a job for a target head, by spec reference:

```json
{
  "tool": "job_submit",
  "spec_ref": "docs/plans/obsidian-sync/plan.md",
  "priority": "normal",
  "target_head": "codex"
}
```

Submit an inline task:

```json
{
  "tool": "job_submit",
  "spec_inline": "Add a test-connection button to the obsidian-sync plugin settings.",
  "priority": "high",
  "target_head": "claude"
}
```

Note the start and read the board:

```json
{
  "tool": "job_note",
  "job_id": "job:abc123",
  "note": "start_session_ref: local-run-42"
}
```

```json
{ "tool": "job_list" }
```

Spawn a fresh head immediately, with a handoff:

```json
{
  "tool": "spawn_handoff_session",
  "handoff": "Resume the CRDT verifier work: Part 7 audit done, SC-W integration tests remaining."
}
```

## Standard Flow

1. **List before you submit.** Call `job_list` first so you do not put a
   duplicate on the board.
2. **Submit with the right shape.** Prefer `spec_ref` when a plan artifact
   exists; use `spec_inline` for a self-contained task. Set `target_head` when
   the work belongs to a specific lane (claude vs codex) and `priority` when it
   is urgent.
3. **Remember submit is not run.** A submitted job runs only when a receiver is
   up. If the user expects it to execute now and no receiver is running, say so,
   or use `spawn_session` / `spawn_handoff_session` to start a head directly.
4. **Record progress as notes.** Use `job_note` for the start marker and
   meaningful status; the start note is what keeps a job from being launched
   twice.
5. **Archive when done.** Close finished or abandoned jobs with `job_archive`
   so the board reflects reality.

## Output

State which verb ran and the `job_id` it produced or acted on. For `job_list`,
report the board grouped by state (pending / started / archived), not the full
node payloads. For a submit, state whether execution depends on a running
receiver. For a spawn, state that a head was launched and what it was handed.

## Anti-Patterns

- Treating `job_submit` as "run this now." It queues; the receiver executes.
- Submitting without `job_list` first and duplicating an existing job.
- Using the job board for coordination chatter that belongs in intent /
  presence / @mentions.
- Spawning a fresh head when a job already covers the work, or queueing a job
  when the user clearly wanted execution to start immediately.
- Forgetting the set-once start note (`job_note`), which is what prevents a
  double launch.
