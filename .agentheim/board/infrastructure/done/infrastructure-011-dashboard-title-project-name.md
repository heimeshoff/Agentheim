---
id: infrastructure-011
title: Dashboard browser tab title reflects the discovered project's name
status: done
type: feature
context: infrastructure
created: 2026-06-14
completed: 2026-06-14
commit: 6985ee7
depends_on: []
blocks: []
tags: [dashboard, runtime, project-discovery]
related_adrs: [0002]
related_research: []
prior_art: []
---

## Why
The dashboard can be pointed at any project (project discovery walks up for
`.agentheim/`), but its browser tab title is hard-coded to `Agentheim — Dashboard`
(`dashboard/build.mjs:60`, baked into the committed `dist/index.html`). A builder
running the dashboard against their own project sees Agentheim's name, not theirs —
the tab lies about which project is on screen. The title should name the project the
dashboard is actually serving.

## What
Make the served dashboard's browser tab `<title>` read **`<ProjectName> — Dashboard`**,
where `ProjectName` is the discovered project's name, resolved at runtime (not baked at
build time, since the project is only known once project discovery resolves the
`.agentheim/` root).

Project-name source (decided with the builder, 2026-06-14):
1. Primary: the `# Vision: <Name>` heading in the discovered project's
   `.agentheim/vision.md` (human-authored, correct casing — e.g. `Agentheim`).
2. Fallback: the project root folder name (`path.basename(root)`) when `vision.md` is
   missing or has no `# Vision:` heading.

The ` — Dashboard` suffix/format is preserved, so against the Agentheim repo itself the
tab stays `Agentheim — Dashboard` (no visible change at home), while a foreign project
named "Books" shows `Books — Dashboard`.

## Acceptance criteria
- [x] When the dashboard is pointed at a project whose `vision.md` begins `# Vision: Books`, the browser tab title reads `Books — Dashboard`.
- [x] When pointed at the Agentheim repo itself, the tab still reads `Agentheim — Dashboard`.
- [x] When `vision.md` is absent or has no `# Vision:` heading, the title falls back to `<folder-basename> — Dashboard`.
- [x] The ` — Dashboard` suffix and overall format are unchanged from today.
- [x] No new install step, dependency, or runtime CDN is introduced — respects ADR-0002 (Node-stdlib static serve, no deps) and ADR-0003 (committed `dist/`).
- [x] Tests cover: name parsed from the vision heading, fallback to folder name when the heading is missing, and the suffix preserved.

## Notes
- Current hard-coded source: `dashboard/build.mjs:60` → `<title>Agentheim — Dashboard</title>`,
  emitted into the committed `dashboard/dist/index.html`. That baked literal becomes a
  template/placeholder once the title is dynamic.
- Implementation options for the worker/orchestrator (decide via TDD):
  - **Server-side injection (preferred — no flash):** the runtime reads the vision
    name (at startup or per request) and rewrites the `<title>` of the served
    `dist/index.html` before sending. The static handler currently streams `dist/`
    verbatim (ADR-0002); injecting the title means a small transform of the index
    response only — keep traversal/validation guarantees intact.
  - **Client-side:** expose the project name over an API (extend `/api/tree` or add a
    tiny `/api/project`) and set `document.title` on load. Simpler, but flashes the
    baked default before the fetch resolves.
- The project name comes from **project discovery** (the already-resolved absolute
  `root` in `server.mjs`), so this is squarely an infrastructure/runtime concern, not a
  styleguide one — the `<title>` is page metadata, not a visible styled component, so
  the design-system styleguide gate does not apply.
- Keep parsing lenient: tolerate leading whitespace and the exact `# Vision:` prefix
  used by `brainstorm`'s vision template; trim the captured name.

## Outcome
The dashboard browser-tab `<title>` now names the project the runtime is actually
serving. Implemented via **server-side injection** (the builder's no-flash preference):
`GET /` and `GET /index.html` route to a new `serveIndexHtml` transform that rewrites the
served `dist/index.html`'s `<title>` to `<ProjectName> — Dashboard` before sending; every
other asset still streams verbatim, and the transform reuses the same in-root path
resolver, so ADR-0002's traversal/validation guarantees are intact.

`ProjectName` resolution is a small pure module, unit-tested directly:
- Primary: the `# Vision: <Name>` heading in the discovered project's `.agentheim/vision.md`
  (lenient parse — tolerates leading whitespace, trims the name, preserves human casing).
- Fallback: `path.basename(root)` when `vision.md` is missing or carries no heading.

Against the Agentheim repo itself the tab stays `Agentheim — Dashboard` (no visible change
at home). Zero new deps / install step / CDN — stdlib only (ADR-0002 / ADR-0003). The
committed `dist/index.html` keeps a baked default title (only seen if injection is bypassed)
and stays reproducible via `cd dashboard && npm install && npm run build` (verified;
`dist/` regenerated).

Key files:
- `dashboard/project-name.mjs` (new) — `parseVisionName`, `resolveProjectName`, `dashboardTitle`, `injectTitle`.
- `dashboard/static.mjs` — added `serveIndexHtml` (index-only title transform).
- `dashboard/server.mjs` — routes `/` and `/index.html` to the transform.
- `dashboard/build.mjs` — documented the title as a runtime-injected default (no behavior change).
- `dashboard/test/project-name.test.mjs` (new, 12 tests) + `dashboard/test/server.test.mjs` (2 new integration tests).

Tests: full dashboard suite green — 210 passing, 0 failing (was 198).
