---
id: agentic-workflow-g5ez5
title: Collapse `.agentheim/` into two roots — `knowledge/` (ADRs, research, index, and every BC README under `knowledge/contexts/<bc>/`) and one dedicated task-system folder (every BC's lifecycle folders + `INDEX.md`, the protocol log) — retiring the top-level `contexts/` folder, with an automatic on-upgrade migration of existing projects
status: backlog
type: refactor
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: []
blocks: []
tags: [layout, migration, lifecycle, protocol, index, dashboard, upgrade]
related_adrs: [0038, 0039, 0047, 0017, 0075]
related_research: []
prior_art: []
---

## Why

Today `.agentheim/contexts/<bc>/` mixes two very different kinds of file: the BC's
**description** (`README.md` — purpose, ubiquitous language, invariants, runtime surface)
and the **operational churn** of working the system (`backlog/ todo/ doing/ done/
done-archive/` task files that get moved around, plus the count-coupled `INDEX.md`).
Likewise `.agentheim/knowledge/` mixes durable knowledge (ADRs, research, the top-level
`index.md`) with `protocol.md` and its `protocol/YYYY-MM.md` archives — a chronological
diary of the system operating, not knowledge about the domain.

The builder's intent: **every file under `.agentheim/` is either knowledge or task-system
noise — two roots, nothing else.** A BC's README is knowledge about the domain, so it
belongs under `knowledge/` in a bounded-context subfolder; a separate top-level
`contexts/` parent is not needed once the lifecycle files have left it. That makes "what
is this project" (`knowledge/`) readable without wading through lifecycle files, makes the
noise folder trivially ignorable/greppable as a unit, and gives the mechanized lifecycle
verbs (ADR-0038/0075) one root to own instead of two.

## What

1. **Introduce one dedicated task-system folder** under `.agentheim/` that holds:
   - per BC: the four lifecycle folders (`backlog/ todo/ doing/ done/`), `done-archive/`
     (ADR-0047 rotation target), and the **task half** of `INDEX.md` — the
     `task-counts` block and the four task-status lists;
   - the protocol log `protocol.md` and its `protocol/YYYY-MM.md` archives (ADR-0039).
   `knowledge/` keeps `index.md`, `decisions/`, `research/`, audits, **and gains**:
   - `knowledge/vision.md` and `knowledge/context-map.md` (moved from the `.agentheim/`
     root — the most reviewer-relevant information of all belongs with the rest);
   - `knowledge/contexts/<bc>/README.md` plus the BC's `concepts/` pages — the BC
     description is knowledge, so it moves in with the rest;
   - `knowledge/contexts/<bc>/INDEX.md` — the **knowledge half** of today's per-BC INDEX:
     the `adr-local`, `research-local`, and `concepts` catalog sections. Today's INDEX is a
     mixed file (task churn + knowledge pointers); it is split so the BC's catalog of
     ADRs/research/concepts stays reviewable beside the README while the task lists live
     with the tasks. `index-add`'s legal surface already separates the two halves
     (`adr-local`/`research-local`/`concepts` vs the refused task sections), so each half
     has exactly the writers it has today;
   - `knowledge/contexts/design-system/styleguide/` — the styleguide app source
     (`index.html`, `app/*.js`, `styles/`, vendored fonts) moves with the design-system
     README; `dashboard/build.mjs`'s STYLEGUIDE path re-points to it.
   The top-level `.agentheim/contexts/` folder is retired: after migration `.agentheim/`
   holds exactly `knowledge/`, the task-system folder, and the gitignored runtime folders
   (`state/`, `salvage/`, `.dashboard/`) — two content roots, no third parent.
   **Task-system folder name to be settled at REFINE** — see Notes for candidates and a
   recommendation.
2. **Centralize path resolution** in `lib/` (one module that answers "where do this BC's
   lifecycle folder / INDEX / the protocol live?") and re-point every consumer: the
   lifecycle verbs and movers (`applyTaskMove`, promote/claim/complete/bounce/reroute/
   capture/dismiss/log/index-add), protocol + INDEX rotation, the lints (id-grammar,
   duplicate-id, human-eye, spike-stop-loss, index-entry-length), vacuum guard,
   session-start churn, the dashboard tree projection and its rail/library grouping,
   and the prose in every skill/agent/reference that spells the old paths.
3. **Automatic migration on upgrade.** A project created under the old layout is moved
   into the new one the first time the new plugin version touches it — no manual step:
   detect legacy layout → move every lifecycle folder, `done-archive/`, `protocol.md`,
   `protocol/` under the new root; move `vision.md`, `context-map.md`, every
   `contexts/<bc>/README.md` (+ `concepts/`), and `contexts/design-system/styleguide/`
   under `knowledge/` (plain renames, so git records them as renames and history
   survives) → **split each per-BC `INDEX.md`**: the header + `task-counts` + four
   task-status blocks become `<task-system>/<bc>/INDEX.md`, the `adr-local` /
   `research-local` / `concepts` blocks become `knowledge/contexts/<bc>/INDEX.md`, every
   line carried verbatim (the ADR lines' `../../knowledge/decisions/…` links become
   `../../decisions/…` from the new depth) → remove the now-empty top-level `contexts/` →
   rewrite the pointers that name the old paths (`knowledge/index.md`'s bc-list lines now
   end in `contexts/<bc>/README.md` — the knowledge side, not the task INDEX — and its
   Pointers section names the new vision / context-map / protocol locations; BC README
   lines that spell `contexts/<bc>/INDEX.md`; any relative link inside a README, whose
   depth changes now that it sits one level deeper under `knowledge/`) → commit
   the migration as one scoped commit → log one protocol entry. Idempotent: a second
   run on a migrated tree is a no-op; a mixed half-migrated tree is refused with a
   structured reason rather than guessed at.

## Acceptance criteria

- [ ] A fresh project (`brainstorm` foundation capture) creates `vision.md` and
      `context-map.md` under `knowledge/`, every BC `README.md` (plus concept pages) and
      the knowledge-half `INDEX.md` under `knowledge/contexts/<bc>/`, and lifecycle
      folders, the task-half `INDEX.md`, and `protocol.md` only under the new task-system
      root; no top-level `.agentheim/contexts/`, `.agentheim/vision.md`, or
      `.agentheim/context-map.md` is created.
- [ ] Exactly one `lib/` module resolves task-system and knowledge paths (lifecycle folders,
      both INDEX halves, protocol, BC README, vision, context-map); no other `lib/`,
      `dashboard/` (source, not `dist/`), `skills/`, `agents/`, or `references/` file spells
      `.agentheim/contexts/` (any child — `README.md`, lifecycle folders, `done-archive`,
      `INDEX.md`, `styleguide/`), `.agentheim/vision.md`, `.agentheim/context-map.md`, or
      `knowledge/protocol` as a live path — a live-tree `node --test` lint fails on any
      reappearance (ADR-0059 enforcement; historical protocol entries and ADR bodies are
      exempt, they are verbatim records).
- [ ] The per-BC INDEX split is lossless: for every BC, the union of lines in the two new
      INDEX halves equals the old INDEX's lines (modulo the relative-link depth rewrite on
      ADR lines), the task-half carries `task-counts` + the four task-status marker blocks
      and nothing else, and the knowledge-half carries `adr-local` / `research-local` /
      `concepts` and nothing else. `index-add` routes `adr-local`/`research-local`/`concepts`
      to the knowledge half and still refuses every task section; the lifecycle verbs and
      `rotateIndexDoneList` touch only the task half.
- [ ] `dashboard/build.mjs` bundles from `knowledge/contexts/design-system/styleguide/`; the
      styleguide's own entry and the dashboard build both succeed from the new location.
- [ ] Every existing lifecycle verb test (`lib/test/*`, currently 574 passing) passes
      against the new layout with fixtures rebuilt under the new root; the full suite
      (`npm test`, 984 today) is green.
- [ ] Migration: a `node --test` fixture of a legacy-layout project (root `vision.md` +
      `context-map.md`; three BCs with READMEs, a `concepts/` page, a mixed INDEX, tasks in
      all four folders, a `done-archive/`; one BC with a `styleguide/` subtree;
      `protocol.md` + one `protocol/YYYY-MM.md`) ends up byte-identical in file *content* —
      task files, task-half INDEXes, protocol under the new root; vision, context-map,
      READMEs, concepts, knowledge-half INDEXes, styleguide under `knowledge/` — and the
      top-level `contexts/`, `vision.md`, and `context-map.md` no longer exist at the root.
- [ ] Migration is idempotent (second run returns a `no-op` manifest, zero writes) and
      refuses a half-migrated tree with a structured `{ok:false, code, reason}` naming the
      offending path — it never mixes layouts silently.
- [ ] Migration rewrites every pointer to an old path in `knowledge/index.md` (bc-list lines
      end in `contexts/<bc>/README.md`; Pointers name `vision.md`, `context-map.md`, and the
      protocol at their new locations) and the BC READMEs (including README-relative links,
      which sit one level deeper afterwards); a lint over the migrated fixture finds zero
      references to `.agentheim/contexts/`, `contexts/<bc>/INDEX.md`,
      `contexts/<bc>/<lifecycle>/`, root-level `vision.md`/`context-map.md`, or
      `knowledge/protocol`.
- [ ] Migration runs under the lifecycle lock (ADR-0075), writes through `writeFileAtomic`
      for rewritten files (ADR-0076), and produces a manifest `{changed, message, verb}`
      that the invoking skill commits via `scoped-commit` — the dashboard never triggers
      or performs it (ADR-0017: the dashboard is read-only).
- [ ] Migration is triggered automatically: the first skill invocation (any of
      `modeling` / `quick-capture` / `work` / `brainstorm` / `research`) on a legacy-layout
      project migrates before its own "Before acting" reads, with one line to the builder
      naming what moved. Trigger mechanism settled at REFINE (see Notes).
- [ ] The dashboard renders a migrated project correctly (board, rail, library, search,
      done-archive prior-art reads) and, on an un-migrated legacy project, shows a clear
      "layout migration pending — run any Agentheim skill" notice instead of an empty
      board; `dashboard/dist/` rebuilt and staged per ADR-0057.
- [ ] Every INDEX task line's relative link (`done/<file>.md`, `../../knowledge/decisions/…`)
      still resolves from the INDEX's new location; verified by the migration fixture test.
- [ ] This repo's own `.agentheim/` is migrated by the same code path (dogfooding), and
      the migration commit is a rename-detected git commit (`git log --follow` on a moved
      task file shows its pre-migration history).
- [ ] An ADR records the layout decision, the chosen name, the migration trigger, and
      which paths were deliberately left alone (`state/`, `salvage/`, `.dashboard/`).

## Notes

**Naming candidates** (builder said "feel free to suggest better names"):

| Candidate | For | Against |
|---|---|---|
| `.agentheim/board/` **(recommended)** | A Kanban board *is* lanes of task cards plus an activity log; the protocol is the board's activity feed; INDEX is the board's per-lane catalog. Short, non-technical, no collision. | Protocol-as-"board" reads slightly loose. |
| `.agentheim/tasks/` | Most literal for the lifecycle folders. | `protocol.md` under `tasks/` is odd; `tasks/` also invites reading it as a flat task list. |
| `.agentheim/ops/` / `.agentheim/system/` | Honest about "noise of operating the system". | Vague; `system` echoes the builder's own "task system" phrase but says nothing about what it holds. |
| `.agentheim/work/` | Matches the `work` skill. | Collides with the `work` skill name and `aw/` worker branches — confusing in prose ("work's work folder"). |
| `.agentheim/ledger/` | Fits the protocol well. | Poor fit for lifecycle folders. |

Recommendation: `board/<bc>/{backlog,todo,doing,done,done-archive}/`, `board/<bc>/INDEX.md`,
`board/protocol.md`, `board/protocol/YYYY-MM.md`. Settle at REFINE; the ADR records it.

**Settled by the builder (2026-09-06):** BC READMEs move to `knowledge/contexts/<bc>/README.md`
— a bounded-context subfolder of `knowledge/`, no separate top-level parent. Then, after a
full inventory of everything Agentheim writes: `vision.md` and `context-map.md` also move into
`knowledge/`; the per-BC INDEX is split into a task half and a knowledge half; `index.md`'s
bc-list points at READMEs; the design-system styleguide source moves with its README. The
resulting `.agentheim/` tree:

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
  <task-system>/                 (name open — board/ recommended)
    protocol.md
    protocol/YYYY-MM.md
    <bc>/{backlog,todo,doing,done,done-archive}/
    <bc>/INDEX.md                (task half: task-counts + four status lists)
  state/  salvage/  .dashboard/  (gitignored runtime, unchanged)
```

**Why the INDEX split rather than a whole-file move:** the per-BC INDEX was a mixed file —
the task lists and counts are churn, the ADR/research/concept catalog is what a reviewer
reads to find the BC's decisions. Moving it whole would drag the catalog into the noise
folder. The two halves already have disjoint writers today (`index-add` for the catalog
sections; the lifecycle verbs + done-list rotation for the task sections), so the split adds
no new writer class. Naming the knowledge half (`INDEX.md` vs e.g. `CATALOG.md`) is REFINE's
call; the task-half keeps `INDEX.md` so every verb's path stays one segment away.

**Decisions REFINE must settle** (likely an ADR + a split):

1. **The name** (above).
2. **Migration trigger.** Options: (a) a `migrate` verb on `lib/task-lifecycle-cli.mjs`,
   invoked by every skill's "Before acting" step via the usual homedir→cache→semver-max
   bootstrap — explicit, lock-held, testable, and the skill owns the scoped commit exactly
   like every other verb (recommended); (b) lazy `ensureLayout()` inside every lib verb —
   automatic even for callers that skip the skill prose, but then a verb's manifest
   mixes a migration with its own change; (c) a plugin `SessionStart` hook — the plugin
   ships no `hooks/hooks.json` today; adding one is a new surface (ADR-0043's heartbeat
   hooks live in the consumer's settings, not the plugin). Whichever is chosen, every lib
   verb and the dashboard tree should at minimum *detect* a legacy layout and refuse
   (`legacy-layout`) rather than write new files into the old tree.
3. **What stays put.** `state/` (advisory, gitignored — `in-flight.json`, `whats-next.md`,
   `lifecycle.lock`), `salvage/` (ADR-0063, gitignored), `.dashboard/` (runtime.json) are
   already runtime noise but are gitignored and path-pinned by hooks and the dashboard
   launcher. Default: leave them; record the choice in the ADR. `lifecycle.lock` in
   particular must stay resolvable *before* migration runs, since migration takes it.
4. **Split shape.** Probable children: (i) decision ADR + `lib/` path module (task-system
   paths *and* the BC-README path) + verb/rotation/lint re-pointing + tests; (ii) migration
   verb + fixture tests + pointer rewrite; (iii) skill/agent/reference prose sweep (~180 path
   mentions across `skills/work`, `modeling`, `brainstorm` — which *creates* BC READMEs and
   must write them under `knowledge/contexts/` —, `research`, `quick-capture`, `whats-next`,
   `agents/worker`, `agents/verifier`, `agents/strategic-modeler`, `references/index-template`,
   `lib-bootstrap`, `commit-doctrine`, `bc-readme-template`); (iv) dashboard tree/rail/library
   (BC READMEs now discovered under `knowledge/contexts/`, BC names enumerated from the
   task-system root and/or `knowledge/contexts/` — decide which is authoritative when they
   disagree) + legacy notice + dist rebuild. (i) before (ii)/(iii)/(iv).
5. **BC enumeration source.** Today "which BCs exist" = `readdir(contexts/)`. Afterwards a BC
   can exist as a README without tasks (`knowledge/contexts/<bc>/`) or as tasks without a
   README (`<task-system>/<bc>/`). Recommend: `knowledge/contexts/` is authoritative
   (a BC is a domain description first); a task-system folder with no README is a lint
   finding, and `capture`'s empty-BC INDEX backfill creates the task-system folder on demand.

**Blast radius (grep of live path literals, 2026-09-06):** `lib/task-lifecycle.mjs` 51,
`lib/task-lifecycle-capture-dismiss.mjs` 32, `lib/index-rotation.mjs` 28,
`lib/index-entry-length.mjs` 17, `lib/task-lifecycle-cli.mjs` 11, `lib/protocol-rotation.mjs` 11,
`dashboard/app/board.js` 23, `dashboard/tree.mjs` 9, `skills/work/SKILL.md` 43,
`skills/modeling/SKILL.md` 35, `skills/brainstorm/SKILL.md` 32, `references/index-template.md` 19,
plus ~20 `lib/test/*` files and a tail of 1–8-hit files. There is no central path module today:
`path.join(rootDir, '.agentheim', 'contexts', context, folder)` is repeated per verb.

**Things that move together and must not be forgotten:** `done-archive/` (ADR-0047 —
INDEX's `### Done (…)` header names it, relative); `protocol/YYYY-MM.md` (ADR-0039);
INDEX task lines link `done/<file>.md` relative to the task-half INDEX (unaffected — it
moves with its BC's lifecycle folders); ADR lines in the knowledge-half INDEX link
`../../knowledge/decisions/…` today and must become `../../decisions/…` from
`knowledge/contexts/<bc>/`; `knowledge/index.md`'s bc-list lines and Pointers section;
every reader of `vision.md` (`modeling`/`work`/`brainstorm` "Before acting", the vacuum
guard `lib/vacuum-guard.mjs`, `lib/vision-conformance.mjs`, `whats-next`, the dashboard
rail/library) and of `context-map.md`; `dashboard/build.mjs`'s STYLEGUIDE constant and the
design-system README's file inventory of `styleguide/…` paths; `references/index-template.md`
becomes two templates (or one template with a `half` switch) and `capture`'s empty-BC INDEX
backfill creates the task half only.

**Risks:** (1) `scoped-commit` takes an enumerated path list — a migration of this repo
touches ~250 files (196 done tasks + archives + protocol); Windows argv limits (~32K chars)
may bite → the migration commit may need a `--pathspec-from-file` seam in
`lib/scoped-commit.mjs`, or scoped-commit must accept a directory path (a directory is not
a glob, but confirm the `invalid-path` rule agrees). (2) A worker worktree (`aw/<id>`)
alive during migration would carry the old layout — the migration must refuse when
`git worktree list` shows an Agentheim worker worktree, or `work` must migrate at session
start before any batch claim. (3) The installed plugin cache is often a version behind the
repo (see the 0.9.2/0.9.3 notes in recent protocol entries); a stale skill running against
a migrated tree must fail closed on the missing old paths rather than re-create them —
the `legacy-layout`/`unknown-layout` detection in `lib/` is what guards this. (4) Historical
protocol entries and ADR bodies spell old paths verbatim — leave them (ADR-0039 verbatim
discipline); the lint exempts them.

**Convention check (ADR-0059):** this establishes a structural convention on doctrine-bearing
surfaces (`lib/`, `skills/`, `references/`); enforcement is the live-tree path-literal lint
in the acceptance criteria — not prose-only.
