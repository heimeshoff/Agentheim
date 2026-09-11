---
id: design-system-002
title: Migrate the styleguide to ES modules (buildless import-map canvas, single source) + re-approval
status: done
type: chore
context: design-system
created: 2026-06-05
completed: 2026-06-06
commit: 58fafcf
depends_on: [design-system-001]
blocks: [infrastructure-002, agentic-workflow-006, agentic-workflow-007, agentic-workflow-008]
tags: [styleguide, design-system, esm, frontend, refactor, build]
related_adrs: [ADR-0003, ADR-0005]
related_research: []
prior_art: []
---

## Why

The approved styleguide (`design-system-001`, done) is **11 global-script JSX files**
(~1,800 lines under `styleguide/app/`) loaded via `<script type="text/babel">`, compiling
JSX **in-browser** with `@babel/standalone` and pulling React / ReactDOM / `marked` from
the unpkg CDN. The files share state through implicit globals — top-level `const`/`function`
symbols (`TICKETS`, `LIBRARY`, `Icon`, `Markdown`, `ThemeCtx`, `describeItem`, …) referenced
across files by bare name, plus a few `window.X = …` / `Object.assign(window, {…})` exports.

The dashboard (`agentic-workflow-001`) must ship this UI as committed, pre-bundled, offline,
production-build static assets (`infrastructure-002`). The builder locked the architecture
(ADR-0003): there is **one source of truth** — the styleguide itself, migrated to ES modules
— and **two consumers** built from it: a **buildless reviewable canvas** (native
`<script type="module">` + import map, no Babel) and the **esbuild-bundled dashboard dist**.

This task owns the design-system half: the **ESM migration of the source** and the
**buildless canvas**, re-passed through the **styleguide gate**. It is the change that, by
the routing test, would still be a coherent design-system improvement even if the dashboard
never existed — so it lives here, not in infrastructure. It **blocks** `infrastructure-002`,
which bundles the ESM source it produces.

## What

Refactor the styleguide's 11 `app/*.jsx` files from global scripts into **ES modules** with
explicit `import` / `export`, so there is a single, importable source of truth. Re-wire the
canvas (`styleguide/index.html`) to load that source **buildlessly** — native
`<script type="module">` + an **import map** for the bare specifiers — with **no
`@babel/standalone` at runtime** and **no toolchain required to open the canvas**. Then
re-pass the **styleguide gate**: builder review and explicit re-approval, because this
reopens the approved `design-system-001` artifact.

The visual result must be **byte-for-byte faithful** to the approved styleguide — same
tokens (`styleguide/styles/*.css`, unchanged), same component patterns, same live
kanban→drawer demo. This is a structural refactor of *how the source loads and composes*,
not a redesign.

## Acceptance criteria

- [x] All 11 `styleguide/app/*.jsx` files are ES modules: every cross-file symbol is an
      explicit named `export` and every use is an explicit `import`. No bare-name
      cross-file references remain. (Files renamed `*.jsx` → `*.js`; htm view-factory module
      `app/html.js` added.)
- [x] All `window.X = …` and `Object.assign(window, {…})` exports are removed; no module
      communicates through globals.
- [x] `React` / `ReactDOM` are imported (not read off the global from a UMD `<script>`);
      `const { useState, useEffect } = React`-style global destructuring is replaced with
      real imports (`import { useState, useEffect } from "react"`). `window.marked` is
      replaced with `import { marked } from "marked"`.
- [x] The canvas (`styleguide/index.html`) loads the source via native
      `<script type="module">` + an **import map** resolving the bare specifiers
      (`react`, `react-dom/client`, `marked`, `htm`). **No `<script type="text/babel">` and
      no `@babel/standalone`** remain anywhere in the canvas.
- [x] No toolchain is required to **open** the canvas — opening `index.html` renders the
      styleguide directly. JSX is **not** retained in any browser-loaded module: views are
      authored with **htm tagged templates** (`app/html.js` = `htm.bind(React.createElement)`),
      parsed at runtime with no Babel. See ADR-0005.
