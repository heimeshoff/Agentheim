---
id: agentic-workflow-040
title: Main-pane document reader centers its reading column in the content area
status: done
type: bug
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: b5b663b
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, ui, main-pane, reader]
related_adrs: [0021, 0003]
related_research: []
prior_art: [agentic-workflow-027]
---

## Why

When the builder clicks a non-task document in the rail (vision, context map, BC
README, ADR, research), the `MainPaneReader` (agentic-workflow-027) renders it
flush against the **left edge** of the main content area. The reader already
constrains the text to a comfortable measure (`maxWidth: 760`) for readability,
but the constrained column is pinned left, leaving a wide empty gutter on the
right and an unbalanced page. The builder wants the reading column **centered**
in the content area.

## What

In `dashboard/app/main-pane-reader.js`, the rendered `<article>` carries
`maxWidth: 760` but no horizontal centering, so it sits at the left of its
parent. Center the constrained reading column **horizontally** within the main
content area (the natural fix is `margin: "0 auto"` on the `<article>`), keeping
the existing `maxWidth` measure so line length stays comfortable.

This is the reader's own board-local layout wrapper — the styleguide `Markdown`
primitive stays consumed unforked (ADR-0003); no design-system change and no
design-system child task.

Scope note: this is horizontal centering of the reading column only — not
center-*aligned* text, and not vertical centering.

## Acceptance criteria

- [ ] A non-task document opened in the main pane renders with its reading
      column **horizontally centered** in the content area (balanced left/right
      gutters), not flush left.
- [ ] The existing `maxWidth` measure is preserved — text is centered as a block,
      paragraph text is **not** center-aligned.
- [ ] The styleguide `Markdown` primitive remains consumed unforked (ADR-0003);
      no styleguide / design-system change.
- [ ] Dashboard `dist/` rebuilt (derived artifact); existing tests stay green.

## Notes

The wrapper to change is the `<article style=${{ maxWidth: 760 }}>` in
`dashboard/app/main-pane-reader.js` (the path-header `<div>` and the `<${Markdown}>`
both live inside it, so centering the article centers the whole reading column,
header included).

Relates to **agentic-workflow-039** (slide-over "Open in full screen" also feeds
`MainPaneReader`) — that path benefits from the same centering for free once this
lands.

## Outcome

Centered the main-pane reading column horizontally by adding `margin: "0 auto"` to
the `<article>` wrapper in `dashboard/app/main-pane-reader.js`, keeping the existing
`maxWidth: 760` measure. Block centering only — paragraph text stays left-aligned, no
vertical centering. The path header and `<${Markdown}>` both live inside the article,
so the whole reading column (header included) centers as one. The styleguide `Markdown`
primitive stays consumed unforked (ADR-0003); no design-system change.

Extended the static guard in `dashboard/test/main-pane-reader.test.mjs` to assert the
article carries `margin: "0 auto"`, preserves `maxWidth: 760`, and does NOT center-align
text. Rebuilt `dashboard/dist/` (`node build.mjs`). Full `node --test` suite green (351
tests).

Key files:
- `dashboard/app/main-pane-reader.js` — the `<article>` centering change
- `dashboard/test/main-pane-reader.test.mjs` — the centering guard
- `dashboard/dist/` — derived artifact rebuilt
