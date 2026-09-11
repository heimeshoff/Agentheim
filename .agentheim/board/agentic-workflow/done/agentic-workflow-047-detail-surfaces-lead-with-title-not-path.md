---
id: agentic-workflow-047
title: Both detail surfaces lead with the item title, not the file path
status: done
type: feature
context: agentic-workflow
created: 2026-06-16
completed: 2026-06-16
commit: fe4d6b4
depends_on: [design-system-001, design-system-014]
blocks: []
tags: [dashboard, slide-over, main-pane-reader, typography]
related_adrs: [0021, 0010, 0003]
related_research: []
prior_art: [agentic-workflow-040, agentic-workflow-027, agentic-workflow-007]
---

## Why
When you open an item's details, the top of the panel leads with the raw file
path, not the item's title. The path is plumbing — it tells you *where the file
lives*, not *what you're reading*. The first thing the eye lands on should name
the item.

Both detail surfaces have this problem:
- **Slide-over Drawer** — the contextual header shows a type pill and, below it,
  the path in small (11.5px) quiet (`--fg-3`) monospace. There is no title: in
  the live dashboard `intentToDrawerItem` (`slide-over-data.js:50`) builds a
  doc-shaped item `{ type, meta, body }` with **no title field at all**, so the
  Drawer has nothing to render even if its header wanted to.
- **Main-pane reader** — leads with the same path line (`main-pane-reader.js:82-85`).

## What
This is the dashboard (consumer) half of the change. The styleguide Drawer
gaining a title heading is **design-system-014**; this task feeds it the title
and fixes the dashboard-owned reader.

1. **Thread the title into the Drawer item.** `intentToDrawerItem`
   (`dashboard/app/slide-over-data.js`) carries the intent's `title` onto the
   doc item so the styleguide Drawer header (ds-014) can render it. The intent
   already carries a `title` (board cards and library rows both have one).
2. **Main-pane reader shows the title.** In `dashboard/app/main-pane-reader.js`,
   replace the monospace path line at the top of the article (`82-85`) with
   `doc.title`, given **stronger contrast** (`--fg-1` rather than `--fg-3`) and a
   **larger font** than the current 11.5px, using styleguide tokens.
3. **Rebuild `dashboard/dist/`** (`cd dashboard && node build.mjs`) so the live
   surfaces pick up the bundled Drawer change from ds-014.

## Acceptance criteria
- [ ] Opening a task in the slide-over shows the item's title at the top of the header (rendered by ds-014), fed from the intent via `intentToDrawerItem`.
- [ ] Opening a document in the main content pane shows `doc.title` at the top, not `doc.path`.
- [ ] On both surfaces the title has clearly stronger contrast than the old path line (e.g. `--fg-1`) and a clearly larger font than the old 11.5px.
- [ ] Typography uses styleguide tokens (UI font + an existing foreground token), consistent with the consume-unforked doctrine (ADR-0003) — no bespoke hex or one-off font stack.
- [ ] The path is no longer the prominent header on either surface. Demoting it to a quiet sub-line under the title is acceptable; the slide-over may keep the path as the existing quiet sub-line beneath the new title.
- [ ] The main-pane error state (`main-pane-reader.js:74`) may keep showing the path for diagnostics — that's fine; this task is only about the ready-state header.
- [ ] `dashboard/dist/` is rebuilt so the live slide-over actually shows the title. Dashboard test suite stays green.

## Notes
- **Depends on design-system-014** for the slide-over half — that task adds the title heading to the styleguide Drawer's contextual header and demotes the path to a sub-line. This task supplies the title data and rebuilds the bundle. The main-pane-reader half is independent dashboard code but is bundled here too.
- Current slide-over header: `drawer.js` `HeaderContextual` (`67-93`) — TypePill, then `info.path` (mono, `--fg-3`). In the live dashboard everything renders on the `doc` branch of `describeItem` (no `status` is threaded), so the title must arrive via the doc item's new title field.
- Current main-pane header: `main-pane-reader.js:82-85` — flex row, `font-mono`, `fontSize: 11.5`, `color: var(--fg-3)`, content `${doc.path}`.
- `doc.title` / `intent.title` is the library-data / board item title (the open-intent shape).
- Prior art in the same files: aw-007 (built the slide-over + intentToDrawerItem), aw-027 (built the main-pane reader and its path-at-top line), aw-040 (centered the reading column).

## Outcome
Both dashboard detail surfaces now lead with the item title; the path is demoted to a quiet
mono sub-line. The dashboard (consumer) half only — the styleguide Drawer title heading shipped
in ds-014.

- **Slide-over** — `intentToDrawerItem` (`dashboard/app/slide-over-data.js`) now threads
  `intent.title` onto the doc-shaped item as `title`, which the styleguide Drawer's
  `describeItem` doc branch reads and `HeaderContextual` renders as the leading heading
  (ds-014). Empty-string fallback for a title-less intent so the Drawer falls back to the path.
- **Main-pane reader** — `dashboard/app/main-pane-reader.js` ready-state header replaced its
  mono `doc.path` line with an `<h1>` leading on `doc.title` (`--font-ui`, 21px, weight 600,
  `--fg-1`), demoting `doc.path` to a quiet `--font-mono` 11.5px `--fg-3` sub-line beneath it.
  The error state still shows the path for diagnostics, as the task allowed.
- **Bundle** — `dashboard/dist/` rebuilt (`node build.mjs`), folding in both the threaded title
  and ds-014's committed Drawer change.

Styleguide tokens only, no bespoke hex (ADR-0003). Tests: 3 added (1 main-pane static guard,
2 slide-over-data unit cases + an assertion on the existing case); full dashboard suite 398 green
including the dist-build test. No ADR needed — pure consumption of the existing ADR-0021/0010/0003
shape plus the ds-014 capability. Key files: `dashboard/app/slide-over-data.js`,
`dashboard/app/main-pane-reader.js`, `dashboard/dist/app.js`.
