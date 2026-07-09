---
id: ADR-0053
title: Runtime self-lifecycle — a third dashboard write category, and POST /api/stop
scope: global
status: accepted
date: 2026-07-09
related_tasks: [agentic-workflow-h4n2v, agentic-workflow-028]
related_adrs: [0017, 0046, 0027, 0018, 0002]
supersedes_clause: ["agentic-workflow-028: 'the server is never asked to stop itself'"]
---

# ADR-0053: Runtime self-lifecycle — a third dashboard write category, and `POST /api/stop`

## Context

The **Stop dashboard** control lives in the topbar settings menu (aw-049, relocating
aw-028's original placement). Until this task it worked by **reuse, not a server
write**: clicking it dispatched the bridge launch path (`launchOrCopy`) to run
`/agentheim:dashboard stop` (`STOP_DASHBOARD_COMMAND`) in a **spawned Claude Code
session**, which then invoked `/dashboard stop` → `stopDashboard(root)` (kill pid +
remove runfile, `dashboard/launch.mjs`). aw-028 recorded the seam decision
explicitly:

> "The server is never asked to stop itself" — `server.mjs` stays purely read-only
> (ADR-0017); the seam decision is bridge-reuse, not a new self-stop endpoint.

That seam bought ADR-0017 purity at a real cost, now unacceptable:

1. **Absurdly heavy for the work done.** A whole agent session is spawned to run
   two syscalls (kill a pid, delete a JSON file).
2. **The bridge-present/absent asymmetry aw-028 accepted becomes a defect for
   this control specifically.** Without the VS Code bridge (a plain browser tab),
   the "Stop" button could only *copy* the stop command to the clipboard — the one
   control whose entire job is "stop the thing I'm looking at" could not do it in
   the browser most builders actually use. aw-028 called this "accepted, not a
   defect," reasonable in the moment but wrong for a control this load-bearing.

`stopDashboard(root)` already exists and already has a CLI (`node launch.mjs
stop`) and a skill (`/agentheim:dashboard stop`). The button should be able to
reach that capability directly, not narrate a command to a session that will.

**Why this isn't simply reopening ADR-0017.** ADR-0017 forbids the dashboard from
owning **task lifecycle** — task moves, `status` rewrites, `INDEX.md` counts,
`protocol.md` entries, backlink reconciliation. Stopping the dashboard's own HTTP
server touches **none of that**. The only file involved is
`.agentheim/.dashboard/runtime.json` — a runtime artifact the dashboard's own
launch path already wrote exclusively (`runfile.mjs`), that no skill reads and no
board projection derives from. The server is not claiming new ownership over
anything; it already owns its own runfile. This is a **different, narrower**
category of write than either of the two the codebase has already named:

- **Lifecycle write** (ADR-0017/ADR-0007) — disk truth about the *project*.
  Forbidden to the dashboard.
- **Advisory write** (ADR-0027, extended ADR-0043, one delete carved by
  ADR-0046) — a skill's *opinion* about the state, persisted for the dashboard to
  read (and, since ADR-0046, delete on explicit dismiss).
- **Runtime self-lifecycle write** (this ADR) — the dashboard ending *its own
  process* and cleaning up *its own runtime artifact*, on an explicit builder
  command issued from the UI it is currently rendering. It touches neither the
  project's lifecycle truth nor any skill's advisory artifact — only the
  runtime bookkeeping the dashboard's own launcher already owns end-to-end
  (`launch.mjs` writes the runfile on start; this ADR lets the same server
  remove it on an explicit stop).

ADR-0046 already cut the shape for "the dashboard gets exactly one new HTTP verb,
narrowly": `DELETE /api/whats-next` — dispatched before the `405` method gate, no
request body, no client-supplied path, target derived entirely server-side. This
task reuses that shape verbatim for `POST /api/stop`; only the *category* of what
is being written is new, not the transport contract.

## Decision

**The dashboard gains a second write since ADR-0017, and a third named write
category — RUNTIME SELF-LIFECYCLE, sibling to the forbidden lifecycle category
(ADR-0017) and the advisory category (ADR-0027/ADR-0043/ADR-0046).** Concretely:
`POST /api/stop` ends the dashboard's own HTTP server process and removes its own
runfile, on an explicit builder click, with no bridge and no spawned session in
the path. This **amends** ADR-0017's read-only framing and ADR-0046's "exactly one
write" claim (see §5 below), and **supersedes** aw-028's "the server is never
asked to stop itself."

### 1. The endpoint: `POST /api/stop`

- **Method.** `POST` rather than `DELETE`: the action is not "delete a named
  resource" (ADR-0046's honest `DELETE` framing) but "perform an action with a
  side-effect" (end this process) — the standard HTTP idiom for a command-style
  RPC-lite action with no natural resource noun. Unlike `DELETE
  /api/whats-next`, there is no artifact being named by the client at all; `POST`
  says "do the one thing this route does," which is exactly the endpoint's whole
  contract.
- **No request body, no client-supplied path — mirrors `whats-next-delete.mjs`
  exactly.** The handler reads nothing from `req`. The one file it ever touches
  (`.agentheim/.dashboard/runtime.json`) is resolved entirely server-side, through
  `runfile.mjs`'s own hardcoded `path.join(root, '.agentheim', '.dashboard',
  'runtime.json')` — there is no path parameter to validate because none is ever
  accepted, the same "absence of a parameter is the guard" posture ADR-0046 chose
  over a client-supplied path.
- **Dispatch placement.** `server.mjs` dispatches `POST /api/stop` **before** the
  `if (req.method !== 'GET' && req.method !== 'HEAD') return 405` gate — in the
  same spot as `GET /api/events` and `DELETE /api/whats-next` above it — so the
  gate still rejects every *other* non-GET method, including any other method on
  `/api/stop` itself. (`GET /api/stop`, having no matching GET route, falls
  through to the ordinary unmatched-route `404`, not a `405` — the gate does not
  reject GET, it simply has nothing to route it to; this is the same shape a GET
  on any other write-only route would show.)

### 2. The load-bearing ordering constraint: respond before you die

`stopDashboard(root)` (`launch.mjs`) works by **pid termination**:
`terminate(rf.pid)` then `deleteRunfile(root)`. Called from *inside* the server
handling the request, `rf.pid === process.pid` — the handler would be asking the
process to kill **itself**, mid-response. If the runfile were removed and the
process exited before the HTTP response finished flushing to the socket, the
browser's `fetch` would see a dropped connection (a network error, not a
resolved response with a status code), and the "Dashboard stopped" overlay —
which the client only shows on a **truthful `res.ok`** — would never render. The
handler is therefore ordered strictly:

```
res.writeHead(204);
res.on('finish', () => {
  deleteRunfile(root);
  exit(0);
});
res.end();
```

`res.end()` is called, but nothing destructive happens until Node's own
`'finish'` event fires — the signal that the response has been fully handed off
to the underlying transport. Only then is the runfile removed and the process
exited. `dashboard/test/stop-api.test.mjs` pins this ordering with a
controllable fake `res` and proves that neither the runfile removal nor the exit
call happens before `finish` fires — an implementation that kills the pid (or
even just calls `exit`) before the response is flushed fails that test
immediately (verified during implementation: a deliberately kill-first variant
was run against the test and failed exactly as expected, before being reverted).

### 3. Implementation choice: a dedicated in-process path, not `stopDashboard(root)` reuse

Two implementation options were on the table (recorded as the worker's open
sub-question in the task):

- **(A) Reuse `stopDashboard(root)` wholesale** — one implementation shared with
  the CLI/skill path, but the in-process call becomes a process asking the OS to
  signal *itself* (`process.kill(process.pid)`), then falling through
  `terminate()`'s cross-platform branches (a POSIX signal path, plus a Windows
  `taskkill /PID … /F /T` subprocess fallback) that exist to handle killing an
  **external, possibly-stubborn** process — none of which apply to a process
  ending itself cleanly.
- **(B) A dedicated in-process path** — `deleteRunfile(root)` + `process.exit(0)`,
  with no `terminate()`/`process.kill`/`taskkill` involved at all.

**Chosen: (B).** A process asking the OS to deliver it a signal, when it can just
call `process.exit()` directly, is unnecessary indirection with real downside:
`terminate()`'s Windows fallback shells out to `taskkill`, a subprocess spawn
that would itself need to complete *before* the original process could safely
exit — directly in tension with §2's already-tight ordering requirement.
`process.exit(0)` is synchronous, requires no subprocess, and ends the process
(and every open socket/handle with it) unconditionally the instant it is called
— exactly the "stop, now" semantics the UI's single click promises. `server.close()`
was considered as an additional step before `process.exit(0)` (a "graceful
drain") and **rejected**: it would wait on any still-open connections (notably
any live `GET /api/events` SSE stream) before its callback fires, which
contradicts the UI's expectation of an immediate stop, and is moot anyway since
`process.exit()` terminates every open socket regardless of what `close()` was
doing. `stopDashboard(root)` in `launch.mjs` is **unchanged** and keeps owning
the out-of-process case (the CLI, the `/dashboard stop` skill invocation, where
`terminate()`'s cross-platform pid-kill branches are exactly the right tool
because the target process is a **different** process the caller cannot simply
`exit()`).

Both paths **do** still remove the runfile — the split is honest per the task's
constraint: `stop-api.mjs`'s `handleStop` calls `deleteRunfile(root)` directly
(the same `runfile.mjs` function `stopDashboard` also calls), so there is exactly
one deletion implementation, just two different processes(-or-not) around it.

### 4. Security surface: CSRF exposure, matched symmetrically to `DELETE /api/whats-next`

`POST /api/stop` on a `127.0.0.1`-bound, single-user dev server is reachable by
CSRF from any page the builder has open in the same browser — no different in
kind from the exposure `DELETE /api/whats-next` already accepts (ADR-0046 §Trust
posture, inherited from ADR-0002's "single-user, localhost-only" scope). Impact
is bounded to stopping a local dev server the builder can trivially relaunch.

**No `Origin`/`Sec-Fetch-Site` check is added to either endpoint.** `DELETE
/api/whats-next` ships today with none; adding one only to `/api/stop` would
leave the two routes asymmetrically guarded for the same class of exposure, which
the task explicitly forbids ("add it to both or neither"). The guards that *are*
already in place — no request body, no client-supplied path, a server-derived
target — are the same guards ADR-0046 relied on, and they remain the whole
defense for both routes. This is recorded as an accepted, bounded risk consistent
with ADR-0002's "single-user, localhost-only, no auth, no network exposure"
scope; a future ADR could add symmetric `Origin` checks to both routes at once if
that scope ever widens.

### 5. What this amends

- **ADR-0017 §"read-only".** ADR-0017's decision text states "the dashboard is
  read-only" and lists the server's contract as reads + SSE + static assets only.
  That framing was already narrowed once, by ADR-0046, to "read-only over
  *lifecycle*, not literally every byte." This ADR narrows it a second, distinct
  way: the dashboard may now also perform a **runtime self-lifecycle** write —
  ending its own process and removing its own runfile — which is neither a
  lifecycle write nor an advisory write, but a third category with its own guard
  rails (§1–§2 above). ADR-0017's actual substance (skills are the sole owners of
  *task* lifecycle transitions) is completely untouched; only its "read-only"
  shorthand gains a second named exception.
- **ADR-0046's "exactly one write" claim.** ADR-0046 (Consequences, Positive)
  states the endpoint it added was "the dashboard's first write since
  ADR-0017" and its own module comment still calls `DELETE /api/whats-next` "the
  dashboard's one scoped write." That claim is now **superseded by count**:
  `POST /api/stop` is a **second** write, and — because it is a different write
  *category*, not a second advisory artifact — it does not extend ADR-0027's
  "one file only" advisory guard rail (§4.1) at all. ADR-0046's own contract
  (the exact-equality allowlist over `whats-next.md`, the advisory guard rails)
  is **completely unchanged**; only the "exactly one write total" framing
  in its prose is corrected to "the first of what are now two, in two different
  categories."
- **aw-028's "the server is never asked to stop itself."** This clause is
  **superseded outright**, not narrowed. aw-028's Notes recorded the seam
  decision as "Option A [a new self-stop endpoint] was rejected precisely
  because it would have demanded an ADR carving process-shutdown out of
  ADR-0017's read-only scope." This ADR is exactly that carve-out, done now
  because the cost of the bridge-reuse seam (session-spawn overhead, and — more
  importantly — the bridge-present/absent asymmetry making Stop non-functional
  in a plain browser tab) outweighs the purity aw-028 was protecting. aw-028's
  task file remains the historical record of why bridge-reuse was chosen at the
  time; this ADR is the record of why it was reversed.

## Consequences

**Positive**

- Stop dashboard is now a single, direct request-response — no spawned Claude
  Code session, no terminal, no bridge round-trip for what is fundamentally two
  syscalls.
- The bridge-present/absent asymmetry aw-028 accepted for Stop is **gone**: the
  control works identically in any browser tab, VS Code Simple Browser or not.
  The post-stop overlay is now **truthful on a 2xx response**, not optimistic on
  a bridge dispatch — a strictly stronger guarantee than aw-028 shipped.
- The runtime self-lifecycle category is named and guard-railed once, available
  for any future "the dashboard ends or reconfigures its own runtime" need
  without re-litigating ADR-0017 from scratch — mirroring how ADR-0027 made the
  advisory category reusable for `in-flight.json` (ADR-0043) without a fresh
  ADR-0017 fight each time.
- `stopDashboard(root)` / `terminate()` / the CLI / the `/dashboard stop` skill
  invocation are **completely unchanged** — the out-of-process kill path most
  needed for a stuck/foreign process stays exactly as robust (POSIX signal +
  Windows `taskkill` fallback) as before.

**Negative**

- The dashboard server is no longer "read-only" in even the ADR-0046-narrowed
  sense (read-only-over-lifecycle, one advisory delete) — it now also carries a
  route whose entire purpose is ending its own process. Mitigated by the route
  being narrowly scoped (no body, no client path, one hardcoded target) and by
  this ADR being the explicit, discoverable record of the narrowing, exactly as
  ADR-0046 was for the first exception.
- Two independent implementations of "stop this dashboard" now exist in the
  codebase (`stopDashboard`/`terminate` in `launch.mjs` for the out-of-process
  case, `handleStop` in `stop-api.mjs` for the in-process case) rather than one.
  Both call the same `deleteRunfile`, so the runfile-removal half never
  diverges; only the "how is the process actually ended" half is duplicated,
  and deliberately so (§3) — a shared `terminate()`-style call would have made
  the in-process case slower and murkier, not simpler.
- CSRF exposure on `POST /api/stop` is accepted, matching `DELETE
  /api/whats-next`'s existing posture (§4) — a future networked/multi-user
  deployment (explicitly out of scope per ADR-0002) would need to revisit both
  routes together.

**Neutral**

- `.agentheim/.dashboard/runtime.json` remains the sole piece of runtime state
  on disk (ADR-0002); this ADR does not add a new artifact, only a new way for
  the existing owner (the dashboard's own launch machinery) to remove it.
- The dashboard's read-only stance **over task lifecycle** (ADR-0017's actual
  substance) is untouched: no task moves, no `status` rewrite, no `INDEX.md`
  count, no `protocol.md` append is reachable from `POST /api/stop`.

## Alternatives considered

- **Keep the bridge-reuse seam (aw-028's original choice), fix only the
  asymmetry by other means** (e.g., degrade Stop to a no-op with a message in a
  bridgeless browser). Rejected: it does not fix the underlying absurdity
  (spawning a session to run two syscalls), and a "Stop" button that sometimes
  can't stop is a worse UX than removing the bridge dependency entirely.
- **Reuse `stopDashboard(root)` wholesale (implementation option A, §3).**
  Rejected in favor of the dedicated in-process path — see §3's full reasoning.
- **`DELETE /api/stop`** (matching ADR-0046's method choice). Considered and
  rejected: `DELETE` names a resource being removed; there is no resource here,
  only an action ("end this process") with no natural noun, which `POST`
  expresses more honestly than forcing a `DELETE` semantics onto a command.
- **Fold `Origin`/`Sec-Fetch-Site` checks into this endpoint only.** Rejected
  per the task's explicit instruction and §4's reasoning: it would leave
  `DELETE /api/whats-next` and `POST /api/stop` asymmetrically guarded against
  the identical class of exposure, for no principled reason tied to either
  route's actual risk.
- **Fold "stop" into the existing `applyTaskMove`/lifecycle write path or a
  generic mutation endpoint.** Never seriously on the table — that is precisely
  the lifecycle-write reopening ADR-0017 forbids and ADR-0046 was careful not to
  do; runtime self-lifecycle is a *different* category by construction, not a
  relaxation of the lifecycle one.
