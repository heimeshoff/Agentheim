---
id: agentic-workflow-vmk1z
title: Dismissing the What's next panel deletes its advisory artifact
status: done
type: feature
context: agentic-workflow
created: 2026-07-04
completed: 2026-07-04
depends_on: []
blocks: []
tags: [dashboard, whats-next, advisory-write, advisory-delete, frontend]
related_adrs: [0046, 0027, 0017, 0006]
related_research: []
prior_art: [agentic-workflow-073, agentic-workflow-076, agentic-workflow-m9w5c]
---

## Why
The `whats-next` recommendation (`.agentheim/state/whats-next.md`) goes stale fast — the
board changes and yesterday's recommended move is no longer the right one. Today the panel's
**dismiss** is only a client-side `localStorage` hide keyed by the artifact's `generated`
stamp (aw-073): the file stays on disk, so the stale recommendation lingers and re-surfaces
in other browsers / after a store reset. The builder wants dismiss to actually **remove the
stale thing** — press dismiss, the recommendation is gone, not just hidden.

## What
When the builder dismisses the What's next panel on the dashboard, the underlying advisory
artifact `.agentheim/state/whats-next.md` is **deleted from disk** (not merely suppressed in
`localStorage`), so a dismissed recommendation is genuinely gone — across browsers, across
store resets — until `whats-next` next runs and writes a fresh one.

The direction is settled by **ADR-0046** (ratified this same refinement round): the dashboard
gains its first write since ADR-0017 — a narrow, delete-only, advisory-only endpoint
`DELETE /api/whats-next` that can remove that one literal file and nothing else. This is a
bounded exception to ADR-0017 (whose read-only stance is over *lifecycle*, which this does not
touch) and a narrowing amendment to ADR-0027 §4.5. See ADR-0046 for the full contract.

## Decision
Settled — no separate decision task needed. **ADR-0046** is the decision:
`DELETE /api/whats-next`, no request body, no client-supplied path, exact-equality allowlist
over the one resolved absolute path, idempotent (already-absent → success), zero lifecycle
side-effects, panel disappears through the existing SSE mechanism, `localStorage` dismiss store
retired. This feature task proceeds straight to `todo/` once refined.

## Acceptance criteria

### Server — the delete endpoint
- [ ] `dashboard/server.mjs` dispatches `DELETE /api/whats-next` **before** the existing
      `if (req.method !== 'GET' && req.method !== 'HEAD') return 405` gate (placed beside the
      `GET /api/events` block, which already sits above that gate). A test asserts the route is
      reachable via `DELETE` and that the `405` gate still rejects other non-GET methods
      (including any other method on `/api/whats-next`) unchanged.
- [ ] The handler takes **no** `?path=` query parameter and reads **no** request body: the
      target path is derived server-side from the hardcoded constant
      `.agentheim/state/whats-next.md` through `resolveInRoot(root, …)`.
- [ ] On success (file existed and was removed) the endpoint returns **`204 No Content`**.
- [ ] **Idempotency:** deleting an already-absent file returns success (`204`), never `404`.
      A repeat `DELETE` (delete twice in a row) also returns `204`. A test covers both.
- [ ] A genuine non-`ENOENT` filesystem failure returns `500` (not `204`), and deletes nothing.

### Server — the allowlist guard (unit-tested)
- [ ] The handler compares the resolved target against a **precomputed allowed absolute path
      by exact string equality** (`target === ALLOWED`), never a prefix/glob match, before any
      `unlink`.
- [ ] A unit test proves the guard: any attempt to make the handler delete anything other than
      the exact `state/whats-next.md` path is rejected and deletes nothing — **explicitly
      including an attempt aimed at the sibling advisory artifact
      `.agentheim/state/in-flight.json`** (a prefix match on `state/` would have matched it; the
      exact-equality check must not), and including any `contexts/`-lifecycle path. After the
      full test run, `state/in-flight.json` (if present) is verifiably untouched.
- [ ] A test asserts the in-root traversal guard (`resolveInRoot`) is still exercised on the
      resolved constant (defense-in-depth even though no client path is supplied).

### Client — rewire dismiss
- [ ] `dashboard/app/board.js`'s `WhatsNextPanel` dismiss handler (`onDismiss`) is rewired to
      call `DELETE /api/whats-next` **instead of** `saveDismissed(...)`. On click it also clears
      the local panel body optimistically (`setBody(null)`) so the panel vanishes immediately;
      disk convergence (unlink → SSE → `404` fetch → renders nothing) is the durable truth
      behind that optimistic hide.
- [ ] The panel disappears **live** via the existing SSE `tree-changed` mechanism (ADR-0006)
      once the file is gone: the panel's re-fetch on the frame now `404`s and renders nothing,
      reusing aw-073's already-shipped "absent artifact renders nothing" contract. No new client
      state-sync path is introduced.
- [ ] The `localStorage` dismiss store is **retired entirely**: `loadDismissed`,
      `saveDismissed`, `isDismissed`, `WHATS_NEXT_KEY`, and `WHATS_NEXT_VERSION` are removed
      from `dashboard/app/whats-next-state.js`, and their imports/usages in `board.js`
      (`isDismissed(storage, generated)` gate, the `force`/`generatedStamp`-for-dismiss
      plumbing) are removed. `WHATS_NEXT_DOC_PATH`, `splitWhatsNextSections`, and
      `formatStaleness` remain (still used by the render path). Their existing unit tests are
      updated to drop the retired-store cases while keeping the pure-helper coverage.

### Tests / build / regression
- [ ] Pure helpers and any new pure server-side logic are unit-tested under
      `node --test lib/test/*.test.mjs` (and the dashboard's own test layout for the endpoint
      handler + allowlist).
