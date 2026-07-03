---
id: widgets-it1
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

Add a `paint(color)` command to `Widget`. Index bookkeeping (moving this task
`doing → done` in `INDEX.md`) is owned by the `work` skill, never the worker.

## Acceptance criteria

- [x] Painting a widget sets its color.

## Outcome

Added `Widget.paint(color)`.
