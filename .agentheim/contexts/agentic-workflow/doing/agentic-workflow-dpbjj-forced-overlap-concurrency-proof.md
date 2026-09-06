---
id: agentic-workflow-dpbjj
title: Force overlap in pt0gy's two-process concurrency proof — a child-side hold inside the locked section so the lost-update assertion cannot pass by luck
status: doing
type: chore
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-pt0gy]
blocks: []
tags: [concurrency, bookkeeping, lifecycle-cli, testing, falsifiability]
related_adrs: [0038, 0054, 0061, 0062, 0073]
related_research: []
prior_art: [agentic-workflow-e4bjh, agentic-workflow-k5n8f, agentic-workflow-wq7fn]
---

## Why

`agentic-workflow-pt0gy`'s first acceptance criterion proves the lifecycle lock by
`child_process.spawn`ing two real `capture` calls into one BC concurrently and asserting
what an unlocked run would get wrong: a `**Backlog:**` count of 1 instead of 2 and one
INDEX line missing. That assertion is only falsifiable if the two processes' read→compute→write
spans actually overlap. Two Node processes started back to back each spend tens of
milliseconds booting and a few milliseconds inside the writer; on most runs the second has
not even resolved its root by the time the first has written and exited. Then the test
passes **with no lock at all** — a green that proves nothing (ADR-0061's falsifiability bar,
ADR-0062's runner-first verdicts). Pinned at pt0gy's refinement by the second architect +
tactical-modeler round on 2026-09-06.

## What

Give the locked critical section an injectable hold, and make the concurrency test assert
that serialization *happened*, not merely that the final state is right:

1. **Hold point.** Inside `lib/lifecycle-lock.mjs`'s held section — after the caller's read
   phase, before its write phase — honour a test-only hold. Shape to decide in-task, two
   candidates: an environment variable (e.g. `AGENTHEIM_TEST_HOLD_MS`) read once by the lock
   module, which crosses the spawn boundary for free; or a JSON opt on the CLI's third argv
   (`{"_holdMs": N}`) forwarded to the writer. Either way the hold is **absent → zero** and
   documented as test-only in the module's doc comment; decide whether to additionally gate
   it (e.g. ignore unless `NODE_TEST_CONTEXT` is set) so a production caller can never
   stall a verb by accident.
2. **The proof.** With hold `H` (≈300 ms) set for both children and both spawned within a
   few milliseconds of each other:
   - both exit 0 with `{ok:true}`; both ids sit in the `backlog-list` block; the `**Backlog:**`
     count equals `readdirSync(backlogDir).length`; the `protocol.md` `## ` heading count rose
     by exactly 2 (pt0gy's existing assertions, unchanged);
   - **wall-clock from first spawn to last exit ≥ 2·H** — the second child provably waited
     for the first's release; a fake or missing lock finishes in ≈ H and fails this line;
   - the lock file is gone afterwards.
3. **Negative control, decided in-task.** Whether to ship a mutation-style check that runs
   the same harness with the lock disabled and asserts the count *does* read 1. Lean: no —
   a disable switch in production code is a footgun; the `≥ 2·H` timing assertion already
   discriminates. Record the disposition in the task's Outcome either way.

Out of scope: any change to the lock's acquire/wait/reap policy, the verbs' argv shapes, or
pt0gy's other criteria. This task edits `lib/lifecycle-lock.mjs` (hold point only) and the
concurrency test pt0gy ships, nothing else.

## Acceptance criteria

- [ ] `lib/lifecycle-lock.mjs` honours a documented, test-only hold inside the held section (absent → no delay), reachable from a spawned CLI child; the module's doc comment names it as test-only and states the gate chosen (or that none is needed, with the reason).
- [ ] The two-process `capture` test sets the hold to a fixed `H` for both children and asserts, in addition to pt0gy's state assertions, that first-spawn→last-exit wall-clock is ≥ 2·H, and that the lock file no longer exists afterwards. `node --test` green on the merged tree (ADR-0062).
- [ ] Demonstrated falsifiability, recorded in the task's Outcome: the test run once with the lock acquisition stubbed to a no-op (a local, uncommitted edit) fails on the count or the timing line — the exact failing assertion is quoted.
- [ ] The negative-control disposition (ship a lock-disabled mutation check, or rely on the timing assertion) is stated in the Outcome with its reason; no production disable switch ships unless that disposition says so.
- [ ] No existing test or writer function becomes `async`; the hold is synchronous like the lock's waiter.

## Notes

Surfaced as an additive gap to `agentic-workflow-pt0gy`'s todo text by a second orchestrator
round (architect + tactical-modeler) on 2026-09-06 and captured on the builder's request.
Depends on pt0gy because the lock module and the spawn harness it hardens do not exist yet;
a worker should pick this up immediately after pt0gy integrates, before the harness's
false-green habit sets in.

The tactical-modeler's alternative — a deterministic in-process interleave via an injectable
`fs` or `node:test`'s `mock.method` as the primary proof, with the spawn test secondary — was
weighed against pt0gy's own fixture note ("one interpreter would pass with no lock at all").
The hold keeps pt0gy's real-process shape and makes it deterministic; it is the smaller change.
