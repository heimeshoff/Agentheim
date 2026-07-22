---
id: agentic-workflow-k9pbh
title: Small-drift batch from the 2026-07-22 post-survey audit — lib-bootstrap counts and §6 legend, phantom backfill-indexes.sh, two stale line pointers, worker.md pre-worktree-era text, one INDEX annotation
status: todo
type: chore
context: agentic-workflow
created: 2026-07-22
completed:
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
      annotation like its siblings.

## Notes

Touches `skills/work/SKILL.md` (~:55) — same file as agentic-workflow-t8kfq (Phase 3
step 4); different sections, co-batchable per the additive-edit heuristic, but neither
should co-batch with a wholesale rewrite of that file. All fixes are one-off doc
corrections, not new conventions — ADR-0059 convention check not applicable (the
prefer-anchors-over-line-numbers choice is applied locally here, not established as a
rule; if a later task wants it as doctrine, that capture must carry its own
enforcement-or-marker choice).
