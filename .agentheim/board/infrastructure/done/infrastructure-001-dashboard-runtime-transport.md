---
id: infrastructure-001
title: Decide the dashboard runtime — Node static+JSON transport, launch/stop, project discovery
status: done
type: decision
context: infrastructure
created: 2026-06-05
completed: 2026-06-05
commit: fd486c7
depends_on: []
blocks: [agentic-workflow-004, infrastructure-003]
tags: [dashboard, runtime, web-server, transport, launch, cross-platform]
related_adrs: [ADR-0002]
related_research: []
prior_art: []
---

## Why

The `dashboard` feature (agentic-workflow-001) introduces the **first runtime** into a
plugin that has so far been pure markdown and prompts. The infrastructure BC exists to
keep that runtime from leaking into the domain. This decision fixes the *transport*: the
local web server, how the `dashboard` command launches and stops it cross-platform, how it
discovers `.agentheim/`, and the shape of the read and write endpoints — **as transport
only**. What a write *means* (Task lifecycle semantics, invariants, concurrency) is the
companion decision agentic-workflow-002, and the shared move primitive it mandates is
agentic-workflow-003 — both explicitly out of scope here. The one-line test governs every
line below: *if the dashboard were read-only, would this concern still exist?* If yes,
it's here.

## What

Decide and record (ADR, BC-scoped to infrastructure):

### Server stack
- **Node, standard library only.** `node:http` for the server, `node:fs`/`node:path` for
  file access. **No framework, no `node_modules`, no install step** — the plugin ships the
  server as plain `.js`/`.mjs` and runs it with the Node that Claude Code already provides.
  This is the "zero extra global install" constraint taken to its conclusion.
- **Static assets** (the built dashboard UI from design-system-001) are served from a
  known plugin-relative directory by a small static handler: resolve request path against
  the asset root, reject path traversal, stream with a minimal content-type map. No
  runtime bundler; if the UI needs a build, that build's committed output is the asset set.

### JSON API shape
Localhost-only JSON over the same server. Two read endpoints and one write endpoint:

- `GET /api/tree` — the project's `.agentheim/` structure the UI needs: every BC, its four
  lifecycle folders, the task files in each (id, title, status, type, path from
  frontmatter), plus the locations of vision / context-map / BC READMEs / research / ADRs.
  Pointers and metadata, not full bodies.
- `GET /api/doc?path=<relative>` — raw markdown of one artifact by its
  `.agentheim/`-relative path, validated against the discovered root (no escape). Markdown
  → HTML rendering happens **client-side** (keeps the server a dumb file carrier).
- `POST /api/task/move` — the **single** write endpoint. Body:
  `{ "id": "<bc>-NNN", "from": "<lifecycle-folder>", "to": "<lifecycle-folder>" }`.
  The transport's job is narrow and total: (1) resolve `id`+`from` to a file under the
  discovered root, (2) verify the file is where `from` claims (precondition), (3) delegate
  the move, (4) return the new state or a structured error. It does **not** decide whether
  the move is a legal lifecycle transition — see the seam below.
  **v1 note:** the only move the UI ever sends is `backlog → todo` (Promote-only, per
  agentic-workflow-002); the endpoint stays generic but is exercised by that one move.

### Launch mechanism (the risky part — Windows vs POSIX)
The `dashboard` command spawns the server **as a detached background process** so the
terminal stays usable, and records enough state to stop it later.

- **Host/port:** bind `127.0.0.1` only (never `0.0.0.0`). Bind an ephemeral port (`:0`),
  read the OS-assigned port back, write it to a runfile, print the URL. (Fixed default with
  EADDRINUSE fallback is an acceptable alternative; ephemeral is simpler and collision-free.)
- **Runfile:** on launch, write `.agentheim/.dashboard/runtime.json` =
  `{ pid, port, startedAt }`. The one piece of runtime state on disk; basis for both "open
  the URL" and "stop it." Add `.agentheim/.dashboard/` to `.gitignore`.
- **Backgrounding / spawn — the cross-platform split:**
  - **POSIX (macOS/Linux):** spawn detached (`spawn(..., {detached:true, stdio:'ignore'}).unref()`);
    the process outlives the spawning shell.
  - **Windows:** no `&`/`disown`; `detached` differs. Spawn with `{detached:true,
    windowsHide:true, stdio:'ignore'}` + `unref()`; do not rely on shell job control or
    `start /b` semantics that tie the child to the console window.
  - **One launcher, not two.** Ship a single `launch.mjs` invoked by the skill (not a
    `.sh`+`.bat` pair with divergent logic); confine all OS differences to `spawn` options.
