---
id: ADR-0002
title: Dashboard runtime — Node-stdlib localhost transport with detached launch
scope: infrastructure
status: proposed
date: 2026-06-05
related_tasks: [infrastructure-001, agentic-workflow-001, agentic-workflow-002, agentic-workflow-003, infrastructure-010, infrastructure-018, infrastructure-019, infrastructure-rgknz]
related_adrs: [ADR-0006, ADR-0018]
superseded_in_part_by: [ADR-0006]
---

# ADR-0002: Dashboard runtime — Node-stdlib localhost transport with detached launch

> **Superseded in part by [ADR-0006](0006-dashboard-live-update-sse.md).** This ADR chose
> request/response only and listed live file-watch as *deferred*. ADR-0006 reverses **that one
> clause** by adding a Server-Sent-Events push channel (`GET /api/events`) backed by an
> `.agentheim/` file-watcher. **Every other clause below still stands**: Node-stdlib / zero
> dependencies, `127.0.0.1` binding, detached launch + runfile + explicit stop, walk-up project
> discovery, in-root path validation, and the `applyTaskMove` write seam.

> **Transport precedent for [ADR-0018](0018-vscode-dashboard-terminal-bridge.md).** ADR-0018 (the
> VS Code dashboard→terminal bridge) reuses this ADR's `127.0.0.1`-only binding, in-root path
> validation, and gitignored `.agentheim/.dashboard/` runtime dir, but **diverges on one clause**:
> it chooses a **fixed starting port + server-mediated discovery** instead of this ADR's ephemeral
> `:0` + runfile, because the bridge's discovery reader is a filesystem-blind sandboxed Simple
> Browser frame that can never read a runfile.

## Context

The dashboard (agentic-workflow-001) is Agentheim's **first runtime**. Until it, the
plugin was markdown + prompts: no server, no database, no deploy target. The infrastructure
BC exists to keep this runtime from leaking into the domain, and this decision fixes the
**transport** — the local web server, how the `dashboard` command launches and stops it
cross-platform, how it discovers `.agentheim/`, and the shape of the read/write endpoints —
**as transport only**.

Constraints from locked inputs:

- **Single-user, localhost-only.** No multi-user, no auth, no network exposure.
- **Windows *and* macOS/Linux.** The builder runs Windows; POSIX must work too. The hardest
  part is cross-platform launch/stop of a background process.
- **No extra global install.** Claude Code already ships Node, so Node is treated as
  guaranteed; nothing else may be assumed.
- **v1 is interactive but write-minimal.** The UI writes exactly one task move (Promote,
  `backlog→todo`) back to disk. *What* a write means belongs to `agentic-workflow`
  (ADR-0001); this BC carries it as dumb transport.

The governing test for what belongs here: *if the dashboard were read-only, would this
concern still exist?* If yes, it is transport and lives in this decision.

## Decision

### Server stack — Node standard library, zero dependencies

Serve from a **Node standard-library HTTP server**: `node:http` for the server,
`node:fs`/`node:path` for file access. **No framework, no `node_modules`, no install step.**
The plugin ships the server as plain `.js`/`.mjs` and runs it with the Node that Claude Code
already provides. This is the "zero extra global install" constraint taken to its conclusion.

**Static assets** — the pre-bundled dashboard UI (committed output of design-system-001,
delivered by infrastructure-002) — are served from a known plugin-relative directory by a
small static handler: resolve the request path against the asset root, reject path traversal,
stream with a minimal content-type map. There is **no runtime bundler and no in-browser
Babel**; the UI's committed build output *is* the asset set.

### JSON API shape — localhost-only, two reads + one write

Two read endpoints and one write endpoint over the same server:

- `GET /api/tree` — the project's `.agentheim/` structure the UI needs: every BC, its four
  lifecycle folders, the task files in each (id, title, status, type, path — from
  frontmatter), plus the locations of vision / context-map / BC READMEs / research / ADRs.
  Pointers and metadata, **not** full bodies.
