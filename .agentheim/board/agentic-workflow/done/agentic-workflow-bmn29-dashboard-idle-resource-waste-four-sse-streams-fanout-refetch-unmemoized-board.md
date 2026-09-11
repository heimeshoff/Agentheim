---
id: agentic-workflow-bmn29
title: Hidden dashboard tab pauses live re-sync and catches up once on return — closes the idle-waste umbrella (hub, memoization, keyframes shipped) with the before/after MacBook measurement
status: done
type: bug
context: agentic-workflow
created: 2026-09-05
completed:
depends_on: [agentic-workflow-mvt8x, agentic-workflow-rw6ck, design-system-pk4qd]
blocks: []
tags: [dashboard, performance, sse, live-update, board, motion, visibility]
related_adrs: [0006, 0014, 0027, 0033, 0043, 0059, 0061, 0070]
related_research: []
prior_art: [agentic-workflow-009, agentic-workflow-073, agentic-workflow-m9w5c, agentic-workflow-n4h7q, agentic-workflow-h9v3m, agentic-workflow-mvt8x, agentic-workflow-rw6ck]
---

## Why
The builder reported the dashboard burning resources on a MacBook, assumed to be "polling".
The 2026-09-05 diagnosis found no timer anywhere — the waste was emergent: four `EventSource`
streams per tab, every frame fanning out into two `/api/tree` walks plus two `/api/doc`
fetches, advisory heartbeat writes (ADR-0043) arriving as structural changes, ~255 unmemoized
cards re-rendering on every fetch and every hover, and two infinite `box-shadow` keyframes
painting every frame. The full ranked finding list (1–6) is preserved in the Notes below as
the shared record.

Findings 1–5 have shipped through the three children this umbrella was split into:

| Child | Carried | Shipped |
|---|---|---|
| `agentic-workflow-mvt8x` | findings 1–3 — one refcounted live-tree hub per tab (`dashboard/app/live-tree-hub.js`), one `/api/tree` fetch, frames routed structural / advisory / runtime (ADR-0070) | 2071902, 2026-09-05 |
| `agentic-workflow-rw6ck` | finding 4 — `React.memo` cards/columns, hover out of the board root, identity-stable projection | fdac98c, 2026-09-05 |
| `design-system-pk4qd` | finding 5 — the two ambient keyframes are opacity-only over a pre-painted glow layer (ADR-0014 amended) | fa9d1e8, 2026-09-05 |

