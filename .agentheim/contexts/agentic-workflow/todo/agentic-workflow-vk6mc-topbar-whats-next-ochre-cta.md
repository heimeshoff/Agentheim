---
id: agentic-workflow-vk6mc
title: Topbar — recolor What's-next to the ochre CTA; regression-guard the unchanged parts
status: todo
type: feature
context: agentic-workflow
created: 2026-07-05
completed:
depends_on: [design-system-vw12e, design-system-a31e0, design-system-001-styleguide]
blocks: []
tags: [dashboard-redesign, topbar, whats-next, skip-permissions]
related_adrs: [0016]
related_research: []
prior_art: [agentic-workflow-064, agentic-workflow-069, agentic-workflow-053, agentic-workflow-041, agentic-workflow-029]
---

## Why
The one genuine topbar *color* change the brief asks for. Several adjacent brief items — search at
the far left (1a position), the settings gear immediately left of What's-next, and the
skip-permissions **red-icon** armed cue — are **already true today**, so they only need explicit
regression protection while the surrounding reskin lands.

## What
Recolor the What's-next `LaunchButton` in `BoardTopbar` (`dashboard/app/board.js`) to the new ochre
CTA treatment (orange text on the warm-dark fill/border from the palette task), applying the
accent carve-out [[design-system-vw12e]]. Leave `Work`'s existing treatment untouched.

## Acceptance criteria
- [ ] What's-next button renders from the new palette tokens (no hardcoded hex).
- [ ] Global search field remains the topbar's **leftmost** element (1a position) — explicit
      regression check.
- [ ] Ordering holds: settings gear immediately left of What's-next, which is immediately left of
      Work — no reorder.
- [ ] **Skip-permissions-armed icon(s) still render `--obligation` red** regardless of the new ochre
      CTA — the aw-041 behavior explicitly re-verified, not assumed.

## Notes
- The "menu button" the builder wants kept is the aw-049 settings menu (shared `Menu` primitive,
  ds-015), carrying the theme + skip-permissions toggles (aw-029).
- Prior art: aw-064 (What's-next + Work restyle), aw-069 (button fires the whats-next skill),
  aw-053 (right-align settings/work), aw-041 (armed = red icon), aw-029 (topbar toggles).
- Depends on the palette [[design-system-a31e0]] and the accent decision [[design-system-vw12e]].
