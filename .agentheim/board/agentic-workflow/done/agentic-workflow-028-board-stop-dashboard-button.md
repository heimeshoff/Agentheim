---
id: agentic-workflow-028
title: Add a button to stop the dashboard from the dashboard
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: 77e9c41
depends_on: [design-system-001, agentic-workflow-029]
blocks: []
tags: [dashboard, topbar, stop, bridge-launch, frontend]
related_adrs: [0018, 0001, 0017, 0003, 0019]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [agentic-workflow-011, agentic-workflow-020, agentic-workflow-024, agentic-workflow-016]
---

## Why
Once the dashboard is open in the browser, the only way to stop the server is to go
back to a session and type `/dashboard stop`. The builder wants to stop it from the UI
it is already looking at — a one-click "I'm done" affordance next to the other session
controls in the topbar.

## What
Add a **Stop dashboard** button to the main-column **topbar**, alongside the existing
inverse **Work** launch. Clicking it stops the running dashboard server **by reusing the
existing bridge launch path** (the seam decision — see Notes), not a new server endpoint:

- The button fires `launchOrCopy({ prompt: STOP_DASHBOARD_COMMAND, … })`
  (`dashboard/app/bridge-launch.js`, unchanged) with **no confirmation step** (builder
  decision — a single click stops, matching the directness of `/dashboard stop`).
- `STOP_DASHBOARD_COMMAND` is a new **bare constant** `'/agentheim:dashboard stop'` in
  `dashboard/app/modeling-command.js` — fully-qualified for the same reason
  `WORK_COMMAND` / `MODELING_COMMAND` are (resolves regardless of the builder's alias
  setup, aw-016). It takes no prompt and has no `*CommandFor` builder (it ignores the
  board prompt-bar textarea, exactly like `WORK_COMMAND`, aw-024).
- The bridge wraps it as `claude "/agentheim:dashboard stop"` and opens a terminal; that
  session invokes `/dashboard stop` → `stopDashboard(root)` (kill pid + remove runfile),
  exactly as today. The server is never asked to stop itself.

**Post-stop UX (builder decision — "Stopped" overlay):** the outcome is driven off
`launchOrCopy`'s return value, which discriminates the two paths cleanly:

- **Bridge dispatch** (`res.via === 'bridge'`) → the shell shows a terminal full-pane
  **"Dashboard stopped — safe to close this tab"** overlay over the main content area.
  The page is now talking to a server that is shutting down, so the overlay is the honest
  end state. (It is *optimistic* on dispatch; the SSE stream dropping shortly after
  corroborates it — see Notes.)
- **Clipboard fallback** (`res.via === 'clipboard'`) → **no overlay**. Nothing was
  actually stopped — the command was only copied for the builder to paste into a running
  session — so the button flashes the existing quiet **"Copied"** feedback only. Showing
  a "Stopped" overlay here would be a lie.

