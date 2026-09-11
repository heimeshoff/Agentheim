---
id: agentic-workflow-066
title: Left rail — Research group opens by default, Decisions collapses by default
status: done
type: feature
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
commit: 5d58b6f
depends_on: [design-system-001]
blocks: []
tags: [dashboard, rail, library, tree-group, default-state]
related_adrs: [0011]
related_research: []
prior_art: [agentic-workflow-056]
---

## Why
The left-rail Workspace tree currently opens with **Decisions expanded** and
**Research collapsed**. The builder reads research more often than ADRs day-to-day,
so the defaults are backwards: Research should be open on load and Decisions tucked
away. (aw-056 already moved Research *above* Decisions in the rail order; this finishes
the job by flipping which of the two starts open.)

## What
Flip the per-group `defaultOpen` for the two named rail `TreeGroup`s:

- **Research** → expanded by default
- **Decisions** → collapsed by default

Product and Bounded contexts are unaffected (stay expanded). This is the
default/initial open state only — the user can still toggle either group open or
closed at runtime; `TreeGroup` owns its own open state after mount.

The change is a single expression in the rail render. Today
`dashboard/app/board.js` (~line 1260) renders each group with:

```js
defaultOpen=${g.group !== "Research"}
```

which collapses Research and expands everything else (incl. Decisions). The flip is:

```js
defaultOpen=${g.group !== "Decisions"}
```

so Decisions becomes the single collapsed group and Research (plus Product /
Bounded contexts) opens. The `treeToLibrary` data transform
(`dashboard/app/library-data.js`) is unchanged — it carries order and items, not
open state.

## Acceptance criteria
- [ ] On a fresh dashboard load, the rail's **Research** group is expanded.
- [ ] On a fresh dashboard load, the rail's **Decisions** group is collapsed.
- [ ] **Product** and **Bounded contexts** remain expanded by default (unchanged).
- [ ] Both groups can still be toggled open/closed by the user after load (runtime
      open state unchanged — `TreeGroup` keeps owning it).
- [ ] `dashboard/dist/app.js` is rebuilt (esbuild) so the deployed app carries the change.
- [ ] Styleguide consumed unforked (ADR-0003) — no `TreeGroup` edit, no design-system child task.

## Notes
- Single seam: the `defaultOpen=${...}` expression in `board.js`'s rail render
  (the `groups.map((g) => ...<${TreeGroup} ... defaultOpen=... />)` block).
- Frontend task → styleguide gate satisfied (design-system-001 approved/done).
- Read-only dashboard (ADR-0017) — this is presentation default state, no disk write.
- Prior art: **aw-056** (Research group sits above Decisions in the rail) touched the
  same `GROUP_ORDER` / rail render; read it for the ordering context before editing.
- The aw-056 commit comment line is the same code region, so confirm the current
  expression before swapping (it may have a guard for empty groups via the
  `treeToLibrary` `.filter` — open state is independent of that).

## Outcome
Flipped the single rail `defaultOpen` expression in the `groups.map((g) => ... <TreeGroup ... defaultOpen=... />)` block in `dashboard/app/board.js` from `g.group !== "Research"` to `g.group !== "Decisions"`. On fresh load the rail now opens Research (plus Product and Bounded contexts) and collapses only Decisions; `TreeGroup` keeps owning runtime open state, so the user can still toggle either group. `treeToLibrary`/`GROUP_ORDER` untouched (ADR-0011); `TreeGroup` consumed unforked (ADR-0003); presentation-only, no disk write (ADR-0017).

Added `dashboard/test/rail-default-open.test.mjs` — a source-guard (the board's render idiom) that extracts the rail `defaultOpen` expression and asserts the per-group default: Research/Product/Bounded contexts true, Decisions false. Rebuilt `dashboard/dist/` via `node build.mjs`; full `node --test` suite green (533 tests).

Key files:
- `dashboard/app/board.js` (rail render `defaultOpen` expression)
- `dashboard/test/rail-default-open.test.mjs` (new default-state guard)
- `dashboard/dist/app.js` + `dashboard/dist/index.html` (rebuilt bundle)
