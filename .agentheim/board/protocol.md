# Protocol

Chronological log of everything that happens in this project.
Newest entries on top.

---

## 2026-11-03 20:55 -- Capture / Captured: agentic-workflow-wq4nd - Fix stale wording on the guard's styleguide carve-out and the README lint count

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Fix stale wording: worker/verifier/work SKILL omit the ADR-0085 styleguide carve-out; README lint count likely stale after dd8yn

---

## 2026-11-03 19:57 -- Work session ended

**Type:** Work / Session end
**Duration:** 16m
**Completed:** 1 (first-try PASS: 0, re-dispatched: 1, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Lost-result re-dispatches:** 0
**Lost-result escalations:** 0
**Dispatches:** agentic-workflow-e3zby: 3
**Commits:** 2
**Vision-conformance:** none — batch aligns with vision
**Batch mix:** 0% product-facing / 100% harness / 0% bookkeeping (1 task)
**Carry-over:** left behind (user WIP, 1 files)

---

## 2026-11-03 19:56 -- Task verified and completed: agentic-workflow-e3zby - Checkpoint guard compares real paths on both sides, so symlinked project paths (incl. macOS /var → /private/var) no longer silently refuse worker files; fixes the red "real checkpoint invocation" lib test

**Type:** Work / Task completion
**Task:** agentic-workflow-e3zby - Checkpoint guard compares real paths on both sides, so symlinked project paths (incl. macOS /var → /private/var) no longer silently refuse worker files; fixes the red "real checkpoint invocation" lib test
**Summary:** checkpoint guard resolves real paths on both sides so symlinked project paths (macOS /var) no longer silently refuse worker files; ADR-0057 amended
**Duration:** 14m
**Verification:** PASS (iteration 3)
**Files changed:** 2
**Tests added:** 3
**ADRs written:** ADR-0057 amendment

---

## 2026-11-03 19:54 -- Verification failed: agentic-workflow-e3zby - Checkpoint guard compares real paths on both sides

**Type:** Work / Verification failure
**Task:** agentic-workflow-e3zby - Checkpoint guard compares real paths on both sides
**Iteration:** 2 of 3
**Reasons:** realpathSync relaxes ADR-0057 pure/node:path-only guard without an amendment; module header now contradicts code
**Iteration hint:** likely-fixable
**Next:** re-dispatched worker

---

## 2026-11-03 19:51 -- Verification failed: agentic-workflow-e3zby - Checkpoint guard compares real paths on both sides

**Type:** Work / Verification failure
**Task:** agentic-workflow-e3zby - Checkpoint guard compares real paths on both sides
**Iteration:** 1 of 3
**Reasons:** one test added for criteria naming four behaviours; missing reverse mixed form, deleted-entry, genuinely-outside and caller-path-preservation tests
**Iteration hint:** likely-fixable
**Next:** re-dispatched worker

---

## 2026-11-03 19:49 -- Batch started: [agentic-workflow-e3zby]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-e3zby - Checkpoint guard compares real paths on both sides, so symlinked project paths (incl. macOS /var → /private/var) no longer silently refuse worker files; fixes the red "real checkpoint invocation" lib test
**Parallel:** scoped — builder named agentic-workflow-e3zby; no other ready tasks dispatched

---

## 2026-11-03 19:48 -- Modeling / Promoted: agentic-workflow-e3zby - Checkpoint guard compares real paths on both sides, so symlinked project paths (incl. macOS /var → /private/var) no longer silently refuse worker files; fixes the red "real checkpoint invocation" lib test

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-11-03 19:48 -- Modeling / Refined: agentic-workflow-e3zby - Checkpoint guard compares real paths on both sides

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Confirmed root cause (macOS /var → /private/var vs un-normalised path.relative in lib/derived-artifact-guard.mjs). Builder widened scope: fix the guard (real paths on both sides, deleted-file ancestor fallback, caller paths preserved in the manifest) so symlinked project paths no longer silently refuse worker files; plus symlink regression tests.

---

## 2026-11-03 19:36 -- Capture / Captured: agentic-workflow-e3zby - Fix the red "real checkpoint invocation" lib test — realpath its mkdtemp fixture root (macOS /var vs /private/var mismatch)

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Fix the red real-checkpoint-invocation lib test: realpath the mkdtemp fixture root (macOS /var vs /private/var).

---

## 2026-11-03 19:34 -- Work session ended

**Type:** Work / Session end
**Duration:** 1h20m (incl. API rate-limit pause)
**Completed:** 1 (first-try PASS: 0, re-dispatched: 1, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Lost-result re-dispatches:** 0
**Lost-result escalations:** 0
**Dispatches:** design-system-kw15t: 2 (plus one resume after a rate-limit interruption)
**Commits:** 2
**Vision-conformance:** none — batch aligns with vision
**Batch mix:** 100% product-facing / 0% harness / 0% bookkeeping (1 task)
**Carry-over:** left behind (user WIP, 1 files)

---

## 2026-11-03 19:34 -- Task verified and completed: design-system-kw15t - Markdown primitive renders ```mermaid fenced blocks as diagrams, in every doc the dashboard shows (context map, ADRs, READMEs, research)

**Type:** Work / Task completion
**Task:** design-system-kw15t - Markdown primitive renders ```mermaid fenced blocks as diagrams, in every doc the dashboard shows (context map, ADRs, READMEs, research)
**Summary:** Markdown primitive renders mermaid fences as token-themed SVG diagrams via a lazy mermaid chunk (ADR-0083); error fallback, theme-flip re-render, render cache, unique ids, canvas specimen
**Duration:** 1h12m (incl. rate-limit pause)
**Verification:** PASS (iteration 2)
**Files changed:** 9
**Tests added:** 14
**ADRs written:** none

---

## 2026-11-03 19:32 -- Verification failed: design-system-kw15t - Markdown primitive renders mermaid fences as diagrams

**Type:** Work / Verification failure
**Task:** design-system-kw15t - Markdown primitive renders mermaid fences as diagrams
**Iteration:** 1 of 3
**Reasons:** README_DELTA targets nonexistent section Ubiquitous language (appended-fallback would land inside ## Pointers); code and tests pass
**Iteration hint:** likely-fixable
**Next:** re-dispatched worker

---

## 2026-11-03 15:32 -- Batch started: [design-system-kw15t]

**Type:** Work / Batch start
**Tasks:** design-system-kw15t - Markdown primitive renders ```mermaid fenced blocks as diagrams, in every doc the dashboard shows (context map, ADRs, READMEs, research)
**Parallel:** scoped — builder named design-system-kw15t; no other ready tasks dispatched

---

## 2026-11-03 15:31 -- Work session ended

**Type:** Work / Session end
**Duration:** 10m30s
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Lost-result re-dispatches:** 1 (RESULT header missing CONCEPT_CANDIDATE; same worker re-emitted, no code change)
**Lost-result escalations:** 0
**Dispatches:** agentic-workflow-gvcy8: 1
**Commits:** 2
**Vision-conformance:** none — batch aligns with vision
**Batch mix:** 0% product-facing / 100% harness / 0% bookkeeping (1 task)
**Carry-over:** left behind (user WIP, 1 files)

---

## 2026-11-03 15:31 -- Task verified and completed: agentic-workflow-gvcy8 - Exempt the design-system styleguide source (.agentheim/knowledge/contexts/design-system/styleguide/) from the worker bookkeeping-path guard — it is source code, not bookkeeping

**Type:** Work / Task completion
**Task:** agentic-workflow-gvcy8 - Exempt the design-system styleguide source (.agentheim/knowledge/contexts/design-system/styleguide/) from the worker bookkeeping-path guard — it is source code, not bookkeeping
**Summary:** exempt design-system styleguide source from the worker bookkeeping-path guard (ADR-0085); doctrine states the carve-out once and points to it
**Duration:** 8m40s
**Verification:** PASS (iteration 1)
**Files changed:** 6
**Tests added:** 4
**ADRs written:** ADR-0085

---

## 2026-11-03 15:26 -- Batch started: [agentic-workflow-gvcy8]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-gvcy8 - Exempt the design-system styleguide source (.agentheim/knowledge/contexts/design-system/styleguide/) from the worker bookkeeping-path guard — it is source code, not bookkeeping
**Parallel:** scoped — builder named agentic-workflow-gvcy8; design-system-kw15t waits on it (not ready), no other ready tasks

---

## 2026-11-03 15:26 -- Modeling / Captured: agentic-workflow-gvcy8 - Exempt the design-system styleguide source (.agentheim/knowledge/contexts/design-system/styleguide/) from the worker bookkeeping-path guard — it is source code, not bookkeeping

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Bug found preparing design-system-kw15t: ADR-0078 put styleguide source under .agentheim/, and the ghcaj checkpoint guard refuses every .agentheim/ path, so no worker can edit the styleguide. Builder chose a narrow exemption; kw15t now depends on this.

---

## 2026-11-03 15:24 -- Modeling / Promoted: design-system-kw15t - Markdown primitive renders ```mermaid fenced blocks as diagrams, in every doc the dashboard shows (context map, ADRs, READMEs, research)

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-11-03 15:24 -- Work session ended

**Type:** Work / Session end
**Duration:** 6m10s (dispatch to integration; preceded by a dashboard node_modules repair — Homebrew openssl@3 cert.pem link restored by the builder, npm ci re-run)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Lost-result re-dispatches:** 0
**Lost-result escalations:** 0
**Dispatches:** infrastructure-yaajt: 1
**Commits:** 2
**Vision-conformance:** none — batch aligns with vision
**Batch mix:** 100% product-facing / 0% harness / 0% bookkeeping (1 task)
**Carry-over:** left behind (user WIP, 1 files)

---

## 2026-11-03 15:24 -- Task verified and completed: infrastructure-yaajt - Dashboard build emits lazily-loaded code-split chunks (dist/app.js + dist/chunks/), dependency pins become build-stamp inputs

**Type:** Work / Task completion
**Task:** infrastructure-yaajt - Dashboard build emits lazily-loaded code-split chunks (dist/app.js + dist/chunks/), dependency pins become build-stamp inputs
**Summary:** dashboard build emits app.js + content-hashed lazy chunks (esbuild splitting, ADR-0083); mermaid pinned 11.17.2; package.json/lock become build-stamp inputs
**Duration:** 4m10s
**Verification:** PASS (iteration 1)
**Files changed:** 8
**Tests added:** 6
**ADRs written:** none

---

## 2026-11-03 15:19 -- Batch started: [infrastructure-yaajt]

**Type:** Work / Batch start
**Tasks:** infrastructure-yaajt - Dashboard build emits lazily-loaded code-split chunks (dist/app.js + dist/chunks/), dependency pins become build-stamp inputs
**Parallel:** scoped — builder named infrastructure-yaajt; 0 other ready tasks not dispatched

---

## 2026-11-03 15:08 -- Work session ended

**Type:** Work / Session end
**Duration:** 19m10s
**Completed:** 1 (first-try PASS: 0, re-dispatched: 1, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Lost-result re-dispatches:** 0
**Lost-result escalations:** 0
**Dispatches:** agentic-workflow-dd8yn: 2
**Commits:** 3
**Vision-conformance:** none — batch aligns with vision
**Batch mix:** 100% product-facing / 0% harness / 0% bookkeeping (1 task)
**Carry-over:** left behind (user WIP, 1 files)

---

## 2026-11-03 15:08 -- Task verified and completed: agentic-workflow-dd8yn - context-map.md carries an authored ```mermaid relationship diagram alongside its prose — brainstorm's template and the strategic-modeler's output emit and maintain it

**Type:** Work / Task completion
**Task:** agentic-workflow-dd8yn - context-map.md carries an authored ```mermaid relationship diagram alongside its prose — brainstorm's template and the strategic-modeler's output emit and maintain it
**Summary:** context-map.md gains an authored mermaid relationship diagram — notation reference, brainstorm/strategic-modeler/worker wiring, live-tree lint
**Duration:** 19m10s
**Verification:** PASS (iteration 2)
**Files changed:** 6
**Tests added:** 8
**ADRs written:** ADR-0084

---

## 2026-11-03 15:04 -- Verification failed: agentic-workflow-dd8yn - context-map.md carries an authored mermaid relationship diagram

**Type:** Work / Verification failure
**Task:** agentic-workflow-dd8yn - context-map.md carries an authored mermaid relationship diagram
**Iteration:** 1 of 3
**Reasons:** README_DELTA empty despite a new BC convention/lint (ubiquitous language + Test command lint list go stale), advisory: no ADR for authored-not-derived/prose-wins
**Iteration hint:** likely-fixable
**Next:** re-dispatched worker

---

## 2026-11-03 15:04 -- Modeling / Promoted: infrastructure-yaajt - Dashboard build emits lazily-loaded code-split chunks (dist/app.js + dist/chunks/), dependency pins become build-stamp inputs

**Type:** Modeling / Promote
**BC:** infrastructure
**From → To:** backlog → todo

---

## 2026-11-03 15:04 -- Modeling / Refined: design-system-kw15t - Markdown primitive renders mermaid fences as diagrams

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** backlog
**Summary:** Architect pass: mermaid ships as a lazily-loaded esbuild chunk (ADR-0083, accepted by builder); token-to-themeVariables mapping, MutationObserver theme re-render, strict security, serialized render queue and cache specified; SSE re-render assumption corrected (open docs do not re-fetch today).
**Split into:** infrastructure-yaajt (build code-splitting, blocks kw15t), agentic-workflow-es288 (optional open-doc re-fetch)
**ADRs written:** ADR-0083

---

## 2026-11-03 15:04 -- Modeling / Captured: agentic-workflow-es288 - Open doc readers (slide-over + main-pane reader) re-fetch when their file changes on disk

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Optional follow-up from design-system-kw15t refinement: open doc readers re-fetch when their file changes on disk.

---

## 2026-11-03 15:04 -- Modeling / Captured: infrastructure-yaajt - Dashboard build emits lazily-loaded code-split chunks (dist/app.js + dist/chunks/), dependency pins become build-stamp inputs

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** backlog
**Summary:** Split from design-system-kw15t refinement: dashboard build switches to esbuild code-splitting (dist/app.js + dist/chunks/), pins mermaid, adds dependency pins to the build stamp (ADR-0083).

---

## 2026-11-03 14:59 -- Batch started: [agentic-workflow-dd8yn]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-dd8yn - context-map.md carries an authored ```mermaid relationship diagram alongside its prose — brainstorm's template and the strategic-modeler's output emit and maintain it
**Parallel:** scoped — builder named agentic-workflow-dd8yn; 0 other ready tasks not dispatched

---

## 2026-11-03 14:55 -- Modeling / Promoted: agentic-workflow-dd8yn - context-map.md carries an authored ```mermaid relationship diagram alongside its prose — brainstorm's template and the strategic-modeler's output emit and maintain it

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-11-03 14:55 -- Modeling / Refined: agentic-workflow-dd8yn - context-map.md carries an authored mermaid relationship diagram

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Builder decisions: lint the doctrine surfaces (notation reference, brainstorm template, strategic-modeler, worker.md) as ADR-0059 enforcement; only strategic-modeler/brainstorm edit the diagram (README_DELTA cannot edit inside a fence), prose wins on conflict; backfill existing maps when next touched. Canonical notation in a new references/context-map-notation.md with theme-neutral classDefs and a fixed edge-label vocabulary.

---

## 2026-11-03 14:51 -- Modeling / Captured: agentic-workflow-dd8yn - context-map.md carries an authored ```mermaid relationship diagram alongside its prose — brainstorm's template and the strategic-modeler's output emit and maintain it

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** context-map.md gains an authored mermaid relationship diagram alongside the prose, emitted by brainstorm and maintained by strategic-modeler.

---

## 2026-11-03 14:51 -- Modeling / Captured: design-system-kw15t - Markdown primitive renders ```mermaid fenced blocks as diagrams, in every doc the dashboard shows (context map, ADRs, READMEs, research)

**Type:** Modeling / Capture
**BC:** design-system
**Filed to:** backlog
**Summary:** Dashboard Markdown renders mermaid fences as diagrams in every doc; offline bundling (lazy chunk) to be decided in refinement.

---

## 2026-11-01 15:32 -- Release shipped: v0.9.7

**Type:** Release
**Version:** 0.9.6 → 0.9.7 (patch — a Herdr-mediated launch into an existing project workspace now opens the session as a right-hand split of the focused pane instead of a new tab)
**Manifest:** `.claude-plugin/plugin.json` bumped, committed `6d64bee`
**Marketplace ref:** `.claude-plugin/marketplace.json` pinned to `v0.9.7` (same commit)
**Changelog:** `CHANGELOG.md` `[Unreleased]` → `[0.9.7]` section rolled (same commit)
**Pushed:** yes — `main` + `v0.9.7` atomically (`4222dbd..6d64bee` on `origin/main`)
**Tag:** `v0.9.7` (annotated) → `6d64bee`, pushed to origin
**GitHub Release:** created via `gh` (from CHANGELOG)

---

## 2026-11-01 15:23 -- Work session ended

**Type:** Work / Session end
**Duration:** ~12m (batch start 15:15 to session end)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Lost-result re-dispatches:** 0
**Lost-result escalations:** 0
**Dispatches:** infrastructure-cztns: 1
**Commits:** 3
**Vision-conformance:** none — batch aligns with vision
**Batch mix:** 100% product-facing / 0% harness / 0% bookkeeping (1 task)
**Carry-over:** none — working tree clean; no non-main worktrees; 1 stranded RESULT sidecar removed; full suite in worktree 1972/1972

---

## 2026-11-01 15:22 -- Task verified and completed: infrastructure-cztns - A Herdr-mediated launch into an existing project workspace should open the new session in a new pane, split right off the focused pane, instead of a new tab; amends ADR-0082 §5

**Type:** Work / Task completion
**Task:** infrastructure-cztns - A Herdr-mediated launch into an existing project workspace should open the new session in a new pane, split right off the focused pane, instead of a new tab; amends ADR-0082 §5
**Summary:** Herdr-mediated launch into an existing project workspace now splits the focused pane of its active tab to the right (pane split) instead of opening a new tab; cold workspace-create path unchanged
**Duration:** 5m
**Verification:** PASS (iteration 1)
**Result source:** sidecar · layout both+sentinel · sidecar present
**Files changed:** 2
**Tests added:** 7
**ADRs written:** none (ADR-0082 amended §5)

---

## 2026-11-01 15:15 -- Batch started: [infrastructure-cztns]

**Type:** Work / Batch start
**Tasks:** infrastructure-cztns - A Herdr-mediated launch into an existing project workspace should open the new session in a new pane, split right off the focused pane, instead of a new tab; amends ADR-0082 §5
**Parallel:** no (1 worker — the only ready task across all contexts)

---

## 2026-11-01 15:12 -- Modeling / Captured: infrastructure-cztns - A Herdr-mediated launch into an existing project workspace should open the new session in a new pane, split right off the focused pane, instead of a new tab; amends ADR-0082 §5

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** todo
**Summary:** A Herdr-mediated launch into an existing project workspace now splits the focused pane to the right (pane split --focus) instead of opening a new tab; the cold workspace-create path is unchanged. Amends ADR-0082 §5.

---

