---
id: design-system-016
title: Search field + grouped-results popover/listbox styleguide pattern
status: done
type: feature
context: design-system
created: 2026-06-16
completed: 2026-06-16
commit: 9c7f353
depends_on: [design-system-001]
blocks: [agentic-workflow-052]
tags: [captured, frontend, styleguide, search]
related_adrs: [ADR-0003, ADR-0005, ADR-0024]
related_research: []
prior_art: [design-system-005, design-system-006, design-system-015]
---

## Why
The dashboard global search UI (agentic-workflow-052) needs a **text input that, as you
type, opens a floating panel of results grouped by category** — each row a title plus a
matched-text excerpt, navigable by up/down arrows and chosen by Enter or click. The
styleguide has **no text-input primitive** today (the board prompt-bar `<textarea>` is a
bespoke, board-local control flagged repeatedly as a design-system follow-up) and **no
combobox/listbox results pattern**.

`design-system-015` (todo) extracts a generic `Menu`/`Popover`; its own Notes say to build
it "when a second popover consumer appears." This search affordance **is** that second
consumer — but it is a **richer combobox** (type-ahead input + grouped result rows +
active-descendant keyboard highlight) than a dropdown menu. This task gives the styleguide a
reviewed **search-field + grouped-results** pattern so the dashboard consumes it unforked
(ADR-0003) instead of inventing token-drifting search chrome board-side.

## What
A styleguide search/combobox pattern in a new module `styleguide/app/search.js`,
authored with htm tagged templates (no JSX, ADR-0005), owning:

- a **token-styled text input** — the styleguide's first input control: placeholder, focus
  ring, a clear affordance, theme-aware (surfaces / type / radii / focus from the token set).
  This input stays **scoped to this module** — it is *not* extracted as a shared `Input`
  primitive (decided at refine 2026-06-16). A general input waits for a second consumer, per
  the BC's "promote when the second consumer appears" doctrine (ds-005 `Collapsible`, ds-015
  `Menu`);
- a **standalone floating results panel** anchored **below the input** at `--shadow-md`
  elevation, with **its own** outside-click + Esc dismiss machinery — **not** composed on
  ds-015's `Menu`/`Popover` (decided at refine 2026-06-16). A combobox keeps focus in the
  input and highlights rows via `aria-activedescendant`, whereas `Menu` moves focus *into* its
  items, so wholesale reuse would fight that primitive; the panel instead **matches ds-015's
  Popover `--shadow-md` elevation by convention** (same surface / hairline / radius) so the two
  read identically without sharing code;
- **labelled category groups** in the panel — consistent with the library groups
  (Bounded contexts / Decisions / Research / Tickets);
- **result rows**: a title line + a secondary **excerpt** sub-line (the matched snippet),
  with the matched term marked, token-styled;
