# Agentheim Bridge (VS Code extension)

Agentheim's first deployable VS Code component. It runs a tiny `127.0.0.1`-only
HTTP listener inside the editor so the dashboard — served into VS Code's
sandboxed Simple Browser — can open a **real, visible, interactive** Claude
terminal. The terminal **is** the `claude` process (spawned via
`shellPath`/`shellArgs`), so the prompt is delivered as a raw argv element and
no shell can mangle quotes or other metacharacters. This is the only path that
works from inside the browser sandbox; see ADR-0018 and the research report
`knowledge/research/vscode-dashboard-terminal-bridge-2026-06-09.md`.

The bridge is **generic**: it launches whatever prompt it is handed, so the
board's buttons (agentic-workflow-020) and any future affordance share it.

## What it does (ADR-0018 contract)

On activation it:

- Binds a `node:http` listener to `127.0.0.1` only (never `0.0.0.0`) on the
  fixed port **31425**, with a bounded fallback ladder `31425 → 31426 → 31427`
  on `EADDRINUSE`.
- Generates a fresh per-activation token (32 hex chars) and writes the
  discovery file `.agentheim/.dashboard/bridge.json` =
  `{ port, token, pid, startedAt, v }`. The dashboard server reads this to find
  and authenticate the live listener.
- Removes `bridge.json` on deactivation, so a dead editor leaves no live
  discovery file behind. Because the token is regenerated every activation, a
  stale `bridge.json` carries a token no live listener will accept.

HTTP surface (every request requires the `X-Agentheim-Bridge-Token` header):

| Method + path     | Behaviour |
|-------------------|-----------|
| `POST /run { prompt, skipPermissions? }` | Opens a `Claude` terminal that **is** the `claude` process — spawned with the prompt as a raw argv element (no shell, no quoting). The optional, off-by-default `skipPermissions` boolean prepends `--dangerously-skip-permissions` to the launch args **only** when set to the literal `true`; absent/`false`/malformed launches with the prompt alone. → `202` |
| `GET /health`     | Liveness probe **and** the authoritative capability handshake: returns `{ ok, v, capabilities }`, where `capabilities` is the set of `POST /run` fields *this* build honours (`['prompt', 'skipPermissions', 'name', 'model']`), sourced from the running process — never from `bridge.json`. The dashboard omits any field this list lacks. → `200` |
| `OPTIONS *`       | CORS preflight (load-bearing — the custom-header JSON POST is preflighted). → `204` |

Rejections: missing/mismatched token → `401`; malformed or empty body → `400`.

### Trust boundary

Loopback-only bind **plus** the shared-secret token header. Acceptable for a
single-user dev box; **not** for any networked or multi-user deployment.

The launch carries the `--dangerously-skip-permissions` bypass **only** as an
opt-in, off-by-default capability: a `POST /run` prepends the bypass flag only when
the request body sets `skipPermissions` to the literal `true`. Absent, `false`,
or malformed `skipPermissions` launches with the prompt alone, exactly as before.
The token guardrail is unchanged
— a missing/mismatched token still returns `401` byte-identically whether or not
`skipPermissions` is set, so the bypass widens what an *already-authenticated*
request may do, never *who* is authenticated. The bypass is **bridge-launch-only**
(`--dangerously-skip-permissions` is a startup-only flag, so the clipboard
fallback cannot carry it), and any UI affordance that can fire a bypass launch
must show a per-launch at-a-glance indicator (ADR-0018, agentic-workflow-021).

### Out of scope

The inject-into-a-running-session path (`POST /inject`) is deferred per
ADR-0018 — named, not built.

## Architecture

- `src/bridge.js` — pure, editor-free core: bind + fallback ladder, token,
  `bridge.json` lifecycle, body parsing, CORS, routing. Emits a structured launch
  descriptor `{ command:'claude', args:[…] }` (prompt as a raw argv element, no
  shell escaping) and hands it to an injected callback, so it is fully unit-tested
  without the editor. Stdlib only (`node:http`, `node:crypto`, `node:fs`,
  `node:path`); zero runtime deps.
- `extension.js` — thin activation glue; the **only** file that touches the
  `vscode` API. Consumes the descriptor, resolves `command` to a concrete
  executable on Windows (PATH × PATHEXT → absolute path), and spawns it as the
  terminal's shell via `createTerminal({ shellPath, shellArgs })` — the terminal
  *is* the `claude` process, no `sendText`.

## Tests

```sh
cd vscode-extension
npm test          # node --test --test-concurrency=1
```

Covers: loopback bind on the fixed port, the fallback ladder, `bridge.json`
write/overwrite/remove, token gating (401), body validation (400), `GET /health`,
the `OPTIONS` preflight, and that `POST /run` emits the descriptor
`{ command:'claude', args:[prompt] }` by default — with the strict-`true`
`skipPermissions` path (prepends `--dangerously-skip-permissions` to `args`), the
absent/`false`/malformed default path (`args` is exactly `[prompt]`), and a
**metacharacter-survival** guard (a prompt full of `"`, `'`, `` ` ``, `$`, `&`,
`|`, `;`, `$(…)` reaches `args[0]` as one verbatim element) all covered.

## Install (outside the marketplace)

This extension is not published to the VS Code Marketplace; install the `.vsix`
locally.

```sh
cd vscode-extension
npm install                       # only to get @vscode/vsce (packaging tool)
npm run package                   # → agentheim-bridge-<version>.vsix
code --install-extension agentheim-bridge-*.vsix --force
```

The version in the filename tracks `package.json` — install the `.vsix` you just
built, never a version pinned in prose. `--force` is what makes this an
**upgrade** as well as a first install; without it `code` refuses to replace an
already-installed build.

Then reload VS Code. On startup, with an Agentheim project open in the
workspace, the bridge binds and writes `.agentheim/.dashboard/bridge.json`.

### Upgrading, and the "older version" banner

VS Code loads the **installed** extension, not this source tree — working in the
Agentheim repo does *not* mean you are running the bridge you see in `src/`. The
two only converge when you re-package and re-install.

If the dashboard raises *"Your VS Code bridge is running an older version. Some
launch options are unavailable until you reload the window"*, the live listener
answered `GET /health` with fewer `capabilities` than the dashboard knows how to
send (`KNOWN_CAPABILITIES` in `dashboard/app/bridge-launch.js`); a `/health` with
no `capabilities` field at all is a pre-handshake build and reads as the closed
`LEGACY_CAPABILITIES` baseline (ADR-0018). The dashboard then omits the
unsupported fields at the wire level and greys out the affected controls, so the
banner is a truthful report of a stale install — not a bug.

The remedy is to re-package and re-install with `--force` (above), **then** reload
the window. Reloading alone re-activates the same stale extension and the banner
will come straight back.

## Uninstall

```sh
code --uninstall-extension agentheim.agentheim-bridge
```

Or via the Extensions view (search "Agentheim Bridge" → Uninstall). On
deactivation the extension removes `bridge.json`.
