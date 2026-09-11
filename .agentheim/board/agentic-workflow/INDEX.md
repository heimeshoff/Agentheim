# Agentic Workflow — Index

Catalog of everything in this bounded context: tasks by status, ADRs scoped to this BC,
research touching this BC, and concept synthesis pages.

> Updated by: `modeling` (tasks), `work` (BC-scoped ADRs, concept page links), `research` (BC-scoped reports).

---

## Tasks by status

<!-- task-counts:start -->
- **Backlog:** 3
- **Todo:** 0
- **Doing:** 0
- **Done:** 200
<!-- task-counts:end -->

### Todo
<!-- todo-list:start -->
<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
<!-- doing-list:end -->

### Done (current-month entries live; older months archived verbatim under `done-archive/` — kept for prior-art search, ADR-0039 convention)
<!-- done-list:start -->
- **agentic-workflow-zgav8** — Prose sweep for the two-root layout — every skill, agent, and reference spells `board/` and `knowledge/contexts/`, the five entry skills run `migrate` as "Before acting" step 0, and a permanent live-tree lint fails on any reappearing legacy path literal (refactor) — `done/agentic-workflow-zgav8-skill-agent-reference-prose-sweep-step0-migrate-path-literal-lint.md`
- **agentic-workflow-hxq1g** — Dashboard reads the two-root layout — `tree.mjs` resolves through `task-system-paths`, BCs enumerate from `knowledge/contexts/` with orphan `board/` folders as warnings, the styleguide bundle and its 20 ESM imports re-point, and a legacy or mixed tree renders a "layout migration pending" notice; dist rebuilt (refactor) — `done/agentic-workflow-hxq1g-dashboard-two-root-layout-tree-styleguide-repoint-migration-notice.md`
- **agentic-workflow-e896r** — The `migrate` verb — `lib/layout-migration.mjs` moves a legacy `.agentheim/` into the two-root layout under the lifecycle lock, splits every per-BC INDEX losslessly, rewrites every pointer, and is idempotent; refuses a mixed tree; never touches this repo's own tree (feature) — `done/agentic-workflow-e896r-migrate-verb-layout-migration-fixture-pointer-rewrite.md`
- **agentic-workflow-cj54k** — One path module for the two-root layout — `lib/task-system-paths.mjs` with `detectLayout` (legacy / board / mixed) — and every lifecycle verb, rotation, and live-tree lint re-pointed through it, resolving both layouts during the transition; ADR-0078 accepted (refactor) — `done/agentic-workflow-cj54k-task-system-paths-module-dual-layout-repoint-lib.md`
- **agentic-workflow-fn59c** — Wire every remaining hand-written protocol, INDEX, and git edit in work, brainstorm, research, and quick-capture onto the locked lifecycle verbs (log, index-add, capture, bounce, reroute, scoped-commit), deleting the replaced prose, so main has exactly one class of writer per bookkeeping file project-wide (refactor) — `done/agentic-workflow-fn59c-wire-remaining-hand-writers-onto-locked-verbs.md`
- **agentic-workflow-qd24q** — Build the two count-coupled lifecycle verbs pt0gy could not cover — `bounce` (doing → backlog under its own mover policy, worker note riding the mover's single write) and `reroute` (cross-BC backlog move that mints a new id, retires the old, re-points every backlink) (feature) — `done/agentic-workflow-qd24q-remaining-hand-writers-onto-locked-verbs-bounce-reroute.md`
- **agentic-workflow-vhz69** — Atomic temp-file-plus-rename for every INDEX.md / protocol.md / archive write — a crash mid-write must never truncate a bookkeeping file (chore) — `done/agentic-workflow-vhz69-atomic-tmp-rename-bookkeeping-writes.md`
- **agentic-workflow-dpbjj** — Force overlap in pt0gy's two-process concurrency proof — a child-side hold inside the locked section so the lost-update assertion cannot pass by luck (chore) — `done/agentic-workflow-dpbjj-forced-overlap-concurrency-proof.md`
- **agentic-workflow-pt0gy** — Concurrent modeling sessions collide on protocol.md, INDEX.md, and the git index — make capture-side bookkeeping conflict-free (feature) — `done/agentic-workflow-pt0gy-concurrent-modeling-sessions-conflict-free-bookkeeping.md`
- **agentic-workflow-bmn29** — Hidden dashboard tab pauses live re-sync and catches up once on return — closes the idle-waste umbrella (hub, memoization, keyframes shipped) with the before/after MacBook measurement (bug) — `done/agentic-workflow-bmn29-dashboard-idle-resource-waste-four-sse-streams-fanout-refetch-unmemoized-board.md`
- **agentic-workflow-r7dq3** — Post-ghcaj doctrine residuals the bounded sweep's closure rule set aside — five stale passages in verifier.md, work SKILL.md rung 2, commit-doctrine.md, verification-before-completion SKILL.md, and the modeling field legend (chore) — `done/agentic-workflow-r7dq3-post-ghcaj-doctrine-residuals-outside-bounded-sweep.md`
- **agentic-workflow-ghcaj** — Worker branch carries source and tests only — the conductor applies README, ADR, and task-move bookkeeping on main from the worker's structured report (refactor) — `done/agentic-workflow-ghcaj-worker-branch-code-only-conductor-writes-bookkeeping.md`
- **agentic-workflow-e4bjh** — Finish the bookkeeping mechanization — capture and dismiss verbs on the lifecycle CLI (refactor) — `done/agentic-workflow-e4bjh-capture-dismiss-lifecycle-cli-verbs.md`
- **agentic-workflow-pcwnn** — Merge-back conflict ladder — merge the new main into the loser's worktree, let the worker resolve the real conflict, re-verify against the new base, and escalate to the builder only as the last rung (feature) — `done/agentic-workflow-pcwnn-merge-back-conflict-rebase-reverify-worker-resolves.md`
- **agentic-workflow-rw6ck** — Hovering a card re-renders that card and its ring targets, not all 255 — memoized board cards and columns, hover state out of the board root, identity-stable tree projection (refactor) — `done/agentic-workflow-rw6ck-memoized-board-hover-scoped-identity-stable-projection.md`
- **agentic-workflow-g4zce** — Todo cards get a Work launch button seeded with the ticket id — `/agentheim:work <id>` for exactly that task (feature) — `done/agentic-workflow-g4zce-todo-card-work-launch-button.md`
- **agentic-workflow-swj2q** — "`/agentheim:work <task-id>` — scope a work run to one named todo task instead of the whole ready set" (feature) — `done/agentic-workflow-swj2q-work-single-task-argument.md`
- **agentic-workflow-mvt8x** — One live-update subscription per tab, one /api/tree fetch per structural frame — an advisory frame (.agentheim/state/**) re-syncs only the panel that reads that artifact, never the board or rail (bug) — `done/agentic-workflow-mvt8x-live-tree-hub-one-subscription-frame-routing.md`
- **agentic-workflow-jf6qz** — Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; heal the three stale live INDEX headers on no-op rotation (Option A) (bug) — `done/agentic-workflow-jf6qz-fix-archiveddoneheader-phantom-cap-wording.md`
<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
- **agentic-workflow-q8f3n** — `lib/vacuum-guard.mjs`'s `BOOKKEEPING_SEGMENT_RE` doesn't recognize `board/`/`knowledge/contexts/` INDEX paths (bug) — `backlog/agentic-workflow-q8f3n-lib-vacuum-guard-mjs-s-bookkeeping-segment-re-doesn-t-recogn.md`
- **agentic-workflow-tgr31** — Dogfood the migration — run the `migrate` verb on this repo's own `.agentheim/` on `main`, commit it as one rename-detected scoped commit, and prove history, lints, and the dashboard survive; conductor-owned, never dispatched to a worker (chore) — `backlog/agentic-workflow-tgr31-dogfood-migrate-this-repo-agentheim-to-two-root-layout.md`
- **agentic-workflow-g5ez5** — Split the operational task system out of `contexts/` and `knowledge/` — every BC's lifecycle folders, `INDEX.md`, and the protocol log move to one dedicated folder, leaving BC READMEs in `contexts/` and durable knowledge in `knowledge/`, with an automatic on-upgrade migration of existing projects (refactor) — `backlog/agentic-workflow-g5ez5-split-task-system-folder-from-contexts-and-knowledge.md`
<!-- backlog-list:end -->


## Pointers

- Knowledge half (ADRs / research / concepts / BC README) for this BC: `../../knowledge/contexts/agentic-workflow/INDEX.md`
