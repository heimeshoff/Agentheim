---
id: agentic-workflow-bx01e
title: Strip duplicated rationale narration from the big prompts — rules stay imperative with ADR pointers
status: todo
type: refactor
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: [agentic-workflow-cvptc, agentic-workflow-mqwnc, agentic-workflow-z3grd, agentic-workflow-pzacx]
blocks: []
tags: [audit-2026-07-22-followup, overshoot-tuning, context-budget, single-sourcing]
related_adrs: [0059, 0060]
related_research: []
prior_art: [agentic-workflow-s7d3k, agentic-workflow-s9wtc]
---

## Why

Since the 2026-07-02 audit the skills/agents in scope grew +665 lines (+37%):
`skills/work/SKILL.md` 396→686 (+73%), `agents/verifier.md` 170→294 (+73%),
`skills/modeling/SKILL.md` 443→605. A large share is story, not instruction — the Dorc
pixel-metric anecdote is retold in six files (ADR-0061, ADR-0062, modeling, verifier, VBC,
TDD), and several steps embed multi-hundred-word rationale paragraphs whose content already
lives in the cited ADR. The original audit's headline complaint was the conductor burning
context on prompt mass; the remediation wave mechanized the writes but nearly doubled the
prompt. Every session pays this; the failure it prevents (an agent not knowing why a rule
exists) is already covered by the ADR pointer.

## What

Rewrite `skills/work/SKILL.md`, `skills/modeling/SKILL.md`, `agents/verifier.md`,
`skills/test-driven-development/SKILL.md`, and
`skills/verification-before-completion/SKILL.md` so each rule is stated once, imperatively,
with an `(ADR-NNNN)` pointer carrying the rationale. Turn VBC's numbered-checks section into
a pointer to `agents/verifier.md` (the same move its given-list already made — it needed a
six-drift sync (s9wtc) precisely because it restates). No doctrine content may be lost:
every rule present before exists after, as rule text or pointer. See the drift-twice rule
(agentic-workflow-zbbsw) for the standing doctrine this applies.

## Acceptance criteria

- [ ] The Dorc pixel-metric anecdote appears only in ADRs:
      `grep -rin "pixel" skills/ agents/` returns no narrative retelling (rule text naming
      the ADR is fine).
- [ ] Combined line count of `skills/work/SKILL.md` + `skills/modeling/SKILL.md` +
      `agents/verifier.md` is reduced by ≥150 lines against their pre-task state.
- [ ] `skills/verification-before-completion/SKILL.md`'s checks section is a pointer to
      `agents/verifier.md`, not a restatement.
- [ ] Every rule/step present before the rewrite is still present (as rule or pointer) —
      verified against a pre-task inventory of section headings and rule sentences.
- [ ] `node --test lib/test/*.test.mjs` still passes (lint fixtures that grep skill text
      still resolve).

## Notes

depends_on serializes this wholesale rewrite behind the four smaller edits touching the
same files (cvptc: VBC, mqwnc: verifier, z3grd: verifier+modeling, pzacx: work) — the
README-collision heuristic: never co-batch a wholesale rewrite with additive edits to the
same file.
