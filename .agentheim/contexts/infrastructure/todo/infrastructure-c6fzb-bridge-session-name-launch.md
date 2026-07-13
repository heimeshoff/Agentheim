---
id: infrastructure-c6fzb
title: Bridge-launched sessions carry a derived name — createTerminal({name}) + claude -n
status: todo
type: feature
context: infrastructure
created: 2026-07-13
completed:
depends_on: []
blocks: []
tags: [bridge, vscode-extension, session-naming, terminal, dashboard]
related_adrs: [0018]
related_research: [claude-code-terminal-session-naming-2026-06-15]
prior_art: [infrastructure-016, infrastructure-020, infrastructure-q8m4t, infrastructure-011]
---

## Why

Every session the dashboard launches shows up in VS Code as "Claude" — because
Agentheim's own bridge extension hard-codes it: `createTerminal({ name: 'Claude', ... })`
at `vscode-extension/extension.js:86`. With several concurrent sessions the tabs are
indistinguishable, and the session picker entry is equally generic.

The June research report (`claude-code-terminal-session-naming-2026-06-15`) correctly
concluded no naming flag existed then. That is now outdated on one point: the installed
CLI (verified on 2.1.207) ships `-n, --name <name>` — "Set a display name for this
session (picker, and terminal title)". Meanwhile `/rename` remains strictly user-typed:
no model, skill, hook, or subagent can invoke it, so launch time is the only
programmatic naming point — and the bridge owns the launch.

Scope is deliberately bridge-only: sessions the builder starts manually in a terminal
and then hands to Agentheim cannot be renamed by the plugin (confirmed against current
docs 2026-07-13); those stay out of scope.

## What

Name the session at launch, on the path the bridge already owns:

1. `POST /run` gains an optional `name` field (string). The pure core
   (`vscode-extension/src/bridge.js`) sanitizes it (trim, strip control chars/newlines,
   cap at ~60 chars); when absent or malformed it derives a fallback from the prompt —
   strip a leading `/agentheim:<skill>` prefix to `<skill>: <first chars of the text>`,
   or just the leading prompt text for plain prompts. The result rides the launch
   descriptor: `args` gains `-n <name>` prepended, exactly the pattern the
   `skipPermissions` flag already uses (infrastructure-016). The name is a raw argv
   element like the prompt — no shell parses it (infra-020 / q8m4t discipline).
2. `extension.js` uses the descriptor's name in `createTerminal({ name })` instead of
   the hard-coded `'Claude'` — tab and session picker both stop saying "Claude".
3. The dashboard prompt bar sends `name` derived from its mode + typed text
   (e.g. `model: dark mode toggle`), since the frontend knows the mode more cleanly
   than prompt-prefix parsing does.

## Acceptance criteria

- [ ] `POST /run` accepts an optional `name`; the emitted launch descriptor becomes
      `{ command: 'claude', args: ['-n', <name>, ...existing args] }`, with
      `skipPermissions` composition preserved.
- [ ] Absent/malformed `name` → the core derives a fallback from the prompt
      (`/agentheim:<skill> …` → `<skill>: …`; plain text → truncated text); no request
      shape is rejected that was accepted before (backward compatible).
- [ ] Name sanitization: trimmed, control characters and newlines stripped, length
      capped; the prompt argv element itself is untouched (byte-for-byte survival tests
      from infra-020/q8m4t still pass).
- [ ] `extension.js` passes the descriptor's name to `createTerminal({ name })`; the
      literal `'Claude'` default survives only as the last-resort fallback when no name
      can be derived.
- [ ] Dashboard prompt bar sends a mode-derived `name` for every launch mode.
- [ ] `vscode-extension/test/bridge.test.mjs` covers: name present, name absent
      (fallback derivation), name malformed (sanitized), and descriptor ordering with
      `skipPermissions` armed.
- [ ] A dashboard-launched session's VS Code terminal tab and `/resume` picker entry
      both show the derived name, not "Claude" (manual verification on Windows).

## Notes

- `/rename` is architecturally off-limits to the model/plugin (user-typed only; no hook
  or MCP surface exists) — do not attempt an in-session rename path. Launch-time `-n`
  is the whole mechanism.
- The extension change requires repackaging the `.vsix` (see infrastructure-017 for the
  release pattern) — bump the extension version as part of this task.
- Concurrent identical prompts will produce identical names; that is acceptable — the
  goal is "not Claude", not global uniqueness.
- ADR-0018's `POST /run` contract grows one optional field; note the amendment in the
  ADR if the worker judges it contract-level (it is additive and backward compatible).
- Verify `-n` composes with a positional prompt argument on the installed CLI before
  wiring (`claude -n "x" "prompt"` — 30-second smoke test).
