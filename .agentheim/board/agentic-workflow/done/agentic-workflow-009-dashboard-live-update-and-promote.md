---
id: agentic-workflow-009
title: Dashboard interactivity — SSE live-update consumer + Promote drag → applyTaskMove write path
status: done
type: feature
context: agentic-workflow
created: 2026-06-06
completed: 2026-06-06
commit: 5cc5aac
depends_on: [agentic-workflow-003, agentic-workflow-005, agentic-workflow-006, infrastructure-003]
blocks: [agentic-workflow-001]
tags: [dashboard, ui, frontend, sse, live-update, write, promote, applyTaskMove]
related_adrs: [ADR-0001, ADR-0004]
related_research: []
prior_art: []
---

## Why

Two interactivity concerns that share one rule — *disk is the source of truth, the board is a
projection rebuilt from it*. The builder runs `dashboard` in one terminal and `work` / `modeling`
in another; the board must reflect skill-driven file moves live (decided 2026-06-06), and the one
UI-initiated move (Promote) must go through the same lifecycle writer the skills use.

## What

1. **Live-update consumer** — subscribe to the SSE stream infrastructure-003 exposes. On any
   change event, re-fetch `/api/tree` and re-project the board (and refresh an open drawer if its
   artifact changed). The consumer never interprets the raw event as a transition — it just
   re-fetches. Reconnect on drop and re-sync from `/api/tree`.
2. **Promote write path** — wire the `backlog→todo` drag to `POST /api/task/move`, which delegates
   to `applyTaskMove` (agentic-workflow-003). Every other column is a non-drop target. Optimistic
   precondition (`from` + mtime) per ADR-0001; on a rejected/stale move (409), surface the domain's
   reason and re-fetch.

## Acceptance criteria

- [x] While the dashboard is open, when a skill moves a task file on disk, the board reflects it in
      near-real-time via the SSE stream + `/api/tree` re-fetch — no manual reload.
- [x] The SSE connection reconnects on drop and the board re-syncs from `/api/tree` on reconnect.
- [x] Dragging `backlog→todo` performs a legal Promote via `applyTaskMove`; the move's own
      resulting SSE echo is handled idempotently (re-fetch, no double-apply).
- [x] Every non-Promote transition is a non-drop target; an illegal or blocked move (e.g. unmet
      `depends_on`, frontend gate) is refused with the domain's reason and the board re-fetches.
- [x] No UI-only writer of lifecycle state exists; the only write goes through `applyTaskMove`.

## Notes

- Write semantics: ADR-0001 (Promote-only UI moves, shared mover, optimistic concurrency).
  Live-update transport: ADR-0004 (recorded by infrastructure-003).
- The watcher (infrastructure-003) emits raw "something changed" pointers; the interpretation
  ("re-fetch and re-project") lives here, keeping the watcher transport-only.
- New decision: ADR-0012 — `applyTaskMove` resolves the slugged on-disk filename from a bare id,
  and the SSE consumer re-fetches rather than interpreting the pointer.

## Outcome

Both interactivity concerns shipped, both bound by ADR-0001 ("disk is the source of truth, the
board is a projection rebuilt from it").

**Live-update consumer (frontend).** `dashboard/app/live-update.js` (`createLiveUpdate`,
framework-free + unit-tested) subscribes to `GET /api/events` and, on every `tree-changed` frame
*and* every (re)connect, re-fetches `/api/tree` and re-projects the whole board — never
interpreting the raw pointer. Idempotent by construction, so the move's own SSE echo causes one
more re-fetch, no double-apply; reconnect re-syncs with no missed-event bookkeeping. Wired into the
board via a thin `useLiveTree` hook in `dashboard/app/board.js`.

**Promote write path.** Server: `dashboard/move-api.mjs` adds `POST /api/task/move`
(wired in `dashboard/server.mjs`, POST-only — GET → 405), transport-only, delegating to
`applyTaskMove` with `policy: 'ui'` and translating the structured result to HTTP (200 / 409
stale|blocked / 404 / 422 / 400). Frontend: `dashboard/app/promote.js` (`isLegalDrop` +
`postMove`, unit-tested) makes `backlog→todo` the only legal drop; the board's `DragColumn`
composes the approved styleguide sub-components (`ColumnHeader`/`TicketCard`/`EmptyColumn` — same
composition the styleguide `Column` uses, no fork) and adds HTML5 drag: a legal drop posts the
optimistic precondition, a rejected/stale move surfaces the domain `reason` and the board
re-fetches. No UI-only writer exists — `applyTaskMove` is the sole writer.

**Mover fix (ADR-0012).** `lib/task-lifecycle.mjs` now resolves a task's real on-disk file
`<id>-<slug>.md` from its bare id (anchored against `alpha-001` vs `alpha-0010`) and preserves the
filename across the move. Without this, a Promote of any real slugged task file would have 404'd.

**Key files**
- `dashboard/move-api.mjs` (new) — `POST /api/task/move` handler.
- `dashboard/server.mjs` — route wired.
- `dashboard/app/live-update.js` (new) — SSE consumer core.
- `dashboard/app/promote.js` (new) — legal-drop predicate + move client.
- `dashboard/app/board.js` — live subscription + drag-to-Promote (`DragColumn`).
- `lib/task-lifecycle.mjs` — slugged-filename resolution.
- `.agentheim/knowledge/decisions/0012-applytaskmove-resolves-slugged-filenames-by-bare-id.md` (new).

**Verification.** Full dashboard suite 100 passing (new: `move-api`, `promote`, `live-update`;
updated stale `server.test.mjs` write-route assertion). lib suite 13 passing (added slug +
collision cases). `dist/` rebuilt and verified to carry `/api/events`, `/api/task/move`,
`tree-changed`. End-to-end smoke confirmed a Promote moves the file on disk AND emits a
`tree-changed` SSE frame.
