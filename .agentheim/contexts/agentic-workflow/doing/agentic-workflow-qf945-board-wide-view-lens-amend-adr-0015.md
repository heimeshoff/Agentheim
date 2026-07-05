---
id: agentic-workflow-qf945
title: Reverse ADR-0015 per-column scope — one board-wide view lens, per-(column,BC) collapse/peek retained (amend in place)
status: doing
type: decision
context: agentic-workflow
created: 2026-07-05
completed:
depends_on: []
blocks: [agentic-workflow-c2ver]
tags: [dashboard-redesign, board, view-state, adr-amendment, localstorage, decision]
related_adrs: [0015]
related_research: []
prior_art: [agentic-workflow-014, agentic-workflow-012, agentic-workflow-m2v8d]
---

## Why

The board redesign ([[agentic-workflow-c2ver]]) collapses the four lifecycle columns'
**independent** Sort + Group-by-BC affordances into a **single board-wide "View" chip**
that drives sort and grouping for all four columns identically. That reverses the core
scope decision of ADR-0015 — "the board's **per-column view lens** `{ grouped, sort,
collapsed[] }` per lifecycle column" — so it is a recorded architectural reversal, not a
cosmetic tweak. Per the decisions-as-tasks discipline it is split out of c2ver (which
becomes pure UI-wiring against a settled ADR) into its own `type: decision` task whose
worked output is the ADR amendment, not code.

The reversal is **scoped to the sort + group-by-BC CHOICE only**. Two facets stay
per-column and must be preserved verbatim: the per-`(column, BC)` `collapsed[]` sections,
and the Done column's `peek` collapse/peek boolean (aw-m2v8d). Only the *lens* goes
board-wide.

## What

Amend **ADR-0015 in place** (do NOT write a new superseding ADR) to record the collapse
from a per-column lens to one board-wide lens, while explicitly retaining per-column
collapse and per-column Done `peek`.

**Amend-vs-supersede ruling:** ADR-0015 is still `status: proposed` — never adopted. This
repo *supersedes/reshapes* only `accepted` ADRs (ADR-0021 reshaped the *accepted*
ADR-0010/ADR-0011 §5); a still-`proposed` ADR is amended in place at lower ceremony
(precedent: infrastructure-015 amended the still-`proposed` ADR-0018 for exactly this
reason, in the same document, via a dated banner). Keeping the whole board-view-state
story — persist-vs-in-session (the original ADR-0015 reversal of ADR-0009), then
per-column-vs-board-wide (this reversal) — in one file a reader follows top-to-bottom via
banners is clearer than fragmenting it across a supersession chain.

The amendment records the new persisted store shape — the **lens becomes a single
board-wide object**; **collapse and peek stay column-scoped**:

    {
      version: 2,
      lens: { grouped: boolean, sort: SortValue },        // board-wide, ONE per board
      columns: {                                          // one entry per lifecycle column
        [col]: { collapsed: string[], peek: boolean }     // per-(column, BC) + Done peek, UNCHANGED
      }
    }

`VIEW_STATE_VERSION` bumps to `2`. The old v1 shape
(`{ version: 1, columns: { [col]: { grouped, sort, collapsed, peek } } }`) is retired: on
load, a non-`2`, missing, or malformed blob degrades to board-wide defaults and NEVER
throws — inheriting ADR-0015's own "a version bump silently discards old preferences
(safe reset)" consequence and the existing `normalizeColumn`-style defensive-default
precedent. No field-by-field migration of old per-column sort/grouped values is
attempted; this is a deliberate hard reset, not a lossy-but-best-effort carry-forward.

## Acceptance criteria

- [ ] **Amend-in-place, not supersede.** ADR-0015
      (`.agentheim/knowledge/decisions/0015-board-view-state-persisted-localstorage.md`)
      is edited in place: a dated amendment banner is added under the title noting the
      per-column→board-wide scope reversal; the Decision bullet that reads "the board's
      **per-column view lens** — `{ grouped, sort, collapsed[] }` per lifecycle column"
      is rewritten to the board-wide-lens + retained-per-column-collapse/peek shape;
      `status` stays `proposed`; NO `supersedes`/`diverges_from`/new-ADR-number is added;
      `related_tasks` is extended with `agentic-workflow-qf945` and `agentic-workflow-c2ver`.
      No new ADR file is created.
- [ ] **The amendment reasons the ruling from precedent** — it names ADR-0015's
      `proposed` status and cites the repo convention (supersession reserved for
      `accepted` ADRs, per ADR-0021; in-place amendment of a `proposed` ADR, per
      infrastructure-015/ADR-0018) as the basis for amending rather than superseding.
- [ ] **New store shape is spelled out** in the amended Decision: a single board-wide
      `lens: { grouped, sort }` (no longer per-column), plus a per-column
      `columns: { [col]: { collapsed: string[], peek: boolean } }` map. The lens is ONE
      object for the whole board; `collapsed[]` and `peek` remain column-scoped exactly at
      today's granularity.
- [ ] **Done collapse/peek explicitly unaffected.** The amendment states in words that the
      Done column's `peek` collapse/peek affordance (aw-m2v8d) and every column's
      `collapsed[]` section state stay per-column and are NOT swept into the board-wide
      lens — only sort + group-by-BC go board-wide.
- [ ] **Dormant retention, not clearing.** The amendment states that toggling the
      board-wide `grouped` flag off then back on does NOT clear a column's stored
      `collapsed[]` — a column's per-BC collapse state goes dormant (unused while flat)
      and reappears intact once grouping is re-enabled, board-wide or not. (Confirmed
      sort-invariant by the tactical-modeler: a column's BC-section set depends only on
      which BCs have cards there, never on sort order, since grouping only partitions and
      never re-orders.)
- [ ] **Versioned-migration semantics recorded.** The amendment states `VIEW_STATE_VERSION`
      bumps to `2`; that a blob with any version other than `2` (or absent/malformed JSON)
      degrades to board-wide defaults (`lens` = flat + default sort; every column = empty
      `collapsed[]`, `peek: false`) and NEVER throws; and that no old-shape→new-shape field
      migration is performed (safe reset, per ADR-0015's existing consequence and the
      `normalizeColumn` defensive-default precedent).
- [ ] **Bidirectional links.** This task's `related_adrs` names ADR-0015; ADR-0015's
      `related_tasks` names this task. The downstream wiring task
      [[agentic-workflow-c2ver]] `depends_on` this task (it builds against the shape
      frozen here).

## Notes

- **Worked output is the ADR amendment, not code.** The store rewrite in
  `dashboard/app/board-view-state.js` (v1→v2 shape, board-wide `lens`, retained per-column
  `collapsed`/`peek`, version-bump degrade path, and splitting `normalizeColumn` into a
  board-lens normalizer + a leaner per-column normalizer) and the `ViewChip` UI belong to
  [[agentic-workflow-c2ver]], which builds against the shape this ADR freezes.
- The `VIEW_STATE_KEY` (`agentheim.board.viewState`) is reused unchanged — the version
  bump alone invalidates old blobs, per ADR-0015's existing mechanism; no new storage key
  is introduced.
- No open product call remains: the builder has already settled (1) the split into this
  decision task and (2) that collapse stays per-`(column, BC)` and Done `peek` stays
  per-column. This task ratifies the amend-in-place recommendation, freezes the store
  shape, and pins the dormant-retention rule; it is ready to work.
- Prior art: aw-014 (per-column group-by-BC + persisted lens, the scope being reversed),
  aw-012 (column sort now going board-wide), aw-m2v8d (the Done `peek` clamp being
  retained per-column).
- Precedent for the amend-vs-supersede call: infrastructure-015 (amended the
  still-`proposed` ADR-0018 in place); contrast ADR-0021 (reshaped the *accepted*
  ADR-0010/0011 via a new ADR).
