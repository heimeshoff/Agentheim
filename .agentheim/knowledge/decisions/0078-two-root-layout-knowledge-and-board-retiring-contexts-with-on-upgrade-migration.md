---
id: ADR-0078
title: Two-root layout — `knowledge/` and `board/` — retiring top-level `contexts/`, with a `migrate` verb every skill runs before its own reads
scope: agentic-workflow
status: proposed
date: 2026-09-06
related_tasks: [agentic-workflow-g5ez5, agentic-workflow-cj54k, agentic-workflow-e896r, agentic-workflow-zgav8, agentic-workflow-hxq1g, agentic-workflow-tgr31]
related_adrs: [0017, 0026, 0038, 0039, 0043, 0047, 0057, 0059, 0073, 0074, 0075, 0076]
---

# ADR-0078: Two-root layout — `knowledge/` and `board/` — retiring top-level `contexts/`, with a `migrate` verb every skill runs before its own reads

## Context

`.agentheim/contexts/<bc>/` mixed two different kinds of file: the BC's durable
**description** (`README.md`, `concepts/`) and the **operational churn** of working the
system (`backlog/ todo/ doing/ done/ done-archive/` task files, plus the count-coupled
`INDEX.md`). `.agentheim/knowledge/` likewise mixed durable knowledge (ADRs, research, the
top-level `index.md`) with `protocol.md` and its monthly archives — a chronological diary
of the system operating, not knowledge about the domain. `vision.md` and `context-map.md`
sat loose at the `.agentheim/` root.

The builder's intent (agentic-workflow-g5ez5, 2026-09-06): **every file under `.agentheim/`
is either knowledge or task-system noise — two roots, nothing else.** "What is this project"
should read without wading through lifecycle files; the noise should be ignorable and
greppable as a unit; the mechanized lifecycle verbs (ADR-0038, ADR-0075) should own one
root instead of two.

The blast radius is large and uncentralized. There is no path module today:
`path.join(rootDir, '.agentheim', 'contexts', context, folder)` is repeated per verb across
`lib/task-lifecycle.mjs`, `lib/task-lifecycle-capture-dismiss.mjs`,
`lib/task-lifecycle-cli.mjs`, `lib/index-rotation.mjs`, `lib/protocol-rotation.mjs`, the
four live-tree lints (`index-entry-length`, `duplicate-id-check`, `human-eye-criteria`,
`spike-stop-loss`), `dashboard/tree.mjs`, `dashboard/build.mjs`, and ~180 prose mentions
across `skills/`, `agents/`, `references/`. And this repo's own `.agentheim/` must migrate
without breaking `main`'s `npm test` at any point — the live-tree lints walk this repo's
real tree, so a lint re-pointed at the new root before the tree moves turns `main` red.

## Decision

### 1. The two-roots rule

Every file under `.agentheim/` is either **knowledge** (durable — what and why) or
**task-system** (operational churn — status and log). After this decision `.agentheim/`
holds exactly `knowledge/`, `board/`, and the gitignored runtime folders:

```
.agentheim/
  knowledge/
    vision.md
    context-map.md
    index.md                     (bc-list lines end in contexts/<bc>/README.md)
    decisions/
    research/
    contexts/<bc>/README.md
    contexts/<bc>/INDEX.md       (knowledge half: adr-local / research-local / concepts)
    contexts/<bc>/concepts/
    contexts/design-system/styleguide/   (app source; dashboard/build.mjs reads it here)
  board/
    protocol.md
    protocol/YYYY-MM.md          (ADR-0039 archives, unchanged in shape)
    <bc>/{backlog,todo,doing,done,done-archive}/
    <bc>/INDEX.md                (task half: task-counts + the four task-status lists)
  state/  salvage/  .dashboard/  .worktrees/   (gitignored runtime — untouched, see §6)
```

The top-level `.agentheim/contexts/` folder is retired.

### 2. The task-system folder is named `board/`