This is the **accepted bridge-present/absent asymmetry** (amended ADR-0018, same shape as
aw-021's skip-permissions cue): in a plain browser with no bridge, a "Stop" button can
only copy the command, not stop. Accepted, not a defect.

## Acceptance criteria
- [ ] A **Stop dashboard** button renders in the main-column **topbar**, as a sibling of
      the inverse Work launch (placement relative to the aw-029 cluster — see Notes).
- [ ] Clicking it calls `launchOrCopy({ prompt: STOP_DASHBOARD_COMMAND, … })` with **no
      confirmation** — a single click fires the stop.
- [ ] `STOP_DASHBOARD_COMMAND` is a new bare constant `'/agentheim:dashboard stop'` in
      `dashboard/app/modeling-command.js`, exported and covered by a `node --test` unit
      test (it is a plain constant, no prompt builder).
- [ ] On a **bridge** result (`res.via === 'bridge'`) the shell shows a terminal full-pane
      **"Dashboard stopped — safe to close this tab"** overlay over the main content area.
- [ ] On a **clipboard** result (`res.via === 'clipboard'`) **no** overlay is shown; the
      button flashes the existing "Copied" feedback only.
- [ ] The Stop button and the overlay are **board-local, token-matched**; the styleguide
      is consumed **unforked** (ADR-0003) and **no styleguide source is modified** (there
      is no full-screen modal primitive — `Drawer` is a side panel and is not used here).
- [ ] **No new server endpoint** is added: `dashboard/server.mjs` keeps its read-only
      GET/HEAD-only contract; the stop reaches the server only through the external
      `/dashboard stop` session (ADR-0017 read-only preserved; ADR-0001/0018 — launching a
      session is an external side-effect, not a lifecycle write).
- [ ] The dashboard `dist/` bundle is rebuilt to carry the new control + overlay.
- [ ] New + existing dashboard tests are green: the new `modeling-command` constant test,
      plus a `board.js` test asserting overlay-on-`bridge` / no-overlay-on-`clipboard`
      (drive it through `LaunchButton`'s existing `onResult`).

## Notes
- **Seam decision (builder, 2026-06-15):** of the two ways a browser button could reach
  the kill — (A) a new self-stop endpoint on the server, or (B) reuse the bridge launch to
  run `/dashboard stop` — the builder chose **(B)**. This keeps the server **purely
  read-only** (no first mutating endpoint, ADR-0017 untouched) and reuses the aw-020/022/024
  `launchOrCopy` + `LaunchButton` infrastructure unchanged. **No ADR is required**: the
  chosen path adds no mutating endpoint and reopens no doctrine — it is a straight reuse of
  ADR-0018's launch path under ADR-0001's "a launch is an external side-effect, not a
  lifecycle write." (Option A was rejected precisely because it would have demanded an ADR
  carving process-shutdown out of ADR-0017's read-only scope.)
- **Wiring:** `LaunchButton` already accepts an `onResult(res)` callback (aw-023). The Stop
  control passes an `onResult` that flips a shell-level "stopped" state when
  `res.via === 'bridge'`, which `DashboardApp` renders as the overlay. No new plumbing in
  `bridge-launch.js` or `launchOrCopy`.
- **Optimistic overlay:** `res.via === 'bridge'` means `POST /run` was *dispatched* (the
  terminal opened), not that the server is confirmed dead — the spawned session still has to
  run `/dashboard stop`. The overlay is therefore optimistic; the SSE stream dropping a
  moment later (live-update already tracks connection state) naturally corroborates it. A
  nice-to-have (not required by the AC) is to key/confirm the overlay off actual
  server-death detection rather than dispatch alone.
- **skip-permissions:** Stop reuses the shared `launchOrCopy` seam, so threading
  `skipPermissions` is immaterial to the outcome (the spawned session just runs
  `/dashboard stop` and exits). Keep it seam-uniform if trivial, but the Stop button does
  **not** render the armed/danger per-launch cue (aw-021) — that cue is about authoring/work
  launches doing risky work with bypassed permissions, which a stop is not.
- **Placement / dependency on aw-029:** aw-029 (in `todo/`) moves the theme +
  skip-permissions toggles into the topbar, establishing a `[theme][skip-perms][Work]`
  cluster. This task adds Stop into that same topbar region of `board.js`, so it
  `depends_on: [agentic-workflow-029]` to (a) serialize the two edits to the same file and
  (b) add Stop into a settled cluster. Suggested placement: a quiet/distinct treatment set
  **apart** from the cluster (e.g. far edge) so it never reads or fat-fingers as the Work
  primary — confirm exact position against the aw-029 layout when worked.
- **Frontend gate satisfied:** `design-system-001` (styleguide) is done.
- Prior art: aw-011 (`/dashboard` stop/status/launch command this drives), aw-020
  (`launchOrCopy` + `LaunchButton`), aw-024 (bare `WORK_COMMAND` constant pattern), aw-016
  (clipboard copy + no-throw `copyToClipboard`).

## Outcome
Added a quiet **Stop dashboard** launch to the main-column `BoardTopbar`, set **apart**
from the `[theme][skip-perms][Work]` cluster (far left, after the breadcrumb,
`emphasis="quiet"`), reusing the existing `launchOrCopy` bridge path **unchanged** to run
the new bare constant `STOP_DASHBOARD_COMMAND = '/agentheim:dashboard stop'`. No new server
endpoint — `server.mjs` stays read-only (ADR-0017); the spawned session runs
`/dashboard stop` -> `stopDashboard(root)`. **No confirmation**, and the button does **not**
thread `skipPermissions` (no armed/danger cue — aw-021/ADR-0019 non-goal).

Post-stop UX is driven off `launchOrCopy`'s discriminated return via the button's
`onResult`: `res.via === "bridge"` flips a shell-level `stopped` state in `DashboardApp`,
which mounts a board-local, token-matched full-pane `StoppedOverlay`
("Dashboard stopped — safe to close this tab") over the main content area (optimistic on
dispatch). `res.via === "clipboard"` shows **no** overlay (nothing stopped) — just the
existing quiet "Copied" flash. The overlay is composed from tokens, not the `Drawer` side
panel (ADR-0003 unforked). No ADR required (bridge-reuse adds no mutating endpoint and
reopens no doctrine — straight reuse of ADR-0018/0001).

Key files:
- `dashboard/app/modeling-command.js` — new bare `STOP_DASHBOARD_COMMAND` constant.
- `dashboard/app/board.js` — `BoardTopbar` Stop button + `onStopped`/`onStopResult` wiring;
  `DashboardApp` `stopped` state + relatively-positioned content wrapper; new
  `StoppedOverlay` component.
- `dashboard/test/modeling-command.test.mjs` — constant unit tests.
- `dashboard/test/stop-dashboard.test.mjs` — new static/glue guards (placement-apart,
  no-armed-cue, no-confirm, overlay-on-bridge / no-overlay-on-clipboard, board-local overlay).
- `dashboard/dist/app.js` — rebuilt bundle.

Tests: new + touched suites green (64/64 across modeling-command, stop-dashboard,
shell-relayout, board-prompt-bar, dist-build). The only full-suite failure is the
pre-existing flaky SSE watcher-timing race in `events.test.mjs` (passes/fails run-to-run on
its own; untouched by this change).
</content>
</invoke>
