---
id: agentic-workflow-f7k2d
title: Fix TESTS_* return-format drift — work spawn template omits the fields the verifier gates on
status: done
type: bug
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-02
depends_on: []
blocks: []
tags: [harness-audit, verifier, work-skill, doctrine-drift]
related_adrs: []
related_research: []
prior_art: []
---

## Why

`agents/worker.md:128-130` requires `TESTS_ADDED`, `TESTS_PASSING`, `TDD_SKIPPED`
in the SUCCESS return block, and `agents/verifier.md:49` gates its test-execution
check on "If `TESTS_ADDED > 0` … run the test suite." But the spawn template the
worker actually receives — `skills/work/SKILL.md:350-358` — omits all three fields
and says "return ONLY the following, nothing else." A compliant worker therefore
never reports test counts, the verifier's check-2 trigger never fires as specified,
and the protocol entry's "**Tests added:** N" (`work/SKILL.md:245`) has no source.
The verifier's test-execution check is silently disabled by format drift.
(Harness audit 2026-07-02, confirmed defect #1.)

## What

Add the three `TESTS_*` fields to the SUCCESS return-block template in
`skills/work/SKILL.md` so it matches `agents/worker.md`'s strict return format.

## Acceptance criteria

- [ ] The `work/SKILL.md` spawn template's SUCCESS block lists `TESTS_ADDED`, `TESTS_PASSING`, and `TDD_SKIPPED` exactly as `agents/worker.md` specifies them.
- [ ] The verifier's `TESTS_ADDED > 0` trigger has a real source in every compliant worker return.
- [ ] The protocol task-completion entry's "Tests added" field has a source.
- [ ] The two format definitions agree byte-for-byte, or one explicitly points at the other as the single source.

## Notes

Highest defect-severity-to-effort ratio in the audit. This is the live proof of the
doctrine-duplication bug class that the broader single-sourcing task
(agentic-workflow-s7d3k) exists to eliminate — fix this instance now, structurally
prevent recurrence there.

## Outcome

Added `TESTS_ADDED`, `TESTS_PASSING`, and `TDD_SKIPPED` to the SUCCESS return-block
template in `skills/work/SKILL.md` (the block a worker is spawned with), copied
byte-for-byte from `agents/worker.md:128-130`, in the same position (between
`NEW_BACKLOG_ITEMS` and `CONCEPT_CANDIDATE`). Also carried over the
`TESTS_PASSING: no` guardrail note so the field's semantics are unambiguous.

Effect on the sourcing chain:
- `agents/verifier.md:49` (`If TESTS_ADDED > 0 … run the test suite`) now has a
  real source in every compliant worker return — the trigger can actually fire.
- The protocol task-completion entry's `**Tests added:** N`
  (`skills/work/SKILL.md:247`) now has a source field to draw from.

The three `TESTS_*` field definitions now agree byte-for-byte across
`agents/worker.md` and `skills/work/SKILL.md`. Documentation/template-consistency
fix only — no code, so TDD legitimately skipped (pure documentation task).

Key file: `skills/work/SKILL.md` (SUCCESS return-block template).
