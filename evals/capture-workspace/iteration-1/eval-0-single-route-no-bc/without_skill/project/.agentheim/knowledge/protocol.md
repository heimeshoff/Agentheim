# Protocol

Chronological log of everything that happens in this project.
Newest entries on top.

---

## 2026-06-08 14:32 — Idea captured (agentic-workflow)

**Idea captured** — `agentic-workflow-012` (feature, backlog): the dashboard board view
should remember which board column the builder last scrolled to and restore it on reopen,
instead of jumping back to the top/start every time.

- Routed to **agentic-workflow** — this is board-view UI behavior (the board + frontend app
  live in `dashboard/app/`, agentic-workflow-006), not transport plumbing.
- Created `contexts/agentic-workflow/backlog/agentic-workflow-012-dashboard-remember-scroll-column.md`
  with open questions (persistence scope, scroll vs. column snap, live-update re-render
  interaction) for a later refinement pass.
- Updated `contexts/agentic-workflow/INDEX.md` (backlog 0→1).
- Left unrefined in `backlog/`; no promotion to `todo`.

---
