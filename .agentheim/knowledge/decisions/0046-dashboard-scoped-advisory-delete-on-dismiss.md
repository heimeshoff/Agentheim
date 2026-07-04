---
id: ADR-0046
title: The dashboard may perform one scoped advisory write — deleting the whats-next recommendation on explicit dismiss
scope: agentic-workflow
status: proposed
date: 2026-07-04
related_tasks: [agentic-workflow-vmk1z]
related_adrs: [0017, 0027, 0006, 0043, 0021]
---

# ADR-0046: The dashboard may perform one scoped advisory write — deleting the `whats-next` recommendation on explicit dismiss

## Context

ADR-0017 removed the dashboard's last write path (`POST /api/task/move`) and made
the server read-only. Its substance — stated in its own Context — is about
**lifecycle** ownership: "skills are the sole owners of task-lifecycle
transitions." A lifecycle write moves a task between folders, rewrites its
`status`, updates the BC `INDEX.md`, appends to `protocol.md`, and reconciles ADR
backlinks. ADR-0017 forbids the dashboard from owning *that*, not literally every
byte on disk.

ADR-0027 named a second, narrower write category — an **advisory write** — for the
`whats-next` skill's single artifact `.agentheim/state/whats-next.md`: "an opinion
*about* the state, not a change *to* it," recording no transition, driving no board
projection, with nothing in the lifecycle depending on it. Its §4 guard rails keep
"advisory" from becoming a lifecycle backdoor. ADR-0043 extended the category to a
second artifact, `.agentheim/state/in-flight.json`, written by Claude Code hooks —
establishing that the advisory category can hold more than one member, each behind
its own decision.

Two of ADR-0027's guard rails are relevant here:

> 5. **The dashboard is read-only over it too.** The dashboard reads and renders
>    it; it never writes, edits, or deletes it. Only `whats-next` writes it.

and ADR-0043 §5.5 restates the identical stance for `in-flight.json` ("The dashboard
is read-only over it too — reads and renders, never writes").

The `whats-next` recommendation goes stale fast: the board changes and yesterday's
recommended move is no longer the right one. Today the panel's **dismiss** (aw-073)
is only a client-side `localStorage` hide keyed by the artifact's `generated`
stamp — the file stays on disk, so the stale recommendation lingers and re-surfaces
in other browsers or after a store reset. The builder has decided, explicitly, that
dismiss must **remove the stale artifact**, not hide it: "press dismiss, the
recommendation is gone, not just hidden." That collides head-on with ADR-0027 §4's
fifth guard rail. This ADR settles how to give the dashboard that one narrow delete
without reopening what ADR-0017 closed.

The collision is only apparent — the same shape ADR-0027 already resolved for the
*write*. Deleting an advisory artifact touches no lifecycle truth: no task moves, no
`status` changes, no `INDEX.md` count shifts, no `protocol.md` grows, no backlink
reconciles. It removes an opinion, not a transition. What is missing is a bounded
exception to §4.5 and a concrete, airtight endpoint contract.

## Decision

**The dashboard gains exactly one write: a delete-only, advisory-only endpoint that
removes `.agentheim/state/whats-next.md` — and only that literal file — when the
builder explicitly dismisses the What's-next panel. This is a bounded exception to
ADR-0017 (whose read-only stance is over *lifecycle*, which this does not touch) and
a narrowing amendment to ADR-0027 §4's fifth guard rail. Nothing else about either
ADR changes.**

### 1. The endpoint: `DELETE /api/whats-next`

The endpoint is **`DELETE /api/whats-next`** — no request body, no query
parameters, no client-supplied path.

- **Method.** `DELETE` states the operation honestly: this route can do exactly one
  thing, remove a named resource. HTTP `DELETE` is defined idempotent, which is
  precisely the semantics we want (§4 below). This is the first non-GET route the
  read-only server carries since ADR-0017; setting the precedent with the truthful
  method — rather than a `POST /api/whats-next/dismiss` RPC — keeps the transport
  from leaking a UI verb ("dismiss") into the wire contract and keeps the route's
  capability legible from its method alone.
- **No client-supplied path — the strongest possible guard.** Unlike `/api/doc`,
  which takes a `?path=` the client names, this endpoint takes **no path input at
  all**. The server alone knows the one file it may delete. There is therefore no
  attacker-controlled string to traverse with: the primary defense is the *absence*
  of a path parameter, not a filter over one.
- **Dispatch placement.** `server.mjs` has a hard gate at the top of the dispatcher:
  `if (req.method !== 'GET' && req.method !== 'HEAD') return 405`, placed before the
  read routes. A `DELETE` route must be dispatched **before** that gate — exactly as
  the method-specific `GET /api/events` block already sits above it. The new route
  slots in beside `/api/events`, guarded by `pathname === '/api/whats-next' &&
  req.method === 'DELETE'`, so the 405 gate still rejects every *other* non-GET
  method (including any other method on `/api/whats-next`) unchanged.

### 2. Airtight scoping: no path input, plus an exact-equality allowlist assertion

Even though the client names no path, the handler is written so it can *only ever*
resolve to the one allowed file, and asserts that before touching the filesystem:

1. The handler computes the target from a hardcoded constant, through the same
   in-root validator every read uses:
   `const target = resolveInRoot(root, '.agentheim/state/whats-next.md')`
   (`resolveInRoot` = `path.resolve` + separator-aware `startsWith(root)` traversal
   guard, `dashboard/discovery.mjs`).
2. It then compares `target` against a precomputed allowed absolute path by **exact
   string equality** — `target === ALLOWED` — never a prefix or glob match. This is
   deliberate: a prefix match against `.agentheim/state/` would also match
   `state/in-flight.json`, which is exactly what must never happen. An exact-equality
   check against one precomputed absolute path can only ever authorize the single
   file `whats-next.md`.
3. Only if that assertion holds does it `unlink`. If it ever fails (only reachable
   via a future refactor bug, since there is no client path today), it deletes
   nothing and returns `500` — a programming error, not a client error.

The endpoint therefore can never delete a lifecycle file, never anything under
`contexts/`, and — critically — never the sibling advisory artifact
`state/in-flight.json`. The absence of a path parameter makes this true; the
exact-equality assertion keeps it true under refactoring.

### 3. No request body, no lifecycle side-effects — and why

The handler reads no body and performs **no** lifecycle bookkeeping: no `INDEX.md`
edit, no `protocol.md` append, no ADR backlink reconciliation, no task move. This is
not an omission — an advisory artifact *has* no lifecycle bookkeeping. Those
side-effects exist to keep lifecycle truth consistent when a task transitions
(ADR-0017/ADR-0007); an advisory artifact records no transition and nothing in the
lifecycle reads it (ADR-0027 §4.3, ADR-0043 §5.3), so there is nothing to keep
consistent. Deleting it is a single `unlink` and nothing more. This is exactly why
the exception is bounded and safe rather than a reopening of the lifecycle-write ban.

### 4. Idempotent: already-absent is success, never `404`

`DELETE /api/whats-next` returns **`204 No Content`** on success, and treats a
missing file as success (also `204`), never `404`. Deleting an already-deleted
recommendation is a normal, expected outcome — two browsers dismissing the same
recommendation, or a dismiss racing a `whats-next` re-run — and "absence is a normal
outcome" is the pattern the codebase already uses (`handleBridge` returns `200` for
an absent bridge file; `useLiveTree`/the panel render nothing for an absent
artifact). A genuine non-`ENOENT` filesystem failure (e.g. permissions) is a real
error and returns `500`.

