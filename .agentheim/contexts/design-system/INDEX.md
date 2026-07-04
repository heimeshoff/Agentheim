# Design System — Index

Catalog of everything in this bounded context: tasks by status, ADRs scoped to this BC,
research touching this BC, and concept synthesis pages.

> Updated by: `modeling` (tasks), `work` (BC-scoped ADRs, concept page links), `research` (BC-scoped reports).

---

## Tasks by status

<!-- task-counts:start -->
- **Backlog:** 1
- **Todo:** 0
- **Doing:** 1
- **Done:** 27
<!-- task-counts:end -->

### Todo
<!-- todo-list:start -->
<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
- **design-system-a31e0** — Retokenize the palette — Command-deck dark + derived light, across both token files (feature) — `doing/design-system-a31e0-retokenize-palette-dark-derived-light.md`
<!-- doing-list:end -->

### Done (most recent first; older entries kept for prior-art search)
<!-- done-list:start -->
- **design-system-e9apx** — Command-deck palette identity — cool neutrals supersede the warm-Ledger heritage (decision) — `done/design-system-e9apx-command-deck-palette-identity.md`
- **design-system-vw12e** — Accent carve-out — ochre marks the primed primary action, not passive selection (decision) — `done/design-system-vw12e-accent-carveout-ochre-primary-action.md`
- **design-system-b7n2s** — Hidden and off-viewport dependency presence markers (feature) — `done/design-system-b7n2s-hidden-offviewport-dependency-markers.md`
- **design-system-w4t9k** — Dependency-highlight ring — a third ambient-motion signal on TicketCard (feature) — `done/design-system-w4t9k-dependency-highlight-ring-ticket-card.md`
- **design-system-c3p9k** — Add a double-chevron glyph pair (chevrons-up / chevrons-down) to the shared icon set (feature) — `done/design-system-c3p9k-chevrons-up-down-glyph.md`
- **design-system-v8k2p** — Rail "new item" attention blink — an ambient cue on a TreeItem / TreeGroup until acknowledged (feature) — `done/design-system-v8k2p-rail-new-item-attention-blink-cue.md`
- **design-system-r4k8m** — Add an inquiry/question glyph to the shared icon set (feature) — `done/design-system-r4k8m-inquire-glyph.md`
- **design-system-021** — Concept content-type — registry entry + glyph + --ct-concept tokens for the library/search type (feature) — `done/design-system-021-concept-content-type.md`
- **design-system-020** — Drawer gains in-place expandable width — controlled expand seam + body-top chevron + panel glyph pair (feature) — `done/design-system-020-drawer-expandable-width-chevron.md`
- **design-system-019** — Search results — category headers need more contrast (refactor) — `done/design-system-019-search-category-headers-more-contrast.md`
- **design-system-016** — Search field + grouped-results popover/listbox styleguide pattern (feature) — `done/design-system-016-search-field-grouped-results-pattern.md`
- **design-system-018** — Shared Button + Modal + ConfirmDialog primitives (centered, scrim, Esc-to-cancel) (feature) — `done/design-system-018-confirm-dialog-modal.md`
- **design-system-017** — Add the trash-2 glyph to the shared icon set (feature) — `done/design-system-017-trash-glyph.md`
- **design-system-015** — Shared Menu / Popover primitive for dropdown menus (feature) — `done/design-system-015-shared-menu-popover-primitive.md`
- **design-system-014** — Drawer contextual header leads with the item title, path demoted to a sub-line (feature) — `done/design-system-014-drawer-header-leads-with-title.md`
- **design-system-013** — Drawer "Open in full screen" uses a maximize glyph, not the external-link icon (chore) — `done/design-system-013-drawer-fullscreen-icon-maximize.md`
- **design-system-011** — Stale add-affordance test — styleguide suite asserts against dashboard board.js that has dropped onAdd (bug) — `done/design-system-011-stale-add-affordance-test-vs-board-source.md`
- **design-system-010** — TicketCard — drop the ochre selected-state ring (no replacement cue) (refactor) — `done/design-system-010-ticket-card-drop-ochre-selected-ring.md`
- **design-system-009** — Drawer header — drop the Copy button, rename "Open in editor" → "Open in full screen", expose a callback (feature) — `done/design-system-009-drawer-header-open-in-full-screen.md`
- **design-system-008** — TicketCard hover — stronger shadow, no upward content lift (refactor) — `done/design-system-008-ticket-card-hover-no-lift.md`
- **design-system-007** — Theme toggle buttons swatch their own theme (Dark = dark bg, Light = light bg) — `done/design-system-007-theme-toggle-swatch-buttons.md`
- **design-system-005** — Shared collapsible-section primitive (decoupled from TreeItem) for board + library — `done/design-system-005-shared-collapsible-section.md`
- **design-system-006** — TicketCard: optional corner action; hide the empty estimate chip — `done/design-system-006-ticket-card-corner-action.md`
- **design-system-004** — Animated "actively working" treatment for doing-column tickets — `done/design-system-004-doing-column-active-animation.md`
- **design-system-003** — Vendor the dashboard's webfonts offline (local @font-face, drop the Google Fonts CDN @import) (chore) — `done/design-system-003-offline-webfonts.md`
- **design-system-002** — Migrate the styleguide to ES modules (buildless htm + import-map canvas, single source) — _re-approved 2026-06-06; gate OPEN_ — `done/design-system-002-styleguide-esm-migration.md`
- **design-system-001** — Dashboard styleguide (visual language for Agentheim's UI) — _approved 2026-06-05_ — `done/design-system-001-styleguide.md`
<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
- **design-system-t896s** — TicketCard — bump corner radius toward 1b's 10px (refactor) — `backlog/design-system-t896s-ticketcard-radius-10px.md`
<!-- backlog-list:end -->

## ADRs scoped to this BC

<!-- adr-local:start -->
- **ADR-0049** — Command-deck palette identity: cool neutrals supersede the Ledger-derived warm-paper heritage — a values-only shift (token names/roles frozen, only hexes move in both `[data-theme]` blocks); the light theme is *derived* from the 1b dark stack anchored at the existing `--swatch-light` `#FAF8F4`, and ADR-0016's frozen preview swatches re-pin to the new `--surface-0` values; the hex substitution itself is design-system-a31e0 (proposed) — `../../knowledge/decisions/0049-command-deck-palette-identity-supersedes-warm-ledger-heritage.md`
- **ADR-0048** — Accent carve-out: ochre marks the *primed primary action*, not passive selection — a discriminating test (fires/commits vs. passive equivalent-state) refining ADR-0016, applied to all five dashboard-redesign tension surfaces; the single left-nav active item keeps 1a's ochre inset rail as a bounded wayfinding exception, and a named `--emphasis-border` token (added later by design-system-a31e0) carries the one hero-border allowance (proposed) — `../../knowledge/decisions/0048-accent-carveout-primed-primary-action-not-passive-selection.md`
- **ADR-0034** — A relational dependency-highlight is a third ambient signal — its own dedicated token (`--rel-dep`), direction coded by line-style (solid=waiting-on / dashed=holding-up) not hue, card-perimeter not rail, static (never vanished) under reduced motion (proposed) — `../../knowledge/decisions/0034-dependency-ring-third-ambient-signal-dedicated-token-direction-by-line-style.md`
- **ADR-0029** — Ambient attention cue is a distinct signal from the active-status pulse; the rail "new item" marker draws from `--st-todo` and keeps a static dot under reduced motion (accepted) — `../../knowledge/decisions/0029-ambient-attention-cue-distinct-from-active-status-pulse.md`
- **ADR-0024** — The search combobox's floating panel is standalone — matches the Menu's `--shadow-md` Popover elevation by convention, not by composition (accepted) — `../../knowledge/decisions/0024-search-combobox-standalone-not-on-menu.md`
- **ADR-0016** — Theme-preview swatches use fixed (non-theming) tokens; selection by de-emphasis, never the reserved accent (accepted) — `../../knowledge/decisions/0016-theme-preview-swatches-fixed-tokens-deemphasis-selection.md`
- **ADR-0003** — Styleguide as ES-module single source — buildless canvas, esbuild-bundled dashboard (proposed) — `../../knowledge/decisions/0003-styleguide-esm-single-source.md`
- **ADR-0005** — Styleguide views authored with htm tagged templates (buildless, no JSX runtime compile) (accepted) — `../../knowledge/decisions/0005-styleguide-htm-buildless-viewfactory.md`
- **ADR-0008** — Vendored webfonts — latin-subset woff2, `fonts/` beside the token CSS (accepted) — `../../knowledge/decisions/0008-vendored-webfonts-latin-subset.md`
- **ADR-0014** — Ambient motion may signal active status — the doing-card pulse (accepted) — `../../knowledge/decisions/0014-ambient-motion-signals-active-status.md`
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
