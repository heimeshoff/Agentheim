---
id: agentic-workflow-059
title: Workflow page shell + three-segment layout
status: done
type: feature
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
commit: bae517d
depends_on: [design-system-001, agentic-workflow-058]
blocks: [agentic-workflow-060, agentic-workflow-057]
tags: [frontend, ui, docs, onboarding]
related_adrs: [0003, 0017, 0025]
related_research: []
prior_art: [agentic-workflow-027, agentic-workflow-040]
---

## Why
With the routing scaffold landed (aw-058), the Workflow page needs its real structure:
the three labelled segments that explain Agentheim's workflow, with supporting caption
copy. This task builds the **static page shell and layout** — the frame the diagrams
(aw-060) will hang in — and the honest, skill-accurate captions. Splitting layout from
diagrams keeps each commit reviewable and lets the verifier check the prose for accuracy
independently of the visuals.

## What
Replace aw-058's placeholder with the real **static, built-in** Workflow page body: three
labelled segments, in order, each a titled section with supporting caption text and
**placeholder diagram slots** (filled by aw-060). The page is read where there is room —
a comfortable centered reading measure consistent with the main-pane reader (aw-040).

The three segments and the **real** flow each must describe (corrected for accuracy
during refinement — keep the copy honest against the actual skills/vision):

1. **Preparation** — `brainstorm` (no-code Socratic dialogue, six modes) produces
   **vision.md** + **context-map.md**, then the foundation pass stands up the
   **infrastructure BC**, **foundation decision tasks**, a **walking-skeleton spike**,
   and (if the vision implies frontend) the **design-system styleguide gate**. *Gate: no
   code is written in Preparation.*
2. **Capturing** — two intake doors into `backlog/`: **`quick-capture`** (fast, no
   questions, raw) and **`modeling` CAPTURE** (Socratic). **`modeling` REFINE** deepens a
   task; **`research`** feeds external knowledge mid-model (gated by **`research-reviewer`**
   before it is citable); **`modeling` DISMISS** cascade-deletes an abandoned task under
   one confirmation (ADR-0022). *Gate: refinement is human-in-the-loop.*
3. **Promote & Work** — **`modeling` PROMOTE** (`backlog → todo`, readiness check) →
   **`work`** resolves the dependency DAG and dispatches **parallel TDD workers** → each
   SUCCESS passes a fresh-context **`verifier`** gate (FAIL re-dispatches up to twice,
   then escalates to the builder) → **commit** (one task = one commit). *Gates: the user
   reviews tasks before `work`; the verifier guards every commit; failures escalate to
   the human.*

Captions are **supporting** — the primary medium is the diagrams (aw-060). Static and
built into the bundle (no `/api/doc` fetch), read-only (ADR-0017), styleguide tokens/
primitives consumed **unforked** (ADR-0003), no new bundled dependency.

## Acceptance criteria
- [ ] The page renders **three named segments in order**: **Preparation**, **Capturing**,
      **Promote & Work**, each a clearly labelled section.
- [ ] Caption copy names the **real** verbs/skills and **gates** per the corrected flow
      above: quick-capture **and** modeling as two distinct intake doors; the
      **`verifier`** named correctly (not "verify"); DISMISS present; the
      human-in-the-loop gates marked.
- [ ] Each segment carries **placeholder diagram slots** ready for aw-060 to fill.
- [ ] The page is **static / built-in** (not fetched from disk), renders correctly in
      **both light and dark themes**, and keeps a comfortable centered reading measure
      consistent with the main-pane reader (aw-040).
- [ ] Read-only (ADR-0017); styleguide consumed unforked (ADR-0003); no new bundled
      runtime dependency.
- [ ] `dashboard/dist/` is rebuilt so the deployed app carries the layout.

## Notes
- Source of truth for the copy: `.agentheim/vision.md` and this BC's README
  ("Key commands", "Adversarial gate", "Ubiquitous language"). Keep it honest — the
  refinement found the original capture copy understated Preparation and the gates.
- Layout is **board-local** under `dashboard/app/`; the diagram primitives are also
  board-local (decided in refinement — no design-system child task; aw-060 authors them).
- Depends on aw-058 (the routing scaffold must exist first) — now **done** (commit `ad4a6f0`).
  The placeholder `WorkflowPage` lives in `dashboard/app/board.js`; replace its body, keep
  the function name and the `onSelectWorkflow` / `mainView === "workflow"` wiring untouched
  (that is aw-058's routing, governed by ADR-0025 — do not re-touch the rail or the handlers).
- **Keep aw-058's routing tests green.** `dashboard/test/workflow-rail-routing.test.mjs` asserts
  the page exists and carries a "Workflow" heading; the real page must still satisfy that (a
  Workflow/"Workflow guide" heading). Update only the placeholder-specific assertion if the
  exact heading text changes — do not weaken the routing/precedence/mutual-exclusivity guards.
- Diagram slots are **placeholders only** in this task — empty, clearly-marked slots that
  aw-060 fills with the hand-authored visuals. Do not author diagrams here (that is aw-060).
- Frontend gate met: `design-system-001` (styleguide) is in `done/`.

## Outcome
Replaced aw-058's placeholder `WorkflowPage` body in `dashboard/app/board.js` with the
real static three-segment guide. Kept the `WorkflowPage` function name and aw-058's
`onSelectWorkflow` / `mainView === "workflow"` routing untouched (ADR-0025 scaffold not
re-touched). Added three board-local presentational helpers above the page —
`WorkflowSegment` (numbered, labelled section + an empty, clearly-marked placeholder
diagram slot for aw-060 + an explicit human-in-the-loop **Gate** marker),
`WorkflowCaption`, and `Wcode` (monospace token for naming skills/verbs/artifacts) —
all composed from styleguide tokens consumed unforked (ADR-0003).

The page renders three named segments in order — **Preparation** (`brainstorm` → vision/
context-map + foundation pass with the walking-skeleton spike and design-system gate),
**Capturing** (`quick-capture` and `modeling` CAPTURE as two distinct intake doors,
`modeling` REFINE, `research` gated by the `research-reviewer`, `modeling` DISMISS), and
**Promote & Work** (`modeling` PROMOTE → `work`'s parallel TDD workers → the fresh-context
`verifier` gate, FAIL re-dispatches up to twice then escalates to the builder → one task =
one commit). Copy names the **verifier** correctly (never "verify"), marks the gates, and
keeps the main-pane reader's centered measure (maxWidth 760, margin `0 auto`). Static /
read-only — no `/api/doc` fetch, no `isTaskIntent`, no new bundled dependency.

Key files:
- `dashboard/app/board.js` — `WorkflowSegment` / `WorkflowCaption` / `Wcode` helpers + the
  real `WorkflowPage` body (replaced the placeholder).
- `dashboard/test/workflow-page-content.test.mjs` — new source-reading static guard (9
  tests): segment order + names, honest skill/verb/gate copy, the verifier-not-"verify"
  check, three placeholder diagram slots, the 760/`0 auto` reading measure, and the
  static/read-only/unforked invariants.
- `dashboard/dist/app.js` (+ rest of `dist/`) — rebuilt via `node build.mjs` so the
  deployed bundle carries the layout.
- `dashboard/test/workflow-rail-routing.test.mjs` (aw-058) stays green unchanged.

Full dashboard suite: 515 tests passing. No ADR written (the page follows the AboutPage
precedent under the existing ADR-0025/0017/0003 decisions; no new decision made).
