---
id: agentic-workflow-001
title: Dashboard — local web UI over the project's .agentheim folder
status: done
type: feature
context: agentic-workflow
created: 2026-06-05
completed: 2026-06-06
commit: 8af5748
depends_on: [agentic-workflow-004, agentic-workflow-005, agentic-workflow-006, agentic-workflow-007, agentic-workflow-008, agentic-workflow-009]
blocks: []
tags: [dashboard, ui, frontend, web, kanban, epic]
related_adrs: [ADR-0001, ADR-0002, ADR-0004]
related_research: []
prior_art: []
---

## Why

The builder works the agentic workflow through markdown files scattered across
`.agentheim/` — tasks in four lifecycle folders per BC, plus the vision, context map, BC
READMEs, research reports, and ADRs. There is no at-a-glance view of project state and no
easy way to browse or discover this knowledge. A dashboard turns the file tree into a
navigable, discoverable overview without the builder having to open files by hand.

## What

A new `dashboard` skill/command. When invoked, it starts a local web server **in that
terminal**, serving a UI over the `.agentheim/` folder of whichever project the plugin is
being used in. The UI provides:

- A **Kanban board** of tasks across the lifecycle columns (`backlog` / `todo` / `doing` /
  `done`), drawn from every BC.
- A **right-hand slide-over panel** (Notion-style, animated in from the right) that is the
  universal detail view: clicking a task card opens that task's rendered markdown in the
  panel.
- The same slide-over for **every other markdown artifact** — BC READMEs, the vision, the
  context map, research reports, and ADRs — so clicking any of them opens its rendered
  markdown in the panel.
- **Navigation** that makes all of these artifacts discoverable and easy to browse.

**v1 is interactive (write-back), scoped to a single move.** Dragging a task card from the
`backlog` column to `todo` performs a **Promote** — the only UI-initiated Task move in v1
(per agentic-workflow-002). All other transitions (claim, complete, backward moves) stay
skill-driven and are non-drop in the UI. Everything else the UI shows is read-rendered.

This is the first UI in Agentheim, and **this task is the integration epic** — the
buildable units are its children (agentic-workflow-004…009). It closes only when all of them
are `done` and the end-to-end flow works: launch → board → slide-over → live-update → Promote.

## Acceptance criteria (integration / end-to-end only)

- [x] All child tasks land `done`: aw-004 (server bootstrap), aw-005 (read API), aw-006
      (flat board), aw-007 (slide-over + renderer), aw-008 (navigation), aw-009 (live-update +
      Promote).
- [x] Invoking `dashboard` launches the server, opens the board, and a builder can: browse every
      BC artifact, open any as rendered markdown in the slide-over, see the board live-update when
      a skill moves a file on disk, and drag `backlog→todo` to Promote.
- [x] The end-to-end flow works on the builder's Windows box. (v1 bar is Windows-only; the
      POSIX leg is carved out to agentic-workflow-010 — see Notes.)
- [x] `dashboard` is documented as a Key command of this BC.

## Notes

- **Decomposed during refinement (2026-06-06)** into six children — see them in `backlog/`:
  aw-004 server bootstrap · aw-005 read API · aw-006 flat board view · aw-007 slide-over +
  renderer · aw-008 navigation · aw-009 SSE live-update + Promote. This file is now the thin
  epic / integration gate; all leaf dependencies moved down onto the child that consumes them.
- **Resolved during refinement:**
  - *Read-only vs. interactive* → **interactive, Promote-only** (`backlog→todo` only); all other
    moves stay skill-driven. See agentic-workflow-002 / ADR-0001. (Built in aw-009.)
  - *Host/port and stop* → infrastructure-001 / ADR-0002 (localhost-only, ephemeral port +
    runfile, explicit `dashboard stop`). (Built in aw-004.)
  - *Live updates* → **live-update, not refresh-only** (2026-06-06): the server pushes disk
    changes via SSE so the board reflects skill-driven moves in near-real-time. Transport is a
    new infrastructure concern — infrastructure-003 / ADR-0004 (supersedes ADR-0002's
    request/response-only clause). Consumed in aw-009.
  - *Multiple BCs on the board* → **flat board, BC shown on the card** (2026-06-06). The earlier
    swimlane proposal was reversed; the approved flat `KanbanBoard` is used as-is, no styleguide
    re-approval. Built in aw-006. (A BC filter can be captured later if the board gets crowded.)
- **Depends on:** its six children (aw-004…009). The children carry the leaf deps —
  infrastructure-001/002/003, agentic-workflow-002/003, design-system-001/002. This epic is
  promotable only once all children are done.
- **POSIX cross-OS verification deferred (2026-06-06, builder decision).** The v1 acceptance
  bar was narrowed to the builder's Windows box because the integration pass runs from a
  Windows-only environment. The original "and at least one POSIX OS" criterion is carved out
  into the follow-up task **agentic-workflow-010** (Dashboard cross-OS verification — POSIX
  leg), which `depends_on: [agentic-workflow-001]`. v1 closes on the Windows leg; POSIX
  parity is tracked separately.

## Outcome

Epic closed on the Windows leg. All six children (aw-004…009) confirmed `done`. End-to-end
integration verified on the builder's Windows box:

- **Test suites green:** `lib/test/` 13/13 and `dashboard/test/` 100/100 (run via
  `node --test "<dir>/**/*.test.mjs"` — this Node 25 build treats a bare directory arg as a
  module path, so an explicit glob is needed).
- **Live launch/stop:** spawned the detached server (`launchDashboard`) against a throwaway
  temp `.agentheim/` fixture — neutral cwd + `AGENTHEIM_ROOT` per ADR-0004; got pid+port back;
  `stopDashboard` killed the pid and removed the runfile cleanly (no lingering lock, the real
  project's runfile was never created).
- **Endpoints exercised live (HTTP, against the fixture):** `GET /api/tree` → 200 with the
  per-BC lifecycle projection; `GET /api/doc?path=` → 200 raw markdown, and a `../` traversal
  → 403; `GET /api/events` → 200 `text/event-stream` with the SSE `hello` frame; `POST
  /api/task/move {backlog→todo}` → 200 and the task file actually moved to `todo/` with
  frontmatter rewritten (the shared `applyTaskMove`, ADR-0001); an illegal `todo→done` skip →
  422 with a structured domain reason.
- **Static assets:** served the committed `dashboard/dist/` directly — `/` (index.html),
  `/agentheim.css`, `/app.js` all 200 with correct content-types (the fixture's `/` 404 was
  only the scratch root lacking a `dist/`, not a defect).

Not automatable here and therefore not exercised live: the browser-rendered board, the
slide-over animation, and physical drag-drop. Those are covered by the children's unit/DOM-data
suites (`board-data`, `slide-over-data`, `library-data`, `live-update`, `promote`) plus the live
API + launch/stop evidence above. No integration defect found; no runtime code changed.

README updated: `dashboard` added to the Key commands of this BC.
