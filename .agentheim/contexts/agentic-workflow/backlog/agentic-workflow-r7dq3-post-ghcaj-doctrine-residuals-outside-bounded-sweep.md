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
related_adrs: [0074, 0072, 0057, 0059]
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
or plain-rewrite shape ghcaj used:

1. `agents/verifier.md` ~line 53 — check 1's TDD-skip artifact list still says "ADR file for a
   `decision` task; … the README diff for documentation tasks", contradicting the same file's
   rewritten check 5 ("There is no README diff to read anymore") and check 6 ("There is no ADR
   file on disk yet"). Point the skip-artifact list at the `ADRS` / `README_DELTA` blocks.
2. `skills/work/SKILL.md` ~line 341 (ADR-0072 ladder, rung 2) — "every tracked path the checkpoint
   guard refuses (today: `dashboard/dist/**`, ADR-0057)"; the guard now refuses two families
   (`derived-artifact`, `bookkeeping-path`). The parallel "today:" phrase in the BC README was
   amended by ghcaj; this one was not.
3. `references/commit-doctrine.md` ~line 55 — the "`work`'s own non-task-commit shapes" table still
   labels the BOUNCE row "BOUNCE integration (verifier-free squash-merge)"; post-ghcaj BOUNCE no
   longer squash-merges at all (`skills/work/SKILL.md` "BOUNCE integration").
4. `skills/verification-before-completion/SKILL.md` ~line 56 — the `VERDICT: PASS` paragraph's
   abbreviated integration sequence ("squash-merge the worktree branch, run the mechanized COMPLETE
   script, then `git add` …") predates steps (a), (c) and (e) of the ADR-0074 integration order;
   the same file states the full order correctly near line 92. Make the short form agree.
5. `skills/modeling/SKILL.md` ~line 300 (outside ghcaj's list, which narrowed this surface to the
   `completed` line) — "`blocks` is populated automatically by worker / refine"; post-ghcaj the
   worker writes no task-file frontmatter, so it is refine / the conductor's backlink step.

Line numbers are as of commit dc1b15f (main, 2026-09-06) and will drift; match on the quoted
phrases.

## Acceptance criteria

- [ ] Each of the five passages above reads post-ghcaj; grepping the five quoted phrases (verbatim) returns nothing.
- [ ] No other file is touched, and no `lib/` behavior changes — `node --test lib/test/*.test.mjs` stays green (493/493 at capture).
- [ ] Prose-only, unenforced per ADR-0059; no new ADR (this amends nothing decided — it finishes ADR-0074's own consistency pass).

## Notes

Captured by the `work` conductor at ghcaj's integration under the task's closure rule, not by a
modeling session. The bounded-list approach converged the verifier loop on its first try
(iteration 6 PASS after five open-ended FAILs) — worth remembering when writing any future
"every surface agrees" criterion.
