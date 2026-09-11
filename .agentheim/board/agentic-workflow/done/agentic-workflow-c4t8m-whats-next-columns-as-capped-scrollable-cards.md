---
id: agentic-workflow-c4t8m
title: What's Next columns become their own capped, scrollable cards
status: done
type: feature
context: agentic-workflow
created: 2026-06-18
completed: 2026-06-18
depends_on: [design-system-001]
blocks: []
tags: [dashboard, whats-next, layout, frontend]
related_adrs: [0027, 0003]
related_research: []
prior_art: [agentic-workflow-q7m4k, agentic-workflow-073, agentic-workflow-076]
---

## Why
aw-q7m4k laid the What's Next advisory panel's three sections (*where things stand* /
*recommended move* / *next*) out as three side-by-side columns. They're bare columns
today — heading + `Markdown`, no card chrome, no height bound. A long recommendation
makes the panel grow tall and eat a quarter of the screen or more, which defeats the
point of a *glanceable* advisory card sitting at the top of the board view.

The fix: each column should read as its own **card**, and the whole row should be
**height-bounded** so it stays a compact top strip. Content that overflows the cap
scrolls *inside* its card rather than pushing the board down.

## What
A presentation refinement to `WhatsNextPanel` (`dashboard/app/board.js`) — the same
three-column render aw-q7m4k built, given card chrome and a height cap:

1. **Each column is its own card.** Wrap each of the three columns in board-local,
   token-matched card chrome (surface fill + `--hairline` border + radius + padding),
   consumed **unforked** (ADR-0003) — the board-control precedent, no new design-system
   primitive. The three cards keep the existing responsive auto-fit grid (they collapse
   to fewer/one column on a narrow board).

2. **Capped height, internal scroll.** Each card gets a `max-height` of roughly **two
   ticket cards** tall — enough that the row is a compact top strip, never ~a quarter of
   the viewport. The card's content area scrolls vertically (`overflow-y: auto`) when it
   exceeds the cap; pick a concrete value (px/rem or a `clamp`) at implementation time,
   token-matched, and prefer the existing `scroll-quiet` scrollbar treatment if it fits.
   The section heading staying visible while the body scrolls is a nice-to-have, not
   required.

## Acceptance criteria
- [ ] Each of the three What's Next columns renders as its own card with board-local, token-matched chrome (surface + `--hairline` border + radius + padding), the styleguide consumed unforked (ADR-0003) — no new design-system child task.
- [ ] Each card has a bounded `max-height` of roughly two ticket cards; the whole What's Next row stays a compact top strip and does not grow to ~a quarter of the viewport regardless of recommendation length.
- [ ] When a card's content exceeds the cap, the content scrolls vertically *inside* that card (`overflow-y: auto`); the card itself does not grow past the cap and does not push the board down.
- [ ] The three cards keep the existing responsive behaviour (auto-fit grid collapsing to fewer/one column on a narrow board); the loss-tolerant degraded/absent-artifact contract from aw-q7m4k / aw-073 is preserved (no throw, absent artifact still renders nothing).
- [ ] `dashboard/dist/` is rebuilt (`node build.mjs`) so the served bundle carries the change (the standing dashboard-source-change rule).

## Notes
- The three-column layout, the `splitWhatsNextSections` splitter, and the auto-fit grid
  (`repeat(auto-fit, minmax(220px, 1fr))`) are aw-q7m4k; the panel + dismiss/staleness
  reads are aw-073; the artifact shape (`generated` + three sections) is aw-076 / ADR-0027.
  This task touches **only** the per-column wrapper styling in `WhatsNextPanel`
  (`dashboard/app/board.js`, around the `columns.map(...)` block) — the splitter, fetch,
  dismiss, and staleness logic are untouched.
- "Two ticket cards" is a sizing *intent*, not a hard pixel spec — the worker picks a
  concrete cap that keeps the strip compact while leaving each card readable.
- Styleguide gate is **OPEN** (design-system re-approved), so this frontend task is
  promotable; it depends on `design-system-001` per the gate.

## Outcome
Each of the `WhatsNextPanel`'s three advisory columns (`dashboard/app/board.js`,
`columns.map(...)`) now renders as its own **board-local, token-matched card** —
a `--surface-1` fill on a `--hairline` border, `--radius-md` corners, `10px 12px`
padding — the board-control precedent, styleguide consumed UNFORKED, no new
design-system primitive (ADR-0003).
- **Height-capped, internal scroll.** Each card is bounded to `maxHeight: 196` (roughly
  two compact ticket cards) and scrolls its overflow vertically INSIDE the card
  (`overflowY: auto`) wearing the existing quiet styleguide scrollbar (the
  `scroll-quiet` class, agentheim.css) — so the advisory row stays a compact top strip
  and never pushes the board down regardless of recommendation length.
- **Responsive + loss-tolerant preserved.** The cap layers ON the existing auto-fit grid
  (`repeat(auto-fit, minmax(220px, 1fr))`) — cards still collapse to fewer/one on a
  narrow board — and the aw-q7m4k / aw-073 degraded/absent-artifact contract is untouched
  (fewer/empty/absent columns still render without throwing).
- **dist/ rebuilt** via `node build.mjs` (the standing dashboard-source rule) — the cap
  and `scroll-quiet` chrome ship in `dist/app.js`.

Key files: `dashboard/app/board.js` (`WhatsNextPanel` column wrapper),
`dashboard/test/whats-next-panel.test.mjs` (4 new chrome/cap/scroll/grid guards),
`dashboard/dist/` (rebuilt). Full suite 614 green.
</content>
</invoke>
