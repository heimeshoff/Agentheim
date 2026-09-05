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
  runfile lands under the consumer project (infrastructure-009, amended by 010). **Version-aware
  reuse** (infrastructure-rgknz, ADR-0002 addendum): a live server is reused only when its
  runfile's recorded plugin identity **matches** the launcher's own; any mismatch — including an
  older runfile missing the fields, or one whose recorded root no longer exists on disk — is a
  **replace**, not a reuse. See the **Runfile** entry below for the mechanics.
- **Project discovery** — how the running runtime locates and reads the current project's
  `.agentheim/` folder: **walk up from the invocation directory** until a `.agentheim/`
  folder is found (the way git finds `.git`), resolve an **absolute root once at startup**,
  and validate **every** read/write path against it so no request escapes the project.
- **Write API** — the endpoints that apply a UI-initiated change to disk (e.g. moving a
  task file between lifecycle folders). The transport *carries* the write; it does **not**
  own what a valid write means — that authority lives in `agentic-workflow`. The single
  write endpoint `POST /api/task/move` **delegates to `applyTaskMove`** (owned by
  `agentic-workflow`, ADR-0001/agentic-workflow-003) and never moves a file itself.
- **Runfile** — `.agentheim/.dashboard/runtime.json` = `{ pid, port, startedAt, pluginVersion,
  pluginRoot }`, the **sole live-runtime** artifact on disk ("present ⇒ a live runtime, gated by
  pid"). Basis for "open the URL" and "stop the runtime"; gitignored. Relaunch over a live/stale
  runfile reuses-or-replaces rather than orphaning. `pluginVersion`/`pluginRoot`
  (infrastructure-rgknz, ADR-0002 addendum) identify **which installed plugin instance** wrote the
  runfile — the serving process's own resolved plugin root
  (`path.resolve(__dirname, '..')` from `dashboard/`) and that root's `.claude-plugin/plugin.json`
  `version`. A runfile written before this task simply lacks the two fields; every reader
  **tolerates their absence** (`undefined`, never a parse error). The relaunch decision
  (`launch.mjs`'s pure `decideReuseOrReplace`) **fails toward freshness**: a dead pid stays
  "stale → replace" exactly as before (unaffected — that path never reaches this comparison); for
  a **live** pid, reuse now requires **both** an equal `pluginVersion` **and** an existing
  `pluginRoot` on disk — a missing/unknown field, a version mismatch, or a `pluginRoot` that no
  longer exists (the previous version's cache dir was removed on update) are each independently
  replace-worthy. `status` prints the serving `pluginVersion` alongside pid/port so skew is
  visible without a launch attempt; `GET /healthz` exposes the same value as `version` on the read
  API.
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
  the extension spawns it via `createTerminal({ name, shellPath:'claude', shellArgs:[<'-n', name>, <'--model', id>?, <flag?>, prompt] })`
  (infra-020, named by infrastructure-c6fzb, given a model by infrastructure-h5wnq) — the prompt is a **raw argv element**, no shell parses it, so quotes/backticks/`$`/`&`
  and every other metacharacter the builder typed survive verbatim. (Earlier the bridge typed a
  shell command line with `sendText('claude "<prompt>"')`, which mangled metacharacters on Windows
  PowerShell/cmd; that escaping is deleted.) Fixed port **31425** with a bounded fallback ladder
  `31425 → 31426 → 31427`. Surface: `POST /run { prompt, skipPermissions?, name?, model? }` (opens a
  seeded, named terminal → 202), `GET /health` (→ `200 { ok, v, capabilities }`), `OPTIONS`
  preflight (load-bearing — the custom-header JSON POST is preflighted). Every request carries
  the `X-Agentheim-Bridge-Token`
  header; missing/mismatched → 401, malformed/empty body → 400. `POST /run` takes an **optional
  `skipPermissions` boolean** (off by default): only literal `true` prepends
  `--dangerously-skip-permissions` to the launch args; absent/false/malformed launches with the
  prompt alone. The bypass is **bridge-launch-only** (startup flag — the clipboard fallback cannot
  carry it) and requires a per-launch at-a-glance indicator. `POST /run` also takes an **optional
  `name` string** (infrastructure-c6fzb) — every dashboard-launched session used to show as
  `"Claude"` in the tab and the `/resume` picker; the installed CLI's `-n, --name <name>` flag now
  names it. The core sanitizes an explicit `name` (trim, strip control chars/newlines, cap ~60
  chars); absent/malformed derives a fallback from the prompt (`/agentheim:<skill> …` →
  `<skill>: …`; plain text → the prompt itself) — **except `modeling`** (infrastructure-w6p4k),
  which derives `<rest>` alone with no `modeling: ` prefix, a deliberate one-skill carve-out to
  the otherwise-uniform convention. The name rides its own raw argv pair `-n <name>`,
  prepended exactly the way `skipPermissions` already prepends — no shell parses it either. The
  dashboard prompt bar sends an explicit mode-derived name (`"<mode label>: <typed text>"`,
  `prompt-mode.js`'s `nameForPromptMode`); other launch affordances rely on the prompt-derived
  fallback. `/rename` is confirmed strictly user-typed (no model/hook/subagent surface), so launch
  time is the only programmatic naming point. `POST /run` also takes an **optional, allowlisted
  `model` string** (infrastructure-h5wnq, feeding the prompt bar's model selector,
  agentic-workflow-m2vkp): `bridge.js` exports the closed `MODEL_ALLOWLIST = ['fable', 'opus',
  'sonnet', 'haiku']` (the short aliases `claude --model`'s own help text documents first — they
  track "the latest model" automatically, unlike a pinned full id) and `sanitizeModel`, an exact
  case-sensitive membership check. This is the **security boundary**: a value outside the allowlist
  (case mismatch, shell metacharacters, whitespace, a leading dash, a full model id, a non-string)
  never reaches the argv — it degrades quietly to no `--model` flag at all, never a `500`. An
  accepted value rides its own raw argv pair, `--model <id>`, after `-n <name>` and ahead of the
  skip-permissions flag/prompt. The dashboard side (`bridge-launch.js`) only threads the value
  through `launchOrCopy`'s `model` option (omitted when absent/blank) — the allowlist enforcement
  itself lives solely in the bridge. The same module also exports `probeBridge(fetchImpl)`, an
  ambient, render-time-safe bridge-presence + capability signal: it reuses `launchOrCopy`'s own
  discover-then-health-probe internals and resolves `{ present: boolean, capabilities: string[] }`,
  never throwing, so the prompt bar's model selector can grey out *before* any launch is attempted
  (a clipboard-copied command can never carry `--model`).
- **Capability handshake — `GET /health` is authoritative, `bridge.json` is belt-and-braces**
  (ADR-0018, infrastructure-v8r3q). Three amendments in a row (infrastructure-016, -c6fzb,
  -h5wnq) grew the `POST /run` fields the bridge honours without bumping any version signal, so a
  builder running a stale extension host (VS Code defers loading a new version until the window
  reloads) silently lost fields the *installed* bridge supported but the *running* listener
  dropped, with a `202 { ok: true }` reported as success regardless. `bridge.js` exports
  `CAPABILITIES = ['prompt', 'skipPermissions', 'name', 'model']` — the `POST /run` fields *this
  build* of `makeHandler` actually reads (a source-scan structural guard in
  `vscode-extension/test/bridge.test.mjs` asserts every `parsed?.<field>` read matches this set
  exactly, in both directions, so a fifth field breaks the build if the constant isn't updated
  too). `GET /health` returns `{ ok: true, v: BRIDGE_V, capabilities: CAPABILITIES }` sourced from
  the **live answering process's own in-memory constant** — structurally incapable of going stale,
  because there is no second process and no write-then-read race. A pre-handshake (0.2.0-shaped)
  listener answers `/health` with **no `capabilities` field at all**; the dashboard treats that
  absence as the closed baseline `LEGACY_CAPABILITIES = ['prompt', 'skipPermissions']`
  (`bridge-launch.js`), never as "unknown." The dashboard is capability-aware in **two places —
  defense in depth**: `probeBridge` surfaces `capabilities` for render-time UI (agentic-workflow-
  n4qte's grey-out/skew banner), and `launchOrCopy`'s own fire-time health probe captures the same
  list so `runOnBridge` **omits `model`/`name` from the `POST /run` body at the wire level**
  whenever the live-probed capabilities don't include them — even if a render-time UI gate is
  stale or bypassed, the request itself cannot claim a capability the listener, at that moment,
  just said it doesn't have (mirrors the bridge's own allowlist-degrades-quietly discipline,
  infrastructure-h5wnq: omit, never reject, never `500`).
- **Bridge discovery file** — `.agentheim/.dashboard/bridge.json` =
  `{ port, token, pid, startedAt, v, capabilities }`, a **sibling of `runtime.json`** in the same
  gitignored dir, written by a **separate process** (the VS Code extension host) on its own
  activation/deactivation lifecycle. The per-activation token (32 hex via `node:crypto`) is
  regenerated each activation and removed on deactivation, so a stale `bridge.json` from a dead
  host carries a token no live listener accepts. The dashboard server *reads* it to find and
  authenticate the live listener via the read endpoint **`GET /api/bridge`** (infrastructure-014):
  present → `200 { port, token, v, capabilities }` (the discovery subset only — `pid`/`startedAt`
  never leak; `capabilities` here is passed through **unchanged**, belt-and-braces only — see
  above, it is **not** the authoritative check); absent, unreadable, or malformed → `200 { present:
  false }` (never a 5xx for normal absence), so the sandboxed frontend degrades silently to
  clipboard. Read through ADR-0002's in-root path validator; pure transport — it runs no `claude`.
  The extension only *writes* `bridge.json`. (ADR-0018.)
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
  - **Amendment (infrastructure-w45ce) — the dashboard bundle joined the release contract.**
    The marketplace copies the marketplace clone of **`main`**, not the tag (verified against
    a live installed cache), so `dashboard/dist/` must be fresh on `main` whenever a release
    is cut — the tag alone was never the right freshness invariant. `RELEASE.md` gained a
    step, ahead of the version-bump commit, to rebuild + verify + stage `dashboard/dist/`.
    See "Dist freshness" under Testing below for the durable, in-suite half of this
    discipline.

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
  predates the CLI's `-n`/`--name` flag). `POST /run` also carries an **optional, allowlisted
  `model` string** (amended 2026-07-13, infrastructure-h5wnq): the closed
  `MODEL_ALLOWLIST = ['fable', 'opus', 'sonnet', 'haiku']` (the CLI's own short aliases, which
  auto-track the latest model of their tier) is the security boundary — an exact,
  case-sensitive member rides `--model <id>` as its own raw argv pair, after `-n <name>` and
  ahead of the skip-permissions flag/prompt; anything else (shell metacharacters, whitespace, a
  leading dash, a full model id, a non-string, absent) degrades to no `--model` flag, never a
  rejection. Feeds the prompt bar's model selector (agentic-workflow-m2vkp), which also consumes
  the `probeBridge(fetchImpl)` export on `bridge-launch.js` — a render-time-safe
  `{ present: boolean, capabilities: string[] }` signal (grown by infrastructure-v8r3q below)
  reusing the module's own discover/health-probe internals, so the selector can grey out before
  any launch is attempted. The HTTP wire contract is otherwise unchanged. **Shares ADR-0002's
  bounded-ladder collision idiom** but on a different port clause
  (a *fixed literal* `31425` start + server-mediated discovery, because the bridge's reader is a
  filesystem-blind sandboxed frame; the dashboard derives a *root-based* port + runfile discovery —
  see the ADR-0002 infrastructure-018 addendum); every other ADR-0002 clause stands (stdlib-only,
  loopback bind, in-root validation, walk-up discovery, gitignored `.agentheim/.dashboard/`). The contractual core
  lives in `vscode-extension/src/bridge.js` (pure, unit-tested with the terminal-launch action
  injected); `extension.js` is the only file touching the `vscode` API. `POST /inject` deferred.
  Installed outside the marketplace via `vsce package` + `code --install-extension`
  (see `vscode-extension/README.md`). (infrastructure-013, building on infrastructure-012;
  shell-bypass launch reshape infrastructure-020.) **Amended 2026-07-13 (infrastructure-v8r3q):**
  three prior amendments (016, -c6fzb, -h5wnq) each grew the `POST /run` fields the bridge honours
  without bumping any version signal, so a builder on a stale extension host (VS Code defers a new
  version until the window reloads) silently lost fields the *installed* build supported —
  `202 { ok: true }` reported regardless. `bridge.js` now exports `CAPABILITIES = ['prompt',
  'skipPermissions', 'name', 'model']` and `GET /health` returns `{ ok, v, capabilities }` sourced
  from the live process's own constant — structurally incapable of staleness, unlike
  `bridge.json`'s last-writer-wins `v` (which also now carries `capabilities`, belt-and-braces
  only). A pre-handshake listener's `/health` omits the field entirely; absence resolves the
  closed `LEGACY_CAPABILITIES = ['prompt', 'skipPermissions']` baseline, never "unknown."
  `probeBridge` and `launchOrCopy`'s fire-time probe both read this signal; `runOnBridge` omits
  `model`/`name` from the `POST /run` body at the **wire level** whenever the live-probed
  capabilities lack them, so a stale/bypassed UI gate can never make a request claim a capability
  the listener just said it doesn't have. A structural guard
  (`vscode-extension/test/bridge.test.mjs`) scans `bridge.js`'s source for every `parsed?.<field>`
  read and asserts that set is exactly `CAPABILITIES`, so a future field added to one but not the
  other breaks the build. UI consumption of `capabilities` (grey-out + skew banner) is
  agentic-workflow-n4qte's, not this BC's.

- **ADR-0056 — Node ESM bare-specifier resolve hook for cross-BC DOM tests.** A jsdom
  DOM-render test harness (`dashboard/test/dom-harness.mjs`) lets a `node --test` file mount a
  real component and dispatch a real DOM event — observable behavior a source-regex suite
  structurally cannot see (see the Testing note below). Mounting a design-system styleguide
  component (consumed unforked, ADR-0003) throws `ERR_MODULE_NOT_FOUND` under a plain `node
  --test`, because the styleguide has no `node_modules` anywhere up its own tree — the same
  problem `build.mjs`'s esbuild `nodePaths` already solves at build time, which has no Node-ESM
  equivalent (`NODE_PATH` is ignored for ESM). `dashboard/test/resolve-hook.mjs` is the
  Node-side analogue: a `module.register()` resolve hook, self-registered by each DOM test file
  (never globally), that redirects a fixed handful of bare specifiers
  (`react`/`react-dom`/`react-dom/client`/`htm`/`marked`) to `dashboard/node_modules` by
  reusing Node's own walk-up algorithm against a synthetic parent path — zero source changes,
  and inert for every test file that does not opt in. Rejected: a second `styleguide/
  node_modules` junction (ADR-0032's `lib/worktree-node-modules.mjs` spike-confirmed that `git
  worktree remove --force` recurses through an un-unlinked junction and silently deletes the
  real target's contents; `unlinkDashboardNodeModules` only knows about `dashboard/
  node_modules`).

## Testing

- **DOM-render harness (`dashboard/test/dom-harness.mjs` + `resolve-hook.mjs`, jsdom, ADR-0056)
  — reach for it when a keyboard/focus/ARIA contract's correctness depends on *live event
  propagation* (capture/bubble, delegation, focus movement), not just on what strings appear in
  the source.** `agentic-workflow-m2vkp` shipped a double-handled Ctrl+M — React 18
  `createRoot` delegates keydown at the root container, the event then bubbles on to `document`,
  where a second listener also fired, stepping a model selector by two instead of one — with
  1279 tests green, because no source-regex assertion can predict what happens when two live
  listeners are both attached and one bubbles into the other. The harness mounts a real
  component (`mount`, wrapping `createRoot`/`act`), dispatches real `KeyboardEvent`s through
  jsdom's spec-accurate algorithm (`dispatchKeyDown`), and reads real rendered DOM/focus —
  see `dashboard/test/board-prompt-bar-dom.test.mjs` (the Ctrl+M reproduction, mutation-tested
  against `shouldWindowCtrlMHandle`) and `dashboard/test/model-split-button-dom.test.mjs` (the
  `ModelSplitButton` menu's roving-tabindex keyboard contract, mounted from styleguide source
  across the BC boundary — proof the cross-BC reach genuinely works, not merely asserted).
  jsdom is a `dashboard/package.json` **devDependency only** — same build/test-time-only carve-
  out as esbuild (ADR-0002/ADR-0003); `dist-build.test.mjs` asserts it never reaches the
  committed bundle. Container **must** be `document.body.appendChild`'d BEFORE `createRoot` — a
  detached container never sees an event bubble to `document`, so the bug this harness exists
  to catch would silently not reproduce and the harness would give a false green. Always
  `await act(async () => root.unmount())` in teardown — a leaked mount's `document` listener
  double-fires the next test's dispatch.
- **What it still cannot see.** This task deliberately did **not** migrate the rest of
  `board-prompt-bar.test.mjs` or `model-split-button.test.mjs` to the harness ("not a big-bang
  regex migration") — most of those files' assertions (layout/token/structure guards, ARIA
  attribute presence, import-shape pins) are exactly what a source-regex suite is *good* at,
  and migrating them would trade a cheap, precise assertion for an expensive, less-precise one.
  The harness also proves nothing about real-browser-only concerns jsdom does not implement
  (layout/paint, real focus-visible styling, actual screen-reader announcement) — it is a DOM
  behavior harness, not a visual or assistive-technology regression tool. One `board-prompt-
  bar.test.mjs` regex test is deliberately KEPT alongside the new DOM test, not superseded by
  it: pinning that the window-scoped Ctrl+M listener calls `shouldWindowCtrlMHandle` *before*
  `preventDefault`/`setSelectedModel` proves a call site's ordering, which a behavioral test
  genuinely does not assert.

- **Dist freshness (`dashboard/build-stamp.mjs` + `dist-staleness.test.mjs`, infrastructure-w45ce,
  ADR-0013 amendment / ADR-0057 doctrine note).** A stdlib-only, `node --test` check that a
  release checklist alone cannot enforce: it fails when the **committed** `dashboard/dist/`
  lags its declared inputs (`dashboard/app/**`, the styleguide source `build.mjs` consumes,
  `dashboard/assets/**`, `build.mjs` itself), and passes right after `cd dashboard && npm run
  build`. `build.mjs` writes `dist/.build-stamp.json` (a content hash over those inputs, text
  files normalised to LF so Windows `autocrlf` never phantom-fails it — never the bundle
  bytes) on every real build; the check only ever reads and re-hashes, never rebuilds, so it
  needs no esbuild/`node_modules` to run. **Interplay with the ADR-0057 checkpoint guard** (do
  not confuse the two): a worker who edits `dashboard/app/` without rebuilding is not blocked
  by this check — ADR-0057's guard still drops that worker's worktree rebuild before it can
  reach `main` — but this check goes red **on `main`** once the merge lands, and stays red
  until a builder runs the real rebuild (the `RELEASE.md` step above) and commits it. The two
  guards are complementary, not contradictory: one is preventive and worker-scoped, the other
  is detective and `main`-scoped. `dist-build.test.mjs`'s own fresh-build assertions now build
  into a scratch directory instead of `dashboard/dist/` in place, precisely so this check keeps
  reading the real, honest, committed `dist/` rather than one a sibling test just refreshed.

## Open questions

- **Future remit** — whether the eval harness or shared runtime tooling eventually fold into
  this BC. Deliberately deferred; fold in only when the concern actually appears.
  (Plugin packaging/distribution **has** now folded in — see ADR-0013 / `RELEASE.md` above.)
