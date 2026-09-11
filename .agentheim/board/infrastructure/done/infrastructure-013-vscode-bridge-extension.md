---
id: infrastructure-013
title: Build the VS Code bridge extension — 127.0.0.1 listener that opens a seeded Claude terminal
status: done
type: feature
context: infrastructure
created: 2026-06-14
completed: 2026-06-14
commit: 7ccd2a7
depends_on: [infrastructure-012]
blocks: []
tags: [dashboard, vscode, bridge, transport, extension]
related_adrs: [0002]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [infrastructure-001, infrastructure-003]
---

## Why
The board buttons (aw-020) need a real, visible, interactive terminal running
`claude "<prompt>"` from inside VS Code's sandboxed Simple Browser. The research
(`vscode-dashboard-terminal-bridge-2026-06-09`) and ADR-0018 (infrastructure-012)
established the only path: a tiny custom VS Code extension running a `127.0.0.1` HTTP
listener that calls `window.createTerminal()` + `sendText()`. This task builds that
extension — Agentheim's first deployable VS Code component.

## What
A small VS Code extension (research estimates ~30–50 lines of logic) living in a new
repo-root `vscode-extension/` (sibling of `dashboard/`, its own toolchain, infra-owned),
implementing the ADR-0018 contract:

- Binds an HTTP listener on `127.0.0.1:31425` (loopback only, never `0.0.0.0`) with the
  bounded fallback ladder `31425 → 31426 → 31427` on `EADDRINUSE`; records the bound port.
- On activation, generates a per-activation random token (32 hex via `node:crypto`) and
  writes `.agentheim/.dashboard/bridge.json` = `{ port, token, pid, startedAt, v }`;
  removes/invalidates it on deactivation.
- `POST /run { prompt }` (requires `X-Agentheim-Bridge-Token`) →
  `createTerminal('Claude')` + `show()` + `sendText('claude "<prompt>"')` for a fresh,
  interactive, seeded session.
- `GET /health` (requires token) → `200`.
- Answers CORS preflight (`OPTIONS`) — a custom-header JSON POST is preflighted; this is
  load-bearing and an easy trap.
- Rejects requests with missing/mismatched token (401) and malformed body (400).
- Never hard-wires `--dangerously-skip-permissions` or any permission-bypass flag.
- Installable without the marketplace: `vsce package` → `code --install-extension <.vsix>`.

The `POST /inject` (inject-into-running-session) path is **out of scope** here — deferred
per ADR-0018.

## Acceptance criteria
- [ ] A VS Code extension exists under `vscode-extension/` that, when installed, opens a terminal and runs `claude "<prompt>"` in response to a token-bearing loopback `POST /run`.
- [ ] The listener binds `127.0.0.1` only on the fixed port `31425` (with the documented `31425→31426→31427` fallback) and **rejects** requests lacking/mismatching the `X-Agentheim-Bridge-Token` header (401), so other local pages cannot trigger `claude`.
- [ ] On activation the extension generates a per-activation token and writes `.agentheim/.dashboard/bridge.json` `{ port, token, pid, startedAt, v }`; on deactivation the file is removed/invalidated.
- [ ] `GET /health` (token-bearing) returns `200`; `OPTIONS` preflight is answered so the dashboard's cross-origin custom-header POST succeeds.
- [ ] The launch does **not** hard-wire `--dangerously-skip-permissions` or any permission-bypass flag.
- [ ] A documented install/uninstall path (extension README or repo doc): `vsce package` + `code --install-extension`, and how to remove it — since it lives outside the marketplace.
- [ ] The bridge is generic — it launches whatever prompt it is handed — so aw-020's two buttons and any future board affordance share it.

## Notes
- Depends on infrastructure-012 (ADR-0018) for the frozen contract: port, `bridge.json`
  shape, token scheme, HTTP shape, scope. Do not re-decide any of those here.
- Does **not** block aw-020: an absent extension is a tested normal mode for the
  frontend (clipboard fallback), so aw-020 can ship before this `.vsix` exists.
- Transport-family sibling of infrastructure-001 (dashboard runtime transport) and
  infrastructure-003 (SSE live-update transport). Full findings + citations:
  `knowledge/research/vscode-dashboard-terminal-bridge-2026-06-09.md`.

## Outcome

Built Agentheim's first deployable VS Code extension under a new repo-root
`vscode-extension/` (sibling of `dashboard/`, infra-owned, its own toolchain). All
ADR-0018 contract clauses are implemented and unit-tested:

- `vscode-extension/src/bridge.js` — the pure, editor-free core (stdlib only:
  `node:http`/`node:crypto`/`node:fs`/`node:path`; zero runtime deps). Loopback-only
  bind on fixed port 31425 with the `31425→31426→31427` fallback ladder (reads back the
  OS-assigned port when given 0); per-activation 32-hex token; `bridge.json` write on
  start / remove on `close()`; token-gated routing with timing-safe compare; `POST /run`
  builds `claude "<prompt>"` (quotes escaped, never a permission-bypass flag) and invokes
  an **injected** `launchTerminal` callback; `GET /health` → 200; `OPTIONS` preflight
  answered with permissive CORS (the load-bearing trap); 401 on bad token, 400 on
  malformed/empty body. Early-exit responses drain the inbound body first to avoid a
  Windows ECONNRESET.
- `vscode-extension/extension.js` — the only file touching the `vscode` API. Walks up to
  the workspace's `.agentheim/` root, wires `vscode.window.createTerminal` +
  `show` + `sendText` into the injected callback, registers `close()` as a subscription,
  and removes `bridge.json` on `deactivate`. A no-Agentheim-project workspace stays quiet
  (absent bridge is a normal frontend mode — clipboard fallback).
- `vscode-extension/test/bridge.test.mjs` — 9 `node:test` cases (zero-dep, mirroring the
  dashboard idiom; run with `--test-concurrency=1` so the fixed-port tests don't contend):
  fixed-port bind + `bridge.json` shape, fallback ladder, `POST /run` launch text + no
  bypass flag, 401 (missing/wrong token, launches nothing), 400 (malformed + empty),
  `GET /health`, `OPTIONS` preflight CORS headers, `close()` removes `bridge.json`, stale
  `bridge.json` overwritten on activation. All passing.
- `vscode-extension/package.json` (manifest: `engines.vscode`, `onStartupFinished`
  activation, `main`, `test`/`package` scripts; `@vscode/vsce` is the sole packaging-time
  devDep), `.vscodeignore` (tests/tooling out of the `.vsix`), and `README.md` documenting
  the `vsce package` → `code --install-extension` install and `code --uninstall-extension`
  removal path.
- `.gitignore` extended for `vscode-extension/node_modules/` and `*.vsix`;
  `.agentheim/.dashboard/` was already ignored, so `bridge.json` is covered.
- Infrastructure BC README updated: Bridge + Bridge discovery file added to Ubiquitous
  language, ADR-0018 added to Decisions.

`POST /inject` was correctly left unbuilt (deferred per ADR-0018). No new decision was
made beyond the frozen contract, so no new ADR was written. The dashboard-side
`GET /api/bridge` reader is infrastructure-014 (separate task) and intentionally untouched.
