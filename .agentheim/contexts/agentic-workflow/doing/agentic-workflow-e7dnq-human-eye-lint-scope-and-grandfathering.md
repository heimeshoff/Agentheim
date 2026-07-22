---
id: agentic-workflow-e7dnq
title: human-eye-criteria lint flags backlog tasks the doctrine says are legal — align its scope with the promote-time note rule
status: doing
type: bug
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: []
tags: [dorc-audit-followup, lint-scope, falsifiability]
related_adrs: [0061, 0059]
related_research: []
prior_art: [agentic-workflow-mxk6v]
---

## Why

`lib/human-eye-criteria.mjs` scans `backlog/` (line 41) and — unlike its sibling lints
(`index-entry-length.mjs`, `spike-stop-loss.mjs`) — has no `ADOPTION_DATE` grandfathering.
But the doctrine it claims to enforce says the all-human-eye note is added at PROMOTE
(`skills/modeling/SKILL.md:207-219`, step 2b) or at CAPTURE only for tasks landing directly
in `todo/` (:135), and "human-eye criteria are never a `backlog/`→`todo/` blocker"
(:428-431). A correctly captured all-human-eye backlog task is therefore lint-flagged for
its entire backlog life — the lint is stricter than the doctrine, in the exact way the
doctrine deliberately rejected.

## What

Align the lint with the doctrine it enforces:

1. Narrow `findAllHumanEyeTasksMissingNote`'s scan to `todo/`, `doing/`, `done/` —
   `backlog/` residents are legal without the note by design.
2. Add `ADOPTION_DATE` grandfathering mirroring the sibling lints' shape (a task whose
   `created` date is on/before 2026-07-21 is never flagged), so pre-doctrine done/ tasks
   can't retro-fail the gate.
3. Correct the module's header comment, which currently claims CAPTURE/PROMOTE "both
   require" the note for backlog residents — they don't.

## Acceptance criteria

- [ ] `findAllHumanEyeTasksMissingNote` no longer scans `backlog/`; unit test proves an all-human-eye, note-less backlog task is not flagged.
- [ ] Tasks with `created` on/before the adoption date are exempt, mirroring `spike-stop-loss.mjs`'s date-grandfather shape; unit test covers the boundary.
- [ ] The module header comment matches the actual doctrine (note required from promote/direct-todo onward only).
- [ ] `node --test lib/test/human-eye-criteria.test.mjs` green, including the live-tree gate.

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (finding H2). ADR-0061 itself needs no
amendment — the lint drifted from the ADR, not the other way round; note the narrowed scope
in the ADR only if the worker judges the ADR text ambiguous on it.
