# Dashboard runtime

The Agentheim dashboard server — Agentheim's first runtime. Node standard library
only: **no framework, no `node_modules`, no install step**. Runs on the Node that
Claude Code already provides. See **ADR-0002**
(`.agentheim/knowledge/decisions/0002-dashboard-runtime-transport.md`) for the
transport/launch/discovery decision this implements.

## Scope

Server skeleton (agentic-workflow-004): static asset serving + a health check, the
**live-update SSE stream** (infrastructure-003, ADR-0006), and the **read endpoints**
`GET /api/tree` + `GET /api/doc` (agentic-workflow-005). The dashboard is **read-only**
(ADR-0017): it has **no write path**. Not here:

- **No `POST /api/task/move`** — the dashboard never writes lifecycle state. The drag-to-Promote
  endpoint (agentic-workflow-009) was **removed** (ADR-0017); skills (`modeling` / `work`) are
  the sole owners of task-lifecycle transitions and the board reflects their on-disk moves via
  the SSE stream. The canonical mover `applyTaskMove` (`lib/task-lifecycle.mjs`) lives on for the
  skills.
- The pre-bundled `dist/` assets — infrastructure-002

### Read endpoints: `GET /api/tree` + `GET /api/doc` — ADR-0002

The single read model the board, slide-over, and navigation all rebuild from, and that the
SSE consumer re-fetches on a `tree-changed` frame.

- **`GET /api/tree`** → JSON. Walks the discovered `.agentheim/` and returns, per BC, its four
  lifecycle folders and each task's frontmatter projection
  (`id, title, status, type, context, path`), plus the *locations* of vision / context-map /
  per-BC README+INDEX+concepts / ADRs / research. **Pointers and metadata only — no document
  bodies.** A task with missing `status`/`context` falls back to its folder / BC name (disk is
  the source of truth); malformed frontmatter degrades gracefully — the card is still listed,
  the walk never aborts. The projection logic lives in `tree.mjs` (stdlib-only frontmatter
  parser, no YAML dependency).
- **`GET /api/doc?path=<in-root path>`** → raw `text/markdown`. A validated file carrier for
  one artifact's body (rendering is client-side). `path` is project-root-relative
  (e.g. `.agentheim/knowledge/vision.md`); it is resolved against the root and an escaping path is
  rejected **403** touching no file. Missing `path` → **400**; a non-existent or non-file
  in-root path → **404**.

Both endpoints are pure reads, reuse the `discovery.mjs` `startsWith(root)` guard, and never
write or interpret a lifecycle move.

### Live-update: `GET /api/events` (SSE) — ADR-0006

A long-lived `text/event-stream` connection that pushes a debounced `tree-changed`
pointer whenever the project's `.agentheim/` tree changes, so an open board re-fetches
`/api/tree` and re-renders in near-real-time. Transport only — the payload is a raw
pointer, never an interpreted Task transition (that is agentic-workflow-009's job).

- **Frame:** `event: tree-changed\ndata: {"type":"tree-changed","path":"<root-relative>"}`.
  An opening `hello` frame and periodic `:` heartbeat comment frames keep the stream live;
  a `retry:` hint plus the browser's `EventSource` handle reconnect automatically.
- **Watcher:** `node:fs.watch(.agentheim, { recursive: true })` where supported (macOS,
  Windows) with a **debounced stat-poll fallback** where recursive watch is unreliable
  (Linux, some Windows / network-drive cases). Bursts (a move = delete+create, atomic
  saves, folder renames) collapse into one event. Every emitted path is validated against
  the discovered root; the dashboard's own writes are **not** special-cased.

Until infrastructure-002 lands, `dashboard/dist/` is absent and the static handler
returns a graceful 404 ("assets not built yet"). The server itself runs fine.

### Static assets: module-relative asset root — ADR-0002 / ADR-0004

The static handler serves the committed build from a **module-relative** directory:
`defaultAssetRoot()` resolves `dist/` beside `server.mjs` (via `import.meta.url`), not
against the discovered project root. This is the ADR-0002 "plugin-relative directory"
contract and the asset-serving consequence of ADR-0004's cwd/root decoupling — when the
plugin is installed and pointed at a **foreign project** (project root ≠ plugin dir), the
built `dist/` still lives in the plugin cache beside the module, so the foreign root holds
none. `serve.mjs` honours `AGENTHEIM_DASHBOARD_DIST` as a dev override; the explicit
`assetRoot` parameter on `createDashboardServer` remains the test/override seam.
(infrastructure-004)

## Usage

```sh
node dashboard/launch.mjs          # launch (detached); prints the URL (open it yourself)
node dashboard/launch.mjs stop     # stop: kill by pid, remove the runfile
node dashboard/launch.mjs status   # report running/not-running + port (read-only, never launches)
```

The builder-facing surface is the **`/dashboard`** slash command (agentic-workflow-011,
`commands/dashboard.md`) — a thin trigger that passes the verb straight through to this
launcher. `/dashboard`, `/dashboard stop`, `/dashboard status`. It is the single, documented
exception to Agentheim's "phrasing, not slash commands" rule (a process-launcher, not a
dialogue).

