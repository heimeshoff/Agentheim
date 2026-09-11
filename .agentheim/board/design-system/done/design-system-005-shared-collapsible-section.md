---
id: design-system-005
title: Shared collapsible-section primitive (decoupled from TreeItem) for board + library
status: done
type: feature
context: design-system
created: 2026-06-09
completed: 2026-06-09
commit: fbfba13
depends_on: [design-system-001]
blocks: []
tags: [captured, frontend, styleguide]
related_adrs: [ADR-0003, ADR-0015]
related_research: []
prior_art: []
---

## Why
The dashboard board's group-by-bounded-context lens (agentic-workflow-014) needs a
**collapsible section header** — a chevron + uppercase label + mono count that
toggles a body open/closed. The styleguide already HAS exactly this affordance, but
only INSIDE `TreeGroup` (`design-system/styleguide/app/library.js`): it is welded to
`TreeItem` rows (it renders `TreeItem` children directly) and it owns its own open
state (`useState(defaultOpen)`). The board could not reuse it, because the board:

- renders **`TicketCard`** bodies with HTML5 drag affordances, not `TreeItem` rows;
- needs the collapse state **lifted out** (it is persisted per-`(column, BC)` in the
  board's `localStorage` view-state store, ADR-0015), not owned internally.

So aw-014 built a **board-local** collapsible header (`BCSectionHeader`,
`dashboard/app/board.js`) matching the same styleguide tokens (chevron rotation,
`--font-ui` uppercase label, `--font-mono` count) — the sort-`<select>` board-local
precedent (ADR-0003). That is defensible but it is the SECOND consumer that wants this
affordance: a shared primitive is now warranted to avoid token drift.

**The two headers are not actually identical today** — and the refinement chose to
*close that gap*, not preserve it:

- `TreeGroup`'s count **hugs the label**; the board's `BCSectionHeader` uses `flex:1`
  on the label to **push the count to the right edge**.
- `TreeGroup`'s label does **not** truncate; the board's truncates with ellipsis
  (`overflow/textOverflow/whiteSpace`) so long BC names don't wrap.
- Button paddings differ: `6px 8px` (tree) vs `5px 6px` (board); bodies differ
  (`gap 1 / paddingLeft 8` vs `gap 10 / paddingLeft 2`).

## What
Extract a single `Collapsible` styleguide primitive into a **new module**
`styleguide/app/collapsible.js`, consumed by BOTH `TreeGroup` and the board's per-BC
section. Three decisions are locked (builder, 2026-06-09):

1. **Owns show/hide + styleable body.** The primitive renders the chevron header AND
   conditionally renders the body container (it owns the `open` truth, so it owns the
   body it reveals — one source of the open/closed logic, no `{open && …}` duplicated
   in consumers). The body container accepts a **`bodyStyle` override** so each
   consumer keeps its own spacing (`{gap:1, paddingLeft:8}` for the tree,
   `{gap:10, paddingLeft:2}` for the board). Children are arbitrary — `TreeItem`s or
   `TicketCard`s, the primitive is body-agnostic.

2. **Controlled OR uncontrolled.** Controlled when `open` + `onToggle` are supplied
   (the board drives it from persisted view-state, ADR-0015). Uncontrolled when they
   are omitted and `defaultOpen` is given (the current `TreeGroup` behavior — the
   primitive holds the `useState`). Standard React resolution: `isControlled =
   open !== undefined`; toggling only sets internal state when uncontrolled, and
   always fires `onToggle`.

3. **Unify to ONE canonical header look** (a small redesign, not pure dedup). The
   canonical header adopts the board's stronger treatment: **label `flex:1` with
   ellipsis truncation**, **count right-aligned** (or an optional trailing slot in
   that position), chevron rotates to 90° when open, at the tree's roomier **`6px 8px`**
   padding, `gap 6`, `--font-ui` 11px/600/uppercase `--fg-3` label, `--font-mono`
   10.5px `--fg-4` count. → **`TreeGroup`'s header changes visually** (count moves to
   the right edge, label gains truncation), so this **reopens the styleguide gate**
   for builder re-review (the ds-002 / ds-003 / ds-004 precedent). The exact canonical
   look is adjustable at that review.

## Acceptance criteria
- [ ] A `Collapsible` primitive exists in **`styleguide/app/collapsible.js`**: renders
      the canonical header (chevron + ellipsis-truncating uppercase label +
      right-aligned mono count / optional trailing slot) AND the body it reveals;
      controlled (`open` + `onToggle`) OR uncontrolled (`defaultOpen` + internal
      state); body container takes a `bodyStyle` override; body-agnostic to children.