### 5. The board stays a total projection of disk — no new client state-sync

The delete **is** the write; the panel disappearing is a consequence of disk truth
changing, observed through the machinery already in place. When the file is
unlinked, the recursive watcher (ADR-0006) fires an SSE `tree-changed` frame; the
panel's existing re-fetch on that frame now `404`s and renders nothing — reusing
aw-073's already-shipped "absent artifact renders nothing" contract verbatim. No new
client synchronization path is invented. The client additionally clears its local
panel body optimistically on the dismiss click (set to `null`) so the panel vanishes
immediately without waiting for the round-trip; disk convergence (unlink → SSE →
`404` fetch → nothing) is the durable truth behind that optimistic hide.

### 6. Retire the `localStorage` dismiss store entirely

The `loadDismissed` / `saveDismissed` / `isDismissed` store in `whats-next-state.js`
(with `WHATS_NEXT_KEY` and `WHATS_NEXT_VERSION`), keyed by the `generated` stamp, is
**removed**. It existed (aw-073) to solve one problem the dashboard could not
otherwise solve: hide a stale recommendation *without deleting it*, keyed so a newer
write (a different `generated`) re-shows. Once dismiss actually deletes the file that
problem no longer exists:

- After delete, the next `/api/doc` fetch `404`s → the panel renders nothing. No
  client-side suppression is needed to hide it.
- A later `whats-next` run writes a fresh file → the panel shows it. There is no
  stored dismissal to consult, so no stale dismissal can ever mis-hide a fresh
  recommendation.
- The one remaining edge — a delete-request-in-flight racing a stale cached fetch —
  is covered by the optimistic local `setBody(null)` on click (§5) plus SSE
  convergence, **not** by a persisted store. Keeping the `localStorage` layer would
  be a net liability: a dismissal persisted against a `generated` stamp that no
  longer names any file is dead state that a future run could only ever mis-consult.

Retiring it is the honest consequence of moving the source of truth from
localStorage back onto disk. The pure helpers `splitWhatsNextSections` and
`formatStaleness`, and the constant `WHATS_NEXT_DOC_PATH`, stay — they are still used
by the render path.

### 7. Precisely which ADR-0027 clause is amended

Guard rail **§4.5** is the only clause touched.

- **Before (verbatim):** "5. **The dashboard is read-only over it too.** The
  dashboard reads and renders it; it never writes, edits, or deletes it. Only
  `whats-next` writes it."
- **After:** "5. **The dashboard is read-only over it too, with one scoped
  exception.** The dashboard reads and renders it, and never edits, appends to, or
  partially rewrites it. It may perform exactly one write: on an explicit user
  dismiss it may **delete the whole `state/whats-next.md` file** — and no other file
  (ADR-0046). Only `whats-next` ever *creates or overwrites* it; the dashboard's
  only capability over it is whole-file deletion on dismiss."

