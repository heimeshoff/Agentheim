---
id: agentic-workflow-x4t2g
title: whats-next feeds back into planning — modeling and work read the advisory at session start
status: done
type: feature
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-03
depends_on: []
blocks: []
tags: [harness-audit, whats-next, vision, planning, three-loops]
related_adrs: ["0027", "0017"]
related_research: []
prior_art: [agentic-workflow-076, agentic-workflow-073]
related_tasks: []
---

## Why

The Why→What feedback edge is missing: once `vision.md` is written, nothing
structurally re-checks in-flight planning against it. `whats-next` reads the
vision's success criteria and gaps — but its artifact
(`.agentheim/state/whats-next.md`) dead-ends at the dashboard panel; no other
skill reads it. The vision can quietly drift from what's being built and only a
human notices. (Harness audit 2026-07-02, What-loop closure gap; mechanism ⊕
from the Opus cross-check.)

## What

Make the advisory artifact a real planning input: `modeling` and `work` read
`state/whats-next.md` (when present) in their "Before acting" / batch-planning
steps, so the vision-gap analysis re-enters the loop — informing refinement
questions and batch prioritization instead of waiting for a human to relay it.

**Scope is the READ edge only.** This task adds two *reader* consumers to the
existing advisory write (aw-076); it does not touch how the advisory is
produced, and it does not add any new evaluation/check. The heavier
"does in-flight work still serve the vision's success criteria / violate a
non-goal?" conformance check — floated in this task's original Notes — is split
out to its own backlog task `agentic-workflow-v6d4n` (session-end / verify-path
vision-conformance check), because it is a different mechanism (it *evaluates
and flags*, this task only *reads*).

### Surfacing (decided this refine)

The read is **surfaced explicitly**, never folded in silently. When the advisory
is present, each skill names it to the builder before acting and folds it into
its reasoning — it must stay visible influence, matching the human-in-the-loop
non-goal (vision.md §Non-goals 3):

- `modeling` (in "Before acting", after the protocol read): if
  `state/whats-next.md` exists, note the latest recommendation to the builder in
  one line (the *recommended move* section + its age) and let it weight the
  REFINE/CAPTURE questions — it never auto-picks a task to refine or auto-routes
  a capture.
- `work` (at batch planning, before dispatching workers): if present, note the
  recommendation and let it inform **ordering/priority among already-ready
  tasks** — it never overrides the dependency DAG, never promotes, never picks an
  un-ready task.

### Staleness (decided this refine)

Staleness is computed against the **newest Work entry in `protocol.md`** (a
`## … -- Work / …` batch-start / completion / session-end heading), which both
skills already read in "Before acting", so the correlation is ~free:

- advisory `generated` timestamp **newer than** the newest Work protocol entry →
  treat as **current** input to this session's planning.
- advisory `generated` **older than** the newest Work protocol entry → work has
  happened since it was written; treat it as **background context**, not a
  directive (surface it, but flag it stale and lean on it less).
- No Work entries in protocol yet → not stale (nothing has happened since).

This keeps the advisory strictly advisory (ADR-0027): staleness softens *how
much weight* a skill's reasoning gives it — it never gates a lifecycle action, so
it does not re-open ADR-0017's read-only-over-lifecycle stance. (Distinct from
the dashboard consumer, where staleness is render-only per ADR-0027 §4; here the
consumer is a reasoning skill, and "weigh it less" is still advisory, not a
behavior gate on disk.)

## Acceptance criteria

- [x] `modeling`'s "Before acting" reads `state/whats-next.md` when it exists and surfaces the latest *recommended move* + its age to the builder in one line before acting; a missing artifact is silent (no line, no error).
- [x] `work`'s batch-planning step reads `state/whats-next.md` when it exists and lets it inform ordering/priority among already-ready tasks, surfaced in the batch rationale; a missing artifact is silent.
- [x] The advisory stays advisory: neither skill auto-moves, auto-promotes, auto-picks, or overrides the user's explicit ask or the dependency DAG (ADR-0027 advisory-write boundary + ADR-0017 hold).
- [x] Staleness is respected: an advisory whose `generated` predates the newest Work entry in `protocol.md` is surfaced as **stale/context**, not directive; a fresher advisory is surfaced as current. No Work entries → not stale.
- [x] A malformed / partial / headingless advisory degrades gracefully — the skill reads what it can and proceeds; it never blocks the session or throws.

## Notes

- **Split-off:** the session-end / verify-path vision-conformance check that lived
  in this task's original Notes is now `agentic-workflow-v6d4n`. The two are
  independent (v6d4n reads `vision.md` directly, not the advisory), so there is
  **no** `depends_on` edge between them — cross-referenced only.
- No new ADR required: ADR-0027 already draws the advisory-write boundary and
  this task only adds consumers of it; the staleness-weighting nuance above is
  recorded here rather than as a decision, since it changes no contract.
- Doctrine-only change: edits `skills/modeling/SKILL.md` ("Before acting") and
  `skills/work/SKILL.md` (batch planning). No dashboard/server/frontend surface —
  not a UI task, so no design-system styleguide gate applies.
- **Ready to promote** after this refine: concrete scope, testable criteria,
  unblocked (whats-next write aw-076 + dashboard read aw-073 both `done`). Left in
  `backlog/` for the builder to promote deliberately.

## Outcome

Closed the Why→What advisory loop's READ edge: `modeling` and `work` now surface the
`whats-next` advisory to the builder before acting, as visible influence only — never a
lifecycle gate — per ADR-0027 §4.

- **`skills/modeling/SKILL.md`** — "Before acting" gained step 6 (after the protocol read,
  renumbering the old steps 6-7 to 7-8): if `state/whats-next.md` exists, note the latest
  *recommended move* + age in one line, weighted current/stale by comparing `generated`
  against the newest `Work / …` protocol entry (no Work entries → not stale). Lets it weight
  REFINE/CAPTURE questions; never auto-picks a task or auto-routes a capture. Missing file is
  silent; malformed/partial/headingless degrades gracefully (reads what's parseable, never
  blocks or throws).
- **`skills/work/SKILL.md`** — Phase 3 (Conflict pre-scan) gained step 3, "Weigh the planning
  advisory," between the merge-order annotation (old step 2) and the batch cap / lowest-numbered
  pick (old step 3, renumbered to step 4): the advisory can nudge ordering/priority among
  already-ready tasks (e.g. tie-breaking, dispatch-earlier-in-batch) with the same
  current/stale staleness rule against the newest `Work / …` protocol entry — it never
  overrides the DAG, promotes an un-ready task, or demotes a ready one. Added an optional
  `**Planning advisory:**` line to the "Batch started" protocol-entry format (Protocol logging
  section) so the weighting is surfaced in the batch rationale when present, and omitted
  entirely when the artifact is absent.
- **`.agentheim/contexts/agentic-workflow/README.md`** — extended the existing advisory-write
  paragraph (originally written for aw-076/aw-073) with one paragraph noting the two new READ
  consumers and their posture, so future sessions don't think the dashboard is still the only
  reader.

Both edits keep the advisory strictly advisory per ADR-0027 §4 (frontmatter `generated` is a
descriptive staleness cue, not load-bearing) and do not re-open ADR-0017's
read-only-over-lifecycle stance — a reasoning skill weighing an artifact less when stale is
still advisory, not a behavior gate on disk. Doctrine-only change (no runtime code, no new
ADR — ADR-0027 already governs); TDD does not apply, per the task's own scoping note.

Split-off `agentic-workflow-v6d4n` (session-end/verify-path vision-conformance check) remains
independent, cross-referenced only, no `depends_on` edge.
