---
id: agentic-workflow-z394j
title: Mechanize-or-drop — a convention-establishing task ships its enforcement or records "prose-only, unenforced"
status: doing
type: feature
context: agentic-workflow
created: 2026-07-21
completed:
depends_on: []
blocks: []
tags: [doctrine, modeling, verifier, lint, dorc-review]
related_adrs: []
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

- [ ] `skills/modeling/SKILL.md` (CAPTURE + REFINE + PROMOTE readiness): a
      convention-establishing task must carry either an enforcement acceptance criterion
      or an explicit "prose-only, unenforced" marker; readiness fails if it has neither.
- [ ] `agents/verifier.md` / `skills/verification-before-completion/SKILL.md`: a
      convention task whose diff ships neither enforcement nor the marker is flagged
      (analogous to the existing check-6 ADR gate).
- [ ] An ADR records the doctrine, citing ADR-0044 / ADR-0052 as in-house exemplars of
      the enforced pattern.

## Notes

Source: Dorc agent-time review 2026-07, recommendation A3. Self-referential test case:
[[agentic-workflow-ngzwz]] (INDEX entry cap) is itself a convention capture and must
satisfy this rule — it ships a lint or records prose-only.
