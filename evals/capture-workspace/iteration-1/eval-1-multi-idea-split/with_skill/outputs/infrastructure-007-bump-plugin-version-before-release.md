---
id: infrastructure-007
title: Stop forgetting to bump the plugin version before a release
status: backlog
type: chore
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
We keep forgetting to bump the plugin version before a release.

## What
Make sure the plugin version gets bumped before a release so it doesn't get
skipped. We keep forgetting to do it.

## Acceptance criteria
- [ ] To be defined during refinement.

## Notes
Captured via `capture` on 2026-06-08 — raw, unrefined. Needs a `modeling` refine pass
before it can be promoted. Likely overlaps with the existing backlog item
`infrastructure-006` (Plugin release discipline — stop the manifest version from silently
drifting); refinement should reconcile/merge the two rather than duplicate.
