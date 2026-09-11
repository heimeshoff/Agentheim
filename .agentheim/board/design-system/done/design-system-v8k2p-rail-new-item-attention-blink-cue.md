---
id: design-system-v8k2p
title: Rail "new item" attention blink — an ambient cue on a TreeItem / TreeGroup until acknowledged
status: done
type: feature
context: design-system
created: 2026-06-19
completed: 2026-06-19
depends_on: [design-system-001]
blocks: [agentic-workflow-n4h7q]
tags: [motion, rail, tree, ambient-cue, attention]
related_adrs: [0014, 0003, 0016, 0029]
related_research: []
prior_art: [design-system-004]
---

## Why
When the agent creates a new research report or ADR while the dashboard is open, the
artifact appears in the left-rail tree but nothing draws the eye to it — the builder has
no reason to notice it arrived. The system already has a precedent for *signalling state
through quiet ambient motion*: the doing-column card's "breathe" pulse (`design-system-004`,
**ADR-0014**). A "this just arrived — look here" cue is the sibling of that pulse, and it
belongs in the styleguide as a reusable capability rather than being invented board-side
(the styleguide gate; **ADR-0003** — consumers stay unforked).

This task is the **styleguide half**. The detection of *which* rail rows are new, and the
"until clicked or reloaded" lifecycle, are the dashboard's job (`agentic-workflow-n4h7q`),
which consumes this cue. Mirrors the `design-system-009 → agentic-workflow-039`,
`design-system-017 → agentic-workflow-048` capability-first ordering.

## What
Add an opt-in **attention / "new"** ambient cue to the rail's `TreeItem` (leaf row) and the
shared `Collapsible` group header (`TreeGroup`), keyed off a new boolean prop (e.g.
`attention` / `isNew`, default OFF — the `cornerAction` / `onAdd` absent-slot precedent), so
a flagged row/header **blinks** to draw the eye and an unflagged one is byte-identical to
today.

- The cue must apply to **both** a leaf `TreeItem` **and** a group header — the consumer
  propagates "new" up to the parent group so an arrival under a *collapsed* group is still
  visible (builder decision 2026-06-19). The styleguide just needs both surfaces to accept
  the flag and render the cue; the propagation logic lives in the consumer.
- **Stays inside the quiet-by-default law (ADR-0014).** Draws only from existing tokens — a
  status/foreground/surface token already in the set — and is **low-amplitude**. It must
  **never** borrow the reserved selection accent `--accent-ochre-soft` (**ADR-0016**), and
  should not introduce a new hue. The exact visual (opacity flash vs. a calmer pulse vs. a
  small dot/badge) is a **styleguide-gate decision with the builder** — "blink" is the
  intent, not a literal spec; the breathe pulse is the tonal reference.
- **Reduced-motion strippable.** Under `prefers-reduced-motion: reduce` it strips to a
  still-legible static baseline (the ADR-0014 standing contract — e.g. a steady dot/marker,
  no animation), pure progressive enhancement.
- Lives in the styleguide source (`styleguide/app/` — `kanban.js`/`tree` row, `collapsible.js`
  header, keyframes in `styles/agentheim.css`, any loop token in `styles/colors_and_type.css`),
  consumed by the dashboard **unforked** (ADR-0003). The pure decision (does this row render
  the cue?) should be React-free and `node --test`-able, mirroring `doingPulseClass`.

## Acceptance criteria
- [ ] A `TreeItem` and a `Collapsible`/`TreeGroup` header each accept a new opt-in boolean
      flag (default OFF); OFF renders byte-identical to today.
- [ ] When the flag is ON the surface shows a quiet "new/attention" cue that draws the eye,
      drawn from existing tokens — never `--accent-ochre-soft` (ADR-0016), no new hue.
- [ ] The cue honours `prefers-reduced-motion: reduce` by stripping to a still-legible static
      baseline (ADR-0014).
- [ ] The pure "should this render the cue" predicate is React-free and covered under
      `node --test` (mirrors `doingPulseClass` / `showEstimate`).
- [ ] The canvas (`styleguide/index.html`) demonstrates the cue on a tree row and a group
      header, both motion and reduced-motion behaviour visible for builder review.
