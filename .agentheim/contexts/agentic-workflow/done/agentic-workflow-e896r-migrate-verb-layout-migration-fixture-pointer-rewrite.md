---
id: agentic-workflow-e896r
title: The `migrate` verb — `lib/layout-migration.mjs` moves a legacy `.agentheim/` into the two-root layout under the lifecycle lock, splits every per-BC INDEX losslessly, rewrites every pointer, and is idempotent; refuses a mixed tree; never touches this repo's own tree
status: done
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
   - `legacy` → under the lifecycle lock (`withLifecycleLock` from `lib/lifecycle-lock.mjs`,
     ADR-0075): rename `contexts/<bc>/{backlog,todo,doing,done,done-archive}` →
     `board/<bc>/…`; `knowledge/protocol.md` + `knowledge/protocol/` → `board/`;
     `vision.md`, `context-map.md` → `knowledge/`; `contexts/<bc>/README.md` +
     `concepts/` → `knowledge/contexts/<bc>/`; `contexts/design-system/styleguide/` →
     `knowledge/contexts/design-system/styleguide/`; plain `fs.renameSync` so git records
     renames. Then **split each per-BC INDEX** (item 2); write both halves through
     `writeFileAtomic` (`lib/atomic-write.mjs`, ADR-0076); remove the emptied
     `contexts/` tree; rewrite pointers (item 3); return `{ok:true, verb:'migrate',
     changed:['.agentheim'], moved:[…], message:'chore(agentheim): migrate .agentheim/ to
     the two-root layout (ADR-0078)'}`.

   **Layout-override discipline (non-obvious, load-bearing).** Mid-move the tree is
   transiently `mixed`, and every getter in `lib/task-system-paths.mjs` *throws* an
   `Error` with `.code === 'mixed-layout'` on a mixed detect (that module's documented
   structured-error convention). So `migrate` calls `detectLayout(rootDir)` **exactly
   once**, up front, and thereafter passes an explicit `{layout:'legacy'}` (sources) or
   `{layout:'board'}` (destinations) opt to every getter it uses — it never lets a getter
   re-detect. A bare getter call inside the write phase is a bug, not a style choice.

   **`board/` is created unconditionally, even with zero BCs.** `detectLayout` resolves an
   `.agentheim/` that exists but has populated *neither* `contexts/` nor `board/` as
   `'legacy'` (the pre-ADR-0078 shape). A project in that state — e.g. only
   `knowledge/protocol.md` on disk — must still come out of `migrate` detecting as
   `'board'`, or every skill re-runs the migration forever. `migrate` therefore always
   `mkdir`s `board/` before returning, whether or not any BC directory moved into it.

2. **INDEX split** — a pure, separately-tested `splitIndexContent(text) →
   {taskHalf, knowledgeHalf}`:
   - Task half keeps the file header, `## Tasks by status`, the `task-counts` block, the
     four `todo-list` / `doing-list` / `done-list` / `backlog-list` blocks with their
     `###` headings and the done-list's trailing rotation paragraph, and the Pointers
     line naming `done-archive/`.
   - Knowledge half keeps the `adr-local`, `research-local` and `concepts` blocks with
     their `##` headings, and the Pointers line naming `README.md`.
   - Every retained line is **byte-verbatim** except the relative-link depth rewrite,
     which applies to **both** BC-local link families — `../../knowledge/decisions/…` →
     `../../decisions/…` (adr-local) and `../../knowledge/research/…` → `../../research/…`
     (research-local) — since the knowledge half sits one level deeper.
   - **Each half additionally gains exactly one new Pointers line** routing to its sibling
     (builder decision, 2026-09-06: the two split templates specify it, and a half with no
     route back to its other half is a dead end). Task half gains the "Knowledge half
     (ADRs / research / concepts / BC README) for this BC" line pointing at
     `../../knowledge/contexts/<bc>/INDEX.md`; knowledge half gains the "Task board (tasks
     by status) for this BC" line pointing at `../../../board/<bc>/INDEX.md`. Take the
     exact wording from `references/task-index-template.md` and
     `references/knowledge-index-template.md` — don't re-word it.
   - A BC INDEX missing a marker block entirely (legal — an empty BC) splits with that
     block simply absent from its half; never synthesize a block that wasn't there.

