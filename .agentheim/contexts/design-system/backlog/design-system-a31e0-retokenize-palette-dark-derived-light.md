---
id: design-system-a31e0
title: Retokenize the palette — Command-deck dark + derived light, across both token files
status: backlog
type: feature
context: design-system
created: 2026-07-05
completed:
depends_on: [design-system-vw12e, design-system-e9apx]
blocks: [agentic-workflow-vk6mc, agentic-workflow-wsfsk, agentic-workflow-bz3az, agentic-workflow-a2pm1, agentic-workflow-c2ver]
tags: [dashboard-redesign, palette, tokens]
related_adrs: [0003, 0016]
related_research: []
prior_art: [design-system-001, design-system-003, design-system-007]
---

## Why
Every downstream visual task (topbar CTA, prompt bar, flight-plan hero, left nav, ticket cards)
needs the new hex values and the new `--emphasis-border` token to exist before it can consume
them. This is the single biggest unlock in the redesign.

## What
Retokenize **both** `[data-theme]` blocks of `styleguide/styles/colors_and_type.css` (surfaces,
hairlines, the `--accent-ochre` family → the 1b hue `#e5a13c`) and, where the cooler neutral
backdrop demands it, `styleguide/styles/agentheim.css` (status / content-type values) to the 1b
dark palette plus a **derived** light counterpart. Add the `--emphasis-border` token pair (both
themes) per [[design-system-vw12e]], and resolve the frozen-swatch question per
[[design-system-e9apx]]. Token names/roles are unchanged — values only.

## Acceptance criteria
- [ ] Both theme blocks updated; token **names/roles unchanged** (values only), so every unforked
      consumer inherits the new look with no rename.
- [ ] `--accent-ochre` / `-soft` / `-tint` read the 1b hue in dark, with a derived light counterpart.
- [ ] The new `--emphasis-border` token pair exists in both theme blocks.
- [ ] Frozen `--swatch-light` / `--swatch-dark` handled per the ADR-0049 ruling (re-pin vs. stay).
- [ ] `dist/` is **rebuilt by this task itself** (`node build.mjs`) — a token-value-only change with
      no dashboard source edits, per the ds-019 / ds-007 / ds-004 solo-retokenization precedent;
      no separate agentic-workflow wiring task.
- [ ] The canvas (`styleguide/index.html`) is re-reviewed as ONE consolidated gate re-review for
      the whole palette, not per-component.

## Notes
- 1b dark reference values are in the redesign brief and in [[design-system-e9apx]].
- This reopens the styleguide gate (per ADR-0003 / the ds-005/007/009 precedent) — builder
  re-review of the canvas before the agentic-workflow wiring tasks consume it.
