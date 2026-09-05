---
id: agentic-workflow-swj2q
title: "`/agentheim:work <task-id>` — scope a work run to one named todo task instead of the whole ready set"
status: doing
type: feature
context: agentic-workflow
created: 2026-09-05
completed:
depends_on: []
blocks: [agentic-workflow-g4zce]
tags: [work, conductor, dispatch, skill-arguments, single-task]
related_adrs: [0032, 0038, 0026]
related_research: []
prior_art: [agentic-workflow-024]
---

## Why

Today `/agentheim:work` has exactly one shape: scan every `contexts/*/todo/`, build the
DAG, dispatch the whole ready set (capped at `MAX_PARALLEL`), and keep looping until
todo is empty. The only user-settable knobs the skill names are `MAX_PARALLEL` ("run 5
in parallel", "one at a time") and `--no-verify`. There is **no argument contract for a
task id** — `/agentheim:work agentic-workflow-xyz` is not refused, but nothing in
`skills/work/SKILL.md` binds it, so whether the conductor honours it is a heuristic of
the session, not a guarantee.

The builder wants to point at one todo card and say "work on *this* one" — for example
to ship a single small fix while two larger todo items wait, or to run one task in
isolation without the batch's merge-order ceremony. The dashboard's per-card Work button
(agentic-workflow-g4zce) needs a deterministic command to seed, which is why this task
blocks it.

## What

Give the `work` skill an explicit, documented argument grammar:

- `/agentheim:work` — unchanged: the whole ready set, loop until todo is empty.
- `/agentheim:work <task-id>` — a **scoped run**: the batch is exactly that task (if
  ready), the loop ends when that task is integrated (PASS/SKIP), bounced, failed, or
  escalated. Newly promoted todo tasks are **not** picked up mid-run — the scope is the
  named id, full stop.
- `/agentheim:work <id-1> <id-2> …` (space- or comma-separated) — the same, for a small
  explicit set; still capped by `MAX_PARALLEL`, still merge-ordered by the Phase 3
  advisory.
- `--no-verify` composes with all of the above exactly as today.

Everything else the conductor does is **unchanged** — this is a selection filter on
Phase 2/3/4, not a new execution path:

- Phase 1 recovery check runs first, as always. A stranded `doing/` task from an
  interrupted session is surfaced and resumed **before** the scoped task, per the
  existing rule (do not silently skip it because the builder named something else).
- Readiness is still fail-closed (ADR-0038 Ruling A). A named id whose `depends_on`
  is not fully in `done/` — or dangles — is **refused with the unmet ids named**, never
  force-dispatched. A named id that is not in any `todo/` (it's in backlog, doing,
  done, or doesn't exist) is refused with a one-line message that says where it
  actually is.
- Per-worker worktree isolation, the batch-start `claim` commit, the verifier gate,
  the squash-merge integration, `complete`, session-end bookkeeping and vision
  conformance all run exactly as for an unscoped run.

The "Batch started" protocol entry records that the run was scoped (e.g. in its
`Parallel:` line: `scoped — builder named agentic-workflow-xyz; 3 other ready tasks not
dispatched`), so a batch smaller than the ready set is never a silent truncation (the
existing "cap triggered — never truncate silently" rule).

## Acceptance criteria

- [ ] `skills/work/SKILL.md` documents the argument grammar (bare / one id / several
      ids / `--no-verify` composition) in one clearly headed section, and Phase 2–4
      reference it where selection happens.
- [ ] A scoped run dispatches **only** the named ready id(s); newly promoted todo tasks
      are not picked up during a scoped run, and the session ends after the named
      set is integrated/bounced/failed/escalated.
- [ ] A named id that is blocked (unmet or dangling `depends_on`) is refused before
      any file moves, with the unmet ids named — the `claim` verb is never invoked
      for it.
- [ ] A named id that is not in `todo/` is refused with a message naming its actual
      lifecycle folder (or "not found").
- [ ] The Phase 1 recovery check still runs and a stranded `doing/` task is still
      resumed first, even on a scoped run.
- [ ] The "Batch started" entry of a scoped run states that it was scoped and how
      many ready tasks were left undispatched.
- [ ] The id resolution accepts the exact id only — no fuzzy/keyword matching in
      `work` (that stays modeling's job); a malformed id is refused, not guessed.
- [ ] An ADR records the decision (an addendum to ADR-0032's batch model or a new
      ADR): the work loop's "until todo is empty" termination gains a second,
      builder-scoped termination; the DAG gate is never bypassed by naming a task.
- [ ] Any `lib/` doctrine-pointer tests that cover `skills/work/SKILL.md` section
      headings (`lib/test/doctrine-line-pointer.test.mjs` and friends) still pass;
      the full suite is green.
- [ ] `[human-eye]` The builder runs `/agentheim:work <one-todo-id>` with at least
      two ready tasks in todo and observes exactly one worker dispatched.

## Notes

- The same bootstrap that makes `claim <id-1>,<id-2>` a batch verb already takes an
  explicit id list — a scoped run is just the conductor handing `claim` the named ids
  instead of the DAG's full ready set. No `lib/` change is expected; if one turns out to
  be needed (e.g. a shared id-list parser), keep it stdlib-only and tested.
- Deliberately **not** in scope: fuzzy matching, "work on the next one", or a
  `--max-parallel` flag — the existing prose knob covers the latter.
- Dashboard side is agentic-workflow-g4zce (blocked on this).
