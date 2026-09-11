---
id: design-system-a31e0
title: Retokenize the palette — Command-deck dark + derived light, across both token files
status: done
type: feature
context: design-system
created: 2026-07-05
completed: 2026-07-05
depends_on: [design-system-vw12e, design-system-e9apx]
blocks: [agentic-workflow-vk6mc, agentic-workflow-wsfsk, agentic-workflow-bz3az, agentic-workflow-a2pm1, agentic-workflow-c2ver]
tags: [dashboard-redesign, palette, tokens]
related_adrs: [0003, 0016]
related_research: []
prior_art: [design-system-001, design-system-003, design-system-007]
---

## Why
Every downstream visual task (topbar CTA, prompt bar, flight-plan hero, left nav, ticket cards)
needs the new hex values and the new `--emphasis-border` token to exist before it can consume
them. This is the single biggest unlock in the redesign.

## What
Retokenize **both** `[data-theme]` blocks of `styleguide/styles/colors_and_type.css` (surfaces,
hairlines, the `--accent-ochre` family → the 1b hue `#e5a13c`) and, where the cooler neutral
backdrop demands it, `styleguide/styles/agentheim.css` (status / content-type values) to the 1b
dark palette plus a **derived** light counterpart. Add the `--emphasis-border` token pair (both
themes) per [[design-system-vw12e]], and resolve the frozen-swatch question per
[[design-system-e9apx]]. Token names/roles are unchanged — values only.

## Acceptance criteria
- [ ] Both theme blocks updated; token **names/roles unchanged** (values only), so every unforked
      consumer inherits the new look with no rename.
- [ ] `--accent-ochre` / `-soft` / `-tint` read the 1b hue in dark, with a derived light counterpart.
- [ ] The new `--emphasis-border` token pair exists in both theme blocks.
- [ ] Frozen `--swatch-light` / `--swatch-dark` handled per the ADR-0049 ruling (re-pin vs. stay).
- [ ] `dist/` is **rebuilt by this task itself** (`node build.mjs`) — a token-value-only change with
      no dashboard source edits, per the ds-019 / ds-007 / ds-004 solo-retokenization precedent;
      no separate agentic-workflow wiring task.
- [ ] The canvas (`styleguide/index.html`) is re-reviewed as ONE consolidated gate re-review for
      the whole palette, not per-component.

## Notes
- 1b dark reference values are in the redesign brief and in [[design-system-e9apx]].
- This reopens the styleguide gate (per ADR-0003 / the ds-005/007/009 precedent) — builder
  re-review of the canvas before the agentic-workflow wiring tasks consume it.

## Outcome
Both `[data-theme]` blocks of `styles/colors_and_type.css` retokenized to the
Command-deck palette (ADR-0049) — values only, every token kept its name/role. Dark:
`--surface-0/1/2` = `#090C12`/`#0D1119`/`#121826` (app bg / panel / ticket-card — the
1b brief's 4-rung stack collapsed onto 3 surface slots, dropping the "panel-2" rung),
hairlines `#1C2330`/`#2B3548`, `--fg-1..4` = `#F2F5F9`/`#AEB8C4`/`#7D8794`/`#48515C`,
`--accent-ochre` family = `#E5A13C`/`#5E4015`/`#211A0D`. Light theme is *derived* per
ADR-0049 §2: `--surface-0` held at the `#FAF8F4` anchor, the rest of the ramp computed
by re-applying the dark stack's HSL step sizes on the same cool blue-grey hue,
inverted — `--surface-1/2` = `#EFF1F4`/`#E4E7ED`, hairlines `#D9DDE4`/`#C2C9D4`,
`--fg-1..4` = `#0C0E12`/`#414956`/`#6D788B`/`#A8B0BD`, accent family =
`#B87619`/`#E6C28E`/`#FBF2DF`. Frozen swatches re-pinned per ADR-0049 §3:
`--swatch-dark` → `#090C12` (new dark `--surface-0`), `--swatch-light` unchanged
(`#FAF8F4`), both on-swatch fg tokens now mirror the new `--fg-1` values.
`styles/agentheim.css` gained `--emphasis-border` in both theme blocks (ADR-0048;
`color-mix(in oklab, var(--accent-ochre) 50%/40%, transparent)` light/dark) — no
consumer wired. Status/content-type tokens (`--st-*`, `--ct-*`, `--rel-dep*`,
`--code-bg`/`--code-block-bg`) left unchanged (out of scope). `dashboard/dist/`
rebuilt via `node build.mjs`, verified reproducible (second run: no further diff).
`styleguide/test/theme-toggle.test.mjs` updated (re-pinned swatch-dark lock value)
and extended (new `--emphasis-border` presence assertions in both agentheim.css
blocks); full design-system suite green (158 passing). BC README updated with the
full hex table and a consolidated gate re-review note — builder confirmation
pending on the canvas before the downstream agentic-workflow wiring set consumes it.

Key files: `styleguide/styles/colors_and_type.css`, `styleguide/styles/agentheim.css`,
`styleguide/test/theme-toggle.test.mjs`, `README.md`, `dashboard/dist/*`.