- `GET /api/doc?path=<relative>` — raw markdown of one artifact by its `.agentheim/`-relative
  path, validated against the discovered root (no escape). Markdown → HTML rendering happens
  **client-side**, keeping the server a dumb file carrier.
- `POST /api/task/move` — the **single** write endpoint. Body
  `{ "id": "<bc>-NNN", "from": "<lifecycle-folder>", "to": "<lifecycle-folder>" }`. The
  transport's job is narrow and total: (1) resolve `id`+`from` to a file under the discovered
  root, (2) verify the file is where `from` claims (precondition), (3) delegate the move,
  (4) return the new state or a structured error. It does **not** decide whether the move is a
  legal lifecycle transition — see the seam below.

### Launch mechanism — single Node launcher, detached, 127.0.0.1 only

The `dashboard` command spawns the server **as a detached background process** so the
terminal stays usable, and records enough state to stop it later.

- **Host/port:** bind `127.0.0.1` only — **never** `0.0.0.0`. Bind an ephemeral port (`:0`),
  read the OS-assigned port back, write it to the runfile, print the URL. (A fixed default with
  EADDRINUSE fallback is an acceptable alternative; ephemeral is simpler and collision-free.)
- **Runfile:** on launch, write `.agentheim/.dashboard/runtime.json` =
  `{ pid, port, startedAt }`. This is the **sole** piece of runtime state on disk and the
  basis for both "open the URL" and "stop it." `.agentheim/.dashboard/` is gitignored.
- **One launcher, not two.** Ship a single `launch.mjs` invoked by the skill — *not* a
  `.sh` + `.bat` pair with divergent, rot-prone logic. All OS differences are confined to
  `spawn` options and the kill path:
  - **POSIX (macOS/Linux):** `spawn(..., { detached: true, stdio: 'ignore' }).unref()`; the
    process outlives the spawning shell.
  - **Windows:** no `&`/`disown`, and `detached` behaves differently. Spawn with
    `{ detached: true, windowsHide: true, stdio: 'ignore' }` + `unref()`; do **not** rely on
    shell job control or `start /b` semantics that tie the child to the console window.

### Stop — explicit command, never Ctrl+C

The process is detached, so there is no foreground signal to interrupt. Ship a `dashboard stop`
path: read `runtime.json`, terminate `pid` (POSIX and Windows both via `process.kill(pid)`,
with `taskkill /PID <pid> /F` as a documented Windows fallback), delete the runfile, confirm.
A relaunch over a live/stale runfile **detects and reuses-or-replaces** rather than orphaning a
process.

### Project discovery — walk up for `.agentheim/`

Find the project's `.agentheim/` by **walking up from the invocation directory** until a
`.agentheim/` folder is found (the way git finds `.git`). Resolve an **absolute root once at
startup**, store it, and validate **every** read and write path against it — `path.resolve` +
`startsWith(root)` on every request — so no request can escape the project. If none is found up
to the filesystem root, **fail loudly**.

### The write-endpoint contract as a seam (transport ↔ meaning)

This BC owns the **mechanics** of `POST /api/task/move`: parse, locate, precondition-check
`from`, perform the move, respond. It is a **conformist** on **whether** a `from→to` is allowed
— that predicate lives in `agentic-workflow`. Concretely:

> The write API calls a single agentic-workflow-owned operation —
> `applyTaskMove(rootDir, id, from, to)` (delivered by agentic-workflow-003, per ADR-0001) —
> which encapsulates the legal-move policy (Promote-only in v1, including the `depends_on`
> guards), the *status-matches-folder* invariant (folder rename **and** frontmatter `status`
> rewrite together), the optimistic precondition (`from` + mtime guard), and the rename itself.
> The transport supplies `rootDir` + the parsed request; it does **not** reimplement the rename
> or the rules. On rejection it translates the domain's reason into a 4xx (e.g. 409 for a stale
> board) and touches **no** file. The transport never moves a file by itself.

