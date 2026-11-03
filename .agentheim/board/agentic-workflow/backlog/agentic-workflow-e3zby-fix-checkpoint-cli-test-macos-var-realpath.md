---
id: agentic-workflow-e3zby
title: Fix the red "real checkpoint invocation" lib test — realpath its mkdtemp fixture root (macOS /var vs /private/var mismatch)
status: backlog
type: bug
context: agentic-workflow
created: 2026-11-03
completed:
depends_on: []
blocks: []
tags: [captured]
related_adrs: []
related_research: []
prior_art: []
---

## Why
The lib test "the real `node lib/task-lifecycle-cli.mjs checkpoint <id> <json-opts>` invocation
filters derived artifacts and exits 0" in `lib/test/task-lifecycle-cli.test.mjs` has been failing
on `main` throughout the 2026-11-03 session. Every work run has had to carry it as a known baseline
failure.

## What
- **Root cause**, diagnosed by the agentic-workflow-gvcy8 worker: on macOS, `/var` is a symlink to
  `/private/var`.
  - The test's `mkdtemp` fixture root is `/var/folders/...`.
  - The CLI's cwd resolves to the realpath, `/private/var/...`.
  - The checkpoint guard therefore treats the file as outside the worktree, and `changed` comes back
    `[]`.
- **Fix:** call `realpathSync` on the fixture root in that test. The new CLI test in
  `lib/test/derived-artifact-guard.test.mjs` (gvcy8) already does this. It should be a one-line
  fix.

## Acceptance criteria
- [ ] To be defined during refinement.

## Notes
Captured via `quick-capture` on 2026-11-03 — raw, unrefined. Needs a `modeling` refine pass before
it can be promoted.
