---
id: ADR-0043
title: Live observability — a Stop/SubagentStop hook heartbeat is a second advisory artifact
scope: agentic-workflow
status: accepted
date: 2026-07-03
related_tasks: [agentic-workflow-m9w5c, agentic-workflow-g7p2x]
related_adrs: [0027, 0017, 0014]
---

# ADR-0043: Live observability — a `Stop`/`SubagentStop` hook heartbeat is a second advisory artifact

## Context

The dashboard shows only resting disk state (ADR-0009/0017): it projects `/api/tree`
and re-projects on every SSE frame, but during a `work` batch there is no signal
that a worker/verifier is *actively* running versus a task simply sitting in
`doing/` — including a stranded `doing/` task left behind by a crashed session. Two
research reports (`work-session-presence-lock-2026-06-15`,
`work-terminal-completion-signal-2026-06-15`) independently converged on the same
mechanism: a Claude Code hook writes/heartbeats a small on-disk signal that the
read-only dashboard watches and reasons about the *freshness* of, because no
reliable "session ended" event exists (`SessionEnd` is undocumented for
crash/SIGKILL and confirmed to skip `/exit`) and no PID is exposed to probe
liveness directly.

ADR-0027 named the **advisory write** category for exactly this shape — a skill (or,
here, a hook) persists an opinion/signal about state, not a change to it — and
sanctioned exactly one artifact, `.agentheim/state/whats-next.md`, with an explicit
guard rail: "this ADR sanctions exactly `state/whats-next.md`. A second advisory
artifact needs its own decision." This is that decision.

## Decision

**A second advisory artifact, `.agentheim/state/in-flight.json`, is sanctioned under
the ADR-0027 category, maintained by two Claude Code hooks rather than a skill.**

### 1. The artifact

`.agentheim/state/in-flight.json` — a single-latest, merge-and-overwritten JSON
document (never appended, per ADR-0027 §4.2, honored at the content level: each
hook fire rewrites the whole small document rather than growing a log):

```json
{
  "version": 1,
  "sessionId": "<Claude Code session_id>",
  "startedAt": "<ISO-8601, set once, reset when a stale prior heartbeat is found>",
  "lastHeartbeat": "<ISO-8601, bumped on every hook fire>",
  "agents": [
    { "agentType": "worker" | "verifier", "agentId": "<string>", "completedAt": "<ISO-8601>" }
  ]
}
```

`agents` is bounded, not an append log: every fire prunes entries whose
`completedAt` has itself gone stale and de-duplicates by `agentId` (a repeat
completion for the same id replaces, never doubles).

### 2. Two hooks, not a skill, write it

