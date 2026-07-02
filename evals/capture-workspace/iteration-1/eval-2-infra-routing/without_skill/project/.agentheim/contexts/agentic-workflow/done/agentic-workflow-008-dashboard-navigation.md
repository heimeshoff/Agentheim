---
id: agentic-workflow-008
title: Dashboard navigation — discover and browse all .agentheim artifacts (library/nav)
status: done
type: feature
context: agentic-workflow
created: 2026-06-06
completed: 2026-06-06
commit: 78c25e6
depends_on: [agentic-workflow-005, design-system-002, infrastructure-002]
blocks: [agentic-workflow-001]
tags: [dashboard, ui, frontend, navigation, discovery]
related_adrs: [0009, 0010, 0011]
related_research: []
prior_art: []
---

## Why

The board covers tasks, but the rest of the knowledge base — vision, context map, BC READMEs,
research, ADRs — also needs to be discoverable, or the dashboard only solves half the
"stop opening files by hand" problem. Navigation makes every artifact browsable and routes each
into the slide-over.

## What

The discovery / navigation surface (reuse the approved library / doc-row and app-rail patterns
from the styleguide) that makes vision, context-map, BC READMEs, research, and ADRs browsable and
opens each in the slide-over (aw-007). Includes the toggle between the board view (aw-006) and the
library/discovery view, driven off the `/api/tree` artifact locations.

## Acceptance criteria

- [ ] All non-task artifacts (vision, context-map, every BC README, research reports, ADRs) are
      discoverable from the navigation, grouped legibly.
- [ ] Selecting any artifact opens it rendered in the slide-over (aw-007).
- [ ] Navigation switches between the board view (aw-006) and the library/discovery view.
- [ ] Conforms to the approved styleguide nav/library patterns, loaded from the committed dist.

## Notes

- Depends on design-system-002 (styleguide source for the nav/library patterns) and
  infrastructure-002 (bundle); consumes the artifact-location half of `/api/tree` (aw-005).
- Decision recorded in ADR-0011 (library = non-task half of the tree projection, grouped
  client-side; tasks excluded; items shaped as the slide-over open-intent).

## Outcome

The dashboard now has its discovery/navigation surface alongside the board, both inside the
existing app shell, with a board↔library toggle.

- **`dashboard/app/library-data.js`** (new) — pure, framework-free transform `treeToLibrary(tree)`
  pooling the `/api/tree` artifact-location half (vision, context map, every BC README, ADRs,
  research) into fixed legible groups (Product / Bounded contexts / Decisions / Research), each
  item shaped as the slide-over open-intent `{ id, type, title, path }`. Tasks excluded by
  construction. `libraryCount` totals the rail badge. Unit-tested (`test/library-data.test.mjs`,
  10 tests).
- **`dashboard/app/library.js`** (new) — the React library view: fetches `/api/tree`, transforms,
  and renders through the approved styleguide `TreeGroup`/`TreeItem` (imported as-is, ADR-0003).
  Selecting any row emits the open-intent the existing universal slide-over (aw-007) consumes —
  the SAME mechanism the board uses. Loading / error / empty states mirror the board's.
- **`dashboard/app/board.js`** (modified) — the `DashboardApp` shell now holds a `view` state and a
  board↔library toggle built from the styleguide `RailItem`, mounting either surface; both emit
  into the one slide-over. `build.mjs` was NOT touched — the existing entry imports the new modules
  transitively.
- `dashboard/dist/` rebuilt and re-committed (`npm install && npm run build`). Full suite green:
  **82 tests pass**, including the fresh-build dist assertions.

Acceptance criteria 1–4 met: non-task artifacts discoverable and grouped (1), each opens in the
slide-over via the shared open-intent (2), board↔library toggle in the shell (3), all through the
approved styleguide patterns loaded from the committed dist (4).

Follow-up surfaced (not yet a task): per-BC `index`/`concepts[]` locations are projected by the tree
but not yet surfaced in the library — a candidate enhancement if it earns its place (noted in ADR-0011).
