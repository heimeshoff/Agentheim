---
id: agentic-workflow-h3z5b
title: Resolve the two-orchestrators naming ambiguity
status: done
type: chore
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-02
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

Move the *loop* side of the name, leaving the agent untouched: the `work`
skill's driving loop becomes the **conductor**; the `orchestrator` agent keeps
its name. This is the safe direction — the agent's registry name is a spawn
identifier referenced across `modeling` / `brainstorm` / `worker`, whereas the
loop is prose-only.

**Scope is tight — one file plus two definitions.** A full scan (2026-07-02)
shows `work/SKILL.md` is the *only* file where "orchestrator" means the loop:
all ~14 of its occurrences ("The orchestrator (you)", "Git authority
(orchestrator only)", "Index updates (orchestrator-owned)", "the orchestrator
does this before spawning", …) refer to the driving session, not the agent.
Every other file — `modeling` (13 refs), `brainstorm` (2), `quick-capture` (1),
`verification-before-completion` (1), and `agents/orchestrator.md` — already
uses "orchestrator" correctly for the **agent** and must **not** be touched.
"conductor" is already the term the harness-audit doc gravitates to (`work
conductor`, `work (conductor)`), so it is the low-friction choice.

## Acceptance criteria

- [ ] Every "orchestrator" reference in `work/SKILL.md` that means the driving loop is renamed to **conductor** (section headings included: "Git authority", "Index updates", the "(you)" line). The word "orchestrator" survives in `work/SKILL.md` only where it genuinely refers to the agent (if anywhere — the worker, not the loop, spawns it).
- [ ] **conductor** is defined in both ubiquitous-language sections: the vision seed (`vision.md`) and the agentic-workflow BC README, as the `work` skill's non-code-writing driving loop, distinguished in the same breath from the `orchestrator` agent.
- [ ] No file reference or agent-spawn identifier changes — the rename is prose-only (the `orchestrator` agent's registry name is left exactly as-is).
- [ ] No stray "orchestrator" is left referring to the loop anywhere in `skills/` or the two ubiquitous-language sections (grep clean for the loop sense).

## Notes

Prose-only; the loop is the side that moves, so nothing breaks.

**Relationship to agentic-workflow-n6r8j (consultation flattening):**
conceptually adjacent — n6r8j narrows the orchestrator agent's *role*
(multi-specialist aggregation only), this clarifies its *name* vs the conductor
— but **file-independent**: n6r8j edits `agents/worker.md` + the orchestrator
agent's description, this edits `work/SKILL.md` + `vision.md` + the BC README.
The earlier "same files, one pass" note was wrong; there is no file overlap and
no `depends_on`. Either can go first. Doing them in one sitting is still
pleasant (both are "what does 'orchestrator' mean" cleanups) but not required.

## Outcome

Renamed all ~14 loop-sense "orchestrator" references in `skills/work/SKILL.md`
to **conductor** (section headings "Git authority (conductor only)", "Index
updates (conductor-owned)", the "(you)" line, and all inline prose mentions).
Grep-verified zero remaining "orchestrator" occurrences in that file. Added a
**conductor** bullet/clause to both ubiquitous-language sections
(`.agentheim/vision.md` and this BC's `README.md`), each distinguishing it
from the `orchestrator` agent in the same breath. No file references, paths,
or agent-spawn identifiers (`subagent_type: "orchestrator"`,
`agents/orchestrator.md`) were touched — confirmed by grep across `skills/`
that all remaining "orchestrator" mentions are in other files and correctly
refer to the agent.