This keeps a **single writer** of `.agentheim/` task state shared by skills and UI, exactly as
ADR-0001 mandates.

## Consequences

**Positive**

- Zero install / zero dependencies; the launcher uses only Node already present.
- One launcher across all OSes — differences confined to `spawn` options and the kill path —
  so no per-OS script drift.
- `127.0.0.1`-only binding + in-root path validation on every request ⇒ near-zero attack
  surface.
- One shared writer for UI and skills; the transport cannot drift from the domain's rules.

**Negative**

- Hand-rolled static serving / routing / content-types need care on path-traversal and
  content-type edges.
- Detached processes bring stale-runfile / orphan failure modes that the relaunch and stop
  paths must handle.
- Windows `process.kill` / detached semantics need explicit testing plus the `taskkill`
  fallback.

**Neutral**

- Markdown is rendered client-side; the server stays a dumb file carrier.
- `runtime.json` under `.agentheim/.dashboard/` is the only runtime artifact, and it is
  gitignored.

## Alternatives considered

- **Express / Fastify / micro-framework** — reintroduces `node_modules` + an install step for a
  handful of routes. Rejected against the zero-install constraint.
- **Self-contained binary (pkg / Go / Rust)** — off the table per locked inputs; pure cost given
  Node is already present.
- **Foreground server + Ctrl+C** — occupies the terminal the feature wants kept free, and Ctrl+C
  behaves differently on Windows anyway. Rejected.
- **Bash + batch launcher pair** — divergent per-OS logic rots; one Node launcher with branching
  confined to `spawn` options is strictly better.
- **Fixed default port with EADDRINUSE fallback** — viable, but ephemeral `:0` is simpler and
  collision-free; recorded as an acceptable alternative rather than rejected.

## Scope note

This ADR records the **decision only**. The runtime itself (`launch.mjs`, the HTTP server, the
static handler, `/api/tree`, `/api/doc`, `/api/task/move`) is built by **agentic-workflow-001**
(the dashboard), once **agentic-workflow-003** (`applyTaskMove`) and the pre-bundled UI assets
(**infrastructure-002**) land. The transport's write endpoint cannot exist before the operation
it delegates to.

## Addendum — env-independent launcher location (2026-06-08, infrastructure-010)

> Adds a sub-clause to the **detached launch + walk-up discovery** decision above. Does not
> reverse any prior clause; it removes a hidden dependency the original launch decision left
> unstated. Not a new ADR number — it is part of this transport decision.

### Context

The `/dashboard` slash-command card must reach `launch.mjs`, which ships **inside the plugin's
install dir**, while running with the **consumer project as cwd** (so the launcher's
`discoverRoot(process.cwd())` walks up to the foreign `.agentheim/`). infrastructure-008 reached
the launcher via `node "${CLAUDE_PLUGIN_ROOT:-.}/dashboard/launch.mjs"` on the **unverified
assumption** that Claude Code exports `$CLAUDE_PLUGIN_ROOT` into the command's Bash context.

The field disproved it: on an **installed** plugin (v0.8.3, Windows 11), `$CLAUDE_PLUGIN_ROOT`
came through **empty** in the command's Bash context. `${VAR:-.}` treats empty exactly like
unset, so it collapsed to `.` → the consumer project root → `Cannot find module
'…\<project>\dashboard\launch.mjs'`. 008's fix was inert in the exact case it targeted.
Platform ground truth (claude-code-guide): `$CLAUDE_PLUGIN_ROOT` is documented for *hook
processes and MCP/LSP subprocesses*; there is a **doc gap** for command-card Bash calls, and no
other env var (`$CLAUDE_PLUGIN_DATA` is state; `$CLAUDE_PROJECT_DIR` is the project) gives a
command its own plugin root.

### Decision

