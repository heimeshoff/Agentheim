---
id: agentic-workflow-pzacx
title: Consumer-tune the two session reconciliations — fold recognized machine shapes into a summary, batch non-.agentheim carry-over
status: done
type: refactor
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: [agentic-workflow-bx01e]
tags: [audit-2026-07-22-followup, overshoot-tuning, session-start-churn, carry-over]
related_adrs: [0066, 0026]
related_research: []
prior_art: [agentic-workflow-c5nvb, agentic-workflow-hhjjx, agentic-workflow-d6q4h]
---

## Why

Both session reconciliations were tuned for this self-hosted repo, where machine commits
dominate — and their recall-over-precision defaults invert in a consumer repo:

1. **Session-start churn (ADR-0066)** flags every untrailed commit. A solo builder who
   commits by hand constantly gets most commits flagged, every session, each needing a
   governed-surface judgment skim. ADR-0066 itself names the revisit ("special-case the
   known machine shapes … revisit if the false-positive rate proves annoying") — and the
   condition is arguably met: keeping the known-shapes prose in sync has already cost two
   fix-tasks in one week (d7ksw, c5nvb).
2. **Session-end carry-over reconciliation** interrogates per file ("ask the user per
   file… Do not batch"). A consumer's working tree routinely carries their own WIP; the
   safe answer is always "leave behind," asked N times per session.

Additionally (same surface, found by the same audit): every known-machine-shapes
enumeration omits `modeling` CONSOLIDATE, which `references/commit-doctrine.md:40` itself
defines as trailer-less — so a CONSOLIDATE commit reads as human churn.

## What

1. **Churn:** recognize the known machine shapes from `references/commit-doctrine.md`'s
   tables (including CONSOLIDATE) deterministically in `lib/session-start-churn.mjs`
   (`node --test` covered), and have `work`'s churn step print one summary line — "N
   recognized machine-shape commits, M human commits" — itemizing only the
   governed-surface hits. The advisory stays advisory; recall on genuinely human commits
   is unchanged.
2. **Carry-over:** ask per-file only for `.agentheim/`-owned paths; batch everything else
   into a single "left behind (user WIP, N files)" disposition line.
3. Amend ADR-0066 (its own named revisit) and align the enumerations at
   `skills/work/SKILL.md:42` and the `lib/session-start-churn.mjs` header comment with the
   table.

## Acceptance criteria

- [x] `lib/session-start-churn.mjs` recognizes all commit-doctrine machine shapes incl.
      CONSOLIDATE, with `node --test` coverage for each shape.
- [x] `skills/work/SKILL.md`'s churn step prints the summary line and itemizes only
      governed-surface hits.
- [x] The carry-over step's per-file prompt is scoped to `.agentheim/` paths; non-.agentheim
      files get one batched disposition line.
- [x] ADR-0066 is amended recording the tuning.

## Notes

Flagged by the 2026-07-22 overshoot review (candidate #2) and the consistency audit
(finding #4, the CONSOLIDATE omission).

## Outcome

Added `recognizeMachineShape` / `partitionUntrailedCommits` / `formatChurnSummaryLine` to
`lib/session-start-churn.mjs` — a closed, deterministic pattern set matching
`references/commit-doctrine.md`'s complete known-shapes table: the four trailer-less rows of
its "Message convention" table (`modeling` DISMISS, `modeling` CONSOLIDATE — the audit-found gap
every prior enumeration omitted — `brainstorm`'s session commit, and `research`'s
report-cleared-review commit, both its BC-scoped and global forms), plus `work`'s own four bare
fallback shapes from its second table: reconcile stranded carry-over, session-end bookkeeping,
protocol rotation, INDEX done-list rotation — eight shapes total. 17 new `node --test` cases
cover every shape (including both `research` forms) plus the partition/summary helpers.
`skills/work/SKILL.md`'s session-start churn step now prints one summary line ("N recognized
machine-shape commits, M human commits") and itemizes only the governed-surface hits its
existing judgment step finds (unchanged there) — replacing full per-commit itemization.
`references/lib-bootstrap.md`'s §2 step 3 bootstrap one-liner updated to call the new
partition/summary functions and emit each untrailed commit's recognized `shape` in its JSON
payload.

Session-end carry-over (`skills/work/SKILL.md`'s "Reconciling stranded carry-over" section) now
partitions stranded working-tree files by ownership before surfacing: `.agentheim/`-owned paths
keep the full per-file ask (commit deliberately / leave with a named owner); everything else
batches into one `left behind (user WIP, N files)` line with no per-file interrogation and no
commit offered.

Amended ADR-0066 (its own named revisit) recording the mechanization and pointing at the
carry-over tuning (recorded there and in the BC README rather than as a second ADR, since that
mechanism's decision of record is `agentic-workflow-d6q4h`'s task file / ADR-0026, not a
standalone ADR). Updated the BC README's committing-doctrine, session-start-churn, and
carry-over bullets to match.

**Iteration-2 fix (verifier catch):** iteration 1's `MACHINE_SHAPES` omitted the `research`
trailer-less shape (`chore(<bc-or-global>): research <slug>` / `chore: research <slug>`), which
`references/commit-doctrine.md` had gained mid-session (agentic-workflow-n3bbk) just before this
task's worktree was cut from a slightly-earlier base — the exact false-positive class this task
exists to close. Fixed by adding a `research` entry to `MACHINE_SHAPES` (matching both the
BC-scoped and global forms), adding two `node --test` cases for it, re-auditing the completeness
claim against every trailer-less row of BOTH `commit-doctrine.md` tables (now documented
explicitly in the module's header comment as "eight entries total"), and correcting the
"authoritative, complete list" language in `lib/session-start-churn.mjs`'s header comment,
`skills/work/SKILL.md`'s churn step, ADR-0066's amendment section, and the BC README's
session-start-churn bullet to name all eight shapes instead of seven. `node --test
lib/test/*.test.mjs`: 351 passed, 0 failed (up from 349 pre-fix / 334 pre-task; 2 new tests this
iteration, no regressions).

Key files:
- `lib/session-start-churn.mjs` — new exports + header-comment amendment/completeness notes,
  `research` shape added.
- `lib/test/session-start-churn.test.mjs` — 17 new tests total (2 added this iteration for
  `research`).
- `skills/work/SKILL.md` — churn step (steps 3/5) and carry-over section (steps 2-6) rewritten;
  step 3's shape enumeration corrected to eight entries.
- `references/lib-bootstrap.md` — §2 step 3 bootstrap script updated.
- `.agentheim/knowledge/decisions/0066-session-start-human-churn-reconciliation.md` — amended,
  plus an iteration-2 correction note recording the `research` gap and fix.
- `.agentheim/contexts/agentic-workflow/README.md` — committing-doctrine, session-start-churn
  (corrected to eight shapes across both commit-doctrine tables), and carry-over bullets updated.

## Verifier note (iteration 1)

**Verdict:** FAIL — likely-fixable.

**Reasons:**
- Acceptance criterion 1 ("recognizes ALL commit-doctrine machine shapes ... cross-check against `references/commit-doctrine.md`'s tables that the shape set is complete") is NOT met. `MACHINE_SHAPES` in `lib/session-start-churn.mjs` omits the `research` trailer-less machine shape defined at `references/commit-doctrine.md:44` — `chore(<bc-or-global>): research <slug>` (and its global `chore: research <slug>` form), which carries no `[<task-id>]` trailer. A cleared-review research commit would be mis-counted as a human commit by `partitionUntrailedCommits` — the exact false-positive class this task exists to close (mirroring the CONSOLIDATE gap it does fix). NOTE: the `research` row was added to `commit-doctrine.md` earlier THIS session by agentic-workflow-n3bbk, so it is present on your worktree base.
- No `node --test` case covers a `research` commit in `lib/test/session-start-churn.test.mjs` (tests exist only for DISMISS, CONSOLIDATE, brainstorm, and the four bare fallbacks), so "coverage for each shape" is unmet for this shape.
- The header comment in `lib/session-start-churn.mjs` and `skills/work/SKILL.md`'s churn step both claim the pattern set mirrors commit-doctrine.md's table "exactly" / is the "authoritative, complete list" — an overclaim while `research` is absent.

**Suggested fix:** Add a `research` entry to `MACHINE_SHAPES` matching both `chore(<bc>): research <slug>` and the global `chore: research <slug>` forms; add a `node --test` case for each; and re-check the completeness claim in the header comment and SKILL.md step 3 against EVERY trailer-less row of commit-doctrine.md's two tables (DISMISS, CONSOLIDATE, brainstorm, research, plus work's four bare fallbacks) so no shape is missed again.

**Iteration hint:** likely-fixable.
