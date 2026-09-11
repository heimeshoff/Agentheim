---
id: infrastructure-012
title: VS Code dashboard→terminal bridge — pin the transport contract (ADR-0017)
status: done
type: decision
context: infrastructure
created: 2026-06-14
completed: 2026-06-14
commit: 8552050
depends_on: []
blocks: [infrastructure-013, infrastructure-014, agentic-workflow-020]
tags: [dashboard, vscode, bridge, transport, decision]
related_adrs: [0002, 0018]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [infrastructure-001, infrastructure-003]
---

## Why
The dashboard runs inside VS Code's sandboxed Simple Browser, which by design cannot
touch the OS terminal or spawn a visible process. The builder wants board buttons
(aw-020) to open a real, interactive terminal running `claude "<prompt>"`, not a
clipboard paste. The 2026-06-09 research (`vscode-dashboard-terminal-bridge-2026-06-09`)
established that the **only** path to a real, visible, interactive terminal from the
sandboxed browser is a tiny custom VS Code extension running a `127.0.0.1` HTTP listener
that calls `window.createTerminal()` + `terminal.sendText('claude "<prompt>"')`.

Before any code is written, the **transport contract** must be pinned so the extension
(infrastructure-013), the dashboard server endpoint (infrastructure-014), and the board
buttons (aw-020) all build against one frozen interface instead of duplicating a magic
number across codebases. This task's deliverable is that contract, recorded as
**ADR-0017** — Agentheim's first cross-process discovery decision and the first to
*diverge* from ADR-0002's ephemeral-port pattern.

## What
Ratify and record (as ADR-0017) the bridge transport contract resolved during refine.
The decision content below is settled by the architect; this task formalizes it into
ADR-0017 and commits it so the downstream build tasks unblock.

### The decision (to be recorded in ADR-0017)

1. **Fixed port, not ephemeral.** The extension listener binds `127.0.0.1:31425`
   (loopback only, never `0.0.0.0`), with a bounded fallback ladder `31425 → 31426 →
   31427` on `EADDRINUSE`; the actually-bound port is recorded in the discovery file.
   ADR-0002 chose an ephemeral `:0` port read back into `runtime.json`, but that pattern
   **cannot work here**: the discovery reader is the dashboard frontend — a sandboxed
   Simple Browser frame that is filesystem-blind and can only `fetch()` its own origin.
   It can never read a runfile. A fixed, knowable starting port is therefore required.
   The port literal is arbitrary-but-fixed; the contract is the discovery mechanism, not
   the number.

2. **Server-mediated discovery (no duplicated magic number).** The extension writes
   `.agentheim/.dashboard/bridge.json` = `{ port, token, pid, startedAt, v }` — a sibling
   of the existing `runtime.json` in the same gitignored `.agentheim/.dashboard/` dir,
   written by a *different* process (the extension host) with its own lifecycle, so it is
   a **separate file**, not an extension of `runtime.json`. The dashboard server gains a
   read endpoint **`GET /api/bridge`** that reads `bridge.json` through ADR-0002's in-root
   path validator and returns `{ port, token, v }`, or `200 { present: false }` when the
   file is absent. The frontend obtains port+token **only** via that endpoint — never
   hardcoded — which is what lets a sandboxed frame learn a contract it cannot read off
   disk.

3. **Scope: fresh-session only.** The bridge ships `POST /run` (open a new terminal,
   seed `claude "<prompt>"`). The `activeTerminal.sendText()` inject-into-a-running-session
   path is **deferred** as a named future `POST /inject` — purely additive, distinct
   untested edge cases (bracketed-paste / multi-line into a live TUI), and no current
   consumer needs it (aw-020 only wants fresh sessions).

4. **Absence detection contract for the frontend.** The dashboard frontend detects the
   bridge by calling `GET /api/bridge`, then a token-bearing `GET /health` against the
   advertised port (≈800 ms timeout). **Every** failure mode — timeout,
   connection-refused, non-200, CORS rejection, not-running-in-Simple-Browser, any throw
   — collapses **silently** to the clipboard fallback. The board must never surface an
   error toast, console crash, or broken-looking button for an absent bridge; absence is
   a normal mode. This is the contract aw-020's fallback relies on.