3. **Pointer rewrite** (pure, tested helper):
   - `knowledge/index.md`'s **Pointers** section: the `vision.md` and `context-map.md`
     entries become correct-as-written once both files sit beside `index.md` — leave them
     verbatim; `knowledge/protocol.md` → `../board/protocol.md`.
   - `knowledge/index.md`'s **`bc-list` block is left verbatim.** Its lines already end in
     `contexts/<bc>/INDEX.md`, which resolves relative to `index.md`'s own directory — i.e.
     to `.agentheim/knowledge/contexts/<bc>/INDEX.md`, the knowledge half, exactly where
     ADR-0078 §6 puts the authoritative BC list. Rewriting it would *break* it. (This
     corrects the pre-cj54k assumption that these lines named `README.md` and needed an
     edit — verified against the live file.)
   - BC README lines spelling `contexts/<bc>/INDEX.md` or `contexts/<bc>/<lifecycle>/`, and
     README-relative links (`../../knowledge/…` → `../../…`) now one level deeper.
   - Historical protocol entries and ADR bodies are **not** rewritten (ADR-0039 verbatim
     discipline).
4. **Refusal guards:** refuse with `{ok:false, code:'worktree-active'}` when `git worktree
   list --porcelain` (read-only) shows an `aw/` worker worktree — a live worker would carry
   the old layout. Lock-timeout surfaces as the existing `lock-timeout` code.
5. **Manifest for the caller:** `changed` is the single directory pathspec `.agentheim` —
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
      the two INDEX halves equals the old INDEX's lines modulo the adr-local /
      research-local link-depth rewrite, **plus exactly one added cross-half Pointers line
      per half**; `detectLayout` returns `board`; `contexts/`, root `vision.md`, root
      `context-map.md` no longer exist.
- [ ] A fixture whose `.agentheim/` holds **no `contexts/` at all** (only
      `knowledge/protocol.md`) migrates its knowledge-half files and comes out with
      `board/` on disk, so a second `detectLayout` returns `board` and a second `migrate`
      is a `noop` — the re-migrate-forever trap is closed.
- [ ] A second `migrate` on the migrated fixture returns `noop:true` with `changed:[]` and
      the fixture's mtimes are unchanged (zero writes).
- [ ] A mixed fixture (both `contexts/` and `board/` present) returns
      `{ok:false, code:'mixed-layout'}` naming the path, with zero writes.
- [ ] The write phase never calls a `task-system-paths` getter without an explicit
      `{layout}` opt: a test that mid-migration snapshots a transiently-mixed tree and
      re-runs the same resolution helpers asserts no `mixed-layout` throw escapes.
- [ ] After migration a grep over the fixture's `knowledge/index.md` and every README
      finds zero references to `.agentheim/contexts/`, `contexts/<bc>/<lifecycle>/`,
      root-level `vision.md` / `context-map.md`, or `knowledge/protocol` — **excluding
      `knowledge/index.md`'s `bc-list` block, which legitimately keeps
      `contexts/<bc>/INDEX.md` verbatim** (item 3). Every rewritten relative link, and
      every `bc-list` link, resolves to an existing file.
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
- **Refined 2026-09-06 against shipped cj54k.** Three assumptions written before the path
  module existed were corrected here: the `mixed-layout` throw makes the `{layout}`
  override mandatory mid-move; `detectLayout`'s "`.agentheim/` exists but unpopulated →
  legacy" branch forces the unconditional `board/` mkdir; and `knowledge/index.md`'s
  `bc-list` needs *no* rewrite (its links already resolve into the knowledge half). The
  INDEX-split fork (verbatim vs. additive cross-half pointer) was settled additive.