Every other §4 guard rail is **untouched and still holds**:

1. **One file only** — still exactly `state/whats-next.md`; this adds a capability
   over that same one file, not a new artifact.
2. **Overwritten, never appended** — unchanged; the dashboard cannot append, only
   whole-file-delete. `whats-next` still overwrites.
3. **No lifecycle dependency on its content** — unchanged, and the delete relies on
   this (§3): nothing in the lifecycle reads the file, so removing it cannot perturb
   the board.
4. **Frontmatter descriptive, not load-bearing** — unchanged; the delete reads no
   frontmatter (it names no `generated`, no `?path`).
6. **`whats-next` writes nothing else** — unchanged; this ADR constrains the
   *dashboard*, not the skill.

ADR-0043 §5.5 (the dashboard is read-only over `in-flight.json`) is **fully intact**:
the new endpoint's exact-equality allowlist (§2) makes it impossible for the delete
to touch `in-flight.json` or any file but `whats-next.md`. The dashboard remains
strictly read-only over `in-flight.json`.

## Consequences

**Positive**

- Dismiss does what the builder asked: the stale recommendation is genuinely gone —
  across browsers, across store resets — until `whats-next` writes a fresh one. The
  failure mode aw-073's localStorage hide left open (a dismissed-but-present file
  re-surfacing elsewhere) is closed at the source.
- The exception is provably narrow: no client-supplied path, an exact-equality
  allowlist over one precomputed absolute path, and a delete-only method. There is no
  reachable code path from this endpoint to any lifecycle file or to the sibling
  advisory artifact.
- The board stays a total projection of disk. The panel vanishes through the
  existing SSE + `404`-renders-nothing machinery (ADR-0006 / aw-073); no new
  client-side truth is invented, and the `localStorage` dismiss store — a second,
  now-redundant source of truth — is retired, shrinking client state.
- The advisory-write vocabulary (ADR-0027/0043) gains a matching *delete* verb with
  the same guard-rail rigor, available to reason about for any future advisory
  artifact without re-litigating ADR-0017.

**Negative**

- The read-only server is no longer literally read-only: it carries its first
  mutating route since ADR-0017. Mitigated by the route being delete-only,
  path-input-free, and scoped to one file by exact equality — but "the dashboard
  never writes" is now "the dashboard writes exactly one delete," a nuance future
  readers must carry. This ADR and the amended §4.5 are that nuance's home.
- A new HTTP method (`DELETE`) enters the dispatcher, which must be threaded before
  the 405 gate. A careless later edit that moves the gate above it would silently
  turn the delete into a 405; the acceptance criteria pin a test on the method +
  dispatch order to catch that.

**Neutral**

- Disk remains the single source of truth. Previously the dismiss decision lived in
  per-browser localStorage; now it lives on disk as the file's presence/absence —
  which is the more honest home for "is there a current recommendation."
- The endpoint carries no body and returns `204`; it is the smallest possible
  mutation surface.

## Alternatives considered

- **Direction B — no dashboard write; kill staleness some other way** (e.g. an
  auto-hide past a staleness threshold, or `whats-next` self-expiring its file).
  **Rejected** — the builder explicitly locked the delete-on-dismiss behavior ("I'm
  very sure I wanted to delete it on dismissal, not auto-hide it"). Auto-hide leaves
  the stale file on disk (the exact aw-073 problem), and a self-expiring skill can't
  observe a dismiss it isn't running for. Recorded only as the rejected direction.
- **A generic `POST /api/task/move`-style mutation endpoint.** **Rejected** — that
  is precisely the write path ADR-0017 removed; a general mutation route reopens
  lifecycle-write ownership on the dashboard, which this ADR is careful *not* to do.
  The endpoint here is delete-only, single-file, and lifecycle-inert by construction.
- **Fold the delete into `/api/doc` via a query flag** (e.g. `DELETE
  /api/doc?path=…` or `/api/doc?path=…&delete=1`). **Rejected** — `/api/doc` is the
  read carrier and takes a *client-supplied* path; giving it delete power would force
  the allowlist to live inside the general body carrier and reintroduce exactly the
  attacker-controlled-path surface a dedicated route eliminates. A distinct
  `DELETE /api/whats-next` with no path parameter is strictly safer and keeps read
  and write on separate routes with separate capabilities.
- **`POST /api/whats-next/dismiss` (RPC-style).** **Rejected** — leaks the UI verb
  "dismiss" into the transport and hides an idempotent delete behind a POST. `DELETE`
  states the capability truthfully and gets idempotency semantics for free.
- **Keep the `localStorage` dismiss store as defense-in-depth.** **Rejected** (§6) —
  once the file is really deleted the store guards nothing: an absent file already
  renders nothing, a fresh file has no prior dismissal to consult, and the in-flight
  race is covered by an optimistic local hide plus SSE convergence. A dismissal
  persisted against a `generated` stamp that no longer names any file is dead state,
  not a safety net.
