---
id: agentic-workflow-050
title: GET /api/search read endpoint — content search across BC READMEs, ADRs, research & tasks (title + body, title-first ranking, body excerpts)
status: done
type: feature
context: agentic-workflow
created: 2026-06-16
completed: 2026-06-16
commit: e164ff0
depends_on: []
blocks: [agentic-workflow-052]
tags: [captured, backend, dashboard, search, read-api]
related_adrs: [ADR-0023, ADR-0002, ADR-0017, ADR-0001]
related_research: []
prior_art: [agentic-workflow-005, agentic-workflow-008, agentic-workflow-013]
---

## Why
The dashboard global search the builder wants — type anything in the topbar and search **every
artifact** in `.agentheim` (BC READMEs, ADRs, research, **and** tickets) by **title and
content** — needs something the read API does **not** have today: a way to search document
**bodies**. `/api/tree` carries **pointers / metadata only, never document bodies** (ADR-0002),
and `/api/doc` fetches **one** body at a time. So content search requires a **new server-side
read endpoint** — the read-only server's **first** endpoint that reads bodies *in bulk* to match
their content.

This task is **that endpoint** — the architectural keystone of the global-search feature, split
out (REFINE, 2026-06-16) so it can proceed **independently of the styleguide gate**: a pure,
separately-testable read-API task in the spirit of aw-005, needing **no** frontend. The topbar
search **field + popover + keyboard + routing** that consumes it is a separate task,
**agentic-workflow-052**, which carries the styleguide dependencies (ds-001 / ds-016). Search is a
**pure read**, so it does **not** breach the read-only contract (ADR-0017 / ADR-0001).

## What
A `GET /api/search?q=<term>` read endpoint — a sibling of `/api/tree` + `/api/doc` (aw-005) on the
same stdlib HTTP server — backed by a **pure, unit-testable** walk/rank/excerpt core. Per the
builder's REFINE decisions (2026-06-16) and **ADR-0023**:

- **Endpoint:** `GET /api/search?q=<term>` → `200 application/json` `{ query, results: [...] }`. An
  empty/whitespace query or `q.length < 2` returns `{ query, results: [] }` **with no walk**.
