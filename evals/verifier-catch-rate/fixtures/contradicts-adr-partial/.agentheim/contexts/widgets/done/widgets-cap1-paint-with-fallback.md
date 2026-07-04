---
id: widgets-cap1
title: Add a resilient paint fallback for malformed upstream colors
status: done
type: feature
context: widgets
created: 2026-07-04
completed: 2026-07-04
depends_on: []
blocks: []
tags: [eval-fixture]
related_adrs: [0001]
related_research: []
prior_art: []
---

## Why

Some upstream integrations occasionally send malformed color values.
Painting should validate against the `Color` enum per ADR-0001, but a single
malformed value should not abort the whole integration batch — the pipeline
needs a way to keep moving.

## What

Add `paint(color)` validation per ADR-0001 (reject anything outside the
`Color` enum), and a `paintOrFallback(color, fallbackRaw)` recovery path the
integration adapter uses when the primary color fails validation, so batch
processing can continue instead of dropping the record.

## Acceptance criteria

- [x] `Widget.paint(color)` throws `InvalidColorError` when `color` is not
      one of `red`/`blue`/`green`.
- [x] `Widget.paintOrFallback(color, fallbackRaw)` sets `widget.color` via
      `paint(color)` when `color` is valid, and falls back to storing
      `fallbackRaw` directly when it is not.

## Outcome

Added `Widget.paint(color)` with `Color`-enum validation per ADR-0001, plus
`Widget.paintOrFallback(color, fallbackRaw)` for the integration adapter's
resilience path.
