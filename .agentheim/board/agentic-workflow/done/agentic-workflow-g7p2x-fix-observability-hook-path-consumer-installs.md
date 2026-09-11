---
id: agentic-workflow-g7p2x
title: Observability hook command path breaks in consumer plugin installs
status: done
type: bug
context: agentic-workflow
created: 2026-07-04
completed: 2026-07-04
depends_on: []
blocks: []
tags: [hooks, observability, plugin, in-flight-lane, path-resolution]
related_adrs: [0043, 0027]
related_research: []
prior_art: [agentic-workflow-m9w5c]
---

## Why

All three live-observability hook registrations — `agents/worker.md` and
`agents/verifier.md` (`Stop` hooks) and `skills/work/SKILL.md` (session heartbeat) —
invoke:

    node "${CLAUDE_PROJECT_DIR}/lib/hook-agent-signal.mjs" <signal>

That path resolves **only in the Agentheim source repo**, where the project *is* the
plugin. In any consumer project that installed Agentheim as a plugin,
`CLAUDE_PROJECT_DIR` is the consumer's root, `lib/hook-agent-signal.mjs` does not
exist there, and the hook fails **silently on every fire** — so
`.agentheim/state/in-flight.json` is never written and the dashboard's in-flight lane
(the entire feature ADR-0043 shipped) never lights up outside this repo. The
2026-07-04 harness-audit follow-up caught this; notably the original audit's
"where the audit is uncertain" section had flagged plugin path resolution as exactly
this risk class, and ADR-0043 never considered consumer installs.

## What

Point the hook *command path* at the plugin-shipped script:

- **Preferred:** `${CLAUDE_PLUGIN_ROOT}` in the hook command, if the harness resolves
  that variable in agent/skill frontmatter hooks shipped via plugin (verify, don't
  assume — this is the exact class of assumption that produced the bug). Confirm it
  also resolves when developing in this source repo (installed as a local plugin);
  if it does, the fix is three one-line frontmatter edits.
- **Fallback:** if `${CLAUDE_PLUGIN_ROOT}` is not available in this hook context,
  reuse the env-free homedir→cache→semver-max bootstrap
  (`lib/resolve-plugin-file.mjs`, infrastructure-010 pattern, already generalized by
  k5n8f) inline in the hook command, exactly as the PROMOTE/claim/complete verbs do.

**Do not touch the script's internals:** `lib/hook-agent-signal.mjs` uses
`CLAUDE_PROJECT_DIR` to resolve the *write target* (the consumer project's
`.agentheim/state/`) — that use is correct and must stay. The bug is only in *where
the hook command looks for the script*, not where the script writes.

## Acceptance criteria

- [x] In a scratch consumer project with Agentheim installed as a plugin (not this
      repo), a fired hook actually executes: `.agentheim/state/in-flight.json`
      appears/updates in the consumer project. This is the end-to-end proof — a
      resolution-only check is not sufficient, since silent failure is the bug.
- [x] The same hooks still work when running from this source repo (dogfood
      development), same observable write.
- [x] All three registration sites are fixed consistently (`agents/worker.md`,
      `agents/verifier.md`, `skills/work/SKILL.md`) — no site left on the old path.
- [x] The script's internal project-root resolution (env-first, documented fallback)
      is unchanged; `node --test lib/test/*.test.mjs` stays green.
- [x] The resolution choice (plugin-root variable vs. bootstrap fallback) and its
      verified support status are recorded — as an amendment note to ADR-0043 or a
      new ADR if the investigation overturns an 0043 assumption.

## Notes

- Verification in a consumer install may need a manual hook fire (e.g. run a trivial
  `work` batch in the scratch project) — describe the actual reproduction used in the
  task outcome so the verifier can weigh the evidence.
- The dashboard's `InFlightLane` staleness self-suppression (ADR-0043) means a broken
  hook produces *no visible error anywhere* — worth one line in the ADR amendment on
  why silent-failure surfaces nowhere, in case a future regression repeats this.

## Outcome

