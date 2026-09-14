---
id: infrastructure-nz2e8
title: A Herdr-mediated launch opens a new terminal window on Windows even though a Herdr session is already running — the session should land as a tab in the existing Herdr view with no extra OS window; hide the console of every herdr child the dashboard server spawns and harden the workspace-reuse cwd match
status: done
type: bug
context: infrastructure
created: 2026-09-14
completed:
depends_on: []
blocks: []
tags: [herdr, bridge, launch, windows, console]
related_adrs: [0082, 0018]
related_research: []
prior_art: [infrastructure-w506e, infrastructure-xh8tw, infrastructure-p3k9r, infrastructure-vpbks]
---

## Why

**Builder report (2026-09-14, after v0.9.5 / infrastructure-w506e shipped):** adding a prompt
through the Herdr bridge opens a *new terminal window* even though a Herdr session is already
running. The builder does not want that — the new Claude session should simply pop up in the
already-open Herdr view.

This is the second sighting of the same shape. infrastructure-w506e's report included Herdr
"starting to open a terminal, fade in and out" — recorded there as builder-observed, not
reproduced, and left out of scope. w506e fixed *intra-Herdr* focus (`--focus` on
`workspace create` / `tab create`). This task is about the *OS-level* window that appears
alongside the launch.

**Evidence gathered at capture (read-only, live install, Herdr 0.9.0 / protocol 22):**

1. `herdr api snapshot` holds a workspace labelled `Agentheim` with three panes whose `cwd` is
   the project root in backslash form — byte-equal to the `pluginRoot` string in
   `.agentheim/.dashboard/runtime.json`. So on this box `handleBridgeLaunch`'s exact-string
   match (`p.cwd === root`, `dashboard/bridge-launch-api.mjs` ~line 294) is expected to hit
   and take the `tab create --workspace <id>` branch — workspace reuse itself is probably not
   the failure. It is still only an exact-string compare; see acceptance criterion 2.
