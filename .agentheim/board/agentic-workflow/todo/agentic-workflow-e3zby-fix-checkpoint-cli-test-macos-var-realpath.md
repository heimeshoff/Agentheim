---
id: agentic-workflow-e3zby
title: Checkpoint guard compares real paths on both sides, so symlinked project paths (incl. macOS /var → /private/var) no longer silently refuse worker files; fixes the red "real checkpoint invocation" lib test
status: todo
type: bug
context: agentic-workflow
created: 2026-11-03
completed:
depends_on: []
blocks: []
tags: [captured, checkpoint-guard, symlink, worktree]
related_adrs: [ADR-0057, ADR-0074, ADR-0085]
related_research: []
prior_art: [agentic-workflow-q7v3k, agentic-workflow-gvcy8]
---

## Why
The lib test "the real `node lib/task-lifecycle-cli.mjs checkpoint <id> <json-opts>` invocation
filters derived artifacts and exits 0" (`lib/test/task-lifecycle-cli.test.mjs:484`) was red on
`main` for the whole 2026-11-03 session.

Root cause (diagnosed by the agentic-workflow-gvcy8 worker, confirmed at refinement): on macOS,
`/var` is a symlink to `/private/var`. The test's fixture root is `mkdtempSync(...)` →
`/var/folders/...`, while the CLI's cwd resolves to the real path `/private/var/...`. The guard in
`lib/derived-artifact-guard.mjs` computes `path.relative(worktreeRoot, filePath)` (line 89) on
un-normalised strings. So every file looks like it is outside the worktree, and `changed` comes back
`[]`.

This is not just a test bug. Any real project whose path passes through a symlink (e.g. a
symlinked `~/Dev`) hits the same mismatch between the worker's reported absolute paths and the
worktree root. The checkpoint then **silently refuses every file the worker changed** with
`outside-worktree`, and the worker's work never gets staged. Builder decision (2026-11-03): fix the
guard, not only the test.

## What
- `lib/derived-artifact-guard.mjs`: normalise both sides to real paths before comparing.
  - Resolve `worktreeRoot` with `realpathSync`.
  - For each declared file, resolve the real path of the file, or, if the file no longer exists
    (e.g. a deletion in FILE_LIST), of its deepest existing ancestor, then re-append the missing tail.
  - Use the resolved values for both the inside-worktree test and the relative path used for prefix
    matching: `DERIVED_ARTIFACT_PREFIXES`, `BOOKKEEPING_PATH_PREFIXES`,
    `SOURCE_UNDER_AGENTHEIM_PREFIXES`.
  - The manifest keeps reporting the paths as the caller passed them, so `git add` still receives
    paths valid in the worktree.
- `lib/test/task-lifecycle-cli.test.mjs:484`: once the guard is fixed, the existing test should pass
  unchanged. Keep it as-is, because it now doubles as a regression test for the `/var` case. Only
  add `realpathSync` if the test itself needs it for some other reason, and say why.
- Add a regression test in `lib/test/derived-artifact-guard.test.mjs`:
  - a fixture worktree reached through a **symlinked** directory (create a symlink to a temp dir);
  - file paths given through the symlink;
  - the root given as the real path (and the reverse);
  - expect source files in `changed`, a `dashboard/dist/` path refused as `derived-artifact`, and a
    `.agentheim/board/` path refused as `bookkeeping-path`.

## Acceptance criteria
- [ ] `node --test lib/test/task-lifecycle-cli.test.mjs`: the "real checkpoint invocation" test passes on macOS without any change to its fixture setup. If a change was needed, the Outcome explains why.
- [ ] A new test in `lib/test/derived-artifact-guard.test.mjs` builds a worktree reachable through a symlink and checks both mixed forms (symlinked file paths with a real root, and real file paths with a symlinked root). Source files land in `changed`, a `dashboard/dist/` file is refused as `derived-artifact`, and a `.agentheim/board/` file is refused as `bookkeeping-path`. This test fails against the current guard.
- [ ] A FILE_LIST entry for a file that no longer exists (deleted in the worktree) is still classified correctly (staged as a deletion if it is source, refused if it matches a refused prefix), not thrown on and not mis-reported as `outside-worktree` (test).
- [ ] A path that is genuinely outside the worktree, even after resolving real paths, is still refused as `outside-worktree` (test).
- [ ] The manifest's `changed` entries remain exactly the paths the caller passed in (not rewritten to real paths), so the conductor's `git -C <worktree> add` keeps working (test).
- [ ] `node --test lib/test/*.test.mjs` has zero failures, apart from the known-flaky layout-migration lifecycle-lock test if it happens to flake.

## Notes
- Refined from a quick-capture on 2026-11-03. The scope widened at refinement from "test only" to
  "guard + test" by builder decision.
- Keep the guard's contract: it is still judged against the declared FILE_LIST, never by scanning the
  working tree. Resolving real paths for the declared entries and the root is the only filesystem
  access added.
- No `dashboard/` change, so no node_modules link is needed for this task.
