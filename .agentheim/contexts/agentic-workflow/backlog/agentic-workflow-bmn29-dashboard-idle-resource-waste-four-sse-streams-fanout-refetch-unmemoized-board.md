---
id: agentic-workflow-bmn29
title: Dashboard burns resources at idle on a MacBook — umbrella for the split (hub, memoization, keyframes); residual hidden-tab pause/resume and the before/after measurement
status: backlog
type: bug
context: agentic-workflow
created: 2026-09-05
completed:
depends_on: [agentic-workflow-mvt8x, agentic-workflow-rw6ck, design-system-pk4qd]
blocks: []
tags: [dashboard, performance, sse, live-update, board, motion]
related_adrs: [0006, 0014, 0027, 0033, 0043, 0070]
related_research: []
prior_art: [agentic-workflow-009, agentic-workflow-073, agentic-workflow-m9w5c, agentic-workflow-n4h7q, agentic-workflow-h9v3m]
---

## Why
The builder reports the dashboard using a lot of resources on a MacBook, assumed to be
"polling". A read of the frontend architecture (dashboard/app/*, the styleguide CSS, the SSE
runtime) shows there is **no client-side polling timer at all** — no `setInterval` in the
app, and on macOS the server uses recursive `fs.watch` (FSEvents), never the stat-poll
fallback. The waste comes from several structural sources that compound each other. This
task records them so the fix is measured, not guessed.

## What
Findings, ranked by likely impact:

1. **Four `EventSource` streams per tab, not one.** `useLiveTree` is called by four
   components — `DashboardBoard`, `ShellRail`, `WhatsNextPanel`, `InFlightLane` — and each
   call opens its own `/api/events` connection. ADR-0006 explicitly assumed "a long-lived
   connection per open board tab". Consequences: the server runs four recursive
   `fs.watch` watchers and four 25 s heartbeat intervals per tab (times the number of open
   tabs / Simple Browser panes); the browser's 6-connections-per-host HTTP/1.1 budget is
   4/6 consumed by idle streams, so ordinary fetches queue behind them; on server restart
   four reconnect loops (`retry: 3000`) fire, each re-triggering a `hello` re-sync.
2. **Every tree change fans out into 2× `/api/tree` + 2× `/api/doc`.** The board and the
   rail each re-fetch the full tree; the two panels each re-fetch their artifact. `/api/tree`
   is a fully synchronous walk (`readFileSync` + two `statSync` per task) over ~255 task
   files, run twice, blocking the server's event loop both times.
3. **Tree changes are frequent during a session, so this is polling in effect.** The
   `Stop`/`SubagentStop` hooks (ADR-0043) overwrite `.agentheim/state/in-flight.json` on
   every orchestrator turn end and every subagent completion. Each write lands inside the
   watched `.agentheim/` tree → one `tree-changed` frame → the full fan-out above, plus a
   whole-board re-render. Protocol/INDEX/task moves and `.agentheim/.dashboard/*` writes do
   the same. The heartbeat's *purpose* is a timestamp bump, but the dashboard treats it as a
   structural tree change.
4. **Every state change re-renders every card.** There is no `React.memo` anywhere in
   `board.js` (0 occurrences); `DashboardBoard` re-renders all ~255 `BoardCard`s (each a
   `TicketCard` with several inline-SVG `Icon`s via `dangerouslySetInnerHTML`) on every
   tree fetch **and on every card hover** (`onCardHover` → `setHoveredId` lifts hover into
   board state; `resolveHoverDependencies` re-runs; the IntersectionObserver effect
   re-subscribes on `[hoveredTicket, targetIds, columns.done, …]`). The Done column's 249
   cards are always mounted — `peek` only height-clamps them.
5. **Infinite `box-shadow` keyframes are not compositor-only.** `ambient-rail-pulse`
   (doing cards) and `rail-attention-breathe` (new-item dots) animate `box-shadow` with a
   per-frame `color-mix()` — that is a paint every frame at 60 fps for as long as the tab is
   open, regardless of visibility. The CSS comment claims "composited on opacity +
   box-shadow only (cheap to run continuously)"; only the opacity half is cheap.
   `rel-ring`, `rel-present`, `rel-edge-blink` are opacity-only and hover-scoped (fine).
6. **No `visibilitychange` handling.** A hidden tab keeps its four streams, its re-fetch
   fan-out and its animations alive.

Split at refinement (2026-09-05) into three children that carry findings 1–5; this
parent keeps the diagnosis above as the shared record, plus the residual scope below:

| Child | Carries | BC |
|---|---|---|
| `agentic-workflow-mvt8x` | findings 1–3 — one live-tree hub per tab (one source, one `/api/tree` fetch), frames routed structural / advisory / runtime so a heartbeat write reaches only `InFlightLane` (ADR-0070) | agentic-workflow |
| `agentic-workflow-rw6ck` | finding 4 — memoized cards/columns, hover state out of the board root, identity-stable tree projection | agentic-workflow |
| `design-system-pk4qd` | finding 5 — the two ambient keyframes become opacity-only over a pre-painted glow layer | design-system |

The infrastructure candidate (one shared `fs.watch` across SSE clients) was considered and
**dropped**: once the hub lands, server-side watchers fall 4→1 per tab as a side effect, and
sharing across tabs serves a many-tabs load profile this local single-user plugin does not have
(vision non-goal: not multi-tenant). A ref-counted watcher registry is not worth its complexity
for one or two `fs.watch` handles.

**Residual scope of this task** (finding 6 + the close-out measurement):
- `visibilitychange` handling on the hub: a hidden tab stops re-fetching (the hub keeps its
  one source open but drops frames while `document.hidden`), and on becoming visible performs
  exactly one re-sync. This hangs on the hub's subscriber API, so it is shaped only after
  `agentic-workflow-mvt8x` ships — refine this task again then.
- The aggregate before/after measurement on the builder's MacBook, taken after all three
  children have shipped.

## Acceptance criteria
- [ ] A hidden tab (`document.hidden`) performs no `/api/tree` or `/api/doc` fetch on any
      frame; on becoming visible the hub performs exactly one re-sync (node test with the hub's
      injectable `sourceFactory` / `fetchTree` and a stubbed `document.visibilityState`).
- [ ] `[human-eye]` Before/after measurement recorded on the MacBook in this task's Notes:
      Activity Monitor energy impact (or Chrome Task Manager CPU) for the dashboard tab at idle
      for 5 minutes, and during a running `work` session — the *before* number is the one
      taken before `agentic-workflow-mvt8x` shipped, the *after* with all three children merged.

## Notes
- Builder's hypothesis was "polling". Verified: no client timer, no server stat-poll on
  macOS (`RECURSIVE_SUPPORTED` covers darwin). The polling-like behaviour is emergent:
  frequent advisory writes × four subscribers × full re-fetch × full re-render.
- ADR-0006 (one connection per tab) is the design the code drifted from — the four
  `useLiveTree` call sites arrived one feature at a time (aw-009 board, n4h7q rail,
  aw-073 whats-next, m9w5c in-flight lane), each correct in isolation. ADR-0070 (written at
  this refinement) makes the one-hub-per-tab shape and the read-side frame routing a held
  invariant rather than an aspirational sentence; ADR-0006 itself is untouched.
- ADR-0014 / ADR-0029 own the breathe animations (design-system-pk4qd amends ADR-0014 in
  place); ADR-0033 admits the hover-scoped IntersectionObserver; ADR-0043 owns the heartbeat
  writer (narrowed in part by ADR-0070 on the read side only).
- Analysis was done against the repo source, which is byte-identical to the 0.9.2 plugin
  cache's `dashboard/app/board.js` and `dist/app.js`, so it describes what actually runs.
- `depends_on` lists all three children: this umbrella is the last to close. It is deliberately
  left in `backlog/` — the visibility work cannot be shaped until the hub exists, and the
  measurement criterion needs the children merged. Do not promote before `mvt8x` is done.
- Take the **before** measurement now, before any child ships, or the close-out has nothing to
  compare against.
