---
id: ADR-0082
title: Herdr joins the dashboard bridge family — a second bridge kind, a fourth (MEDIATED LAUNCH) write category, and a per-process token
scope: infrastructure
status: proposed
date: 2026-09-13
related_tasks: [infrastructure-e8h9f, infrastructure-xh8tw, infrastructure-vpbks, infrastructure-w506e, infrastructure-nz2e8]
related_adrs: [0017, 0018, 0053, 0079]
---

# ADR-0082: Herdr joins the dashboard bridge family

## Context

Every board launch button resolves through one decision: is a bridge live? Until now that
decision was hard-wired to a single bridge — the VS Code extension of ADR-0018. The builder now
also runs Claude sessions inside **Herdr**, a local terminal-workspace manager with its own
persistent server behind a socket and a CLI that creates a tab/workspace and starts a recognized
`claude` agent in it with raw argv. Herdr's socket is unreachable from the browser, so unlike the
VS Code path (a browser `fetch` straight to a second local listener), a Herdr launch is
necessarily **server-mediated**: the dashboard's own Node process runs the `herdr` CLI on the
UI's behalf. The bridge choice is a per-machine fact of exactly the kind `/setup` already owns
(ADR-0079). infrastructure-g6h1m's refinement round settled the seven open questions this ADR
now freezes; the work ships as three chained tasks — infrastructure-e8h9f (foundation), infrastructure-xh8tw (server), infrastructure-vpbks (frontend).

## Decision

### 1. Per-machine selection

