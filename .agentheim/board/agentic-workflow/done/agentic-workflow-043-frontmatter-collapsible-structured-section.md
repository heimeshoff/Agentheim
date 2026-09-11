---
id: agentic-workflow-043
title: Dashboard hides document frontmatter behind a collapsible, structured "Front matter" section (slide-over + main pane)
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-16
commit: 62625b8
depends_on: [design-system-001-styleguide]
blocks: []
tags: [dashboard, slide-over, main-pane, markdown, frontmatter]
related_adrs: [0003, 0010, 0021]
related_research: []
prior_art: [agentic-workflow-007, agentic-workflow-027]
---

## Why
When the builder opens a document on the dashboard, the body renders **raw**,
including its YAML frontmatter. The styleguide `Markdown` primitive (consumed
unforked, ADR-0003) calls `marked.parse()` on the whole string, and `marked`
reads the `key: value` block sitting just above the closing `---` as a **setext
heading** — so the entire frontmatter collapses into one large, bold, white line
at the top of the rendered view. It is unreadable, it isn't what frontmatter is
for, and it pushes the actual document content down.

This leak is **identical on two surfaces** that share the same primitive: the
task **slide-over** (`slide-over.js` → styleguide `Drawer` → `Markdown`) and the
non-task **main-pane reader** (`main-pane-reader.js` → `Markdown` directly).
Tickets, ADRs, BC READMEs and research all carry frontmatter and all leak the
same way. One shared fix covers both (scope decided in REFINE: **both surfaces**).

The frontmatter is still useful information — it just shouldn't masquerade as a
heading in the prose. The builder wants it out of the rendered body and tucked
into a quiet, expandable affordance that, when opened, shows the fields
**structured** (one field per row), not as a single concatenated line.

## What
Separate the YAML frontmatter from the markdown body **before** it reaches the
styleguide `Markdown` primitive, on both render surfaces, via **one shared pure
helper**:

1. **Strip** the leading frontmatter block (the first `---` … next `---`) out of
   the markdown string, so it never renders as a heading or inline text in the body.
2. **Render** the frontmatter instead as a collapsible section at the **top** of
   the rendered output, labelled "Front matter" in a quiet, smaller-than-body
   type treatment (subdued — never the large bold white heading it is today).
3. **Collapsed by default**; expanding it shows a **structured** key/value
   rendering — one row per field (`id`, `title`, `status`, `type`, `depends_on`,
   …), not a single line.

### Mechanism (decided in REFINE): native `<details>` folded into the body string

The styleguide `Drawer` renders `<${Markdown} source=${info.body} />` itself and
exposes **no slot** above the body, and ADR-0003 says consume both `Drawer` and
`Markdown` **unforked** — so there is no React seam to mount a collapsible above
the body. Resolution: the `Markdown` primitive runs
`marked.parse(source, { gfm: true })` and injects via `dangerouslySetInnerHTML`,
so it **passes raw HTML through**. The helper therefore emits a native, token-styled
`<details><summary>Front matter</summary>…</details>` block and **prepends it to
the stripped body string**. Native `<details>` gives collapse-by-default
(no `open` attribute) and toggle for free — no React state, no Drawer fork, no
`Markdown` fork, **no design-system child task**, and the *same composed string*
flows through both the `Drawer` (slide-over) and the direct `Markdown`
(main-pane reader).

### Shape

- New pure module `dashboard/app/frontmatter.js`, unit-tested under `node --test`:
  - `parseFrontmatter(raw)` → `{ fields: Array<[key, value]>, body: string }`.
    No frontmatter (no leading `---`) → `{ fields: [], body: raw }`. A
    hand-rolled flat key/value parse over the first `---`…`---` block; values are
    kept as their trimmed raw string (`[]`, `[design-system-001-styleguide]`,
    `feature` …) — no YAML dependency, no nested parsing.
  - `frontmatterSection(fields)` → HTML string: the token-styled `<details>` with
    a one-row-per-field table; **`""` when `fields` is empty**. Keys and values are
    **HTML-escaped** before embedding (no injection, no broken table).
  - `withFrontmatterSection(raw)` → `frontmatterSection(fields) + body`: the one
    call both surfaces use.
- Wire it in at the two render boundaries:
  - **slide-over** — apply `withFrontmatterSection` to the fetched body before it
    becomes the Drawer item's `body` (the `_Loading…_` / error bodies have no
    frontmatter, so they pass through unchanged).
  - **main-pane reader** — apply `withFrontmatterSection` to the fetched body
    before `<${Markdown} source=...>`.

The `Drawer` and `Markdown` primitives stay **unforked** (ADR-0003): all
splitting, parsing and the collapsible affordance are dashboard-local.

## Acceptance criteria
- [ ] On **both** the task slide-over **and** the main-pane reader, the YAML
      frontmatter block no longer appears anywhere in the **rendered body** — no
      setext heading, no inline `key: value` text.
- [ ] A collapsible section labelled **"Front matter"** sits **above** the
      rendered body, in a quiet/subdued, smaller-than-body type treatment (not
      large, not bold-white).
- [ ] The section is **collapsed by default**; activating it expands (and
      activating again collapses) the frontmatter view (native `<details>`).
- [ ] Expanded, the frontmatter renders as a **structured** key/value layout —
      one row per field — not a single concatenated line.
