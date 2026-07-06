---
id: infrastructure-nz6k4
title: Skills spawn subagents by bare name — fails as installed plugin ("Agent type 'worker' not found")
status: doing
type: bug
context: infrastructure
created: 2026-07-06
completed:
depends_on: []
blocks: []
tags: [harness-bug, agent-spawn, plugin, namespace, work-skill]
related_adrs: [0031, 0035]
related_research: []
prior_art: []
---

## Why

An **`Agent type 'worker' not found`** error surfaced on 2026-07-06 during agent
dispatch. Root cause: the skills spawn
subagents by their **bare** name (`subagent_type: "worker"`), but Agentheim is
installed as the `agentheim` plugin (`~/.claude/plugins/installed_plugins.json`
→ `agentheim@agentheim`, from a directory marketplace pointing at this repo).
Claude Code registers a plugin's agents **under the plugin namespace**, so the
types that actually exist are `agentheim:worker`, `agentheim:verifier`,
`agentheim:orchestrator`, `agentheim:tactical-modeler`, … — there is **no bare
`worker`**. Every internal spawn identifier in the skills is therefore
unresolvable when the harness doesn't auto-qualify the bare name.

The evals already spawn the qualified form —
`Agent(subagent_type: "agentheim:verifier", ...)`
(`evals/verifier-catch-rate/results/2026-07-04-sonnet-arm-run.md:6`,
`.agentheim/knowledge/verifier-catch-rate-eval-2026-07-04.md:265`) — which is
proof the namespaced form resolves and the bare form is the defect.

**REFINE correction (2026-07-06):** the capture originally read this as having
*killed* the 16:56 `design-system-xr4sb` work run at dispatch — but the protocol
records that run as a clean first-try verified PASS (completed 17:13, now in
`done/`, worktree torn down at integration), so that run did **not** strand. Bare
names also resolved on an earlier run the same day (`agentic-workflow-p8k4d`,
13:27 — worker + verifier spawned fine). So the harness *was* auto-qualifying the
bare name at those moments; the `not found` error is real but its exact triggering
dispatch is **unconfirmed** (a plugin/marketplace reload around 15:12 — other
plugins show `lastUpdated: 2026-07-06T15:12`, `agentheim` is `autoUpdate: true` —
is a hypothesis, not established fact). What this task fixes is therefore the
**latent fragility**: the bare spawns depend on undocumented harness
auto-qualification, whereas the namespaced form is deterministic — it is the form
the evals already use and the form under which *this very repo* resolves its agents
(`agentheim:worker`/`agentheim:orchestrator`/…, no bare `worker`). The fix stands
regardless of the trigger.

## What

Qualify **every internal agent-spawn identifier** with the plugin namespace so
it resolves deterministically when installed as `agentheim`. The bare→qualified
change spans (at least) these sites:

- `skills/work/SKILL.md` — `"worker"` (lines ~69, ~391) → `"agentheim:worker"`;
  `"verifier"` (lines ~117, ~159) → `"agentheim:verifier"`
- `skills/research/SKILL.md` — `"research-reviewer"` (lines ~90, ~103) →
  `"agentheim:research-reviewer"`
- `skills/modeling/SKILL.md` — the orchestrator spawn (lines ~135, ~376) →
  `"agentheim:orchestrator"`
- `agents/worker.md` (routing table, lines ~66–69) and `agents/orchestrator.md`
  (routing table, lines ~27–30) — the specialist names workers/orchestrator
  dispatch (`tactical-modeler`, `strategic-modeler`, `architect`, `researcher`)
  → `agentheim:*`

The routing-table rows are the easy-to-miss ones: a worker that dispatches fine
will still throw `Agent type 'tactical-modeler' not found` the moment it tries to
consult a specialist, so fixing only the top-level `work` spawn is a partial fix.

## Acceptance criteria

- [ ] Every internal `subagent_type` / agent-spawn identifier in `skills/` and
      `agents/` that names an Agentheim-provided agent is qualified with the
      `agentheim:` namespace (worker, verifier, research-reviewer, orchestrator,
      tactical-modeler, strategic-modeler, architect, researcher).
- [ ] A grep across `skills/` and `agents/` finds no remaining **bare** spawn of
      an Agentheim agent name (guard against a missed routing-table row — the
      Signal→Specialist tables in `agents/worker.md` and `agents/orchestrator.md`
      are the easy misses; `researcher` is dispatched via the gated research flow,
      not a bare `subagent_type`, so confirm that path is qualified too).
- [ ] A `work` run spawns a worker without `Agent type '…' not found`, and a
      worker's specialist consultation resolves the specialist by its qualified
      name (end-to-end: dispatch → specialist consult → verifier).
- [ ] A `type: decision` ADR records the namespacing convention (qualify with
      `agentheim:` **unconditionally**; a bare source-run that loads `agents/*.md`
      as project-local agents outside the plugin is unsupported), cross-referencing
      **ADR-0035** (the direct-to-specialist routing tables being namespaced) and
      **ADR-0031** (per-agent config keyed on the same agent names). On completion
      the ADR id is added to this task's `related_adrs` and this task id to the
      ADR's `related_tasks` (bidirectional link).

## Notes

**Decision (resolved in REFINE, 2026-07-06):** Qualify **unconditionally** —
`agentheim:` on every internal spawn identifier (option 1). Rationale: it matches
how Agentheim is actually run *and developed*. The source repo loads its own agents
under the plugin namespace (a directory marketplace pointing at this repo,
`autoUpdate: true`), so even Agentheim's own dev and eval runs see
`agentheim:worker`/`agentheim:orchestrator`/… and **no bare `worker`** — the "a
bare source-run would break" downside of option 1 is therefore hypothetical (it
would only bite a checkout that loaded `agents/*.md` as `.claude/agents/`
project-local agents outside the plugin, which is neither how the project is run
nor how it is eval'd). Options 2 (bare fallback) and 3 (upstream harness fix) were
considered and rejected: (2) adds model-dependent fallback prose for a run mode
that isn't supported; (3) isn't actionable in this repo and doesn't unblock the
breakage. The convention gets a `type: decision` ADR authored **when this task is
worked**, alongside the code fix (see the ADR acceptance criterion above) — the
source-run caveat is recorded there as the accepted residual.

**Diagnosis session:** captured from an `inquire` → `modeling` session on
2026-07-06 that traced the 16:56 `design-system-xr4sb` failure. The plugin
namespace is `agentheim` per `.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json`.
