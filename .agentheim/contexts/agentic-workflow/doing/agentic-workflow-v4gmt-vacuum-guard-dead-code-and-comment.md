---
id: agentic-workflow-v4gmt
title: vacuum-guard.mjs carries dead regexes and a wrong repo-relative-path claim in classifyTask's comment
status: doing
type: chore
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: []
tags: [dorc-audit-followup, lib-cleanup, vacuum-guard]
related_adrs: [0064]
related_research: []
prior_art: [agentic-workflow-qz1h7]
---

## Why

Audit findings in `lib/vacuum-guard.mjs`:

1. `HARNESS_SEGMENT_RE` (:113) and `ADR_SEGMENT_RE` (:114) are defined but never used —
   `classifyTask` consults only `BOOKKEEPING_SEGMENT_RE`.
2. The comment at :108-112 claims segment matching works for "repo-relative paths" —
   false when the segment starts the string: repo-relative
   `.agentheim/knowledge/protocol.md` has no leading separator, fails
   `[\\/]\.agentheim[\\/]…`, so a bookkeeping-only chore with a repo-relative FILE_LIST
   silently classifies as "harness". Worker SUCCESS returns absolute paths today, so
   impact is latent and advisory-only — but the comment documents behavior the code
   doesn't have.

## What

Remove the two dead regexes, and either fix the comment to say "absolute paths (as
FILE_LIST provides)" or make the matcher genuinely handle a segment-initial relative path
(`(^|[\\/])` anchor) — worker's choice; the cheaper honest fix is fine, this is
advisory-only classification.

## Acceptance criteria

- [ ] No unused top-level regex constants remain in `lib/vacuum-guard.mjs`.
- [ ] The classifyTask comment matches actual matcher behavior; if the anchor fix is chosen instead, a unit test covers a segment-initial repo-relative bookkeeping path classifying as bookkeeping.
- [ ] `node --test lib/test/vacuum-guard.test.mjs` green (27 existing tests untouched or extended, none deleted).

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (finding G4).
