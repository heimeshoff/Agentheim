---
id: agentic-workflow-m9w5c
title: Live observability — hooks write agent status to state/, dashboard renders an in-flight lane
status: done
type: feature
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-03
depends_on: [design-system-001]
blocks: []
tags: [harness-audit, observability, hooks, dashboard, work-skill, state]
related_adrs: ["0027", "0017", "0043"]
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

- [x] A running `work` batch is visible on the dashboard: which workers/verifiers are in flight, since when.
- [x] Status signals live under `.agentheim/state/` as advisory writes (ADR-0027) — never lifecycle writes.
- [x] A crashed/killed session's stale signals age out via a staleness window (no zombie in-flight lane).
- [x] The dashboard remains read-only over `.agentheim/` (ADR-0017).

## Notes

Note the audit's caveat: hooks are session-wide and can't distinguish worker
from orchestrator for *guardrails* — but observability hooks don't need to
distinguish; they just record. Both prior research reports are directly on
point — **read them first.**

**Promoted 2026-07-03** under the builder's autonomous-refinement authorization.
Dependency satisfied: `design-system-001` (the styleguide gate) is **done**
(approved 2026-06-05) — the in-flight-lane UI has its styleguide foundation. The
split candidate ((1) `SubagentStop`/`Stop` hook + `state/` schema, (2) dashboard
in-flight lane UI) is left to the worker's discretion at implementation — do it as
one task or split into a child if the hook layer lands first; either satisfies the
four AC. The state schema is an advisory write (ADR-0027) and the lane is read-only
(ADR-0017); honor both seams.

## Outcome

Delivered as **one task** (both halves): the `Stop`/`SubagentStop` hook layer that writes
`.agentheim/state/in-flight.json`, and the dashboard's `InFlightLane` panel that reads it. A
new ADR (**ADR-0043**) extends ADR-0027's advisory-write category — which explicitly sanctioned
only one file — to this second, bounded artifact.

**Design decision, honestly scoped to what the two pre-loaded research reports actually
establish:** neither report (nor any hook event either documents) exposes a per-subagent
"started" signal or a task id in any hook payload — `Stop`/`SubagentStop` payloads carry
`session_id`/`agent_type`/`agent_id`, never a task id. So the lane is **session-scoped**, not
per-task: it shows how many workers/verifiers have completed a turn *this session* and since
when the session's heartbeat started, gated live/stale by the same staleness window that reaps
a crashed session's signal (AC3). This is a deliberate, documented narrowing (see ADR-0043
"Negative" consequences and "Alternatives considered") rather than fabricating a mechanism the
research doesn't support — the task's own scope note named only `SubagentStop`/`Stop`(/possibly
`SessionStart`) as the hooks to use.

- **NEW `lib/agent-heartbeat.mjs`** — pure, I/O-free state-transition core: `applyHeartbeat`
  (first fire creates `{startedAt, lastHeartbeat}`, later fires bump `lastHeartbeat`, a STALE
  prior heartbeat resets as a fresh session), `applyAgentCompletion` (records/replaces a
  `{agentType, agentId, completedAt}` entry, prunes stale entries — bounded, never an append
  log), `isStale`, `STALE_WINDOW_MS` (5 minutes, empirical — no doc basis for an exact figure).
- **NEW `lib/hook-agent-signal.mjs`** — the CLI a `Stop`/`SubagentStop` command hook invokes:
  reads stdin JSON, resolves the project root (`${CLAUDE_PROJECT_DIR}` first, `discoverRoot`
  fallback), applies the matching pure transition, writes `.agentheim/state/in-flight.json`.
  Every failure path degrades silently and exits 0 (a hook must never crash the session it
  observes). `runHook(mode, deps)` is exported for injected-dependency unit tests; additionally
  smoke-tested as a real subprocess with real stdin and `CLAUDE_PROJECT_DIR`.
- **`skills/work/SKILL.md`** — gained a `hooks: Stop: […]` frontmatter entry (session heartbeat)
  and a short "Live observability" doctrine paragraph.
- **`agents/worker.md` / `agents/verifier.md`** — each gained a `hooks: Stop: […]` frontmatter
  entry (auto-converted to `SubagentStop` when that subagent completes, per the
  work-terminal-completion-signal research).
- **NEW `dashboard/app/in-flight-state.js`** — pure dashboard-side read path:
  `parseInFlightDoc` (safe JSON parse + shape guard), `deriveInFlightView` (the staleness gate —
  returns `null` for absent/malformed/stale, the crash-safety mechanism behind AC3).
- **`dashboard/app/board.js`** — new `InFlightLane` component, rendered below the board header
  above the columns; fetches `.agentheim/state/in-flight.json` via the existing `/api/doc`
  carrier (never `/api/tree`), re-fetches on every SSE frame, renders nothing when absent/stale,
  otherwise shows worker/verifier counts + "running since …" (reusing `formatStaleness` from
  `whats-next-state.js`). Deliberately does **not** touch the existing `doingPulseClass`
  (design-system ADR-0014) — a different, already-shipped, cross-BC signal outside this task's
  scope.
- **agentic-workflow BC README** — new `InFlightLane` paragraph beside `WhatsNextPanel`, and a
  new `lib/agent-heartbeat.mjs` / `lib/hook-agent-signal.mjs` paragraph beside the other `lib/`
  modules.
- **NEW ADR-0043** — extends ADR-0027's advisory-write category to the second artifact, records
  the staleness-only crash-safety design, and the deliberate non-retrofit of `doingPulseClass`.

No `.gitignore` change needed: the existing `.agentheim/state/` directory ignore (aw-076)
already covers the new `in-flight.json` file.

Tests: NEW `lib/test/agent-heartbeat.test.mjs` (11 cases), NEW `lib/test/hook-agent-signal.test.mjs`
(6 cases, including a corrupt-prior-file and an unresolvable-root path), NEW
`dashboard/test/in-flight-state.test.mjs` (10 cases), NEW `dashboard/test/in-flight-lane.test.mjs`
(9 static-source guard cases, mirroring the `whats-next-panel.test.mjs` idiom). `lib/test/*.test.mjs`:
125/125 passing. `dashboard` suite (`npm test`): 731/731 passing (was 712). `dashboard/dist/`
rebuilt via `node build.mjs`.

Key files: `lib/agent-heartbeat.mjs`, `lib/hook-agent-signal.mjs`, `lib/test/agent-heartbeat.test.mjs`,
`lib/test/hook-agent-signal.test.mjs`, `dashboard/app/in-flight-state.js`, `dashboard/app/board.js`,
`dashboard/test/in-flight-state.test.mjs`, `dashboard/test/in-flight-lane.test.mjs`,
`skills/work/SKILL.md`, `agents/worker.md`, `agents/verifier.md`,
`.agentheim/knowledge/decisions/0043-live-observability-hook-heartbeat-second-advisory-artifact.md`,
`.agentheim/contexts/agentic-workflow/README.md`.
