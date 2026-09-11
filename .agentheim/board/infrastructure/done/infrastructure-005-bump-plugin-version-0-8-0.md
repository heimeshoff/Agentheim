---
id: infrastructure-005
title: Bump plugin version to 0.8.0 to unblock marketplace updates
status: done
type: chore
context: infrastructure
created: 2026-06-08
completed: 2026-06-08
commit: 41fabcb
depends_on: []
blocks: []
tags: [plugin, packaging, distribution, release, version]
related_adrs: []
related_research: []
prior_art: []
---

## Why

`.claude-plugin/plugin.json` still declares `"version": "0.7.0"`, set by a prior research
commit — but `main` is ~30 commits past it (the dashboard, design-system, and
infrastructure feature work). Because the manifest version is unchanged, `/plugin`
reports *"already at latest version (0.7.0)"* to every marketplace user and never pulls
the new state. A macOS contributor had to mirror the marketplace cache to `main` by hand
just to get the current code. A version bump is what actually ships the accumulated work.

## What

Bump `.claude-plugin/plugin.json` `version` from `0.7.0` to `0.8.0` — a minor bump,
reflecting the new dashboard / design-system / infrastructure features added since 0.7.0
(no breaking changes to the plugin contract).

## Acceptance criteria

- [ ] `.claude-plugin/plugin.json` `version` reads `0.8.0`.
- [ ] No other manifest fields changed.
- [ ] (If the repo has any version reference that must agree — e.g. a changelog or README
      badge — it is updated to match; otherwise N/A.)

## Notes

- One-line change; the value of capturing it is making sure it lands and is not forgotten
  again — the recurrence is the actual problem.
- **Open process question** (not this task): nothing today forces a version bump when
  feature commits land, so the manifest silently drifts and marketplace users stall. Worth
  a follow-up to decide release discipline — a bump-on-feature policy, a release checklist,
  or a CI guard that fails when `main` advances without a manifest bump. Surface to the
  builder whether to capture that separately.

## Outcome

Bumped `.claude-plugin/plugin.json` `version` from `0.7.0` to `0.8.0` (single field; no
other manifest fields touched). This is the version `/plugin` reads to decide whether
marketplace users are up to date, so the accumulated dashboard / design-system /
infrastructure work since 0.7.0 now ships.

No other version reference needed to agree: a repo-wide grep for `0.7.0` found only the
manifest plus narrative mentions in protocol.md and task files (which are not version
sources). No CHANGELOG, README badge, or marketplace/catalog manifest carries the plugin
version. Acceptance criterion 3 is N/A.

Key file: `C:\src\heimeshoff\agentic\agentheim\.claude-plugin\plugin.json`
