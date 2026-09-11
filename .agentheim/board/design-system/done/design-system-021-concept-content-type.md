---
id: design-system-021
title: Concept content-type — registry entry + glyph + --ct-concept tokens for the library/search type
status: done
type: feature
context: design-system
created: 2026-06-17
completed: 2026-06-17
depends_on: [design-system-001-styleguide]
blocks: [agentic-workflow-075]
tags: [styleguide, icons, content-types, frontend]
related_adrs: [0003, 0016]
related_research: []
prior_art: [design-system-017, design-system-001]
---

## Why
aw-075 makes **Concepts** a first-class artifact kind in the dashboard's two discovery
surfaces (left-rail nav group + search category). The rail renders each library row through
the styleguide `TreeItem`, which does `const t = CONTENT_TYPES[item.type]` and then
`<Icon name=${t.icon} color=${t.color} />`. `CONTENT_TYPES` (`styleguide/app/data.js`) today
has only `ticket | context | vision | map | research | adr` — **no `concept`** — so a
`type: 'concept'` row would dereference `t.icon` on `undefined` and **throw**. The icon
registry (`styleguide/app/icons.js`) also has **no concept-suitable glyph** (no lightbulb /
sparkles / network; the full set today is arrow-right, bot, box, chevron-right, compass,
copy, file-text, flask-conical, folder, folder-git-2, git-commit-horizontal, git-fork,
inbox, library, maximize, moon, plus, scale, search, settings-2, square-arrow-out-up-right,
square-kanban, sun, trash-2).

Per ADR-0003 the dashboard consumes the styleguide **unforked**, and ds-017's lesson is that
even a one-entry glyph add to `icons.js` is a styleguide change that reopens the gate. So the
new content-type must land in the primitive first — the ds-009→aw-039 / ds-014→aw-047 /
ds-016→aw-052 / ds-020→aw-074 "styleguide-capability-first" precedent. This is aw-075's hard
dependency: without it the Concepts rail group cannot render a single row.

## What
Make `concept` a first-class **content type** in the styleguide registry, so any consumer
emitting `{ type: 'concept' }` gets a distinct icon + color at a glance — mirroring the five
existing non-task types (context / vision / map / research / adr).

1. **Glyph → `lightbulb`** (builder-decided at refine, 2026-06-17 — concept = idea / insight /
   synthesis). The styleguide gate still **re-confirms** it against the canvas (the glyph add is
   a visible styleguide change — see the gate criterion below), but it is no longer an open
   "lightbulb vs notebook-pen" choice. Add `lightbulb` to the `icons.js` LUCIDE map; the worker
   **verifies the Lucide path geometry against the pinned Lucide version** when adding (the
   ds-017/ds-020 discipline — copy the upstream `lightbulb` SVG paths verbatim).
2. **Registry entry.** Add a `concept` entry to `CONTENT_TYPES` (`data.js`):
   `{ label: "Concept", icon: "lightbulb", color: "var(--ct-concept)", tint: "var(--ct-concept-tint)" }`
   — placed after the `adr` entry, keeping the registry's existing order.
3. **Tokens → a magenta / pink hue** (builder-decided at refine, 2026-06-17 — maximally distinct
   from the six in use; nearest neighbour is map purple). Add `--ct-concept` / `--ct-concept-tint`
   to **both** the light and dark theme blocks in `styleguide/styles/agentheim.css`, alongside the
   existing `--ct-*` pairs. It must stay distinct from the six in use (ticket grey, context teal,
   vision ochre-brown, map purple, research blue, adr red) and **never** the reserved selection
   accent `--accent-ochre-soft` (ADR-0016). **Proposed concrete values** (the worker tunes for
   contrast/feel against the canvas, the gate confirms — mirroring how the existing pairs sit):
   - light (`:root`): `--ct-concept: #B0479A;` · `--ct-concept-tint: #F7E3F1;`
   - dark (`.dark, [data-theme="dark"]`): `--ct-concept: #D98AC8;` · `--ct-concept-tint: #2A1626;`

## Acceptance criteria
- [ ] `icons.js` LUCIDE map contains the `lightbulb` glyph (builder-decided at refine),
      path geometry copied verbatim from the pinned Lucide version.
- [ ] `CONTENT_TYPES` (`data.js`) has a `concept` entry — `label: "Concept"`, `icon: "lightbulb"`,
      `color: "var(--ct-concept)"`, `tint: "var(--ct-concept-tint)"` — placed after `adr`.
- [ ] `--ct-concept` and `--ct-concept-tint` are defined in **both** the light and the dark
      theme blocks of `agentheim.css` as a **magenta / pink** hue (builder-decided at refine;
      distinct from the six existing content types, never `--accent-ochre-soft`). Proposed:
      light `#B0479A` / tint `#F7E3F1`, dark `#D98AC8` / tint `#2A1626`.
- [ ] A `type: 'concept'` row renders through `TreeItem` **without throwing** (the gap that
      blocks aw-075 is closed): `CONTENT_TYPES['concept'].icon` resolves to a real glyph.
- [ ] Canvas (`styleguide/index.html`, the §04 icon gallery + the library/TreeItem specimen)
      demonstrates the concept glyph + a `type: 'concept'` TreeItem so the gate re-review has
      something visible.