The launcher is located by an **environment-variable-independent resolver**, not by
`$CLAUDE_PLUGIN_ROOT`. Contract (`dashboard/resolve-launcher.mjs`, stdlib-only):

1. **Cache path from `os.homedir()`**, never raw env vars — covers `%USERPROFILE%` and `$HOME`
   alike: `<home>/.claude/plugins/cache/agentheim/agentheim`. The `agentheim/agentheim`
   `<source>/<plugin>` segment is confirmed against the live cache. The cache layout is a
   stable-in-practice implementation detail, not a formal platform contract.
2. **Newest version by SEMVER maximum**, numeric per field — `0.8.10 > 0.8.9 > 0.8.3` — ignoring
   non-semver dir names and skipping a version dir whose `dashboard/launch.mjs` is absent.
3. **Fail loud**, naming the searched cache path, when nothing is found. Never a silent
   `.`-relative fallback (the silent collapse is precisely what caused the bug).
4. **Spawn the real launcher with cwd inherited** (the consumer project) and `stdio: 'inherit'`,
   exiting with the child's code — preserving the load-bearing **script-in-cache + cwd-in-project**
   split so foreign `.agentheim/` discovery still works.
5. **Repo-local short-circuit**: when run from the Agentheim repo itself (launcher beside the
   module via `import.meta.url`, or `./dashboard/resolve-launcher.mjs` under cwd), use it and skip
   the cache walk.

The card's entry point is a minimal, env-free `node -e` bootstrap doing only
homedir→cache→newest-version→`import()`, delegating to the resolver's exported `run()` — because
locating the *resolver file itself* has the **same** empty-`$CLAUDE_PLUGIN_ROOT` chicken-and-egg
as locating the launcher, so it cannot reference that var either. `$CLAUDE_PLUGIN_ROOT` may only
ever be a *fast-path*; correctness never depends on it.

### Consequences

- The dashboard launches from any consumer project without manual cache spelunking.
- A new constraint: the home plugin-cache layout (`agentheim/agentheim/<semver>/dashboard/`) is now
  load-bearing for `/dashboard`; if Claude Code changes it, the resolver must change with it (and
  fails loud meanwhile).
- **Verification realism (the reason 008 shipped broken):** a worker in the Agentheim repo can
  unit-test the resolver fully and simulate the foreign + empty-var case (temp foreign project,
  `CLAUDE_PLUGIN_ROOT` deleted, `os.homedir()` redirected to a fake cache linking the repo
  dashboard). It **cannot** observe a real Claude Code `/dashboard` invocation against an installed
  plugin — and the cross-shell `node -e` quoting can only be fully confirmed there. The
  installed-plugin run remains a **post-release maintainer confirmation step**.

## Addendum — deterministic port for a stable origin (2026-06-15, infrastructure-018)

