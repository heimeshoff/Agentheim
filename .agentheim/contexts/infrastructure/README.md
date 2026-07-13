# Infrastructure

## Purpose

The standing home for Agentheim's **globally-true tech concerns** — runtime, hosting,
shared transport, and the like: the plumbing that exists to *serve* the core, not the
product itself. BC-local infrastructure (an adapter, a repository implementation, a
single BC's own queue handler) stays inside its originating BC; only concerns that are
true independent of any one BC live here.

In practice Agentheim is a Claude Code plugin distributed as **markdown and prompts** —
it has almost no conventional infrastructure: no database, no server, no deploy target,
and until the dashboard, no runtime at all. So this BC is deliberately born **tightly
scoped to a single concern: the dashboard's web-server runtime and transport.** Other
cross-cutting tech (plugin packaging/distribution, the eval harness, shared runtime
tooling) folds in **only if and when it actually appears** — not pre-emptively. The BC's
job today is to keep that one runtime concern from leaking into the domain, and to give
future tech concerns a home so they never fragment into ad-hoc `monitoring/` / `deploy/`
contexts.

## Classification

**supporting (generic-leaning)** — generic tech plumbing that serves the core
`agentic-workflow` context. It carries no domain rules of its own; its value is that it
lets the core run a UI without the core having to grow a runtime.

## Actors

- **Builder** — the single human user. Launches the dashboard runtime from a terminal and
  stops it; never interacts with this BC except through that lifecycle.
- **Internal machinery (not external actors)** — the local web-server process itself, the
  static-asset serving, the JSON API, and the write transport. These are how the context
  does its work, not parties it serves. The skills (`modeling`, `work`, …) and the
  dashboard UI are *clients* of the transport, not actors inside it.

## Ubiquitous language

Generic ops vocabulary, not project-specific domain terms — that thinness is expected
for an infrastructure BC.

- **Runtime** — the local process the `dashboard` command boots. Assumed to run on
  **Node** (Claude Code's own runtime, treated as guaranteed present); no extra global
  install.
- **Transport** — the mechanism that serves `.agentheim/` to the UI and carries writes
  back: static assets + a JSON API over localhost.
- **Launch / Stop** — how the runtime is started from a terminal inside a Claude Code
  plugin context, on a chosen host/port, and how it is torn down. The launcher
  (`launch.mjs`) **ships with the plugin, not the consumer project**. The `/dashboard` command
  locates it through an **environment-variable-independent resolver** (`resolve-launcher.mjs`):
  `$CLAUDE_PLUGIN_ROOT` is **empty** in the command's Bash context for an installed plugin
  (the v0.8.3 field failure that made infrastructure-008's `${CLAUDE_PLUGIN_ROOT:-.}` path
  collapse to the broken project root), so correctness must never depend on it. The resolver
  derives the plugin cache from `os.homedir()` (`<home>/.claude/plugins/cache/agentheim/agentheim`),
  picks the newest version by **semver** (`0.8.10 > 0.8.9`), **fails loud** if none is found,
  and spawns `launch.mjs` with the consumer project as cwd so **project discovery** still
  resolves the foreign `.agentheim/`. Script-in-cache + cwd-in-project remains load-bearing.
  (infrastructure-010, superseding 008's locator; ADR-0002 addendum.) The contract is guarded
  by a committed test seam — a static guard over `commands/dashboard.md` (all three verbs use
  the env-independent `node -e` resolver bootstrap, none depend on `$CLAUDE_PLUGIN_ROOT`, no
  `cd`), resolver unit tests (semver-max incl. the `0.8.10` lexical trap, homedir derivation on
  win32- and POSIX-shaped homes, fail-loud), and a foreign-project integration test that runs
  the literal card form with `CLAUDE_PLUGIN_ROOT` **deleted** from the child env and asserts the
  runfile lands under the consumer project (infrastructure-009, amended by 010).
- **Project discovery** — how the running runtime locates and reads the current project's
  `.agentheim/` folder: **walk up from the invocation directory** until a `.agentheim/`
  folder is found (the way git finds `.git`), resolve an **absolute root once at startup**,
  and validate **every** read/write path against it so no request escapes the project.
- **Write API** — the endpoints that apply a UI-initiated change to disk (e.g. moving a
  task file between lifecycle folders). The transport *carries* the write; it does **not**
  own what a valid write means — that authority lives in `agentic-workflow`. The single
  write endpoint `POST /api/task/move` **delegates to `applyTaskMove`** (owned by
  `agentic-workflow`, ADR-0001/agentic-workflow-003) and never moves a file itself.
- **Runfile** — `.agentheim/.dashboard/runtime.json` = `{ pid, port, startedAt }`, the
  **sole live-runtime** artifact on disk ("present ⇒ a live runtime, gated by pid"). Basis for
  "open the URL" and "stop the runtime"; gitignored. Relaunch over a live/stale runfile
  reuses-or-replaces rather than orphaning.
- **Last-good-port marker** — `.agentheim/.dashboard/last-port.json` = `{ port }`, a separate
  sibling of `runtime.json` in the same gitignored dir (infrastructure-019, ADR-0002 addendum).
  A **pure memory** of the last successfully-bound port, written at bind time so it survives both
  a crash and a clean stop; it does **not** imply a live runtime (that stays `runtime.json`'s job,
  pid-gated). The child's bind path reads it to make the origin **sticky**: bind order is
  **last-good → derived → ladder** (a corrupt/out-of-window marker is ignored, falling back to
  derivation), so an intermittent collision can't flap the `127.0.0.1:<port>` origin.
- **Bridge** — a tiny **VS Code extension** (`vscode-extension/`, infra-owned, its own
  toolchain) running a `127.0.0.1`-only `node:http` listener *inside the editor*. It is the
  only path by which the dashboard — served into VS Code's sandboxed Simple Browser — can open
  a **real, visible, interactive** Claude terminal. The terminal **is** the `claude` process:
  the extension spawns it via `createTerminal({ name, shellPath:'claude', shellArgs:[<'-n', name>, <flag?>, prompt] })`
  (infra-020, named by infrastructure-c6fzb) — the prompt is a **raw argv element**, no shell parses it, so quotes/backticks/`$`/`&`
  and every other metacharacter the builder typed survive verbatim. (Earlier the bridge typed a
  shell command line with `sendText('claude "<prompt>"')`, which mangled metacharacters on Windows
  PowerShell/cmd; that escaping is deleted.) Fixed port **31425** with a bounded fallback ladder
  `31425 → 31426 → 31427`. Surface: `POST /run { prompt, skipPermissions?, name? }` (opens a
  seeded, named terminal → 202), `GET /health` (→ 200), `OPTIONS` preflight (load-bearing — the
  custom-header JSON POST is preflighted). Every request carries the `X-Agentheim-Bridge-Token`
  header; missing/mismatched → 401, malformed/empty body → 400. `POST /run` takes an **optional
  `skipPermissions` boolean** (off by default): only literal `true` prepends
  `--dangerously-skip-permissions` to the launch args; absent/false/malformed launches with the
  prompt alone. The bypass is **bridge-launch-only** (startup flag — the clipboard fallback cannot
  carry it) and requires a per-launch at-a-glance indicator. `POST /run` also takes an **optional
  `name` string** (infrastructure-c6fzb) — every dashboard-launched session used to show as
  `"Claude"` in the tab and the `/resume` picker; the installed CLI's `-n, --name <name>` flag now
  names it. The core sanitizes an explicit `name` (trim, strip control chars/newlines, cap ~60
  chars); absent/malformed derives a fallback from the prompt (`/agentheim:<skill> …` →
  `<skill>: …`; plain text → the prompt itself). The name rides its own raw argv pair `-n <name>`,
  prepended exactly the way `skipPermissions` already prepends — no shell parses it either. The
  dashboard prompt bar sends an explicit mode-derived name (`"<mode label>: <typed text>"`,
  `prompt-mode.js`'s `nameForPromptMode`); other launch affordances rely on the prompt-derived
  fallback. `/rename` is confirmed strictly user-typed (no model/hook/subagent surface), so launch
  time is the only programmatic naming point. The trust boundary is loopback-only bind **plus**
  the shared-secret token — single-user dev box only. The generic launcher carries *whatever*
  prompt it is handed, so all board affordances share it. The inject-into-running-session path
  (`POST /inject`) is deferred. (ADR-0018, infrastructure-013, infrastructure-020, infrastructure-c6fzb.)
- **Bridge discovery file** — `.agentheim/.dashboard/bridge.json` =
  `{ port, token, pid, startedAt, v }`, a **sibling of `runtime.json`** in the same gitignored
  dir, written by a **separate process** (the VS Code extension host) on its own
  activation/deactivation lifecycle. The per-activation token (32 hex via `node:crypto`) is
  regenerated each activation and removed on deactivation, so a stale `bridge.json` from a dead
  host carries a token no live listener accepts. The dashboard server *reads* it to find and
  authenticate the live listener via the read endpoint **`GET /api/bridge`** (infrastructure-014):
  present → `200 { port, token, v }` (the discovery subset only — `pid`/`startedAt` never leak);
  absent, unreadable, or malformed → `200 { present: false }` (never a 5xx for normal absence), so
  the sandboxed frontend degrades silently to clipboard. Read through ADR-0002's in-root path
  validator; pure transport — it runs no `claude`. The extension only *writes* `bridge.json`.
  (ADR-0018.)
- **Live-update transport** — a server→client push channel (`GET /api/events`, Server-Sent
  Events) backed by an `.agentheim/` **file-watcher**. When the project tree changes (a task
  moved by `work`/`modeling` in another terminal, or by the dashboard's own write), the server
  pushes a debounced **`tree-changed` pointer** `{ type, path }` so an open board re-fetches
  `/api/tree` and re-renders in near-real-time. The watcher uses `node:fs.watch` (recursive)
  with a debounced stat-poll fallback where recursive watch is unreliable (Linux, some Windows
  / network-drive cases). The pointer is **raw transport** — what a change *means* (which task
  transitioned) is `agentic-workflow`'s job. (ADR-0006.)

## Owned mechanisms

This BC has no domain aggregates. What it protects instead:

- **Runtime/transport** — protects (decided in ADR-0002):
  - the runtime stays local and single-user — bound to **`127.0.0.1` only**, never
    `0.0.0.0`; built on **Node standard library only**, no framework, no `node_modules`,
    no install step;
  - the transport serves `.agentheim/` and is the *only* path UI writes take to disk;
  - **every** read/write path is validated against the discovered absolute root, so no
    request can escape the project (traversal attempts are rejected, touching no file);
  - no domain rules are encoded here — the transport stays a dumb, conformist carrier of
    domain-authorized operations, delegating the move to `applyTaskMove` and translating
    its rejections into 4xx responses.

## Key events

Past-tense, domain-language. Runtime started · Runtime stopped · Project discovered ·
Asset served · Write request received · Write request applied · Project tree changed.

## Key commands

Intents entering the context. Launch runtime · Stop runtime · Serve `.agentheim/` ·
Apply write request.

## Relationships with other contexts

- **agentic-workflow** — the crux of why this BC exists. The split is **transport vs.
  meaning**:
  - This BC *supplies* the transport (web server, launch, static serving, project
    discovery, the raw write endpoints). For that, `agentic-workflow` is the **downstream
    customer** of infrastructure (customer–supplier; infrastructure = supplier).
  - But what a write *means* — that moving a task card is a **Task lifecycle transition**
    (`Task promoted` / `Task claimed`), bound by the Task aggregate invariants *status
    matches folder* and *one task = one commit*, plus the concurrency story when the UI
    mutates the same files `modeling`/`work` edit — belongs entirely to
    `agentic-workflow`. On those rules this BC is a **conformist**: the transport obeys
    the domain's definition of a valid move; it never invents its own.
  - One-line test for what lands where: *if the dashboard were strictly read-only, would
    this concern still exist?* If yes → infrastructure (transport). If no → it's about the
    meaning of a write → agentic-workflow.

- **design-system** — the dashboard UI served over this transport conforms to the
  design-system styleguide. The visual language is supplied by design-system; this BC only
  serves the assets. The dashboard's committed `dist/` is **built from** the design-system
  ES-module styleguide source by this BC's esbuild pipeline (ADR-0003) — it is a *derived*
  artifact, never a hand-maintained copy, so it cannot drift from the approved styleguide.

## Decisions

- **ADR-0002 — Dashboard runtime / transport.** Node-stdlib localhost HTTP server (no deps,
  no install); single detached `launch.mjs` bound to `127.0.0.1` on a **deterministic,
  project-root-derived port** in window 41000–42023 (per the 2026-06-15 addendum,
  infrastructure-018 — reversed the original ephemeral `:0`), with a bounded fallback ladder
  of 8 on `EADDRINUSE`. The selection order is **last-good → derived → ladder** (2026-06-15
  addendum, infrastructure-019 — refined "derived-first, always" to last-good-first so the
  origin sticks through an intermittent collision; the last-good port lives in the separate
  `last-port.json` marker). The bound port is recorded in `runtime.json`; explicit `stop` path;
  project discovery by walking up for
  `.agentheim/`; write endpoint delegates to `applyTaskMove`. This settles the former
  *transport/meaning seam* and *concurrency* open questions: the seam is `POST /api/task/move`
  → `applyTaskMove`, and concurrency (optimistic precondition + refetch) is owned by
  `agentic-workflow` per ADR-0001 — the transport carries `from` so the precondition can run
  but invents no rule of its own.
  - **Project-named tab title (infrastructure-011).** The served `dist/index.html` is the one
    static asset not streamed verbatim: its `<title>` is rewritten server-side per request to
    `<ProjectName> — Dashboard`, so a dashboard pointed at any discovered project names *that*
    project (no flash of the baked default). `ProjectName` comes from the `# Vision: <Name>`
    heading in the discovered project's `.agentheim/vision.md`, falling back to the root
    folder basename. Pure resolution lives in `dashboard/project-name.mjs`; the transform
    (`serveIndexHtml`) reuses the same in-root path resolver, so ADR-0002's traversal/validation
    guarantees are unchanged. Still zero-dep, stdlib-only, no install step.

- **ADR-0003 — Dashboard asset build (esbuild → committed `dist/`).** The dashboard UI ships
  as a **pre-bundled, committed `dashboard/dist/`** produced by an **esbuild** pipeline
  (`dashboard/build.mjs`) from the design-system ES-module styleguide source. esbuild bundles
  React (production) / ReactDOM / `marked` / `htm` IN, minifies, and writes `dist/` (index.html
  + `app.js` + token CSS) — **no runtime CDN for the framework, no import map, no in-browser
  Babel**. The static handler (ADR-0002) serves this `dist/` directly: **no install step to
  run**. esbuild + the framework deps are **build-time only** (`dashboard/package.json`
  devDependencies; `dashboard/node_modules/` gitignored). One command regenerates `dist/`:
  `cd dashboard && npm install && npm run build`. Known residual: the styleguide token CSS
  `@import`s Google Fonts (Inter Tight / JetBrains Mono) from a CDN — inherited unchanged from
  the source of truth; the framework itself is fully local. (Architecture decided in ADR-0003,
  owned by design-system; the pipeline + committed `dist/` are infrastructure's, per
  infrastructure-002.)

- **ADR-0006 — Dashboard live-update (SSE + file-watcher).** Adds a server→client push channel
  (`GET /api/events`, Server-Sent Events) backed by an `.agentheim/` file-watcher
  (`node:fs.watch` recursive + debounced poll fallback) emitting debounced, path-validated
  `tree-changed` pointers. **Supersedes in part** ADR-0002's request/response-only clause
  (which deferred live file-watch); every other ADR-0002 clause stands. SSE chosen over
  WebSocket (no upgrade handshake; one-directional push) and over client polling (laggy /
  wasteful). The board stays a projection rebuilt from disk (ADR-0001), now event-driven.

- **ADR-0013 — Plugin release discipline (manifest bump bound to a `vX.Y.Z` tag, by
  checklist).** The marketplace reads exactly one version source — `plugin.json` `version`
  (`marketplace.json` has none) — and caches it, so a manifest that lags `main` leaves users
  stuck on *"already at latest"*. A **release** is therefore one deliberate act: cutting a
  `vX.Y.Z` git tag that matches the manifest. Enforced by a **documented checklist**, not CI
  or git hooks (both weighed and rejected as first-CI cost / fresh-clone-unprotected); the
  bump → commit → **push to `main`** → tag steps live in the discoverable top-level
  **[`RELEASE.md`](../../../RELEASE.md)**. Semver is defined against the plugin *contract*
  (patch = doc/copy fixes; minor = new skill/command/capability; major = a breaking change to
  the skill or command surface). Accepted residual risk: a checklist run from memory is the
  same failure class as the original drift, mitigated by binding the bump to the tag act; CI
  is the documented escalation path if drift recurs.

- **ADR-0018 — VS Code dashboard→terminal bridge (fixed-port localhost extension).** Agentheim's
  first deployable VS Code component (`vscode-extension/`): a `127.0.0.1`-only `node:http` listener
  inside the editor that, on a token-bearing `POST /run`, opens a real interactive terminal that
  **is** the `claude` process — spawned via `createTerminal({ shellPath:'claude', shellArgs })`
  (amended 2026-06-16, infra-020), so the prompt is a raw argv element no shell parses and every
  metacharacter survives verbatim. (Originally the bridge typed `sendText('claude "<prompt>"')`,
  whose POSIX `\"`-escaping mangled prompts on Windows PowerShell/cmd; that escaping is deleted.)
  Binds fixed port **31425** with a `31425→31426→31427` fallback ladder;
  records the bound port + a per-activation 32-hex token in `.agentheim/.dashboard/bridge.json`
  (a separate process from the dashboard server's `runtime.json`), removed on deactivation. CORS
  preflight is load-bearing; missing/bad token → 401, malformed body → 400. `POST /run` carries an
  **optional, off-by-default `skipPermissions` boolean** (amended): only literal `true` prepends
  `--dangerously-skip-permissions` to the launch args; absent/false/malformed launches with the
  prompt alone, and the bypass is bridge-launch-only (the clipboard fallback cannot carry the startup
  flag) with a required per-launch indicator. The HTTP wire contract is unchanged by infra-020.
  `POST /run` also carries an **optional `name` string** (amended 2026-07-13,
  infrastructure-c6fzb): sanitized when supplied, else derived from the prompt
  (`/agentheim:<skill> …` → `<skill>: …`; plain text → the prompt itself), riding its own raw argv
  pair `-n <name>` prepended ahead of everything else — so every dashboard-launched session's
  terminal tab and `/resume` picker entry stop reading the hard-coded `"Claude"`. This closed the
  gap the June research report (`vscode-dashboard-terminal-bridge-2026-06-09`) had left open (it
  predates the CLI's `-n`/`--name` flag). The HTTP wire contract is otherwise unchanged.
  **Shares ADR-0002's bounded-ladder collision idiom** but on a different port clause
  (a *fixed literal* `31425` start + server-mediated discovery, because the bridge's reader is a
  filesystem-blind sandboxed frame; the dashboard derives a *root-based* port + runfile discovery —
  see the ADR-0002 infrastructure-018 addendum); every other ADR-0002 clause stands (stdlib-only,
  loopback bind, in-root validation, walk-up discovery, gitignored `.agentheim/.dashboard/`). The contractual core
  lives in `vscode-extension/src/bridge.js` (pure, unit-tested with the terminal-launch action
  injected); `extension.js` is the only file touching the `vscode` API. `POST /inject` deferred.
  Installed outside the marketplace via `vsce package` + `code --install-extension`
  (see `vscode-extension/README.md`). (infrastructure-013, building on infrastructure-012;
  shell-bypass launch reshape infrastructure-020.)

## Open questions

- **Future remit** — whether the eval harness or shared runtime tooling eventually fold into
  this BC. Deliberately deferred; fold in only when the concern actually appears.
  (Plugin packaging/distribution **has** now folded in — see ADR-0013 / `RELEASE.md` above.)
