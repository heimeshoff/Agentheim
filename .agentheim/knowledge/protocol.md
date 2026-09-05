# Protocol

Chronological log of everything that happens in this project.
Newest entries on top.

---

## 2026-09-05 23:41 -- Modeling / Refined: agentic-workflow-pcwnn - Merge-back conflict ladder — merge the new main into the loser's worktree, let the worker resolve the real conflict, re-verify against the new base, and escalate to the builder only as the last rung

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (promoted in the entry above)
**Summary:** A throwaway-repo spike showed the captured rebase rung does not exist — a squash conflict on main and `git merge main` in the loser's worktree are the same 3-way merge and conflict on the same paths, while disjoint-hunk edits never conflict at all. The ladder is now: reset main → salvage (`merge-conflict` tag) → discard derived churn (no stash) → conductor runs a real, abortable `git merge main` INTO the branch → resolve-conflict dispatch to the same worker in the same worktree (allow-list from `--diff-filter=U`, orientation + authority statement, `## Merge-conflict note`) → fail-closed checkpoint → mandatory re-verify against the new base with a two-dot diff → normal squash; builder escalation is the last rung. Budget: one ladder per worktree lifetime, off the 3-iteration FAIL counter. INDEX/protocol excluded by construction; Phase 1 gains a MERGE_HEAD-present recovery case. Enforcement: pure lib helpers + a tmpdir-isolated git-fact fixture (a bounded exception to git-free lib); the sequencing itself is prose-only per ADR-0059. Orchestrator round (architect + tactical-modeler) accepted all three decisions with amendments, all folded in. Backlinks: ADR-0057/0058/0059 added. Title updated to drop "rebase".
**Split into:** none
**ADRs written:** none

---

## 2026-09-05 23:26 -- Batch started: [agentic-workflow-rw6ck]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-rw6ck - Hovering a card re-renders that card and its ring targets, not all 255 — memoized board cards and columns, hover state out of the board root, identity-stable tree projection
**Parallel:** no (1 worker — the whole ready set after the post-g4zce re-scan: rw6ck was promoted by a concurrent modeling session at 23:21 and was blocked on mvt8x, integrated at 23:15; no other todo task exists)

---

## 2026-09-05 23:25 -- Task verified and completed: agentic-workflow-g4zce - Todo cards get a Work launch button seeded with the ticket id — `/agentheim:work <id>` for exactly that task

**Type:** Work / Task completion
**Task:** agentic-workflow-g4zce - Todo cards get a Work launch button seeded with the ticket id — `/agentheim:work <id>` for exactly that task
**Summary:** todo cards carry a bottom-right primary Work launch button in the styleguide cornerAction slot, seeded by the new pure workCommandFor(id) builder with /agentheim:work <id> (ADR-0071 scoped run) and threaded through launchOrCopy with the armed skip-permissions cue; backlog Refine/Promote, doing/done cards and the topbar bare Work launch are unchanged; dist healed via the conductor integration rebuild
**Duration:** 12m
**Verification:** PASS (iteration 1)
**Files changed:** 6
**Tests added:** 11
**ADRs written:** none

---

## 2026-09-05 23:23 -- Modeling / Promoted: agentic-workflow-rw6ck - Hovering a card re-renders that card and its ring targets, not all 255 — memoized board cards and columns, hover state out of the board root, identity-stable tree projection

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-09-05 23:21 -- Modeling / Refined: agentic-workflow-rw6ck - Hovering a card re-renders that card and its ring targets, not all 255 — memoized board cards and columns, hover state out of the board root, identity-stable tree projection

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (promoted in the entry above)
**Summary:** Post-mvt8x readiness pass against the live board — diagnosis re-verified (no React.memo in board.js, hover state at the board root, treeToColumns single-arg); the mvt8x sequencing dependency is discharged (shipped 23:15) and the reconcile's plug-in point named (functional setColumns at applyTree). Three findings folded into the criteria: the inline sortTickets at the column call site defeats column memo and must be memoized per (column, sort); BoardColumn legitimately re-renders on hover for the h9v3m collapsed-section marker, so the hard criterion is the card cascade, and React.memo(BoardCard) alone already meets it; the reconcile's value-equality is the treeTicket field set with mtimeMs deliberately included. Pure-projection and re-projection criteria tightened to exact column-array reuse and exact render counts. Backlinks re-run: ADR-0062, ADR-0070, prior art k5p8w added. No orchestrator round — the task had one this afternoon (tactical-modeler ×2, architect) and the pass was verification against code, not new modeling.
**Split into:** none
**ADRs written:** none

---

## 2026-09-05 23:17 -- Batch started: [agentic-workflow-g4zce]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-g4zce - Todo cards get a Work launch button seeded with the ticket id — `/agentheim:work <id>` for exactly that task
**Parallel:** no (1 worker — the whole ready set after the re-scan: g4zce was blocked on swj2q, which this session integrated at 23:22; no other todo task exists)

