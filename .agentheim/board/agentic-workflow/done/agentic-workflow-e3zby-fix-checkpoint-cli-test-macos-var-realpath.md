---
id: agentic-workflow-e3zby
title: Checkpoint guard compares real paths on both sides, so symlinked project paths (incl. macOS /var → /private/var) no longer silently refuse worker files; fixes the red "real checkpoint invocation" lib test
status: done
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

## Verifier note (iteration 1)

**REASONS:**
- Criterion 2 is only partly covered. The one new test (`lib/test/derived-artifact-guard.test.mjs:208`) checks a single form: symlinked file paths against a real root. Nothing tests real file paths against a symlinked root, and no `.agentheim/board/` path is asserted as `bookkeeping-path` under a symlinked root.
- Criterion 3 has no dedicated test. A deleted FILE_LIST entry is exercised only in passing (`lib/x.mjs` doesn't exist in the fixture). Nothing asserts that a missing path under a refused prefix gets the right reason rather than `outside-worktree`.
- Criterion 4 has no new test. The pre-existing test at line 80 doesn't go through the realpath code.
- Criterion 5 is covered for one form only. Nothing asserts `changed` keeps the caller's exact strings in the reverse mixed form.
- The verifier stopped at check 1; checks 2–8 were not evaluated.

**SUGGESTED_FIX:** In `lib/test/derived-artifact-guard.test.mjs`, add tests named after each behaviour that fail without the `realish()` change:
- (a) A symlinked root with real file paths, plus the existing reverse form. Each asserts source in `changed` with the caller's exact strings, `dashboard/dist/` refused as `derived-artifact`, and `.agentheim/board/` refused as `bookkeeping-path`.
- (b) A deleted FILE_LIST entry under a symlinked or real root: a source path (staged) and a refused-prefix path (refused with the correct reason, not `outside-worktree`), with no throw.
- (c) A path genuinely outside the worktree (e.g. a sibling temp dir reached through the symlink) still refused as `outside-worktree`.

**ITERATION_HINT:** likely-fixable

## Verifier note (iteration 2)

**REASONS:**
- Check 6b (honored related ADRs) FAILS. ADR-0057's Decision → Implementation (lines 87–88) states the guard is "pure, stdlib-only (`node:path`), git-free, side-effect-free". The diff adds `realpathSync` from `node:fs` and filesystem reads in `realish()`, so the guard's output now depends on filesystem state. That is a recorded decision being relaxed with no amendment (ADRS block empty). ADR-0057 already uses the `## Amendment (...)` pattern (w2njd, w45ce).
- The module's own header (`lib/derived-artifact-guard.mjs:17–23`) still says "stdlib-only (node:path)" and "never touches the filesystem". The code now contradicts it.
- Everything else passes:
  - Check 1: all 6 criteria map to assertions; C4's "still refused" reading as a regression guard holds.
  - Iteration-1 note: fully addressed.
  - Suite: 884/885, with the one failure being the known-flaky lifecycle-lock test.
  - Scope: clean.

**SUGGESTED_FIX:**
- Update the header comment to name the one bounded, read-only filesystem access: realpath resolution of the root and the declared entries, still never a tree walk, still git-free and write-free.
- Record an `## Amendment (agentic-workflow-e3zby)` to ADR-0057 explaining the relaxation from "pure / node:path-only" and why: macOS /var → /private/var, and symlinked project paths.

**ITERATION_HINT:** likely-fixable

## Outcome

`lib/derived-artifact-guard.mjs` normalises both sides of `path.relative` through `realish()`. It resolves symlinks on the longest existing ancestor and re-appends the missing tail, so deleted FILE_LIST entries still resolve. The module header now describes the bounded read-only realpath access, and an ADR-0057 amendment is reported in the ADRS block. The ADR-0085 styleguide carve-out is unchanged.

Three tests in `lib/test/derived-artifact-guard.test.mjs` cover:
- a symlinked root with real paths, and the reverse;
- deleted entries under a symlinked root;
- a genuinely outside path reached through a symlink.

The full run gives 885 pass on a clean run. On other runs the only failure is the known flaky layout-migration lifecycle-lock test (a race between two child processes). It fails intermittently when run alone too, and is unrelated to this change.
