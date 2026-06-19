---
id: design-system-c3p9k
title: Add a double-chevron glyph pair (chevrons-up / chevrons-down) to the shared icon set
status: backlog
type: feature
context: design-system
created: 2026-06-19
completed:
depends_on: []
blocks: [agentic-workflow-m2v8d]
tags: [icon, glyph, styleguide-gate]
related_adrs: [0003]
related_research: []
prior_art: [design-system-017, design-system-021, design-system-r4k8m]
---

## Why
The Done-column collapse control (`agentic-workflow-m2v8d`) needs a button that "looks like
two arrows / chevrons pointing upwards" to collapse, flipping to point the other way when
collapsed. The shared icon registry (`styleguide/app/icons.js`, the `LUCIDE` map) currently
carries only the single `chevron-right` — there is no doubled-chevron glyph. Per ADR-0003 the
dashboard consumes the styleguide **unforked**, so a new glyph belongs in the styleguide source,
added once here, then consumed by the board — the exact `trash-2` (ds-017) → aw-048,
`message-circle-question` (ds-r4k8m) → aw-h7n2c, `lightbulb` (ds-021) → aw-075 ordering.

## What
Add the Lucide **`chevrons-up`** and **`chevrons-down`** glyphs (the stacked double-chevron) to
the shared icon set at upstream Lucide geometry, inner markup only (the `Icon` component supplies
the `<svg>` wrapper), and surface them in the section-04 interface-set gallery
(`foundations2.js`, the curated `ui` array) so the canvas documents them. The pair reads as
"collapse upward / expand downward" — `chevrons-up` for the collapse action, `chevrons-down`
for the collapsed→expand action (the consumer picks which way points when).

## Acceptance criteria
- [ ] `chevrons-up` and `chevrons-down` are added to `styleguide/app/icons.js` `LUCIDE` at
      upstream Lucide geometry (verbatim path data, inner markup only — no `<svg>` wrapper).
- [ ] Both glyphs render via the existing `Icon name="chevrons-up"` / `Icon name="chevrons-down"`
      path with no special-casing.
- [ ] Both are surfaced in the section-04 interface-set gallery (`foundations2.js`, the `ui`
      array) so they appear on the canvas (`styleguide/index.html` → section 04, Iconography).
- [ ] No token changes, no new color — a glyph-only addition (the ds-017 / ds-r4k8m precedent).
- [ ] **Gate:** this is a visible styleguide change (new glyphs in the section-04 gallery) and
      **reopens the design-system gate** — the builder re-reviews the canvas before
      `agentic-workflow-m2v8d` consumes the glyphs and rebuilds `dist/`.
- [ ] `dist/` is **not** rebuilt here (a derived artifact, ADR-0003) — the consuming task
      (`agentic-workflow-m2v8d`) rebuilds it when the collapse button actually renders the glyph
      on the board (the ds-017 / ds-021 / ds-r4k8m live-board pattern).

## Notes
- Single vs double chevron: the user asked for "**two** arrows or chevrons pointing upwards,"
  so this is explicitly the *doubled* glyph (`chevrons-up`), not the single `chevron-right`
  already in the registry.
- The consumer may render one glyph and rotate/flip it, or use the up/down pair directly — both
  are left to `agentic-workflow-m2v8d`. Shipping the pair keeps the consumer's options open and
  matches Lucide's own `chevrons-up` / `chevrons-down` naming.
- Prior art / precedent: ds-017 (`trash-2` glyph → aw-048), ds-r4k8m (`message-circle-question`
  → aw-h7n2c), ds-021 (`lightbulb` content-type glyph → aw-075) — all glyph-only styleguide
  additions consumed unforked by an agentic-workflow task.
</content>
</invoke>
