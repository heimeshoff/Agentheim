---
id: ADR-0033
title: Ephemeral, hover-scoped DOM/viewport observation is admissible board-side
scope: agentic-workflow
status: proposed
date: 2026-07-02
related_tasks: [agentic-workflow-h9v3m, agentic-workflow-r9k2p]
related_adrs: [0017, 0002, 0014]
---

# ADR-0033: Ephemeral, hover-scoped DOM/viewport observation is admissible board-side

## Context

ADR-0017 established the dashboard as read-only: it never writes lifecycle state,
and every render is a pure projection of `/api/tree`, re-fetched on every SSE
`tree-changed` frame. Until now, nothing on the board has needed to read the
browser's own rendered geometry — every visual decision has been derivable from the
projected data plus persisted view-state (sort, group, collapse, peek).

The hover-dependency feature (`agentic-workflow-r9k2p`) breaks that pattern in one
specific way: to tell a builder "this dependency target is scrolled out of view,
look up/down," the board must know where a rendered card's bounding box actually
sits relative to the app's one scrolling region — information that exists only in
the browser's layout engine, not in any projected or persisted state. This is the
first board feature to reach for browser-geometry APIs (`IntersectionObserver`,
`getBoundingClientRect`) as a first-class mechanism.

A reader encountering this code without context could reasonably ask: "wait, is the
board even allowed to touch the DOM imperatively like this — didn't ADR-0017 make it
read-only?" That conflation is worth heading off explicitly, because ADR-0017's
"read-only" is about *disk and lifecycle truth*, not about whether the board may
observe its own rendered output.

## Decision

**Ephemeral, hover-scoped DOM and viewport observation is an admissible board-side
technique, orthogonal to the ADR-0017 lifecycle contract.** Specifically:

1. **`IntersectionObserver`, rooted on the app's sole vertical scroll container, is
   the sanctioned mechanism** for visible-vs-off-viewport classification of a
   dependency target. A manual `scroll`-event listener reimplementing rect math by
   hand is not — it reinvents `IntersectionObserver` at the cost of scroll-frame
   jank and edge-case fragility.
2. **Observers are mounted per interaction session (per hover) and disconnected on
   hover-end.** There is no always-on global observer watching every card at all
   times; the technique is scoped tightly to the moment it's needed.
3. **Data-layer state drives what geometry cannot.** Whether a target is hidden
   inside a *collapsed* board section is derived purely from projected data + view-
   state (mirroring `rail-attention.annotateGroups`'s "propagate a flag to a
   possibly-collapsed header" pattern) — a closed `Collapsible` renders no body, so
   there is no DOM node for geometry to find. Geometry is reserved for the one
   question only the DOM can truthfully answer: where does a *rendered* element
   currently sit relative to the visible viewport.
4. **These reads are transient presentation state only.** They never produce a disk
   write, never feed persisted view-state (`board-view-state.js`), never interpret a
   lifecycle transition, and produce no artifact that outlives the pointer hover
   that triggered them.

## Consequences

**Positive**
- ADR-0017's "read-only" is clarified rather than reinterpreted: it constrains
  *writes* to disk and lifecycle truth, not client-side geometry reads for
  transient, self-contained UI. Future features needing similar geometry (e.g. a
  "scroll to card" affordance) have a clear precedent to follow rather than a fresh
  ambiguity to resolve.
- The existing pure/DOM seam is preserved: id-set resolution
  (`agentic-workflow-k5p8w`), section-marker derivation, and edge-classification rect
  math (`classifyEdge`) all stay framework-free and `node --test`-covered; only the
  observer wiring and the edge-indicator overlay elements are browser-only and
  untested — matching the existing `autoGrowField`/`fireConfetti` precedent in
  `board.js`.
- Reduced-motion stripping (ADR-0014/0029's static-marker contract, inherited by
  `design-system-b7n2s`'s primitives) still applies to everything this technique
  drives.
- Fully reversible and low-risk: the mechanism is entirely client-local ephemeral
  state; removing it touches no disk shape, no other bounded context, and no
  persisted preference.

**Negative / cost**
- A second class of "what does the board know" now exists — projected/persisted data
  (everything else) versus live browser geometry (this feature alone) — a future
  reader needs to understand both to reason about the dependency-highlight feature
  fully.
- `IntersectionObserver` wiring is DOM-only and cannot be `node --test`-covered the
  way the rest of the board's transform pipeline is; correctness here relies on
  manual/visual verification more than the codebase's norm.

**Neutral**
- `IntersectionObserver` is a standard, well-supported browser API; no new runtime
  dependency is introduced.

## Alternatives considered

- **Manual `scroll` listener + `getBoundingClientRect` polling.** Rejected: reinvents
  `IntersectionObserver`, costs a layout read on every scroll frame, and is
  materially harder to get right at the viewport edges.
- **Server-side "is this visible" computation.** Not viable — visibility depends on
  live client scroll position and window size, information the read-only `/api/tree`
  server has no access to and should not be asked to track.
- **Skip the off-viewport case entirely (pulse visible targets only, silently no-op
  otherwise).** Rejected by the builder at refine — the explicit ask was a richer,
  three-part behavior (visible / hidden-in-collapsed-group / off-viewport-edge-blink),
  not a silent no-op.
