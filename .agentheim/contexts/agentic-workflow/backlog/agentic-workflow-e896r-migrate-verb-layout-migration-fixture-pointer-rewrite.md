---
id: agentic-workflow-e896r
title: The `migrate` verb — `lib/layout-migration.mjs` moves a legacy `.agentheim/` into the two-root layout under the lifecycle lock, splits every per-BC INDEX losslessly, rewrites every pointer, and is idempotent; refuses a mixed tree; never touches this repo's own tree
status: backlog
type: feature
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-cj54k]
blocks: [agentic-workflow-zgav8]
tags: [layout, migration, lifecycle, index, protocol, upgrade]
related_adrs: [0078, 0038, 0039, 0047, 0073, 0075, 0076]
related_research: []
prior_art: [agentic-workflow-pt0gy, agentic-workflow-vhz69, agentic-workflow-e4bjh]
---

## Why

ADR-0078 §4 settles the trigger: a `migrate` verb on `lib/task-lifecycle-cli.mjs`, run by
every skill before its own reads. An existing project must move into the new layout the
first time the new plugin touches it, with no manual step, no lost git history, and no
half-moved tree left behind if something fails mid-way. This child builds and proves the
verb against fixtures only; the dogfood run on this repo is agentic-workflow-tgr31.

## What

1. **New `lib/layout-migration.mjs`** exporting `migrateLayout(rootDir, opts = {}) →
   manifest`, wired as `migrate` on `lib/task-lifecycle-cli.mjs` (same `runCli` /
   `main` shape as the other verbs; git-free). Behaviour by `detectLayout`:
   - `board` → `{ok:true, verb:'migrate', noop:true, changed:[]}`, zero writes.
   - `mixed` → `{ok:false, code:'mixed-layout', reason}` naming the offending path, zero writes.
   - `legacy` → under the lifecycle lock (ADR-0075): rename `contexts/<bc>/{backlog,todo,
     doing,done,done-archive}` → `board/<bc>/…`; `knowledge/protocol.md` + `knowledge/protocol/`
     → `board/`; `vision.md`, `context-map.md` → `knowledge/`; `contexts/<bc>/README.md` +
     `concepts/` → `knowledge/contexts/<bc>/`; `contexts/design-system/styleguide/` →
     `knowledge/contexts/design-system/styleguide/`; plain `fs.renameSync` so git records
     renames. Then **split each per-BC INDEX** via a pure `splitIndexContent(text) →
     {taskHalf, knowledgeHalf}` (header + `task-counts` + four task-status blocks vs
     `adr-local` / `research-local` / `concepts`; every line verbatim except the ADR-local
     relative-link depth rewrite `../../knowledge/decisions/…` → `../../decisions/…`);
     write both halves through `writeFileAtomic` (ADR-0076); remove the emptied
     `contexts/` tree; rewrite pointers (below); return `{ok:true, verb:'migrate',
     changed:['.agentheim'], moved:[…], message:'chore(agentheim): migrate .agentheim/ to
     the two-root layout (ADR-0078)'}`.
2. **Pointer rewrite** (pure, tested helper): `knowledge/index.md` bc-list lines end in
   `contexts/<bc>/README.md`; its Pointers section names `vision.md`, `context-map.md`,
   `../board/protocol.md`; BC README lines spelling `contexts/<bc>/INDEX.md` or
   `contexts/<bc>/<lifecycle>/`; README-relative links (`../../knowledge/…` → `../../…`)
   now one level deeper. Historical protocol entries and ADR bodies are **not** rewritten
   (ADR-0039 verbatim discipline).
3. **Refusal guards:** refuse with `{ok:false, code:'worktree-active'}` when `git worktree
   list --porcelain` (read-only) shows an `aw/` worker worktree — a live worker would carry
   the old layout. Lock-timeout surfaces as the existing `lock-timeout` code.
4. **Manifest for the caller:** `changed` is the single directory pathspec `.agentheim` —
   `runScopedCommit` accepts it (`isInvalidPath` refuses only `-A`, `.`, empty, glob
   chars; git is spawned with an argv array) and `git add -- .agentheim` stages renames
   and respects `.gitignore`.

Out of scope: wiring the verb into skill prose (zgav8), running it on this repo (tgr31),
the dashboard notice (hxq1g).

## Acceptance criteria

- [ ] `lib/test/layout-migration.test.mjs` builds the legacy fixture named in g5ez5 (root
      `vision.md` + `context-map.md`; three BCs with READMEs, one `concepts/` page, a mixed
      INDEX each, tasks in all four folders, a `done-archive/`; one BC with a `styleguide/`
      subtree; `protocol.md` + one `protocol/YYYY-MM.md`) and asserts, after `migrate`:
      every moved file is byte-identical in content at its new path; the union of lines in
      the two INDEX halves equals the old INDEX's lines modulo the ADR-link depth rewrite;
      `detectLayout` returns `board`; `contexts/`, root `vision.md`, root `context-map.md`
      no longer exist.
- [ ] A second `migrate` on the migrated fixture returns `noop:true` with `changed:[]` and
      the fixture's mtimes are unchanged (zero writes).
- [ ] A mixed fixture (both `contexts/` and `board/` present) returns
      `{ok:false, code:'mixed-layout'}` naming the path, with zero writes.
- [ ] After migration a grep over the fixture's `knowledge/index.md` and every README
      finds zero references to `.agentheim/contexts/`, `contexts/<bc>/INDEX.md`,
      `contexts/<bc>/<lifecycle>/`, root-level `vision.md` / `context-map.md`, or
      `knowledge/protocol`; every rewritten relative link resolves to an existing file.
- [ ] `migrate` holds the lifecycle lock for its whole write phase (a concurrent `log`
      call blocks until it releases, asserted with the existing two-process harness from
      pt0gy/dpbjj) and every rewritten file goes through `writeFileAtomic` (a forced
      failure injected before the rename leaves no truncated INDEX or protocol).
- [ ] `runCli(['migrate'])` returns the manifest shape above; the CLI's verb table and its
      usage line list `migrate`; `worktree-active` is returned when a fixture repo has an
      `aw/` worktree.
- [ ] `runScopedCommit(fixtureRepo, ['.agentheim'], manifest.message)` succeeds on the
      migrated fixture and `git log --follow` on a moved done-task file shows its
      pre-migration commit.
- [ ] `npm test` is green with this repo's own `.agentheim/` still legacy.

## Notes

- **ADR-0059 disposition:** enforced by the fixture suite above.
- `migrate`'s legacy-reading path is **permanent** (ADR-0078 §5) — do not gate it behind
  the transition flag g5ez5's closure introduces.
- The stale plugin cache (0.9.3) will not carry zgav8's step-0 prose; a builder on this
  repo may run `node lib/task-lifecycle-cli.mjs migrate` by hand — the verb must be
  usable standalone with a clear one-line result.
- Parent: agentic-workflow-g5ez5; decision record: ADR-0078.
