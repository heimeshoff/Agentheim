---
id: agentic-workflow-n8zqe
title: whats-next is behind the new advisories — recommends resolved open questions, ignores the ADR-0065 remediation-first tiebreak
status: todo
type: bug
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: []
tags: [dorc-audit-followup, whats-next, dispatch-ordering]
related_adrs: [0027, 0064, 0065]
related_research: []
prior_art: [agentic-workflow-qz1h7, agentic-workflow-rx630, agentic-workflow-x4t2g]
---

## Why

`skills/whats-next/SKILL.md:27-63` predates the Dorc wave:

1. It reads vision.md's "Open questions" raw — no filtering of `~~struck-through~~
   *Resolved…*` items (unlike `lib/vacuum-guard.mjs`'s `extractOpenQuestions`), so it can
   recommend an already-resolved question as the next move.
2. It doesn't know ADR-0065's remediation-over-diagnosis preference — when naming the
   "highest-leverage" ready task it can recommend exactly the diagnosis spike that work's
   dispatch ordering would deliberately order last on the same thread. This is a residual
   cycle vector for the analytical-loop behavior the Dorc review flagged.
3. It doesn't surface the ADR-0064 vacuum framing when the ready set is empty but open
   questions exist.

## What

1. Route whats-next's open-question read through `extractOpenQuestions` (same helper,
   resolved items filtered, age surfaced) — with the standard bootstrap invocation so it
   works in consumer installs (see agentic-workflow-b4yrm).
2. Add the remediation-first tiebreak to its ready-task weighing: a known-cheap
   remediation on an already-diagnosed thread outranks a further-diagnosis spike on the
   same thread (same-thread definition verbatim from ADR-0065).
3. Empty ready set + open questions → the recommendation is the vacuum-guard framing (the
   open decision with its age), not invented work.

## Acceptance criteria

- [ ] whats-next's vision read filters resolved items and carries each item's age (via `extractOpenQuestions`, not a re-implementation).
- [ ] Its ready-task recommendation logic states the ADR-0065 tiebreak with the same same-thread definition (shared tag / depends_on-blocks / prior_art).
- [ ] Empty-board recommendation matches the ADR-0064 framing; no self-generated filler suggested.

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (finding L4). Doc-only unless the
worker finds whats-next needs a lib touch for the bootstrap.
