---
id: agentic-workflow-cj54k
title: One path module for the two-root layout — `lib/task-system-paths.mjs` with `detectLayout` (legacy / board / mixed) — and every lifecycle verb, rotation, and live-tree lint re-pointed through it, resolving both layouts during the transition; ADR-0078 accepted
status: backlog
type: refactor
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: []
blocks: [agentic-workflow-e896r, agentic-workflow-hxq1g]
tags: [layout, lifecycle, index, protocol, lint, paths]
related_adrs: [0078, 0038, 0039, 0047, 0073, 0075, 0076, 0059]
related_research: []
prior_art: [agentic-workflow-pt0gy, agentic-workflow-e4bjh, agentic-workflow-vhz69]
---

## Why

There is no path module today: `path.join(rootDir, '.agentheim', 'contexts', context,
folder)` is repeated per verb across nine `lib/` modules. ADR-0078 moves every lifecycle
folder, the task-half INDEX, and the protocol under `.agentheim/board/`, and every BC README
plus the knowledge-half INDEX under `knowledge/contexts/<bc>/`. That cannot happen safely
while path construction is scattered. This child is the seam every other g5ez5 child
depends on, and it must land **without moving a single file in this repo** — `main`'s
live-tree lints walk this repo's real (still legacy) tree, so the module has to resolve
both layouts until the dogfood migration (agentic-workflow-tgr31) flips it.

## What

1. **New `lib/task-system-paths.mjs`** exporting:
   - `detectLayout(rootDir) → 'legacy' | 'board' | 'mixed'` — `legacy` when
     `.agentheim/contexts/` exists and `.agentheim/board/` does not; `board` when the
     reverse holds; `mixed` when both exist or when root-level `vision.md` coexists with
     `knowledge/vision.md`. A tree with neither (fresh project before brainstorm) resolves
     `board`.
   - Path getters, all shaped `(rootDir, ...args, opts = {}) → string` with an optional
     `opts.layout` override and `mixed` throwing a structured error, never guessing:
     `taskFolderPath(rootDir, bc, folder)`, `taskIndexPath(rootDir, bc)`,
     `doneArchiveDir(rootDir, bc)`, `protocolPath(rootDir)`, `protocolArchiveDir(rootDir)`,
     `knowledgeIndexPath(rootDir, bc)` (knowledge-half INDEX; under `legacy` this is the
     same file as `taskIndexPath`), `bcReadmePath(rootDir, bc)`, `bcConceptsDir(rootDir, bc)`,
     `topIndexPath(rootDir)`, `decisionsDir(rootDir)`, `researchDir(rootDir)`,
     `visionPath(rootDir)`, `contextMapPath(rootDir)`, `styleguideDir(rootDir)`.
   - Enumerators `listBoardContexts(rootDir)` and `listKnowledgeContexts(rootDir)`; under
     `legacy` both read `contexts/`. A `mixed` tree surfaces as a structured refusal from
     both, never as `[]`.
2. **Re-point every `lib/` consumer** through the module, deleting the inline joins:
   `lib/task-lifecycle.mjs`, `lib/task-lifecycle-capture-dismiss.mjs`,
   `lib/task-lifecycle-cli.mjs`, `lib/index-rotation.mjs`, `lib/protocol-rotation.mjs`,
   `lib/index-entry-length.mjs`, `lib/duplicate-id-check.mjs`, `lib/human-eye-criteria.mjs`,
   `lib/spike-stop-loss.mjs`. (`vacuum-guard`, `vision-conformance`, `session-start-churn`
   carry no path literals — callers pass paths — so they are untouched.)
3. **Two INDEX templates.** Split `references/index-template.md` into
   `references/task-index-template.md` (header + `task-counts` + the four task-status
   blocks) and `references/knowledge-index-template.md` (`adr-local` / `research-local` /
   `concepts`); the old file stays as a legacy-labelled pointer until g5ez5's closure
   deletes it. `captureTask`'s empty-BC backfill uses the task-half template under `board`
   and the combined legacy template under `legacy`.
4. **ADR-0078 → `status: accepted`** in the same diff (the module is its enforcement).

Out of scope: the `migrate` verb (e896r), any prose in `skills/` / `agents/` (zgav8), the
dashboard (hxq1g), refusing `legacy` (g5ez5 closure).

## Acceptance criteria

- [ ] `lib/test/task-system-paths.test.mjs` asserts every export against three fixtures —
      a legacy tree, a board tree, and a mixed tree — with the exact expected path per
      getter, and asserts `detectLayout` on each; `mixed` produces a structured error from
      every getter and enumerator, never an empty result.
- [ ] Zero occurrences of the string `'contexts'` (as a path segment) or
      `'knowledge', 'protocol'` remain in the nine re-pointed `lib/` modules — checked by a
      `node --test` grep lint over that enumerated file list (this is the temporary form;
      zgav8 ships the permanent tree-wide lint).
- [ ] All existing `lib/test/*` tests pass unmodified; `detectLayout(<this repo root>)`
      returns `'legacy'` on the merged tree, and every getter resolves byte-identical to
      the path the removed inline join produced (a snapshot test over the nine call sites).
- [ ] `captureTask`'s backfill selects the task-half template under a board fixture and
      the combined template under a legacy fixture; the resulting INDEX files match the
      templates byte-for-byte after BC-name substitution.
- [ ] `references/task-index-template.md` ∪ `references/knowledge-index-template.md`
      carries exactly today's marker set (`task-counts`, `todo-list`, `doing-list`,
      `done-list`, `backlog-list`, `adr-local`, `research-local`, `concepts`) — asserted
      by a test that diffs marker names against `references/index-template.md`.
- [ ] `npm test` is green on the merged tree with this repo's `.agentheim/` still legacy.
- [ ] `knowledge/decisions/0078-*.md` reads `status: accepted`.

## Notes

- **ADR-0059 disposition:** the convention (one path module, no inline joins) is enforced
  by the enumerated grep lint above; zgav8 widens it to the whole tree.
- Second child of the same seam-first pattern as pt0gy → qd24q: build the mechanism under
  the old layout first, move the tree later.
- `taskIndexPath` and `knowledgeIndexPath` deliberately return the same file under
  `legacy` — `index-add` keeps working unchanged until the dogfood migration.
- Do not add a `dashboard/` import here; hxq1g introduces the `dashboard → lib` edge and
  records it.
- Parent: agentic-workflow-g5ez5 (closure task); decision record: ADR-0078.
