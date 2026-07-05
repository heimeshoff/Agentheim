---
id: ADR-0015
title: Board per-column view-state (group + sort + collapse) persists in versioned localStorage
scope: agentic-workflow
status: proposed
date: 2026-06-09
related_tasks: [agentic-workflow-014, agentic-workflow-012, agentic-workflow-006, agentic-workflow-qf945, agentic-workflow-c2ver]
related_adrs: [ADR-0009, ADR-0001, ADR-0002]
---

# ADR-0015: Board per-column view-state persists in versioned `localStorage`

> An ADDENDUM to ADR-0009. It REVERSES one clause of ADR-0009 — "in-session
> view-state only — no localStorage, so every load resets to the default" — and
> supersedes the matching "in-session view-state only, no `localStorage`" clause of
> agentic-workflow-012 (column sort). It does NOT reopen aw-012 (done, frozen) and
> changes no other clause of ADR-0009 (the app still lives in `dashboard/app/`,
> still consumes the styleguide unmodified, ADR-0003).

> **Amended 2026-07-05 (agentic-workflow-qf945).** REVERSES the *scope* of the view
> lens from per-column to **board-wide**: sort and group-by-BC are no longer chosen
> independently per lifecycle column — the board redesign
> ([[agentic-workflow-c2ver]]) collapses them into a single board-wide "View" chip
> that drives all four columns identically. This ADR **stays `status: proposed`**
> and gains **no `supersedes`/`diverges_from` clause and no new ADR number** — the
> repo convention (ADR-0021) reserves supersession for `accepted` ADRs; a still-
> `proposed` ADR is amended in place instead, at lower ceremony, per the precedent
> of infrastructure-015 amending the still-`proposed` ADR-0018 in the same document
> via a dated banner. The reversal is **scoped to the sort + group-by-BC choice
> only** — per-`(column, BC)` `collapsed[]` sections and the Done column's `peek`
> boolean (agentic-workflow-m2v8d) stay column-scoped exactly as before; only the
> *lens* goes board-wide. See the rewritten Decision bullet below ("Board-wide lens,
> column-scoped collapse/peek") for the new store shape and migration semantics.

## Context
agentic-workflow-014 adds a per-column **group-by-bounded-context** lens to the
board, with independently **collapsible** per-BC sections. Grouping is only useful
if it survives a reload — a lens you must re-apply on every page load is noise, not
a tool. The same is true of the column **sort** (aw-012), which until now reset to
the default on every load. ADR-0009 deliberately chose in-session-only view-state
for the original board; that choice predates any board control rich enough to be
worth keeping.

The risk a persistence reversal raises: a stored client preference becoming a
SECOND source of truth about the board's content, competing with disk (ADR-0001:
disk is the source of truth, the board is a projection rebuilt from it).

