---
id: agentic-workflow-g5ez5
title: Close the two-root layout (ADR-0078) — once this repo is migrated, every consumer except `migrate` refuses a legacy tree with `legacy-layout`, the legacy INDEX template is deleted, and a fresh-project walk-through plus the tree-wide lint prove `.agentheim/` holds exactly `knowledge/` and `board/`
status: backlog
type: refactor
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-tgr31]
blocks: []
tags: [layout, migration, lifecycle, protocol, index, dashboard, upgrade]
related_adrs: [0078, 0038, 0039, 0047, 0017, 0059, 0073, 0075, 0076]
related_research: []
prior_art: [agentic-workflow-bmn29, agentic-workflow-pt0gy]
---

## Why

Today `.agentheim/contexts/<bc>/` mixes the BC's **description** (`README.md`) with the
**operational churn** of working the system (lifecycle folders, the count-coupled
`INDEX.md`), and `knowledge/` mixes durable knowledge with the protocol diary. The
builder's intent: **every file under `.agentheim/` is either knowledge or task-system
noise — two roots, nothing else.** ADR-0078 records the decision: `knowledge/` (vision,
context map, ADRs, research, `contexts/<bc>/README.md` + the knowledge-half INDEX +
concepts + the styleguide source) and `board/` (per-BC lifecycle folders, the task-half
INDEX, the protocol log), with a `migrate` verb every skill runs before its own reads.

This task was captured as the umbrella and split on 2026-09-06 (third refinement) into
five children plus this closure. The children build the seam under the old layout, the
migration verb, the prose, the dashboard, and finally move this repo's own tree. What
remains here is the step that is only safe *after* the repo is board-shaped: turning
"resolve either layout" into "refuse legacy", deleting the transitional scaffolding, and
proving the end state end to end.

## What

Children (in dependency order; each carries its own What and criteria):

| Child | Delivers | depends_on |
|---|---|---|
| agentic-workflow-cj54k | `lib/task-system-paths.mjs` (`detectLayout`, path getters, enumerators), nine `lib/` modules re-pointed, two INDEX templates, ADR-0078 accepted | — |
| agentic-workflow-e896r | `migrate` verb + `lib/layout-migration.mjs`, lossless INDEX split, pointer rewrite, idempotent, refuses mixed / active worktree | cj54k |
| agentic-workflow-zgav8 | Prose sweep over skills/agents/references, step-0 `migrate` in the five entry skills, permanent `legacy-path-literal-lint` | e896r |
| agentic-workflow-hxq1g | Dashboard: tree through the path module, BCs from `knowledge/contexts/`, orphan warnings, styleguide re-point, migration-pending notice, dist | cj54k |
| agentic-workflow-tgr31 | Dogfood: run `migrate` on this repo's `main`, one rename-detected scoped commit, conductor-owned | zgav8, hxq1g |
| **this task** | Legacy refusal, scaffolding removal, end-state proof | tgr31 |

This closure task:

