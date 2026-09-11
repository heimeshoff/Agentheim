---
id: agentic-workflow-056
title: Left rail — Research group sits above Decisions
status: done
type: bug
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
commit: 3b0a749
depends_on: [design-system-001]
blocks: []
tags: [dashboard, rail, library, ordering]
related_adrs: [0011]
prior_art: [agentic-workflow-008]
related_research: []
---

## Why
In the left rail's library tree the knowledge groups currently render
`Product → Bounded contexts → Decisions → Research`. The builder wants
**Research before Decisions**, so the rail reads
`Product → Bounded contexts → Research → Decisions`.

## What
Swap the order of the **Decisions** and **Research** groups in the rail's
library navigation so Research comes first. The grouping is produced by the
pure transform `treeToLibrary` in `dashboard/app/library-data.js`, where the
display order is the `GROUP_ORDER` constant (`library-data.js:23`):

```
const GROUP_ORDER = ['Product', 'Bounded contexts', 'Decisions', 'Research'];
```

becomes

```
const GROUP_ORDER = ['Product', 'Bounded contexts', 'Research', 'Decisions'];
```

This is a presentation-only ordering change in the consumer's data transform —
the styleguide `TreeGroup`/`TreeItem` primitives stay consumed unforked
(ADR-0003), and the dashboard stays read-only over `.agentheim/` (ADR-0017).
Update the adjacent comment (`library-data.js:22`, "Product → Bounded
contexts → Decisions → Research") to match the new order so it doesn't lie.

## Acceptance criteria
- [ ] In the live rail, the **Research** group renders above the **Decisions** group.
- [ ] `Product` and `Bounded contexts` keep their positions (still first and second).
- [ ] Items *within* each group are unchanged (same ADRs under Decisions, same reports under Research).
- [ ] Empty-group omission still holds — a group with zero items renders no heading.
- [ ] `dashboard/dist/app.js` is rebuilt (esbuild) so the deployed app carries the change.
- [ ] The `library-data.js` ordering comment matches the new order.

## Notes
- Scope is the **live dashboard rail** only. The styleguide demo's own
  `LIBRARY` fixture (`data.js`) is a separate review surface — leave it unless
  the worker wants the demo to mirror the live order for consistency; not required by this ticket.
- `treeToLibrary` is unit-tested under `node --test`; if a test asserts the
  group order, update it to expect Research-before-Decisions.
- Styleguide gate (`design-system-001`) is already in `done/`, so the
  frontend dependency is met.

## Outcome
Swapped the **Research** and **Decisions** entries in the `GROUP_ORDER`
constant in `dashboard/app/library-data.js` so the left-rail library tree now
renders `Product → Bounded contexts → Research → Decisions`. The adjacent
comment was updated to match. Empty-group omission and within-group item
ordering are untouched (driven by the same `GROUP_ORDER`-filter pipeline).
The order unit test in `dashboard/test/library-data.test.mjs` was updated to
expect Research-before-Decisions, and `dashboard/dist/app.js` was rebuilt via
`npm run build` (esbuild) so the deployed app carries the change. Full suite
green (474 tests). Presentation-only; no ADR, no README change.

Key files:
- `dashboard/app/library-data.js` — `GROUP_ORDER` + comment
- `dashboard/test/library-data.test.mjs` — order assertion
- `dashboard/dist/app.js` — rebuilt bundle
