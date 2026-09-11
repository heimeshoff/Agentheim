---
id: agentic-workflow-hxq1g
title: Dashboard reads the two-root layout — `tree.mjs` resolves through `task-system-paths`, BCs enumerate from `knowledge/contexts/` with orphan `board/` folders as warnings, the styleguide bundle and its 20 ESM imports re-point, and a legacy or mixed tree renders a "layout migration pending" notice; dist rebuilt
status: done
type: refactor
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-cj54k]
blocks: [agentic-workflow-tgr31]
tags: [layout, dashboard, styleguide, build, upgrade]
related_adrs: [0078, 0017, 0057, 0070]
related_research: []
prior_art: [agentic-workflow-mvt8x, agentic-workflow-rw6ck, agentic-workflow-bmn29]
---

## Why

The dashboard is read-only (ADR-0017) and must render either layout correctly — before
this repo migrates it sees a legacy tree, afterwards a board tree, and a consumer who
upgrades the plugin before running any skill sees a legacy tree with no way to migrate
from the dashboard. Today `dashboard/tree.mjs` enumerates BCs with `readdir(contexts/)`
and `dashboard/build.mjs` plus four app files import the styleguide from
`.agentheim/contexts/design-system/styleguide/`. Needs only cj54k's path module, so it
runs in parallel with e896r and zgav8.

## What

1. **`dashboard/tree.mjs`** resolves every `.agentheim/` path through
   `lib/task-system-paths.mjs` — the first `dashboard → lib` import (today the only
   cross-import is `lib → dashboard` for `discoverRoot`); record the reversed edge in a
   module comment and in the BC README's runtime-surface section via the README delta.
   BC enumeration switches to `listKnowledgeContexts` (ADR-0078 §6); a `board/<bc>/` with
   no README lands in a `warnings: [{code:'orphan-task-folder', bc}]` array on the
   `buildTree` payload, never dropped and never a crash.

   **Detect once, then override (non-obvious, load-bearing).** Every getter in
   `task-system-paths.mjs` *throws* `Error` with `.code === 'mixed-layout'` on a mixed
   detect. `buildTree` therefore calls `detectLayout(root)` **once**, short-circuits on
   `mixed` before touching any getter (item 2), and otherwise threads the resolved
   `{layout}` opt into every getter call so one build is internally consistent even if the
   tree changes under it mid-walk.

   **`projectContext` is re-shaped, not just re-pointed.** Its current signature
   `projectContext(root, bcDir, bcName)` assumes one directory holds a BC's lifecycle
   folders, README, INDEX and `concepts/`. Under `board/` those live under two roots, so
   it becomes `projectContext(root, bcName, layout)` and resolves each surface through its
   own getter — `taskFolderPath`, `bcReadmePath`, `taskIndexPath`, `knowledgeIndexPath`,
   `bcConceptsDir`.

   **Per-BC index pointer (builder decision, 2026-09-06):** `contexts[].index` keeps its
   meaning as the *task* half (`board/<bc>/INDEX.md`), and a new sibling field
   `contexts[].knowledgeIndex` points at `knowledge/contexts/<bc>/INDEX.md`. Under
   `legacy` both resolve to the same file, so every existing app-side reader of `.index`
   keeps working through the transition unchanged.

   Also re-pointed in the same pass: `buildTree`'s `locations.vision` and
   `locations.contextMap` (both move into `knowledge/` under `board/`) via `visionPath` /
   `contextMapPath`, and `dashboard/project-name.mjs`'s own hardcoded
   `path.join(root, '.agentheim', 'vision.md')` — a *second*, independent vision literal
   that the styleguide sweep would otherwise miss. `locations.adrs` / `locations.research`
   are unchanged across both layouts (ADR-0078 §7) but route through `decisionsDir` /
   `researchDir` anyway so no raw join survives in this file.

   *Scope correction (verified against the code, 2026-09-06):* `tree.mjs` reads **no
   protocol feed and no `done-archive/`** — `LIFECYCLE_FOLDERS` is
   `['backlog','todo','doing','done']` and nothing in `dashboard/` reads `protocol.md`.
   The earlier draft's "done-archive prior-art reads, the protocol feed" line was wrong;
   there is nothing there to re-point. `dashboard/search.mjs` builds its corpus from the
   `tree.contexts` payload, so it follows for free — no edit.

