---
id: agentic-workflow-q3n7k
title: Update the workflow guide to reflect new features like inquire and what's next
status: done
type: feature
context: agentic-workflow
created: 2026-06-19
completed: 2026-07-03
depends_on: [design-system-001]
blocks: []
tags: [captured, dashboard, workflow-guide, docs]
related_adrs: ["0025"]
related_research: []
prior_art: [agentic-workflow-057, agentic-workflow-058, agentic-workflow-059, agentic-workflow-060, agentic-workflow-h7n2c, agentic-workflow-069, agentic-workflow-073, agentic-workflow-076]
---

## Why

The dashboard's **Workflow guide page** (the left-rail visual explainer of the
Agentheim workflow, `agentic-workflow-057`, delivered via aw-058/059/060) predates
the newer skills, so it no longer shows the full picture. Two shipped skills are
absent from it: `inquire` (read-only, code-grounded Q&A about the project —
aw-h7n2c) and `whats-next` (the planning advisory — aw-073 / aw-076 / aw-069). A
builder reading the guide today gets a stale map of the workflow.

## What

Update the dashboard Workflow guide page so its depiction of the Agentheim workflow
includes `inquire` and `whats-next` alongside `brainstorm` / `modeling` / `research`
/ `work`. **Target confirmed (2026-07-03): the dashboard Workflow guide page**
(the aw-057 three-segment left-rail explainer), not the top-level README — the
"workflow explainer" the capture named is that page, and it is where the skill
inventory lives.

- Add each newer skill to the guide's skill inventory / flow with a one-line role:
  `inquire` = read-only, code-grounded answers about how the project works and what
  was decided; `whats-next` = reads the boards + vision + protocol and recommends
  the next sensible move (advisory, never moves tasks).
- Place them correctly in the flow: `whats-next` sits at the planning/where-do-I-
  pick-up moment (before/around `modeling` and `work`); `inquire` is an
  any-time read-only lens over the built system.
- Update any guide **diagram or segment** that enumerates the workflow steps so it
  no longer omits the two skills — no stale skill list survives anywhere on the page.

## Acceptance criteria

- [ ] The dashboard Workflow guide page (aw-057/058/059/060 three-segment explainer) is updated to include the `inquire` skill and the `whats-next` skill in the workflow it depicts, each with a one-line role.
- [ ] The two skills are positioned correctly in the depicted flow (`whats-next` at the planning moment; `inquire` as an any-time read-only lens), not merely appended to a list.
- [ ] Every guide diagram / segment that enumerates the workflow steps reflects the current shipped skill set — no segment still shows a skill list that omits `inquire` or `whats-next`.
- [ ] The page still conforms to the styleguide (`design-system-001`) — no new unstyled patterns; reuses the existing segment / diagram / left-rail treatment (ADR-0025 built-in static page view state).
- [ ] Any existing guide test/assertion stays green; an assertion guards that the guide names both `inquire` and `whats-next` so this can't silently regress as more skills ship.

## Notes

Captured via `quick-capture` on 2026-06-19 — raw. Refined 2026-07-03 under the
builder's autonomous-refinement authorization: target confirmed (dashboard Workflow
guide page), concrete AC written, the styleguide gate honored (`depends_on:
design-system-001`, already **done** — a satisfied gate, kept for discipline since
this touches UI).

The guide's shell + three-segment layout is aw-059; the rail item + routing scaffold
is aw-058; the hand-authored flow diagrams are aw-060 — those are the surfaces this
edit touches. The skills to add: `inquire` (aw-h7n2c) and `whats-next` (aw-073 render
/ aw-076 advisory persist / aw-069 topbar launch).

## Outcome

Updated the built-in Workflow guide page (`dashboard/app/board.js`, `WorkflowPage` /
`PromoteWorkDiagram`) to add both skills, positioned per the AC:

- **`whats-next`** now opens the **Promote & Work** segment (both the hand-authored
  diagram and its caption copy) as a new `WNode` ("advisory") with a "recommends"
  arrow leading into `modeling` PROMOTE — the planning/where-do-I-pick-up moment,
  before PROMOTE/`work`, not appended after the pipeline.
- **`inquire`** is presented in a new, un-numbered "Any time" section rendered
  *after* the three `WorkflowSegment`s (`aria-label="Available any time"`) — framed
  as a read-only, code-grounded lens usable at any point in the workflow, kept
  deliberately outside the three-segment flow rather than tacked onto a segment's
  skill list.

Both additions reuse existing primitives only (`WNode`, `WArrow`, `WorkflowCaption`,
`Wcode`, design-system tokens) — no styleguide fork, no new dependency, page stays
static/read-only (ADR-0025 honored).

Added a regression test in `dashboard/test/workflow-page-content.test.mjs`
("the guide names both inquire and whats-next, correctly positioned in the flow")
asserting both skills are named AND correctly ordered (`whats-next` before
`verb="PROMOTE"`; `inquire` after the last `</${WorkflowSegment}>` close) — guards
against this regressing silently as more skills ship. Full dashboard suite
(`node --test`, 712 tests) and `node build.mjs` both pass.

Updated `.agentheim/contexts/agentic-workflow/README.md`'s Workflow-guide-page
paragraph to describe the new whats-next/inquire placement, keeping the README in
sync with the shipped page content.

Key files:
- `dashboard/app/board.js` (`PromoteWorkDiagram`, `WorkflowPage`)
- `dashboard/test/workflow-page-content.test.mjs`
- `.agentheim/contexts/agentic-workflow/README.md`
- `dashboard/dist/app.js`, `dashboard/dist/index.html` (rebuilt bundle)
