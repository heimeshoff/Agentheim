# Design System — Index

Catalog of everything in this bounded context: tasks by status, ADRs scoped to this BC,
research touching this BC, and concept synthesis pages.

> Updated by: `modeling` (tasks), `work` (BC-scoped ADRs, concept page links), `research` (BC-scoped reports).

---

## Tasks by status

<!-- task-counts:start -->
- **Backlog:** 1
- **Todo:** 0
- **Doing:** 0
- **Done:** 3
<!-- task-counts:end -->

### Todo
<!-- todo-list:start -->
<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
<!-- doing-list:end -->

### Done (most recent first; older entries kept for prior-art search)
<!-- done-list:start -->
- **design-system-003** — Vendor the dashboard's webfonts offline (local @font-face, drop the Google Fonts CDN @import) (chore) — `done/design-system-003-offline-webfonts.md`
- **design-system-002** — Migrate the styleguide to ES modules (buildless htm + import-map canvas, single source) — _re-approved 2026-06-06; gate OPEN_ — `done/design-system-002-styleguide-esm-migration.md`
- **design-system-001** — Dashboard styleguide (visual language for Agentheim's UI) — _approved 2026-06-05_ — `done/design-system-001-styleguide.md`
<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
- **design-system-004** — Dashboard dark-mode toggle (feature) — `backlog/design-system-004-dark-mode-toggle.md`
<!-- backlog-list:end -->

## ADRs scoped to this BC

<!-- adr-local:start -->
- **ADR-0003** — Styleguide as ES-module single source — buildless canvas, esbuild-bundled dashboard (proposed) — `../../knowledge/decisions/0003-styleguide-esm-single-source.md`
- **ADR-0005** — Styleguide views authored with htm tagged templates (buildless, no JSX runtime compile) (accepted) — `../../knowledge/decisions/0005-styleguide-htm-buildless-viewfactory.md`
- **ADR-0008** — Vendored webfonts — latin-subset woff2, `fonts/` beside the token CSS (accepted) — `../../knowledge/decisions/0008-vendored-webfonts-latin-subset.md`
<!-- adr-local:end -->

## Research touching this BC

<!-- research-local:start -->
<!-- research-local:end -->

## Concepts (opt-in synthesis pages)

<!-- concepts:start -->
<!-- concepts:end -->

## Pointers

- Styleguide artifact: `styleguide/index.html` (+ `styleguide/styles/`, `styleguide/app/`)
- BC README (purpose, styleguide gate): `README.md`
