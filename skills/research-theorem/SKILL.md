---
name: research-theorem
description: Resolve an AFK research task from a Plan against primary sources, offload the findings to the graph, and land a markdown projection in the repo. Use when a decision waits on facts from documentation, third-party APIs, source code, benchmarks, or the knowledge graph; dispatched by /planning-theorem for decision.afk tasks, and usable standalone when the user wants reading legwork delegated.
---

**Audience:** Theorem-internal subagent and MCP-connected head. A rule that binds only one audience names it.

# Research Theorem

A research task exists because a decision is waiting on a fact. The deliverable is the fact with its source, not a summary of the reading. Run in the background where the surface supports it, so the dispatching session keeps working.

The substrate resolves mechanical unknowns on its own: the known-unknowns registry harvests unresolved symbols, external APIs, and stale docs at plan create and fires bounded web resolution per entry within budget. This skill is the judgment lane above that machinery, for questions whose answer needs synthesis, comparison, or a source the registry cannot reach, and the fallback lane when a registry entry comes back unresolved. Check what the registry already resolved before reading anything; its resolutions carry provenance and bind to the tasks they de-risk.

1. **Investigate against primary sources**: official docs, source code, specs, first-party APIs, the graph itself, never a secondary write-up of them. Follow every claim back to the source that owns it. Done when each claim the decision needs carries the source that owns it.
2. **Offload to the graph as you go**: `encode` the load-bearing findings with their sources, so the information belongs to every session, not this one. Within Theorem's subagent topology, sessions never hand off to each other; they offload to the graph. An MCP-connected head coordinates directly through `coordinate`, `coordination_room`, and `handoff`, and offloads to the graph so the handoff is readable rather than replaced. Done when a cold head could recall the findings without this session's context.
3. **Land the markdown projection**: one file per research task, citing each claim's source, saved where the repo already keeps such notes; match the existing convention, and if there is none, `docs/research/<plan-slug>/<task-alias>.md` and say so. Done when the file exists and the task links it as an asset.
4. **Resolve the task**: `assert_facts` records the answer the decision was waiting on, in one or two lines with a link to the projection for the detail; the task transitions. Done when the fact sheet holds the answer and the fog it clears is graduated or flagged for the hub to graduate.

Research tasks are the one exception to one decision per session: several may run in parallel against the same plan, because each writes to its own task and the graph merges the awareness.

## Anti-patterns

- Citing a blog post for a claim the source code owns.
- Findings that live only in the session transcript.
- A projection file that answers a different question than the task asked.
- Resolving the decision the research feeds; the fact is this task's deliverable, the decision belongs to its own task.
