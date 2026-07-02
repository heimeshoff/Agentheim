---
id: agentic-workflow-005
title: Dashboard read API — /api/tree projection and /api/doc carrier
status: done
type: feature
context: agentic-workflow
created: 2026-06-06
completed: 2026-06-06
commit: 21f0fe7
depends_on: [agentic-workflow-004]
blocks: [agentic-workflow-001]
tags: [dashboard, api, read, projection]
related_adrs: [ADR-0002]
related_research: []
prior_art: []
---

## Why

The board, the slide-over, and the navigation all render off the same on-disk truth. Rather
than each view re-walking `.agentheim/`, the server exposes one read projection they all
consume. This is the read half of ADR-0002's transport (the write half is aw-009, the live
half is infrastructure-003).

## What

Two read endpoints on the aw-004 server:

- `GET /api/tree` — walk the discovered root and project every BC, its four lifecycle folders,
  and each task's frontmatter (id, title, status, type, context, path), plus the *locations*
  of vision, context-map, BC READMEs, research reports, and ADRs. Pointers and metadata only —
  no document bodies. This is the single projection the board (aw-006) and the SSE consumer
  (aw-009) rebuild from.
- `GET /api/doc?path=<relative>` — return the raw markdown for an in-root path. Rendering stays
  client-side (aw-007); this endpoint is a validated file carrier, nothing more.

## Acceptance criteria

- [x] `GET /api/tree` returns the BC × lifecycle × task structure plus artifact locations for the
      discovered project, built from frontmatter, with no document bodies.
- [x] Each task in the tree carries its BC (`context`) and `status`, so a flat board can label
      cards by BC and sort into lifecycle columns without a second request.
- [x] `GET /api/doc?path=` returns raw markdown for a valid in-root path and rejects any escaping
      path (4xx, no file touched).
- [x] Malformed or missing frontmatter degrades gracefully — the task is still listed with
      whatever is parseable, the walk does not abort.

## Notes

- Path validation reuses the aw-004 root-resolution + `startsWith(root)` guard.
- "Disk is the source of truth; the tree is a projection" — keep this endpoint pure read; it
  never writes or interprets lifecycle moves.

## Outcome

Added the two read endpoints to the aw-004 stdlib server, reusing its root-resolution +
`startsWith(root)` path guard. No new ADR — every choice is mandated by ADR-0002.

**What landed (all under `dashboard/`):**
- `tree.mjs` — the `/api/tree` projection. Walks the discovered `.agentheim/` and returns, per
  BC, its four lifecycle folders + each task's frontmatter projection
  (`id, title, status, type, context, path`), plus the *locations* of vision / context-map /
  per-BC README+INDEX+concepts / ADRs / research. Pointers and metadata only — no bodies.
  Includes a tiny stdlib-only frontmatter parser (no YAML dep, per ADR-0002's no-`node_modules`
  rule). Missing `status`/`context` fall back to folder / BC name (disk is the source of truth);
  malformed/missing frontmatter still lists the card with a filename-derived id and never aborts
  the walk.
- `read-api.mjs` — the `/api/tree` (JSON) and `/api/doc` (raw `text/markdown`) request handlers.
  `/api/doc` validates `path` against the root (escape → 403, missing query → 400, non-file →
  404) before touching the filesystem.
- `server.mjs` — wired `GET /api/tree` and `GET /api/doc` ahead of the static fall-through.

**Tests:** `dashboard/test/tree.test.mjs` (6) + `dashboard/test/read-api.test.mjs` (6); updated
the now-obsolete aw-004 "no /api/tree (404)" assertion in `server.test.mjs` to target the still-
unbuilt write route. Full suite: **55 passing** (`node --test "dashboard/test/*.test.mjs"`).
Smoke-tested `buildTree` against this real project (3 BCs, vision pointer, 7 ADRs, this task
file visible in `doing/`).

**Downstream:** aw-006 (board), aw-007 (slide-over), aw-008 (navigation), and aw-009 (SSE
consumer) all consume this projection shape — documented in the BC README's *Tree projection*
ubiquitous-language entry.

**Key files:**
- `dashboard/tree.mjs`, `dashboard/read-api.mjs`, `dashboard/server.mjs`
- `dashboard/test/tree.test.mjs`, `dashboard/test/read-api.test.mjs`, `dashboard/test/server.test.mjs`
- `dashboard/README.md`, `.agentheim/contexts/agentic-workflow/README.md`
