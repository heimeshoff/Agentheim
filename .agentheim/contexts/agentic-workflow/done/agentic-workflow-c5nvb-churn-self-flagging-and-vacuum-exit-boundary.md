---
id: agentic-workflow-c5nvb
title: Session-start churn re-flags work's own trailer-less fallback commits; vacuum-guard exits leave no session-end boundary
status: done
type: bug
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: []
tags: [dorc-audit-followup, session-start-churn, vacuum-guard]
related_adrs: [0066, 0064, 0026]
related_research: []
prior_art: [agentic-workflow-hhjjx, agentic-workflow-qz1h7]
---

## Why

Two compounding gaps in the new session-start reconciliation:

1. `skills/work/SKILL.md:42` names only `modeling` DISMISS and brainstorm as known
   trailer-less machine commit shapes — but work itself mints trailer-less commits when a
   session completes no task: `chore: work session end bookkeeping`, `chore: rotate
   protocol — …`, `chore: rotate INDEX done-list — …` (:539, :605-607, :666-668). These
   get flagged as "human churn" at the next session start.
2. A vacuum-guard exit (:64) skips the session-end protocol entry entirely, so
   `resolveSinceLastSessionEnd`'s window reaches back past such sessions — the same
   untrailed commits get re-flagged every subsequent session until a real session-end
   entry lands.

Together: an idle-ish period (exactly when the vacuum guard fires) generates recurring
false churn noise, eroding trust in the advisory that exists to catch real human churn.

## What

1. Add work's own fallback commit shapes to the known-machine-shapes list in the churn
   step (and keep the list adjacent to where those shapes are defined, or point at
   `references/commit-doctrine.md` once it lists them — see agentic-workflow-d7ksw for the
   commit-doctrine table gap).
2. On a vacuum-guard exit, write a minimal session-end protocol entry (type Work / Session
   end, zero tasks, one line noting the vacuum exit) so the churn window has a boundary.
   Keep it cheap — no batch-mix line for an empty batch unless trivial to include.

## Acceptance criteria

- [x] The churn step's known-shapes list covers every trailer-less commit message work itself can mint (session-end bookkeeping, both rotations, batch-start is trailered — verify which shapes actually lack trailers and cover exactly those).
- [x] A vacuum-guard exit writes a session-end protocol entry that `resolveSinceLastSessionEnd` resolves (unit-testable against `lib/session-start-churn.mjs`'s heading regex).
- [x] A test in `lib/test/session-start-churn.test.mjs` covers a work-minted fallback shape not being classified as human churn, if the classification moves into the lib; if it stays conductor prose, the skill text enumerates the shapes verbatim.
- [x] `node --test lib/test/*.test.mjs` green.

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (finding L5). The fix touches
`skills/work/SKILL.md` (churn step + vacuum-exit step) and possibly
`lib/session-start-churn.mjs`.

## Outcome

Verified which of `work`'s own fallback commit shapes are actually trailer-less: batch-start
and BOUNCE-integration always carry a `[<task-id>]` trailer; session-end bookkeeping and both
rotation commits (`chore(agentic-workflow): rotate protocol — ...`, `chore(agentic-workflow):
rotate INDEX done-list — ...`) fall back to a bare `chore: ...` (no trailer) only when the
session completed no task. `references/commit-doctrine.md`'s "`work`'s own non-task-commit
shapes" table (already populated this session by sibling task agentic-workflow-d7ksw) already
enumerates exactly those bare shapes, so gap 1 was closed by **pointing** the churn step's
known-machine-shapes list at that table (plus naming the shapes inline) rather than duplicating
the enumeration — kept the classification prose-only per ADR-0066's deliberate
recall-over-precision stance, no `lib/` change needed for this half.

Gap 2 (vacuum-guard exit boundary): the vacuum-guard branch of `work`'s Phase 2 step 8 now
writes a minimal `## YYYY-MM-DD HH:MM -- Work session ended` protocol entry (`Type: Work /
Session end`, `Completed: 0`, one line noting the vacuum exit) before stopping the run, committed
via the same bare `chore: work session end bookkeeping` fallback convention step 8 already uses
when no task ran — no batch-mix line, vision-conformance pass, or carry-over reconciliation for
this minimal entry, keeping it cheap as the task asked. Added a regression test in
`lib/test/session-start-churn.test.mjs` proving `resolveSinceLastSessionEnd` resolves this
minimal shape's heading identically to a full session-end entry — the boundary works even with
almost no body underneath it.

Updated the BC README's vacuum-guard and session-start-churn bullets to document both changes as
new invariants. `node --test lib/test/*.test.mjs`: 334 passed, 0 failed.

Key files:
- `skills/work/SKILL.md` — churn step's known-shapes list (gap 1), Phase 2 step 8 vacuum-guard
  branch (gap 2).
- `lib/test/session-start-churn.test.mjs` — new regression test for the minimal entry heading.
- `.agentheim/contexts/agentic-workflow/README.md` — two bullets updated.

## Verifier note (iteration 1)

REASONS:
- Criterion 1 not fully met. The churn step's inline known-shapes enumeration (skills/work/SKILL.md line 42 / step 3) covers only 3 of work's 4 trailer-less-capable fallback shapes. It omits the reconcile-stranded carry-over shape — `chore: reconcile stranded <short-desc>`, minted trailer-less when no task ran (skills/work/SKILL.md carry-over reconciliation section; references/commit-doctrine.md's "work's own non-task-commit shapes" table lists it). The criterion required covering "every trailer-less commit message work itself can mint ... cover exactly those."
- The inline list is written as a closed accounting: it explicitly includes session-end bookkeeping + both rotations and explicitly excludes batch-start/BOUNCE as trailered, yet never mentions reconcile-stranded — creating an internal inconsistency with the commit-doctrine.md table it points to, which does list reconcile-stranded's trailer-less form. A reader trusting the inline enumeration would mis-flag a reconcile-stranded commit as human churn — precisely the false-positive this task exists to remove.

SUGGESTED_FIX: Add the reconcile-stranded fallback shape (`chore: reconcile stranded <short-desc>`, trailer-less when no task ran) to the churn step's inline known-shapes list in skills/work/SKILL.md, OR reword the inline enumeration to be explicitly non-exhaustive and defer wholly to commit-doctrine.md's table for the complete set. Ensure the same accuracy in the BC README ubiquitous-language entry if it repeats the enumeration.

ITERATION_HINT: likely-fixable

## Iteration 2 correction

Verified the verifier's claim: `references/commit-doctrine.md`'s "`work`'s own non-task-commit
shapes" table does list "Reconcile stranded carry-over (session-end, per orphaned file/set)" —
`chore: reconcile stranded <short-desc>` trailer-less when no task ran this session — alongside
session-end bookkeeping and both rotations. The churn step's inline enumeration in
`skills/work/SKILL.md` (step 3) named only three of the four trailer-less-capable shapes,
omitting reconcile-stranded, which is an internal inconsistency with the very table it points
at. Fixed by adding the reconcile-stranded shape to the inline list in both `skills/work/SKILL.md`
and the BC README's matching bullet, and rewording both to explicitly flag
`references/commit-doctrine.md`'s table as the authoritative, complete set rather than
implying the inline prose is itself exhaustive — so future additions to that table can't
silently drift out of sync with this prose again. `node --test lib/test/*.test.mjs`: 334
passed, 0 failed.