A Kanban board *is* lanes of task cards plus an activity feed: the protocol is the board's
activity log, the task-half INDEX is its per-lane catalog. Short, non-technical, no
collision with an existing term. Rejected candidates:

- `tasks/` — most literal for the lifecycle folders, but `protocol.md` under `tasks/` reads
  oddly, and the name invites reading it as a flat task list.
- `ops/` / `system/` — honest about "noise of operating the system", but vague; `system`
  echoes the phrase "task system" without saying what it holds.
- `work/` — collides with the `work` skill and the `aw/` worker branches in prose.
- `ledger/` — fits the protocol, poor fit for lifecycle folders.

### 3. The per-BC INDEX splits into two files with disjoint writers

The mixed per-BC `INDEX.md` splits into `board/<bc>/INDEX.md` (task half: the
`task-counts` block plus the `todo-list` / `doing-list` / `done-list` / `backlog-list`
marker blocks) and `knowledge/contexts/<bc>/INDEX.md` (knowledge half: `adr-local` /
`research-local` / `concepts`). The knowledge half keeps the filename `INDEX.md` so every
existing `index-add` call, template, and reader changes only its root, not its name.

The two halves already have disjoint writers — `index-add` for the catalog sections, the
lifecycle verbs plus `rotateIndexDoneList` for the task sections (ADR-0073, ADR-0075) — so
the split adds no writer class; it relocates each half beside the files it governs. The
split is lossless: the union of lines across both halves equals the original file's lines,
modulo the ADR-local lines' relative-link depth rewrite (`../../knowledge/decisions/…`
becomes `../../decisions/…` from `knowledge/contexts/<bc>/`). `references/index-template.md`
becomes two templates, one per half; `capture`'s empty-BC backfill creates the task half only.

### 4. Migration trigger: a `migrate` verb, invoked by every skill before its own reads

A `migrate` verb on `lib/task-lifecycle-cli.mjs` (backed by `lib/layout-migration.mjs`)
performs the move: git-free, lifecycle-lock-held (ADR-0075), atomic for every rewritten
file (ADR-0076), idempotent (a `board` tree returns a no-op manifest with zero writes), and
returning an enumerated manifest `{changed, message, verb}` the calling skill commits via
`scoped-commit`. Every skill's "Before acting" gains a step 0 that runs it through the usual
homedir→cache→semver-max bootstrap — `modeling`, `quick-capture`, `work`, `brainstorm`,
`research` — with one line to the builder naming what moved. Rejected alternatives:

- **Lazy `ensureLayout()` inside every lib verb** — automatic even for a caller that skips
  the skill prose, but a verb's manifest would then mix a migration with its own change,
  breaking ADR-0026's one-action-one-commit discipline.
- **A plugin `SessionStart` hook** — the plugin ships no `hooks/hooks.json` today
  (ADR-0043's heartbeat hooks live in the consumer's settings); adding one is a new
  distribution surface not justified for a one-time move.

The migration commit uses a single directory pathspec — `runScopedCommit(repoRoot,
['.agentheim'], message)` — not ~250 enumerated paths. `lib/scoped-commit.mjs`'s
`isInvalidPath` refuses only `-A`, `.`, empty strings, and glob characters; a directory
string passes, and `runGit` spawns git with an argv array (no shell line, no argv-length
concern). `git add -- .agentheim` after the move stages renames, respects `.gitignore`, and
keeps `git log --follow` history (verified empirically during refinement).

### 5. Layout detection and the transition window

All path resolution centralizes in `lib/task-system-paths.mjs`, whose
`detectLayout(rootDir)` returns `'legacy'`, `'board'`, or `'mixed'`. Consumers resolve
through it in two phases:

- **Transition (children 1–4 of g5ez5):** every consumer resolves correctly against
  whichever layout is actually on disk; only `'mixed'` is refused. This keeps `main`'s
  live-tree lints green while this repo is still legacy-shaped.