1. **Flip legacy from resolved to refused** (ADR-0078 §5). Every consumer of
   `task-system-paths` — the lifecycle verbs, both rotations, the four live-tree lints,
   `capture`'s backfill, `dashboard/tree.mjs` — returns `{ok:false, code:'legacy-layout',
   reason}` (or the dashboard's `migrationPending` notice) on a `legacy` tree instead of
   resolving old paths. `migrateLayout` and `detectLayout` keep their legacy branch
   permanently; `taskIndexPath` / `knowledgeIndexPath` no longer alias under legacy.
2. **Delete the transitional scaffolding:** `references/index-template.md` (the pointer
   zgav8 left), the legacy branch of every getter except `detectLayout`, cj54k's temporary
   enumerated grep lint (superseded by zgav8's tree-wide lint), and the legacy fixture
   inputs from every test except `layout-migration` and `task-system-paths`'s detection
   cases.
3. **End-state proof:** a fresh-project fixture driven the way `brainstorm` + `capture`
   create a project lands `vision.md`, `context-map.md`, `contexts/<bc>/README.md`, the
   knowledge-half INDEX under `knowledge/`, and lifecycle folders, task-half INDEX,
   `protocol.md` only under `board/`; BC README runtime-surface prose and the
   agentic-workflow README's ubiquitous-language entries for INDEX / protocol / lifecycle
   folders name the new paths (README delta, ADR-0068 pointer style for anything that
   restates `lib-bootstrap`).

## Acceptance criteria

- [ ] A parametrized `node --test` over every re-pointed module and CLI verb (the list
      from cj54k plus `dashboard/tree.mjs`) asserts `{ok:false, code:'legacy-layout'}` on
      a legacy fixture, `mixed-layout` on a mixed fixture, and normal operation on a board
      fixture; `migrateLayout` still migrates the legacy fixture unchanged.
- [ ] e896r's `layout-migration` fixture suite passes unmodified.
- [ ] A fresh-project fixture (empty `.agentheim/`, then the brainstorm-shaped writes and
      one `capture`) contains no top-level `contexts/`, `vision.md`, or `context-map.md`;
      `vision.md`, `context-map.md`, `contexts/<bc>/README.md`, and `contexts/<bc>/INDEX.md`
      exist under `knowledge/`; `board/<bc>/{backlog,todo,doing,done}/`, `board/<bc>/INDEX.md`,
      and `board/protocol.md` exist and nothing else under `board/`.
- [ ] `references/index-template.md` no longer exists; the two templates from cj54k are
      the only INDEX templates and `capture`'s backfill reads the task-half one.
- [ ] `legacy-path-literal-lint` passes on the merged tree with its exemption list
      reduced to `knowledge/decisions/`, `board/protocol*`, `lib/layout-migration.mjs` (+ tests),
      and `detectLayout`; no other exemption remains.
- [ ] Exactly one `lib/` module (`task-system-paths.mjs`) constructs `.agentheim/` paths;
      a test greps `lib/`, `dashboard/*.mjs`, and `dashboard/app/` for `'.agentheim'` string
      literals and finds them only there, in `discoverRoot`, and in the lock path.
- [ ] `npm test` is green on the merged tree; `dashboard/dist/` rebuilt and staged
      (ADR-0057) if `tree.mjs` or app files changed.
- [ ] ADR-0078 gains a Consequences addendum naming the date the legacy refusal shipped
      and this task id in `related_tasks` (already present) — no second ADR.

## Notes

**Settled at refinement 3 (2026-09-06, builder):** folder name `board/`; knowledge-half
INDEX keeps the name `INDEX.md`; migration trigger is the `migrate` verb run from each
skill's "Before acting" step 0; `knowledge/contexts/` is the authoritative BC list;
`state/`, `salvage/`, `.dashboard/`, `.worktrees/` stay put. All recorded in ADR-0078,
including the rejected candidates.

**Resulting tree** (ADR-0078 §1):

```
.agentheim/
  knowledge/
    vision.md
    context-map.md
    index.md                     (bc-list → contexts/<bc>/README.md)
    decisions/
    research/
    contexts/<bc>/README.md
    contexts/<bc>/INDEX.md       (knowledge half: adr-local / research-local / concepts)
    contexts/<bc>/concepts/
    contexts/design-system/styleguide/   (app source; dashboard build reads it here)
  board/
    protocol.md
    protocol/YYYY-MM.md
    <bc>/{backlog,todo,doing,done,done-archive}/
    <bc>/INDEX.md                (task half: task-counts + four status lists)
  state/  salvage/  .dashboard/  .worktrees/  (gitignored runtime, unchanged)
```

**Sequencing rule that shaped the split:** `main`'s live-tree lints walk this repo's real
tree. So cj54k–hxq1g resolve *both* layouts (`detectLayout`), tgr31 moves the tree, and only
this task refuses legacy. Each child is promotable only once its `depends_on` are in
`done/` (fail-closed) — re-run modeling PROMOTE on the next child after each ships.

**Findings from the architect round that corrected the earlier notes:**
- `lib/scoped-commit.mjs`'s `isInvalidPath` accepts a plain directory pathspec and `runGit`
  spawns git with an argv array — the migration commit is `runScopedCommit(root,
  ['.agentheim'], msg)`, one pathspec; no `--pathspec-from-file` seam and no Windows
  argv concern.
- `lib/vacuum-guard.mjs`, `lib/vision-conformance.mjs`, `lib/session-start-churn.mjs` carry
  no path literals; only their callers' prose changes (zgav8).
- `dashboard/app/{board,app,main-pane-reader,slide-over}.js` hold 14 literal ESM imports
  into the styleguide — a distinct class from `.agentheim/` data reads (hxq1g).
- `dashboard/app/live-frame-router.js` needs no change; unrecognized frame paths already
  classify as structural.

**Risks carried by the children:** a live `aw/` worktree during migration (e896r refuses
`worktree-active`); the stale plugin cache running pre-zgav8 prose against a migrated tree
(fails closed on `legacy-layout` / missing paths, never re-creates `contexts/`; builder
runs `migrate` by hand from the repo `lib/` until a release refreshes the cache);
historical protocol entries and ADR bodies keep old paths verbatim (lint exempts them).

**Convention check (ADR-0059):** enforced — the tree-wide `legacy-path-literal-lint`
(zgav8) and this task's parametrized refusal test.
