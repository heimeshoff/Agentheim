---
id: ADR-0016
title: Theme-preview swatches use fixed (non-theming) tokens; selection by de-emphasis, never the reserved accent
scope: design-system
status: accepted
date: 2026-06-09
related_tasks: [design-system-007]
related_adrs: [ADR-0014, ADR-0003, ADR-0005]
---

# ADR-0016: Theme-preview swatches use fixed tokens; selection by de-emphasis, never the reserved accent

## Context

The styleguide's visual law is *"quiet by default; color is reserved for meaning
— it signals **ticket status** and **content type** only."* The accent (ochre) is
held back for brand / focus, and per ADR-0014 status motion stays ochre-only.

The Dark/Light theme control was, until `design-system-007`, the generic
`Segmented` control. `Segmented` fills the **selected** option with
`--surface-inverse` — a token that **flips under `[data-theme]`**. For a *theme*
toggle this reads backwards: in dark mode the selected "Dark" button becomes
bright and the unselected "Light" button goes dark — the opposite of what the
labels promise. A user scanning the toggle expects each button to **preview** the
theme it switches to, not to invert.

Two design questions had to be settled, both touching the color law:

1. **What background does each button carry?** It cannot reuse `--surface-0` /
   `--surface-inverse` because those flip with the active theme — the swatch would
   change meaning when you switch themes.
2. **How is the *selected* theme signalled** without reaching for the reserved
   accent (which would break "color = status / content-type only")?

## Decision

A dedicated `ThemeToggle` (alongside, not replacing, the generic `Segmented`)
renders the theme control, with two rules:

1. **Fixed, non-theming swatch tokens.** Two `:root` tokens —
   `--swatch-light: #FAF8F4` and `--swatch-dark: #0F1115` (the light/dark
   `--surface-0` values, frozen) — back the two buttons, plus fixed on-swatch
   foreground tokens (`--swatch-light-fg`, `--swatch-dark-fg`). These are
   **deliberately NOT redefined under `.dark` / `[data-theme="dark"]`**. So the
   "Dark" button is always dark and the "Light" button always light, in **both**
   themes: each button previews the theme it switches to. The fixed foregrounds
   keep the label + moon/sun icon legible on each swatch under either theme.

2. **Selection by de-emphasis, never accent.** The selected option sits at full
   strength; the unselected one is **dimmed** (opacity). No ring, no ochre, no new
   hue. This keeps the accent reserved for status / focus (consistent with
   ADR-0014's ochre-only rule) and keeps "color = status / content-type only"
   intact — the toggle introduces no chromatic signal of its own.

The control reuses `Segmented`'s `value` / `onChange` / `options` contract, so it
is a drop-in for the theme usage. `Segmented` is left **exactly as-is** — its
inverse-fill selection still serves the card-variant, drawer-header, and
Board↔Library switchers, which are NOT theme previews and read correctly with an
inverse fill.

Both consumers swap unforked (ADR-0003): the styleguide `TopBar` and the
dashboard `ShellRail`. The de-emphasis transition follows the quiet-motion law
(transition-only, `--duration-fast` / `--ease-base`).

## Consequences

- **A new token category — frozen preview swatches.** This is the system's first
  set of tokens that intentionally do *not* participate in theming. The precedent:
  a control that **previews** a theme/mode must paint from frozen tokens, never the
  live (flipping) surface tokens, or it reads inverted.
- **The "no accent for ordinary selection" precedent is reinforced.** Selecting
  among peer options is signalled by de-emphasis (dimming the rest), keeping the
  accent reserved. Future segmented-style controls that aren't status/content
  should prefer de-emphasis over an accent fill where an accent fill would imply
  meaning the option doesn't carry.
- **Two selection idioms now coexist** by intent: `Segmented` (inverse-fill the
  active option) for abstract mode switches, and `ThemeToggle` (swatch + dim the
  inactive) for theme previews. The choice is "does the option's appearance need
  to *be* the thing it selects?" — if yes, swatch + de-emphasis.
- The dashboard `dist/` is a derived artifact (ADR-0003) and was rebuilt
  (`node build.mjs`) to carry the new control + tokens.

> See ADR-0048 for a refinement of the "no accent for ordinary selection" rule:
> a discriminating test (fires/commits vs. passive equivalent-state selection)
> and a bounded, single-surface wayfinding exception for the left-nav active
> item. This rule (de-emphasis for peer selection) otherwise stands unchanged.
