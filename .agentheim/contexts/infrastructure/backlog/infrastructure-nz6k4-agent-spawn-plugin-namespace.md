---
id: infrastructure-nz6k4
title: Skills spawn subagents by bare name — fails as installed plugin ("Agent type 'worker' not found")
status: backlog
type: bug
context: infrastructure
created: 2026-07-06
completed:
depends_on: []
blocks: []
tags: [harness-bug, agent-spawn, plugin, namespace, work-skill]
related_adrs: []
related_research: []
prior_art: []
---

## Why

The `work` run at 2026-07-06 16:56 (`design-system-xr4sb`) died at worker
dispatch with **`Agent type 'worker' not found`**. Root cause: the skills spawn
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

An earlier run the same day (`agentic-workflow-p8k4d`, 13:27) *did* spawn a
worker + verifier successfully, so bare names resolved then; a plugin/marketplace
reload around 15:12 (other plugins show `lastUpdated: 2026-07-06T15:12`, and
`agentheim` is `autoUpdate: true`) is the leading hypothesis for what flipped a
previously-working bare `"worker"` into "not found." Not established fact — but
the fix stands regardless of the trigger.

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
      an Agentheim agent name (guard against a missed routing-table row).
- [ ] A `work` run spawns a worker without `Agent type '…' not found`, and a
      worker's specialist consultation resolves the specialist by its qualified
      name (end-to-end: dispatch → specialist consult → verifier).
- [ ] The stranded `design-system-xr4sb` (still in `doing/`, worktree
      `aw/design-system-xr4sb` alive) resumes cleanly via `work` Phase 1 recovery
      once the fix lands — reusing the existing worktree, not spawning a second.

## Notes

**Open decision to resolve in REFINE (why this is backlog, not todo):**
hardcoding `agentheim:` couples the skill prose to the installed-plugin
namespace. That is correct for how Agentheim is actually run (and matches the
evals), but it would *break* a raw source checkout where these same agents are
loaded as **bare project/local agents** (no namespace). Pick one before a worker
executes:

1. **Qualify unconditionally** — `agentheim:worker` everywhere. Simplest;
   matches reality + the evals; accepts that a bare source-run is unsupported.
2. **Qualify with a documented bare fallback** — instruct the conductor to try
   `agentheim:worker`, fall back to bare `worker`. Honest for both run modes,
   but clunkier prose and relies on the model to do the fallback.
3. **Treat as a harness resolution bug** — the harness *should* auto-qualify an
   unambiguous bare name; file upstream. Not actionable in this repo and doesn't
   unblock the immediate breakage.

Recommendation: option 1, and note the source-run caveat — but this is the call
to confirm with the builder. If a decision with real rationale is reached, it may
warrant a `type: decision` ADR on the agent-spawn naming convention.

**Diagnosis session:** captured from an `inquire` → `modeling` session on
2026-07-06 that traced the 16:56 `design-system-xr4sb` failure. The plugin
namespace is `agentheim` per `.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json`.
