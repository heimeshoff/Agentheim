---
id: agentic-workflow-011
title: /dashboard command — launch, stop, status, auto-open
status: done
type: feature
context: agentic-workflow
created: 2026-06-07
completed: 2026-06-07
commit: ca3a150
depends_on: []
blocks: []
tags: [dashboard, command, launcher, cli, slash-command]
related_adrs: [ADR-0002, ADR-0004]
related_research: []
prior_art: [agentic-workflow-004, agentic-workflow-001]
---

## Why

The dashboard runtime and its launcher already exist (`dashboard/launch.mjs`, built in
agentic-workflow-004), and "Dashboard" is listed as a Key command of this BC — but there is no
actual trigger for it. Today the builder must run `node dashboard/launch.mjs` by hand. The intent
("Dashboard launches the local web UI") is modeled but not invocable. This task supplies the
missing entry-point: typing `/dashboard` starts it.

## What

A `/dashboard` command that drives the existing launcher, with three verbs and browser auto-open:

- `/dashboard` — launch (or reuse) the detached server, then **auto-open** the default browser at
  `http://127.0.0.1:<port>/`.
- `/dashboard stop` — terminate the detached server and remove the runfile.
- `/dashboard status` — report whether a server is already running and on which port (from the
  runfile), without launching.

**Slash-command exception (decided 2026-06-07).** Agentheim's stated principle is that skills are
triggered by phrasing, not slash commands ("no slash commands to memorize" — vision + BC README).
`/dashboard` is a **deliberate, documented exception**: the dashboard is a process-launcher, not a
Socratic dialogue, so a literal slash command is the right surface. The exception must be written
into the ubiquitous language (BC README "Key commands" / "Skill" entry) so the departure is
explicit, not an erosion of the principle.

## Acceptance criteria

- [ ] Typing `/dashboard` launches the detached server (terminal returns to a prompt) and reports
      the URL + pid; if a live server already exists it is reused, not double-spawned.
- [ ] After a successful launch/reuse, the default browser opens at `http://127.0.0.1:<port>/`
      (cross-OS: `start` on Windows, `open` on macOS, `xdg-open` on Linux).
- [ ] `/dashboard stop` terminates the detached process and removes the runfile; a no-op (with a
      clear message) when nothing is running.
- [ ] `/dashboard status` reports running/not-running and the port, reading the runfile only —
      it never launches or stops.
- [ ] The slash-command exception is documented in the BC README ubiquitous language so the
      "phrasing, not slash commands" principle and this exception are both explicit.
- [ ] The existing lib + dashboard test suites stay green; any new launcher logic (status verb,
      auto-open) is covered.

## Notes

- **Likely shape (worker/architect to confirm):** extend `dashboard/launch.mjs` with a `status`
  verb and an auto-open step (a small cross-OS `openBrowser(url)` helper), then add a thin
  `commands/dashboard.md` plugin command file (the `commands/` directory does not exist yet) that
  invokes the launcher and passes through the verb. Keeping the new logic in `launch.mjs` (already
  the single home for all OS-specific spawn/kill differences — ADR-0002) means the command file
  stays a thin trigger and the cross-OS surface stays in one place.
- The launcher already exposes `launchDashboard`, `stopDashboard`, `terminate`, and runfile
  helpers (`readRunfile`, `inspectExisting`, `isPidAlive`); `status` is a read over the same
  runfile `inspectExisting` already inspects. Reuse, don't re-derive.
- Auto-open is the one genuinely new cross-OS path; it joins the spawn/kill path as OS-divergent
  code and should be confined to `launch.mjs` accordingly. Worth a line in the POSIX cross-OS
  spike (agentic-workflow-010) once that runs.
- Governing decisions: ADR-0002 (Node-stdlib localhost transport, detached launch, walk-up
  discovery), ADR-0004 (neutral cwd + `AGENTHEIM_ROOT`). Prior art: aw-004 built the launcher
  this wraps; aw-001 is the dashboard epic it completes the surface of.
- Not a frontend/UI change — it launches the existing UI but authors none, so the design-system
  styleguide gate does not apply.

## Outcome

The `/dashboard` command now exists as the builder-facing trigger for the dashboard runtime.

- `commands/dashboard.md` — a thin Claude Code plugin slash command (the `commands/` directory's
  first file) that passes its verb (`/`, `stop`, `status`) straight through to
  `node dashboard/launch.mjs`. No launch/stop/status logic lives in the command file.
- `dashboard/launch.mjs` — extended with three exported functions, keeping all OS-divergent code
  in the single launcher per ADR-0002:
  - `statusDashboard(root)` — pure read over the runfile (`{ state:'running', port, pid }` /
    `{ state:'none' }`) via `inspectExisting`, which also reaps a stale (dead-pid) runfile; never
    launches or stops.
  - `browserCommand(platform, url)` + `openBrowser(url, opts)` — the one new OS-divergent path:
    `cmd /c start "" <url>` (Windows), `open <url>` (macOS), `xdg-open <url>` (Linux). Spawned
    detached+unref and best-effort (a failed browser-open never fails the launch). `opts.spawnFn`
    / `opts.platform` are injectable for tests.
  - CLI wired for the new `status` verb and for auto-open after a successful launch/reuse.
- `dashboard/test/status-open.test.mjs` — 6 new tests covering the status verb (none / running /
  stale-reaped) and the auto-open helpers (per-platform command selection, detached spawn,
  error-swallowing). Red-green-refactor followed.

Tests: `dashboard/test/` 106/106 (was 100; +6), `lib/test/` 13/13 — all green. Live-verified on
Windows: `node dashboard/launch.mjs status` correctly reported a running server + port read from
the runfile without launching.

Ubiquitous language: the BC README now documents `/dashboard` as the **single, deliberate
slash-command exception** to the "phrasing, not slash commands" principle (new term entry + Key
commands / Dashboard entry). `dashboard/README.md` usage updated with the `status` verb, auto-open
behavior, and the `/dashboard` surface.

No ADR written — the slash-command exception was decided during modeling (already in the task /
BC README), and the auto-open command choices follow ADR-0002's single-home principle; no new
"why this, not the obvious alternative?" decision was introduced.

Key files:
- `commands/dashboard.md`
- `dashboard/launch.mjs`
- `dashboard/test/status-open.test.mjs`
- `.agentheim/contexts/agentic-workflow/README.md`
- `dashboard/README.md`
