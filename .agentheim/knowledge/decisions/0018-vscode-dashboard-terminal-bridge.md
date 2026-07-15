---
id: ADR-0018
title: VS Code dashboard→terminal bridge — fixed-port localhost extension with server-mediated discovery
scope: infrastructure
status: proposed
date: 2026-06-14
related_tasks: [infrastructure-012, infrastructure-013, infrastructure-014, agentic-workflow-020, infrastructure-015, infrastructure-016, agentic-workflow-021, infrastructure-020, infrastructure-c6fzb, infrastructure-h5wnq, infrastructure-v8r3q, agentic-workflow-n4qte, infrastructure-w6p4k]
related_adrs: [ADR-0002]
diverges_from: [ADR-0002]
---

# ADR-0018: VS Code dashboard→terminal bridge — fixed-port localhost extension with server-mediated discovery

> **Amended 2026-06-14 (infrastructure-015).** The original **"No permission-bypass"** section is
> reversed: the bridge now permits an **opt-in, off-by-default** permission-bypass on `POST /run`,
> via an optional `skipPermissions` boolean. The ADR stays `status: proposed` and gains no
> `supersedes`/`diverges_from` change — this is an in-place additive amendment to a still-proposed
> decision. The reversed section below is now **"Permission-bypass — opt-in, off by default"**; the
> `POST /run` body and command construction in "HTTP shape and status codes" are extended to match.
> Everything else in this ADR stands unchanged (see "What stays frozen" at the end of the Decision).

> **Amended 2026-06-16 (infrastructure-020).** The bridge mechanism no longer types a
> shell command line into a terminal. The original clause —
> `window.createTerminal()` + `terminal.show()` + `terminal.sendText('claude "<prompt>"')`
> — seeded a *shell* terminal and let that shell parse `claude "<prompt>"`, which mangled
> prompts containing shell metacharacters on non-POSIX default shells (Windows
> PowerShell/cmd treat `\"` differently). The bridge now makes the terminal **be the
> `claude` process directly**:
> `createTerminal({ name:'Claude', cwd:root, shellPath:'claude', shellArgs:[<flag?>, prompt] })`,
> so the prompt and the optional `--dangerously-skip-permissions` flag are delivered as
> raw `argv` elements with **no shell and no escaping** — quoting cannot corrupt them.
> The pure core (`bridge.js`) correspondingly emits a structured launch descriptor
> `{ command:'claude', args:[…] }` instead of a pre-escaped command string; the injected
> seam (`extension.js`) resolves `command` to a concrete executable on Windows
> (PATH×PATHEXT → absolute path) and spawns it. **Nothing on the HTTP wire changes:**
> `POST /run { prompt, skipPermissions? }`, the token header, the load-bearing `OPTIONS`
> preflight, status codes, `bridge.json`/`GET /api/bridge`, and the strict-`true`
> skip-permissions activation all stand verbatim. The `\"`-escaping step is deleted as
> the source of the bug.

