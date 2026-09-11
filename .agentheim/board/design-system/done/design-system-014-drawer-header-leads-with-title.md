---
id: design-system-014
title: Drawer contextual header leads with the item title, path demoted to a sub-line
status: done
type: feature
context: design-system
created: 2026-06-16
completed: 2026-06-16
commit: 2a07ec9
depends_on: [design-system-001]
blocks: [agentic-workflow-047]
tags: [styleguide, drawer, slide-over, typography, ui]
related_adrs: [0003]
related_research: []
prior_art: [design-system-009]
---

## Why
The slide-over / item-details header (the styleguide `Drawer`) leads with the
file **path**, not the item's **title**. `HeaderContextual` (`drawer.js:67-93`)
renders a `TypePill` and, below it, `info.path` in small (11.5px) quiet
(`--fg-3`) monospace — there is no title line at all. The first thing the eye
lands on should name the item; the path is plumbing and belongs in a quieter
position. This is the styleguide capability behind the dashboard request in
**agentic-workflow-047**.

## What
Give the `Drawer`'s contextual header a prominent **title heading**, with the
path demoted to a quiet sub-line beneath it.

1. **Carry a title on the item shape.** In `describeItem` (`drawer.js:31-47`),
   the `doc` branch (and the `ticket` branch, for the styleguide demo) should
   carry `title` from `item.title`.
2. **Render the title in `HeaderContextual`.** Add a title line — UI font
   (`var(--font-ui)`), **larger** than the 11.5px path (≈15–16px), **stronger
   contrast** (`var(--fg-1)`), medium/semibold weight — as the lead element of
   the header, with the existing `info.path` line demoted to a quiet sub-line
   under it (keep its current mono / `--fg-3` treatment).
3. **Graceful fallback.** If an item carries no `title`, the header must still
   render sensibly (fall back to the path as today) so the styleguide canvas and
   any title-less consumer don't break.

`HeaderMinimal` is out of scope unless trivial — the dashboard slide-over uses
`headerVariant="contextual"`. If touched, keep it consistent.

## Acceptance criteria
- [ ] `describeItem` carries `title` (from `item.title`) on the doc branch (and the ticket branch).
- [ ] `HeaderContextual` renders the title as the lead element: UI font, larger than 11.5px, `var(--fg-1)`, heavier weight than the path line.
- [ ] The path still appears, demoted to a quiet sub-line beneath the title (existing mono / `--fg-3` treatment retained).
- [ ] When `title` is absent, the header falls back to showing the path as the lead (no blank/broken header) — the styleguide canvas still renders.
- [ ] Consumed unforked (ADR-0003): the change is made in the styleguide `Drawer` source, not forked in the dashboard.
- [ ] Styleguide tests stay green (`styleguide/test`, `node --test`).

## Notes
- **Cross-BC consumption:** the dashboard imports `Drawer` directly from the styleguide source and esbuild bundles it (`dashboard/app/slide-over.js` → `…/styleguide/app/drawer.js`). This task changes the styleguide; **agentic-workflow-047** supplies the actual title data (threads it through `intentToDrawerItem`) and rebuilds `dashboard/dist/`. Order: this task first (capability), then aw-047 (data + rebuild). Mirrors the design-system-009 → agentic-workflow-039 precedent.
- In the live dashboard everything renders on the `doc` branch of `describeItem` (no `status` is threaded), so the doc-branch title is the one the dashboard actually uses; the ticket-branch title only matters for the styleguide demo.
- Prior art: **design-system-009** (last reshaped this Drawer header — dropped Copy, renamed the full-screen action, exposed its callback).

## Outcome
The styleguide `Drawer`'s contextual header now **leads with the item's title**, with
the file path demoted to a quiet sub-line.

- `describeItem` (`styleguide/app/drawer.js`) carries `title: item.title` on **both**
  the `doc` branch (what the live dashboard renders on) and the `ticket` branch (demo).
- `HeaderContextual` renders an `<h2>` lead heading — `var(--font-ui)`, `15.5px`,
  `fontWeight: 600`, `var(--fg-1)` — directly under the pill/action row. The path moved
  below it as a sub-line, retaining its `var(--font-mono)` / `11.5px` / `var(--fg-3)`
  treatment. Fallback: `heading = info.title || info.path`, and the path sub-line is
  guarded by `info.title` so a title-less item shows the path once as the lead (no
  blank/duplicated header). `HeaderMinimal` untouched (out of scope; dashboard uses
  `contextual`).
- The canvas demos (`app/app.js`, both `describeItem(SAMPLE_DOC)` / `(SAMPLE_TICKET)`
  headers) now show the new title heading automatically — both samples already carry
  `title` in `data.js`, so no demo edit was needed.

Consumed unforked per ADR-0003: change is in the styleguide source only. The
`dashboard/dist/` rebuild + threading the title from the dashboard intent
(`intentToDrawerItem`) is deferred to **agentic-workflow-047**.

Tests: 4 new source-reading static guards added to `styleguide/test/drawer.test.mjs`
(title on both `describeItem` branches; prominent UI-font/`--fg-1`/heavier/larger title
line; path demoted keeping mono/`--fg-3`; title-less fallback to path). Full styleguide
suite green (`node --test` per file).

Key files:
- `styleguide/app/drawer.js`
- `styleguide/test/drawer.test.mjs`
- design-system `README.md` (Drawer-header title subsection + reopened gate note)
