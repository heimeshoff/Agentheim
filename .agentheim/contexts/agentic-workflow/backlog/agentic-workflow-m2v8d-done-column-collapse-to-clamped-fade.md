---
id: agentic-workflow-m2v8d
title: Done column collapse control — clamp to ~3.5 faded tickets instead of hiding the column
status: backlog
type: feature
context: agentic-workflow
created: 2026-06-19
completed:
depends_on: [design-system-001, design-system-c3p9k]
blocks: []
tags: [dashboard, board, done-column, collapse, frontend]
related_adrs: [0015, 0017, 0003, 0009, 0001]
related_research: []
prior_art: [agentic-workflow-072, agentic-workflow-074, agentic-workflow-014]
---

## Why
The Done column grows unbounded as completed tasks accumulate, crowding the live columns.
`agentic-workflow-072` solved this by letting the builder **hide** Done entirely (drop it from
the layout, bring it back via a "Show Done (N)" chip). The builder now wants a softer control:
keep Done visible but **collapse** it to a short, glanceable peek of the most-recent completions
rather than removing it. The hard hide/show toggle is replaced by an in-place collapse that
always leaves a few done tickets in view.

## What
**Replace** the aw-072 Done-column hide affordance with a **collapse control** (user-confirmed
2026-06-19 — full replacement, not coexistence):

- A **collapse button** in the **top-right of the Done column, above the group toggle**, drawn
  as the **double-chevron pointing up** (`chevrons-up`, design-system-c3p9k). Done only —
  backlog / todo / doing carry no such control (the aw-018 default-OFF per-column-affordance
  precedent).
- **When collapsed:** the Done column body is **height-clamped to ≈3.5 average cards**
  (`max-height` + `overflow: hidden`) with a **bottom `mask-image` gradient fade**, so whatever
  card the clamp cuts **fades out** and **nothing renders below the clamp**. "3.5" is a **visual
  height target, not a node count** (refine 2026-06-19) — card heights vary with title length, so
  the honest reading is a height clamp that lands ~3.5 cards tall, not "render exactly 4 nodes."
  The chevron **flips to point down** (`chevrons-down`) to signal the expand action.
- **When expanded (default):** the full Done list renders, chevron points up.
- Clicking the button toggles between the two states.
- **Persists across reloads** (user-confirmed 2026-06-19) via the existing versioned board
  view-state store (ADR-0015), the same way sort / group / the retired `hidden` flag did.
- **Presentation-only** — no `/api` write, no lifecycle move; the board stays a read-only
  projection of disk (ADR-0017 / ADR-0001). Collapsing only suppresses *rendering* of the
  overflow tickets; they still exist on disk and survive every SSE re-projection.

## Acceptance criteria
- [ ] The Done column carries a **collapse button** in its **top-right control strip, above the
      group toggle**, using the **`chevrons-up`** glyph when expanded and **`chevrons-down`** when
      collapsed (design-system-c3p9k, consumed unforked — ADR-0003). **Done only.**
- [ ] **Collapsed state is a height clamp, not a node count** (refine 2026-06-19): the Done
      column body carries a `max-height` of **≈3.5 average cards** with `overflow: hidden` and a
      bottom **`mask-image` gradient fade**, so whatever card the clamp cuts fades out toward the
      bottom and **nothing renders below the clamp**. The ~3.5 is a visual height target — a long
      title may show slightly fewer/more cards; that is acceptable and expected.
- [ ] **Collapse is orthogonal to grouping** (refine 2026-06-19): when Done is grouped-by-BC
      (aw-014), the clamp applies to the **whole column body regardless of sections** — section
      headers and cards fall where they may inside the clamped/faded region; the clamp does **not**
      run per-section. (Reinforces the height-clamp reading: one `max-height` on the body, grouping
      untouched.)
- [ ] **Expanded is the default** — no stored preference resolves to the full list.
- [ ] Clicking the button **toggles** collapsed ⇄ expanded, and the chevron direction flips to
      match (up = will-collapse / expanded, down = will-expand / collapsed). The flip is a
      **glyph-name swap** — `Icon name="chevrons-up"` ⇄ `Icon name="chevrons-down"` (refine
      2026-06-19) — consuming **both** glyphs ds-c3p9k ships, **not** a board-local CSS rotate
      transform on a single glyph.