> Reverses **one clause** of the "Launch mechanism" decision above: the preference for an
> **ephemeral `:0`** port and its restatement under "Alternatives considered" (the "Fixed
> default port with EADDRINUSE fallback" bullet). The dashboard now binds a **deterministic,
> project-root-derived port** so the browser origin is stable across relaunches. Every other
> clause — `127.0.0.1`-only binding, detached launch + runfile + explicit stop, walk-up
> discovery, in-root path validation, the `applyTaskMove` write seam — **still stands**. Not a
> new ADR number; it is part of this transport decision.

### Context

When ADR-0002 chose ephemeral `:0`, the rationale was "simpler and collision-free, and no
reason to want a stable origin." That premise has since been **invalidated** by three
origin-keyed persistence features that did not exist in 2026-06-05:

- the dashboard **theme** (`theme-state.js`, agentic-workflow-017),
- the **board view-state** (`board-view-state.js`, ADR-0015), and
- the persisted **skip-permissions armed toggle** (`skip-permissions-state.js`,
  agentic-workflow-021).

All three persist to browser `localStorage`, which is **keyed by origin**. The launcher binds
`server.listen(0, ...)` (`serve.mjs`), so every relaunch onto a fresh OS-assigned port produces
a *new* `127.0.0.1:<port>` origin and **orphans all three stores**. The user noticed it through
skip-permissions because that store has real consequence; theme and board view-state were losing
state silently for the same reason. There is now a **strong reason to want a stable origin** —
the exact reason ADR-0002 recorded as absent.

The reuse path already preserves the origin when a server is *live*: `launchDashboard` →
`inspectExisting` returns `action:'reused'` at the same port (`launch.mjs`). The orphaning
happens **only** when the previous server is dead and a fresh `:0` bind lands somewhere new.

### Decision

Bind a **deterministic port derived from the absolute project root path**: hash the resolved
root and fold it into the non-privileged window **41000–42023** (`port = 41000 + (hash(root) mod
1024)`), so the *same project* binds the *same port* (hence the same origin) on every relaunch,
and *different Agentheim projects* on one machine derive *different* ports (no cross-project
collision — which a single fixed literal could not guarantee). The window is clear of the
privileged range, the OS ephemeral range (49152+), ADR-0018's bridge band (31425–31427), and
common dev ports. The derivation is a pure function of the root; it is the contract.

On `EADDRINUSE`, fall back along a **bounded ladder of 8** that wraps within the same window
(`port = 41000 + ((hash(root) mod 1024) + step) mod 1024`, `step = 0..7`), binding the first free
port — **mirroring ADR-0018's `31425 → 31426 → 31427` shape** (longer ladder for the wider
derivation surface) so the two local transports share one collision idiom. The bound port is
always written to `runtime.json`, exactly as the ephemeral port was, so "open the URL" and
"stop it" are unaffected.

A **genuine third-party collision** (the derived port and its whole ladder held by unrelated
processes) is the same bounded-collision trade-off ADR-0018 already accepts; it is rare. Making
that case *self-heal* — retrying the launcher-visible **last-good port** from `runtime.json`
before deriving (a discovery option the sandboxed-frame bridge lacks) — is a deliberate
follow-up (**infrastructure-019**), not part of this clause; the launcher's reuse path and
`inspectExisting` are unchanged here.

### Consequences

- The three origin-keyed stores (theme, board view-state, skip-permissions) survive stop+relaunch
  with **no new endpoint and no client change** — the fix is purely in the bind.
- The dashboard and the bridge (ADR-0018) now share one fixed-port-with-bounded-ladder idiom.
- ADR-0002's original "collision-free" virtue of `:0` is traded for origin stability — the right
  trade now that origin-keyed state exists. Real collisions become a rare edge (handled cleanly
  by the ladder; self-heal across launches is the infrastructure-019 follow-up) rather than an
  impossibility.

## Addendum — sticky last-good port (2026-06-15, infrastructure-019)

> Refines the **port-selection order** of the infrastructure-018 addendum directly above: from
> "**derived-first, always**" to "**last-good-first**". The dashboard now prefers the port it last
> successfully bound, falling back to the derived port and then the ladder. Reverses no clause of
> the base decision — `127.0.0.1`-only binding, detached launch + runfile + explicit stop, walk-up
> discovery, in-root path validation, the `applyTaskMove` write seam all **still stand**. Not a new
> ADR number; it is part of this transport decision.

### Context

infrastructure-018 always tries the **derived port first**, which already snaps the origin back to
the derived port when a collision *clears*. The case it leaves open is **flapping**: when a
third-party process holds the derived port **intermittently**, the origin bounces launch-to-launch
between the derived port (when free) and a ladder rung (when taken). Each bounce is a different
`127.0.0.1:<port>` origin and therefore a different (often empty) set of the origin-keyed
`localStorage` stores (theme, board view-state, skip-permissions) — the builder's settings appear
to reset intermittently. "Derived-first, always" cannot be sticky by construction.

