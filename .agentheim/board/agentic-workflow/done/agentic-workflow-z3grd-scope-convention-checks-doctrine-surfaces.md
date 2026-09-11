---
id: agentic-workflow-z3grd
title: Scope the mechanize-or-drop convention checks to doctrine-bearing surfaces — consumer product tasks skip check 6c
status: done
type: refactor
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: [agentic-workflow-bx01e]
tags: [audit-2026-07-22-followup, overshoot-tuning, mechanize-or-drop, verification]
related_adrs: [0059]
related_research: []
prior_art: [agentic-workflow-z394j]
---

## Why

Verifier check 6c asks "does this diff establish a convention?" on every verified task, on
opus, and `modeling`'s CAPTURE step 4 / PROMOTE step 2 mirror the same judgment at
refinement. The founding incidents (ADR-0059's Context) are two convention violations in
this repo's own harness development; a consumer's product tasks (game features, app code)
essentially never establish harness-style conventions. The check is a per-task judgment tax
for a self-hosting failure mode, and ADR-0059 itself warns of the false-positive pressure
(a verifier over-reading "convention" into an ordinary implementation choice and demanding a
brittle lint). Flagged by the 2026-07-22 overshoot review as its #3 candidate.

## What

Gate the convention checks on the task/diff touching doctrine-bearing surfaces — `skills/`,
`agents/`, `references/`, `lib/`, `.agentheim/knowledge/`, and BC README convention/
ubiquitous-language sections — and skip them otherwise:

1. `agents/verifier.md` check 6c: fire only when the diff touches a doctrine-bearing path.
2. `skills/modeling/SKILL.md` CAPTURE step 4 + PROMOTE step 2 convention checks: same scope
   condition, same wording.
3. Amend ADR-0059 to record the scoping and its rationale (self-hosting keeps full
   coverage; consumer product tasks exempt).

## Acceptance criteria

- [x] `agents/verifier.md` check 6c states the doctrine-bearing path scope and the skip.
- [x] `skills/modeling/SKILL.md`'s two convention checks carry the same scope condition.
- [x] ADR-0059 is amended recording the scoping.
- [x] `skills/verification-before-completion/SKILL.md`'s restatement (or pointer) of check
      6c is consistent with the new scope.

## Outcome

Scoped both mechanize-or-drop gates to doctrine-bearing surfaces (`skills/`, `agents/`,
`references/`, `lib/`, `.agentheim/knowledge/`, BC README convention/ubiquitous-language
sections):

- `agents/verifier.md` check 6c now states the scope gate up front and instructs the verifier
  to state the scope-and-skip in its evidence when the diff is out of scope.
- `skills/modeling/SKILL.md` CAPTURE step 4 and PROMOTE step 2 both gained the identical scope
  condition, worded consistently with the verifier check.
- `skills/verification-before-completion/SKILL.md`'s check 6c restatement updated to match.
- ADR-0059 amended with a "Doctrine-bearing-surface scoping" section recording the rationale
  (self-hosting keeps full coverage; consumer product tasks exempt) and a reference-list entry
  pointing at this task.
- BC README's Mechanize-or-drop glossary entry updated with the same scoping note so it stays
  in sync with the ADR and the gated checks.

No test/lint changes — this is a judgment-call prompt text scoping (mirrors ADR-0059's own
framing of the gate as LLM judgment, not a mechanizable predicate); TDD does not apply.

Key files: `agents/verifier.md`, `skills/modeling/SKILL.md`, `skills/verification-before-completion/SKILL.md`, `.agentheim/knowledge/decisions/0059-mechanize-or-drop-convention-enforcement-doctrine.md`, `.agentheim/contexts/agentic-workflow/README.md`.
