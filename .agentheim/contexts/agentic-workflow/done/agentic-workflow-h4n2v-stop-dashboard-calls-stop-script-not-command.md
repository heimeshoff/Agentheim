---
id: agentic-workflow-h4n2v
title: Stop dashboard menu item calls the stop script, not the slash command
status: done
type: feature
context: agentic-workflow
created: 2026-07-09
completed: 2026-07-09
depends_on: [design-system-001-styleguide]
blocks: []
tags: [dashboard, topbar, settings-menu, stop, runfile, endpoint]
related_adrs: [0017, 0046, 0027, 0018, 0002, 0053]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [agentic-workflow-028, agentic-workflow-vmk1z, agentic-workflow-011, agentic-workflow-049, agentic-workflow-032]
---

## Why
Selecting **Stop dashboard** in the topbar settings menu currently fires
`launchOrCopy({ prompt: STOP_DASHBOARD_COMMAND })` — the bridge opens a terminal and boots an
entire Claude Code session whose only job is to run `/dashboard stop` → `stopDashboard(root)`:
kill a pid, delete a runfile. A whole agent session to reap a process.

Two costs. It is absurdly heavy for the work done. And it only works where the bridge is
present — in a plain browser the button can merely copy a command string to the clipboard, so
the one control labelled "Stop" cannot stop anything (aw-028 recorded that asymmetry as
accepted; it is now the thing to remove).

`stopDashboard(root)` already exists (`dashboard/launch.mjs:99`) and already has a CLI
(`node launch.mjs stop`). The button should call that script, not narrate a command to a
session that will.

## What
**The Stop dashboard menu item stops the dashboard directly, via a scoped `POST /api/stop`
endpoint on the dashboard server itself.**

This reverses aw-028's explicit seam ("the server is never asked to stop itself") and needs an
ADR. The reversal is narrower than it first looks, and ADR-0046 already cut the shape:

- **ADR-0017** made the dashboard read-only over the **task lifecycle** — no task moves, no
  `status` rewrite, no `INDEX.md` count, no `protocol.md` append, no backlink reconcile. It
  forbids the dashboard from owning *that*, not literally every byte on disk.
- **ADR-0046** carved exactly one bounded non-GET exception (`DELETE /api/whats-next`) for an
  **advisory** artifact, on the argument that deleting an opinion touches no lifecycle truth.
- Stopping the dashboard touches **less** than either. The only file involved is
  `.agentheim/.dashboard/runtime.json` — a runtime artifact the dashboard's own launch path
  wrote (`runfile.mjs`), that no skill reads and no board projection derives from. The server
  is not claiming new ownership; it already owns its runfile exclusively.

So the ADR names a **third write category — runtime self-lifecycle** — sibling to lifecycle
(ADR-0017, forbidden) and advisory (ADR-0027/0043/0046, one carve-out each): the dashboard may
end its own process and remove its own runfile on an explicit builder command.

The load-bearing implementation constraint: `stopDashboard(root)` terminates by pid, and under
`/api/stop` that pid **is the process serving the request**. The response must be fully flushed
before the process dies, or the browser's `fetch` rejects and the stopped overlay never renders.
Respond first, die on `finish`.

Because there is no bridge in the path, the clipboard fallback for stop disappears — the
button works in any browser, and the overlay is no longer optimistic-on-dispatch (aw-028's
"the spawned session still has to run it") but truthful-on-2xx.

## Acceptance criteria
- [ ] `POST /api/stop` is dispatched in `server.mjs` **before** the `req.method !== 'GET'` gate,
      exactly as `DELETE /api/whats-next` is — so the gate still 405s every other non-GET
      method, including any other method on `/api/stop` itself.
- [ ] The handler takes **no request body and no client-supplied path**; the root is derived
      server-side, mirroring `whats-next-delete.mjs`.
- [ ] The success response is **fully flushed before the process exits**. A test pins the
      ordering (respond → `res.on('finish')` → remove runfile → exit), and would fail an
      implementation that kills the pid first.
- [ ] `.agentheim/.dashboard/runtime.json` is gone after the call, and the server process is
      dead — verified against a real launched dashboard, not a mock.
