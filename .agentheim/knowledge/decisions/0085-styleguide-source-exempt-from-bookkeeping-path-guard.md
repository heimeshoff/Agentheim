---
id: ADR-0085
title: Styleguide source is exempt from the worker bookkeeping-path guard
scope: agentic-workflow
status: accepted
date: 2026-11-03
related_tasks: [agentic-workflow-gvcy8, design-system-kw15t]
related_adrs: [0057, 0074, 0078, 0003, 0068, 0059]
---

# ADR-0085: Styleguide source is exempt from the worker bookkeeping-path guard

## Context

ADR-0078 moved the design-system styleguide source (`app/*.js`, `styles/`, `index.html`, `test/`) to `.agentheim/knowledge/contexts/design-system/styleguide/`. ADR-0074 (agentic-workflow-ghcaj) made a worker's branch code-only and has the checkpoint guard refuse every `.agentheim/` path as `bookkeeping-path`. Together, no worker could change the styleguide: its edits were silently dropped at checkpoint. Latent until design-system-kw15t (mermaid in the `Markdown` primitive).

## Decision

Amends ADR-0074. The styleguide subtree is source code, not bookkeeping, so it is carved out of the guard:

- `lib/derived-artifact-guard.mjs` exports `SOURCE_UNDER_AGENTHEIM_PREFIXES`, checked before the `bookkeeping-path` refusal. Its single entry is derived from `task-system-paths.mjs`'s `styleguideDir()` (never a second literal), so moving the styleguide moves the carve-out; a test pins the equality.
- Everything else under `.agentheim/` (board, decisions, READMEs, indexes, protocol) is refused exactly as before; report-carried bookkeeping (ADR-0074) is unchanged.
- Doctrine states the carve-out once, canonically, in `references/worker-return-format.md`; `agents/worker.md`, `skills/work/SKILL.md` (rule 10, checkpoint paragraph, merge-ladder rung 2) and `agents/verifier.md` point to it (ADR-0068). A live-tree test pins the canonical sentence and the pointers (ADR-0059).
- Merge-ladder rung 2 no longer reverts styleguide source as derived churn.

Rejected: moving the styleguide out of `.agentheim/` (reopens ADR-0078).

## Consequences

Workers can build styleguide features; the verifier no longer fails a diff solely for touching it. The carve-out is deliberately one subtree; other source-under-`.agentheim/` cases would need their own amendment.