> **Amended 2026-07-13 (infrastructure-c6fzb).** Every bridge-launched session
> named its terminal `'Claude'` unconditionally (`extension.js` hard-coded
> `createTerminal({ name: 'Claude', ... })`), so with several concurrent
> sessions the tabs and the `/resume` picker entries were indistinguishable.
> The installed CLI ships `-n, --name <name>` ("Set a display name for this
> session (picker, and terminal title)", verified 2.1.207) — the June research
> report predates this flag and is superseded on that one point. `POST /run`
> gains an **optional, additive** `name: string` field: the pure core
> (`bridge.js`) sanitizes it (trim, strip control characters/newlines, cap
> ~60 chars); when absent or it sanitizes to empty, the core derives a
> fallback from the prompt — `/agentheim:<skill> …` → `<skill>: …`, plain text
> → the prompt itself. The resolved name rides the launch descriptor as its
> own raw argv pair, prepended exactly the way the `skipPermissions` flag
> already prepends (infrastructure-016): `args = ['-n', <name>, ...existing]`,
> so the ordering with an armed bypass is `['-n', <name>,
> '--dangerously-skip-permissions', <prompt>]`. No shell parses it, so (like
> the prompt) it needs no quoting/escaping (infra-020/q8m4t discipline). The
> seam (`extension.js`) recovers the name from the descriptor's `args` and
> passes it to `createTerminal({ name })`; `'Claude'` survives only as the
> last-resort fallback if `args` ever arrives without a `-n` pair. **Nothing
> else on the HTTP wire changes:** `{ prompt, skipPermissions? }` stay exactly
> as before; `name` is a third, independent, optional field. `/rename` is
> confirmed strictly user-typed (no model/hook/subagent surface), so launch
> time is the only programmatic naming point; sessions the builder starts
> manually outside the bridge stay out of scope.

> **Amended 2026-07-13 (infrastructure-h5wnq).** The prompt bar grows a model
> selector (agentic-workflow-m2vkp); the chosen model has to ride the same
> launch descriptor. `POST /run` gains a **second, independent, optional,
> additive** field: `model: string`. The pure core (`bridge.js`) validates it
> against a **closed allowlist**, `MODEL_ALLOWLIST = ['fable', 'opus',
> 'sonnet', 'haiku']` — the short aliases the installed CLI's own
> `--model <model>` help text documents first ("Provide an alias for the
> latest model … or a model's full name"). The allowlist holds only the
> aliases, not pinned full ids (`claude-sonnet-5`, …): an alias tracks "the
> latest model" of its tier automatically, so it does not go stale the way a
> pinned full id would the day a new model ships under the same tier name.
> **This is the security boundary, not a convenience filter**: the value
> reaches a spawned process, so exact, case-sensitive membership is the only
> path from request body to argv — anything else (case mismatch, shell
> metacharacters, whitespace, a leading dash, a full model id, a non-string)
> sanitizes to `''` and produces **no `--model` flag at all**, never a `500`.
> An accepted value rides its own raw argv pair, `--model <id>`, prepended
> exactly the way `name`/`skipPermissions` already prepend
> (infrastructure-c6fzb/016): `args = ['-n', <name>, '--model', <id>,
> ...(skipPermissions-and-prompt args)]` — so the full order with every field
> armed is `['-n', <name>, '--model', <id>, '--dangerously-skip-permissions',
> <prompt>]`. No shell parses it, so (like the prompt and the name) it needs
> no quoting/escaping. **Nothing else on the HTTP wire changes:** `{ prompt,
> skipPermissions?, name? }` stay exactly as before; `model` is a fourth,
> independent, optional field, and its clipboard-fallback path stays
> deliberately unimplemented — a pasted slash command cannot carry a startup
> flag, so the model selector greys out when no bridge is reachable (the
> builder's ruling). This ambient bridge-presence signal is a new export,
> `probeBridge(fetchImpl)`, on `dashboard/app/bridge-launch.js`: it reuses the
> module's existing `discoverBridge`/`probeHealth` two-step protocol (no
> second implementation) and resolves a plain `{ present: boolean }`, never
> throwing, for exactly the render-time question `launchOrCopy`'s
> fire-time-only discovery cannot answer. **This amendment does not touch
> ADR-0031** — ADR-0031 pins a model *per agent* via agent frontmatter;
> `--model` sets the main-loop/session model, and the two compose (a session
> launched `--model haiku` still spawns its `verifier` on opus).

> **Amended 2026-07-13 (infrastructure-v8r3q).** Three separate amendments
> (infrastructure-016, -c6fzb, -h5wnq) each grew the fields `POST /run`
> honours — `skipPermissions`, `name`, `model` — and none of them bumped
> `BRIDGE_V`. The result: a builder running a stale extension host (VS Code
> defers loading a new extension version until the window reloads) POSTs a
> `model`/`name` the *installed* bridge supports, the *running* listener
> silently drops fields it doesn't recognise, returns `202 { ok: true }`
> anyway, and the dashboard reports success. Nothing told the builder his
> session launched on the wrong model under the wrong name. `bridge.json`'s
> `v` cannot fix this: it is written by a **separate process** on its own
> activation lifecycle and is last-writer-wins across concurrent VS Code
> windows, so it can lag or race the listener it's meant to describe.
>
> **The capability signal now rides `GET /health`, not (only) `bridge.json`.**
> `bridge.js` exports `CAPABILITIES = ['prompt', 'skipPermissions', 'name',
> 'model']` — the `POST /run` fields *this build* of `makeHandler` actually
> reads. `GET /health` (previously `{ ok: true, v: BRIDGE_V }`) now returns
> `{ ok: true, v: BRIDGE_V, capabilities: CAPABILITIES }`, sourced from the
> **live listener's own in-memory constant** — structurally incapable of
> going stale the way `bridge.json` can, because there is no second process
> and no write-then-read race: the answering process and the process whose
> capabilities are being asked about are the same process. `bridge.json` (and
> therefore `GET /api/bridge`) also carries `capabilities` as **belt-and-
> braces**, but it is **not authoritative** — a caller that wants a
> trustworthy answer probes the live `/health`, exactly as `probeBridge`
> already did for liveness.
>
> **Absence is the legacy baseline.** A pre-handshake listener (0.2.0-shaped:
> honours only `prompt` + `skipPermissions`) answers `/health` with no
> `capabilities` field at all — it predates this amendment and cannot emit
> one. The dashboard treats that absence as the closed baseline
> `LEGACY_CAPABILITIES = ['prompt', 'skipPermissions']` (`bridge-launch.js`),
> never as "unknown" or "assume everything works."
>
> **The dashboard becomes capability-aware in two places, not one — defense
> in depth, not just a UI courtesy.** (1) `bridge-launch.js`'s
> `probeBridge(fetchImpl)` now resolves `{ present: boolean, capabilities:
> string[] }` instead of a bare `{ present }`, reusing the same discover
> (`GET /api/bridge`) + health (`GET /health`) steps. (2) `launchOrCopy`'s
> internal health probe captures the same `capabilities` list at fire time
> and `runOnBridge` **omits** `model` / `name` from the `POST /run` body
> whenever the live-probed capabilities don't include them — even if a UI
> layer's render-time gate is stale or bypassed, the wire-level request
> itself cannot silently claim a capability the listener just told it, at
> that moment, it doesn't have. This mirrors the bridge's own
> allowlist-degrades-quietly discipline (infrastructure-h5wnq): an
> unsupported field is never sent, never a rejected request, never a `500`.
>
> **A structural guard replaces the prose rule that already failed three
> times.** `vscode-extension/test/bridge.test.mjs` gains a test that scans
> `bridge.js`'s own source for every `parsed?.<field>` read inside
> `makeHandler` (the convention all four honoured fields already follow) and
> asserts that set is **exactly** `new Set(CAPABILITIES)` — both directions:
> a field read without being declared fails the build; a field declared but
> never read fails the build too. Adding a fifth `/run` field without adding
> it to `CAPABILITIES` (or vice versa) now breaks `npm test`, not merely a
> comment.
>
> **UI consumption (grey-out + a one-time banner) is agentic-workflow's, not
> this BC's** — the transport/meaning split (BC README) puts "what a builder
> sees when a capability is missing" on the far side of the seam;
> `agentic-workflow-n4qte` extends the prompt bar's existing
> `probeBridge`-driven `modelLocked` grey-out (infrastructure-h5wnq) from
> *bridge absent* to *bridge present but too old*, and adds a dismissible
> banner naming the fix ("reload your VS Code window"). This BC's job stops
> at handing over a trustworthy `{ present, capabilities }` signal.
>
> **Nothing else on the HTTP wire changes.** `POST /run`'s body shape,
> status codes, the token header, and the `OPTIONS` preflight are all
> unchanged; `capabilities` is a purely additive `GET /health` (and
> `bridge.json`/`GET /api/bridge`) response field.

> **Amended 2026-07-15 (infrastructure-w6p4k).** A one-skill carve-out to the
> `<skill>: <rest>` fallback convention (infrastructure-c6fzb): when
> `deriveNameFromPrompt` parses `/agentheim:modeling <rest>` and `<rest>` is
> non-empty, the derived name is `sanitizeName(rest)` alone — **no**
> `modeling: ` prefix — because the builder found that prefix to be noise
> specifically for modeling launches. A bare `/agentheim:modeling` (no rest)
> still degrades to the plain `modeling` label, same as every other skill's
> bare-invocation case. **Every other skill is unchanged**, including
> `resolveSessionName`'s explicit-`name` path, which never reaches this
> derivation at all. The dashboard prompt bar's capital-`M` `"Modeling: "`
> explicit name (`agentic-workflow`'s `nameForPromptMode`) is a **separate**
> surface — it supplies an explicit `name` and bypasses
> `deriveNameFromPrompt` entirely — and is out of scope for this amendment.

> **Diverges from [ADR-0002](0002-dashboard-runtime-transport.md) on one clause.** ADR-0002 fixed
> the dashboard runtime as an **ephemeral `:0` port** read back into `runtime.json`. That pattern
> **cannot serve this bridge**, because the discovery reader here is the dashboard *frontend* — a
> sandboxed VS Code Simple Browser frame that is filesystem-blind and can only `fetch()` its own
> origin. It can never read a runfile. This ADR therefore chooses a **fixed starting port** for the
> bridge listener and a **server-mediated discovery** path. Every other ADR-0002 clause —
> `127.0.0.1`-only binding, in-root path validation, the `.agentheim/.dashboard/` gitignored
> runtime dir — **still stands and is reused here**.

## Context

The Agentheim dashboard runs inside VS Code's **Simple Browser**, a sandboxed webview that by
design cannot touch the OS terminal or spawn a visible process. The builder wants board buttons
(agentic-workflow-020) to open a **real, interactive** terminal running `claude "<prompt>"` —
not a clipboard paste, and not a headless background process whose output is invisible.

The 2026-06-09 research (`vscode-dashboard-terminal-bridge-2026-06-09`) established that the
**only** path to a real, visible, interactive terminal from the sandboxed browser is a tiny
custom VS Code extension that runs a `127.0.0.1` HTTP listener and, on request, calls
`window.createTerminal()` + `terminal.show()` + `terminal.sendText('claude "<prompt>"')`. A plain
`http` POST is the one cross-origin action the sandbox permits; every other bridge (`vscode://`
deep links, `command:` URIs, server-spawned child processes) is either blocked from inside Simple
Browser or cannot reach the user's visible terminal pane.

Before any code is written, the **transport contract** must be pinned, so the extension
(infrastructure-013), the dashboard server endpoint (infrastructure-014), and the board buttons
(agentic-workflow-020) all build against one frozen interface instead of duplicating a magic
number and an ad-hoc handshake across three codebases. This ADR is that contract. It mirrors the
repo's decision-then-build precedent (ADR-0002 ← infrastructure-001): pin the decision first, so
the three build tasks proceed in parallel against a frozen seam.

This is Agentheim's **first cross-process discovery decision** — two independently-launched local
processes (the dashboard server and the VS Code extension host) that must find each other without
a shared launcher.

## Decision

### Bridge mechanism — custom VS Code extension with a 127.0.0.1 HTTP listener

The bridge is a small VS Code extension whose activation starts a `node:http` listener bound to
**`127.0.0.1` only** (never `0.0.0.0`). On a valid `POST /run`, it calls
`window.createTerminal()` + `terminal.show()` + `terminal.sendText('claude "<prompt>"')`, yielding
a real, visible, interactive Claude session in the user's editor. This is chosen over the
alternatives below because it is the only path that controls a visible, interactive terminal from
inside the sandboxed Simple Browser.

### Fixed port, not ephemeral

The extension listener binds **`127.0.0.1:31425`**, with a bounded fallback ladder
**`31425 → 31426 → 31427`** on `EADDRINUSE`; the actually-bound port is recorded in the discovery
file. The port literal is **arbitrary-but-fixed** — what is contractual is the *discovery
mechanism*, not the number. ADR-0002's ephemeral `:0` is impossible here for the reason in the
banner: the reader is a filesystem-blind sandboxed frame, so it cannot read a runfile to learn an
OS-assigned port; it needs a fixed, knowable starting point to begin discovery.

### Server-mediated discovery — no duplicated magic number

The extension writes **`.agentheim/.dashboard/bridge.json`** =
`{ port, token, pid, startedAt, v }` — a sibling of the existing `runtime.json` in the same
gitignored `.agentheim/.dashboard/` dir. It is a **separate file**, not an extension of
`runtime.json`, because a **different process** (the VS Code extension host) writes it on its own
activation/deactivation lifecycle; folding it into `runtime.json` (owned by the dashboard server
launcher) would couple two independent lifecycles to one file.

The dashboard server gains a read endpoint **`GET /api/bridge`** that reads `bridge.json` through
**ADR-0002's in-root path validator** (`path.resolve` + `startsWith(root)`) and returns
`{ port, token, v }`, or **`200 { present: false }`** when the file is absent.

The frontend obtains `port` + `token` **only** via `GET /api/bridge` — never hardcoded. This is
the crux: it lets a sandboxed frame, which cannot read disk, learn a contract that lives on disk,
by going through the one origin it *can* reach. The magic port is written and read in exactly one
place each; no third party hardcodes it.

### Scope — fresh-session only

The bridge ships **`POST /run`** (open a new terminal, seed `claude "<prompt>"`). The
inject-into-a-running-session path (`vscode.window.activeTerminal.sendText(prompt)`) is
**deferred** as a named future **`POST /inject`**. It is purely additive (no consumer needs it —
agentic-workflow-020 only wants fresh sessions) and carries distinct, untested edge cases
(bracketed-paste / multi-line submission into a live TUI; see the research's open questions). It
is named here so the build tasks reserve the route shape, not built.

### Token — per-activation shared secret

A **per-activation random token** (32 hex chars via `node:crypto`), regenerated each time the
extension activates, is written into `bridge.json` and carried on every request as the
**`X-Agentheim-Bridge-Token`** header. The listener **rejects** any request lacking or mismatching
it, so other local pages on the dev box cannot trigger `claude`. Regenerating per activation means
a stale `bridge.json` from a dead extension host carries a token no live listener will accept —
absence degrades safely.

### HTTP shape and status codes

- **`POST /run { prompt: string, skipPermissions?: boolean, name?: string, model?: string }`**
  (extension listener; `X-Agentheim-Bridge-Token` required) → opens a terminal and seeds the
  prompt → `200`/`202`. Missing/bad token → `401`. Malformed/empty body → `400`. The
  `skipPermissions` field is **optional and additive** — every existing `{ prompt }` caller
  (infrastructure-013/014, agentic-workflow-020) remains valid unchanged, since omitting it is the
  off default. The `name` field is likewise **optional and additive** (infrastructure-c6fzb) — a
  caller that omits it gets a prompt-derived fallback name, never a rejection. The `model` field
  (infrastructure-h5wnq) is likewise **optional and additive** — a caller that omits it, or sends a
  value outside the allowlist, gets no `--model` flag at all, never a rejection.
  **Command construction (frozen):**
  - `skipPermissions === true` (the JSON boolean literal `true`, nothing else) → seed
    `claude --dangerously-skip-permissions "<prompt>"`.
  - **anything else** — field absent, `false`, `null`, the string `"true"`, a number, or any other
    non-`true` value → seed `claude "<prompt>"` **verbatim**, exactly as before this amendment.
    The activation test is a strict identity check (`skipPermissions === true`), so malformed input
    fails toward the prompt-gated default, never toward the bypass.
  - **Session name (infrastructure-c6fzb, frozen; carve-out amended infrastructure-w6p4k):** a
    sanitized explicit `name` when supplied, else a fallback derived from the prompt
    (`/agentheim:<skill> …` → `<skill>: …`; plain text → the prompt itself) — **except**
    `/agentheim:modeling <rest>`, which derives `<rest>` alone with no `modeling: ` prefix. The
    resolved name is prepended as its own raw argv pair ahead of everything else:
    `args = ['-n', <name>, ...(model-and-skipPermissions-and-prompt args)]`.
  - **Model selection (infrastructure-h5wnq, frozen):** an exact, case-sensitive member of
    `MODEL_ALLOWLIST = ['fable', 'opus', 'sonnet', 'haiku']` when supplied → `--model <id>` rides
    its own raw argv pair, after `-n <name>` and ahead of the skip-permissions flag/prompt:
    `args = ['-n', <name>, '--model', <id>, ...(skipPermissions-and-prompt args)]`. Anything outside
    the allowlist — case mismatch, shell metacharacters, whitespace, a leading dash, a full model
    id, a non-string, absent — sanitizes to `''` and adds **no** `--model` element; the session then
    inherits the user's own Claude Code config, exactly as if the field had never been sent.
- **`GET /health`** (extension listener; token required) → `200 { ok: true, v: BRIDGE_V,
  capabilities: CAPABILITIES }` (amended 2026-07-13, infrastructure-v8r3q). `capabilities`
  is the **authoritative** signal of what `POST /run` fields *this running listener* honours,
  sourced from the live process's own `CAPABILITIES` constant — it structurally cannot be
  stale the way `bridge.json` can (see amendment banner). Used by the frontend both to
  confirm a live listener at the advertised port and to learn what it can safely send it.
- **`GET /api/bridge`** lives on the **dashboard server**, not the extension → `{ port, token, v,
  capabilities }` or `200 { present: false }`. `capabilities` here is read from `bridge.json`
  and is **belt-and-braces only** — `bridge.json` is written by a separate process on its own
  activation lifecycle and can lag or race the listener it describes; a caller that needs a
  trustworthy answer probes the live `GET /health` instead (infrastructure-v8r3q).
- **CORS preflight is load-bearing.** A custom-header (`X-Agentheim-Bridge-Token`) JSON `POST` is
  **preflighted** by the browser, so the extension listener **must** answer the `OPTIONS`
  preflight (echoing the allowed origin/headers/methods) or the real request never fires. This is
  an easy build trap — called out explicitly for infrastructure-013.

### Absence-detection contract for the frontend

The frontend detects the bridge by calling **`GET /api/bridge`**, then a token-bearing
**`GET /health`** against the advertised port (**≈800 ms timeout**). **Every** failure mode —
timeout, connection-refused, non-200, CORS rejection, `present: false`, not-running-in-Simple-
Browser, any thrown exception — collapses **silently** to the **clipboard fallback**. The board
**must never** surface an error toast, console crash, or broken-looking button for an absent
bridge: **absence is a normal mode**, not an error. This is the contract agentic-workflow-020's
fallback relies on.

### Permission-bypass — opt-in, off by default

> **Reverses the original "No permission-bypass" stance (amended 2026-06-14, infrastructure-015).**
> The original section forbade the launch from ever carrying `--dangerously-skip-permissions`. The
> builder needs an *opt-in* path so that an explicitly-armed launch can skip the per-action
> permission prompts. The default is unchanged — **off** — and absent/false/malformed input still
> reproduces today's prompt-gated `claude "<prompt>"` verbatim.

The bridge **may** carry `--dangerously-skip-permissions`, but **only** when a launch explicitly
asks for it via the optional `skipPermissions` boolean on `POST /run` (frozen in "HTTP shape and
status codes" below). The field is **off by default**: the bypass is never the implicit behaviour
of any board affordance, and a request that omits it — or sends anything other than literal `true`
— launches with normal permission prompts intact.

The field is **intent-named** (`skipPermissions`, not the flag-spelled `dangerouslySkipPermissions`)
so it survives a future CLI-flag rename, and **strictly `true`-activated** so malformed input fails
toward safety rather than toward the bypass.

**Guardrails this amendment mandates:**

- **The token is unchanged.** `X-Agentheim-Bridge-Token` stays required and identical for bypass
  launches; a missing/mismatched token still returns a **byte-identical `401`** whether or not
  `skipPermissions` is set. The bypass widens what an *already-authenticated* request may do — it
  never changes *who* is authenticated, and it is never reachable without the token.
- **A required at-a-glance, per-launch indicator.** Any UI affordance that can fire a bypass launch
  **must** show, at the moment of each launch, a clear at-a-glance signal that *this launch will
  skip permissions* — the conscious moment is each launch, not the one-time toggle flip. The visual
  detail is deferred to agentic-workflow-021 / the design-system; this ADR mandates that the
  indicator exist and be per-launch, not its pixels.
- **Residual risk, stated plainly.** With `skipPermissions: true`, the seeded `claude` session edits
  files and runs shell commands **without its per-action permission prompts** — the last
  interactive gate on a request that has already cleared loopback + token. An armed launch trusts
  the prompt and the session unconditionally for the life of that terminal. This is acceptable only
  for the single-user dev box this whole bridge targets; it is **not** a model for any networked or
  multi-user deployment, and it compounds the trust-boundary note below.

**Clipboard fallback cannot carry the bypass.** `--dangerously-skip-permissions` is a **startup-only**
flag — it is set when `claude` launches, not mid-session. The clipboard fallback copies a slash
command to paste into an *already-running* session, so it has no launch to attach the flag to and
therefore **cannot** carry the bypass. The resulting **bridge-present/absent asymmetry** — a bypass
launch is possible only when the bridge is live — is **accepted, not a defect**: it is the direct
consequence of the flag's startup-only nature, and it fails safe (no bridge ⇒ no bypass).

### Trust boundary

Loopback-only bind (`127.0.0.1`) **plus** the shared-secret token header, per the research note.
Anything that can reach the listener can trigger `claude` (which edits files and runs shell
commands), so the token is what stops other local pages from POSTing to it. Acceptable for a
single-user dev box; **not** a model for any networked or multi-user deployment.

### What stays frozen (the opt-in bypass is purely additive)

The 2026-06-14 amendment adds **only** the optional `skipPermissions` field and its command
construction. It reopens nothing that infrastructure-013, infrastructure-014, or agentic-workflow-020
already built against. Explicitly **unchanged**:

- **Loopback bind** — `127.0.0.1` only, never `0.0.0.0`.
- **Fixed port + ladder** — `31425`, falling back `31425 → 31426 → 31427` on `EADDRINUSE`.
- **Token header** — `X-Agentheim-Bridge-Token` required on every request; missing/mismatched → `401`,
  byte-identical regardless of `skipPermissions`.
- **`OPTIONS` preflight** — still load-bearing; the listener must answer it or the POST never fires.
- **Status codes** — malformed/empty body → `400`; bad/missing token → `401`.
- **Absence degrades silently to clipboard** — every bridge-detection failure mode collapses to the
  clipboard fallback, no error surfaced.
- **`bridge.json` shape** — `{ port, token, pid, startedAt, v }`; `GET /api/bridge` returns the
  `{ port, token, v }` subset or `200 { present: false }`.
- **`POST /inject`** — still named-but-deferred; not built here.

## Consequences

**Positive**

- One frozen interface for three build tasks (013 extension, 014 endpoint, aw-020 buttons) — they
  proceed in parallel with no shared magic number or handshake drift.
- Reuses ADR-0002's `127.0.0.1` binding, in-root path validation, and `.agentheim/.dashboard/`
  gitignored dir wholesale — the divergence is surgical (one clause: port + discovery).
- A sandboxed, filesystem-blind frame learns an on-disk contract through its own origin — the
  general pattern for any future Simple-Browser↔local-process bridge.
- Per-activation token + loopback-only bind gives a defensible trust boundary for a single-user box.

**Negative**

- A fixed port can collide; the `31425→31427` fallback ladder is bounded, so a (pathological)
  triple-collision leaves the bridge undiscoverable — at which point the frontend correctly falls
  back to clipboard. Acceptable, but it is a real failure edge the fallback must cover.
- The CORS-preflight `OPTIONS` requirement is a non-obvious build trap; getting it wrong yields a
  bridge that silently never fires (and, per the absence contract, looks indistinguishable from
  "no bridge").
- A stale `bridge.json` (dead extension host) lingers until the next activation overwrites it; the
  token mismatch and the `GET /health` probe are what keep a stale file from causing a false
  positive.

**Neutral**

- `bridge.json` is a second runtime artifact under `.agentheim/.dashboard/` alongside
  `runtime.json`, written by a different process; both stay gitignored.
- Fresh-session-only scope means the live-inject UX (`POST /inject`) is a known, named future, not
  a gap discovered later.

## Alternatives considered

- **Dashboard server spawns `claude` (headless `child_process.spawn`).** Rejected: a server-spawned
  child does **not** appear in the user's visible VS Code terminal pane — that pane is a pty owned
  by VS Code, and an unrelated server has no handle to write into it. Confirmed locally: the
  dashboard server is itself spawned `detached` with `stdio:'ignore'`, so it has no terminal
  connection. This path is headless-only (`claude -p`, render output back in the dashboard) and
  fails the "real, interactive, visible terminal" requirement. (Research §4.)
- **`vscode://` deep link / `command:` URI.** Rejected for the in-Simple-Browser case: the sandboxed
  webview **blocks** navigation/popups to non-`http(s)` schemes ("sandboxed frame whose
  'allow-popups' permission is not set"), and `command:` URIs only work inside an extension-authored
  webview with `enableCommandUris: true` — not in Simple Browser. Deep links work only when opened
  by a *real external* browser, which is not our context. (Research §2.)
- **Ephemeral `:0` port + runfile (ADR-0002's pattern).** Rejected for this bridge: the discovery
  reader is a filesystem-blind sandboxed frame that can never read the runfile to learn the
  OS-assigned port. A fixed starting port is required so the frame has a knowable place to begin
  server-mediated discovery.
- **`workbench.action.terminal.sendSequence` via a bridge.** Subsumed: it still requires a bridge
  extension calling `executeCommand`, at which point `terminal.sendText()` is simpler and can target
  a specific terminal. Only worth it for control keys `sendText` can't express — not our need.
  (Research §5.)

## Deferred / open sub-questions (non-blocking)

- **`POST /inject`** (inject into a running session) — named-but-deferred, see Scope above.
- **Multi-root-workspace anchoring** for the extension's `.agentheim/` walk-up — a non-issue for
  single-project use; revisit only if a multi-root workspace appears.
- **Whether the port literal `31425` ever needs to move** — only the discovery *mechanism* is
  contractual, so the number can change without breaking the contract.
- **Bracketed-paste / multi-line submission edge cases** when `/inject` is eventually built — flagged
  by the research's open questions; out of scope for the fresh-session `POST /run` path.

## Scope note

This ADR records the **decision only**. No extension, no server endpoint, no board button is built
here. infrastructure-013 builds the extension + listener; infrastructure-014 builds the
`GET /api/bridge` endpoint on the dashboard server; agentic-workflow-020 wires the board buttons +
clipboard fallback. All three build against the contract frozen above.

Full findings + source citations: `knowledge/research/vscode-dashboard-terminal-bridge-2026-06-09.md`.