- [ ] The dashboard `dist/` is rebuilt via esbuild after the `board.js` / `whats-next-state.js`
      changes.
- [ ] The full existing suite stays green (no regression to `/api/doc`, `/api/tree`,
      `/api/events`, `/api/bridge`, `/api/search`, or the `405` gate behavior).

## Notes
- This task went through an **architect round** (routed via the orchestrator per ADR-0035),
  which produced and ratified **ADR-0046** as the settled decision — so this stays a single
  feature task with no separate blocking decision sub-task; it can proceed straight to `todo/`.
- **Endpoint contract chosen:** `DELETE /api/whats-next` — truthful method, idempotent,
  dispatched before the `405` gate; **no client-supplied path** (the server alone knows the one
  file — stronger than `/api/doc`'s client-named path); **exact-equality allowlist** over the
  one resolved absolute path (a prefix match on `state/` was rejected precisely because it would
  also match `in-flight.json`); `204` success; already-absent is success, never `404`; zero
  lifecycle side-effects (an advisory artifact has no `INDEX.md`/`protocol.md`/backlink
  bookkeeping).
- **localStorage call:** the dismiss store is **retired entirely**, not kept as
  defense-in-depth. Once the file is really deleted, an absent file already renders nothing and
  a fresh `whats-next` run has no prior dismissal to consult; the only remaining race
  (delete-in-flight vs. a stale cached fetch) is covered by the optimistic local hide plus SSE
  convergence, so the store guards nothing and would only be dead state keyed to a `generated`
  stamp that names no file.
- **ADR-0027 §4.5** is the only guard rail amended (before/after wording in ADR-0046); guard
  rails 1, 2, 3, 4, 6 are untouched, and ADR-0043 §5.5 (dashboard read-only over
  `in-flight.json`) stays fully intact — the allowlist makes touching `in-flight.json`
  unreachable.
- **Two implementation nits flagged by the architect** (not blockers): (a) `204 No Content` vs
  a `200 {deleted:true}` body is a free swap if the worker/reviewer prefers symmetry with
  `handleBridge`; (b) confirm the ADR-0006 recursive watcher actually emits `tree-changed` on
  file **removal** (not just create/overwrite) — if it doesn't, the optimistic local hide still
  covers the single-browser outcome and cross-browser convergence falls to the next natural
  re-fetch. Resolve inline during implementation.

## Outcome

Implemented exactly per ADR-0046. `dashboard/whats-next-delete.mjs` (new) exports the constant
`WHATS_NEXT_RELATIVE_PATH`, the pure guard `assertWhatsNextTarget(root, relativePath = WHATS_NEXT_RELATIVE_PATH)`
(resolves through `resolveInRoot`, then asserts **exact string equality** against the
precomputed allowed absolute path — the `relativePath` parameter exists only so the guard is
adversarially unit-testable, since production callers never supply one), and the HTTP handler
`handleWhatsNextDelete` (`204` on delete, `204` on already-absent/ENOENT, `500` on any other
fs failure, deleting nothing in that case). `dashboard/server.mjs` dispatches `DELETE
/api/whats-next` beside the existing `GET /api/events` block, above the `405` gate, so the
gate still rejects every other non-GET method (including other methods on the same route)
unchanged.

`dashboard/app/board.js`'s `WhatsNextPanel.onDismiss` now does `setBody(null)` (optimistic
hide) then `fetch("/api/whats-next", { method: "DELETE" })`; the `isDismissed`/`saveDismissed`
gate and the `force` re-render plumbing are gone. `dashboard/app/whats-next-state.js` had
`loadDismissed`/`saveDismissed`/`isDismissed`/`WHATS_NEXT_KEY`/`WHATS_NEXT_VERSION` removed
entirely; `WHATS_NEXT_DOC_PATH`, `splitWhatsNextSections`, and `formatStaleness` are unchanged.

Also flipped ADR-0046's frontmatter `status` from `proposed` to `accepted` (the refine round
had already ratified it; implementing it is the natural trigger).

Tests: new `dashboard/test/whats-next-delete.test.mjs` (12 tests) covers the exact-equality
allowlist (explicitly proving an attempt aimed at `.agentheim/state/in-flight.json` is
rejected and the file stays untouched, plus a `contexts/`-lifecycle path and the traversal
guard), the `204`/idempotency/`500` contract, dispatch-before-405-gate, the 405 gate's
continued rejection of other methods, and that a supplied `?path=`/body changes nothing.
`whats-next-state.test.mjs` was trimmed to the two remaining pure helpers plus a guard test
asserting the retired exports are gone. `whats-next-panel.test.mjs` was updated to assert the
new dismiss wiring and the absence of the retired store calls. Full dashboard suite: 729/729
passing (`cd dashboard && node --test`). Root lib suite: 183/183 passing (`node --test
lib/test/*.test.mjs`). `dashboard/dist/` rebuilt via `node build.mjs`.

Key files:
- `dashboard/whats-next-delete.mjs` (new)
- `dashboard/server.mjs`
- `dashboard/app/board.js`
- `dashboard/app/whats-next-state.js`
- `dashboard/test/whats-next-delete.test.mjs` (new)
- `dashboard/test/whats-next-state.test.mjs`
- `dashboard/test/whats-next-panel.test.mjs`
- `dashboard/dist/` (rebuilt)
- `.agentheim/knowledge/decisions/0046-dashboard-scoped-advisory-delete-on-dismiss.md` (status → accepted)
- `.agentheim/contexts/agentic-workflow/README.md` (WhatsNextPanel + no-write-path sections)
