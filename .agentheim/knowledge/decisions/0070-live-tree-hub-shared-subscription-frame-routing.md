---
id: ADR-0070
title: Live-tree hub — one shared subscription and fetch per tab; frame routing extends the advisory/lifecycle split to the read side
scope: agentic-workflow
status: accepted
date: 2026-09-05
related_tasks: [agentic-workflow-bmn29, agentic-workflow-mvt8x, agentic-workflow-rw6ck]
related_adrs: [0006, 0027, 0043]
supersedes_in_part: [ADR-0027, ADR-0043]
---

# ADR-0070: Live-tree hub — one shared subscription and fetch per tab; frame routing extends the advisory/lifecycle split to the read side

## Context

`agentic-workflow-bmn29` found that the dashboard behaves like a poller with no
timer anywhere in it. Two structural drifts compound:

1. **ADR-0006 designed "a long-lived connection per open board tab."** The code
   drifted from that design one feature at a time: `useLiveTree` is a React hook,
   and each of its four call sites — `DashboardBoard`, the rail's baseline
   tracker, `WhatsNextPanel`, `InFlightLane` — opens its own
   `createLiveUpdate`/`EventSource`. A tab holds four connections, not one, each
   with its own server-side recursive watcher and heartbeat. ADR-0006's own text
   was never wrong; it was written as a *consequence to budget for*, not as a
   *consumer-side invariant anyone was accountable for holding*.
2. **Nothing distinguishes advisory from lifecycle on the read side.** ADR-0027
   named the *advisory write* — an opinion about state, not a change to it — and
   ADR-0043 extended it to `.agentheim/state/in-flight.json`, rewritten by the
   `Stop`/`SubagentStop` hooks on every orchestrator turn end and every subagent
   completion. Both ADRs constrain the write; neither constrains what happens
   when the dashboard *reads* the resulting `tree-changed` frame. Today every
   frame — advisory or structural — triggers the identical fan-out: the board
   and rail each re-walk the full `/api/tree` projection (a synchronous
   `readFileSync` + two `statSync` per task over ~255 tasks, run twice, blocking
   the event loop both times) and the two advisory panels each re-fetch their
   doc. During a `work` session, advisory writes vastly outnumber real task
   moves, so the emergent behavior is indistinguishable from polling even though
   no client timer and no server stat-poll (on macOS) exists anywhere.

This decision belongs in **agentic-workflow**, not infrastructure, for the same
reason ADR-0006's own Scope note already draws that line: "Interpreting the
change... is the consumer's job." Deciding *who* re-syncs on a given frame, and
*which* artifacts count as advisory for read purposes, is exactly that
consumer-side interpretation — ADR-0006 stays pure transport and is unchanged.

## Decision

**Every tab holds exactly one live-tree source, owned by a single hub that also
owns the one `/api/tree` fetch; every component subscribes to the hub instead of
constructing its own source. A frame's path selects which subscriber re-syncs —
never what changed in the model.**

### 1. One hub per tab — connection and fetch both

A framework-free, refcounted hub (beside `dashboard/app/live-update.js`, same
design: injectable `sourceFactory` **and** injectable `fetchTree`, no React
import, `node --test`-able with no DOM) owns exactly one `EventSource`/source
for the tab. The first subscriber constructs it; the last unsubscribe closes it;
concurrent subscriptions in the same tick share one in-flight `/api/tree`
fetch. `useLiveTree` becomes a thin hook over the hub. No component constructs
`createLiveUpdate` or `EventSource` directly — the hub is the only call site for
both, mechanically enforced (see `agentic-workflow-mvt8x`'s acceptance
criteria). This is the literal realization of ADR-0006's "a long-lived
connection per open board tab" — one tab, one connection, regardless of how many
in-process consumers subscribe to it.

### 2. Three frame categories, not one undifferentiated pointer

A frame's `path` sorts into exactly one of:

- **Structural** — `.agentheim/contexts/**`, `.agentheim/knowledge/**`, or any
  path this ADR does not name below → the board and rail re-sync (one shared
  `/api/tree` fetch via the hub, each applying its own projection).
- **Advisory** — `.agentheim/state/**` → only the panel that reads that specific
  artifact re-syncs: `state/whats-next.md` → `WhatsNextPanel`;
  `state/in-flight.json` → `InFlightLane`. Never the board, never the rail. This
  is the read-side counterpart ADR-0027/0043 never specified — an advisory
  artifact was never supposed to be able to move the board's structural
  projection, and today it does, transitively, through the undifferentiated
  fan-out this ADR closes.
- **Runtime** — `.agentheim/.dashboard/**` (the runfile, bridge discovery file,
  last-port marker — infrastructure's own transport bookkeeping, ADR-0002 /
  ADR-0018 / ADR-0053) → no dashboard consumer re-syncs. Nothing on the board
  projects this category today; a frame naming it is simply not addressed to
  any subscriber.

