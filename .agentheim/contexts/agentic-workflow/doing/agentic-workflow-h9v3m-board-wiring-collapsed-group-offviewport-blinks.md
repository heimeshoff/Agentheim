---
id: agentic-workflow-h9v3m
title: Board wiring — collapsed-group markers and scroll-reactive off-viewport edge blinks
status: doing
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: [agentic-workflow-k5p8w, design-system-b7n2s]
blocks: [agentic-workflow-r9k2p]
tags: [dashboard, board, dependencies, motion, viewport]
related_adrs: [0017, 0033, 0014, 0029]
related_research: []
prior_art: [agentic-workflow-n4h7q, agentic-workflow-m2v8d, agentic-workflow-014, agentic-workflow-023]
---

## Why
`agentic-workflow-k5p8w` pulses dependency targets that are currently rendered on the
board, but says nothing about targets hidden inside a collapsed BC section, clipped
by the collapsed Done peek, or simply scrolled out of the visible viewport. Those are
exactly the cases the builder called out at refine: a hidden target needs a marker on
its group/column header, and an off-viewport (but rendered) target needs an edge
blink that turns into a normal pulse once scrolled into view.

## What
Given `agentic-workflow-k5p8w`'s resolved `waitingOn`/`holdingUp` target-id sets for
the active hover session, classify every target id into exactly one of three states
and drive the matching cue:

**1. HIDDEN-IN-COLLAPSED-GROUP → pure data derivation, no DOM.**
New pure module `dashboard/app/board-dependency-groups.js` (`node --test`-able,
mirrors `rail-attention.annotateGroups`): given the per-column `groupTickets`
sections, the collapsed-BC set (from persisted view-state), the target id sets, and
the Done column's `peek` boolean, derive:
- Per (column, BC) section: `hasHiddenDependency` — true when that section is
  currently **collapsed** and contains at least one target id.
- For the Done column specifically, when `peek === true`: whether at least one
  target id sits in Done. (Whether it's actually *clipped* by the peek window
  vs. still within it is resolved with one bounded rect check in step 2 below, since
  the peek is a height clamp, not a node-count cut — the pure derivation here only
  narrows to "Done is peeked and holds a target"; the DOM glue below refines it to
  "and it's actually below the fold.")

A closed `Collapsible` renders no body (its target cards have no DOM node at all —
they cannot be found by any geometry check), so this MUST be a data-layer derivation,
not a fallback of the IntersectionObserver path below.

Wire the result onto each grouped section's `Collapsible` via
`design-system-b7n2s`'s new `hasHiddenDependency` prop, and onto the Done column's
collapse control via the standalone `rel-present` class.

