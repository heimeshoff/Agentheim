---
id: design-system-020
title: Drawer gains in-place expandable width — controlled expand seam + body-top chevron + panel glyph pair
status: done
type: feature
context: design-system
created: 2026-06-17
completed: 2026-06-17
depends_on: [design-system-001-styleguide]
blocks: [agentic-workflow-074]
tags: [styleguide, drawer, frontend]
related_adrs: [0003, 0014]
related_research: []
prior_art: [design-system-009, design-system-005, design-system-006]
---

## Why
The slide-over `Drawer` is cramped for reading. aw-074 wants an **in-place width
toggle** — widen the drawer *where you are* — which is a different affordance from
ds-009's `onOpenFullScreen` (that one *promotes* the task **out** into the main pane).
Per ADR-0003 the dashboard consumes the `Drawer` **unforked**, so the expandable-width
capability must land in the primitive first — the ds-009→aw-039 / ds-014→aw-047 /
ds-016→aw-052 "styleguide-capability-first" precedent (and ds-017's lesson that even a
one-entry glyph add to `icons.js` is a styleguide change that reopens the gate).

## What
Add a **controlled expand seam** to `Drawer`, following the ds-005 Collapsible
controlled/uncontrolled pattern:

- `expanded` (boolean) — **controlled when defined** (primitive writes no state); when
  `undefined`, the primitive holds its own `useState`.
- `onToggleExpand` — announced on every toggle.
- `expandedWidth` (string) — **consumer-supplied** width for the expanded state.

The panel width becomes `isExpanded ? expandedWidth : "min(560px, 78%)"` (the existing
collapsed default stays in the primitive); the panel `transition` gains a `width …`
segment alongside the existing `transform …`. A **body-top chevron** (`IconButton`,
top-left of the scrollable body, **above `Markdown`** — a new slot that does not exist
today) toggles it. Add the `panel-right-open` / `panel-right-close` glyph pair to
`icons.js`.

The **styleguide owns** the chevron look/placement, the animated width transition, and
its reduced-motion strip; **the consumer owns the `expandedWidth` value** — rail-awareness
is a consumer fact, never primitive knowledge (no `248` / `calc(100vw - …)` in
`drawer.js`). The `onOpenFullScreen` maximize action (ds-009/ds-013) is **untouched**.

## Acceptance criteria
- [ ] `Drawer` signature carries `expanded`, `onToggleExpand`, and `expandedWidth` props.
- [ ] Panel `style` selects width by expand state: collapsed default `min(560px, 78%)`
      present; expanded width read from the `expandedWidth` prop — **no literal `248` /
      no hard-coded `calc(100vw - …)` in `drawer.js`**.
- [ ] Panel `transition` string includes a `width …` segment alongside the existing
      `transform …`.
- [ ] A framework-free controlled-vs-uncontrolled resolution exists, testable under
      `node --test` (extend `collapsible-state.js`'s `isControlled` or add
      `drawer-state.js`): `expanded !== undefined ⇒ controlled`.
- [ ] A chevron `IconButton` renders in the body region (above `Markdown`), with
      `aria-label`/`title` flipping **"Expand panel" / "Collapse panel"** and the glyph
      flipping `panel-right-open` (collapsed) / `panel-right-close` (expanded).
- [ ] `icons.js` LUCIDE map contains `"panel-right-open"` and `"panel-right-close"`.
- [ ] `prefers-reduced-motion: reduce` strips the **width** transition to instant
      (ds-009/ds-013/ds-018 / ADR-0014 motion contract; the existing `translateX` slide
      already honours it).
- [ ] The existing `onOpenFullScreen` thread + `maximize` glyph + callback-guarded
      rendering guards still pass **unchanged**.
- [ ] Canvas (`styleguide/index.html`, Drawer section) demonstrates an `expanded`-driven
      specimen so the gate re-review has something visible.
- [ ] `dist/` rebuild is **deferred to the consuming task (aw-074)** — this task adds the
      capability with no shipped dashboard consumer yet (the ds-017/ds-018 live-board
      pattern).

## Notes
Split off from **agentic-workflow-074** during its refine (2026-06-17): aw-074 is the
slide-over consumer, this is the Drawer capability it depends on.

- **Chevron placement ratified (builder, 2026-06-17):** body-top-left — a new
  `IconButton` slot inside the scrollable body, **above `Markdown`**, **not** in the
  header. The header keeps its existing controls untouched (maximize + Close). "Widen in
  place" deliberately sits with the content it widens, kept visually distinct from the
  header's "promote out" (`onOpenFullScreen` maximize). The header-action alternative
  (chevron grouped left of maximize) was put to the builder and **rejected** — the worker
  should not relocate the chevron into the header.

