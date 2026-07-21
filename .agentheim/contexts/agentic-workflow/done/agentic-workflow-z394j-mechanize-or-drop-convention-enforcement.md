---
id: agentic-workflow-z394j
title: Mechanize-or-drop — a convention-establishing task ships its enforcement or records "prose-only, unenforced"
status: done
type: feature
context: agentic-workflow
created: 2026-07-21
completed: 2026-07-21
depends_on: []
blocks: []
tags: [doctrine, modeling, verifier, lint, dorc-review]
related_adrs: [0059]
related_research: []
prior_art: []
---

## Why

Dorc review recommendation A3: agents twice violated a convention that was *literally in
their context* (the no-hand-typed-UID rule) — prose rules do not bind agent behavior.
The cheap enforcement (a one-evening text lint) was proposed only after the convention's
violation had caused the week's largest rabbit hole. Agentheim's own history proves the
enforced alternative works: ADR-0044 (id-grammar live-tree lint) and ADR-0052
(agent-spawn namespace lint) both shipped their check with the convention.

## What

Elevate to doctrine: any task that **establishes a convention** must either ship its
enforcement (a lint, a live-tree `node --test` check, a build failure) *in the same
task*, or explicitly record **"prose-only, unenforced"** in the task file — so an
unenforced convention is a visible decision, never an accident.

## Acceptance criteria

- [x] `skills/modeling/SKILL.md` (CAPTURE + REFINE + PROMOTE readiness): a
      convention-establishing task must carry either an enforcement acceptance criterion
      or an explicit "prose-only, unenforced" marker; readiness fails if it has neither.
- [x] `agents/verifier.md` / `skills/verification-before-completion/SKILL.md`: a
      convention task whose diff ships neither enforcement nor the marker is flagged
      (analogous to the existing check-6 ADR gate).
- [x] An ADR records the doctrine, citing ADR-0044 / ADR-0052 as in-house exemplars of
      the enforced pattern.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A3. Self-referential test case:
[[agentic-workflow-ngzwz]] (INDEX entry cap) is itself a convention capture and must
satisfy this rule — it ships a lint or records prose-only.

## Outcome

Elevated "mechanize-or-drop" to project doctrine, recorded as **ADR-0059**. Two gates added,
both mirroring the existing ADR-worthiness gate shape (LLM judgment, not a mechanized script,
since "does this establish a convention" is a semantic question, unlike ADR-0044/ADR-0052's
mechanically-checkable target rules):

- `skills/modeling/SKILL.md` — CAPTURE step 4 ("Decide refinement level") and PROMOTE step 2
  ("Check readiness") each gained a **Convention check** bullet: a convention-establishing
  task is not "Ready"/does not pass readiness without either an enforcement acceptance
  criterion or an explicit "prose-only, unenforced" marker. REFINE inherits PROMOTE's check
  verbatim via its existing auto-promote step, so all three flows named in this task's ACs are
  covered.
- `agents/verifier.md` — new **check 6c** ("Mechanize-or-drop — convention enforcement"),
  placed beside the existing ADR gate (6/6b), FAILing a convention-establishing diff that ships
  neither enforcement nor the marker. Mirrored in
  `skills/verification-before-completion/SKILL.md`'s numbered check summary as item **6c**.
  Existing check numbers 7/8 were left untouched (both are referenced by name in eval fixtures
  — `check6-wording-fix-run`, `add-check8-runtime-drive-fixture` — so renumbering them would
  have broken those cross-references).
- `.agentheim/contexts/agentic-workflow/README.md` gained a **Mechanize-or-drop** ubiquitous-
  language entry pointing at ADR-0059.

**Self-referential compliance:** this task is itself convention-establishing and satisfies its
own rule by **shipping enforcement**, not the prose-only marker — its own two doctrine
acceptance criteria (the readiness gate + verifier check 6c) *are* the mechanism that will
catch a future convention-task shipping neither. See ADR-0059's "Self-referential compliance"
section for the full reasoning.

TDD was not applicable: the deliverable is doctrine prose (two `SKILL.md` files, one agent
definition file) plus an ADR — no executable code was introduced, so there is no `lib/` module
to unit-test. Verified by manual read-through of both edited flows (CAPTURE/PROMOTE readiness,
verifier check 6c) against the acceptance criteria, and by confirming existing check-number
cross-references (evals fixtures naming check 6/8) remain intact.

Files: `skills/modeling/SKILL.md`, `agents/verifier.md`,
`skills/verification-before-completion/SKILL.md`,
`.agentheim/knowledge/decisions/0059-mechanize-or-drop-convention-enforcement-doctrine.md`,
`.agentheim/contexts/agentic-workflow/README.md`.
