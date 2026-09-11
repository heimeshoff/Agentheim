---
id: agentic-workflow-061
title: Board "Name A→Z / Z→A" sort orders by the title's readable text, in true alphabetical order
status: done
type: bug
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
commit: 3280619
depends_on: [design-system-001]
blocks: []
tags: [dashboard, board, sort, ordering]
related_adrs: []
prior_art: [agentic-workflow-012]
related_research: []
---

## Why
On the board, each column's **Name A→Z** / **Name Z→A** sort should order cards
by the **actual readable text of the task title** in plain alphabetical order —
the order a person reading the titles would expect.

It already keys on the `title` field, but it compares with raw JavaScript
string operators (`<` / `>`) on the lowercased title, i.e. **UTF-16 code-point
order**, not alphabetical/collation order. Code-point order diverges from "what
a human calls alphabetical" for: leading digits (`"10…"` sorts before `"2…"`),
leading punctuation/symbols (a title starting with `/api/…` or a quote sorts
before letters), and accented / umlaut characters (`ä`, `ö`, `ü`, `ß` sort
*after* `z`). So the builder sees an ordering that is technically "by title" but
not the alphabetical order they mean.

## What
Make the **Name** orderings sort by the title's text using locale-aware
alphabetical collation instead of code-point comparison.

The comparator is the pure `dashboard/app/board-sort.js` (`sortTickets`,
unit-tested under `node --test`). Today `title-asc` / `title-desc` build a
`titleKey` via `title.toLocaleLowerCase()` and compare with `ka < kb ? … : …`
(`board-sort.js:50` and `:67`–`:76`). Replace the `<`/`>` comparison with a
collation-aware compare — `String.prototype.localeCompare` (or a shared
`Intl.Collator`) with `{ sensitivity: 'base', numeric: true }` — so:

- case-insensitive (the explicit lowercasing can fall away, `sensitivity:'base'`
  already ignores case **and** accents for ordering),
- accented / umlaut letters sort next to their base letter, not after `z`,
- numeric runs sort naturally (`2` before `10`).

`title-asc` returns the collator result; `title-desc` returns its negation. Keep
the existing tie-break: equal titles still fall through to **id ascending**
(`byIdAsc`), and a missing/non-string title still degrades to `""` (never a
throw). This stays a **pure** reordering of the already-projected list — it does
not touch the projection, the read model, or disk (ADR-0001 / ADR-0017), and the
styleguide is untouched (ADR-0003).

## Acceptance criteria
- [ ] **Name A→Z** orders cards by the title's readable text in alphabetical
      (locale-collated) order; **Name Z→A** is the exact reverse.
- [ ] Ordering is case-insensitive (`"apple"`, `"Banana"`, `"cherry"` →
      apple, Banana, cherry — not all-capitals-first).
- [ ] Accented / umlaut titles collate next to their base letter, not after `z`
      (e.g. `"Ärger"` sorts near `"A…"`, not after `"Z…"`).
- [ ] A title with a leading number collates naturally (`"2 things"` before
      `"10 things"`), not `"10…"` before `"2…"`.
- [ ] Equal titles still break ties by **id ascending** (unchanged).
- [ ] A missing / non-string title degrades to empty and never throws (unchanged).
- [ ] The other orderings (Recently modified / Least recently modified) are
      byte-unchanged.
- [ ] `board-sort.js`'s `node --test` unit tests are updated/added to cover
      case, accent, and numeric ordering, and pass.
- [ ] `dashboard/dist/app.js` is rebuilt (esbuild) so the deployed app carries
      the change.

## Notes
- This is a comparator-only change inside `board-sort.js`; `SORT_OPTIONS`, the
  labels (`Name A→Z` / `Name Z→A`), `DEFAULT_SORT`, and the board wiring all
  stay as-is.
- Scope is the **Name** orderings only — do not alter the mtime comparators or
  the id tie-break direction.
- Locale: use the host default locale (call `localeCompare(b, undefined, …)` /
  `new Intl.Collator(undefined, …)`) rather than hard-coding one, so it follows
  the builder's environment. Flag for refinement only if a fixed locale is ever
  wanted.
- Prior art: `agentic-workflow-012` introduced this comparator and its tests;
  the persisted sort choice (aw-014 / ADR-0015) and the group-by pipeline
  (aw-014) are unaffected — they consume `sortTickets`' output unchanged.
- Styleguide gate (`design-system-001`) is already in `done/`, so the frontend
  dependency is met.

## Outcome
The Name orderings now collate alphabetically by readable title text instead of
UTF-16 code-point order. `dashboard/app/board-sort.js`: `titleKey` no longer
lowercases (degrades a missing/non-string title to `""` as before); a shared
`new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })` drives a
`byTitleCollated(a, b)` helper. `title-asc` returns its result, `title-desc`
returns the negation, and both keep the `byIdAsc` tie-break unchanged. The mtime
comparators and the id tie-break direction are byte-unchanged.

Result: case-insensitive ordering, accented/umlaut letters collate next to their
base letter (e.g. `Ärger` near `A`, not after `Z`), and leading-number runs sort
naturally (`2 things` before `10 things`). Default sort (`mtime-desc`),
`SORT_OPTIONS`, labels, and board wiring are untouched.

Key files:
- `dashboard/app/board-sort.js` — comparator change.
- `dashboard/test/board-sort.test.mjs` — 5 new cases (case, accent, numeric,
  desc-reverse, missing/non-string degrade); existing tie-break/degrade tests
  stay green.
- `dashboard/dist/app.js` — rebuilt via esbuild so the deployed app carries it.

Full dashboard `node --test` suite: 491 passing (was 486 + 5 new). No ADR
written — the approach was fully prescribed by the task and prior art
(aw-012), no novel decision to record.