### Launcher location: env-independent resolver, run from the project cwd — ADR-0002 (infrastructure-010)

`launch.mjs` ships **inside the plugin's install dir**, not in the consumer project. When
Agentheim runs as an installed plugin against a foreign codebase there is no `dashboard/`
beside that project's `.agentheim/`, so a project-relative `node dashboard/launch.mjs` would
fail with a module-not-found error.

infrastructure-008 first reached the launcher via `node "${CLAUDE_PLUGIN_ROOT:-.}/dashboard/launch.mjs"`,
but the field disproved that approach: `$CLAUDE_PLUGIN_ROOT` comes through **empty** in the
command's Bash context for an installed plugin, so `${VAR:-.}` collapsed back to `.` → the
consumer project → the exact module-not-found error it set out to fix. **The launcher location
must never depend on `$CLAUDE_PLUGIN_ROOT`** (infrastructure-010; see the ADR-0002 addendum).

The `/dashboard` command instead runs a tiny env-free `node -e` bootstrap that derives the plugin
cache path from `os.homedir()` (`<home>/.claude/plugins/cache/agentheim/agentheim`), picks the
newest cached version by **semver** (`0.8.10 > 0.8.9 > 0.8.3`), imports
`dashboard/resolve-launcher.mjs` from there (or the repo-local copy when run from the Agentheim
repo), and that resolver spawns `launch.mjs`. If no cached launcher is found the bootstrap **fails
loudly** naming the searched path — never a silent `.`-relative fallback. The pure helpers
(`cacheRoot`, `pickNewestVersion`, `resolveLauncher`, `locateLauncher`) are exported and
unit-tested.

The split is load-bearing: the **script** path may live in the plugin cache while the **cwd**
stays the consumer project. The resolver spawns the launcher with cwd inherited, and the
launcher's CLI discovers the root via `discoverRoot(process.cwd())` (walk up from cwd for
`.agentheim/`), so launch/stop/status all find the foreign project and write the runfile under it
regardless of where the script lives. The command must not `cd` or pass a project path.

`launch` spawns the server **detached** so the terminal returns to a prompt, then prints the
served URL — it does **not** open a browser (agentic-workflow-032 removed the auto-open; starting
the server and opening a tab are separate decisions). The builder opens the printed URL
themselves. The server binds `127.0.0.1` **only** on an **ephemeral** port, reads the OS-assigned
port back, and writes the sole runtime artifact:

```
.agentheim/.dashboard/runtime.json   = { pid, port, startedAt }   (gitignored)
```

Relaunch is idempotent: a **live** runfile is reused (no second process); a **stale**
runfile (dead pid) is reaped and replaced — nothing is orphaned.