- [ ] README capability note + **gate re-review note**: a new content-type glyph + token pair
      is a visible styleguide change reopening the gate (the ds-005/007/009/014/015/017/018
      precedent) — re-review against `styleguide/index.html` before aw-075 ships.
- [ ] `dist/` rebuild is **deferred to the consuming task (aw-075)** — this task adds the
      capability with no shipped dashboard consumer yet (the ds-017/ds-018/ds-020 pattern).

## Notes
**Refined 2026-06-17** — the two open visual choices the capture deferred "to a gate decision"
were **locked with the builder** at refine, so the worker has a concrete target and the gate
becomes a confirmation rather than a decision:
- **Glyph → `lightbulb`** (over runner-up `notebook-pen` and `sparkles`).
- **Hue → magenta / pink** (over the originally-proposed green), for maximal distinctness from
  the six existing content-type hues — concrete proposed values now in *What* item 3.
Both still ride the styleguide gate re-review (a glyph + token-pair add is a visible change),
but the builder has pre-confirmed the choices. No orchestrator/specialist handoff was needed —
this is a pure styleguide-capability task under ADR-0003/ADR-0016 with no domain or cross-BC
decision; the only ambiguity was visual taste, which is the builder's call. **Promoted backlog
→ todo.**

Split off from **agentic-workflow-075** during its refine (2026-06-17): aw-075 is the
rail/search consumer, this is the content-type capability it depends on. aw-075's
acceptance criterion ("if a `type: 'concept'` row needs a distinct icon the styleguide's
TreeItem icon map lacks, file a design-system child task rather than forking") resolved to
**yes, it's needed** — `CONTENT_TYPES` has no `concept` and the registry has no fitting glyph.

- **No ADR** — adds a content type along the established `CONTENT_TYPES` shape under ADR-0003
  (unforked) + ADR-0016 (don't repurpose the reserved selection accent). The glyph/hue choice
  is README prose + a gate decision, exactly as ds-017 carried the trash-2 rationale.
- **Direct prior art:** ds-017 (added the `trash-2` glyph the same way — glyph + gate
  re-review + deferred dist rebuild). ds-001 is the registry's origin.

**Relevant files:**
- `styleguide/app/icons.js`, `styleguide/app/data.js`,
  `styleguide/styles/agentheim.css`, `styleguide/index.html`, `README.md`.

## Outcome
Made `concept` a first-class **content type** in the styleguide registry — the
seventh type alongside `ticket | context | vision | map | research | adr` — closing
the gap that would have thrown when aw-075 renders a `type: 'concept'` row through
`TreeItem`.

- **Glyph** — added Lucide `lightbulb` to `app/icons.js` `LUCIDE` (verbatim upstream
  geometry: bulb dome path + filament base `M9 18h6` + screw base `M10 22h4`, inner
  markup only) and appended it to the curated section-04 interface-set `ui` array in
  `app/foundations2.js`.
- **Registry** — `concept: { label: "Concept", icon: "lightbulb", color:
  "var(--ct-concept)", tint: "var(--ct-concept-tint)" }` added to `CONTENT_TYPES`
  (`app/data.js`) **after** `adr`. It auto-surfaces in the section-04 content-type set
  (that DocCard is `Object.entries(CONTENT_TYPES)`-derived).
- **Tokens** — `--ct-concept` / `--ct-concept-tint` added to BOTH theme blocks of
  `styles/agentheim.css` as a magenta/pink hue (light `#B0479A` / `#F7E3F1`, dark
  `#D98AC8` / `#2A1626`) — distinct from the six in use and never the reserved selection
  accent `--accent-ochre-soft` (ADR-0016).
- **Canvas specimen** — a "Concepts" group of `type: 'concept'` rows joins the demo
  `LIBRARY` (`app/data.js`), so the section-09 `TreeSpecimen` renders a live concept
  `TreeItem` (exercising the formerly-throwing deref) for the gate re-review.
- **Tests** — new `test/content-type-concept.test.mjs` (6 source-guard tests mirroring
  the trash-2 / panel-glyph suites): the `lightbulb` glyph resolves; the `concept`
  registry entry exists with the right shape placed after `adr`; its icon resolves to a
  real LUCIDE glyph (the exact `TreeItem` deref — never throws); the token pair is in
  both themes and never aliases `--accent-ochre-soft`; a `type: 'concept'` library row
  exists; the gallery surfaces `lightbulb`. Full styleguide suite green: 113/113.
- **Gate** — visible canvas change (section-04 icon + content-type sets, section-09
  tree), so it reopens the design-system gate per the ds-005/007/009/014/015/017/018/020
  precedent; gate-reopen note + capability note added to the BC README.
- **dist/** — deliberately NOT rebuilt (derived artifact per ADR-0003; aw-075 rebuilds
  it when concept rows actually render on the board).

Key files:
- `styleguide/app/icons.js` (LUCIDE `lightbulb`)
- `styleguide/app/data.js` (`CONTENT_TYPES.concept` + Concepts demo group)
- `styleguide/styles/agentheim.css` (`--ct-concept` token pair, both themes)
- `styleguide/app/foundations2.js` (gallery `ui` array)
- `styleguide/test/content-type-concept.test.mjs` (new tests)
- `.agentheim/contexts/design-system/README.md` (capability + gate-reopen note)
</content>
</invoke>
