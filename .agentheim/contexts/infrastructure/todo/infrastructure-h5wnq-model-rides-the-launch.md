---
id: infrastructure-h5wnq
title: The model rides the launch — POST /run carries a model, the bridge spawns claude --model, and the dashboard learns whether a bridge is even there
status: todo
type: feature
context: infrastructure
created: 2026-07-13
completed:
depends_on: []
blocks: [agentic-workflow-m2vkp]
tags: [bridge, vscode-extension, transport, launch, model]
related_adrs: [0018, 0031]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [infrastructure-c6fzb, infrastructure-016]
---

## Why
The prompt bar is growing a model selector (`agentic-workflow-m2vkp`), but the
launch path has nowhere to put the answer. `POST /run` today carries
`{ prompt, skipPermissions, name }` and the bridge spawns
`claude -n <name> [--dangerously-skip-permissions] <prompt>`. A chosen model has
to ride that same descriptor as `--model <id>`, or the selector is decoration.

Second, smaller hole: the builder's ruling is that **the model selector greys out
when no bridge is reachable** — a clipboard-copied command cannot carry a
`--model` flag, so the control must not promise what the fallback can't deliver.
But the dashboard has no *ambient* notion of bridge presence: `launchOrCopy`
discovers and health-probes the bridge **lazily, at fire time**
(`dashboard/app/bridge-launch.js`). Nothing knows, at render time, whether the
bridge is up. That signal has to exist before any UI can react to it.

Both halves are the bridge transport contract, so they land here rather than in
`agentic-workflow` — same routing as `infrastructure-c6fzb`, which threaded the
session `name` through this exact seam.

## What

**1. `model` on the launch descriptor.**
- `dashboard/app/bridge-launch.js` — `launchOrCopy({ ..., model })` forwards an
  optional `model` in the `POST /run` body. Omitted / empty / non-string → the
  field is simply absent, exactly as `name` degrades today.
- `vscode-extension/src/bridge.js` — `POST /run` accepts an optional `model`,
  **sanitizes and allowlists** it, and prepends `'--model', model` to the argv as
  its own raw argv pair (never string-interpolated into a shell — same discipline
  as `-n <name>` and `--dangerously-skip-permissions`). A missing or
  non-allowlisted `model` spawns with **no `--model` flag at all**, so the session
  inherits the user's Claude Code config. A rejected value is never a 500 — it
  degrades to "no flag", quietly.
- The allowlist is the point: the value reaches a spawned process, so it is a
  closed set, not free text.

**2. An ambient bridge-presence signal.**
- Export a `probeBridge(fetchImpl)` from `bridge-launch.js` that runs the existing
  discover (`GET /api/bridge`) + health (`GET /health`, ~800 ms budget) steps and
  resolves to a plain `{ present: boolean }` — reusing the two functions that are
  already in that module, not a second implementation of them.
- It must be as silent as `launchOrCopy` is: every failure mode (no bridge.json,
  dead port, thrown fetch, no fetch at all, not-in-Simple-Browser) resolves
  `{ present: false }`. Never throws, never logs noisily.
- Consumed by the prompt bar in `agentic-workflow-m2vkp`; this task only has to
  *provide* it and test it.

## Acceptance criteria
- [ ] `POST /run` accepts an optional `model`; a valid one produces
      `claude -n <name> --model <id> [--dangerously-skip-permissions] <prompt>` with
      `--model` and its value as **two separate raw argv elements**.
- [ ] A missing, empty, non-string, or non-allowlisted `model` spawns with **no**
      `--model` flag and **no** error response — the launch still succeeds.
- [ ] The allowlist is a single exported constant in the bridge, and a value
      outside it (including one carrying shell metacharacters, spaces, newlines, or
      a leading `-`) can never reach the argv.
- [ ] Existing `/run` callers that send no `model` behave **byte-identically** to
      today (the `name` + `skipPermissions` argv order is unchanged).
- [ ] `launchOrCopy` forwards `model` when given one and omits the field entirely
      when not; the clipboard fallback path is untouched (no `--model`, no
      `/model` line — the builder ruled: the selector is greyed out there, so the
      fallback never has to carry a model).
- [ ] `probeBridge(fetchImpl)` is exported from `bridge-launch.js`, resolves
      `{ present: true }` against a live token-answering bridge and
      `{ present: false }` for every failure mode, and never throws or rejects.
- [ ] `probeBridge` reuses the module's existing `discoverBridge` / `probeHealth`
      internals rather than duplicating the two-step protocol.
- [ ] The `.vsix` is repackaged and `vscode-extension/package.json` is version-bumped
      (the bridge's wire contract changed). If `vsce` isn't available, say so
      plainly in the return rather than claiming the package shipped.

## Notes
- **The model alias set is an open question the worker must answer, not guess.**
  `claude --model` takes aliases (`opus`, `sonnet`, `haiku`) and full ids
  (`claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5-20251001`,
  `claude-fable-5`). **Fable may not have a short alias** — check `claude --help`
  / the CLI docs and use the full id where no alias exists. The allowlist should
  hold whatever actually works, and the prompt bar's display labels
  (`agentic-workflow-m2vkp`) map onto it. Consult the `claude-api` skill or the
  researcher rather than assuming.
- **This does not touch ADR-0031 and must not be described as if it does.**
  ADR-0031 pins a model *per agent* (`worker`→sonnet, `verifier`→opus, …) via
  agent frontmatter. `--model` sets the **main-loop / session** model. They
  compose: a session launched `--model haiku` still spawns its `verifier` on opus.
  A worker touching this should not "reconcile" the two — there is no conflict.
- ADR-0018 governs this transport (localhost listener, token header, argv-not-shell).
  Every rule there holds: the new field is one more raw argv pair, and the token
  header requirement is unchanged.
- Prior art worth reading first: `infrastructure-c6fzb` did precisely this shape of
  change for `name` two commits ago — `sanitizeName` / `resolveSessionName` /
  `const args = ['-n', name, ...existingArgs]`. Follow it.
- **Test-environment gotcha:** `vscode-extension/test/bridge.test.mjs` has two
  fixed-port tests that fail `EADDRINUSE` on `127.0.0.1:31425` whenever the
  builder's real bridge extension is live in VS Code. That is **pre-existing and
  environmental, not a regression** — expect exactly those two, and treat a third
  failure as yours. (Making that port injectable is a known un-captured cleanup.)
