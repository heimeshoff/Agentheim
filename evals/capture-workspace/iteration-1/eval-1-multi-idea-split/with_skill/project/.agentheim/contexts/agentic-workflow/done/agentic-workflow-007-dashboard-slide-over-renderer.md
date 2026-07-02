---
id: agentic-workflow-007
title: Dashboard slide-over — universal detail panel + client-side markdown renderer over /api/doc
status: done
type: feature
context: agentic-workflow
created: 2026-06-06
completed: 2026-06-06
commit: ffda30f
depends_on: [agentic-workflow-005, design-system-002, infrastructure-002]
blocks: [agentic-workflow-001]
tags: [dashboard, ui, frontend, drawer, slide-over, markdown]
related_adrs: [0010-slide-over-doc-shaped-item]
related_research: []
prior_art: []
---

## Why

Every artifact in `.agentheim/` — tasks, BC READMEs, the vision, the context map, research
reports, ADRs — should be readable in place without opening files by hand. One universal detail
view serves them all: the Notion-style right-hand slide-over from the approved styleguide.

## What

The right-hand slide-over (reuse the approved `Drawer` pattern) as the universal detail view for
*any* artifact. On open, fetch `/api/doc?path=` and render the markdown client-side (bundled
renderer, e.g. `marked`). Driven by the open-intent emitted from the board (aw-006) and from
navigation (aw-008). The same panel handles a task and a non-task artifact identically — the only
difference is which path it fetches.

## Acceptance criteria

- [x] Clicking any task card or doc opens the slide-over animating in from the right; Esc and
      scrim-click close it (matches the approved drawer behavior).
- [x] The panel fetches `/api/doc` and renders the artifact's markdown client-side; no
      server-side rendering.
- [x] Works uniformly for tasks and every non-task artifact (BC README, vision, context-map,
      research, ADR).
- [x] Conforms to the approved styleguide drawer pattern, loaded from the committed dist.

## Notes

- Depends on design-system-002 (the ESM `Drawer` / markdown source) and infrastructure-002 (the
  bundle) — but not on any board-specific pattern; the drawer is independent of the board layout.
- Decision recorded: ADR-0010 (the slide-over feeds the styleguide `Drawer` a *doc-shaped* item
  so the real in-root path shows and tasks + non-task artifacts render through one path).

## Outcome

Built the universal right-hand detail slide-over and wired it to the board's existing
open-intent seam (aw-006). Clicking any card now opens the approved styleguide `Drawer`
(imported from the committed dist, never forked — ADR-0003), which fetches
`GET /api/doc?path=` and renders the artifact's markdown **client-side** via the styleguide
`Markdown`/`marked`. Tasks and non-task artifacts (BC README, vision, context-map, research,
ADR) render through one identical path — only the fetched `path` differs. Esc and scrim-click
close it; the panel slides over the whole viewport via a fixed positioned overlay.

Design split for testability + ADR-0003 compliance:
- `dashboard/app/slide-over-data.js` — pure, framework-free mapping (`intentToDrawerItem`,
  `docUrl`); the doc-shaped-item decision lives here (ADR-0010). Unit-tested under `node --test`.
- `dashboard/app/slide-over.js` — thin React wrapper that owns fetch lifecycle and renders the
  imported `Drawer`.
- `dashboard/app/board.js` — `DashboardApp` shell now holds `openIntent` state and mounts
  `<SlideOver>` over the board's `onOpen`/`onClose`.

Verification: 7 new pure unit tests (slide-over-data) + full suite green (72 tests, includes a
fresh esbuild build via dist-build.test). Rebuilt and re-committed `dashboard/dist/` so the
bundle ships the slide-over. End-to-end smoke (server boot): served bundle contains the
`/api/doc` slide-over call, `/api/tree` yields a real task path, `/api/doc` returns that task's
markdown as `text/markdown`, and the path guard still rejects escapes (403). No DOM render
test infra exists (consistent with aw-006); the React wrapper is intentionally thin and its
load-bearing logic is the pure module that is fully unit-tested.

Key files: `dashboard/app/slide-over.js`, `dashboard/app/slide-over-data.js`,
`dashboard/app/board.js`, `dashboard/test/slide-over-data.test.mjs`,
`.agentheim/knowledge/decisions/0010-slide-over-doc-shaped-item.md`, rebuilt `dashboard/dist/`.
