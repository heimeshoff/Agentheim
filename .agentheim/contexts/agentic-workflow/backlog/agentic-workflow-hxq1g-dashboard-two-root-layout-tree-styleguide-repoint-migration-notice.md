---
id: agentic-workflow-hxq1g
title: Dashboard reads the two-root layout — `tree.mjs` resolves through `task-system-paths`, BCs enumerate from `knowledge/contexts/` with orphan `board/` folders as warnings, the styleguide bundle and its 14 ESM imports re-point, and a legacy or mixed tree renders a "layout migration pending" notice; dist rebuilt
status: backlog
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
   `buildTree` payload, never dropped and never a crash. Task lists, done-archive
   prior-art reads, the protocol feed, and the library/rail paths all go through the
   getters.
2. **`migrationPending` flag** on the `buildTree` payload: `true` for `legacy` and `mixed`
   (with `layout` carried alongside); the board renders a notice — "layout migration
   pending — run any Agentheim skill" — instead of an empty board or a legacy-shaped
   board. The dashboard **never** invokes `migrate` (ADR-0017).
3. **Styleguide re-point:** `dashboard/build.mjs`'s STYLEGUIDE constant, `build-stamp.mjs`,
   `project-name.mjs`, and the 14 literal ESM import paths in
   `dashboard/app/{board,app,main-pane-reader,slide-over}.js` resolve the styleguide via
   `styleguideDir` (build-time) so the bundle works from either location during the
   transition.
4. **`dashboard/dist/`** rebuilt and staged per ADR-0057 (conductor rebuilds on main after
   the squash; worker rebuilds in the worktree so `dist-staleness` is green).

Out of scope: `dashboard/app/live-frame-router.js` (unrecognized paths already classify
as structural — no edit), any `lib/` verb, any skill prose.

## Acceptance criteria

- [ ] A fixture-diff test builds `buildTree` against a legacy fixture and the same content
      as a board fixture and asserts identical output modulo the path prefixes
      (`contexts/<bc>/` ↔ `board/<bc>/` / `knowledge/contexts/<bc>/`), including
      done-archive prior-art entries and the protocol feed.
- [ ] A board fixture with `board/orphan/` and no `knowledge/contexts/orphan/` yields
      `warnings:[{code:'orphan-task-folder', bc:'orphan'}]` and the other BCs render
      normally.
- [ ] `buildTree` on a legacy fixture and on a mixed fixture returns
      `migrationPending:true` with the matching `layout`; on a board fixture `false`.
- [ ] The notice text appears in the rendered board for `migrationPending:true` and no
      task columns are drawn (DOM assertion in the existing board test harness).
- [ ] `npm run build` in `dashboard/` succeeds against a board fixture whose styleguide
      lives at `knowledge/contexts/design-system/styleguide/` and against this repo's
      current legacy location; the styleguide's own entry page loads from both.
- [ ] `dist-staleness.test.mjs` is green on the merged tree; `dashboard/dist/app.js` and
      `.build-stamp.json` are in the integrating commit.
- [ ] `npm test` is green with this repo's `.agentheim/` still legacy.
- [ ] The notice reads as a clear instruction to a first-time viewer, not as an error. [human-eye]

## Notes

- **ADR-0059 disposition:** the layout-agnostic rendering convention is enforced by the
  fixture-diff test; no prose-only rule introduced.
- ADR-0070's live-tree hub: `.agentheim/board/**` and `knowledge/contexts/**` frames must
  keep classifying as structural — verify `classifyFramePath`'s default covers them (the
  architect round says it does; assert it in the fixture test rather than trust it).
- Parent: agentic-workflow-g5ez5; decision record: ADR-0078.
