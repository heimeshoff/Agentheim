---
id: ADR-0006
title: Dashboard live-update — Server-Sent Events push + .agentheim/ file-watcher
scope: infrastructure
status: proposed
date: 2026-06-06
related_tasks: [infrastructure-003, agentic-workflow-001, agentic-workflow-009]
supersedes_in_part: [ADR-0002]
related_adrs: [ADR-0001, ADR-0002]
---

# ADR-0006: Dashboard live-update — Server-Sent Events push + `.agentheim/` file-watcher

## Context

The dashboard board (agentic-workflow-001) is a **projection rebuilt from disk** (ADR-0001).
The builder locked **live-update** (2026-06-06): while the board is open, a task file moved by
`work` or `modeling` in another terminal must appear on the board in near-real-time — not only
after a manual refresh.

ADR-0002 fixed the dashboard transport as **request/response only** and explicitly listed live
file-watch as **deferred**. The live-update requirement reverses that one clause: the server now
needs a way to *push* to an open client when the project tree changes. That is a new transport
decision with its own context, so it earns its own ADR rather than amending ADR-0002 in place.

Everything else ADR-0002 decided is untouched: Node-stdlib only / zero dependencies, `127.0.0.1`
binding, detached launch + runfile + explicit stop, walk-up project discovery, and in-root path
validation on every path. The `applyTaskMove` write seam (ADR-0001/ADR-0002) is also untouched.

The governing constraint, as in ADR-0002: *if the dashboard were read-only, would this concern
still exist?* Yes — a read-only board still wants to reflect external file changes live — so this
is transport and lives in the infrastructure BC.

## Decision

### Push channel — Server-Sent Events on the existing server

Add **`GET /api/events`** to the ADR-0002 `node:http` server: a long-lived
`text/event-stream` response that pushes a small change frame to the connected client.

- **Frame shape:** a named SSE event `tree-changed` carrying a JSON pointer
  `{ "type": "tree-changed", "path": "<root-relative path>" }`. The payload is a **raw pointer**
  at one changed path — *not* an interpreted Task transition. Interpreting the change (which task
  moved, from where to where) is the consumer's job (agentic-workflow-009); the consumer simply
  re-fetches `/api/tree` on every event and rebuilds the projection (ADR-0001), now **event-driven**
  instead of action-driven.
- **Heartbeats:** the server emits periodic SSE comment frames (`: heartbeat …`) to keep the
  socket warm through idle timeouts; comment frames are ignored by `EventSource`.
- **Reconnect:** standard SSE semantics. The server sends a `retry:` hint and an opening `hello`
  frame; the browser's `EventSource` reconnects automatically, and each connection gets its own
  fresh watcher. On client close the server tears down the watcher and heartbeat (no leak).
- **Headers:** `content-type: text/event-stream`, `cache-control: no-cache, no-transform`,
  `connection: keep-alive`, `x-accel-buffering: no`.

### Change source — `.agentheim/` file-watcher with a poll fallback

Watch the discovered `.agentheim/` root and turn mutations into `tree-changed` pointers:

- **Primary:** `node:fs.watch(agentheim, { recursive: true })` where the platform supports
  recursive watch (macOS, Windows) — one watcher covers the whole subtree.
- **Fallback:** a **debounced stat-poll** of the tree where recursive watch is unsupported or
  unreliable (notably Linux, and some Windows / network-drive cases). The poll diffs a snapshot of
  file `{mtime,size}` signatures to detect adds / modifies / removes. If a recursive watcher errors
  at runtime, the watcher drops to the poll fallback rather than going silent.
- **Debounce:** a burst of filesystem events — a move is a delete+create, an atomic editor save is
  rename-over, a folder rename touches many entries — **collapses into one** `tree-changed` event.
  Because the board re-fetches the whole tree on any event, one signal is sufficient and cheaper
  than N.
- **Path validation:** every emitted path is resolved against the project root
  (`resolveInRoot`, ADR-0002) before it leaves the watcher — a path that escapes the root is never
  emitted. A move performed by `applyTaskMove` produces exactly the normal change event; the
  dashboard's own writes are **not** special-cased.

### Relationship to ADR-0002 (supersedes-in-part)

This decision **supersedes in part** ADR-0002 — specifically its "request/response only, live
file-watch deferred" clause. ADR-0002 carries a banner pointing here, and the two are cross-linked.
No other ADR-0002 clause changes.

## Consequences

**Positive**

- Near-real-time board updates with zero new dependencies — SSE and `fs.watch`/poll are pure
  `node:*` stdlib, consistent with ADR-0002's zero-install constraint.
- One-directional server→client push fits the need exactly; the client stays a dumb re-fetcher and
  the board projection model (ADR-0001) is preserved, just event-driven.
- The poll fallback makes the feature robust on Linux and network drives where recursive watch is
  weak.

**Negative**

- A long-lived connection per open board tab; the server must clean up watcher + heartbeat on
  close (handled) or leak resources.
- The poll fallback costs a periodic tree walk; debounce + `{mtime,size}` diffing keep it cheap,
  but very large trees would want a smarter strategy later.
- `fs.watch` filenames are platform-inconsistent; the pointer is treated as a hint and the consumer
  always re-fetches, which absorbs that inconsistency.

**Neutral**

- The event is a pointer, not a transition; all interpretation stays in agentic-workflow (aw-009).

## Alternatives considered

- **WebSocket** — bidirectional, but the dashboard only needs server→push. WebSocket adds an HTTP
  upgrade handshake and a framing layer for no benefit here. SSE rides plain HTTP, auto-reconnects
  via `EventSource`, and is simpler. Rejected.
- **Client polling `/api/tree`** on a timer — laggy (bounded by the poll interval) and wasteful
  (re-fetches with no change most of the time). Rejected as the *transport*; note the server-side
  watcher still uses a *poll fallback* internally only where `fs.watch` is unreliable.
- **No live-update (keep ADR-0002 as-is)** — contradicts the locked live-update requirement.
  Rejected.

## Scope note

This ADR's code lives **here**, in `dashboard/` (`events.mjs`, `watcher.mjs`, the `/api/events`
route in `server.mjs`) — unlike infrastructure-001, which deferred its build to agentic-workflow,
because this is pure transport, not domain. The consumer side (subscribing to `/api/events` and
re-rendering the board) is agentic-workflow-009.

The consumer-side realization of this design — one shared subscription per tab, plus routing a
frame's path to the right subscriber — is ADR-0070 (agentic-workflow-mvt8x).
