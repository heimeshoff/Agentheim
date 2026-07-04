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
- [ ] ADR permits the **left-nav active item to take 1a's ochre inset rail** (builder decision,
      2026-07-05) as a **bounded wayfinding exception**: the allowance is scoped to the single
      primary-navigation active item, NOT opened to arbitrary equivalent-state selection. ADR states
      the boundary explicitly so it can't be cited to justify ochre on ordinary peer selection
      elsewhere.
- [ ] A named `--emphasis-border` token (not a raw `rgba(...)`) is specified for the single
      hero-border allowance, to be added to both theme blocks by the palette task
      (design-system-a31e0).
- [ ] ADR-0016 gets a one-line "see ADR-0048" pointer; its own text and status are left untouched.

## Notes
- **Resolved (builder, 2026-07-05): the nav active item KEEPS 1a's ochre inset rail.** The architect
  had defaulted to de-emphasis on ADR-0016 grounds (passive selection); the builder overrode in
  favour of the orange rail. So ADR-0048's rule is now two-part: ochre for (a) *primed primary
  actions* and (b) *the single primary-navigation active item* (a deliberate, bounded wayfinding
  exception). The discriminating test still forbids ochre on arbitrary equivalent-state selection —
  the exception is explicitly one surface, not a general reopening of ADR-0016.
- Precedent for reserved-accent discipline: design-system-007 (theme toggle selects by
  de-emphasis), design-system-010 (dropped the ochre selected-ring), design-system-016 (search
  focus ring is the sanctioned accent use).
- One of three foundation decisions for the dashboard redesign; the other two are
  [[design-system-e9apx]] (palette identity) and [[agentic-workflow-s7gev]] (prompt selection model).
