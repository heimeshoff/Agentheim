---
id: agentic-workflow-tgr31
title: Dogfood the migration — `migrate` already moved this repo's `.agentheim/` on `main` (commit 6fbaad2, 2026-09-11); finish it: re-point the 20 app specifiers and 5 test-side styleguide reads to `knowledge/contexts/`, flip the two live-tree tests still asserting `legacy`, and prove both suites, the rebuilt `dist/`, and the dashboard green on the migrated tree
status: backlog
type: chore
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-zgav8, agentic-workflow-hxq1g]
blocks: [agentic-workflow-g5ez5]
tags: [layout, migration, dogfood, upgrade]
related_adrs: [0078, 0074, 0075, 0057, 0047, 0039]
related_research: []
prior_art: [agentic-workflow-ghcaj, agentic-workflow-fn59c]
---

## Why

ADR-0078 is only real once this repo lives under it. The tree move itself could never run
inside a worker: a worker branch carries source and tests only and never writes under
`.agentheim/` (ADR-0074), and a worktree's copy of the tree is not `main`'s. So the move
was designed to happen on `main` through any skill's step 0 — and it did: on 2026-09-11
the `modeling` skill's "Before acting" step 0 ran `migrate` against this repo and committed
the result as `6fbaad2` (`chore(agentheim): migrate .agentheim/ to the two-root layout
(ADR-0078)`). Every layout-side criterion below was verified at that moment (see Notes).

What is left is the code half the move could not carry: the dashboard's 20 literal
styleguide import specifiers, five test files that read the styleguide from disk, and two
live-tree tests that still assert the repo is `legacy`. Until those land, the lib suite has
two genuine failures and the dashboard suite has ~30, so `main` is expected-red on exactly
that set. This task is the gate before g5ez5's closure can refuse the legacy layout
anywhere.

## What

**Execution model (changed at the 2026-09-11 refinement):** the residual is source and
tests only, so this is now an ordinary worker task — a worktree branched from post-`6fbaad2`
`main` already carries the `board` layout, and `migrate` is a zero-write noop everywhere
(`{ok:true, verb:'migrate', noop:true}`). The conductor does not run the verb again and
never hand-moves anything. If a step-0 call ever reports something other than `noop:true`
on this repo, stop and bounce this task with the manifest — that is a verb defect for an
e896r follow-up.

1. **Re-point the 20 app-side ESM specifiers** in `dashboard/app/{app,board,main-pane-reader,slide-over}.js`
   (1 / 14 / 3 / 2 occurrences, at `app.js:16`, `board.js:41-54`, `main-pane-reader.js:24-26`,
   `slide-over.js:28-29`) from `../../.agentheim/contexts/design-system/styleguide/…` to
   `../../.agentheim/knowledge/contexts/design-system/styleguide/…`. They must spell the
   on-disk path — the jsdom tests resolve them through node directly, and
   `build.mjs`'s `styleguideRedirectPlugin` (hxq1g) keeps working either way because it
   matches on the `design-system/styleguide/app/<file>.js` suffix.
2. **Re-point the 5 test-side on-disk reads** that `legacy-path-literal-lint` does not
   flag (they are `path.join` segments or test-local imports) but that now `ENOENT` /
   `ERR_MODULE_NOT_FOUND` on the migrated tree:
   - `dashboard/test/backlog-card-launch.test.mjs:34` (`kanban.js` source read)
   - `dashboard/test/dist-build.test.mjs:123` (`styles/` token-CSS comparison)
   - `dashboard/test/model-split-button-dom.test.mjs` (7 × `button.js` dynamic import,
     lines 50, 149, 166, 191, 211, 228, 242)
   - `dashboard/test/settings-menu.test.mjs:45` (`icons.js`)
   - `dashboard/test/shell-relayout.test.mjs:29` (`library.js`)
   Prefer resolving the `path.join` reads through `styleguideDir(repoRoot)` from
   `lib/task-system-paths.mjs` (the way `build.mjs` and `build-stamp.mjs` already do); a
   literal `knowledge/contexts/…` path is acceptable for the dynamic-import strings. The
   `contexts/alpha`-style fixture paths in the other test files are synthetic legacy-shaped
   fixtures the dual-layout readers still support — leave them alone.
3. **Flip the two live-tree tests that assert the old layout:**
   - `lib/test/task-system-paths.test.mjs:147` — `detectLayout: the live repo root resolves
     "legacy" today` must assert `'board'` (and be renamed accordingly).
   - `lib/test/legacy-path-literal-lint.test.mjs:219` — the assertion (`[]`) is already
     layout-agnostic; only its title ("…still legacy") is stale. Rename it.
4. **Do not rebuild `dashboard/dist/`** on the worker branch (ADR-0057 — derived artifacts
   are unstageable from a worktree). The conductor rebuilds from merged source on `main`
   at integration with `npm run build` in `dashboard/` and commits `dist/` in the
   integrating commit; the `dist-staleness` test is expected red on the branch and green
   after that rebuild. `build.mjs` itself needs no edit — it already resolves the styleguide
   per layout.
5. **Completion:** the conductor's OUTCOME names both the migration commit (`6fbaad2`, 22
   manifest entries, 342 pure renames) and the integrating commit of this task.

**Out of scope:** removing `legacy-path-literal-lint`'s layout-gated tolerance for the 20
specifiers, hardening any consumer to refuse `legacy` with `{code:'legacy-layout'}`
(ADR-0078 §5), and the top-level `index.md` `bc-list` pointers (deliberately untouched —
they resolve relative to `index.md` into the knowledge half, ADR-0078 §6). All of that is
g5ez5's closure. Any other code change is out of scope too.