**Investigated `${CLAUDE_PLUGIN_ROOT}` first, per the guard.** Spawned `claude-code-guide`
directly (single-specialist question, ADR-0035) to check current Claude Code docs/issue
trackers for hook-context support. Result: documented for hook command contexts, but
confirmed to have open, unresolved non-injection bugs upstream (anthropics/claude-code
issues #43380, #66557, #24529) — i.e. the same "documented but empirically broken" shape
this repo's own infrastructure-010 already found in a *different* context
(command-card Bash tool calls). Rejected `${CLAUDE_PLUGIN_ROOT}`; used the **env-free
bootstrap fallback**.

**Fix:** all three hook registrations (`agents/worker.md`, `agents/verifier.md`,
`skills/work/SKILL.md`) now use a self-contained `node -e` bootstrap — homedir ->
`~/.claude/plugins/cache/agentheim/agentheim/<version>/` (semver-max) ->
`lib/hook-agent-signal.mjs`, with a `process.cwd()` repo-local short-circuit for dogfood
development — the identical pattern `lib/resolve-plugin-file.mjs` (infrastructure-010) and
the `work` skill's own claim/complete verbs already ship. The script's internal
`resolveRoot()` (`${CLAUDE_PROJECT_DIR}` first, `discoverRoot` fallback) — the *write
target* — was **not** touched.

**End-to-end reproduction actually run (AC#1), in `lib/test/hook-command-path.test.mjs`:**
using real `spawnSync('bash', ['-c', <command>], ...)` subprocess calls (not a
resolution-only check):
1. Built a fake plugin-cache home (`os.tmpdir()`-based, `HOME`/`USERPROFILE` redirected)
   whose `9.9.9` version dir junction-links this repo's real `lib/` and `dashboard/` —
   simulating an installed consumer's plugin cache.
2. Extracted the **literal** fixed `worker-stop` command straight out of
   `agents/worker.md`'s frontmatter (no hand-retyped approximation) and ran it via bash
   with `cwd` = a temp foreign project (no `lib/` present, i.e. NOT this repo) and
   `CLAUDE_PROJECT_DIR` pointed at that same foreign project, `CLAUDE_PLUGIN_ROOT` deleted
   from the child env, feeding a real JSON stdin payload. **Observed:** exit 0, and
   `.agentheim/state/in-flight.json` appeared under the foreign project with a recorded
   worker completion.
3. Ran the **literal old broken command string** (`node "${CLAUDE_PROJECT_DIR}/lib/hook-agent-signal.mjs" worker-stop`)
   against the identical foreign-project setup. **Observed:** no `in-flight.json` ever
   appears — the bug, reproduced directly, not just asserted.
4. Ran the fixed `verifier-stop` command with `cwd` = this repo (dogfood) but
   `CLAUDE_PROJECT_DIR` pointed at a *different* temp project dir. **Observed:** the
   script resolved via the repo-local cwd short-circuit, exit 0, and the artifact landed
   under `CLAUDE_PROJECT_DIR` (not cwd, not the repo's own `.agentheim/state/`) — proving
   the "where the script is found" vs. "where it writes" split stayed intact (AC#2 +
   the "do not touch write-target resolution" guard).

Static guards (`lib/test/helpers/hook-command.mjs`) also assert all three sites use the
new bootstrap shape and reject the old literal form, with a Red-proof meta-test proving
the predicate itself would have caught the original bug.

`node --test lib/test/*.test.mjs`: 183/183 green (was 176; +7, all real subprocess/static
tests, no skips — `bash` was available on this Windows box for every run).

**Files:**
- `agents/worker.md`, `agents/verifier.md`, `skills/work/SKILL.md` — hook `command:` lines
  (frontmatter only; SKILL.md body prose untouched, left for the sibling v8n3t task).
- `lib/test/hook-command-path.test.mjs` (new) — static guards + real-subprocess
  reproduction (old-form failure, new-form success, dogfood decoupling).
- `lib/test/helpers/hook-command.mjs` (new) — YAML-scalar extraction + classification
  helpers, mirroring `dashboard/test/helpers/card.mjs`'s established shape.
- `.agentheim/knowledge/decisions/0043-live-observability-hook-heartbeat-second-advisory-artifact.md`
  — `## Amendment (2026-07-04, agentic-workflow-g7p2x)` appended (no new ADR number; this
  extends 0043's own flagged risk, doesn't overturn its core decision).
- `.agentheim/contexts/agentic-workflow/README.md` — new bullet under `lib/agent-heartbeat.mjs
  / lib/hook-agent-signal.mjs` documenting the fixed, env-independent command path.
