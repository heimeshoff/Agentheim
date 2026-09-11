---
id: agentic-workflow-075
title: Concepts are a first-class artifact kind — left-rail nav group + searchable category
status: done
type: feature
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-18
depends_on: [design-system-001-styleguide, design-system-021-concept-content-type]
blocks: []
tags: [dashboard, navigation, search, concepts]
related_adrs: [0011, 0023, 0021, 0003]
related_research: []
prior_art: [agentic-workflow-008, agentic-workflow-066, agentic-workflow-056, agentic-workflow-050, agentic-workflow-052]
---

## Why
Concept pages (the opt-in per-BC synthesis pages under `contexts/<bc>/concepts/`) are a
real artifact kind — the tree projection already carries them per BC (`bc.concepts`,
built in aw-005, tested in `tree.test.mjs`) — but they are **invisible** in the dashboard's
two discovery surfaces. `treeToLibrary` (the left-rail library) pools only Product /
Bounded contexts / Research / Decisions, and the search corpus (`enumerateCorpus`) walks
only Bounded contexts / Decisions / Research / Tickets. So a synthesized concept page can
be linked from an INDEX but cannot be browsed from the rail or found by search. Concepts
deserve the same first-class standing as ADRs and research.

## What
Surface **Concepts** as a first-class group/category across the dashboard's discovery
surfaces, drawing from the `bc.concepts` locations the tree projection already carries
(no new server data — purely additive to the consuming transforms; styleguide consumed
unforked, ADR-0003).

1. **Left rail (library nav).** `dashboard/app/library-data.js` → `treeToLibrary` gains a
   **Concepts** group positioned **immediately after Bounded contexts** —
   `Product → Bounded contexts → Concepts → Research → Decisions` (this preserves the rail's
   own aw-056/aw-066 order: Research above Decisions). It lists every BC's concept pages, each
   a row opening in the **main-pane reader** via the existing non-task open-intent shape
   (`{ id, type: 'concept', title, path }`, routed by `isTaskIntent`, ADR-0021). Note concepts
   are **per-BC** (`tree.contexts[].concepts`), unlike the top-level `locations.adrs` /
   `locations.research` — the transform must iterate contexts. **Title = `baseName`** (last
   path segment minus `.md`), exactly as ADRs and research are titled today (refine decision —
   see Notes; the tree carries `bc.concepts` as **paths only**, so reading a frontmatter title
   would require new server data, which this task forbids).
2. **Search.** `dashboard/search.mjs` → `enumerateCorpus` gains a **Concepts** category
   (title + body searchable, frontmatter excluded per ADR-0023), and the topbar search
   panel groups results under a **Concepts** label, positioned **immediately after Bounded
   contexts** (confirmed in refine) — `Bounded contexts → Concepts → Decisions → Research →
   Tickets`. The two **search** orderings — `search.mjs` (`CATEGORY_ORDER`) and
   `dashboard/app/search-results.js` (`GROUP_ORDER`) — must stay **byte-identical to each
   other** (they are today). They are **not** mirrored to the rail and never have been: the
   rail puts Research above Decisions (aw-056), search puts Decisions above Research. The one
   invariant common to all three surfaces is **Concepts immediately after Bounded contexts**.
