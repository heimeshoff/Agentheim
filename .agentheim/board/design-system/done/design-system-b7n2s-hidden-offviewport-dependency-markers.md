---
id: design-system-b7n2s
title: Hidden and off-viewport dependency presence markers
status: done
type: feature
context: design-system
created: 2026-07-02
completed: 2026-07-03
depends_on: [design-system-w4t9k]
blocks: [agentic-workflow-h9v3m, agentic-workflow-r9k2p]
tags: [motion, collapsible, dependencies]
related_adrs: [0029, 0016, 0003, 0034]
related_research: []
prior_art: [design-system-v8k2p, design-system-005, design-system-c3p9k, agentic-workflow-n4h7q]
---

## Why
`agentic-workflow-r9k2p` needs a way to say "a highlighted dependency target is
hidden in here" on a **collapsed** board section header, on the **Done** column's
collapse control (the height-clamped "peek," which is not a `Collapsible`), and at
the **top/bottom edge** of the board's scroll area when a rendered target is scrolled
out of view. None of these exist today; `Collapsible`'s existing `attention` prop
means something different ("new item," ADR-0029) and must not be overloaded.

## What
Reuses `design-system-w4t9k`'s `--rel-dep` token and `--duration-relation` — no new
hue, one shared visual language across "pulsing on the card" and "present but
hidden."

**1. One CSS mechanism, two consumption points — the hidden-dependency marker.**
`.rel-present` + `@keyframes rel-present-breathe` in `styles/agentheim.css`: a
**hollow** breathing dot (border only, not filled) in `--rel-dep` — deliberately
distinct from the *filled* `--st-todo` attention dot so "a dependency is hidden here"
never reads as "a new item is here." **Direction-agnostic** by design (a collapsed
group can hold both `waiting-on` and `holding-up` targets; one marker meaning
"expand to see" is enough — direction stays on the on-card ring). Reduced motion:
loop off, hollow dot stays static (ADR-0029 pattern).

- Helper (`app/motion.js`): `dependencyPresentClass(present)` → `"rel-present"` when
  truthy, else `""`. React-free, mirrors `attentionCueClass`.
- **Consumption 1 — `Collapsible` prop.** New optional `hasHiddenDependency`
  (`app/collapsible.js`, default `false`), wired on the header button exactly as
  `attention`/`attentionCueClass` already are (a **separate** prop, separate class,
  separate meaning/lifecycle from `attention` — not a reuse).
- **Consumption 2 — standalone class.** The Done column's peek clamp is a board-local
  CSS `max-height` clamp (`board-view-state.js`), not a `Collapsible`. The board
  applies the raw `rel-present` class directly to the Done column's collapse control
  (the `chevrons-up`/`chevrons-down` button, design-system-c3p9k) — no new
  `Collapsible` usage needed there.

