---
id: agentic-workflow-060
title: Workflow guide diagrams (hand-authored flow visuals)
status: done
type: feature
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
commit:
depends_on: [design-system-001, agentic-workflow-059]
blocks: [agentic-workflow-057]
tags: [frontend, ui, docs, onboarding, diagrams]
related_adrs: [0003, 0017]
related_research: []
prior_art: [agentic-workflow-040]
---

## Why
The Workflow page is meant to be **mostly visual** — the workflow as a diagram, not prose
(umbrella aw-057). With the page shell and captions in place (aw-059), this task supplies
the actual **hand-authored flow diagrams** that carry each of the three segments, turning
the supporting captions into supporting text around a primary visual.

## What
Replace aw-059's placeholder diagram slots (the dashed `role="img"` frames in
`WorkflowSegment`, `dashboard/app/board.js`) with **hand-authored flow visuals** drawn
from the design-system tokens so they track the active light/dark theme. **No bundled
diagramming library** (decided at capture, 2026-06-17). The components are **board-local**
under `dashboard/app/` (decided in refinement — the seam test fails for a shared
design-system primitive: single consumer, content-bound shapes), with the styleguide
consumed **unforked** (ADR-0003), like the board's sort `<select>`, confetti, and
`StoppedOverlay` precedents.

**Three decisions from this refinement (2026-06-17) fix the form:**

1. **Honest topology per segment** — each diagram takes the shape of its *real* flow, not
   a uniform left-to-right lane. The three shapes differ on purpose.
2. **Skills & artifacts only** — nodes are the skills (`brainstorm`, `quick-capture`,
   `modeling`, `research`, `work`) and artifacts (`vision.md`, `context-map`, `backlog`,
   `todo`, `commit`). The adversarial gates and human-in-the-loop checks appear as a
   **marked checkpoint on an edge**, *not* as separate agent boxes — no `orchestrator` /
   specialist nodes, no `verifier` / `research-reviewer` boxes. This keeps the visuals at
   the same granularity as aw-059's captions.
3. **HTML + CSS boxes** — node boxes laid out with flexbox and **CSS-drawn connectors**
   (no inline SVG, no library). Every color/border/fill is a CSS var so light/dark
   tracking is automatic. Branching/looping arrows are built from token-styled
   borders/pseudo-edges, accepting that connectors are straighter than SVG curves.

**Per-segment diagram spec** (the shapes the worker builds; copy stays in aw-059's
captions, the diagram is the primary visual above them):

1. **Preparation — linear, then fan-out.**
   `brainstorm` → (`vision.md` + `context-map`) → a **fan-out** into the four foundation
   outputs: **infrastructure BC**, **foundation decision tasks**, **walking-skeleton
   spike**, and (frontend-only) the **styleguide gate**. The whole segment carries the
   **no-code** checkpoint marker (the human reviews before anything is stood up).
2. **Capturing — backlog hub with loops, not a line.**
   Two intake doors — `quick-capture` and `modeling` CAPTURE — converge on a central
   **`backlog`** node. Three operations loop back on the backlog: `modeling` REFINE
   (deepen), `research` (feed in, carrying the review checkpoint before it's citable),
   and `modeling` DISMISS (cascade-remove). The **human-in-the-loop** checkpoint marks the
   refine/promote-readiness edge.
3. **Promote & Work — pipeline with a retry loop.**
   `modeling` PROMOTE (`backlog → todo`) → `work` (parallel TDD workers) → a **verifier
   checkpoint on the edge** → `commit`. The checkpoint shows the **FAIL → re-dispatch
   (×2) → escalate** loop back to `work`, with the **user-reviews-before-work** checkpoint
   on the entry edge. One task = one commit.

## Acceptance criteria
- [ ] Each of the three segments is carried **primarily by a hand-authored diagram**
      built with **HTML + CSS boxes and CSS connectors** (no inline SVG, no library), with
      the existing aw-059 caption text as support.
- [ ] Each diagram uses the **honest per-segment topology** above: Preparation fans out to
      the four foundation outputs; Capturing is a backlog **hub** with the refine /
      research / dismiss **loops**; Promote & Work is a pipeline with the **verifier retry
      loop** (FAIL → ×2 → escalate).
- [ ] Nodes are **skills + artifacts only**; gates and human checks render as **marked
      checkpoints on edges**, never as separate `orchestrator` / specialist / `verifier` /
      `research-reviewer` boxes.
- [ ] Diagrams are built from **design-system tokens** and render correctly in **both
      light and dark themes** (they track the theme flip) — every color/border/fill is a
      CSS var, not a literal.
- [ ] **No bundled diagramming library** and **no new bundled runtime dependency** are
      introduced.
- [ ] Components are **board-local** under `dashboard/app/`; styleguide consumed
      **unforked** (ADR-0003); aw-059's `WorkflowPage` / `WorkflowSegment` routing and the
      `onSelectWorkflow` / `mainView === "workflow"` wiring (aw-058 / ADR-0025) stay
      untouched — only the placeholder slot's contents change. The worker edits only this
      BC's README.
- [ ] Honors **`prefers-reduced-motion`** if any motion is added (default: static, no
      motion — matches the read-only static page).
- [ ] Read-only (ADR-0017); `dashboard/dist/` rebuilt (`node build.mjs`) so the deployed
      app carries the diagrams; aw-059's `workflow-page-content.test.mjs` and aw-058's
      `workflow-rail-routing.test.mjs` stay green.

## Notes
- **Slot to fill:** `WorkflowSegment`'s placeholder is the dashed `role="img"` `<div>`
  (`minHeight: 132`) in `dashboard/app/board.js`. Replace its body with the diagram;
  preserve the segment's `role="img"` + descriptive `aria-label` (now describing the real
  flow, not "placeholder"). The diagram primitives are board-local helpers beside
  `WorkflowSegment` / `WorkflowCaption` / `Wcode`.
