---
id: agentic-workflow-g7p2x
title: Observability hook command path breaks in consumer plugin installs
status: todo
type: bug
context: agentic-workflow
created: 2026-07-04
completed:
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

- [ ] In a scratch consumer project with Agentheim installed as a plugin (not this
      repo), a fired hook actually executes: `.agentheim/state/in-flight.json`
      appears/updates in the consumer project. This is the end-to-end proof — a
      resolution-only check is not sufficient, since silent failure is the bug.
- [ ] The same hooks still work when running from this source repo (dogfood
      development), same observable write.
- [ ] All three registration sites are fixed consistently (`agents/worker.md`,
      `agents/verifier.md`, `skills/work/SKILL.md`) — no site left on the old path.
- [ ] The script's internal project-root resolution (env-first, documented fallback)
      is unchanged; `node --test lib/test/*.test.mjs` stays green.
- [ ] The resolution choice (plugin-root variable vs. bootstrap fallback) and its
      verified support status are recorded — as an amendment note to ADR-0043 or a
      new ADR if the investigation overturns an 0043 assumption.

## Notes

- Verification in a consumer install may need a manual hook fire (e.g. run a trivial
  `work` batch in the scratch project) — describe the actual reproduction used in the
  task outcome so the verifier can weigh the evidence.
- The dashboard's `InFlightLane` staleness self-suppression (ADR-0043) means a broken
  hook produces *no visible error anywhere* — worth one line in the ADR amendment on
  why silent-failure surfaces nowhere, in case a future regression repeats this.
