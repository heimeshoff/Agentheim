---
id: agentic-workflow-z2f7s
title: Fan-out caps — MAX_PARALLEL as a knob, research cap, global nested-spawn ceiling
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, concurrency, cost, work-skill, research-skill, orchestrator]
related_adrs: []
related_research: []
prior_art: [agentic-workflow-b8x2v]
---

## Why

All three fan-out surfaces are magic or unbounded: `work` caps at a bare
`MAX_PARALLEL = 3` (`skills/work/SKILL.md:36`, no rationale, no named knob),
`research` fan-out is entirely uncapped ("spawn multiple researcher agents
rather than serializing" — `skills/research/SKILL.md:160`), and the nested
worker→orchestrator→specialist chain has no stated budget — worst case a full
batch fans out to 3 workers × (1 orchestrator + 2–4 specialists), and a FAIL
re-dispatch re-runs the chain. Nothing states, bounds, or surfaces the
cumulative fan-out. (Harness audit 2026-07-02, ⊕ finding from the Opus
cross-check.)

## What

Three doctrine edits across two skill files. **All three are documentation +
rationale, not new enforcement code** — the caps are prose the conductor /
skills already honor; this task names them, gives them a why, and makes any
trigger visible.

1. **`work` — name `MAX_PARALLEL` as a knob.** In `skills/work/SKILL.md` (Phase
   3, line ~36) state that `MAX_PARALLEL = 3` is a **user-settable default**
   (the "unless the user asked otherwise" clause already implies override — make
   it explicit and named) and carry a one-line rationale for *3* (merge-conflict
   surface × review load × the b8x2v duration data now available to inform it).

2. **`research` — a default fan-out cap.** In `skills/research/SKILL.md`
   (Parallelism, line ~158) give the "spawn multiple researchers" guidance a
   **stated default ceiling** (e.g. cap concurrent researchers unless the user
   explicitly asks for more), matching the shape of `work`'s knob.

3. **Nested-spawn budget (documented worst case + mitigation, not an enforced
   count).** The conductor cannot *enforce* a nested-spawn ceiling — spawns
   inside a worker's own subagent context (worker → orchestrator → specialists)
   are invisible to and uncontrollable by the dispatching session, and the Agent
   tool exposes no nested-concurrency cap. So instead of a hard count, state the
   **worst-case fan-out budget** (≈ `MAX_PARALLEL × (1 orchestrator + up to 4
   specialists)`, plus re-dispatch), name the **low-`MAX_PARALLEL` default** as
   the lever that bounds it, and point at **prefer-direct-consultation
   (agentic-workflow-n6r8j)** as the structural shrink. Honest about
   non-enforceability — no invented mechanism.

## Acceptance criteria

- [ ] `skills/work/SKILL.md` documents `MAX_PARALLEL` as a **named, user-settable** knob (default 3) and carries a rationale for the default.
- [ ] `skills/research/SKILL.md` states a **default cap** on concurrent researchers, overridable by explicit user ask.
- [ ] A **worst-case nested fan-out budget** is written down (the `MAX_PARALLEL × (orchestrator + specialists)` math), with the low-`MAX_PARALLEL` default named as its bound and n6r8j named as the structural mitigation. It does **not** claim an enforced per-batch nested-spawn count the conductor cannot deliver.
- [ ] Any cap that **triggers** (a batch capped below the ready set, a research fan-out held back) is surfaced in the protocol **Batch-started** entry — silent truncation is not allowed. (The practice already exists — e.g. "k5p8w held to next wave" — this codifies it.)

## Notes

**Blocker cleared:** the duration/iteration observability this wanted first
(agentic-workflow-b8x2v) is **done** (2026-07-02) — cap values (esp. the *3*
rationale) can now be informed by real batch-duration data rather than invented.
So the prior "wants b8x2v first" gate no longer holds.

**Structural interaction:** flattening single-specialist consultations
(agentic-workflow-n6r8j) directly shrinks the chain the budget describes — it is
the *mitigation*, not a hard dependency (the budget can be documented whether or
not n6r8j lands). Sequence freely; if both are worked together the worst-case
math should be written *after* knowing whether n6r8j collapsed the middle hop.
Related cost work: model-pinning the agent fleet (agentic-workflow-j4m6r, done)
and worktree isolation (ADR-0032) share the "bound the parallel-worker cost"
theme.

**Refinement decisions defaulted while the builder was away (please ratify):**
1. **Scope — kept as one task.** All three surfaces are the same "bound +
   document + rationalize fan-out" concern in adjacent doctrine; splitting into
   three micro-edits adds DAG overhead for no gain. (Alternative: split per
   surface.)
2. **Spawn surface — documented worst-case budget + mitigation, not an enforced
   ceiling.** Reframed because the conductor genuinely cannot police spawns
   inside worker subagent contexts. (Alternatives considered: insist on a hard
   enforced ceiling via a budget threaded into the worker spawn prompt that the
   worker self-polices; or drop the third surface into n6r8j.) Left in
   `backlog/` rather than promoted so these two calls can be confirmed before a
   worker picks it up.