- [ ] `TreeGroup` (`library.js`) composes `Collapsible` (uncontrolled, `defaultOpen`),
      passing `TreeItem` children and the tree's `bodyStyle` — same open/close behavior,
      now wearing the unified header.
- [ ] The board's per-BC section (`dashboard/app/board.js`) consumes `Collapsible`
      (controlled via the persisted view-state `collapsed` list), and the board-local
      `BCSectionHeader` is **deleted** — no duplicate header remains.
- [ ] The styleguide canvas (`styleguide/index.html` + `app`) **documents `Collapsible`
      as a pattern**, rendered in context in both controlled and uncontrolled modes (the
      canvas renders every component pattern — BC README).
- [ ] Styleguide unit/demo tests + dashboard build/dist tests stay green; the dashboard
      `dist/` is **rebuilt from source** (`node build.mjs`) — it is a derived artifact
      (ADR-0003), the source edit alone does not update the bundle.
- [ ] **Styleguide gate re-reviewed by the builder** — the unified header is a visual
      change to the library tree; the worker surfaces the canvas for re-confirmation and
      the BC README's gate note is updated (per the ds-002 / ds-003 / ds-004 pattern).

## Notes
- Captured by agentic-workflow-014 (board group-by-BC). The board-local `BCSectionHeader`
  is the interim; this task makes the affordance shared and retires it.
- Authoring constraint: the primitive is a styleguide view → **htm tagged templates, no
  JSX** (ADR-0005), and is consumed across the BC boundary **unforked** (ADR-0003) — the
  board imports it, never copies it.
- Test shape mirrors `styleguide/test/ticket-card.test.mjs` (ds-006): source-guard asserts
  + a small controlled/uncontrolled behavior check that runs under `node --test` without
  the canvas import map.
- Precedent for "styleguide owns the look, consumer drives the state/behavior": ds-006's
  `cornerAction` slot and the ADR-0003 unforked-consumption seam.
- Gate is OPEN today (ADR-0001 frontend gate, re-confirmed 2026-06-06); this task will
  reopen it on completion for a fresh builder sign-off — see AC 6.

## Outcome
Extracted a single shared `Collapsible` styleguide primitive consumed unforked by both
the library tree and the dashboard board; the board-local duplicate header is retired.

- **`styleguide/app/collapsible.js`** — the primitive. Owns the open/close truth and
  conditionally renders the body it reveals (the `${open && …}` reveal logic now lives
  once). Body-agnostic children; `bodyStyle` override per consumer. Controlled
  (`open` + `onToggle`) OR uncontrolled (`defaultOpen` + internal `useState`); always
  fires `onToggle`, writes internal state only when uncontrolled. One canonical header:
  chevron→90°, ellipsis-truncating `flex:1` uppercase label, right-aligned mono count
  (or a `trailing` slot).
- **`styleguide/app/collapsible-state.js`** — the React-free `isControlled(open)`
  resolution, testable under `node --test` (mirrors `showEstimate` / `doingPulseClass`).
- **`styleguide/app/library.js`** — `TreeGroup` now composes `Collapsible` uncontrolled,
  passing `TreeItem` children + the tree's `bodyStyle` (`gap:1 / paddingLeft:8`). Its
  header now wears the unified look (count right-aligned, label truncates) → a visual
  delta that **reopens the styleguide gate**.
- **`dashboard/app/board.js`** — the per-BC section now composes `Collapsible`
  controlled (`open=${!sec.collapsed}` + `onToggle`, driven by persisted view-state
  ADR-0015); board-local `BCSectionHeader` deleted.
- **`styleguide/app/app.js`** — canvas section 09 documents `Collapsible` in BOTH
  controlled and uncontrolled modes (`CollapsibleSpecimen`).
- **`styleguide/test/collapsible.test.mjs`** — 5 new tests (pure `isControlled` +
  reveal/toggle source-guards + both-consumer composition + duplicate-header removal).
  All 15 styleguide tests and all 196 dashboard tests green.
- **`dashboard/dist/`** — rebuilt from source (`node build.mjs`), reproducible
  (dist-build test green).

Decisions made: the three API forks (owns-reveal + `bodyStyle`, controlled-or-
uncontrolled, one canonical header) were locked at refinement and are recorded by
**ADR-0015** (collapse view-state, names this task) and **ADR-0003** (unforked
single-source consumption); no new ADR was warranted — this implements decisions
already on record.

**Gate: REOPENED, pending builder re-review** (AC 6) — the unified `TreeGroup` header
is a visual change; the BC README gate note records it, the canvas surfaces it.