### Windows stop fallback

`stop` uses `process.kill(pid)` on both OSes. On Windows, if the process is stubborn
the launcher falls back to `taskkill /PID <pid> /F /T`. Manual fallback:

```sh
taskkill /PID <pid> /F /T
```

## Files

- `discovery.mjs` — walk up for `.agentheim/`, resolve an absolute root, validate
  every served path (`path.resolve` + separator-safe `startsWith`).
- `static.mjs` — content-type map + static handler (traversal → 403, missing/absent
  dist → 404, otherwise stream).
- `server.mjs` — `node:http` server: `/healthz` + `GET /api/events` (SSE) +
  `GET /api/tree` + `GET /api/doc` + static. No write route yet (aw-009).
- `tree.mjs` — the `/api/tree` read projection: BC × lifecycle × task frontmatter +
  artifact locations, plus a stdlib-only frontmatter parser. Pointers, never bodies.
- `read-api.mjs` — the `/api/tree` and `/api/doc` request handlers (JSON projection +
  validated raw-markdown carrier).
- `events.mjs` — the SSE handler: stream headers, hello + heartbeat frames, pushes
  `tree-changed` events from the watcher, cleans up on client close (ADR-0006).
- `watcher.mjs` — `.agentheim/` file-watcher: recursive `fs.watch` + debounced poll
  fallback, emits path-validated `{type:"tree-changed", path}` pointers (ADR-0006).
- `runfile.mjs` — runfile read/write/delete, pid-liveness probe, reuse-or-replace.
- `serve.mjs` — the long-running entry spawned detached; binds, writes the runfile.
- `launch.mjs` — the single cross-platform launcher (`launch` / `stop` / `status` CLI),
  including `statusDashboard` (pure runfile read). Prints the served URL on launch but does not
  open a browser (agentic-workflow-032). Driven by `resolve-launcher.mjs`.
- `resolve-launcher.mjs` — env-independent launcher locator (infrastructure-010): derives the
  plugin cache from `os.homedir()`, picks the newest version by semver, fails loud, and spawns
  `launch.mjs` cwd-inherited. Exposes pure `cacheRoot` / `pickNewestVersion` / `resolveLauncher`
  / `locateLauncher` + a `run()` the `commands/dashboard.md` `node -e` bootstrap delegates to.

## Tests

```sh
node --test "dashboard/test/*.test.mjs"
```

Covers discovery + traversal rejection, content-type mapping, runfile
reuse-or-replace, the HTTP server (health check, static streaming, traversal 4xx,
graceful absent-dist 404), a real detached launch → health check → stop cycle, the read
endpoints (`/api/tree` projection shape + no-body guarantee, `/api/doc` valid markdown,
traversal-403, missing-path-400, missing-file-404, directory-refusal) and the `tree.mjs`
projection (lifecycle folders, frontmatter fields, BC+status on every card, artifact
locations, malformed-frontmatter degradation), the SSE stream (`text/event-stream` +
no-cache headers, hello/heartbeat frame, a real `.agentheim/` mutation pushing a
`tree-changed` frame, reconnect), and the watcher
(tree-changed pointer on change/move, in-root path guarantee, burst debounce, clean
close). The watcher's recursive-vs-poll fallback selection is platform-dependent and
documented rather than fully unit-tested; the debounce + emit-shape are covered.

## Verification status

- **Windows** — launch + stop verified on the builder's box (this implementation
  run): detached launch returns the prompt, runfile written, health check reachable,
  stop kills by pid and removes the runfile, reuse/stale-replace confirmed.
- **POSIX (macOS/Linux)** — **pending builder verification** (acceptance criterion
  5). The POSIX spawn path is `spawn(..., { detached: true, stdio: 'ignore' }).unref()`,
  written per ADR-0002 but not executed here. Run the Usage commands on one POSIX OS
  to close the criterion.
