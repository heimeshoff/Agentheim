---
id: agentic-workflow-bmn29
title: Dashboard burns resources at idle on a MacBook — four SSE streams per tab, a 2×tree + 2×doc fan-out on every heartbeat, an unmemoized 255-card board, and box-shadow keyframes
status: backlog
type: bug
context: agentic-workflow
created: 2026-09-05
completed:
depends_on: [design-system-001-styleguide]
blocks: []
tags: [dashboard, performance, sse, live-update, board, motion]
related_adrs: [0006, 0014, 0033, 0043]
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

Scope of the fix (to be refined — candidate shape, not yet decided):
- One SSE subscription per tab (a single `useLiveTree` at `DashboardApp`, or a shared
  module-level source with subscribers) that fetches `/api/tree` **once** and distributes
  it; the panels re-fetch their doc only when the frame's `path` points at it.
- Ignore or debounce frames whose `path` is `.agentheim/state/**` / `.agentheim/.dashboard/**`
  for the board/rail (advisory artifacts are not tree structure — ADR-0027's category split
  already names them).
- `React.memo` on `BoardCard`/`BoardColumn`; keep hover state out of the board root (or
  derive ring membership per card from a context/set so only affected cards re-render).
- design-system: rewrite the two box-shadow keyframes as opacity/transform-only (e.g. a
  pre-painted glow layer whose opacity breathes) — a BC-local styleguide change, candidate
  child task.
- infrastructure (optional): share one `fs.watch` across all SSE clients in `events.mjs`
  instead of one watcher per connection — candidate child task.

## Acceptance criteria
- [ ] With the board open at idle, exactly one `/api/events` connection exists per tab
      (verify in DevTools Network) and the server holds one watcher per tab.
- [ ] One `tree-changed` frame produces at most one `/api/tree` request per tab.
- [ ] An in-flight heartbeat write (`.agentheim/state/in-flight.json`) does not re-render
      the board's cards (React DevTools profiler shows only `InFlightLane` committing).
- [ ] Hovering a backlog card re-renders only the hovered card and the ring targets, not
      all cards.
- [ ] No infinite keyframe animates `box-shadow`, `filter`, or any other non-compositable
      property; the doing-card breathe and attention dot still read the same visually.
- [ ] A hidden tab (`document.hidden`) pauses re-fetching and resumes with one re-sync
      on visibility.
- [ ] Before/after measurement recorded on the MacBook: Activity Monitor energy impact
      (or Chrome Task Manager CPU) for the dashboard tab at idle for 5 minutes, and during
      a running `work` session.

## Notes
- Builder's hypothesis was "polling". Verified: no client timer, no server stat-poll on
  macOS (`RECURSIVE_SUPPORTED` covers darwin). The polling-like behaviour is emergent:
  frequent advisory writes × four subscribers × full re-fetch × full re-render.
- ADR-0006 (one connection per tab) is the design the code drifted from — the four
  `useLiveTree` call sites arrived one feature at a time (aw-009 board, n4h7q rail,
  aw-073 whats-next, m9w5c in-flight lane), each correct in isolation.
- ADR-0014 / ADR-0029 own the breathe animations; ADR-0033 admits the hover-scoped
  IntersectionObserver; ADR-0043 owns the heartbeat writer.
- Analysis was done against the repo source, which is byte-identical to the 0.9.2 plugin
  cache's `dashboard/app/board.js` and `dist/app.js`, so it describes what actually runs.
- REFINE should decide whether this stays one task or splits into three (agentic-workflow
  live-update consolidation + memoization; design-system keyframes; infrastructure shared
  watcher) — the first is the bulk of the gain and can ship alone.