- [ ] List/array values (e.g. `depends_on: []`, `tags: [...]`) and empty values
      render readably (never `[object Object]`, never a throw); key/value text is
      HTML-escaped (no markup injection from field contents).
- [ ] The styleguide `Drawer` and `Markdown` primitives are consumed **unforked**
      (ADR-0003); all frontmatter parsing/stripping/rendering is dashboard-local;
      **no** design-system child task is filed.
- [ ] A document with **no** frontmatter renders exactly as today on both surfaces
      (no empty "Front matter" section, no error).
- [ ] `parseFrontmatter` / `frontmatterSection` / `withFrontmatterSection` are
      **pure** and covered by `node --test` (with frontmatter, without, empty/array
      values, escaping); dashboard `dist/` rebuilt (derived artifact); existing
      tests stay green.

## Notes
- **Root cause** is the shared render path, upstream of the primitive: both
  `slide-over.js` (via the Drawer) and `main-pane-reader.js` hand the raw
  `/api/doc` body straight to the styleguide `Markdown` (`primitives.js` →
  `marked.parse(source)`), which setext-heading-ifies the `key: value` block. The
  fix is a pre-`Markdown` split applied at both boundaries.
- **Decisions taken in REFINE (2026-06-15):**
  - *Scope* — fix **both** surfaces with one shared helper (the main-pane reader,
    aw-027, leaks ADR/README frontmatter identically; aw-039's future full-screen
    task view inherits the fix for free since it reuses `MainPaneReader`).
  - *Mechanism* — **native `<details>` folded into the body string** (above),
    over the alternative of adding a Drawer body-header slot via a design-system
    child task. Chosen because it keeps both primitives unforked, adds no
    cross-BC dependency, needs no React state, and fixes both surfaces with one
    string transform. This **supersedes** the old "where does the collapsible
    live — board-local React component vs design-system primitive?" open question
    and the aw-014 React-collapsible precedent: native `<details>` needs neither.
- **Pure helper, unit-tested**, matching the BC's pure-helper precedent
  (`board-sort.js`, `slide-over-data.js`, `confetti-launch.js`). Hand-rolled flat
  key/value parse — **no YAML dep** unless a future need for nested structures
  appears.
- **Quiet styling** comes from token-referencing **inline styles** on the emitted
  `<details>`/`<summary>`/table (`var(--fg-3)`, smaller `font-size`, mono for
  values), since marked passes the `style=` attributes through verbatim — this is
  how "subdued, not bold-white" is achieved without touching the `.prose` CSS or
  forking `Markdown`.
- **Prior art:** agentic-workflow-007 built the slide-over + client-side
  `Markdown` renderer; agentic-workflow-027 built the main-pane reader over the
  same primitive. This task changes how both treat the frontmatter. See ADR-0010
  (slide-over feeds the Drawer a doc-shaped item), ADR-0021 (open-intent split:
  tasks → slide-over, docs → main pane), ADR-0003 (styleguide consumed unforked).

## Outcome
A document's leading YAML frontmatter no longer renders as a bold setext heading
on either dashboard render surface. One shared pure helper now runs upstream of
the styleguide `Markdown` primitive on both.

- **NEW `dashboard/app/frontmatter.js`** — pure, framework-free, unit-tested under
  `node --test`:
  - `parseFrontmatter(raw)` → `{ fields: Array<[key, value]>, body }`. Recognises
    frontmatter only when the very first line is `---` with a later closing `---`;
    a mid-document rule, an unterminated opener, or no opener all pass through as
    body (no throw, no document-swallowing). Values kept as trimmed raw strings —
    no YAML dep, no nested parsing.
  - `frontmatterSection(fields)` → token-styled, collapsed-by-default native
    `<details><summary>Front matter</summary>` with a one-row-per-field table;
    keys/values HTML-escaped; `""` when no fields.
  - `withFrontmatterSection(raw)` = `frontmatterSection(fields) + body` — the one
    call both surfaces use.
- **`dashboard/app/slide-over.js`** — fetched body folded through
  `withFrontmatterSection` before `intentToDrawerItem` (success path only; the
  loading/error bodies and aw-039's `onOpenFullScreen` Drawer thread untouched).
- **`dashboard/app/main-pane-reader.js`** — fetched body folded through
  `withFrontmatterSection` at the `<${Markdown} source=...>` boundary.
- `Drawer` and `Markdown` consumed **unforked** (ADR-0003); all parsing/stripping/
  rendering is dashboard-local; no design-system child task filed.

Quiet styling rides on token-referencing inline `style=` attributes (`var(--fg-3)`,
`var(--fg-4)`, smaller font-size, mono values) that `marked` passes through verbatim
— never an `<h*>` that `.prose` paints large+bold+white. No ADR written: the
mechanism (native `<details>` folded into the body string) was decided in REFINE
and is fully constrained by ADR-0003/0010/0021; no new architectural decision.

Tests: NEW `dashboard/test/frontmatter.test.mjs` (18 cases — with/without frontmatter,
empty/array values, HTML-escaping, no-frontmatter passthrough, plus source-reading
wiring guards on both boundaries). Full dashboard suite green (393 tests). `dashboard/dist/`
rebuilt via `node build.mjs` (the "Front matter" label is present in the bundle).

Key files: `dashboard/app/frontmatter.js`, `dashboard/app/slide-over.js`,
`dashboard/app/main-pane-reader.js`, `dashboard/test/frontmatter.test.mjs`.
</content>
</invoke>
