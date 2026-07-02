---
id: infrastructure-007
title: Stop forgetting to bump the plugin version before a release
status: backlog
type: chore
context: infrastructure
created: 2026-06-08
depends_on: []
blocks: []
tags: [plugin, release, versioning, packaging, discipline]
related_adrs: []
related_research: []
prior_art: [infrastructure-006]
---

## Why

Captured from the builder (2026-06-08): "we keep forgetting to bump the plugin version before a
release." This is a recurring miss, not a one-off — the manifest version drifts because the bump is
a manual step nobody is reminded to do, so releases ship with a stale version. Plugin
packaging/distribution is exactly the kind of globally-true tech concern this BC stands as the home
for (see README → Open questions / future remit), and a sibling decision task already exists on
plugin release discipline (infrastructure-006), so this belongs here.

## What (rough capture — to refine)

Make "bump the plugin version" hard to forget before a release. Open shape, to be decided during
refinement:

- A guardrail/check that fails (or warns) a release when the manifest version hasn't been bumped
  past the last released version.
- And/or a documented release checklist step + a single command that bumps + tags.
- And/or a pre-release hook that prompts for the bump.

## Open questions (for refinement)

- Where does the plugin version actually live (manifest file path), and what's the source of truth
  for "last released version"?
- Automated guard vs. checklist discipline vs. both? Relationship to infrastructure-006 (plugin
  release discipline) — is this the executable counterpart of that decision, or folded into it?
- What counts as "a release" for this plugin (tag, marketplace publish, branch merge)?

## Notes

- Pure capture — not yet refined or promoted. No solution committed.
- Related: infrastructure-006 (Plugin release discipline — stop the manifest version from silently
  drifting). These two should be reconciled during refinement; this one may be its concrete
  enforcement task.
