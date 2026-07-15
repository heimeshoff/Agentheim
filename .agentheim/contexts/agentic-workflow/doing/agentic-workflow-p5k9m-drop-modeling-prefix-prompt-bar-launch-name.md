---
id: agentic-workflow-p5k9m
title: Drop the "Modeling:" prefix from dashboard prompt-bar launch names
status: doing
type: chore
context: agentic-workflow
created: 2026-07-15
completed:
depends_on: []
blocks: []
tags: [prompt-bar, session-name, dashboard]
related_adrs: [0018]
related_research: [claude-code-terminal-session-naming-2026-06-15]
prior_art: [agentic-workflow-n4qte]
---

## Why
When the builder launches a **modeling** session from the dashboard prompt bar's
Modeling tab, the session terminal is named `Modeling: <typed text>` — the
prompt bar sends an *explicit* mode-derived name via `nameForPromptMode`
(`dashboard/app/prompt-mode.js`), which the bridge honours as-is (an explicit
`name` wins in `resolveSessionName`, bypassing the bridge's own derivation). The
builder wants modeling launches unprefixed.

This is the dashboard-side sibling of **infrastructure-w6p4k**, which drops the
lowercase `modeling:` prefix from the *bridge's* prompt-derived fallback (typed
`/agentheim:modeling …` launches). That task cannot fix this path: the prompt bar
supplies an explicit name, so the bridge fallback never runs. Same builder intent,
different code path, different BC.

Scoped decision (builder, 2026-07-15): **only modeling** loses its prefix. The
other prompt-bar modes (Quick Capture, Inquire, Research, Plain) keep their
`"<label>: <typed text>"` naming.

## What
Special-case the `modeling` mode in `nameForPromptMode`
(`dashboard/app/prompt-mode.js:217`) so a Modeling-tab launch derives the session
name from the typed text alone — no `Modeling: ` prefix — while every other mode
keeps `"<label>: <typed text>"`.

## Acceptance criteria
- [ ] `nameForPromptMode(<modeling index>, 'dark mode toggle')` returns
      `dark mode toggle` — **no** `Modeling: ` prefix.
- [ ] Other modes are untouched: e.g. the Research tab still yields
      `Research: dark mode toggle`, Quick Capture still yields
      `Quick Capture: dark mode toggle`.
- [ ] A Modeling launch with an empty/whitespace-only prompt still degrades to a
      usable bare name (decide: the bare `Modeling` label, or omit the name and
      fall back to the bridge's own derivation — keep it non-empty and non-throwing).
- [ ] The `LAUNCH_NAME_MAX_LEN` cap and non-throwing contract are preserved.
- [ ] `dashboard/test/prompt-mode.test.mjs` is updated to assert the modeling
      carve-out and to pin that a non-modeling mode keeps its `<label>:` prefix.

## Notes
- **Where the prefix comes from:** `nameForPromptMode(index, prompt)` in
  `dashboard/app/prompt-mode.js` — `base = trimmed ? \`${label}: ${trimmed}\` : label`,
  where `label = PROMPT_MODES[idx].label` (`'Modeling'` for the modeling mode).
  The carve-out: when the armed mode is `modeling` and there is trimmed text,
  return the trimmed text without the `${label}: ` prefix.
- **Identify the modeling mode by its stable `id: 'modeling'`**, not by matching
  the `'Modeling'` label string — the label is display copy and could change;
  the `PROMPT_MODES` entry's `id` is the durable key.
- **Governed by ADR-0018 / infrastructure-c6fzb** (the POST /run `name` field and
  the explicit-name-wins rule). `nameForPromptMode` is a *courtesy* derivation —
  the bridge re-sanitizes/caps whatever it receives — so this change is purely
  about what string the prompt bar chooses to send.
- **Sibling task:** infrastructure-w6p4k (bridge fallback, lowercase `modeling:`).
  Independent code paths — no ordering dependency — but a reviewer landing both
  should confirm the modeling carve-out reads consistently across the two.
