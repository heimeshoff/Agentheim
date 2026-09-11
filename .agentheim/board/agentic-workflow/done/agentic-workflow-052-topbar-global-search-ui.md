---
id: agentic-workflow-052
title: Topbar global search UI — search field replaces the breadcrumb; grouped-results popover routing to the main pane
status: done
type: feature
context: agentic-workflow
created: 2026-06-16
completed: 2026-06-16
commit: 46fa5ec
depends_on: [design-system-001, design-system-016, agentic-workflow-049, agentic-workflow-050]
blocks: []
tags: [captured, frontend, dashboard, search]
related_adrs: [ADR-0023, ADR-0021, ADR-0017, ADR-0009, ADR-0003]
related_research: []
prior_art: [agentic-workflow-005, agentic-workflow-008, agentic-workflow-027, agentic-workflow-039]
---

## Why
The main-column topbar leads with a **static breadcrumb** — `Board` + a mono `agentheim / tickets`
(`dashboard/app/board.js`, `BoardTopbar`) — that carries no function: the project name already
shows in the **rail brand**, so the breadcrumb is dead chrome. Since **aw-049** the three utility
controls collapsed behind the settings gear and the topbar reads `[breadcrumb] … [⚙] [Work]`, so
the breadcrumb slot is **free**. The builder wants it to become a **global search**: type anything,
search **every artifact** in `.agentheim` — BC READMEs, ADRs, research, **and** tickets — by title
and content, see grouped results, and jump straight to the document.

This task is the **UI half**: the topbar search field, the grouped-results popover, the keyboard
model, and the selection routing into the main pane. The **content-search backend** it queries is
**agentic-workflow-050** (`GET /api/search`, the read endpoint + ADR-0023); the reviewed styleguide
**search-field + grouped-results pattern** it consumes is **design-system-016**. This split (REFINE,
2026-06-16) lets the backend proceed independently of the styleguide gate this task carries.

## What
Replace the `BoardTopbar` breadcrumb with a search field, wired to `GET /api/search` (aw-050), with
a grouped-results popover:

- **Topbar search field** replacing the breadcrumb — the **ds-016 `SearchField`**, consumed
  **unforked** (ADR-0003). `SearchField` is a **controlled combobox**: this task owns the raw
  query **`value`**, the **`onChange`** handler, and feeds the **`groups`** + **`onSelect`** props;
  ds-016 owns the input chrome, the floating panel, and the keyboard mechanics. The query is
  **debounced ~200ms** and **gated at min length 2** *before the `/api/search` fetch* — the field
  still displays every typed character (the gate suppresses the network call, not the input).
