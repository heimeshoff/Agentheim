---
id: infrastructure-019
title: Dashboard origin sticks to its last-good port so an intermittent collision can't flap it
status: done
type: feature
context: infrastructure
created: 2026-06-15
completed: 2026-06-15
commit: a47d31a
depends_on: [infrastructure-018]
blocks: []
tags: [dashboard, transport, port, runfile, persistence, origin]
related_adrs: [0002, 0018]
related_research: []
prior_art: [infrastructure-018]
---

## Why
infrastructure-018 makes the dashboard bind a deterministic root-derived port (window 41000–42023,
bounded ladder of 8) and **always tries the derived port first**. That means when a collision *clears*,
the origin already snaps back to the derived port — the cleared-collision case is handled. The case it
leaves open is **flapping**: when a third-party process holds the derived port **intermittently**, the
origin bounces between the derived port and a ladder rung launch-to-launch (derived free → 41500; derived
taken → 41501; free again → 41500 …). Each bounce is a different `127.0.0.1:<port>` origin and therefore
a different (often empty) set of the origin-keyed `localStorage` stores (theme aw-017, board view-state
ADR-0015, skip-permissions aw-021), so the builder's settings appear to reset intermittently.

The fix is to make the origin **sticky**: once the dashboard successfully binds a port, prefer **that**
port on every subsequent launch (last-good → derived → ladder). The derived port becomes only the
first-ever seed. This trades one property for a better one — the pre-collision store is orphaned
permanently once the origin moves (accepted) — in exchange for an origin that never flaps.

## What
Make the dashboard **remember the last successfully-bound port** and try it first, so the origin is
stable across relaunches regardless of transient collisions.

- **Persist the last-good port in a separate marker** `.agentheim/.dashboard/last-port.json` = `{ port }`
  — a sibling of `runtime.json` in the same gitignored dir. Keeping it separate preserves
  `runtime.json`'s contract ("present ⇒ a live runtime, gated by pid"); the marker is a pure memory that
  outlives the server. (Mirrors how `bridge.json` sits beside `runtime.json`, ADR-0018.)
- **Write the marker at successful-bind time** in the child (`serve.mjs`), right where it writes
  `runtime.json`. Writing it at bind time (not coupled to the stale-reap) means it survives **both** a
  crash and a clean `stop`, and keeps `inspectExisting` / `stopDashboard` **unchanged** — they never need
  to know about the port.
- **The child reads the marker before binding** (it already knows the root) and forms the bind order
  **last-good → derived → ladder**. No env/arg plumbing from the launcher; `serve.mjs` stays the sole
  owner of the bind, exactly as infra-018 left it.
- **Pure ordering logic in `port.mjs`** so it stays stdlib-only unit-testable: a function that, given the
  root and an optional last-good port, yields the de-duplicated, in-window bind sequence (`listenOnLadder`
  either consumes it or is extended to accept an optional preferred port). Ignore a last-good port that is
  outside the 41000–42023 window (defensive — a corrupt/foreign marker falls back to derivation).
- Keep the deterministic derivation from infra-018 as the fallback when there is no marker (first launch)
  or it is unusable.

## Acceptance criteria
- [ ] After a collision-driven move to a ladder rung, every subsequent relaunch reuses the **last-good
      port** — whether the collision is still present or has cleared — instead of flapping back to the
      derived port.
- [ ] The last-good port is recorded in `.agentheim/.dashboard/last-port.json` at successful bind, and
      survives both a crash (no clean stop) and a clean `/dashboard stop` + relaunch.
- [ ] First launch (no marker) binds the deterministic derived port from infra-018; the last-good step is
      skipped cleanly.
- [ ] `runtime.json`'s meaning is unchanged: `inspectExisting` / `stopDashboard` still treat it as
      live-runtime state gated by pid; the new marker is independent and read only by the child's bind path.
- [ ] An out-of-window or unreadable/malformed `last-port.json` is ignored and the bind falls back to
      derived → ladder (never a crash, never an out-of-band bind).
