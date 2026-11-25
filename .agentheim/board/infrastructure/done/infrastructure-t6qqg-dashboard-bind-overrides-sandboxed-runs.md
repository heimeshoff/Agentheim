---
id: infrastructure-t6qqg
title: The dashboard should be reachable from the host when Claude Code runs inside a container or VM sandbox; opt-in bind host and fixed port via environment variables
status: done
type: feature
context: infrastructure
created: 2026-11-25
completed: 2026-11-25
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

## Verifier note (iteration 1)

**REASONS:**
- Check 1 (acceptance criteria coverage): "In `serve.mjs`, an invalid value makes the process exit 1 with that message on stderr before anything binds and before a runfile is written" has no executable test. The diff covers it only with the Outcome's "Manually confirmed invalid port exits 1". This is a `type: feature` task, so a manual note does not count, and process-level tests are routine in this suite: dashboard/test/launch.test.mjs already spawns serve.mjs (`serveEntry`, `launchDashboard`, `readRunfile`). The criterion's two halves, no runfile written and exit code 1 with the message on stderr, are both unasserted.
- Check 1: the second half of "Fixed port set: ... the last-good marker is neither read nor written" has no test. dashboard/test/port.test.mjs `listenOnLadder: fixed port tries exactly that port` covers the `[port]` bind sequence. The marker skip lives only in dashboard/serve.mjs (`lastGood = fixedPort === null ? readLastPort(root) : undefined` and `if (fixedPort === null) writeLastPort(root, port)`), and no test checks that the marker stays absent or unchanged after a fixed-port launch.
- Check 1: "The server binds the interface from `AGENTHEIM_DASHBOARD_HOST`" has no test. The only change is `server.listen(port, bindHost)` in dashboard/serve.mjs, and nothing would fail if that line went back to `'127.0.0.1'`.
- Check 1 (weaker gap): for "A wildcard bind prints a `http://127.0.0.1:<port>/` URL", the `displayHost: wildcard binds show 127.0.0.1, others themselves` test covers the mapping. Nothing checks that serve.mjs actually prints the result of `displayHost(bindHost)`.
- For reference only, since checks stop at the first failure: dashboard/test/port.test.mjs and dashboard/test/runfile.test.mjs pass (49/49), and the 7 new port.mjs unit tests look sound.

**SUGGESTED_FIX:** Add spawn-level node --test cases, using the pattern in dashboard/test/launch.test.mjs, that run serve.mjs against a temp root. With an invalid AGENTHEIM_DASHBOARD_PORT, assert exit code 1, the message on stderr and no runfile. With a fixed port, assert it binds exactly that port and the last-good marker is neither created nor changed. With AGENTHEIM_DASHBOARD_HOST=0.0.0.0, assert the server is reachable and the stdout URL shows 127.0.0.1.

**ITERATION_HINT:** likely-fixable

## Verifier note (iteration 2)