A new advisory artifact must register with the router when it is added
(mechanically checked: every advisory doc-path constant the app exports must
classify as advisory and resolve to exactly one registered subscriber) — a
guard rail carried forward from ADR-0027 §4's "one file only... a second
advisory artifact needs its own decision," now enforced on the read side too.

### 3. Routing is not interpretation — the load-bearing distinction

**The pointer stays a pointer.** Using `path` to decide *who* re-syncs is
addressing; using it to decide *what changed in the model* remains forbidden
(ADR-0001, restated in `live-update.js`'s own header comment: "this consumer
NEVER interprets a raw `tree-changed` frame as a Task transition"). Every
routed consumer still re-fetches its **whole** artifact and re-projects it from
scratch on being addressed — nothing is diffed, nothing is patched, and
idempotence is untouched. Without this clause a future reader could reasonably
conclude this ADR broke the projection discipline ADR-0001/0006 established; it
did not — it only narrowed the *audience* a frame reaches, not what a reached
consumer does with it.

### 4. Fail open on an unrecognized path

`fs.watch` filenames are platform-inconsistent, and ADR-0006 already calls the
emitted path a *hint*; the `hello` frame carries no path at all. An absent,
malformed, or unrecognized path classifies as **structural** — everyone
re-syncs, i.e. exactly today's behavior for that frame. A classification miss
can only cost one wasted fetch; it can never produce a stale board.

### 5. Relationship to ADR-0006 (unchanged) and ADR-0027 / ADR-0043 (narrowed)

ADR-0006 is untouched — this decision realizes its stated design rather than
amending it, and stays out of the transport layer it owns. ADR-0027 §3 ("the
existing SSE consumer fires on any `.agentheim/` mutation... the panel
re-fetches") and ADR-0043 §4 ("re-fetches on every SSE frame") are each
**superseded in part**: an advisory panel now re-syncs only on a frame naming
its own artifact (plus connect/reconnect, unchanged), not on every frame
regardless of path. Every other clause of both ADRs — the write-side guard
rails, the one-file-only discipline, "no lifecycle dependency on its content,"
the dashboard's read-only stance over the artifacts themselves — is fully
intact; this ADR only narrows how the *reader* reacts to the frame, never what
the writer may do.

### 6. Hidden tab — pause, coalesce, catch up once

A hidden tab still holds the hub's one `EventSource` and still receives every
frame, but a hidden tab has no board or rail to project into — routing a
frame while hidden buys nothing but a wasted fetch or re-render the user
cannot see. `createLiveTreeHub` gains one injectable `visibility` dependency,
`{ isHidden, onChange }`, matching `sourceFactory` / `fetchTree`'s own idiom.
The default adapter reads `document.visibilityState` and listens for
`visibilitychange`; with no `document` (node) it reports always-visible, so
every pre-existing test keeps passing unedited.

While hidden, `handleFrame` delivers NOTHING and instead records, per
category (§2), what it would have done in a pending set: `hello`/reconnect →
`pending.all`; a structural frame → `pending.structural` (and
`invalidateTree()`, so a subscriber that mounts while still hidden never
receives a stale cache); an advisory frame → `pending.advisory.add(path)`;
runtime → nothing, unchanged. On becoming visible, the pending set replays
AT MOST ONCE per category, then clears: `pending.all` → `notifyAll()`;
otherwise `pending.structural` → `notifyStructural()` (one shared `/api/tree`
fetch no matter how many structural frames were dropped) and each pending
advisory path → `notifyAdvisory(path)`. An empty pending set replays
nothing — a tab switch with no change behind it costs zero fetches. The
audience rule of §2 holds across the pause: five in-flight heartbeats while
hidden re-sync `InFlightLane` once on return and never touch the board or
rail.

**Why not close the source on hide.** The server-side cost of one open
stream is one watcher and one heartbeat timer; closing it turns every return
into a reconnect plus a full `hello` re-sync, reintroducing the restart-storm
shape ADR-0070 §1 removed. The pending set gives the same catch-up guarantee
for free, so the source stays open, always.

**Why not replay unconditionally on every return.** An unconditional re-sync
on every visibility change is a `/api/tree` walk on every tab switch — the
exact waste class this hub exists to remove. The missed-change failure mode
is covered by the pending set plus `EventSource`'s native reconnect (a
connection dropped while hidden re-fires `hello`, itself subject to the same
pending-set gate).

This is unconditionally an addressing decision, never an interpretation one:
§3's routing-is-not-interpretation distinction is untouched — pausing selects
*when* an audience is notified, never *what changed*. Mechanized:
`live-tree-source-guard.test.mjs` asserts `visibilitychange` / `visibilityState`
/ `document.hidden` occur under `dashboard/app/**` only in `live-tree-hub.js` —
visibility gating has exactly one home, the same way source construction does.

## Consequences

**Positive**

- Closes the exact gap `agentic-workflow-bmn29` found: an advisory heartbeat
  write (fired on every orchestrator turn end) no longer triggers two
  `/api/tree` walks, two `/api/doc` fetches, and a whole-board re-render. Only
  the one panel that actually reads the changed artifact re-syncs.
- ADR-0006's "one connection per tab" becomes a held invariant, not an aspirational
  sentence four independently-added call sites drifted away from — enforced by a
  source-construction guard, not just documented.
- The routing/interpretation distinction (§3) keeps ADR-0001's projection
  discipline fully intact while still closing the fan-out: this is an addressing
  change, not a reinterpretation of what a frame means.
- A future dashboard panel has a clear, named place to plug into (subscribe to
  the hub; classify its own artifact) instead of a fifth ad hoc
  `createLiveUpdate` call site.

**Negative**

- A fourth frame category will eventually need naming (e.g. if a future artifact
  lives outside `contexts/`, `knowledge/`, `state/`, and `.dashboard/`) — the
  fail-open default (§4) is the mitigation until that happens, not a permanent
  answer.
- Routing means the board no longer re-syncs on some `.agentheim/` writes it
  used to react to unconditionally. If a future lifecycle write were ever
  mis-filed under `state/`, it would go unseen by the board — mitigated by
  ADR-0027/0043 already forbidding exactly that (advisory artifacts carry no
  lifecycle truth), and by the classifier's structural default covering
  anything unclassified.
- Two ADRs beyond this one (0027, 0043) must now be read together with this
  one's narrowing to get the full read-side picture for an advisory artifact —
  a small but real documentation-navigation cost.

**Neutral**

- Does not change what any artifact *is* (advisory vs. lifecycle) — only how the
  dashboard's SSE consumer reacts to a change in one. The write-side categories
  and guard rails from ADR-0027/0043 are the ones this ADR reads from, not
  redefines.
- Memoization/render-count concerns (`agentic-workflow-rw6ck`) are a downstream
  consumer of this ADR's identity-stable re-fetch behavior but are not decided
  here — that task's identity-stable-projection contract is recorded as a BC
  README/ubiquitous-language note plus a plain unit test, not a second ADR.

## Alternatives considered

- **Amend ADR-0006 in place instead of a new ADR.** Considered and rejected:
  ADR-0006 is `scope: infrastructure` and is explicitly pure transport — its own
  Scope note assigns frame interpretation and consumption to agentic-workflow.
  The shared-hub shape and the frame-routing rule are both consumer-side
  decisions; putting them in an infrastructure ADR would misplace the decision
  even though it references ADR-0006's design.
- **Leave frames undifferentiated; let each consumer decide independently
  whether to react.** Rejected — this is today's behavior, which is the bug:
  four independently-added call sites each made a locally-reasonable choice
  ("re-fetch on every frame") that compounds badly in aggregate, with no shared
  place holding the invariant.
- **Stop watching `.agentheim/state/**`/`.agentheim/.dashboard/**` entirely
  instead of routing.** Rejected — the advisory panels still need *some* signal
  to know their artifact changed; silencing the source removes their only
  update path. Scoping the *reaction* (routing), not the *source* (the
  watcher), is the fix.
- **A fourth id-based routing scheme (route by artifact identity rather than
  path prefix).** Rejected as unnecessary complexity: every advisory/runtime
  artifact today is addressed by a fixed, known path
  (`state/whats-next.md`, `state/in-flight.json`, the runtime files under
  `.dashboard/`), so a path-prefix classifier is sufficient and matches how the
  watcher already emits paths (ADR-0006).

## Status log

- **2026-09-05 — accepted.** Implemented by `agentic-workflow-mvt8x`:
  `dashboard/app/live-tree-hub.js` (the refcounted hub) and
  `dashboard/app/live-frame-router.js` (the pure classifier), with `board.js`'s
  `useLiveTree` rewired to subscribe to the hub instead of constructing its own
  `createLiveUpdate`/`EventSource`. All acceptance criteria in that task are
  machine-checked (`dashboard/test/live-update-hub.test.mjs`,
  `live-frame-router.test.mjs`, `live-tree-source-guard.test.mjs`,
  `live-frame-registration.test.mjs`, `live-tree-hub-e2e.test.mjs`) except the
  builder's own MacBook resource measurement, which stays `[human-eye]`.
- **2026-09-06 — amended.** Implemented by `agentic-workflow-bmn29`: the
  injectable `visibility` gate (`{ isHidden, onChange }`) on
  `createLiveTreeHub`, the per-category pending set, and the extended source
  guard. Machine-checked by `dashboard/test/live-tree-hub-visibility.test.mjs`,
  a new default-adapter case in `live-tree-hub-e2e.test.mjs`, and the extended
  `live-tree-source-guard.test.mjs`. The umbrella's `[human-eye]` MacBook
  measurement stays open at the builder's own check (ADR-0061/0062).
