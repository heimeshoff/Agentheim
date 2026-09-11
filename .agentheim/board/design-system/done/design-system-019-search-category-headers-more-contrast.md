---
id: design-system-019
title: Search results — category headers need more contrast
status: done
type: refactor
context: design-system
created: 2026-06-16
completed: 2026-06-16
commit: 6edeacc
depends_on: [design-system-001]
blocks: []
tags: [search, contrast, accessibility, styleguide]
related_adrs: [0024]
related_research: []
prior_art: [design-system-016]
---

## Why
In the global search panel, the category headers that group the results
(Bounded contexts / Decisions / Research / Tickets) sit at `var(--fg-4)` — the
*dimmest* foreground token. They're dimmer than the matched-text excerpts
(`--fg-3`) and far below the result-row titles (`--fg-1`), so the structure that
organises the results barely registers. The builder wants the category titles to
read with more contrast.

## What
Raise the contrast of the grouped-results **category header** in the `SearchField`
combobox — `styleguide/app/search.js`, the group `<div>` at the
`textTransform: "uppercase"` / `fontWeight: 600` / `color: "var(--fg-4)"` block
(currently ~line 276). The label stays a small uppercase organising header; only
its colour strengthens. It must remain quieter than the `--fg-1` result-row titles
(the headers organise, the titles are the content), but should clearly out-read the
`--fg-3` excerpt text — bumping the colour token (e.g. `--fg-4` → `--fg-2`) is the
expected shape. No layout, size, or weight change is required.

The change lives in the styleguide source, consumed unforked by the dashboard
(ADR-0003). It is a **visible styleguide change**, so it reopens the design-system
gate for builder re-review (the ds-005/007/009/014/015/016 precedent) and the
served `dashboard/dist/` must be **rebuilt** (`node build.mjs`) so the live topbar
search (agentic-workflow-052) picks it up.

## Acceptance criteria
- [ ] The search-panel category header colour in `styleguide/app/search.js` is
      raised off `var(--fg-4)` to a stronger foreground token, so the category
      titles read with noticeably more contrast.
- [ ] The category header stays quieter than the result-row titles (`--fg-1`) and
      out-reads the excerpt text (`--fg-3`) — header < title in emphasis, header >
      excerpt.
- [ ] Size, weight, uppercase, and letter-spacing of the header are unchanged
      (only the colour token changes).
- [ ] The styleguide is consumed **unforked** — no dashboard-side fork of the
      component; the dashboard inherits the change via the rebuilt `dist/`.
- [ ] `dashboard/dist/` is rebuilt (`node build.mjs`) so the live search panel
      shows the stronger headers.
- [ ] Builder re-reviews the canvas (`styleguide/index.html` → section 11, the
      Search & grouped-results specimen) and the gate is re-confirmed OPEN.

## Notes
- Exact element: `search.js`, the group header `<div role` block with
  `fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fg-4)"`.
- The precise target token is a styleguide-review call — `--fg-2` is the natural
  pick (prominent organising label, still below the `--fg-1` titles); `--fg-3`
  would be the minimum. Confirm against the live canvas.
- Pure-logic modules (`search-state.js`) are untouched; this is presentation only.
- Built on ds-016 (the SearchField pattern). See ADR-0024.

## Outcome
Raised the grouped-results **category header** colour in `styleguide/app/search.js`
(the `role="group"` header `<div>`, ~line 277) from `var(--fg-4)` (dimmest
foreground) to `var(--fg-2)`. The header now out-reads the `--fg-3` excerpts while
staying quieter than the `--fg-1` result-row titles — header < title, header >
excerpt, exactly as the criteria require. Size (10.5), weight (600), uppercase, and
letter-spacing (0.05em) are unchanged; this is colour-token-only. The panel elevation
tokens (`--shadow-md`/`--surface-1`/`--hairline`/`--radius-md`) that ADR-0024's
source-guards assert were left untouched.

Consumed unforked (ADR-0003): `dashboard/dist/` was rebuilt via `node build.mjs`, and
the `--fg-2` header verified present in the bundled `dist/app.js`, so the live
`agentic-workflow-052` topbar search renders the stronger headers.

Verification: styleguide suite (96 pass, incl. `search.test.mjs` 23) + dashboard
suite (467 pass) + `dist/` rebuild.

Key files:
- `.agentheim/contexts/design-system/styleguide/app/search.js` — header colour token
- `dashboard/dist/app.js`, `dashboard/dist/*` — rebuilt derived artifact
- `.agentheim/contexts/design-system/README.md` — gate re-review note (builder
  confirmation PENDING; the canvas re-review is a human gate not self-confirmable)
