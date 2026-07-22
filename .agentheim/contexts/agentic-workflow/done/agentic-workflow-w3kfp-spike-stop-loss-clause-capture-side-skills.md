---
id: agentic-workflow-w3kfp
title: quick-capture and brainstorm mint spike tasks without the ADR-0065 stop-loss clause
status: done
type: bug
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: []
tags: [dorc-audit-followup, capture-side, spike-doctrine]
related_adrs: [0065, 0059]
related_research: []
prior_art: [agentic-workflow-rx630]
---

## Why

ADR-0065 requires every `type: spike` task minted after 2026-07-21 to carry the stop-loss
clause, enforced by `lib/spike-stop-loss.mjs`'s live-tree lint (which scans ALL lifecycle
folders including `backlog/`). `skills/modeling/SKILL.md` (type legend) and
`agents/worker.md` were updated — but the two other capture paths were not:

- `skills/quick-capture/SKILL.md:76-79` infers `type: spike` for "investigate" ideas with
  no clause in its template path.
- `skills/brainstorm/SKILL.md:175-181` emits the walking-skeleton spike with no clause.

Any spike either skill mints today is an immediate lint violation on a fresh capture.

## What

Bring both capture-side skills in line with ADR-0065, and fix quick-capture's stale ID
placeholder found in the same audit (same file, folded here to avoid two tasks contending
on `skills/quick-capture/SKILL.md`):

1. quick-capture: when the type heuristic lands on `spike`, the emitted task body must
   include the stop-loss clause ("if, mid-spike, the mitigation is already known and cheap,
   record it and stop" — either accepted wording per `lib/spike-stop-loss.mjs`).
2. brainstorm: the walking-skeleton spike spec includes the clause.
3. quick-capture template fix: `skills/quick-capture/SKILL.md:112` shows
   `id: <bc-short>-<NNN>` — contradicts its own ADR-0028 random-token rule at :153-157.
   Change the placeholder to the token form.

## Acceptance criteria

- [x] `skills/quick-capture/SKILL.md` instructs including the stop-loss clause whenever it mints a `type: spike` task, with wording that satisfies `lib/spike-stop-loss.mjs`'s marker regex.
- [x] `skills/brainstorm/SKILL.md`'s walking-skeleton spike emission includes the stop-loss clause.
- [x] `skills/quick-capture/SKILL.md`'s task template shows a token-form id placeholder, not `<NNN>`.
- [x] `node --test lib/test/spike-stop-loss.test.mjs` stays green (live-tree gate).

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (finding H1 + template item from
finding cluster 8). Doc-only change — no lib code moves.

## Outcome

Brought both capture-side skills in line with ADR-0065 (agentic-workflow-rx630's stop-loss
doctrine) and fixed the stale id placeholder in the same file:

- `skills/quick-capture/SKILL.md` step 3 (type heuristic) now instructs: when the type
  lands on `spike`, the task body must carry the stop-loss clause ("if, mid-spike, the
  mitigation is already known and cheap, record it and stop") in the `## Notes` section,
  worded to satisfy `lib/spike-stop-loss.mjs`'s `/stop-loss|record it and stop/i` marker
  regex — mirrors the wording already in `skills/modeling/SKILL.md`'s type legend.
- `skills/quick-capture/SKILL.md`'s task template id placeholder (was `<bc-short>-<NNN>`)
  changed to `<bc>-<token>`, consistent with the file's own ADR-0028 random-token rule at
  the "ID convention" section a few lines below.
- `skills/brainstorm/SKILL.md`'s walking-skeleton spike emission section now includes the
  same stop-loss clause instruction, directing it into the task's `## Notes` section.
- Verified via `node --test lib/test/spike-stop-loss.test.mjs` (9/9 passing, including the
  live-tree gate scanning all lifecycle folders) — no non-grandfathered spike task in the
  live `.agentheim/` tree is missing the clause.

Doc-only change: no `lib/` code moved, no behavioral test added (TDD-skip: doc-only change
in prose skill files; the acceptance criterion that *is* testable — the live-tree lint
staying green — was run and confirmed passing).