The infrastructure-018 addendum framed the follow-up as retrying the launcher-visible last-good
port **from `runtime.json`**. Refinement **superseded** that framing: coupling the port memory to
`runtime.json` would muddy its "present ⇒ a live runtime, gated by pid" contract, and reap-time
preservation would have needed writes in both `inspectExisting` and `stopDashboard`.

### Decision

Persist the last successfully-bound port in a **separate marker**,
`.agentheim/.dashboard/last-port.json` = `{ port }` — a sibling of `runtime.json` in the same
gitignored dir (mirroring how `bridge.json` sits beside it, ADR-0018). It is a **pure memory** that
outlives the server: written **at successful-bind time** in the child (`serve.mjs`), right where it
writes `runtime.json`, so it survives **both** a crash and a clean `/dashboard stop`. `runtime.json`
keeps its exact meaning — `inspectExisting` / `stopDashboard` are **unchanged** and never learn
about the port; the marker is read only by the child's bind path.

The child forms the bind order **last-good → derived → ladder** (pure, stdlib-unit-tested
`bindSequence` in `port.mjs`, consumed by `listenOnLadder`). A last-good port **outside** the
41000–42023 window, or a malformed/unreadable marker, is **ignored** — the bind falls back to
derivation, never an out-of-band bind, never a crash. A last-good equal to the derived port (or
already on a ladder rung) produces **no duplicate attempt**. The deterministic derivation from
infrastructure-018 remains the fallback for the first launch (no marker) or an unusable one.

This changes the observable contract to **last-good-first**: once the dashboard binds a port, that
port is preferred on every subsequent launch, so the origin no longer flaps under an intermittent
collision.

### Consequences

- The origin is **sticky**: an intermittent third-party collision can no longer flap the origin,
  so the three origin-keyed stores stay put across relaunches — the gap infrastructure-018 left.
- **Accepted tradeoff:** once the origin moves off the derived port (a collision-driven move), the
  pre-collision `localStorage` store is **orphaned permanently**. Cross-origin store migration was
  considered and rejected as out of scope.
- The derived port becomes only the **first-ever seed**, no longer the always-preferred port. The
  snap-back-to-derived behavior of infrastructure-018 is deliberately **dropped** in favor of
  stickiness; the two are opposite behaviors and stickiness was chosen for origin stability.

## Addendum — version-aware reuse (2026-09-05, infrastructure-rgknz)

> Refines the **"reuses a live server, replaces a stale one"** clause of the "Stop" section
> above: from "*stale* means only pid is dead" to "*stale* means a dead pid **or** a plugin
> version/root mismatch". Reverses no other clause — `127.0.0.1`-only binding, detached launch +
> runfile + explicit stop, walk-up discovery, in-root path validation, the `applyTaskMove` write
> seam, the deterministic port + sticky-last-good-port addenda all **still stand**. Not a new ADR
> number; it is part of this transport decision.

### Context

A field report ("I updated the plugin and the dashboard didn't update") traced to a real gap:
`launch.mjs`'s reuse decision only ever asked "is the pid alive?" The runfile
(`{ pid, port, startedAt }`) recorded **no plugin identity**. So after a marketplace update in a
consumer project:

- the dashboard process spawned from the **previous** version's cache dir stays alive;
- `/dashboard` resolves the **newest** cache dir by semver (infrastructure-010) but then reads the
  runfile, sees a live pid, and reports `already running` — the builder gets the old UI;
- if the marketplace also **removed** the previous version's cache dir on update, the old
  process's `assetRoot` — resolved once at its own startup, module-relative (ADR-0004,
  infrastructure-004) — points at a path that no longer exists, so every asset 404s while the
  runfile still claims a healthy runtime.

"Reuse vs. replace" was answering the wrong question: liveness, not **identity**. This addendum
makes identity the deciding signal, the dashboard-runtime analogue of infrastructure-v8r3q's
bridge capability handshake — the answering process reports what it *is*, and the caller decides
from that live signal rather than an on-disk assumption.

