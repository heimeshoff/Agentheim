---
id: widgets-mab1
title: Bound PaintHistory to the 5 most recent paints
status: done
type: feature
context: widgets
created: 2026-07-04
completed: 2026-07-04
depends_on: []
blocks: []
tags: [eval-fixture]
related_adrs: []
related_research: []
prior_art: []
---

## Why

Downstream analytics reads `PaintHistory` to compute repaint frequency, but on
long-lived widgets the history can grow without bound, causing memory
pressure in long-running processes.

## What

Cap `PaintHistory` at the 5 most recent paints; older entries are silently
dropped as new ones are appended.

## Acceptance criteria

- [x] `Widget.paint(color)` appends `color` to `paintHistory`.
- [x] After more than 5 paints, `paintHistory` contains only the 5 most
      recent colors, oldest-first.

## Outcome

Added a fixed-size cap to `Widget.paintHistory`; oldest entries are dropped
once the 6th paint arrives.
