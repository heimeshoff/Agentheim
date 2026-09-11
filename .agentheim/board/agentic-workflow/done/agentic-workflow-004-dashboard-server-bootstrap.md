---
id: agentic-workflow-004
title: Dashboard server bootstrap — stdlib HTTP server, detached launch/stop, project discovery
status: done
type: feature
context: agentic-workflow
created: 2026-06-06
completed: 2026-06-06
commit: 9b09b3e
depends_on: [infrastructure-001]
blocks: [agentic-workflow-001]
tags: [dashboard, runtime, launch, server, cross-platform]
related_adrs: [ADR-0002, ADR-0004]
related_research: []
prior_art: []
---

## Why

The dashboard needs a runtime skeleton before any view can render. infrastructure-001
(ADR-0002) decided the shape — Node-stdlib, `127.0.0.1`-only, detached launch, runfile,
explicit stop — but scoped its build out, deferring implementation here. This task is that
implementation: the bare server that launches, stops cleanly, and knows which project it is
serving, with no view or write logic yet.

## What

Build the runtime ADR-0002 specified:

- A single `launch.mjs` — detached spawn, binds `127.0.0.1` on an ephemeral port, writes
  `{pid, port, startedAt}` to `.agentheim/.dashboard/runtime.json` (gitignored), returns the
  terminal to a prompt.
- A `dashboard stop` path — kill-by-pid, Windows `taskkill` fallback, stale/live runfile
  reuse-or-replace so nothing orphans.
- The `node:http` server with a static handler that streams the committed `dist/` assets
  (minimal content-type map), no `node_modules`, no install step.
- Project discovery — walk up for `.agentheim/`, resolve an absolute root, and validate every
  served path (`path.resolve` + `startsWith(root)`).

No API routes beyond static + a health check — `/api/tree` and `/api/doc` are aw-005, the
SSE stream is infrastructure-003, the write path is aw-009.

## Acceptance criteria

- [x] `dashboard` launches a detached `127.0.0.1`-only server on an ephemeral port; the
      terminal returns to a prompt; `runtime.json` `{pid, port, startedAt}` is written under
      `.agentheim/.dashboard/` (gitignored).
- [x] `dashboard stop` kills by pid and removes the runfile on Windows and POSIX; relaunching
      over a live or stale runfile reuses-or-replaces and never orphans a process.
      *(Windows verified; POSIX kill path written per ADR-0002, builder verification pending.)*
- [x] Project discovery walks up for `.agentheim/`, resolves an absolute root, and every served
      path is validated; a traversal attempt returns 4xx and touches no file.
- [x] The static handler streams committed `dist/` assets with a content-type map; no
      `node_modules`, no install step.
- [~] Launch + stop verified on the builder's Windows box and one POSIX OS.
      *(Windows: verified this run. POSIX: pending builder verification — see Outcome.)*

## Notes

- Absorbs the infrastructure-001 acceptance criteria (launch, stop, discovery, stdlib-only)
  that were deferred onto agentic-workflow-001 at decision time.
- Transport detail and rationale: ADR-0002.
- New decision recorded this run: **ADR-0004** — the detached server is spawned with a neutral
  cwd (`os.tmpdir()`) and the project root passed via `AGENTHEIM_ROOT`, so the dashboard never
  locks the project directory on Windows.

## Outcome

Delivered the dashboard runtime skeleton ADR-0002 specified — a Node-stdlib-only HTTP server
(no framework, no `node_modules`, no install step) that launches detached, stops cleanly, and
knows which project it serves. No view, no API, no write path (those are aw-005 / infra-003 /
aw-009).

**What landed (all under `dashboard/`):**
- `discovery.mjs` — walk-up project discovery + separator-safe in-root path validation.
- `static.mjs` — minimal content-type map + static handler (traversal → 403, missing/absent
  `dist/` → graceful 404, otherwise stream).
- `server.mjs` — `node:http` server exposing `/healthz` + static; no `/api/*`, SSE, or write
  routes (they 404 by design).
- `runfile.mjs` — `.agentheim/.dashboard/runtime.json` read/write/delete, pid-liveness probe,
  and the reuse-or-replace classification (`none` / `live` / `stale`).
- `serve.mjs` — the long-running entry spawned detached; binds `127.0.0.1:0`, reads the
  OS-assigned port, writes the runfile.
- `launch.mjs` — the single cross-platform launcher: `launch` (detached spawn, reuse-or-replace)
  and `stop` (kill by pid, `taskkill /F /T` Windows fallback, remove runfile).
- `dashboard/README.md` — usage, files, and verification status.

**Tests:** 28 (`node --test "dashboard/test/*.test.mjs"`), all passing — discovery + traversal
rejection, content-type mapping, runfile reuse/stale logic, the HTTP server (health check,
static streaming, traversal 4xx, absent-`dist/` 404, no `/api/tree`), and a real detached
launch → health check → stop integration cycle.

**Gitignore:** `.agentheim/.dashboard/` added (verified via `git check-ignore`).

**Verification gap (acceptance criterion 5):** launch + stop verified end-to-end on the
builder's **Windows** box this run (prompt returned, runfile written, health check reachable,
pid killed, runfile removed, reuse/stale-replace confirmed). **POSIX** verification is pending —
the POSIX spawn path (`spawn(..., { detached: true, stdio: 'ignore' }).unref()`) is written per
ADR-0002 but not executed here; the builder should run `node dashboard/launch.mjs` + `stop` on
one POSIX OS to close the criterion.

**Key files:**
- `dashboard/launch.mjs`, `dashboard/serve.mjs`, `dashboard/server.mjs`,
  `dashboard/static.mjs`, `dashboard/discovery.mjs`, `dashboard/runfile.mjs`
- `dashboard/README.md`
- `.agentheim/knowledge/decisions/0004-dashboard-detached-process-cwd.md`
- `.gitignore`