- an **active-descendant keyboard model**: **focus stays in the input** while up/down moves a
  single highlight across **all** rows (spanning groups) via `aria-activedescendant`, Enter
  selects, Esc closes/clears; ARIA combobox/listbox roles. (Distinct from ds-015's
  focus-into-items model — that's why this is a standalone primitive, not a `Menu` consumer.)
- **body-agnostic / data-driven**: the consumer supplies the grouped result data + an
  `onSelect` callback — the styleguide owns look / placement / keyboard mechanics, the
  consumer owns the data and what selection does (the ds-006 `cornerAction` / ds-005
  `Collapsible` "styleguide owns the look, consumer drives behavior" seam).

## Acceptance criteria
- [x] A search-field + grouped-results pattern exists in the styleguide as a new module, htm templates (no JSX, ADR-0005), consumed unforked across the BC boundary (ADR-0003). — `styleguide/app/search.js` (+ React-free `search-state.js`).
- [x] The input is token-styled (surfaces / type / radii / focus), theme-aware, with a placeholder and a clear control. — `--surface-1`/`--hairline-strong`/`--radius-md`, `--accent-ochre` focus ring + `--accent-ochre-soft` halo, search glyph, `×` clear button.
- [x] Results render in a floating panel anchored below the input, partitioned into labelled category groups; each row shows a title + a matched-excerpt sub-line with the term marked. — `<mark>` segments from pure `markMatches`.
- [x] Keyboard model: focus stays in the input while up/down moves a single highlight across all rows (spanning groups) via `aria-activedescendant`, Enter selects the highlighted row, Esc closes/clears; mouse hover + click select the same way. ARIA combobox/listbox semantics. — `nextActiveIndex` (flat track, wrapping), `role=combobox/listbox/option`.
- [x] The floating panel is standalone (owns its own outside-click + Esc dismiss, not composed on ds-015's `Menu`), and matches ds-015's Popover `--shadow-md` elevation by convention (same surface / hairline / radius). Empty-query and no-results states are defined (no dead panel). — ADR-0024; pure `panelState` (closed / no-results / results).
- [x] The pattern is body-agnostic: the consumer supplies grouped result data + `onSelect`; the styleguide owns look / placement / keyboard. — `groups` + `onSelect` + optional `getTitle`/`getExcerpt`.
- [x] The styleguide canvas documents the pattern in context; styleguide + dashboard build/dist tests stay green; the dashboard `dist/` is rebuilt from source (`node build.mjs`). — section 11 `SearchSpecimen`; styleguide 96/96, dashboard 451/451; `dist/` rebuilt (byte-identical — no shipped dashboard consumer yet).
- [x] Styleguide gate re-reviewed by the builder (a visible new pattern; ds-005 / 007 / 009 / 014 precedent). — gate re-review note recorded in the BC README (section 11), pending the builder's confirmation per precedent.

## Outcome

Shipped the styleguide **search-field + grouped-results combobox** pattern:
`SearchField` (`styleguide/app/search.js`) over a React-free decision module
`styleguide/app/search-state.js`. A token-styled text input opens a **standalone**
floating panel — **not** composed on ds-015's `Menu` (ADR-0024): a combobox keeps
focus in the input and highlights rows via `aria-activedescendant`, whereas `Menu`
moves focus into its items — that matches the Menu's `--shadow-md` Popover elevation
by **convention** (same surface / hairline / radius) so the two read identically
without sharing code. Results are partitioned into labelled category groups; each
row is a title + a marked-excerpt sub-line. The active-descendant keyboard model
walks a single highlight across all rows spanning groups (↑/↓ with wraparound),
Enter selects, Esc closes/clears, hover + click select the same way; the panel is
never dead (pure `panelState`: closed / no-results / results). Body-agnostic — the
consumer feeds `groups` + `onSelect`; the styleguide never calls `/api/search`
(that's aw-050 + ADR-0023; aw-052 wires the topbar).

Key files:
- `styleguide/app/search.js` — the `SearchField` combobox (htm, ADR-0005).
- `styleguide/app/search-state.js` — pure decisions: `flattenGroups`, `resultCount`,
  `panelState`/`isPanelOpen`, `nextActiveIndex`, `activeDescendantId`,
  `arrowDirection`, `isDismissKey`, `isSelectKey`, `shouldDismissOnOutsideClick`,
  `markMatches`.
- `styleguide/test/search.test.mjs` — 23 tests (pure decisions + source-guards).
- `styleguide/app/app.js` — canvas section 11 (`SearchSpecimen` / `SearchSection`).
- `.agentheim/knowledge/decisions/0024-search-combobox-standalone-not-on-menu.md` — the standalone-not-on-Menu decision.
- `.agentheim/contexts/design-system/README.md` — pattern section + pointer + gate re-review note.

Verification: styleguide suite 96/96 green, dashboard suite 451/451 green (incl. a
fresh dist-build), plus an esbuild-bundle render smoke (combobox/listbox roles,
marked excerpt, closed-on-empty, no-results panel) confirming no htm render gotchas.

## Notes

## Notes
- **Consumer:** `agentic-workflow-052` (dashboard global search UI — topbar field + popover +
  routing). The `/api/search` backend is a separate task, `agentic-workflow-050` (+ ADR-0023). This
  task is the styleguide-capability half — mirrors the ds-014 → aw-047 and ds-009 → aw-039 ordering.
- **Relationship to design-system-015 (Menu/Popover) — RESOLVED (refine 2026-06-16): standalone.**
  ds-015 shipped (done, `70ffde0`), so the open question collapsed. The builder chose to build the
  combobox's floating panel + dismiss **standalone** rather than composing on `Menu`: a combobox
  keeps focus in the input and highlights rows via `aria-activedescendant`, whereas `Menu` moves
  focus *into* its items, so wholesale reuse would fight that primitive. The panel **matches
  ds-015's `--shadow-md` Popover elevation by convention** (same surface / hairline / radius) so the
  two read identically without sharing code. If a third popover-ish consumer later appears, the
  dismiss machinery is a candidate for extraction — out of scope here.
- **Shared text-input question — RESOLVED (refine 2026-06-16): search-scoped.** The token-styled
  input lives inside `search.js`, not extracted as a shared `Input` primitive. Mirrors the BC's
  "promote the shared primitive only when a second consumer appears" doctrine (ds-005, ds-015);
  retiring the bespoke board prompt-bar textarea onto a shared input is a *future* task, not this one.
- Seam precedent: ds-006 `cornerAction` render-prop, ds-005 `Collapsible` (controlled/uncontrolled).
- **Decision recorded:** [ADR-0024](../../../knowledge/decisions/0024-search-combobox-standalone-not-on-menu.md) — the combobox panel is standalone, matching the Menu's `--shadow-md` Popover elevation by convention (not composition), because the combobox keeps focus in the input via `aria-activedescendant` while `Menu` moves focus into its items.