- **Accessibility:** with skills-and-artifacts-only nodes and edge checkpoints, each
  diagram still needs a faithful `aria-label` summarizing the flow (the visual is
  decorative-structural; the prose remains the captions beneath).
- Diagram primitives are **board-local** — no design-system child task (refinement
  decision; the seam test failed). If a second surface ever needs flow diagrams, promote
  them to a `design-system` primitive then.
- Depends on aw-059 (the slots must exist first) — now **done** (`bae517d`). This is the
  last piece of the umbrella aw-057 — when this lands, aw-057 closes.
- Frontend gate met: `design-system-001` (styleguide) is in `done/`.

## Outcome
Replaced aw-059's placeholder diagram slots with three hand-authored flow visuals, one
per segment, each carried above its existing captions. Built four board-local diagram
primitives beside `WorkflowSegment`/`WorkflowCaption`/`Wcode` in `dashboard/app/board.js`:
`WNode` (skill/artifact box, tinted from `--accent-ochre` vs `--surface-1`/`--hairline`
tokens), `WCheckpoint` (dashed edge-marker pill for gates / human checks — never an agent
box), `WArrow` (CSS-drawn connector with a rotated bordered arrowhead, `down`/`right`,
`fail`-tone for the verifier loop, `dashed` for loop-backs), and `WFanRow` (the fan-out
row). On top of those, three diagram components with HONEST per-segment topologies:
- `PreparationDiagram` — linear (`brainstorm` → no-code review checkpoint → `vision.md`
  + `context-map`) then fan-out to the four foundation outputs (infrastructure BC,
  foundation tasks, walking skeleton, styleguide gate).
- `CapturingDiagram` — two intake doors (`quick-capture`, `modeling` CAPTURE) converging
  on a central `backlog` hub, with three loop-back operations (`modeling` REFINE past a
  human-review checkpoint, `research` past a reviewer checkpoint, `modeling` DISMISS).
- `PromoteWorkDiagram` — pipeline `modeling` PROMOTE (`backlog → todo`) → user-reviews-todo
  checkpoint → `work` (parallel TDD) → `verifier` edge checkpoint → `commit`, with the
  FAIL → re-dispatch ×2 → escalate loop shown in `--obligation` tone. One task = one commit.

No inline SVG, no diagramming library, no new bundled dependency. Every color/border/fill
is a CSS var so light/dark theme tracking is automatic (asserted: no hardcoded hex in the
diagram block). Static, read-only (ADR-0017); no motion added (the prefers-reduced-motion
guard is conditional in the test and currently vacuous). `WorkflowSegment` now takes a
`diagram` + descriptive `diagramLabel`, keeping `role="img"`; the page passes a real-flow
`aria-label` per segment (no "placeholder"). aw-058/aw-059 routing wiring untouched.

Added static guard suite `dashboard/test/workflow-diagrams.test.mjs` (9 tests covering the
three topologies, no-SVG/no-library, edge-checkpoints-not-boxes, token-only colors, and the
read-only/aria contract). Updated the one now-stale placeholder assertion in
`dashboard/test/workflow-page-content.test.mjs` to guard the `role="img"` diagram frame
instead. Rebuilt `dashboard/dist/` (`node build.mjs`). Full `node --test` suite green
(551 pass, 0 fail). This closes umbrella aw-057.

Key files: `dashboard/app/board.js`, `dashboard/test/workflow-diagrams.test.mjs`,
`dashboard/test/workflow-page-content.test.mjs`, `dashboard/dist/`.
