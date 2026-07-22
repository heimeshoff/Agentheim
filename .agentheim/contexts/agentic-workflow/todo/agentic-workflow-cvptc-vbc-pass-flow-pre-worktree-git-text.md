---
id: agentic-workflow-cvptc
title: verification-before-completion's PASS handling still describes the pre-worktree git model — staging the raw FILE_LIST on the main tree
status: todo
type: bug
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: [agentic-workflow-bx01e]
tags: [audit-2026-07-22-followup, doctrine-drift, verification]
related_adrs: [0057, 0032, 0038]
related_research: []
prior_art: [agentic-workflow-s9wtc]
---

## Why

`skills/verification-before-completion/SKILL.md:76` says that on PASS, `work` "proceeds to
move the task to `done/` (if the worker didn't already), runs `git add` on the FILE_LIST and
ancillary files, and commits." That is the retired shared-tree choreography.
`skills/work/SKILL.md:283-291` integrates via `git merge --squash aw/<task-id>`, and step 3's
`git add` covers only the `complete` manifest's `changed` paths + backlink files —
`skills/work/SKILL.md:149` explicitly forbids staging the raw FILE_LIST ("never the raw
FILE_LIST — `changed` is the guarded subset", ADR-0057's derived-artifact guard). An agent
following the VBC sentence would hand-stage FILE_LIST on the main tree — exactly the
`dashboard/dist/` restage the checkpoint/squash flow exists to prevent. The doctrine doc
already defers to work's template for its givens (line 26-28) but not for this
verdict-handling text.

## What

Rewrite the PASS-handling text in `skills/verification-before-completion/SKILL.md` to match
the actual choreography: squash-merge of the worktree branch, then the manifest-scoped stage
(`changed` paths + backlink files) — or simply defer to `skills/work/SKILL.md`'s integration
steps as the canonical source, the same way the doc already defers for the given-list.

## Acceptance criteria

- [ ] No sentence in `skills/verification-before-completion/SKILL.md` instructs staging the
      FILE_LIST: `grep -n "FILE_LIST" skills/verification-before-completion/SKILL.md` shows
      only guarded-subset framing or a pointer to `work`'s integration steps.
- [ ] The PASS-handling text names the squash-merge + manifest-scoped stage, or points at
      `skills/work/SKILL.md` as canonical (no third restatement of the git choreography).

## Notes

Found by the 2026-07-22 four-agent consistency audit (cross-doc drift finding #1, MEDIUM —
the only finding that could cause a wrong git action). s9wtc synced this file's checks two
days ago but this verdict-handling sentence survived that sweep.
