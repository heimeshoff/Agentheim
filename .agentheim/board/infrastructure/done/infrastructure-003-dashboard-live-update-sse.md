---
id: infrastructure-003
title: Dashboard live-update transport — SSE endpoint + .agentheim file-watcher (supersedes ADR-0002 request/response-only)
status: done
type: decision
context: infrastructure
created: 2026-06-06
completed: 2026-06-06
commit: 1e192ba
depends_on: [infrastructure-001]
blocks: [agentic-workflow-001, agentic-workflow-009]
tags: [dashboard, runtime, transport, sse, file-watcher, push, live-update]
related_adrs: [ADR-0002, ADR-0006]
related_research: []
prior_art: []
---

## Why

The builder locked **live-update** for the dashboard (2026-06-06): while the board is open, a task
file moved by `work` or `modeling` in another terminal must appear on the board in near-real-time.
ADR-0002 deliberately chose request/response only and listed live file-watch as *deferred*.
Reversing that is a new transport decision with its own context, so it earns its own ADR and a
server-push channel.

## What

Add a server→client push channel to the ADR-0002 runtime — transport only, no domain logic:

1. **`GET /api/events` (SSE)** — a long-lived `text/event-stream` response on the existing
   `node:http` server (no new deps; fits `127.0.0.1` / stdlib). Emits a small change event
   (`{ type: "tree-changed", path }`) whenever `.agentheim/` changes; heartbeats to keep the
   connection alive; survives client reconnect.
2. **File-watcher** — watch the discovered `.agentheim/` root (`node:fs.watch`, recursive where
   supported, with a debounced poll fallback where recursive watch is unreliable — notably some
   Windows / network-drive cases). Debounce bursts. Emits **raw** "something changed" pointers; it
   does **not** interpret them as Task transitions — that is the consumer's job (aw-009). Path
   validation against the root, as everywhere else.

The decision output is **ADR-0004**, which supersedes (in part) ADR-0002's request/response-only
clause. SSE is chosen over WebSocket (heavier, needs an upgrade handshake, no benefit for
one-directional push) and over client polling (laggy, wasteful).

## Acceptance criteria

- [ ] A new ADR (ADR-0004, scope: infrastructure) records the SSE + file-watcher decision and
      **supersedes the ADR-0002 clause** that said request/response only, no push; ADR-0002 gets a
      "Superseded-in-part by ADR-0004" banner and the two ADRs are cross-linked.
- [ ] `GET /api/events` holds a `text/event-stream` connection, emits a change event on
      `.agentheim/` mutations, sends heartbeats, and survives client reconnect.
- [ ] The watcher detects task-file moves (and any `.agentheim/` change) on Windows and POSIX;
      recursive-watch limitations are handled with a documented fallback.
- [ ] Change bursts are debounced; the event payload is a pointer (`{type, path}`), never an
      interpreted transition.
- [ ] No new runtime dependency; stdlib-only, `127.0.0.1`-only, path-validated.
- [ ] A move performed by `applyTaskMove` produces exactly the normal change event — no
      special-casing of the dashboard's own writes.

## Notes

- Preserves ADR-0001's "board is a projection rebuilt from disk" model — now event-driven instead
  of action-driven; the consumer (aw-009) re-fetches `/api/tree` on every event.
- Type is `decision` (matching infrastructure-001's precedent) but, unlike infrastructure-001, the
  transport build lives **here** rather than deferring to agentic-workflow — it is transport, not
  domain. ADR-0004 + the SSE/watcher code are both this task's output.
- Leaves intact every other ADR-0002 clause: stdlib-only, `127.0.0.1`, detached launch, runfile,
  explicit stop, path validation, and the `applyTaskMove` write seam.

## Outcome

**Done 2026-06-06.** The decision ADR is **ADR-0006** (not "ADR-0004" as drafted above — 0004 and
0005 were taken earlier this session; the orchestrator corrected the number and the `related_adrs`
frontmatter to `[ADR-0002, ADR-0006]`). All acceptance criteria met.

Delivered (all `node:*` stdlib, zero deps, `127.0.0.1`-only, path-validated):

- **ADR-0006** — `.agentheim/knowledge/decisions/0006-dashboard-live-update-sse.md`: records the
  SSE push + file-watcher decision; **supersedes-in-part** ADR-0002's request/response-only clause;
  justifies SSE over WebSocket and over client polling; preserves ADR-0001's projection model
  (now event-driven). ADR-0002 gained a "Superseded in part by ADR-0006" banner +
  `superseded_in_part_by` / `related_adrs` frontmatter, cross-linked both ways.
- **`dashboard/watcher.mjs`** — `.agentheim/` file-watcher: recursive `node:fs.watch` where
  supported (macOS, Windows) + a debounced stat-poll fallback (Linux, some Windows/network-drive
  cases; also the runtime error fallback). Debounces bursts into one `{type:"tree-changed", path}`
  pointer; validates every emitted path against the root (`resolveInRoot`); raw pointer only, no
  transition interpretation. The recursive-vs-poll selection is documented (platform-dependent);
  debounce + emit-shape are unit-tested.
- **`dashboard/events.mjs`** — SSE handler for `GET /api/events`: `text/event-stream` +
  `no-cache` headers, opening `hello` frame, `retry:` hint, periodic comment-frame heartbeats,
  pushes `tree-changed` data frames from the watcher, tears down watcher + heartbeat on client
  close (no leak). Reconnect via standard `EventSource` semantics.
- **`dashboard/server.mjs`** — wired the `GET /api/events` route (the sole server edit; the
  parallel aw-003 worker stayed off this file). `applyTaskMove` / `POST /api/task/move` left
  untouched (aw-003 / aw-009 scope).
- **Tests** — `dashboard/test/watcher.test.mjs` (5) + `dashboard/test/events.test.mjs` (4). Full
  dashboard suite green: **37 passing**.
- **READMEs** — infrastructure BC README (live-update transport in ubiquitous language, a key
  event, ADR-0006 decision entry) and `dashboard/README.md` (endpoint + watcher docs).

Key files: `dashboard/events.mjs`, `dashboard/watcher.mjs`, `dashboard/server.mjs`,
`.agentheim/knowledge/decisions/0006-dashboard-live-update-sse.md`.

The consumer side (subscribe to `/api/events`, re-fetch `/api/tree`, re-render board) remains
agentic-workflow-009.
