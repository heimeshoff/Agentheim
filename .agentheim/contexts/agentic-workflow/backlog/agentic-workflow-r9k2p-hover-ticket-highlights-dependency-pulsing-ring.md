---
id: agentic-workflow-r9k2p
title: Hover a backlog/todo ticket to highlight its dependencies with a pulsing ring
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: [agentic-workflow-d8q3n, design-system-w4t9k, design-system-b7n2s, agentic-workflow-k5p8w, agentic-workflow-h9v3m]
blocks: []
tags: [dashboard, board, motion, dependencies]
related_adrs: [0014, 0016, 0017, 0029, 0033, 0034]
related_research: []
prior_art: [agentic-workflow-030, agentic-workflow-013, agentic-workflow-t3b9k, agentic-workflow-n4h7q, design-system-004, design-system-v8k2p, design-system-005, agentic-workflow-012, agentic-workflow-014, agentic-workflow-m2v8d]
---

## Why
Dependencies between tickets are invisible on the board today — a card in backlog or
todo gives no hint of what it is waiting on, or what it is holding up. When triaging or
refining, the builder has to open the task and read `depends_on`/`blocks` to learn
what's connected. A hover-revealed cue turns that into an at-a-glance, zero-click
answer, in **both** directions: "what is this ticket waiting on?" and "what is this
ticket holding up?"

## What
This is an **umbrella task** — the four decisions below are now settled, and the actual
work is delivered by five child tasks (`agentic-workflow-d8q3n`, `design-system-w4t9k`,
`design-system-b7n2s`, `agentic-workflow-k5p8w`, `agentic-workflow-h9v3m`). This parent
carries the end-to-end Why/AC and is done only when all five are.

When the pointer hovers a ticket card **in the backlog or todo column**:

- Every card that ticket **`depends_on`** ("what it's waiting on") gets a
  **solid** breathing ring.
- Every card it **`blocks`** ("what it's holding up") gets a **dashed** breathing
  ring — the same hue, distinguished by line-style, not a second color.
- A target that's **visible** on the board pulses directly.
- A target hidden inside a **collapsed BC section** or the clamped **Done peek**
  gets a marker on that section/column's header instead ("a highlighted dependency
  is hidden in here").
- A target that's rendered but **scrolled out of the viewport** shows a blink at the
  top or bottom edge of the scroll area, pointing toward it; scrolling it into view
  turns the blink into a normal pulse.
- Moving the pointer away clears everything.

Hover source is **backlog/todo cards only** (doing/done cards reveal nothing on
hover); the **targets** being pulsed can live in any column, any bounded context.

This is presentation only: the board stays read-only over `.agentheim/` (ADR-0017). No
lifecycle move, no `/api` write — hover in, cues on; hover out, cues off.

## Acceptance criteria
- [ ] Hovering a **backlog** or **todo** card pulses a **solid** ring around each card
      it `depends_on`, and a **dashed** ring (same hue) around each card it `blocks`.
- [ ] Hovering a **doing** or **done** card reveals nothing.
- [ ] A target card is highlighted **wherever it lives** — any lifecycle column, any
      bounded context.
- [ ] A target inside a **collapsed BC section** shows a marker on that section's
      header (not the card itself, which isn't rendered while collapsed).
- [ ] A target clipped by the **collapsed Done peek** shows the same kind of marker on
      the Done column's header/collapse control.
- [ ] A target that's rendered but **outside the visible scroll viewport** shows a
      blink at the top or bottom edge of the scroll container, matching which
      direction the card lies; scrolling it into view replaces the blink with the
      normal on-card pulse, live (no re-hover needed).
- [ ] A ticket with **no** dependencies and **nothing depending on it** pulses/marks
      nothing on hover.
- [ ] A ticket with **multiple** dependencies/dependents pulses/marks all of them.
- [ ] Every cue is an **ambient pulse** (breathing loop), a third member of the
      existing motion taxonomy (doing-breathe ds-004, attention-dot ds-v8k2p), and
      clears the moment the hover ends.
- [ ] Every cue is **stripped to a static (non-animated) marker under
      `prefers-reduced-motion`** — never vanishes entirely, and direction (solid vs.
      dashed) stays legible with motion removed.
- [ ] No cue uses the reserved ochre selection accent `--accent-ochre-soft`
      (ADR-0016) — a dedicated new token is used instead.
- [ ] Hover-highlighting writes nothing to disk (read-only dashboard, ADR-0017).

## Notes

Decomposed at refine (2026-07-02) via the orchestrator, consulting `architect` (the
`/api/tree` projection shape and the off-screen/collapsed-group DOM-orchestration
mechanism) and `tactical-modeler` (the design-system token/component shape). Five
children, two ADRs:

1. **`agentic-workflow-d8q3n`** — carries `depends_on`/`blocks` through the
   `/api/tree` per-task projection (`tree.mjs`). Foundational; blocks nothing else's
   *design*, but the board wiring can't resolve edges without it.
2. **`design-system-w4t9k`** — the on-card dependency ring: the real styleguide
   blocker for this feature (swapped in for the placeholder `design-system-001`).
   Ships `--rel-dep`, `--duration-relation`, `dependencyRingClass()`, and
   `TicketCard`'s new `dependencyRelation` prop. ADR-0034 rides this task.
3. **`design-system-b7n2s`** — the hidden/off-viewport presence markers: extends
   `Collapsible` with `hasHiddenDependency` and ships a standalone off-viewport
   edge-blink motion primitive. Depends on `design-system-w4t9k` (reuses its token).
4. **`agentic-workflow-k5p8w`** — board wiring: pure hover→directional-target-id-set
   resolution + drives the ring on visible targets. Depends on `d8q3n` (data) and
   `w4t9k` (ring class).
5. **`agentic-workflow-h9v3m`** — board wiring: collapsed-group header markers +
   scroll-reactive off-viewport edge blinks (IntersectionObserver-driven). Depends
   on `k5p8w` (the hover session/target sets) and `b7n2s` (the marker primitives).
   ADR-0033 rides this task.

**Direction is one hue, not two.** `waiting-on` (this card's `depends_on`) and
`holding-up` (this card's `blocks`) are one bidirectional relation on **one**
dedicated token (`--rel-dep`), split by an orthogonal **line-style** channel (solid
vs. dashed) — this is what keeps direction legible after the reduced-motion strip
removes the loop. See ADR-0034.

**The cue is a full-card perimeter ring, not a rail treatment.** A dependency target
can simultaneously be an actively-doing card (ADR-0014's rail pulse) or a
freshly-arrived card (ADR-0029's rail attention dot) — a third rail-based cue would
collide with either. The perimeter is free of both.

**Off-screen orchestration is genuinely two different mechanisms, not one.** A
target hidden by a *collapsed* BC section has **no DOM node at all** (the closed
`Collapsible` doesn't render its body) — that's a pure data-layer derivation,
mirroring `rail-attention.annotateGroups`. A target that's *rendered but scrolled
away* needs real browser geometry (IntersectionObserver against the app's sole
vertical scroll container). The Done peek clamp is a hybrid: cards are in the DOM but
CSS-clipped, resolved by a bounded rect check against `PEEK_MAX_HEIGHT_PX`, not by
leaning on IntersectionObserver through the mask.

Open, non-blocking items carried into the ds tasks: the exact `--rel-dep` hue
(builder confirms at the styleguide gate), and whether the hidden-dependency marker
should ever need to be direction-aware (both specialists recommend against it — one
marker is enough).

Ready-to-promote entry points (no unmet dependencies): `agentic-workflow-d8q3n` and
`design-system-w4t9k`. The other three unlock as those land.
