---
id: infrastructure-v8r3q
title: The bridge contract grows but never versions — an old bridge silently swallows fields the dashboard sends
status: backlog
type: bug
context: infrastructure
created: 2026-07-13
completed:
depends_on: []
blocks: []
tags: [bridge, dashboard, versioning, vscode-extension, silent-failure]
related_adrs: [0018, 0013]
related_research: []
prior_art: [infrastructure-h5wnq, infrastructure-c6fzb, infrastructure-016, infrastructure-014, infrastructure-017]
---

## Why

The builder selected Sonnet in the dashboard's model selector and got an Opus session. He
named the session and got a terminal called "Claude". Both features were built, tested, and
shipped — and both did nothing.

**Nothing was broken.** `src/bridge.js` builds `['-n', name, '--model', model, …]` correctly,
`claude --help` really does carry `-n, --name` and `--model`, and `dashboard/dist/app.js`
really does put both fields in the `POST /run` body. The actual cause was version skew: the
extension **on disk** was 0.4.0 (installed 14:09), but the two live VS Code extension hosts
had started at 09:08 and 09:36 and were still executing **0.2.0** from memory. 0.2.0's
`makeHandler` reads only `prompt` and `skipPermissions`, ignores every other JSON field, and
hard-codes `createTerminal({ name: 'Claude' })`. Reloading the window fixed it.

The defect is not the missing flags. **The defect is that nothing told him.** The dashboard
POSTed `{ prompt, name, model }`, an old bridge dropped two of those three fields on the
floor, returned `202 { ok: true }`, and the UI reported success. A capability the running
bridge does not have degrades **silently and indistinguishably from success** — the builder's
only recourse was to notice the wrong model in a running session and then have someone go
read process start-times against extension install-times to find out why.

`bridge.json` even carries a version field for exactly this purpose — `BRIDGE_V = 1`
(`src/bridge.js:29`) — and `GET /api/bridge` passes it to the frontend. But it has **stayed at
`1` through every growth of the `/run` contract**: `skipPermissions` (infrastructure-016),
`name` (infrastructure-c6fzb), and `model` (infrastructure-h5wnq) were all added without
touching it. So the one signal designed to detect this skew is inert, and the frontend has no
way to ask "can the bridge you found actually honour what I'm about to send it?"

This will recur on every future field added to `/run`, and it will recur for every user who
updates the plugin without reloading their editor — which is the normal case, since VS Code
defers loading a new extension version until the window reloads.

## What

Make the bridge's advertised version mean something, and make the dashboard act on it.

Three moving parts:

1. **The bridge declares what it can do.** Either bump `BRIDGE_V` monotonically whenever the
   set of `/run` fields it honours changes, or (probably better) have `bridge.json` carry an
   explicit capability list — the fields this listener will actually act on. An integer says
   "newer"; a list says "understands `model`", which is what the caller genuinely needs to know
   and which survives out-of-order feature landings.

2. **The capability reaches the frontend.** `GET /api/bridge` already carries `v` through from
   `bridge.json`; it carries whatever replaces or joins it too.

3. **The dashboard refuses to lie.** When the live bridge cannot honour a field the UI can
   send, that control does not silently no-op. The precedent already exists in-tree:
   `probeBridge` (`dashboard/app/bridge-launch.js`) was added by infrastructure-h5wnq for
   exactly this reason — the model selector greys out when *no* bridge is reachable, because a
   clipboard-copied command can't carry a `--model` flag. This task extends that same honesty
   from *bridge absent* to *bridge too old*: an unsupported control is disabled or flagged,
   with a message that names the actual fix ("reload your VS Code window to pick up bridge
   0.4.0").

**Also make the version bump hard to forget.** The root cause is that three separate tasks
grew the `/run` contract and none of them bumped `BRIDGE_V`. A prose rule in ADR-0018 is the
thing that already failed. Prefer a structural guard — e.g. a test that pins the honoured-field
set against the declared version and fails when they drift apart, so adding a field to
`makeHandler` without declaring it breaks the build.

## Acceptance criteria

- [ ] The bridge advertises, in `bridge.json`, what the running listener can actually honour —
      not merely that it exists. (`BRIDGE_V` bumped and/or a capability list; the choice is the
      task's to make and record.)
- [ ] `GET /api/bridge` carries that capability signal through to the frontend.
- [ ] With a bridge that does **not** support `model`, the dashboard's model selector is
      visibly unavailable (or clearly warns) rather than silently sending a field that gets
      dropped. Same for the session-name field.
- [ ] The message the builder sees names the real remedy — reloading/updating the VS Code
      extension — not a generic "unavailable".
- [ ] A test fails if a new field is added to `POST /run`'s honoured set without the declared
      capability/version changing to match. (The prose rule already failed three times; this
      criterion is the one that stops a fourth.)
- [ ] Regression coverage for the exact live scenario: a 0.2.0-shaped bridge (honours only
      `prompt` + `skipPermissions`) plus a current dashboard ⇒ the UI does **not** report a
      successful model/name launch.

## Notes

**Evidence from the live box (2026-07-13):**

- `~/.vscode/extensions/agentheim.agentheim-bridge-0.4.0` — created 14:09:48.
- `~/.vscode/extensions/agentheim.agentheim-bridge-0.2.0` — created 15.06, listed in
  `.obsolete`, awaiting deletion on next restart.
- Two live listeners: pid 35212 (VS Code, started 09:08:06) on :31425, pid 38476 (started
  09:36:35) on :31426. Both predate the 0.4.0 install, so both were running 0.2.0 code.
- `.agentheim/.dashboard/bridge.json` advertised `{ port: 31426, v: 1 }` — the `v: 1` being
  precisely the value it also had when `model` support existed, which is the bug in one line.
- Confirmed by grep: 0.2.0's `src/bridge.js` has no `sanitizeModel`; its `extension.js` has no
  `nameFromArgs`.

**Open design questions for refinement:**

- Monotonic `v` vs an explicit capability list. A list is more honest and order-independent;
  an integer is cheaper and `v` already exists. Leaning list, but it's a real fork.
- How loud should the skew be? Greying the control out (the `probeBridge` precedent) is
  consistent but quiet — a builder who never opens the selector never learns his extension is
  stale. A one-time banner may be warranted, since the skew affects *launching* generally, not
  just the one control.

**Adjacent hazard, deliberately NOT in this task's scope** (capture separately if it bites):
two VS Code windows were each running a bridge, and `bridge.json` is last-writer-wins. The
dashboard therefore drives whichever window's extension host started last — not necessarily the
window the builder is looking at, and with no signal about which. Orthogonal to the capability
handshake; worth its own task if it ever produces a confusing launch.