- [ ] The board's Stop dashboard `MenuItem` no longer renders a `LaunchButton` and no longer
      references `STOP_DASHBOARD_COMMAND`; it POSTs `/api/stop`. Menu still closes first
      (controlled), then the overlay flips.
- [ ] The **"Dashboard stopped — safe to close this tab"** overlay renders on a 2xx, and now
      renders **with no bridge present** — drive it in a plain browser tab.
- [ ] `/agentheim:dashboard stop` (the skill) and `node dashboard/launch.mjs stop` (the CLI)
      still work unchanged. The terminal path is not removed, only unhooked from the button.
- [ ] `STOP_DASHBOARD_COMMAND` is deleted from `dashboard/app/modeling-command.js` if the grep
      shows no surviving consumer. `WORK_COMMAND` / `MODELING_COMMAND` are untouched.
- [ ] An ADR records the runtime-self-lifecycle category, amends ADR-0017 §"read-only" and
      ADR-0046's "exactly one write", and marks aw-028's "the server is never asked to stop
      itself" as superseded.
- [ ] `.agentheim/contexts/agentic-workflow/README.md` (the Stop-dashboard paragraph, ~L455–463)
      no longer claims the server is never asked to stop itself, and drops the
      bridge-present/absent asymmetry for stop.
- [ ] `dashboard/dist/` rebuilt (`node build.mjs`) so the shipped bundle carries the change.

## Notes
**Open sub-question for the worker.** `stopDashboard(root)` = `terminate(rf.pid)` +
`deleteRunfile(root)`. Called from inside the server, `rf.pid === process.pid`, so it is
self-signalling. Two options, worker's call — record whichever in the ADR:
- Reuse `stopDashboard(root)` wholesale (one implementation, but a process signalling itself).
- A dedicated in-process path (`deleteRunfile(root)` + `server.close()` + `process.exit(0)`),
  leaving `stopDashboard` for the out-of-process CLI/skill callers.

The second reads cleaner and sidesteps `terminate()`'s cross-platform pid-kill branches, but
splits the "stop" implementation in two. Prefer it only if the split stays honest — both paths
must remove the runfile.

**Security surface.** `POST /api/stop` on a `127.0.0.1`-bound server is reachable by CSRF from
any page the builder has open (`fetch(..., {mode:'no-cors'})`). Impact is bounded: it stops a
local dev dashboard. This is the *same* exposure `DELETE /api/whats-next` already accepts, so
matching its guards (no body, no client path, server-derived target) keeps the two consistent.
If the ADR wants an `Origin`/`Sec-Fetch-Site` check, add it to **both** endpoints or neither —
don't leave them asymmetric.

**Relevant code.**
- `dashboard/server.mjs:59-83` — the events/whats-next pre-gate dispatch + the 405 method gate.
- `dashboard/whats-next-delete.mjs` — the guard shape to copy.
- `dashboard/launch.mjs:99` — `stopDashboard(root)`; CLI at `:120`.
- `dashboard/runfile.mjs:13` — `.agentheim/.dashboard/runtime.json`.
- `dashboard/app/board.js:2862-2868` — the menu item; `:3224-3236` — the stopped overlay + the
  comment block that documents the behaviour being replaced.
- `dashboard/app/modeling-command.js:89-93` — `STOP_DASHBOARD_COMMAND` and its rationale.

**Advisory.** The BC README is 791 lines, past ADR-0041's ~600-line consolidation trigger.
Not this task's job — worth a `/agentheim:modeling consolidate agentic-workflow README` pass.

## Outcome

Implemented exactly per the task's shape and ADR-0046's precedent. The Stop dashboard
control POSTs a new scoped `POST /api/stop` endpoint directly — no bridge, no spawned
session, no `STOP_DASHBOARD_COMMAND` (retired, no surviving consumer). This reverses
aw-028's "the server is never asked to stop itself" and removes the bridge-present/absent
asymmetry aw-028 accepted for Stop specifically: the control now works identically in any
browser tab.

