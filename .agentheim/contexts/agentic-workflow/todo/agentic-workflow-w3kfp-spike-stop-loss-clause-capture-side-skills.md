---
id: agentic-workflow-w3kfp
title: quick-capture and brainstorm mint spike tasks without the ADR-0065 stop-loss clause
status: todo
type: bug
context: agentic-workflow
created: 2026-07-22
completed:
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

- [ ] `skills/quick-capture/SKILL.md` instructs including the stop-loss clause whenever it mints a `type: spike` task, with wording that satisfies `lib/spike-stop-loss.mjs`'s marker regex.
- [ ] `skills/brainstorm/SKILL.md`'s walking-skeleton spike emission includes the stop-loss clause.
- [ ] `skills/quick-capture/SKILL.md`'s task template shows a token-form id placeholder, not `<NNN>`.
- [ ] `node --test lib/test/spike-stop-loss.test.mjs` stays green (live-tree gate).

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (finding H1 + template item from
finding cluster 8). Doc-only change — no lib code moves.
