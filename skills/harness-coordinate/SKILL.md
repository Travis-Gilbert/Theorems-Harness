---
name: harness-coordinate
description: Teach and run Theorem's Harness cross-agent coordination protocol. Use when Codex, Claude Code, Claude.ai, or another head works the same repo/task and the user wants coordination, shared intent, mentions, presence, handoff, or a ping-like wait. The model is one agent with several heads sharing a scratchpad, announcing over a shared room and checking semantic overlap before reconciling concrete edits.
---

# Harness Coordinate

You are not several agents sharing a repo. You are one agent with several heads
(`codex`, `claude-code`, `claude-ai`), and the binding makes that literal: one
identity, one shared scratchpad the heads append revisions to, one budget, heads
as hands. The one-sentence model: you and the other head edit in isolation and
share one live room. Do not claim files. Announce what you are doing and your next
move, watch the room, build on a peer's completed edit, and let the semantic guard
catch the conflicts the room cannot show. The verb is announce, not coordinate and
not claim.

The heads run in isolated execution: separate worktrees or environments, each
patching against a base. That fence stays. A source file has no semantic merge, so
two hands on the same bytes lose work, and a third-party head cannot be made to edit
through a shared buffer. What unifies you across the fence is not a shared tree, it
is announce frequency plus the headline guard below. Closeness is awareness, not
shared bytes.

The transport is gossip over a shared substrate, not handshakes over a bus. Each
head reads the others' live state at turn-start, writes its own announcement,
works, and closes that announcement as a handoff at turn-end. The next head
reads those records and continues. That is what makes coordination feel
continuous across sleeps: the records persist and are read at the next
turn-start, whether or not anyone was waiting.

## The headline guard: semantic overlap

Named first, because it is the one thing isolation and text merge both miss. The
room shows who is touching what; git shows whether two diffs merge as text. Neither
catches an edit that merges cleanly and still disagrees at runtime: you change a
function's contract in your worktree while the other head writes a caller in theirs,
both land, both merge as text, and the program is now wrong. The semantic-overlap
check runs over the code graph. When your announced footprint and a peer's touch
structurally coupled code, the substrate emits a `coordination_tension`. Read those
tensions before you decide your edit is safe. Isolation is commodity (every 2026
agent tool ships worktrees); semantic-overlap detection over a code graph is not, so
it is the guard you lead with.

## When to use

- another head is active on the same repo, branch, task, or workstream
- the user asks whether the heads can coordinate or message each other
- you are about to touch files another head may be editing
- you are handing off, pausing, or finishing multi-head work

## The primitives

| Primitive | Tool | Role |
|---|---|---|
| Announcement | `coordination_intent` / `read_intents_for_room` | The spine. One live record per (room, head): what you are doing now, which files or concepts your hands are on, and where semantic overlap may exist. Read others' at turn-start, write yours before you act, close it at turn-end as your handoff. It is not a fence. |
| Room | `coordination_room` | Durable membership and the task. `status` to read, `start` / `join` to enter. |
| Presence | `presence` | Short-TTL liveness. Who is fresh right now. |
| Interrupt | `coordinate` + `mentions` | The block and fork channel. A specific head must see this now: something is broken, or a real disagreement changes the next step. Not the default channel. |
| Stream | `stream_subscribe` / `stream_read` / `stream_publish` | The ambient event flow. Subscribe once per room, read the cursor delta at turn-start, publish events as you go. The passive replacement for polling the room each turn. |
| Semantic overlap | code-graph overlap check -> `coordination_tension` | The headline guard. When your announced footprint and a peer's touch structurally coupled code, the substrate raises a tension; read it before you commit to your edit, because it catches runtime disagreement a clean text merge hides. |
| Fork | `coordination_tension` | A durable record of a structural disagreement. Surface it and keep working; it does not block the disagreed-with work. |
| Reconciliation | `multihead_patch` / lease-like records | Isolated mechanics for concrete patch review, proof, and merge reconciliation after overlap is understood. They are not the headline coordination model and not a way to reserve files. |
| Plan fan-out | `plan claim` / `multihead_next` with `plan_id` | When a durable Plan backs the work, heads claim tasks from the plan, not from a coordination record, and `plan_id` scopes routing to that plan's task subgraph. The room injects a bound plan digest automatically — reference the plan by id/digest and never re-encode its content into records, messages, or reflections. |
| Memory | `coordination_reflection` / `coordination_decision` | Turn-end working memory and architectural choices the next head inherits. |

