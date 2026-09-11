---
id: infrastructure-018
title: Dashboard binds a deterministic project-root port so the origin survives relaunch
status: done
type: decision
context: infrastructure
created: 2026-06-15
completed: 2026-06-15
commit: 398dee2
depends_on: []
blocks: [infrastructure-019]
tags: [dashboard, transport, port, localstorage, persistence, origin]
related_adrs: [0002, 0018]
related_research: []
prior_art: []
---

## Why
The dashboard binds an ephemeral port (`server.listen(0, '127.0.0.1', ...)` in `dashboard/serve.mjs`),
so every relaunch onto a fresh OS-assigned port produces a new `127.0.0.1:<port>` browser origin.
All three dashboard `localStorage` stores are keyed by origin — the skip-permissions armed toggle
(`skip-permissions-state.js`, aw-021), the theme (`theme-state.js`, aw-017), and the board
view-state (`board-view-state.js`, ADR-0015) — so each is **orphaned on every relaunch onto a new
port**. The store layer already persists correctly; the defect is purely the unstable origin. The
user reported it via skip-permissions ("it should be active again next launch"); theme and board
view-state lose state silently for the identical reason.

ADR-0002 deliberately chose ephemeral `:0` and recorded "no reason to want a stable origin." That
premise predates all three origin-keyed stores and no longer holds. This task amends that one
clause; everything else in ADR-0002 stands.

## What
Bind a **deterministic port derived from the absolute project root path**, so the same project lands
on the same origin every relaunch and different Agentheim projects on one machine derive different
ports.

- **Derivation (the contract):** a pure function of the resolved absolute root. Hash the root and
  fold it into the window **41000–42023** (a 1024-wide band): `port = 41000 + (hash(root) mod 1024)`.
  The band is non-privileged, clear of the OS ephemeral range (49152+), clear of ADR-0018's bridge
  band (31425–31427), and clear of common dev ports (3000 / 5173 / 8080).
- **Bounded ladder on `EADDRINUSE`:** walk a **fixed ladder of 8** within the same window —
  `port = 41000 + ((hash(root) mod 1024) + step) mod 1024` for `step = 0..7` — binding the first
  free port. Wrapping modulo the window keeps every ladder port in-band. Mirrors ADR-0018's
  `31425 → 31426 → 31427` collision idiom (longer ladder for the wider derivation surface).
- The bound port is written to `runtime.json` exactly as today; "open the URL" / stop / reuse paths
  are unaffected.
- **Out of scope (deferred to infrastructure-019):** last-good-port retry / self-heal after a
  one-time collision-driven move, and the `inspectExisting` change to preserve the last-good port.
  See Notes — deterministic derivation + the bounded ladder is the full load-bearing contract here;
  self-heal is a pure optimization for a rare case and carries plumbing this task does not.
- Paste the drafted addendum (in Notes) into `knowledge/decisions/0002-dashboard-runtime-transport.md`
  (reversing only the ephemeral-port clause).

## Acceptance criteria
- [ ] The same project root binds the **same port** across stop + relaunch (deterministic).
- [ ] Two different project roots derive **different** ports (no cross-project origin collision).
- [ ] A persisted `localStorage` value (skip-permissions armed) **survives a full stop+relaunch**
      cycle — same origin, value intact. (Verifiable end-to-end; unit-verifiable at the derivation
      and bind level.)
- [ ] When the derived port is free, the ladder is **not** consulted (the common case binds the
      deterministic port directly).
- [ ] On `EADDRINUSE` the bind walks the bounded ladder of 8 (wrapping within 41000–42023) and binds
      the first free port; the bound port is written to `runtime.json`.
- [ ] A genuine third-party collision across the whole ladder is handled — no crash, no orphaned
      process (a clear error is acceptable; the one-time origin change / self-heal belongs to
      infrastructure-019).
- [ ] The port-derivation + ladder logic is **pure** and unit-tested (stdlib-only, no DOM, under
      `node --test`): same root → same port; different roots → different ports; ladder wraps in-band.
- [ ] ADR-0002 carries the dated addendum reversing only the ephemeral-port clause.

