---
id: ADR-0049
title: Command-deck palette identity — cool neutrals supersede the warm-Ledger heritage
scope: design-system
status: proposed
date: 2026-07-05
related_tasks: [design-system-e9apx]
related_adrs: [ADR-0016]
---

# ADR-0049: Command-deck palette identity — cool neutrals supersede the warm-Ledger heritage

## Context

The styleguide's documented visual identity (`design-system-001`) has, since 2026-06-05, been
framed as *"Linear precision, Notion calm, Vercel restraint … derived from the Ledger design
system"* — a **warm-paper** neutral family (light `--surface-0: #FAF8F4`, dark
`--surface-0: #0F1115` and its siblings in `styleguide/styles/colors_and_type.css`).

The dashboard-redesign brief's "1b" direction (cherry-picked by the builder alongside condensed
columns and condensed ticket cards — see `protocol.md` 2026-07-05 00:19) uses a visibly **cooler,
bluer "Command deck"** neutral stack instead: app bg `#090c12`, panels `#0d1119` / `#0f141d`,
ticket card `#121826`, hairlines `#1c2330`–`#2b3548`, text `#f2f5f9` / `#aeb8c4` / `#7d8794` /
`#48515c`, accent `#e5a13c` (on-card `#f0c584`). Retokenizing the full surface/border/text stack
to these values is a real shift in the system's documented character, independently reversible
from the *accent-usage* question (the sibling ADR-0048 accent carve-out) — it earns its own
record.

Two questions had to be resolved before the downstream retokenization task
(`design-system-a31e0`) can execute without inventing policy:

1. **How is the light theme derived**, given the brief only supplies a *dark* (1b) reference —
   there is no separate 1a/1c light mock to lift values from?
2. **What happens to the ADR-0016 frozen preview swatches** (`--swatch-light`, `--swatch-dark`),
   which today mirror the *old* warm-paper `--surface-0` hexes verbatim and exist specifically so
   the `ThemeToggle` previews "the theme it switches to"?

## Decision

### 1. Palette identity: Command-deck (cool neutral) supersedes the Ledger-derived warm-paper heritage

The system's neutral family shifts from warm paper (Ledger-derived) to the cooler, bluer
Command-deck stack. This is a **values-only** change:

- **Token names and roles are frozen.** `--surface-0`, `--surface-1`, `--surface-2`,
  `--surface-inverse`, the hairline tokens, the `--fg-1`…`--fg-4` text ramp, and the accent
  tokens keep their existing names and the same structural role (page bg → panel → card →
  hairline → text-emphasis-ramp → accent). Only the hex **values** assigned to those roles
  change, in both `[data-theme]` blocks.
- **No consumer rename.** Every component that references a token by name today
  (`var(--surface-1)`, `var(--fg-2)`, etc.) continues to resolve correctly post-retokenization
  with zero source edits outside the token file itself. `design-system-a31e0` is a pure
  value-substitution task, not a rename/migration.
- **The accent-usage question is out of scope here.** When and where the ochre accent may
  appear is governed by the accent carve-out (ADR-0048, sibling decision) — this ADR only
  changes the neutral palette's identity, not accent policy.

### 2. Light-theme derivation: derive from the 1b dark stack, anchored at the existing `--swatch-light` hex

The brief supplies only the dark (1b) reference values. The light theme is **not** lifted from a
separately designed 1a/1c mock; it is **derived** from the dark 1b stack, using the following
method:

- **Treat the dark 1b stack as the canonical hierarchy**, not just a set of isolated colors: app
  bg → panel → panel-2 → card → hairline-low → hairline-high → text-1 → text-2 → text-3 → text-4.
  The *relationships* between these steps (how far apart each step sits, and the shared cool
  blue-grey undertone rather than a warm/paper undertone) are the thing being derived, not just
  each hex in isolation.
- **Anchor the top of the light ramp at the existing `--swatch-light` hex, `#FAF8F4`.** That
  value stays the fixed starting point for the light theme's `--surface-0` — but its *meaning*
  changes: it is no longer read as "warm paper" (the Ledger framing) but as the **light-theme
  endpoint of the same cool-neutral family** the dark stack establishes. Concretely: hold the
  same lightness (`L*`) `#FAF8F4` already carries, but walk the rest of the light-theme ramp
  (panel/card/hairline/text) by re-applying the dark stack's **step sizes and cool blue-grey hue
  family**, inverted, rather than by independently choosing a new set of warm-paper-adjacent
  tones. The two themes end up as **one system read in both directions** (same structural DNA,
  inverted lightness), not two independently art-directed palettes.
- **This derivation instruction is binding on `design-system-a31e0`.** The retokenization task
  does not re-litigate "what should light look like" — it applies this method against the 1b
  dark values and the `#FAF8F4` anchor to produce the light-theme hex values, subject to the
  builder's usual gate re-review of the resulting canvas.

### 3. Frozen-swatch question (ADR-0016): re-pin, don't preserve the old hexes

`--swatch-light` / `--swatch-dark` **re-pin to the NEW `--surface-0` values** (post-retokenization
light and dark), not the old warm-paper hexes.

Reasoning: ADR-0016 froze these two tokens **relative to the active `[data-theme]` attribute** —
they deliberately do not flip when the user toggles theme, so each `ThemeToggle` button always
previews the theme it switches to rather than inverting. That freeze was never a promise to
preserve a *specific palette generation* forever; it was a promise about *theme-toggle
invariance*. If `--swatch-light` / `--swatch-dark` kept mirroring the retired warm-paper hexes
after `--surface-0` moves to the Command-deck values, the `ThemeToggle` would preview the **wrong**
theme — a stale warm-paper swatch previewing a light mode that no longer exists. That is exactly
the failure mode ADR-0016 was written to prevent (a swatch that misrepresents the theme it
switches to), just triggered by a palette change instead of a theme flip.

So: `design-system-a31e0` updates `--swatch-light` and `--swatch-dark` (and their fixed
`-fg` companions, re-checked for contrast against the new hexes) to mirror the **new** light/dark
`--surface-0` values, in the same commit that retokenizes `--surface-0` itself. The tokens'
*names*, their *frozen (non-theming) status*, and ADR-0016's de-emphasis-selection rule are all
**unchanged** — only their pinned values move, exactly like every other neutral token in this
ADR.

## Consequences

- `design-system-a31e0` (retokenization) has an explicit, non-improvised mandate: substitute
  values only, under both `[data-theme]` blocks, including re-pinning the two ADR-0016 frozen
  swatch tokens to the new `--surface-0` hexes. No token renames, no consumer edits beyond the
  token file (and the `dist/` rebuild ADR-0003 already requires for any token change).
  `design-system-t896s` (ticket-card radius) is a sibling, independent value-level tweak riding
  the same palette generation.
- The styleguide's identity prose ("Ledger-derived, warm paper") is now historical, not current
  — the README's Purpose/styleguide-direction section is updated in this task to record the
  superseded heritage (see below) without touching the Motion/accent-law sections, which are the
  sibling ADR-0048's territory.
- The builder's canvas gate reopens once `design-system-a31e0` lands the new hex values (per the
  established "visible styleguide change reopens the gate" precedent already used for every prior
  token/visual change in this BC).
- Future palette regenerations should follow the same shape this ADR sets: pick one reference
  stack (here, the dark 1b brief), derive the other theme's ramp from it by holding an existing
  anchor token's lightness and re-applying the reference stack's step relationships, and always
  re-pin any ADR-0016-style frozen preview tokens to the new values rather than leaving them
  stranded on a retired palette generation.
