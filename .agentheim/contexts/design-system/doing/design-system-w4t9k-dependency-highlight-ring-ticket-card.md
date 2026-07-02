---
id: design-system-w4t9k
title: Dependency-highlight ring — a third ambient-motion signal on TicketCard
status: todo
type: feature
context: design-system
created: 2026-07-02
completed:
depends_on: []
blocks: [design-system-b7n2s, agentic-workflow-k5p8w, agentic-workflow-r9k2p]
tags: [motion, ticket-card, dependencies]
related_adrs: [0014, 0016, 0029, 0003, 0034]
related_research: []
prior_art: [design-system-004, design-system-v8k2p, design-system-006, design-system-010]
---

## Why
`agentic-workflow-r9k2p` needs a hover-revealed cue on `TicketCard` marking "this
card is a dependency of the card you're pointing at" — in two directions (waiting-on
/ holding-up) that must stay distinguishable even with all motion stripped
(`prefers-reduced-motion`). This is the styleguide capability the feature's board
wiring is blocked on (swap `agentic-workflow-r9k2p`'s `depends_on` from the placeholder
`design-system-001` to this task once it lands).

## What
A third member of the ambient-motion taxonomy (alongside ADR-0014's doing-breathe and
ADR-0029's attention-dot): a breathing ring around a `TicketCard`'s **perimeter**
(not the rail — a target can simultaneously be an actively-doing card or a
freshly-arrived card, and a third rail-based cue would collide with either existing
one). Direction rides an orthogonal **line-style** channel on **one** dedicated hue,
not two separate colors:

- **`waiting-on`** (the card is in the hovered card's `depends_on`) → **solid**
  breathing ring.
- **`holding-up`** (the card is in the hovered card's `blocks`) → **dashed**
  breathing ring, same hue.

Concrete shape:

- **Token(s)** — `--rel-dep` (+ optional `--rel-dep-tint`) in **both** theme blocks of
  `styles/agentheim.css`, alongside the status palette. Distinct from every existing
  status/content-type hue and **never** aliases the reserved `--accent-ochre-soft`
  (ADR-0016). Proposed starting point: a cyan/aqua distinct from context-teal
  (`#1E88A8` light / `#5FC7DE` dark) — **builder confirms the exact hue at the gate**.
- **Duration token** — `--duration-relation: 2000ms` in `styles/colors_and_type.css`,
  beside `--duration-ambient` (2600ms) / `--duration-attention` (2200ms).
- **Keyframes + classes** (`styles/agentheim.css`), an **inset** `::after` ring (the
  card root is already `position: relative; overflow: hidden`, so an inset ring is
  clip-safe; an outer box-shadow ring would be clipped — do not use one without also
  lifting `overflow: hidden`):
  ```css
  @keyframes rel-ring-breathe { 0%,100%{opacity:.5} 50%{opacity:1} }
  .rel-ring::after {
    content:""; position:absolute; inset:0; border-radius:var(--radius-md);
    pointer-events:none; border:2px solid var(--rel-dep);
    box-shadow: inset 0 0 8px color-mix(in oklab, var(--rel-dep) 30%, transparent);
    animation: rel-ring-breathe var(--duration-relation) var(--ease-base) infinite;
  }
  .rel-ring--waiting-on::after { border-style: solid; }
  .rel-ring--holding-up::after { border-style: dashed; }
  @media (prefers-reduced-motion: reduce) {
    .rel-ring::after { animation: none; box-shadow: none; opacity: 1; } /* KEEP the ring */
  }
  ```
- **Helper** (`app/motion.js`, React-free, mirroring `doingPulseClass`/`attentionCueClass`):
  ```js
  export function dependencyRingClass(relation) {
    if (relation === "waiting-on") return "rel-ring rel-ring--waiting-on";
    if (relation === "holding-up") return "rel-ring rel-ring--holding-up";
    return "";
  }
  ```
- **`TicketCard` prop** (`app/kanban.js`) — new optional `dependencyRelation`
  (`"waiting-on" | "holding-up" | null|undefined`, default `null` → byte-identical to
  today). Appends `dependencyRingClass(dependencyRelation)` to the card root's
  `className`. Detection of which cards are targets and the hover lifecycle is the
  **consumer's** job (`agentic-workflow-k5p8w`); this only renders on/off. Re-export
  `dependencyRingClass` from `kanban.js` alongside `doingPulseClass`/`showEstimate`.
- **Canvas specimen** — section 06 (where the doing-pulse specimen lives): a
  `waiting-on` (solid) target card and a `holding-up` (dashed) target card side by
  side, plus a **doing** target card wearing both cues at once (proving no
  collision between the rail pulse and the perimeter ring).

## Acceptance criteria
- [ ] `--rel-dep` (and optional tint) exist in both light and dark theme blocks,
      distinct from every existing status/content-type token and from
      `--accent-ochre-soft`.
- [ ] `--duration-relation` exists in `styles/colors_and_type.css`.
- [ ] `dependencyRingClass("waiting-on")` returns a class producing a **solid**
      breathing ring; `dependencyRingClass("holding-up")` returns a class producing
      a **dashed** breathing ring of the same hue; any other input returns `""`.
- [ ] The ring is a full-card **perimeter** treatment (inset, clip-safe under the
      card's `overflow: hidden`), never a rail treatment.
- [ ] A doing card wearing `dependencyRelation` shows **both** the existing rail
      pulse (ADR-0014) and the new perimeter ring simultaneously, with no visual
      collision or z-fighting.
- [ ] Under `prefers-reduced-motion: reduce`, the ring's loop stops but the ring
      **stays visible** as a static solid/dashed border (never vanishes) — direction
      remains legible from line-style alone.
- [ ] `TicketCard` with no `dependencyRelation` (or `null`/`undefined`) renders
      byte-identical to today.
- [ ] `dependencyRingClass` is `node --test`-covered without the canvas import map.
- [ ] Canvas section 06 documents both directions plus the doing+ring coexistence
      case.
- [ ] `dist/` is **not** rebuilt by this task (no shipped dashboard consumer yet —
      the ds-020/021 pattern); the consuming board task rebuilds it.

## Notes
This reopens the design-system styleguide gate (new token, keyframes, `TicketCard`
visual, canvas specimen) — the ds-004/005/007/009/.../v8k2p/c3p9k precedent chain.
Needs builder re-review against the canvas before `agentic-workflow-k5p8w` ships.

**ADR-0034** rides this task — records the taxonomy extension: a third ambient signal,
its own dedicated token (breaking the "reuse an existing status token" pattern
ADR-0029 set), direction by line-style not hue, static-not-vanished under reduced
motion, card-perimeter not rail.

Do not fork a second token for the second direction — `design-system-b7n2s` and
`agentic-workflow-k5p8w`/`h9v3m` all reuse `--rel-dep` and `--duration-relation`
as-is.