- [ ] Bind-order logic is unit-tested (stdlib-only, `node --test`): last-good preferred when present and
      free; derived used when the marker is absent; derived used when last-good is taken but derived free;
      ladder reached when both are taken; last-good == derived produces no duplicate attempt; out-of-window
      last-good ignored.

## Notes
- Split out of infrastructure-018 during refinement (2026-06-15); refined + promoted 2026-06-15. The
  original framing ("self-heal back … or at least stick to last-good") conflated two **opposite**
  behaviors: snap-back-to-derived (which infra-018 **already ships** — `listenOnLadder` tries the derived
  port first) and last-good-sticky (this task). The user chose last-good-sticky for origin stability;
  snap-back is explicitly **not** the goal.
- The original draft put the last-good port inside `runtime.json` and made `inspectExisting` preserve it
  on stale-reap. Superseded during refinement: a **separate marker written at bind time** is simpler and
  also covers the clean-stop path (reap-time preservation would have needed writes in both
  `inspectExisting` and `stopDashboard`). `inspectExisting` therefore needs **no change**.
- This changes the observable port-selection contract from infra-018's "derived-first, always" to
  "last-good-first". The worker should add a short dated addendum to **ADR-0002** and update the infra
  README's Runfile entry to mention `last-port.json`.
- Accepted tradeoff: once the origin moves off the derived port, the pre-collision `localStorage` store is
  orphaned permanently. Cross-origin store migration was considered and rejected as out of scope.
- Keep `127.0.0.1`-only; do not touch the live-server reuse path (`launchDashboard` → `action:'reused'`),
  which already preserves the origin when a server is alive. The gap is purely the dead-server relaunch /
  intermittent-collision case.

## Outcome
The dashboard origin is now **sticky**: it prefers the port it last successfully bound, so an
intermittent third-party collision can no longer flap the `127.0.0.1:<port>` origin (and orphan the
origin-keyed localStorage stores) launch-to-launch. Bind order is **last-good → derived → ladder**.

Implementation:
- `dashboard/port.mjs` — added pure `bindSequence(root, lastGood)` (de-duplicated, in-window
  last-good prepended to the derived ladder; out-of-window/non-integer/already-on-ladder last-good
  dropped). Extended `listenOnLadder(root, tryListen, lastGood)` to walk that sequence; error
  message now references the bind sequence. Stays stdlib-only and unit-testable.
- `dashboard/runfile.mjs` — added the separate `last-port.json` marker:
  `lastPortPath` / `writeLastPort` / `readLastPort` (returns null on absent / malformed / non-integer
  port). Kept `runtime.json`'s pid-gated "live runtime" contract untouched — `inspectExisting` /
  `stopDashboard` are unchanged and never learn the port.
- `dashboard/serve.mjs` — reads the marker before binding, passes it to `listenOnLadder`, and writes
  the marker at successful-bind time (right beside `runtime.json`), so it survives both a crash and a
  clean stop. `serve.mjs` stays the sole bind owner; no env/arg plumbing from the launcher.

Tests (stdlib `node --test`, all green; full dashboard suite 370 pass / 0 fail):
- `dashboard/test/port.test.mjs` — bind-order unit tests: last-good preferred when free; derived when
  absent; derived when last-good taken but derived free; ladder reached when both taken;
  last-good == derived / on-a-rung no duplicate; out-of-window/garbage ignored.
- `dashboard/test/runfile.test.mjs` — marker round-trip; null on absent/malformed/non-integer;
  marker survives reaping of the runfile (independence).

Decisions: amended **ADR-0002** with a dated `## Addendum — sticky last-good port (2026-06-15,
infrastructure-019)` recording the change from "derived-first, always" to "last-good-first" and the
separate-marker design; added infrastructure-019 to ADR-0002's `related_tasks`. Updated the
infrastructure README (Runfile entry + new Last-good-port marker entry + ADR-0002 selection-order
line). No new ADR. Accepted tradeoff: once the origin moves off the derived port, the pre-collision
localStorage store is orphaned permanently (cross-origin migration out of scope).
