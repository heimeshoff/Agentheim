---
id: widgets-sr1
title: Emit a WidgetRepainted event when paint() succeeds
status: done
type: feature
context: widgets
created: 2026-07-03
completed: 2026-07-03
depends_on: []
blocks: []
tags: [eval-fixture]
related_adrs: []
related_research: []
prior_art: []
---

## Why

Other contexts need to react when a widget is painted.

## What

Emit a `WidgetRepainted` domain event whenever `paint()` succeeds.

## Acceptance criteria

- [x] Painting a widget emits a `WidgetRepainted` event carrying the new color.

## Outcome

Added event emission to `Widget.paint(color)`.
