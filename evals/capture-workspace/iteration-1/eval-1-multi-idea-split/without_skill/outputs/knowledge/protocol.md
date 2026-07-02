# Protocol

Chronological log of everything that happens in this project.
Newest entries on top.

---

## 2026-06-08 14:32 — Idea captured (quick dump, 3 items → 3 BCs)

Builder dumped three things "so I don't forget", asked to file them without questions. Captured as
three backlog tasks, each routed to the BC that owns the concern:

- **infrastructure-007** — "Stop forgetting to bump the plugin version before a release" (chore) →
  `contexts/infrastructure/backlog/`. Plugin packaging/release discipline is a globally-true tech
  concern infrastructure stands as the home for; sibling to the existing infrastructure-006 (plugin
  release discipline) — to be reconciled on refinement.
- **design-system-004** — "Dashboard dark-mode toggle" (feature) →
  `contexts/design-system/backlog/`. Theming / visual language is design-system's; the styleguide is
  already dark-first-with-a-light-toggle, so the actual toggle and its theme tokens live here.
  Styleguide-gated (`depends_on: design-system-001-styleguide`).
- **agentic-workflow-012** — "Copy a task's id to the clipboard from its card" (feature) →
  `contexts/agentic-workflow/backlog/`. Board cards and the dashboard frontend app are this BC's;
  a card-level copy affordance is a dashboard interaction. Styleguide-gated.

All three are pure captures (status: backlog) — not refined, not promoted, no solution committed.
Per-BC INDEX.md backlog lists + counts updated. No questions asked back to the builder.

---
