---
id: agentic-workflow-h3z5b
title: Resolve the two-orchestrators naming ambiguity
status: backlog
type: chore
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, naming, ubiquitous-language, orchestrator, work-skill]
related_adrs: []
related_research: []
prior_art: []
---

## Why

"Orchestrator" names two different things: the `orchestrator` *agent* (the
modeling router) and the `work` skill's main loop ("The orchestrator (you)",
`work/SKILL.md:10`). In a harness whose method is ubiquitous language, its own
core vocabulary is conflated — a genuine confusion for humans and models
reading the docs. (Harness audit 2026-07-02, Phase 3 recommendation c.)

## What

Pick one term to move — e.g. the `work` main loop becomes the **conductor**
(a term some protocol prose already gravitates toward) while the agent keeps
`orchestrator` — and apply it consistently across skills, agents, README,
vision seed language, and the BC README's ubiquitous-language section.

## Acceptance criteria

- [ ] One name refers to exactly one thing everywhere: skills, agent definitions, README, vision, BC README.
- [ ] The renamed term is defined in the ubiquitous-language sections (vision seed + agentic-workflow README).
- [ ] No file reference or agent-spawn identifier breaks (the agent's registry name only changes if the *agent* is the one renamed — prefer renaming the loop, which is prose-only).

## Notes

Prose-only if the loop is the side that moves. Coordinate with
agentic-workflow-n6r8j (consultation flattening) — same files, one pass.
