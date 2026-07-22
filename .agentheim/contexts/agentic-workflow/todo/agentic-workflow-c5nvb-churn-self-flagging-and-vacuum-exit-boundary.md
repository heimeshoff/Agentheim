---
id: agentic-workflow-c5nvb
title: Session-start churn re-flags work's own trailer-less fallback commits; vacuum-guard exits leave no session-end boundary
status: todo
type: bug
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: []
tags: [dorc-audit-followup, session-start-churn, vacuum-guard]
related_adrs: [0066, 0064, 0026]
related_research: []
prior_art: [agentic-workflow-hhjjx, agentic-workflow-qz1h7]
---

## Why

Two compounding gaps in the new session-start reconciliation:

1. `skills/work/SKILL.md:42` names only `modeling` DISMISS and brainstorm as known
   trailer-less machine commit shapes — but work itself mints trailer-less commits when a
   session completes no task: `chore: work session end bookkeeping`, `chore: rotate
   protocol — …`, `chore: rotate INDEX done-list — …` (:539, :605-607, :666-668). These
   get flagged as "human churn" at the next session start.
2. A vacuum-guard exit (:64) skips the session-end protocol entry entirely, so
   `resolveSinceLastSessionEnd`'s window reaches back past such sessions — the same
   untrailed commits get re-flagged every subsequent session until a real session-end
   entry lands.

Together: an idle-ish period (exactly when the vacuum guard fires) generates recurring
false churn noise, eroding trust in the advisory that exists to catch real human churn.

## What

1. Add work's own fallback commit shapes to the known-machine-shapes list in the churn
   step (and keep the list adjacent to where those shapes are defined, or point at
   `references/commit-doctrine.md` once it lists them — see agentic-workflow-d7ksw for the
   commit-doctrine table gap).
2. On a vacuum-guard exit, write a minimal session-end protocol entry (type Work / Session
   end, zero tasks, one line noting the vacuum exit) so the churn window has a boundary.
   Keep it cheap — no batch-mix line for an empty batch unless trivial to include.

## Acceptance criteria

- [ ] The churn step's known-shapes list covers every trailer-less commit message work itself can mint (session-end bookkeeping, both rotations, batch-start is trailered — verify which shapes actually lack trailers and cover exactly those).
- [ ] A vacuum-guard exit writes a session-end protocol entry that `resolveSinceLastSessionEnd` resolves (unit-testable against `lib/session-start-churn.mjs`'s heading regex).
- [ ] A test in `lib/test/session-start-churn.test.mjs` covers a work-minted fallback shape not being classified as human churn, if the classification moves into the lib; if it stays conductor prose, the skill text enumerates the shapes verbatim.
- [ ] `node --test lib/test/*.test.mjs` green.

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (finding L5). The fix touches
`skills/work/SKILL.md` (churn step + vacuum-exit step) and possibly
`lib/session-start-churn.mjs`.
