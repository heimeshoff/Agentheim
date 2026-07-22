---
id: agentic-workflow-zbbsw
title: Drift-twice rule — a restatement that drifts a second time is deleted and pointered, never re-synced
status: doing
type: decision
context: agentic-workflow
created: 2026-07-22
completed:
depends_on: []
blocks: []
tags: [audit-2026-07-22-followup, single-sourcing, meta-loop]
related_adrs: [0059]
related_research: []
prior_art: [agentic-workflow-s7d3k, agentic-workflow-s9wtc]
---

## Why

The doctrine-audit meta-loop (Dorc review → follow-up batch → residual batches) is
structurally refueled: every rule restated in 2-4 files generates genuine drift findings for
the next audit round, and each round re-synchronizes prose that will drift again. Concrete
evidence: `references/commit-doctrine.md`'s known-shapes text — created to support the churn
advisory — needed sync fixes in two of the three residual batches within one week (d7ksw,
c5nvb); `verification-before-completion` needed a six-drift sync (s9wtc) and still carried a
stale PASS-flow sentence two days later (cvptc). The missing bound on the meta-loop isn't a
cap on audits — it's making each audit round permanently shrink the drift surface. This
finishes the 2026-07-02 audit's recommendation #8, which the remediation wave only
half-executed.

## What

Write an ADR establishing the convergence rule: **when a restatement of doctrine is found
drifted for the second time, the fix deletes the restatement and leaves a pointer to the
canonical source — it never re-synchronizes the copy.** First-time drift may still be fixed
in place (the copy might be earning its keep); second-time drift is proof the copy costs
more than it serves. Name where the rule applies (modeling REFINE shaping drift-fix tasks,
workers executing them) and cite agentic-workflow-bx01e as the wave-scale application.

## Acceptance criteria

- [ ] An accepted ADR exists stating the drift-twice rule, its scope, and its enforcement
      disposition.
- [ ] The ADR is discoverable from where drift-fix tasks get shaped: `modeling`'s REFINE
      guidance (or the single-sourcing note in `references/`) points at it in one line.

## Notes

This task establishes a convention. Enforcement disposition: **prose-only, unenforced**
(ADR-0059) — "found drifted a second time" is a judgment over task history, not a lintable
predicate; the visible-decision record is this marker plus the ADR itself.