- [ ] The collapsed/expanded choice **persists across reloads** in the existing versioned
      view-state store (`dashboard/app/board-view-state.js`, ADR-0015): an additive boolean
      (e.g. `collapsed` / `peek`) on the per-column state, **back-compatible** — an old blob that
      predates it loads as expanded with **no `VIEW_STATE_VERSION` bump**.
- [ ] **aw-072's hide control is removed:** the `x` hide button, the `hidden` column flag, the
      `visibleColumns` drop-from-layout filtering, and the **"Show Done (N)"** chip are taken out
      (replacement, not coexistence). Migrate or retire the `hidden` field cleanly — an old blob
      carrying `hidden: true` must not blank or break the board (degrade to shown + expanded).
- [ ] Collapsing is **presentation-only**: no `/api/*` write, no lifecycle move, nothing changes
      on disk (ADR-0017 / ADR-0001). The collapsed state **survives every SSE `tree-changed`
      re-projection** (derived at render, like sort / group); a task completing into a collapsed
      Done just slots into the (still-hidden) overflow — it never auto-expands.
- [ ] The collapse button + the fade-out clamp are **board-local, token-matched** elements (the
      sort `<select>` / group-toggle precedent); the styleguide is consumed **unforked** beyond
      the design-system-c3p9k glyph — no other styleguide edit.
- [ ] Pure logic is **unit-tested under `node --test`**: the collapsed-state normalization in
      `board-view-state.js` (incl. the old-blob and old-`hidden` back-compat paths) and any pure
      "clamp the rendered Done list to N" helper.
- [ ] `dashboard/dist/app.js` is **rebuilt (esbuild)** so the deployed bundle carries the change.

## Notes
- **Resolved refinement decisions (2026-06-19)** — the three open questions that held this in
  backlog are now decided by the builder:
  - **Clamp is height-based, not count-based.** A `max-height` on the Done column body (≈3.5
    average cards) + `overflow: hidden` + a bottom `mask-image` gradient fade. "3.5" is a *visual
    height target*, not a literal node count — robust to varying card heights, and the honest
    reading of the builder's "3.5 + fade" intent. (Rejected: rendering the first 4 and half-fading
    the 4th node.)
  - **Collapse is orthogonal to grouping.** When Done is grouped-by-BC (aw-014) the clamp applies
    to the **whole column body regardless of sections** — one `max-height` on the body, sections
    fall where they may inside the faded region. Not a per-section clamp. (Falls out naturally from
    the height-based reading.)
  - **Chevron flip is a glyph-name swap.** `chevrons-up` (expanded) ⇄ `chevrons-down` (collapsed)
    via the `Icon name` prop, consuming both glyphs ds-c3p9k ships exactly as designed — **not** a
    board-local CSS rotate transform on a single glyph. (Keeps the styleguide consumed unforked,
    ADR-0003; no board-local motion to reduced-motion-guard.)
- **Readiness:** content is now todo-ready (all open questions resolved). It stays in **backlog**
  only because it is **dependency-blocked** — `design-system-c3p9k` (the `chevrons-up`/`-down`
  glyph pair) is in the design-system **todo** as of 2026-06-19 (promoted by a concurrent session)
  but not yet done. Do not promote m2v8d until c3p9k lands and the design-system gate
  (design-system-001) is re-reviewed (styleguide gate, below).
- **Relationship to aw-072:** this is a deliberate **reversal** of aw-072's refinement decision.
  aw-072's notes record that "collapse-to-a-thin-strip" was *considered and rejected* in favor of
  remove-from-layout. The builder has now chosen a (different) collapse flavor — clamp-to-3.5-
  with-fade — and wants it to **replace** the shipped hide control. aw-072 stays `done`; its
  machinery is removed by this task.
- **Styleguide gate:** frontend task → depends on `design-system-001` (gate OPEN) and on the new
  glyph task `design-system-c3p9k`. Do not promote ahead of the glyph landing + gate re-review.
- **Prior art / precedent:** aw-072 (the hide control this replaces; the view-state `hidden`
  field + Done-only `onHide` wiring this rips out), aw-074 (an expand/collapse chevron toggle on
  the slide-over — the controlled-toggle + reduced-motion precedent), aw-014 (the persisted
  per-column view-state store this extends; the collapsible-section pattern).
</content>