2. The dashboard server is spawned by `dashboard/launch.mjs` with `detached: true`,
   `windowsHide: true`, `stdio: 'ignore'` — on win32 that is `DETACHED_PROCESS` +
   `CREATE_NO_WINDOW`, i.e. the server owns **no console**. Every `herdr` child it then starts
   is spawned *without* `windowsHide`: the awaited `execFileSync` calls (`api snapshot`,
   `agent list`, `tab create` / `workspace create`, ~lines 198 and 284-312), the
   fire-and-forget `spawn(binaryPath, args, { stdio: 'ignore' })` for `agent start`
   (~line 350), and `checkHerdrLiveness`'s `execFileSync(binaryPath, ['status'])` in
   `lib/resolve-herdr.mjs` (~line 209). A console-subsystem child of a console-less parent is
   allocated a fresh, visible console on Windows unless `CREATE_NO_WINDOW` is set. The short
   awaited calls would flash (w506e's "fade in and out"); the `agent start` child lives until
   Claude is ready or `--timeout` (30 s default) elapses — long enough to read as "opens a new
   terminal window".
3. An attempt to reproduce the console allocation from a sandboxed probe in the capture session
   was inconclusive (the sandbox reaps detached children), so item 2 is a strong, mechanism-level
   hypothesis, not a confirmed cause. The worker reproduces against the live install first
   (see Notes).

## What

Make a Herdr-mediated launch on Windows produce **no new OS window**: the Claude session lands
as a new focused tab in the Herdr workspace already open at the project root, and nothing else
appears on screen.

- Pass `windowsHide: true` on every `herdr` child process the dashboard server starts —
  `execFileSync` and `spawn` alike, in `dashboard/bridge-launch-api.mjs` and
  `lib/resolve-herdr.mjs`. The option is harmless on POSIX, so it is unconditional, not
  platform-gated.
- Harden the workspace-reuse match so a path-form difference alone can never push a launch onto
  the `workspace create` branch: compare `root` and each pane `cwd` through one small pure
  normaliser (resolve both, strip a trailing separator, case-insensitive on win32), unit-tested
  with the reuse branch as the expected outcome for mixed separator forms.
- Record the rule in ADR-0082 (amendment to §5/§6: "the server owns no console; every herdr
  child is spawned hidden") and in the infrastructure README's Herdr-mediated-launch entry via
  the reported README delta.

## Acceptance criteria

- [ ] Every `herdr` child process the dashboard server starts passes `windowsHide: true`: the
      awaited `api snapshot` / `agent list` / `tab create` / `workspace create` calls and the
      fire-and-forget `agent start` spawn in `dashboard/bridge-launch-api.mjs`, and
      `checkHerdrLiveness`'s `herdr status` in `lib/resolve-herdr.mjs`. A `node --test` case
      asserts the option on every call the existing injectable `exec` / `spawnFn` seams
      receive (extending `dashboard/test/bridge-launch-api.test.mjs` and
      `lib/test/resolve-herdr.test.mjs`).
- [ ] The workspace-reuse decision in `handleBridgeLaunch` compares `root` and pane `cwd`
      through a normaliser: a unit test with the pane `cwd` in backslash form and `root` in
      forward-slash form (and the reverse, and a trailing-separator variant) takes the
      `tab create --workspace <id>` branch, never `workspace create`; a genuinely different
      directory still takes `workspace create`.
- [ ] ADR-0082 is amended (§5/§6) to record that the dashboard server owns no console and every
      `herdr` child is spawned hidden, and the infrastructure README's Herdr-mediated-launch entry
      carries the same rule via the worker's reported README delta.
- [ ] On a live Windows Herdr with a workspace already open at the project root, clicking a
      board launch button opens no new OS terminal window; the Claude session appears as a new
      focused tab in that existing workspace. [human-eye]

## Notes

- **Reproduce first, against the live install.** Start a fresh dashboard server from the
  current tree (the server running at capture time, pid 15776, was started before v0.9.5 and
  serves the 0.9.4 bundle — do not judge the fix against it). With a Herdr workspace open at the
  project root, POST one real launch and watch for the extra window; then confirm the awaited
  topology call was `tab create --workspace <id>` (a second `api snapshot` shows the new tab in
  the existing workspace, not a new workspace). If the reuse branch did *not* fire despite the
  byte-equal cwd seen at capture, record what the two strings actually were in the Outcome.
- If the window turns out to come from somewhere other than the un-hidden child spawns (for
  example Herdr itself attaching a TUI client on `--focus`), record the actual source in the
  Outcome and keep criterion 1 anyway — a console-less server must never let a child allocate
  a visible console.
- `windowsHide` is accepted by `spawn`, `execFile`, `execFileSync` and `spawnSync` alike; no
  platform branch is needed.
- The `--focus` flags from infrastructure-w506e stay — they are intra-Herdr focus (which
  workspace / tab the TUI renders), not the OS window this task removes.
- Herdr binary on the builder's machine is not on Git Bash's PATH; `lib/resolve-herdr.mjs`
  finds it under the known release root (see infrastructure-e8h9f).
- Dashboard build hygiene applies: the worker changes source and tests only; `dist/` is
  regenerated at release, not in the task branch.

## Verifier note (iteration 1)

**REASONS:**
- Acceptance criterion 1 enumerates four awaited `exec` call sites that must carry `windowsHide: true` — `api snapshot`, `agent list`, `tab create`, `workspace create` — plus the `agent start` spawn, and requires a `node --test` case asserting the option on every one. The `tab create` call site is the only one with NO assertion anywhere: the single windowsHide test (`dashboard/test/bridge-launch-api.test.mjs:449`, "every awaited exec call (api snapshot, workspace create, agent list) AND the fire-and-forget spawn receive windowsHide:true") feeds `panes: []`, so the handler takes the `workspace create` branch and the `tab create` exec is never invoked in that test; its own title silently drops `tab create` from the enumeration.
- The four new workspace-reuse tests are the only cases that do drive the `tab create` branch, but each declares its fake as `const exec = (bin, args) => {...}` (`dashboard/test/bridge-launch-api.test.mjs:486, 511, 536`) — the third `options` argument is discarded and never asserted. Consequence: deleting `HERDR_CHILD_OPTIONS` from the `tab create` arm of `dashboard/bridge-launch-api.mjs:352-357` leaves the entire suite green (confirmed: `node --test lib/test/resolve-herdr.test.mjs dashboard/test/bridge-launch-api.test.mjs` → 78/78 pass, with no assertion reaching that argument). That is precisely the "would fail if the production change were absent" property criterion 1 demands, and the unguarded branch is the one the builder's own repro takes — a Herdr workspace already open at the project root reuses via `tab create`, so the awaited child most likely to flash a console in the reported scenario is the one with no regression guard.
- Production code itself is correct on this point (`HERDR_CHILD_OPTIONS` IS passed at `dashboard/bridge-launch-api.mjs:356`); the defect is missing falsifiable coverage, not a missing fix.

**SUGGESTED_FIX:** Extend the existing windowsHide test to also exercise the reuse branch (give the `api snapshot` fixture a pane whose `cwd` matches `root` so `tab create` fires, and keep the existing loop asserting `options.windowsHide === true` on every captured call), or capture and assert the third `options` argument in the four workspace-reuse tests' `exec` fakes. Everything else in the diff (the `cwdsMatch`/`normalizeCwdForComparison` normaliser and its 6 unit + 4 handler-level tests, the `checkHerdrLiveness` seam and its 2 tests, the reported ADR-0082 amendment and README delta) reads sound — no other change is needed.

**ITERATION_HINT:** likely-fixable

## Outcome

Two independent fixes for the builder's "Herdr launch opens a new terminal window" report,
both restricted to the two `herdr`-child-spawning modules.

**1. `windowsHide: true` on every `herdr` child (ADR-0082 §5/§6 amended).** The dashboard
server owns no console on win32 (`dashboard/launch.mjs`: `detached: true`, `windowsHide: true`,
`stdio: 'ignore'` → `DETACHED_PROCESS` + `CREATE_NO_WINDOW`), and a console-subsystem child of a
console-less parent is handed a fresh, visible console unless the child spawn itself sets
`windowsHide`. A new shared `HERDR_CHILD_OPTIONS = Object.freeze({ windowsHide: true })` lives in
`lib/resolve-herdr.mjs` and is imported into `dashboard/bridge-launch-api.mjs`. Rather than baking
it into a default implementation's internals (which the injectable `exec`/`spawnFn` seams could
never observe), it is threaded through the seams' own call sites: `defaultExec`/`defaultListAgentNames`
in `bridge-launch-api.mjs` now accept an `options` parameter, every `exec(binaryPath, args, ...)`
call site (`api snapshot`, `tab create`/`workspace create`, `agent list`) passes
`HERDR_CHILD_OPTIONS` explicitly, and the fire-and-forget `spawnFn(binaryPath, args, {stdio:
'ignore', ...HERDR_CHILD_OPTIONS})` carries it too. `lib/resolve-herdr.mjs`'s `checkHerdrLiveness`
now calls its injected `exec(binaryPath, HERDR_CHILD_OPTIONS)` the same way, and its own
`defaultExec` spreads `options` into the real `execFileSync` call.

**2. Hardened workspace-reuse cwd match.** `handleBridgeLaunch`'s pane match no longer uses a bare
`p.cwd === root`; it goes through new pure, platform-injectable `normalizeCwdForComparison`/
`cwdsMatch` functions (`dashboard/bridge-launch-api.mjs`) that resolve both sides via
`path.win32.resolve`/`path.posix.resolve`, strip a trailing separator, and (win32 only)
lower-case, before comparing. `handleBridgeLaunch` gained an `opts.platform` seam (defaults to
`process.platform`) so win32 behaviour is testable on any host OS, mirroring
`lib/resolve-herdr.mjs`'s own hermetic-fixture discipline. Unit tests cover the normaliser
directly (non-string input, mixed separator forms both directions, trailing separator,
win32 case-insensitivity, a genuinely different directory never matching) and the handler-level
reuse decision (backslash-vs-forward-slash both directions, a trailing-separator variant, and a
genuinely different directory still taking `workspace create`).

**Live reproduction (Herdr 0.9.0, real install, iteration 1).** Started a second dashboard
instance from this worktree (`node dashboard/launch.mjs`, its own ephemeral port and
`.agentheim/.dashboard/runtime.json` inside the worktree — removed by `POST /api/stop` at the
end, never committed). `GET /api/bridge` returned `kind:'herdr'`, `live:true`, and a fresh
per-process token. A real `POST /api/bridge/launch {"prompt":"echo nz2e8-windowshide-check",
"name":"nz2e8-windowshide-check"}` returned `202`; a subsequent `herdr api snapshot` showed a new
focused workspace `wG` with a pane whose `cwd` was this worktree's own root (no existing pane
matched it, so `workspace create` correctly fired — this worktree's root is not the pre-existing
`Agentheim` workspace's main-tree root, so the reuse branch itself wasn't exercised live). Every
`exec`/`spawn` call completed without error with `windowsHide: true` set; no crash, no hang.
**Could not observe the OS-level window from this background subagent context** (no attached
desktop session to watch for a flashing/persistent terminal) — a `tasklist` snapshot of
`conhost.exe`/`herdr.exe` before/after was inconclusive (many pre-existing `conhost.exe` instances
from unrelated shells on this box; no reliable before/after delta was captured), so this is NOT a
confirmed visual fix, only a confirmed no-crash/no-hang run with the flag correctly wired
end-to-end — exactly the sandboxed-probe caveat the task's Notes anticipated. Criterion 1 (every
`herdr` child carries `windowsHide: true`, unit-tested) is met regardless, per the task's own
"record the actual source … and keep criterion 1 anyway" guidance. Cleaned up: `herdr workspace
close wG`, `POST /api/stop`.

