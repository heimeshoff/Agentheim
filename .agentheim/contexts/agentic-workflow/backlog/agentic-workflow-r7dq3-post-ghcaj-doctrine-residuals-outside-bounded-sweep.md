---
id: agentic-workflow-r7dq3
title: Post-ghcaj doctrine residuals the bounded sweep's closure rule set aside — five stale passages in verifier.md, work SKILL.md rung 2, commit-doctrine.md, verification-before-completion SKILL.md, and the modeling field legend
status: backlog
type: chore
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: []
blocks: []
tags: [captured, doctrine, post-ghcaj, sweep, follow-up]
related_adrs: [0074, 0073, 0072, 0057, 0059]
related_research: []
prior_art: [agentic-workflow-ghcaj]
---

## Why

agentic-workflow-ghcaj (ADR-0074) landed on 2026-09-06 under a **bounded** doctrine-consistency
sweep: an enumerated surface list, a five-clause definition of a residual pre-ghcaj statement,
and a closure rule — "a residual statement found outside the list is not a FAIL for this task:
the verifier names it in its verdict, and the conductor captures it as a follow-up backlog item."
The iteration-6 verifier PASSed and named five passages that are stale post-ghcaj but fall
outside the five-clause bar (or, in one case, outside the list). This task is that capture.
None of them contradicts the mechanized helpers; all are prose-only (ADR-0059).

## What

Amend each passage so it reads post-ghcaj (the worker reports; the conductor materializes on
`main`; the checkpoint guard refuses two families), in the same "Post-ghcaj (agentic-workflow-ghcaj)"
or plain-rewrite shape ghcaj used. All five were re-verified present at `feaa8d3` (main,
2026-09-06, the 01:55 refinement session's follow-up) — line numbers below are from that commit
and will drift; match on the quoted phrases. Each item names the **target wording** the fix
should agree with, so the worker does not re-derive it.

1. `agents/verifier.md` line 53 — check 1's TDD-skip artifact list still says "ADR file for a
   `decision` task; … the README diff for documentation tasks", contradicting the same file's
   rewritten check 5 (line 155: "There is no README diff to read anymore") and check 6 (line 164:
   "There is no ADR file on disk yet"). **Target:** point the skip-artifact list at the parsed
   `adrs` block (one `body` per `ADRS_WRITTEN` filename) for a `decision` task and the parsed
   `readmeDelta` block for documentation tasks; the config-task item ("integration config + a boot
   check") is unaffected and stays.
2. `skills/work/SKILL.md` line 341 (ADR-0072 ladder, rung 2) — "every tracked path the checkpoint
   guard refuses (today: `dashboard/dist/**`, ADR-0057)". **Target:** the guard refuses two
   families, as the same file's checkpoint paragraph (line 173) already states: `derived-artifact`
   (`dashboard/dist/**`, ADR-0057/ADR-0003) and `bookkeeping-path` (any `.agentheim/` path,
   ADR-0074). Rung 2's `git checkout -- <path>` instruction applies to both families; the parallel
   "today:" phrase in the BC README was amended by ghcaj, this one was not.
3. `references/commit-doctrine.md` line 55 — the "`work`'s own non-task-commit shapes" table still
   labels the BOUNCE row "BOUNCE integration (verifier-free squash-merge)". **Target:** the
   section heading at `skills/work/SKILL.md` line 207, "BOUNCE integration (ADR-0037, no longer
   squash-merges since agentic-workflow-ghcaj)" — the bounce is now a conductor-only `doing →
   backlog` move on `main` plus the `## Worker note`; the commit message shape in the row's right
   column (`chore(<bc>): task bounced — <title> [<task-id>]`) is unchanged. Also re-read the
   sentence at line 61 that refers back to "the BOUNCE-integration shape" — it stays true (the
   shape still carries the bracketed id) but confirm it does not repeat "squash-merge".
4. `skills/verification-before-completion/SKILL.md` line 56 — the `VERDICT: PASS` paragraph's
   abbreviated integration sequence ("squash-merge the worktree branch, run the mechanized COMPLETE
   script, then `git add` …") predates steps (a), (b), (c), (e) and (f) of the ADR-0074 integration
   order. **Target:** the same file's own PASS bullet under "What `work` does with each verdict"
   (line 92) already states the full order correctly — README delta(s), ADR(s) +
   `finalizeAdrNumbering`, the `## Outcome` append, the real `doing → done` move, any new backlog
   items, one commit. Make the short form agree with that bullet (a one-line pointer to it is
   acceptable); keep the paragraph's load-bearing clause that it never stages the raw `FILE_LIST`,
   only the `complete` manifest's `changed` subset (ADR-0057).
5. `skills/modeling/SKILL.md` line 300 (outside ghcaj's list, which narrowed this surface to the
   `completed` line) — "`blocks` is populated automatically by worker / refine". **Target:** post-
   ghcaj the worker writes no task-file frontmatter at all, so "worker" is wrong; and `blocks` is
   not mirrored from `depends_on` by any mechanized helper either (ADR-0073: "`blocks` and
   `depends_on` are not mirrored"; the only lib code touching the field is DISMISS's backlink
   strip). The conductor's integration step (f) maintains ADR↔task backlinks only, not `blocks`.
   State that `blocks` is the optional reverse edge, maintained by modeling (CAPTURE / REFINE)
   when it writes the task file, never auto-mirrored and never written by the worker. **Note the
   capture wording "refine / the conductor's backlink step" was itself inaccurate** — do not
   carry it into the fix.

Out of scope, deliberately: the installed plugin-cache copies under
`~/.claude/plugins/cache/agentheim/…` (the repo's `skills/`, `agents/` and `references/` are the
source; `release` ships them), the BC README (already amended by ghcaj), and the ADR-0073
reference at `skills/modeling/SKILL.md` line 214 (it resolves — ADR-0073 is the capture/dismiss
mechanization ADR; ghcaj's provisional 0073 was finalized to 0074 per ADR-0058).

## Acceptance criteria

- [ ] Each of the five passages above reads post-ghcaj and agrees with its named target wording; grepping these five phrases (verbatim) returns nothing: `the README diff for documentation tasks`, `(today: \`dashboard/dist/**\`, ADR-0057)`, `BOUNCE integration (verifier-free squash-merge)`, `squash-merge the worktree branch (\`git merge --squash`, `populated automatically by worker / refine`.
- [ ] No other file is touched — the diff is exactly the five files named above — and no `lib/` behavior changes: `node --test lib/test/*.test.mjs` stays green (493/493 at capture, re-confirmed at refinement).
- [ ] Prose-only, unenforced per ADR-0059; no new ADR (this amends nothing decided — it finishes ADR-0074's own consistency pass); README_DELTA and ADRS blocks in the worker's report are empty.

## Notes

Captured by the `work` conductor at ghcaj's integration under the task's closure rule, not by a
modeling session. The bounded-list approach converged the verifier loop on its first try
(iteration 6 PASS after five open-ended FAILs) — worth remembering when writing any future
"every surface agrees" criterion.

Refined 2026-09-06 (modeling, no orchestrator round — the design is settled and verified; the
refinement only pinned each fix's target wording and corrected the passage-5 attribution). The
verifier for this task should judge each passage against the named target, not run its own
open-ended sweep — the sweep is exactly what ghcaj's closure rule bounded.
