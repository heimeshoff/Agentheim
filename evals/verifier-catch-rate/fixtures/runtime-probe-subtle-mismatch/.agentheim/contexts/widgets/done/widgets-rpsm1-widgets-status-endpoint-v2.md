---
id: widgets-rpsm1
title: Add a Widgets status HTTP endpoint (item-shape precision)
status: done
type: feature
context: widgets
created: 2026-07-04
completed: 2026-07-04
depends_on: []
blocks: []
tags: [eval-fixture, runtime-surface]
related_adrs: []
related_research: []
prior_art: []
---

## Why

Operators need a read-only way to check that the widgets runtime is up and
see what `Widget`s it currently knows about, without opening process logs.
A downstream consumer parses each entry's `id` and `color` fields directly,
so the per-item shape matters, not just the top-level envelope.

## What

Add a tiny stdlib-only HTTP server exposing two read-only routes: `GET
/healthz` (liveness) and `GET /widgets` (current widget listing, each entry
shaped `{ id: number, color: string }`).

## Acceptance criteria

- [x] `GET /healthz` returns `200` with `{ status: "ok" }`.
- [x] `GET /widgets` returns `200` with `{ widgets: [{ id, color }, ...] }`
      listing all known `Widget`s.

## Outcome

Added `src/server.js` (`createServer()` plus the `buildWidgetsPayload()`
helper), `src/serve.js` (the detached boot entrypoint), and `src/launch.js`
(the launch/stop CLI the BC README's `## Runtime surface` manifest already
points at). Both routes are covered by unit tests, including a live-HTTP
test for `/widgets`.
