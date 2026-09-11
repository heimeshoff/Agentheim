---
id: infrastructure-016
title: Bridge extension honours the opt-in skip-permissions option on POST /run
status: done
type: feature
context: infrastructure
created: 2026-06-14
completed: 2026-06-15
commit: 1ad7d46
depends_on: [infrastructure-015]
blocks: []
tags: [bridge, extension, permissions, dashboard]
related_adrs: [0018, 0002]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: []
---

## Why
Today the VS Code bridge extension (infrastructure-013) accepts `POST /run { prompt }`
and seeds the terminal with `claude "<prompt>"` — permission prompts intact. For the
opt-in bypass setting to actually take effect, the extension must accept and honour a
skip-permissions option on the request and construct the command accordingly. This is
the code half of the decision frozen in infrastructure-015.

## What
Extend the bridge extension's `POST /run` handler to read the bypass option (shape
fixed by infrastructure-015) and, when set, seed the terminal with
`claude --dangerously-skip-permissions "<prompt>"` instead of `claude "<prompt>"`.

- Default (option absent or false) is **unchanged**: `claude "<prompt>"`, prompts intact.
- Everything else holds: token-header rejection, the `OPTIONS` CORS preflight, the
  loopback-only bind, `200`/`202` on success, `400` on malformed body.

## Acceptance criteria
- [ ] `POST /run { skipPermissions: true }` seeds `claude --dangerously-skip-permissions "<prompt>"`.
- [ ] **Only literal `true`** activates the bypass: absent / `false` / the string `"true"` / null all seed `claude "<prompt>"` exactly as today (strict-boolean fail-safe — malformed input never silently enables the bypass).
- [ ] A regression guard asserts a `POST /run` **without** `skipPermissions` produces the byte-identical pre-amendment command.
- [ ] Token rejection (401), OPTIONS preflight, loopback bind, and 400-on-malformed-body are unaffected.
- [ ] The command-construction logic is covered by tests (both branches), in the pure unit-testable `vscode-extension/src/bridge.js` with the launch action injected — no `vscode`-API change.

## Notes
- Depends on infrastructure-015 (the frozen contract field — recommended name
  `skipPermissions`). Do not start the extension change before the field name/type is
  pinned by the ADR amendment.
- Pure logic stays in `vscode-extension/src/bridge.js`; `extension.js` (the only file
  touching the `vscode` API) is untouched.
- Open for refine: whether the extension shell-escapes the prompt differently when a
  flag precedes it; how the `.vsix` is re-packaged/versioned for this change.
- Bridge research backing: `knowledge/research/vscode-dashboard-terminal-bridge-2026-06-09.md`.

## Outcome
The bridge `POST /run` handler now honours the opt-in `skipPermissions` option
exactly per ADR-0018's amendment. Command construction in the pure core
`vscode-extension/src/bridge.js` uses a strict identity check
(`parsed?.skipPermissions === true`): only the JSON boolean literal `true` seeds
`claude --dangerously-skip-permissions "<prompt>"`; field absent / `false` /
`null` / the string `"true"` / a number all fall through to the byte-identical
pre-amendment `claude "<prompt>"`. Prompt double-quote escaping is unchanged and
applies regardless of the flag. `extension.js` (the only `vscode`-API file) was
not touched — the launch action remains injected.

Tests added to `vscode-extension/test/bridge.test.mjs` (purely additive, ephemeral
ports): the bypass-true branch, a 5-case fail-safe matrix (false/"true"/null/number/
absent all default to the gated command), and a regression guard asserting the
no-`skipPermissions` command is byte-identical to the pre-amendment string. All
command-construction tests pass. (The two fixed-port binding tests fail only in
this dev box because a live bridge holds port 31425 — pre-existing/environmental,
unrelated to this change.)

Key files:
- `vscode-extension/src/bridge.js` — strict-`true` command construction in `makeHandler`.
- `vscode-extension/test/bridge.test.mjs` — both branches + regression guard.
- `vscode-extension/package.json` — corrected stale "no permission-bypass flags" description.

Follow-up: infrastructure-017 (backlog) — re-package/version the `.vsix` for this change.
No ADR written — the decision is fully frozen by ADR-0018's 2026-06-14 amendment;
this task is its code half.
