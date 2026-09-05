# Design System — Index

Catalog of everything in this bounded context: tasks by status, ADRs scoped to this BC,
research touching this BC, and concept synthesis pages.

> Updated by: `modeling` (tasks), `work` (BC-scoped ADRs, concept page links), `research` (BC-scoped reports).

---

## Tasks by status

<!-- task-counts:start -->
- **Backlog:** 0
- **Todo:** 0
- **Doing:** 1
- **Done:** 36
<!-- task-counts:end -->

### Todo
<!-- todo-list:start -->
<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
- **design-system-pk4qd** — Two ambient cues repaint every frame — ambient-rail-pulse and rail-attention-breathe animate box-shadow inside their keyframes, contradicting the compositor-only claim (bug) — `doing/design-system-pk4qd-ambient-keyframes-compositor-only-glow-layer.md`
<!-- doing-list:end -->

### Done (current-month entries live; older months archived verbatim under `done-archive/` — kept for prior-art search, ADR-0039 convention)
<!-- done-list:start -->
- **design-system-me97j** — ModelSplitButton's `disabled` deadens the model caret along with Enter — an empty prompt shouldn't block picking a model (bug) — `done/design-system-me97j-split-button-disabled-spares-caret.md`
- **design-system-k3f7q** — ModelSplitButton's model menu opens upward and escapes the prompt console's clip (bug) — `done/design-system-k3f7q-model-menu-opens-upward-unclipped.md`
- **design-system-r9dtm** — ModelSplitButton — the ochre Enter button widens into a labelled split button with a caret (feature) — `done/design-system-r9dtm-model-split-button.md`
- **design-system-v08qq** — TicketCard — condense to 1b: no context chip, no estimate, no timestamp, smaller type (refactor) — `done/design-system-v08qq-ticketcard-condense-to-1b.md`
- **design-system-tfhn6** — EnterButton gains a disabled state (feature) — `done/design-system-tfhn6-enter-button-disabled-state.md`
- **design-system-xr4sb** — Prompt-mode tab glyphs + solid-ochre icon Enter-button variant, aligned to 1b (feature) — `done/design-system-xr4sb-prompt-mode-glyphs-icon-enter-button.md`
- **design-system-rm2yv** — Extend the ochre wayfinding exception to the highlighted prompt-mode tab (decision) — `done/design-system-rm2yv-ochre-exception-prompt-mode-tab.md`
- **design-system-t896s** — TicketCard — bump corner radius toward 1b's 10px (refactor) — `done/design-system-t896s-ticketcard-radius-10px.md`
- **design-system-a31e0** — Retokenize the palette — Command-deck dark + derived light, across both token files (feature) — `done/design-system-a31e0-retokenize-palette-dark-derived-light.md`
- **design-system-e9apx** — Command-deck palette identity — cool neutrals supersede the warm-Ledger heritage (decision) — `done/design-system-e9apx-command-deck-palette-identity.md`
- **design-system-vw12e** — Accent carve-out — ochre marks the primed primary action, not passive selection (decision) — `done/design-system-vw12e-accent-carveout-ochre-primary-action.md`
- **design-system-b7n2s** — Hidden and off-viewport dependency presence markers (feature) — `done/design-system-b7n2s-hidden-offviewport-dependency-markers.md`
- **design-system-w4t9k** — Dependency-highlight ring — a third ambient-motion signal on TicketCard (feature) — `done/design-system-w4t9k-dependency-highlight-ring-ticket-card.md`
<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
<!-- backlog-list:end -->

## ADRs scoped to this BC

<!-- adr-local:start -->
- **ADR-0051** — Ochre wayfinding exception extends to the highlighted prompt-mode tab — amends ADR-0048, growing its bounded wayfinding-exception set from one surface to two (primary-nav active item + highlighted prompt-mode tab), on the same "persistent you-are-here / fires-on-Ctrl+Enter" rationale; the discriminating test is untouched, the exception stays exactly two enumerated surfaces (non-citable elsewhere), reuses `--accent-ochre` directly (no new token), and records the full four-tabs-plus-Enter paint contract for agentic-workflow-bz3az; ADR-0050's interaction model is untouched (proposed) — `../../knowledge/decisions/0051-ochre-wayfinding-exception-extends-to-highlighted-prompt-mode-tab.md`
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