- **After the dogfood migration (child 5 moves this repo's real tree):** every consumer
  except `migrate` itself is hardened to refuse `'legacy'` with
  `{ok:false, code:'legacy-layout'}` rather than tolerate it forever. `migrate`'s
  legacy-reading path is permanent — any consumer project upgrading past this plugin
  version relies on it. `'mixed'` is always refused, never guessed at.

The dashboard never migrates (ADR-0017). On `'legacy'` or `'mixed'` it renders a
"layout migration pending — run any Agentheim skill" notice instead of an empty board.

### 6. `knowledge/contexts/` is the authoritative BC list

A BC exists when `knowledge/contexts/<bc>/` exists — a BC is a domain description first.
A `board/<bc>/` folder with no matching README is a lint finding (`orphan-task-folder`),
not evidence of a BC. `capture`'s empty-BC backfill creates `board/<bc>/` plus the
task-half INDEX on demand but never authors a README — that stays with `modeling` /
`brainstorm`.

### 7. What stays put

`state/` (`in-flight.json`, `whats-next.md`, `lifecycle.lock`), `salvage/` (ADR-0063),
`.dashboard/` (`runtime.json`), and `.worktrees/` are already gitignored runtime noise,
path-pinned by hooks, the dashboard launcher, and the lock itself. Moving them buys nothing
and risks a hook that hard-codes their path. `lifecycle.lock` in particular must stay
resolvable *before* migration runs, since migration takes it.

## Consequences

**Positive.** `knowledge/` reads as the project's description with no lifecycle churn in
it; `board/` is one ignorable, greppable unit; the lifecycle verbs own one root; the
mixed-INDEX smell is gone with zero new writer classes; one path module replaces ~15 inline
`path.join` sites.

**Negative.** A re-pointing pass over ~180 prose mentions and every path-resolving module;
a temporary dual-layout window across several children before legacy support can be
refused; the dashboard gains its first `dashboard → lib` import (`dashboard/tree.mjs`
importing `lib/task-system-paths.mjs`; today the only cross-import runs `lib → dashboard`
for `discoverRoot`). Historical protocol entries and ADR bodies keep spelling the old
paths verbatim (ADR-0039 discipline); the path-literal lint exempts them.

**Neutral.** `dashboard/discovery.mjs`'s `discoverRoot` needs no change (it only checks
that `.agentheim/` exists). `lib/vacuum-guard.mjs`, `lib/vision-conformance.mjs`, and
`lib/session-start-churn.mjs` carry no path literals — their callers pass paths — so their
fix is skill prose only. `dashboard/app/live-frame-router.js` needs no edit (unrecognized
paths already classify as structural).

## Alternatives considered

- **Move the per-BC INDEX whole** — rejected: drags the ADR/research/concept catalog into
  the noise folder, defeating the two-roots rule.
- **`board/<bc>/` as the authoritative BC list** — rejected: task folders are downstream of
  the domain description, not the other way around. A union of both roots was also
  rejected as making a missing README a warning rather than a finding.
- **`CATALOG.md` for the knowledge half** — rejected in favour of keeping `INDEX.md`: a
  distinct name buys grep clarity at the cost of renaming in `index-add`, the template,
  and the dashboard.
- **Lazy per-verb migration** and **a plugin `SessionStart` hook** — rejected, §4.
- **Rebuilding the tree as an event-sourced projection** — not pursued: this is a one-time
  structural move of existing files, not a read-model concern (cf. ADR-0075's deferral).

## References

- ADR-0038 — the mover / git-free CLI / skill boundary the `migrate` verb follows.
- ADR-0039, ADR-0047 — protocol and INDEX done-list rotation; both archives move with
  their live files, shape unchanged.
- ADR-0017 — the dashboard is read-only; it never migrates.
- ADR-0057 — `dashboard/dist/` is rebuilt, never hand-edited, after the styleguide re-point.
- ADR-0059 — each child records its enforcement-or-marker disposition in its task file.
- ADR-0073, ADR-0074, ADR-0075, ADR-0076 — the mechanized-verb family this builds on.
