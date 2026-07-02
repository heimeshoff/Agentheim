---
id: agentic-workflow-y8b4q
title: End-to-end verification step for tasks with a runtime surface
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, verifier, verification, e2e, ui]
related_adrs: []
related_research: []
prior_art: []
---

## Why

Verification stops at the unit-test suite — no step ever *runs the app* and
observes the change end-to-end. The UI-task carve-out is the softest spot: a
worker's self-reported "exercised manually" note is accepted as evidence by a
verifier who never sees the screen. The What-loop is strong on inner execution,
weak on closure. (Harness audit 2026-07-02, Phase 1 + recommendation #10.)

## What

Add a verification path for tasks with a runtime surface: drive the affected
flow (launch the dashboard, hit the endpoint, exercise the UI change — e.g. via
the existing launch tooling plus a scripted or screenshot-capable check) instead
of accepting a self-reported manual-exercise note.

## Acceptance criteria

- [ ] Tasks whose diff touches a runtime surface get an observable end-to-end check as part of verification, not just the unit suite.
- [ ] The worker's "manually exercised" self-report is no longer sufficient evidence on its own for UI tasks.
- [ ] Tasks with no runtime surface (docs, doctrine, pure refactors with test coverage) are explicitly exempt — no cargo-cult ceremony.

## Notes

Refinement questions: who drives (the verifier itself with Bash, or a dedicated
step in `work` before the verifier), what "observing" means for a local web UI
(HTTP assertions vs. screenshots), and cost — this should trigger on runtime
surface, not on every task.
