---
name: prototype-theorem
description: Raise the fidelity of a decision by building a throwaway artifact to react to; a logic spike, a set of UI variations, an outline, or a stub. Use when a Plan decision task hinges on how something should look or behave, or when discussion has gone abstract and needs something concrete to push against. HITL; worked live with the human, dispatched by /planning-theorem for decision.hitl tasks.
---

**Audience:** Theorem-internal subagent and MCP-connected head. A rule that binds only one audience names it.

# Prototype Theorem

A prototype is throwaway code that answers a question. The question decides the shape: a state model or logic question wants a tiny interactive spike that pushes the machine through the cases that are hard to reason about on paper; a look-or-behavior question wants several radically different variations the human can flip between. Getting the shape wrong wastes the whole prototype, so name the question first, out loud, with the human.

1. **Name the question and pick the shape** with the human; this is HITL, and the reaction is the data. Done when the question is stated in one line on the task and the human agrees it is the question.
2. **Build throwaway from the first minute**: located next to the code it is prototyping for, named so a casual reader sees it is a prototype, one command to run, no persistence unless persistence is the question, no tests, no error handling beyond runnable, no abstractions. Done when the human can start it without thinking.
3. **Surface the state**: after every action, or on every variant switch, print or render the full relevant state so the human sees what changed. For variations, make them genuinely different answers to the question, not one answer in three fonts. Done when the human has reacted to each case or variant.
4. **Capture the verdict, then the artifact**: the verdict and the question it settled land as `assert_facts` on the plan and the task transitions; the prototype commits to a throwaway branch, out of main, with a context pointer from the task; any validated decision folds into the real code. Main keeps only the validated decision. Done when someone reading only the plan knows what was decided and where the evidence lives.

## Anti-patterns

- Polishing: tests, error handling, or abstractions on code built to be deleted.
- Variations that are one design in three coats of paint.
- A prototype that persists state, then quietly becomes the persistence design.
- A verdict that lives in the chat and never lands on the plan.
- Keeping the prototype on main because it works.