---

## 2026-09-05 23:16 -- Task verified and completed: agentic-workflow-swj2q - "`/agentheim:work <task-id>` — scope a work run to one named todo task instead of the whole ready set"

**Type:** Work / Task completion
**Task:** agentic-workflow-swj2q - "`/agentheim:work <task-id>` — scope a work run to one named todo task instead of the whole ready set"
**Summary:** /agentheim:work gains a documented argument grammar — bare (whole ready set, loop until todo is empty) vs. a scoped run over one or more named todo ids with exact-match fail-closed id resolution, no mid-run pickup, and an explicit scoped Batch-started entry; recorded in ADR-0071 and guarded by a live-tree lint (lib/work-argument-grammar-section.mjs) that keeps the cited Argument grammar section present
**Duration:** 23m
**Verification:** PASS (iteration 2)
**Files changed:** 5
**Tests added:** 5
**ADRs written:** ADR-0071

---

## 2026-09-05 23:15 -- Task verified and completed: agentic-workflow-mvt8x - One live-update subscription per tab, one /api/tree fetch per structural frame — an advisory frame (.agentheim/state/**) re-syncs only the panel that reads that artifact, never the board or rail

**Type:** Work / Task completion
**Task:** agentic-workflow-mvt8x - One live-update subscription per tab, one /api/tree fetch per structural frame — an advisory frame (.agentheim/state/**) re-syncs only the panel that reads that artifact, never the board or rail
**Summary:** a refcounted, framework-free live-tree hub (dashboard/app/live-tree-hub.js) owns the tab's single /api/events source and single /api/tree fetch; board, rail, WhatsNextPanel and InFlightLane subscribe instead of each opening their own source; a pure classifier (live-frame-router.js) routes frames structural/advisory/runtime so an advisory heartbeat write re-syncs only the panel that reads that artifact, never the board or rail — enforced by a source guard and a registration-consistency test; ADR-0070 accepted, ADR-0006 backlinked; dist healed via the conductor integration rebuild
**Duration:** 17m
**Verification:** PASS (iteration 1)
**Files changed:** 14
**Tests added:** 27
**ADRs written:** none (ADR-0070 accepted, ADR-0006 amended)

---

## 2026-09-05 23:13 -- Task verified and completed: design-system-pk4qd - Two ambient cues repaint every frame — ambient-rail-pulse and rail-attention-breathe animate box-shadow inside their keyframes, contradicting the compositor-only claim

**Type:** Work / Task completion
**Task:** design-system-pk4qd - Two ambient cues repaint every frame — ambient-rail-pulse and rail-attention-breathe animate box-shadow inside their keyframes, contradicting the compositor-only claim
**Summary:** ambient-rail-pulse and rail-attention-breathe are now compositor-only (opacity-only keyframes) — the doing-rail glow moved to a pre-painted .ticket-rail--pulse::after layer removed outright under reduced motion, the attention dot halo became a static box-shadow on the dot; a new allowlist lint (ambient-motion-compositor.test.mjs) resolves every infinite keyframes in the styleguide and fails on any non-compositable property; ADR-0014 amended with the third clause, ADR-0029 footnoted; dist healed via the conductor integration rebuild
**Duration:** 14m13s
**Verification:** PASS (iteration 1)
**Files changed:** 8
**Tests added:** 18
**ADRs written:** none (ADR-0014, ADR-0029 amended)

---

## 2026-09-05 23:11 -- Verification failed: agentic-workflow-swj2q - `/agentheim:work <task-id>` — scope a work run to one named todo task instead of the whole ready set

**Type:** Work / Verification failure
**Task:** agentic-workflow-swj2q - `/agentheim:work <task-id>` — scope a work run to one named todo task instead of the whole ready set
**Iteration:** 1 of 3
**Reasons:** Check 6c (mechanize-or-drop, ADR-0059) fires and is unmet — the new argument-grammar convention lands on doctrine-bearing surfaces (skills/work/SKILL.md, ADR-0071, BC README ubiquitous language) with neither a lib/test doctrine-lint asserting the "Argument grammar" section nor an explicit "prose-only, unenforced (ADR-0059)" marker in the task Notes / ADR-0071 Consequences
**Iteration hint:** likely-fixable
**Next:** re-dispatched worker

---

## 2026-09-05 22:57 -- Batch started: [agentic-workflow-swj2q, agentic-workflow-mvt8x, design-system-pk4qd]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-swj2q - "`/agentheim:work <task-id>` — scope a work run to one named todo task instead of the whole ready set", agentic-workflow-mvt8x - One live-update subscription per tab, one /api/tree fetch per structural frame — an advisory frame (.agentheim/state/**) re-syncs only the panel that reads that artifact, never the board or rail, design-system-pk4qd - Two ambient cues repaint every frame — ambient-rail-pulse and rail-attention-breathe animate box-shadow inside their keyframes, contradicting the compositor-only claim
**Parallel:** yes (3 workers — the whole ready set at MAX_PARALLEL=3; agentic-workflow-g4zce is the only other todo task and is blocked on swj2q. Merge-order advisory: mvt8x and pk4qd both make dashboard/dist stale (healed by the conductor integration rebuild on main) and both touch dashboard/test — squash mvt8x before pk4qd; swj2q touches skills/work/SKILL.md, lib/, and an ADR only)

---

## 2026-09-05 22:50 -- Modeling / Promoted: design-system-pk4qd - Two ambient cues repaint every frame — ambient-rail-pulse and rail-attention-breathe animate box-shadow inside their keyframes, contradicting the compositor-only claim

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-09-05 22:50 -- Modeling / Promoted: agentic-workflow-mvt8x - One live-update subscription per tab, one /api/tree fetch per structural frame — an advisory frame (.agentheim/state/**) re-syncs only the panel that reads that artifact, never the board or rail

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-09-05 22:58 -- Modeling / Refined: agentic-workflow-bmn29 - Dashboard burns resources at idle on a MacBook — split into hub, memoization, and keyframes children; parent keeps the residual hidden-tab scope

**Type:** Modeling / Refine
**BC:** agentic-workflow (children also in design-system)
**Status after:** backlog (parent); children promoted to todo in the entries above
**Summary:** Orchestrator (tactical-modeler ×2, architect) confirmed the capture's diagnosis and split findings 1–5 into three children: agentic-workflow-mvt8x (one refcounted live-tree hub per tab, one /api/tree fetch, frames routed structural/advisory/runtime so a heartbeat write reaches only InFlightLane; source-guard test enforces the one-source rule), agentic-workflow-rw6ck (React.memo on cards/columns, hover state out of the board root, identity-stable treeToColumns reconcile; depends on mvt8x for merge-surface and clean-measurement reasons), design-system-pk4qd (the two box-shadow keyframes become opacity-only over a pre-painted glow layer; ships a compositor-only allowlist lint and amends ADR-0014). The infrastructure shared-fs.watch candidate was dropped — the hub already brings watchers to one per tab. Every criterion classified machine-checkable or [human-eye] (ADR-0061). The parent stays in backlog as the umbrella: residual visibilitychange pause/resume (shapeable only once the hub exists) plus the aggregate before/after MacBook measurement; it now depends on all three children.
**Split into:** agentic-workflow-mvt8x, agentic-workflow-rw6ck, design-system-pk4qd (infrastructure candidate dropped, id unminted)
**ADRs written:** ADR-0070

---

## 2026-09-05 22:36 -- Modeling / Captured: agentic-workflow-swj2q + agentic-workflow-g4zce - single-task `/agentheim:work <id>` and the todo-card Work button

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo (both)
**Summary:** Builder asked whether a worker can be started for one specific todo item and wanted a per-card Work button on todo, symmetric to the backlog Refine/Promote pair. Today `/agentheim:work` has no task-id argument contract — it always dispatches the whole ready set. Captured as two todo tasks: swj2q gives the work skill an explicit `/agentheim:work <task-id>` scoped-run grammar (DAG gate stays fail-closed, run ends after the named task, no mid-run pickup); g4zce adds `workCommandFor(id)` and a single Work LaunchButton in the todo card cornerAction slot, blocked on swj2q. Also repaired protocol.md's header, which the 22:30 session-end prepend had split mid-word ("# P" / "rotocol").

---

## 2026-09-05 22:30 -- Work session ended

**Type:** Work / Session end
**Duration:** 23m (batch start 22:07 → 22:30)
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** infrastructure-w45ce: 1, infrastructure-rgknz: 1
**Commits:** 4 (1 batch-start, 2 task integrations, this entry)
**Vision-conformance:** none — batch aligns with vision. Both tasks close the builder's field report ("after updating the plugin the dashboard is not updated") by structure rather than instruction: w45ce makes a stale committed dist a failing check in the suite the verifier runs and a named RELEASE.md step; rgknz makes the runtime replace a live server whose recorded plugin identity is stale or unknown. Serves "wrong work is caught by structure, not luck"; no pull toward a non-goal.
**Batch mix:** 100% infrastructure (2 type:bug tasks); same BC, same batch — both touched the infrastructure README and it auto-merged cleanly at the second squash (the Phase 3 advisory flagged the overlap; no conflict materialised).
**Integration note:** w45ce's dist heal landed through the conductor's sanctioned main-tree rebuild (`npm run build` in dashboard/ after the squash, staged in the integrating commit) — the ADR-0057 checkpoint guard correctly kept it off the worker branch. Full merged-main suite: 1307/1307. The suite no longer dirties dashboard/dist/ (dist-build.test.mjs now builds to a scratch outdir). Concurrent modeling sessions committed pcwnn and bmn29 on main during the session — no collision with this session's scoped commits.
**Carry-over:** none — working tree clean. No orphan worktrees (both torn down after integration).

---

## 2026-09-05 22:29 -- Task verified and completed: infrastructure-rgknz - The dashboard runtime notices a plugin update — replace a live server that serves an older plugin version instead of reusing it

**Type:** Work / Task completion
**Task:** infrastructure-rgknz - The dashboard runtime notices a plugin update — replace a live server that serves an older plugin version instead of reusing it
**Summary:** the runfile records the serving plugin version and root; launch replaces a live server whose recorded identity is stale, unknown, or points at a removed cache dir and reports replaced <old> → <new>; status and GET /healthz surface the serving version; static responses carry Cache-Control: no-cache — ADR-0002 addendum
**Duration:** 20m
**Verification:** PASS (iteration 1)
**Files changed:** 14
**Tests added:** 17
**ADRs written:** none (ADR-0002 amended)

---

## 2026-09-05 22:26 -- Task verified and completed: infrastructure-w45ce - A release ships a fresh dashboard — rebuild dist/ as a release step and make dist-vs-source staleness a failing check

**Type:** Work / Task completion
**Task:** infrastructure-w45ce - A release ships a fresh dashboard — rebuild dist/ as a release step and make dist-vs-source staleness a failing check
**Summary:** RELEASE.md gains a rebuild-and-stage dashboard/dist step ahead of the version bump; a stdlib-only staleness check (build-stamp.mjs + dist-staleness.test.mjs) fails whenever committed dist lags its sources and names the rebuild command, with dist-build.test.mjs redirected to a scratch outdir so the check is never structurally green; ADR-0013 and ADR-0057 amended; main dist healed via the conductor integration rebuild
**Duration:** 16m
**Verification:** PASS (iteration 1)
**Files changed:** 10
**Tests added:** 6
**ADRs written:** none (ADR-0013, ADR-0057 amended)

---

## 2026-09-05 22:20 -- Modeling / Captured: agentic-workflow-bmn29 - Dashboard burns resources at idle on a MacBook — four SSE streams per tab, a 2×tree + 2×doc fan-out on every heartbeat, an unmemoized 255-card board, and box-shadow keyframes

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Builder reported high resource use on a MacBook and suspected polling. Architecture read found no client timer and no server stat-poll on macOS; the waste is emergent — four `useLiveTree` EventSource subscriptions per tab (ADR-0006 assumed one), each tree-changed frame fanning out to 2× /api/tree (sync 255-file walk) + 2× /api/doc, heartbeat writes to .agentheim/state triggering it on every turn end, an unmemoized whole-board re-render on every fetch and card hover, and two infinite box-shadow keyframes painting every frame. Candidate split into agentic-workflow / design-system / infrastructure children at REFINE.

---

## 2026-09-05 22:08 -- Batch started: [infrastructure-rgknz, infrastructure-w45ce]

**Type:** Work / Batch start
**Tasks:** infrastructure-rgknz - The dashboard runtime notices a plugin update — replace a live server that serves an older plugin version instead of reusing it, infrastructure-w45ce - A release ships a fresh dashboard — rebuild dist/ as a release step and make dist-vs-source staleness a failing check
**Parallel:** yes (2 workers — the whole ready set; both touch the infrastructure README and ADR-0002, so they are annotated for sequential squash-merge order at integration, not held back)

---

## 2026-09-05 22:06 -- Modeling / Captured: agentic-workflow-pcwnn - Merge-back conflict ladder — rebase the loser onto new main, re-verify, and let the worker resolve a real conflict before escalating to the builder

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** The ADR-0032 "future enhancement" (auto rebase + re-verify), captured honestly: a rebase clears only merge-order conflicts, so the real gain is the next rung — on a rebase conflict, re-dispatch the worker into its own worktree to resolve (counts as an iteration), verify, squash-merge; the builder becomes the last rung, not the first. Salvage before every rung (ADR-0063), main never left mid-merge, ADR amending ADR-0032/0037. Complements ghcaj (which removes the prose-conflict class); neither blocks the other.

---


## 2026-09-05 21:59 -- Work session ended

**Type:** Work / Session end
**Duration:** 22m (batch start 21:38 → 21:59)
**Completed:** 1 (first-try PASS: 0, re-dispatched: 1, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** jf6qz: 2
**Commits:** 3 (1 batch-start, 1 task integration, this entry) — plus the INDEX header-heal commit that follows this entry, if the session-end rotation check heals
**Vision-conformance:** none — batch aligns with vision. The one shipped task (jf6qz) removes a false machine-generated claim from every BC INDEX header and mechanizes its one-time correction through the ADR-0047 session-end seam, with the heal committed by `work` — serving "knowledge is durable" and "wrong work is caught by structure" (ADR-0059 enforcement shipped in-task). No pull toward a non-goal.
**Batch mix:** 100% harness (1 task) — a type:bug fix confined to lib/, its test, ADR-0047, the BC README, and one section of skills/work/SKILL.md.
**Iteration note:** the iteration-1 FAIL was conductor-induced — the dispatch note scoped `skills/` out, so the worker shipped a heal that `work`'s session-end step would write but never commit; iteration 2 widened scope and closed the gap. Concurrent `modeling` sessions committed four captures/promotions on main during this session (w45ce, rgknz, ghcaj, pt0gy) and swept this session's uncommitted "Verification failed" protocol entry into one of their scoped commits — recorded, not lost.
**Carry-over:** none — working tree clean. No orphan worktrees (jf6qz's worktree and branch torn down after integration).

---

## 2026-09-05 21:59 -- Task verified and completed: agentic-workflow-jf6qz - Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; heal the three stale live INDEX headers on no-op rotation (Option A)

**Type:** Work / Task completion
**Task:** agentic-workflow-jf6qz - Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; heal the three stale live INDEX headers on no-op rotation (Option A)
**Summary:** archivedDoneHeader no longer emits a phantom "most recent N" cap; a non-rotating session-end run now heals a stale archive-naming header (gated on done-archive/, idempotent) and work commits the heal — ADR-0047 amended, 4 heal tests, SKILL.md rotation step recognizes healed
**Duration:** 27m (2 iterations)
**Verification:** PASS (iteration 2)
**Files changed:** 6
**Tests added:** 4
**ADRs written:** none (ADR-0047 amended)

---

## 2026-09-05 21:55 -- Modeling / Captured: agentic-workflow-pt0gy - Concurrent modeling sessions collide on protocol.md, INDEX.md, and the git index — make capture-side bookkeeping conflict-free

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** The builder runs one work session but several modeling sessions in parallel, and they race on the protocol prepend line, the INDEX task-counts/marker lists, and .git/index.lock. Narrower re-capture of the dismissed d5a9b: the pain is multi-writer bookkeeping files, not worktree-local backlogs. Candidate shapes — event-per-action with generated protocol/INDEX read models (aligned with the rework's EventLog/ReadModel ports), CLI-level advisory lock + index.lock retry, or per-session protocol shards. depends_on e4bjh (capture/dismiss must be mechanized before atomicity has a seam).

---

## 2026-09-05 21:55 -- Modeling / Captured: agentic-workflow-ghcaj - Worker branch carries source and tests only — the conductor applies README, ADR, and task-move bookkeeping on main from the worker's structured report

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Builder's complaint that parallel worktrees conflict very often. Evidence from the protocol: every merge-back conflict since ADR-0032 was prose or a build artifact (BC README bullets, ADR amendments at the same anchor, dist bundle), never code. Proposal: the worker's branch carries source + tests only; README delta, ADR bodies and the doing→done move travel as structured blocks in the worker report and are applied by the conductor on main, sequentially, at integration — checkpoint refuses .agentheim/ paths the way ADR-0057 refuses dashboard/dist/. Removes the same-BC-README collision class and lets MAX_PARALLEL rise for same-BC batches.

---


## 2026-09-05 21:54 -- Modeling / Promoted: infrastructure-rgknz - The dashboard runtime notices a plugin update — replace a live server that serves an older plugin version instead of reusing it

**Type:** Modeling / Promote
**BC:** infrastructure
**From → To:** backlog → todo

---

## 2026-09-05 22:02 -- Modeling / Refined: infrastructure-rgknz - The dashboard runtime notices a plugin update

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo
**Summary:** Builder answered the open symptom question: old UI after an update, no `already running` message noticed. Recorded that the simplest reading is "no release since v0.9.2, so the marketplace had nothing newer" (ADR-0013 manifest lag) — the unblock for that is cutting a release with w45ce's fresh dist; this task still guards the runtime once a newer version is on disk. Added one hardening criterion (`Cache-Control: no-cache` on static assets — today none are sent). Readiness gate cleared → promoted.
**Split into:** —
**ADRs written:** none

---

## 2026-09-05 21:52 -- Verification failed: agentic-workflow-jf6qz - Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; heal the three stale live INDEX headers on no-op rotation (Option A)

**Type:** Work / Verification failure
**Task:** agentic-workflow-jf6qz - Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; heal the three stale live INDEX headers on no-op rotation (Option A)
**Iteration:** 1 of 3
**Reasons:** criterion #7 unreachable — `skills/work/SKILL.md`'s session-end rotation step never commits a healed-only run, so the heal would strand three dirty INDEX.md files; README and ADR-0047 amendment claim a SKILL.md narrowing that does not exist; the worker had scoped `skills/` out on the conductor's over-narrow file-scope note
**Iteration hint:** likely-fixable
**Next:** re-dispatched worker

---

## 2026-09-05 21:50 -- Modeling / Captured: infrastructure-w45ce, infrastructure-rgknz - A marketplace install/update ships and serves an up-to-date dashboard

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** todo (w45ce), backlog (rgknz)
**Summary:** Builder field report — after updating the plugin in a consumer repo the dashboard is not properly installed/updated. Root causes found: (1) the committed `dashboard/dist/` is the shipped artifact and nothing rebuilds it at release time (`RELEASE.md` has no step; ADR-0057 deliberately keeps workers from committing it), and `main` is already stale (app changed 2026-07-15, dist built 2026-07-13); the marketplace also copies `main`, not the tag. → w45ce: release-step rebuild + a stdlib staleness check, filed to todo. (2) `launch.mjs` reuses any live pid regardless of which plugin version it serves — an old-version server survives an update (or serves from a removed cache dir). → rgknz: version-aware replace-not-reuse, filed to backlog pending the builder's observed symptom.

---

## 2026-09-05 21:38 -- Batch started: [agentic-workflow-jf6qz]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-jf6qz - Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; heal the three stale live INDEX headers on no-op rotation (Option A)
**Parallel:** no (1 worker — the only ready task)

---

## 2026-09-05 21:38 -- Modeling / Dismissed: agentic-workflow-d5a9b

**Type:** Modeling / Dismiss
**Dismissed:** agentic-workflow-d5a9b - Enable parallel worktree sessions with independent idea capture and ticket movement (agentic-workflow)

---


ork session ended

**Type:** Work / Session end
**Duration:** 23m (batch start 22:07 → 22:30)
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** infrastructure-w45ce: 1, infrastructure-rgknz: 1
**Commits:** 4 (1 batch-start, 2 task integrations, this entry)
**Vision-conformance:** none — batch aligns with vision. Both tasks close the builder's field report ("after updating the plugin the dashboard is not updated") by structure rather than instruction: w45ce makes a stale committed dist a failing check in the suite the verifier runs and a named RELEASE.md step; rgknz makes the runtime replace a live server whose recorded plugin identity is stale or unknown. Serves "wrong work is caught by structure, not luck"; no pull toward a non-goal.
**Batch mix:** 100% infrastructure (2 type:bug tasks); same BC, same batch — both touched the infrastructure README and it auto-merged cleanly at the second squash (the Phase 3 advisory flagged the overlap; no conflict materialised).
**Integration note:** w45ce's dist heal landed through the conductor's sanctioned main-tree rebuild (`npm run build` in dashboard/ after the squash, staged in the integrating commit) — the ADR-0057 checkpoint guard correctly kept it off the worker branch. Full merged-main suite: 1307/1307. The suite no longer dirties dashboard/dist/ (dist-build.test.mjs now builds to a scratch outdir). Concurrent modeling sessions committed pcwnn and bmn29 on main during the session — no collision with this session's scoped commits.
**Carry-over:** none — working tree clean. No orphan worktrees (both torn down after integration).

---

## 2026-09-05 22:29 -- Task verified and completed: infrastructure-rgknz - The dashboard runtime notices a plugin update — replace a live server that serves an older plugin version instead of reusing it

**Type:** Work / Task completion
**Task:** infrastructure-rgknz - The dashboard runtime notices a plugin update — replace a live server that serves an older plugin version instead of reusing it
**Summary:** the runfile records the serving plugin version and root; launch replaces a live server whose recorded identity is stale, unknown, or points at a removed cache dir and reports replaced <old> → <new>; status and GET /healthz surface the serving version; static responses carry Cache-Control: no-cache — ADR-0002 addendum
**Duration:** 20m
**Verification:** PASS (iteration 1)
**Files changed:** 14
**Tests added:** 17
**ADRs written:** none (ADR-0002 amended)

---

## 2026-09-05 22:26 -- Task verified and completed: infrastructure-w45ce - A release ships a fresh dashboard — rebuild dist/ as a release step and make dist-vs-source staleness a failing check

**Type:** Work / Task completion
**Task:** infrastructure-w45ce - A release ships a fresh dashboard — rebuild dist/ as a release step and make dist-vs-source staleness a failing check
**Summary:** RELEASE.md gains a rebuild-and-stage dashboard/dist step ahead of the version bump; a stdlib-only staleness check (build-stamp.mjs + dist-staleness.test.mjs) fails whenever committed dist lags its sources and names the rebuild command, with dist-build.test.mjs redirected to a scratch outdir so the check is never structurally green; ADR-0013 and ADR-0057 amended; main dist healed via the conductor integration rebuild
**Duration:** 16m
**Verification:** PASS (iteration 1)
**Files changed:** 10
**Tests added:** 6
**ADRs written:** none (ADR-0013, ADR-0057 amended)

---

## 2026-09-05 22:20 -- Modeling / Captured: agentic-workflow-bmn29 - Dashboard burns resources at idle on a MacBook — four SSE streams per tab, a 2×tree + 2×doc fan-out on every heartbeat, an unmemoized 255-card board, and box-shadow keyframes

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Builder reported high resource use on a MacBook and suspected polling. Architecture read found no client timer and no server stat-poll on macOS; the waste is emergent — four `useLiveTree` EventSource subscriptions per tab (ADR-0006 assumed one), each tree-changed frame fanning out to 2× /api/tree (sync 255-file walk) + 2× /api/doc, heartbeat writes to .agentheim/state triggering it on every turn end, an unmemoized whole-board re-render on every fetch and card hover, and two infinite box-shadow keyframes painting every frame. Candidate split into agentic-workflow / design-system / infrastructure children at REFINE.

---

## 2026-09-05 22:08 -- Batch started: [infrastructure-rgknz, infrastructure-w45ce]

**Type:** Work / Batch start
**Tasks:** infrastructure-rgknz - The dashboard runtime notices a plugin update — replace a live server that serves an older plugin version instead of reusing it, infrastructure-w45ce - A release ships a fresh dashboard — rebuild dist/ as a release step and make dist-vs-source staleness a failing check
**Parallel:** yes (2 workers — the whole ready set; both touch the infrastructure README and ADR-0002, so they are annotated for sequential squash-merge order at integration, not held back)

---

## 2026-09-05 22:06 -- Modeling / Captured: agentic-workflow-pcwnn - Merge-back conflict ladder — rebase the loser onto new main, re-verify, and let the worker resolve a real conflict before escalating to the builder

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** The ADR-0032 "future enhancement" (auto rebase + re-verify), captured honestly: a rebase clears only merge-order conflicts, so the real gain is the next rung — on a rebase conflict, re-dispatch the worker into its own worktree to resolve (counts as an iteration), verify, squash-merge; the builder becomes the last rung, not the first. Salvage before every rung (ADR-0063), main never left mid-merge, ADR amending ADR-0032/0037. Complements ghcaj (which removes the prose-conflict class); neither blocks the other.

---


## 2026-09-05 21:59 -- Work session ended

**Type:** Work / Session end
**Duration:** 22m (batch start 21:38 → 21:59)
**Completed:** 1 (first-try PASS: 0, re-dispatched: 1, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** jf6qz: 2
**Commits:** 3 (1 batch-start, 1 task integration, this entry) — plus the INDEX header-heal commit that follows this entry, if the session-end rotation check heals
**Vision-conformance:** none — batch aligns with vision. The one shipped task (jf6qz) removes a false machine-generated claim from every BC INDEX header and mechanizes its one-time correction through the ADR-0047 session-end seam, with the heal committed by `work` — serving "knowledge is durable" and "wrong work is caught by structure" (ADR-0059 enforcement shipped in-task). No pull toward a non-goal.
**Batch mix:** 100% harness (1 task) — a type:bug fix confined to lib/, its test, ADR-0047, the BC README, and one section of skills/work/SKILL.md.
**Iteration note:** the iteration-1 FAIL was conductor-induced — the dispatch note scoped `skills/` out, so the worker shipped a heal that `work`'s session-end step would write but never commit; iteration 2 widened scope and closed the gap. Concurrent `modeling` sessions committed four captures/promotions on main during this session (w45ce, rgknz, ghcaj, pt0gy) and swept this session's uncommitted "Verification failed" protocol entry into one of their scoped commits — recorded, not lost.
**Carry-over:** none — working tree clean. No orphan worktrees (jf6qz's worktree and branch torn down after integration).

---

## 2026-09-05 21:59 -- Task verified and completed: agentic-workflow-jf6qz - Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; heal the three stale live INDEX headers on no-op rotation (Option A)

**Type:** Work / Task completion
**Task:** agentic-workflow-jf6qz - Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; heal the three stale live INDEX headers on no-op rotation (Option A)
**Summary:** archivedDoneHeader no longer emits a phantom "most recent N" cap; a non-rotating session-end run now heals a stale archive-naming header (gated on done-archive/, idempotent) and work commits the heal — ADR-0047 amended, 4 heal tests, SKILL.md rotation step recognizes healed
**Duration:** 27m (2 iterations)
**Verification:** PASS (iteration 2)
**Files changed:** 6
**Tests added:** 4
**ADRs written:** none (ADR-0047 amended)

---

## 2026-09-05 21:55 -- Modeling / Captured: agentic-workflow-pt0gy - Concurrent modeling sessions collide on protocol.md, INDEX.md, and the git index — make capture-side bookkeeping conflict-free

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** The builder runs one work session but several modeling sessions in parallel, and they race on the protocol prepend line, the INDEX task-counts/marker lists, and .git/index.lock. Narrower re-capture of the dismissed d5a9b: the pain is multi-writer bookkeeping files, not worktree-local backlogs. Candidate shapes — event-per-action with generated protocol/INDEX read models (aligned with the rework's EventLog/ReadModel ports), CLI-level advisory lock + index.lock retry, or per-session protocol shards. depends_on e4bjh (capture/dismiss must be mechanized before atomicity has a seam).

---

## 2026-09-05 21:55 -- Modeling / Captured: agentic-workflow-ghcaj - Worker branch carries source and tests only — the conductor applies README, ADR, and task-move bookkeeping on main from the worker's structured report

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Builder's complaint that parallel worktrees conflict very often. Evidence from the protocol: every merge-back conflict since ADR-0032 was prose or a build artifact (BC README bullets, ADR amendments at the same anchor, dist bundle), never code. Proposal: the worker's branch carries source + tests only; README delta, ADR bodies and the doing→done move travel as structured blocks in the worker report and are applied by the conductor on main, sequentially, at integration — checkpoint refuses .agentheim/ paths the way ADR-0057 refuses dashboard/dist/. Removes the same-BC-README collision class and lets MAX_PARALLEL rise for same-BC batches.

---


## 2026-09-05 21:54 -- Modeling / Promoted: infrastructure-rgknz - The dashboard runtime notices a plugin update — replace a live server that serves an older plugin version instead of reusing it

**Type:** Modeling / Promote
**BC:** infrastructure
**From → To:** backlog → todo

---

## 2026-09-05 22:02 -- Modeling / Refined: infrastructure-rgknz - The dashboard runtime notices a plugin update

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo
**Summary:** Builder answered the open symptom question: old UI after an update, no `already running` message noticed. Recorded that the simplest reading is "no release since v0.9.2, so the marketplace had nothing newer" (ADR-0013 manifest lag) — the unblock for that is cutting a release with w45ce's fresh dist; this task still guards the runtime once a newer version is on disk. Added one hardening criterion (`Cache-Control: no-cache` on static assets — today none are sent). Readiness gate cleared → promoted.
**Split into:** —
**ADRs written:** none

---

## 2026-09-05 21:52 -- Verification failed: agentic-workflow-jf6qz - Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; heal the three stale live INDEX headers on no-op rotation (Option A)

**Type:** Work / Verification failure
**Task:** agentic-workflow-jf6qz - Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; heal the three stale live INDEX headers on no-op rotation (Option A)
**Iteration:** 1 of 3
**Reasons:** criterion #7 unreachable — `skills/work/SKILL.md`'s session-end rotation step never commits a healed-only run, so the heal would strand three dirty INDEX.md files; README and ADR-0047 amendment claim a SKILL.md narrowing that does not exist; the worker had scoped `skills/` out on the conductor's over-narrow file-scope note
**Iteration hint:** likely-fixable
**Next:** re-dispatched worker

---

## 2026-09-05 21:50 -- Modeling / Captured: infrastructure-w45ce, infrastructure-rgknz - A marketplace install/update ships and serves an up-to-date dashboard

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** todo (w45ce), backlog (rgknz)
**Summary:** Builder field report — after updating the plugin in a consumer repo the dashboard is not properly installed/updated. Root causes found: (1) the committed `dashboard/dist/` is the shipped artifact and nothing rebuilds it at release time (`RELEASE.md` has no step; ADR-0057 deliberately keeps workers from committing it), and `main` is already stale (app changed 2026-07-15, dist built 2026-07-13); the marketplace also copies `main`, not the tag. → w45ce: release-step rebuild + a stdlib staleness check, filed to todo. (2) `launch.mjs` reuses any live pid regardless of which plugin version it serves — an old-version server survives an update (or serves from a removed cache dir). → rgknz: version-aware replace-not-reuse, filed to backlog pending the builder's observed symptom.

---

## 2026-09-05 21:38 -- Batch started: [agentic-workflow-jf6qz]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-jf6qz - Fix `archivedDoneHeader`'s hardcoded "most recent N" wording — it re-introduces the phantom-cap header on rotation; heal the three stale live INDEX headers on no-op rotation (Option A)
**Parallel:** no (1 worker — the only ready task)

---

## 2026-09-05 21:38 -- Modeling / Dismissed: agentic-workflow-d5a9b

**Type:** Modeling / Dismiss
**Dismissed:** agentic-workflow-d5a9b - Enable parallel worktree sessions with independent idea capture and ticket movement (agentic-workflow)

---

