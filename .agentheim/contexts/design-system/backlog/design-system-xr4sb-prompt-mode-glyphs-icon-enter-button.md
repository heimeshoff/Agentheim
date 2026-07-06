---
id: design-system-xr4sb
title: Prompt-mode tab glyphs + solid-ochre icon Enter-button variant, aligned to 1b
status: backlog
type: feature
context: design-system
created: 2026-07-06
completed:
depends_on: [design-system-001-styleguide]
blocks: [agentic-workflow-q7r3x]
tags: [dashboard-redesign, prompt-bar]
related_adrs: [0048, 0051]
related_research: []
prior_art: [design-system-r4k8m]
---

## Why
Section 1b of the UX-explorations reference (`inspiration/Agentheim UX Explorations.html`)
paints the docked prompt console with a specific mode-tab glyph set and a compact
solid-ochre **icon** Enter button. Both are styleguide-owned primitives the dashboard
consumes, so they belong in `design-system`, not in the `agentic-workflow` consumer.
This task exists to make those primitives available so `agentic-workflow-q7r3x` can wire
them without forking the styleguide (ADR-0003).

## What
Two styleguide additions, both documented in the canvas (`styleguide/index.html`):

1. **Prompt-mode tab glyphs aligned to 1b** — Quick Capture = a plus, Modeling = a
   diamond/rhombus, Inquire = a question mark, Research = a ring/target-circle.
2. **A solid-ochre icon-square Enter-button variant** — a filled `--accent-ochre`
   background with a `↵` return-arrow glyph (not the word "Enter"), a compact ~square
   footprint, distinct from the existing soft/`cta` text-button treatment.

## Acceptance criteria
- [ ] The shared icon set exposes the four prompt-mode glyphs matching 1b (plus /
      diamond / question / ring). **Resolve the post-1b tension explicitly:**
      `design-system-r4k8m` deliberately added an inquire glyph and ADR-0049's
      Command-deck identity post-dates 1b — so "match 1b" is not automatically "revert
      to 1b". Per glyph, either 1b supersedes the current one (retire the old with a
      note / ADR if it reverses a shipped decision) or the current glyph is kept as the
      intended evolution; record which and why.
- [ ] A solid-ochre icon-square Enter-button variant exists in the styleguide: filled
      `--accent-ochre`, a `↵` glyph, ~square footprint (radius near `--radius-sm`),
      visibly distinct from the soft `cta` text button. It sits within ADR-0048's
      "primed primary action" carve-out (the Enter affordance fires a launch), so it is
      not a new accent exception.
- [ ] Glyph contrast on the ochre fill meets the styleguide legibility bar.
- [ ] Both are rendered in context in the styleguide canvas.
- [ ] Styleguide + dashboard suites green.

## Notes
- Blocks `agentic-workflow-q7r3x` (the dashboard consumer that wires these in).
- Scope is styleguide primitives only. The tab-cell **layout**, the active-tab
  **underline** paint (ADR-0051 intent), the ochre **chevron**, and the subtitle copy
  are all consumer-side and live in `agentic-workflow-q7r3x` — not here.
- Deltas were read from a side-by-side of `1b.png` (Section 1b) and `yours.png` (live
  bar) on 2026-07-06.
- Open call this task carries: whether 1b's Inquire "?" supersedes `design-system-r4k8m`.
  Settle it during this task's own refine or at execution; do not blindly revert good
  post-1b work.
