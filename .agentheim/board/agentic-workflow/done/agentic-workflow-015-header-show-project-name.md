---
id: agentic-workflow-015
title: Show the project name next to "Agentheim" in the dashboard header
status: done
type: feature
context: agentic-workflow
created: 2026-06-08
completed: 2026-06-09
commit: eaacf67
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, projection]
related_adrs: [0002]
related_research: []
prior_art: [agentic-workflow-005, agentic-workflow-013]
---

## Why
Agentheim is a plugin installed once and used across many projects. When the builder
launches `/dashboard` inside a consumer repo, nothing on screen says *which* project's
`.agentheim/` is being viewed — the header reads "Agentheim" identically everywhere.
Showing the current project's name disambiguates at a glance which project you're in.

## What
In the dashboard header (`ShellRail` in `dashboard/app/board.js`), render the current
project's name next to the "Agentheim" wordmark, as `Agentheim · <project>` — the
project name in muted, slightly smaller text on the same baseline (separator-dot
treatment, design-system tokens, no new styleguide pattern).

The project name is the text of the `# Vision: <name>` heading in the project's
`.agentheim/vision.md`. It reaches the frontend by **extending the `/api/tree`
projection** (`dashboard/tree.mjs`) with a small `project: { name }` metadata field,
parsed server-side. This keeps it on the one fetch the dashboard already makes and lets
it ride the existing SSE re-projection. It follows the precedent set by `mtimeMs`
(aw-013): a single derived value, not a document body — the projection's
"pointers + metadata only, never document bodies" contract (ADR-0002) still holds. The
nuance worth naming: this is the first projection field extracted from a markdown
**body** (a heading) rather than frontmatter, so the worker must keep it to exactly one
trimmed string and not start shipping body content through the projection.

## Acceptance criteria

**Projection (`dashboard/tree.mjs`)**
- [ ] `/api/tree` includes a `project: { name }` field where `name` is the trimmed text
      following `# Vision:` in the project's `vision.md`.
- [ ] When `vision.md` is missing, or present but has no `# Vision: <name>` heading,
      `project.name` is `null` — the tree walk never aborts (loss-tolerant, same ethos
      as malformed-frontmatter handling).
- [ ] No document body is added to the projection — only the single extracted name
      string (the body-free contract from ADR-0002 still holds).

**Header (`dashboard/app/board.js` → `ShellRail`)**
- [ ] When `project.name` is present, the header renders `Agentheim · <name>` with the
      name in muted, slightly smaller text on the same baseline, using existing
      design-system tokens (e.g. `--fg-3`/`--fg-4`) — no new styleguide component.
- [ ] When `project.name` is `null`/absent, the header shows only "Agentheim" exactly as
      today — no separator dot, no trailing gap.

**Tests**
- [ ] Unit coverage for the vision-name parse: heading present, heading absent,
      `vision.md` missing, and a heading with surrounding whitespace / trailing content.
- [ ] The existing tree-projection tests still pass; a case asserts `project.name` is
      populated and `null` as specified.

## Notes
- **Where the shell sources the name (small implementation choice for the worker):**
  today only `DashboardBoard` fetches `/api/tree`; the shell (`DashboardApp` →
  `ShellRail`) renders without data. The worker decides how `ShellRail` gets
  `project.name` — e.g. a minimal read in `DashboardApp` (a small `useProjectName`-style
  fetch of `/api/tree`) passed down to `ShellRail`. Live-refresh on SSE is acceptable but
  not required: the vision name is effectively static within a session, so a one-time
  read on mount is fine.
- **Prior art / contract:** aw-005 created the tree projection (`/api/tree`,
  `dashboard/tree.mjs`); aw-013 added `mtimeMs` to it — the direct precedent for adding a
  derived metadata field. ADR-0002 holds the projection's transport-vs-body contract.
- **Styleguide gate:** frontend task → `depends_on: [design-system-001]` (approved/done,
  so the gate is satisfied).

## Outcome
Extended the `/api/tree` projection with a derived `project: { name }` metadata field,
parsed server-side from `vision.md`'s `# Vision: <name>` heading via a new
`parseProjectName(text)` export in `dashboard/tree.mjs`. Missing/headingless/empty heading
degrades to `null` and never aborts the walk — mirroring the malformed-frontmatter and
aw-013 `mtimeMs` graceful-degradation posture. It is exactly one trimmed string, so ADR-0002's
"pointers + metadata only, never document bodies" contract still holds (the first projection
value drawn from a markdown body rather than frontmatter). No ADR/addendum (additive,
backward-compatible, consistent with the aw-013 precedent).

The dashboard header now renders `Agentheim · <name>` in `ShellRail` (`dashboard/app/board.js`):
the name in muted, slightly smaller text (`--fg-3`, 13.5px) on the same baseline with a
`--fg-4` separator dot, using existing design-system tokens — no new styleguide component. When
`project.name` is `null`/absent the header shows only "Agentheim", with no separator and no
trailing gap. `DashboardApp` sources the name via a one-time `/api/tree` read on mount (the
vision name is static within a session) and passes it down to `ShellRail`.

Key files: `dashboard/tree.mjs` (parse + projection), `dashboard/app/board.js`
(`ShellRail`/`DashboardApp` header), `dashboard/test/tree.test.mjs` (parse + projection cases),
`dashboard/dist/` (rebuilt bundle). Full suite green (177 tests). BC README's Tree-projection
entry documents the new field.
</content>
</invoke>