## Transport: streams carry the ambient flow

The footprint stays the spine, but the ambient event flow moved from polling to
a subscribed cursor. Subscribe to the room stream once with `stream_subscribe`.
At turn-start, `stream_read` returns only what was appended since your last
cursor, so you stop re-reading the whole room every turn. Publish progress and
events with `stream_publish`. A publish with urgency block or ask and a
`target_actor` lands on that head's mention and wake path, so the interrupt
channel rides the same stream. Footprints (`coordination_intent`) and durable
records (`coordination_record` with type decision, reflection, or tension) are
unchanged. The stream is how the other heads learn an event happened without
polling for it.

## Head calls: the live call grammar

`head_call` events are the narrow grammar for interruptible live conversation
between heads. They ride the same coordination stream, but the switchboard may
also inject them directly into an active head's context, and MCP tool results may
piggyback a small `unread_head_calls` summary. Treat those summaries as delivery
notices, not full bodies: they do not ack, do not advance your stream cursor, and
the full call still comes from `stream_read`.

Kinds:

- `Say`: fire-and-forget context. Do not publish a reply unless the content asks
  you to start a separate new call.
- `Ask`: answer before `deadline_ms` by publishing a `Reply` head call with the
  same `correlation_id` as the inbound call's `call_id`. Silence becomes a
  `Timeout` receipt.
- `Block`: the caller is halted on this. Treat it as interrupt-priority, answer
  as soon as possible, and publish a `Reply` with `correlation_id=<call_id>`.
- `Reply`: response to an `Ask` or `Block`; route it by `correlation_id`.
- `Timeout`: receipt that an `Ask` or `Block` exceeded its deadline.

When a call is injected, the preamble names `from_actor`, `call_id`, `kind`,
`deadline_ms`, and `refs` with one-line gists. For `Ask` and `Block`, obey the
exact reply instruction in the preamble:

```text
publish head_call kind=reply correlation_id=<id>
```

When sending a call yourself, choose the weakest kind that matches the need:
`Say` for useful context, `Ask` when a reply changes your next step, and `Block`
only when the other head should stop or unblock you. Include a short gist and
refs instead of pasting large context into the call body.

## The turn, in four beats

**1. Read the room.** Before you plan edits, read what the other heads left.

```json
// read_intents_for_room: who is doing what, which files their hands are on
{ "actor": "claude-code", "room_id": "harness-plugin-rebuild" }
```

```json
// mentions: drain block / fork interrupts addressed to you
{ "actor": "claude-code", "consume": true, "limit": 20 }
```

Also read open tensions and recent reflections / decisions when the task is live.
Synthesize: where are the other hands, and does anything I am about to do cut
against an open fork or a recorded decision.

**2. Announce your work.** Write what you are doing, where your hands are, and
what semantic overlap you have already noticed. This replaces stating a lane and
replaces asking "can I take X".

```json
{
  "actor": "claude-code",
  "room_id": "harness-plugin-rebuild",
  "status": "working",
  "summary": "Rewriting harness-coordinate to the announce-over-room model; semantic overlap is the headline check.",
  "claimed_files": ["theorems-harness/skills/harness-coordinate/SKILL.md"],
  "expected_completion": "this session"
}
```