- [x] The rendered canvas is faithful to the approved styleguide: same tokens
      (`styles/*.css` unchanged), same components, same sections 05–10, same live
      kanban→drawer demo. **Render-verified** server-side (see Outcome); the human
      *visual* sign-off is criterion 8 below.
- [x] The ES-module source is **importable by a bundler** with no global-script assumptions
      (plain `import`/`export`, htm as a runtime function call — no JSX, no globals). This is
      what `infrastructure-002` consumes — the single source of truth.
- [x] The migrated styleguide is **re-reviewed and explicitly re-approved by the builder**
      through the styleguide gate. **Re-approved by the builder 2026-06-06** ("looks good,
      everything works") — the gate is OPEN against the migrated ESM source.

## Notes

- **Locked decisions (ADR-0003, do not relitigate):** single source = the styleguide
  migrated to ESM; canvas stays buildless (native module + import map, no Babel); the
  dashboard bundle (esbuild) is produced from this same source by `infrastructure-002`.
- **This reopens an approved artifact by design.** The builder explicitly accepted that
  migrating the source reopens `design-system-001`; re-approval is part of *this* task's
  acceptance, not a side effect.
- **Tokens are untouched.** `styles/colors_and_type.css` and `styles/agentheim.css` stay
  the source of truth and do not change; this is a JS/module-structure refactor only.
- **Coupling map for the migration** (from the current source): `data.jsx` exports the
  sample data (`TICKETS`, `LIBRARY`, `CONTENT_TYPES`, `STATUSES`, `COLUMN_ORDER`, the
  `MD_*` strings); `icons.jsx` → `Icon`/`LUCIDE`; `primitives.jsx` → badges/chips +
  `Markdown` (uses `marked`); `foundations*.jsx` → `ThemeCtx`, doc primitives, token
  sections; `kanban.jsx`, `drawer.jsx` (`describeItem`, `Drawer`, header variants),
  `empty.jsx`, `library.jsx`, `live.jsx` → component patterns; `app.jsx` → the root `App`
  (currently `window.App = App`) and the `ReactDOM.createRoot(...).render(<App/>)` bootstrap
  in `index.html`. Each becomes explicit exports/imports.
- **Split rationale (ADR-0003):** the migration + buildless canvas + re-approval are
  design-system concerns (the source and the gate are this BC's). The esbuild bundling and
  committed `dist/` are infrastructure's — tracked as `infrastructure-002`, which depends
  on this task.
- **Depends on:** `design-system-001` (the artifact being migrated — done, approved
  2026-06-05). **Blocks:** `infrastructure-002` (it bundles this ESM source).

## Outcome

The styleguide is now a **single ES-module source of truth** feeding two consumers
(ADR-0003). The 11 global-script JSX files were refactored into native ES modules with
explicit `import`/`export` and **no globals, no in-browser Babel**. Views are authored
with **htm tagged templates** instead of JSX, so the modules run buildlessly in the
browser *and* are consumed unchanged by infrastructure-002's esbuild bundle — JSX is
never shipped. This concrete htm + import-map choice (left open by ADR-0003) is recorded
in **ADR-0005**.

**What changed (`styleguide/app/`):**
- New: `html.js` — the `htm.bind(React.createElement)` view factory every module imports.
- `data.jsx` → `data.js`: removed the `Object.assign(window, …)`; each datum is now a
  named `export`.
- `icons.js`, `primitives.js`, `empty.js`, `kanban.js`, `drawer.js`, `library.js`,
  `foundations.js`, `foundations2.js`, `live.js`, `app.js`: converted JSX → htm templates;
  hooks/`marked`/`createContext`/`createRoot` are real imports; cross-file symbols are
  explicit imports. `app.js` exports `App` and carries the `document`-guarded
  `createRoot(#root).render(…)` bootstrap (the shared entry for both consumers).
- `index.html`: replaced the four UMD/Babel `<script>` tags + 12 `text/babel` script tags
  with a single `<script type="importmap">` (react, react-dom/client, marked, htm → pinned
  esm.sh URLs) and `<script type="module" src="app/app.js">`.
- Tokens (`styles/colors_and_type.css`, `styles/agentheim.css`) — **untouched**, as required.

**Coupling preserved** exactly per ADR-0003's map: data → registries/markdown; icons →
`Icon`/`LUCIDE`; primitives → badges/chips/`Markdown`; foundations → `ThemeCtx`/doc
primitives/`ColorSection`; kanban/drawer/empty/library/live → component patterns; app →
root `App` + bootstrap.

**Verification (no human required, criteria 1–7):**
- `node --check` passes on all 12 modules.
- Full-tree **server-side render** of `App` via `react-dom/server` against the real
  `app/*.js` modules: 194 KB of HTML, **no thrown errors**; asserted presence of the hero,
  all sections 01–10, kanban tickets (`AGH-128`), status chips, the library tree
  (Decisions group), and the `marked`-rendered ADR — including rendered `<table>`,
  `<pre><code>`, and `<blockquote>` in the `.prose` surface. This proves htm templates
  parse, every cross-module import resolves, `marked` works via its ESM import, and the
  component tree mounts.
- Migration bug caught and fixed during verification: htm does **not** support bare
  `<>…</>` fragments (throws "Invalid tag") — the one fragment in `drawer.js`
  (`HeaderContextual`) now uses `html\`<${Fragment}>…<//>\``. (This htm-vs-JSX gotcha,
  invisible to `node --check`, is documented in ADR-0005.)

**Criterion 8 — DONE (builder re-approved 2026-06-06).** The ESM migration reopened the
approved `design-system-001` artifact by design; the builder reviewed the migrated canvas
(`styleguide/index.html` — sections 05–10 + the live kanban→drawer demo) and re-approved
it ("looks good, everything works"). **The styleguide gate is OPEN against the migrated ESM
source.** Frontend tasks (aw-006/007/008) may now promote, each still subject to its own
other dependencies.

**Unblocks** `infrastructure-002` (esbuild bundle of `app/app.js` → committed `dist/`),
which can proceed in parallel with the builder's visual re-approval since it consumes the
same source.

Iteration 2: corrected ADR-0004→ADR-0005 citations in index.html and html.js.

## Verifier note (iteration 1)

**VERDICT: FAIL** (likely-fixable). Criteria 1–7 otherwise verified PASS (ESM migration,
no window globals, React/ReactDOM/marked imported, buildless import-map canvas, no
@babel/standalone, tokens unchanged, bundler-importable). Criterion 8 (builder visual
re-approval) correctly left as a human gate — not judged.

**REASONS:**
- `styleguide/index.html:18` — the buildless-canvas comment cites the governing decision as
  "ADR-0003 / ADR-0004". **ADR-0004 is agentic-workflow's "Detached dashboard server cwd"
  decision — unrelated to the styleguide.** The htm + import-map view-factory decision is
  recorded in **ADR-0005** (this task's own new ADR). A builder opening the canvas (the
  criterion-8 gate action) is pointed at the wrong, unrelated ADR.
- `styleguide/app/html.js:15` — same mis-citation: the authoring-note comment says
  "See ADR-0004." It should reference **ADR-0005**, which records "views are authored with
  htm tagged templates, not JSX". (The "ADR-0004"/"ADR-0005" strings inside
  `styleguide/app/data.js` are sample/demo markdown content, not real cross-references —
  correctly out of scope, do not touch.)

**SUGGESTED_FIX:** In `styleguide/index.html` (buildless-canvas comment) and
`styleguide/app/html.js` (authoring note), change the ADR pointer from **ADR-0004 → ADR-0005**
so the in-canvas documentation points reviewers at the actual htm/import-map decision record.
No code or render change needed.

**ITERATION_HINT:** likely-fixable
