---
id: agentic-workflow-s9wtc
title: verification-before-completion SKILL.md drifted behind verifier.md — sync checks, tokens, salvage, and the given-list
status: done
type: bug
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: []
tags: [dorc-audit-followup, doc-sync, verification]
related_adrs: [0061, 0062, 0063]
related_research: []
prior_art: [agentic-workflow-mxk6v, agentic-workflow-vvmfy, agentic-workflow-hvqa4, agentic-workflow-z394j]
---

## Why

The Dorc wave updated `agents/verifier.md` and `skills/work/SKILL.md` thoroughly, but the
verification doctrine doc (`skills/verification-before-completion/SKILL.md`) was only
partially updated. Six confirmed drifts:

1. Check **6b** (Honored related ADRs, `agents/verifier.md:186-194`) is missing — the doc
   jumps 6 → 6c.
2. Check 7's title/scope omits the INDEX half ("No protocol, index, or git tampering";
   `references/worker-return-format.md:29` cross-references that exact title).
3. The FAIL template shows prose ITERATION_HINT values instead of the machine-parsed
   tokens `likely-fixable | task-under-specified` (work's escalation branch string-matches
   the latter, `skills/work/SKILL.md:166`).
4. "What the verifier is given" (:26-32) omits the pre-resolved test command, pre-resolved
   launch command, worktree path, and iteration number — all inputs its own checks gate on.
5. Task-file location says "currently in `doing/`" — a SUCCESS worker has already moved it
   to `done/` inside the worktree; work's own template says "doing/ or done/".
6. The FAIL-iteration-3 bullet (:111-112) predates ADR-0063 — no mention of the mandatory
   worktree-diff salvage and the escalation naming the patch.

## What

Sync the doctrine doc with `agents/verifier.md` and `skills/work/SKILL.md` on all six
points. Where a full restatement invites future drift, prefer a pointer to the
authoritative file (verifier.md for the check list, work's Verifier Prompt Template for
the given-list) over a second copy.

## Acceptance criteria

- [ ] Check 6b appears between 6 and 6c with semantics matching verifier.md.
- [ ] Check 7's title and scope include the INDEX prohibition.
- [ ] The FAIL template's ITERATION_HINT values are exactly `likely-fixable` and `task-under-specified`.
- [ ] The given-list matches verifier.md's inputs (or is replaced by a pointer to work's template).
- [ ] Task-file location reads "in `doing/` or `done/` inside the worktree".
- [ ] The FAIL-third-time bullet names the ADR-0063 salvage (patch tagged `escalated-iterN`, escalation names the patch path).

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (findings F1-F6/M3). Doc-only.

## Outcome

Synced `skills/verification-before-completion/SKILL.md` to `agents/verifier.md` and
`skills/work/SKILL.md` on all six drifts:

1. Inserted check **6b** ("Honored related ADRs") between checks 6 and 6c, matching
   `agents/verifier.md:186-194`'s semantics (contradicts / silently-ignores / supersedes-without-ADR).
2. Renamed check 7 to "No protocol, index, or git tampering" and added the INDEX prohibition
   to its scope, matching `references/worker-return-format.md:29`'s exact cross-referenced title.
3. Replaced the FAIL template's prose `ITERATION_HINT` values with the exact machine tokens
   `likely-fixable | task-under-specified`.
4. Replaced "What the verifier is given"'s restated field list with a pointer to
   `skills/work/SKILL.md`'s Verifier Prompt Template (pre-resolved test/launch commands,
   worktree path, iteration number all live there now — avoids a second copy drifting).
5. Folded the "task-file location" fix into the same pointer rewrite — now reads "in `doing/`
   or `done/`, inside the worktree", matching work's own template wording.
6. Added the ADR-0063 mandatory worktree-diff salvage (tag `escalated-iterN`, `## Salvage
   note` naming the patch path, escalation summary naming the patch explicitly) to the
   FAIL-iteration-3 bullet under "What `work` does with each verdict".

Doc-only change; no production code touched. Verified `node --test lib/test/*.test.mjs` stays
green (330/330 pass) post-edit — this run rebuilds `dashboard/dist/` as a side effect, expected
and not part of this task's diff.

Key file: `skills/verification-before-completion/SKILL.md`.