**Server (`dashboard/stop-api.mjs`, new):** `handleStop(req, res, root, { exit })` responds
`204` immediately, then — only once Node's `res` emits `'finish'` (fully flushed to the
socket) — removes the runfile (`deleteRunfile`, `runfile.mjs`) and calls `exit(0)`
(`process.exit` by default; injectable purely for tests). This ordering is load-bearing:
the handler kills the very process serving the request, so a kill-first implementation
would drop the connection before the browser's `fetch` resolves and the "Dashboard
stopped" overlay would never render. `dashboard/server.mjs` dispatches
`POST /api/stop` before the `405` method gate, mirroring `DELETE /api/whats-next`'s
placement exactly; `createDashboardServer` gained a `stop` options passthrough so tests
can inject a non-exiting `exit` spy. Chose the **dedicated in-process path**
(`deleteRunfile` + `process.exit(0)`) over reusing `stopDashboard(root)` wholesale — see
ADR-0053 §3 for the full reasoning (sidesteps `terminate()`'s cross-platform pid-kill /
`taskkill` branches, which exist for killing an *external* process, not this one).
`stopDashboard(root)` / `terminate()` / the CLI (`node launch.mjs stop`) / the
`/agentheim:dashboard stop` skill path are **completely unchanged**.

**Client (`dashboard/app/board.js`):** new `StopDashboardButton` (purely presentational,
no `command`, no `LaunchButton`) replaces the old bridge-launch element inside
`SettingsMenu`. `SettingsMenu`'s new `onStopClick` handler POSTs `/api/stop`, closes the
menu (`setOpen(false)`), then flips the shell `stopped` state **only on a truthful
`res.ok`** (not merely on dispatch) — the overlay is now truthful-on-2xx rather than
optimistic-on-bridge-dispatch. `STOP_DASHBOARD_COMMAND` removed from
`dashboard/app/modeling-command.js` (grep confirmed no surviving consumer).

**Security:** no `Origin`/`Sec-Fetch-Site` check added to either `POST /api/stop` or
`DELETE /api/whats-next` — kept symmetric per the task's explicit instruction (ADR-0053
§4). Same guards as `DELETE /api/whats-next`: no request body, no client-supplied path,
server-derived target.

**ADR-0053** (new, global scope) names the third write category — **runtime
self-lifecycle** — amends ADR-0017's read-only framing and ADR-0046's "exactly one write"
claim, and marks aw-028's "never asked to stop itself" as superseded.

**Runtime-verified against a real launched dashboard** (not a mock): launched via
`node dashboard/launch.mjs`, read the actual bound port from `runtime.json` (41354),
`POST /api/stop` → `204`, confirmed the runfile was removed and the pid (45000) was
dead (`tasklist` showed no matching task). Re-verified the CLI stop path
(`node dashboard/launch.mjs stop`) still works unchanged on a fresh launch.

Tests: dashboard suite 784/784 passing (`cd dashboard && node --test test/*.test.mjs`,
baseline 775 + new/restructured coverage), lib suite 189/189 passing (baseline 189,
unchanged). New `dashboard/test/stop-api.test.mjs` (6 tests) pins the
respond→finish→remove-runfile→exit ordering (verified red against a deliberately
kill-first variant, then green after restoring the correct implementation) plus the
dispatch-before-405-gate / 405-gate / no-body-no-query contract. Updated
`dashboard/test/stop-dashboard.test.mjs`, `dashboard/test/settings-menu.test.mjs`,
`dashboard/test/modeling-command.test.mjs`, `dashboard/test/topbar-launch-large.test.mjs`
to match the new wiring (StopDashboardButton, no STOP_DASHBOARD_COMMAND). `dashboard/dist/`
rebuilt via `node build.mjs` from inside the worktree.

Key files:
- `dashboard/stop-api.mjs` (new)
- `dashboard/server.mjs`
- `dashboard/app/board.js`
- `dashboard/app/modeling-command.js`
- `dashboard/test/stop-api.test.mjs` (new)
- `dashboard/test/stop-dashboard.test.mjs`
- `dashboard/test/settings-menu.test.mjs`
- `dashboard/test/modeling-command.test.mjs`
- `dashboard/test/topbar-launch-large.test.mjs`
- `dashboard/dist/` (rebuilt)
- `.agentheim/knowledge/decisions/0053-runtime-self-lifecycle-dashboard-stop-endpoint.md` (new)
- `.agentheim/contexts/agentic-workflow/README.md` (Stop-dashboard + no-lifecycle-write-path
  sections)
