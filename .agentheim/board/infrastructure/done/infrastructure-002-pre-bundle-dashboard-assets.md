---
id: infrastructure-002
title: Bundle the styleguide ESM source into the dashboard's committed static assets (esbuild → dist)
status: done
type: chore
context: infrastructure
created: 2026-06-05
completed: 2026-06-06
commit: e37dac9
depends_on: [infrastructure-001, design-system-001, design-system-002]
blocks: [agentic-workflow-001, agentic-workflow-006, agentic-workflow-007, agentic-workflow-008]
tags: [dashboard, build, bundling, esbuild, static-assets, frontend, runtime]
related_adrs: [ADR-0003]
related_research: []
prior_art: []
---

## Why

The dashboard (`agentic-workflow-001`), served by the infrastructure runtime (ADR-0002),
must ship its UI as **committed, pre-bundled static assets**: no network at view time,
React's *production* build, and **no in-browser Babel compile** on first paint. ADR-0002
fixed the serving contract — *"the UI's committed build output **is** the asset set,"* with
no runtime bundler — but left the build mechanism open.

The builder locked the architecture (ADR-0003): the **single source of truth** is the
styleguide migrated to ES modules (`design-system-002`), and the dashboard's asset set is
**built from that same source** so it cannot drift from the approved styleguide. This task
owns the infrastructure half: the **esbuild build pipeline** that turns the ESM styleguide
source into a committed `dist/`, which `infrastructure-001`'s static handler serves
directly. The ESM migration and the buildless canvas live in `design-system-002`, which
this task **depends on** — there is no source to bundle until it lands.

## What

Add an **esbuild** build pipeline that consumes the ES-module styleguide source (produced by
`design-system-002`) and emits a **committed `dist/`** asset set for the dashboard. The build
bundles React / ReactDOM / `marked` in (no runtime CDN fetch), transforms JSX at build time,
selects React's **production** build, and minifies. The committed `dist/` — not the build —
is what `infrastructure-001`'s static handler serves; **running the dashboard requires no
install step.**

esbuild is a **build-time** dependency only: it is used to regenerate `dist/` when the
source changes and is never installed or invoked to *run* the dashboard.

## Acceptance criteria

- [ ] An esbuild build config exists that takes the ES-module styleguide source
      (`styleguide/app/*` per `design-system-002`) as entry and emits a committed `dist/`.
- [ ] The build bundles **React / ReactDOM / `marked` in** — the committed `dist/` loads and
      renders with **no network access** at view time (no CDN fetch of the framework).
- [ ] JSX is transformed **at build time**; the committed output contains **no
      `<script type="text/babel">` and no `@babel/standalone`**.
- [ ] React's **production** build is bundled (not `react.development.js`).
- [ ] The build is **minified** and emits the asset set `infrastructure-001`'s static
      handler serves from the plugin-relative asset root.
- [ ] **No install step to run:** the committed `dist/` is served directly; starting the
      dashboard invokes no bundler and installs nothing. esbuild appears only in the
      build-time tooling, never in the run path.
- [ ] The bundled dashboard is **visually identical** to the approved (migrated) styleguide
      — same tokens (`styleguide/styles/*.css`) and component patterns; the styleguide
      source remains the single source of truth.
- [ ] First paint is materially faster than the in-browser-Babel canvas (no compile on load).
- [ ] The build is **reproducible and documented**: a single command regenerates `dist/`
      from source, so the committed output can be rebuilt and re-committed when the source
      changes (build discipline noted, not a runtime requirement).

## Notes

- **Bundler choice — esbuild (ADR-0003, locked architecture; esbuild chosen here).** For a
  single page, ~1,800 lines, three runtime deps, no dev-server / HMR need, with a committed
  `dist/` deliverable, esbuild is the smallest legible build-time tool that does
  JSX-transform + bundle + minify in one step. Vite (Rollup-plus-dev-server) and bare Rollup
  are heavier for no benefit here. See ADR-0003 for the full justification and the rejected
  alternatives.
- **Single source of truth.** This task does **not** own or copy the styleguide source. It
  bundles `design-system-002`'s ES-module source; the dashboard asset set is a *derived*
  artifact, never a hand-maintained copy. That is the invariant ADR-0003 protects.
