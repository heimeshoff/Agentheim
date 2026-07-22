---
id: agentic-workflow-r2hxk
title: worker-return-format.md misses the ADR-0062 runner-verdict qualifier its own restatement-exactness rule demands
status: doing
type: bug
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: []
tags: [dorc-audit-followup, doc-sync, runner-first]
related_adrs: [0062]
related_research: []
prior_art: [agentic-workflow-vvmfy]
---

## Why

`references/worker-return-format.md` declares itself the single source for the worker
return block and demands any restatement be exact (:47-49). But the runner-first wave
updated the restatement, not the source: `skills/test-driven-development/SKILL.md:119-121`
defines `TESTS_PASSING` "per the runner's own verdict … don't infer 'yes' from a test
printing its own success message" (ADR-0062), while worker-return-format.md:22 still says
plain `yes | no` with no qualifier. The canonical file is now the stale copy — the exact
drift it warns against, inverted.

## What

Fold the ADR-0062 runner-verdict qualifier into `references/worker-return-format.md`'s
`TESTS_PASSING` definition, and shrink the TDD skill's restatement to match the source
exactly (or replace it with a pointer, per the reference's own rule).

## Acceptance criteria

- [ ] `worker-return-format.md`'s `TESTS_PASSING` definition carries the runner-verdict qualifier (verdict from the runner's exit status / structured report, never a test's own printed green).
- [ ] The TDD skill's restatement is byte-consistent with the source or replaced by a pointer to it.
- [ ] No third copy of the field definition exists anywhere (grep for `TESTS_PASSING` across skills/, agents/, references/).

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (findings F7/M4). Doc-only.
Touches `skills/test-driven-development/SKILL.md` in a different section than
agentic-workflow-t6pjd — hunks don't overlap, safe to co-batch.
