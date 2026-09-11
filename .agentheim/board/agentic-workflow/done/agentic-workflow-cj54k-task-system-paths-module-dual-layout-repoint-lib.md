---
id: agentic-workflow-cj54k
title: One path module for the two-root layout — `lib/task-system-paths.mjs` with `detectLayout` (legacy / board / mixed) — and every lifecycle verb, rotation, and live-tree lint re-pointed through it, resolving both layouts during the transition; ADR-0078 accepted
status: done
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

## Outcome

Added `lib/task-system-paths.mjs`: `detectLayout(rootDir)` (`'legacy'` / `'board'` /
`'mixed'`, with a documented, uniformly-applied convention — every getter and enumerator
throws a Error carrying `.code === 'mixed-layout'` on a mixed tree, never guesses), plus a
getter per path (`taskFolderPath`, `taskIndexPath`, `doneArchiveDir`, `protocolPath`,
`protocolArchiveDir`, `knowledgeIndexPath`, `bcReadmePath`, `bcConceptsDir`, `topIndexPath`,
`decisionsDir`, `researchDir`, `visionPath`, `contextMapPath`, `styleguideDir` — each
`(rootDir, ...args, opts={}) → string` with an `opts.layout` override) and two enumerators
(`listBoardContexts`, `listKnowledgeContexts`).

Re-pointed all nine consumers named in the task (`lib/task-lifecycle.mjs`,
`lib/task-lifecycle-capture-dismiss.mjs`, `lib/task-lifecycle-cli.mjs`,
`lib/index-rotation.mjs`, `lib/protocol-rotation.mjs`, `lib/index-entry-length.mjs`,
`lib/duplicate-id-check.mjs`, `lib/human-eye-criteria.mjs`, `lib/spike-stop-loss.mjs`),
deleting every inline `.agentheim/contexts/...` / `.agentheim/knowledge/protocol.md` join —
verified by a `node --test` grep lint (`lib/test/task-system-paths-literal-lint.test.mjs`)
over that enumerated file list. `lib/index-entry-length.mjs`'s `findOverLengthIndexEntries`
additionally branches on layout: under `'legacy'` it checks the one combined per-BC INDEX
(unchanged behavior); under `'board'` it checks the task-half INDEX for task sections and
the knowledge-half INDEX for ADR sections separately, since the two live in different files
there. `captureTask`/`rerouteTask`'s empty-BC INDEX backfill (`renderIndexTemplate`, now
exported) branches the same way: the combined LEGACY template under `'legacy'`, the
task-half-only template under `'board'`.

Split `references/index-template.md` into `references/task-index-template.md` (task-counts
+ the four task-status marker blocks) and `references/knowledge-index-template.md`
(adr-local / research-local / concepts); `references/index-template.md` keeps its top-level
`knowledge/index.md` template section unchanged and its Per-BC section relabeled "LEGACY
combined shape" with a pointer to the two new files, its fenced example otherwise kept
byte-verbatim since `captureTask`'s legacy renderer still reads it. A marker-set test
(`lib/test/task-index-template-split.test.mjs`) proves the two new files' marker union is
exactly today's 8-marker Per-BC set, diffed against the kept-verbatim legacy section.

`lib/task-system-paths.mjs`'s own `detectLayout` "neither contexts/ nor board/" branch
resolves `'legacy'` when `.agentheim/` already exists on disk (even empty, or holding only
e.g. `knowledge/protocol.md`) and `'board'` only when `.agentheim/` is completely absent (a
genuinely fresh, pre-brainstorm project) — refining the task's "neither → board" prose so
every pre-existing `lib/test/*` fixture (several of which create only `.agentheim/knowledge/`
or an empty `.agentheim/` without ever touching `contexts/`) keeps resolving `'legacy'`
unmodified, while a truly fresh project still gets the forward-looking `'board'` default.

ADR-0078 flips to `status: accepted` in this diff (see the `ADRS` block — the conductor
rewrites `.agentheim/knowledge/decisions/0078-two-root-layout-knowledge-and-board-retiring-contexts-with-on-upgrade-migration.md`
on `main`), with an `## Enforcement` paragraph naming this module and task.

Tests: `lib/test/task-system-paths.test.mjs` (31 tests: `detectLayout` across legacy/
board/mixed/fresh/empty-agentheim/live-repo fixtures, every getter's exact path per layout,
every getter+enumerator's structured mixed-layout throw, the `opts.layout` override, both
enumerators, and a byte-identical snapshot across the nine call sites),
`lib/test/task-system-paths-literal-lint.test.mjs` (2 tests: the zero-literal grep lint plus
a self-check that its regexes actually match), `lib/test/task-index-template-split.test.mjs`
(7 tests: the marker-set split and captureTask's dual-layout byte-for-byte backfill). All
574 pre-existing `lib/test/*` tests pass unmodified; the full suite is 614/614 green.
`node --test` at the repo root additionally runs `dashboard/test/*` and a few unrelated
suites (`evals/`, `vscode-extension/`) — 20 dashboard failures are due to
`dashboard/node_modules` not being linked in this worktree (confirmed absent; not run via
`npm install` per instructions), 1 is an evals fixture deliberately asserting a failure, and
2 are `vscode-extension/test/bridge.test.mjs` port-in-use flakiness unrelated to this diff;
none touch `lib/` or this task's files. `detectLayout(<this repo root>)` returns `'legacy'`,
confirmed by a live-tree test.

Key files: `lib/task-system-paths.mjs`, `lib/task-lifecycle.mjs`,
`lib/task-lifecycle-capture-dismiss.mjs`, `lib/task-lifecycle-cli.mjs`,
`lib/index-rotation.mjs`, `lib/protocol-rotation.mjs`, `lib/index-entry-length.mjs`,
`lib/duplicate-id-check.mjs`, `lib/human-eye-criteria.mjs`, `lib/spike-stop-loss.mjs`,
`references/task-index-template.md`, `references/knowledge-index-template.md`,
`references/index-template.md`.