What is left is **finding 6** — a hidden tab still holds its one source, still re-fetches on
every structural frame, still re-projects board and rail, still re-fetches the advisory docs
on every heartbeat — and the aggregate **before/after measurement** that tells the builder
whether the umbrella actually closed the complaint. mvt8x deliberately left visibility out
("a distinct failure mode — a paused tab silently missing a change — that deserves its own
falsifiable criteria; ~10 lines once the hub exists as a single place to gate visibility").
The hub exists now, so this is that task.

## What

### 1. Visibility gate in the hub — pause delivery, coalesce, catch up once

The hub (`createLiveTreeHub`) gains one injectable dependency alongside `sourceFactory` /
`fetchTree`, following the same idiom (framework-free, `node --test`-able with no DOM):

```
createLiveTreeHub({ sourceFactory, fetchTree, reconnectMs, visibility })
// visibility: { isHidden: () => boolean, onChange: (cb) => unsubscribe }
```

- **Default adapter** (production, no options passed): reads
  `globalThis.document?.visibilityState === 'hidden'` and listens to `visibilitychange` on
  `document`. When there is no `document` (node) or it has no `visibilityState`, the adapter
  reports *always visible* and `onChange` is a no-op — every existing hub test keeps passing
  unedited.
- **While hidden, `handleFrame` delivers nothing and records what it would have done**, per
  ADR-0070 category, in a pending set: `hello`/reconnect → `pending.all`; a structural frame →
  `pending.structural` (and `invalidateTree()`, so a subscriber that mounts while hidden never
  receives a stale cache); an advisory frame → `pending.advisory.add(path)`; a runtime frame →
  nothing, exactly as today. **The source stays open** — the tab keeps its one `EventSource`
  and the server keeps its one watcher; closing it would trade a dropped frame for a reconnect
  `hello` storm on return and buy nothing the pending set doesn't already give.
- **On becoming visible, the pending set replays once, then clears**: `pending.all` →
  `notifyAll()`; otherwise `pending.structural` → `notifyStructural()` (one shared `/api/tree`
  fetch regardless of how many structural frames were dropped — the existing dedupe) and each
  pending advisory path → `notifyAdvisory(path)`. **An empty pending set replays nothing** — a
  tab switch with no change behind it costs zero fetches. The audience rule of ADR-0070 §2 holds
  across the pause: five in-flight heartbeats while hidden re-sync `InFlightLane` once on
  return and never touch the board or rail.
- **Subscribe/unsubscribe while hidden** behave as today (mount-time delivery is not a frame).
  `ensureSource()` registers the `visibilitychange` listener with the first subscriber;
  `teardownSource()` removes it and clears the pending set with the last unsubscribe.
- **Mechanized boundary**: `live-tree-source-guard.test.mjs` gains a third pattern —
  `visibilitychange` (and `document.hidden` / `visibilityState`) appear under `dashboard/app/**`
  only in `live-tree-hub.js`. Visibility gating has exactly one home, the same way source
  construction does (ADR-0059 verdict: this half mechanizes cheaply, so it ships as a guard).

### 2. Doctrine deltas (in place, no new ADR)

- **ADR-0070** gains a `### 6. Hidden tab — pause, coalesce, catch up once` section stating the
  rule above and the *why-not* (never close the source on hide; never replay unconditionally),
  plus a status-log line naming this task. The routing-is-not-interpretation distinction (§3)
  is untouched: pausing selects *when* an audience is notified, never *what changed*.
- **BC README** — the *Live-tree hub* bullet gains one sentence on the hidden-tab behaviour,
  with the `visibilitychange`-lives-only-in-the-hub guard named next to the existing source
  guard. No new ubiquitous-language term; "pending set" is an implementation word, not a domain
  one.

### 3. The measurement — close the umbrella against the original complaint

The *before* number was never taken while the pre-hub build was the checked-out code. It is
still obtainable, and the protocol is pinned here so the close-out is comparable:

- **Before build** — either of:
  - the installed plugin cache `~/.claude/plugins/cache/agentheim/agentheim/0.9.2/` — verified
    2026-09-06 to contain none of the hub (`dashboard/app/live-tree-hub.js` absent, no
    `subscribeStructural` in `dist/app.js`), the memoization, or the keyframe change; launched by
    `/dashboard` from any consumer project as long as the plugin has not been upgraded past 0.9.2;
  - or a `git worktree add ../bmn29-before d819612` (the batch-start commit before any child
    landed; `dashboard/dist/app.js` is committed there) and `node ../bmn29-before/dashboard/launch.mjs`
    from this repo's root.
- **After build** — this repo at the commit that merges this task, `node dashboard/launch.mjs`
  from the repo root (`resolve-launcher.mjs` prefers the repo-local launcher over the cache).
- **Same project for both** (this repo: ~255 tasks is the load that made finding 2 expensive),
  same browser, same tab count (one), Simple Browser panes closed.
- **Three conditions × 5 minutes each**, Chrome Task Manager CPU % (or Safari's equivalent) for
  the dashboard tab plus Activity Monitor *Energy Impact* for the browser's renderer process:
  1. foreground, idle (no `work` session);
  2. foreground, a `work` session running (advisory heartbeat writes every turn end);
  3. tab hidden behind another tab, `work` session running — *after* only; the *before* build
     has no pause to measure, but record it anyway if cheap, it is the finding-6 baseline.
- **Record the table in this task's Notes** at close-out. The same numbers satisfy mvt8x's own
  still-unchecked `[human-eye]` measurement criterion — tick it there by hand and point at this
  task; nothing else in mvt8x is open.

## Acceptance criteria
- [ ] `createLiveTreeHub` accepts an injectable `visibility` `{ isHidden, onChange }` beside
      `sourceFactory` / `fetchTree`; with none injected and no `document` present the hub is
      always-visible and every existing test in `dashboard/test/live-update-hub.test.mjs`,
      `live-tree-hub-e2e.test.mjs`, `live-frame-registration.test.mjs`,
      `live-tree-source-guard.test.mjs` passes **unedited**.
- [ ] New `dashboard/test/live-tree-hub-visibility.test.mjs` (no DOM, injected fake
      `visibility`): with two structural and two advisory subscribers, hidden, after three
      structural frames and five `.agentheim/state/in-flight.json` frames → **zero** `fetchTree`
      calls and **zero** subscriber callbacks while hidden; on the visibility change to visible →
      **exactly one** `fetchTree` call, each structural subscriber called **once** with the new
      tree, the in-flight subscriber called **once**, the whats-next subscriber **never**.
- [ ] Same file: hidden, only in-flight advisory frames, then visible → **zero** `fetchTree`
      calls, in-flight subscriber once (ADR-0070's audience rule holds across the pause).
- [ ] Same file: hidden, no frames, then visible → **zero** fetches, **zero** callbacks. Hidden,
      a `hello` frame, then visible → every subscriber once, one `fetchTree`.
- [ ] Same file: across hidden → visible the source is **not** closed and **not** reconstructed
      (`constructions` stays 1, `closed` stays false); after the last unsubscribe the fake's
      `visibilitychange` listener count is **0** and a fresh subscribe re-registers exactly one.
- [ ] `live-tree-hub-e2e.test.mjs` (jsdom, whole app mounted) gains one case using the
      **default** adapter: `document.visibilityState` overridden to `'hidden'` +
      `visibilitychange` dispatched, a structural frame → **zero** `/api/tree` fetches; back to
      `'visible'` + dispatch → **exactly one** `/api/tree` fetch and **zero** `/api/doc` fetches.
      This is the proof the production adapter actually reads `document`.
- [ ] `live-tree-source-guard.test.mjs` asserts `visibilitychange`, `visibilityState` and
      `document.hidden` occur under `dashboard/app/**` only in `live-tree-hub.js` (a component
      that gates itself on visibility fails the suite).
- [ ] ADR-0070 has a `### 6.` hidden-tab section and a status-log line for this task; the BC
      README's *Live-tree hub* bullet states the hidden-tab rule and names the extended guard.
      Prose deltas are carried per ADR-0074 (conductor materializes README/ADR at integration).
- [ ] The whole `dashboard/` `node --test` suite passes; `dashboard/dist/` is rebuilt at
      integration (dist-staleness gate), so the shipped bundle carries the gate.
- [ ] `[human-eye]` Before/after table recorded in this task's Notes per the protocol in
      §3 above — before build (0.9.2 cache or worktree at d819612) vs after build, conditions
      1–3, Chrome Task Manager CPU % + Activity Monitor Energy Impact, 5 min each on the
      builder's MacBook. No in-repo runner can observe the real browser on the builder's
      hardware, and every synthetic proxy is already a machine-checked criterion above or in the
      three children — inventing a "CPU fell N%" number here would be the metric-smuggling
      ADR-0061 forbids. Per ADR-0062 this box stays unchecked through `done/` as the routing
      signal to the builder's own check.

## Notes

### Original diagnosis (2026-09-05, kept as the shared record)
Findings, ranked by likely impact at the time:

1. **Four `EventSource` streams per tab, not one.** `useLiveTree` was called by four
   components — `DashboardBoard`, `ShellRail`, `WhatsNextPanel`, `InFlightLane` — each opening
   its own `/api/events` connection; four server-side recursive `fs.watch` watchers and four
   heartbeat intervals per tab; 4/6 of the HTTP/1.1 connection budget idle; four reconnect loops
   on restart. → mvt8x.
2. **Every tree change fanned out into 2× `/api/tree` + 2× `/api/doc`.** `/api/tree` is a
   synchronous walk (`readFileSync` + two `statSync` per task) over ~255 task files, run twice,
   blocking the event loop both times. → mvt8x.
3. **Tree changes are frequent during a session, so this was polling in effect.** The
   `Stop`/`SubagentStop` hooks (ADR-0043) overwrite `.agentheim/state/in-flight.json` on every
   turn end and subagent completion; each write → one `tree-changed` frame → the full fan-out
   and a whole-board re-render. → mvt8x (advisory routing).
4. **Every state change re-rendered every card.** No `React.memo` in `board.js`; hover lifted
   into board state re-ran `resolveHoverDependencies` and re-subscribed the IntersectionObserver;
   the Done column's ~249 cards always mounted. → rw6ck.
5. **Infinite `box-shadow` keyframes were not compositor-only.** `ambient-rail-pulse` and
   `rail-attention-breathe` animated `box-shadow` with a per-frame `color-mix()` — a paint every
   frame regardless of visibility. → pk4qd.
6. **No `visibilitychange` handling.** A hidden tab keeps its stream, its re-fetch fan-out and
   its animations alive. → **this task** (animations: pk4qd already made them compositor-only;
   the compositor does not run raster for a hidden tab, so nothing remains there).

The infrastructure candidate (one shared `fs.watch` across SSE clients) was considered and
dropped at the 2026-09-05 refinement: with the hub, watchers fell 4→1 per tab as a side effect,
and sharing across tabs serves a many-tabs profile this single-user plugin does not have.

### Design notes for the worker
- Builder's hypothesis was "polling". Verified then and still true: no client timer, no server
  stat-poll on macOS (`RECURSIVE_SUPPORTED` covers darwin). Whatever waste remains after the
  three children is the hidden-tab residue plus whatever the measurement shows.
- **Why a per-category pending set and not one dirty bit.** A single "something happened" bit
  would replay `notifyAll()` on return, re-projecting the board after five heartbeats — the
  exact advisory→structural leak ADR-0070 closed. Tracking `all / structural / advisory paths`
  keeps the audience rule intact through the pause at the cost of a `Set`.
- **Why not replay unconditionally on every return.** The 2026-09-05 wording said "exactly one
  re-sync on becoming visible". Refined to *at most one per category, none if nothing arrived*:
  an unconditional re-sync is a `/api/tree` walk on every tab switch, which is the waste class
  this umbrella exists to remove. The missed-change failure mode is covered by the pending set
  plus `EventSource`'s native reconnect (a connection dropped while hidden re-fires `hello`
  either while hidden → `pending.all`, or after return → normal `notifyAll`).
- **Why not close the source on hide.** The server-side cost of one open stream is one watcher
  and one 25 s heartbeat timer; closing it makes every return a reconnect + full `hello` re-sync
  and reintroduces the restart-storm shape finding 1 removed. The pending set gives the same
  catch-up guarantee for free.
- `useLiveTree` in `board.js` needs no change — the gate sits below the hook. Four call sites
  today: board (structural), rail (structural), `WhatsNextPanel` and `InFlightLane` (advisory).
- The hub's `EventSource` is unreachable under jsdom for the unit test; the injected
  `visibility` fake is how the criteria run at all (same reason `sourceFactory` exists). Keep
  the hub free of React.
- ADR-0006 (transport) stays untouched, as at mvt8x. ADR-0014/ADR-0029 (animations) are closed
  by pk4qd. ADR-0033's hover-scoped IntersectionObserver is unaffected.
- `depends_on` lists the three children, all in `done/` — the dependency gate is met. This task
  was held in `backlog/` until the hub existed; it is promotable now.

## Outcome

`createLiveTreeHub` (`dashboard/app/live-tree-hub.js`) gained one injectable `visibility` dependency, `{ isHidden, onChange }`, alongside `sourceFactory` / `fetchTree`. The default adapter reads `globalThis.document?.visibilityState` and listens for `visibilitychange`; with no `document` present (node, and every pre-existing hub test) it reports always-visible and `onChange` is a no-op, so all four pre-existing suites pass unedited.

While hidden, `handleFrame` delivers nothing and records what would have happened per ADR-0070 category in a per-hub `pending` set: `hello`/reconnect → `pending.all`; a structural frame → `pending.structural` (plus `invalidateTree()`, so a subscriber mounting while hidden never sees a stale cache); an advisory frame → `pending.advisory.add(path)`; runtime → nothing, unchanged. On becoming visible, `onVisibilityChange` replays the pending set at most once per category then clears it: `pending.all` wins outright (`notifyAll()`); otherwise `pending.structural` (one shared `/api/tree` fetch regardless of how many structural frames were dropped) and each pending advisory path replay independently. An empty pending set replays nothing. The source is never closed on hide — `ensureSource()` registers the `visibility.onChange` listener with the first subscriber; `teardownSource()` (last unsubscribe) removes it and clears the pending set.

New `dashboard/test/live-tree-hub-visibility.test.mjs` (5 tests, no DOM, injected fake `visibility`) covers: (1) two structural + two advisory subscribers, hidden, three structural + five in-flight frames → zero fetches/callbacks while hidden, then visible → one `fetchTree`, each structural subscriber once, in-flight once, whats-next never; (2) hidden with only in-flight advisory frames → zero `fetchTree` on return, in-flight once; (3) hidden with no frames → zero fetches/callbacks on return; (4) hidden with a `hello` frame → every subscriber once, one `fetchTree` on return; (5) the source's `constructions`/`closed` are untouched across the pause, and the fake's visibility-listener count goes to 0 on last unsubscribe and back to 1 on a fresh subscribe. `dashboard/test/live-tree-hub-e2e.test.mjs` gained one jsdom case proving the *production* adapter reads real `document.visibilityState`/`visibilitychange` (override to `'hidden'` + dispatch → zero `/api/tree` fetches for a structural frame; back to `'visible'` + dispatch → exactly one `/api/tree` fetch, zero `/api/doc` fetches). `dashboard/test/live-tree-source-guard.test.mjs` gained two tests: `visibilitychange` / `visibilityState` / `document.hidden` occur under `dashboard/app/**` only in `live-tree-hub.js`, and the hub itself references the first two (its default adapter).

All four pre-existing hub test files (`live-update-hub.test.mjs`, `live-tree-hub-e2e.test.mjs`, `live-frame-registration.test.mjs`, `live-tree-source-guard.test.mjs`) pass unedited alongside the new/extended ones. Full `node --test dashboard/test/*.test.mjs` in the worktree: 981 tests, 980 pass, 1 expected failure — `dist-staleness.test.mjs`'s "committed dist matches sources" check, which goes red the moment a declared source (`live-tree-hub.js`) changes and is resolved by the real `npm run build` rebuild at integration (ADR-0057/ADR-0074; the worker branch carries source and tests only, never `dist/`), exactly as this task's own acceptance criterion anticipates ("`dashboard/dist/` is rebuilt at integration").

The `[human-eye]` before/after MacBook measurement criterion (§3 of the task) stays unchecked — it is the builder's own check per ADR-0061/0062; no number was invented here.

Key files: `dashboard/app/live-tree-hub.js`, `dashboard/test/live-tree-hub-visibility.test.mjs`, `dashboard/test/live-tree-hub-e2e.test.mjs`, `dashboard/test/live-tree-source-guard.test.mjs`.

ADR-0070 amended at integration by the conductor (ADR-0074): a new `### 6. Hidden tab — pause, coalesce, catch up once` section and a `## Status log` line for this task, both carried in the worker's report.
