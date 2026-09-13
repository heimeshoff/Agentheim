---
id: infrastructure-e8h9f
title: Herdr bridge foundation — `/setup use bridge <vscode|herdr|none>` persists the selection to a per-machine config file, `status` reports Herdr install/liveness, and a shared `lib/resolve-herdr.mjs` finds the binary for both `/setup` and the dashboard server
status: doing
type: feature
context: infrastructure
created: 2026-09-13
completed:
depends_on: []
blocks: [infrastructure-xh8tw]
tags: [dashboard, bridge, herdr, setup]
related_adrs: [0082, 0079]
related_research: []
prior_art: [infrastructure-js62b, infrastructure-x56qm, infrastructure-kr9pd]
---

## Why

infrastructure-g6h1m split into three chained tasks (ADR-0082) because the Herdr bridge has a
real code dependency: the server-side launch endpoint and the frontend dispatch both need a
recorded bridge selection and a way to find the `herdr` binary before they can do anything. This
task is that foundation, built and tested standalone, with no UI surface of its own.

The bridge choice is a per-machine fact of exactly the kind `/setup` already owns (ADR-0079:
install the CLI, install the VS Code bridge, report state). `/setup` is where the builder says
which bridge — VS Code, Herdr, or none — the dashboard should use, and `status` is where the
builder learns whether Herdr is even installed and running, mirroring how `status` already
reports the VS Code bridge's install state.

## What

1. **A per-machine selection file.** `lib/bridge-selection.mjs` reads and writes
   `<home>/.config/agentheim/config.json` (`{schema:1, bridge:'vscode'|'herdr'|'none'}`),
   homedir always an injected parameter, never a bare `os.homedir()` call, and never inside a
   project tree. Absence, or a malformed file, resolves to `{bridge:null}` — never a throw —
   which is behaviourally identical to `'vscode'` on the read side, so an existing install does
   not change behaviour on upgrade.

2. **A shared Herdr binary/liveness resolver.** `lib/resolve-herdr.mjs` finds `herdr`: PATH first
   (an injectable `which`-style probe), else a newest-semver walk of
   `<home>/.herdr/packages/standalone/releases/<semver>-<triple>/herdr(.exe)` (the same shape as
   the existing plugin-cache semver-max walk), else, on Windows only, `<home>/AppData/Local/
   Programs/Herdr/bin/herdr.exe` (built from an injected `localAppData`-shaped parameter, never a
   bare `process.env.LOCALAPPDATA` read). A companion liveness check reads the platform socket
   file's existence and, only if present, spawns a short, injectable `herdr status` and caches the
   boolean briefly. Every environment input — homedir, platform, env, `which`, `exec` — is an
   injected parameter with a real default, per this repo's hermetic-fixture doctrine.

3. **`/setup` grows a verb and a status field.** A new `use bridge vscode|herdr|none` verb calls
   `writeBridgeSelection`. `buildStatus`'s JSON gains `activeBridge` (the recorded selection,
   `null` when unset — deliberately not named `bridge`, which already means "VS Code extension
   install state") and a new `herdr` key (`{onPath, version, serverRunning}`) mirroring the
   existing `bridge` key's shape. `commands/setup.md` documents the new verb in its verb table.

## Acceptance criteria

- [ ] `lib/bridge-selection.mjs` exports `readBridgeSelection(homedir)` / `writeBridgeSelection(homedir, kind)` against `<home>/.config/agentheim/config.json` (`{schema:1, bridge}`); absence/malformed input resolves to `{bridge: null}` and never throws; `node --test` covers read, write, absence, and malformed-file cases.
- [ ] `lib/resolve-herdr.mjs` exports `resolveHerdrBinary(deps)` (PATH via injectable `which`, else newest-semver walk of `<home>/.herdr/packages/standalone/releases/`, else win32 `<home>/AppData/Local/Programs/Herdr/bin/herdr.exe`) and `checkHerdrLiveness(deps)` (socket-file check plus a short-TTL-cached, injectable-`exec` `herdr status` spawn); every environment input (homedir, platform, env, which, exec) is an injected parameter with a real default; `node --test` covers PATH-found, known-root-found, not-found, and the liveness cache TTL.
- [ ] `lib/setup-cli.mjs` gains `use bridge vscode|herdr|none` (calls `writeBridgeSelection`); `status`'s JSON gains `activeBridge` (the recorded selection, `null` when unset) and a new `herdr` key (`{onPath, version, serverRunning}`) mirroring the existing `bridge` key's shape; `node --test` covers all three verb values and both new status fields.
- [ ] `commands/setup.md` documents `use bridge <kind>` in its verb table.

## Notes

**Rulings from the g6h1m REFINE round (ADR-0082), applied here:**

- Config file location and shape are frozen by ADR-0082 §1: `<home>/.config/agentheim/config.json`,
  uniform across platforms — not `<home>/.agentheim/` (name-collides with the project-level
  directory) and not `<home>/.claude/` (not Agentheim's own).
- The binary resolver is frozen by ADR-0082 §9 and is deliberately shared: this task builds it in
  `lib/`, and the server-side launch endpoint (a later task) imports it directly rather than
  re-implementing binary discovery.
- This task has no UI surface, so it does not depend on `design-system-001` (the parent task's
  original `depends_on`); that dependency belongs to the frontend-facing child, not this one.

**Herdr facts verified on the builder's machine (2026-09-13), ground truth for the resolver:**
`herdr 0.9.0`, protocol 22, server running, socket `%APPDATA%\herdr\herdr.sock` (a 25-byte file on
Windows). Herdr is *not* on the PATH of a process started from a shell that predates the install —
`where.exe herdr` fails in a fresh PowerShell or Git Bash session even though the Windows *User*
PATH contains `C:\Users\marco\.herdr\packages\standalone\releases\0.9.0-x86_64-pc-windows-msvc`; a
second copy lives at `%LOCALAPPDATA%\Programs\Herdr\bin\herdr.exe`. So "on PATH" is
necessary-but-insufficient detection and the known-install-root fallback is required, not optional.
`herdr status` answers from any shell (no `HERDR_ENV` needed) and prints client/server versions and
`server: status: running`; server errors are JSON on stderr, exit 1, syntax errors exit 2.

Prior art: infrastructure-js62b (`/setup` installs/reports the VS Code bridge's install state —
the pattern this task's `herdr` status key mirrors), infrastructure-x56qm (`/setup` installs the
CLI to a per-machine, outside-project-tree location — the same property this task's config file
needs), infrastructure-kr9pd (`/setup` bridge-verb argument handling on win32 — relevant to the
new `use bridge` verb's argument parsing).
