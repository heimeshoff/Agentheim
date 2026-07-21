---
id: agentic-workflow-hhjjx
title: Session-start human-churn reconciliation — diff human commits, flag ADR-governed files, surface re-alignment work
status: todo
type: feature
context: agentic-workflow
created: 2026-07-21
completed:
depends_on: []
blocks: []
tags: [work, bookkeeping, advisory, dorc-review]
related_adrs: [0027, 0026]
related_research: []
prior_art: [agentic-workflow-d6q4h]
---

## Why

Dorc review recommendation A6 (surviving piece 3 of 3): the builder's out-of-band
commits — a level reorg, a raw edit to a file governed by an ADR, with no amendment —
left the agents' world model stale. Tests pinned to the old state then failed
mysteriously, and whole tasks existed only to chase that churn after the fact. The drift
was discoverable at session start; nothing looked.

## What

A `work` session-start reconciliation step: enumerate commits since the last session's
end that lack a `[<task-id>]` trailer (i.e. human/out-of-band commits, per the ADR-0026
convention), list the files they touched, and flag any file governed by an ADR or
described in a BC README. Surface the result as an advisory (session-start line and/or
`whats-next`, ADR-0027 family) so the builder can approve explicit re-alignment tasks —
never auto-file tasks, never gate the session.

## Acceptance criteria

- [ ] `skills/work/SKILL.md` session start: commits since the last session-end protocol
      entry without a task-id trailer are enumerated with their touched files.
- [ ] Touched files are matched against governed surfaces (ADR-referenced paths, BC
      README runtime-surface manifests) and surfaced one line per hit.
- [ ] Advisory only: no auto-generated tasks, no gate; with no prior session-end entry
      (fresh project) the step skips silently.
- [ ] Deterministic detection (trailer parsing, commit-range resolution) lives in a
      git-reading but git-free-of-writes `lib/` helper with `node --test` coverage;
      judgment (what counts as governed, what to recommend) stays with the skill
      (ADR-0038 three-layer boundary).

## Notes

Source: Dorc agent-time review 2026-07, recommendation A6. Mirror image of d6q4h
(session-*end* carry-over reconciliation) — same slot at the other end of the session.
The trailer convention (ADR-0026) makes "human commit" cheaply detectable here, which
Dorc lacked.
