---
id: agentic-workflow-039
title: Slide-over "Open in full screen" renders the task in the main content pane
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-16
commit: f289c29
depends_on: [design-system-009, design-system-001]
blocks: []
tags: [dashboard, frontend, ui, slide-over, main-pane]
related_adrs: [0021, 0010, 0003]
related_research: []
prior_art: [agentic-workflow-027, agentic-workflow-007]
---

## Why

When a board ticket is clicked, the slide-over (`dashboard/app/slide-over.js`) opens with two
useless icon buttons at the top — inherited from the styleguide `Drawer` header. design-system-009
fixed the styleguide side (done, committed `96bd905`): it dropped the Copy button and turned
"Open in editor" into an **"Open in full screen"** action backed by a bare optional
`onOpenFullScreen()` callback (rendered only when the consumer supplies it). This task wires that
callback so the dashboard does something useful with it: render the ticket **in the main content
pane** — the same surface that already shows non-task documents (BC READMEs, vision, ADRs,
research) via the `MainPaneReader` (agentic-workflow-027). The slide-over is cramped
(`min(560px, 78%)`); a task's body deserves the full reading column when the builder asks for it.

## What

Wire the slide-over's "Open in full screen" action through to the main pane:

- The slide-over (`slide-over.js`) accepts an `onOpenFullScreen` prop and **threads it to the
  styleguide `Drawer`** (the prop ds-009 added). It does **not** need to pass the task back up — the
  callback is bare (`onOpenFullScreen()`, ds-009 settled), and the **shell already owns the open
  task** (`openIntent`).
- The shell (`DashboardApp`, `board.js`) defines the handler over its existing state — verified
  against the live code, the two states it names already exist (`board.js:1118-1132`):

  ```js
  const onOpenFullScreen = useCallback(() => {
    setSelectedDoc(openIntent);  // promote the open task into the main pane
    setOpenIntent(null);         // and close the slide-over
  }, [openIntent]);
  ```

  It passes this handler to `<SlideOver … onOpenFullScreen=${onOpenFullScreen} />`. The main pane
  already renders `selectedDoc ? MainPaneReader : DashboardBoard` (`board.js:1166-1168`), so feeding
  the task into `selectedDoc` renders it there with **no change to the render branch**.
- The main pane uses **one fetch mechanism** (`docUrl` / `GET /api/doc`) and the existing render
  target: `MainPaneReader` consumes only `doc.path` (+ `doc.id` for the rail edge). A task intent
  carries a real on-disk `path` and an `id` (from `/api/tree`, board-data.js), so it **feeds the
  reader directly — no shape adapter**. The task's `id` won't match any rail row (the rail is
  non-task documents only), so no rail item lights up — harmless and correct.
- This is a **deliberate per-action override of the ADR-0021 open-intent split**: that split routes a
  task (carries `status`) to the slide-over and a non-task doc to the main pane. "Open in full
  screen" is an **explicit user action** that puts a *task* in the main pane anyway. `isTaskIntent`
  still governs the *default* click routing (`onOpen`); this is the explicit exception, expressed as
  a separate shell handler, not a change to `isTaskIntent`.

The dashboard stays **read-only** (ADR-0017): opening a task full-screen performs no write and does
not alter the board projection. Returning to the board uses the existing **Board** rail item
(`onSelectBoard` → clears `selectedDoc`, already works for a task held in `selectedDoc`).

## Acceptance criteria

- [ ] The slide-over header shows **no** Copy button and an **"Open in full screen"** action (inherited from design-system-009).
- [ ] Clicking **"Open in full screen"** renders the open task in the **main content pane** — the same surface ADRs / decisions / non-task docs render in (`MainPaneReader`) — and **closes the slide-over**.
- [ ] The full-screen task view fetches `GET /api/doc?path=` for the task and renders markdown client-side through the styleguide `Markdown` primitive, consumed unforked (ADR-0003) — reusing the existing one fetch mechanism (`docUrl`).
- [ ] The **Board** rail item returns the main pane to the board (clears the full-screen task selection), exactly as it does for a non-task document — no new control is added for this (see Notes).
- [ ] Default click routing is unchanged: clicking a board card still opens the slide-over; clicking a rail document still opens the main pane. The full-screen path is an explicit per-action override of ADR-0021, not a change to `isTaskIntent` / the default split.
- [ ] The dashboard remains read-only; opening a task full-screen performs no write and does not alter the board projection.
- [ ] Covered by **source-reading static guards under `node --test`** (the repo idiom; ds-009 precedent): assert `slide-over.js` forwards `onOpenFullScreen` to the `Drawer`, and the shell wires a handler that sets the main-pane selection from `openIntent` and clears `openIntent`. **No pure module is extracted** — the transition is two `setState` calls in the shell, not domain logic (unlike `intent-route.js`).
- [ ] Dashboard `dist/` rebuilt (`cd dashboard && node build.mjs` — derived artifact); existing tests stay green.

