---
id: infrastructure-007
title: Throttle the dashboard file-watcher against burst tree-changed events
status: backlog
type: feature
context: infrastructure
created: 2026-06-08
completed:
commit:
depends_on: []
blocks: []
tags: [captured]
related_adrs: []
related_research: []
prior_art: []
---

## Why
A huge git checkout can fire a thousand tree-changed events at once.

## What
Throttle the dashboard's file-watcher so a large bulk filesystem change (e.g. a big git
checkout) doesn't fire a thousand `tree-changed` events at once.

## Acceptance criteria
- [ ] To be defined during refinement.

## Notes
Captured via `capture` on 2026-06-08 — raw, unrefined. Needs a `modeling` refine pass before
it can be promoted.
