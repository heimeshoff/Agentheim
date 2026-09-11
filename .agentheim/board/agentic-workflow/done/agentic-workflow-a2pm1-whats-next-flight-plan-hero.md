---
id: agentic-workflow-a2pm1
title: What's Next panel — 3-step flight plan with ochre step-2 hero
status: done
type: feature
context: agentic-workflow
created: 2026-07-05
completed: 2026-07-05
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
- [x] Renders three steps with numbered circles connected by a horizontal line.
- [x] Step 2 carries the `--emphasis-border` hero treatment drawn from the **named token** (not a
      raw rgba); no second hero renders anywhere else in the region.
- [x] Only the X-dismiss control renders top-right — **no reload button** (already true; explicit
      regression check that the aw-vmk1z `DELETE /api/whats-next` dismiss is unaffected).
- [x] `splitWhatsNextSections`' loss-tolerant behavior (degraded / absent bodies) is preserved.

## Notes
- Prior art: aw-073 (renders on dashboard), aw-076 (persists advisory), aw-q7m4k (three-column
  layout), aw-c4t8m (capped scrollable cards), aw-vmk1z (X-dismiss deletes the advisory artifact).
- Depends on palette [[design-system-a31e0]] (for `--emphasis-border`) and accent decision
  [[design-system-vw12e]].

## Outcome
Rebuilt `WhatsNextPanel` (`dashboard/app/board.js`) so the advisory's parsed sections render as
a flight-plan stepper: a horizontal connector row of numbered circles (one per parsed column,
joined by a connecting hairline-token line between consecutive circles), followed by the
existing per-section CAPPED CARDS (aw-c4t8m chrome unchanged). Both the numbering and the step-2
hero are **position-based, not text-matched** (`i + 1` for the label, `i === 1` for the hero) —
this keeps `splitWhatsNextSections`' loss-tolerant contract intact: a degraded body with fewer
columns just yields fewer circles/cards and one fewer connector line, never an invented step.
Step 2 (the second parsed column) wears the licensed `--emphasis-border` hero carve-out
(ADR-0048/ADR-0049): a named-token border + a matching token-driven `boxShadow`, never a raw
rgba/hex — and it is the ONLY surface in the region referencing that token (verified by a test
asserting exactly 2 occurrences of `var(--emphasis-border)`, both inside the one hero card's
style object). The X-dismiss control and its `DELETE /api/whats-next` wiring (aw-vmk1z) are
untouched — a regression test asserts exactly one `<button>` renders in the panel (no reload
button introduced). `dashboard/dist/` was rebuilt via `npm run build` (esbuild) to pick up the
change.

Files touched: `dashboard/app/board.js` (WhatsNextPanel layout + doc comment),
`dashboard/test/whats-next-panel.test.mjs` (5 new tests + 1 updated regex for the now-
conditional card border), `dashboard/dist/*` (rebuilt), `.agentheim/contexts/agentic-workflow/README.md`
(WhatsNextPanel bullet updated to describe the stepper + step-2 hero).

Full dashboard suite: 739/739 passing (baseline 734 + 5 new).
