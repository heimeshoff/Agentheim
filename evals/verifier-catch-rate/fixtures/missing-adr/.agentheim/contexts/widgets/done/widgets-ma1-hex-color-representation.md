---
id: widgets-ma1
title: Store Widget colors as hex strings instead of the Color enum
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

A future integration needs arbitrary RGB colors, not just the three named
`Color` enum values.

## What

Change `Widget.color` to accept a hex string (e.g. `#ff0000`) instead of the
`Color` enum, so any RGB value can be represented — a representational
decision a future maintainer would clearly ask "why not keep the enum?"
about.

## Acceptance criteria

- [x] `Widget.paint('#ff0000')` sets `widget.color` to `'#ff0000'`.

## Outcome

Changed `Widget.color` to a hex-string representation.
