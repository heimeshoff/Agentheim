---
id: infrastructure-c6fzb
title: Bridge-launched sessions carry a derived name — createTerminal({name}) + claude -n
status: done
type: feature
context: infrastructure
created: 2026-07-13
completed: 2026-07-13
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

## Outcome

Bridge-launched sessions now carry a derived or explicit display name instead of the
hard-coded `'Claude'`. `POST /run` gains an optional, additive `name: string` field.
The pure core (`vscode-extension/src/bridge.js`) sanitizes an explicit name (trim,
strip control characters/newlines, cap at 60 chars via `sanitizeName`); when absent
or it sanitizes to empty, `deriveNameFromPrompt` derives a fallback — a leading
`/agentheim:<skill>` prefix becomes `<skill>: <rest>`, plain text becomes the prompt
itself. `resolveSessionName` composes both and is exported for test use. The
resolved name rides its own raw argv pair, prepended exactly the way the
`skipPermissions` flag already prepends (infrastructure-016):
`args = ['-n', <name>, ...existingArgs]`, so the full ordering with an armed bypass
is `['-n', <name>, '--dangerously-skip-permissions', <prompt>]`. No shell parses it
(infra-020/q8m4t discipline holds).

`extension.js` gained `nameFromArgs(args)`, which recovers the name from the
descriptor's `-n` pair and passes it to `createTerminal({ name })`; `'Claude'`
survives only as the last-resort fallback if `args` ever arrives without a `-n`
pair.

The dashboard prompt bar derives an explicit, mode-aware name via a new
`nameForPromptMode(index, prompt)` in `dashboard/app/prompt-mode.js`
(`"<mode label>: <typed text>"`, or the bare label on an empty prompt), threaded
through `bridge-launch.js`'s `launchOrCopy`/`runOnBridge` (omitted from the POST body
when absent/blank, never sent to the clipboard fallback — there is no launch to
name there) and wired into `board.js`'s `fire()` alongside the existing
`skipPermissions` thread. Other launch affordances (backlog card Refine/Promote,
Work, What's-next, the trash-can dismiss) were left untouched, per scope — they
rely on the bridge's own prompt-derived fallback.

ADR-0018 was amended in place (additive, `status: proposed` unchanged, no
`supersedes`) with a dated banner plus updates to the "HTTP shape and status codes"
section recording the `name` field and its frozen command-construction rule;
`infrastructure-c6fzb` added to `related_tasks`. The BC README's *Bridge*
ubiquitous-language entry and the ADR-0018 changelog paragraph were updated to
match. `vscode-extension/package.json` bumped `0.2.1` -> `0.3.0` (a new capability,
not just a fix) and its description mentions the naming behavior; `vsce` is not
installed in this worktree (no `vscode-extension/node_modules`), so the `.vsix`
itself was **not** repackaged — noted here rather than fabricated, per the task's
own guidance. `dashboard/dist/app.js` was rebuilt (`node build.mjs`) since
`dashboard/app/board.js`, `bridge-launch.js`, and `prompt-mode.js` all changed.

Confirmed via `claude --help` (installed CLI 2.1.207) that `-n, --name <name>`
exists exactly as the Why section states; no interactive `claude -n "x" "prompt"`
session was launched (that would require driving a live terminal), so the
positional-prompt-composition smoke test is **not independently verified** beyond
the flag's documented existence.

Tests: `vscode-extension/test/bridge.test.mjs` gained 8 new tests (pure
`sanitizeName`/`deriveNameFromPrompt`/`resolveSessionName` coverage, plus
integration tests for an explicit name, a malformed/over-length name, and
descriptor ordering with `skipPermissions` armed) and had 7 existing tests
rewritten for the new always-present `-n <name>` args shape (regression guard,
metacharacter/typographic-quote survival, the skip-permissions matrix). Dashboard
gained 4 new tests in `dashboard/test/prompt-mode.test.mjs` (`nameForPromptMode`),
4 in `dashboard/test/bridge-launch.test.mjs` (name threading through
`launchOrCopy`), and 1 in `dashboard/test/board-prompt-bar.test.mjs` (fire() wiring).
Full suite: 1057 pass / 2 fail — the 2 failures are the pre-existing, environmental
fixed-port EADDRINUSE cases (a live VS Code bridge holds 31425 on this dev box),
confirmed identical at the pre-session baseline commit; no regression.

**AC 7 (manual VS Code verification that the terminal tab and `/resume` picker show
the derived name) is NOT verified here** — it requires a human driving VS Code and
is explicitly left to the builder.

Key files: `vscode-extension/src/bridge.js`, `vscode-extension/extension.js`,
`vscode-extension/test/bridge.test.mjs`, `vscode-extension/package.json`,
`dashboard/app/prompt-mode.js`, `dashboard/app/bridge-launch.js`,
`dashboard/app/board.js`, `dashboard/dist/app.js`,
`dashboard/test/prompt-mode.test.mjs`, `dashboard/test/bridge-launch.test.mjs`,
`dashboard/test/board-prompt-bar.test.mjs`,
`.agentheim/knowledge/decisions/0018-vscode-dashboard-terminal-bridge.md`,
`.agentheim/contexts/infrastructure/README.md`.
