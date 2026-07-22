---
id: agentic-workflow-v4gmt
title: vacuum-guard.mjs carries dead regexes and a wrong repo-relative-path claim in classifyTask's comment
status: done
type: chore
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
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

- [x] No unused top-level regex constants remain in `lib/vacuum-guard.mjs`.
- [x] The classifyTask comment matches actual matcher behavior; if the anchor fix is chosen instead, a unit test covers a segment-initial repo-relative bookkeeping path classifying as bookkeeping.
- [x] `node --test lib/test/vacuum-guard.test.mjs` green (27 existing tests untouched or extended, none deleted).

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (finding G4).

## Outcome

Removed the two dead top-level regex constants (`HARNESS_SEGMENT_RE`,
`ADR_SEGMENT_RE`) from `lib/vacuum-guard.mjs` — `classifyTask` only ever
consulted `BOOKKEEPING_SEGMENT_RE`. Took the cheaper honest fix over the
anchor rewrite: corrected the comment above `BOOKKEEPING_SEGMENT_RE` to
state plainly that the segment match requires a leading separator and so
works for absolute `FILE_LIST` paths but not a repo-relative path where
`.agentheim` starts the string — matching actual matcher behavior instead
of the previous false "works for repo-relative paths" claim. No matcher
behavior changed, so all 27 existing `vacuum-guard.test.mjs` tests pass
unmodified; full suite (`lib/test/*.test.mjs`, 333 tests) also green.
