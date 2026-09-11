## ADRs scoped to this BC

<!-- adr-local:start -->
- **ADR-0051** — Ochre wayfinding exception extends to the highlighted prompt-mode tab — amends ADR-0048, growing its bounded wayfinding-exception set from one surface to two (primary-nav active item + highlighted prompt-mode tab), on the same "persistent you-are-here / fires-on-Ctrl+Enter" rationale; the discriminating test is untouched, the exception stays exactly two enumerated surfaces (non-citable elsewhere), reuses `--accent-ochre` directly (no new token), and records the full four-tabs-plus-Enter paint contract for agentic-workflow-bz3az; ADR-0050's interaction model is untouched (proposed) — `../../decisions/0051-ochre-wayfinding-exception-extends-to-highlighted-prompt-mode-tab.md`
- **ADR-0049** — Command-deck palette identity: cool neutrals supersede the Ledger-derived warm-paper heritage — a values-only shift (token names/roles frozen, only hexes move in both `[data-theme]` blocks); the light theme is *derived* from the 1b dark stack anchored at the existing `--swatch-light` `#FAF8F4`, and ADR-0016's frozen preview swatches re-pin to the new `--surface-0` values; the hex substitution itself is design-system-a31e0 (proposed) — `../../decisions/0049-command-deck-palette-identity-supersedes-warm-ledger-heritage.md`
- **ADR-0048** — Accent carve-out: ochre marks the *primed primary action*, not passive selection — a discriminating test (fires/commits vs. passive equivalent-state) refining ADR-0016, applied to all five dashboard-redesign tension surfaces; the single left-nav active item keeps 1a's ochre inset rail as a bounded wayfinding exception, and a named `--emphasis-border` token (added later by design-system-a31e0) carries the one hero-border allowance (proposed) — `../../decisions/0048-accent-carveout-primed-primary-action-not-passive-selection.md`
- **ADR-0034** — A relational dependency-highlight is a third ambient signal — its own dedicated token (`--rel-dep`), direction coded by line-style (solid=waiting-on / dashed=holding-up) not hue, card-perimeter not rail, static (never vanished) under reduced motion (proposed) — `../../decisions/0034-dependency-ring-third-ambient-signal-dedicated-token-direction-by-line-style.md`
- **ADR-0029** — Ambient attention cue is a distinct signal from the active-status pulse; the rail "new item" marker draws from `--st-todo` and keeps a static dot under reduced motion (accepted) — `../../decisions/0029-ambient-attention-cue-distinct-from-active-status-pulse.md`
- **ADR-0024** — The search combobox's floating panel is standalone — matches the Menu's `--shadow-md` Popover elevation by convention, not by composition (accepted) — `../../decisions/0024-search-combobox-standalone-not-on-menu.md`
- **ADR-0016** — Theme-preview swatches use fixed (non-theming) tokens; selection by de-emphasis, never the reserved accent (accepted) — `../../decisions/0016-theme-preview-swatches-fixed-tokens-deemphasis-selection.md`
- **ADR-0003** — Styleguide as ES-module single source — buildless canvas, esbuild-bundled dashboard (proposed) — `../../decisions/0003-styleguide-esm-single-source.md`
- **ADR-0005** — Styleguide views authored with htm tagged templates (buildless, no JSX runtime compile) (accepted) — `../../decisions/0005-styleguide-htm-buildless-viewfactory.md`
- **ADR-0008** — Vendored webfonts — latin-subset woff2, `fonts/` beside the token CSS (accepted) — `../../decisions/0008-vendored-webfonts-latin-subset.md`
- **ADR-0014** — Ambient motion may signal active status — the doing-card pulse (accepted) — `../../decisions/0014-ambient-motion-signals-active-status.md`
<!-- adr-local:end -->

## Research touching this BC

<!-- research-local:start -->
<!-- research-local:end -->

## Concepts (opt-in synthesis pages)

<!-- concepts:start -->
<!-- concepts:end -->


## Pointers

- BC README (purpose, styleguide gate): `README.md`
- Styleguide artifact: `styleguide/index.html` (+ `styleguide/styles/`, `styleguide/app/`)
- Task board (tasks by status) for this BC: `../../../board/design-system/INDEX.md`
