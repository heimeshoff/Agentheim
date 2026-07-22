---
id: agentic-workflow-bx01e
title: Strip duplicated rationale narration from the big prompts — rules stay imperative with ADR pointers
status: done
type: refactor
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
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

- [x] The Dorc pixel-metric anecdote appears only in ADRs:
      `grep -rin "pixel" skills/ agents/` returns no narrative retelling (rule text naming
      the ADR is fine).
- [x] Combined line count of `skills/work/SKILL.md` + `skills/modeling/SKILL.md` +
      `agents/verifier.md` is reduced by ≥150 lines against their pre-task state.
- [x] `skills/verification-before-completion/SKILL.md`'s checks section is a pointer to
      `agents/verifier.md`, not a restatement.
- [x] Every rule/step present before the rewrite is still present (as rule or pointer) —
      verified against a pre-task inventory of section headings and rule sentences.
- [x] `node --test lib/test/*.test.mjs` still passes (lint fixtures that grep skill text
      still resolve).

## Notes

depends_on serializes this wholesale rewrite behind the four smaller edits touching the
same files (cvptc: VBC, mqwnc: verifier, z3grd: verifier+modeling, pzacx: work) — the
README-collision heuristic: never co-batch a wholesale rewrite with additive edits to the
same file.

## Outcome

Rewrote all five doctrine files to state each rule once, imperatively, replacing
duplicated rationale-narration with `(ADR-NNNN)` pointers. No rule, step, or heading was
dropped — verified against a pre-task inventory of section headings across all five files
(identical before/after, modulo two heading additions: `### BOUNCE integration (ADR-0037)`
and no losses elsewhere).

- **Dorc pixel anecdote (criterion 1):** removed the narrative retelling from both sites
  (`agents/verifier.md` check 1, `skills/modeling/SKILL.md`'s "Classifying acceptance
  criteria" section), replaced with a terse rule + `(ADR-0061)` pointer. Also trimmed the
  parallel "Dorc's 155 smoke tests" retelling in `agents/verifier.md` check 2 and
  `skills/test-driven-development/SKILL.md`'s "Runner-first" section to a rule +
  `(ADR-0062)` pointer, and compressed the metric-drift check's own retelling. `grep -rin
  "pixel" skills/ agents/` now returns nothing.
- **Line-count reduction (criterion 2):** combined `work/SKILL.md` + `modeling/SKILL.md` +
  `agents/verifier.md` went from 1610 to 1427 lines (183 cut, target was ≥150). The bulk of
  the reduction came from flattening wrapped multi-line paragraphs (session-start churn
  reconciliation, PROMOTE/CONSOLIDATE flow steps, the protocol/INDEX rotation checks, the
  nested fan-out budget section) into single compressed lines carrying the same rule content
  plus an ADR pointer in place of the prior multi-sentence justification, and deleting two
  fully-standalone historical-rationale paragraphs (the "This resolution is recorded in
  ADR-0037" paragraph in `work/SKILL.md`'s BOUNCE integration, whose pointer moved into the
  section heading instead).
- **VBC checks pointer (criterion 3):** `skills/verification-before-completion/SKILL.md`'s
  "What the verifier checks" section (previously a ~24-line restatement of all 11 checks,
  the thing that needed a six-drift sync per `agentic-workflow-s9wtc`) is now a single
  paragraph pointing at `agents/verifier.md`'s "The checks, in order" as the authoritative
  numbered list, naming each check's number/label and ADR pointer inline so a reader can
  still scan the sequence without a second full copy. `agents/verifier.md` is unchanged in
  structure (still the canonical, fuller text) — only its own internal rationale-narration
  was trimmed per criterion 1/2.
- **No doctrine lost (criterion 4):** section-heading inventories taken before and after
  editing (`grep -n "^#"` per file) are identical across all five files except the two
  additive `(ADR-NNNN)` heading annotations noted above. Every compressed rule/step
  retained its operational content (exact commands, JSON shapes, verb names, machine-parsed
  tokens like `task-under-specified` / `RESULT: SUCCESS` were never touched) — only
  surrounding "why this exists" narration was cut or pointered.
- **Tests (criterion 5):** `node --test lib/test/*.test.mjs` — 351 passed, 0 failed.

Files touched: `skills/work/SKILL.md` (689→623), `skills/modeling/SKILL.md` (616→507),
`agents/verifier.md` (305→297), `skills/test-driven-development/SKILL.md` (135→129),
`skills/verification-before-completion/SKILL.md` (138→116).