**2. Off-viewport edge-blink — primitive only, no new component.** Mirroring the
ADR-0003 "styleguide owns look/mechanics, consumer owns placement" seam used for
`cornerAction` (ds-006): design-system ships `.rel-edge-blink` +
`.rel-edge-blink--top` / `--bottom` + `@keyframes rel-edge-blink-breathe` in
`agentheim.css`, and a direction-aware helper `edgeBlinkClass(edge)`
(`edge ∈ {"top","bottom"}`) in `app/motion.js`. The board (`agentic-workflow-h9v3m`)
builds and places the actual small edge indicator (e.g. a `--rel-dep`-tinted
`chevron-up`/`chevron-down` `Icon` pinned to the scroll container's edge) using its
own scroll geometry — design-system doesn't know the scroll container exists.

- **Canvas specimens** — `Collapsible` section (09): a `hasHiddenDependency` header
  variant shown both open and collapsed. A small edge-blink specimen (a scroll-frame
  mockup with a top and a bottom `--rel-dep` chevron) documenting the primitive.

## Acceptance criteria
- [x] `dependencyPresentClass(true)` returns a class rendering a **hollow** breathing
      dot in `--rel-dep`; `dependencyPresentClass(false|undefined)` returns `""`.
- [x] `Collapsible` accepts `hasHiddenDependency` (default `false`); off renders
      byte-identical to today; on renders the hollow dot on the header, independent
      of and simultaneous-safe with `attention`.
- [x] The `rel-present` class works standalone (no `Collapsible` required) — usable
      directly on an arbitrary element (the Done collapse button).
- [x] Under `prefers-reduced-motion: reduce`, the hollow dot's loop stops but stays
      visible (static), never vanishes.
- [x] `edgeBlinkClass("top")` and `edgeBlinkClass("bottom")` each return a distinct
      class producing a breathing indicator oriented toward that edge; any other
      input returns `""`.
- [x] Both helpers are `node --test`-covered without the canvas import map.
- [x] Canvas documents the `hasHiddenDependency` `Collapsible` variant (open +
      collapsed) and the edge-blink specimen.
- [x] `dist/` is **not** rebuilt by this task; the consuming board task
      (`agentic-workflow-h9v3m`) rebuilds it.

## Outcome
Shipped both sibling mechanisms as pure CSS + React-free helpers, no new component:

- `dependencyPresentClass(present)` (`app/motion.js`) → `"rel-present"` / `""`.
  `.rel-present::after` + `@keyframes rel-present-breathe` in
  `styles/agentheim.css` render a **hollow** (border-only, `background:
  transparent`) breathing dot in `--rel-dep`, painted via `::after` (the rail
  attention dot uses `::before`) so the two never collide when both classes are
  applied to the same header. Reduced motion strips the loop, keeps the dot
  (ADR-0029 pattern).
- `Collapsible` gained `hasHiddenDependency` (default `false`, `app/collapsible.js`),
  wired via `dependencyPresentClass(hasHiddenDependency)` on the header button
  alongside (not instead of) `attentionCueClass(attention)` — a fully separate prop.
- `edgeBlinkClass(edge)` (`app/motion.js`) → `"rel-edge-blink rel-edge-blink--top"` /
  `"...--bottom"` / `""`. `.rel-edge-blink` + `.rel-edge-blink--top`/`--bottom` +
  `@keyframes rel-edge-blink-breathe` in `styles/agentheim.css`, reusing
  `--rel-dep`/`--duration-relation`; each direction modifier renders a distinct
  edge-oriented glow (`box-shadow` pointing up vs. down). No board-side placement
  logic added — that is `agentic-workflow-h9v3m`'s job (ADR-0003 seam).
- Canvas: section 09 gained `HiddenDependencySpecimen` (collapsed, open, and a
  third group proving coexistence with `attention`) and `EdgeBlinkSpecimen` (a
  mockup scroll frame with a top/bottom `chevrons-up`/`chevrons-down` `--rel-dep`
  chevron).
- 15 new `node --test` cases (`test/dependency-present.test.mjs`,
  `test/edge-blink.test.mjs`); full suite 157/157 passing. `dashboard/dist/` was
  **not** touched.
- No new ADR: the design (hollow vs. filled, direction-agnostic marker, the
  cornerAction-style primitive seam for the edge-blink) was already decided in
  ADR-0034 pt. 6, which names this task explicitly.
- BC README updated (`design-system` Motion section + Pointers) documenting both
  mechanisms and reopening the styleguide gate for builder re-review.

Key files: `styleguide/app/motion.js`, `styleguide/app/collapsible.js`,
`styleguide/app/app.js` (canvas section 09), `styleguide/styles/agentheim.css`,
`styleguide/test/dependency-present.test.mjs`, `styleguide/test/edge-blink.test.mjs`.

## Notes
Reopens the design-system gate (new `Collapsible` prop + visible marker, new
primitive, canvas specimens) — same precedent chain as `design-system-w4t9k`. Needs
builder re-review before `agentic-workflow-h9v3m` ships.

Do not overload `Collapsible`'s existing `attention` prop (design-system-v8k2p /
ADR-0029) — `hasHiddenDependency` is intentionally a separate prop with a separate
meaning and lifecycle.