## Acceptance criteria

- [ ] `detectLayout(<repo root>)` returns `board`; `.agentheim/` lists exactly `knowledge/`,
      `board/`, and the gitignored runtime folders (`state/`, `salvage/`, `.dashboard/`);
      no `.agentheim/contexts/`, `.agentheim/vision.md`, or `.agentheim/context-map.md`
      exists on `main`. (Held since `6fbaad2`; re-check, don't redo.)
- [ ] `git show --name-status --find-renames 6fbaad2` reports every task file, README,
      protocol file, and done-archive as a rename (342 × `R100`, README `R099`); the only
      non-renames are the three per-BC INDEX splits (each legacy `INDEX.md` becomes a
      task-half `A` + knowledge-half `A`/`R0xx`) and the `M` on `knowledge/index.md`.
      `git log --follow` on `board/agentic-workflow/done/agentic-workflow-ghcaj-*.md`
      reaches its pre-migration history (`dc1b15f`).
- [ ] Per-BC task-half INDEX section counts equal the folder contents, and every ADR link
      in each knowledge-half INDEX resolves to a file under `knowledge/decisions/`.
- [ ] `node --test lib/test/*.test.mjs` from the repo root is green on the migrated `main`
      (there is no root `package.json`; the lib suite is invoked directly — Node 25 needs
      the explicit glob). The lock-wait test in `lifecycle-lock.test.mjs` may `EPERM` under
      parallel load on Windows and passes alone; that is a pre-existing flake, not a
      finding.
- [ ] `npm test` in `dashboard/` is green on the migrated `main` after the conductor's
      rebuild — including `dist-build`'s token-CSS test, the ten jsdom mounts that import
      the styleguide, and `build-layout`'s board fixture. The two fixed-port bridge tests
      `EADDRINUSE` while the builder's VS Code bridge holds `:31425`, and
      `foreign-launch`'s `rmSync` teardown may `EPERM`; both are known environmental, not
      findings.
- [ ] `npm run build` in `dashboard/` succeeds on `main` and the `dist-staleness` test is
      green post-integration.
- [ ] After the re-point, `dashboard/app/*.js` and `dashboard/test/*.mjs` contain zero
      on-disk reads or import specifiers under `.agentheim/contexts/design-system/`;
      `findLegacyPathViolations(<repo root>)` returns `[]`; and the two flipped lib tests
      assert / are titled for `board`.
- [ ] The dashboard's `/api/tree` on the migrated project reports `layout: "board"`,
      `migrationPending: false`, `warnings: []`, `readme`/`index`/`knowledgeIndex` paths
      under `knowledge/contexts/` and `board/`, and the same lifecycle counts the folders
      hold (agentic-workflow done = 200 at refinement time). `board/<bc>/done-archive/*.md`
      exists for every BC that had one, and each task-half INDEX's `### Done` header still
      names `done-archive/`, so modeling's prior-art lookup keeps finding archived lines.
- [ ] No hand-written protocol entry describes the migration. The verb writes none by
      design (its manifest is `changed: ['.agentheim']`, git-free, ADR-0078 §4); the record
      is the `6fbaad2` commit, the `Modeling / Refined` entry of 2026-09-11 that reports
      step 0 ran it, and this task's own completion entry whose OUTCOME names the hash.
- [ ] Board, rail, and library look unchanged to the builder apart from paths. [human-eye]

## Notes

- **ADR-0059 disposition:** not applicable — a one-time operational action, no convention
  established.
- **Verified at the 2026-09-11 refinement, immediately after `6fbaad2`:** `detectLayout`
  → `board`; manifest `moved.length` = 22 (vision, protocol + archive, and per BC the
  lifecycle folders, `done-archive/`, README, `styleguide/` for design-system, and the
  INDEX split); `git show --name-status --find-renames` = 342 R100 + 1 R099 (README) +
  1 R072 / 1 R063 (INDEX halves) + 4 A + 1 D + 1 M; `git log --follow` on the ghcaj done
  file reaches `dc1b15f`; every knowledge-half ADR link resolves (5 in agentic-workflow);
  dashboard relaunched on the migrated tree → `layout: board`, `migrationPending: false`,
  no warnings, agentic-workflow backlog 2 / todo 1 / done 200, design-system done 37,
  infrastructure done 34. `scoped-commit` needed 2 attempts on `git add` (a sibling held
  `.git/index.lock` briefly) — the retry worked as designed.
- **Suite state on the migrated tree before this task (the expected-red set):** lib 645/648
  — `task-system-paths.test.mjs:147` (asserts `legacy`), the lint test (20 specifier
  violations now that the layout gate is `board`), and the lock-wait EPERM flake;
  dashboard 931/965 — 60 `ERR_MODULE_NOT_FOUND` on the styleguide specifiers, the five
  test-side reads above, and 2 bridge `EADDRINUSE`.
- **Pre-flight that step 0 observed and that the worker inherits as "nothing to do":** no
  `aw/` worktree was registered (the verb refuses `worktree-active` otherwise); the
  dashboard was stopped before the move because its recursive `fs.watch` holds
  `.agentheim/` open, and relaunched afterwards on the same port (41135). The dashboard's
  pre-migration bundle kept serving throughout because the styleguide is inlined into
  `dist/app.js` at build time.
- The stale plugin cache (0.9.3) still carries neither step 0 nor the new paths; conduct
  from the repo's own `skills/` until a release refreshes it — the repo-root-first
  bootstrap already resolves the repo's `lib/`.
- Parent: agentic-workflow-g5ez5 (its closure depends on this); decision record: ADR-0078.