## Notes
- Type is `decision`: it amends a deliberate ADR clause with real trade-offs (origin stability vs
  the collision-free property `:0` gave). It is *not* a plain `bug` — the ephemeral bind was a
  recorded, reasoned choice, not a mistake; the premise simply expired. The fix carries an ADR
  amendment, which `bug`/`feature` tasks here do not.
- **Where the derivation lives.** The bind happens in the **child** (`serve.mjs`), not the launcher
  (`launch.mjs` spawns serve.mjs detached). Put the pure derivation in its own module (e.g.
  `dashboard/port.mjs`) so it is unit-testable without a server, and have `serve.mjs` replace
  `server.listen(0, ...)` with the derived port + ladder. The launcher's reuse-or-replace path
  (`inspectExisting`) is untouched by this task.
- **Why last-good retry is deferred (infrastructure-019).** Self-heal only matters in the rare case
  where a real third-party collision forced a one-time move — in the common case last-good == derived,
  so it adds nothing. It also carries non-trivial plumbing: `inspectExisting` (`runfile.mjs`) currently
  *deletes* the stale runfile **before** the child spawns, and the bind happens in the child, so
  retrying the last-good port requires preserving it across the reap and handing it into `serve.mjs`.
  That plumbing is the follow-up's job; this task ships the deterministic contract clean.
- Asymmetry with ADR-0018, on purpose: the bridge needs a *fixed literal* start because its reader
  is a filesystem-blind sandboxed frame; the dashboard launcher *reads the runfile*, so it can later
  add a *root-derived* port plus last-good retry — a discovery option the bridge lacks. Both share the
  bounded-ladder collision idiom.
- Keep `127.0.0.1`-only — never widen the bind.
- The rejected alternative (server-side persistence of the toggle in `.agentheim/.dashboard/`)
  fixes only skip-perms unless generalized to all three stores, and needs a new write endpoint +
  client wiring for what a stable origin gives for free. It does NOT violate ADR-0017 (that posture
  is about task state, not runtime view-state), but it loses on coverage and cost.

### ADR-0002 addendum — paste verbatim at the end of `0002-dashboard-runtime-transport.md`

## Addendum — deterministic port for a stable origin (2026-06-15, infrastructure-018)

> Reverses **one clause** of the "Launch mechanism" decision above: the preference for an
> **ephemeral `:0`** port and its restatement under "Alternatives considered" (the "Fixed
> default port with EADDRINUSE fallback" bullet). The dashboard now binds a **deterministic,
> project-root-derived port** so the browser origin is stable across relaunches. Every other
> clause — `127.0.0.1`-only binding, detached launch + runfile + explicit stop, walk-up
> discovery, in-root path validation, the `applyTaskMove` write seam — **still stands**. Not a
> new ADR number; it is part of this transport decision.

### Context

When ADR-0002 chose ephemeral `:0`, the rationale was "simpler and collision-free, and no
reason to want a stable origin." That premise has since been **invalidated** by three
origin-keyed persistence features that did not exist in 2026-06-05:

- the dashboard **theme** (`theme-state.js`, agentic-workflow-017),
- the **board view-state** (`board-view-state.js`, ADR-0015), and
- the persisted **skip-permissions armed toggle** (`skip-permissions-state.js`,
  agentic-workflow-021).

All three persist to browser `localStorage`, which is **keyed by origin**. The launcher binds
`server.listen(0, ...)` (`serve.mjs`), so every relaunch onto a fresh OS-assigned port produces
a *new* `127.0.0.1:<port>` origin and **orphans all three stores**. The user noticed it through
skip-permissions because that store has real consequence; theme and board view-state were losing
state silently for the same reason. There is now a **strong reason to want a stable origin** —
the exact reason ADR-0002 recorded as absent.

The reuse path already preserves the origin when a server is *live*: `launchDashboard` →
`inspectExisting` returns `action:'reused'` at the same port (`launch.mjs`). The orphaning
happens **only** when the previous server is dead and a fresh `:0` bind lands somewhere new.

### Decision

Bind a **deterministic port derived from the absolute project root path**: hash the resolved
root and fold it into the non-privileged window **41000–42023** (`port = 41000 + (hash(root) mod
1024)`), so the *same project* binds the *same port* (hence the same origin) on every relaunch,
and *different Agentheim projects* on one machine derive *different* ports (no cross-project
collision — which a single fixed literal could not guarantee). The window is clear of the
privileged range, the OS ephemeral range (49152+), ADR-0018's bridge band (31425–31427), and
common dev ports. The derivation is a pure function of the root; it is the contract.

On `EADDRINUSE`, fall back along a **bounded ladder of 8** that wraps within the same window
(`port = 41000 + ((hash(root) mod 1024) + step) mod 1024`, `step = 0..7`), binding the first free
port — **mirroring ADR-0018's `31425 → 31426 → 31427` shape** (longer ladder for the wider
derivation surface) so the two local transports share one collision idiom. The bound port is
always written to `runtime.json`, exactly as the ephemeral port was, so "open the URL" and
"stop it" are unaffected.

