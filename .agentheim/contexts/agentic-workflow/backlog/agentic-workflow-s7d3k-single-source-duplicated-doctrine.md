---
id: agentic-workflow-s7d3k
title: Single-source the duplicated doctrine into references/ files
status: backlog
type: refactor
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, doctrine-drift, skills, single-sourcing]
related_adrs: []
related_research: []
prior_art: []
---

## Why

Copy-pasted doctrine drifts: the ID convention is duplicated verbatim in 3
files, the strict worker return format in 2 (already diverged — that's confirmed
defect #1, agentic-workflow-f7k2d), commit rules in 4. `references/modes.md`
proves the right pattern — one file, skills point at it. (Harness audit
2026-07-02, doctrine single-sourcing gap.)

## What

Inventory the duplicated doctrine blocks (ID grammar, strict return formats,
commit rules at minimum), extract each into a `references/` file, and replace
the inline copies with pointers — the `modes.md` pattern, generalized. Keep a
one-line summary at each former site so skills stay readable without the hop.

## Acceptance criteria

- [ ] ID grammar, worker return format, and commit rules each live in exactly one file.
- [ ] Every skill/agent that needs them points at that file instead of restating it.
- [ ] A grep for the moved doctrine's distinctive phrases finds one definition site each.
- [ ] No behavior change — this is a relocation, not a rewrite.

## Notes

Sequence after agentic-workflow-f7k2d (fix the live drift first, then
single-source so it can't recur). Consider whether agents can reliably read
`references/` across plugin installs — same path-resolution caveat as the
k5n8f scripts.