### Supporting contract details (also recorded in the ADR)
- **Token:** a per-activation random token (32 hex chars via `node:crypto`), regenerated
  each time the extension activates, carried on requests as the
  `X-Agentheim-Bridge-Token` header. The listener rejects requests lacking/mismatching it
  so other local pages cannot trigger `claude`.
- **HTTP shape:** `POST /run { prompt }` (token header required) → opens terminal, returns
  `200`/`202`; `GET /health` (token header) → `200`; `GET /api/bridge` lives on the
  *dashboard server*, not the extension. Define exact status codes (e.g. 401 missing/bad
  token, 400 malformed body). **CORS preflight is load-bearing** — a custom-header JSON
  POST is preflighted, so the extension listener must answer `OPTIONS`; this is an easy
  build trap to call out for infrastructure-013.
- **No permission-bypass:** the launch never hard-wires `--dangerously-skip-permissions`
  or any permission-bypass flag.
- **Trust boundary:** loopback-only bind + shared-secret token, per the research note;
  acceptable for a single-user dev box.

## Acceptance criteria
- [ ] **ADR-0017** is written to `.agentheim/knowledge/decisions/0017-vscode-dashboard-terminal-bridge.md` recording: the localhost-listener extension over the rejected alternatives (server-spawn headless, `vscode://` deep link); the **fixed-port + server-mediated discovery** decision and *why it diverges from ADR-0002's ephemeral port* (sandboxed, filesystem-blind reader); the `bridge.json` shape and the `GET /api/bridge` discovery contract; the per-activation token + `X-Agentheim-Bridge-Token`; the fresh-session-only scope (with `POST /inject` named as deferred); and the absence-detection contract.
- [ ] The ADR's `related_tasks` lists `infrastructure-012, infrastructure-013, infrastructure-014, agentic-workflow-020`; ADR-0002 cross-links it as the bridge's transport precedent.
- [ ] The infrastructure BC `INDEX.md` "ADRs scoped to this BC" list gains ADR-0017.
- [ ] No code, extension, or server endpoint is written by this task — its sole output is the committed ADR. (infrastructure-013 builds the extension; infrastructure-014 builds the endpoint.)

## Notes
- Split out of the original infrastructure-012 (a single `feature` task) during the
  2026-06-14 refine, on the architect's recommendation: pin the contract as an ADR first,
  so the extension build (013), the server endpoint (014), and the buttons (aw-020) all
  proceed in parallel against a frozen interface. Mirrors the repo's decision-then-build
  pattern (ADR-0002 ← infrastructure-001).
- **Open sub-questions deliberately deferred** (non-blocking, note in the ADR if cheap):
  multi-root-workspace anchoring for the extension's `.agentheim/` walk-up (non-issue for
  single-project use); whether the port literal `31425` ever needs to move (only the
  mechanism is contractual).
- Full findings + source citations:
  `knowledge/research/vscode-dashboard-terminal-bridge-2026-06-09.md`.

## Outcome
The VS Code dashboard→terminal bridge transport contract is pinned as
**ADR-0018** (`.agentheim/knowledge/decisions/0018-vscode-dashboard-terminal-bridge.md`).
Note: shipped as 0018, not 0017 as the task title says — 0017 was taken earlier the same
day by the dashboard-read-only ADR; the user reassigned this deliverable to 0018.

The ADR records: the localhost-listener extension over the rejected alternatives
(server-spawn headless, `vscode://`/`command:` deep links, `sendSequence`); the
**fixed-port `31425`→`31427` ladder + server-mediated discovery** decision and *why it
diverges from ADR-0002's ephemeral `:0`* (the discovery reader is a filesystem-blind
sandboxed Simple Browser frame); the `bridge.json` shape and the `GET /api/bridge`
discovery contract; the per-activation token + `X-Agentheim-Bridge-Token`; the
fresh-session-only scope with `POST /inject` named as deferred; the absence-detection
contract (≈800 ms probe, every failure mode collapses silently to clipboard); and the
CORS-preflight `OPTIONS` build trap for infrastructure-013.

ADR-0002 cross-links ADR-0018 as the bridge's transport precedent (frontmatter
`related_adrs` + a banner note). No code was written — the extension (013), the
`GET /api/bridge` endpoint (014), and the board buttons (aw-020) build against this frozen
contract. TDD does not apply (decision-only task).
