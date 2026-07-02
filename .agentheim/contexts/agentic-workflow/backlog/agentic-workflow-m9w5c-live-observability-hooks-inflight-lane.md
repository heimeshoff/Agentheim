---
id: agentic-workflow-m9w5c
title: Live observability — hooks write agent status to state/, dashboard renders an in-flight lane
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: [design-system-001]
blocks: []
tags: [harness-audit, observability, hooks, dashboard, work-skill, state]
related_adrs: ["0027", "0017"]
related_research: [work-session-presence-lock-2026-06-15, work-terminal-completion-signal-2026-06-15]
prior_art: [agentic-workflow-076, agentic-workflow-073]
---

## Why

The dashboard shows only resting state on disk. During a `work` batch,
in-flight workers and verifiers are invisible — no live agent status, no
progress, until files land and the watcher fires. For a harness whose pitch is
parallel dependency-aware execution, the parallelism can't be seen happening.
The harness has zero hooks despite two research reports (2026-06-15) designing
exactly this. (Harness audit 2026-07-02, ⊕ finding from the Opus cross-check.)

## What

- `SubagentStop`/`Stop` (and possibly `SessionStart`) hooks write agent
  status + timing (+ token counts if available) to `.agentheim/state/` — the
  ADR-0027 advisory-write home, git-ignored, machine-written.
- The dashboard renders an in-flight lane from those signals (read-only,
  ADR-0017 — it observes, never drives), with the staleness-window reaping the
  presence-lock research already designed.

## Acceptance criteria

- [ ] A running `work` batch is visible on the dashboard: which workers/verifiers are in flight, since when.
- [ ] Status signals live under `.agentheim/state/` as advisory writes (ADR-0027) — never lifecycle writes.
- [ ] A crashed/killed session's stale signals age out via a staleness window (no zombie in-flight lane).
- [ ] The dashboard remains read-only over `.agentheim/` (ADR-0017).

## Notes

Note the audit's caveat: hooks are session-wide and can't distinguish worker
from orchestrator for *guardrails* — but observability hooks don't need to
distinguish; they just record. Split candidate at refinement: (1) hook + state
schema, (2) dashboard lane UI. Both prior research reports are directly on
point — read them first.
