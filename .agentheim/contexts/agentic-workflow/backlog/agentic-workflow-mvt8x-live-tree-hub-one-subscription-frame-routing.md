---
id: agentic-workflow-mvt8x
title: One live-update subscription per tab, one /api/tree fetch per structural frame — an advisory frame (.agentheim/state/**) re-syncs only the panel that reads that artifact, never the board or rail
status: backlog
type: bug
context: agentic-workflow
created: 2026-09-05
completed:
depends_on: [design-system-001-styleguide]
blocks: [agentic-workflow-rw6ck, agentic-workflow-bmn29]
tags: [dashboard, performance, sse, live-update, advisory-write]
related_adrs: [0006, 0027, 0043, 0070]
related_research: []
prior_art: [agentic-workflow-009, agentic-workflow-073, agentic-workflow-m9w5c, agentic-workflow-n4h7q]
---

## Why

The board is a **projection of disk** (ADR-0001): a `tree-changed` frame is a raw
pointer, and the consumer's whole job is to re-fetch and re-project — it **never
interprets the raw event** as a Task transition. That discipline is intact. What
drifted is *how many consumers hold it*. `useLiveTree` is a React hook, and each
of its four call sites opens its own `createLiveUpdate`/`EventSource`: the
board, the rail's baseline tracker, `WhatsNextPanel`, `InFlightLane`. ADR-0006
designed one long-lived connection per open board tab; the tab actually holds
four, each with its own server-side recursive watcher and 25s heartbeat,
consuming four of the browser's six per-host HTTP/1.1 slots.

The four subscribers then compound into a fan-out. Because `useLiveTree`'s
callback ignores the frame's `path` entirely, **one** frame produces **two**
full `/api/tree` walks (board + rail — each a synchronous `readFileSync` + two
`statSync` per task over ~255 tasks, blocking the event loop both times) plus
**two** `/api/doc` fetches, regardless of what actually changed on disk.

What actually changes most often is not lifecycle truth. ADR-0027 named the
**advisory write** — a skill or hook persisting an *opinion about* state, not a
*change to* it — and ADR-0043 added the second artifact, `in-flight.json`,
rewritten by the `Stop`/`SubagentStop` hooks on **every orchestrator turn end
and every subagent completion**. During a `work` session those advisory writes
vastly outnumber real task moves, and each one currently triggers the identical
full board+rail re-projection. ADR-0027's category split exists only on the
**write** side; nothing distinguishes advisory from lifecycle on the **read**
side. That is what makes the dashboard behave like a poller with no timer in it.

See ADR-0070 for the decision this task implements (a new agentic-workflow ADR;
ADR-0006 itself is transport-only and is not amended — see Notes).

## What

**One shared live-tree source, one fetch, many consumers.** Introduce a
framework-free, refcounted live-tree hub beside `createLiveUpdate`
(`dashboard/app/live-update.js`) — same design philosophy: injectable
`sourceFactory` **and** injectable `fetchTree`, no React import, `node --test`-able
with no DOM. It owns exactly one source for the tab: the first subscriber
constructs it, the last unsubscribe closes it, and concurrent subscriptions in
the same tick share one in-flight `/api/tree` promise. `useLiveTree` becomes a
thin hook over the hub; no component constructs `createLiveUpdate` or
`EventSource` again. Board and rail consume the hub's **one** tree payload and
each apply their own projection (`treeToColumns` / `treeToLibrary`) — one
fetch, two projections, instead of two fetches.

**The pointer selects the re-sync's audience, never its meaning.** Add a pure
classifier (a data-module helper with a sibling `node --test`, per the BC's
convention) that sorts a frame's `path` into three categories:

- **structural frame** — `.agentheim/contexts/**`, `.agentheim/knowledge/**`, or
  anything unclassifiable → board and rail re-sync (one shared fetch);
- **advisory frame** — `.agentheim/state/**` → only the panel that reads *that
  exact artifact* re-syncs (`whats-next.md` → `WhatsNextPanel`;
  `in-flight.json` → `InFlightLane`). Never the board, never the rail;
- **runtime frame** — `.agentheim/.dashboard/**` (runfile, bridge discovery
  file, last-port marker — infrastructure transport bookkeeping, ADR-0002 /
  ADR-0018 / ADR-0053) → **no** consumer re-syncs; nothing on the board
  projects these.

**This is routing, not interpretation.** The frame's payload remains a raw
pointer that says *something under this path changed*. Using it to decide
**who** re-syncs is addressing; using it to decide **what changed in the
model** would be interpretation, and is still forbidden. Every routed consumer
re-fetches its **whole** artifact and re-projects it from scratch — nothing is
diffed, nothing is patched, idempotence and the ADR-0001 projection discipline
are untouched.

**Fail open.** `fs.watch` filenames are platform-inconsistent and ADR-0006
explicitly calls the path a hint; the `hello` frame carries no path at all. An
absent, malformed, or unrecognized path classifies as **structural** —
everybody re-syncs, i.e. exactly today's behavior. A classification miss can
only cost a wasted fetch, never a stale board (same "can't tell degrades to the
safe answer" idiom as the `lib/` lints).

## Acceptance criteria

- [ ] `dashboard/test/live-update-hub.test.mjs` (`node --test`, no DOM): a counting
      `sourceFactory` records constructions. Four subscribers → exactly **1**
      construction. Dropping three → source stays open (0 closes). Dropping the
      last → exactly 1 close. Re-subscribing after full teardown → exactly 1 new
      construction. (Covers "no new connection when the board unmounts for a
      main-pane document and remounts", which today costs three fresh
      connections.)
- [ ] Same file, injected `fetchTree` counter: one structural frame → exactly
      **1** `/api/tree` call regardless of consumer count; two consumers
      subscribing in the same tick → exactly **1** fetch (in-flight dedupe); a
      consumer subscribing after the tree is cached receives the current tree
      with **0** additional fetches.
- [ ] Pure classifier test, table-driven: `.agentheim/state/in-flight.json` →
      advisory; `.agentheim/state/whats-next.md` → advisory;
      `.agentheim/contexts/agentic-workflow/todo/x.md` → structural;
      `.agentheim/knowledge/decisions/0006-*.md` → structural;
      `.agentheim/.dashboard/runtime.json` → runtime; `null` / `undefined` /
      `{}` / a non-string path / a path outside `.agentheim/` → **structural**
      (fail-open).
- [ ] Hub-level fan-out: an advisory frame naming `in-flight.json` invokes
      **only** the in-flight subscriber's callback (board, rail and whats-next
      callbacks recorded 0 invocations); an advisory frame naming
      `whats-next.md` invokes only the whats-next subscriber; a runtime frame
      invokes **none**; a structural frame invokes **all**; a `hello` frame
      invokes all (reconnect catch-up, ADR-0006).
- [ ] End-to-end in jsdom via the existing `dashboard/test/dom-harness.mjs`, with
      `globalThis.EventSource` set to a counting fake before importing
      `board.js` and `fetch` stubbed per-URL: mounting the app constructs
      exactly **1** `EventSource`; emitting one `.agentheim/contexts/**` frame
      issues exactly 1 `/api/tree` and 0 `/api/doc`; emitting one
      `.agentheim/state/in-flight.json` frame issues **0** `/api/tree`, exactly
      1 `/api/doc?path=…in-flight.json`, and **0**
      `/api/doc?path=…whats-next.md`. (This is the direct proof of the parent's
      "a heartbeat write does not re-render the board's cards" — the board
      issues no fetch, so it cannot re-project.)
- [ ] Convention guard: across `dashboard/app/**`, `createLiveUpdate(` and
      `new EventSource(` appear only inside the hub module — a source-regex
      `node --test` static guard, matching the codebase's established idiom
      (see `dashboard/test/launch-button-hover.test.mjs` for the pattern).
- [ ] Registration consistency: every advisory doc-path constant the app
      exports (`WHATS_NEXT_DOC_PATH`, `IN_FLIGHT_DOC_PATH` — both already
      exist) classifies as advisory **and** resolves to exactly one registered
      subscriber. A future third advisory artifact added without registering
      it fails this test.
- [ ] The existing `dashboard/` `node --test` suite passes with no test edited
      to accommodate the change, except `in-flight-lane.test.mjs` /
      `whats-next-panel.test.mjs`'s `useLiveTree(reload)` source assertions,
      which are updated to the routed form (expected, sanctioned churn — not a
      red flag).
- [ ] Before/after resource measurement recorded on the builder's MacBook:
      Activity Monitor energy impact (or Chrome Task Manager CPU) for the
      dashboard tab, 5 minutes at idle and during a running `work` session.
      **[human-eye]** — not because it is perceptual, but because no in-repo
      runner can observe the real browser process on the builder's hardware.
      Every synthetic proxy for it is already one of the machine-checkable
      criteria above; inventing an in-repo "CPU dropped by N%" number would be
      exactly the metric-smuggling ADR-0061 exists to stop. Per ADR-0062 a
      verdict comes only from a runner, and there is no runner for this claim
      — so it stays `[human-eye]` and its checkbox stays unchecked through
      `done/` as the routing signal to the builder's own check.

All other criteria above are machine-checkable, so `lib/human-eye-criteria.mjs`'s
all-human-eye rule does not fire and no "Verification is builder-eye only"
`## Notes` line is required.

## Notes

**Scope / file surface.** This task's diff touches `dashboard/app/**` (new hub
module, updated `useLiveTree`, updated call sites), `dashboard/test/**`, the
`.agentheim/contexts/agentic-workflow/README.md` ubiquitous-language section
(see below), and cross-references ADR-0070 (already written, see
`.agentheim/knowledge/decisions/0070-live-tree-hub-shared-subscription-frame-routing.md`).
Because the diff touches a BC README convention section and an ADR, it is on a
**doctrine-bearing surface** — the ADR-0059 mechanize-or-drop gate fires (state
this explicitly in the task rather than leaving it implicit).

**Mechanize-or-drop (ADR-0059) — two conventions, two verdicts:**

- **C1 — "exactly one live `/api/events` subscription per tab, fanned out to
  consumers; a component subscribes to the shared hub and never constructs its
  own source."** → **Ship enforcement** (the source-guard acceptance criterion
  above). The behavioral tests alone are not sufficient: a future panel that
  opens its own `EventSource` would pass every behavioral test in the suite
  while silently restoring the bug. The source guard is what catches the next
  author — the same shape ADR-0044/ADR-0052 already proved works.
- **C2 — "a frame's path selects its audience: advisory (`.agentheim/state/**`)
  re-syncs only the panel reading that artifact; runtime
  (`.agentheim/.dashboard/**`) re-syncs nobody; anything else, including an
  unclassifiable path, re-syncs everyone."** → **Ship partial enforcement**
  (the registration-consistency criterion above mechanizes the mechanical
  half: a new advisory artifact that isn't registered with the router fails
  the suite). The residual judgment — *should this new panel subscribe
  structurally or advisorily?* — is semantic and stays **prose-only,
  unenforced** in the README + ADR-0070, because a lint would have to
  understand what a new panel reads. This mixed verdict is the doctrine's
  intended shape: mechanize what mechanizes, record the rest visibly.

**Hub shape (implementation guidance).** The hub's `EventSource` is
unreachable under jsdom, so the injectable `sourceFactory` is not optional
polish — it is how the acceptance criteria run at all. Keep the hub free of any
React import so those tests need no DOM. `WhatsNextPanel` and `InFlightLane`
already take an injectable `fetchDoc`; follow that same dependency-injection
idiom rather than inventing a new one. `WhatsNextPanel`/`InFlightLane` are
rendered **inside** `DashboardBoard`, which itself unmounts whenever a document
opens in the main pane — today that closes three sources and reopens them on
return; with the refcounted hub the rail should keep the one source alive
across that transition (worth asserting as part of the source-construction
test above).

**ADR relationship.** This task implements ADR-0070 (new, agentic-workflow
scope, `status: proposed`), which supersedes-in-part ADR-0027 §3 and ADR-0043
§4 (an advisory panel re-syncs only on a frame naming its own artifact, not on
every frame). **ADR-0006 is deliberately left unamended** — it is pure
transport (its own Scope note assigns frame interpretation/consumption to
agentic-workflow) and its "a long-lived connection per open tab" text was
never wrong, only drifted from. If convenient, add a one-line backlink from
ADR-0006 to ADR-0070 as part of this diff ("the consumer-side realization of
this design is ADR-0070") — trivial, not required.

**Split rationale (for context only — do not re-litigate).** This is one of
two children split from `agentic-workflow-bmn29`. The sibling,
`agentic-workflow-rw6ck` (board memoization + identity-stable projection),
`depends_on` this task — not for logical reasons (a hover never touches the
SSE path) but because both edit `dashboard/app/board.js` in adjacent regions
(merge-surface risk under worktree isolation) and because rw6ck's render-count
measurements are only clean once this task removes the heartbeat-driven
full-board re-fetch. The parent's acceptance criterion "an in-flight heartbeat
write does not re-render the board's cards" belongs to **this** task (proven
by the end-to-end jsdom criterion above) — it is not evidence for rw6ck.

**Deliberately out of scope.** `visibilitychange` pause/resume (parent AC #6,
a hidden tab pausing re-fetch/re-sync) is NOT part of this task. It introduces
a distinct failure mode (a paused tab silently missing a change) that deserves
its own falsifiable criteria, and it becomes ~10 lines once this task's hub
exists as a single place to gate visibility (pre-hub it would have to be
written four times). Leave the hub's shape open to that future addition (e.g.
don't hardcode "always active" logic somewhere that would need untangling
later) but do not implement it here. A future task should pick this up once
this one has shipped.

**Ubiquitous language to add to `.agentheim/contexts/agentic-workflow/README.md`**
(and amend the existing "Live-update (SSE consumer)" bullet, whose current
wording — "On every `tree-changed` frame or (re)connect it does **one** thing:
re-fetch `/api/tree` and re-project the whole board" — becomes inaccurate for
advisory frames and must be corrected in this same diff):

```markdown
- **Live-tree hub (one subscription, one fetch, many consumers)** — the tab holds
  **exactly one** `/api/events` source (ADR-0006's "a long-lived connection per open
  board tab", finally realized), owned by a refcounted, framework-free hub that also
  owns the single `/api/tree` fetch. Board, rail, and the advisory panels *subscribe*;
  they never construct `createLiveUpdate`/`EventSource` themselves. First subscriber
  opens the source, last unsubscribe closes it, concurrent subscribers share one
  in-flight fetch, and each consumer applies its own projection (`treeToColumns` /
  `treeToLibrary`) to the one payload. Enforced by a source guard: `createLiveUpdate(`
  and `new EventSource(` appear only in the hub. See ADR-0070, ADR-0006.
- **Structural / advisory / runtime frame** — the read-side counterpart to ADR-0027's
  write-side category split. A `tree-changed` frame under `.agentheim/contexts/**` or
  `.agentheim/knowledge/**` is **structural**: board and rail re-sync. A frame under
  `.agentheim/state/**` is **advisory** — it was produced by an advisory write
  (ADR-0027/0043) and re-syncs ONLY the panel that reads that artifact
  (`whats-next.md` → `WhatsNextPanel`, `in-flight.json` → `InFlightLane`), never the
  board or rail. A frame under `.agentheim/.dashboard/**` is **runtime** (runfile,
  bridge discovery file, last-port marker — infrastructure transport bookkeeping) and
  re-syncs nobody. An absent, malformed, or unrecognized path classifies as
  **structural** — fail open, so a classification miss costs a wasted fetch, never a
  stale board. A new advisory artifact must register with the router (mechanized).
  See ADR-0070, ADR-0027, ADR-0043.
- **Frame routing is not frame interpretation** — the pointer stays a pointer: it
  selects the re-sync's **audience**, never its **meaning**. Deciding WHO re-syncs is
  addressing; deciding WHAT CHANGED in the model would be interpretation, and remains
  forbidden (ADR-0001). Every routed consumer still re-fetches its whole artifact and
  re-projects from scratch — nothing diffed, nothing patched, idempotence intact.
  See ADR-0070, ADR-0006.
```

**Open question for the promoter.** Is `.agentheim/protocol/` (and a BC
`INDEX.md`) structural under this classifier? Recommendation: yes (falls under
"anything unclassifiable" → structural, fail-open, simplest) — note it as a
future narrowing rather than deciding it definitively now, since protocol
writes are frequent but the board itself doesn't project them (only the rail's
baseline tracking might eventually care).

**Resolution of the open question above (at refinement):** `protocol.md` lives under
`.agentheim/knowledge/**` and every `INDEX.md` under `.agentheim/contexts/**`, so both are
structural by the classifier as written — no special case. Narrowing them (the board projects
neither; only the rail's baseline tracker might care) is a legitimate future follow-up, not
part of this task.

Split from `agentic-workflow-bmn29` at refinement (2026-09-05); the parent keeps the full
diagnosis and the residual hidden-tab scope.
