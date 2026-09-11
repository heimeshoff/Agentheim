---
id: agentic-workflow-e7dnq
title: human-eye-criteria lint flags backlog tasks the doctrine says are legal — align its scope with the promote-time note rule
status: done
type: bug
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
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

- [x] `findAllHumanEyeTasksMissingNote` no longer scans `backlog/`; unit test proves an all-human-eye, note-less backlog task is not flagged.
- [x] Tasks with `created` on/before the adoption date are exempt, mirroring `spike-stop-loss.mjs`'s date-grandfather shape; unit test covers the boundary.
- [x] The module header comment matches the actual doctrine (note required from promote/direct-todo onward only).
- [x] `node --test lib/test/human-eye-criteria.test.mjs` green, including the live-tree gate.

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (finding H2). ADR-0061 itself needs no
amendment — the lint drifted from the ADR, not the other way round; note the narrowed scope
in the ADR only if the worker judges the ADR text ambiguous on it.

## Outcome

`lib/human-eye-criteria.mjs`'s scan now covers only `todo/`, `doing/`, `done/`
(`backlog/` residents are legal without the note by design); a new `ADOPTION_DATE =
'2026-07-21'` constant grandfathers any task with `created` on/before that date, mirroring
`lib/spike-stop-loss.mjs`'s shape (a local `frontmatterField` helper reads `created`, same
pattern as `lib/index-entry-length.mjs`). The module header comment was corrected — the note
is required at PROMOTE (edited into the task while still in `backlog/`, before the move) or
at CAPTURE only for a task landing directly in `todo/`, never for a `backlog/` resident.

`lib/test/human-eye-criteria.test.mjs`'s `writeTask` helper now takes an optional `created`
override (default post-adoption so existing behavioral tests keep exercising the
"note required" branch); added tests for the backlog exemption and the exact grandfather
boundary (on-date exempt, day-after flagged). 19/19 tests pass in this file; full suite
(`node --test lib/test/*.test.mjs`) is 333/333 green.

Also lightly corrected ADR-0061's self-referential-compliance section, which described the
lint as walking "every BC's lifecycle folders" — now inaccurate — to state the actual
todo/doing/done scope and the date-grandfather, crediting this task.

Key files: `lib/human-eye-criteria.mjs`, `lib/test/human-eye-criteria.test.mjs`,
`.agentheim/knowledge/decisions/0061-falsifiability-gate-machine-vs-human-eye-criteria.md`.