- **No ADR** — extends an existing primitive along the ds-005/ds-006 controlled-seam
  pattern under ADR-0003 (unforked) + ADR-0014 (motion-strip). The expand-vs-promote
  distinction is README prose (exactly as ds-013 carried the maximize-glyph rationale).
- Add a `### Drawer — in-place expandable width (design-system-020)` README capability
  section **+ a gate re-review note**: the body-top chevron, the canvas specimen, and the
  two new glyphs are a visible styleguide change reopening the gate (the
  ds-005/007/009/014/015/017/018 precedent) — re-review against `styleguide/index.html`
  Drawer section + the section-04 icon gallery before aw-074 ships.
- **Glyph rationale:** `panel-right-open` / `panel-right-close` read as "widen this
  right-anchored panel in place," deliberately distinct from `maximize` (four-corner
  promote). `chevrons-left`/`chevrons-right` was the runner-up but reads as "navigate,"
  not "resize." Worker verifies the Lucide path geometry against the pinned Lucide
  version when adding to `icons.js`.
- `expandedWidth` for the **uncontrolled/canvas specimen** can default to `min(920px, 92%)`
  (cosmetic, canvas-only — the live dashboard always passes its own rail-aware value).

**Relevant files:**
- `styleguide/app/drawer.js`, `styleguide/app/icons.js`,
  `styleguide/app/collapsible-state.js`, `styleguide/test/drawer.test.mjs`,
  `styleguide/index.html`, `README.md`.

**Prior art:** ds-009 (the maximize action this functionally complements), ds-005 (the
controlled/uncontrolled seam this API follows), ds-006 (styleguide-owns-look /
consumer-owns-behavior seam).

## Outcome
The slide-over `Drawer` gained an **in-place expandable-width** capability — widen the
panel *where you are*, kept deliberately distinct from ds-009's `onOpenFullScreen`
("promote out"). Shipped as a styleguide capability only (ADR-0003 unforked); the rail-aware
wiring + `dist/` rebuild are deferred to the consuming `agentic-workflow-074`.

- **`styleguide/app/drawer-state.js`** (new) — React-free `isExpandControlled(expanded)`:
  `expanded !== undefined ⇒ controlled` (ds-005 `isControlled` precedent), testable under
  `node --test`.
- **`styleguide/app/drawer.js`** — `Drawer` now accepts `expanded` / `onToggleExpand` /
  `expandedWidth`, resolving controlled-vs-uncontrolled via `isExpandControlled` (own
  `useState` when uncontrolled, always announces `onToggleExpand`). Panel width selects
  `isExpanded && expandedWidth ? expandedWidth : COLLAPSED_WIDTH` (`min(560px, 78%)` stays
  in the primitive — no `248` / no `calc(100vw…)`). The panel `transition` gains a `width …`
  segment alongside `transform …`, stripped to instant under `prefers-reduced-motion`
  (`matchMedia`, ADR-0014). A body-top-left `IconButton` above `Markdown` toggles it,
  flipping "Expand panel"/"Collapse panel" + `panel-right-open`/`panel-right-close`. The
  `onOpenFullScreen` maximize thread + both header guards are **untouched**.
- **`styleguide/app/icons.js`** — `panel-right-open` / `panel-right-close` glyphs added
  (Lucide geometry verbatim: shared rounded frame + right divider `x=15`, chevron in/out).
- **`styleguide/app/app.js`** — Drawer section (07) gains an `expanded`-driven
  `ExpandSpecimen` (contained, controlled, `expandedWidth="min(920px, 92%)"`) so the gate
  has something visible.
- **`styleguide/test/drawer-expand.test.mjs`** (new) — 11 tests (pure `isExpandControlled`
  + source-reading static guards for the signature, width selection, no rail literals, the
  width transition + reduced-motion strip, the body-above-Markdown chevron, the glyphs, the
  untouched `onOpenFullScreen`, and the canvas specimen). Full styleguide suite: **107 pass**.

No ADR written — this extends the ds-005/ds-006 controlled-seam under ADR-0003 (unforked)
+ ADR-0014 (motion strip); the expand-vs-promote distinction is README prose (ds-013
precedent). BC README gained a `### Drawer — in-place expandable width (design-system-020)`
capability section + a gate re-review note (the body-top chevron, the canvas specimen, and
the two glyphs reopen the gate — re-review before aw-074 ships).

**Gate: REOPENED, pending builder re-review** — visible chevron + canvas specimen + two
new glyphs; recorded in the BC README, surfaced on the canvas. `dist/` rebuild deferred to
aw-074.