**2. VISIBLE vs. OFF-VIEWPORT → IntersectionObserver, root = the sole vertical scroll
container.** Per the BC README's shell layout, the app has exactly one scrolling
region (`overflow: hidden` on the outer shell; the inner `scroll-quiet` region is the
sole scroll container). On hover-start over a backlog/todo card (mirroring
`agentic-workflow-k5p8w`'s hover lifecycle), for every target id that IS currently
rendered (has a DOM node, per the `data-ticket-id` stamp `agentic-workflow-k5p8w`
already added), mount an IntersectionObserver against that scroll container:
- `entry.isIntersecting` → the target reads as VISIBLE (already pulsing via
  `agentic-workflow-k5p8w`'s wiring — nothing extra to do).
- Not intersecting → classify **above** or **below** via a pure helper:
  ```js
  // dashboard/app/board-dependency-groups.js (or a sibling pure module)
  export function classifyEdge(rect, rootBounds) {
    // rect, rootBounds: plain {top, bottom} shaped objects (from
    // entry.boundingClientRect / entry.rootBounds) — pure rect math, no DOM.
    // → 'above' | 'below' | 'visible'
  }
  ```
  Drive `design-system-b7n2s`'s `edgeBlinkClass("top"|"bottom")` on a small
  board-built edge indicator (a `--rel-dep`-tinted `chevron-up`/`chevron-down`
  `Icon`, token-styled, pinned to the scroll container's top/bottom edge — the board
  owns placement per ADR-0003's seam).
- Disconnect the observer on hover-end. No always-on global observer — mounted only
  for the duration of an active hover, matching `agentic-workflow-k5p8w`'s scoped
  lifecycle.
- **Scroll-reactivity is free**: IntersectionObserver re-fires as the target scrolls
  through the root, so OFF-VIEWPORT → VISIBLE (edge-blink replaced by the normal
  pulse) happens live, with no manual scroll listener.

**3. Done peek refinement.** For a target inside a peeked Done column, compare its
`boundingClientRect` against the clamp body's rect (import `PEEK_MAX_HEIGHT_PX` from
`board-view-state.js`, don't hardcode the pixel value): below the clamp's visible
window → route to the Done header marker (step 1); within it → it's genuinely visible
and pulses normally (step 2's IO path, since it has a real DOM node and Done isn't
otherwise clipped from the viewport).

**Reduced motion:** both the group/Done marker and the edge blink honor
`prefers-reduced-motion` (their design-system classes already strip to static per
`design-system-b7n2s`) — no additional board-side guard needed beyond using the
classes as shipped.

## Acceptance criteria
- [ ] `board-dependency-groups.js`'s section-derivation function is pure,
      `node --test`-covered, and mirrors `rail-attention.annotateGroups`'s shape
      (given sections + collapsed set + target ids → per-section
      `hasHiddenDependency`).
- [ ] `classifyEdge` is pure, `node --test`-covered, given plain rect-shaped objects
      (no DOM, no IntersectionObserver in the test).
- [ ] Hovering a backlog/todo card whose dependency target lives inside a
      **collapsed** BC section shows the hidden-dependency marker on that section's
      header, not on any card (none is rendered).
- [ ] Hovering a card whose target lives in a **peeked (collapsed) Done column, below
      the clamp** shows the marker on the Done collapse control.
- [ ] Hovering a card whose target lives in a **peeked Done column but still within
      the visible clamp window** pulses the card directly (no marker).
- [ ] Hovering a card whose target is rendered, section open, not clamped, but
      **scrolled above** the visible viewport shows a blink at the **top** edge of
      the scroll container.
- [ ] Same for **below** → **bottom** edge.
- [ ] Scrolling an off-viewport target into view, while the hover is still active,
      replaces its edge blink with the normal on-card pulse without re-hovering.
- [ ] Moving the pointer off the hovered card disconnects all observers and clears
      every marker/blink.
- [ ] No observer is mounted except during an active backlog/todo hover session (no
      always-on global observer).
- [ ] The dashboard `dist/` is rebuilt so the live board picks up
      `design-system-b7n2s`'s primitives.

## Notes
**ADR-0033** rides this task — this is the board's first use of browser-geometry
observation (IntersectionObserver, `getBoundingClientRect`) as a first-class
mechanism, close enough to ADR-0017's "read-only" framing that it's worth recording
the boundary explicitly: ADR-0017 constrains *writes* to disk/lifecycle truth, not
transient, hover-scoped client-side geometry reads.

Depends on `agentic-workflow-k5p8w` (needs its resolved target sets, hover session,
and `data-ticket-id` stamps) and `design-system-b7n2s` (the marker/edge-blink
primitives). This task deliberately does NOT touch the pure resolver from
`agentic-workflow-k5p8w` — it only adds classification and DOM orchestration on top.

The IntersectionObserver wiring itself, the scroll-container ref threading, and the
edge-indicator overlay elements are DOM/browser-only glue and are not unit-tested
(the existing `autoGrowField`/`fireConfetti` precedent in `board.js`) — only the pure
rect-math and data-derivation slices carry `node --test` coverage.