- [ ] `dist/` is **not** rebuilt by this task (derived artifact, ADR-0003) — the consuming
      task `agentic-workflow-n4h7q` rebuilds it when the cue actually renders on the board.

## Notes
- **Gate.** This is a visible styleguide change → it **reopens the design-system gate** for
  builder re-review (the ds-005 / 007 / 009 / 014 / 015 / 017 / 018 / 020 / 021 precedent).
  Re-review the canvas before `agentic-workflow-n4h7q` ships.
- Prior art: `design-system-004` (the doing-column "breathe" ambient pulse) is the tonal and
  structural template — status-keyed `doingPulseClass()` in `app/motion.js`, keyframes in
  `styles/agentheim.css`, reduced-motion strip. Governed by [[ADR-0014]].
- Open (defer to gate / refine): is "blink" a true opacity flash, a calmer pulse, or a
  static "new" dot? The quiet-by-default doctrine leans away from an aggressive flash.
- Pairs with `agentic-workflow-n4h7q` (the dashboard detection + lifecycle).
- **ADR written:** [[ADR-0029]] (`.agentheim/knowledge/decisions/0029-ambient-attention-cue-distinct-from-active-status-pulse.md`)
  — the attention cue is a second, distinct ambient signal and keeps its marker
  under reduced motion (the one principled divergence from the doing-pulse).

## Outcome

The left rail now carries a quiet **"new item" attention cue** — the rail sibling
of the doing-card breathe (ADR-0014). A freshly-arrived `TreeItem` row or its
(possibly collapsed) `Collapsible` group header can render a **breathing left-edge
dot** that draws the eye until the consumer clears the flag. Opt-in and default
OFF on both surfaces, so an unflagged row/header renders **byte-identical** to
today.

The settled fork (deferred to the gate): the "blink" is a **quiet breathing dot**,
not an aggressive flash — consistent with the breathe-pulse tone.

- **Pure decision:** `attentionCueClass(isNew)` in `styleguide/app/motion.js`
  (React-free, `node --test`-able, mirrors `doingPulseClass`) — returns
  `"rail-attention"` when flagged, `""` otherwise.
- **Token:** `--duration-attention: 2200ms` in the motion block of
  `styleguide/styles/colors_and_type.css`.
- **CSS:** `@keyframes rail-attention-breathe` + `.rail-attention::before` (a
  `--st-todo` dot) in `styleguide/styles/agentheim.css`. Drawn from the existing
  `--st-todo` "incoming" token — **never** `--accent-ochre-soft` (ADR-0016), no
  new hue, low amplitude (ADR-0014).
- **Surfaces:** `attention` prop (default `false`) on `TreeItem`
  (`styleguide/app/library.js`) and `Collapsible`
  (`styleguide/app/collapsible.js`).
- **Reduced motion:** a `prefers-reduced-motion: reduce` guard stops the loop but
  **keeps a steady static dot** (`opacity: 1`) — the cue's information survives
  the strip, the one deliberate divergence from the doing-pulse (ADR-0029).
- **Canvas:** section 09 gains an "AttentionCueSpecimen" — a flagged vs. quiet
  tree row, and a flagged vs. quiet collapsed group header — for the gate review.
- **Tests:** `styleguide/test/attention-cue.test.mjs` (6 `node --test` cases) —
  the predicate is flag-keyed and default-OFF, the token exists, the keyframes/
  class draw from `--st-todo` and never the reserved ochre, and the reduced-motion
  guard keeps a static marker. All 14 styleguide test files green.
- **Consumer / `dist/`:** detection of *which* rows are new and the
  until-acknowledged lifecycle belong to `agentic-workflow-n4h7q`, which also
  rebuilds the derived `dist/` (ADR-0003) — **not rebuilt here**.

**Gate:** this is a visible styleguide/canvas change → it **reopens the
design-system gate** for builder re-review (section 09 attention specimen) before
`agentic-workflow-n4h7q` ships.

See ADR-0029 (`.agentheim/knowledge/decisions/0029-ambient-attention-cue-distinct-from-active-status-pulse.md`).