- **Flat → grouped transform (this task's one pure unit).** aw-050 returns a **flat** ranked
  `results: [{ category, title, excerpt, path, ...intent }]`; ds-016 wants
  **`groups: [{ label, items }]`**. A pure, `node --test`-able transform
  (`dashboard/app/search-results.js` → `searchResultsToGroups`) buckets the flat list into the
  four fixed-order category groups — **Bounded contexts → Decisions → Research → Tickets** —
  **preserving the within-category order as received** (so aw-050's title-hits-first ranking
  survives inside each group). Empty groups may be passed through unfiltered — ds-016 renders no
  header for a group with zero rows. Each row = the item **title** + the **first-occurrence
  excerpt** (from aw-050); ds-016's `getTitle`/`getExcerpt` **defaults already read
  `item.title`/`item.excerpt`** and `markMatches` marks the term against `value`, so **no custom
  getters and no marking code are written board-side**.
- **Keyboard:** up/down moves a **single** highlight across **all** rows (spanning groups), Enter
  loads the highlighted item; mouse hover + click do the same; Esc closes **and clears** (ds-016's
  `close()` fires `onChange("")`). ds-016 owns the active-descendant mechanics; this task supplies
  the data + `onSelect`, and its `onChange` handler treats `""` as "clear results, no fetch"
  (an empty query is the `panelState` "closed" state — no panel).
- **Selection routing:** loads the chosen artifact into the **main content pane**
  (`MainPaneReader`) — non-task docs as today (aw-027) **and tickets too** (builder's choice,
  consistent with aw-039 "open in full screen"). The result already carries the existing intent
  shape from `/api/search` (ADR-0023), so the shell routes it through the unchanged
  `isTaskIntent` (ADR-0021): docs → `setSelectedDoc`; tickets → the aw-039 full-screen handler
  (`setSelectedDoc(intent); setOpenIntent(null)`), **not** the slide-over. The rail's **Board**
  item returns to the board.
- **Empty / no-results states (ds-016's `panelState`, accepted unchanged — REFINE 2026-06-16):**
  an **empty/whitespace** query shows **no panel** (`panelState` "closed"). **Any non-empty query**
  with no rows — including a **sub-min (1-char) query the backend never walks** — shows ds-016's
  **"No matches for …" line**, not a dead box. This **relaxes** the original "sub-min → no panel"
  wording: ds-016 has no force-closed prop and the input must display the typed character, so the
  consumer accepts the styleguide's honest no-results panel rather than forking ds-016. (See Notes.)

## Acceptance criteria
- [ ] The `BoardTopbar` breadcrumb (`Board` + `agentheim / tickets`) is removed; a search field takes its place. The project name is unaffected (it lives in the rail brand). The settings gear + Work launch (aw-049) are untouched — the topbar reads `[search field] … [⚙] [Work]`.
- [ ] The search input **consumes the design-system ds-016 `SearchField` unforked** (ADR-0003); no bespoke search chrome forked board-side. The consumer owns `value`/`onChange` and feeds `groups` + `onSelect`; ds-016's `getTitle`/`getExcerpt` defaults (reading `item.title`/`item.excerpt`) are used as-is — no custom getters, no board-side term-marking.
- [ ] Typing queries `/api/search` live, **debounced ~200ms** and **gated at min length 2** *before the fetch* (the field still displays every typed char); results render in ds-016's floating panel **below the input**, grouped by category with a per-category group label.
- [ ] A pure, `node --test`-able `searchResultsToGroups` (`dashboard/app/search-results.js`) buckets aw-050's flat ranked `results` into ds-016's `groups: [{label, items}]` in fixed category order (Bounded contexts → Decisions → Research → Tickets), preserving the within-category order received from the endpoint; it is loss-tolerant (a malformed/empty result set yields `[]`, never a throw).
- [ ] Each result row shows the item title + the matched-excerpt sub-line with the term marked (ds-016's `markMatches` against `value`).
- [ ] Up/down arrows move a single highlight across all result rows (spanning groups); Enter opens the highlighted result; mouse hover + click open the same way; Esc closes **and clears** the field.
- [ ] Selecting any result loads that document into the **main content pane** (`MainPaneReader`) — non-task docs and tickets alike — via the existing intent routing (`isTaskIntent`, ADR-0021) and `/api/doc` fetch; tickets use the aw-039 full-screen path, not the slide-over. ds-016's `onSelect(item, ctx)` hands back the full aw-050 result (carrying `...intent`), which the shell routes unchanged.
- [ ] Empty / whitespace query shows **no panel**; any non-empty query with no matches (incl. a sub-min query the backend never walks) shows ds-016's clear "No matches" line — no dead popover.
- [ ] Dashboard tests green; `dist/` rebuilt from source (`node build.mjs`); SSE/live-update and existing topbar behavior (settings gear, Work launch) unaffected.

## Notes
- **REFINE 2026-06-16 (grounded against the shipped ds-016 + aw-050; both now `done`).** ds-016
  shipped `SearchField` (`styleguide/app/search.js` over pure `search-state.js`) and aw-050 shipped
  `GET /api/search`, so this task was re-grounded against the *actual* APIs:
  - **`SearchField` is a controlled combobox** — props `value`, `onChange(next)`, `groups`,
    `onSelect(item, ctx)`, optional `getTitle`/`getExcerpt`. The consumer owns query state + debounce
    + the min-length-2 *fetch* gate + the flat→grouped transform; ds-016 owns chrome + panel +
    keyboard. The defaults read `item.title`/`item.excerpt`, so aw-050's result shape feeds it with
    **no custom getters**.
  - **Panel-open behavior reconciled (builder decision):** ds-016's `panelState(value, count)` opens
    the panel for **any** non-empty trimmed `value` (showing "No matches" when `count===0`); it has
    no force-closed prop. The original "sub-min query → no panel" criterion is therefore **relaxed**
    to accept ds-016's no-results panel for a 1-char query — keeping ds-016 **unforked** (no
    styleguide amendment, no design-system follow-up task). Only an empty/whitespace query shows no
    panel.
- **Depends on the backend (aw-050) and the styleguide pattern (ds-016) — both now `done`.** This
  task does **no** corpus walking, ranking, or excerpting — that all lives in `/api/search` (aw-050 /
  ADR-0023). It also forks **no** search chrome — the field + popover + keyboard come from ds-016.
  Its job is the **wiring**: place the field, own the controlled `value` + debounce + min-length-2
  fetch gate, run the one pure `searchResultsToGroups` transform to feed ds-016, and route the
  `onSelect` through the unchanged `isTaskIntent`.
- **Sequencing:** edits the **same `BoardTopbar`** that aw-049 rewrote into `[breadcrumb] … [⚙]
  [Work]`; this removes the breadcrumb so the topbar becomes `[search field] … [⚙] [Work]` (hence
  the `depends_on` on aw-049, now **done**).
- **Styleguide gate:** depends on `design-system-001` (gate) + `design-system-016` (the
  search-field pattern). **Both satisfied** — ds-016 landed (`9c7f353`) and the gate was
  re-confirmed OPEN against the source including the search combobox (protocol 2026-06-16 15:12).
- **Prior art to reuse:** the main-pane reader (aw-027) + ticket-in-main-pane (aw-039); open-intent
  routing `isTaskIntent` (aw-027 / ADR-0021); the library category grouping (aw-008,
  `treeToLibrary`) for the group labels/order.

## Outcome
The topbar breadcrumb is replaced by the global search field; selecting a result opens
the document in the main content pane.

- **Pure transform (TDD red→green):** `dashboard/app/search-results.js` →
  `searchResultsToGroups(results)` buckets aw-050's flat ranked `results` into ds-016's
  `groups: [{label, items}]` in fixed order (Bounded contexts → Decisions → Research →
  Tickets), preserving within-category order, loss-tolerant (malformed/empty → all-empty
  groups, never throws; unknown-category rows dropped). Unit-tested in
  `dashboard/test/search-results.test.mjs` (7 tests, `node --test`, no DOM).
- **Wiring (`dashboard/app/board.js`):** new `TopbarSearch` component consumes the ds-016
  `SearchField` **unforked** (imported from `design-system/styleguide/app/search.js`,
  ADR-0003). It owns the controlled `value` + `onChange`, the **~200ms debounce**
  (`SEARCH_DEBOUNCE_MS`), the **min-length-2 fetch gate** (`SEARCH_MIN_LENGTH`, suppresses
  the network call, not the input), and feeds `groups` (via `searchResultsToGroups`) +
  `onSelect`. No custom getters / no board-side term-marking — ds-016's defaults read
  `item.title`/`item.excerpt` and `markMatches` marks against `value`. A monotonic `seq`
  ref discards stale in-flight fetches. `BoardTopbar` now renders `[search field] … [⚙]
  [Work]`; the settings gear + Work launch are untouched.
- **Routing:** `DashboardApp` gained `onOpenSearch`, threaded into `BoardTopbar` as
  `onOpen`. A selected result (carrying the existing intent shape, ADR-0023) routes through
  the unchanged `isTaskIntent` (ADR-0021): docs → `setSelectedDoc` (main pane, aw-027);
  tickets → the aw-039 full-screen path (`setSelectedDoc` + `setOpenIntent(null)`), NOT the
  slide-over. Both land in `MainPaneReader`.
- **Empty/no-results:** empty/whitespace → groups cleared, no fetch (ds-016 panelState
  "closed", no panel); a sub-min/no-match non-empty query shows ds-016's honest "No matches"
  line (relaxed per the REFINE note — ds-016 stays unforked).
- **Tests:** new `dashboard/test/topbar-search.test.mjs` (8 static-guard tests) locks the
  wiring criteria. Updated the now-obsolete `shell-relayout.test.mjs` guard (its "no Search
  box" assertion predated aw-050/ds-016) to assert the search field is present. `dist/`
  rebuilt via `node build.mjs`. Full dashboard suite green: **467 tests, 0 fail**.
- **Docs:** BC README updated (new *Global search (topbar)* capability entry; topbar-layout
  references updated to `[search field] … [⚙] [Work]`; the aw-050 entry now points at the
  shipped UI). No ADR written — the decisions (ticket→main-pane routing, relaxed sub-min
  panel) were already fixed by ADR-0023 + the REFINE notes, not introduced here.

Key files: `dashboard/app/search-results.js`, `dashboard/app/board.js`,
`dashboard/test/search-results.test.mjs`, `dashboard/test/topbar-search.test.mjs`.