- **Stop:** ship a **`dashboard stop` path** (not "press Ctrl+C" — the process is
  detached, there's no foreground signal). Stop reads `runtime.json`, terminates `pid`
  (POSIX: `process.kill(pid)`; Windows: `process.kill(pid)`, with `taskkill /PID <pid> /F`
  as documented fallback), deletes the runfile, confirms. A relaunch over a live/stale
  runfile detects and reuses-or-replaces rather than orphaning a process.

### Project discovery
Find the project's `.agentheim/` by **walking up from the invocation directory** until a
`.agentheim/` folder is found (the way git finds `.git`). Resolve an **absolute root once
at startup**, store it, and validate **every** file path (read and write) against it so no
request can escape the project. If none is found up to the filesystem root, fail loudly.

### The write-endpoint contract as a seam (transport ↔ meaning)
This BC owns the **mechanics** of `POST /api/task/move`: parse, locate, precondition-check
`from`, perform the move, respond. It is a **conformist** on **whether** a `from→to` is
allowed — that predicate lives in agentic-workflow. Concretely:

> The write API calls a single agentic-workflow-owned operation —
> `applyTaskMove(rootDir, id, from, to)` (delivered by agentic-workflow-003) — which
> encapsulates the legal-move policy (agentic-workflow-002), the invariant enforcement
> (*status matches folder*: folder rename **and** frontmatter `status` rewrite), and the
> rename. The transport supplies `rootDir` + the parsed request; it does **not**
> reimplement the rename or the rules. On rejection it translates the domain's reason into
> a 4xx and touches no file. The transport never moves a file by itself.

This keeps a single writer of `.agentheim/` task state shared by skills and UI.

## Acceptance criteria

- [x] A BC-scoped ADR is recorded in `knowledge/decisions/` choosing Node-stdlib transport,
      the launch/stop mechanism, and project discovery, with alternatives and reasoning.
      **→ ADR-0002.**
- [ ] _(deferred to agentic-workflow-001)_ Running the launch path starts a server bound to
      `127.0.0.1` only, on macOS, Linux, **and Windows**, using the same single Node launcher
      (verified on the builder's Windows box and at least one POSIX OS).
- [ ] _(deferred to agentic-workflow-001)_ The launch is backgrounded: the spawning terminal
      returns to a prompt and the server keeps serving; a `runtime.json` with `{pid, port}` is
      written under `.agentheim/.dashboard/`.
- [ ] _(deferred to agentic-workflow-001)_ A documented **stop** path terminates the server by
      pid and removes the runfile, on Windows and POSIX. Relaunch over a live/stale runfile does
      not orphan a process.
- [ ] _(deferred to agentic-workflow-001)_ `GET /api/tree` returns the BC/lifecycle/task
      structure of the discovered project; `GET /api/doc?path=` returns raw markdown for a valid
      in-root path and rejects any path that escapes the root.
- [ ] _(deferred to agentic-workflow-001)_ `POST /api/task/move` performs the move **only** by
      delegating to `applyTaskMove` (agentic-workflow-003); on rejection it returns a 4xx with
      the domain's reason and makes **no** filesystem change.
- [ ] _(deferred to agentic-workflow-001)_ Project discovery walks up for `.agentheim/`,
      resolves an absolute root, and every read/write path is validated against it (a traversal
      attempt returns 4xx, touches no file).
- [ ] _(deferred to agentic-workflow-001)_ No `node_modules` / no install step is required to
      launch (stdlib-only verified).

## Notes

> ### ADR draft (for the worker) — scope: infrastructure
>
> ```markdown
> ---
> id: <assign-at-commit>
> title: Dashboard runtime — Node-stdlib localhost transport with detached launch
> scope: infrastructure
> status: proposed
> date: 2026-06-05
> related_tasks: [infrastructure-001, agentic-workflow-001, agentic-workflow-002, agentic-workflow-003]
> ---
>
> # ADR: Dashboard runtime — Node-stdlib localhost transport with detached launch
>
> ## Context
> The dashboard is Agentheim's first runtime; the plugin was markdown + prompts with no
> server, DB, or deploy target. It must run on Windows and macOS/Linux, single-user,
> localhost-only, with no extra global install. Claude Code runs on Node, so Node is
> treated as guaranteed. v1 is interactive (UI writes one task move — Promote — back to
> disk), but *what* a write means belongs to agentic-workflow. The hardest part is
> cross-platform launch/stop of a background process.
>
> ## Decision
> Serve from a **Node standard-library HTTP server, no dependencies, no install** — static
> assets + a tiny JSON API (`GET /api/tree`, `GET /api/doc`, `POST /api/task/move`).
> Launch via a **single Node launcher** spawned **detached**, bound to `127.0.0.1` on an
> ephemeral port recorded in `.agentheim/.dashboard/runtime.json`; provide an explicit
> **stop** command that kills by pid and clears the runfile. Discover the project by
> walking up for `.agentheim/` and validate every path against that root. The write
> endpoint is a dumb carrier: it delegates to `applyTaskMove` and never decides legality.
>
> ## Consequences
> **Positive:** zero install/deps; one launcher across all OSes (differences confined to
> spawn options); localhost-only + in-root path validation ⇒ near-zero attack surface; one
> shared writer for UI and skills. **Negative:** hand-rolled static serving/routing/content
> types need care on traversal + content-type edges; detached processes bring stale-runfile
> / orphan failure modes to handle on relaunch; Windows `process.kill`/detached semantics
> need explicit testing + a `taskkill` fallback. **Neutral:** markdown rendered
> client-side; `runtime.json` is the only runtime artifact and is gitignored.
>
> ## Alternatives considered
> - **Express/Fastify/micro-framework** — reintroduces `node_modules` + install for a
>   handful of routes. Rejected.
> - **Self-contained binary (pkg/Go/Rust)** — off the table per locked inputs; pure cost
>   given Node-present.
> - **Foreground server + Ctrl+C** — occupies the terminal the feature wants free; Ctrl+C
>   differs on Windows anyway.
> - **Bash + batch launcher pair** — divergent per-OS logic rots; one Node launcher is
>   strictly better.
> ```

### Implementation notes for the worker
- Keep the server one file + a small static handler; guard traversal with
  `path.resolve` + `startsWith(root)` on **every** request, reads included.
- Confine OS branching to spawn options + the kill path; test launch+stop on Windows first.
- Do not implement the move in the endpoint — call `applyTaskMove` (agentic-workflow-003)
  and translate its result to HTTP.

## Outcome

**Scope: decision-only.** This run delivered the runtime/transport *decision*, not the
runtime code. The builder explicitly scoped the run to the ADR + BC README update; the
actual server (`launch.mjs`, the HTTP server, the static handler, `/api/tree`, `/api/doc`,
`/api/task/move`, the stop path) is carried by **agentic-workflow-001** once
**agentic-workflow-003** (`applyTaskMove`) and the pre-bundled UI assets
(**infrastructure-002**) land — the write endpoint cannot exist before the operation it
delegates to.

- **ADR-0002** (`.agentheim/knowledge/decisions/0002-dashboard-runtime-transport.md`,
  status `proposed`) records the transport/launch/discovery decision: Node-stdlib localhost
  HTTP server (no deps, no install); single detached `launch.mjs` bound to `127.0.0.1` on an
  ephemeral port recorded in `runtime.json`; explicit `stop` path with `taskkill` fallback on
  Windows; project discovery by walking up for `.agentheim/` with every path validated
  against the resolved root; write endpoint as a dumb carrier delegating to `applyTaskMove`
  (per ADR-0001). Alternatives (framework, self-contained binary, foreground+Ctrl+C, sh/bat
  launcher pair, fixed port) are recorded with reasoning.
- **Infrastructure BC README** updated: project-discovery and write-API ubiquitous language
  sharpened, the runfile added as a term, the runtime/transport invariants made concrete
  (127.0.0.1-only, stdlib-only, in-root path validation, `applyTaskMove` delegation), and the
  former *transport/meaning seam* and *concurrency* open questions resolved into a new
  **Decisions** section pointing at ADR-0002 / ADR-0001.

The **ADR acceptance criterion is met (ticked)**; the seven implementation criteria are
marked *deferred to agentic-workflow-001* rather than checked.

**Key files:**
- `.agentheim/knowledge/decisions/0002-dashboard-runtime-transport.md`
- `.agentheim/contexts/infrastructure/README.md`
