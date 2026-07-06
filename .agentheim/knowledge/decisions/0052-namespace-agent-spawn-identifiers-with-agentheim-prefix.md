---
id: 0052
title: Qualify every internal agent-spawn identifier with the agentheim: plugin namespace, unconditionally
scope: global
status: accepted
date: 2026-07-06
supersedes: []
superseded_by: []
related_tasks: [infrastructure-nz6k4]
related_research: []
---

# ADR 0052: Qualify every internal agent-spawn identifier with the `agentheim:` plugin namespace, unconditionally

## Context

Agentheim ships as an installable Claude Code plugin (`.claude-plugin/plugin.json`,
`.claude-plugin/marketplace.json`, namespace `agentheim`). Claude Code registers a
plugin's agents **under the plugin's namespace** — when Agentheim is installed as
`agentheim@agentheim`, the agent types that actually exist are `agentheim:worker`,
`agentheim:verifier`, `agentheim:orchestrator`, `agentheim:tactical-modeler`,
`agentheim:strategic-modeler`, `agentheim:architect`, `agentheim:researcher`,
`agentheim:research-reviewer` — there is no bare `worker`.

Every skill (`skills/work/SKILL.md`, `skills/research/SKILL.md`,
`skills/modeling/SKILL.md`, `skills/brainstorm/SKILL.md`) and both routing-table
agents (`agents/worker.md`'s Signal→Specialist table, per ADR-0035;
`agents/orchestrator.md`'s Signal→Specialist table) named these agents **bare**
in their `subagent_type` spawn identifiers and routing-table rows. This produced
an `Agent type 'worker' not found` failure at dispatch. The evals already used
the qualified form (`Agent(subagent_type: "agentheim:verifier", model: "sonnet",
...)`, `evals/verifier-catch-rate/results/2026-07-04-sonnet-arm-run.md`), proof
the namespaced form resolves and the bare form is the defect.

The exact triggering dispatch that surfaced the error is unconfirmed — bare
names resolved cleanly on other 2026-07-06 runs (`agentic-workflow-p8k4d`,
13:27; `design-system-xr4sb`, 16:56–17:13, a clean first-try verified PASS) — so
the harness appears to sometimes auto-qualify a bare name and sometimes not
(hypothesis: a plugin/marketplace reload around 15:12 changed behavior mid-day).
What this ADR fixes is the underlying **latent fragility**: bare spawns depend
on undocumented harness auto-qualification, which is not a contract Agentheim
can rely on.

## Decision

Qualify **every internal agent-spawn identifier** with the `agentheim:`
namespace, **unconditionally** — no bare fallback, no conditional logic based on
run mode. This applies to:

- Literal `subagent_type: "<name>"` values in `skills/work/SKILL.md`,
  `skills/research/SKILL.md` (worker, verifier, research-reviewer).
- Dispatch-directing prose that names the actual spawn target ("spawn the X
  agent", "delegate to X", "hand off to X", "re-dispatch X") in
  `skills/modeling/SKILL.md`, `skills/research/SKILL.md`, and
  `skills/brainstorm/SKILL.md` (orchestrator, researcher).
- The Signal→Specialist routing-table rows in `agents/worker.md` (ADR-0035's
  direct-to-specialist table) and `agents/orchestrator.md` — these bare
  backtick-wrapped names are the operative identifier a worker or orchestrator
  turns directly into a `subagent_type` the moment it consults a specialist, so
  a worker that dispatches fine can still fail with `Agent type
  'tactical-modeler' not found` the instant it tries to consult one.

Conceptual/narrative mentions of an agent's role (e.g. "the worker's own
attention is anchored to the solution it produced", "the researcher fails in
one distinctive way") are deliberately left bare — qualifying every prose
occurrence of these words would be noise, not signal, and the task's own
acceptance criteria distinguish a spawn identifier from a role reference.

A live-tree lint (`lib/agent-spawn-namespace.mjs`, exercised by
`lib/test/agent-spawn-namespace.test.mjs`) now guards this convention going
forward: it scans every `.md` file under `skills/` and `agents/` for (a) a
literal `subagent_type: "<bare-name>"` and (b) a standalone backtick-wrapped
bare name on a markdown table-row line, and fails if either names one of the
eight Agentheim agents without the `agentheim:` prefix.

This decision cross-references two prior ADRs whose agent names are the ones
being namespaced:
- **ADR-0035** (worker spawns a single specialist directly) — the
  Signal→Specialist table this ADR namespaces lives in `agents/worker.md`
  because of ADR-0035's flattening.
- **ADR-0031** (per-agent model routing) — routes by the same eight agent
  names (`worker`, `verifier`, `orchestrator`, `tactical-modeler`,
  `strategic-modeler`, `architect`, `researcher`, `research-reviewer`) this ADR
  qualifies; the model-routing keys are unaffected (they key off the agent
  definition file's own `name:` frontmatter, not the spawn-site string), but a
  future reader auditing one should know the other exists.

## Consequences

### Positive
- Deterministic agent resolution regardless of harness auto-qualification
  behavior — no more dependency on an undocumented fallback.
- A permanent lint (not just a one-time grep) catches a future regression —
  e.g. a new skill or a new routing-table row added without the prefix.
- Matches how Agentheim is actually run and developed: this repo's own dev/eval
  loop already resolves its agents as `agentheim:worker`/`agentheim:orchestrator`/…
  (a directory marketplace pointing at this repo, `autoUpdate: true`), so there
  is no bare `worker` to fall back to even in this project's own sessions.

### Negative
- A bare source-run that loads `agents/*.md` as project-local agents (`.claude/agents/`)
  *outside* the plugin system would see unqualified names and would need bare
  `subagent_type` values — that run mode is **unsupported** by this decision.
  Accepted as a residual: it is neither how the project is run nor how it is
  eval'd (see Alternatives).
- Every new skill or agent file must remember the convention; the lint is the
  backstop, not a substitute for reviewers knowing the rule.

### Neutral
- Conceptual prose mentions of agent names remain bare by design — a reader
  cannot grep-count "agentheim:" occurrences as a completeness proxy; the lint
  is the actual completeness check.

## Alternatives considered

- **Bare name with a documented fallback convention** — rejected. Adds
  model-dependent fallback prose for a run mode (bare source-run outside the
  plugin) that isn't how this project is developed or evaluated; the fallback
  itself would depend on the same undocumented harness behavior that caused
  the original bug.
- **Push the fix upstream into the harness** (auto-qualify bare names
  consistently) — rejected as not actionable from this repo, and it wouldn't
  unblock the breakage in the meantime.

## References
- `infrastructure-nz6k4` — the task this ADR was written alongside.
- `evals/verifier-catch-rate/results/2026-07-04-sonnet-arm-run.md` — the
  qualified-form evidence.
- `.agentheim/knowledge/decisions/0031-per-agent-model-routing-decorrelate-adversarial-gates.md`
- `.agentheim/knowledge/decisions/0035-single-specialist-consultation-flattening.md`
- `lib/agent-spawn-namespace.mjs`, `lib/test/agent-spawn-namespace.test.mjs`
