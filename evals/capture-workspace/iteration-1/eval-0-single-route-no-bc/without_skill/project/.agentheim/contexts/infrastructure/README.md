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
  plugin context, on a chosen host/port, and how it is torn down.
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
  **sole** runtime artifact on disk. Basis for "open the URL" and "stop the runtime";
  gitignored. Relaunch over a live/stale runfile reuses-or-replaces rather than orphaning.
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
  no install); single detached `launch.mjs` bound to `127.0.0.1` on an ephemeral port
  recorded in `runtime.json`; explicit `stop` path; project discovery by walking up for
  `.agentheim/`; write endpoint delegates to `applyTaskMove`. This settles the former
  *transport/meaning seam* and *concurrency* open questions: the seam is `POST /api/task/move`
  → `applyTaskMove`, and concurrency (optimistic precondition + refetch) is owned by
  `agentic-workflow` per ADR-0001 — the transport carries `from` so the precondition can run
  but invents no rule of its own.

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

## Open questions

- **Future remit** — whether plugin packaging/distribution, the eval harness, or shared
  runtime tooling eventually fold into this BC. Deliberately deferred; fold in only when
  the concern actually appears.
