---
id: design-system-004
title: Dashboard dark-mode toggle
status: backlog
type: feature
context: design-system
created: 2026-06-08
depends_on: [design-system-001-styleguide]
blocks: []
tags: [dashboard, theme, dark-mode, toggle, styleguide]
related_adrs: []
related_research: []
prior_art: [design-system-001, design-system-002]
---

## Why

Captured from the builder (2026-06-08): "the dashboard needs a dark-mode toggle." Theming and the
visual language are owned by this BC — the styleguide is already "dark-first with a light toggle"
(README → The styleguide), so an actual in-UI toggle to switch between dark and light is a
design-system concern. The tokens for both modes are the source of truth here
(`styleguide/styles/colors_and_type.css` / `agentheim.css`); the dashboard app consumes them across
the BC boundary, so the toggle mechanism belongs with the design system that owns the themes.

## What (rough capture — to refine)

A user-facing toggle in the dashboard UI that switches the theme between dark and light. Open shape,
to be decided during refinement:

- Where the toggle lives in the shell (rail? header?).
- How theme is applied (a `data-theme` / class on the root that the token CSS keys off).
- Whether the choice persists (localStorage) and whether it respects `prefers-color-scheme` on
  first load.

## Open questions (for refinement)

- Do light-mode tokens already fully exist, or does this task also produce the missing light palette?
- Persisted preference vs. session-only? Default to OS preference?
- This is a styleguide change (gated) plus a dashboard-app consumption — split into two tasks
  (design-system styleguide toggle + agentic-workflow wiring) or keep as one cross-BC feature?

## Notes

- Pure capture — not yet refined or promoted. No solution committed.
- Frontend/UI task: subject to the styleguide gate (`depends_on: design-system-001-styleguide`).
- The dashboard frontend app that would surface the toggle lives in `agentic-workflow`
  (`dashboard/app/`); coordinate across the BC boundary during refinement — themes here, wiring there.