## Decision
- **Board-wide lens, column-scoped collapse/peek** (amended 2026-07-05,
  agentic-workflow-qf945; supersedes the original "per-column view lens" bullet
  below it). The board's **view lens** — `{ grouped, sort }` — is no longer chosen
  independently per lifecycle column: it is **one object for the whole board**,
  persisted alongside a **retained per-column** collapse/peek map, in the same
  **single versioned `localStorage` store**
  (`dashboard/app/board-view-state.js`, key `agentheim.board.viewState`,
  `VIEW_STATE_VERSION` bumped to `2`):

      {
        version: 2,
        lens: { grouped: boolean, sort: SortValue },        // board-wide, ONE per board
        columns: {                                          // one entry per lifecycle column
          [col]: { collapsed: string[], peek: boolean }     // per-(column, BC) + Done peek, UNCHANGED
        }
      }

  Only the sort + group-by-BC **choice** goes board-wide. The per-`(column, BC)`
  `collapsed[]` section state and the Done column's `peek` collapse/peek boolean
  (agentic-workflow-m2v8d) are **not** swept into the board-wide lens — they stay
  exactly as column-scoped as before this amendment, just re-homed under `columns`
  instead of alongside a per-column `grouped`/`sort`.

  **Dormant retention, not clearing.** Toggling the board-wide `grouped` flag off
  then back on does **not** clear a column's stored `collapsed[]`: a column's
  per-BC collapse state goes dormant (unused while the board is flat) and
  reappears intact once grouping is re-enabled. This holds board-wide or
  per-column, because a column's BC-section set depends only on which BCs have
  cards in that column, never on sort order — grouping only partitions the
  already-sorted list and never re-orders it (confirmed sort-invariant by the
  tactical-modeler).

  **Versioned-migration semantics.** `VIEW_STATE_VERSION` bumps to `2`. The old v1
  shape (`{ version: 1, columns: { [col]: { grouped, sort, collapsed, peek } } }`)
  is retired: a blob with any version other than `2` — including absent or
  malformed JSON — degrades to **board-wide defaults** (`lens` = flat + default
  sort; every column = empty `collapsed[]`, `peek: false`) and **never throws**,
  inheriting this ADR's own "a version bump silently discards old preferences
  (safe reset)" consequence and the existing `normalizeColumn`-style defensive-
  default precedent. No field-by-field migration of old per-column sort/grouped
  values is attempted — this is a deliberate hard reset, not a lossy-but-best-
  effort carry-forward. The storage key (`agentheim.board.viewState`) is reused
  unchanged; the version bump alone invalidates old blobs.

  The store rewrite that implements this shape (`dashboard/app/board-view-state.js`
  v1→v2, splitting `normalizeColumn` into a board-lens normalizer and a leaner
  per-column normalizer) and the board-wide `ViewChip` UI are built by
  [[agentic-workflow-c2ver]], which depends on this decision.

- ~~The board's **per-column view lens** — `{ grouped, sort, collapsed[] }` per
  lifecycle column — is persisted in a **single versioned `localStorage` store**
  (`dashboard/app/board-view-state.js`, key `agentheim.board.viewState`,
  `VIEW_STATE_VERSION`). One store covers grouping, sort, AND each `(column, BC)`
  collapse state; the sort flip rides the same store rather than spawning an
  artificial store-first dependency.~~ *(superseded by the bullet above — retained
  struck-through for history; the original per-column scope is what the
  2026-07-05 amendment reverses.)*
- The reversal is **bounded to PRESENTATION view-state**. The store records only how
  you LOOK at the board (grouped/flat, ordering, which sections are collapsed). It
  NEVER records lifecycle truth — which task is in which column remains a pure
  projection of `/api/tree`, re-fetched on every SSE `tree-changed` frame and on
  reconnect (ADR-0001/0002). Persisting a lens is not a second source of truth about
  content.
- **Re-applied, never reset, on re-projection.** Because grouping/sort are DERIVED
  at render from React view-state (not baked into the fetched data), every live
  re-projection re-applies the current lens. The persisted state seeds that React
  view-state on mount.
- **Defensive defaults.** A column with no stored state — including a brand-new
  bounded context appearing in the tree — defaults to **flat + default sort +
  all-expanded**. A stale-version, malformed, or absent blob degrades to "every
  column defaults" rather than throwing: a corrupt preference must never blank the
  board (mirrors board-data's malformed-status guard).
- **Pipeline order unchanged:** project (`treeToColumns`) → sort (`board-sort.js`)
  → group (`board-group.js`). Grouping consumes the already-sorted list and only
  partitions it, so sort semantics (name/mod-date, id tie-break, null-mtime-oldest)
  are preserved inside every section.

## Consequences
- A builder's chosen lens (e.g. "group `done` by BC, sort by name") survives reloads
  and live updates, restoring per-BC legibility without abandoning the flat board.
- The store and both transforms (`board-group.js`, `board-view-state.js`) are pure
  and unit-tested under `node --test` with no DOM, keeping the React shell thin.
- A version bump silently discards old preferences (safe reset), so the persisted
  shape can evolve without migration code.
- The collapsible **section header** is board-local, token-matched (the sort-`<select>`
  precedent), because the styleguide `TreeGroup` primitive is coupled to `TreeItem`
  rows and owns its own open state — it does not fit a board section rendering
  draggable `TicketCard`s with externally-persisted collapse state. A design-system
  capture is filed for the shared collapsible primitive this reveals.
