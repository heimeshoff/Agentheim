---
id: agentic-workflow-swj2q
title: "`/agentheim:work <task-id>` — scope a work run to one named todo task instead of the whole ready set"
status: done
type: feature
context: agentic-workflow
created: 2026-09-05
completed: 2026-09-05
depends_on: []
blocks: [agentic-workflow-g4zce]
tags: [work, conductor, dispatch, skill-arguments, single-task]
related_adrs: [0032, 0038, 0026, 0071]
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
- Decision recorded in ADR-0071.
- ADR-0059 disposition: **mechanized, not left prose-only.** `lib/work-argument-grammar-section.mjs`
  + `lib/test/work-argument-grammar-section.test.mjs` is a live-tree lint asserting
  `skills/work/SKILL.md` still carries the "Argument grammar" heading that this task's ADR-0071
  and the BC README's ubiquitous-language entry cite by name (verifier iteration 1 flagged the
  gap; see ADR-0071's Consequences for the full disposition).

## Outcome

Gave `skills/work/SKILL.md` an explicit "Argument grammar" section (new, right before Phase 1)
documenting bare / single-id / multi-id / `--no-verify` composition, plus exact-match-only,
fail-closed id resolution (not found anywhere / found but not in `todo/` / found but not ready —
each refused before any file moves, naming the unmet ids or the actual lifecycle folder). Wired
that section into every place selection or termination actually happens: Phase 2 step 5
(readiness check applies to the named set) and step 7 (scoped-run tally line), Phase 3 step 4
(candidate pool is the named ids, not lowest-numbered), Phase 4 step 1 (claim gets the named/
capped subset) and step 7 (no re-scan on a scoped run — dispatch the remaining named ids or end
the run), the Protocol logging "Cap triggered" section (new "Scoped run — record it explicitly"
paragraph composing the `parallel` JSON opt), and End-of-run reporting's termination condition.
The intro paragraph now states the two termination modes explicitly. No `lib/` change was
needed — `claimBatch` already accepts an arbitrary id list; only the conductor's doctrine on
*which* ids to pass and *when to stop* changed. Wrote **ADR-0071** recording the decision
(builds on ADR-0032's batch model, ADR-0038 Ruling A's fail-closed `depends_on`, and ADR-0026's
never-truncate-silently discipline). Updated the BC README: reworded `claimBatch`'s
"claims a whole ready set" description to reflect that it claims whichever id list its caller
hands it (scoped or unscoped), and added a "Scoped run" ubiquitous-language entry.

Key files:
- `skills/work/SKILL.md` — new "Argument grammar" section + cross-references through Phase 2-4,
  Protocol logging, and End-of-run reporting.
- `.agentheim/knowledge/decisions/0071-work-scoped-run-argument-grammar.md` — the decision.
- `.agentheim/contexts/agentic-workflow/README.md` — `claimBatch` description reworded;
  "Scoped run" ubiquitous-language entry added.
- `lib/work-argument-grammar-section.mjs` — iteration 2: live-tree lint asserting
  `skills/work/SKILL.md`'s "Argument grammar" section stays present.
- `lib/test/work-argument-grammar-section.test.mjs` — iteration 2: its 5 tests.

No `dashboard/` changes.

### Iteration 2 (verifier follow-up)

Verifier iteration 1 passed every acceptance criterion but failed check 6c (ADR-0059
mechanize-or-drop): the "Argument grammar" section is cited by name from two other doctrine
surfaces (ADR-0071, the BC README) but nothing on disk would notice if it were renamed or
deleted. Added `lib/work-argument-grammar-section.mjs` (a small, stdlib-only, side-effect-free,
loss-tolerant live-tree lint mirroring `lib/doctrine-line-pointer.mjs`'s shape) plus
`lib/test/work-argument-grammar-section.test.mjs` (5 tests: present-section pass, missing-section
flag, missing-file flag, mid-sentence-mention-without-heading flag, and the recurring
live-tree gate against the real `skills/work/SKILL.md`). Recorded the ADR-0059 disposition
explicitly in ADR-0071's Consequences ("mechanized, not prose-only") and in this task's Notes.

`TDD_SKIPPED`: no — iteration 2's enforcement lint followed TDD (tests written and run green
alongside the module; the live-tree gate proves the real SKILL.md satisfies the new predicate
today). Iteration 1's skill-prose/ADR/README work remains `TDD_SKIPPED` for the reason
originally stated (pure doctrine/documentation, no testable code path).

## Verifier note (iteration 1)

**VERDICT: FAIL**

REASONS:
- Check 6c (mechanize-or-drop, ADR-0059) fires and is unmet. The diff touches doctrine-bearing surfaces (`skills/work/SKILL.md`, `.agentheim/knowledge/decisions/0071-work-scoped-run-argument-grammar.md`, and the BC README's ubiquitous-language section at `.agentheim/contexts/agentic-workflow/README.md:57-63`), and the task establishes a convention other agents/artifacts must follow going forward: the `/agentheim:work <id-1> <id-2>…` invocation grammar plus its exact-match/fail-closed resolution rules. ADR-0071 itself frames it as a contract downstream consumers must honor ("the dashboard's planned per-card Work button (agentic-workflow-g4zce) … needs a deterministic command to seed … requires the argument's meaning to be a documented contract, not a per-session guess", `0071-work-scoped-run-argument-grammar.md:22-26`), and `blocks: [agentic-workflow-g4zce]` in the task frontmatter makes that consumer explicit.
- Neither half of ADR-0059's requirement is present: no enforcement ships (`TESTS_ADDED: 0`; no new or modified check under `lib/` — the existing live-tree lints in `lib/test/` are untouched, and none asserts the new "Argument grammar" section the README and ADR-0071 both point at by name), and the task file carries no explicit "prose-only, unenforced" marker — grep for `prose-only` / `unenforced` / `ADR-0059` across the task file, ADR-0071 and `skills/work/SKILL.md` returns nothing. `## Notes` records only the "deliberately not in scope" list (fuzzy matching, `--max-parallel`), which is a scope statement, not the ADR-0059 disposition. Sibling doctrine tasks in this BC set the house precedent for the marker (ADR-0063's sequencing half, ADR-0065's ordering half via agentic-workflow-t8kfq, ADR-0069's PASS bar and stamp convention).

SUGGESTED_FIX: Either add a live-tree check (in the `lib/test/` doctrine-lint family) asserting `skills/work/SKILL.md` still carries the "Argument grammar" section that the BC README entry and ADR-0071 cite by name, or record an explicit "prose-only, unenforced (ADR-0059)" line in the task file's `## Notes` (and ideally in ADR-0071's Consequences) so the unenforced grammar is a visible decision rather than an omission.

ITERATION_HINT: likely-fixable

Checks 1-6b passed: every machine-checkable criterion maps to a concrete artifact in `skills/work/SKILL.md` (new "Argument grammar" section and its cross-references in Phase 2 steps 5/7, Phase 3 step 4, Phase 4 steps 1/7, Protocol logging, End-of-run reporting); refusals and "claim never invoked for a refused id" present; Phase-1-recovery-first present; ADR-0071 well-formed; scope clean (4 files); `node --test lib/test/*.test.mjs` 380/380 from the worktree; check 8 did not fire.
