---
id: 0035
title: Worker spawns a single specialist directly; orchestrator reserved for multi-specialist aggregation
scope: agentic-workflow
status: proposed
date: 2026-07-03
supersedes: []
superseded_by: []
related_tasks: [agentic-workflow-n6r8j, agentic-workflow-z2f7s, agentic-workflow-s7d3k]
related_research: []
---

# ADR 0035: Worker spawns a single specialist directly; orchestrator reserved for multi-specialist aggregation

## Context
The worker→orchestrator→specialist consultation path is three agent contexts
deep. For a common class of question — "does this need an ACL?", "what
aggregate does this belong to?" — there is exactly one specialist who can
answer, and the orchestrator's entire contribution is routing: matching the
question to a row in its Signal→Specialist table. That routing is a static
lookup, not judgment; the worker already has the `Agent` tool and can perform
the same lookup itself. The orchestrator's distinguishing value — aggregating
multiple specialists' answers and surfacing conflicts between them — only
exists when more than one specialist is consulted. Paying a full context
(spawn latency, token cost, an extra place for information to be paraphrased
or dropped) for single-specialist routing does not buy anything a worker-held
static table doesn't. (2026-07-02 harness audit.)

## Decision
The worker consults a specialist directly via the `Agent` tool when a task
raises exactly one specialist's question (per the Signal→Specialist routing
hint carried in `agents/worker.md`). The worker assembles the same
context block a directly-spawned specialist needs as the orchestrator would
have (see agentic-workflow-n6r8j's AC-3 minimum-context-block spec). The
orchestrator remains the path when a question spans more than one
specialist's domain, or when specialists' answers must be aggregated and
conflicts surfaced to the caller — its "Running specialists in parallel" and
"Integrating results" sections keep their job.

## Consequences
### Positive
- Removes one full agent context (spawn + return round-trip) from the common
  single-specialist case, cutting latency and token cost per consultation.
- Shrinks the nested-spawn chain that agentic-workflow-z2f7s's fan-out ceiling
  has to guard against.
- Makes the orchestrator's remaining job — aggregation and conflict surfacing
  — its sole reason to exist, sharpening its description.

### Negative
- Introduces a second place (worker.md, alongside orchestrator.md) that knows
  the Signal→Specialist mapping — a duplication agentic-workflow-s7d3k is
  positioned to single-source; until that lands, the two tables can drift.
- The worker now owns judgment calls it previously deferred (is this really
  single-specialist, or does it actually need aggregation?). A wrong call
  either does needless orchestrator round-trips (safe, just slower) or misses
  a conflict that should have been surfaced (the actual risk — mitigated by
  keeping the boundary rule conservative: any hint of a second specialist's
  concern routes through the orchestrator).

### Neutral
- No change to what a specialist agent itself does or is given — the context
  block it receives is specified to match orchestrator-assembled quality
  (AC-3), so this is a topology change, not a specialist-behavior change.

## Alternatives considered
- **Keep all consultations routed through the orchestrator.** Simpler (one
  path, no boundary rule to get wrong) but keeps paying a full context for
  routing that a static table already resolves; rejected as the audit's
  identified waste.
- **Let the worker decide per-question with no routing hint, freeform.**
  Maximally flexible but reintroduces the ambiguity the routing table exists
  to remove, and risks the worker silently under-consulting; rejected in
  favor of a stated hint plus a conservative single-vs-multi boundary rule.
- **Collapse the orchestrator entirely, always let the worker fan out to
  multiple specialists itself.** Pushes aggregation and conflict-surfacing
  logic into every worker invocation instead of one place; rejected — that
  logic is exactly what's worth keeping centralized.

## References
- agentic-workflow-n6r8j (this ADR's originating task)
- agentic-workflow-z2f7s (fan-out ceiling this shrinks the chain for)
- agentic-workflow-s7d3k (single-sourcing debt this decision creates)