`<home>/.config/agentheim/config.json` = `{schema:1, bridge:'vscode'|'herdr'|'none'}`, written by
a new `lib/bridge-selection.mjs`, homedir always injected. This is the same "user-level, once per
machine, never in a project tree" shape ADR-0079 already chose for the CLI install target, applied
uniformly across platforms (no per-OS branching), and deliberately not `<home>/.agentheim/`
(name-collides with the project-level directory) or `<home>/.claude/` (not Agentheim's own).
Absence → `bridge: null`, behaviourally identical to `'vscode'` client-side (today's default is
unchanged on upgrade).

### 2. A fourth write category — MEDIATED LAUNCH

Spawning an external Herdr session from the server is neither a LIFECYCLE write (ADR-0017,
forbidden), an ADVISORY write (ADR-0027/0043/0046), nor RUNTIME SELF-LIFECYCLE (ADR-0053, ending
the server's own process). It is the server performing, on the builder's explicit request, the
same external side effect the browser performs directly for VS Code — named here as its own
category so a future "the dashboard mediates another external action" need doesn't re-litigate
ADR-0017 from scratch, mirroring how ADR-0053 itself named RUNTIME SELF-LIFECYCLE as a reusable
sibling. **This ADR does not amend ADR-0018** — VS Code's mechanism, ports, `bridge.json` shape,
and token scheme are completely untouched; Herdr is a new, independent bridge kind.

### 3. Wire shape

`GET /api/bridge` gains an additive `kind` field (the recorded selection verbatim, `null` when
unset) on every response. When `kind==='herdr'`: `{present, kind:'herdr', token, capabilities:
['prompt','skipPermissions','name','model'], live}` — `live` from a socket-file check plus a
short-TTL-cached, bounded `herdr status` spawn (no second network hop is needed, unlike VS Code's
separate-port `/health`, because producer and consumer are the same process). A new sibling write
endpoint, `POST /api/bridge/launch { prompt, skipPermissions?, name?, model? }` — the identical
body shape as VS Code's `POST /run`, deliberately, to minimize `bridge-launch.js`'s diff — requires
`X-Agentheim-Bridge-Token` (same header name as ADR-0018, reused, not reinvented).

### 4. Security — a per-process token, no Origin check

A random per-process token (`node:crypto`, 32 hex) minted once at server start, in memory only (no
disk write needed — unlike `bridge.json`, there is no second reader process). Delivered same-origin
via `GET /api/bridge`. The custom header forces a CORS preflight this server never answers
permissively, blocking cross-origin `fetch` attacks before the real POST fires; a header-less form
CSRF arrives token-less and gets `401`. **ADR-0053's no-Origin-check ruling does not carry over**:
it was justified by bounded blast radius (a locally-relaunchable dev server, one advisory file);
this endpoint reaches `claude` directly with `skipPermissions` available, the same unbounded blast
radius ADR-0018 itself already accepted a token-only defense for — with no Origin check either.
This ADR inherits ADR-0018's bar exactly: token only, nothing more.

### 5. Topology

`herdr api snapshot` first; reuse the workspace whose panes' `cwd` equals the project root
(`tab create --workspace <id> --cwd <root> --label <name> --focus`); else
`workspace create --cwd <root> --label <name> --focus`. Focuses the created workspace/tab — a
board launch is the builder's explicit gesture, Herdr focus is intra-Herdr not OS focus, and this
mirrors ADR-0018's `terminal.show()`. `<name>` is the same resolved session name the VS Code path
already derives (`-n <name>`) — one naming source. No `--env` is set; nothing in this task needs
one.

> **Amended 2026-09-14 (infrastructure-w506e).** Originally read "`--no-focus` … Never steals
> focus", protecting a builder mid-conversation in another Herdr pane. Reproduced against the
> live install: a cold Herdr launch created the session but left focus on the pre-existing
> workspace, so the TUI rendered an empty/unrelated pane while the new session ran one workspace
> over — the "empty screen" in the original builder report. The rule was wrong for this caller:
> a board launch is the builder's own explicit gesture (they just asked for a session), and Herdr
> focus is intra-Herdr (which workspace the TUI renders), not OS window focus, so focusing it
> pulls the builder out of nothing. `workspace create --focus` was confirmed to work with no TUI
> client attached (no `no_foreground_client` error). This ADR now matches ADR-0018's own
> `terminal.show()`, which is unconditional. A future "launch in the background" need is a
> body-field opt-in (`focus: false`), not the default — not built here.

### 6. Request-path budget

`api snapshot` + `tab`/`workspace create` are awaited (fast; a failure here is reported honestly as
a non-2xx before any response commits). `agent start … --timeout …` (up to 30 s, and whose
`agent_not_ready` still counts as launched — the pane is open) runs **after** a `202 {ok:true}` has
already been sent, unawaited by the handler — fire-and-report, mirroring VS Code's `/run`.

> **Amended 2026-09-14 (infrastructure-nz2e8).** §5's `execFileSync`/`spawn` calls, and
> `checkHerdrLiveness`'s own `herdr status` probe (§9's resolver's sibling liveness check,
> `lib/resolve-herdr.mjs`), did not set `windowsHide`. Reproduced against the live install: the
> dashboard server itself is spawned `detached`/`windowsHide`/`stdio:'ignore'`
> (`dashboard/launch.mjs`) and so owns no console of its own on Windows; a console-subsystem
> child of a console-less parent is handed a fresh, VISIBLE console unless `windowsHide` is set
> on the child spawn itself — the mechanism behind both this task's "new terminal window"
> builder report and infrastructure-w506e's earlier "fading in and out" observation. Every
> `herdr` child this server spawns — the awaited `api snapshot`/`agent list`/`tab create`/
> `workspace create` calls (§5/§6) and the fire-and-forget `agent start` spawn (§6) — now
> carries `windowsHide: true` via a shared `HERDR_CHILD_OPTIONS` constant
> (`lib/resolve-herdr.mjs`), threaded through the `exec`/`spawnFn` seams themselves so it is
> directly test-asserted, not just baked into a default implementation's internals. Harmless on
> POSIX, so unconditional, never platform-gated — the same discipline §8's clipboard-floor
> asymmetry and §9's resolver already apply uniformly across platforms.

> **Amended 2026-09-14 (infrastructure-nz2e8).** §5's workspace-reuse pane match
> (`p.cwd === root`) was a bare string `===`, so a path-FORM difference alone — separator style,
> a trailing separator, or (win32) letter case — between the `api snapshot` pane's `cwd` and the
> discovered `root` could push a launch onto the `workspace create` branch instead of reusing
> the existing one, even when the two name the same directory. The comparison now goes through a
> pure, platform-injectable normaliser (`normalizeCwdForComparison`/`cwdsMatch`,
> `dashboard/bridge-launch-api.mjs`): each side resolved via `path.win32.resolve`/
> `path.posix.resolve`, a trailing separator stripped, and (win32 only) lower-cased, before
> comparing for equality.

### 7. HERDR_ENV

Herdr's own guidance to drive it only from inside a Herdr pane is policy for autonomous agents, not
a technical gate the CLI enforces (`herdr status` answers from any shell); this bridge is a
deterministic launcher, so it neither sets nor checks `HERDR_ENV`.

### 8. Clipboard floor, unchanged

`--dangerously-skip-permissions`, `--model`, `-n <name>` remain startup-only argv the clipboard path
can never carry, on any bridge kind — the existing ADR-0018/infrastructure-h5wnq asymmetry extends
unchanged, orthogonal to which bridge is selected.

### 9. Binary resolution

`lib/resolve-herdr.mjs`: PATH first (injectable `which`), else newest-semver
`<home>/.herdr/packages/standalone/releases/`, else (win32) `<home>/AppData/Local/Programs/Herdr/bin/herdr.exe`.
Shared by `/setup`'s `status` and the dashboard server — one resolver, two callers, mirroring
`resolve-plugin-file.mjs`'s existing reuse pattern.

## Consequences

**Positive** — one frozen contract lets the setup/lib, server, and frontend pieces build against it
independently; the security bar matches the actual risk (ADR-0018's, not ADR-0053's); no version-
skew concept is needed for Herdr's capabilities (single process, no separately-activated host).

**Negative** — a fourth write category is one more exception to ADR-0017's "read-only" framing to
track; two independent "open an external Claude session" implementations now exist (VS Code's
extension-mediated one, Herdr's server-mediated one), never unified, deliberately (different
transports).

**Neutral** — `bridge.json`/ADR-0018's mechanism is entirely unaffected; `<home>/.config/agentheim/`
is a new on-disk location, still user-level, still outside every project tree.

## What stays frozen

ADR-0018's mechanism (loopback bind, fixed port ladder, `bridge.json` shape, per-activation token,
`OPTIONS` preflight) — untouched. ADR-0053's `POST /api/stop` and its no-Origin-check ruling for
that narrow-blast-radius pair of routes — untouched, and explicitly not the precedent this ADR
follows. ADR-0079's `/setup`/CLI install mechanics — untouched; this ADR only adds a verb and a
config file alongside them.
