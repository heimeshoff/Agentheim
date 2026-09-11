---
id: agentic-workflow-k9pbh
title: Small-drift batch from the 2026-07-22 post-survey audit — lib-bootstrap counts and §6 legend, phantom backfill-indexes.sh, two stale line pointers, worker.md pre-worktree-era text, one INDEX annotation
status: done
type: chore
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: []
tags: [doc-drift, audit-residuals]
related_adrs: [0026, 0032, 0044]
related_research: []
prior_art: [agentic-workflow-mqwnc, agentic-workflow-d7ksw, agentic-workflow-ewt9s, agentic-workflow-b4yrm]
---

## Why

2026-07-22 post-survey audit residuals — seven small, disjoint doc/comment drifts, none
behavior-affecting on its own, batched so they stop resurfacing in every future audit.

## What / Acceptance criteria

- [ ] `references/lib-bootstrap.md` ~:40 — "the four invocations below" corrected (there
      are nine; the file's own intro says nine).
- [ ] `references/lib-bootstrap.md` §6 output legend — "`legacy` (all-digit tail —
      accept)" corrected for the mint-time-backstop context it documents: a freshly
      minted id classifying `legacy` is out-of-spec and must be discarded and re-minted
      (ADR-0044, `classifyTaskId(newId) === 'token'`); legacy-accept applies only to
      reading pre-existing ids.
- [ ] `skills/work/SKILL.md` ~:55 — no longer offers a nonexistent
      `scripts/backfill-indexes.sh`; either name only the `.ps1` or add the `.sh`
      (fixing the doc is the expected cheap path).
- [ ] `references/bc-readme-template.md` ~:45 — stale "~:66-69" pointer to TDD's
      record-the-invocation rule corrected; prefer a step/section anchor ("runner-first
      step 2") over a raw line number so it can't go stale the same way again.
- [ ] `lib/human-eye-criteria.mjs` ~:16 — stale "(:428-431)" header pointer corrected to
      where the never-a-backlog-blocker rule actually lives in
      `skills/modeling/SKILL.md`; prefer a section anchor over a line number.
- [ ] `agents/worker.md` — three pre-worktree-era drifts: (a) ~:151 "The work skill
      fills that in after it commits" deleted (the `commit:` field was dropped by
      ADR-0026 — nothing fills it in); (b) frontmatter description no longer claims the
      worker moves the task todo/→doing/ (the conductor's mechanized batch CLAIM does,
      ADR-0032/0038); (c) the "Inputs you receive" list names the `Workspace` worktree
      field the spawn template supplies.
- [ ] `contexts/agentic-workflow/INDEX.md` — the d5a9b backlog line gains its "(type)"
      annotation like its siblings. **Conductor-deferred** — worker is forbidden from
      editing INDEX.md. d5a9b's frontmatter `type: feature`; the conductor should add
      `(feature)` to that backlog line.

## Outcome

Fixed six of the seven small-drift residuals (the seventh — the INDEX.md `(type)`
annotation for d5a9b — is conductor-deferred per the worker's INDEX-write prohibition;
see the checkbox above for the exact edit and type):

1. `references/lib-bootstrap.md` — "four invocations" → "nine" (matches the file's own
   nine `node -e` blocks and the intro's already-correct "nine near-duplicate
   one-liners" count).
2. `references/lib-bootstrap.md` §6 legend — clarified that at this mint-time-backstop
   call site only `token` is acceptable (ADR-0044: `classifyTaskId(newId) === 'token'`);
   a freshly minted id classifying `legacy` is itself out-of-spec and must be discarded
   and re-minted like `malformed`. `legacy`-accept is a reading-only behaviour
   (e.g. `deriveContext`'s resolver tolerating an already-on-disk id) that does not apply
   when classifying a newly minted one.
3. `skills/work/SKILL.md` (~:55) — dropped the phantom `scripts/backfill-indexes.sh`
   reference; only the real `.ps1` script is named now.
4. `references/bc-readme-template.md` (~:45) — replaced the stale `~:66-69` line-number
   pointer with a section/step anchor: TDD's "Runner-first" section, step 2.
5. `lib/human-eye-criteria.mjs` (~:16) — replaced the stale `(:428-431)` header pointer
   with `skills/modeling/SKILL.md` PROMOTE step 2, "Falsifiability classification"
   bullet (ADR-0061), where the never-a-backlog-blocker rule actually lives.
6. `agents/worker.md` — three pre-worktree-era corrections: (a) removed the false claim
   that "the work skill fills that in after it commits" for the `commit:` frontmatter
   field — the field was dropped by ADR-0026 and nothing fills it in; a task's commit is
   discoverable via `git log`'s `[<task-id>]` trailer instead; (b) the frontmatter
   `description` no longer claims the worker itself moves the task `todo/`→`doing/` —
   that's now the conductor's mechanized batch claim (ADR-0032/ADR-0038); (c) the
   "Inputs you receive" list now names the `Workspace` worktree-path field the spawn
   template supplies (ADR-0032).

`node --test lib/test/*.test.mjs` run from the worktree: 351/351 pass — no production
code touched, doc/comment-only change.

## Notes

Touches `skills/work/SKILL.md` (~:55) — same file as agentic-workflow-t8kfq (Phase 3
step 4); different sections, co-batchable per the additive-edit heuristic, but neither
should co-batch with a wholesale rewrite of that file. All fixes are one-off doc
corrections, not new conventions — ADR-0059 convention check not applicable (the
prefer-anchors-over-line-numbers choice is applied locally here, not established as a
rule; if a later task wants it as doctrine, that capture must carry its own
enforcement-or-marker choice).
