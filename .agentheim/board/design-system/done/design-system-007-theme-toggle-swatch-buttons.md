---
id: design-system-007
title: Theme toggle buttons swatch their own theme (Dark = dark bg, Light = light bg)
status: done
type: bug
context: design-system
created: 2026-06-09
completed: 2026-06-09
commit: 8545b92
depends_on: [design-system-001]
blocks: []
tags: [bug, frontend, styleguide, theme]
related_adrs: [ADR-0003, ADR-0005, ADR-0016]
related_research: []
prior_art: []
---

## Why
The Dark/Light theme toggle reads backwards. It renders with the styleguide's generic
`Segmented` control (`styleguide/app/live.js:15`), which fills whichever option is
**selected** with an inverse background (`--surface-inverse`). In dark mode that makes the
selected "Dark" button bright and the unselected "Light" button dark — the opposite of what
the labels imply. A user scanning the toggle expects each button to preview the theme it
switches to, not to read inverted.

## What
Replace the `Segmented`-based theme toggle with a **dedicated `ThemeToggle` component** whose
two buttons **swatch their own theme**: the "Dark" button always carries a dark background,
the "Light" button always a light/bright background, regardless of which is active. The
**selected** theme is shown by **de-emphasizing the unselected button** (selected at full
strength, the other dimmed) — no accent hue, so the change stays inside the styleguide's
quiet-by-default law and the accent-reservation rule (ochre stays reserved for status /
focus, per the README and ADR-0014).

Three decisions locked during refinement (2026-06-09):

1. **Fixed swatch tokens.** The swatch backgrounds can't reuse `--surface-0` /
   `--surface-inverse` — those *flip* under `[data-theme="dark"]`. Introduce two
   theme-independent tokens in `:root` in `styles/colors_and_type.css` that are **not**
   redefined under `.dark` / `[data-theme="dark"]`:
   `--swatch-light: #FAF8F4` (the light `--surface-0`) and `--swatch-dark: #0F1115` (the dark
   `--surface-0`). Matching fixed on-swatch foreground colors (dark swatch → light text/icon,
   light swatch → dark text/icon) so labels and the moon/sun icons stay legible in both themes.
2. **Selection by de-emphasis, not color.** Selected button full strength; unselected dimmed
   (opacity / desaturation). No ring, no ochre, no new hue.
3. **Dedicated component.** A new `ThemeToggle` (alongside `Segmented` in
   `styleguide/app/live.js`) renders the swatched control. The generic `Segmented` is left
   exactly as-is, so the styleguide card-variant & drawer-header switchers (`app.js:106,112`)
   and the dashboard Board/Library switcher cannot regress.

The new `ThemeToggle` replaces `Segmented` in the styleguide's own `TopBar` (`app.js:66`) and
in the dashboard `ShellRail` header (`dashboard/app/board.js`, wired in agentic-workflow-017).
The dashboard consumer swap is **mechanical propagation** of a styleguide change (single task,
agreed with the builder 2026-06-09 — no separate agentic-workflow ticket): swap the import +
usage, no new dashboard behavior. The dashboard `dist/` bundle is then rebuilt from source.

## Acceptance criteria
- [ ] Two theme-independent tokens `--swatch-light` (`#FAF8F4`) and `--swatch-dark`
      (`#0F1115`) exist in `:root` in `styles/colors_and_type.css` and are **not** redefined
      under `.dark` / `[data-theme="dark"]`.
- [ ] The toggle's "Dark" button uses the dark swatch and the "Light" button the light
      swatch, in **both** the dark and light themes (swatch does not flip with `data-theme`).
- [ ] On-swatch text + moon/sun icon use fixed colors with legible contrast on each swatch in
      both themes (dark swatch → light fg, light swatch → dark fg).
- [ ] The currently-selected theme is shown by de-emphasizing the unselected button (selected
      at full strength); **no** accent/ochre hue or ring is used for the selected cue.
- [ ] A dedicated `ThemeToggle` component renders the control; the generic `Segmented`
      component's source and runtime behavior are **unchanged** — the styleguide card-variant
      & drawer-header switchers and the dashboard Board/Library switcher look and behave
      exactly as before.
- [ ] The new `ThemeToggle` replaces the prior `Segmented` theme control in **both** the
      styleguide `TopBar` and the dashboard `ShellRail` header.