(`claimed_files` is the legacy tool field name. Read it as "files my hands are
on now," not a lock.)

**3. Work in isolation, watch the guard.** Do the work in your own worktree or
environment. Watch for semantic-overlap tensions: when your footprint and a peer's
touch structurally coupled code, the check fires, and that is the signal to read
their work before you commit to your edit. When a peer's *completed* edit lands on
code you also need, build on it rather than redoing it or reverting it; held, not
clobbered. If you think their edit is wrong, that is a fork, not a license to
overwrite: write a `coordination_tension` with what you saw and your alternative,
and keep moving. Patch, proof, and lease mechanics are how two isolated trees
reconcile a concrete artifact; reach for them when there is something to review or
merge, not to reserve a file.

**4. Close your announcement.** Rewrite your intent with `status: "done"` or
`"paused"`, and put the handoff in the summary: what changed, what is true now,
what the next step is. Write a `coordination_reflection` (what you are tracking,
assuming, leaving open) and a `coordination_decision` for any real architectural
choice, so the next turn of either head resumes cold with no catch-up.

```json
{
  "actor": "claude-code",
  "room_id": "harness-plugin-rebuild",
  "status": "done",
  "summary": "Coordinate skill rewritten to announce-over-room. Open: verify prompt injection and patch any stale references.",
  "claimed_files": [],
  "expected_completion": "handoff complete"
}
```

A stale `working` announcement with files still listed reads to the other head
like an abandoned hand on the keyboard, so close it even on a short turn.

## Isolation is correct; announce makes it transparent

Closeness and isolation are orthogonal. Closer collaboration does not mean shared
bytes; it means shared awareness over isolated execution. The fence (a worktree or a
separate environment, patching against a base) stays, because that is what makes
concurrent work on unmergeable source safe: a clean text merge does not give you a
correct program. The mistake the fence invites is using it to avoid each other,
pre-assigning rigid lanes so your hands never meet, which hides the overlap that
catches errors and lets two halves of one contract drift apart. The fix is not to
tear down the fence and co-edit the same bytes. The fix is to make the fence
transparent: announce at high frequency so each head sees what the other is doing,
read the semantic-overlap tensions the substrate raises over the code graph, and
build on a peer's completed edit instead of redoing it. Frequency over fences means
announce more often, not share a working tree. What prevents duplicate work is the
announce loop plus the guard, not a shared buffer.

## When to send a mention

Send one only when the answer changes your immediate next action, or the other
head must stop. Two cases:

- **Block.** Something is broken and the other head should stop or wait.
  `coordinate` with `urgency: "block"` and an `@actor`.
- **Fork.** You disagree with a structural choice. Write the
  `coordination_tension`, and add a `coordinate` with `urgency: "ask"` only if a
  specific head should see it now.

Ordinary progress (a file landed, a test passed) needs no mention. Update your
announcement summary; the other head reads it next turn. Do not wait just because
you sent a mention: send it, keep working the non-blocked slice, read the reply at
your next checkpoint. Wait (`mentions_wait`, `timeout_seconds` <= 30) only when
you cannot proceed without the answer.

## Reaching a specific dirty checkout

Actor name is the channel, not proof of anything. For unpushed local work, target
the durable checkout identity (`target_session_id`, `target_worktree`,
`target_branch`, `target_changed_files`) so the mention reaches the right dirty
tree. Clients auto-advertise local `worktree` / `branch` / `head` /
`changed_files`. This is the one place targeting matters; default coordination
needs only the room.

## Reality of "real time"

`mentions_wait` is long-polling, not host push. It feels like a ping when a live
head calls it at a checkpoint, but it cannot wake a suspended turn by itself, and
it holds an MCP thread until it returns. Keep waits short and prefer checkpoints
over listeners. The wake courier (`theorem-receiver` wake mode) only spawns asleep
heads; a live head drains its own wakes. Frequency over fences. A subscribed
head reads the cursor delta at its next checkpoint, so most coordination needs no
wait at all. Reserve `mentions_wait` for the case where you cannot proceed
without the answer, and let everything else arrive on the next `stream_read`.

## Output discipline

- Record where your hands are in the announcement, not only in prose.
- `urgency: "block"` only when the other head should stop.
- Put file paths and repo names in `metadata`, not just the message body.
- Consume mentions after reading so the same ping does not reappear.
- Close your announcement at turn-end, every turn.
- Mention coordination in your final reply only when it shaped the work.
