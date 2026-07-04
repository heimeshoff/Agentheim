---
id: widgets-rpm1
title: Add a Widgets status HTTP endpoint
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
see what `Widget`s it currently knows about, without opening the process logs.

## What

Add a tiny stdlib-only HTTP server exposing two read-only routes: `GET
/healthz` (liveness) and `GET /widgets` (current widget listing).

## Acceptance criteria

- [x] `GET /healthz` returns `200` with `{ status: "ok" }`.
- [x] `GET /widgets` returns `200` with `{ widgets: [...] }` listing all known
      `Widget`s and their colors.

## Outcome

Added `src/server.js` (`createServer()` plus the `buildWidgetsPayload()`
helper, unit-tested directly), `src/serve.js` (the detached boot entrypoint),
and `src/launch.js` (the cross-platform launch/stop CLI the BC README's
`## Runtime surface` manifest already points at). `buildWidgetsPayload()`'s
`{ widgets: [...] }` shape is covered by a unit test; `/healthz` is covered
end-to-end.
