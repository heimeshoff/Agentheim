---
id: agentic-workflow-a2pm1
title: What's Next panel — 3-step flight plan with ochre step-2 hero
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-05
completed:
depends_on: [design-system-vw12e, design-system-a31e0, design-system-001-styleguide]
blocks: []
tags: [dashboard-redesign, whats-next]
related_adrs: [0016]
related_research: []
prior_art: [agentic-workflow-073, agentic-workflow-076, agentic-workflow-q7m4k, agentic-workflow-c4t8m, agentic-workflow-vmk1z]
---

## Why
The builder wants the What's-next section restructured into 1b's "flight plan": three numbered,
connected steps with step 2 (RECOMMENDED MOVE) as the visual hero. Today's panel is three plain
columns. The existing X-only dismiss is already correct (no reload button exists — the brief's "X
only, no reload" is already true).

## What
Rebuild `WhatsNextPanel`'s layout (`dashboard/app/board.js`) from three plain columns into three
numbered steps (1 WHERE THINGS STAND / 2 RECOMMENDED MOVE / 3 SAY THE WORD) with numbered circles
connected by a horizontal line, step 2 wearing the `--emphasis-border` hero treatment (ochre border
+ shadow) from [[design-system-vw12e]] / [[design-system-a31e0]].

## Acceptance criteria
- [ ] Renders three steps with numbered circles connected by a horizontal line.
- [ ] Step 2 carries the `--emphasis-border` hero treatment drawn from the **named token** (not a
      raw rgba); no second hero renders anywhere else in the region.
- [ ] Only the X-dismiss control renders top-right — **no reload button** (already true; explicit
      regression check that the aw-vmk1z `DELETE /api/whats-next` dismiss is unaffected).
- [ ] `splitWhatsNextSections`' loss-tolerant behavior (degraded / absent bodies) is preserved.

## Notes
- Prior art: aw-073 (renders on dashboard), aw-076 (persists advisory), aw-q7m4k (three-column
  layout), aw-c4t8m (capped scrollable cards), aw-vmk1z (X-dismiss deletes the advisory artifact).
- Depends on palette [[design-system-a31e0]] (for `--emphasis-border`) and accent decision
  [[design-system-vw12e]].
