---
id: agentic-workflow-t3b9k
title: Carry mtimeMs on research/ADR location pointers in /api/tree
status: done
type: feature
context: agentic-workflow
created: 2026-06-19
completed: 2026-06-19
depends_on: []
blocks: [agentic-workflow-n4h7q]
tags: [dashboard, tree, projection, mtime, research, adr]
related_adrs: [0002, 0017]
related_research: []
prior_art: [agentic-workflow-013, agentic-workflow-005, agentic-workflow-008]
---

## Why
`agentic-workflow-n4h7q`'s "modified also blinks" decision (builder, 2026-06-19) needs the
dashboard to notice when an existing research report or ADR file *changes*, not just when a
new one appears. But the dashboard is read-only and can only see the `/api/tree` projection —
it never stats files itself (ADR-0017). Today `locations.adrs` / `locations.research` in the
projection are **bare in-root path strings** (`dashboard/tree.mjs`) with **no modification
time**: only *tasks* carry `mtimeMs` (aw-013). So a re-saved doc at the same path is
indistinguishable from an untouched one, and "modified" is undetectable downstream.

This task carries `mtimeMs` on the research/ADR pointers so the consumer (`agentic-workflow-n4h7q`)
can diff a path's modification time against its session baseline. It is the direct sibling of
**aw-013**, which carried `mtimeMs` for tasks to feed the aw-012 column sort — the same move,
now for the non-task location pointers.

## What
Extend the tree projection so each **research** and **ADR** location pointer carries its file
`mtimeMs` alongside its path.

- **Prefer an additive, backward-compatible shape.** Carry the mtime in a **parallel metadata
  map** (e.g. `locations.adrsMeta` / `locations.researchMeta`, keyed by the same in-root path)
  so existing readers of the flat `locations.adrs` / `locations.research` **string arrays** —
  `treeToLibrary` (`dashboard/app/library-data.js`) and the search corpus single-source
  (`buildTree`, aw-050) — keep working untouched. If you instead reshape each pointer to
  `{ path, mtimeMs }`, **every** consumer of those lists must move in the **same** task (the
  pointer-shape ripple is the whole reason this was split out — don't leave a half-migrated
  shape).
- **Reuse aw-013's mechanism.** Read `statSync(absFile).mtimeMs` exactly as the per-task
  projection already does; a missing / unstattable file degrades to **null** mtime and the
  tree walk **never aborts** (loss-tolerant, the aw-013 / `tree.mjs` precedent).
- **Stays inside ADR-0002's pointers + metadata-only contract.** mtime is metadata (the aw-013
  precedent established this), never a document **body** — no body is added to the projection.
- The mtime-carrying transform is **pure** and covered in `tree.mjs`'s existing `node --test`
  seam (mirrors aw-013's task-mtime test).

## Acceptance criteria
- [ ] Each research and ADR location pointer in `/api/tree` carries its file `mtimeMs` (path +
      modification time).
- [ ] Existing consumers of `locations.adrs` / `locations.research` (`treeToLibrary` /
      `library-data`, the search corpus `buildTree`) keep working — no broken pointer reads.
- [ ] A missing / unstattable research or ADR file degrades to a `null` mtime; the tree walk
      never aborts (loss-tolerant, aw-013 precedent).
- [ ] The pointers + metadata-only contract is preserved (ADR-0002) — no document bodies added
      to the projection.
- [ ] The mtime-carrying projection logic is covered under `node --test` (the `tree.mjs` test
      seam).
- [ ] No client bundle change is required by this task — `dashboard/dist/app.js` is **not**
      rebuilt here; the consuming task `agentic-workflow-n4h7q` rebuilds `dist/` when the cue
      actually renders.

## Notes
- **Blocks** `agentic-workflow-n4h7q` — that task cannot detect a *modified* (vs created)
  research/ADR doc without this. Pure server-side projection work; **no styleguide gate**, no UI.
- Direct precedent: **aw-013** ("Carry task file modification time (mtimeMs) in the /api/tree
  projection") carried mtime for tasks to feed the aw-012 column sort. This is the same move for
  the research/ADR location pointers — read it for the exact `statSync` + loss-tolerance pattern.
- Shape recommendation is the **additive parallel-meta map**; it keeps `treeToLibrary` and the
  search corpus byte-compatible and avoids touching every pointer-list reader. The `{path,
  mtimeMs}` reshape is allowed but only if every consumer moves in this task.

## Outcome
`buildTree` (`dashboard/tree.mjs`) now projects two additive parallel metadata maps,
`locations.adrsMeta` and `locations.researchMeta`, each keyed by the same in-root path string the
flat `locations.adrs` / `locations.research` arrays use, with values `{ mtimeMs }`. A new
`metaMap(root, absFiles)` helper plus a shared `mtimeOf(abs)` helper reuse aw-013's
`statSync(abs).mtimeMs` mechanism; an unstattable file degrades to `mtimeMs: null` and the walk
never aborts. The flat string arrays are byte-unchanged, so the existing consumers
(`dashboard/app/library-data.js`, `dashboard/search.mjs`) keep working untouched — verified by the
suite (630/630 green). No document bodies were added (ADR-0002 contract preserved). The read-only
dashboard (ADR-0017) can now diff a doc's modification time against a session baseline, unblocking
aw-n4h7q's "modified also blinks". `dist/app.js` was intentionally NOT rebuilt — that is aw-n4h7q's
job when the cue renders.

Key files: `dashboard/tree.mjs` (`mtimeOf` + `metaMap` + meta maps in `buildTree`),
`dashboard/test/tree.test.mjs` (3 new `node --test` cases).
