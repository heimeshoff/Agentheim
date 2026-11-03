# Protocol

Chronological log of everything that happens in this project.
Newest entries on top.

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

