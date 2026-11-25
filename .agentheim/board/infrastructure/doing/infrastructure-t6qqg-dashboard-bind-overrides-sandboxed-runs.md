---
id: infrastructure-t6qqg
title: The dashboard should be reachable from the host when Claude Code runs inside a container or VM sandbox; opt-in bind host and fixed port via environment variables
status: doing
type: feature
context: infrastructure
created: 2026-11-25
completed:
depends_on: []
blocks: []
tags: [dashboard, port, bind, sandbox, docker]
related_adrs: [0002]
related_research: []
prior_art: [infrastructure-018, infrastructure-019]
---

## Why

Builder request (2026-11-25): running Claude Code inside a container or VM sandbox (Docker
Sandboxes) makes the dashboard unreachable from the host browser. The sandbox publishes a port to
the host only for services listening on a non-loopback interface, and the host-side port mapping
has to be declared before the dashboard starts. Today the dashboard binds `127.0.0.1` on a port
derived from the absolute project root, with the bind order last-good → derived → ladder
(infrastructure-018, infrastructure-019). Neither the interface nor the port fits a sandbox: the
interface is loopback, and the port differs per machine and can move.

Verified by the builder in a Docker sandbox: a server on `127.0.0.1` behind a published port is
not reachable from the host; the same server on `0.0.0.0` is.

## What

Two opt-in environment variables, read in `dashboard/serve.mjs` through a new **pure**
`readBindOverrides(env)` in `dashboard/port.mjs`:

- `AGENTHEIM_DASHBOARD_HOST`: the interface to bind, e.g. `0.0.0.0`. Default `127.0.0.1`.
- `AGENTHEIM_DASHBOARD_PORT`: exactly one fixed port. It replaces the derived port, the ladder
  and the last-good marker. It is **not** written as the last-good port, so removing the variable
  restores the derived origin. A busy or invalid value is an error, never a silent fallback to
  another port.

Blank values count as unset. With neither variable set, behavior is byte-for-byte unchanged.

For a wildcard bind (`0.0.0.0` or `::`), the printed "Dashboard listening at" URL shows
`127.0.0.1`, which is also the address the sandbox publishes on the host.

`dashboard/launch.mjs` already passes its environment to the server child, so `/dashboard` and
`agentheim-dashboard` pick the variables up from the sandbox environment; no change needed there
(confirm, don't assume).

Document both variables in `dashboard/README.md`, including a warning that the dashboard has no
authentication, so a non-loopback interface belongs only inside a private network such as a
sandbox.

## Acceptance criteria

- [ ] `readBindOverrides(env)` is exported from `dashboard/port.mjs`, pure (takes `env`, never
      reads `process.env` itself), and returns `{ host, port }` with `host` defaulting to
      `127.0.0.1` and `port === null` when no fixed port is set.
- [ ] Blank or whitespace-only values for either variable count as unset.
- [ ] `AGENTHEIM_DASHBOARD_PORT` that is non-numeric, not an integer, or outside 1..65535 throws
      with a message naming the variable and the offending value.
- [ ] In `serve.mjs`, an invalid value makes the process exit 1 with that message on stderr
      **before** anything binds and before a runfile is written.
- [ ] Fixed port set: the bind sequence is exactly `[port]`; the last-good marker is neither read
      nor written.
- [ ] Fixed port busy: the bind fails with an error naming the port and
      `AGENTHEIM_DASHBOARD_PORT`; no other port is tried.
- [ ] Neither variable set: bind host `127.0.0.1`, bind order last-good → derived → ladder, and
      the last-good marker is written, exactly as before (existing `port`/`runfile` tests stay
      green).
- [ ] The server binds the interface from `AGENTHEIM_DASHBOARD_HOST`.
- [ ] A wildcard bind (`0.0.0.0`, `::`) prints a `http://127.0.0.1:<port>/` URL; any other host
      prints itself.
- [ ] `dashboard/README.md` documents both variables, their defaults, the no-fallback rule for
      the fixed port, and the no-auth warning.
- [ ] New `node --test` cases in `dashboard/test/port.test.mjs` cover the criteria above that
      `port.mjs` owns (defaults, blank values, invalid ports, fixed port with and without
      collision, display host).
- [ ] From a Docker sandbox with a published port and `AGENTHEIM_DASHBOARD_HOST=0.0.0.0`,
      `AGENTHEIM_DASHBOARD_PORT=<published>`, the dashboard opens in the host browser.
      [human-eye]

## Notes

- **Builder decisions (2026-11-25, during capture):** environment variables only, no CLI flags
  or config file; one fixed port rather than a fixed ladder; fail loudly on a busy fixed port;
  no auth or allowlist added. The opt-in plus the README warning is the only guard against
  exposing the board's write transport on a network.
- Security: ADR-0002 assumes a loopback-only transport. This task keeps loopback as the default
  and makes a non-loopback bind an explicit operator choice. If the worker judges that this
  needs an ADR-0002 amendment rather than a README delta, report it in the RESULT block.
- Server-only change; no frontend, no `dashboard/dist/` rebuild.
- Known pre-existing dashboard suite failures on macOS (unrelated, brief the verifier):
  `resolveInRoot` absolute path, committed `dist/` staleness, `resolvePluginRoot`, watcher
  `close()`, and an intermittent `events.test.mjs`.