## Notes

- **Open modeling question — resolved (refine 2026-06-16):** the main pane needs **no** "back to
  slide-over" control and **no** "which task is shown" marker. **Reuse `MainPaneReader` as-is.** The
  existing path is enough: the **Board** rail item returns to the board, and clicking the card again
  re-opens the slide-over (`onOpen` → `isTaskIntent` true → back to `openIntent`). Lightest option,
  ships exactly the documented seam.
- **The seam (verified against live code):** the two mutually-exclusive shell selection states
  (`openIntent` → slide-over, `selectedDoc` → main pane, aw-027) are the natural seam, and the shell
  already holds `openIntent` in scope (`board.js:1118-1132`). "Open in full screen" moves the task
  from the first state to the second — `setSelectedDoc(openIntent); setOpenIntent(null)`. No task
  needs to travel back through the Drawer's bare callback.
- `MainPaneReader` takes a `doc` and renders `doc.path` (a mono header line) + `Markdown(body)`. A
  task intent carries `path`, `id`, `title`, `status`, `type` — fed directly; the path-header reads
  sensibly for a task path (it just shows the on-disk path). **Relates to aw-043** (todo): until that
  ships, a task rendered in the main pane shows its **raw frontmatter** at the top of the body (marked
  renders `---` as an `<hr>` + the `key: value` lines as a paragraph) — aw-043 will hide that behind a
  collapsible structured section in both the slide-over and the main pane. Not a blocker for aw-039;
  the title is still visible, just unstyled, until aw-043.
- **Dependency met:** design-system-009 is **done / committed** (`96bd905`) and the styleguide gate it
  reopened was handled with that task. design-system-001 (styleguide) is approved. Frontend gate
  satisfied — this task is now promoted to `todo`.
- Relates to **ADR-0021** (the open-intent split this action deliberately overrides) — worth a line
  in that ADR's Related/Update during work if the override is load-bearing.

## Outcome

The slide-over's "Open in full screen" action (ds-009's bare `onOpenFullScreen` Drawer callback) now
promotes the open task out of the cramped slide-over and into the main content pane — the same
surface non-task documents render in via `MainPaneReader` (aw-027). The seam was exactly the two
mutually-exclusive shell selection states: the handler is `setSelectedDoc(openIntent); setOpenIntent(null)`.
No pure module extracted, no shape adapter (a task intent already carries a real on-disk `path` + `id`),
no write (ADR-0017). It is a deliberate per-action override of the ADR-0021 split — the default
`isTaskIntent` click routing is untouched. The **Board** rail item returns to the board, and clicking
the card re-opens the slide-over — the existing paths suffice, no new control added.

Key files:
- `dashboard/app/slide-over.js` — `SlideOver` accepts `onOpenFullScreen` and threads it to the
  styleguide `Drawer` (consumed unforked, ADR-0003).
- `dashboard/app/board.js` — `DashboardApp` defines the `onOpenFullScreen` handler over its existing
  `openIntent`/`selectedDoc` states and passes it to the mounted `<SlideOver>`.
- `dashboard/test/slide-over-full-screen.test.mjs` (NEW) — 5 source-reading static guards (the repo
  idiom): forwarding the prop to the Drawer, the shell handler's two setState calls, the SlideOver
  receiving it, the override NOT touching `isTaskIntent`, and read-only.
- `dashboard/dist/` rebuilt (`node build.mjs`); full dashboard suite 375 green.
- ADR-0021 Related note records the override; BC README Slide-over entry updated.

Note (aw-043, todo): until that ships, a task rendered in the main pane shows its raw frontmatter at
the top of the body — expected, not a blocker (the title is still visible, just unstyled).
</content>
</invoke>
