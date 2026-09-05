# Protocol

Chronological log of everything that happens in this project.
Newest entries on top.

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

