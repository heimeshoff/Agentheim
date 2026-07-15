---
id: infrastructure-w6p4k
title: Drop the "modeling:" prefix from bridge-derived session names
status: todo
type: chore
context: infrastructure
created: 2026-07-15
completed:
depends_on: []
blocks: []
tags: [bridge, session-name, vscode-extension]
related_adrs: [0018]
related_research: [claude-code-terminal-session-naming-2026-06-15]
prior_art: [infrastructure-c6fzb]
---

## Why
When a `modeling` session is launched via the VS Code Bridge, its terminal tab
and `/resume` picker entry currently read `modeling: <rest>` — the bridge's
session-name **fallback derivation** prepends the skill name. The builder finds
that `modeling:` prefix to be noise for modeling launches specifically and wants
the name to be just the idea text.

Scoped decision (builder, 2026-07-15): **only modeling** loses its prefix. Every
other skill (`work:`, `research:`, `inquire:`, …) keeps the uniform `<skill>: …`
convention that infrastructure-c6fzb established. This is a deliberate carve-out,
not a wholesale reversal of that convention.

## What
Special-case `modeling` in the bridge's `deriveNameFromPrompt`
(`vscode-extension/src/bridge.js:273`) so a `/agentheim:modeling <rest>` launch
derives the session name from `<rest>` alone — no `modeling:` prefix — while all
other `/agentheim:<skill> <rest>` launches keep deriving `<skill>: <rest>`.

The explicit-name path (`resolveSessionName` when a caller supplies a `name`) is
unchanged — this only touches the prompt-derived fallback.

## Acceptance criteria
- [ ] `deriveNameFromPrompt('/agentheim:modeling dark mode toggle')` returns the
      sanitized `dark mode toggle` — **no** `modeling:` prefix.
- [ ] Non-modeling skills are untouched: `/agentheim:work foo` still derives
      `work: foo`, `/agentheim:research bar` still derives `research: bar`.
- [ ] Bare `/agentheim:modeling` with no trailing text still yields a usable
      name (the bare `modeling` label — there is no rest to name it from).
- [ ] The explicit-name path (`resolveSessionName({ name, prompt })` with a
      supplied `name`) is unchanged.
- [ ] `vscode-extension/test/bridge.test.mjs` is updated: the existing assertion
      that `deriveNameFromPrompt('/agentheim:modeling dark mode toggle')` equals
      `'modeling: dark mode toggle'` (bridge.test.mjs:322-323) now reflects the
      unprefixed expectation, plus a test pins that a non-modeling skill keeps
      its `<skill>:` prefix (guarding the carve-out from over-reaching).

## Notes
- **Where the prefix comes from:** `deriveNameFromPrompt` in
  `vscode-extension/src/bridge.js` — regex `/^\/agentheim:(\S+)\s*([\s\S]*)$/`,
  then `sanitizeName(rest ? \`${skill}: ${rest}\` : skill)`. The modeling
  carve-out is: when `skill === 'modeling'` and there is a `rest`, return
  `sanitizeName(rest)` without the `${skill}: ` prefix.
- **Governed by ADR-0018 / infrastructure-c6fzb**, which codified the
  `/agentheim:<skill> … → <skill>: …` fallback derivation. This task introduces a
  documented exception to that uniform rule — the worker should decide whether a
  one-line ADR-0018 amendment recording the modeling carve-out is warranted.
- **Related but out of scope (separate surface, dashboard-owned):** the dashboard
  prompt-bar's Modeling tab launches with an *explicit* name `"Modeling: <text>"`
  via `nameForPromptMode` (`dashboard/app/prompt-mode.js`), which bypasses
  `deriveNameFromPrompt` entirely (an explicit `name` wins in
  `resolveSessionName`). That path is capital-`M` "Modeling:" and lives in
  `agentic-workflow`/dashboard, not this BC. If the builder wants
  *dashboard-launched* modeling sessions unprefixed too, capture that separately
  against `agentic-workflow` — this task fixes only the bridge/terminal
  (lowercase `modeling:`) derivation the builder named.
- **Guardrails already present:** `bridge.js`'s naming logic is pure and
  unit-tested with the terminal-launch action injected — the change is a small
  edit to one pure function plus its test.
