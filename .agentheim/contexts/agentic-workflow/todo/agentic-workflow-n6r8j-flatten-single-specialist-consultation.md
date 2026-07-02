---
id: agentic-workflow-n6r8j
title: Flatten single-specialist consultations — worker spawns the specialist directly
status: todo
type: refactor
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: []
blocks: []
tags: [harness-audit, orchestrator, worker, consultation, cost]
related_adrs: [0035]
related_research: []
prior_art: [agentic-workflow-h3z5b]
---

## Why

The worker→orchestrator→specialist consultation path is three agent contexts
deep (the conductor spawns the worker, the worker spawns the orchestrator, the
orchestrator spawns the specialist). For the common single-specialist question
("does this need an ACL?", "what aggregate does this belong to?") the
orchestrator's entire contribution is routing — matching the question to a row
in its Signal→Specialist table, a static lookup, not judgment. The worker
already holds the `Agent` tool and can do that lookup itself. The orchestrator
earns its keep only when multiple specialists must be aggregated and conflicts
surfaced. (Harness audit 2026-07-02, Phase 3 recommendation b; decision recorded
in ADR-0035.)

## What

Let the worker spawn the needed specialist (`architect`, `tactical-modeler`,
`strategic-modeler`, `researcher`) **directly** for single-specialist
questions, and keep the orchestrator agent for the multi-specialist /
conflict-surfacing case (its "Running specialists in parallel" + "Integrating
results" sections keep their job). The worker already has the `Agent` tool — no
tool-frontmatter change. This is a prose-only doctrine edit to two files:
`agents/worker.md` (consultation guidance) and `agents/orchestrator.md`
(description + the "when I'm still the path" rule). ADR-0035 already records the
decision; this task makes the two agent docs match it.

**Boundary rule (put verbatim in both docs so neither leaves a gray zone):**
route direct-to-specialist only when *exactly one* row of the routing table
matches and no aggregation / conflict-surfacing is needed; route through the
orchestrator when the question spans more than one specialist's domain, when
answers must be aggregated, or when the worker cannot rule out that a second
specialist's concern applies (conservative default — when in doubt, escalate to
the orchestrator rather than guess).

## Acceptance criteria

- [ ] `agents/worker.md`'s "Second action: plan briefly" (and the consultation
      sentence there) instructs **direct** specialist consultation for
      single-specialist questions via the `Agent` tool, carrying the compact
      Signal→Specialist routing hint (see Notes) and the boundary rule above.
- [ ] The orchestrator remains the path for multi-specialist / conflict-surfacing
      questions — `agents/orchestrator.md`'s description states this split (its
      remaining reason to exist is aggregation + conflict surfacing) and states
      the *same* boundary rule as worker.md.
- [ ] When the worker spawns a specialist directly, it hands over the **minimum
      context block** (see Notes) — the same pre-loaded quality the orchestrator
      would have assembled. Flattening must not degrade what the specialist sees.
- [ ] `agents/worker.md:14`'s stale "The orchestrator passes these in your spawn
      prompt" is corrected to **conductor** (the `work`-skill loop actually
      assembles/passes the worker's spawn prompt — h3z5b renamed the loop but was
      scoped out of worker.md), or removed if redundant with the new
      consultation-guidance section. Grep worker.md clean of any loop-sense
      "orchestrator".

## Notes

**Routing hint to inline in `agents/worker.md`** (compact form of the
orchestrator's Signal→Specialist table):

| Question | Specialist |
|---|---|
| Aggregates, entities, value objects, domain events/commands, invariants, workflow within this BC | tactical-modeler |
| Cross-cutting tech: persistence, messaging, transport, deployment, external integration, library choice | architect |
| Does this belong in a different BC / crosses context boundaries | strategic-modeler |
| Outside/external knowledge not in the repo | researcher (via the gated research flow, not a bare spawn) |

**Minimum context block (AC-3)** the worker hands a directly-spawned specialist
— mirrors the conductor's Subagent Prompt Template (`skills/work/SKILL.md`,
"Subagent Prompt Template"), trimmed to what a specialist (not a worker) needs:

- The single, concrete **question** (not the whole task file), plus the task
  file path for reference
- BC name, BC README path, BC INDEX path
- **Pre-loaded ADRs** — full content of every ADR in the task's `related_adrs`
  (or "No related ADRs.")
- **Pre-loaded prior art** — id / title / `done/` path / Outcome excerpt per
  `prior_art` entry (or "No prior art identified.")
- **Related research** — `related_research` slugs (not contents)
- Project-context pointers (vision.md, context-map.md, wider `decisions/`) to
  read on demand

Drop the conductor-only fields that don't apply to a specialist call: the
"Recent activity" protocol excerpt and the git/protocol/INDEX "Rules — CRITICAL"
block (specialists have Read/Write/Edit/Grep/Glob only — no git/index writes to
forbid). Keep a strict, parseable return contract so the worker gets back
something as structured as the orchestrator would have.

**Duplication debt:** inlining the routing table puts the Signal→Specialist
mapping in two places (worker.md + orchestrator.md). This is deliberate —
deferring to single-sourcing would leave worker.md with no routing guidance
until then. Flagged for **agentic-workflow-s7d3k** (single-source duplicated
doctrine) to absorb as an inventory target when it's refined. Recorded in
ADR-0035's Negative consequences.

**Relationships:** shrinks the nested-spawn chain that
**agentic-workflow-z2f7s**'s fan-out ceiling guards (soft cross-ref, no
`depends_on`). Sibling naming cleanup **agentic-workflow-h3z5b** (done) resolved
the orchestrator/conductor name and is the reason AC-4 exists. No hard
dependency edges — can be worked any time.