3. **`type: 'concept'` plumbing (in this BC).** The styleguide `TreeItem` looks the type up in
   `CONTENT_TYPES` and would throw on an unknown `concept` — closed by the **design-system-021**
   dependency (adds the `concept` registry entry + glyph + `--ct-concept` tokens). In *this* BC,
   `dashboard/app/slide-over-data.js`'s `CONTENT_TYPE_KEYS` allow-list (`ticket | context |
   vision | map | research | adr`) must also gain `'concept'` so the type pill resolves on the
   "open in full screen" / search→main-pane paths (aw-039/aw-052) — an in-scope edit, not a
   separate task.

## Acceptance criteria
- [ ] The left rail shows a **Concepts** group between **Bounded contexts** and **Research**
      (`Product → Bounded contexts → Concepts → Research → Decisions`).
- [ ] The Concepts group lists every BC's concept pages (from `bc.concepts`); selecting a row
      opens it in the main-pane reader (non-task doc, `type: 'concept'`, no new routing).
- [ ] An empty Concepts group is **omitted** (no 0-item heading) — consistent with the other
      groups' `.filter(items.length > 0)`.
- [ ] `/api/search` matches concept page titles + bodies; results appear under a **Concepts**
      group in the topbar search panel, positioned immediately after Bounded contexts.
- [ ] The two **search** orderings stay byte-identical to each other — `search.mjs`
      (`CATEGORY_ORDER`) === `search-results.js` (`GROUP_ORDER`) === `Bounded contexts →
      Concepts → Decisions → Research → Tickets`. The rail (`library-data.js`) keeps its own
      order (`Product → Bounded contexts → Concepts → Research → Decisions`, aw-056); the
      cross-surface invariant is only **Concepts immediately after Bounded contexts**.
- [ ] A concept row opens in the main-pane reader with a resolving type pill — `'concept'` is
      added to `slide-over-data.js`'s `CONTENT_TYPE_KEYS` allow-list (in-scope, this BC).
- [ ] Concept rows are titled by `baseName` (last path segment minus `.md`), like ADRs/research.
- [ ] The pure transforms keep their `node --test` coverage — new cases for the Concepts
      group/category; loss-tolerant (missing/empty `concepts` → no group, never a throw).
- [ ] `dashboard/dist/` rebuilt via esbuild so the deployed app carries the change.
- [ ] Styleguide consumed **unforked** (ADR-0003): reuse the existing `TreeGroup`/`TreeItem`
      and `SearchField`. The `type: 'concept'` icon need is **confirmed** — `CONTENT_TYPES`
      lacks a `concept` entry and the registry lacks a fitting glyph — so it is met by the
      **design-system-021** dependency (registry entry + glyph + `--ct-concept` tokens), not by
      forking. aw-075 cannot ship before ds-021 (a `concept` row throws in `TreeItem` until then).

## Notes
**Refined 2026-06-17** — the three open questions are resolved (all code-checked against the
real transforms), and one hard dependency was split out:

- **Concept title source → `baseName`** (RESOLVED). The tree projection carries `bc.concepts`
  as **paths only** (`tree.mjs:157` — `concepts: listMarkdown(conceptsDir).map(relPointer)`),
  and this task forbids new server data. Reading a frontmatter title would require either
  server-side parsing or a client fetch in a pure transform — neither acceptable. ADRs and
  research already title by `baseName`, so concepts follow suit. Consistent and zero new data.
- **Search category position → right after Bounded contexts** (CONFIRMED). `Bounded contexts →
  Concepts → Decisions → Research → Tickets`, matching the rail's "Concepts right after BC"
  insertion point. The two search orderings (`search.mjs` / `search-results.js`) stay identical;
  see the corrected acceptance criterion — they are **not** mirrored to the rail (Research and
  Decisions are deliberately flipped between rail and search since aw-056).
- **Styleguide icon → design-system-021** (RESOLVED — a hard dependency, not optional). Checked
  the registry: `CONTENT_TYPES` (`styleguide/app/data.js`) has only `ticket | context | vision |
  map | research | adr` — **no `concept`** — and `TreeItem` dereferences `CONTENT_TYPES[item.type]
  .icon`, so a `concept` row **throws** until the entry exists. The icon set (`icons.js`) also has
  no fitting glyph. So **design-system-021** was split off (registry entry + glyph + `--ct-concept`
  tokens) and added to `depends_on`. This is the ds-009→aw-039 / ds-016→aw-052 / ds-020→aw-074
  styleguide-capability-first precedent; aw-075 stays in **backlog** until ds-021 ships.
- **In-scope plumbing (this BC):** `slide-over-data.js`'s `CONTENT_TYPE_KEYS` allow-list also
  lacks `'concept'` and needs it (so the type pill resolves on the open-in-full-screen / search
  → main-pane paths). That's an edit inside this task, not a separate one.
- This project currently has **zero** concept pages (the BC INDEX `concepts` list is empty),
  so both surfaces render empty until a concept is synthesized — but the rail group and search
  category become first-class regardless, ready the moment a concept page lands.

Prior art (all shipped, related, none the same): aw-008 (library nav transform), aw-056 /
aw-066 (rail group ordering), aw-050 (`/api/search` corpus), aw-052 (topbar search grouping).

## Outcome
**Done 2026-06-18.** Concepts are now a first-class artifact kind across both dashboard
discovery surfaces, drawing from the per-BC `tree.contexts[].concepts` paths the projection
already carries (no new server data — purely additive to the consuming pure transforms;
styleguide consumed unforked, ADR-0003, via the ds-021 `concept` content-type).

- **Left rail** (`dashboard/app/library-data.js`): `treeToLibrary` gains a **Concepts** group
  between Bounded contexts and Research — rail order `Product → Bounded contexts → Concepts →
  Research → Decisions` (preserving aw-056's Research-above-Decisions). Iterates contexts
  (concepts are per-BC, unlike top-level `locations.adrs`/`research`), titles each row by
  `baseName`, type `'concept'`, id `concept-<baseName>`. Empty/missing/non-array `concepts` →
  group omitted, never a throw.
- **Search corpus** (`dashboard/search.mjs`): `enumerateCorpus` gains a **Concepts** category
  (title + body searchable, frontmatter excluded per ADR-0023); `CATEGORY_ORDER` becomes
  `Bounded contexts → Concepts → Decisions → Research → Tickets`.
- **Topbar grouping** (`dashboard/app/search-results.js`): `GROUP_ORDER` updated to the same
  five-category order — kept **byte-identical** to `search.mjs`'s `CATEGORY_ORDER`.
- **Type-pill plumbing** (`dashboard/app/slide-over-data.js`): `'concept'` added to the
  `CONTENT_TYPE_KEYS` allow-list so a concept row's pill resolves on the open-in-full-screen /
  search→main-pane paths.
- **`dist/` rebuilt** via `node build.mjs` (esbuild); the committed bundle carries the
  `Concepts` group, the `concept-` id prefix, and the `--ct-concept` token CSS.
- **Tests**: 6 new pure-transform cases across `library-data.test.mjs` (Concepts group order,
  per-BC iteration, omission of empty, loss-tolerance), `search.test.mjs` (concept page
  searchable + ranking + intent shape), `search-results.test.mjs` (Concepts bucket position),
  `slide-over-data.test.mjs` (concept type resolves). Full dashboard suite green (601/601).

The cross-surface invariant — **Concepts immediately after Bounded contexts** — holds on all
three orderings; the rail vs. search Research/Decisions flip (aw-056) is intentionally
preserved. The project currently has zero concept pages, so both surfaces render empty until
one is synthesized, but the rail group and search category are first-class regardless.

Key files: `dashboard/app/library-data.js`, `dashboard/search.mjs`,
`dashboard/app/search-results.js`, `dashboard/app/slide-over-data.js`, rebuilt `dashboard/dist/`,
BC README (library/search surface descriptions).
</content>
</invoke>