### Decision

The runfile gains the serving process's plugin identity:
`{ pid, port, startedAt, pluginVersion, pluginRoot }`. Both processes that write it — `serve.mjs`
(the long-running server) — compute their own identity from their own module location, the SAME
relationship `resolve-plugin-file.mjs` already relies on: `dashboard/` sits one level under the
plugin root in both layouts (the Agentheim repo, and an installed plugin's cached version dir).
`pluginRoot = path.resolve(__dirname, '..')`; `pluginVersion` is that root's
`.claude-plugin/plugin.json` `version` field, or `null` when the manifest can't be read (a
legitimate "unknown" state, never a crash). `dashboard/plugin-version.mjs` is the shared,
stdlib-only, injectable (no ambient globals — the caller always passes its own `__dirname`)
resolver both `serve.mjs` and `launch.mjs` (and `server.mjs`, for the read-API exposure below)
import.

`launch.mjs`'s reuse decision (`decideReuseOrReplace`, pure — no I/O, `rootExists` probed and
passed in by the caller so the decision is unit-testable without a live process) compares the live
runfile's recorded identity against the launcher's own (the newest semver-max cache dir the
`/dashboard` bootstrap resolved, per the infrastructure-010 addendum above):

- **Reuse** only when `pluginVersion` is equal **and** `pluginRoot` still exists on disk.
- **Replace** — stop the outgoing pid through the existing external kill path, launch fresh, report
  `replaced <old-version> → <new-version>` — on any of: a missing `pluginVersion`/`pluginRoot`
  (an older runfile written before this addendum: "unknown → replace", failing toward freshness),
  a `pluginRoot` that no longer exists (the previous version's cache dir was removed on update —
  this ALSO covers the dead-`assetRoot` failure mode above, independent of whether the version
  string happens to differ), or a `pluginVersion` mismatch.
- A **dead pid** is unaffected — `inspectExisting` still reaps it as "stale" before this
  comparison is ever reached; this addendum only changes what happens when the pid **is** alive.

`status` prints the serving `pluginVersion` next to pid/port, so skew is visible without attempting
a launch. `GET /healthz` exposes the same value as `version` — cheap (`server.mjs` already computes
its own identity the same way) — so the read API carries it too, for a future About-page display.

`static.mjs` also sends `Cache-Control: no-cache` on every asset and index response (previously no
cache headers at all): once a replace swaps the live process, a browser or VS Code Simple Browser
tab left open across the update must revalidate `app.js`/`index.html` against the new server
rather than replaying a cached bundle — a small, independent piece of the same "serve what's
actually on disk" property this addendum is about.

### Consequences

- A newer plugin on disk is served on the **next** `/dashboard` invocation with **no manual
  `stop`** — the exact self-heal the field report needed.
- The runfile format gains two fields; every reader tolerates their absence, so no migration step
  is required for a runfile written by a pre-addendum `serve.mjs`.
- **Verification realism (mirroring infrastructure-010's note):** Node resolves an ES module
  loaded through a symlink/junction to its **real path** for `import.meta.url` — confirmed
  empirically. The foreign-project seam's fake-cache-home harness (infrastructure-009/010) links a
  fake version dir's `dashboard/` to this repo's real `dashboard/`, so two such fake version dirs
  would collapse to the **same** real `plugin.json` and could never actually differ in a real
  simulated skew. The integration test for this addendum therefore forces the skew directly on the
  written runfile (same live pid, a manipulated `pluginVersion`) rather than juggling two symlinked
  fake versions — still exercised at the real foreign-project + env-independent-resolver + literal
  card-command seam, still asserting the runfile lands under the consumer project. A REAL installed
  plugin cache holds a full copy of `dashboard/` per version dir, not a symlink, so this collapse is
  a test-harness artifact only, not a production gap.