**Iteration 2 — coverage fix for the verifier's FAIL.** The verifier found that acceptance
criterion 1's `tab create` call site had no regression guard: the single windowsHide test
(`dashboard/test/bridge-launch-api.test.mjs`, "every awaited exec call …") feeds `panes: []`, so
only the `workspace create` branch fires; the four workspace-reuse tests are the only cases that
drive `tab create`, but each declared its `exec` fake as `(bin, args) => {...}`, discarding the
third `options` argument entirely. Per the redispatch's chosen remediation option, all four
workspace-reuse tests (`bridge-launch-api.test.mjs`, "a path-FORM difference alone", "the reverse
form", "a trailing-separator variant", "a genuinely different directory") now capture the third
`exec` argument (`calls.push({ args, options })`) and assert `windowsHide: true` on the specific
`tab create` (three tests) or `workspace create` (the fourth) call that actually fired, with test
titles updated to name the call site and mark the origin (infrastructure-nz2e8). Falsifiability
was proven by hand, not assumed: `HERDR_CHILD_OPTIONS` was temporarily removed from the `tab
create` arm of `dashboard/bridge-launch-api.mjs` (~line 353-357) — the three tab-create-driving
tests went RED (`AssertionError: tab create exec must receive windowsHide:true`), the fourth
(workspace-create-driving) test stayed green as expected since it exercises the other arm; the
line was then restored and the full suite confirmed GREEN again. The `windowsHide:true` guard on
the `tab create` branch is now provably load-bearing.

**Files:** `dashboard/bridge-launch-api.mjs`, `dashboard/test/bridge-launch-api.test.mjs`,
`lib/resolve-herdr.mjs`, `lib/test/resolve-herdr.test.mjs`. Full BC suite:
`node --test lib/test/*.test.mjs dashboard/test/*.test.mjs` → 1968/1968 passing, no flakes
observed on this run; isolated `node --test dashboard/test/bridge-launch-api.test.mjs` → 57/57
passing.

ADR-0082 §5/§6 amended and the infrastructure README's Herdr-mediated-launch bullet (in the
"Ubiquitous language" section) updated — see this result's `ADR_AMENDMENT` and `README_DELTA`
blocks.