Unlike `whats-next.md` (written by a skill's own prose instructions),
`in-flight.json` is written by real Claude Code `Stop`/`SubagentStop` command
hooks, because the signal it carries — "is a session with a worker/verifier
currently alive" — cannot be produced any other way: a skill cannot observe its
own liveness between turns, and the dashboard cannot probe a PID (none is exposed,
per the presence-lock research).

- **`skills/work/SKILL.md`** frontmatter declares a `Stop` hook that shells out to
  `lib/hook-agent-signal.mjs session-heartbeat`. `Stop` fires on every orchestrator
  turn while `work` is active (an inline, non-forked skill) — the per-turn
  heartbeat the presence-lock research designed. First fire creates the session
  record; every later fire (while still fresh) just bumps `lastHeartbeat`.
- **`agents/worker.md`** and **`agents/verifier.md`** frontmatter each declare a
  `Stop` hook (auto-converted to `SubagentStop` when that subagent completes, per
  the terminal-completion-signal research) that shells out to
  `lib/hook-agent-signal.mjs worker-stop` / `verifier-stop` respectively, recording
  `{agentType, agentId, completedAt}`.

### 3. Staleness is the only crash-safety mechanism — by design

There is no `SessionEnd`-removes-the-lock step. Per the presence-lock research,
`SessionEnd` is not guaranteed on crash/SIGKILL and is confirmed to skip `/exit`,
so relying on it would leave stale locks in practice. Instead:
`lib/agent-heartbeat.mjs`'s `applyHeartbeat`/`applyAgentCompletion` treat a
heartbeat older than `STALE_WINDOW_MS` (5 minutes — no doc basis for an exact
figure, chosen to exceed ordinary inter-turn gaps while still reaping promptly;
open to revision from real measurement later) as belonging to a **dead session**:
the next hook fire starts a brand-new record (`startedAt` resets, `agents`
clears) rather than extending a stale one. The dashboard-side reader
(`dashboard/app/in-flight-state.js`) applies the identical test and renders
**nothing** once the heartbeat is stale — no zombie in-flight lane survives a
crashed/killed session.

### 4. The dashboard reads it through the existing `/api/doc` carrier — no new endpoint

Exactly the ADR-0027 §3 precedent: the artifact is a document body, so it is
**not** folded into `/api/tree` (pointers/metadata only, ADR-0002/0023). The board's
`InFlightLane` fetches `GET /api/doc?path=.agentheim/state/in-flight.json`, the
same carrier `WhatsNextPanel` uses for its sibling artifact, and re-fetches on
every SSE frame (ADR-0006). The dashboard stays strictly read-only over it
(ADR-0017) — only the two hooks ever write it.

### 5. Guard rails carried forward from ADR-0027, restated for this artifact

1. **Exactly one more file.** This ADR sanctions `state/in-flight.json` and no
   further artifact; a third needs its own decision.
2. **Merge-and-overwritten, never an append log** — bounded by staleness pruning
   (§1 above), not by a cap on line count.
3. **No lifecycle dependency on its content.** No task readiness, no `INDEX.md`
   count, no `depends_on` resolution reads this file. It is a separate,
   self-suppressing panel, not a lifecycle input.
4. **Descriptive, not load-bearing** — `startedAt`/`lastHeartbeat` are rendering
   cues (a "since when" display and the staleness gate); nothing in the lifecycle
   keys off them.
5. **The dashboard is read-only over it too** — reads and renders, never writes.
6. **Git-ignored**, under the existing `.agentheim/state/` ignore rule (ADR-0027 §5)
   — no `.gitignore` change needed, the directory-level ignore already covers it.

### 6. Distinct from the existing doing-column pulse (ADR-0014) — deliberately not touched

`doingPulseClass` (design-system, ADR-0014/design-system-004) is explicitly keyed
off `status === "doing"` alone — "the dashboard reads disk state... not whether a
worker process is live this second" — a DIFFERENT, already-shipped signal this
feature does not change. `InFlightLane` is an additive, standalone panel, not a
retrofit of the existing pulse: changing what the pulse means would be a
cross-BC (design-system) decision outside this task's scope, and the two signals
answer different questions ("is this task in the doing folder" vs. "is a work
session's heartbeat currently fresh").

## Consequences

**Positive**

- A running `work` batch becomes visible on the dashboard — worker/verifier
  counts this session, since when — without inventing a new transport, a new
  endpoint, or reopening ADR-0017/ADR-0027's read-only contracts.
- The staleness-only crash-safety design means there is no code path that can
  leave a permanently-stuck "in flight" lane: the artifact self-heals into a new
  session on the very next hook fire, and the dashboard-side reader independently
  reaps on the same window even if no further hook fire ever comes.
- `lib/agent-heartbeat.mjs` and `dashboard/app/in-flight-state.js` are pure,
  I/O-free, fully unit-tested; `lib/hook-agent-signal.mjs` is the thin, isolated
  I/O glue, itself directly testable via dependency injection (no real stdin/
  subprocess needed for its unit tests) and additionally smoke-tested as a real
  subprocess reading real stdin.

**Negative**

- Real Claude Code hook firing (as opposed to the pure logic and the CLI script,
  both of which are tested directly) cannot be verified end-to-end inside this
  repo's own test suite — there is no way to spawn a nested Claude Code session
  with hooks active from within a worker task. The design leans on the two
  research reports' documentation reading; issue #17688 (skill-frontmatter hooks
  not firing inside a *plugin*-packaged skill, open as of the research date) is a
  known risk specifically because this project ships itself as a Claude Code
  plugin. If hooks silently do not fire in a given Claude Code version/packaging,
  the artifact simply never appears — the dashboard degrades to showing nothing
  (identical to today), never to a wrong or misleading signal.
- Per-task granularity is not available: hook payloads carry `session_id`/
  `agent_type`/`agent_id`, never a task id, so the lane reports session-wide
  worker/verifier counts, not which specific `doing/` card each agent is working
  on. A future task could close this gap if a documented mechanism exposes it.
- `.agentheim/state/` now holds two artifacts instead of one, slightly enlarging
  the advisory-write surface ADR-0027 kept deliberately narrow. Mitigated by
  guard rail §5 above staying otherwise unchanged.

**Neutral**

- The 5-minute staleness window is an empirical starting point (explicitly
  flagged as such by the presence-lock research's own open questions), not a
  measured constant; a future session with real heartbeat-gap data could tune it.

## Alternatives considered

- **Fold the signal into `/api/tree`.** Rejected: the tree is pointers/metadata
  only (ADR-0002/0023); this is a body, and `/api/doc` already carries bodies —
  identical reasoning to ADR-0027 §3's rejection of the same idea for
  `whats-next.md`.
- **A `SessionStart`-writes / `SessionEnd`-removes clean bracket.** Rejected per
  the presence-lock research: `SessionEnd` is not guaranteed on crash and
  confirmed to skip `/exit`; a bracket alone would leave stale locks in practice.
  Staleness is the primary correctness mechanism, not a fallback layered on a
  bracket that doesn't exist here.
- **Track per-task identity via `PreToolUse`/`PostToolUse` on the `Task` tool.**
  Considered, but neither pre-loaded research report documents this event's exact
  payload shape for this use, and the task's own scope note explicitly names only
  `SubagentStop`/`Stop`(/possibly `SessionStart`) as the hooks to use — extending
  beyond that would be speculating about an unresearched mechanism. Left as a
  named gap (Consequences, "Negative") rather than guessed at.
- **One file per agent (`state/agents/<agent_id>.json`).** Rejected: the dashboard
  has no way to discover an unbounded/unknown set of filenames through the
  existing `/api/doc` carrier (it fetches one known path, exactly like
  `whats-next.md`) without either a new listing endpoint or folding `state/` into
  `/api/tree` — both rejected above. A single bounded, pruned document avoids
  both.
- **Retrofit the existing `doingPulseClass` (ADR-0014) to key off this signal
  instead of `status === "doing"`.** Rejected: that primitive lives in the
  design-system BC and is a deliberate, already-shipped decision; changing its
  meaning is a cross-BC change outside this task's scope (see §6 above). An
  additive standalone panel achieves the acceptance criteria without touching it.

## Amendment (2026-07-04, agentic-workflow-g7p2x) — hook COMMAND path fixed for consumer plugin installs

This ADR's own "Negative" section flagged the risk this amendment resolves:
consumer-install packaging was never verified. The specific bug found: all three
hook registrations (`skills/work/SKILL.md`, `agents/worker.md`,
`agents/verifier.md`) invoked

```
node "${CLAUDE_PROJECT_DIR}/lib/hook-agent-signal.mjs" <signal>
```

`${CLAUDE_PROJECT_DIR}` correctly names the *write target* (the script's
internal `resolveRoot()`, unchanged by this amendment) but was being reused,
incorrectly, to also locate the *script itself*. That collapses to the right
path only when the project **is** the plugin (this repo, dogfood development).
In any consumer project that installed Agentheim as a plugin, `CLAUDE_PROJECT_DIR`
is the consumer's root, `lib/hook-agent-signal.mjs` does not exist there, and
`node` exits non-zero with `in-flight.json` never written — a failure that is
silent **at the Claude Code hook level** (a command hook's stderr is not surfaced
to the user), even though the underlying `node` process itself does error. This
is exactly the "no visible error anywhere" case this ADR's own Negative section
warned about, and is a sibling risk to (not the same bug as) issue #17688 — that
issue is about a hook's *declaration* not firing at all; this bug is about a
firing hook's command *resolving to the wrong path*.

**Investigated: `${CLAUDE_PLUGIN_ROOT}` in a hook command.** The preferred fix
would have been a one-line `${CLAUDE_PLUGIN_ROOT}` substitution in each hook
command (Claude Code's documented placeholder for a plugin's own install
directory). Verified via a `claude-code-guide` consultation against current
Claude Code docs and issue trackers before adopting it — the exact "verify,
don't assume" discipline this bug's root cause (an unverified `${CLAUDE_PROJECT_DIR}`
reuse) should have had the first time:

- **Documented:** yes — the Claude Code hooks reference lists `${CLAUDE_PLUGIN_ROOT}`
  as a path placeholder substituted into hook command strings and exported to
  the spawned process.
- **Reliable in practice: no.** Multiple open, confirmed upstream issues
  (anthropics/claude-code #43380, #66557, #24529) document `${CLAUDE_PLUGIN_ROOT}`
  *not* being injected during hook execution across multiple plugins — a
  documented-but-broken mechanism, unresolved as of this investigation
  (2026-07-04). This is the same failure shape infrastructure-010 already found
  for a *different* context (`${CLAUDE_PLUGIN_ROOT}` empty in a slash-command's
  Bash tool-call context) — the two contexts are documented differently but
  share the same real-world unreliability.
- Whether per-agent/per-skill frontmatter `hooks:` blocks (as opposed to a
  plugin-level `hooks.json`) are even a fully-documented mechanism was also
  unclear from the guide consultation — one more reason not to lean on a second
  undocumented-in-this-shape assumption stacked on top of the first.

**Decision: use the env-free bootstrap fallback, not `${CLAUDE_PLUGIN_ROOT}`.**
Each hook command is now a self-contained `node -e` bootstrap — homedir ->
`~/.claude/plugins/cache/agentheim/agentheim/<version>/` (semver-max) ->
`lib/hook-agent-signal.mjs`, with a repo-local (`process.cwd()`) short-circuit
for dogfood development — reusing verbatim the pattern
`lib/resolve-plugin-file.mjs` (infrastructure-010, generalized by
agentic-workflow-k5n8f) already established, and mirroring the exact bootstrap
shape `skills/work/SKILL.md`'s claim/complete verbs already ship (Phase 4 step 1
of the `work` skill). This keeps the fix consistent with a pattern already
proven in this codebase rather than introducing a third resolution strategy.
Unlike `resolve-plugin-file.mjs`'s CLI-facing "fail loudly" philosophy, the
bootstrap here silently `process.exit(0)`s when no candidate resolves — matching
this ADR's own governing rule that a hook must never surface an error the
session can't act on.

**Why this failure mode surfaces nowhere (the Negative-section warning, made
concrete).** The staleness self-suppression this ADR designed (§3) means a
broken hook and a healthy-but-idle session are visually indistinguishable on the
dashboard — both render "no in-flight lane." A future regression that breaks the
hook COMMAND path again (e.g. a careless edit to one of the three `node -e`
bootstraps) will not throw, will not appear in any log a normal session ever
reads, and will not fail any test that doesn't specifically simulate a foreign
cwd — exactly the gap this amendment's new regression test
(`lib/test/hook-command-path.test.mjs`) closes for this specific command shape.

**Verification performed:** unit/static guards over the three registration
sites (asserting the env-independent bootstrap shape and rejecting the legacy
form), plus a real-subprocess reproduction — the fixed `worker-stop` command,
run via `bash -c` from a temp foreign project (not this repo) with
`CLAUDE_PROJECT_DIR` pointed at that foreign project and `HOME`/`USERPROFILE`
pointed at a fake plugin-cache home (repo `lib/`/`dashboard/` linked in as the
"installed version"), writes `.agentheim/state/in-flight.json` under the
foreign project. A parallel run of the literal OLD command string against the
same foreign project confirms it does **not** write the file (the bug,
reproduced). A third run confirms the fixed command still works from this repo
itself (dogfood), and that the write target is `CLAUDE_PROJECT_DIR`, not
wherever the script was resolved from — proving the two roles stayed decoupled.
See `lib/test/hook-command-path.test.mjs` for the full reproduction.