2. **`migrationPending` flag** on the `buildTree` payload: `true` for `legacy` and `mixed`
   (with `layout` carried alongside); the board renders a notice — "layout migration
   pending — run any Agentheim skill" — instead of an empty board or a legacy-shaped
   board. On `mixed` the short-circuit returns a payload carrying `root`, `layout`,
   `migrationPending:true` and empty `contexts` / `locations` rather than propagating the
   getters' `mixed-layout` throw — a half-migrated tree must render the notice, not a 500.
   The dashboard **never** invokes `migrate` (ADR-0017).
3. **Styleguide re-point:** `dashboard/build.mjs`'s STYLEGUIDE constant,
   `dashboard/build-stamp.mjs`'s own separate styleguide join, and the **20** literal ESM
   import paths across `dashboard/app/{board.js (14), app.js (1), main-pane-reader.js (3),
   slide-over.js (2)}` resolve the styleguide via `styleguideDir` (build-time) so the
   bundle works from either location during the transition. (The earlier draft said 14 —
   that was `board.js`'s share, not the total; counted on disk 2026-09-06.)
4. **`dashboard/dist/`** rebuilt and staged per ADR-0057 (conductor rebuilds on main after
   the squash; worker rebuilds in the worktree so `dist-staleness` is green).

Out of scope: `dashboard/app/live-frame-router.js` (unrecognized paths already classify
as structural — no edit), any `lib/` verb, any skill prose.

## Acceptance criteria

- [ ] A fixture-diff test builds `buildTree` against a legacy fixture and the same content
      as a board fixture and asserts identical output modulo the path prefixes
      (`contexts/<bc>/` ↔ `board/<bc>/` / `knowledge/contexts/<bc>/`), across all four
      lifecycle folders, `readme`, `concepts`, and `locations.{vision,contextMap,adrs,research}`.
- [ ] On a board fixture `contexts[].index` points at `board/<bc>/INDEX.md` and
      `contexts[].knowledgeIndex` at `knowledge/contexts/<bc>/INDEX.md`; on a legacy
      fixture both point at the same `contexts/<bc>/INDEX.md`.
- [ ] A board fixture with `board/orphan/` and no `knowledge/contexts/orphan/` yields
      `warnings:[{code:'orphan-task-folder', bc:'orphan'}]` and the other BCs render
      normally.
- [ ] `buildTree` on a legacy fixture and on a mixed fixture returns
      `migrationPending:true` with the matching `layout`; on a board fixture `false`. The
      mixed case **returns a payload — it does not throw**; no `mixed-layout` error escapes
      `buildTree` for any of the three layouts.
- [ ] The notice text appears in the rendered board for `migrationPending:true` and no
      task columns are drawn (DOM assertion in the existing board test harness).
- [ ] `dashboard/project-name.mjs`'s `resolveProjectName` reads the vision from
      `knowledge/vision.md` on a board fixture and from `.agentheim/vision.md` on a legacy
      one; a grep over `dashboard/**` (excluding `dist/` and `node_modules/`) finds zero
      remaining raw `.agentheim` + `contexts` / `vision.md` / `context-map.md` path joins
      outside `task-system-paths.mjs`.
- [ ] `npm run build` in `dashboard/` succeeds against a board fixture whose styleguide
      lives at `knowledge/contexts/design-system/styleguide/` and against this repo's
      current legacy location; the styleguide's own entry page loads from both. All 20
      app-side import paths resolve in the built bundle.
- [ ] `classifyFramePath` returns `STRUCTURAL` for `.agentheim/board/<bc>/todo/x.md` and
      `.agentheim/knowledge/contexts/<bc>/README.md` — asserted, not assumed (ADR-0070).
- [ ] `dist-staleness.test.mjs` is green on the merged tree; `dashboard/dist/app.js` and
      `.build-stamp.json` are in the integrating commit.
- [ ] `npm test` is green with this repo's `.agentheim/` still legacy.
- [ ] The notice reads as a clear instruction to a first-time viewer, not as an error. [human-eye]

## Notes

- **ADR-0059 disposition:** the layout-agnostic rendering convention is enforced by the
  fixture-diff test; no prose-only rule introduced.
- **Refined 2026-09-06 against shipped cj54k and the live dashboard source.** Four
  corrections: the mixed-layout throw forces a detect-once short-circuit (otherwise the
  "mixed renders the notice" criterion is unsatisfiable); `projectContext`'s single-`bcDir`
  signature cannot survive the split and is re-shaped; `tree.mjs` reads no protocol feed
  and no `done-archive/`, so that scope line was struck; the app-side styleguide import
  count is 20, not 14. `project-name.mjs`'s independent `vision.md` literal was added to
  scope. The per-BC index-pointer fork was settled as `index` = task half +
  `knowledgeIndex`.
- ADR-0070's live-tree hub: `.agentheim/board/**` and `knowledge/contexts/**` frames must
  keep classifying as structural — `classifyFramePath`'s default arm returns `STRUCTURAL`
  for anything outside the advisory/runtime prefixes (read on disk, confirming the
  architect round), so this is an assertion to add, not a change to make.
- Parent: agentic-workflow-g5ez5; decision record: ADR-0078.

## Outcome

The dashboard's read side now resolves both ADR-0078 `.agentheim/` layouts (`legacy` and `board`), never throws on `mixed`, and never migrates anything itself (ADR-0017).

**`dashboard/tree.mjs`** now imports `lib/task-system-paths.mjs` — the first `dashboard → lib` import (the reverse of the existing `lib → dashboard` `discoverRoot` edge, recorded in a module comment and the README delta). `buildTree` calls `detectLayout` once and short-circuits a `'mixed'` detect into `{root, layout:'mixed', migrationPending:true, contexts:[], locations:{}, warnings:[]}` *before* touching any getter — every getter in `task-system-paths.mjs` throws `{code:'mixed-layout'}`, so this had to happen ahead of any call, never via catching the throw. For `'legacy'`/`'board'`, the resolved `{layout}` opt threads into every remaining getter call. BC enumeration is authoritative from `listKnowledgeContexts` (ADR-0078 §6); `listBoardContexts` entries with no matching knowledge-side counterpart become `warnings: [{code:'orphan-task-folder', bc}]`. `projectContext(root, bcName, layout)` was re-shaped from its old single-`bcDir` signature to resolve each surface (`taskFolderPath`, `bcReadmePath`, `taskIndexPath`, `knowledgeIndexPath`, `bcConceptsDir`) through its own getter; the payload's `contexts[].index` keeps its task-half meaning and gains a sibling `contexts[].knowledgeIndex` (both point at the same file under `legacy`). `locations.vision`/`contextMap`/`adrs`/`research` route through `visionPath`/`contextMapPath`/`decisionsDir`/`researchDir`. `migrationPending` is `true` for `legacy` (and the short-circuited `mixed`), `false` for `board`.

**`dashboard/project-name.mjs`**'s `resolveProjectName` reads vision.md via `visionPath(root)` instead of a raw `path.join`; a `visionPath` throw (mixed layout) degrades to the folder-basename fallback, same as any other read failure — never surfaces.

**`dashboard/build.mjs`** keeps all 20 literal styleguide ESM import specifiers across `app.js`/`board.js`/`main-pane-reader.js`/`slide-over.js` byte-unchanged (no edit needed to any of the four files' import statements) and instead resolves them at BUILD time: a new `runBuild({repoRoot, outDir})` (exported; the CLI `main()` calls it with the real repo root, guarded so importing the module for tests never re-triggers the CLI) computes `styleguideDir(repoRoot)` and registers an esbuild `onResolve` plugin (`styleguideRedirectPlugin`) that intercepts any import path ending in `design-system/styleguide/app/<file>.js` and redirects it to the resolved directory. esbuild's own `alias` option was tried and rejected — it only accepts package-name-shaped keys, throwing `Invalid alias name` on a relative-looking key (verified empirically) — so a plugin filter was the only mechanism that could redirect a *relative* literal specifier without touching the 20 import lines. **`dashboard/build-stamp.mjs`**'s `declaredInputRoots` now calls `styleguideDir(repoRoot)` too, replacing its own independent raw join.

**`dashboard/app/board.js`**: `applyTree` checks `tree.migrationPending` before `treeToColumns` and sets a new `"migration-pending"` phase (columns emptied); the render branch shows a `LoadState` notice ("Layout migration pending — run any Agentheim skill to finish migrating this project.") with no lifecycle columns.

**Tests** (13 new, all TDD'd red-then-green against the real fixtures, no mocks of `task-system-paths.mjs` itself):
- `dashboard/test/tree-layout.test.mjs` (5) — a legacy/board fixture-diff comparing normalized output (path-prefix-stripped) for identical content across all four lifecycle folders + readme + concepts + locations; the `index`/`knowledgeIndex` split on both layouts; the orphan-task-folder warning; `migrationPending` across all three `detectLayout` outcomes, confirming `buildTree` never throws on `mixed`.
- `dashboard/test/build-layout.test.mjs` (2) — drives `runBuild` directly against two fixture roots (the real on-disk styleguide copied to a legacy-shaped and a board-shaped location) and asserts the real esbuild build succeeds against both — build success is itself the proof all 20 imports resolve, since a resolution miss on any one throws out of `runBuild`.
- `dashboard/test/board-migration-pending.test.mjs` (1) — jsdom mount asserting the notice text renders and zero `[data-ticket-id]`/column-header text appears.
- `dashboard/test/project-name.test.mjs` (+3) — board-layout vision resolution, board-layout fallback, and mixed-layout fallback (visionPath throw never surfaces).
- `dashboard/test/live-frame-router.test.mjs` (+2) — `classifyFramePath` asserted (not assumed) STRUCTURAL for `.agentheim/board/**` and `.agentheim/knowledge/contexts/**` (ADR-0070); `dashboard/app/live-frame-router.js` itself needed no edit, per the task's own scope note.

**Out of scope, confirmed unaffected by inspection + passing suite**: `dashboard/search.mjs` (consumes `tree.contexts` — no raw path literal, no edit); `dashboard/watcher.mjs` (already watches the whole `.agentheim/` tree recursively — `board/`/`knowledge/` are covered for free); `dashboard/runfile.mjs`/`read-api.mjs`'s `.dashboard/` joins (ADR-0078 §7: `.dashboard/` stays put, untouched).

**Verification**: `lib/test/*.test.mjs` 614/614 green. `dashboard` suite: 996/997 green — the sole failure is `dist-staleness.test.mjs`'s "committed dist matches sources" check, which goes red the moment a declared input (`build.mjs`, now import-graph-different) changes, exactly the same expected-red pattern prior tasks (e.g. agentic-workflow-bmn29) recorded; resolved by the conductor's real `npm run build` rebuild on `main` at integration (ADR-0057/ADR-0074) — this worker's worktree carries source and tests only, never `dashboard/dist/`. A grep over `dashboard/**` (excluding `dist/`/`node_modules/`) confirms zero remaining raw `.agentheim`+`contexts`/`vision.md`/`context-map.md` `path.join` calls in production source outside `lib/task-system-paths.mjs`.

The "[human-eye]" notice-clarity criterion is left unchecked per its own annotation — the builder's own read.

Key files: `dashboard/tree.mjs`, `dashboard/project-name.mjs`, `dashboard/build.mjs`, `dashboard/build-stamp.mjs`, `dashboard/app/board.js`, `dashboard/test/tree-layout.test.mjs`, `dashboard/test/build-layout.test.mjs`, `dashboard/test/board-migration-pending.test.mjs`, `dashboard/test/project-name.test.mjs`, `dashboard/test/live-frame-router.test.mjs`.
