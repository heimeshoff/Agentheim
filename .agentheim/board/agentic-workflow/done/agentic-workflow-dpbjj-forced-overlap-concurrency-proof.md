---
id: agentic-workflow-dpbjj
title: Force overlap in pt0gy's two-process concurrency proof — a child-side hold inside the locked section so the lost-update assertion cannot pass by luck
status: done
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

## Outcome

Gave `withLifecycleLock` (lib/lifecycle-lock.mjs) a documented, test-only, synchronous hold and used it to force real overlap in pt0gy's two-process `capture` concurrency proof (lib/test/task-lifecycle-cli-mechanics.test.mjs), rather than relying on incidental process-startup timing.

**Hold shape chosen: JSON opt, not an env var.** Every `'id'`-arity verb (capture, dismiss, promote, complete, checkpoint, claim) already threads its third CLI argv's `opts.lock` sub-object straight into `withLifecycleLock`'s own `opts` unchanged (e.g. `captureTask`: `withLifecycleLock(rootDir, () => captureTaskLocked(...), opts.lock)`). Adding `opts.holdMs`, read inside `withLifecycleLock` itself, means `{"lock":{"holdMs":300}}` on the existing third argv reaches the lock module for free — no new cross-process channel, no argv shape change, and (per the task's own scope line) zero edits to any of the four writer files. Absent/falsy `holdMs` is a no-op, so all six other verbs keep zero-delay behaviour.

**Placement:** after the lock is successfully acquired, before `fn()` runs, inside the `try` (so it still counts as "held" and the hold time is still covered by the `finally`'s release). `withLifecycleLock` never sees inside its `fn` — it's an opaque read-then-write closure owned by the writer file, which is out of this task's scope — so the hold brackets the *entire* critical section from the lock module's perspective rather than sitting precisely between the writer's own read and write phases. For this proof that's equivalent: it still forces the second spawned process to wait out the first's whole hold before it can even begin its own read.

**Gate chosen: `process.env.NODE_TEST_CONTEXT`.** Verified empirically (two probe tests, since discarded) that `node --test` sets this env var on itself, and a plain `child_process.spawn(process.execPath, [...])` with no `env` override inherits it into the grandchild CLI process — so the harness's spawned `capture` children see the gate satisfied automatically, with zero test-harness plumbing. A stray `holdMs` key surviving into a real user's invocation would otherwise silently stall production capture/dismiss/promote calls (unlike the two pre-existing overrides `waitIntervalMs`/`timeoutMs`, which only change how long an *already-contended* wait takes, never whether an uncontended call stalls) — the gate makes that impossible outside `node --test`. Rationale recorded in the module doc comment and the `withLifecycleLock` JSDoc.

**Test hardening:** the concurrency test now sets `H = 300`ms via `lock: { holdMs: H }` on both spawned children's third argv, records `firstSpawn`/`lastExit` around `Promise.all`, and asserts (in addition to pt0gy's existing count/heading assertions, unchanged) `lastExit - firstSpawn >= 2 * H` and `existsSync(lifecycleLockPath(root)) === false`. Real run: the test passed with wall clock 786.9ms (comfortably ≥ 600ms).

**Falsifiability demonstrated** (local, uncommitted stub, then reverted — final worktree carries the real `acquireLifecycleLock`): replaced `acquireLifecycleLock`'s body with an unconditional `return { ok: true, release: () => {} };` (a no-op lock), re-ran only this test. It failed on the new timing assertion, not the count assertion (the count/heading assertions passed "by luck" this run — exactly the false-green failure mode this task exists to close):
```
AssertionError [ERR_ASSERTION]: first-spawn-to-last-exit wall clock must be >= 2*H (600ms) -- serialization must have happened, got 384ms
    at TestContext.<anonymous> (.../task-lifecycle-cli-mechanics.test.mjs:542:12)
```
The stub was then reverted by re-editing `acquireLifecycleLock` back to its real body (not `git checkout`, since that would also discard this task's own real edits to the file); a full `node --test lib/test/*.test.mjs` re-run afterward confirmed 542/542 passing with the real lock restored.

**Negative-control disposition:** no production disable switch ships. The task leans against a lock-disabled mutation-style check, and this run confirms why the timing assertion alone is the right discriminator: the count-based assertion passed even with the lock fully stubbed out (a false green), while `>= 2*H` failed decisively. A disable switch in production code would be a footgun for no added coverage the timing assertion doesn't already provide.

No writer function became `async`; the hold uses the module's existing synchronous `sleepSync` (the same `Atomics.wait`-based primitive the waiter already uses).

Files touched: `lib/lifecycle-lock.mjs` (module doc comment + `withLifecycleLock`'s hold, JSDoc), `lib/test/task-lifecycle-cli-mechanics.test.mjs` (concurrency test hardened, `lifecycleLockPath` import added). `node --test lib/test/*.test.mjs`: 542 tests, 542 pass, 0 fail (unchanged count from batch start — no new `test()` block, only added assertions to the existing one, per the task's scope).
