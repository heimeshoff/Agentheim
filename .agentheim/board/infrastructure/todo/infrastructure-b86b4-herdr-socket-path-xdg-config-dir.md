---
id: infrastructure-b86b4
title: The herdr bridge is never reported live on macOS and Linux because socketPath looks for <home>/.herdr/herdr.sock, while herdr puts its socket under ${XDG_CONFIG_HOME:-<home>/.config}/herdr/; every dashboard launch silently falls back to the clipboard (bug)
status: todo
type: bug
context: infrastructure
created: 2026-11-25
completed:
depends_on: []
blocks: []
tags: [herdr, bridge, setup, dashboard]
related_adrs: [0082]
related_research: []
prior_art: [infrastructure-e8h9f, infrastructure-xh8tw]
---

## Why
`checkHerdrLiveness` (lib/resolve-herdr.mjs) runs `herdr status` only after the socket file
exists. `socketPath()` assumes `<home>/.herdr/herdr.sock` on POSIX. The comment says "the
POSIX shape mirrors it under `<home>/.herdr/`", which was a guess: only the win32 path
(`%APPDATA%\herdr\herdr.sock`) was verified in infrastructure-e8h9f. herdr actually puts
its socket in its config directory:

- macOS: `herdr status` prints `socket: /Users/<user>/.config/herdr/herdr.sock`
- Linux (Docker sandbox): `socket: /home/agent/.config/herdr/herdr.sock`
- herdr honours `XDG_CONFIG_HOME`: with `XDG_CONFIG_HOME=/tmp/xdgtest` it prints
  `socket: /tmp/xdgtest/herdr/herdr.sock`

`~/.herdr/` only ever holds the release cache (`~/.herdr/packages/standalone/releases`).

Consequences:
- `GET /api/bridge` answers `{kind:"herdr", live:false}` while the herdr server runs and
  `herdr status` exits 0.
- `dashboard/app/bridge-launch.js` reads `live:false` as "no bridge" and copies the prompt
  to the clipboard without a message, so the user never learns why no pane opened.
- `/setup status` (lib/setup-cli.mjs) reports herdr as not live, for the same reason.

Found while testing PR #8 in a Docker sandbox with `bridge=herdr`. Symlinking
`~/.herdr/herdr.sock` to `~/.config/herdr/herdr.sock` flipped `live` to true, and a
dashboard launch then opened a Claude pane in herdr. The socket path is the only blocker.

## What
On POSIX, resolve the socket as `${XDG_CONFIG_HOME || <home>/.config}/herdr/herdr.sock`.
Leave win32 alone (`<appData>/herdr/herdr.sock`, `appData` still derived purely from
`homedir`, `env.APPDATA` still ignored).

Decided at capture (alternative rejected): keep the socket pre-check rather than relying
on `herdr status` alone. The pre-check avoids spawning a process every TTL window while
herdr is down, and keeps the existing cache/injection shape and the "no exec when the
socket is absent" test.

Hermeticity (the infrastructure README invariant: a faked `homedir` must yield an entirely
faked path, never the builder's real herdr):
- `socketPath` and `checkHerdrLiveness` accept `deps.env`. `XDG_CONFIG_HOME` is read only
  from that injected `env`, never from a bare `process.env` in the path logic.
- Default: `env = deps.env ?? (deps.homedir === undefined ? process.env : {})`. A caller
  that fakes `homedir` without passing `env` gets no XDG override, so a real
  `XDG_CONFIG_HOME` on the test machine can never leak into a faked socket path.
- A blank or whitespace-only `XDG_CONFIG_HOME` counts as unset.
- Thread `env` through both production callers: `dashboard/read-api.mjs` `handleBridge`
  (currently passes only `homedir`) and `lib/setup-cli.mjs` `status` (already has
  `deps.env` for `resolveHerdrBinary`; forward it to `checkHerdrLiveness` too).
- Replace the misleading `socketPath` doc comment with what was verified on each platform.
- Update the infrastructure README's "Bridge selection & Herdr resolver" entry where it
  describes the socket location (one sentence; the README delta goes in the worker's
  RESULT).

Should land as its own small PR against heimeshoff/Agentheim, independent of PR #8.

## Acceptance criteria
- [ ] `socketPath({platform:'darwin', homedir, env:{}})` and the same call with `'linux'`
      return `<home>/.config/herdr/herdr.sock` (test in lib/test/resolve-herdr.test.mjs).
- [ ] `socketPath` with `env:{XDG_CONFIG_HOME:'/x'}` on linux/darwin returns
      `/x/herdr/herdr.sock`.
- [ ] `socketPath` with `env:{XDG_CONFIG_HOME:''}` and with `'   '` returns
      `<home>/.config/herdr/herdr.sock`.
- [ ] `socketPath` with a faked `homedir` and no `env` ignores the real
      `process.env.XDG_CONFIG_HOME` (test sets it temporarily and restores it).
- [ ] win32 is unchanged: the existing win32 and `env.APPDATA`-ignored tests still pass,
      and `env.XDG_CONFIG_HOME` has no effect on win32.
- [ ] The old test asserting `<home>/.herdr/herdr.sock` on POSIX is replaced, not kept.
- [ ] `checkHerdrLiveness` returns true when the injected `existsSync` reports the socket
      only at the XDG location and the injected `exec` succeeds, and false when it reports
      it only at the old `<home>/.herdr/herdr.sock`.
- [ ] `handleBridge` and `/setup status` forward `env` to `checkHerdrLiveness` (covered by a
      test in each caller's existing suite, asserting the XDG location is consulted).
- [ ] Full `node --test` suite passes.
- [ ] On macOS with a running herdr server and `bridge=herdr`, `GET /api/bridge` reports
      `live:true` and a dashboard launch opens a Claude pane in herdr. [human-eye]

## Notes
- Code: lib/resolve-herdr.mjs:201-221 (`defaultAppData`, `socketPath`), :257-284
  (`checkHerdrLiveness`); callers dashboard/read-api.mjs:148, lib/setup-cli.mjs:564.
- The silent clipboard fallback in `dashboard/app/bridge-launch.js` when `live:false` is a
  separate UX gap (the user gets no hint why no pane opened). Out of scope here; capture
  separately if wanted.
