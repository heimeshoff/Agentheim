---
id: widgets-srp1
title: Add a resize(weight) command to Widget
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

Downstream layout logic needs widgets that can grow, not just change color.

## What

Add a `resize(weight)` command to `Widget`, enforcing a `MaxWeight` of 100 —
attempts to resize above it are rejected.

## Acceptance criteria

- [x] `Widget.resize(weight)` sets `widget.weight` to `weight` when
      `weight <= 100`.
- [x] `Widget.resize(weight)` throws when `weight > 100`.

## Outcome

Added `Widget.resize(weight)` enforcing the `MaxWeight` invariant. Updated
the BC README's Ubiquitous language section with the new `Resize` and
`MaxWeight` terms.
