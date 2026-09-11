---
id: agentic-workflow-013
title: Carry task file modification time (mtimeMs) in the /api/tree projection
status: done
type: refactor
context: agentic-workflow
created: 2026-06-08
completed: 2026-06-08
commit: 9a0db2d
depends_on: [agentic-workflow-005]
blocks: [agentic-workflow-012]
tags: [dashboard, tree, read-model]
related_adrs: [0002]
related_research: []
prior_art: [agentic-workflow-005]
---

## Why
The board can't sort by modification date because the read model doesn't carry it. The
`/api/tree` projection (`dashboard/tree.mjs`, built in aw-005) surfaces only
`{ id, title, status, type, context, path }` per task, and the board is a browser client
that cannot `stat()` files itself. agentic-workflow-012 (board column sorting) needs each
task's file modification time to make `modification date descending` — its default — work.

## What
Extend the per-task projection in `dashboard/tree.mjs` to include each task file's
`mtimeMs` (modification time in milliseconds). Additive and backward-compatible: existing
consumers (board aw-006, slide-over aw-007, navigation aw-008, SSE consumer aw-009) ignore
the new field. This stays **within** ADR-0002's "pointers + metadata only" contract —
`mtimeMs` is per-task metadata, not a document body — so no ADR or ADR-0002 addendum is
warranted; a one-line note in `tree.mjs` recording this suffices.

## Acceptance criteria
- [ ] `projectTask` in `dashboard/tree.mjs` `stat()`s each task file and adds `mtimeMs`
      (a number, milliseconds) to the projected task object.
- [ ] A `stat` failure (unreadable file) yields `mtimeMs: null` and the walk continues —
      same graceful-degradation posture as the existing frontmatter parsing (never throws,
      never aborts the walk).
- [ ] Existing projected fields (`id`, `title`, `status`, `type`, `context`, `path`) and
      existing consumers are unchanged — the field is purely additive.
- [ ] A one-line comment in `tree.mjs` notes that `mtimeMs` is per-task metadata within
      ADR-0002's pointers+metadata contract, carried for board sort (aw-012).
- [ ] Covered by the existing `tree.mjs` test approach (`node --test`): a task file's
      `mtimeMs` is present and numeric; an unreadable file projects `mtimeMs: null`.

## Notes
Split out of agentic-workflow-012 during refinement (2026-06-08) because this mutates a
shared read-model contract consumed by four done tasks (aw-006/007/008/009) and deserves
its own commit + verifier pass under the one-task-one-commit invariant. aw-012 is then a
pure frontend task that depends on this.

`board-data.js` (`treeToColumns` / `treeTicket`) may pass `mtimeMs` through to the board
ticket shape, or aw-012 may read it off the raw tree task — that boundary is aw-012's call.

**Relevant files:**
- `dashboard/tree.mjs` — `projectTask` (add the `stat()` + `mtimeMs`)
- `dashboard/app/board-data.js` — optional pass-through for aw-012
- ADR-0002 (the projection contract this extends)

## Outcome
`projectTask` in `dashboard/tree.mjs` now `statSync()`s each task file and adds a
per-task `mtimeMs` (epoch milliseconds, a number) to the projected task object,
alongside the existing `id/title/status/type/context/path` fields. The field is
purely additive — every existing consumer (board aw-006, slide-over aw-007,
navigation aw-008, SSE consumer aw-009) ignores it. A stat failure degrades to
`mtimeMs: null` and never aborts the walk, matching the existing frontmatter
graceful-degradation posture. A one-line comment in `tree.mjs` records that
`mtimeMs` is metadata within ADR-0002's pointers+metadata contract, carried for
board sort (aw-012). No ADR written (additive metadata, no contract change).
`board-data.js` was left untouched — the pass-through boundary is aw-012's call.

**Key files:**
- `dashboard/tree.mjs` — `projectTask` now emits `mtimeMs`; header field list and
  inline ADR-0002 note updated.
- `dashboard/test/tree.test.mjs` — two new `node --test` cases: every task carries
  a finite numeric `mtimeMs`; an unstattable file projects `mtimeMs: null` without
  throwing. Full dashboard suite: 110 pass.

This unblocks aw-012 (board column sorting, default modification-date-descending).
