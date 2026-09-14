---
id: infrastructure-nz2e8
title: A Herdr-mediated launch opens a new terminal window on Windows even though a Herdr session is already running — the session should land as a tab in the existing Herdr view with no extra OS window; hide the console of every herdr child the dashboard server spawns and harden the workspace-reuse cwd match
status: doing
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
