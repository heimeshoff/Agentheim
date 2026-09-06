---
id: agentic-workflow-tgr31
title: Dogfood the migration — run the `migrate` verb on this repo's own `.agentheim/` on `main`, commit it as one rename-detected scoped commit, and prove history, lints, and the dashboard survive; conductor-owned, never dispatched to a worker
status: backlog
type: chore
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-zgav8, agentic-workflow-hxq1g]
blocks: [agentic-workflow-g5ez5]
tags: [layout, migration, dogfood, upgrade]
related_adrs: [0078, 0074, 0075, 0047, 0039]
related_research: []
prior_art: [agentic-workflow-ghcaj, agentic-workflow-fn59c]
---

## Why

ADR-0078 is only real once this repo lives under it. The migration cannot run inside a
worker: a worker branch carries source and tests only and never writes under
`.agentheim/` (ADR-0074), and a worktree's copy of the tree is not `main`'s. So this task
is executed by whoever holds `main` — the `work` conductor at session start, or the
builder through any skill's step 0 once zgav8 has landed — and it is the gate before
g5ez5's closure can refuse the legacy layout anywhere.

## What

1. **Execution model (conductor-owned, like the ADR-0047 session-end rotation):** when
   `work` finds this task in the ready set it does **not** spawn a worker. The conductor
   claims it, runs `node lib/task-lifecycle-cli.mjs migrate` from the repo root on `main`
   (repo `lib/`, not the plugin cache), and commits the manifest via
   `runScopedCommit(repoRoot, ['.agentheim'], manifest.message)` — one directory pathspec.
   Equivalent path: the builder invokes any skill after zgav8 and step 0 performs the same
   call; the conductor then only verifies and completes.
2. **Pre-flight:** working tree clean; `git worktree list --porcelain` shows no `aw/`
   worktree (the verb refuses otherwise); the dashboard stopped (`/agentheim:dashboard
   stop`) so no live-tree watcher holds handles on `contexts/`.
3. **Verify** the criteria below, then `complete` the task with an OUTCOME naming the
   migration commit hash and the counts of moved files.
4. **Stale plugin cache note:** the installed cache (0.9.3 at refinement time) will not
   carry step 0 or the new paths. Until a release refreshes it, conduct from the repo's own
   `skills/`; the repo-root-first bootstrap already resolves the repo's `lib/`.

5. **The one code change (added by zgav8's refinement, 2026-09-06):** the 20 literal
   `../../.agentheim/contexts/design-system/styleguide/...` ESM import specifiers in
   `dashboard/app/{app,board,main-pane-reader,slide-over}.js` must spell the on-disk path
   (ten jsdom tests resolve them through node directly), so they can only move once the
   tree has. Immediately after the migration commit, re-point all 20 to
   `../../.agentheim/knowledge/contexts/design-system/styleguide/...`, run `npm run build`
   in `dashboard/`, and commit the four files plus `dashboard/dist/` as a second scoped
   commit under this task's trailer. zgav8's `legacy-path-literal-lint` tolerates those
   lines only while `detectLayout` says `legacy`; on the migrated tree they are violations
   until re-pointed, so the `npm test` criterion below cannot pass without this step.

Out of scope: any other code change. If the verb misbehaves on the real tree, bounce this
task with the finding and fix it under e896r's follow-up, never hand-move files.

## Acceptance criteria

- [ ] After the migration commit, `detectLayout(<repo root>)` returns `board`; `.agentheim/`
      lists exactly `knowledge/`, `board/`, and the gitignored runtime folders; no
      `.agentheim/contexts/`, `.agentheim/vision.md`, or `.agentheim/context-map.md` exists.
- [ ] `git show --stat --find-renames` on the migration commit reports every task file,
      README, protocol file, and archive as a rename (R), and `git log --follow` on
      `board/agentic-workflow/done/agentic-workflow-ghcaj-*.md` shows its pre-migration
      history.
- [ ] Per-BC task-half INDEX counts equal the folder contents (`task-counts` vs `ls`), and
      each knowledge-half INDEX's ADR lines resolve to files under `knowledge/decisions/`.
- [ ] `npm test` (full suite, including the live-tree lints and `legacy-path-literal-lint`)
      is green on the migrated `main`; `npm run build` in `dashboard/` succeeds and the
      `dist-staleness` test is green.
- [ ] The dashboard renders the migrated project with `migrationPending:false`, the same
      done count as before (196 in agentic-workflow at refinement time), and prior-art
      search still finds a `done-archive/` entry.
- [ ] After the re-point commit, `dashboard/app/*.js` contains zero
      `.agentheim/contexts/` specifiers, all 20 imports resolve to
      `knowledge/contexts/design-system/styleguide/`, and `findLegacyPathViolations` on the
      migrated tree returns `[]`.
- [ ] Exactly one protocol entry records the migration (the verb's own entry; no second
      hand-written one) and the task's OUTCOME names the commit hash.
- [ ] Board, rail, and library look unchanged to the builder apart from paths. [human-eye]

## Notes

- **ADR-0059 disposition:** not applicable — a one-time operational action, no convention
  established.
- Run with no sibling modeling session open: `migrate` takes the lifecycle lock, but a
  sibling mid-commit can still hold `.git/index.lock`; `scoped-commit` retries, never
  delete the lock by hand.
- Parent: agentic-workflow-g5ez5 (its closure depends on this); decision record: ADR-0078.