- **Match scope — title + body only.** Case-insensitive substring match against each artifact's
  **title and body**. Frontmatter (ids, tags, type, dates) is **not** searched (builder's call).
- **Corpus:** the **same** `.agentheim` the tree projection already discovers — enumerate
  searchable artifacts by reusing the tree walk (`buildTree(root)`), so "what is searchable" stays
  single-sourced. Categories: **Bounded contexts** (READMEs), **Decisions** (ADRs), **Research**,
  **Tickets** (tasks).
- **Result shape per match:** `{ category, title, excerpt, path, ...intent }`. The **excerpt** is a
  short window (~60 chars each side) around the **first** occurrence of the term in that artifact
  (whitespace-collapsed, sliced from the original-case body, matched case-insensitively); a
  title-only match excerpts from the title. The result also carries the **existing open-intent
  fields** the client needs to route it (see *Selection routing*).
- **Ranking — title hits first, then fixed category order.** Two tiers: rows whose **title**
  matched rank above **body-only** matches; within each tier, fixed category order **Bounded
  contexts → Decisions → Research → Tickets**.
- **Selection routing (carried, not rendered, by this task):** every result loads into the **main
  content pane** (`MainPaneReader`) — non-task docs as today (aw-027) **and tickets too** (builder's
  choice, consistent with aw-039 "open in full screen"). So each result carries the *existing*
  intent shape (ADR-0021): non-task docs an intent with content `type` + `title` + `path`
  (`isTaskIntent` false → main pane); tasks a ticket-shaped intent (`status` + `id` + `title` +
  `path` + `context`, `isTaskIntent` true) the aw-039 full-screen path renders in the main pane. No
  new intent shape — `intent-route.js`/`isTaskIntent` is reused unchanged.
- **Root guard:** the walk only opens **in-root** paths and the route validates `q`/paths via the
  existing root-resolution guard (`resolveInRoot` / `startsWith(root)`); search can never traverse
  out. **No writes** — read-only contract intact.

## Acceptance criteria
- [ ] `GET /api/search?q=` returns matches across BC READMEs, ADRs, research, and tasks, matching the term against **title and body**, case-insensitive. It performs **no writes** (read-only contract intact, ADR-0017 / ADR-0001).
- [ ] Frontmatter is **not** matched — only title and body (a frontmatter-only term like a bare id or tag does not produce a hit on that basis alone).
- [ ] Each result carries: `category`, `title`, a short `excerpt` around the **first** occurrence of the term, `path`, and the existing intent fields needed to open it in the main pane (content `type` for docs; `status`/`id`/`context` for tickets).
- [ ] Ranking is **title-hits-first, then fixed category order** Bounded contexts → Decisions → Research → Tickets; verified by a test fixture exercising both tiers and the category order.
- [ ] Empty / whitespace query and `q.length < 2` return `{ query, results: [] }` with no corpus walk.
- [ ] The walk + ranking + excerpting is a **pure** module (stdlib only, DOM-free) covered by `node --test`, including the excerpt edge cases: term at start (no left window), term at end (no right window), multiple matches (first wins), case-fold offset vs original-case slice, multi-line collapse.
- [ ] The endpoint reuses the existing root-resolution guard (`startsWith(root)`); a crafted `q`/path can never read outside the project root.
- [ ] Dashboard tests green; `dist/` unaffected (this is a server-side change, no client bundle); SSE/live-update and the existing `/api/tree` + `/api/doc` contracts are unchanged.

## Notes
**Architect design (ADR-0023, folded in at REFINE):**
- **Module split:** pure walk/rank/excerpt core in a new `dashboard/search.mjs` (stdlib-only,
  DOM-free, `node --test`-able — mirrors `dashboard/tree.mjs` + `dashboard/app/board-data.js`); a
  **thin** HTTP route (`handleSearch`, alongside the other reads in `dashboard/read-api.mjs`) does
  only `q`-read → root guard → call the pure fn → serialize. Enumerate the corpus by reusing
  `buildTree(root)` so the searchable set stays single-sourced with the board/library.
- **Why a new endpoint, not extend `/api/tree`:** `/api/tree` is pointers/metadata-only and never
  carries bodies (ADR-0002); search is the *first* read that reads bodies in bulk. A separate
  endpoint keeps the tree contract intact and pays the body-read cost only on a search.
- **Routing reconciliation (load-bearing):** results carry the *existing* intent shapes so the
  client routes with no new code — non-task docs `{ type: context|adr|research, title, path }`
  (library-data-compatible), tasks the full ticket `{ status, id, title, path, context }`
  (board-data-compatible). Per the builder's call **every** result renders in the **main pane** —
  tickets via the aw-039 full-screen handler (`setSelectedDoc(intent); setOpenIntent(null)`), not
  the slide-over.
- **Risks flagged:** (1) first read to open *every* body — real per-request I/O on a large corpus;
  bounded by local single-user files + the client debounce + min-length; an SSE-watcher-invalidated
  cache (ADR-0006) is the mitigation **if it ever bites** — deliberately **not** built now. (2)
  excerpt edge cases must be pinned by the pure tests (listed in AC).
- **Source touchpoints:** `dashboard/read-api.mjs`, `dashboard/tree.mjs`, `dashboard/discovery.mjs`
  (`resolveInRoot`), `dashboard/server.mjs` (route wiring), and — for the intent shapes the result
  must match — `dashboard/app/intent-route.js`, `dashboard/app/library-data.js`,
  `dashboard/app/board-data.js`.

**Prior art to reuse:** `/api/tree` + `/api/doc` read API (aw-005, ADR-0002); the library category
grouping Product / BCs / Decisions / Research (aw-008, `treeToLibrary`); the per-task `mtimeMs` the
projection already carries (aw-013, available if a tiebreak is wanted, though ranking is title-first
not mtime).

**Sequencing:** this backend has **no** frontend dependency and can be promoted/worked **now**. The
consumer **agentic-workflow-052** (topbar search UI) depends on this **and** on ds-016 (the
styleguide search-field pattern) — mirrors the ds-014 → aw-047 and ds-009 → aw-039 ordering.

## Outcome

Shipped `GET /api/search?q=<term>` — the read-only dashboard server's first content-search
endpoint and its first read that opens document *bodies* in bulk (ADR-0023). Implementation per
the architect's design:

- **`dashboard/search.mjs`** (new) — the pure, stdlib-only, DOM-free walk/rank/excerpt core,
  mirroring `tree.mjs`. `searchCorpus(root, query)` enumerates the corpus from `buildTree(root)`
  (single-sourced with board/library), matches **title + body only** (frontmatter excluded),
  case-insensitive, ranks **title-tier first then fixed category order** (Bounded contexts →
  Decisions → Research → Tickets via a stable sort), and returns rows shaped
  `{ category, title, excerpt, path, ...intent }`. Non-task results carry library-data-compatible
  intent (`type/title/path`); tasks carry board-data-compatible intent (`status/id/title/path/
  context`) — no new intent shape. Exported helpers `stripFrontmatter` and `buildExcerpt` pin the
  ADR-0023 excerpt edge cases (start/end windows, first-occurrence-wins, case-fold offset vs
  original-case slice, multi-line collapse). Loss-tolerant: never throws on a malformed/unreadable
  file; empty/whitespace/`<2`-char query returns `[]` with no walk.
- **`dashboard/read-api.mjs`** — added the thin `handleSearch` route: read `q`, delegate to
  `searchCorpus`, serialize `{ query, results }`. No file written; the in-root guard
  (`resolveInRoot` / `startsWith(root)`) is reused inside the pure core so the walk can never
  traverse out.
- **`dashboard/server.mjs`** — wired `/api/search` ahead of the static fall-through, beside
  `/api/tree` + `/api/doc`.
- **`dashboard/test/search.test.mjs`** (new) — 18 `node --test` cases covering pure
  stripFrontmatter, every buildExcerpt edge case, searchCorpus match-scope/ranking/result-shape/
  frontmatter-exclusion/loss-tolerance, and the HTTP route (JSON shape + empty/short-q no-walk).

Full dashboard suite green (451 tests). Server-side only — `dist/` unaffected, no client bundle
change. The topbar search UI consumer is **aw-052** (this task is `blocks: [aw-052]`).

Key files: `dashboard/search.mjs`, `dashboard/read-api.mjs`, `dashboard/server.mjs`,
`dashboard/test/search.test.mjs`.
