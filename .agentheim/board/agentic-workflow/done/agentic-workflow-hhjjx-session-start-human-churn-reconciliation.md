---
id: agentic-workflow-hhjjx
title: Session-start human-churn reconciliation — diff human commits, flag ADR-governed files, surface re-alignment work
status: done
type: feature
context: agentic-workflow
created: 2026-07-21
completed: 2026-07-21
depends_on: []
blocks: []
tags: [work, bookkeeping, advisory, dorc-review]
related_adrs: [0027, 0026, 0066]
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

- [x] `skills/work/SKILL.md` session start: commits since the last session-end protocol
      entry without a task-id trailer are enumerated with their touched files.
- [x] Touched files are matched against governed surfaces (ADR-referenced paths, BC
      README runtime-surface manifests) and surfaced one line per hit.
- [x] Advisory only: no auto-generated tasks, no gate; with no prior session-end entry
      (fresh project) the step skips silently.
- [x] Deterministic detection (trailer parsing, commit-range resolution) lives in a
      git-reading but git-free-of-writes `lib/` helper with `node --test` coverage;
      judgment (what counts as governed, what to recommend) stays with the skill
      (ADR-0038 three-layer boundary).

## Notes

Source: Dorc agent-time review 2026-07, recommendation A6. Mirror image of d6q4h
(session-*end* carry-over reconciliation) — same slot at the other end of the session.
The trailer convention (ADR-0026) makes "human commit" cheaply detectable here, which
Dorc lacked.

Decision recorded: ADR-0066 (`.agentheim/knowledge/decisions/0066-session-start-human-
churn-reconciliation.md`).

## Outcome

Added a `work` **session-start human-churn reconciliation** step (`skills/work/SKILL.md`,
new dedicated section run at the end of Phase 1, before Phase 2) — the mirror image of
`agentic-workflow-d6q4h`'s session-end carry-over reconciliation, at the other end of the
session. Per session: resolve the most recent `## ... -- Work session ended` protocol
entry as a boundary (`resolveSinceLastSessionEnd`; `null` → skip silently, the fresh-
project case), have the conductor read `git log --since=... --name-only
--format="%x1eCOMMIT%x1f%H%x1f%s"` (prose-only, never inside the `lib/` helper — ADR-0038
git-free boundary), then `parseCommitLog`/`hasTaskTrailer`/`findUntrailedCommits` filter to
commits whose subject carries no `[<task-id>]` bracketed trailer (ADR-0026). The skill
(not the helper) then judges which of those commits' touched files land on a governed
surface (an ADR-described file, or one a BC README documents as load-bearing) and
surfaces a session-start line — plus, when a governed hit exists, a `.agentheim/state/
whats-next.md` write (ADR-0027) — recommending the builder approve an explicit
re-alignment task. Never auto-files a task, never gates Phase 2. Deliberately does not try
to separate genuine human commits from the small number of machine-commit shapes that
also omit the trailer by convention (`modeling` DISMISS, `brainstorm`) — recorded as an
accepted, named cost in ADR-0066.

Deterministic detection is `lib/session-start-churn.mjs` (git-free per ADR-0038 — the one
git read stays a conductor prose step): `resolveSinceLastSessionEnd`, `parseCommitLog`,
`hasTaskTrailer`, `findUntrailedCommits`, `formatUntrailedCommitLine`,
`formatHumanChurnSummary`. 17 new `node --test` cases in
`lib/test/session-start-churn.test.mjs`; full `lib/test/*.test.mjs` suite (330 tests) is
green.

Decision recorded in **ADR-0066**. BC README gained a new ubiquitous-language entry under
the same bullet list as ADR-0064/0065.

Key files: `skills/work/SKILL.md`, `lib/session-start-churn.mjs`,
`lib/test/session-start-churn.test.mjs`,
`.agentheim/knowledge/decisions/0066-session-start-human-churn-reconciliation.md`,
`.agentheim/contexts/agentic-workflow/README.md`.
