---
id: design-system-vw12e
title: Accent carve-out — ochre marks the primed primary action, not passive selection
status: done
type: decision
context: design-system
created: 2026-07-05
completed: 2026-07-05
depends_on: []
blocks: [design-system-a31e0, agentic-workflow-vk6mc, agentic-workflow-wsfsk, agentic-workflow-bz3az, agentic-workflow-a2pm1]
tags: [dashboard-redesign, accent, adr, color-law]
related_adrs: [0016, 0048]
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

## Outcome

Wrote ADR-0048 (`.agentheim/knowledge/decisions/0048-accent-carveout-primed-primary-action-not-passive-selection.md`),
refining ADR-0016 with the fires/commits-vs-passive-equivalent-state test and
applying it to all five tension surfaces:

- **What's-next CTA** and **prompt Enter button** — fire/commit, ochre permitted.
- **Highlighted prompt-mode tab** — passive selection, ochre forbidden; stays
  de-emphasis per ADR-0016.
- **Flight-plan step-2 hero border** — a bounded emphasis allowance (reads as
  "next to run," not selection-among-peers), gated behind a new named token,
  `--emphasis-border` (specified by name/intent only; the value/CSS addition is
  design-system-a31e0's job, not this task's — no CSS file touched here).
- **Left-nav active item** — the builder's 1a ochre inset rail
  (`inset 2px 0 0 var(--accent-ochre)`) is kept as a bounded, single-surface
  wayfinding exception, explicitly stated so it cannot be cited to justify
  ochre on any other equivalent-state selection.

Added a one-line "see ADR-0048" pointer to ADR-0016
(`.agentheim/knowledge/decisions/0016-theme-preview-swatches-fixed-tokens-deemphasis-selection.md`)
under its Consequences section; ADR-0016's own text and `status: accepted` are
untouched. No CSS/token file was touched (per task instruction — a31e0 adds the
token). No README change made (README's identity framing belongs to the
parallel sibling task design-system-e9apx; no other design-system README
section needed updating for this accent-usage decision).
