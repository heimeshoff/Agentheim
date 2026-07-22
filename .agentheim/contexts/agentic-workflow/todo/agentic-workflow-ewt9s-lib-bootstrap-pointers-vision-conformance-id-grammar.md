---
id: agentic-workflow-ewt9s
title: Consumer-install bootstrap coverage missing for the vision-conformance and classifyTaskId call sites
status: todo
type: bug
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: []
tags: [audit-2026-07-22-followup, consumer-install, lib-bootstrap]
related_adrs: [0038, 0044, 0040]
related_research: []
prior_art: [agentic-workflow-b4yrm]
---

## Why

agentic-workflow-b4yrm gave the four conductor-executed helpers runnable consumer-install
invocations via `references/lib-bootstrap.md`, but two call-site families outside its scope
still name lib functions with no resolution path — in a consumer project (where `lib/` is
not at the repo root) the conductor cannot run them:

1. `skills/work/SKILL.md:556-560` names four `lib/vision-conformance.mjs` exports
   (`extractVisionSections`, `labelFor`, `formatConformanceLine`, `worthSurfacing`) for the
   session-end vision-conformance pass (ADR-0040) with neither a runnable invocation nor a
   lib-bootstrap pointer.
2. The `classifyTaskId` mint-time backstop (`skills/modeling/SKILL.md:399`,
   `skills/quick-capture/SKILL.md:162`) points at `lib/id-grammar.mjs` the same way.

## What

Extend `references/lib-bootstrap.md` with sections for `lib/vision-conformance.mjs` and
`lib/id-grammar.mjs` (`classifyTaskId`), using the same env-free resolve-plugin-file
bootstrap as §1-§4, and point the three call sites at the new sections. While rewriting the
intro, correct its helper/one-liner count — it currently says "five near-duplicate
one-liners" while the file already carries six (audit finding; the count must match the
final section set).

## Acceptance criteria

- [ ] `references/lib-bootstrap.md` carries runnable invocations for
      `lib/vision-conformance.mjs` and `classifyTaskId` from `lib/id-grammar.mjs`.
- [ ] `skills/work/SKILL.md`'s vision-conformance step, `skills/modeling/SKILL.md`'s and
      `skills/quick-capture/SKILL.md`'s mint backstops each cite their lib-bootstrap §.
- [ ] The lib-bootstrap intro's stated one-liner count matches the file's actual sections.

## Notes

Found by the 2026-07-22 board/mechanization audit — same class as b4yrm, explicitly noted
there as outside its scope. The pure `node --test` lints (spike-stop-loss,
human-eye-criteria, index-entry-length) legitimately need no conductor invocation and stay
out of lib-bootstrap.
