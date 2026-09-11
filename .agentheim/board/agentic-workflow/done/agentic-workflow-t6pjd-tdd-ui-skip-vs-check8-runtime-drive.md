---
id: agentic-workflow-t6pjd
title: TDD's UI-task skip advice contradicts verifier check 8 — manual browser exercise never substitutes for the runtime drive
status: done
type: bug
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: []
tags: [dorc-audit-followup, doc-sync, verification]
related_adrs: [0062, 0036]
related_research: []
prior_art: [agentic-workflow-vvmfy, agentic-workflow-y8b4q]
---

## Why

`skills/test-driven-development/SKILL.md:106` advises a worker on a UI task to "exercise
the change manually in the browser as a substitute" for tests. But the verifier's ADR-0036
narrowed manual-note rule says a self-reported "exercised manually" note is never
sufficient for a diff touching a runtime `surfacePath`
(`skills/verification-before-completion/SKILL.md:48,66`; check 8 HTTP-floor drive). A UI
task almost always touches a runtime surface — a worker following the TDD advice verbatim
walks straight into a check-1/check-8 FAIL, burning a dispatch iteration on doctrine that
contradicts itself.

## What

Amend the TDD skill's UI-skip bullet: the manual browser exercise covers only the
visual-DOM delta a test can't see, and never substitutes for check 8's runtime drive when
the BC declares a `## Runtime surface`. Point at ADR-0036 so the worker knows the verifier
will boot the app regardless.

## Acceptance criteria

- [x] The UI-skip bullet no longer presents manual exercise as a substitute where a runtime surface is declared; it names check 8 / ADR-0036 explicitly.
- [x] Wording is consistent with `agents/verifier.md` check 8 and the verification skill's manual-note rule (no third variant of the rule introduced).

## Notes

Found by the 2026-07-22 post-Dorc consistency audit (finding M2). Doc-only. Touches
`skills/test-driven-development/SKILL.md` in a different section than
agentic-workflow-r2hxk — hunks don't overlap, safe to co-batch.

## Outcome

Amended the UI-skip bullet (was line 106) in `skills/test-driven-development/SKILL.md`
`## When TDD does not apply` section: manual browser exercise is now scoped explicitly to
the visual-DOM delta a test can't see, and the bullet states it is never a substitute for
check 8's runtime drive (ADR-0036) when the BC README declares a `## Runtime surface` —
matching `agents/verifier.md` check 8 and `skills/verification-before-completion/SKILL.md`'s
narrowed manual-note rule verbatim in spirit, no new variant introduced. No other section
touched (TESTS_PASSING section at ~119-121 left untouched for agentic-workflow-r2hxk).