- **Relationship to the dashboard (`agentic-workflow-001`).** This is the production asset
  pipeline for that feature and **blocks** it (builder decision, 2026-06-05): the dashboard
  ships pre-bundled from day one — the in-browser-Babel canvas is not an acceptable v1. The
  edge is recorded both ways (`blocks: [agentic-workflow-001]` here; `infrastructure-002` in
  the dashboard's `depends_on`).
- **Split from the ESM migration (ADR-0003).** Migrating the styleguide source to ESM and
  keeping the canvas buildless + re-approved is a **design-system** concern (`design-system-002`):
  it changes design-system's owned, gated artifact and must re-pass the styleguide gate. This
  task narrows to "bundle the ESM source → committed dist," an **infrastructure** concern. Routing
  test: if infrastructure didn't exist, the ESM migration would still be a coherent design-system
  improvement → it lives there; the build pipeline serving the runtime is what lives here.
- **Depends on:** `infrastructure-001` (fixes where assets live and how they're served —
  ADR-0002), `design-system-001` (the original tokens/components — done), and
  **`design-system-002`** (the ES-module source this bundles — must land first).
- Surfaced as the reconciliation note while delivering `design-system-001`; the build
  mechanism and the single-source split are now settled in ADR-0003.

## Outcome

Added the **esbuild build pipeline** that bundles the design-system ES-module styleguide
source into a **committed `dashboard/dist/`**, replacing the static handler's "assets not
built" fallback with the real dashboard UI served offline.

**Build tooling (build-time only, per ADR-0003):**
- `dashboard/package.json` — esbuild + react + react-dom + marked + htm as **devDependencies**
  (versions pinned to the canvas import map: react/react-dom `18.3.1`, marked `12.0.2`,
  htm `3.1.1`). `npm run build` → `node build.mjs`.
- `dashboard/build.mjs` — esbuild bundle of `styleguide/app/app.js` (read-only single source
  of truth). Bundles React **production** / ReactDOM / marked / htm IN; `bundle:true`,
  `minify:true`, `format:'esm'`, `--define:process.env.NODE_ENV='"production"'`. Uses
  `nodePaths: [dashboard/node_modules]` so esbuild resolves the bare specifiers even though the
  source lives outside `dashboard/`. Copies the two token CSS files verbatim into `dist/` and
  emits an `index.html` shell (`#root`, local CSS links, `<script type="module" src="./app.js">`
  — **no import map, no CDN, no Babel**).
- `dashboard/node_modules/` added to `.gitignore`; `.agentheim/.dashboard/` ignore intact.

**Committed artifacts:** `dashboard/dist/` (`index.html`, `app.js` ~241 KB minified,
`colors_and_type.css`, `agentheim.css`), `dashboard/build.mjs`, `dashboard/package.json`,
`dashboard/package-lock.json`.

**Rebuild command (one command regenerates dist/):**
`cd dashboard && npm install && npm run build`

**Tests:** added `dashboard/test/dist-build.test.mjs` (7 tests — runs the build, asserts the
artifact set exists, no `esm.sh`/`unpkg`/`importmap`/`@babel/standalone`/`text/babel`/
`react.development` strings, `process.env.NODE_ENV` fully inlined = production, index.html loads
local bundle + local CSS with no remote `<script>`, and dist CSS is a verbatim copy of source).
Full `dashboard/` suite: **43 pass / 0 fail** (36 pre-existing aw-004 + infra-003 tests still
green — no regression).

**Render verified:** stopped the stale pre-dist server, relaunched `node dashboard/launch.mjs`
(port from `runtime.json`), then `curl`:
- `GET /` → **200**, served the dashboard `index.html` (has `id="root"`, loads `./app.js`, no
  import map, no remote `<script src="https:...">`) — NOT the "assets not built" 404.
- `GET /app.js` → **200**; grep of served JS confirms **0** occurrences of
  esm.sh / unpkg / @babel/standalone / react.development / text/babel; `createRoot` bundled in.
- `GET /colors_and_type.css` → **200**.
- Stopped cleanly via `node dashboard/launch.mjs stop` (runfile removed, no orphan).

**Known residual:** the styleguide token CSS `@import`s Google Fonts (Inter Tight / JetBrains
Mono) from `fonts.googleapis.com` — inherited unchanged from the source-of-truth CSS (not edited
here). The **framework** is fully local/offline; only the webfonts remain CDN. Localizing the
fonts would edit the design-system source (out of scope for this infrastructure task).

No new ADR: ADR-0003 already records this architecture; ADR-0002 the serving contract. No server
file was modified.
