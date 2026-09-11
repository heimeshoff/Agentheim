---
id: agentic-workflow-r2hxk
title: worker-return-format.md misses the ADR-0062 runner-verdict qualifier its own restatement-exactness rule demands
status: done
type: bug
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
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

- [x] `worker-return-format.md`'s `TESTS_PASSING` definition carries the runner-verdict qualifier (verdict from the runner's exit status / structured report, never a test's own printed green).
- [x] The TDD skill's restatement is byte-consistent with the source or replaced by a pointer to it.
- [x] No third copy of the field definition exists anywhere (grep for `TESTS_PASSING` across skills/, agents/, references/).

## Outcome

`references/worker-return-format.md` now carries the canonical `TESTS_PASSING` definition
in full: a new paragraph after the return-block template states the verdict comes from the
runner's own exit status / structured report (ADR-0062), never inferred from a test's own
printed success. `skills/test-driven-development/SKILL.md`'s restatement (previously ahead of
the source) is now shrunk to a one-line pointer at the canonical definition, per the
reference's own "prefer pointing here over restating" rule. Grepped `TESTS_PASSING` across
`skills/`, `agents/`, `references/`: `agents/verifier.md` and `agents/worker.md` only name
the field or point to the reference; `agents/verifier.md` check 2's own operational logic
(sharpened per ADR-0062) is the verifier's check description, not a duplicate field
definition, and is unchanged. No third full copy exists. Full test suite green (333/333)
per `node --test`'s own summary line.

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (findings F7/M4). Doc-only.
Touches `skills/test-driven-development/SKILL.md` in a different section than
agentic-workflow-t6pjd — hunks don't overlap, safe to co-batch.
