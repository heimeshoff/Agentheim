---
id: widgets-mac1
title: Add paint behavior to Widget
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

Widgets need to be paintable.

## What

Add a `paint(color)` command to `Widget`.

## Acceptance criteria

- [x] Painting a widget sets its color.
- [x] Painting an already-painted widget with the same color throws `AlreadyPaintedError`.

## Outcome

Added `Widget.paint(color)`.