- [ ] Selecting a theme still flips `data-theme` and persists via the existing theme-state
      store (agentic-workflow-017) — only the control's appearance changes, not its behavior.
- [ ] The dashboard `dist/` bundle is rebuilt from source (`node build.mjs`) and is
      reproducible from source.
- [ ] A test asserts: Dark option → dark swatch, Light option → light swatch independent of
      active theme; selected → full / unselected → dimmed; and a source-guard that the generic
      `Segmented` render path is untouched (mirroring `styleguide/test/ticket-card.test.mjs`).

## Notes
- **ADR to write at work-time.** This settles a small but durable design-language precedent
  worth an ADR (the worker allocates the next free number — deferred to avoid colliding with
  concurrent sessions): *theme-preview swatches use fixed, non-theming tokens; the selected
  state is signalled by de-emphasis, never by the reserved accent — keeping "color = status /
  content-type only" intact.* Append its id to `related_adrs` here and set its `related_tasks`
  to `[design-system-007]` (bidirectional link, per the modeling skill).
- **Single-source / rebuild discipline (ADR-0003).** The styleguide is the source; the
  dashboard `dist/` is derived and must be rebuilt (`node build.mjs`) to carry the fix — the
  source edit alone does not update the served bundle.
- **Cross-BC file touched:** `dashboard/app/board.js` (agentic-workflow) is edited
  mechanically (the `ShellRail` consumer swap). Flagged so `work` treats board.js as in-scope
  for conflict-avoidance against any concurrent agentic-workflow task.
- **Motion:** any dim/select transition follows the quiet-motion law — transition-only, fast
  ease (`--duration-fast`, `--ease-base`) — consistent with the existing theme-flip.
- Refinement forks resolved with the builder 2026-06-09: swatch look (each button swatches its
  theme), selected cue (dim the unselected — no accent), code seam (dedicated `ThemeToggle`),
  task shape (single task, mechanical dashboard swap included).

## Outcome

Replaced the backwards-reading `Segmented`-based Dark/Light toggle with a dedicated
**`ThemeToggle`** whose two buttons each **preview their own theme** via fixed,
non-theming swatch tokens, with the **selected** theme signalled by **de-emphasis**
(dimming the unselected button) — no accent, keeping "color = status / content-type
only" intact.

- **Tokens** (`styleguide/styles/colors_and_type.css`): added `--swatch-light`
  (`#FAF8F4`), `--swatch-dark` (`#0F1115`) and fixed on-swatch foregrounds
  (`--swatch-light-fg`, `--swatch-dark-fg`) in `:root` — the system's first
  **frozen** tokens, deliberately NOT redefined under `.dark` / `[data-theme]` so
  the swatches don't flip with the theme.
- **Component** (`styleguide/app/live.js`): new exported `ThemeToggle` — same
  `value`/`onChange`/`options` contract as `Segmented`, which is left **unchanged**
  (its inverse-fill still serves the card-variant / drawer-header / Board↔Library
  switchers). Selection by `opacity` (active 1, inactive 0.42), transition-only
  motion (`--duration-fast` / `--ease-base`).
- **Consumers swapped unforked** (ADR-0003): styleguide `TopBar`
  (`styleguide/app/app.js`) and dashboard `ShellRail`
  (`dashboard/app/board.js` — dead `Segmented` import dropped). Persistence
  (`theme-state.js`, aw-017) unchanged.
- **Derived dist rebuilt** (`node build.mjs`) — reproducible (second build = no new
  diff): only `dist/app.js` + `dist/colors_and_type.css` change.
- **ADR-0016** records the durable precedent (frozen preview-swatch tokens;
  de-emphasis selection, never the reserved accent).
- **Tests**: new `styleguide/test/theme-toggle.test.mjs` (8 tests) — token
  presence + non-flip under dark, ThemeToggle swatches/fg/no-surface-inverse,
  de-emphasis/no-accent, `Segmented` source-guard, TopBar usage. Styleguide 23/23,
  dashboard 196/196 green.
- **Gate**: the swatched theme control is a visible change in the canvas header;
  noted in the BC README as part of the re-review already open from ds-005.

Key files: `styleguide/styles/colors_and_type.css`, `styleguide/app/live.js`,
`styleguide/app/app.js`, `dashboard/app/board.js`,
`styleguide/test/theme-toggle.test.mjs`,
`.agentheim/knowledge/decisions/0016-theme-preview-swatches-fixed-tokens-deemphasis-selection.md`.
