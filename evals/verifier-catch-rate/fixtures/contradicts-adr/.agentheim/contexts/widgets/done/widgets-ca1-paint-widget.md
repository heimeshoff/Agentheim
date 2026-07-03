---
id: widgets-ca1
title: Add paint behavior to Widget
status: done
type: feature
context: widgets
created: 2026-07-03
completed: 2026-07-03
depends_on: []
blocks: []
tags: [eval-fixture]
related_adrs: [0001]
related_research: []
prior_art: []
---

## Why

Widgets need to be paintable.

## What

Add a `paint(color)` command to `Widget`, honoring ADR-0001 (colors are the
`Color` enum, never a raw string).

## Acceptance criteria

- [x] Painting a widget sets its color.

## Outcome

Added `Widget.paint(color)`.