A **genuine third-party collision** (the derived port and its whole ladder held by unrelated
processes) is the same bounded-collision trade-off ADR-0018 already accepts; it is rare. Making
that case *self-heal* — retrying the launcher-visible **last-good port** from `runtime.json`
before deriving (a discovery option the sandboxed-frame bridge lacks) — is a deliberate
follow-up (**infrastructure-019**), not part of this clause; the launcher's reuse path and
`inspectExisting` are unchanged here.

### Consequences

- The three origin-keyed stores (theme, board view-state, skip-permissions) survive stop+relaunch
  with **no new endpoint and no client change** — the fix is purely in the bind.
- The dashboard and the bridge (ADR-0018) now share one fixed-port-with-bounded-ladder idiom.
- ADR-0002's original "collision-free" virtue of `:0` is traded for origin stability — the right
  trade now that origin-keyed state exists. Real collisions become a rare edge (handled cleanly
  by the ladder; self-heal across launches is the infrastructure-019 follow-up) rather than an
  impossibility.

## Outcome

The dashboard now binds a **deterministic, project-root-derived port** instead of an ephemeral
`:0`, so the `127.0.0.1:<port>` browser origin is stable across stop+relaunch and the three
origin-keyed `localStorage` stores (theme, board view-state, skip-permissions) survive a relaunch.

- **`dashboard/port.mjs`** (new, pure, stdlib-only): `derivePort(root)` hashes the resolved
  absolute root (sha256, for cross-version stability) and folds it into window **41000–42023**;
  `portLadder(root)` yields the bounded ladder of 8 that wraps within the window; `listenOnLadder`
  walks the ladder on `EADDRINUSE`, binds the first free rung, tries the derived port first (no
  ladder when free), and rejects with a clear `EADDRINUSE_LADDER_EXHAUSTED` error when the whole
  ladder is busy — no crash, no orphaned process. Non-`EADDRINUSE` errors are fatal immediately.
- **`dashboard/serve.mjs`**: replaced `server.listen(0, '127.0.0.1', ...)` with
  `listenOnLadder(root, tryListen)`; the bound port is written to `runtime.json` exactly as before;
  ladder exhaustion / fatal bind error logs to stderr and `process.exit(1)`.
- **`dashboard/test/port.test.mjs`** (new, 14 tests under `node --test`): determinism, absolute-root
  resolution, in-band derivation, different roots → different ports, persisted-origin survival,
  ladder shape + wrap, derived-port-first, EADDRINUSE walk, full-collision clean error, fatal-error
  passthrough. End-to-end smoke (spawned `serve.mjs` against a temp root) confirmed it binds the
  derived port and writes it to `runtime.json`.
- **ADR-0002** carries the dated 2026-06-15 addendum reversing only the ephemeral-port clause.
- Launcher (`launch.mjs`) and `inspectExisting` (`runfile.mjs`) untouched; last-good-port self-heal
  remains deferred to infrastructure-019.
- BC README updated: ADR-0002 summary, ADR-0018 asymmetry note.

Full dashboard suite: 345 tests passing.