- Parent: agentic-workflow-g5ez5; decision record: ADR-0078.

## Outcome

Built and shipped `lib/layout-migration.mjs`'s `migrateLayout(rootDir, opts) → manifest`, wired
as the `migrate` verb on `lib/task-lifecycle-cli.mjs` (`ARITY.migrate = 'opts'`, alongside
`log`/`index-add`). It moves a legacy `.agentheim/contexts/` tree into ADR-0078's two-root
`knowledge/`+`board/` layout: `board` layout → `{ok:true, noop:true, changed:[]}` zero-write
no-op (unlocked); `mixed` → `{ok:false, code:'mixed-layout'}` naming the root, zero writes;
`legacy` → under `withLifecycleLock` (ADR-0075), renames every lifecycle folder / `done-archive/`
/ README / `concepts/` / the design-system `styleguide/` / root `vision.md` and `context-map.md`
/ `protocol.md` and its archive dir into their board-layout destinations via plain
`fs.renameSync` (so `git log --follow` survives across the move), splits each per-BC combined
`INDEX.md` losslessly via the pure `splitIndexContent(text, bc)` into its task half and
knowledge half (byte-verbatim except the adr-local/research-local relative-link depth rewrite
plus exactly one new cross-half Pointers line per half, written through `writeFileAtomic`,
ADR-0076), rewrites the two remaining stale-pointer surfaces via the pure
`rewriteTopIndexPointers` and `rewriteReadmeContent`, refuses `worktree-active` when a live
`aw/<task-id>` worker worktree is registered (read-only `git worktree list --porcelain`), and
removes the emptied `contexts/` tree. `board/` is always created, even with zero BCs, closing
the re-migrate-forever trap for a project whose `.agentheim/` exists but has populated neither
root yet. Every getter call in the write phase passes an explicit `{layout}` opt — proved by a
dedicated test against a genuinely mid-migration mixed tree — since `task-system-paths.mjs`'s
getters throw `mixed-layout` on a bare re-detect.

14 new `node --test` cases in `lib/test/layout-migration.test.mjs` (4 pure-function unit tests
for `splitIndexContent`/the two pointer rewrites, plus 10 fixture-driven integration tests)
cover every acceptance criterion: the full multi-BC legacy fixture (byte-identical moves,
lossless INDEX-split union check, zero stale references excluding `knowledge/index.md`'s
`bc-list` block, every rewritten link resolving); the "no `contexts/` at all" fixture and its
resulting idempotent second `migrate`; a second run's zero-write/mtime-unchanged idempotence; a
mixed-fixture refusal; the layout-override discipline against a real transiently-mixed tree; a
spawned two-process proof that `migrate` holds the lifecycle lock for its whole write phase
against a concurrent `log` call (mirroring pt0gy/dpbjj's `holdMs` harness); a forced
`injectFailureAfterWrite` proof that every rewritten file goes through `writeFileAtomic` with no
truncation; `runCli`'s verb-table/usage-line wiring and manifest shape; a real-git
`worktree-active` refusal; and `runScopedCommit` + `git log --follow` against the migrated
fixture. Full suite: `node --test lib/test/*.test.mjs` reports 628/628 passing (614 pre-existing
+ 14 new), 0 failing. `cd dashboard && npm test` (after temporarily linking
`dashboard/node_modules` via `linkDashboardNodeModules`, then unlinking again before returning,
since this task doesn't touch `dashboard/` and so gets no automatic link): 984/984 passing. This
repo's own `.agentheim/` was never touched and still detects `legacy`.

Key files: `lib/layout-migration.mjs` (new), `lib/task-lifecycle-cli.mjs` (wired `migrate` into
`OPTS_HANDLERS`/`ARITY`), `lib/test/layout-migration.test.mjs` (new).

Out of scope (per this task): wiring `migrate` into skill prose (agentic-workflow-zgav8) and
running it against this repo's own tree (agentic-workflow-tgr31).
