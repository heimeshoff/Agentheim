---
id: design-system-vw12e
title: Accent carve-out — ochre marks the primed primary action, not passive selection
status: backlog
type: decision
context: design-system
created: 2026-07-05
completed:
depends_on: []
blocks: [design-system-a31e0, agentic-workflow-vk6mc, agentic-workflow-wsfsk, agentic-workflow-bz3az, agentic-workflow-a2pm1]
tags: [dashboard-redesign, accent, adr, color-law]
related_adrs: [0016]
related_research: []
prior_art: [design-system-007, design-system-010, design-system-016]
---

## Why
The builder's chosen 1b ("Command deck") palette puts ochre on several action surfaces —
the What's-next CTA, the prompt Enter button, the currently-highlighted prompt-mode tab, and
one hero-emphasis border (the What's-next flight-plan's step 2). ADR-0016 currently reserves
the accent for status/focus and forbids ochre for any "selection among peers" (selection is by
de-emphasis). Every downstream redesign task needs a settled rule before it can safely apply
the accent, so this decision gates the whole set.

## What
Write an ADR (provisional ADR-0048) refining — not superseding — ADR-0016 with a discriminating
test: **ochre is permitted for a *primed primary action*** (a surface that fires / commits / is
armed-to-fire), **and forbidden for *passive equivalent-state selection*** (marking one of several
peers as current). Apply the test explicitly to the five tension surfaces the redesign raises.

## Acceptance criteria
- [ ] ADR names the discriminating test (fires/commits-vs-records-passive-state) and applies it
      explicitly to all five tension surfaces: What's-next CTA, prompt Enter button, highlighted
      prompt-mode tab, flight-plan step-2 hero border, and the left-nav active item.
- [ ] ADR rules the **left-nav active item stays non-ochre** (keeps the `--surface-2` de-emphasis
      fill), and records that this **conflicts with the builder's literal brief ask** (1a's orange
      inset rail) — flagged for explicit builder sign-off at refine.
- [ ] A named `--emphasis-border` token (not a raw `rgba(...)`) is specified for the single
      hero-border allowance, to be added to both theme blocks by the palette task
      (design-system-a31e0).
- [ ] ADR-0016 gets a one-line "see ADR-0048" pointer; its own text and status are left untouched.

## Notes
- **Open conflict to resolve with the builder:** the brief (item 11) explicitly asked for 1a's
  ochre inset rail on the active nav item. The architect ruled against it on ADR-0016 grounds
  (passive selection). Captured here with the de-emphasis default; if the builder overrides,
  this ADR's boundary must be restated (it would mean "passive selection may also take ochre").
- Precedent for reserved-accent discipline: design-system-007 (theme toggle selects by
  de-emphasis), design-system-010 (dropped the ochre selected-ring), design-system-016 (search
  focus ring is the sanctioned accent use).
- One of three foundation decisions for the dashboard redesign; the other two are
  [[design-system-e9apx]] (palette identity) and [[agentic-workflow-s7gev]] (prompt selection model).
