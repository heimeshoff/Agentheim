---
id: design-system-e9apx
title: Command-deck palette identity — cool neutrals supersede the warm-Ledger heritage
status: done
type: decision
context: design-system
created: 2026-07-05
completed: 2026-07-05
depends_on: []
blocks: [design-system-a31e0, design-system-t896s]
tags: [dashboard-redesign, palette, adr, color-identity]
related_adrs: [0016, 0049]
related_research: []
prior_art: [design-system-001, design-system-003]
---

## Why
Retokenizing every surface / border / text value to 1b's cooler, bluer "Command deck" identity is
a real shift in the system's documented visual character — today's styleguide is framed as
"Ledger-derived, warm paper, quiet." This is independently reversible from the *accent-usage*
question ([[design-system-vw12e]]), so it earns its own record rather than being folded into an
accent amendment.

## What
Write an ADR (provisional ADR-0049) recording the identity shift: token **names/roles stay frozen,
only values change** across both `[data-theme]` blocks; the **light theme is *derived* from the 1b
dark palette** (not lifted from a separate 1a/1c source), anchored on the existing `--swatch-light`
(#FAF8F4) starting point. Update the design-system README's "Ledger-derived / warm paper" framing
to record the superseded heritage.

## Acceptance criteria
- [ ] ADR states the light-theme-derivation approach explicitly (derive from dark 1b values +
      `--swatch-light` anchor), not left implicit for the worker to invent.
- [ ] ADR resolves the **frozen-swatch question**: do `--swatch-light` / `--swatch-dark` (ADR-0016,
      deliberately theme-independent, currently mirroring `--surface-0`) re-pin to the new
      `--surface-0` values or stay pinned to the old hexes?
- [ ] ADR records that only *values* change — token names/roles are untouched — so no consumer
      needs a rename.
- [ ] The design-system README's identity/heritage language is updated in the same task.

## Notes
- The 1b dark reference values are catalogued in the redesign brief: app bg `#090c12`, panels
  `#0d1119` / `#0f141d`, ticket card `#121826`, hairlines `#1c2330`–`#2b3548`, text
  `#f2f5f9`/`#aeb8c4`/`#7d8794`/`#48515c`, accent `#e5a13c` (on-card `#f0c584`).
- Foundation decision for the redesign; blocks the palette retokenization [[design-system-a31e0]]
  and the ticket-card radius tweak [[design-system-t896s]].
- ADR: `.agentheim/knowledge/decisions/0049-command-deck-palette-identity-supersedes-warm-ledger-heritage.md`

## Outcome

Wrote ADR-0049 recording the palette identity shift: Command-deck (cool neutral) supersedes the
Ledger-derived warm-paper heritage, values-only (token names/roles frozen). It rules explicitly on
the two open questions:

- **Light-theme derivation** — derive from the 1b dark stack's hierarchy (step relationships +
  cool blue-grey undertone), anchored at the existing `--swatch-light` hex `#FAF8F4` (same
  lightness, re-hued), rather than lifting a separate 1a/1c light mock. This is binding on the
  downstream retokenization task (`design-system-a31e0`).
- **Frozen-swatch question (ADR-0016)** — `--swatch-light` / `--swatch-dark` **re-pin** to the new
  `--surface-0` values (not the retired warm-paper hexes), because ADR-0016's freeze was relative
  to the `[data-theme]` attribute (theme-toggle invariance), not to a specific palette generation;
  keeping the old hexes would make the `ThemeToggle` preview the wrong theme once `--surface-0`
  moves.

Also updated the design-system README's "The styleguide" section with a callout recording the
superseded Ledger/warm-paper heritage framing, pointing at ADR-0049, without touching the
Motion/accent-law sections (sibling ADR-0048's lane).

No code/tests — this is a `type: decision` task; the retokenization itself is
`design-system-a31e0`.

Key files:
- `.agentheim/knowledge/decisions/0049-command-deck-palette-identity-supersedes-warm-ledger-heritage.md`
- `.agentheim/contexts/design-system/README.md` (§ "The styleguide")