**REASONS:**
- Check 5 (BC README sync): the parsed `readmeDelta` is `[]`, yet the diff changes two things the infrastructure BC README states as fact. (a) The protected invariant under "Runtime/transport" (README.md around line 179) says the runtime is "bound to **`127.0.0.1` only**, never `0.0.0.0`". dashboard/serve.mjs now runs `server.listen(port, bindHost)`, with `bindHost` taken from `AGENTHEIM_DASHBOARD_HOST`, so `0.0.0.0` is a supported opt-in. (b) The "Last-good-port marker" ubiquitous-language entry (around lines 73-79) gives the bind order as always "last-good → derived → ladder". With `AGENTHEIM_DASHBOARD_PORT` set, the diff skips that order and does not read or write the marker. Once this integrates, the README contradicts the code. The new operator-facing terms (`AGENTHEIM_DASHBOARD_HOST` / `AGENTHEIM_DASHBOARD_PORT`, fixed port with no fallback) appear only in dashboard/README.md, not in the BC README.
- Not reached as the first failure, but the next worker will hit it under check 6b. ADR-0002 (related_adrs: [0002]) says in its Decision at .agentheim/knowledge/decisions/0002-dashboard-runtime-transport.md line 89: "bind `127.0.0.1` only — **never** `0.0.0.0`". Line 39 adds: "Single-user, localhost-only. No ... network exposure". The diff deliberately relaxes that clause. The Outcome says "ADR-0002: no amendment needed" and ADRS_WRITTEN is none. Per check 6b, a diff that intentionally supersedes an ADR's decision needs an ADR (or ADR-0002 addendum, matching the existing 2026-06-15 addenda pattern) recording the opt-in non-loopback bind and the fixed-port bypass of last-good → derived → ladder.
- For reference, checks 1 to 4 passed. Every iteration-1 verifier reason is now addressed by dashboard/test/serve-bind-overrides.test.mjs (mutation-checked). Full `cd dashboard && node --test`: 1117 tests, 1113 passing, 4 failing, all known pre-existing (resolveInRoot, dist staleness, events.test.mjs, resolvePluginRoot). New spawn tests passed 3 times in a row. Scope clean.

**SUGGESTED_FIX:** Report a README_DELTA that amends the BC README's "Runtime/transport" invariant (loopback by default, non-loopback only via the opt-in `AGENTHEIM_DASHBOARD_HOST`, no auth) and the "Last-good-port marker" entry (`AGENTHEIM_DASHBOARD_PORT` replaces the order and the marker is neither read nor written). Also report an ADR-0002 addendum, or a new ADR that supersedes the "never 0.0.0.0" clause, recording the builder's opt-in decision.

**ITERATION_HINT:** likely-fixable

## Outcome

Added pure `readBindOverrides(env)` and `displayHost(host)` to `dashboard/port.mjs` (plus `HOST_ENV`, `PORT_ENV`, `DEFAULT_HOST`). `listenOnLadder` takes an optional 4th `fixedPort` argument: exactly one attempt, and a busy port rejects with an error naming the port and `AGENTHEIM_DASHBOARD_PORT` (no fallback). `dashboard/serve.mjs` validates the env before anything binds (invalid value: stderr message, exit 1, no runfile), binds `AGENTHEIM_DASHBOARD_HOST`, skips both reading and writing the last-good marker when a fixed port is set, and prints `127.0.0.1` for wildcard binds. `launch.mjs` already forwards `...process.env` to the server child (confirmed, unchanged). Documented in `dashboard/README.md` ("Bind overrides for sandboxed runs"), including the no-auth warning.

Tests: 7 unit tests in `dashboard/test/port.test.mjs`; 4 spawn-level tests in `dashboard/test/serve-bind-overrides.test.mjs` (invalid port: exit 1, stderr names variable, no runfile; fixed port: binds exactly it, marker not created and an existing marker byte-identical; busy fixed port: exit 1 naming port and variable; HOST=0.0.0.0: stdout URL shows 127.0.0.1 and the server holds the wildcard bind, mutation-checked). Tests use dynamic free ports, kill the child and remove the temp root.

ADR-0002: an addendum (dated 2026-11-25), not a new ADR and not "no amendment needed". It relaxes the "never `0.0.0.0`" clause and the "localhost-only, no network exposure" premise to "loopback by default, non-loopback only by explicit operator opt-in", and records that a fixed port bypasses the last-good, derived, ladder order. The addendum text is reported in the `ADR_0002_AMENDMENT` block for the conductor to append to ADR-0002; the `ADRS` block is empty (no new ADR file). The BC README delta amends the Runtime/transport invariant and the Last-good-port marker entry and adds a Bind overrides entry.

Pre-existing macOS failures (unrelated): resolveInRoot absolute path, committed dist/ staleness, resolvePluginRoot, watcher close().

The [human-eye] criterion (Docker sandbox host-browser check) remains for the builder.
