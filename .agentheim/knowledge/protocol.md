# Protocol

Chronological log of everything that happens in this project.
Newest entries on top.

---

## 2026-06-19 12:10 -- Work session ended

**Type:** Work / Session end
**Completed:** 2 (first-try PASS: 2 — agentic-workflow-t3b9k, design-system-v8k2p; re-dispatched: 0; skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2 (da6d161 t3b9k, 1b86ce2 v8k2p)
**Notes:**
- Parallel batch of 2 conflict-free workers (different BCs, no shared files): t3b9k carried mtimeMs on /api/tree research/ADR pointers (additive parallel meta maps — flat arrays byte-compatible; dashboard suite 630 green); v8k2p added the styleguide rail "new item" attention cue on TreeItem + Collapsible header (styleguide suite 122 green, ADR-0029 written). Both passed verification first try.
- **Concept candidate (design-system):** `ambient-motion-signal-taxonomy` — converging on 3 artifacts (design-system-004 doing-breathe, design-system-v8k2p new-item dot, ADR-0029). Builder may want a concept page distinguishing the two ambient-motion signals.
- **Gate note:** v8k2p is a visible styleguide change → the design-system gate is REOPENED. Builder should re-review the new AttentionCueSpecimen (section 09) on `styleguide/index.html` before aw-n4h7q ships.
- **Working-tree caveat:** the v8k2p worker's test run left `dashboard/dist/{app.js,agentheim.css,colors_and_type.css}` rebuilt with the attention-cue source in the working tree (uncommitted). Per ADR-0003 the dist rebuild belongs to the consuming task aw-n4h7q, so these were deliberately NOT committed — scoped adds kept them out. They sit alongside the pre-existing parallel-session changes (`knowledge/index.md`, `dashboard/app/board.js`, the readme-structure research report), all left untouched.
- **Next:** aw-n4h7q ("rail blinks new/updated research & ADRs") is now unblocked (both its deps t3b9k + v8k2p are done) but sits in backlog — promote via `modeling` to run it.

---

## 2026-06-19 12:08 -- Task verified and completed: design-system-v8k2p - Rail "new item" attention blink (TreeItem / TreeGroup ambient cue)

**Type:** Work / Task completion
**Task:** design-system-v8k2p - Rail "new item" attention blink — an ambient cue on a TreeItem / TreeGroup until acknowledged
**Summary:** Added the styleguide half of the rail "new item" attention cue — a quiet breathing left-edge dot (drawn from --st-todo, never the reserved selection ochre) toggled by an opt-in `attention` flag on both a TreeItem row and a Collapsible group header; off renders byte-identical, and the cue keeps a steady static dot under reduced motion. Detection/lifecycle and the dist/ rebuild stay with the consumer (agentic-workflow-n4h7q).
**Verification:** PASS (iteration 1)
**Files changed:** 7 (+ ADR-0029)
**Tests added:** 6 (styleguide suite 122 green)
**ADRs written:** ADR-0029 (ambient attention cue is a distinct signal from the active-status pulse; scope design-system)

---

## 2026-06-19 12:05 -- Task verified and completed: agentic-workflow-t3b9k - Carry mtimeMs on research/ADR location pointers in /api/tree

**Type:** Work / Task completion
**Task:** agentic-workflow-t3b9k - Carry mtimeMs on research/ADR location pointers in /api/tree
**Summary:** The /api/tree projection now carries each ADR and research location pointer's mtimeMs via additive parallel meta maps (locations.adrsMeta / locations.researchMeta), keyed by the same in-root path; the flat string arrays stay byte-compatible and an unstattable file degrades to mtimeMs: null without aborting the walk. Unblocks aw-n4h7q's "modified blinks".
**Verification:** PASS (iteration 1)
**Files changed:** 3
**Tests added:** 3 (dashboard suite 630 green)
**ADRs written:** none

---

## 2026-06-19 12:00 -- Batch started: [agentic-workflow-t3b9k, design-system-v8k2p]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-t3b9k - Carry mtimeMs on research/ADR location pointers in /api/tree, design-system-v8k2p - Rail "new item" attention blink (TreeItem / TreeGroup ambient cue)
**Parallel:** yes (2 workers)

---

## 2026-06-19 11:30 -- Modeling / Promoted: design-system-v8k2p - Rail "new item" attention blink

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-06-19 11:30 -- Modeling / Promoted: agentic-workflow-t3b9k - Carry mtimeMs on research/ADR location pointers in /api/tree

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-06-19 11:26 -- Modeling / Refined: agentic-workflow-n4h7q - Left rail blinks new or updated research docs and ADRs

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Cornered the three deferred edge cases (Interrogator). Builder decisions: (1) a flagged path that vanishes before being clicked reconciles against the live projection — drops silently, group header recomputes; (2) no cap — a batch arriving in one frame all blink; (3) **modified also blinks**, not created-only. Decision (3) requires research/ADR pointers in `/api/tree` to carry mtime (they don't today — only tasks do, aw-013), so the projection change was split into its own task (aw-013 → aw-012 precedent). Reworked n4h7q's "new" definition to path+mtime baseline map with mtime-versioned clearing (a later edit re-blinks), updated acceptance criteria, and added the new task to depends_on.
**Split into:** agentic-workflow-t3b9k (carry mtimeMs on research/ADR location pointers in /api/tree)
**ADRs written:** none

---

## 2026-06-19 00:00 -- Modeling / Captured: agentic-workflow-n4h7q + design-system-v8k2p - Rail blinks new research/ADRs until acknowledged

**Type:** Modeling / Capture
**BC:** agentic-workflow, design-system
**Filed to:** backlog
**Summary:** When a research report or ADR is created while the dashboard is open it should blink in the left rail until clicked or the page reloads. Captured as two linked backlog tasks (the ds → aw split): design-system-v8k2p adds the styleguide "new item" attention cue (an ambient, reduced-motion-strippable blink on a TreeItem / TreeGroup header, governed by ADR-0014, never the reserved ochre accent), and agentic-workflow-n4h7q detects session-new research/ADR paths over the live tree projection and applies the cue — leaf blinks + propagates to its (possibly collapsed) group header; clicking clears only that item; reload resets the baseline. In-memory presentation state only (read-only dashboard, ADR-0017). Builder decisions: propagate to group header; clicking clears only the clicked item.

---

## 2026-06-18 12:13 -- Work session ended

**Type:** Work / Session end
**Completed:** 2 (first-try PASS: 2 — design-system-r4k8m, agentic-workflow-h7n2c; re-dispatched: 0; skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2 (061f70d r4k8m, 313ff0a h7n2c)
**Notes:**
- Two-task dependency chain run sequentially: design-system-r4k8m (add the `message-circle-question` glyph to the shared icon registry) unblocked agentic-workflow-h7n2c (wire the fourth Inquire PromptLaunchCard between Modeling and Research, consuming the glyph). Both passed verification first try.
- Suites green: styleguide 116/116 after r4k8m; full dashboard suite 627 after h7n2c. h7n2c rebuilt `dashboard/dist/app.js` (ADR-0009 consuming task); r4k8m correctly left dist alone (ADR-0003 derived artifact).
- **Gate note:** r4k8m surfaced the new glyph on the section-04 styleguide canvas gallery, reopening the design-system gate — the builder should re-review `styleguide/index.html` § 04 and re-confirm the gate OPEN.
- **Concurrency note:** a parallel `research` session's in-flight artifacts (`knowledge/index.md` edit + `knowledge/research/readme-structure-developer-tool-2026-06-18.md`) were left uncommitted in the working tree throughout — scoped adds kept them out of both task commits per ADR-0026.

---

## 2026-06-18 12:12 -- Task verified and completed: agentic-workflow-h7n2c - Board prompt bar — Inquire launch button between Modeling and Research

**Type:** Work / Task completion
**Task:** agentic-workflow-h7n2c - Board prompt bar — Inquire launch button between Modeling and Research
**Summary:** Added a fourth Inquire PromptLaunchCard between Modeling and Research, wearing the message-circle-question glyph and seeding /agentheim:inquire <prompt> via a new INQUIRE_COMMAND + inquireCommandFor builder; reuses the existing bridge launch path unchanged.
**Verification:** PASS (iteration 1)
**Files changed:** 6 (incl. rebuilt dist/app.js)
**Tests added:** 13 (8 inquireCommandFor/INQUIRE_COMMAND + 5 prompt-bar guards; full dashboard suite 627 green)
**ADRs written:** none

---

## 2026-06-18 12:08 -- Batch started: [agentic-workflow-h7n2c]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-h7n2c - Board prompt bar — Inquire launch button between Modeling and Research
**Parallel:** no (1 worker)

---

## 2026-06-18 12:05 -- Task verified and completed: design-system-r4k8m - Add an inquiry/question glyph to the shared icon set

**Type:** Work / Task completion
**Task:** design-system-r4k8m - Add an inquiry/question glyph to the shared icon set
**Summary:** Added the Lucide `message-circle-question` glyph to the shared icon set so the board's Inquire launch card (agentic-workflow-h7n2c) can wear it unforked; surfaced in the section-04 canvas gallery, gate reopened for builder re-review.
**Verification:** PASS (iteration 1)
**Files changed:** 4
**Tests added:** 3 (icons-inquire.test.mjs; full styleguide suite 116/116 green)
**ADRs written:** none

---

## 2026-06-18 12:00 -- Batch started: [design-system-r4k8m]

**Type:** Work / Batch start
**Tasks:** design-system-r4k8m - Add an inquiry/question glyph to the shared icon set
**Parallel:** no (1 worker)

---

## 2026-06-18 11:48 -- Modeling / Captured: agentic-workflow-h7n2c + design-system-r4k8m - Board prompt bar Inquire button

**Type:** Modeling / Capture
**BC:** agentic-workflow, design-system
**Filed to:** todo
**Summary:** A fourth board-prompt-bar launch card, **Inquire**, between Modeling and Research, seeding `/agentheim:inquire <prompt>` (the read-only codebase-question skill) via the existing bridge path. Captured as two linked todo tasks: design-system-r4k8m adds the missing inquiry glyph to the shared icon set (ds-017 precedent), and agentic-workflow-h7n2c wires the card (depends on the glyph + the styleguide gate). Direct lineage of aw-036 (Research card) / aw-065 (prompt-bar card redesign).

---

## 2026-06-18 11:42 -- Modeling / Dismissed: agentic-workflow-m3k9p

**Type:** Modeling / Dismiss
**Dismissed:** agentic-workflow-m3k9p - Try the dismiss button (agentic-workflow)

---

## 2026-06-18 11:34 -- Capture / Captured: agentic-workflow-m3k9p - Try the dismiss button

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Capturing an idea just to try the dismiss button.

---

## 2026-06-18 11:34 -- Release shipped: v0.8.7

**Type:** Release
**Version:** 0.8.6 → 0.8.7 (patch — large dashboard release: What's Next advisory panel, global search, first-class Concepts, Workflow guide page, collision-resistant task IDs)
**Manifest:** `.claude-plugin/plugin.json` bumped, committed `f6525b9`
**Pushed to main:** yes (`b28cb29..f6525b9` on `origin/main`)
**Tag:** `v0.8.7` (annotated) → `f6525b9`, pushed to origin
**GitHub Release:** deferred (gh unavailable — notes handed to builder)

---

## 2026-06-18 11:30 -- Research: Structuring a GitHub README for a developer tool (Claude Code plugin + VS Code)

**Type:** Research
**Requested by:** user
**Report:** knowledge/research/readme-structure-developer-tool-2026-06-18.md
**Review:** PASS (iteration 1)
**Summary:**
- Proven section order: logo/tagline + badges → hero screenshot/GIF above the fold → one-paragraph what & why → Install → How it works/Philosophy → Usage → links → Contributing → License.
- Multi-environment install = one heading, labeled per-environment subsections, simplest path inline + longer paths folded in `<details>` (gum); Claude Code plugin install is two-step (`/plugin marketplace add owner/repo` → `/plugin install name@marketplace`) + `/reload-plugins`.
- Dashboard screenshot near the top with descriptive alt text, inside `<picture>` + `prefers-color-scheme` for light/dark; exemplars gum / httpie / opencode / awesome-readme.

---

## 2026-06-18 11:32 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1 — aw-c4t8m; re-dispatched: 0; skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (06f4eb1 aw-c4t8m)
**Notes:**
- Single-task session in the `agentic-workflow` BC. aw-c4t8m (What's Next columns become capped, scrollable cards) passed verification first try; full dashboard suite 614 pass / 0 fail.
- `dashboard/dist/` rebuilt by the worker up front (the standing dashboard-source rule honored; orchestrator confirmed `maxHeight:196` + `scroll-quiet` in the bundle before verifying).
- **Concurrency note:** a parallel `research` session was mid-commit (its README-structure report + `index.md` + an 11:30 protocol entry were uncommitted in the working tree). To honor the ADR-0026 scoped-add rule, this session-end line was **not** committed separately — committing `protocol.md` would have swept the research session's in-flight entry into a work commit. The line rides in the next protocol writer's commit.

---

## 2026-06-18 11:05 -- Task verified and completed: agentic-workflow-c4t8m - What's Next columns become their own capped, scrollable cards

**Type:** Work / Task completion
**Task:** agentic-workflow-c4t8m - What's Next columns become their own capped, scrollable cards
**Summary:** Each of the What's Next panel's three section columns now renders as its own board-local, token-matched card (--surface-1 fill, --hairline border, token radius + padding), height-capped to ~two ticket cards (maxHeight 196) with internal overflow scroll via the quiet styleguide scrollbar, so the advisory strip stays a compact top strip regardless of recommendation length.
**Verification:** PASS (iteration 1)
**Files changed:** 4 (incl. rebuilt dist/)
**Tests added:** 4 new card-chrome/cap/scroll/grid guards in whats-next-panel.test.mjs; full dashboard suite 614 pass / 0 fail
**ADRs written:** none

---

## 2026-06-18 11:02 -- Batch started: [agentic-workflow-c4t8m]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-c4t8m - What's Next columns become their own capped, scrollable cards
**Parallel:** no (1 worker)

---

## 2026-06-18 10:48 -- Modeling / Captured: agentic-workflow-c4t8m - What's Next columns become their own capped, scrollable cards

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Follow-on to aw-q7m4k — wrap each of the What's Next panel's three section columns in its own board-local, token-matched card, cap each card's height at ~two ticket cards, and scroll content internally on overflow so the advisory strip stays compact at the top of the board instead of eating a quarter of the screen.

---

## 2026-06-18 10:44 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1 — aw-q7m4k; re-dispatched: 0; skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (6ab6478 aw-q7m4k, + this session-end line)
**Notes:**
- Single-task session in the `agentic-workflow` BC. aw-q7m4k (What's Next card — strip front matter, three-column layout) passed verification first try; full dashboard suite 610 pass / 0 fail.
- `dashboard/dist/` rebuilt by the worker (the standing dashboard-source rule that bit aw-074 last session was honored up front this time).
- Pre-existing working-tree noise (deleted `Screenshot 2026-06-17 112241.png`, untracked `dashboard.png`) left untouched per the prior session's convention.

---

## 2026-06-18 10:42 -- Task verified and completed: agentic-workflow-q7m4k - What's Next card drops the front matter and lays its three sections out as columns

**Type:** Work / Task completion
**Task:** agentic-workflow-q7m4k - What's Next card drops the front matter and lays its three sections out as columns
**Summary:** The dashboard's What's Next advisory panel drops the folded front-matter render and lays its three named sections (where things stand / recommended move / next) out as three side-by-side, loss-tolerant columns, each rendered through the unforked styleguide Markdown primitive.
**Verification:** PASS (iteration 1)
**Files changed:** 7 (incl. rebuilt dist/)
**Tests added:** new `whats-next-sections.test.mjs` splitter suite + adapted `whats-next-panel.test.mjs`; full dashboard suite 610 pass / 0 fail
**ADRs written:** none

---

## 2026-06-18 10:35 -- Batch started: [agentic-workflow-q7m4k]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-q7m4k - What's Next card drops the front matter and lays its three sections out as columns
**Parallel:** no (1 worker)

---

## 2026-06-18 10:30 -- Modeling / Captured: agentic-workflow-q7m4k - What's Next card drops the front matter and lays its three sections out as columns

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Refinement of the aw-073 What's Next dashboard panel — stop rendering the folded "Front matter" section, and lay the three advisory sections (where things stand / recommended move / next) out as three side-by-side columns instead of one stacked markdown stream.

---

## 2026-06-18 10:08 -- Work session ended

**Type:** Work / Session end
**Completed:** 5 (first-try PASS: 4 — aw-078, aw-080, aw-075, aw-079; re-dispatched: 1 — aw-074 passed iteration 2; skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 5 (0deadaf aw-078, 6d73214 aw-080, 204d70f aw-074, c40a9c1 aw-075, aca34bc aw-079, + this session-end line)
**Notes:**
- Two waves, all five tasks in the single `agentic-workflow` BC. **Wave 1** (3-worker parallel): aw-074 (slide-over expand chevron), aw-078 (deriveContext dual-shape regex), aw-080 (duplicate-id guard) — disjoint files (dashboard / lib / new lib module). **Wave 2** (2-worker parallel): aw-075 (dashboard concepts rail+search) + aw-079 (skills minting-prose sweep) — disjoint files. aw-075 was held from wave 1 (shared `dashboard/dist/` rebuild with aw-074); aw-079 was dependency-blocked on aw-078 until wave 1 cleared it.
- **aw-074 failed verification iteration 1** — verifier caught a real, user-facing defect: AC#9 unmet, `dashboard/dist/` was a stale bundle (still the old maximize button, no expand wiring). Source AC#1–#8 were all correct. Re-dispatched worker rebuilt dist (`node build.mjs`); PASS on iteration 2. **Lesson reinforced:** any dashboard-source task must rebuild `dist/` or it ships nothing.
- **Same-BC-README parallel-edit hazard, handled:** aw-074 and aw-080 (wave 1) both edited `contexts/agentic-workflow/README.md` in disjoint sections; their edits coexisted cleanly, and each task's hunk was committed separately via `git apply --cached` hunk-splitting to keep one-task-one-commit. aw-075 (wave 2) also touched the README but aw-079 did not, so no second collision.
- **Verifier tooling note:** the aw-074 iteration-1 verifier ran `node build.mjs` then `git checkout` to "restore" the tree, which reverted the worker's legitimate dist rebuild. Subsequent verifiers were given an explicit "do NOT run any git-write/checkout" rule. Worth hardening in `agents/verifier.md` so a read-only auditor never mutates the shared working tree.
- No bounces, failures, escalations, or concept candidates across the session.
- Pre-existing working-tree noise (deleted `Screenshot 2026-06-17 112241.png`, untracked `dashboard.png`) left untouched.

---

## 2026-06-18 10:07 -- Task verified and completed: agentic-workflow-079 - Minting call-site token sweep

**Type:** Work / Task completion
**Task:** agentic-workflow-079 - Sweep id-minting prose in the three live skills from next-number to random token
**Summary:** The id-minting prose in quick-capture, modeling, and brainstorm now mints ADR-0028 random `<bc>-<token>` ids via a byte-identical grammar clause citing ADR-0028 §1; DISMISS retirement restated per §5; the two reserved foundation ids (`design-system-001-styleguide`, `infrastructure-001-walking-skeleton`) pinned per §7. Prose-only, no code; `capture-workspace/` fixtures untouched.
**Verification:** PASS (iteration 1)
**Files changed:** 3 (skills/quick-capture, skills/modeling, skills/brainstorm SKILL.md)
**Tests added:** 0 (documentation/prose only)
**ADRs written:** none

---

## 2026-06-18 10:05 -- Task verified and completed: agentic-workflow-075 - Concepts first-class rail group + searchable category

**Type:** Work / Task completion
**Task:** agentic-workflow-075 - Concepts are a first-class artifact kind — left-rail nav group + searchable category
**Summary:** Concepts surface as a first-class group across both dashboard discovery surfaces — a left-rail nav group (immediately after Bounded contexts) and a searchable category — drawing from the per-BC `tree.contexts[].concepts` paths the projection already carries; `concept` type pill resolves via the ds-021 registry. Loss-tolerant, styleguide consumed unforked.
**Verification:** PASS (iteration 1)
**Files changed:** 9 source/test + rebuilt dist
**Tests added:** new Concepts cases across library-data / search / search-results / slide-over-data suites (601/601 green)
**ADRs written:** none

---

## 2026-06-18 09:52 -- Batch started: [agentic-workflow-075, agentic-workflow-079]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-075 - Concepts first-class rail group + searchable category, agentic-workflow-079 - Minting call-site token sweep across the three live skills
**Parallel:** yes (2 workers)

---

## 2026-06-18 09:50 -- Task verified and completed: agentic-workflow-074 - Slide-over expand/collapse-width chevron

**Type:** Work / Task completion
**Task:** agentic-workflow-074 - Slide-over gets an expand/collapse-width chevron, replacing the full-screen button
**Summary:** The slide-over header's "Open in full screen" maximize button is replaced by the ds-020 in-place expand chevron — readers widen a ticket where they are (to fill the main content area right of the 248px rail) and collapse it back, no main-pane promotion; the aw-039 promote path stays live, reached only via global search.
**Verification:** PASS (iteration 2 — iteration 1 failed on a stale `dist/` bundle; source AC#1–#8 were correct from iteration 1, the rebuild closed AC#9)
**Files changed:** 7 (incl. regenerated `dist/`)
**Tests added:** 1 new (`slide-over-expand.test.mjs`) + 2 adapted (`slide-over-full-screen.test.mjs`, `frontmatter.test.mjs`)
**ADRs written:** none

---

## 2026-06-18 09:46 -- Verification failed: agentic-workflow-074 - Slide-over expand/collapse-width chevron

**Type:** Work / Verification failure
**Task:** agentic-workflow-074 - Slide-over expand/collapse-width chevron
**Iteration:** 1 of 3
**Reasons:** AC#9 unmet — `dashboard/dist/` was not rebuilt; the shipped bundle still carries the old maximize button and lacks the in-place expand wiring (source AC#1–#8 all correct)
**Iteration hint:** likely-fixable
**Next:** re-dispatched worker (iteration 2 — rebuild dist + restore frontmatter.test.mjs edit the verifier's git-checkout reverted)

---

## 2026-06-18 09:44 -- Task verified and completed: agentic-workflow-080 - Duplicate task-id guard

**Type:** Work / Task completion
**Task:** agentic-workflow-080 - Duplicate task-id guard across the lifecycle tree
**Summary:** Pure, stdlib-only, loss-tolerant scanner (`findDuplicateTaskIds` in `lib/duplicate-id-check.mjs`) walks every BC's four lifecycle folders, compares ids whole (shape-agnostic), and reports any id claimed by more than one file with all colliding paths. node --test covers fixtures plus a live-`.agentheim/`-tree no-duplicates assertion.
**Verification:** PASS (iteration 1)
**Files changed:** 3
**Tests added:** 9 (fixtures: duplicate→both paths, all-distinct→empty, mixed legacy+token whole-id, loss-tolerant; live-tree assertion)
**ADRs written:** none

---

## 2026-06-18 09:42 -- Task verified and completed: agentic-workflow-078 - deriveContext dual-shape token regex

**Type:** Work / Task completion
**Task:** agentic-workflow-078 - deriveContext dual-shape token regex
**Summary:** deriveContext now resolves the BC for both legacy all-digit and new leading-letter token id shapes via a u-excluding, end-anchored dual-shape regex (ADR-0028 §4), fallback preserved; resolveTaskFile unchanged with a new token-tailed resolution test.
**Verification:** PASS (iteration 1)
**Files changed:** 2
**Tests added:** 4 (deriveContext both shapes, malformed-token fallback, token-tailed resolveTaskFile)
**ADRs written:** none

---

## 2026-06-18 09:30 -- Batch started: [agentic-workflow-074, agentic-workflow-078, agentic-workflow-080]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-074 - Slide-over expand/collapse-width chevron, agentic-workflow-078 - deriveContext dual-shape token regex, agentic-workflow-080 - Duplicate task-id guard
**Parallel:** yes (3 workers)

---

## 2026-06-18 00:28 -- Modeling / Promoted: agentic-workflow-080 - Duplicate task-id guard across the tree

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-06-18 09:10 -- Modeling / Refined: agentic-workflow-079 - Minting call-site token sweep

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Grounded the AC against the live prose (verified quick-capture:154, modeling:263 ID-convention, modeling:206 retirement; confirmed `capture-workspace/` fixtures are out-of-scope snapshots). Closed two ADR-0028 §7 gaps the AC was silent on: pinned the walking-skeleton placeholder `infrastructure-XXX` to the reserved literal `infrastructure-001-walking-skeleton`, and mandated brainstorm's non-foundation decision tasks use random tokens (reserved set closed at the two foundation ids). Added a drift guard from the aw-077 precedent — the three inline token-emit statements must be byte-identical and each cite ADR-0028 §1 as canonical. Promoted backlog → todo.
**Split into:** none
**ADRs written:** none

---

## 2026-06-18 09:05 -- Modeling / Promoted: agentic-workflow-078 - deriveContext dual-shape token regex

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-06-18 00:08 -- Modeling / Promoted: agentic-workflow-075 - Concepts are a first-class artifact kind — left-rail nav group + searchable category

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-06-18 00:20 -- Modeling / Refined: agentic-workflow-080 - Duplicate task-id guard across the tree

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Refined the ADR-0028 child-task-4 "CI lint" into a concrete deliverable after finding the repo has **no CI** (no `.github/`, no Actions, no root `package.json`). Reframed to a pure, stdlib-only `lib/duplicate-id-check.mjs` scanner unit-tested under `node --test` (mirroring `task-lifecycle.mjs` / `tree.mjs` doctrine), with a live-`.agentheim/`-tree assertion replacing the "passes on current tree" + "CI wiring" criteria. Sharpened id extraction (frontmatter `id`, filename fallback, loss-tolerant), whole-id shape-agnostic comparison (independent of aw-078's `deriveContext`), and concrete file/function names. Renamed file slug `…-ci-lint` → `…-duplicate-task-id-guard`; added related_adrs 0022/0012. Kept `depends_on: []` (genuinely independent of aw-078/079); left in backlog (optional insurance, not promoted).
**Split into:** none
**ADRs written:** none

---

## 2026-06-18 09:00 -- Modeling / Refined: agentic-workflow-078 - deriveContext dual-shape token regex

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Hardened the edges of the already-ratified split task (no reshaping — grammar is fixed by ADR-0028). Added two ACs/notes from reading the code: (1) a **no-match fallback** criterion — the new end-anchored regex is stricter than the old `/^(.*)-\d+/`, so a neither-shape id must still return the id unchanged via `m ? m[1] : id` (test pinned); (2) a **caller-confirmation note** — `deriveContext` has exactly one caller, `applyTaskMove` (line 147), always passed the bare id, so end-anchoring is safe. Restated the `u`-excluding regex guard from aw-077's verification. Verified implementable against `lib/task-lifecycle.mjs`. Task is ready for `todo`.
**Split into:** —
**ADRs written:** —

---

## 2026-06-18 00:08 -- Modeling / Promoted: agentic-workflow-075 - Concepts are a first-class artifact kind — left-rail nav group + searchable category

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-06-18 09:00 -- Modeling / Promoted: agentic-workflow-074 - Slide-over gets an expand/collapse-width chevron, replacing the full-screen button

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

Unblocked: both dependencies (design-system-001-styleguide, design-system-020) are now in `done/` — ds-020 (the Drawer expandable-width primitive) shipped this session, clearing the pure-consumer block the second refine flagged. Acceptance criteria concrete and dependency-met; ready to work.

---

## 2026-06-18 00:06 -- Work session ended

**Type:** Work / Session end
**Completed:** 4 (first-try PASS: 3 — aw-073, ds-020, ds-021; re-dispatched: 1 — aw-077 passed iteration 2; skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 5 (1fd313f aw-073, 75f6261 ds-020, c4f45bc ds-021, 8a3c538 aw-077, + this session-end line)
**Notes:**
- Two waves, both 2-worker parallel batches. **Wave 1:** aw-073 (dashboard) + ds-020 (styleguide) — disjoint BCs/files, both PASS first try. **Wave 2:** aw-077 (decision/ADR) + ds-021 (styleguide) — held from wave 1 on conflicts (aw-077↔aw-073 same-BC README; ds-021↔ds-020 shared icons.js/index.html/README).
- **aw-077 failed verification on iteration 1** — the verifier caught a real, load-bearing defect: the ratified token grammar regex `[a-hjkmnp-z]` spans `p-z` and so re-admitted the look-alike `u` that the Crockford alphabet deliberately excludes, and the §2 collision math ("28 letters → 29.4M") matched neither the alphabet nor the regex; the defect propagated into child task aw-078. Re-dispatched worker (iteration 2) reconciled everything to one `u`-excluding definition (`[a-hjkmnp-tv-z]`, 22 letters → ~23.1M, ~0.005%). PASS on iteration 2.
- aw-077 spawned **3 backlog children** (aw-078 deriveContext dual-shape regex + tests; aw-079 minting-call-site sweep; aw-080 duplicate-id CI lint) — not work-eligible until refined/promoted. ADR-0028 (scope: global) recorded in the global index.
- Backlog now holds aw-074 / aw-075 (dependency-blocked consumers, unblocked by ds-020 / ds-021 respectively) and the three new ID-scheme children. Nothing left in todo/doing.
- No bounces, failures, escalations, or concept candidates. Pre-existing working-tree noise (deleted `Screenshot ….png`, untracked `dashboard.png`) left untouched.

---

## 2026-06-18 00:05 -- Task verified and completed: agentic-workflow-077 - Collision-resistant task IDs

**Type:** Work / Task completion
**Task:** agentic-workflow-077 - Collision-resistant task IDs for multi-user / multi-branch work (replace sequential integers)
**Summary:** Ratified **ADR-0028** (`scope: global`) replacing sequential-integer task ids with a `<bc>-<token>` scheme — token = 5 chars from Crockford base32 minus look-alikes, leading letter `[a-hjkmnp-tv-z]` — collision-free by construction for zero-coordination multi-branch capture; legacy `<bc>-NNN` ids coexist go-forward (no rewrite). Amends ADR-0022 §5, cross-links ADR-0012. Resolved the well-known foundation-id question (reserved deterministic ids owned by `brainstorm`). Implementation split into backlog children aw-078/079/080.
**Verification:** PASS (iteration 2) — iteration 1 failed on a token-grammar inconsistency (regex re-admitted the look-alike `u`); the re-dispatch reconciled the alphabet, regex, and §2 collision math to one `u`-excluding definition and propagated the fix into aw-078 and aw-080.
**Files changed:** 4 (ADR-0028 new, ADR-0022 amended, ADR-0012 cross-linked, README aggregate prose) + 3 new backlog child tasks
**Tests added:** 0 (decision task — no code; implementation deferred to children)
**ADRs written:** 0028-collision-resistant-task-ids-short-random-token.md (scope: global)

---

## 2026-06-17 23:55 -- Verification failed: agentic-workflow-077 - Collision-resistant task IDs

**Type:** Work / Verification failure
**Task:** agentic-workflow-077 - Collision-resistant task IDs for multi-user / multi-branch work
**Iteration:** 1 of 3
**Reasons:** ADR-0028 token grammar internally inconsistent — ratified regex `[a-hjkmnp-z]` / `[0-9a-hjkmnp-z]` spans `p-z` and so re-admits the look-alike `u` that the "minus look-alikes" alphabet excludes; §2 collision math ("28 letters → 29.4M") matches neither the 22-letter alphabet nor the 23-letter regex; the defective regex propagates into child task aw-078 (runtime regex would admit `u` while the aw-079 generator excludes it)
**Iteration hint:** likely-fixable
**Next:** re-dispatched worker (iteration 2)

---

## 2026-06-17 23:54 -- Task verified and completed: design-system-021 - Concept content-type — registry entry + glyph + --ct-concept tokens

**Type:** Work / Task completion
**Task:** design-system-021 - Concept content-type — registry entry + glyph + --ct-concept tokens for the library/search type
**Summary:** `concept` is now a first-class content type in the styleguide registry — the seventh type (label "Concept", `lightbulb` glyph, magenta `--ct-concept` tokens in both themes) — closing the `TreeItem` deref gap that would have thrown when aw-075 renders a `type: 'concept'` row.
**Verification:** PASS (iteration 1)
**Files changed:** 6
**Tests added:** new content-type-concept suite (styleguide suite 113 green)
**ADRs written:** none

---

## 2026-06-17 23:49 -- Batch started: [agentic-workflow-077, design-system-021]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-077 - Collision-resistant task IDs for multi-user / multi-branch work, design-system-021 - Concept content-type — registry entry + glyph + --ct-concept tokens
**Parallel:** yes (2 workers)
**Notes:** Wave 2 — the two tasks held from wave 1's conflicts. Different BCs, disjoint file sets (aw-077 → lib/ + skills + ADR; ds-021 → styleguide icons/data/css). aw-077 is `type: decision` (keystone = ADR-0028).

---

## 2026-06-17 23:46 -- Task verified and completed: design-system-020 - Drawer gains in-place expandable width

**Type:** Work / Task completion
**Task:** design-system-020 - Drawer gains in-place expandable width — controlled expand seam + body-top chevron + panel glyph pair
**Summary:** The slide-over `Drawer` gained an in-place expandable-width capability — a controlled `expanded` / `onToggleExpand` / `expandedWidth` seam driven by a body-top chevron that widens the panel where you are, kept distinct from ds-009's promote-out maximize. Styleguide capability only; the rail-aware wiring and `dist/` rebuild are deferred to aw-074.
**Verification:** PASS (iteration 1)
**Files changed:** 6
**Tests added:** 11 (drawer-expand suite; styleguide suite 107 green)
**ADRs written:** none

---

## 2026-06-17 23:45 -- Task verified and completed: agentic-workflow-073 - Dashboard renders the What's next recommendation as a dismissible panel above the board prompt bar

**Type:** Work / Task completion
**Task:** agentic-workflow-073 - Dashboard renders the What's next recommendation as a dismissible panel above the board prompt bar
**Summary:** The dashboard now renders the What's next advisory recommendation (ADR-0027) as a dismissible, live-refreshing panel above the board prompt bar — reading the artifact via the existing `/api/doc` carrier and the unforked frontmatter-folding `Markdown` path, with a `generated`-keyed dismiss store that re-shows on a newer recommendation.
**Verification:** PASS (iteration 1)
**Files changed:** 6
**Tests added:** 2 (whats-next-state + whats-next-panel suites; dashboard suite 588 green)
**ADRs written:** none

---

## 2026-06-17 23:39 -- Batch started: [agentic-workflow-073, design-system-020]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-073 - Dashboard renders the What's next recommendation as a dismissible panel above the board prompt bar, design-system-020 - Drawer gains in-place expandable width
**Parallel:** yes (2 workers)
**Held to next wave:** agentic-workflow-077 (same-BC README conflict with aw-073), design-system-021 (shares icons.js / index.html / README with ds-020)

---

## 2026-06-17 22:50 -- Modeling / Refined: agentic-workflow-077 - Collision-resistant task IDs for multi-user / multi-branch work (replace sequential integers)

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Cornered the decision via an architect round. Builder fixed migration policy to **go-forward coexistence** (legacy `aw-NNN` ids kept, no rewrite sweep) and delegated the scheme choice to the architect, which scored A/B/C and recommended **scheme B — a 5-char random Crockford-base32 token with a leading-letter rule** (`agentic-workflow-k3f9q`): zero-coordination, collision-free by construction, short against the already-long BC prefix, and coexisting with legacy all-digit ids via one structural tell. Grounded the change against the implementation: `deriveContext` (`lib/task-lifecycle.mjs`, `/^(.*)-\d+/`) is the one code change; `resolveTaskFile`'s trailing-`-` anchor needs none. Surfaced a real wrinkle the architect missed — the styleguide gate hard-codes the well-known id `design-system-001-styleguide` in `modeling`/`brainstorm`, which breaks if `brainstorm` mints a random token for it in a new project — and made resolving it an explicit ADR criterion. Tightened acceptance criteria, recorded the proposed grammar + the deferred child-task split (refactor + chore, no migration child) in Notes. Decision is now concrete enough for a worker to write ADR-0028; **promoted backlog → todo**.
**Split into:** — (implementation children created when the decision lands, not now)
**ADRs written:** — (ADR-0028 authored when the task is worked)

---

## 2026-06-17 22:48 -- Modeling / Refined: design-system-021 - Concept content-type — registry entry + glyph + --ct-concept tokens

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** todo
**Summary:** Locked the two visual choices the capture had deferred "to a gate decision," with the builder, at refine — turning the styleguide gate from a decision into a confirmation. **Glyph → `lightbulb`** (over runner-up `notebook-pen` / `sparkles`). **Hue → magenta / pink** (over the originally-proposed green), for maximal distinctness from the six existing content-type hues (nearest neighbour is map purple); concrete proposed token values baked into *What* item 3 — light `#B0479A`/`#F7E3F1`, dark `#D98AC8`/`#2A1626` — so the worker has a target and the gate just confirms. Verified every technical claim against the live source: `CONTENT_TYPES` (`data.js`) has no `concept` key and `TreeItem` would throw on the deref; `icons.js` has no idea/insight glyph; `agentheim.css` carries the six `--ct-*` pairs in both light `:root` and the dark block, with magenta genuinely unused. No ADR / no specialist handoff — pure styleguide-capability under ADR-0003/ADR-0016, the only open points being visual taste. **Promoted backlog → todo** (its only dependency, the ds-001 styleguide gate, is OPEN). Unblocks `agentic-workflow-075`.
**Split into:** —
**ADRs written:** —

---

## 2026-06-17 22:45 -- Modeling / Refined: design-system-020 - Drawer gains in-place expandable width

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** todo
**Summary:** Refined the Drawer expandable-width capability (split off from aw-074 earlier today). The one genuinely open design choice was the **expand-chevron placement** — a new body-top slot vs. grouping it in the header next to maximize/Close. Put it to the builder with side-by-side mockups; builder **ratified the body-top-left slot** (the current spec). Locked the decision into the task Notes (header-action alternative explicitly rejected, so the worker won't relocate it). Everything else was already concrete + testable and the sole dependency (`design-system-001` styleguide gate) is done/open, so **promoted backlog → todo** — clearing the dependency aw-074's refine flagged as the path forward.
**Split into:** —
**ADRs written:** —

---

## 2026-06-17 22:42 -- Modeling / Refined: agentic-workflow-074 - Slide-over gets an expand/collapse-width chevron, replacing the full-screen button

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Second refinement pass. Cross-checked the consumed interface against the split child **design-system-020** — `expanded` / `onToggleExpand` / consumer-supplied `expandedWidth`, the body-top chevron + `panel-right-open`/`panel-right-close` glyph pair, and the deferred-to-consumer `dist/` rebuild all line up; backlinks bidirectional. Tightened AC#3 so the chevron reads as the **ds-020 primitive's** (aw-074 wires + verifies the seam, never renders a board-local glyph). **Held in `backlog` — dependency-blocked:** ds-020 (the primitive) is still in backlog, and a pure consumer cannot be worked or promoted ahead of the primitive it imports. Path forward: promote + work ds-020, then promote aw-074.
**Split into:** —
**ADRs written:** —

---

## 2026-06-17 22:40 -- Modeling / Refined: agentic-workflow-075 - Concepts are a first-class artifact kind — left-rail nav group + searchable category

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Resolved the three "small decisions" the task flagged, all checked against the real transforms. (1) **Title source → `baseName`**: the tree carries `bc.concepts` as paths only (`tree.mjs:157`), so a frontmatter title would mean new server data the task forbids — concepts title like ADRs/research do. (2) **Search position → confirmed** immediately after Bounded contexts. (3) **Icon → decisive & a hard dependency**: `CONTENT_TYPES` (`data.js`) has no `concept` key and `TreeItem` dereferences `CONTENT_TYPES[type].icon`, so a `concept` row would throw; the registry also has no fitting glyph. Split off **design-system-021** (concept content-type entry + glyph + `--ct-concept` tokens) and added it to `depends_on` — aw-075 stays in backlog until it ships. Also corrected a wrong acceptance criterion: the rail and search orderings are **not** mirrored (Research/Decisions deliberately flipped since aw-056); the real invariant is the two *search* orderings being byte-identical and Concepts sitting right after Bounded contexts on all three surfaces. Flagged the in-scope `slide-over-data.js` `CONTENT_TYPE_KEYS` allow-list addition.
**Split into:** design-system-021 (dependency)
**ADRs written:** —

---

## 2026-06-17 22:05 -- Modeling / Refined: agentic-workflow-073 - Dashboard renders the What's next recommendation as a dismissible panel above the board prompt bar

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Second refinement pass. Both dependencies have now shipped — `design-system-001` (styleguide gate) and `agentic-workflow-076` (the advisory write this panel reads) — so the one condition holding the task in backlog ("not workable until aw-076 ships") is resolved. Confirmed the frozen ADR-0027 §2/§4 interface against the shipped skill (path `.agentheim/state/whats-next.md`, `generated` timestamp, three sections, `/api/doc` read path); the artifact being absent on disk is git-ignored-and-not-yet-run, which is exactly the absent-artifact acceptance criterion, not a blocker. Corrected a stale cross-reference in *Why* (named the skill half aw-074; it is aw-076). With both gates met and concrete acceptance criteria, **promoted backlog → todo**.
**Split into:** —
**ADRs written:** —

---

## 2026-06-17 21:47 -- Work session ended

**Type:** Work / Session end
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0) — aw-072 (8e32542), aw-076 (4953fb9)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2 (8e32542 aw-072, 4953fb9 aw-076)
**Notes:**
- Two ready tasks, both in the agentic-workflow BC. **Serialized into two single-task waves** rather than dispatched in parallel: both could touch the agentic-workflow BC README, and only one worker updates a BC's memory per batch (one-worker-per-BC-README rule). Both did in fact update the README, so the serialization avoided a working-tree race on it.
- aw-072 (Done column hideable): additive `hidden` boolean on the ADR-0015 view-state store (old blobs → false, no version bump), Done-only board-local hide control + "Show Done (N)" chip, presentation-only per ADR-0017. PASS first try; dashboard suite 558/558 green, 6 new tests, dist rebuilt.
- aw-076 (whats-next advisory write): skill-doctrine + .gitignore change per ADR-0027 — the skill now writes `.agentheim/state/whats-next.md` (single-latest, git-ignored) as its single advisory write; runtime artifact, not created by the task. PASS first try.
- No bounces, failures, escalations, new backlog items, or concept candidates.
- Pre-existing working-tree noise (deleted `Screenshot ….png`, untracked `dashboard.png`) left untouched — never `git add`ed.

---

## 2026-06-17 21:46 -- Task verified and completed: agentic-workflow-076 - What's next persists its recommendation as a single-latest advisory artifact (advisory write)

**Type:** Work / Task completion
**Task:** agentic-workflow-076 - What's next persists its recommendation as a single-latest advisory artifact (advisory write)
**Summary:** The `whats-next` skill now performs a single advisory write per ADR-0027 — persisting its recommendation to `.agentheim/state/whats-next.md` (frontmatter `generated` ISO-8601 timestamp + three sections: where things stand / recommended move / next; single-latest, overwritten), while staying read-only over lifecycle and running no git action. `.agentheim/state/` is git-ignored; the frozen interface aw-073 reads is preserved.
**Verification:** PASS (iteration 1)
**Files changed:** 3
**Tests added:** 0 (skill-doctrine + .gitignore change; runtime artifact written by the skill, not this task)
**ADRs written:** none

---

## 2026-06-17 21:43 -- Batch started: [agentic-workflow-076]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-076 - What's next persists its recommendation as a single-latest advisory artifact (advisory write)
**Parallel:** no (1 worker)
**Note:** Second wave — held back from the aw-072 batch on the one-worker-per-BC-README rule (same BC).

---

## 2026-06-17 21:42 -- Task verified and completed: agentic-workflow-072 - Done column should be hideable (it can grow infinitely large)

**Type:** Work / Task completion
**Task:** agentic-workflow-072 - Done column should be hideable (it can grow infinitely large)
**Summary:** The Done column is now hideable — a Done-only board-local Hide control drops the column from the layout (the three live columns reflow), a "Show Done (N)" chip restores it, and the choice persists via an additive `hidden` boolean on the ADR-0015 view-state store with no version bump; hiding is presentation-only (no /api write).
**Verification:** PASS (iteration 1)
**Files changed:** 5
**Tests added:** 6 (dashboard suite 558/558 green)
**ADRs written:** none

---

## 2026-06-17 21:35 -- Batch started: [agentic-workflow-072]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-072 - Done column should be hideable (it can grow infinitely large)
**Parallel:** no (1 worker)
**Note:** aw-076 held for the next wave — same BC as aw-072, so both could touch the agentic-workflow BC README (one-worker-per-BC-README rule).

---

## 2026-06-17 21:26 -- Modeling / Refined: agentic-workflow-074 - Slide-over gets an expand/collapse-width chevron, replacing the full-screen button

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Refined the slide-over expand-chevron task to a pure-consumer framing and **split** the Drawer expandable-width capability into a new design-system child. aw-074 now stops passing `onOpenFullScreen` (header drops to Close-only, aw-039/aw-052 main-pane promote path retained in board.js) and consumes a new controlled expand seam, supplying the rail-aware `expandedWidth`. Decided: reopening resets to collapsed (no persisted state); Esc closes outright. No ADR needed (ADR-0003/0010/0014 + ds-005/006 controlled-seam pattern cover it).
**Split into:** design-system-020 (Drawer in-place expandable width — controlled expand seam + body-top chevron + `panel-right-open`/`panel-right-close` glyph pair; `blocks: [agentic-workflow-074]`)
**ADRs written:** none

---

## 2026-06-17 21:25 -- Modeling / Captured: agentic-workflow-077 - Collision-resistant task IDs for multi-user / multi-branch work

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Sequential per-BC integer ids (`aw-072`) are minted by scanning the tree for the next free number — a single-writer assumption that breaks when two people work on separate branches: both pick the same next id for unrelated tasks and collide on merge (filename + frontmatter clash, ambiguous backlinks + `[id]` commit trailers, INDEX double-listing, dismissed-id retirement broken). Captured as a `type: decision` to replace the integer with a coordination-free, collision-resistant id; keystone deliverable is an ADR fixing the scheme, with the implementation sweep + any migration splitting out on refine. Surfaced the central fork (readable branch/author-prefixed counter vs. opaque random/ULID token), the ordering and BC-prefix trade-offs, and the migrate-vs-coexist decision. Linked the three ADRs that encode current id semantics (ADR-0012 anchored filename resolution, ADR-0022 dismissed-id retirement, ADR-0026 `[id]` commit trailer). Architect round recommended next.

---

## 2026-06-17 21:10 -- Modeling / Refined: agentic-workflow-072 - Done column should be hideable (it can grow infinitely large)

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Cornered the three UX forks with the builder. Hide mechanism = **remove the Done column from the board layout** (so backlog/todo/doing reflow to full width) with a **"Show Done (N)" chip** above the board to restore it — chosen over collapse-to-a-thin-strip. Scope = **Done only** (the one column that grows unbounded). Persistence = **yes**, via the existing versioned board view-state store (ADR-0015): an additive `hidden` boolean on the per-column shape, old blobs → `false`, no `VIEW_STATE_VERSION` bump. Wrote concrete acceptance criteria (board-local + token-matched control, styleguide unforked per ADR-0003; presentation-only / read-only per ADR-0017/0001; survives SSE re-projection; pure `node --test` coverage; `dist/` rebuild) and promoted backlog → todo (dependency `design-system-001` already shipped).
**Split into:** —
**ADRs written:** —

---

## 2026-06-17 21:05 -- Modeling / Refined: agentic-workflow-073 - What's next renders on the dashboard (split → aw-073 + aw-076)

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** aw-073 backlog, aw-076 todo
**Summary:** Architect round (via orchestrator) resolved the keystone read-only tension. Builder decisions: (1) advisory write by the skill — a narrow non-lifecycle write, carved out by new **ADR-0027** so ADR-0017 and the skill's read-only stance both stay intact; (2) the skill emits structured data, the dashboard owns rendering (not raw HTML); (3) dismiss/collapse in scope. Artifact is `.agentheim/state/whats-next.md` (single-latest, git-ignored, frontmatter `generated` timestamp + three markdown sections), read via the existing `/api/doc` + SSE, rendered through the aw-043 frontmatter-fold path. **Split** into the skill half (**aw-076**, advisory write — no frontend gate, promoted to todo) and the dashboard half (**aw-073** retitled, render + staleness + dismiss-persistence — gated on design-system-001 + aw-076, stays backlog). ADR-0027's artifact shape is the frozen interface between them.
**Split into:** agentic-workflow-076 (skill half; aw-073 retained as the dashboard half)
**ADRs written:** ADR-0027 (proposed)
**Note:** Concurrent capture session took ids 074 + 075 mid-refine; the skill half landed on aw-076 (ids never reused).

---

## 2026-06-17 20:55 -- Modeling / Captured: agentic-workflow-075 - Concepts are a first-class artifact kind — left-rail nav group + searchable category

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Surface concept pages (the per-BC `contexts/<bc>/concepts/` synthesis pages already carried in the tree projection as `bc.concepts`) as a first-class group/category across the dashboard's two discovery surfaces: a left-rail **Concepts** group between Bounded contexts and Research (`treeToLibrary`), and a searchable **Concepts** category (`enumerateCorpus` + the topbar search grouping). Purely additive to the consuming transforms — no new server data — styleguide consumed unforked. Backlog pending a quick refine to pin concept-title source, exact search-category position, and whether a `type: 'concept'` row needs a design-system icon child task.

---

## 2026-06-17 20:30 -- Modeling / Captured: agentic-workflow-074 - Slide-over gets an expand/collapse-width chevron, replacing the full-screen button

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Replace the slide-over header's "Open in full screen" button (aw-039) with an expand chevron at the top-left of the ticket description that widens the `Drawer` in place to fill the main content area (left rail stays visible); a collapse chevron returns it to the default narrow width. The main-pane full-screen render path is retained (global search aw-052 still uses it) — only the slide-over's button is removed. Clear on the what; backlog pending a refine pass to decide whether the expandable-width mode is a design-system `Drawer` primitive change (likely a ds child task) per ADR-0003.

---

## 2026-06-17 20:05 -- Modeling / Captured: agentic-workflow-073 - What's next renders its recommendation as structured HTML above the dashboard prompt

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** The `whats-next` skill should emit a persisted, structured recommendation that the dashboard renders as a panel above the board prompt bar — so the next-steps advice survives the terminal and is visible at session end and at the next session's start. Clear on the what, raw on the how: needs a refine/architect pass to resolve the read-only tension (the skill is strictly read-only today; ADR-0017 makes the dashboard read-only too), HTML-vs-structured-data, and persistence/staleness.

---

## 2026-06-17 19:40 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0) — aw-071 (8613a07)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (8613a07 aw-071)
**Notes:**
- One ready task this run (aw-071 — confetti "no @keyframes" guard regression). depends_on empty; test-only change, no styleguide gate. Worker tightened the aw-034 assertion from a blanket `/@keyframes/` to a confetti-scoped `/@keyframes[^{]*confetti/i` tripwire; PASS on the first verifier pass (dashboard suite 552/552 green, the unrelated About-page `aboutRise` keyframe now permitted, all three aw-034 vectors still tripped).
- **Concurrent modeling race (benign):** while the worker ran, a parallel modeling session captured aw-072 (Done column hideable) and committed it (3973e28), sweeping in this session's own uncommitted work-bookkeeping (the aw-071 todo→doing INDEX edit + batch-start protocol entry) along with its capture. Content was correct and the tree was clean afterward, so no rework — the PASS bookkeeping (doing→done) applied cleanly on top.
- Pre-existing working-tree noise (deleted `Screenshot ….png`, untracked `dashboard.png`) left untouched — never `git add`ed. No bounces, failures, escalations, new backlog items, or concept candidates.

---

## 2026-06-17 19:34 -- Task verified and completed: agentic-workflow-071 - Confetti "no @keyframes" test trips on the unrelated About-page aboutRise keyframe

**Type:** Work / Task completion
**Task:** agentic-workflow-071 - Confetti "no @keyframes" test trips on the unrelated About-page aboutRise keyframe
**Summary:** Tightened the aw-034 confetti regression guard from a blanket `/@keyframes/` check to a confetti-scoped `/@keyframes[^{]*confetti/i` tripwire — still catches the removed `agentheim-confetti-rise` CSS burst while permitting the unrelated, intentional About-page `aboutRise` keyframe. Dashboard suite back to 552/552 green.
**Verification:** PASS (iteration 1)
**Files changed:** 1
**Tests added:** 0 (tightened an existing assertion)
**ADRs written:** none

---

## 2026-06-17 19:30 -- Capture / Captured: agentic-workflow-072 - Done column should be hideable (it can grow infinitely large)

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** The done column should be hideable because it might grow infinitely large.

---

## 2026-06-17 19:24 -- Batch started: [agentic-workflow-071]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-071 - Confetti "no @keyframes" test trips on the unrelated About-page aboutRise keyframe
**Parallel:** no (1 worker) — sole ready task; depends_on empty. Test-only change (board-prompt-bar.test.mjs).

---

## 2026-06-17 18:40 -- Modeling / Refined: agentic-workflow-071 - Confetti "no @keyframes" test trips on the unrelated About-page aboutRise keyframe

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Confirmed the pre-existing failure (551/552; assertion at `board-prompt-bar.test.mjs:342`) and decided the fix: replace the over-broad `/@keyframes/` check with a confetti-scoped `/@keyframes[^{]*confetti/i` tripwire that still catches the old `agentheim-confetti-rise` burst (name verified in aw-034 commit `bb953cd`) while permitting the unrelated `aboutRise` keyframe; keep the `agentheim-confetti-piece` / `ensureConfettiStyle` siblings. Sharpened acceptance criteria and promoted to todo (test-only change, no styleguide gate).
**Split into:** —
**ADRs written:** —

---

## 2026-06-17 18:22 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0) — aw-070 (23a6dce)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2 (5fa4cbd builder's About-page visual polish committed first to clean the tree; 23a6dce aw-070 task work)
**Notes:**
- One ready task this run (aw-070 — flat Ko-fi button fill). Before dispatch the working tree carried the builder's unrelated, uncommitted About-page visual polish in the SAME two files aw-070 must touch (board.js + dist/app.js). A clean one-task commit was impossible while they were commingled; surfaced as a choice — builder chose "commit polish first" — so the polish landed on its own (5fa4cbd) and aw-070's verification diff started clean.
- aw-070 PASS on the first verifier pass. Gradient → solid `var(--st-doing)`, board-local/unforked (ADR-0003), no ochre (ADR-0016), dist rebuilt via esbuild, one new solid-fill test.
- **Test regression discovered (caused by the polish, not aw-070):** the aw-034 "no @keyframes in board.js" guard (board-prompt-bar.test.mjs) now fails because the polish commit (5fa4cbd) added an `@keyframes aboutRise` entrance animation to board.js. Independently confirmed pre-existing (reproducible on HEAD with aw-070 stashed). Filed as backlog item **aw-071** (bug). The dashboard suite is otherwise 551/552 green; aw-070 adds zero keyframes.
- Pre-existing working-tree noise (deleted `Screenshot ….png`, untracked `dashboard.png`) left untouched — never `git add`ed. No bounces, failures, escalations, or concept candidates.

---

## 2026-06-17 18:20 -- Task verified and completed: agentic-workflow-070 - About-page Ko-fi button uses a solid colour, not a gradient

**Type:** Work / Task completion
**Task:** agentic-workflow-070 - About-page Ko-fi button uses a solid colour, not a gradient
**Summary:** The About-page Ko-fi support button now reads as a flat, opaque fill of the styleguide status token `var(--st-doing)` instead of a linear gradient; board-local, token-based, unforked (ADR-0003), no ochre (ADR-0016), everything else unchanged.
**Verification:** PASS (iteration 1) — dashboard suite 551 pass / 1 fail; the sole failure (board-prompt-bar.test.mjs "no @keyframes" aw-034 guard) is PRE-EXISTING and unrelated, introduced by the earlier About-page visual-polish commit (5fa4cbd) which added the `aboutRise` keyframe to board.js — confirmed reproducible on HEAD with aw-070 stashed. Tracked by new backlog item aw-071; aw-070 adds zero keyframes and introduces no new failures.
**Files changed:** 3 (board.js, dist/app.js, about-rail-routing.test.mjs)
**Tests added:** 1 (KofiButton solid-fill assertion)
**ADRs written:** none

---

## 2026-06-17 18:18 -- Modeling / Captured: agentic-workflow-071 - Confetti "no @keyframes" test trips on the unrelated About-page aboutRise keyframe

**Type:** Work / New backlog item (filed by worker mid-task)
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** The aw-034 "no @keyframes in board.js" guard in `board-prompt-bar.test.mjs` now fails because the About-page visual-polish commit (5fa4cbd) added an `@keyframes aboutRise` entrance animation to board.js. The guard's intent (prove the old CSS-burst confetti is gone) needs narrowing so a legitimate unrelated keyframe doesn't trip it. Surfaced during aw-070; unrelated to the Ko-fi change.

---

## 2026-06-17 18:15 -- Batch started: [agentic-workflow-070]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-070 - About-page Ko-fi button uses a solid colour, not a gradient
**Parallel:** no (1 worker) — sole ready task; dep design-system-001 in done/. Working tree cleaned first: the builder's unrelated About-page visual polish (board.js + dist/app.js) was committed on its own (5fa4cbd) so this task's verification diff starts clean.

---

## 2026-06-17 18:05 -- Modeling / Captured: agentic-workflow-070 - About-page Ko-fi button uses a solid colour, not a gradient

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** The About-page "Buy me a coffee on Ko-fi" button (`KofiButton`, aw-062) uses a linear-gradient fill; the builder wants a flat opaque colour. Filed ready-to-work: replace the gradient with a solid `var(--st-doing)` (builder's pick over `--st-todo` / Ko-fi blue), everything else unchanged, rebuild `dist/`.

---

## 2026-06-17 17:30 -- Modeling / Closed umbrella: agentic-workflow-057 - Workflow guide page

**Type:** Modeling / Refine (umbrella close)
**BC:** agentic-workflow
**From → To:** backlog → done
**Summary:** `refine agentic-workflow-057` resolved to its disposition: the umbrella's three children — aw-058 (routing scaffold), aw-059 (page shell + three-segment layout), aw-060 (hand-authored diagrams) — are all in `done/`, satisfying the umbrella's own closing condition ("closes when all three children are done"). Nothing left to refine. Closed as `done` (status + completed: 2026-06-17) as a tracking record — it produced no code of its own, the children did. Surfaced as a choice (close / dismiss / leave); user chose close-as-done. No cascade, no ADR.

---

## 2026-06-17 17:20 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0) — aw-060 (e764b0d)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (e764b0d aw-060)
**Notes:**
- One ready task this run (aw-060 — Workflow guide diagrams), the last open child of umbrella aw-057. Both deps (design-system-001, agentic-workflow-059) were in done/. No conflict batch needed (sole task). It was the task the prior session deliberately left unclaimed while a concurrent modeling session was still editing it — that session has since settled (0b111c9), so the working tree was clean for it.
- aw-060 PASS on the first verifier pass (551/551 dashboard tests green). Replaced aw-059's three placeholder slots with hand-authored HTML+CSS flow diagrams: board-local token-driven primitives (WNode/WCheckpoint/WArrow/WFanRow), honest per-segment topology, gates as edge checkpoints not agent boxes, no inline SVG / no library / no new runtime dep, dist genuinely rebuilt, aw-058/aw-059 routing wiring byte-unchanged.
- **Umbrella aw-057 is now fully delivered** (aw-058 routing + aw-059 shell + aw-060 diagrams all done). aw-057 still sits in backlog/ as the tracking umbrella — closing/dismissing it is a `modeling` concern, not work's; surfaced to the user.
- Pre-existing working-tree noise (a deleted `Screenshot ….png`, an untracked `dashboard.png`) was left untouched — never `git add`ed. No bounces, failures, escalations, new backlog items, or concept candidates.

---

## 2026-06-17 17:18 -- Task verified and completed: agentic-workflow-060 - Workflow guide diagrams (hand-authored flow visuals)

**Type:** Work / Task completion
**Task:** agentic-workflow-060 - Workflow guide diagrams (hand-authored flow visuals)
**Summary:** Replaced the Workflow guide's three placeholder diagram slots with hand-authored HTML+CSS flow visuals — honest per-segment topologies (Preparation fan-out, Capturing backlog hub with refine/research/dismiss loops, Promote & Work pipeline with the verifier FAIL→×2→escalate retry loop) built from board-local token-driven primitives. Closes umbrella aw-057.
**Verification:** PASS (iteration 1) — full dashboard suite 551 pass / 0 fail; no inline SVG / no diagramming library, all colors are CSS-var tokens (no hex literals), gates render as edge checkpoints not agent boxes, dist genuinely rebuilt, aw-058/aw-059 routing wiring byte-unchanged.
**Files changed:** 4 (board.js, workflow-diagrams.test.mjs [new], workflow-page-content.test.mjs, dist/app.js) + BC README
**Tests added:** 1 new suite (workflow-diagrams.test.mjs) + 1 updated assertion in workflow-page-content.test.mjs
**ADRs written:** none

---

## 2026-06-17 17:10 -- Batch started: [agentic-workflow-060]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-060 - Workflow guide diagrams (hand-authored flow visuals)
**Parallel:** no (1 worker) — sole ready task; both deps (design-system-001, agentic-workflow-059) in done/.

---

## 2026-06-17 17:02 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0) — aw-063 (6e6d9d6)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2 (43e6ca4 pre-existing aw-063 modeling artifacts; 6e6d9d6 aw-063 task work)
**Notes:**
- One ready task this run (aw-063, the committing-pattern doctrine refactor). Before dispatch, the working tree carried the modeling session's leftover capture+refine+promote artifacts for aw-063 — committed first on their own (43e6ca4) so the worker's verification diff started clean.
- aw-063 PASS on the first verifier pass. It writes ADR-0026 (committing doctrine) and applies it across `work` + `modeling` + `quick-capture` + `brainstorm`: skills self-commit their own scoped `.md`, `work` folds bookkeeping into the task commit before committing, the `commit:` frontmatter field is dropped, scoped `git add` (never `git add -A`) is mandated for concurrency safety.
- **Concurrency collision (the very scenario ADR-0026 addresses):** a `modeling` session ran CONCURRENTLY, refining + promoting aw-060 (Workflow guide diagrams) into `INDEX.md` and `protocol.md` during aw-063's commit. Honouring ADR-0026's scoped-add rule, the aw-063 commit (6e6d9d6) was scoped to its own uncontested files (4 skills + ADR-0026 + BC README + task move); the contested `INDEX.md`/`protocol.md` aw-063 bookkeeping was left on the tree for the modeling session to reconcile rather than bundling modeling's in-flight aw-060 artifacts. INDEX.md on disk already reflects both (aw-063 done + aw-060 todo).
- **aw-060 NOT claimed this run:** it was promoted to todo by the concurrent modeling session but is still actively edited/uncommitted on the working tree. Claiming it would race the modeling session's live edits — left for the next `work` invocation once modeling settles and commits.
- No bounces, failures, escalations, new backlog items, or concept candidates this run.

---

## 2026-06-17 17:00 -- Modeling / Promoted: agentic-workflow-060 - Workflow guide diagrams (hand-authored flow visuals)

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-06-17 16:55 -- Modeling / Refined: agentic-workflow-060 - Workflow guide diagrams (hand-authored flow visuals)

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** `refine agentic-workflow-057` resolved to its one open child — aw-057 is a tracking umbrella, 2/3 done (aw-058 routing scaffold + aw-059 page shell shipped), with only aw-060 (the diagrams) left. Refined aw-060's *form* (the constraints were already settled): (1) **honest topology per segment** — Preparation fans out to the four foundation outputs, Capturing is a backlog hub with refine/research/dismiss loops, Promote & Work is a pipeline with the verifier FAIL→×2→escalate retry loop; (2) **skills + artifacts as nodes only** — gates/human checks render as marked checkpoints on edges, never as orchestrator/specialist/verifier/research-reviewer boxes; (3) **HTML + CSS boxes with CSS connectors** (no inline SVG, no library), token-driven so theme-tracking is automatic. Added a per-segment diagram spec, named the exact slot to fill (`WorkflowSegment`'s dashed `role="img"` div in `dashboard/app/board.js`), and tightened acceptance criteria + the keep-aw-058/059-green guard. Ready to promote.
**Split into:** none
**ADRs written:** none (stays under ADR-0003 unforked / ADR-0017 read-only / ADR-0025 routing; no new decision)

---

## 2026-06-17 16:40 -- Batch started: [agentic-workflow-063]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-063 - Analyze and optimize the committing pattern
**Parallel:** no (1 worker) — sole ready task. Preceded by committing the modeling session's leftover capture+refine+promote artifacts for aw-063 (43e6ca4) so the worker's diff starts from a clean tree.

---

## 2026-06-17 16:32 -- Modeling / Promoted: agentic-workflow-063 - Analyze and optimize the committing pattern

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-06-17 16:30 -- Modeling / Refined: agentic-workflow-063 - Analyze and optimize the committing pattern

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Diagnosed both reported symptoms and scoped the fix. Primary pain: `modeling`/`quick-capture`/`brainstorm` write `.md` artifacts (task files, INDEX, protocol) but never commit them, leaving them in the working tree. Secondary: `work` writes the SHA-frontmatter, INDEX, and protocol *after* the task commit (the SHA chicken-and-egg), leaking bookkeeping that then needs a separate per-session commit. Refined plan: fold bookkeeping into the task commit + drop the `commit:` field; markdown-producing skills commit their own scoped `.md`; keep one-commit-per-task with a trivial-squash carve-out; record the doctrine as an ADR (cross-linking ADR-0007 / ADR-0017). Stays in backlog — offered for promotion.
**Split into:** none (may split along the work / modeling seam when worked)
**ADRs written:** none (committing-doctrine ADR expected when the task is worked)

---

## 2026-06-17 16:27 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0) — aw-069 (2cad350)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2 (1ecd469 pre-existing dashboard bundle, 2cad350 aw-069)
**Notes:**
- One ready task this run (aw-069). Before dispatch, the working tree carried a second, UNRELATED finished-but-uncommitted dashboard bundle (a `large` LaunchButton size variant + de-inverted liftOnHover press, with a new `topbar-launch-large.test.mjs`) that shared the `dashboard/dist/app.js` artifact with aw-069. Per user decision it was committed first on its own (1ecd469, 543/543 green) so aw-069's esbuild dist rebuild stayed a clean incremental diff — no `git add -A` ever used.
- aw-069 was the one-line constant swap aw-064 + the code comment already anticipated: `WHATS_NEXT_COMMAND` → `/agentheim:whats-next`. PASS on the first verifier pass.
- The lone `events.test.mjs` failure under full-suite load is a pre-existing flaky SSE-watcher (`fs.watch` debounce) timing race — passes 4/4 in isolation, file untouched by either commit. Worth a hardening task if it recurs.
- Remaining backlog (untouched, not promoted): aw-057 (workflow guide umbrella), aw-060 (workflow guide diagrams, now unblocked), aw-063 (optimize committing pattern). No new backlog items, ADRs, or concept candidates this run.

---

## 2026-06-17 16:25 -- Task verified and completed: agentic-workflow-069 - Topbar "What's next" button fires the /agentheim:whats-next skill

**Type:** Work / Task completion
**Task:** agentic-workflow-069 - Topbar "What's next" button fires the /agentheim:whats-next skill (replaces the interim raw prompt)
**Summary:** Swapped `WHATS_NEXT_COMMAND` from aw-064's interim raw NL prompt to the bare fully-qualified slash command `/agentheim:whats-next` (mirroring `WORK_COMMAND`), now that the real read-only `whats-next` skill exists (76b0e9c) and aw-031 was dismissed. Rewrote the constant's doc comment (drops interim/aw-031 framing), updated the two assertion suites, rebuilt dist via esbuild, and refreshed the BC README's two What's-next descriptions. No UI or bridge rework — the launch (ADR-0018) and read-only contract (ADR-0017) are byte-unchanged.
**Verification:** PASS (iteration 1) — verifier confirmed the constant value + rewritten comment, the topbar wiring/glyph/skipPermissions/no-onResult unchanged, the genuine dist rebuild (`nh="/agentheim:whats-next"` in the bundle), both README descriptions updated, styleguide unforked (ADR-0003); the lone `events.test.mjs` failure is a pre-existing flaky SSE-watcher timing race (passes 4/4 in isolation, file untouched).
**Commit:** 2cad350
**Files changed:** 5 (modeling-command.js, modeling-command.test.mjs, topbar-right-align.test.mjs, dist/app.js, BC README)
**Tests added:** net −0 (2 raw-prompt asserts replaced by 2 slash-command asserts)
**ADRs written:** none

---

## 2026-06-17 16:20 -- Batch started: [agentic-workflow-069]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-069 - Topbar "What's next" button fires the /agentheim:whats-next skill
**Parallel:** no (1 worker) — sole ready task. Preceded by committing a pre-existing unrelated dashboard bundle (larger topbar buttons + de-inverted press) as 1ecd469 so aw-069's dist rebuild stays a clean incremental diff.

---

## 2026-06-17 16:10 -- Modeling / Captured: agentic-workflow-069 - Topbar "What's next" button fires the /agentheim:whats-next skill

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Swap the topbar What's-next button's `WHATS_NEXT_COMMAND` from aw-064's interim raw NL prompt to the fully-qualified `/agentheim:whats-next` slash command (a bare constant like `WORK_COMMAND`), now that the real `whats-next` skill exists (commit 76b0e9c) and the placeholder aw-031 was dismissed. The "one-line change" the code comment and README already anticipate — no UI/bridge rework; update docs, tests, dist, and the BC README. Filed straight to todo: small, fully specified, styleguide gate satisfied.

---

## 2026-06-17 16:00 -- Modeling / Dismissed: agentic-workflow-031

**Type:** Modeling / Dismiss
**Dismissed:** agentic-workflow-031 - Next-steps overview when work is done (agentic-workflow)

---

## 2026-06-17 15:05 -- Work session ended

**Type:** Work / Session end
**Completed:** 5 (first-try PASS: 5, re-dispatched: 0, skipped: 0) — aw-059 (bae517d), aw-065 (cf06395), aw-064 (658d130), aw-066 (5d58b6f), aw-067 (35cc892)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 5 work commits
**Notes:**
- All five tasks are dashboard frontend work that rebuilds the shared `dashboard/dist/app.js` esbuild bundle (and most edit `dashboard/app/board.js`), so the whole run was conflict-serialized to one worker per wave. Every task passed verification on the first try.
- A `modeling` session ran CONCURRENTLY with this work loop, promoting aw-065, aw-064, and aw-067 to todo mid-run; the loop picked each up automatically on re-scan. The concurrent edits to `INDEX.md` and `protocol.md` were merged carefully — work commits were scoped to each task's own files (never `git add -A`) to avoid bundling modeling's in-flight artifacts.
- aw-059 landed the Workflow guide page's real three-segment layout; **aw-060** (the hand-authored diagrams) is now unblocked but stays in `backlog/` until `modeling` PROMOTEs it. **aw-057** (the umbrella) also remains in backlog.
- The no-ochre / primary-surface emphasis decision (settled in aw-065's refinement) was applied consistently across aw-065 and aw-064 — neither touched the reserved `--accent-ochre-soft` (ADR-0016).
- No bounces, no failures, no escalations, no new backlog items, no ADRs, no concept candidates this run.
- Remaining backlog (not promoted, untouched by work): aw-031, aw-057, aw-060, aw-063.

---

## 2026-06-17 15:02 -- Task verified and completed: agentic-workflow-067 - Topbar stays fixed on scroll

**Type:** Work / Task completion
**Task:** agentic-workflow-067 - Topbar stays fixed at the top of the viewport when the board or a document scrolls
**Summary:** Bounded the `DashboardApp` outer shell frame to the viewport (`height: 100dvh` + `overflow: hidden`, replacing the uncapped `minHeight: 100vh`), so the existing inner `scroll-quiet` region (flex:1, minHeight:0 on its wrapper, overflowY:auto) becomes the sole vertical scroll container. The rail and topbar (search / gear / What's next / Work) are siblings outside the scroll region and now stay fixed; no window scrollbar; the ds-016 search popover is not clipped.
**Verification:** PASS (iteration 1) — verifier read the source (not just the README), confirmed the flex chain is mechanically correct (bounded parent + minHeight:0 wrapper + overflowY:auto child), the topbar is a sibling above the scroll region, the only overflow:hidden ancestor is the full-viewport frame (popover unclipped), the new test genuinely fails against the old `minHeight:100vh`, styleguide unforked, dist genuinely rebuilt; full dashboard suite 535/535 pass.
**Commit:** 35cc892
**Files changed:** 4 (board.js [1-line frame], shell-relayout.test.mjs, dist/app.js, BC README)
**Tests added:** ~2 (frame-bounded + scroll-region-owns-scroll guards)
**ADRs written:** none

---

## 2026-06-17 14:56 -- Batch started: [agentic-workflow-067]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-067 - Topbar stays fixed at the top of the viewport when the board or a document scrolls
**Parallel:** no (1 worker) — sole remaining ready task; the conflict-serialized dashboard chrome batch (aw-059/065/064/066) is now landed.

---

## 2026-06-17 14:54 -- Task verified and completed: agentic-workflow-066 - Left rail Research opens / Decisions collapses by default

**Type:** Work / Task completion
**Task:** agentic-workflow-066 - Left rail — Research group opens by default, Decisions collapses by default
**Summary:** Flipped the rail render's per-group `defaultOpen` expression in `board.js` from `g.group !== "Research"` to `g.group !== "Decisions"`, so on fresh load Decisions is the single collapsed group and Research (plus Product / Bounded contexts) opens. `TreeGroup` keeps owning runtime open state (still user-toggleable); `treeToLibrary` / `GROUP_ORDER` unchanged.
**Verification:** PASS (iteration 1) — verifier confirmed the four group defaults (Research/Product/Bounded contexts true, Decisions false) via the new `rail-default-open.test.mjs` (genuinely coupled to the live expression), no runtime open-state logic added, `TreeGroup` unforked, data transform untouched, read-only, dist genuinely rebuilt; full dashboard suite 533/533 pass.
**Commit:** 5d58b6f
**Files changed:** 3 (board.js [1-line], rail-default-open.test.mjs [new], dist/app.js)
**Tests added:** 1 file (four default-open assertions)
**ADRs written:** none

---

## 2026-06-17 14:50 -- Batch started: [agentic-workflow-066]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-066 - Left rail — Research group opens by default, Decisions collapses by default
**Parallel:** no (1 worker) — aw-067 is ready too but conflicts on `dashboard/app/board.js` + `dashboard/dist/app.js`; demoted to the next wave.

---

## 2026-06-17 14:48 -- Task verified and completed: agentic-workflow-064 - Topbar "What's next" button + Work restyle

**Type:** Work / Task completion
**Task:** agentic-workflow-064 - Topbar "What's next" launch button + Work button restyle (trailing ↗, primary-surface fill)
**Summary:** Topbar right group is now `[ ⚙ gear ] [ What's next ] [ Work ↗ ]`. A new standing "What's next" launch (bordered secondary chip, `sun` glyph) fires an interim raw NL prompt (`WHATS_NEXT_COMMAND` constant beside `WORK_COMMAND`, not a slash command — aw-031 is the future process) through `launchOrCopy` (bridge + silent clipboard fallback), threading `skipPermissions`, no `onResult`, read-only. Work keeps its primary-surface fill (NO ochre, ADR-0016 untouched) and now reads `Work ↗` via a new `trailingIcon` prop on the dashboard's `LaunchButton` (glyph `square-arrow-out-up-right`, moved after the label; icon still always rendered per aw-041).
**Verification:** PASS (iteration 1) — verifier confirmed the three-action order + left-anchored search, the What's-next launch wiring (launchOrCopy / skipPermissions / no onResult / read-only), the raw-prompt constant (modeling-command tests), both glyphs (`sun`, `square-arrow-out-up-right`) present in the registry, Work's primary fill + trailing glyph with no ochre, no regression to other LaunchButton callers, styleguide unforked, dist genuinely rebuilt; full dashboard suite 530/530 pass.
**Commit:** 658d130
**Files changed:** 6 (modeling-command.js, board.js, modeling-command.test.mjs, topbar-right-align.test.mjs, dist/app.js, BC README)
**Tests added:** ~8 (WHATS_NEXT_COMMAND constant + topbar order/wiring guards)
**ADRs written:** none (no-ochre + interim-prompt decisions settled in refinement)

---

## 2026-06-17 14:40 -- Batch started: [agentic-workflow-064]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-064 - Topbar "What's next" launch button + Work button restyle (trailing ↗, primary-surface fill)
**Parallel:** no (1 worker) — aw-066 and aw-067 are ready too but all three conflict on `dashboard/app/board.js` + `dashboard/dist/app.js`; conflict-serialized one per wave.

---

## 2026-06-17 14:35 -- Modeling / Refined + Promoted: agentic-workflow-064 - Topbar "What's next" button + Work restyle

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Settled the one open question the capture deferred — what the "What's next" button launches when no skill backs it yet. Builder chose **option (a): interim raw NL prompt now, align later** — a bare `WHATS_NEXT_COMMAND` constant (read-only next-steps overview) beside `WORK_COMMAND` in `modeling-command.js`, fired through the existing bridge; aw-031 ("Next-steps overview when work is done") stays in `related_tasks`, **not** `depends_on`, so the topbar restyle (incl. the ready Work ↗ change) is not blocked behind an undesigned process task. A later one-line follow-up swaps the constant once aw-031 ships a real skill. Splitting the button out from the Work restyle was considered and rejected (both edit the same `BoardTopbar` + `dist/app.js`, conflict-serialize anyway). Also confirmed both glyphs (`sun`, `square-arrow-out-up-right`) already live in the styleguide icon registry — consumed unforked, no design-system child. The shared ochre/token tension was already settled in aw-065's refinement (no ochre; primary-surface emphasis) and propagated here at capture. Updated What/AC/Notes, added a downstream-consumer breadcrumb to aw-031. Frontend gate (design-system-001) done; task is concrete and worker-ready → promoted backlog → todo.
**Split into:** none
**ADRs written:** none (interim command is a constant; no decision touches the reserved accent or a new token)

---

## 2026-06-17 14:20 -- Modeling / Captured: agentic-workflow-067 - Topbar stays fixed when the board or a document scrolls

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** The topbar (global search field + settings gear + standing Work launch) scrolls out of view whenever the content under it grows past the viewport — both the board and a long main-pane document (ADR / research / task). Diagnosed the seam: the `DashboardApp` outer shell frame in `dashboard/app/board.js` (~line 1880) is `minHeight: "100vh"` with no height cap and no `overflow: hidden`, so the whole frame (rail + topbar + content) grows and the *window* scrolls; the inner `scroll-quiet` region (`overflowY: auto`, ~line 1898) never gets a bounded height to scroll within. Fix is to cap the frame to the viewport so the existing inner scroll region owns the scroll, leaving rail + topbar fixed — the intended structure already exists. Filed straight to todo: concrete, single-seam, clear AC, frontend gate (design-system-001) satisfied. Flagged the board.js / dist/app.js file-level conflict with in-flight aw-064/aw-065 (no logical dependency — `work` serializes). Prior art aw-026 (built this shell+topbar layout), aw-053 (topbar internal layout).

---

## 2026-06-17 14:10 -- Task verified and completed: agentic-workflow-065 - Prompt-bar buttons redesign (icon tile + title/subtitle cards)

**Type:** Work / Task completion
**Task:** agentic-workflow-065 - Prompt-bar buttons redesign — icon tile + title/subtitle cards, Quick Capture emphasised, ⌘↵ hint
**Summary:** Restyled the board prompt-bar launch row from three flat chips into a new board-local `PromptLaunchCard` (icon tile + bold title + quiet subtitle: Quick Capture/"File it fast", Modeling/"Shape into structure", Research/"Dig deeper"). Quick Capture wears the aw-033 primary-surface emphasis (`--surface-2`/`--fg-1`/`--hairline-strong`); Modeling/Research stay quiet. NO ochre — reserved `--accent-ochre-soft` untouched (ADR-0016). Plus a decorative "Type a prompt to begin" + ⌘↵ chip that fires nothing. The `launchOrCopy` / seeded-command / `skipPermissions` / `onResult` confetti model is byte-identical; aw-038's swallowed Enter untouched.
**Verification:** PASS (iteration 1) — verifier confirmed the three cards + copy, Quick Capture primary-surface emphasis, no-ochre, the decorative ⌘↵ hint wires nothing, preserved launch model + Enter-swallow, registry icons (plus/compass/search) exist, styleguide unforked, dist genuinely rebuilt; full dashboard suite 521/521 pass.
**Commit:** cf06395
**Files changed:** 4 (board.js, board-prompt-bar.test.mjs, dist/app.js, BC README)
**Tests added:** ~6 (board-prompt-bar.test.mjs extended)
**ADRs written:** none (the no-ochre decision was settled in refinement; consistent with existing colour law)

---

## 2026-06-17 14:05 -- Batch started: [agentic-workflow-065]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-065 - Prompt-bar buttons redesign — icon tile + title/subtitle cards, Quick Capture emphasised, ⌘↵ hint
**Parallel:** no (1 worker) — aw-066 is ready too but conflicts on `dashboard/app/board.js` + `dashboard/dist/app.js`, demoted to next wave.

---

## 2026-06-17 14:00 -- Modeling / Refined + Promoted: agentic-workflow-065 - Prompt-bar buttons redesign (icon tile + title/subtitle cards)

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Settled the one open question blocking aw-065 — the accent-fill token tension shared with aw-064. The mock paints Quick Capture (and Work) in ochre, but ADR-0016 reserves `--accent-ochre-soft` for the selection accent. Builder chose **no ochre**: Quick Capture's emphasis is the existing **primary-surface** treatment (`--surface-2` / `--fg-1` / `--hairline-strong`, the aw-033 Work chrome), Modeling/Research stay quiet on `--hairline`; icon tiles are neutral. This dissolves the tension — ADR-0016 untouched, no token repurposed, no design-system child, **no new ADR**. Updated What/AC/Notes accordingly, cross-linked aw-064, and propagated the settled decision into aw-064's body (Work keeps its primary-surface fill, only gains the trailing ↗). The ⌘↵ decorative hint and restyle-only interaction were already settled at capture. Frontend gate (design-system-001) done; task is concrete and worker-ready → promoted backlog → todo.
**Split into:** none
**ADRs written:** none (decision was *not* to touch the reserved accent — consistent with existing colour law)

---

## 2026-06-17 13:42 -- Task verified and completed: agentic-workflow-059 - Workflow page shell + three-segment layout

**Type:** Work / Task completion
**Task:** agentic-workflow-059 - Workflow page shell + three-segment layout
**Summary:** Replaced aw-058's placeholder `WorkflowPage` body with the real static three-segment guide — Preparation, Capturing, Promote & Work — each a labelled section with honest, skill-accurate caption copy (quick-capture and modeling as two distinct intake doors, `verifier` named correctly, DISMISS, human-in-the-loop gates marked) and an empty placeholder diagram slot (`WorkflowSegment`) for aw-060. Centered reading measure (maxWidth 760, margin 0 auto, per aw-040); aw-058's mainView routing / isTaskIntent untouched.
**Verification:** PASS (iteration 1) — verifier confirmed the three named segments in order, skill-accurate copy (`\bverify\b` doesNotMatch test, two-intake-doors test, DISMISS test, gates marked), 3 empty placeholder diagram slots, static/read-only, styleguide unforked, dist genuinely rebuilt; aw-058 routing guards unchanged; full dashboard suite 515/515 pass.
**Commit:** bae517d
**Files changed:** 4 (board.js, workflow-page-content.test.mjs [new, 9 tests], dist/app.js, BC README)
**Tests added:** 9
**ADRs written:** none

---

## 2026-06-17 13:35 -- Batch started: [agentic-workflow-059]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-059 - Workflow page shell + three-segment layout
**Parallel:** no (1 worker) — aw-066 is ready too but conflicts on `dashboard/app/board.js` + `dashboard/dist/app.js`, demoted to next wave.

---

## 2026-06-17 13:30 -- Modeling / Captured: agentic-workflow-066 - Rail Research opens / Decisions collapses by default

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Flip the left-rail Workspace tree's per-group default open state — Research expanded by default, Decisions collapsed by default (Product + Bounded contexts unchanged). Single seam: the `defaultOpen=${g.group !== "Research"}` expression in `board.js`'s rail render becomes `!== "Decisions"`. Finishes the job aw-056 started (Research above Decisions in order); prior art aw-056. Filed straight to todo — concrete, single-line, worker-ready; frontend gate satisfied (design-system-001 done).

---

## 2026-06-17 13:15 -- Modeling / Captured: agentic-workflow-064 + agentic-workflow-065 - dashboard button redesign from screenshot mock

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Captured a builder-supplied screenshot mock (`Screenshot 2026-06-17 112241.png`) reshaping the dashboard's buttons, split by surface into two tasks. aw-064 — topbar right group gains a "What's next" launch button (seeded session via the bridge, like Work) and restyles Work as an accent-filled `Work ↗` (trailing up-right arrow). aw-065 — the prompt-bar Quick Capture / Modeling / Research chips become icon-tile + title/subtitle cards (Quick Capture emphasised in accent) with a decorative "Type a prompt to begin · ⌘↵" hint; interaction stays restyle-only (still click-to-launch, no Enter-to-launch). Both flag the open token tension: the accent fill leans on `--accent-ochre-soft`, reserved for selection by ADR-0016 — refinement must settle reuse-and-reconcile vs. a new token. aw-064 also relates to aw-031 (the undefined "what next" command).

---

## 2026-06-17 13:10 -- Modeling / Refined + Promoted: agentic-workflow-059 - Workflow page shell + three-segment layout

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Confirmed aw-059 already carries the refinement the umbrella split (aw-057) produced — the three named segments (Preparation / Capturing / Promote & Work) with skill-accurate copy that names the `verifier` correctly, shows quick-capture vs modeling as two distinct intake doors, includes DISMISS, and marks the human-in-the-loop gates. Both predecessors are done (design-system-001, aw-058 `ad4a6f0`), so the routing home exists. Tightened the Notes only: replace the aw-058 placeholder `WorkflowPage` body while keeping its function name + `onSelectWorkflow`/`mainView` routing untouched; keep aw-058's `workflow-rail-routing.test.mjs` guards green (adjust only the placeholder-heading assertion); diagram slots stay empty placeholders for aw-060. No specialist round needed — the task was already worker-ready. Promoted backlog → todo. aw-060 (diagrams) stays in backlog, promotes when aw-059 lands.
**Split into:** none (split already done at aw-057 refinement)
**ADRs written:** none

---

## 2026-06-17 12:00 -- Capture / Captured: agentic-workflow-063 - Analyze and optimize the committing pattern

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Committing pattern produces too many fine-grained commits and still often leaves files uncommitted — analyze and optimize.

---

## 2026-06-17 12:55 -- Work session ended

**Type:** Work / Session end
**Completed:** 4 (first-try PASS: 4, re-dispatched: 0, skipped: 0) — aw-056 (3b0a749), aw-058 (ad4a6f0), aw-061 (3280619), aw-062 (c9ac4d5)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 4 work + 1 chore bookkeeping
**Notes:**
- All four dashboard tasks rebuild the shared `dashboard/dist/app.js` esbuild bundle, so the batch was conflict-serialized to one worker per wave (no safe parallelism). Each passed verification first try.
- aw-058 unblocked aw-062 mid-run (the About page extends the `mainView` third-view-state scaffold) — picked up automatically in the final wave once aw-058 landed.
- aw-062's external profile asset (`heimeshoff.jpg`) was resolved from the sibling repo at `C:\src\heimeshoff\tooling\WhisperHeim\src\WhisperHeim\Assets\` and committed into `dashboard/assets/` (build copies it into dist/).
- Left untouched (pre-existing modeling artifacts from before this session, not work-owned): ADR-0025 (untracked), backlog aw-057/059/060 (untracked), and the ADR-0021 back-annotation pointing at ADR-0025. These belong to the modeling flow; commit them there.
- Standing open human gate (carried over, unrelated): design-system-019 still awaits a builder canvas re-review.
- No bounces, no new backlog items, no concept candidates, no ADRs written this run.

---

## 2026-06-17 12:55 -- Task verified and completed: agentic-workflow-062 - Dashboard About page

**Type:** Work / Task completion
**Task:** agentic-workflow-062 - Dashboard About page — left-rail item below Board, profile bio + Ko-fi support
**Summary:** Extended the aw-058 `mainView` scaffold (ADR-0025) with the second built-in static page — an About page reached from an About RailItem below Workflow. Enum widened to "board"|"workflow"|"about"; precedence workflow → about → document → board; Board active predicate tightened to `mainView === "board" && !selectedId` so it never co-highlights with Workflow/About. Profile & contact card (circular photo + three-paragraph bio + heimeshoff.de/Bluesky/LinkedIn links) and Support & GitHub card (board-local Ko-fi gradient button → ko-fi.com/heimeshoff, View on GitHub → github.com/heimeshoff/Agentheim). Profile photo committed to `dashboard/assets/` and copied into `dist/` by build.mjs after the dist wipe; referenced as `/heimeshoff.jpg`. External links open new-tab with rel="noopener noreferrer". `isTaskIntent`/`main-pane-reader.js` byte-unchanged; styleguide unforked (Ko-fi gradient board-local from --st tokens, honors theme).
**Verification:** PASS (iteration 1) — verifier confirmed all six handlers reset/clear correctly, icons (bot, square-arrow-out-up-right, box) exist in the registry, `/heimeshoff.jpg` resolves (image/jpeg, copied after dist wipe), byte-unchanged discriminator + reader (verbatim-lock tests + empty diffs), read-only, theme-token styling, dist genuinely rebuilt; dashboard suite 506 pass / 0 fail.
**Commit:** c9ac4d5
**Files changed:** 9 (board.js, build.mjs, assets/heimeshoff.jpg, dist/heimeshoff.jpg, dist/app.js, 3 test files, BC README)
**Tests added:** ~12 (about-rail-routing.test.mjs) + 2 existing test files updated for the third rail item
**ADRs written:** none (ADR-0025 governs; the board-local Ko-fi gradient noted inline per the ADR-0003 board-control precedent)

---

## 2026-06-17 12:45 -- Batch started: [agentic-workflow-062]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-062 - Dashboard About page — left-rail item below Board, profile bio + Ko-fi support
**Parallel:** no (1 worker) — sole remaining ready task; unblocked by aw-058 (mainView scaffold). Profile asset resolved at `C:\src\heimeshoff\tooling\WhisperHeim\src\WhisperHeim\Assets\heimeshoff.jpg`.

---

## 2026-06-17 12:40 -- Task verified and completed: agentic-workflow-061 - Board Name sort uses locale-aware collation

**Type:** Work / Task completion
**Task:** agentic-workflow-061 - Board "Name A→Z / Z→A" sort orders by title in true alphabetical order
**Summary:** Swapped the board `title-asc`/`title-desc` comparators in the pure `board-sort.js` from UTF-16 code-point (`<`/`>` on lowercased title) to a shared `Intl.Collator(undefined, {sensitivity:'base', numeric:true})` so Name orderings collate by readable text — case-insensitive, accents/umlauts near their base letter, numeric runs natural (2 before 10). id-ascending tie-break and missing-title degrade unchanged; mtime comparators byte-unchanged.
**Verification:** PASS (iteration 1) — verifier confirmed the desc `-0` falls through to the id tie-break (not inverted), case/accent/numeric covered by 5 new tests, mtime comparators + SORT_OPTIONS/labels/DEFAULT_SORT untouched, dist genuinely rebuilt; dashboard suite 491 pass / 0 fail.
**Commit:** 3280619
**Files changed:** 3 (board-sort.js, board-sort.test.mjs, dist/app.js)
**Tests added:** 5
**ADRs written:** none

---

## 2026-06-17 12:30 -- Batch started: [agentic-workflow-061]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-061 - Board "Name A→Z / Z→A" sort orders by title in true alphabetical order
**Parallel:** no (1 worker) — aw-062 (now unblocked by aw-058) demoted to the final wave; both rebuild the shared `dashboard/dist/app.js`.

---

## 2026-06-17 12:25 -- Task verified and completed: agentic-workflow-058 - Workflow rail item + main-pane routing scaffold

**Type:** Work / Task completion
**Task:** agentic-workflow-058 - Workflow rail item + main-pane routing scaffold (third selection state)
**Summary:** Added the third dashboard main-pane view state `mainView` ("board"|"workflow", default "board") with a built-in static Workflow guide placeholder page, a Workflow RailItem below Board, and a dedicated `onSelectWorkflow` handler. Render precedence workflow → document → board; the `setMainView("board")` reset threaded through every existing main-pane handler (onSelectBoard, onOpen both branches, onOpenSearch, onOpenFullScreen) so the three states are mutually exclusive by construction. Governed by ADR-0025. `isTaskIntent`/`main-pane-reader.js` byte-unchanged.
**Verification:** PASS (iteration 1) — verifier read all five handlers directly (reset present before the onOpen isTaskIntent split, covering both branches), confirmed rail predicates, byte-unchanged discriminator (verbatim-lock test + empty diff), read-only + styleguide unforked, dist genuinely rebuilt; dashboard suite 486 pass / 0 fail.
**Commit:** ad4a6f0
**Files changed:** 5 (board.js, dist/app.js, 2 tests, BC README)
**Tests added:** 12 (workflow-rail-routing.test.mjs) + 1 existing shell test updated
**ADRs written:** none (ADR-0025 pre-existed; ADR-0021 carries an unrelated pre-existing back-annotation, not part of this commit)
**Unblocks:** agentic-workflow-062 (About page — extends the mainView enum)

---

## 2026-06-17 12:10 -- Batch started: [agentic-workflow-058]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-058 - Workflow rail item + main-pane routing scaffold (third selection state)
**Parallel:** no (1 worker) — aw-061 demoted (shares the rebuilt `dashboard/dist/app.js`); aw-062 blocked on aw-058.

---

## 2026-06-17 12:05 -- Task verified and completed: agentic-workflow-056 - Left rail — Research group sits above Decisions

**Type:** Work / Task completion
**Task:** agentic-workflow-056 - Left rail — Research group sits above Decisions
**Summary:** Reordered the dashboard left-rail library groups so Research renders above Decisions (rail now reads Product → Bounded contexts → Research → Decisions); one-line `GROUP_ORDER` swap in the pure `treeToLibrary` transform, comment fixed, group-order test updated, dist rebuilt.
**Verification:** PASS (iteration 1) — verifier confirmed GROUP_ORDER reorder + comment, group-order test updated and asserts new order, empty-group omission untouched, dist genuinely rebuilt to carry the change; dashboard suite 474 pass / 0 fail.
**Commit:** 3b0a749
**Files changed:** 3
**Tests added:** 0 (one existing order assertion updated)
**ADRs written:** none

---

## 2026-06-17 12:00 -- Batch started: [agentic-workflow-056]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-056 - Left rail — Research group sits above Decisions
**Parallel:** no (1 worker) — aw-058 and aw-061 demoted to later waves (all three rebuild the shared `dashboard/dist/app.js` bundle; conflict-serialized).

---

## 2026-06-17 11:30 -- Modeling / Captured: agentic-workflow-062 - Dashboard About page (profile bio + Ko-fi)

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Builder wants an About item in the dashboard left rail, below Board, opening an About page that mirrors the top two cards of his WhisperHeim app — a profile card describing him as a person (bio + heimeshoff.de / Bluesky / LinkedIn contact links, with a profile photo) and a support card with the Ko-fi button (`https://ko-fi.com/heimeshoff`) + GitHub link. Scope confirmed with the builder: both cards in full, photo included; copy adapted from Whisperheim to Agentheim. Routes as a built-in static page via the `mainView` third-view-state pattern — depends on aw-058 (the routing scaffold) and is exactly the "future About page" ADR-0025 anticipated, so it's a one-line enum extension, not a new shell-state invention. Frontend gate (design-system-001) already met. Renumbered from a momentary 057 collision (a concurrent session had taken 057–061) to 062.

---

## 2026-06-17 11:00 -- Modeling / Captured: agentic-workflow-061 - Board Name sort orders by title in true alphabetical order

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Builder wants the board columns' **Name A→Z / Z→A** sort to order by the title's readable text in true alphabetical order. Investigation: the comparator (`dashboard/app/board-sort.js`) *already* keys on `title`, but compares with raw `<`/`>` on the lowercased string — UTF-16 code-point order, not collation — so case, accented/umlaut letters (ä/ö/ü/ß after `z`), leading digits and punctuation mis-order. Captured as a bug to swap the `title-asc`/`title-desc` comparator to locale-aware collation (`localeCompare` / `Intl.Collator`, `sensitivity:'base'`, `numeric:true`), keeping the id-ascending tie-break and pure/read-only contracts. Filed straight to todo — concrete, comparator-only, worker-ready; styleguide gate (design-system-001) already met.

---

## 2026-06-17 10:30 -- Modeling / Refined: agentic-workflow-057 - Workflow guide page

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog (converted to umbrella)
**Summary:** Resolved the four open questions flagged at capture. (1) **Rail routing** → an explicit third main-pane state `mainView` (`board`/`workflow`) alongside `selectedDoc`/`openIntent`, *not* a sentinel pseudo-doc; `isTaskIntent` (ADR-0021) stays byte-unchanged; render precedence `workflow → document → board`. Governed by new **ADR-0025** (Proposed), reshaping ADR-0021. (2) **Diagram primitives** → board-local under `dashboard/app/` (seam test fails for a shared design-system primitive — single consumer, content-bound shapes); no design-system child task. (3) **Decomposition** → split into a strict chain aw-058 → aw-059 → aw-060, with aw-057 converted to the umbrella that closes when all three land. (4) **Content accuracy** → corrected the canonical flow the diagrams must depict (name the verifier, quick-capture vs modeling as two doors, add DISMISS, mark human-in-the-loop gates). **aw-058 promoted to todo**; aw-059/aw-060 stay in backlog and promote as predecessors land.
**Split into:** agentic-workflow-058, agentic-workflow-059, agentic-workflow-060
**ADRs written:** ADR-0025 (Proposed — dashboard main pane third view state for built-in static pages)

---

## 2026-06-17 10:00 -- Modeling / Captured: agentic-workflow-057 - Workflow guide page

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Builder wants a second left-rail entry, **Workflow** (directly below Board), opening a built-in, mostly-visual guide page in the main content area that explains the Agentheim workflow — split into three segments: **Preparation** (repo setup + brainstorm → vision + context map), **Capturing** (quick-capture / modeling / refinement / research intake loop), and **Promote & Work**. Diagram-rendering approach decided at capture: **hand-authored, styleguide-conformant SVG/HTML+CSS components** (themes via tokens, no bundled diagramming library). Filed to backlog — large new view; refinement to resolve rail-routing-as-third-selection-state (vs ADR-0021 task/doc split), whether the flow-diagram visual becomes a shared design-system primitive, and decomposition. Frontend gate (design-system-001) already met.

---

## 2026-06-17 09:30 -- Modeling / Captured: agentic-workflow-056 - Left rail — Research group sits above Decisions

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Builder wants the left rail's library groups reordered so Research sits above Decisions (rail reads Product → Bounded contexts → Research → Decisions). One-line change to the `GROUP_ORDER` constant in the pure `treeToLibrary` transform (`dashboard/app/library-data.js`); presentation-only, styleguide unforked, dashboard stays read-only. Filed straight to todo — concrete and worker-ready; styleguide gate (design-system-001) already met.

---

## 2026-06-17 09:12 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0) — agentic-workflow-055 (e653580)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2 (1 work + 1 chore bookkeeping)
**Notes:**
- Single ready task this run. Dependency `design-system-001` (styleguide gate) already in done/, so aw-055 was unblocked from the start.
- Fix landed board-local in `SettingsMenu` (not a styleguide fork): one shared `justifyContent: center` style on all three MenuItem rows. The board-local-vs-shared-primitive seam flagged at modeling resolved to board-local as the smallest correct change — no `design-system` child task needed.
- **Standing open human gate (carried over, unrelated to this run):** design-system-019 still awaits a builder canvas re-review to re-confirm the design-system styleguide gate OPEN.
- No new backlog items, no ADRs, no concept candidates.

---

## 2026-06-17 09:10 -- Task verified and completed: agentic-workflow-055 - Settings menu content is off-center

**Type:** Work / Task completion
**Task:** agentic-workflow-055 - Settings menu content is off-center — equal whitespace left and right
**Summary:** Centered the top-right settings dropdown's content by giving each of the three MenuItem rows (theme, skip-permissions, Stop dashboard) one shared board-local `justifyContent: center` style, so left/right whitespace reads equal. Smallest correct change — the shared Menu/MenuItem primitive stays a left-aligning generic (ADR-0003 unforked), presentation-only (ADR-0017); dist rebuilt.
**Verification:** PASS (iteration 1) — verifier confirmed `MenuItem` forwards the incoming `style` onto its flex-row div (so the fix re-centers, not a no-op), all three rows centered uniformly from one constant, open/close/Esc/dismiss/Stop wiring untouched, no styleguide fork; dashboard suite 474 pass / 0 fail; dist carries `justifyContent:"center"`.
**Commit:** e653580
**Files changed:** 3 (board.js, dashboard/dist/app.js, settings-menu-center.test.mjs)
**Tests added:** 3 (settings-menu-center.test.mjs — centering style present, all 3 rows uniform, shared primitive unforked)
**ADRs written:** none

---

## 2026-06-17 09:00 -- Batch started: [agentic-workflow-055]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-055 - Settings menu content is off-center — equal whitespace left and right
**Parallel:** no (1 worker) — sole ready task this run.

---

## 2026-06-17 00:00 -- Modeling / Captured: agentic-workflow-055 - Settings menu content is off-center

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** The top-right settings gear dropdown reads off-center — its controls hug the left edge so left/right whitespace is unequal. Captured as a presentation bug to balance the menu content; routed to the originating BC with the board-local-vs-shared-Menu-primitive seam flagged for the worker (depends on the styleguide gate, design-system-001).

---

## 2026-06-16 17:02 -- Work session ended

**Type:** Work / Session end
**Completed:** 3 (first-try PASS: 3, re-dispatched: 0, skipped: 0) — design-system-019 (6edeacc), agentic-workflow-053 (b210357), agentic-workflow-054 (121db42)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 6 (3 work + 3 chore bookkeeping)
**Notes:**
- All 3 ready tasks shared the rebuilt `dashboard/dist/app.js`, and aw-053/aw-054 additionally share `dashboard/app/board.js`, so the batch ran SEQUENTIALLY (one worker per batch) rather than in parallel — the conflict-safe reading of the conflict-detection rule.
- Session started with pre-existing uncommitted modeling dirt (the ds-019/aw-053/aw-054 captures: untracked todo files + INDEX/protocol entries from the 16:00/16:20/16:28 modeling runs). It was folded into the per-task commits as it was consumed; todo/ is now empty across all BCs.
- **Open human gate:** design-system-019 reopened the design-system styleguide gate (a visible styleguide change — search category-header colour). The code shipped and dist is rebuilt, but the builder still needs to re-review the canvas (`styleguide/index.html` → section 11) and re-confirm the gate OPEN. Noted in the design-system README.
- No new backlog items, no ADRs, no concept candidates.

---

## 2026-06-16 16:58 -- Task verified and completed: agentic-workflow-054 - Board prompt bar "Prompt" title + whitespace above "Board"

**Type:** Work / Task completion
**Task:** agentic-workflow-054 - Board prompt bar gets a "Prompt" title; whitespace separates it from the "Board" title
**Summary:** Added a board-local "Prompt" title above the prompt input in `BoardPromptBar`, token-matched to the board-local "Board" title (--font-ui / 15px / 600 / -0.01em / --fg-1), and an 18px `paddingTop` wrapper above `BoardHeader` so the capture region and the board read as two distinct zones. Board-local token-matched (ADR-0003 unforked), presentation-only (ADR-0017); `dashboard/dist/app.js` rebuilt.
**Verification:** PASS (iteration 1) — title token-match confirmed against BoardHeader; whitespace via paddingTop:18 wrapper; "Board" title/count strip otherwise unchanged; no styleguide edit; dashboard suite 471 pass / 0 fail; dist carries the change.
**Commit:** 121db42
**Files changed:** 3 (board.js, dashboard/dist/app.js, board-prompt-bar.test.mjs) + BC README
**Tests added:** 2 (board-prompt-bar.test.mjs — "Prompt" title-above-textarea + token-match guard, whitespace-above-Board guard)
**ADRs written:** none

---

## 2026-06-16 16:56 -- Batch started: [agentic-workflow-054]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-054 - Board prompt bar gets a "Prompt" title; whitespace separates it from the "Board" title
**Parallel:** no (1 worker) — third of 3 sequential batches; board.js conflict with aw-053 cleared (aw-053 committed b210357).

---

## 2026-06-16 16:54 -- Task verified and completed: agentic-workflow-053 - Topbar layout — settings gear + Work flush right

**Type:** Work / Task completion
**Task:** agentic-workflow-053 - Topbar layout — search on the left, settings gear + Work flush right
**Summary:** Added `marginLeft: "auto"` to the `BoardTopbar` gear+Work group div so unconsumed free space collects ahead of it and the group sits flush against the right edge, search staying left-anchored at its bounded `flex:1/maxWidth:520`. Consumer-side only (ADR-0003 unforked, ADR-0017 read-only); `dashboard/dist/app.js` rebuilt.
**Verification:** PASS (iteration 1) — flush-right + left-anchored + narrow-graceful covered by 2 source-guard tests (project idiom for the harness-less React glue); dashboard suite 469 pass / 0 fail; dist carries the change; no styleguide edit.
**Commit:** b210357
**Files changed:** 3 (board.js, dashboard/dist/app.js, topbar-right-align.test.mjs)
**Tests added:** 2 (topbar-right-align.test.mjs — marginLeft:auto group guard, bounded left-anchored search guard)
**ADRs written:** none

---

## 2026-06-16 16:48 -- Batch started: [agentic-workflow-053]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-053 - Topbar layout — search on the left, settings gear + Work flush right
**Parallel:** no (1 worker) — second of 3 sequential batches; aw-053 and aw-054 both edit `dashboard/app/board.js`, so they run one-per-batch.

---

## 2026-06-16 16:46 -- Task verified and completed: design-system-019 - Search results — category headers need more contrast

**Type:** Work / Task completion
**Task:** design-system-019 - Search results — category headers need more contrast
**Summary:** Raised the search panel's grouped-results category-header colour from the dimmest `--fg-4` to `--fg-2`, so the organising headers out-read the `--fg-3` excerpts while staying quieter than the `--fg-1` result-row titles. Colour-token-only; panel elevation tokens (ADR-0024 source-guards) untouched. Styleguide consumed unforked; `dashboard/dist/app.js` rebuilt.
**Verification:** PASS (iteration 1) — token ramp 1<2<3<4 honoured; size/weight/uppercase/letter-spacing unchanged; styleguide 96 pass, dashboard 467 pass; dist carries `--fg-2`. Builder canvas re-review (gate re-confirm) is a human gate — README notes it reopened, confirmation pending.
**Commit:** 6edeacc
**Files changed:** 3 (search.js, dashboard/dist/app.js, README.md)
**Tests added:** 0 (presentation-only colour-token refactor; covered by existing suites)
**ADRs written:** none

---

## 2026-06-16 16:40 -- Batch started: [design-system-019]

**Type:** Work / Batch start
**Tasks:** design-system-019 - Search results — category headers need more contrast
**Parallel:** no (1 worker) — first of 3 sequential batches; ds-019, aw-053, aw-054 all rebuild the shared `dashboard/dist/app.js` and aw-053/aw-054 share `board.js`, so they run one-per-batch.

---

## 2026-06-16 16:28 -- Modeling / Captured: agentic-workflow-054 - Board prompt bar "Prompt" title + whitespace above the "Board" title

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** The board view stacks the prompt-authoring region flush against the Kanban board. Add a "Prompt" title above the prompt input (mirroring the board-local "Board" title in `BoardHeader`) and vertical whitespace above the "Board" title so the capture region and the board read as two distinct zones. Captured ready-to-work as board-local, token-matched layout tweaks in `board.js` (`BoardPromptBar` + `BoardHeader`), styleguide consumed unforked. Renumbered from 053 → 054 after a concurrent capture claimed 053.

---

## 2026-06-16 16:20 -- Modeling / Captured: agentic-workflow-053 - Topbar layout — search on the left, settings gear + Work flush right

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Dashboard topbar doesn't right-align the settings gear + Work group — on wide viewports it floats mid-bar with trailing empty space instead of sitting flush right, while search should stay anchored left. Captured ready-to-work as a consumer-side flex tweak in `board.js` `BoardTopbar` (no styleguide change).

---

## 2026-06-16 16:00 -- Modeling / Captured: design-system-019 - Search results — category headers need more contrast

**Type:** Modeling / Capture
**BC:** design-system
**Filed to:** todo
**Summary:** The grouped-results category headers in the `SearchField` combobox (ds-016) sit at `--fg-4`, the dimmest foreground token — dimmer than the excerpts (`--fg-3`). Raise the header colour (e.g. → `--fg-2`) so the category titles read with more contrast; size/weight/uppercase unchanged. Styleguide change, consumed unforked, reopens the design-system gate and needs a `dist/` rebuild for the live aw-052 search.

---

## 2026-06-16 15:36 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0) — agentic-workflow-052 (46fa5ec)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 feature (46fa5ec) + 2 chore (a5d12b0 pending-modeling baseline, 1b63712 SHA/bookkeeping)
**Notes:**
- Single ready task (aw-052); todo/ and doing/ now empty across all BCs.
- Committed a pre-existing modeling-dirt baseline (a5d12b0) before executing — the aw-052 refine, ADR-0023, INDEX/protocol, and old-name aw-050 backlog deletion that prior sessions flagged for the builder. Tree was clean before and after the worker ran, so verification diff capture was unpolluted.
- No new backlog items, no ADRs, no concept candidates from the worker.

---

## 2026-06-16 15:34 -- Task verified and completed: agentic-workflow-052 - Topbar global search UI

**Type:** Work / Task completion
**Task:** agentic-workflow-052 - Topbar global search UI — search field replaces the breadcrumb; grouped-results popover routing to the main pane
**Summary:** Replaced the dead BoardTopbar breadcrumb with a global search field — the ds-016 `SearchField` consumed unforked (ADR-0003), wired to `GET /api/search` (aw-050/ADR-0023). `TopbarSearch` owns the controlled value + ~200ms debounce + min-length-2 fetch gate; the pure `searchResultsToGroups` (`dashboard/app/search-results.js`, `node --test`) buckets the flat ranked results into ds-016's fixed-order groups. Selection routes via the unchanged `isTaskIntent` (ADR-0021) into the main pane for both kinds (tickets via the aw-039 full-screen path).
**Verification:** PASS (iteration 1) — all 8 acceptance criteria mapped to behavior; SearchField consumed unforked (styleguide source untouched); pure transform `node --test` green; dashboard suite 466 pass / 0 fail; dist rebuilt from source (mtime newer than edited sources).
**Commit:** 46fa5ec
**Files changed:** 6 (+ dist/app.js build output)
**Tests added:** search-results.test.mjs (7 — fixed order, order-preserving, loss-tolerant), topbar-search.test.mjs (breadcrumb gone, unforked SearchField, debounce+min-length-2 gate, isTaskIntent routing, empty/no-panel)
**ADRs written:** none

---

## 2026-06-16 15:30 -- Batch started: [agentic-workflow-052]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-052 - Topbar global search UI — search field replaces the breadcrumb; grouped-results popover routing to the main pane
**Parallel:** no (1 worker) — single ready task; all four deps (design-system-001, design-system-016, agentic-workflow-049, agentic-workflow-050) done.

---

## 2026-06-16 15:20 -- Modeling / Refined: agentic-workflow-052 - Topbar global search UI

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (refined → promoted in the same pass)
**Summary:** Re-grounded the UI-half task against the now-shipped ds-016 `SearchField` and aw-050 `/api/search` (both `done`). Pinned the controlled-combobox seam (consumer owns `value`/`onChange`/debounce/min-length-2 *fetch* gate + the flat→grouped transform; ds-016's `getTitle`/`getExcerpt` defaults read `item.title`/`item.excerpt`, so no custom getters). Named the one pure board-side unit — `searchResultsToGroups` (`dashboard/app/search-results.js`, `node --test`). Resolved the one open decision (builder): ds-016's `panelState` opens a "No matches" panel for any non-empty query and has no force-closed prop, so the "sub-min → no panel" criterion is **relaxed** to accept the styleguide no-results panel for a 1-char query — ds-016 stays **unforked**, no design-system follow-up. All four deps (`design-system-001`, `design-system-016`, `agentic-workflow-049`, `agentic-workflow-050`) are `done` and the styleguide gate is OPEN → promoted backlog → todo.
**Split into:** none
**ADRs written:** none

---

## 2026-06-16 15:12 -- Styleguide gate re-confirmed: OPEN (design-system-016)

**Type:** Design-system / Gate approval
**BC:** design-system
**Trigger:** design-system-016 (Search & grouped-results pattern, canvas section 11)
**Outcome:** Builder reviewed the live canvas and approved ("styleguide looks good"). Gate stands OPEN against the source including the search-field combobox; agentic-workflow-052 unblocked to consume it. Recorded in the BC README gate note.

---

## 2026-06-16 15:08 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0) — design-system-016 (9c7f353)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 feature (9c7f353) + 1 chore (SHA/protocol backfill)
**Notes:**
- Single ready task (ds-016); todo/ and doing/ now empty across all BCs.
- ADR-0024 written (scope: design-system) — search combobox panel is standalone, matches Menu's `--shadow-md` by convention not composition; indexed under design-system adr-local.
- Concept candidate surfaced (NOT auto-created): **styleguide-owns-look-consumer-drives-behavior** — the worker flags 5 converging artifacts (ds-005 Collapsible, ds-006 cornerAction, ds-015 Menu, ds-016 SearchField, ds-018 Button/Modal). A genuine synthesis-page candidate; builder decides.
- Pre-existing tree dirt left untouched (not this task, surfaced for the builder): the aw-050 old-name backlog deletion `agentic-workflow-050-dashboard-global-search.md`, the untracked aw-052 backlog file, and the untracked ADR-0023 — these are prior modeling-session outputs (the aw-050 refine/split) that were never committed. Staging was kept surgical (never `git add -A`).

---

## 2026-06-16 15:05 -- Task verified and completed: design-system-016 - Search field + grouped-results popover/listbox styleguide pattern

**Type:** Work / Task completion
**Task:** design-system-016 - Search field + grouped-results popover/listbox styleguide pattern
**Summary:** Shipped the styleguide search-field + grouped-results combobox pattern — `SearchField` (`styleguide/app/search.js`) over a React-free `search-state.js`: a token-styled, search-scoped input opening a standalone `--shadow-md` floating panel of category-grouped, marked-excerpt rows with an active-descendant keyboard model. Built standalone (not composed on ds-015's `Menu`), matching its Popover elevation by convention. Body-agnostic — consumer feeds grouped data + `onSelect` (future consumer aw-052).
**Verification:** PASS (iteration 1) — all 7 acceptance criteria mapped to behavior; htm gotchas guarded by render-smoke; standalone-not-on-Menu + `--shadow-md`-by-convention confirmed by source-guards; styleguide 96/96 + dashboard 452/452 green; dist correctly unchanged (no dashboard consumer wired yet).
**Commit:** 9c7f353
**Files changed:** 6
**Tests added:** search.test.mjs (panelState, nextActiveIndex wrap, Enter-selects-highlight, Escape-only dismiss, outside-click predicate, markMatches, ARIA + no-menu-import source-guards)
**ADRs written:** ADR-0024 (scope: design-system)

---

## 2026-06-16 14:58 -- Batch started: [design-system-016]

**Type:** Work / Batch start
**Tasks:** design-system-016 - Search field + grouped-results popover/listbox styleguide pattern
**Parallel:** no (1 worker) — single ready task; depends_on [design-system-001] satisfied (done).

---

## 2026-06-16 16:20 -- Modeling / Promoted: design-system-016 - Search field + grouped-results popover/listbox styleguide pattern

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-06-16 16:18 -- Modeling / Refined: design-system-016 - Search field + grouped-results popover/listbox styleguide pattern

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** backlog
**Summary:** Cornered the two open questions the capture flagged "decide at refine," both resolved toward independence. (1) **ds-015 relationship** — ds-015 (`Menu`/`Popover`) shipped (`70ffde0`), collapsing the "build it first?" question; the builder chose to build the combobox's floating panel + dismiss **standalone**, not composed on `Menu` (a combobox keeps focus in the input via `aria-activedescendant`, whereas `Menu` moves focus into its items — wholesale reuse would fight it), matching ds-015's `--shadow-md` Popover elevation **by convention** so the two read identically without sharing code. (2) **Shared text-input** — the token-styled input stays **search-scoped** inside `search.js`, not extracted as a shared `Input` primitive (per the BC's "promote when a second consumer appears" doctrine). Updated What / acceptance criteria / Notes accordingly; added ds-015 to `prior_art`. No split, no ADRs. Now ready to promote.

---

## 2026-06-16 16:13 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0) — agentic-workflow-050 (e164ff0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 feature (e164ff0) + 1 chore (08513d1, SHA/protocol backfill)
**Notes:**
- Single ready task (aw-050); todo/ and doing/ now empty across all BCs.
- Left untouched (pre-existing modeling-session dirt, surfaced to builder): the old-name backlog file deletion `agentic-workflow-050-dashboard-global-search.md`, the untracked split sibling `agentic-workflow-052` backlog file, the untracked `ADR-0023`, and the `design-system-016` edit. These are the refine/split/promote outputs that created aw-050 and were never committed; INDEX/protocol (committed here) reference aw-052 and ADR-0023, so those should be committed by the builder to make the tree fully coherent.
- No new backlog items, no ADRs, no concept candidates from the worker.

---

## 2026-06-16 16:12 -- Task verified and completed: agentic-workflow-050 - GET /api/search read endpoint

**Type:** Work / Task completion
**Task:** agentic-workflow-050 - GET /api/search read endpoint — content search across BC READMEs, ADRs, research & tasks
**Summary:** Shipped the read-only server's first content-search endpoint — a pure walk/rank/excerpt core (`dashboard/search.mjs`, mirroring `tree.mjs`) matching title+body only across BC READMEs, ADRs, research & tasks, ranking title-tier-first then fixed category order, returning library/board-compatible open-intent results behind a thin `handleSearch` route.
**Verification:** PASS (iteration 1) — all 8 acceptance criteria mapped to behavior; ranking fixture exercises both tiers and category order; excerpt edge cases pinned; in-root guard reused; read-only; `dist/` untouched. Full suite green (451 passing, 18 new).
**Commit:** e164ff0
**Files changed:** 5 (search.mjs, read-api.mjs, server.mjs, test/search.test.mjs, BC README)
**Tests added:** 18
**ADRs written:** none (implements pre-existing ADR-0023)

---

## 2026-06-16 16:05 -- Batch started: [agentic-workflow-050]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-050 - GET /api/search read endpoint — content search across BC READMEs, ADRs, research & tasks
**Parallel:** no (1 worker) — single ready task; depends_on empty.

---

## 2026-06-16 16:00 -- Modeling / Promoted: agentic-workflow-050 - GET /api/search read endpoint

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-06-16 15:55 -- Modeling / Refined: agentic-workflow-050 - Dashboard global search (split backend ⁄ UI)

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog (both halves)
**Summary:** Refined the global-search capture. Builder settled three semantics — match **title + body only** (not frontmatter), rank **title-hits-first then fixed category order** (Bounded contexts → Decisions → Research → Tickets), and **split** the task per its own Notes. aw-050 becomes the pure, separately-testable **`GET /api/search` read endpoint** (no styleguide dep — promotable now); a new **agentic-workflow-052** is the **topbar search UI** (consumes ds-016 + the backend). The architect designed the endpoint and wrote **ADR-0023** (the read-only server's first content-search endpoint: pure `dashboard/search.mjs` walk/rank/excerpt seam mirroring `tree.mjs`, results carrying the existing open-intent shapes so routing reuses `isTaskIntent`/aw-039 unchanged). Reconciled ds-016's `blocks` edge (aw-050 → aw-052) and its consumer references.
**Split into:** agentic-workflow-052
**ADRs written:** ADR-0023

---

## 2026-06-16 15:51 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0) — agentic-workflow-051 (dd970ca)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 feature (dd970ca) + 1 chore (this SHA/protocol backfill)
**Notes:**
- Single ready task (aw-051); todo/ and doing/ now empty across all BCs.
- Surfaced a pre-existing INDEX drift: aw-048 (done, committed 5864548, file in done/) is still listed under the agentic-workflow Doing list with the count showing Doing:1 / Done was 47 — the prior session's doing→done INDEX transition for aw-048 never landed. Left untouched to keep this commit surgical; flagged for the builder to correct separately.
- The working tree was already broadly dirty at session start (pre-existing M on many done/ task files + infra/design-system INDEX + several untracked research/decision files); staging was kept surgical (never `git add -A`).
- The dashboard `dist/` needed an explicit rebuild before commit (a transient verifier-build had reverted it to HEAD); rebuilt, +3 `skipPermissions` occurrences vs HEAD confirm the change shipped.
- No new backlog items, no ADRs, no concept candidates.

---

## 2026-06-16 15:50 -- Task verified and completed: agentic-workflow-051 - Dismiss (trash-can) button threads the armed skip-permissions signal like the launch buttons

**Type:** Work / Task completion
**Task:** agentic-workflow-051 - Dismiss (trash-can) button threads the armed skip-permissions signal like the launch buttons
**Summary:** The per-card dismiss trash-can now threads the armed skip-permissions signal like the four launch buttons — POSTing `skipPermissions:true` only when armed (strict-`true`, field omitted when off), reversing aw-048's deliberate omission; the in-session cascade re-confirm (ADR-0022) preserves safety. No distinct armed cue needed — the trash glyph is already `--obligation`-tinted (aw-041 doctrine).
**Verification:** PASS (iteration 1) — all six acceptance criteria mapped to behavior-named `node --test` cases (armed/unarmed body shape, prop-sourced armed value with no second source / no `/api/bridge` probe, clipboard-no-bypass); full suite green 434/434; dist byte-identical to a fresh rebuild.
**Commit:** dd970ca
**Files changed:** 6 (board.js, board-card-dismiss.test.mjs, dist/app.js, BC README, INDEX, task file)
**Tests added:** 5 (armed/unarmed/no-bridge dismiss body shape + prop-threading guards)
**ADRs written:** none (behavioural flip within ADR-0018/0019 territory)

---

## 2026-06-16 15:46 -- Batch started: [agentic-workflow-051]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-051 - Dismiss (trash-can) button threads the armed skip-permissions signal like the launch buttons
**Parallel:** no (1 worker) — single ready task; dep design-system-001 done.

---

## 2026-06-16 15:45 -- Modeling / Promoted: agentic-workflow-051 - Dismiss (trash-can) button threads the armed skip-permissions signal like the launch buttons

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-06-16 15:30 -- Modeling / Captured: agentic-workflow-051 - Dismiss (trash-can) button threads the armed skip-permissions signal like the launch buttons

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** The per-card dismiss trash-can should honour the armed skip-permissions toggle like the four launch buttons do, threading `skipPermissions` through `launchOrCopy` when armed. Deliberately filed to backlog (not todo) because it reverses aw-048's explicit decision to keep the destructive dismiss behind its normal permission prompt (mirroring the Stop button) — that safety reversal wants a confirm before promote. Open question carried in Notes: the trash-can icon is already `--obligation`-tinted, so the standard per-launch armed cue is a no-op and refinement must decide whether armed-dismiss needs any distinct cue.

---

## 2026-06-16 15:00 -- Release shipped: v0.8.6

**Type:** Release
**Version:** 0.8.5 → 0.8.6 (patch — dashboard UX overhaul, shared design-system primitives, sticky/deterministic dashboard port & opt-in skip-permissions bridge)
**Manifest:** `.claude-plugin/plugin.json` bumped, committed `4989b19`
**Pushed to main:** yes (`0b60669..4989b19` on `origin/main`)
**Tag:** `v0.8.6` (annotated) → `4989b19`, pushed to origin
**GitHub Release:** deferred (gh unavailable — notes handed to builder)

---

## 2026-06-16 14:30 -- Modeling / Dismissed: design-system-012

**Type:** Modeling / Dismiss
**Dismissed:** design-system-012 - Make the colors prettier (design-system)

---

## 2026-06-16 13:54 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0) — agentic-workflow-048 (5864548)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 feature (5864548) + 1 chore (this bookkeeping backfill)
**Notes:**
- Single ready task (aw-048); todo/ and doing/ now empty across all BCs.
- aw-048 was the first shipped consumer of ds-018's `ConfirmDialog` and owned the `dist/` esbuild rebuild ds-018 had deferred — the deployed bundle now imports it.
- The repo's working tree was already dirty at session start (pre-existing M on several done/ task files + infrastructure files + INDEX); staging was kept surgical (never `git add -A`) so none of that unrelated work was swept into the aw-048 commit.
- No new backlog items, no ADRs, no concept candidates.

---

## 2026-06-16 13:53 -- Task verified and completed: agentic-workflow-048 - Board card dismiss — hover-revealed red trash can with a confirmation dialog

**Type:** Work / Task completion
**Task:** agentic-workflow-048 - Board card dismiss — hover-revealed red trash can with a confirmation dialog
**Summary:** Backlog/todo cards gain a hover-revealed top-right red trash can that opens the shared ConfirmDialog (ds-018, unforked) and fires `/agentheim:modeling dismiss <id>` through the VS Code bridge; the board stays read-only and the agent runs the cascade dismiss with in-session re-confirmation (ADR-0022).
**Verification:** PASS (iteration 1) — verifier mapped all 11 acceptance criteria to evidence (backlog+todo-only gate; opacity-0 reveal on host-hover/focus; unforked TicketCard overlay + unforked ConfirmDialog destructive; trash-2 glyph tinted `--obligation`, not the reserved ochre accent; cascade-caveat dialog copy consistent with ADR-0022; propagation isolation; no skipPermissions; read-only ADR-0017 honored; dist/ rebuilt; pure unit-tested `dismissCommandFor` with id-degradation) and confirmed the dashboard suite 429/429 green.
**Commit:** 5864548
**Files changed:** 8 (board.js, modeling-command.js, modeling-command.test.mjs, board-card-dismiss.test.mjs [new], README, INDEX, dist/app.js, task file)
**Tests added:** 6 (`dismissCommandFor` unit) + the new `board-card-dismiss.test.mjs` board-glue guards
**ADRs written:** none — grounded in existing ADR-0022 / 0017 / 0018 / 0003 / 0016

---

## 2026-06-16 13:52 -- Batch started: [agentic-workflow-048]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-048 - Board card dismiss — hover-revealed red trash can with a confirmation dialog
**Parallel:** no (1 worker) — single ready task; all four deps done (aw-046, ds-001, ds-017, ds-018).

---

## 2026-06-16 13:51 -- Modeling / Promoted: agentic-workflow-048 - Board card dismiss — hover-revealed red trash can with a confirmation dialog

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo
**Note:** Promoted immediately after the refine that made it dependency-clear (all four deps done: aw-046, ds-001, ds-017, ds-018). Builder override of the standing "don't promote a frontend task ahead of the styleguide gate" caution: ds-017/ds-018 reopened the gate for canvas re-review, and the builder chose to promote now rather than wait on that re-review. The §12 canvas re-review remains the human checkpoint before/at work-time.

---

## 2026-06-16 13:50 -- Modeling / Refined: agentic-workflow-048 - Board card dismiss — hover-revealed red trash can with a confirmation dialog

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Reconciled the task against design-system-018 having shipped (commit 29482ee) earlier the same day. At capture the styleguide had no centered confirm primitive, so the dialog was specced as a hand-rolled board-local overlay with ds-018 merely *filed* as a follow-up. ds-018 now exports the shared `Button`/`Modal`/`ConfirmDialog` family, so the task flips from "hand-roll a board-local centered overlay" to "consume `ConfirmDialog` unforked with `destructive=true`" — the board supplies only `open`/title/body/`onClose`/`onConfirm`; the primitive owns the scrim, focus trap, fade+scale reveal, reduced-motion strip, and stacking above the Drawer. Added `design-system-018` to `depends_on` (and the reverse `blocks` edge on ds-018), added ADR-0016 to `related_adrs`, added a `dist/` esbuild-rebuild acceptance criterion (ds-018 left dist unbuilt; aw-048 is the consumer that rebuilds it). All four dependencies (aw-046, ds-001, ds-017, ds-018) are now done — the task is dependency-clear; the only remaining checkpoint is the builder's canvas re-review (ds-017/ds-018 reopened the gate). The trash-can placement, bridge seed-and-fire, `dismissCommandFor`, and SSE-removal facets are unchanged.
**Split into:** none
**ADRs written:** none

---

## 2026-06-16 13:35 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0) — design-system-018 (29482ee)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (29482ee)
**Notes:**
- Single ready task (design-system-018); todo/ and doing/ now empty across all BCs.
- design-system gate is REOPENED — new visible canvas section 12 (Button both variants + a live ConfirmDialog in neutral + destructive). Builder must re-review the canvas (`styleguide/index.html` → section 12) before aw-048 migrates its board-local confirm onto `ConfirmDialog`.
- Minor cosmetic note surfaced by the verifier (not a defect): the canvas section numbering now reads 10 → 12 → 13 (Empty states renumbered 11→13, Modal inserted as 12), leaving no section 11. Worth a one-line cleanup in a future styleguide touch.
- aw-048 (the eventual ConfirmDialog consumer) remains in backlog/ and needs a `modeling` promote before `work` can claim it.

---

## 2026-06-16 13:33 -- Task verified and completed: design-system-018 - Shared Button + Modal + ConfirmDialog primitives

**Type:** Work / Task completion
**Task:** design-system-018 - Shared Button + Modal + ConfirmDialog primitives (centered, scrim, Esc-to-cancel)
**Summary:** Shipped the three-layer confirm-dialog family — a shared labelled `Button` (neutral + `--obligation` destructive), a viewport-fixed centered scrim-backed `Modal` (fade+scale reveal stripped under reduced-motion, full focus trap, stacked above the Drawer), and a `ConfirmDialog` composed over both — with the pure dismiss/focus-trap decisions factored into a React-free `modal-state.js` and a section-12 canvas specimen. Gate reopened.
**Verification:** PASS (iteration 1) — verifier mapped every acceptance criterion to evidence (Button --obligation not the reserved accent; Modal fixed/centered + Drawer's exact `rgba(8,9,12,0.40)` scrim + z-index 60>40; ConfirmDialog Esc/scrim/Cancel→onClose & Confirm→onConfirm; destructive flag; full focus trap incl. return-to-trigger; fade+scale reveal + reduced-motion strip; React-free `modal-state.js`; canvas specimens) and confirmed the styleguide suite 73/73 green. Noted the canvas section numbering gap (10→12→13, no 11) as cosmetic, not a defect.
**Commit:** <pending>
**Files changed:** 7 (button.js, modal.js, modal-state.js, confirm-dialog.js, app.js, modal.test.mjs, design-system README)
**Commit:** 29482ee
**Tests added:** 19 (modal.test.mjs — pure modal-state predicates + primitive source/behavior guards)
**ADRs written:** none — decisions grounded in existing ADR-0003 / 0005 / 0014 / 0016

---

## 2026-06-16 13:31 -- Batch started: [design-system-018]

**Type:** Work / Batch start
**Tasks:** design-system-018 - Shared Button + Modal + ConfirmDialog primitives (centered, scrim, Esc-to-cancel)
**Parallel:** no (1 worker) — single ready task. Dependency design-system-001-styleguide is done (gate open).

---

## 2026-06-16 13:30 -- Modeling / Promoted: design-system-018 - Shared Button + Modal + ConfirmDialog primitives

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo
**Note:** Promoted ahead of its own "do not promote yet" build-later trigger — builder override. aw-048's board-local confirm is still in backlog (zero shipped consumers), so the shared primitive is being built ahead of a proven board-local shape; canvas specimens stand in as proof-of-shape. Override recorded in the task Notes.

---

## 2026-06-16 13:05 -- Modeling / Refined: design-system-018 - Shared Button + Modal + ConfirmDialog primitives

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** backlog
**Summary:** Second refine pass, grounded against the live styleguide source (`drawer.js`, `primitives.js`, the token CSS), which surfaced three details the first pass had left for a worker to guess. Cornered all three with the builder (2026-06-16): (1) **the styleguide has no shared text-button primitive** — only the icon-only `IconButton` — so ds-018 now ships a **third layer, a `Button` base** (neutral + `destructive`/`--obligation` variants) that `ConfirmDialog` composes, rather than hand-rolling button styling; (2) the `Drawer` (the machinery to lift) is a *contained* `absolute/inset-0/z-40` overlay, so the `Modal` is pinned **`position: fixed`, viewport-centered, stacked above the Drawer** — explicitly NOT copying the Drawer's containment; (3) the reveal is **fade + slight scale-up** (slide doesn't transfer to a centered panel), and the scrim reuses the Drawer's exact `rgba(8,9,12,0.40)` dim (there is no `--scrim` token). Title + INDEX line updated to name all three primitives; AC grew the Button + fixed-positioning + stacking + reveal-shape criteria; Notes pin the Drawer bits to lift vs. the three deliberate departures. related_adrs gained 0016 (the destructive tint deliberately avoids the reserved accent). **Build-later hold unchanged — still NOT promoted** (zero shipped consumers; aw-048's board-local confirm hasn't shipped; ds-005 wants two consumers before unifying).
**Split into:** none — `Button` folded into ds-018 (co-designed with the destructive Confirm); layering kept clean so a future split stays trivial.
**ADRs written:** none

---

## 2026-06-16 12:43 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (984d317)
**Notes:**
- Single ready task (design-system-017); todo/ and doing/ now empty.
- design-system gate is REOPENED — this is a visible canvas change (section-04 gallery now shows trash-2). The builder must re-review the canvas before aw-048 ships its board dismiss affordance.
- aw-048 (the consuming dashboard trash-can task) is still in backlog/ and needs a `modeling` promote before `work` can claim it; it also depends on design-system-018 (shared ConfirmDialog/Modal, non-blocking per its refine).

---

## 2026-06-16 12:42 -- Task verified and completed: design-system-017 - Add the trash-2 glyph to the shared icon set

**Type:** Work / Task completion
**Task:** design-system-017 - Add the trash-2 glyph to the shared icon set
**Summary:** Added the Lucide `trash-2` glyph to the shared `LUCIDE` map (`styleguide/app/icons.js`) at the corrected symmetric-lid upstream geometry (`c1 0 2 1 2 2`), and surfaced it in the canvas section-04 interface-set gallery (`foundations2.js` curated `ui` array) — so aw-048's board dismiss affordance consumes it unforked via `Icon name="trash-2"`. `dist/` deliberately NOT rebuilt (derived artifact, ADR-0003). Gate-reopen note added to the BC README.
**Verification:** PASS (iteration 1) — verifier confirmed the exact symmetric geometry (asymmetric `c1 0 1 1 2 2` absent), the gallery entry, inner-markup-only entry with the `Icon` signature unchanged, the README gate-reopen note, and the styleguide suite 54/54 green incl. 3 new icons-trash guards.
**Commit:** 984d317
**Files changed:** 4 (icons.js, foundations2.js, icons-trash.test.mjs [new], design-system README)
**Tests added:** 3 (icons-trash.test.mjs — static geometry + gallery guards)
**ADRs written:** none

---

## 2026-06-16 12:40 -- Batch started: [design-system-017]

**Type:** Work / Batch start
**Tasks:** design-system-017 - Add the trash-2 glyph to the shared icon set
**Parallel:** no (1 worker) — single ready task; the only other todo was empty. Dependency design-system-001-styleguide is done (gate open).

---

## 2026-06-16 12:36 -- Modeling / Promoted: design-system-017 - Add the trash-2 glyph to the shared icon set

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-06-16 12:34 -- Modeling / Refined: design-system-017 - Add the trash-2 glyph to the shared icon set

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** backlog
**Summary:** Grounded the task against the live source. Two fixes: (1) pinned the **corrected upstream Lucide geometry** — the lid-handle path is symmetric `c1 0 2 1 2 2`, where the prior draft carried the asymmetric `c1 0 1 1 2 2` that would ship a distorted lid; (2) scoped in the **canvas gallery**. The section-04 `IconSection` `ui` array (`foundations2.js`) is a hand-curated subset of `LUCIDE`, not auto-derived, so a new glyph stays invisible unless explicitly added. Builder chose (2026-06-16) to document trash-2 in the gallery rather than leave it undocumented (the box/compass/maximize precedent) — making this a visible styleguide change that **reopens the design-system gate** (re-review before aw-048 ships). AC gained a gallery criterion; Notes gained the exact path data + gate-impact note. No split. depends_on/blocks/related_adrs unchanged (ds-001 styleguide done/gate open; blocks aw-048; ADR-0003 unforked consumption).
**Split into:** none
**ADRs written:** none

---

## 2026-06-16 12:28 -- Modeling / Refined: design-system-018 - Shared ConfirmDialog / Modal primitive (centered, scrim, Esc-to-cancel)

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** backlog
**Summary:** Cornered the three open decisions the capture left hedged. Builder decisions (2026-06-16): (1) ship a **two-layer** primitive — a generic `Modal` base (centered panel over scrim, Esc + scrim-click dismiss, reduced-motion strip) with `ConfirmDialog` composed over it — not a single ConfirmDialog; (2) `ConfirmDialog` gets an **optional `destructive` variant** tinting the Confirm button with `--obligation` (its first use is a destructive dismiss); (3) **full focus trap** (Tab/Shift-Tab contained, focus returns to trigger on close). Added a React-free `modal-state.js` testability AC mirroring collapsible-state/menu-state, named the `Drawer` (ds-001) as the closest scrim/Esc/reduced-motion machinery to lift, and pinned a **build-later trigger**: deliberately NOT promoted — zero shipped consumers (aw-048's board-local confirm hasn't shipped), and the ds-005 extraction pattern wants two consumers before unifying (the same reasoning that held ds-015). related_adrs grew to [0003, 0005, 0014] via the backlink matcher (htm-authoring + reduced-motion now explicit in the body).
**Split into:** none
**ADRs written:** none

---

## 2026-06-16 11:47 -- Work session ended (resumed segment)

**Type:** Work / Session end
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0) — agentic-workflow-046 (60d31ac), design-system-015 (70ffde0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 3 (2 tasks + 1 orchestrator follow-up chore a707592 — agentic-workflow README drift fix from ds-015's cross-BC retirement)
**ADRs:** 0
**Notes:**
- The two tasks the prior segment had HELD for the builder were cleared by the builder ("work on both now"): the aw-046 `skills/modeling/SKILL.md` entanglement was resolved (the pending unrelated ID-numbering change was reverted, tree clean), and ds-015 was authorized despite its single-consumer build-later framing.
- Ran as a true parallel batch (2 workers) — no file overlap: aw-046 = `skills/modeling/SKILL.md` (modeling skill doc); ds-015 = styleguide `menu.js`/`menu-state.js`/canvas + `dashboard/app/board.js` retirement + dist. Both verified PASS first try.
- ds-015 correctly did NOT edit the agentic-workflow README (another BC's) but flagged its `SettingsMenu` prose as stale; the orchestrator fixed that prose in a separate chore commit (a707592) to keep one-task-one-commit clean.
- todo/ and doing/ are now EMPTY. The concurrent `modeling` session left new backlog items (design-system ds-012/016/017/018; agentic-workflow incl. aw-048 — the dashboard trash-can that fires aw-046's new DISMISS verb) — all in backlog/, each needing a `modeling` promote before `work` can claim them.
- Combined across the whole session: 7 tasks shipped (infrastructure-020, design-system-013/014/015, agentic-workflow-046/047/049), 1 ADR amended in place (ADR-0018), 8 commits total. All 7 passed verification on the first try; zero bounces, failures, or escalations.

---

## 2026-06-16 12:10 -- Modeling / Refined: agentic-workflow-048 - Board card dismiss — hover-revealed red trash can with a confirmation dialog

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Corrected the placement model — the trash can is a **board-local top-right overlay** around the styleguide `TicketCard` (consumed unforked), NOT the `cornerAction` slot (which is the card's bottom-right meta row, where Refine/Promote already live); on backlog cards the two coexist, on todo the trash stands alone. Hover reveal is driven by a board-local host wrapper + button focus. Builder decisions (2026-06-16): the trash glyph is added to the shared icon set (depends on new design-system-017) rather than hand-rolled inline; the confirmation dialog is a board-local centered overlay now with a shared `ConfirmDialog`/`Modal` primitive filed as design-system-018 (non-blocking). `dismissCommandFor(id)` pinned (pure, unit-tested, bare-verb fallback); does not thread skipPermissions. Dependency aw-046 (DISMISS verb) is now done. depends_on updated to [aw-046, design-system-001-styleguide, design-system-017].
**Split into:** design-system-017 (trash-2 glyph — blocks aw-048), design-system-018 (shared ConfirmDialog/Modal — follow-up)
**ADRs written:** none

---

## 2026-06-16 11:46 -- Task verified and completed: design-system-015 - Shared Menu / Popover primitive for dropdown menus

**Type:** Work / Task completion
**Task:** design-system-015 - Shared Menu / Popover primitive for dropdown menus
**Summary:** Extracted a shared styleguide `Menu`/`Popover` primitive — `styleguide/app/menu.js` + React-free `styleguide/app/menu-state.js` (controlled/uncontrolled, anchored `--shadow-md` panel, body-agnostic items, Esc + outside-click dismissal, keyboard-operable), documented in the canvas (new section 10) — and RETIRED the aw-049 board-local `SettingsMenu` machinery in `dashboard/app/board.js`, which now consumes the primitive unforked (ADR-0003) with all duplicate popover code deleted and behavior preserved. Completes the aw-014 → ds-005 promotion pattern.
**Verification:** PASS (iteration 1) — verifier confirmed the new htm-authored primitive (no JSX), the pure state module mirroring ds-005's collapsible-state, the `--shadow-md` anchored panel, dismiss-on-Esc/outside-click + keyboard operability, the board.js retirement (duplicate listeners/refs/raf deleted, closed gear neutral, `--obligation` on the skip-perms toggle in the open menu, Stop closes the menu), the canvas pattern, and the gate-reopen note in the README. Styleguide suite 51/51, dashboard suite 412/412 green.
**Commit:** 70ffde0
**Files changed:** 8 (menu.js [new], menu-state.js [new], styleguide app.js canvas, menu.test.mjs [new], dashboard board.js, settings-menu.test.mjs, design-system README, dashboard/dist/app.js) + task file move →done
**Tests added:** menu.test.mjs (new suite: pure state + behavior guards); settings-menu.test.mjs reframed to assert the shared-primitive consumption
**ADRs written:** none
**Follow-up landed:** the now-stale agentic-workflow README `SettingsMenu` prose (flagged by the ds-015 worker, which correctly didn't touch another BC's README) was corrected by the orchestrator in a separate chore commit (a707592).

---

## 2026-06-16 11:45 -- Task verified and completed: agentic-workflow-046 - Modeling DISMISS verb — hard-delete a backlog/todo task with bookkeeping

**Type:** Work / Task completion
**Task:** agentic-workflow-046 - Modeling DISMISS verb — hard-delete a backlog/todo task with bookkeeping
**Summary:** Added DISMISS as the `modeling` skill's fourth verb (alongside CAPTURE/REFINE/PROMOTE) — documented in `skills/modeling/SKILL.md` the full ADR-0022 contract: resolve by id/number/keyword, refuse for doing/done, compute the transitive dependent-subtree cascade set (depends_on/blocks edges only, upstream only), refuse the whole op if any member is in-flight/shipped, one confirmation over the full set, hard-delete, and the bookkeeping layer (cross-BC INDEX line/count edits — the sanctioned multi-BC-index exception — surviving-task + ADR backlink stripping, one bare `Modeling / Dismissed` protocol entry, retired-never-reused ids). BC README gains the Dismiss command + Task-dismissed event.
**Verification:** PASS (iteration 1) — verifier mapped every ADR-0022 clause to the SKILL.md prose (all 10 present, including the doing/done refusal, cascade-edges-only rule, and cross-BC index exception), confirmed "three actions" → "four actions" with no dangling references, scope clean (only SKILL.md + BC README; no real task dismissed; aw-048 still present). Test-execution check N/A (skill prose, no suite) — correctly SKIPPED, not failed.
**Commit:** 60d31ac
**Files changed:** 2 (skills/modeling/SKILL.md, agentic-workflow README) + task file move →done
**Tests added:** none (documentation of a skill capability — no code/test surface)
**ADRs written:** none (ADR-0022 already froze the contract at refine; this is its documentation half)

---

## 2026-06-16 11:36 -- Batch started: [agentic-workflow-046, design-system-015]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-046 - Modeling DISMISS verb — hard-delete a backlog/todo task with bookkeeping; design-system-015 - Shared Menu / Popover primitive for dropdown menus
**Parallel:** yes (2 workers) — builder said "work on both now". The aw-046 blocker cleared (the pending `skills/modeling/SKILL.md` change was reverted, tree clean). No file overlap: aw-046 touches `skills/modeling/SKILL.md` (agentic-workflow); ds-015 touches the styleguide + `dashboard/app/board.js` + dist (design-system) — different files, different BC READMEs. (Session resumed after the 11:07 end entry below.)

---

## 2026-06-16 11:07 -- Work session ended

**Type:** Work / Session end
**Completed:** 5 (first-try PASS: 5, re-dispatched: 0, skipped: 0) — infrastructure-020 (4533d39), design-system-013 (4956ff2), design-system-014 (2a07ec9), agentic-workflow-047 (fe4d6b4), agentic-workflow-049 (f46e6e3)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 5
**ADRs:** 1 (ADR-0018 amended in place by infrastructure-020 — mechanism clause only)
**Notes:**
- Four waves. Wave 1 ran 2 workers in parallel (infra-020 + ds-013, no file overlap); waves 2–4 were solo because of genuine serialization constraints, not lack of work:
  - ds-014 ran alone because aw-049's `node build.mjs` bundles the styleguide `drawer.js` that ds-014 edits (read-while-write on the styleguide→dist bundle).
  - aw-047 and aw-049 each ran alone because they both rebuild `dashboard/dist/app.js` and both touch the agentic-workflow BC README (same-BC-README conflict).
  - The title-leading chain executed in its dependency order: ds-014 (styleguide Drawer title capability) → aw-047 (dashboard threads the title + main-pane reader + rebuild).
- Every SUCCESS passed verification first try (5/5). No bounces, no failures, no escalations.
- **Two todo tasks intentionally HELD for the builder (todo is NOT empty by design):**
  - **agentic-workflow-046** (Modeling DISMISS verb) — deferred, NOT bounced. It edits `skills/modeling/SKILL.md`, which carries a PRE-EXISTING uncommitted change (a deterministic ID-numbering guidance block). A worker edit would entangle that unrelated change into the aw-046 commit (git is file-granular), violating one-task-one-commit. Needs the builder to dispose of the pending SKILL.md change first (commit or revert it), then aw-046 can run cleanly.
  - **design-system-015** (shared Menu/Popover primitive) — held. Its frontmatter `depends_on` under-declares the real dependency: its body requires aw-049's board-local dropdown to exist so it can retire it (aw-049 is now done, so that precondition is met). BUT the task self-describes as build-later ("build only when a second popover consumer appears or the topbar menu is worth unifying") — there is exactly ONE consumer today, where ds-005's extraction precedent waited for two. Building it now would rework aw-049's just-shipped dropdown for a single consumer. Builder's call whether to promote it now.
- The backlog grew heavily DURING the run via a concurrent `modeling`/capture session (aw-046/048/049/050, design-system-015/016 captured & some promoted; aw-049 was promoted mid-run and picked up automatically). protocol.md / INDEX.md saw concurrent writes throughout — all merged cleanly.
- Pre-existing uncommitted working-tree state persists per repo convention (commit:-SHA frontmatter backfills, INDEX/protocol bookkeeping, the pending SKILL.md change) — only code + the per-task file move were committed each task; never `git add -A`.

---

## 2026-06-16 11:06 -- Task verified and completed: agentic-workflow-049 - Topbar settings menu — collapse Stop dashboard / theme / skip-permissions into a gear dropdown

**Type:** Work / Task completion
**Task:** agentic-workflow-049 - Topbar settings menu — collapse Stop dashboard / theme / skip-permissions into a gear dropdown
**Summary:** A board-local `SettingsMenu` gear dropdown (reusing the existing `settings-2` glyph) now sits immediately left of the standing Work button and holds the three relocated utility controls — Stop dashboard, theme toggle, skip-permissions toggle. The three keep their behavior + persistence (theme-state.js, skip-permissions-state.js, launchOrCopy + StoppedOverlay); the closed gear carries no armed cue (the `--obligation` danger hue lives only on the skip-permissions toggle inside the open menu); the menu dismisses on Esc / outside-click / selecting Stop, while the toggles keep it open.
**Verification:** PASS (iteration 1) — verifier confirmed exactly-three menu items, inline controls removed, Work left standing, the armed `--obligation` treatment surviving inside the menu with a neutral closed gear, dismiss/keep-open behavior, keyboard operability (focusable gear, aria-haspopup/expanded, Esc), token-matched + prefers-reduced-motion, NO styleguide-source edit (board-local, gate not reopened). Full dashboard suite 412/412 green.
**Commit:** f46e6e3
**Files changed:** 6 (board.js, settings-menu.test.mjs [new], shell-relayout.test.mjs, stop-dashboard.test.mjs, dashboard/dist/app.js, agentic-workflow README) + task file move →done
**Tests added:** settings-menu.test.mjs (new suite) + updated shell-relayout / stop-dashboard guards for the relocation
**ADRs written:** none

---

## 2026-06-16 11:05 -- Modeling / Captured: agentic-workflow-050 + design-system-016 - Dashboard global search

**Type:** Modeling / Capture
**BC:** agentic-workflow (+ design-system)
**Filed to:** backlog (both)
**Summary:** Replace the dead `BoardTopbar` breadcrumb (`Board` + `agentheim / tickets`) with a global search field that searches every `.agentheim` artifact — BC READMEs, ADRs, research, and tickets — by title AND content, showing results grouped by category in a popover below the input (title + first-occurrence excerpt per row), navigable by up/down + Enter and by click, loading the chosen item into the main content pane. Cross-BC capture: **agentic-workflow-050** owns the new `GET /api/search` read endpoint + topbar field + popover + routing (depends on aw-049's topbar rework, in doing); **design-system-016** owns the styleguide search-field + grouped-results combobox pattern (the second popover consumer ds-015 anticipated). Both backlog (under-refined): the read-only server's first content-search endpoint likely warrants an ADR, and ranking/excerpt/keyboard semantics need cornering at refine. Builder decisions captured: tickets open in the main pane (like aw-039), project name stays in the rail brand (breadcrumb removal costs no branding).

---

## 2026-06-16 10:55 -- Batch started: [agentic-workflow-049]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-049 - Topbar settings menu — collapse Stop dashboard / theme / skip-permissions into a gear dropdown
**Parallel:** no (1 worker). agentic-workflow-046 deferred — it edits `skills/modeling/SKILL.md`, which carries a PRE-EXISTING uncommitted change (deterministic ID-numbering guidance); a worker edit would entangle that unrelated change into the aw-046 commit (git is file-granular). Surfaced to the builder. design-system-015 held (needs aw-049 shipped first; self-described build-later).

---

## 2026-06-16 10:52 -- Task verified and completed: agentic-workflow-047 - Both detail surfaces lead with the item title, not the file path

**Type:** Work / Task completion
**Task:** agentic-workflow-047 - Both detail surfaces lead with the item title, not the file path
**Summary:** The dashboard-consumer half of the title-leading change: `intentToDrawerItem` now threads `intent.title` onto the doc item so the ds-014 styleguide Drawer header leads with it; the main-pane reader's ready-state header leads with `doc.title` (`<h1>`, `--font-ui`, 21px, `--fg-1`) over a demoted quiet mono `--fg-3` path sub-line, with a path fallback when title-less. Dist rebuilt to fold in ds-014's Drawer change + this data threading.
**Verification:** PASS (iteration 1) — verifier ran a fresh `node build.mjs` that reproduced the committed dist byte-for-byte; confirmed the slide-over mapping carries the title (+ title-less → empty-string fallback), the main-pane header leads with the title at >11.5px/`--fg-1`/`--font-ui` with the path demoted below, tokens-only (no bespoke hex, ADR-0003), the error-state path diagnostic preserved, and NO styleguide source touched (scope held). Dashboard suite 398/398 green.
**Commit:** fe4d6b4
**Files changed:** 6 (slide-over-data.js, main-pane-reader.js, 2 tests, dashboard/dist/app.js, agentic-workflow README) + task file move →done
**Tests added:** 3 (title-on-doc-item, title-less-fallback, main-pane-title-leads)
**ADRs written:** none

---

## 2026-06-16 10:49 -- Modeling / Promoted: agentic-workflow-046 - Modeling DISMISS verb — hard-delete a backlog/todo task with bookkeeping

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-06-16 10:48 -- Batch started: [agentic-workflow-047]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-047 - Both detail surfaces lead with the item title, not the file path
**Parallel:** no (1 worker) — unblocked by design-system-014 (done, 2a07ec9). agentic-workflow-049 demoted (it and aw-047 both rebuild `dashboard/dist/app.js` and both touch the agentic-workflow BC README — serialized). design-system-015 held: its body requires aw-049 to ship first (undeclared dep) and self-describes as build-later.

---

## 2026-06-16 10:48 -- Modeling / Refined: agentic-workflow-046 - Modeling DISMISS verb — hard-delete a backlog/todo task with bookkeeping

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Cornered the three open questions. Dependency-reconciliation policy decided as **cascade** (dismiss the whole transitive dependent subtree under one confirmation; refuse entirely if the set touches `doing/`/`done/`) — recorded as ADR-0022. Protocol entry decided as a **bare record** (no builder-typed reason). Verb-vs-skill kept as a `modeling` verb. Rewrote the DISMISS algorithm, acceptance criteria, and Notes around the cascade; propagated the cascade caveat into aw-048's confirm-dialog contract.
**Split into:** none
**ADRs written:** ADR-0022

---

## 2026-06-16 10:43 -- Task verified and completed: design-system-014 - Drawer contextual header leads with the item title, path demoted to a sub-line

**Type:** Work / Task completion
**Task:** design-system-014 - Drawer contextual header leads with the item title, path demoted to a sub-line
**Summary:** The styleguide `Drawer` `HeaderContextual` now leads with the item title (`<h2>`, `--font-ui`, 15.5px, weight 600, `--fg-1`) and demotes the path to a quiet mono `--fg-3` sub-line; `describeItem` carries `title` from `item.title` on both the doc and ticket branches, with a graceful fallback to the path as the lead when no title is present. Styleguide-capability half only — the dist rebuild + intent title-threading is agentic-workflow-047.
**Verification:** PASS (iteration 1) — verifier confirmed title-on-both-branches, the prominent title line (size >11.5, weight ≥500, `--fg-1`), the demoted mono/--fg-3 path sub-line, the title-absent path fallback, consumed-unforked (no `dashboard/` file touched — scope held), and the gate-reopen note in the README. Styleguide suite 41/41 green.
**Commit:** 2a07ec9
**Files changed:** 3 (drawer.js, drawer.test.mjs, design-system README) + task file move →done
**Tests added:** 4 (title-both-branches, prominent-title-line, demoted-path, title-absent-fallback)
**ADRs written:** none

---

## 2026-06-16 10:42 -- Modeling / Promoted: design-system-015 - Shared Menu / Popover primitive for dropdown menus

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-06-16 10:33 -- Batch started: [design-system-014]

**Type:** Work / Batch start
**Tasks:** design-system-014 - Drawer contextual header leads with the item title, path demoted to a sub-line
**Parallel:** no (1 worker) — agentic-workflow-049 demoted (its `node build.mjs` dist rebuild bundles the styleguide drawer.js that ds-014 edits — read-while-write hazard; serialized). agentic-workflow-047 still blocked on ds-014.

---

## 2026-06-16 10:31 -- Task verified and completed: infrastructure-020 - Bridge mangles prompts containing quotes — POSIX escaping breaks the Windows shell

**Type:** Work / Task completion
**Task:** infrastructure-020 - Bridge mangles prompts containing quotes — POSIX escaping breaks the Windows shell
**Summary:** The bridge no longer types a shell command line into a terminal — it spawns `claude` directly as the terminal process via `createTerminal({ shellPath, shellArgs })`, so the prompt is a raw argv element no shell parses and every metacharacter survives verbatim. The pure core emits a structured `{ command:'claude', args }` descriptor (seam renamed `launchTerminal` → `launchClaude`) and the `\"`-escaping is deleted; ADR-0018 amended in place (mechanism only; HTTP wire unchanged); `.vsix` bumped 0.2.0 → 0.2.1.
**Verification:** PASS (iteration 1) — verifier confirmed the descriptor contract + seam rename forcing all call sites, the strict-`true` skip-permissions matrix re-expressed as descriptors, the new metacharacter-survival guard (`" ' \` $ & | ; $(…)` → one verbatim `args[0]`), the in-place additive ADR-0018 amendment (status stays proposed, infra-020 in `related_tasks`, HTTP wire noted unchanged), README corrections, and the Windows PATH×PATHEXT resolver localized in `extension.js`. Bridge suite: 12/14 ephemeral-port tests green; the 2 failures are the documented port-31425 contention (live bridge holds it), not a regression.
**Commit:** 4533d39
**Files changed:** 7 + task file move →done
**Tests added:** 2 metacharacter-survival tests; string assertions migrated to descriptor shape
**ADRs written:** 0018 (in-place amendment)

---

## 2026-06-16 10:31 -- Task verified and completed: design-system-013 - Drawer "Open in full screen" uses a maximize glyph, not the external-link icon

**Type:** Work / Task completion
**Task:** design-system-013 - Drawer "Open in full screen" uses a maximize glyph, not the external-link icon
**Summary:** The styleguide Drawer "Open in full screen" action now wears the `maximize` glyph (four outward corners) instead of the external-link `square-arrow-out-up-right`, in both `HeaderMinimal` and `HeaderContextual`; `maximize` was added to `icons.js`'s LUCIDE map and the dashboard `dist/` rebuilt so the live slide-over shows it.
**Verification:** PASS (iteration 1) — verifier confirmed both headers use `name="maximize"` (none on the action use `square-arrow-out-up-right`), the glyph resolves non-empty, title/aria-label and `onOpenFullScreen` behaviour unchanged, consumed-unforked (ADR-0003), the derived dist reflects the swap. Styleguide suite 37/37 green; dashboard suite 395/395 green.
**Commit:** 4956ff2
**Files changed:** 5 + task file move →done
**Tests added:** 1 (maximize-glyph-resolves) + existing guards flipped to assert the new glyph
**ADRs written:** none

---

## 2026-06-16 11:40 -- Modeling / Refined: agentic-workflow-049 - Topbar settings menu

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Resolved the four open questions. **Primitive:** the styleguide has no Menu/Dropdown/Popover primitive (only an `--shadow-md` "Popovers" token comment), so this builds as a board-local, token-matched dropdown (ADR-0003 unforked, the sort-`<select>` precedent) — it does NOT depend on the shared-primitive follow-up. **Glyph:** reuse the existing `settings-2` glyph — no styleguide edit, no gate reopen. **Closed gear:** no armed cue; the skip-perms danger hue lives only on the toggle inside the open menu (consistent with amended ADR-0019). **Menu persistence:** the theme/skip-perms toggles keep the menu open; Stop dashboard / Esc / outside-click close it. Sharpened acceptance criteria around the board-local-no-gate-reopen constraint, keyboard operability, and the dist rebuild; added related_adrs [ADR-0003, ADR-0017, ADR-0019]. Promoted backlog → todo (gate is open, no remaining blockers).
**Split into:** none
**Filed (follow-up capture):** design-system-015 — shared Menu/Popover primitive (backlog), mirrors aw-014 → ds-005; aw-049 ships board-local first and is retired into it later.
**ADRs written:** none

---

## 2026-06-16 11:00 -- Modeling / Captured: agentic-workflow-049 - Topbar settings menu

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Collapse the three topbar utility controls (Stop dashboard, theme toggle, skip-permissions toggle) into a settings gear dropdown placed immediately left of the standing Work button. Relocation, not rewrite — controls keep their behavior, persistence, and the skip-permissions armed/danger hue. Knowingly supersedes aw-021's inline "one setting today" placement. Open question: styleguide menu primitive vs board-local dropdown.

---

## 2026-06-16 10:23 -- Batch started: [design-system-013, infrastructure-020]

**Type:** Work / Batch start
**Tasks:** design-system-013 - Drawer "Open in full screen" uses a maximize glyph, not the external-link icon; infrastructure-020 - Bridge mangles prompts containing quotes — POSIX escaping breaks the Windows shell
**Parallel:** yes (2 workers) — design-system-014 demoted to next wave (drawer.js conflict with ds-013); agentic-workflow-047 blocked on ds-014.

---

## 2026-06-16 -- Modeling / Captured: agentic-workflow-046 + agentic-workflow-048 - Dismiss a backlog/todo ticket

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Builder wants a hover-revealed red trash can on backlog/todo cards (with a
confirmation dialog) to dismiss a ticket. Because the dashboard is read-only (ADR-0017)
and dismissal carries real bookkeeping (dependency reconciliation, INDEX, protocol,
backlinks), the work split in two: aw-046 adds a `modeling` **DISMISS** verb that
hard-deletes the file + reconciles bookkeeping; aw-048 adds the dashboard trash-can
affordance that fires `/agentheim:modeling dismiss <id>` via the bridge (aw-048
depends on aw-046 + the styleguide gate). Disposition: hard delete (no archive folder /
status flag). The board task was renumbered 047→048 at capture: a concurrent session
had already taken 047 for an unrelated task; resolved per the duplicate-id rule by
moving the less-integrated one.

---

## 2026-06-16 -- Modeling / Refined: infrastructure-020 - Bridge mangles prompts containing quotes — POSIX escaping breaks the Windows shell

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo
**Summary:** Architect resolved the branching fix flagged as the blocker. Decided Approach 1 (bypass the shell): the seam spawns `claude` as the terminal process via `createTerminal({ shellPath, shellArgs })`, the pure core emits a structured launch descriptor `{ command:'claude', args:[…] }` and the `\"`-escaping is deleted — quoting stops mattering for any shell. Rejected detect-and-quote-per-shell (Approach 2) and kept out-of-band temp-file/stdin (Approach 3) only as the Windows-resolution escape hatch. Sharpened acceptance criteria around the descriptor contract, the renamed seam, the metacharacter-survival test, and an in-place ADR-0018 amendment (mechanism clause only; HTTP wire unchanged) with verbatim amendment text and the Windows `shellPath` PATH×PATHEXT resolution caveats captured as worker-confirmable points. Promoted backlog → todo (the architect decision was the only stated blocker).
**Split into:** none
**ADRs written:** none (ADR-0018 amendment specced into the task; the worker lands it with the code)

---

## 2026-06-16 -- Modeling / Captured + Refined: title-not-path on both detail surfaces (design-system-014 + agentic-workflow-047)

**Type:** Modeling / Capture + Refine
**BC:** design-system, agentic-workflow
**Filed to:** todo (both)
**Summary:** User correction: the slide-over Drawer does NOT show the item title — its contextual header (`drawer.js:67-93`) shows a type pill + the path, and in the live dashboard `intentToDrawerItem` builds a doc item `{type, meta, body}` with no title field at all. So BOTH detail surfaces (slide-over + main-pane reader) show the path, not the title — a cross-BC change. Re-scoped the original capture and split it: **design-system-014** (new) adds a prominent title heading to the styleguide Drawer's contextual header — larger, `--fg-1` — with the path demoted to a quiet sub-line (graceful fallback when no title); **agentic-workflow-047** (re-scoped, file renamed) threads the intent's title into the Drawer item, shows the title in the main-pane reader, and rebuilds `dashboard/dist/`. aw-047 depends_on design-system-014. Mirrors the design-system-009 → agentic-workflow-039 cross-BC precedent. The earlier "main-pane only / slide-over already shows the title" framing was wrong and is superseded.
**Split into:** design-system-014, agentic-workflow-047 (re-scoped)
**ADRs written:** none

---

## 2026-06-16 10:30 -- Modeling / Captured: design-system-013 - Drawer "Open in full screen" uses a maximize glyph

**Type:** Modeling / Capture
**BC:** design-system
**Filed to:** todo
**Summary:** The item-details / slide-over "Open in full screen" action wears the external-link glyph (`square-arrow-out-up-right`), which reads as "navigate away". Swap it for a maximize/expand glyph (recommended Lucide `maximize`) in `icons.js` + both `drawer.js` header variants; rebuild dashboard `dist/` so the slide-over shows it. Filed ready-to-work.

---

## 2026-06-16 10:12 -- Work session ended

**Type:** Work / Session end
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0) — agentic-workflow-044 (c3b77a4), agentic-workflow-045 (bac8a0b)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2
**ADRs:** 0
**Notes:**
- Two single-task batches (no parallelism — only ever one ready task per wave). aw-044 (remove the temp "Replay celebration" button) then aw-045 (frontmatter/body glue bug) — both touch `dashboard/` and would have serialized on the shared dist rebuild + `node --test` suite anyway.
- The backlog grew DURING the run via parallel `modeling`/`capture` sessions: design-system-012, infrastructure-020, agentic-workflow-046 captured to backlog, and aw-045 itself was promoted todo mid-session (picked up automatically on the next re-scan). All three new backlog items still need a `modeling` promote before `work` can claim them.
- Dashboard suite: 393 → 393 (aw-044, net-zero — guards inverted) → 395 (aw-045, +2 regression tests).
- ⚠️ Pre-existing uncommitted working-tree state persists (commit:-SHA frontmatter backfills on many done tasks, plus INDEX/protocol bookkeeping from prior + this run). Per repo convention these bookkeeping files stay uncommitted; only code + the per-task file move were committed each task.
- Backlog remaining (all need a `modeling` promote): agentic-workflow-031, agentic-workflow-046, design-system-012, infrastructure-020.

---

## 2026-06-16 10:12 -- Task verified and completed: agentic-workflow-045 - Folded frontmatter glues onto the body so a task's first heading renders as literal "## Why"

**Type:** Work / Task completion
**Task:** agentic-workflow-045 - Folded frontmatter glues onto the body so a task's first heading renders as literal "## Why"
**Summary:** `withFrontmatterSection` now joins the collapsed `<details>` "Front matter" section to the stripped body with a blank line (`section + '\n\n' + body`) only when a section is present, so marked closes the type-6 raw-HTML block and the body's first heading (e.g. `## Why`) renders as a real heading on both render surfaces; a no-frontmatter document still passes through byte-for-byte.
**Verification:** PASS (iteration 1) — dashboard suite 395/395 green; verifier confirmed the blank-line separator (`</details>\n\n## Why`, no double-spacing since parseFrontmatter strips the leading newline), byte-for-byte no-frontmatter passthrough, the guard reflected in the rebuilt dist bundle, both surfaces fed by the one shared transform (ADR-0010/0021), no styleguide/ADR/lifecycle change.
**Commit:** bac8a0b
**Files changed:** 3 (frontmatter.js, frontmatter.test.mjs, dist/app.js) + task file move →done
**Tests added:** 2 (separator-present + no-frontmatter-no-separator regression); dashboard suite 393 → 395
**ADRs written:** none

---

## 2026-06-16 10:09 -- Batch started: [agentic-workflow-045]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-045 - Folded frontmatter glues onto the body so a task's first heading renders as literal "## Why"
**Parallel:** no (1 worker) — only ready task this wave (dependency design-system-001 satisfied in done/).

---

## 2026-06-16 -- Modeling / Captured: agentic-workflow-045 - Folded frontmatter glues onto the body so a task's first heading renders as literal "## Why"

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Bug — since aw-043 folded frontmatter into a `<details>` section, `withFrontmatterSection` joins `</details>` directly onto the stripped body (`frontmatter.js:146`), so the body's first heading (`## Why`) lands inside the raw HTML block and renders as literal `##`. Affects both the slide-over Drawer and the main-pane reader. Root-caused at capture; fix is a blank-line separator. Filed straight to todo (small, well-understood; styleguide gate satisfied — design-system-001 done).

---

## 2026-06-16 10:08 -- Task verified and completed: agentic-workflow-044 - Remove the temporary "Replay celebration" button

**Type:** Work / Task completion
**Task:** agentic-workflow-044 - Remove the temporary "Replay celebration" button
**Summary:** Deleted the temporary aw-025 "🎉 Replay celebration" scaffold block from BoardPromptBar in dashboard/app/board.js; the real confetti machinery (BoardConfetti, confettiKey, and its legitimate successful-launch/landed-copy onResult caller) stays intact, confetti still fires on a real launch/copy.
**Verification:** PASS (iteration 1) — dashboard suite 393/393 green; verifier confirmed the TEMP (aw-025) fence is gone from source AND the rebuilt dist/app.js (zero "Replay celebration"), the legitimate confettiKey caller survives, the aw-025 "block exists" guards were inverted to assert removal, no styleguide/ADR/lifecycle change.
**Commit:** c3b77a4
**Files changed:** 4 (board.js, board-prompt-bar.test.mjs, dist/app.js, agentic-workflow README) + task file move →done
**Tests added:** 0 (two aw-025 existence guards inverted to removal/survival guards)
**ADRs written:** none

---

## 2026-06-16 -- Modeling / Captured: infrastructure-020 - Bridge mangles prompts containing quotes

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** backlog
**Summary:** Prompts typed with `"` (and other shell metacharacters) are cut off when a dashboard launch button hands them to the terminal. Root-caused to `vscode-extension/src/bridge.js:182` — the `\"` POSIX-shell escaping doesn't parse in the builder's Windows PowerShell/cmd default shell, so the first quote terminates the string early. JSON transport carries the prompt fine; the break is the bridge→terminal command construction. Filed to backlog (needs an architect decision: bypass-the-shell via `shellArgs` argv vs. detect-and-quote-per-shell vs. stdin/temp-file).

---

## 2026-06-16 10:01 -- Batch started: [agentic-workflow-044]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-044 - Remove the temporary "Replay celebration" button
**Parallel:** no (1 worker) — only ready task this wave.

---

## 2026-06-16 -- Capture / Captured: design-system-012 - Make the colors prettier

**Type:** Capture
**BC:** design-system
**Filed to:** backlog
**Summary:** "Macht die Farben schöner." — make the colors prettier (aesthetic, unscoped).

---

## 2026-06-16 -- Modeling / Captured: agentic-workflow-044 - Remove the temporary "Replay celebration" button

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Tear down aw-025's throwaway "🎉 Replay celebration" scaffold button — the confetti has been iterated to satisfaction (aw-034, aw-042), so the replay-on-demand trigger has served its purpose. Pure removal of the confined `TEMP (aw-025)` block in `board.js` plus its test guards; confetti still fires on successful launch/copy. Filed ready-to-work (no styleguide gate — removal adds no UI).

---

## 2026-06-16 -- Work session ended

**Type:** Work / Session end
**Completed:** 3 (first-try PASS: 3, re-dispatched: 0, skipped: 0) — agentic-workflow-039 (f289c29), design-system-011 (076870b), agentic-workflow-043 (62625b8)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 3
**ADRs:** 0 new; 1 in-place amendment — ADR-0021 (aw-039, Related line documents the "Open in full screen" per-action override of the open-intent split).
**Notes:**
- Two batches. Batch 1 ran aw-039 + ds-011 in PARALLEL (independent: different BCs, different test runners). aw-043 was held to batch 2 because it shares `dashboard/app/slide-over.js` + the single shared `dashboard/dist` rebuild and `node --test` suite with aw-039 (the documented frontend serialization race) — dispatched solo once aw-039 was committed.
- All three verified first-try. Dashboard suite climbed 370 → 375 (aw-039) → 393 (aw-043); styleguide suite trimmed to 36 green (ds-011 removed 2 stale cross-boundary assertions).
- The aw-039 → aw-043 dependency-in-spirit resolved cleanly: aw-039's note warned a task rendered full-screen shows raw frontmatter until aw-043 ships; aw-043 (built right after) fixes exactly that on both surfaces via one shared pure helper.
- ⚠️ Working-tree housekeeping (pre-existing, NOT this session): the repo carries uncommitted `commit:`-SHA backfills on many done-task frontmatter files plus accumulated INDEX.md/protocol.md edits from prior `work`/`modeling` runs. Per the established repo convention these bookkeeping files are left uncommitted; only code + task-file moves are committed per task. This session's INDEX/protocol/frontmatter updates ride alongside that existing uncommitted state.
- Backlog remaining (needs a `modeling` promote before `work` can claim): agentic-workflow-031 (next-steps overview when work is done).

---

## 2026-06-16 -- Task verified and completed: agentic-workflow-043 - Dashboard hides document frontmatter behind a collapsible "Front matter" section

**Type:** Work / Task completion
**Task:** agentic-workflow-043 - Dashboard hides document frontmatter behind a collapsible "Front matter" section (slide-over + main pane)
**Summary:** A document's leading YAML frontmatter no longer renders as a bold setext heading on either dashboard surface; one shared pure helper (`dashboard/app/frontmatter.js` — `parseFrontmatter`/`frontmatterSection`/`withFrontmatterSection`) strips it and re-emits a quiet, collapsed-by-default native `<details>` "Front matter" table upstream of the unforked styleguide `Markdown`, wired into both the task slide-over and the main-pane reader.
**Verification:** PASS (iteration 1) — dashboard suite 393/393 green; verifier confirmed both surfaces strip before `Markdown`, empty/no-frontmatter passthrough, collapsed-by-default `<details>` (no `open`), structured rows, HTML-escaping, array/empty values readable, `Drawer`/`Markdown` unforked (no styleguide diff), dist rebuilt.
**Commit:** 62625b8
**Files changed:** 6 (frontmatter.js [new], frontmatter.test.mjs [new], slide-over.js, main-pane-reader.js, dist/app.js, agentic-workflow README) + task file move →done
**Tests added:** ~12 pure unit tests (frontmatter.test.mjs); dashboard suite 375 → 393
**ADRs written:** none

---

## 2026-06-16 -- Batch started: [agentic-workflow-043]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-043 - Dashboard hides document frontmatter behind a collapsible "Front matter" section (slide-over + main pane)
**Parallel:** no (1 worker) — held from batch 1 because it shares `dashboard/app/slide-over.js` + the dashboard dist/test suite with aw-039; now unblocked since aw-039 is committed.

---

## 2026-06-16 -- Task verified and completed: design-system-011 - Stale add-affordance test asserts against dashboard board.js

**Type:** Work / Task completion
**Task:** design-system-011 - Stale add-affordance test asserts against dashboard board.js
**Summary:** Removed the ADR-0003 cross-boundary smell from the styleguide add-affordance suite — it now asserts only the styleguide-owned `onAdd &&` guard contract on EmptyColumn/ColumnHeader and no longer reads dashboard board.js. Consumer wiring stays covered in the dashboard suite.
**Verification:** PASS (iteration 1) — `node --test` under styleguide/ 36/36 green; verifier confirmed no `boardSrc`/`REPO` hop remains, the four styleguide guard tests stay, header comment describes only the guard contract.
**Commit:** 076870b
**Files changed:** 1 (add-affordance.test.mjs) + task file move backlog→done
**Tests added:** 0 (removed 2 stale cross-boundary assertions; net suite trimmed)
**ADRs written:** none

---

## 2026-06-16 -- Task verified and completed: agentic-workflow-039 - Slide-over "Open in full screen" renders the task in the main content pane

**Type:** Work / Task completion
**Task:** agentic-workflow-039 - Slide-over "Open in full screen" renders the task in the main content pane
**Summary:** The slide-over's "Open in full screen" action now promotes the open task out of the cramped slide-over into the main content pane (the MainPaneReader surface), as a deliberate per-action override of the ADR-0021 open-intent split — default `isTaskIntent` routing untouched, path stays read-only.
**Verification:** PASS (iteration 1) — dashboard suite 375/375 green; verifier confirmed the shell handler `setSelectedDoc(openIntent); setOpenIntent(null)`, slide-over forwards `onOpenFullScreen` to the Drawer unforked (ADR-0003), no `isTaskIntent` change, read-only, dist rebuilt.
**Commit:** f289c29
**Files changed:** 6 (slide-over.js, board.js, slide-over-full-screen.test.mjs, dist/app.js, agentic-workflow README, ADR-0021 amended) + task file move →done
**Tests added:** 5 source-reading static guards (slide-over-full-screen.test.mjs); dashboard suite 370 → 375
**ADRs written:** none (ADR-0021 amended in place — Related line += agentic-workflow-039, documenting the per-action override)

---

## 2026-06-16 -- Batch started: [agentic-workflow-039, design-system-011]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-039 - Slide-over "Open in full screen" renders the task in the main content pane, design-system-011 - Stale add-affordance test asserts against dashboard board.js
**Parallel:** yes (2 workers)
**Note:** aw-043 (frontmatter collapsible) held to next batch — conflicts with aw-039 on `dashboard/app/slide-over.js` + shared `dashboard/dist` rebuild.

---

## 2026-06-16 -- Modeling / Refined: agentic-workflow-039 - Slide-over "Open in full screen" renders the task in the main content pane

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Verified the seam against live code — the shell already holds `openIntent` in scope, so the new `onOpenFullScreen` handler is just `setSelectedDoc(openIntent); setOpenIntent(null)` (no task travels back through the Drawer's bare callback). Settled the one open modeling question — reuse `MainPaneReader` as-is, no "back to slide-over" control. Pinned the test approach to source-reading static guards (no pure module extracted) and noted the aw-043 frontmatter relationship. Dependency ds-009 is done/committed, so promoted backlog → todo.
**Split into:** none
**ADRs written:** none

---

## 2026-06-15 12:00 -- Modeling / Refined: design-system-011 - Stale add-affordance test asserts against dashboard board.js

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** todo
**Summary:** Resolved the task's open decision by inspecting source. The board
dropped `onAdd` on purpose (zero refs in `dashboard/app/board.js`); aw-018
(`remove dead add-ticket affordances`), aw-022 (per-card Refine/Promote pair) and
aw-023+ (board prompt bar) superseded the inline add affordance — the dashboard is
a read-only projection of disk (ADR-0001/0017). Fix scoped to: delete the two
cross-boundary `Board:` assertions + the `boardSrc`/`REPO` hop from
`add-affordance.test.mjs` (an ADR-0003 smell), keep the four EmptyColumn/
ColumnHeader styleguide-owned guard tests. Consumer add-story already covered in
`dashboard/test/{board-prompt-bar,backlog-card-launch}.test.mjs`, so no relocation
needed. Sharpened acceptance criteria; stays a design-system task; promoted to todo.
**Split into:** —
**ADRs written:** —

---

## 2026-06-16 00:01 -- Modeling / Promoted: agentic-workflow-043 - Dashboard hides document frontmatter behind a collapsible "Front matter" section

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-06-15 23:59 -- Modeling / Refined: agentic-workflow-043 - Dashboard hides document frontmatter behind a collapsible "Front matter" section

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog (ready to promote)
**Summary:** Grounded the fix in the actual render path and resolved both open
questions. Scope decided as **both** surfaces (task slide-over + main-pane reader,
aw-027) since they leak frontmatter identically through the same unforked
`Markdown` primitive. Mechanism decided as a **native `<details>` block folded
into the body string** by one shared pure helper (`dashboard/app/frontmatter.js`:
`parseFrontmatter` / `frontmatterSection` / `withFrontmatterSection`) — chosen
because the styleguide `Drawer` exposes no slot above the body and `Markdown`
passes raw HTML through, so this keeps both primitives unforked (ADR-0003) with
no design-system child task and no React state. Supersedes the prior
board-local-vs-design-system-primitive open question. Tightened acceptance
criteria (both surfaces, HTML-escaping, pure-helper tests, dist rebuild).
**Split into:** none
**ADRs written:** none

---

## 2026-06-15 23:52 -- Work session ended

**Type:** Work / Session end
**Completed:** 8 (first-try PASS: 8, re-dispatched: 0, skipped: 0) — aw-037, aw-038, aw-040, aw-041, design-system-009, aw-042, design-system-010, infrastructure-019
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 8 (aw-037 87e8991, aw-038 72fdbb9, aw-040 b5b663b, aw-041 15cfda5, ds-009 96bd905, aw-042 e5499ec, ds-010 5ba2524, infra-019 a47d31a)
**ADRs:** 0 new; 2 in-place amendments — ADR-0019 (aw-041, dot→red-icon armed cue) and ADR-0002 (infra-019, derived-first→last-good-first port selection, closing the self-heal follow-up infra-018 deferred).
**New backlog:** design-system-011 (filed by the ds-009 worker — a PRE-EXISTING `styleguide/test/add-affordance.test.mjs` failure asserting against drifted `dashboard/app/board.js`; the dashboard suite stayed fully green throughout, only the styleguide suite carries this one known-red test).
**Notes:**
- Every task ran SERIALIZED, one worker at a time — the documented flake race: all frontend tasks rebuild the single shared `dashboard/dist/app.js`, and every task (incl. server-side infra-019) invokes the shared `dashboard/` `node --test` suite. todo was refilled mid-run by concurrent `modeling`/`research` sessions (037→038→040→041→042→043, ds-009→010→011) and each new ready task was picked up as it appeared.
- **Coupling caught:** aw-042 tore out aw-037's confetti aim plumbing, but aw-038 had repurposed the same `textareaRef` for the prompt-field auto-grow — the worker was directed to keep `textareaRef` and remove only the aim chain; verifier confirmed auto-grow survived.
- **⚠️ Builder action pending:** design-system-009 (Drawer header) is a visible styleguide change that REOPENS the design-system gate — re-review against the canvas (section 07 header demos) is required before the downstream consumer agentic-workflow-039 ships.
- Remaining in backlog (need a `modeling` promote before `work` can claim): aw-031 (next-steps overview), aw-039 (slide-over open-in-full-screen — blocked on the ds-009 gate re-review), aw-043 (frontmatter collapsible section), design-system-011 (stale add-affordance test).

---

## 2026-06-15 23:50 -- Task verified and completed: infrastructure-019 - Dashboard origin sticks to its last-good port so an intermittent collision can't flap it

**Type:** Work / Task completion
**Task:** infrastructure-019 - Dashboard origin sticks to its last-good port so an intermittent collision can't flap it
**Summary:** The dashboard now remembers its last successfully-bound port in a separate gitignored `.agentheim/.dashboard/last-port.json` marker (written at bind time, beside `runtime.json`) and binds **last-good → derived → ladder**, so an intermittently-held derived port can no longer flap the `127.0.0.1:<port>` origin launch-to-launch (which would orphan the origin-keyed localStorage stores). Pure `bindSequence(root, lastGood)` in `port.mjs` (in-window guard + ladder-dedup); `serve.mjs` reads-before-bind and writes-at-bind; `runtime.json`/`inspectExisting`/`stopDashboard` untouched.
**Verification:** PASS (iteration 1) — dashboard suite 370/370 green; verifier confirmed all 6 acceptance criteria, that `inspectExisting`/`stopDashboard`/`writeRunfile` are byte-unchanged (runtime.json pid-gated contract intact), the dedup (last-good==derived / last-good-on-a-rung → single attempt) is unit-tested, and the marker is written only after a successful bind.
**Commit:** a47d31a
**Files changed:** 7 (port.mjs, runfile.mjs, serve.mjs, port.test.mjs, runfile.test.mjs, ADR-0002 [amended], infra README) + task file move
**Tests added:** bindSequence + listenOnLadder-with-lastGood cases (port.test.mjs) and readLastPort/writeLastPort round-trip + absent/malformed/non-integer→null + marker-independent-of-reap (runfile.test.mjs); dashboard suite 352 → 370
**ADRs written:** ADR-0002 amended in place (dated addendum, infrastructure-019 — port selection changes from derived-first to last-good-first; `related_tasks` += infrastructure-019; the task's `related_adrs` already lists 0002/0018). This closes the self-heal follow-up the infra-018 addendum had deferred.

---

## 2026-06-15 23:46 -- Batch started: [infrastructure-019]

**Type:** Work / Batch start
**Tasks:** infrastructure-019 - Dashboard origin sticks to its last-good port so an intermittent collision can't flap it
**Parallel:** no (1 worker — last ready task; server-side, edits `serve.mjs` / `port.mjs` / `port.test.mjs` + ADR-0002 amendment, disjoint from the frontend work but shares the dashboard `node --test` suite)

---

## 2026-06-15 23:42 -- Task verified and completed: design-system-010 - TicketCard — drop the ochre selected-state ring (no replacement cue)

**Type:** Work / Task completion
**Task:** design-system-010 - TicketCard — drop the ochre selected-state ring (no replacement cue)
**Summary:** The styleguide `TicketCard` lost its ochre selected-state cue — the `selected ? --accent-ochre` border branch and the `0 0 0 1px var(--accent-ochre)` ring are gone, so a selected card is visually identical to an unselected one. The `selected` prop survives as semantic `aria-pressed` only. Completes ADR-0016's "selection by de-emphasis, never the reserved accent" direction for the card (its last ochre-ring holdout).
**Verification:** PASS (iteration 1) — dashboard suite 352/352 green; styleguide suite 37/38 with the single failure being the confirmed PRE-EXISTING out-of-scope `add-affordance.test.mjs` (design-system-011), not this task's `ticket-card.test.mjs`; verifier confirmed all 5 acceptance criteria, `aria-pressed=${selected}` retained, hover (ds-008) unchanged, dist rebuilt unforked.
**Commit:** 5ba2524
**Files changed:** 4 (kanban.js, ticket-card.test.mjs, dashboard/dist/app.js [rebuilt], design-system README) + task file move
**Tests added:** net 0 (the `selected-state shadow unchanged` guard was inverted to `selected carries no ochre / accent ring`)
**ADRs written:** none (completes ADR-0016's direction; no new decision)

---

## 2026-06-15 23:38 -- Batch started: [design-system-010]

**Type:** Work / Batch start
**Tasks:** design-system-010 - TicketCard — drop the ochre selected-state ring (no replacement cue)
**Parallel:** no (1 worker — serialized vs the one other ready task infra-019: disjoint source files / BCs / ADRs, but both invoke the shared `dashboard/` `node --test` suite (ds-010 also rebuilds the bundled `dashboard/dist/`), the documented flake race. Lowest-id first: ds-010.)

---

## 2026-06-15 23:34 -- Task verified and completed: agentic-workflow-042 - Confetti uses canvas-confetti's realistic multi-fire preset, centered on screen

**Type:** Work / Task completion
**Task:** agentic-workflow-042 - Confetti uses canvas-confetti's realistic multi-fire preset, centered on screen
**Summary:** The celebration now fires canvas-confetti's canonical "realistic look" preset — a layered five-shot multi-fire burst (shared `count:200`, per-shot ratio/spread/velocity/decay/scalar) from a centered origin `{x:0.5,y:0.7}` with no angle aim — retiring aw-037's single textarea-aimed burst. The aim helper became a pure `confettiFireSequence()` returning `{count, defaults, shots}`; `fireConfetti` walks it. aw-038's prompt-field auto-grow `textareaRef` was preserved (only the confetti-aim use of it was torn out).
**Verification:** PASS (iteration 1) — dashboard suite 352/352 green; verifier ran the critical coupling check and confirmed `textareaRef`/`autoGrowField` survive for aw-038 while `confettiLaunchToRect`/`originRef`/`getBoundingClientRect` are fully gone from board.js, the matchMedia guard wraps the whole five-shot loop (reduced-motion fires none), and `confetti-palette.js` is untouched.
**Commit:** e5499ec
**Files changed:** 6 (board.js, confetti-launch.js [aim helper → fire-sequence], dist/app.js, board-prompt-bar.test.mjs, confetti-launch.test.mjs, aw README) + task file move
**Tests added:** confetti-launch.test.mjs rewritten to the new contract (5 fire-sequence guards: count=200, centered origin no-angle, exact five-shot array, no per-shot angle, floor(count*ratio)=[50,40,70,20,20]); board-prompt-bar guard updated to the centered wiring; reduced-motion no-call + aw-038 auto-grow guards retained
**ADRs written:** none (origin/tuning/multi-fire structure is ADR-0020's open replay-loop dial; no genuine new decision)

---

## 2026-06-15 23:30 -- Modeling / Captured: agentic-workflow-043 - Slide-over hides task frontmatter behind a collapsible, structured "Front matter" section

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Clicking a ticket renders the task file's YAML frontmatter as one large bold heading, because the styleguide `Markdown` primitive parses the raw body (the `key: value` block above the closing `---` becomes a setext heading). Capture: strip frontmatter out of the rendered body and show it instead as a quiet, collapsed-by-default "Front matter" section that expands to a structured key/value view. `Markdown` stays unforked (ADR-0003); parsing is board-local. Open question flagged: extend the same fix to the main-pane reader (aw-027), whose non-task docs leak frontmatter the same way.

---

## 2026-06-15 22:50 -- Batch started: [agentic-workflow-042]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-042 - Confetti uses canvas-confetti's realistic multi-fire preset, centered on screen
**Parallel:** no (1 worker — serialized: aw-042 + design-system-010 both rebuild the shared `dashboard/dist/app.js`; infra-019 shares the `dashboard/` `node --test` suite. Lowest-id first: aw-042.) Coupling watch: aw-042 tears out aw-037's confetti aim plumbing, but aw-038 repurposed the same `textareaRef` for the prompt-field auto-grow — the worker must keep `textareaRef` and remove only the aim chain.

---

## 2026-06-15 22:46 -- Task verified and completed: design-system-009 - Drawer header — drop the Copy button, rename "Open in editor" → "Open in full screen", expose a callback

**Type:** Work / Task completion
**Task:** design-system-009 - Drawer header — drop the Copy button, rename "Open in editor" → "Open in full screen", expose a callback
**Summary:** The styleguide `Drawer` header (both `HeaderMinimal` and `HeaderContextual`) dropped its dead Copy button and turned the dead "Open in editor" button into an optional consumer-supplied **Open in full screen** action — a bare `onOpenFullScreen()` callback threaded through `Drawer` to both headers; absent callback renders nothing (ds-006 cornerAction precedent) and the HeaderMinimal divider no longer dangles. The canvas section-07 demo supplies a handler so the action is visible for gate re-review.
**Verification:** PASS (iteration 1) — dashboard suite 353/353 green; new `styleguide/test/drawer.test.mjs` (7 guards) green; verifier confirmed all 8 acceptance criteria, the Drawer consumed unforked in the rebuilt dist, and the open/close/Esc/scrim behavior untouched.
**Commit:** 96bd905
**Files changed:** 6 (styleguide drawer.js, styleguide app.js canvas, styleguide drawer.test.mjs [new], dashboard/dist/app.js [rebuilt], design-system README, design-system-011 [new backlog]) + task file move
**Tests added:** 7 (styleguide/test/drawer.test.mjs: no Copy button, Open-in-full-screen label, fires onOpenFullScreen, absent→not-rendered both headers, divider no-dangle, canvas demo wires handler)
**ADRs written:** none (ADR-0003/0010 govern; ds-006 cornerAction callback precedent)
**Gate:** ⚠️ Visible styleguide change — REOPENS the design-system gate. Builder re-review against the canvas (section 07 header demos) is required before the downstream consumer agentic-workflow-039 (wires `onOpenFullScreen` to the main pane) ships.
**New backlog:** design-system-011 — the worker surfaced a PRE-EXISTING, unrelated styleguide-suite failure (`add-affordance.test.mjs` asserts against `dashboard/app/board.js` which dropped `onAdd` in the aw-026/027 refactor) and filed it rather than fixing out of scope. The styleguide suite carries this one known-red test; the dashboard suite is fully green.

---

## 2026-06-15 22:42 -- Modeling / Captured: agentic-workflow-042 - Confetti uses canvas-confetti's realistic multi-fire preset, centered on screen

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Next replay-loop iteration on the celebration confetti — replace aw-037's single textarea-aimed burst with canvas-confetti's canonical layered five-shot "realistic look" demo, fired from a centered origin (x:0.5, demo y:0.7) with no aim. Drops the aw-037 aim helper + textareaRef plumbing; palette / triggers / reduced-motion / ownership unchanged.

---

## 2026-06-15 22:28 -- Batch started: [design-system-009]

**Type:** Work / Batch start
**Tasks:** design-system-009 - Drawer header — drop the Copy button, rename "Open in editor" → "Open in full screen", expose a callback
**Parallel:** no (1 worker — serialized: design-system-009 and design-system-010 both edit the styleguide source + the design-system README and rebuild the shared `dashboard/dist/app.js`; infra-019 shares the `dashboard/` `node --test` suite. Lowest-id first: ds-009.) Note: ds-009 is a visible styleguide change that REOPENS the design-system gate — builder re-review required before the downstream consumer aw-039 ships.

---

## 2026-06-15 22:24 -- Task verified and completed: agentic-workflow-041 - Armed skip-permissions per-launch cue becomes a red icon, not a separate dot

**Type:** Work / Task completion
**Task:** agentic-workflow-041 - Armed skip-permissions per-launch cue becomes a red icon, not a separate dot
**Summary:** Each board `LaunchButton` now signals an armed (skip-permissions) launch by tinting its always-rendered icon `--obligation` (red), replacing the separate `--obligation` indicator dot and its `armed ? dot : icon` swap. Border + label stay normal (aw-030's no-button-wide-red rule), the "skips permissions" aria-label/title is retained on the button, and the launch payload is unchanged.
**Verification:** PASS (iteration 1) — dashboard suite 353/353 green (old dot test replaced by 3 aw-041 guards); verifier ran the critical accessibility check and confirmed the "skips permissions" wording survives on the `<button>` aria-label/title (not lost with the dot), the SkipPermissionsToggle + POST/launch path untouched, styleguide unforked, dist rebuilt.
**Commit:** 15cfda5
**Files changed:** 5 (board.js, dist/app.js, launch-button-hover.test.mjs, ADR-0019 [amended], aw README) + task file move
**Tests added:** net +2 (launch-button-hover.test.mjs: replaced the dot-retained test with no-dot-element + always-render-icon + armed-icon-tint guards); suite 351 → 353
**ADRs written:** ADR-0019 amended in place (second dated amendment, agentic-workflow-041 — dot→red-icon; bidirectional backlink: ADR-0019.related_tasks += agentic-workflow-041, task already lists ADR-0019). The money-named `--obligation`-as-danger reconciliation (future shared `--danger` token) remains flagged for the design-system README — still open, design-system's to make.

---

## 2026-06-15 22:20 -- Research: Cloud session auto-naming from the prompt (extends terminal-naming report)

**Type:** Research
**Requested by:** user
**Report:** knowledge/research/claude-code-terminal-session-naming-2026-06-15.md (new "## Cloud sessions — auto-naming from the prompt" section, sources 13–19)
**Review:** PASS (iteration 1)
**Summary:**
- The cloud auto-name is official and documented: Remote Control docs spell out the title precedence (`--name`/`/remote-control` > `/rename` > last meaningful message > `hostname-graceful-unicorn` placeholder) and state "If you didn't set an explicit name, the title updates to reflect your prompt once you send one." Same family as claude.ai chat titling.
- Why it works in the cloud but not locally: the cloud names an **Anthropic-owned session-list row** (rendered in a UI Anthropic fully controls), whereas a local IDE terminal tab is owned by VS Code/the OS — the CLI can only push an OSC title string it then overwrites every spinner tick.
- Cloud name is editable and persistent, but split across two non-reconciling stores per community bug #64304 (native `aiTitle` vs cloud Bridge `updateBridgeSessionTitle`). Native local auto-titling request #47176 closed not-planned — the prior report's "no local terminal-tab naming" conclusion stands.

---

## 2026-06-15 22:14 -- Batch started: [agentic-workflow-041]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-041 - Armed skip-permissions per-launch cue becomes a red icon, not a separate dot
**Parallel:** no (1 worker — serialized: the three frontend ready tasks (aw-041, design-system-009, design-system-010) each rebuild the single shared `dashboard/dist/app.js` (ds-009/ds-010 also share the design-system README), and all ready tasks invoke the shared `dashboard/` `node --test` suite. Lowest-id first: aw-041.)

---

## 2026-06-15 22:08 -- Task verified and completed: agentic-workflow-040 - Main-pane document reader centers its reading column in the content area

**Type:** Work / Task completion
**Task:** agentic-workflow-040 - Main-pane document reader centers its reading column in the content area
**Summary:** The main-pane document reader (`MainPaneReader`) now centers its constrained reading column horizontally in the content area via `margin: "0 auto"` on the `<article>`, keeping the `maxWidth: 760` measure — block centering of the whole column (path header + Markdown), not center-aligned text.
**Verification:** PASS (iteration 1) — dashboard suite 351/351 green; verifier confirmed all 4 acceptance criteria, the only production change is the `<article>` style, the styleguide `Markdown` primitive stays unforked (no design-system change), dist genuinely rebuilt.
**Commit:** b5b663b
**Files changed:** 4 (main-pane-reader.js, main-pane-reader.test.mjs, dist/app.js, aw README) + task file move
**Tests added:** 1 (main-pane-reader.test.mjs: asserts `margin:"0 auto"` + maxWidth preserved + no `textAlign:center`); suite 350 → 351
**ADRs written:** none (board-local layout tweak inside the BC-owned reader; ADR-0021/0003 govern)

---

## 2026-06-15 22:05 -- Research: Naming a Claude Code terminal session in the IDE

**Type:** Research
**Requested by:** user
**Report:** knowledge/research/claude-code-terminal-session-naming-2026-06-15.md
**Review:** PASS (iteration 1)
**Summary:**
- No official way exists to give a Claude Code terminal session a custom name — no setting, CLI flag, or env var; the relevant feature requests (#18326, #29349, #52258, #23998, #55197) are all closed (duplicate / not-planned / stale). The CLI rewrites the tab title on every spinner tick, defeating manual rename, OSC sequences, and `/rename`.
- The user almost certainly means the VS Code extension / CLI in VS Code's integrated terminal — there is no official Anthropic Visual Studio (proper) extension (open request #15942).
- Only workaround: a third-party VS Code extension "Claude Terminal Name Sync" (publisher jesshart), macOS/Linux only, Windows untested. The graphical chat-panel sessions, unlike CLI terminal tabs, DO get nameable AI-generated titles.

---

## 2026-06-15 21:52 -- Batch started: [agentic-workflow-040]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-040 - Main-pane document reader centers its reading column in the content area
**Parallel:** no (1 worker — serialized: every frontend ready task (aw-040, aw-041, design-system-009, design-system-010) rebuilds the single shared `dashboard/dist/app.js` and all ready tasks invoke the shared `dashboard/` `node --test` suite, the documented flake race. Lowest-id first: aw-040.)

---

## 2026-06-15 21:48 -- Task verified and completed: agentic-workflow-038 - Board prompt bar — single-line auto-growing input replaces the multi-line textarea

**Type:** Work / Task completion
**Task:** agentic-workflow-038 - Board prompt bar — single-line auto-growing input replaces the multi-line textarea
**Summary:** The board prompt-bar field is now a single-logical-line, auto-growing control: still a `<textarea>` element (so the aw-035/aw-037 confetti rect/aim path reads the same node) but it soft-wraps with no horizontal scrollbar, auto-grows in height to a cap then scrolls, swallows Enter (no newline, no launch), and runs every change through the pure `sanitizePromptLine` so the value can never hold a newline (multi-line paste collapses to one line). The Quick Capture / Modeling / Research builders read the same sanitized value unchanged.
**Verification:** PASS (iteration 1) — dashboard suite 350/350 green (4 new board-glue guards); verifier confirmed all 7 acceptance criteria, the styleguide source and `modeling-command.js` builders untouched, the `textareaRef` confetti path intact, dist genuinely rebuilt, styleguide consumed unforked.
**Commit:** 72fdbb9
**Files changed:** 4 (board.js, board-prompt-bar.test.mjs, dist/app.js, aw README) + task file move
**Tests added:** 4 (board-prompt-bar.test.mjs: single-line+auto-grow wiring, Enter-swallow, never-a-newline/paste-collapse, builders read the sanitized value); suite 346 → 350
**ADRs written:** none (board-local token-matched control consuming the styleguide unforked; ADR-0003/ADR-0020 govern, no new decision)

---

## 2026-06-15 21:45 -- Modeling / Captured: agentic-workflow-041 - Armed skip-permissions per-launch cue becomes a red icon, not a separate dot

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** When the skip-permissions toggle is armed, the board launch buttons should tint their existing icon red (`--obligation`) instead of swapping it for a separate red dot. Drops the dot, colours the always-present icon. A further narrowing of the aw-030 / ADR-0019 armed-cue treatment (dot-only → red icon); the amended ADR-0018 per-launch mandate still holds.

---

## 2026-06-15 21:30 -- Modeling / Captured: design-system-010 - TicketCard — drop the ochre selected-state ring

**Type:** Modeling / Capture
**BC:** design-system
**Filed to:** todo
**Summary:** Remove the ochre (orange/yellow) selected-state cue on TicketCard — the accent border + 1px ring (kanban.js:78,80) — with no replacement cue (selected == unselected). Aligns the card with ADR-0016's accent-reservation / de-emphasis direction. Global keyboard `:focus-visible` ring left intact as out of scope.

---

## 2026-06-15 20:12 -- Batch started: [agentic-workflow-038]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-038 - Board prompt bar — single-line auto-growing input replaces the multi-line textarea
**Parallel:** no (1 worker — serialized vs the three other ready tasks: aw-040 + design-system-009 both rebuild the same `dashboard/dist/app.js` bundle (aw-040 also shares the aw README), and all four ready tasks invoke the shared `dashboard/` `node --test` suite — the documented flake race the prior three sessions serialized around). Lowest-id first: aw-038.

---

## 2026-06-15 20:10 -- Modeling / Captured: agentic-workflow-040 - Main-pane document reader centers its reading column in the content area

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Non-task documents opened in the main pane (MainPaneReader, aw-027) render flush
against the left edge — the `<article>` constrains the measure (`maxWidth: 760`) but is not
centered. Center the reading column horizontally in the content area (natural fix: `margin: 0 auto`),
keeping the measure; horizontal block-centering only, not center-aligned text. Reader-owned
board-local wrapper, styleguide `Markdown` consumed unforked (ADR-0003). Filed to todo (frontend
gate design-system-001 satisfied; small, unambiguous bug).

---

## 2026-06-15 20:08 -- Task verified and completed: agentic-workflow-037 - Confetti launches from the page center and shoots up toward the prompt-bar textarea

**Type:** Work / Task completion
**Task:** agentic-workflow-037 - Confetti launches from the page center and shoots up toward the prompt-bar textarea
**Summary:** Inverted aw-035's celebration geometry — the burst now originates at the page center `{0.5,0.5}` and shoots upward toward the prompt-bar textarea center (converging on the prompt bar). The pure helper `confettiLaunchFromRect` was replaced by the mirror `confettiLaunchToRect(rect, viewport) → { origin:{x:0.5,y:0.5}, angle }`; `board.js` keeps the live fire-time rect/viewport read and the missing-ref fallback.
**Verification:** PASS (iteration 1) — dashboard suite 346/346 green (1 new below-center degenerate test); verifier confirmed all 9 acceptance criteria, `confetti-palette.js` untouched, reduced-motion never-invoke path intact, dist genuinely rebuilt to the new geometry, styleguide consumed unforked.
**Commit:** 87e8991
**Files changed:** 6 (confetti-launch.js, board.js, confetti-launch.test.mjs, board-prompt-bar.test.mjs, dist/app.js, aw README) + task file move
**Tests added:** net +1 (confetti-launch.test.mjs rewritten to the new contract + a below-center degenerate case); suite 345 → 346
**ADRs written:** none (origin/aim is the iteration target ADR-0020 already frames; no genuine new decision)

---

## 2026-06-15 20:05 -- Modeling / Refined: design-system-009 - Drawer header — drop Copy, rename "Open in editor" → "Open in full screen", expose a callback

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** todo (promoted)
**Summary:** Grounded the task against the real source (`.agentheim/contexts/design-system/styleguide/app/drawer.js`) — confirmed both `HeaderMinimal` and `HeaderContextual` carry the two dead, onClick-less buttons. Surfaced two things the capture missed: (1) `HeaderMinimal`'s vertical divider before Close would **dangle** once Copy is gone and "Open in full screen" may be absent — added an AC to render it only when an action precedes it; (2) tightened the canvas-demo AC from "either/or" to **must supply a handler so the button is visibly rendered**, since this task reopens the gate and the builder must see the new action to approve it. Settled the callback signature to a bare `onOpenFullScreen()` (consumer owns the task). Promoted to todo — only dep (design-system-001) is done; gate re-review happens after implementation (ds-005/007 precedent). Downstream aw-039 still waits on it.
**Split into:** none
**ADRs written:** none

---

## 2026-06-15 19:50 -- Batch started: [agentic-workflow-037]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-037 - Confetti launches from the page center and shoots up toward the prompt-bar textarea
**Parallel:** no (1 worker — serialized vs the two other ready tasks: aw-038 shares `board.js` / `dist/app.js` / `board-prompt-bar.test.mjs` / aw README with aw-037 (hard file conflict, demoted to next wave); infra-019 edits disjoint files but invokes the same shared `dashboard/` `node --test` suite, the documented flake race the prior two sessions serialized around)

---

## 2026-06-15 19:25 -- Modeling / Captured: design-system-009 + agentic-workflow-039 - Slide-over "Open in full screen"

**Type:** Modeling / Capture
**BC:** design-system + agentic-workflow
**Filed to:** backlog (both)
**Summary:** The task slide-over has two dead header buttons (Copy path, Open in editor). Drop Copy
and turn "Open in editor" into "Open in full screen", which renders the task in the main content
pane (the MainPaneReader surface where ADRs/docs render, aw-027). Split across two BCs because the
buttons live in the styleguide `Drawer` (consumed unforked): **design-system-009** changes the
`Drawer` header (drop Copy, rename, expose an `onOpenFullScreen` callback; reopens the gate) and
**agentic-workflow-039** wires that callback to the main pane (an explicit per-action override of
the ADR-0021 open-intent split). aw-039 depends on ds-009. (Renumbered 037→039 around a concurrent
modeling session consuming those ids.)

---

## 2026-06-15 19:10 -- Modeling / Refined: infrastructure-019 - Dashboard origin sticks to its last-good port so an intermittent collision can't flap it

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo (promoted)
**Summary:** Cornered a load-bearing contradiction in the task's premise. The original Why claimed a collision-driven move "persists on every relaunch even after the colliding process is gone" — but infra-018's `listenOnLadder` already tries the derived port first, so the shipped code *already* snaps back to the derived port when a collision clears. The real open gap is **flapping** under an *intermittent* collision (origin bounces derived ↔ ladder-rung launch-to-launch, resetting the origin-keyed localStorage stores). The draft conflated two opposite behaviors (snap-back-to-derived, already shipped; vs last-good-sticky). User chose **last-good-sticky**. Decided the persistence mechanism: a **separate `last-port.json` marker** (over muddying `runtime.json` or a pid-less slimmed runfile) — refined further to write it at **successful-bind time** in `serve.mjs` (covers crash *and* clean-stop, leaves `inspectExisting`/`stopDashboard` unchanged), with the child reading it (no env-plumb; `serve.mjs` stays sole bind owner) and pure last-good→derived→ladder ordering in `port.mjs`. Renamed the file/title to match the corrected framing; rewrote Why/What/ACs. Promoted (only dep infra-018 is done; backend-only, no styleguide gate).
**Split into:** none
**ADRs written:** none (worker to add a dated ADR-0002 addendum when the port-selection contract changes from derived-first to last-good-first)

---

## 2026-06-15 19:45 -- Modeling / Captured: agentic-workflow-038 - Board prompt bar — single-line auto-growing input replaces the multi-line textarea

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Swap the board prompt-bar `<textarea>` (aw-023) for a control that renders multi-line but holds a single logical line: text wraps + the field auto-grows to fit, but the value never contains a newline (Enter is swallowed, no launch; multi-line paste collapses to one line). Buttons + confetti consume it unchanged (aw-035/aw-037 rect contract preserved). Board-local token-matched control, styleguide consumed unforked (ADR-0003). Captured aw-037 first taken by a concurrent confetti capture, so this is aw-038. Filed to todo (frontend gate design-system-001 satisfied).

---

## 2026-06-15 19:30 -- Modeling / Captured: agentic-workflow-037 - Confetti launches from the page center and shoots up toward the prompt-bar textarea

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Inverse of aw-035's celebration geometry — the burst now starts at the page center `{0.5,0.5}` and aims upward at the prompt-bar textarea center (converging on the prompt bar), instead of originating at the textarea and aiming at the viewport center. Same pure helper (`confetti-launch.js`), same triggers / palette / reduced-motion / ownership. Filed to todo (frontend gate design-system-001 satisfied).

---

## 2026-06-15 18:51 -- Work session ended

**Type:** Work / Session end
**Completed:** 3 (first-try PASS: 3, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 3 (aw-035 b688673, aw-036 1cfbccf, infra-018 398dee2)
**ADRs:** 0 new; 1 in-place amendment (ADR-0002 deterministic-port addendum [infra-018])
**Note:** Started with 1 ready task (aw-035). Parallel `modeling` sessions promoted aw-036 (Research button) and infra-018 (deterministic port) to todo mid-run — both picked up as they became ready. Despite two ready tasks at once, the batch was serialized one-at-a-time: aw-036 and infra-018 edit disjoint source files but both invoke the shared `dashboard/` `node --test` suite (a worker running the full suite mid-edit of another's file would flake), the same race the prior session documented. Every worker passed verification first try. Remaining in backlog (need a `modeling` promote before `work` can claim): aw-031 (next-steps overview) and infra-019 (port last-good self-heal — the deferred infra-018 follow-up).

---

## 2026-06-15 18:50 -- Task verified and completed: infrastructure-018 - Dashboard binds a deterministic project-root port so the origin survives relaunch

**Type:** Work / Task completion
**Task:** infrastructure-018 - Dashboard binds a deterministic project-root port so the origin survives relaunch
**Summary:** The dashboard now binds a deterministic project-root-derived port (sha256 of the absolute root folded into window 41000–42023) with a bounded fallback ladder of 8 wrapping in-band on EADDRINUSE, replacing ADR-0002's ephemeral `:0`. The browser origin is now stable across stop+relaunch, so the three origin-keyed `localStorage` stores (theme aw-017, board view-state ADR-0015, skip-permissions aw-021) survive relaunch. Pure derivation in new `dashboard/port.mjs`; `serve.mjs` consumes it; ADR-0002 amended in place.
**Verification:** PASS (iteration 1) — dashboard suite 345/345 green (14 new port tests); verifier confirmed all 8 acceptance criteria, launcher reuse path (`launch.mjs` / `inspectExisting`) untouched, `127.0.0.1`-only preserved, no frontend touched, ADR-0002 addendum purely additive (reverses only the ephemeral-port clause).
**Commit:** 398dee2
**Files changed:** 5 (port.mjs [new], serve.mjs, port.test.mjs [new], ADR-0002 [amended], infrastructure README) + task file move
**Tests added:** 14 (dashboard/test/port.test.mjs — derivation determinism, cross-root distinctness, in-band + wrap, ladder walk on EADDRINUSE, whole-ladder-exhausted clear error, non-EADDRINUSE re-throw); suite 331 → 345
**ADRs written:** ADR-0002 amended in place (dated addendum, infrastructure-018 — deterministic port; bidirectional backlink added: ADR-0002 ↔ infrastructure-018). Self-heal / last-good-port retry deferred to infrastructure-019 (backlog).

---

## 2026-06-15 18:43 -- Batch started: [infrastructure-018]

**Type:** Work / Batch start
**Tasks:** infrastructure-018 - Dashboard binds a deterministic project-root port so the origin survives relaunch
**Parallel:** no (1 worker — last ready task; server-side `decision` touching `serve.mjs` + new `port.mjs` + ADR-0002 amendment, disjoint from the just-shipped aw frontend work)

---

## 2026-06-15 18:42 -- Task verified and completed: agentic-workflow-036 - Board prompt bar — Research launch button next to Quick Capture / Modeling

**Type:** Work / Task completion
**Task:** agentic-workflow-036 - Board prompt bar — Research launch button next to Quick Capture / Modeling
**Summary:** The board prompt bar gains a third **Research** launch button beside Quick Capture / Modeling — it seeds `/agentheim:research <prompt>` from the live textarea via a new pure `researchCommandFor` builder (+ `RESEARCH_COMMAND`), reusing the bridge→clipboard launch path (`launchOrCopy`/`LaunchButton`) unchanged and sharing the prompt-bar's clear+confetti `onResult`. Only the command string is new.
**Verification:** PASS (iteration 1) — dashboard suite 331/331 green; verifier confirmed all 9 acceptance criteria, styleguide + `bridge-launch.js` + server/API untouched, builder pure + unit-tested (bare/append/trim/whitespace/non-string), board stays a read-only projection.
**Commit:** 1cfbccf
**Files changed:** 5 (modeling-command.js, board.js, modeling-command.test.mjs, board-prompt-bar.test.mjs, dist/app.js, aw README) + task file move
**Tests added:** 12 (modeling-command.test.mjs: +8 researchCommandFor/RESEARCH_COMMAND cases; board-prompt-bar.test.mjs: +4 render/seed/thread/import guards); suite 319 → 331
**ADRs written:** none (straight extension of aw-023's prompt-bar builder pattern; ADR-0018/0003/0009/0001 reused)

---

## 2026-06-15 18:35 -- Batch started: [agentic-workflow-036]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-036 - Board prompt bar — Research launch button next to Quick Capture / Modeling
**Parallel:** no (1 worker — serialized vs the ready infrastructure-018: disjoint source files but both invoke the shared dashboard `node --test` suite, the same race the prior session documented; aw-036 first, infra-018 next)

---

## 2026-06-15 18:33 -- Task verified and completed: agentic-workflow-035 - Confetti bursts from the prompt-bar textarea center, aimed at the viewport center

**Type:** Work / Task completion
**Task:** agentic-workflow-035 - Confetti bursts from the prompt-bar textarea center, aimed at the viewport center
**Summary:** The board celebration burst now originates at the prompt-bar textarea's center and aims at the viewport center; origin + angle are computed at fire time from the textarea's live `getBoundingClientRect()` (new pure `confettiLaunchFromRect(rect, viewport)` helper, mirroring `confetti-palette.js`), replacing aw-034's hardcoded `{x:0.18,y:0.92}`/`angle:75`. Triggers, palette, reduced-motion silence, and board-local ownership unchanged.
**Verification:** PASS (iteration 1) — dashboard suite 319/319 green; verifier confirmed all 9 acceptance criteria, styleguide + `confetti-palette.js` untouched, reduced-motion never-invoke path intact, pure-helper unit-tested (center normalization + aim angles).
**Commit:** b688673
**Files changed:** 6 (board.js, confetti-launch.js [new], confetti-launch.test.mjs [new], board-prompt-bar.test.mjs, dist/app.js, aw README) + task file move
**Tests added:** 6 (confetti-launch.test.mjs: 5 geometry cases; board-prompt-bar.test.mjs: +1 fire-time/ref-plumbing guard); suite 313 → 319
**ADRs written:** none (origin/aim becoming dynamic is already framed by ADR-0020; no amendment needed)

---

## 2026-06-15 18:32 -- Modeling / Refined: infrastructure-018 - Dashboard binds a deterministic project-root port so the origin survives relaunch

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo (promoted)
**Summary:** Grounded the task in the real code path and cornered two ambiguities. (1) The last-good-port retry was both called "deferrable" and baked into 3 ACs + an `inspectExisting` change — and it has an architectural wrinkle: `inspectExisting` deletes the stale runfile *before* the detached child (`serve.mjs`, where the bind lives) spawns. Resolved by deferring it: v1 ships only the load-bearing contract (deterministic root-derived port + bounded ladder). (2) Pinned the unpinned derivation: window **41000–42023** (`41000 + hash(root) mod 1024`), bounded ladder of **8** wrapping in-band — clear of privileged / ephemeral / bridge (31425–27) / common dev ports. Rewrote the ADR-0002 addendum to match. Promoted to todo (the open decisions are now anchored by the user).
**Split into:** infrastructure-019 (last-good-port self-heal; backlog, depends_on infrastructure-018)
**ADRs written:** none (ADR-0002 addendum drafted in the task body for the worker to paste)

---

## 2026-06-15 18:30 -- Modeling / Captured: agentic-workflow-036 - Board prompt bar — Research launch button next to Quick Capture / Modeling

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Add a third launch button (**Research**) to the board prompt bar beside Quick Capture / Modeling, with identical behaviour — seed `/agentheim:research <prompt>` from the trimmed textarea (bare command when empty), reuse `launchOrCopy`/`LaunchButton` and the bridge→clipboard fallback unchanged (ADR-0018), thread `skipPermissions` (aw-021), and share the prompt bar's clear-textarea + confetti `onResult`. Pure builder `RESEARCH_COMMAND` + `researchCommandFor(prompt)` in `modeling-command.js` mirroring aw-023's builders. Filed straight to todo — small, unambiguous extension of aw-023's pattern; styleguide gate satisfied.

---

## 2026-06-15 18:20 -- Batch started: [agentic-workflow-035]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-035 - Confetti bursts from the prompt-bar textarea center, aimed at the viewport center
**Parallel:** no (1 worker — only ready task; edits board.js confetti origin/aim + extracts a pure helper, rebuilds shared dist)

---

## 2026-06-15 18:05 -- Modeling / Captured: infrastructure-018 - Dashboard binds a deterministic project-root port so the origin survives relaunch

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** backlog
**Summary:** User reported the skip-permissions toggle isn't remembered across dashboard launches. Root cause: the toggle (aw-021) already persists to browser `localStorage`, but `serve.mjs` binds an ephemeral port (`listen(0)`), so each relaunch is a new `127.0.0.1:<port>` origin and orphans all three origin-keyed stores (skip-perms, theme aw-017, board view-state ADR-0015). Architect (via orchestrator) shaped a `decision` task: bind a deterministic project-root-derived port for a stable origin, with a bounded EADDRINUSE ladder + last-good-port retry, amending only ADR-0002's ephemeral-port clause (addendum drafted in the task body). Server-side persistence rejected (less coverage, more code). Held in backlog for the user to read the decision before promotion.

---

## 2026-06-15 17:55 -- Modeling / Captured: agentic-workflow-035 - Confetti bursts from the prompt-bar textarea center, aimed at the viewport center

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Next aw-025 replay-loop iteration on aw-034 — make the celebration's origin + aim dynamic: fire from the prompt-bar textarea's live-rect center (not hardcoded `{0.18,0.92}`) and aim the launch angle at the viewport center `{0.5,0.5}` (not fixed 75°). Triggers/palette/reduced-motion/ownership unchanged. Filed straight to todo (small, unambiguous; styleguide gate satisfied).

---

## 2026-06-15 17:40 -- Work session ended

**Type:** Work / Session end
**Completed:** 8 (first-try PASS: 8, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 8 (aw-025 8694491, aw-029 39447ec, aw-028 77e9c41, aw-030 7e7e191, aw-032 74f23cf, aw-033 4e6f537, aw-034 bb953cd, ds-008 44476fc)
**ADRs:** 0 new; 2 in-place amendments (ADR-0019 dot-only cue [aw-030], ADR-0020 canvas-confetti [aw-034])
**Note:** Started with 4 ready tasks; parallel modeling/research sessions promoted aw-032/033/034 (and captured aw-031, still backlog) mid-run — all picked up as they became ready. Despite MAX_PARALLEL=3 the whole run was serialized one-task-per-batch: every task rebuilt the shared `dashboard/dist/app.js` bundle and most edited `board.js`, so parallel workers would have raced the bundle and the shared `node --test` tree. Every worker passed verification first try. Remaining: aw-031 (next-steps overview) in backlog — needs a `modeling` promote before `work` can claim it.

---

## 2026-06-15 17:38 -- Task verified and completed: design-system-008 - TicketCard hover — stronger shadow, no upward content lift

**Type:** Work / Task completion
**Task:** design-system-008 - TicketCard hover — stronger shadow, no upward content lift
**Summary:** Styleguide TicketCard hover now deepens the shadow one step (--shadow-sm → --shadow-md) and drops the translateY(-1px) lift (and its transition entry), so the card reads as raised without content jumping. Selected + idle states unchanged. Made in the styleguide source (no fork, ADR-0003); dashboard consumes it unforked and its dist was rebuilt.
**Verification:** PASS (iteration 1) — dashboard suite 313/313 green (orchestrator re-confirmed after an inconsistent verifier note); verifier confirmed all 4 acceptance criteria, no styleguide token changed, no dashboard/app source edited (only the rebuilt dist), pulse/cornerAction/estimate-chip undisturbed.
**Commit:** 44476fc
**Files changed:** 4 (kanban.js, ticket-card.test.mjs [new], design-system README, dist/app.js) + task file move
**Tests added:** 8 (styleguide/test/ticket-card.test.mjs — --shadow-md hover, no transform, selected-shadow unchanged)
**ADRs written:** none (extends ADR-0003 unforked consumption)

---

## 2026-06-15 17:35 -- Research: detecting a live Work session

**Type:** Research
**Requested by:** user
**Report:** knowledge/research/work-session-presence-lock-2026-06-15.md
**Review:** PASS (iteration 1)
**Summary:**
- `doing/` is NOT a liveness signal (the work skill's own Phase 1 recovery treats a doing/ task as a possibly-interrupted session). A clean SessionStart-writes / SessionEnd-removes bracket is NOT achievable: no hook exposes the Claude PID, and SessionEnd is unreliable (does not fire on `/exit` per issue #17885, no crash/SIGKILL guarantee).
- Robust deterministic design: a skill-frontmatter `Stop` hook in the work SKILL.md creates a lock on first fire and bumps a `lastHeartbeat` timestamp every turn; the read-only dashboard treats the lock as live within a staleness window — mirroring the existing runtime.json/bridge.json pid-liveness reaping, with the timestamp window standing in for `process.kill(pid,0)`.
- Scoping to WORK sessions only requires skill-frontmatter hooks (settings.json hooks have no skill/command matcher and fire for every claude session). `${CLAUDE_PROJECT_DIR}` is available so the hook can write into `.agentheim/.dashboard/`.

---

## 2026-06-15 17:14 -- Batch started: [design-system-008]

**Type:** Work / Batch start
**Tasks:** design-system-008 - TicketCard hover — stronger shadow, no upward content lift
**Parallel:** no (1 worker — edits styleguide/app/kanban.js TicketCard hover + rebuilds the consumer dashboard/dist; last ready task)

---

## 2026-06-15 17:12 -- Task verified and completed: agentic-workflow-034 - Fire the celebration with canvas-confetti instead of the CSS-keyframe burst

**Type:** Work / Task completion
**Task:** agentic-workflow-034 - Fire the celebration with canvas-confetti instead of the CSS-keyframe burst
**Summary:** Replaced the CSS-keyframe burst with canvas-confetti — a full-viewport burst from an origin near the prompt-bar buttons, palette = the four status bases resolved at fire time (new confetti-palette.js) so it tracks the active theme. Trigger wiring unchanged; reduced-motion stays silent. canvas-confetti bundled into dist (no CDN) — the dashboard's first bundled frontend runtime dependency.
**Verification:** PASS (iteration 1) — dashboard suite 313/313 green; verifier confirmed all 9 acceptance criteria, canvas-confetti installed + bundled into dist (no CDN), styleguide untouched, reserved tokens excluded + resolver tested, reduced-motion no-call path guarded + tested, old CSS-keyframe tests updated (not gutted), trigger wiring + aw-025 TEMP block intact.
**Commit:** bb953cd
**Files changed:** 9 (board.js, confetti-palette.js [new], confetti-palette.test.mjs [new], board-prompt-bar.test.mjs, package.json, package-lock.json, dist/app.js, ADR-0020 [amended], aw README) + task file move
**Tests added:** confetti-palette.test.mjs (resolver + reserved-token exclusion + theme-tracking) + reduced-motion no-call guard; suite 305 → 313
**ADRs written:** none — ADR-0020 amended in-place (canvas-confetti as first bundled frontend runtime dep, CSS→canvas swap, full-window footprint = ownership not pixels, four-status theme-aware palette; ADR-0014 reduced-motion silence still binds); bidirectional related_tasks link added (aw-034 ↔ ADR-0020)

---

## 2026-06-15 17:10 -- Research: knowing when the Work terminal is finished

**Type:** Research
**Requested by:** user
**Report:** knowledge/research/work-terminal-completion-signal-2026-06-15.md
**Review:** PASS (iteration 1)
**Summary:**
- The only deterministic on-disk signal the read-only dashboard can observe is a pre-configured Claude Code hook running a shell command to write/touch a file (FS-watch + SSE then picks it up); there is no runtime/in-prompt way for a skill to register a hook.
- Stop fires at the end of every assistant turn (session stays alive); SessionEnd fires once when the CLI process exits — "user closed the session," not "work done." VS Code onDidCloseTerminal / shell-execution-end can't distinguish turn-completion from REPL exit and are in-process, not on-disk.
- Headless `claude -p` exits cleanly when done (a natural process-exit signal) but loses the visible interactive terminal.

---

## 2026-06-15 16:45 -- Batch started: [agentic-workflow-034]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-034 - Fire the celebration with canvas-confetti instead of the CSS-keyframe burst
**Parallel:** no (1 worker — adds canvas-confetti as a bundled dep, rewrites BoardConfetti in board.js, amends ADR-0020, rebuilds dist; serialized against ds-008 [shared dist])

---

## 2026-06-15 16:42 -- Task verified and completed: agentic-workflow-033 - Work button follows the active theme instead of the inverse light/dark treatment

**Type:** Work / Task completion
**Task:** agentic-workflow-033 - Work button follows the active theme instead of the inverse light/dark treatment
**Summary:** Switched the topbar Work launch from emphasis="inverse" (opposite-scheme) to emphasis="primary" so it follows the active theme (dark text on light fill in light mode, light fill on dark in dark mode). Launch wiring unchanged (bare WORK_COMMAND, skipPermissions, no onResult, read-only).
**Verification:** PASS (iteration 1) — dashboard suite 305/305 green; verifier confirmed all 7 acceptance criteria, only the topbar Work button touched, styleguide unforked (primary is a pre-existing variant, no new token), Stop/toggles/armed-cue/hover undisturbed, dist rebuilt.
**Commit:** 4e6f537
**Files changed:** 3 (board.js, shell-relayout.test.mjs, dist/app.js) + aw README + task file move
**Tests added:** 0 net (updated 2 shell-relayout assertions from inverse → theme-following); suite stayed green
**ADRs written:** none (composes ADR-0009/0003 unchanged; emphasis swap, no decision)

---

## 2026-06-15 16:40 -- Modeling / Refined: agentic-workflow-034 - Fire the celebration with canvas-confetti instead of the CSS-keyframe burst

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (promoted — frontend gate design-system-001 is done/approved)
**Summary:** Cornered the three open items. **Canvas scope:** full-window default `confetti()` with origin near the prompt bar (over a board-local scoped canvas). **Palette:** the four status bases (`--st-done/--st-todo/--st-doing/--st-backlog`), dropping `--fg-3`, adding the `--st-doing` amber. **Token resolution:** at fire time via `getComputedStyle` so the burst tracks the active theme. **Delivery:** canvas-confetti as a `dashboard/package.json` devDependency esbuild folds into `dist/app.js`. **ADR:** amend ADR-0020 in place (aw-021/aw-030 precedent). ACs sharpened to testable form; tuning (count/spread/velocity/origin) left to the aw-025 replay loop.
**Split into:** none
**ADRs written:** none yet (ADR-0020 amendment is written by the worker)

---

## 2026-06-15 16:14 -- Batch started: [agentic-workflow-033]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-033 - Work button follows the active theme instead of the inverse light/dark treatment
**Parallel:** no (1 worker — edits board.js BoardTopbar Work button + rebuilds dist; serialized against ds-008 [shared dist])

---

## 2026-06-15 16:12 -- Task verified and completed: agentic-workflow-032 - Dashboard launch no longer auto-opens the browser

**Type:** Work / Task completion
**Task:** agentic-workflow-032 - Dashboard launch no longer auto-opens the browser
**Summary:** Removed the auto-open from the dashboard launch path (reverses aw-011). `launch` now prints the served URL/pid/stop-hint and returns — the builder opens the URL themselves. The openBrowser/browserCommand OS-divergent helpers were removed entirely (no other production caller) with their tests.
**Verification:** PASS (iteration 1) — dashboard suite 305/305 green; verifier confirmed all 4 acceptance criteria, helpers fully removed (only `=== undefined` guard remains), stop/status branches + statusDashboard untouched, no frontend bundle touched (server-launcher only, no dist).
**Commit:** 74f23cf
**Files changed:** 4 (launch.mjs, status-open.test.mjs, dashboard/README.md, aw README) + task file move
**Tests added:** net −2 (dropped 3 auto-open helper tests, added 1 helpers-gone guard); suite stayed green
**ADRs written:** none (server-launch chore, no decision)

---

## 2026-06-15 16:10 -- Modeling / Captured: agentic-workflow-034 - Fire the celebration with canvas-confetti instead of the CSS-keyframe burst

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Replace the board's hand-rolled CSS-keyframe confetti (BoardConfetti / ensureConfettiStyle, ADR-0020) with the canvas-confetti library, fired from the same triggers (prompt-bar success + aw-025 replay button). Builder chose a brand-derived but livelier palette and vendor+bundle delivery (offline dashboard, no CDN). Amends ADR-0020 (reverses CSS-only/dependency-free), keeps ADR-0014 reduced-motion silence and ADR-0016/ADR-0003 color + unforked discipline; first bundled frontend runtime dep, so an ADR is in scope.

---

## 2026-06-15 15:52 -- Batch started: [agentic-workflow-032]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-032 - Dashboard launch no longer auto-opens the browser
**Parallel:** no (1 worker — edits dashboard/launch.mjs only [no board.js, no dist rebuild]; serialized against aw-033/ds-008 to avoid shared working-tree node --test cross-talk)

---

## 2026-06-15 15:50 -- Task verified and completed: agentic-workflow-030 - Board buttons — hover shadow + background highlight; armed launch cue keeps only the dot

**Type:** Work / Task completion
**Task:** agentic-workflow-030 - Board buttons — hover shadow + background highlight; armed launch cue keeps only the dot (no red border/text)
**Summary:** LaunchButton now raises on hover (--shadow-md + --surface-2 background, no transform/content shift); the armed skip-permissions per-launch cue is narrowed to the --obligation dot alone (armed buttons drop the button-wide red border + label tint, read identical to unarmed); the SkipPermissionsToggle keeps the full danger treatment. Launch payload unchanged.
**Verification:** PASS (iteration 1) — dashboard suite 307/307 green (8 new hover/dot guards); verifier confirmed all 6 acceptance criteria, styleguide + bridge-launch.js untouched, toggle treatment intact, dot retained, dist rebuilt.
**Commit:** 7e7e191
**Files changed:** 5 (board.js, launch-button-hover.test.mjs [new], ADR-0019 [amended], dist/app.js, aw README) + task file move
**Tests added:** 8 (launch-button-hover.test.mjs); suite 299 → 307
**ADRs written:** none — ADR-0019 amended in-file (per-launch cue narrowed to dot-only; narrowing not reversal, dot still satisfies amended ADR-0018 mandate); bidirectional related_tasks ↔ related_adrs link added (aw-030 ↔ ADR-0019)

---

## 2026-06-15 15:42 -- Batch started: [agentic-workflow-030]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-030 - Board buttons — hover shadow + background highlight; armed launch cue keeps only the dot
**Parallel:** no (1 worker — edits board.js LaunchButton + amends ADR-0019 + rebuilds dist; serialized against aw-033/ds-008 [shared board.js/dist] and aw-032 [shared-tree test suite])

---

## 2026-06-15 15:40 -- Task verified and completed: agentic-workflow-028 - Add a button to stop the dashboard from the dashboard

**Type:** Work / Task completion
**Task:** agentic-workflow-028 - Add a button to stop the dashboard from the dashboard
**Summary:** Added a quiet Stop dashboard launch at the far-left of the main-column topbar, set apart from the [theme][skip-perms][Work] cluster. Reuses the existing launchOrCopy bridge path (no new server endpoint) to run the new bare STOP_DASHBOARD_COMMAND ('/agentheim:dashboard stop'); a bridge dispatch flips a shell-level full-pane "Dashboard stopped — safe to close this tab" overlay, a clipboard fallback shows none.
**Verification:** PASS (iteration 1) — dashboard suite 299/299 green on re-run (the lone events.test.mjs hit was the pre-existing SSE-watcher flake, passed on re-run). Verifier confirmed all 9 acceptance criteria, server.mjs unmodified/read-only (ADR-0017), bridge-launch.js + LaunchButton definition + styleguide untouched (emphasis="quiet" is a pre-existing variant — no collision with aw-030), overlay mounts only on res.via==="bridge", dist rebuilt.
**Commit:** 77e9c41
**Files changed:** 6 (modeling-command.js, board.js, modeling-command.test.mjs, stop-dashboard.test.mjs [new], dist/app.js, aw README) + task file move
**Tests added:** 11 (9 board static guards in stop-dashboard.test.mjs + 2 STOP_DASHBOARD_COMMAND constant cases); suite 288 → 299
**ADRs written:** none (bridge-reuse adds no mutating endpoint, reopens no doctrine — the seam decision was recorded in the task, option B over a self-stop endpoint)

---

## 2026-06-15 15:30 -- Modeling / Captured: agentic-workflow-033 - Work button follows the active theme instead of the inverse light/dark treatment

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** The topbar Work launch uses `emphasis="inverse"` (aw-026), so it always reads as the opposite theme to the page. Builder wants it to follow the active scheme (light fill/dark text in light mode, dark fill/light text in dark mode) — likely switching to the existing `emphasis="primary"` variant. Frontend gate (design-system-001) satisfied.

---

## 2026-06-15 15:25 -- Batch started: [agentic-workflow-028]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-028 - Add a button to stop the dashboard from the dashboard
**Parallel:** no (1 worker — aw-028 edits board.js + modeling-command.js + rebuilds dist; serialized against aw-030/ds-008 which share board.js/dist, and against aw-032 to avoid shared-tree test cross-talk). Unblocked by aw-029 (its topbar dep) completing.

---

## 2026-06-15 15:20 -- Task verified and completed: agentic-workflow-029 - Move the theme + skip-permissions toggles to the topbar, left of the Work button

**Type:** Work / Task completion
**Task:** agentic-workflow-029 - Move the theme + skip-permissions toggles to the topbar, left of the Work button
**Summary:** Relocated the theme + skip-permissions armed toggles out of the ShellRail footer into the main-column BoardTopbar, left of the inverse Work launch (order: theme, skip-permissions, Work); the now-empty rail footer dropped. Pure presentation relayout — controls stay unforked (ADR-0003), persistence + armed/danger treatment unchanged.
**Verification:** PASS (iteration 1) — dashboard suite 288/288 green; verifier confirmed all 8 acceptance criteria, styleguide untouched, launch path / theme-state / skip-permissions-state unchanged, LaunchButton left untouched for aw-030, dist rebuilt.
**Commit:** 39447ec
**Files changed:** 4 (board.js, shell-relayout.test.mjs, dist/app.js, aw README) + task file move
**Tests added:** net +1 guard (replaced footer-placement test with rail-no-longer-renders + topbar-order assertions); suite 287 → 288
**ADRs written:** none (pure presentation relayout composing settled ADRs 0009/0003/0019/0018)

---

## 2026-06-15 15:05 -- Modeling / Captured: agentic-workflow-032 - Dashboard launch no longer auto-opens the browser

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** The dashboard `launch` should stop hijacking the default browser. Builder confirmed scope: **remove the auto-open entirely** (the `openBrowser(url)` call + "Opening it in your default browser…" line in `dashboard/launch.mjs`), not an opt-in `--open` flag — `launch` will just print the URL for the builder to open. Reverses the auto-open from aw-011 (recorded as prior_art). Server-launch UX only, not UI, so no styleguide gate; no ADR expected. Concrete enough to file straight to todo.

---

## 2026-06-15 15:08 -- Batch started: [agentic-workflow-029]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-029 - Move the theme + skip-permissions toggles to the topbar, left of the Work button
**Parallel:** no (1 worker — serialized: aw-029/030 both edit board.js and all remaining ready tasks rebuild the shared dashboard/dist bundle)

---

## 2026-06-15 15:05 -- Task verified and completed: agentic-workflow-025 - Add a temporary board button that fires the celebration animation

**Type:** Work / Task completion
**Task:** agentic-workflow-025 - Add a temporary board button that fires the celebration animation
**Summary:** Added a throwaway "🎉 Replay celebration" button beside Quick Capture / Modeling in BoardPromptBar that bumps the existing confettiKey to replay the board-local confetti burst on demand — reusing BoardConfetti unchanged, no launch/bridge/clipboard/textarea-clear/lifecycle-write. Confined to one removable TEMP (aw-025) block.
**Verification:** PASS (iteration 1) — dashboard suite 287/287 green (2 new static board-glue guards); verifier confirmed all 8 acceptance criteria, styleguide source untouched (ADR-0003), animation code unchanged, dist rebuilt.
**Commit:** 8694491
**Files changed:** 3 (board.js, board-prompt-bar.test.mjs, dist/app.js) + task file move
**Tests added:** 2 (TEMP-block existence + confettiKey-bump-only guards); suite 285 → 287
**ADRs written:** none (replays ADR-0020's confetti, reopens no doctrine)

---

## 2026-06-15 15:00 -- Batch started: [agentic-workflow-025]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-025 - Add a temporary board button that fires the celebration animation
**Parallel:** no (1 worker — aw-025/029/030/ds-008 all rebuild the shared dashboard/dist bundle and the three aw-tasks all edit board.js, so the ready set is serialized one task per batch)

---

## 2026-06-15 14:45 -- Modeling / Refined + Promoted: agentic-workflow-025 - Add a temporary board button that fires the celebration animation

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (promoted backlog → todo)
**Summary:** Turned the quick-capture stub into a ready task. Builder confirmed "celebration animation" = the board-local confetti burst (`BoardConfetti`/`ensureConfettiStyle`, ADR-0020, introduced by aw-023) — the only celebration motion in the codebase — and chose the **prompt-bar placement** (a temp button beside Quick Capture / Modeling, exactly where the confetti already renders) over a topbar or floating button, since it reuses `BoardConfetti` with **zero re-homing**. Refinement is mechanical: the temp button is a second, unconditional caller of the existing `setConfettiKey((k)=>k+1)` that already drives the burst — **no** launch / bridge / clipboard / textarea-clear / lifecycle write (ADR-0001). Animation code (keyframes, palette tokens, reduced-motion guard) is reused **unchanged**; under `prefers-reduced-motion` the button fires nothing (ADR-0014 strip-to-plain), accepted. Board-local token-matched control consumed unforked (ADR-0003) — **no** design-system child task. **No ADR** (replays ADR-0020's confetti, reopens no doctrine). Confined to a single clearly-commented temp block for trivial later removal. Frontend gate dep `design-system-001` is done → promoted. Backlinks: related_adrs [ADR-0020, ADR-0014, ADR-0003], prior_art [agentic-workflow-023].
**Split into:** none
**ADRs written:** none

---

## 2026-06-15 14:45 -- Capture / Captured: agentic-workflow-031 - Next-steps overview when work is done

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** When work is done, surface a clear overview of the next sensible steps — via a new agent/skill or an analysis of the worker conversation; design the process.

---

## 2026-06-15 14:30 -- Modeling / Refined + Promoted: agentic-workflow-028 - Add a button to stop the dashboard from the dashboard

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (promoted backlog → todo)
**Summary:** Turned the quick-capture stub into a ready task. Resolved the seam the capture flagged: of (A) a new self-stop server endpoint vs (B) reusing the bridge launch to run `/dashboard stop`, the builder chose **B** — keeps `server.mjs` purely read-only (no first mutating endpoint, ADR-0017 untouched), reuses `launchOrCopy`/`LaunchButton` unchanged, and needs **no ADR** (a launch is an external side-effect under ADR-0001/0018, not a lifecycle write). New bare constant `STOP_DASHBOARD_COMMAND = '/agentheim:dashboard stop'` in `modeling-command.js` (fully-qualified per aw-016). Post-stop UX (builder: **"Stopped" overlay**) keys off `launchOrCopy`'s return: `via:'bridge'` → optimistic full-pane "Dashboard stopped — safe to close this tab" overlay; `via:'clipboard'` → no overlay, just the "Copied" flash (accepted bridge-present/absent asymmetry). **No confirmation** (builder). Overlay/button are board-local token-matched (no full-screen modal primitive exists; styleguide unforked, ADR-0003). Added `depends_on: [design-system-001, agentic-workflow-029]` — aw-029 reshuffles the same topbar region of board.js, so serialize. Styleguide gate (design-system-001) done → promoted.
**Split into:** none
**ADRs written:** none (the chosen bridge-reuse seam reopens no doctrine)

---

## 2026-06-15 14:35 -- Modeling / Refined: agentic-workflow-030 - keep the red dot

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Builder narrowed the skip-permissions change: **keep the red indicator dot** on armed launch buttons; only strip the button-wide red (the `--obligation` border + label color). The per-launch cue therefore stays (dot-only), so this is no longer an ADR-0018 reversal — just a narrowing of ADR-0019's treatment from "border + dot" to "dot only," recorded as an ADR-0019 amendment note rather than a superseding ADR. Title + acceptance criteria updated accordingly.

---

## 2026-06-15 14:30 -- Modeling / Captured: hover polish + skip-permissions cue (2 tasks, 2 BCs)

**Type:** Modeling / Capture
**BC:** design-system + agentic-workflow
**Filed to:** todo (both)
**Summary:** One hover-polish + danger-color request split across two BCs by where the code lives.
**design-system-008** (refactor): `TicketCard` hover gets a stronger shadow (`--shadow-sm` → `--shadow-md`) and drops the `translateY(-1px)` lift so content stops jumping — a styleguide primitive change (card consumed unforked, ADR-0003).
**agentic-workflow-030** (feature): board `LaunchButton` hover gains a stronger shadow + background-color highlight (no content shift), and the armed per-launch `--obligation` cue (red border / dot / label on all four launch buttons) is **removed** — the danger hue stays only on the skip-permissions toggle. This **reverses** the amended ADR-0018 per-launch-cue mandate + ADR-0019; the worker writes a superseding ADR folded into the commit. Both frontend; styleguide gate (design-system-001) done → filed straight to todo.

---

## 2026-06-15 14:10 -- Modeling / Captured: agentic-workflow-029 - Move the theme + skip-permissions toggles to the topbar, left of the Work button

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Partial reversal of aw-026's footer placement — move the theme (brightness) toggle and the skip-permissions armed toggle out of the rail footer into the main-column topbar, rendered left of the inverse Work launch (order: theme, skip-permissions, Work). Pure presentation relayout; both controls stay unforked (ADR-0003) with persistence/armed-danger behaviour unchanged. Styleguide gate (design-system-001) done, so filed straight to todo.

---

## 2026-06-15 13:50 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (5210581 agentic-workflow-027)
**Note:** Single ready task (aw-027); both deps (aw-026, design-system-001) done. One worker, passed verification first try (dashboard suite 272 → 285 green). ADR-0021 written by the worker alongside the code (the folded decision), reshaping ADR-0010 (drawer now task-only) and ADR-0011 §5 (board↔library toggle retired); both reshaped ADRs and the task `related_adrs` were back-linked. After completion `todo/` is empty; `backlog/` holds aw-028 (stop-dashboard button, captured mid-run) and aw-025 (temp celebration button) — both need a `modeling` promote pass before `work` can claim them, so neither was picked up. Per the repo's bookkeeping precedent, only the task's own scoped files were committed; INDEX.md/protocol.md and pre-existing uncommitted working-tree changes were left uncommitted.

---

## 2026-06-15 14:00 -- Capture / Captured: agentic-workflow-028 - Add a button to stop the dashboard from the dashboard

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** A button on the dashboard UI that stops the dashboard.

---

## 2026-06-15 13:48 -- Task verified and completed: agentic-workflow-027 - Non-task documents render in the main content pane

**Type:** Work / Task completion
**Task:** agentic-workflow-027 - Non-task documents render in the main content pane; the slide-over becomes task-only
**Summary:** Split the dashboard's single open-intent sink into two render targets keyed on artifact kind — a board task (carries lifecycle `status`) keeps the right-hand slide-over; a non-task document (`vision|map|context|adr|research`, no `status`) renders in the main content pane via a new `MainPaneReader`. New pure `intent-route.isTaskIntent` router; `DashboardApp` now holds two mutually-exclusive selection states (`openIntent` / `selectedDoc`), the rail edge follows `selectedDoc`, and the Board RailItem returns the main pane to the board. Dead full-pane `library.js` removed; one `/api/doc` fetch, two render targets.
**Verification:** PASS (iteration 1) — dashboard suite 285/285 green (13 new tests); verifier confirmed all 8 acceptance criteria, styleguide source untouched (`Markdown` consumed unforked, ADR-0003), `library.js` cleanly removed, dist rebuilt.
**Commit:** 5210581
**Files changed:** 11 (board.js, intent-route.js [new], main-pane-reader.js [new], 2 test files [new], library.js [deleted], dist/app.js, ADR-0021 [new], ADR-0010 & ADR-0011 [reshaped], aw README) + task file move
**Tests added:** 13 (intent-route.test.mjs pure router + main-pane-reader.test.mjs static guards); suite 272 → 285
**ADRs written:** 0021 (scope agentic-workflow — open-intent split; reshapes ADR-0010 & ADR-0011 §5, bidirectionally linked)

---

## 2026-06-15 13:48 -- Batch started: [agentic-workflow-027]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-027 - Non-task documents render in the main content pane; the slide-over becomes task-only
**Parallel:** no (1 worker)

---

## 2026-06-15 -- Modeling / Refined + Promoted: agentic-workflow-027 - Non-task docs render in the main pane

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (promoted backlog → todo)
**Summary:** Grounded the already-orchestrator-decomposed task against the post-aw-026 code and verified its two load-bearing claims hold: (1) the styleguide `Markdown` primitive is independently exported (`primitives.js:129`, prop `source`) so the main-pane reader consumes it unforked with **no** design-system child task; (2) the artifact-kind discriminator already exists cleanly — a task intent carries lifecycle `status`, a non-task doc intent carries a content `type` and no `status`, so the `onOpen` split needs no new intent field. Folded into the task a **two-state selection model** note (`openIntent` task→slide-over vs a new `selectedDoc` non-task→main pane; the rail's `selectedId` must follow `selectedDoc` for AC bullet 4, and the Board `RailItem` clears it). Builder chose to **keep the ADR folded into the worker's commit** (not draft up front). Both deps (aw-026, design-system-001) done → promoted backlog → todo.
**Split into:** none
**ADRs written:** none (the open-intent-split ADR is written by the worker alongside the code, per the decision above)

---

## 2026-06-15 13:05 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (0ab1f34 agentic-workflow-026)
**Note:** Single ready task (aw-026); dependency design-system-001 satisfied (done). One worker, passed verification first try (dashboard suite 262 → 272 green). No new ADR — the left-rail relayout composes ADR-0009/0011/0017/0003/0018/0019 unchanged, and the topbar inverse button is a board-local `LaunchButton` emphasis under ADR-0003. aw-027 (non-task docs render in main pane) is now unblocked (its only dep aw-026 is done) but sits in `backlog/` — it needs a `modeling` promote pass before `work` can claim it; not picked up this session. Per the repo's bookkeeping precedent, INDEX.md/protocol.md, the task-file commit-SHA backfill, and pre-existing uncommitted working-tree changes were left uncommitted; only the task's own scoped files were committed.

---

## 2026-06-15 13:05 -- Task verified and completed: agentic-workflow-026 - Dashboard left-rail shell relayout

**Type:** Work / Task completion
**Task:** agentic-workflow-026 - Rewrite the dashboard shell to the styleguide's left-rail layout (Components in context)
**Summary:** Rewrote the live dashboard shell to the styleguide §05 "Components in context" full-height left-rail layout — `ShellRail` (brand → single Board `RailItem` → divider → "Workspace" label → live `treeToLibrary` tree → footer holding the theme + skip-permissions toggles) beside a main column whose ~52px topbar carries the inverse Work launch. The Work button moved out of the prompt bar (aw-024) into the topbar; the horizontal header and the board↔library toggle are retired. Pure consumer-side recomposition of unforked styleguide primitives (ADR-0003/0009/0011).
**Verification:** PASS (iteration 1) — dashboard suite 272/272 green; verifier confirmed all 10 acceptance criteria, no styleguide source touched, dist rebuilt to carry the relocated topbar.
**Commit:** 0ab1f34
**Files changed:** 5 (board.js, dist/app.js, shell-relayout.test.mjs [new], board-prompt-bar.test.mjs, aw README) + task file move
**Tests added:** new `shell-relayout.test.mjs` (rail composition / topbar Work / footer toggles / no-styleguide-fork guards) + updated prompt-bar tests for the removed Work button; suite 262 → 272
**ADRs written:** none — refactor composes ADR-0009/0011/0017/0003/0018/0019 unchanged; the topbar `inverse` is a board-local `LaunchButton` emphasis under ADR-0003

---

## 2026-06-15 12:55 -- Batch started: [agentic-workflow-026]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-026 - Rewrite the dashboard shell to the styleguide's left-rail layout (Components in context)
**Parallel:** no (1 worker)

---

## 2026-06-15 -- Modeling / Refined + Promoted: agentic-workflow-026 - Dashboard left-rail shell relayout

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (promoted backlog → todo)
**Summary:** Settled the four orchestrator-flagged open questions with the builder, all to the recommended option: (1) the §05 inverse topbar button **becomes** the Work launch and aw-024's prompt-bar Work button is removed/relocated there (prompt bar keeps only textarea + Quick Capture / Modeling); (2) the §05 Search box is **dropped** (read-only, no backend); (3) the theme + skip-permissions toggles move to the **rail footer**; (4) the separate Library `RailItem` is **dropped** — the always-visible Workspace tree is the library, only the Board item sits above it. Folded all four into the task's *What* / *Acceptance criteria*. Also **dropped the spurious aw-025 dependency** (a temporary, unrefined throwaway button — board.js overlap is a scheduling concern, not a hard dep); with design-system-001 (styleguide gate) already done, the task became ready and was promoted backlog → todo. No split, no ADR (the aw-027 follow-on still owns the open-intent-split ADR).
**Split into:** none
**ADRs written:** none

---

## 2026-06-15 -- Modeling / Captured: agentic-workflow-026 + agentic-workflow-027 - Dashboard left-rail shell relayout (Components in context)

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Builder asked to rewrite the dashboard's overall layout to match the styleguide §05 "Components in context" assembled shell (full left-rail), with: the library file-tree shown in the left rail, a Board re-select option at the top of that menu, the board's primary action button restyled to the §05 filled "New ticket" look, and non-task library documents rendering in the main content pane rather than the slide-over. Orchestrator (tactical-modeler) decomposed it into two dependent tasks: **aw-026** (refactor — shell relayout to left-rail + topbar over live data, absorbing the button restyle; depends_on design-system-001, aw-025) and **aw-027** (decision — split the open-intent sink so non-task docs render in the main pane and the slide-over becomes task-only; writes a BC-scoped ADR superseding/reshaping ADR-0010 & ADR-0011; depends_on aw-026). Both left under-refined in backlog with REFINE-time open questions noted (prompt-bar vs. topbar button, topbar Search, toggle homes, Library RailItem retirement). No ADR written yet — folded into aw-027's worker pass per the orchestrator's recommendation.

---

## 2026-06-15 -- Capture / Captured: agentic-workflow-025 - Add a temporary board button that fires the celebration animation

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Temporary board-view button that only replays the celebration animation, for iterating on it; to be removed later.

---

## 2026-06-15 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (b16022d agentic-workflow-024)
**Note:** Single ready task (aw-024); dependency design-system-001 satisfied (done). One worker, passed verification first try (suite 262 green). No new ADR — composes ADR-0018/0001/0003/0019 unchanged. Standing design-system follow-up unchanged: the board-local "action column beside a prompt field" is the same family as aw-023's flagged shared TextArea/prompt-input primitive — no new capture filed. Per the repo's bookkeeping precedent, INDEX.md/protocol.md and pre-existing uncommitted working-tree changes (infra-015/016/017 + aw-021/022/023 done files, repo-review-2026-06-10.md) were left uncommitted; only the task's own scoped files were committed.

---

## 2026-06-15 -- Task verified and completed: agentic-workflow-024 - Board prompt bar — two-thirds textarea + Work launch button

**Type:** Work / Task completion
**Task:** agentic-workflow-024 - Board prompt bar — textarea to two-thirds width, Work launch button on the right
**Summary:** Re-laid-out aw-023's `BoardPromptBar` into a left/right flex split — the textarea narrows to ~two-thirds (left) and a right-side action column (~one third) holds a single **Work** button that launches the **bare** `/agentheim:work` (new `WORK_COMMAND` constant; ignores the textarea) to kick off an execution run, reusing `launchOrCopy`/`LaunchButton` unchanged and threading `skipPermissions` (no `onResult`, so no clear/confetti). Quick Capture / Modeling stay prompt-seeded beneath, unchanged.
**Verification:** PASS (iteration 1) — dashboard suite 262/262 green; verifier confirmed `bridge-launch.js`/`LaunchButton` reused unforked, Work passes no `onResult`, dist rebuilt to carry the change.
**Commit:** b16022d
**Files changed:** 6 (board.js, modeling-command.js [+ `WORK_COMMAND` constant], 2 test files, dist/app.js, aw README) + task file move
**Tests added:** 7 (2 WORK_COMMAND constant cases + 5 prompt-bar split/Work-button board-glue guards)
**ADRs written:** none — composes ADR-0018/0001/0003/0019 unchanged (a builder refinement, not an architecture decision)

---

## 2026-06-15 -- Batch started: [agentic-workflow-024]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-024 - Board prompt bar — textarea to two-thirds width, Work launch button on the right
**Parallel:** no (1 worker)

---

## 2026-06-15 -- Modeling / Captured: agentic-workflow-024 - Board prompt bar — textarea to two-thirds width, Work launch button on the right

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Re-lay-out aw-023's `BoardPromptBar` into a left/right split — textarea narrows to two-thirds width, freeing a right-side action column whose single occupant is a new **Work** button that launches/copies the bare `/agentheim:work` (ignores the prompt; reuses `launchOrCopy`/`LaunchButton` + `skipPermissions` unchanged). Quick Capture & Modeling stay prompt-seeded beneath the textarea. Filed straight to todo (styleguide gate open via design-system-001).

---

## 2026-06-15 -- Work session ended

**Type:** Work / Session end
**Completed:** 3 (first-try PASS: 3, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 3 (2ff0add infrastructure-017, 0a6275a agentic-workflow-021, d75d820 agentic-workflow-023)
**Note:** Started with 2 ready tasks across infrastructure + agentic-workflow (no file conflict → parallel batch); both passed verification first try. infrastructure-017 re-packaged the bridge .vsix to 0.2.0; agentic-workflow-021 added the armed skip-permissions toggle (ADR-0019). A parallel modeling session promoted agentic-workflow-023 (board prompt bar) to todo mid-run — picked up as a second batch AFTER aw-021 landed so its board.js edits rebased cleanly; the verifier confirmed aw-021's skipPermissions wiring survived the relocation. aw-023 wrote ADR-0020 (board-local confetti).
**Design-system follow-ups flagged for the builder (cross-BC README — no worker can write it):** (1) `--obligation` now doubles as the dashboard's generic danger hue (ADR-0019) — candidate to alias into a named `--danger` token; (2) a shared TextArea / prompt-input primitive (none in the styleguide today); (3) a shared confetti / celebration motion treatment (ADR-0020 keeps it board-local for now).
**Bookkeeping note:** Per the git-authority rule, each task commit was scoped to its own code + task file + BC README + ADR. INDEX.md and protocol.md were updated for live-dashboard correctness but left uncommitted (matching the repo's pre-existing working-tree bookkeeping); pre-existing uncommitted changes from earlier sessions (infra-015/016 done files, aw-022 done file, repo-review-2026-06-10.md) were deliberately left untouched.

---

## 2026-06-15 -- Task verified and completed: agentic-workflow-023 - Board prompt bar (seeded launches)

**Type:** Work / Task completion
**Task:** agentic-workflow-023 - Board prompt bar — type a prompt, Quick Capture / Modeling launch seeded with it
**Summary:** Relocated aw-020's Quick Capture / Modeling buttons out of the backlog column into a board-only prompt bar above the columns; the trimmed textarea seeds `/agentheim:quick-capture <prompt>` / `/agentheim:modeling <prompt>` (bare command when empty), reusing `launchOrCopy`/`LaunchButton` unchanged; on a successful launch/landed copy the textarea clears and a board-local, reduced-motion-aware confetti burst plays.
**Verification:** PASS (iteration 1) — dashboard suite 255/255 green; verifier explicitly confirmed aw-021's skipPermissions wiring survives through to both relocated buttons
**Commit:** d75d820
**Files changed:** 9 (board.js, modeling-command.js [+ pure prompt builders], 3 test files, dist/app.js, ADR-0020 [new], aw README, task file)
**Tests added:** ~14 (pure command-builder degradation matrix + prompt-bar render/seed/clear/confetti + aw-021 regression)
**ADRs written:** 0020-board-confetti-board-local-transient-ack.md (scope: agentic-workflow)
**Note:** Two design-system follow-ups flagged for the builder (no design-system child task created by the worker, per scope): (1) a shared TextArea / prompt-input primitive (styleguide has none today); (2) a shared confetti/celebration motion treatment — ADR-0020 keeps it board-local as a transient ACK distinct from ADR-0014's status pulse, to promote once a second celebration surface exists.

---

## 2026-06-15 -- Batch started: [agentic-workflow-023]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-023 - Board prompt bar — type a prompt, Quick Capture / Modeling launch seeded with it
**Parallel:** no (1 worker) — picked up mid-run after promotion by a parallel modeling session; dispatched after aw-021 landed so the worker reads post-aw-021 board.js

---

## 2026-06-15 -- Task verified and completed: agentic-workflow-021 - Dashboard armed-launch setting (skip-permissions)

**Type:** Work / Task completion
**Task:** agentic-workflow-021 - Dashboard armed-launch setting — all bridge launches skip permissions when armed
**Summary:** A persisted, off-by-default shell-header toggle that, when armed, threads `skipPermissions: true` through the one shared `launchOrCopy` seam so all four bridge launches (Quick Capture, Modeling, per-card Refine/Promote) POST `{ prompt, skipPermissions: true }` (omitted-not-false when off); each launch button shows a per-launch danger indicator reflecting the armed state; clipboard fallback cannot carry the bypass (asymmetry accepted).
**Verification:** PASS (iteration 1) — full dashboard suite 240/240 green
**Commit:** 0a6275a
**Files changed:** 9 (board.js, bridge-launch.js, skip-permissions-state.js [new], 2 test files, dist/app.js, ADR-0019 [new], aw README, task file)
**Tests added:** 14 (store safe-degrade matrix + launchOrCopy armed/omit-not-false + strict-true threading)
**ADRs written:** 0019-dashboard-armed-launch-danger-token.md (scope: agentic-workflow)
**Note:** ADR-0019 reuses the existing `--obligation` token unforked as the danger hue (reserved selection accent ADR-0016 deliberately not touched). A design-system README reconciliation is flagged: `--obligation` now also serves as the dashboard's generic danger hue — a candidate to alias into a named `--danger` token later. No new design-system child task (refinement decision). Coordination note: the just-captured aw-023 (board prompt bar) also edits board.js — it must rebase on this aw-021 board.js change.

---

## 2026-06-15 -- Task verified and completed: infrastructure-017 - Re-package & version the bridge .vsix (skip-permissions)

**Type:** Work / Task completion
**Task:** infrastructure-017 - Re-package & version the bridge .vsix carrying the skip-permissions change
**Summary:** Bumped vscode-extension 0.1.0→0.2.0 and reconciled the extension README with the amended ADR-0018 POST /run contract (opt-in, off-by-default, strict-`true` `skipPermissions`); rebuilt `agentheim-bridge-0.2.0.vsix` (stale 0.1.0 removed, stays gitignored). No runtime code changed.
**Verification:** PASS (iteration 1)
**Commit:** 2ff0add
**Files changed:** 4 (package.json, extension README, INDEX, task file) + backlog→done move
**Tests added:** 0 (packaging chore; infra-016's skipPermissions suite stays green)
**ADRs written:** none (packages the already-amended ADR-0018)
**Note:** `extension.js` confirmed unchanged. Two pre-existing fixed-port-contention tests fail environmentally (a live VS Code bridge host holds 127.0.0.1:31425/:31426) — unrelated to this diff.

---

## 2026-06-15 -- Modeling / Captured: agentic-workflow-023 - Board prompt bar — Quick Capture / Modeling launch seeded with a typed prompt

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Relocate and extend aw-020's backlog launch buttons into a board-level prompt bar: a board-view-only textarea between the shell header and the columns, with Quick Capture / Modeling lifted out of the backlog column to sit beneath it. Each button now seeds its command WITH the trimmed textarea contents appended (`/agentheim:quick-capture <prompt>` / `/agentheim:modeling <prompt>`), reusing aw-020's `launchOrCopy` bridge/clipboard path unchanged (ADR-0018). Builder decisions: empty textarea → bare command (byte-identical to aw-020); after a successful launch/copy → clear the textarea + confetti animation; board surface only; scope is the two column buttons only (aw-022's per-card pair stays id-seeded). Captured straight to todo — concrete, styleguide gate (design-system-001) satisfied. Flagged two non-blocking design-system follow-ups (shared text-input primitive; shared confetti/celebration motion, cf. ADR-0014) and a board.js coordination note with the in-flight aw-021.

---

## 2026-06-15 -- Batch started: [infrastructure-017, agentic-workflow-021]

**Type:** Work / Batch start
**Tasks:** infrastructure-017 - Re-package & version the bridge .vsix carrying the skip-permissions change, agentic-workflow-021 - Dashboard armed-launch setting (all bridge launches skip permissions when armed)
**Parallel:** yes (2 workers)

---

## 2026-06-15 -- Modeling / Refined: agentic-workflow-021 - Dashboard armed-launch setting (skip-permissions)

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (promoted)
**Summary:** Refined and promoted. Both blocking deps are now done (infrastructure-015 frozen `skipPermissions` contract 54c242a; infrastructure-016 extension honours it 1ad7d46; design-system-001 styleguide gate approved), so the task moved from dependency-blocked to ready. Three refinement decisions taken with the builder: (1) **scope broadened to all bridge launches** — aw-022 shipped per-card Refine/Promote bridge launches *after* this task was written; since both aw-020's column buttons and aw-022's per-card buttons call the shared `launchOrCopy`, the armed flag threads at one seam to govern all four; (2) the persisted toggle lives as a **shell-header armed control** (theme-toggle precedent), not a settings panel; (3) the per-launch indicator is built **board-local / unforked** with **no** new design-system child task (must avoid ADR-0016's reserved accent; flag any new danger token for the design-system README). Folded in the now-settled clipboard decision (startup-only flag ⇒ fallback cannot carry the bypass, asymmetry accepted per amended ADR-0018) and dropped that stale open question. Rewrote title, Why/What, 8 acceptance criteria, and worker touch-points (`skip-permissions-state.js` mirroring `theme-state.js`; `launchOrCopy` option-threading; pure `node --test` coverage; `dist/` rebuild).
**Split into:** none
**ADRs written:** none

---

## 2026-06-15 -- Modeling / Refined: infrastructure-017 - Re-package & version the bridge .vsix carrying the skip-permissions change

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo
**Summary:** Settled the two open questions and promoted to todo. (1) Version bump → `0.2.0` minor (additive `skipPermissions` param on the POST /run surface); flagged that the extension's version is independent of ADR-0013 / the plugin manifest and needs no `vX.Y.Z` tag. (2) Distribution → keep build-on-demand — confirmed via `git check-ignore` that the `.vsix` is gitignored and uncommitted (only README + package.json tracked). Rewrote the task with 7 concrete acceptance criteria, including a README reconcile (the "never hard-wires --dangerously-skip-permissions" line and Tests/HTTP-surface/install-filename all lag the amended ADR-0018 contract). prior_art linked to infrastructure-013 (the original vsce-package flow).
**Split into:** none
**ADRs written:** none

---

## 2026-06-15 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (1ad7d46 infrastructure-016)
**Note:** Single ready task (infrastructure-016) — its dependency infrastructure-015 was already done. Worker confined the change to the pure core `vscode-extension/src/bridge.js` and passed verification first try. Worker spun off infrastructure-017 (backlog) to re-package & version the `.vsix`. Verifier flagged 2 environmentally-failing tests: a live VS Code bridge extension host is holding 127.0.0.1:31425 and :31426 on this dev box (PIDs 7636, 22852), so the pre-existing fixed-port-contention tests can't bind their fixtures — unrelated to the diff; every test covering the changed path is green. Left untouched: pre-existing uncommitted changes from earlier sessions (agentic-workflow INDEX + aw-022 done file, infrastructure-015 done file, repo-review-2026-06-10.md) were deliberately kept out of the commit.

---

## 2026-06-15 -- Task verified and completed: infrastructure-016 - Bridge extension honours the opt-in skip-permissions option

**Type:** Work / Task completion
**Task:** infrastructure-016 - Bridge extension honours the opt-in skip-permissions option on POST /run
**Summary:** The bridge's POST /run handler now honours `skipPermissions`: a strict-`true` identity check (`parsed?.skipPermissions === true`) seeds `claude --dangerously-skip-permissions "<prompt>"`, while absent/`false`/`null`/`"true"`/numeric all fail safe to the byte-identical pre-amendment `claude "<prompt>"`. Confined to the pure core `bridge.js`; `extension.js` (the only vscode-API file) untouched.
**Verification:** PASS (iteration 1)
**Commit:** 1ad7d46
**Files changed:** 3 (bridge.js, bridge.test.mjs, package.json) + 1 new backlog item
**Tests added:** 3 (skipPermissions:true bypass, 5-case strict-true matrix, byte-identical regression guard) — all green; 2 pre-existing fixed-port-contention tests fail environmentally (a live bridge host holds :31425/:31426), unrelated to this diff
**ADRs written:** none (implements the frozen command construction in ADR-0018's 2026-06-14 amendment)
**Note:** Worker spun off infrastructure-017 (backlog) to re-package & version the `.vsix` — out of scope for this pure-core change.

---

## 2026-06-15 -- Batch started: [infrastructure-016]

**Type:** Work / Batch start
**Tasks:** infrastructure-016 - Bridge extension honours the opt-in skip-permissions option on POST /run
**Parallel:** no (1 worker)

---

## 2026-06-14 15:35 -- Modeling / Promoted: infrastructure-016 - Bridge extension honours the opt-in skip-permissions option

**Type:** Modeling / Promote
**BC:** infrastructure
**From → To:** backlog → todo
**Summary:** Readiness confirmed — five concrete acceptance criteria, tightly bounded scope, and its sole dependency infrastructure-015 is done (commit 54c242a), so the `skipPermissions` contract field it was waiting on is now pinned. Open-for-refine notes (shell-escaping, .vsix re-packaging) are worker-resolvable implementation detail, not readiness blockers.

---

## 2026-06-14 15:24 -- Work session ended

**Type:** Work / Session end
**Completed:** 2 (first-try PASS: 1, re-dispatched: 1, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2 (b4a5e55 agentic-workflow-022, 54c242a infrastructure-015)
**Note:** Parallel batch of 2 ready tasks across two BCs (no file conflict). agentic-workflow-022 (per-card Refine/Promote launch buttons) passed verification first try (dashboard suite 226 green). infrastructure-015 (ADR-0018 opt-in permission-bypass amendment) failed verification iteration 1 (README left self-contradictory on the reversed clause) and passed on iteration 2 after a targeted README reconcile. todo and doing now empty. Surfaced: (1) a design-system BC README one-liner is warranted (ds-006 `cornerAction` now carries a consumer-composed multi-control group) — a worker can't cross BC READMEs, so it's for the builder; (2) infrastructure-015 unblocks backlog items infrastructure-016 and agentic-workflow-021. Cleared a stale `.git/index.lock` (no live git process) during the run.

---

## 2026-06-14 15:24 -- Task verified and completed: infrastructure-015 - Amend ADR-0018 (opt-in permission-bypass)

**Type:** Work / Task completion
**Task:** infrastructure-015 - Amend ADR-0018 — permit an opt-in bridge permission-bypass
**Summary:** ADR-0018 amended in place ("No permission-bypass" → "Permission-bypass — opt-in, off by default") with an optional strict-`true` `skipPermissions` boolean frozen on `POST /run`, guardrails (token unchanged, required per-launch indicator, residual-risk paragraph), clipboard-cannot-carry-it asymmetry accepted, and a "What stays frozen" list keeping infra-013/014 + aw-020 valid. Infra BC README reconciled.
**Verification:** PASS (iteration 2)
**Commit:** 54c242a
**Files changed:** 2 (ADR-0018, infra README)
**Tests added:** 0 (decision task)
**ADRs written:** 0018-vscode-dashboard-terminal-bridge.md (in-place amendment)
**Note:** Iteration 1 FAILED — the README's ADR-0018 summary bullet still asserted the reversed "no permission-bypass flag is ever wired in"; re-dispatched worker reconciled it. Unblocks infrastructure-016 and agentic-workflow-021 (both in backlog).

---

## 2026-06-14 15:24 -- Verification failed: infrastructure-015 - Amend ADR-0018 (opt-in permission-bypass)

**Type:** Work / Verification failure
**Task:** infrastructure-015 - Amend ADR-0018 — permit an opt-in bridge permission-bypass
**Iteration:** 1 of 3
**Reasons:** Infra BC README still self-contradictory — the ADR-0018 Decisions-section summary bullet (~line 222) still reads "no permission-bypass flag is ever wired in", directly contradicting the amended ADR recorded in the same README. The Bridge entry (~line 84) was correctly updated, but the summary bullet was left stale.
**Iteration hint:** likely-fixable
**Next:** re-dispatched worker (iteration 2)

---

## 2026-06-14 15:24 -- Task verified and completed: agentic-workflow-022 - Backlog cards get Refine & Promote launch buttons

**Type:** Work / Task completion
**Task:** agentic-workflow-022 - Backlog cards get Refine & Promote launch buttons, each seeded with the ticket id
**Summary:** Backlog cards now carry a Refine (primary) / Promote (quiet) launch-button group in the styleguide TicketCard `cornerAction` slot, replacing aw-016's single Copy button; Refine seeds `/agentheim:modeling refine <id>` and Promote `/agentheim:modeling promote <id>`, each launching via the VS Code bridge with silent clipboard fallback, styleguide consumed unforked (ADR-0003).
**Verification:** PASS (iteration 1)
**Commit:** b4a5e55
**Files changed:** 6 (modeling-command.js + test, board.js, new backlog-card-launch test, README, dist/app.js)
**Tests added:** new backlog-card-launch suite + extended modeling-command (full dashboard suite 226 green)
**ADRs written:** none (exercises ADR-0003/0009/0018; no new decision)
**Note:** Verifier flagged that a matching one-line note in the design-system BC README is warranted (ds-006's `cornerAction` now demonstrated carrying a consumer-composed multi-control group) — a worker may not edit another BC's README; surfaced to builder.

---

## 2026-06-14 15:24 -- Batch started: [infrastructure-015, agentic-workflow-022]

**Type:** Work / Batch start
**Tasks:** infrastructure-015 - Amend ADR-0018 (permit an opt-in bridge permission-bypass), agentic-workflow-022 - Backlog cards get Refine & Promote launch buttons
**Parallel:** yes (2 workers)

---

## 2026-06-14 -- Modeling / Refined: agentic-workflow-022 - Backlog cards get Refine & Promote launch buttons

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Resolved the one open architectural question — two labelled actions on
a card whose styleguide `cornerAction` slot (design-system-006) was built for one
control. Decided to **reuse the existing slot**: `cornerAction` is a render-prop, so
the board returns a two-button group from it; the styleguide is consumed unforked
(ADR-0003) and is not modified. **No design-system child task; no new dependency.**
Also fixed emphasis: **Refine primary, Promote de-emphasised**. Acceptance criteria
tightened (slot composition, stop-propagation reuse, no-fork) and the prior "may need
a child task / open placement" hedging removed.
**Split into:** (none — reuse-the-slot decision avoided a split)
**ADRs written:** (none — exercises ADR-0003 / ds-006 rather than superseding them; a one-line README note flagged instead)

---

## 2026-06-14 -- Modeling / Refined + Promoted: infrastructure-015 - Amend ADR-0018, permit an opt-in bridge permission-bypass

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo (promoted from backlog)
**Summary:** Routed the decision to the architect via the orchestrator. Resolved all four open sub-questions: (1) **amend ADR-0018 in place** — it's still `proposed`, repo only supersedes `accepted` ADRs; (2) freeze an optional boolean **`skipPermissions`** on `POST /run` (intent-named over the task's flag-spelled `dangerouslySkipPermissions` — left as a builder veto), with **strict-`true`** activation so malformed input fails safe; (3) guardrails — token stays required/unchanged, a **per-launch at-a-glance indicator** is mandated, and an explicit residual-risk paragraph; (4) bypass is **bridge-launch-only** — the clipboard fallback can't carry a startup flag, closing the previously-open "clipboard appends the flag" question. Tightened acceptance criteria; promoted to todo (no deps, unambiguous). Surfaced two downstream scope gaps and folded them in: infrastructure-016 gains a strict-`true` regression guard; agentic-workflow-021 now explicitly owns the ADR-mandated per-launch indicator and records the accepted clipboard asymmetry.
**Split into:** none
**ADRs written:** none (the ADR-0018 amendment is the *output* of working 015, not written during refine)

---

## 2026-06-14 -- Modeling / Captured: agentic-workflow-022 - Backlog cards get Refine & Promote launch buttons

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Each backlog *card's* single Copy button (aw-016) becomes a Refine /
Promote launch pair — the per-card sibling of aw-020's column launch pair. Each
button seeds an interactive Claude terminal via the VS Code bridge with the
ticket's id baked in (`/agentheim:modeling refine <id>` / `… promote <id>`), with
the existing silent clipboard fallback. Filed straight to todo: all infra and the
styleguide gate are done, so it's worker-ready. (Renumbered 021→022 — a concurrent
session claimed 021 mid-capture.)

---

## 2026-06-14 -- Modeling / Captured: opt-in permission-bypass for the bridge launch buttons

**Type:** Modeling / Capture
**BC:** infrastructure + agentic-workflow
**Filed to:** backlog
**Summary:** Builder wants a persisted dashboard setting (off by default) that launches the Quick Capture & Modeling buttons with `--dangerously-skip-permissions`. This reverses ADR-0018's explicit "No permission-bypass" clause, so it was captured as three linked backlog items: **infrastructure-015** (decision — amend/supersede ADR-0018 to permit an opt-in bypass + freeze the `POST /run` contract field), **infrastructure-016** (feature — the bridge extension honours the option), and **agentic-workflow-021** (feature — the persisted toggle + threading the flag through the launch path, gated on design-system-001). Dependency chain: 015 → 016 → 021. The ADR conflict was surfaced to the builder, who chose to record the reversal as a decision task and to make the setting a persisted, default-off toggle.

---

## 2026-06-14 16:30 -- Release shipped: v0.8.5

**Type:** Release
**Version:** 0.8.4 → 0.8.5 (patch — VS Code bridge: dashboard launches a seeded Claude terminal for Quick Capture & Modeling)
**Manifest:** `.claude-plugin/plugin.json` bumped, committed `fda8108`
**Pushed to main:** yes (`bd358f8..fda8108` on `origin/main`)
**Tag:** `v0.8.5` (annotated) → `fda8108`, pushed to origin
**GitHub Release:** deferred (gh unavailable — notes handed to builder)

---

## 2026-06-14 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (e18e538) + this SHA-backfill entry
**Note:** Single ready task agentic-workflow-020 — backlog Quick Capture / Modeling launch buttons over the VS Code bridge — passed verification first try (full dashboard suite 217 green). todo and doing now both empty; no new tasks promoted mid-run. The backlog BC now has nothing ready: aw-020 was the last open item, and its "open for refine" notes (per-card backlog copy gaining a launch path; exact button placement) were resolved as in-scope worker decisions. Left untouched (not this session's work): `.agentheim/knowledge/repo-review-2026-06-10.md`.

---

## 2026-06-14 -- Task verified and completed: agentic-workflow-020 - Backlog two launch buttons (Quick Capture & Modeling)

**Type:** Work / Task completion
**Task:** agentic-workflow-020 - Backlog "Add ticket" becomes two launch buttons — Quick Capture & Modeling — that start a seeded Claude session
**Summary:** The backlog add affordance is now two labelled launch buttons — Quick Capture (`/agentheim:quick-capture`) and Modeling (`/agentheim:modeling`) — each opening a real interactive Claude session through the VS Code bridge (ADR-0018), with a silent clipboard fallback whenever the bridge is unavailable.
**Verification:** PASS (iteration 1)
**Commit:** e18e538
**Files changed:** 7 (board.js, modeling-command.js + test, new bridge-launch.js + test, README, dist/app.js)
**Tests added:** 12 (10 bridge-launch + 2 modeling-command; full dashboard suite 217 green)
**ADRs written:** none (built against frozen ADR-0018)
**Note:** Pure launch-vs-copy decision logic (`bridge-launch.js`, `launchOrCopy`) injected with fetch+copy, never throws/rejects across every failure mode (absence-is-normal contract). Styleguide consumed unforked (ADR-0003) — buttons are board-composed siblings. Launch is an external side-effect, board stays a projection of disk (ADR-0001).

---

## 2026-06-14 -- Batch started: [agentic-workflow-020]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-020 - Backlog "Add ticket" becomes two launch buttons (Quick Capture & Modeling)
**Parallel:** no (1 worker)
**Note:** Single ready task; all four deps (infrastructure-012, infrastructure-014, agentic-workflow-019, design-system-001) done. No conflicts.

---

## 2026-06-14 -- Modeling / Promoted: agentic-workflow-020 - Backlog two launch buttons (Quick Capture & Modeling)

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo
**Summary:** All four dependencies now done — infrastructure-012 (ADR-0018 bridge contract), infrastructure-014 (`GET /api/bridge` endpoint), agentic-workflow-019 (capture→quick-capture rename), design-system-001 (styleguide gate). Task carries 7 concrete acceptance criteria and a clear scope (two bridge-launched buttons + clipboard fallback), so it is ready for `work`. The "open for refine" notes (exact button placement; whether the per-card copy button also gains a launch path) are within-scope worker decisions, not promotion blockers.

---

## 2026-06-14 -- Work session ended

**Type:** Work / Session end
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 3 (013: 7ccd2a7, ADR-0017 refactor: d13bb66, 014: f6d73d6)
**Note:** infrastructure-013 (VS Code bridge extension) + infrastructure-014 (`GET /api/bridge`) both shipped, serialized across two batches because they share the infrastructure BC README. todo emptied. Surprise: the working tree carried a large pre-existing UNcommitted ADR-0017 refactor overlapping 014's server.mjs — committed it first (d13bb66) per the user's call, then landed 014 cleanly. Downstream **agentic-workflow-020** (board bridge buttons) now has both its dependencies (012 contract, 014 endpoint) done, but stays in **backlog** until `modeling` promotes it. Left uncommitted (not this session's work): `repo-review-2026-06-10.md`, new agentic-workflow backlog items.

---

## 2026-06-14 -- Task verified and completed: infrastructure-014 - Dashboard server GET /api/bridge

**Type:** Work / Task completion
**Task:** infrastructure-014 - Dashboard server GET /api/bridge — serve the bridge port+token to the sandboxed frontend
**Summary:** Added the read-only `GET /api/bridge` endpoint to the dashboard server: reads `.agentheim/.dashboard/bridge.json` (written by the infrastructure-013 extension) via ADR-0002's in-root validator and serves the `{ port, token, v }` subset (no pid/startedAt leak), degrading to `200 { present: false }` on absent/unreadable/malformed — never a 5xx — so the filesystem-blind Simple Browser frontend can discover the bridge and silently fall back to clipboard. Pure read transport; zero-dep, stdlib-only.
**Verification:** PASS (iteration 1)
**Commit:** f6d73d6
**Files changed:** 4 (read-api.mjs, server.mjs, new bridge-api test, infra BC README)
**Tests added:** 3 (present / absent / malformed; full dashboard suite 200/200)
**ADRs written:** none (built against frozen ADR-0018)
**Note:** Blocks agentic-workflow-020 — that task's bridge-detection probe (`GET /api/bridge` → token-bearing `GET /health`) now has its server seam.

---

## 2026-06-14 -- Change / Git hygiene: committed the pre-existing uncommitted ADR-0017 dashboard read-only refactor

**Type:** Change / Git hygiene (work-skill, user-authorized)
**Summary:** At this work session's start the tree carried a large UNcommitted refactor — the ADR-0017 "dashboard made read-only" change (board.js drag removal, promote.js/move-api.mjs + their tests deleted, server.mjs write-path unmounted, dist rebuilt, READMEs, lib/task-lifecycle.mjs, ADR-0017 written, ADR-0001 superseded) — that overlapped infrastructure-014's `server.mjs`. Per the user's call, committed that refactor as its own commit **d13bb66** (hunk-split so 014's `/api/bridge` route was excluded), then landed 014 cleanly on top (**f6d73d6**). Left genuinely-unrelated tree changes uncommitted (repo-review-2026-06-10.md, new agentic-workflow backlog items).

---

## 2026-06-14 -- Batch started: [infrastructure-014]

**Type:** Work / Batch start
**Tasks:** infrastructure-014 - Dashboard server GET /api/bridge — serve the bridge port+token to the sandboxed frontend
**Parallel:** no (1 worker)
**Note:** Second serialized batch — held from batch 1 because it shares the infrastructure BC README with infrastructure-013 (now done).

---

## 2026-06-14 -- Task verified and completed: infrastructure-013 - Build the VS Code bridge extension

**Type:** Work / Task completion
**Task:** infrastructure-013 - Build the VS Code bridge extension — 127.0.0.1 listener that opens a seeded Claude terminal
**Summary:** Built Agentheim's first deployable VS Code extension (`vscode-extension/`): a 127.0.0.1-only `node:http` listener implementing the ADR-0018 bridge contract — token-gated `POST /run` opens a real interactive terminal seeded with `claude "<prompt>"`, fixed port 31425 + 31426/27 fallback ladder, per-activation 32-hex token written to `.agentheim/.dashboard/bridge.json` on activation and removed on deactivation, load-bearing OPTIONS/CORS preflight answered, no permission-bypass flag.
**Verification:** PASS (iteration 1)
**Commit:** 7ccd2a7
**Files changed:** 8 (6 new under vscode-extension/, .gitignore, infra BC README)
**Tests added:** 9 (node:test, all green)
**ADRs written:** none (built against frozen ADR-0018)

---

## 2026-06-14 -- Batch started: [infrastructure-013]

**Type:** Work / Batch start
**Tasks:** infrastructure-013 - Build the VS Code bridge extension — 127.0.0.1 listener that opens a seeded Claude terminal
**Parallel:** no (1 worker)
**Note:** infrastructure-014 held to next batch — both tasks touch the infrastructure BC README (Phase-3 conflict), so they are serialized rather than run in parallel.

---

## 2026-06-14 -- Modeling / Promoted: infrastructure-013, infrastructure-014 (bridge build tasks)

**Type:** Modeling / Promote
**BC:** infrastructure
**From → To:** backlog → todo (013, 014)
**Summary:** With infrastructure-012 (ADR-0018) done, both build tasks have their only dependency satisfied — promoted to todo. agentic-workflow-020 stays in backlog: it depends on infrastructure-014, which is now todo but not yet done, so it is not ready to work.
**ADR ref fix:** Replaced stale "ADR-0017" → "ADR-0018" in the bodies of infrastructure-013, infrastructure-014, and agentic-workflow-020 (the bridge contract shipped as 0018; 0017 is the unrelated dashboard read-only ADR).

---

## 2026-06-14 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (8552050)
**Note:** todo emptied. infrastructure-012's blocked successors (013, 014, aw-020) remain in backlog — they must be promoted to todo via `modeling` before `work` picks them up. ADR renumber 0017→0018 carried through (see completion entry).

---

## 2026-06-14 -- Task verified and completed: infrastructure-012 - VS Code dashboard→terminal bridge transport contract

**Type:** Work / Task completion
**Task:** infrastructure-012 - VS Code dashboard→terminal bridge — pin the transport contract
**Summary:** Pinned the bridge transport contract as ADR-0018 — fixed-port (`127.0.0.1:31425` + fallback ladder) localhost-listener VS Code extension over rejected alternatives, server-mediated discovery via extension-written `bridge.json` read by a new `GET /api/bridge`, per-activation `X-Agentheim-Bridge-Token`, fresh-session `POST /run` only (`POST /inject` deferred), and silent clipboard fallback on any probe failure. Diverges from ADR-0002's ephemeral port because the discovery reader is a filesystem-blind sandboxed Simple Browser frame.
**Verification:** PASS (iteration 1)
**Commit:** 8552050
**Files changed:** 2 (ADR-0018 written; ADR-0002 cross-linked as transport precedent)
**Tests added:** 0 (decision-only task)
**ADRs written:** 0018-vscode-dashboard-terminal-bridge.md
**Note:** Shipped as **ADR-0018**, not the task's stale ADR-0017 (0017 was claimed today by the dashboard read-only ADR; renumbering authorized by the user). Downstream 013 / 014 / aw-020 still text-reference "ADR-0017" — to be corrected to 0018 when those tasks are worked.

---

## 2026-06-14 -- Batch started: [infrastructure-012]

**Type:** Work / Batch start
**Tasks:** infrastructure-012 - VS Code dashboard→terminal bridge — pin the transport contract
**Parallel:** no (1 worker)
**Note:** ADR number renumbered 0017→**0018** at dispatch — 0017 was taken today by the dashboard read-only ADR. Bridge contract ships as ADR-0018.

---

## 2026-06-14 -- Change / Architecture: Dashboard made read-only — skills are the sole owners of task lifecycle

**Type:** Change / Architecture (maintainer, direct)
**BC:** agentic-workflow
**ADR:** ADR-0017 (accepted) supersedes ADR-0001 (→ superseded)
**Summary:** Removed drag-and-drop from the dashboard board altogether and deleted the dashboard's
only write path. Cards are no longer drag sources and columns are no longer drop targets; the
board is now a *total* read-only projection of disk. Deleted `dashboard/app/promote.js` and
`dashboard/move-api.mjs`, unmounted `POST /api/task/move` from `dashboard/server.mjs` (the server
now exposes only reads + SSE + static), and removed the drag/notice state + handlers from
`dashboard/app/board.js` (renamed `DragColumn`→`BoardColumn`, `DraggableCard`→`BoardCard`).
Task-lifecycle transitions are owned entirely by the skills (`modeling` promotes, `work`
claims/completes), which move files together with the readiness check, `depends_on`/gate guard,
INDEX update, and protocol entry — eliminating the UI-Promote INDEX-drift hole (ADR-0007). The
canonical mover `applyTaskMove` (`lib/task-lifecycle.mjs`) is kept for the skills but no longer
called by the dashboard; its `ui` policy is retained as a now-unwired restricted move set.
**Rationale:** No skill ever called `applyTaskMove` (workers move files by hand), so the "one
shared mover" had exactly one caller — the dashboard — and a UI Promote skipped the INDEX/protocol
side-effects skills own, leaving derived views stale. One owner of the lifecycle is clearer than
two. (Follows directly from the out-of-sync evaluation: disk is the single source of truth, the
board a projection; making it write-free makes the projection total.)
**Tests:** deleted `promote.test.mjs` + `move-api.test.mjs`; rewrote the `server.test.mjs`
write-route test to assert no write path exists. Dashboard 197/197, lib 15/15 green; `dist/`
rebuilt from source.
**Docs:** ADR-0017 written, ADR-0001 marked superseded; dashboard README, agentic-workflow README
+ INDEX updated to the read-only model.

---

## 2026-06-14 -- Modeling / Refined: infrastructure-012 - VS Code dashboard→terminal bridge

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo (split)
**Summary:** Refined the bridge feature via the orchestrator→architect. Resolved the four
open transport decisions: fixed port `127.0.0.1:31425` (+ `31426/27` fallback) over
ephemeral (ADR-0002's pattern can't serve a sandboxed, filesystem-blind frontend);
server-mediated discovery via an extension-written `.agentheim/.dashboard/bridge.json`
read by a new dashboard `GET /api/bridge`; fresh-session `POST /run` only (inject deferred);
silent clipboard fallback on any probe failure; per-activation token via
`X-Agentheim-Bridge-Token`. Split the single feature into a `type: decision` task (012 →
ADR-0017 contract, promoted to todo) plus two build features.
**Split into:** infrastructure-012 (decision, → todo; output ADR-0017), infrastructure-013
(build the VS Code extension, backlog), infrastructure-014 (dashboard `GET /api/bridge`
endpoint, backlog). Added infrastructure-014 to agentic-workflow-020's depends_on.
**ADRs written:** none yet — ADR-0017 is infrastructure-012's deliverable when worked.

---

## 2026-06-14 09:41 -- Work session ended

**Type:** Work / Session end
**Completed:** 3 (first-try PASS: 3, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 3 (6985ee7 infrastructure-011, a536cba agentic-workflow-018, df9792d agentic-workflow-019)
**New backlog items:** none created by workers (aw-020 + infrastructure-012 were filed by a concurrent modeling session, not this run)
**Notes:** Three tasks across two BCs, run as three SEQUENTIAL solo waves. infrastructure-011 (dashboard tab title names the discovered project, server-side `serveIndexHtml` injection from the `# Vision:` heading, folder-name fallback; new pure `project-name.mjs`) ran first as the sole ready task. A concurrent modeling session then promoted aw-018 + aw-019 to todo mid-run; both are agentic-workflow BC and both reference the agentic-workflow README (EmptyColumn / Capture), so they were serialized rather than parallelized to avoid a BC-memory race. aw-018 (dropped the dead "Add ticket" empty-card button + no-op header `+` on todo/doing/done via an optional `onAdd` slot on the styleguide `EmptyColumn`/`ColumnHeader`, default off, board supplies only for backlog — consumed unforked per ADR-0003/0009) ran wave 2; aw-019 (renamed the `capture` skill → `quick-capture` end-to-end) ran wave 3. All three PASSED verification first try (dashboard 210/210, styleguide 28/28; both committed `dist/` bundles confirmed byte-reproducible from `node build.mjs`). Concurrent untracked work from other sessions (agentic-workflow/INDEX backlog entry, repo-review-2026-06-10.md, the two new backlog tasks) was kept out of every commit via surgical staging. **Builder action needed:** the styleguide gate REOPENS from aw-018 — `EmptyColumn` and `ColumnHeader` are visual primitives that changed; awaiting a fresh builder canvas re-review (same flow as ds-005/ds-007).

---

## 2026-06-14 09:40 -- Task verified and completed: agentic-workflow-019 - Rename the `capture` skill to `quick-capture`

**Type:** Work / Task completion
**Task:** agentic-workflow-019 - Rename the `capture` skill to `quick-capture`
**Summary:** Renamed the `capture` skill to `quick-capture` end-to-end (`skills/capture/` → `skills/quick-capture/`, evals subtree carried along, `name: quick-capture` frontmatter, body + "Handoff to modeling" wiring) so it invokes as `/agentheim:quick-capture`. The `modeling` CAPTURE action, the verb "capture", user trigger phrases, and `skills/capture-workspace/` eval scratch were left untouched per the scope boundary.
**Verification:** PASS (iteration 1)
**Commit:** df9792d
**Files changed:** skills/{capture => quick-capture}/SKILL.md + evals/evals.json (git-tracked rename) + agentic-workflow README ("Capture" → "Quick Capture" in Key commands)
**Tests added:** none (markdown skill rename; no skill-naming test infra — verifier re-grepped instead)
**ADRs written:** none (ubiquitous-language naming change, not architectural)
**Note:** Plugin manifest auto-discovers skills (no `skills` key, no capture reference) — no manifest edit needed. Only residual "agentheim:capture" / "skills/capture" hits are dated, append-only historical records (repo-review-2026-06-10.md, the protocol diary) — left intact deliberately so the dated observations stay true; verifier judged AC#6 ("no live stale cross-reference") satisfied.

---

## 2026-06-14 09:36 -- Batch started: [agentic-workflow-019]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-019 - Rename the `capture` skill to `quick-capture`
**Parallel:** no (1 worker — sole remaining ready task)

---

## 2026-06-14 09:33 -- Task verified and completed: agentic-workflow-018 - Remove the non-functional "Add ticket" affordances from non-backlog columns

**Type:** Work / Task completion
**Task:** agentic-workflow-018 - Remove the non-functional "Add ticket" affordances from non-backlog columns
**Summary:** The dead "Add ticket" affordances are gone from todo/doing/done. The styleguide `EmptyColumn` button and `ColumnHeader` `+` are now optional `onAdd` slots (default OFF, mirroring ds-006's `cornerAction`); `board.js` supplies them only for backlog — consumed unforked (ADR-0003/0009). Both AC#1 (empty-card button) and the optional AC#2 (header `+`) done.
**Verification:** PASS (iteration 1)
**Commit:** a536cba
**Files changed:** 6 (styleguide empty.js, kanban.js, new add-affordance.test.mjs, dashboard board.js, dist/app.js, agentic-workflow README)
**Tests added:** styleguide add-affordance.test.mjs (5 cases: slot present-when-supplied/absent-by-default on EmptyColumn + ColumnHeader, board supplies onAdd only for backlog) — styleguide 28/28, dashboard 210/210 green; dist/app.js reproducible (byte-identical on rebuild).
**ADRs written:** none (extends ADR-0003 single-source + ADR-0009 unforked consumption)
**Gate:** styleguide gate REOPENS — `EmptyColumn` and `ColumnHeader` are visual primitives that changed; awaiting builder canvas re-review (same flow as ds-005/ds-007).

---

## 2026-06-14 09:27 -- Batch started: [agentic-workflow-018]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-018 - Remove the non-functional "Add ticket" affordances from non-backlog columns
**Parallel:** no (1 worker — aw-019 held this wave; both are agentic-workflow BC and may both touch the BC README / agentic-workflow concerns, so serialized to avoid a BC-memory race)

---

## 2026-06-14 -- Modeling / Captured: dashboard add-ticket cleanup + two launch buttons (4 tasks, 2 BCs)

**Type:** Modeling / Capture
**BC:** agentic-workflow, infrastructure
**Filed to:** todo (2), backlog (2)
**Summary:** Builder wants the dashboard's non-functional add-ticket affordances
removed and the backlog one turned into real launchers. Decomposed into four tasks:
**aw-018** (todo) — remove the dead "Add ticket" button from empty todo/doing/done
columns (+ the no-op header `+`); **aw-019** (todo) — rename the `capture` skill to
`quick-capture` so the button command reads `/agentheim:quick-capture`;
**infrastructure-012** (backlog) — build the VS Code dashboard→terminal bridge
(127.0.0.1 listener extension) per the 2026-06-09 research, the only path to a real
interactive seeded `claude` session from the sandboxed Simple Browser;
**aw-020** (backlog) — replace the backlog "Add ticket" with two buttons (Quick
Capture → `/agentheim:quick-capture`, Modeling → `/agentheim:modeling`) that launch
via the bridge, with a clipboard fallback when not in VS Code / the bridge is absent
(builder's explicit requirement). aw-020 depends on infrastructure-012 + aw-019 +
design-system-001; evolves aw-016 (clipboard copy) as `prior_art`. ID note:
infrastructure-011 was taken by a concurrent session (title-project-name, done), so
the bridge took 012.

---

## 2026-06-14 09:22 -- Task verified and completed: infrastructure-011 - Dashboard browser tab title reflects the discovered project's name

**Type:** Work / Task completion
**Task:** infrastructure-011 - Dashboard browser tab title reflects the discovered project's name
**Summary:** The dashboard tab `<title>` is now rewritten server-side per request to `<ProjectName> — Dashboard`, where the name comes from the discovered project's `# Vision:` heading (falling back to the root folder basename). New `project-name.mjs` (pure, stdlib-only: parseVisionName / resolveProjectName / dashboardTitle / injectTitle, with HTML-escaping); `serveIndexHtml` in static.mjs transforms only `/` and `/index.html`, reusing the in-root resolver so ADR-0002 traversal guarantees stand; the baked `dist/`+`build.mjs` title is now a documented default/template. No flash, no new dependency.
**Verification:** PASS (iteration 1)
**Commit:** 6985ee7
**Files changed:** 8 (project-name.mjs, static.mjs, server.mjs, build.mjs, dist/index.html, project-name.test.mjs, server.test.mjs, infrastructure README)
**Tests added:** dashboard test/project-name.test.mjs (parse/casing/whitespace/fallback/suffix/inject + HTML-escape) and 2 new server.test.mjs integration cases (vision-heading injection, headingless folder fallback) — full dashboard suite 210/210 green; dist/index.html reproducible from `node build.mjs`.
**ADRs written:** none (honors ADR-0002 Node-stdlib zero-deps + ADR-0003 committed dist/)

---

## 2026-06-14 09:17 -- Batch started: [infrastructure-011]

**Type:** Work / Batch start
**Tasks:** infrastructure-011 - Dashboard browser tab title reflects the discovered project's name
**Parallel:** no (1 worker — sole ready task)

---

## 2026-06-14 -- Modeling / Captured: infrastructure-011 - Dashboard browser tab title reflects the discovered project's name

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** todo
**Summary:** The dashboard's browser tab title is hard-coded to `Agentheim — Dashboard` (`build.mjs:60`, baked into `dist/`), so it lies about which project is on screen when pointed at a foreign project. Captured a task to make the `<title>` read `<ProjectName> — Dashboard` at runtime, where the name comes from the discovered project's `# Vision:` heading (builder-decided), falling back to the project folder name.

---

## 2026-06-09 13:05 -- Styleguide gate re-confirmed (OPEN)

**Type:** Gate / Re-approval
**BC:** design-system
**Re-approved by:** builder, 2026-06-09
**Scope:** The two visible styleguide changes from this session's tasks — ds-005's unified `Collapsible`/`TreeGroup` header (count right-aligned, label truncates) and ds-007's swatched `ThemeToggle` in the `TopBar` (every page). Builder reviewed the canvas (`styleguide/index.html` section 09 + the TopBar control) and re-confirmed. The gate now stands **OPEN** against the unified header + swatched theme control; the two BC README gate notes flipped from REOPENED → OPEN.

---

## 2026-06-09 13:00 -- Work session ended

**Type:** Work / Session end
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2 (fbfba13 ds-005, 8545b92 ds-007) + this SHA-backfill / session-close chore
**New backlog items:** none
**Notes:** Two design-system tasks, run as two SEQUENTIAL solo waves — not parallel — because they collided on three shared resources: `dashboard/app/board.js`, the single dashboard `dist/` bundle, and the design-system BC README. ds-005 (shared `Collapsible` primitive: canonical chevron header + revealed body, controlled-or-uncontrolled, body-agnostic via `bodyStyle`; `TreeGroup` + board per-BC section both consume it unforked; board-local `BCSectionHeader` retired) ran wave 1; ds-007 (dedicated `ThemeToggle` swatching each button's own theme via fixed non-flipping tokens, selection by de-emphasis; replaces `Segmented` as the theme control in styleguide TopBar + dashboard ShellRail; wrote ADR-0016) ran wave 2 once unblocked. Both PASSED verification first try (styleguide 15→23 tests, dashboard 196 green throughout; the shared `dist/` rebuilt each wave and verifier-confirmed reproducible from `node build.mjs`). **Builder action needed: the styleguide gate is REOPENED** — ds-005 shifted `TreeGroup`'s header (count right-aligned, label truncates) and ds-007 reskinned the theme control on every page; both await a fresh builder sign-off on the canvas (`styleguide/index.html`, section 09 + the TopBar control). Concurrent edits from other sessions (`lib/task-lifecycle.mjs` + its test, `knowledge/index.md`, an untracked `knowledge/research/`) were kept out of every commit via surgical staging.

---

## 2026-06-09 12:58 -- Task verified and completed: design-system-007 - Theme toggle buttons swatch their own theme

**Type:** Work / Task completion
**Task:** design-system-007 - Theme toggle buttons swatch their own theme (Dark = dark bg, Light = light bg)
**Summary:** Replaced the backwards-reading `Segmented` theme control with a dedicated `ThemeToggle` whose two buttons each preview their own theme via fixed, non-flipping `:root` swatch tokens (`--swatch-light`/`--swatch-dark` + fixed on-swatch fg, NOT redefined under `[data-theme]`), signalling the selected theme by de-emphasis (dimming the unselected) rather than the reserved accent. Swapped unforked into BOTH the styleguide `TopBar` and the dashboard `ShellRail`; `Segmented` and the existing theme persistence (`theme-state.js`) are untouched.
**Verification:** PASS (iteration 1)
**Commit:** 8545b92
**Files changed:** 7 authored (colors_and_type.css, live.js, app.js, dashboard/app/board.js, README, ADR-0016) + styleguide/test/theme-toggle.test.mjs + derived dist (app.js, colors_and_type.css)
**Tests added:** styleguide test/theme-toggle.test.mjs (8 cases: swatch-per-theme non-flip, fixed on-swatch fg, de-emphasis selection / no accent, Segmented unchanged source-guard, TopBar uses ThemeToggle) — styleguide 23/23, dashboard 196/196 green; dist reproducible (identical sha1 on rebuild).
**ADRs written:** ADR-0016 — Theme-preview swatches use fixed (non-theming) tokens; selection by de-emphasis, never the reserved accent (scope: design-system; bidirectional link to design-system-007).
**Gate:** styleguide gate remains REOPENED (from ds-005); the ThemeToggle look is folded into the same pending builder re-review (the TopBar theme control now wears the swatched look on every page).

---

## 2026-06-09 12:52 -- Batch started: [design-system-007]

**Type:** Work / Batch start
**Tasks:** design-system-007 - Theme toggle buttons swatch their own theme (Dark = dark bg, Light = light bg)
**Parallel:** no (1 worker — sole remaining ready task; was held wave 1 for conflicting with ds-005 on dashboard/app/board.js, the dashboard dist bundle, and the design-system BC README; now unblocked)

---

## 2026-06-09 12:50 -- Task verified and completed: design-system-005 - Shared collapsible-section primitive (decoupled from TreeItem) for board + library

**Type:** Work / Task completion
**Task:** design-system-005 - Shared collapsible-section primitive (decoupled from TreeItem) for board + library
**Summary:** Extracted a single shared `Collapsible` styleguide primitive (canonical chevron header + revealed body, controlled-or-uncontrolled, body-agnostic via a `bodyStyle` override) consumed unforked by both the library `TreeGroup` (uncontrolled, `defaultOpen`) and the dashboard board's per-BC section (controlled via persisted view-state, ADR-0015). The board-local `BCSectionHeader` clone is retired; the unified header reopens the styleguide gate pending builder re-review.
**Verification:** PASS (iteration 1)
**Commit:** fbfba13
**Files changed:** 7 authored (collapsible.js, collapsible-state.js, library.js, app.js, collapsible.test.mjs, dashboard/app/board.js, design-system README) + derived dist bundle
**Tests added:** styleguide test/collapsible.test.mjs (5 cases: owns reveal, controlled/uncontrolled toggle semantics, TreeGroup composition, board composition + BCSectionHeader deletion source-guard, pure isControlled) — styleguide 15/15, dashboard 196/196 green; dist reproducible from `node build.mjs`.
**ADRs written:** none (governed by ADR-0003 unforked single-source, ADR-0005 htm, ADR-0015 board controlled collapse)
**Gate:** styleguide gate REOPENED — TreeGroup's header changed visually (count right-aligned, label truncates); awaiting builder re-review (canvas section 09). Surfaced to user.

---

## 2026-06-09 12:40 -- Batch started: [design-system-005]

**Type:** Work / Batch start
**Tasks:** design-system-005 - Shared collapsible-section primitive (decoupled from TreeItem) for board + library
**Parallel:** no (1 worker — ds-007 held this wave; conflicts with ds-005 on dashboard/app/board.js, the dashboard dist bundle, and the design-system BC README)

---

## 2026-06-09 -- Modeling / Refined: design-system-007 - Theme toggle buttons swatch their own theme

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** todo (promoted from backlog)
**Summary:** Cornered the three open forks with the builder and pinned the design. (1) **Swatch tokens** — the fixed swatch backgrounds can't reuse `--surface-0`/`--surface-inverse` (they flip under `[data-theme="dark"]`), so introduce two theme-independent tokens `--swatch-light: #FAF8F4` / `--swatch-dark: #0F1115` in `:root`, NOT redefined under `.dark`, with fixed on-swatch fg. (2) **Selected cue** — de-emphasize the unselected button (selected full strength, other dimmed); NO accent/ochre/ring, preserving the quiet-by-default + accent-reservation law (ochre stays status/focus-only per ADR-0014). (3) **Code seam** — a dedicated `ThemeToggle` component beside `Segmented` in `live.js`; the generic `Segmented` is left untouched so the card/header switchers and the dashboard Board/Library switcher can't regress. (4) **Task shape** — kept as a single design-system task: the dashboard `ShellRail` consumer swap in `board.js` (agentic-workflow) is mechanical propagation, not new behavior, so no separate aw ticket; flagged board.js as cross-BC in-scope for `work` conflict-avoidance. Rewrote What + 9 testable AC + Notes; promoted to todo (deps met, gate OPEN). An ADR recording the swatch-token + selection-by-de-emphasis precedent is deferred to work-time (worker allocates the number — concurrency-safe).
**Split into:** none
**ADRs written:** none (one deferred to work-time; see task Notes)

---

## 2026-06-09 -- Modeling / Captured: design-system-007 - Theme toggle buttons swatch their own theme

**Type:** Modeling / Capture
**BC:** design-system
**Filed to:** backlog
**Summary:** The Dark/Light theme toggle reads backwards — it uses the generic `Segmented` control (`live.js:15`), which fills the *selected* option with `--surface-inverse`, so in dark mode the selected "Dark" button goes bright and the unselected "Light" stays dark. Builder wants each button to swatch its own theme (Dark = dark bg, Light = light/bright bg) with a separate ring/border cue for selection. Routed to design-system (single-source styleguide per ADR-0003 feeds both its own TopBar and the dashboard ShellRail; the dashboard didn't need to exist for the bug to be true). Scoped to the theme toggle only — the same `Segmented` drives the styleguide card/header switchers and the dashboard Board/Library switcher, which must stay unchanged. Held in backlog (not todo) over a real design fork: fixed swatch values can't reuse the theme-flipping `--surface-0` tokens, and the selected-state cue needs a considered design answer. Frontend → depends_on [design-system-001] (gate OPEN); related_adrs [0003, 0005].

---

## 2026-06-09 11:45 -- Modeling / Refined: design-system-005 - Shared collapsible-section primitive (decoupled from TreeItem) for board + library

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** todo (promoted from backlog)
**Summary:** Refined the shared-`Collapsible` extraction by cornering three API forks
the original capture glossed over (the two existing headers — `TreeGroup` and the
board's `BCSectionHeader` — are not pixel-identical today: count placement, label
truncation, and padding all differ). Builder pinned: (1) **primitive owns show/hide +
renders a styleable body** (`bodyStyle` override) so it holds the open truth and the
`{open && body}` logic lives in one place — controlled (`open`+`onToggle`, board's
persisted view-state ADR-0015) OR uncontrolled (`defaultOpen`, the `TreeGroup`
behavior); (2) **unify to one canonical header look** (a small redesign, not pure
dedup) — adopts the board's stronger treatment (label `flex:1`+ellipsis truncation,
right-aligned count) at the tree's roomier `6px 8px` padding, so `TreeGroup`'s header
shifts visually → **reopens the styleguide gate** for builder re-review (ds-002/003/004
precedent); (3) name+home **`Collapsible` in new `styleguide/app/collapsible.js`**, imported
by both `library.js` and the board. Rewrote What + 6 testable AC (incl. delete the
board-local `BCSectionHeader`, document the pattern on the canvas in both modes, rebuild
the derived `dist/`, and gate re-review). Added ADR-0015 to related_adrs. No split —
cohesive one-commit extraction. Promoted to todo (decisions locked, AC concrete, gate
currently OPEN so a frontend task may be promoted).
**Split into:** none
**ADRs written:** none (decisions captured in the task; ADR-0003/0005/0015 govern)

---

## 2026-06-09 11:30 -- Work session ended

**Type:** Work / Session end
**Completed:** 3 (first-try PASS: 3, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 3 (4588599 ds-006, 67ade09 aw-016, ccdf43d aw-017) + this SHA-backfill chore
**New backlog items:** none
**Notes:** Three sequential waves driven by a dependency chain: ds-006 (TicketCard cornerAction slot + conditional estimate chip) unblocked aw-016 (backlog cards copy `/agentheim:modeling <id>` via that slot), which shared `dashboard/app/board.js` + the agentic-workflow README + the dist bundle with aw-017 (theme toggle) — so aw-017 was held one wave for conflict, then run solo. All three passed verification first try (styleguide 5→ /dashboard 196 tests green by the end). The single shared dashboard `dist/` bundle was rebuilt each wave; verifiers independently confirmed it reproducible from source via `node build.mjs`. Other Claude sessions were concurrently writing `knowledge/index.md`, a research report under `knowledge/research/`, and `lib/task-lifecycle.mjs` — kept strictly out of every `git add` (surgical staging only). Two tasks captured mid-run by a parallel modeling session: aw-017 (executed this session) and the research note on the VS Code terminal bridge.

---

## 2026-06-09 11:27 -- Task verified and completed: agentic-workflow-017 - Wire the styleguide light/dark theme toggle into the dashboard

**Type:** Work / Task completion
**Task:** agentic-workflow-017 - Wire the styleguide light/dark theme toggle into the dashboard
**Summary:** The dashboard now has a working light/dark switch — the styleguide's `Segmented` Dark/Light control rendered unforked in the `ShellRail` header (next to the project name), feeding `ThemeCtx.Provider` and a `data-theme`/`theme-fade` documentElement effect that matches the styleguide `App()` behaviour. Theme resolution + persistence is a sibling of the board view-state: its own versioned `localStorage` store (`dashboard/app/theme-state.js`, key `agentheim.dashboard.theme`) that honors OS `prefers-color-scheme` on first visit, remembers the user's override across reloads, safe-degrades a malformed/stale/absent blob to the system default, and (read once via a lazy mount initializer) survives SSE re-projections without resetting. No design-system source touched — the styleguide gate is not reopened.
**Verification:** PASS (iteration 1)
**Commit:** ccdf43d
**Files changed:** 4 authored (theme-state.js + its test, board.js, BC README) + derived dist bundle
**Tests added:** dashboard/test/theme-state.test.mjs — 13 cases (systemTheme dark/light/no-matchMedia; load empty→null, round-trip, versioned, different-version/malformed/unknown → null, no-backend no-throw; saveTheme refuses unknown; resolveTheme override-wins / first-visit-honors-prefers / malformed-stale→system default). Full dashboard suite 196/196 green; dist byte-identical to a fresh `node build.mjs`.
**ADRs written:** none (pure unforked consumption of the styleguide toggle under ADR-0003/0009, mirroring the ADR-0015 versioned-localStorage persistence pattern; no new decision)

---

## 2026-06-09 11:23 -- Batch started: [agentic-workflow-017]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-017 - Wire the styleguide light/dark theme toggle into the dashboard
**Parallel:** no (1 worker — sole remaining ready task; was held in the prior wave for conflicting with aw-016 on dashboard/app/board.js, now unblocked)

---

## 2026-06-09 -- Research: Dashboard button → Claude Code in a VS Code terminal

**Type:** Research
**Requested by:** user
**Report:** knowledge/research/vscode-dashboard-terminal-bridge-2026-06-09.md
**Review:** PASS (iteration 1)
**Summary:**
- `claude "prompt"` officially starts an interactive session seeded with that prompt; the CLI half is trivial — the bridge is the hard part.
- A Simple-Browser page is sandboxed and a server-spawned process can't reach the visible VS Code terminal (confirmed: the dashboard server itself is detached/`stdio:'ignore'`); only a VS Code-side bridge can.
- Easiest reliable path: a ~30–50-line custom extension running a `127.0.0.1` HTTP listener that calls `createTerminal()` + `sendText('claude "<prompt>"')` (or `activeTerminal.sendText` to inject into a running session).

---

## 2026-06-09 -- Modeling / Captured: agentic-workflow-017 - Wire the styleguide light/dark theme toggle into the dashboard

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** The styleguide is "dark-first with a light toggle" and already ships the *whole* switch — a `Segmented` Dark/Light control in its `TopBar`, the `data-theme` documentElement mechanism, a `theme-fade` transition, and light-mode tokens — but the dashboard (its only consumer) never wires it up: `DashboardApp` hardcodes `useState("dark")` (`board.js:497`) with no setter or control, so the live dashboard is permanently dark. Captured as a **single agentic-workflow task** (not a 2-BC split like aw-016/ds-006): routing test — *if agentic-workflow didn't exist, would this need to happen?* No; the styleguide side already exists and exports everything (`Segmented` from `live.js`, `ThemeCtx`, `[data-theme]` tokens, `theme-fade`), so this is **pure unforked consumption (ADR-0003), no design-system change, gate not reopened**. Two forks pinned with the builder: (1) persistence → **persist + system default** — first visit honors `prefers-color-scheme`, user override remembered in versioned `localStorage` per the ADR-0015 / `board-view-state.js` precedent (malformed/stale/absent → system default), choice survives SSE re-projection; (2) control form → **reuse the styleguide `Segmented` control unforked** in the `ShellRail` header (the dashboard analogue of the styleguide `TopBar`), declining a new dashboard-local icon toggle. Filed straight to todo — pieces all exist, decisions locked, worker can execute without ambiguity. Frontend task → `depends_on: [design-system-001]` (styleguide gate OPEN since 2026-06-05). Wrote Why + What + 9 testable AC (incl. dist rebuild + persistence/default tests); related_adrs [0003, 0009, 0015], prior_art [agentic-workflow-015] (the ShellRail header it lands in).

---

## 2026-06-09 11:18 -- Task verified and completed: agentic-workflow-016 - Backlog cards & the add-ticket button copy the matching /modeling command to the clipboard

**Type:** Work / Task completion
**Task:** agentic-workflow-016 - Backlog cards & the add-ticket button copy the matching /modeling command to the clipboard
**Summary:** Backlog board cards now carry a quiet "Copy" button — supplied into the styleguide `TicketCard`'s `cornerAction` slot (design-system-006), where the dropped estimate chip used to sit — that writes the fully-qualified `/agentheim:modeling <id>` to the system clipboard; the backlog column's add-ticket `+` writes the bare `/agentheim:modeling`. The command string is a pure, unit-tested builder (`dashboard/app/modeling-command.js`) and the clipboard write degrades silently when the API is blocked/absent, so the board never crashes. No lifecycle write — clipboard side-effect only; board stays a projection of disk.
**Verification:** PASS (iteration 1)
**Commit:** 67ade09
**Files changed:** 4 authored (modeling-command.js + its test, board.js, BC README) + derived dist bundle
**Tests added:** dashboard/test/modeling-command.test.mjs — 6 cases (qualified+id; bare for no-id/undefined/null/empty; non-string → bare, never "[object Object]"; whitespace trim; all-whitespace → bare). Full dashboard suite 183/183 green; dist rebuilt and reproducible from source.
**ADRs written:** none (consumes the ds-006 slot unforked under ADR-0003/0009; no new decision)

---

## 2026-06-09 11:14 -- Batch started: [agentic-workflow-016]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-016 - Backlog cards & the add-ticket button copy the matching /modeling command to the clipboard
**Parallel:** no (1 worker — unblocked now that design-system-006 is done; agentic-workflow-017 held to next wave, conflicts on dashboard/app/board.js + the agentic-workflow README + the dist bundle)

---

## 2026-06-09 11:10 -- Task verified and completed: design-system-006 - TicketCard: optional corner action; hide the empty estimate chip

**Type:** Work / Task completion
**Task:** design-system-006 - TicketCard: optional corner action; hide the empty estimate chip
**Summary:** The styleguide `TicketCard` now hides the `… pt` estimate chip when there's no real estimate (the em-dash `—` the dashboard projection feeds no longer shows as dead space; decision lives in the pure, React-free `showEstimate()` in the new `app/card.js`, mirroring `doingPulseClass`), and gained an optional bottom-right `cornerAction` render-prop — a click-isolated (stopPropagation) slot where the styleguide owns look/placement and the consumer owns behavior. Dashboard inherits both unforked (ADR-0003).
**Verification:** PASS (iteration 1)
**Commit:** 4588599
**Files changed:** 6 (2 new styleguide source/test, kanban.js, canvas app.js, BC README, derived dist bundle)
**Tests added:** styleguide/test/ticket-card.test.mjs — showEstimate truth table (real value incl "?" → show; —/empty/whitespace/null/undefined → hide) + source-guard asserts (est chip gated by showEstimate; cornerAction accepted; click stops propagation). Dashboard suite 177/177 green; dist reproducible from source via build.mjs.
**ADRs written:** none (extends ADR-0003's unforked-consumption seam; no new decision)
**Unblocks:** agentic-workflow-016 (its dependency on design-system-006 is now satisfied)

---

## 2026-06-09 11:04 -- Batch started: [design-system-006]

**Type:** Work / Batch start
**Tasks:** design-system-006 - TicketCard: optional corner action; hide the empty estimate chip
**Parallel:** no (1 worker — sole ready task; agentic-workflow-016 blocked on it)

---

## 2026-06-09 -- Modeling / Captured: agentic-workflow-016 + design-system-006 - Copy the /modeling command from backlog cards & the add-ticket button

**Type:** Modeling / Capture
**BC:** agentic-workflow (+ design-system)
**Filed to:** todo (both)
**Summary:** Builder wants the dead "— pt" estimate chip on dashboard board cards (the projection carries no estimate, so `board-data.js` feeds the placeholder `est: '—'`) replaced on backlog cards by a button that copies the command they'll run next, for Ctrl+V into the terminal. Captured as a **2-task set across two BCs**, because the affordance lives *inside* the styleguide `TicketCard`, which the dashboard consumes unforked (ADR-0003) — so a styleguide change blocks the dashboard wiring. **design-system-006:** `TicketCard` hides the estimate chip when there's no real estimate, and gains an optional bottom-right corner-action slot (generic, token-styled, click-isolated from card-open). **agentic-workflow-016:** backlog cards' slot copies `/agentheim:modeling <id>` to the clipboard; the backlog column's add-ticket `+` copies bare `/agentheim:modeling`; todo/doing/done cards get no action and lose the dead chip. Two ambiguities pinned with the builder: (1) command text = fully-qualified `/agentheim:modeling`, not the bare `/modeling` alias; (2) drop the dead estimate chip board-wide, not just backlog. aw-016 `depends_on: [design-system-001, design-system-006]`; ds-006 `blocks: [agentic-workflow-016]`. Both pass the styleguide gate (design-system-001 approved/open). "Copy into memory" disambiguated as the system clipboard, not `.agentheim/` memory.
**Split into:** agentic-workflow-016, design-system-006 (one capture → two BC-scoped tasks)
**ADRs written:** none (extends ADR-0003 / ADR-0009; no new decision)

---

## 2026-06-09 -- Work session ended

**Type:** Work / Session end
**Completed:** 3 (first-try PASS: 3, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 3 (86711f0 ds-004, 7c2facf aw-014, eaacf67 aw-015) + SHA-backfill chore
**New backlog items:** design-system-005 (shared collapsible-section primitive — design-system)
**Notes:** Two waves. Wave 1 ran aw-014 + ds-004 in parallel (held aw-015 — it conflicted with aw-014 on `dashboard/app/board.js` + the agentic-workflow README); wave 2 ran aw-015 alone once aw-014 freed the file. Both parallel workers independently wrote ADRs and raced on the next ADR number — resolved cleanly (ds-004 → ADR-0014, aw-014 → ADR-0015). The shared dashboard `dist/` bundle (one esbuild output over both BCs' source) was authoritatively rebuilt after each wave so the committed bundle reflects every source change; verified to contain both ds-004's pulse and aw-014's grouping. All three passed verification first try.

---

## 2026-06-09 -- Task verified and completed: agentic-workflow-015 - Show the project name next to "Agentheim" in the dashboard header

**Type:** Work / Task completion
**Task:** agentic-workflow-015 - Show the project name next to "Agentheim" in the dashboard header
**Summary:** The `/api/tree` projection now carries a derived `project: { name }` parsed server-side from `vision.md`'s `# Vision: <name>` heading (the first projection value drawn from a markdown body — kept to one trimmed string, body-free ADR-0002 contract intact, mirroring aw-013's `mtimeMs`); `ShellRail` renders `Agentheim · <name>` in muted tokens, degrading to "Agentheim" alone when the vision is missing/headingless.
**Verification:** PASS (iteration 1)
**Commit:** eaacf67
**Files changed:** 3 dashboard source/test + derived dist bundle + BC README
**Tests added:** dashboard/test/tree.test.mjs — `parseProjectName` (heading present / absent / empty-after-colon / whitespace+trailing) + `buildTree` project.name populated and null, asserting the vision body never leaks. Full dashboard suite 177/177 green.
**ADRs written:** none (additive metadata field within ADR-0002's pointers+metadata contract, consistent with the aw-013 precedent)

---

## 2026-06-09 -- Batch started: [agentic-workflow-015]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-015 - Show the project name next to "Agentheim" in the dashboard header
**Parallel:** no (1 worker — sole ready task; unblocked now that aw-014 freed dashboard/app/board.js)

---

## 2026-06-09 -- Task verified and completed: agentic-workflow-014 - Group Kanban board columns by bounded context (collapsible)

**Type:** Work / Task completion
**Task:** agentic-workflow-014 - Group Kanban board columns by bounded context (collapsible)
**Summary:** Each dashboard board column gained an independent group-by-bounded-context lens with collapsible per-BC sections (pure `board-group.js`, run after sort in a project→sort→group pipeline); the per-column view lens (group + sort + collapse) now persists across reloads and live re-projections via a single versioned `localStorage` store (`board-view-state.js`), reversing ADR-0009's no-localStorage clause while keeping board content a pure projection of disk.
**Verification:** PASS (iteration 1)
**Commit:** 7c2facf
**Files changed:** 5 dashboard source/test + derived dist bundle + BC README + ADR
**Tests added:** board-group.test.mjs (pure partition, sort-preserved, ascending BC order, zero-card sections, no mutation), board-view-state.test.mjs (versioned round-trip, malformed/stale/absent degrade safely). Dashboard suite 171/171 green; dist rebuilt to bundle both this and ds-004.
**ADRs written:** 0015-board-view-state-persisted-localstorage.md (ADR-0009 addendum: view-state persistence reversal, board stays a projection of disk)
**New backlog items:** design-system-005 (shared collapsible-section primitive — the styleguide gap this task's board-local header revealed)

---

## 2026-06-09 -- Task verified and completed: design-system-004 - Animated "actively working" treatment for doing-column tickets

**Type:** Work / Task completion
**Task:** design-system-004 - Animated "actively working" treatment for doing-column tickets
**Summary:** Doing-status ticket cards now carry a calm ambient pulse — a slow, low-amplitude breathing glow on the ochre status rail — the styleguide's first continuous (looping) animation, status-keyed (`status === "doing"`, not the `agent` field) in the unforked `TicketCard` so the dashboard inherits it with zero dashboard-side change, and fully stripped under `prefers-reduced-motion`.
**Verification:** PASS (iteration 1)
**Commit:** 86711f0
**Files changed:** 6 source + BC README + ADR
**Tests added:** styleguide/test/doing-pulse.test.mjs (doing card carries the hook, non-doing does not, reduced-motion guard exists). Styleguide 5/5 + dashboard 171/171 green.
**ADRs written:** 0014-ambient-motion-signals-active-status.md (ambient-motion-as-status-signal principle, `--duration-ambient` token, reduced-motion-strips-to-plain contract)

---

## 2026-06-09 -- Batch started: [agentic-workflow-014, design-system-004]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-014 - Group Kanban board columns by bounded context (collapsible), design-system-004 - Animated "actively working" treatment for doing-column tickets
**Parallel:** yes (2 workers)
**Held to next wave:** agentic-workflow-015 (conflicts with aw-014 on dashboard/app/board.js + the agentic-workflow BC README)

---

## 2026-06-09 -- Modeling / Refined: design-system-004 - Animated "actively working" treatment for doing-column tickets

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** todo
**Summary:** Interrogator pass on the raw capture. Cornered three forks against the styleguide's "quiet by default, color only signals status" law: (1) Intensity → **calm ambient pulse** (low-amplitude breathing on the ochre rail), not the capture's literal rotating/glowing background — extends the law rather than breaking it; loud option explicitly declined. (2) Scope → **all doing-status cards** (status-driven, keyed off `ticket.status === "doing"`, not the `agent` field) — the `/api/tree` disk projection can't truthfully know a worker is live, so "in `doing/`" is the honest proxy. (3) Reduced-motion → **plain card** (ordinary ochre rail, no static-glow fallback); pulse is pure progressive enhancement. Settled placement as a finding, not a fork: lives in the styleguide `TicketCard` (`styleguide/app/kanban.js`); dashboard inherits via the unforked import (`board.js:37`, ADR-0003) with zero dashboard-side change. Wrote Why + What + 8 testable AC; added a `--duration-ambient` motion-token requirement (first loop token; styleguide has no `@keyframes` today). Left exact pulse mechanism / token value / keyframes-vs-transition to the worker as TDD-time implementation. Added `depends_on: [design-system-001]` (styleguide gate, OPEN). Promoted backlog → todo.
**Split into:** none
**ADRs written:** none yet — a short ADR (ambient-motion-as-status-signal principle + `--duration-ambient` token + reduced-motion-strips-to-plain contract) specified as a worker deliverable, bidirectionally linked back to ds-004.

---

## 2026-06-09 -- Modeling / Refined: agentic-workflow-015 - Show the project name next to "Agentheim" in the dashboard header

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Cornered three ambiguities in Interrogator mode. (1) Display: `Agentheim · <project>` — project name muted/smaller, separator-dot treatment, no new styleguide pattern. (2) Data path: extend the `/api/tree` projection (`dashboard/tree.mjs`) with a `project: { name }` field parsed server-side from `vision.md`'s `# Vision:` heading — one fetch, rides SSE, follows the aw-013 `mtimeMs` precedent; flagged it as the first projection field drawn from a markdown *body* (one trimmed string, body-free contract from ADR-0002 holds). (3) Fallback: missing/headingless vision → show "Agentheim" only (loss-tolerant). Sharpened to 7 testable AC across projection / header / tests. Noted the shell-sources-the-name implementation choice (only `DashboardBoard` fetches `/api/tree` today). Added `depends_on: [design-system-001]` (frontend gate, met). Promoted backlog → todo.
**Split into:** none
**ADRs written:** none (projection-field extension consistent with existing precedent; no standalone ADR warranted)

---

## 2026-06-09 -- Modeling / Promoted: agentic-workflow-014 - Group Kanban board columns by bounded context (collapsible)

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-06-09 -- Modeling / Refined: agentic-workflow-014 - Group Kanban board columns by bounded context (collapsible)

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Interrogator pass on the raw capture. Cornered three forks: per-column toggle (not board-wide); collapsible BC sections (not contiguous runs); persist view-state across reloads — and the builder extended that to the existing column-sort too. Surfaced the flat-board tension (ADR-0009) and reframed grouping as an optional per-column *view lens* over the same read model. The persistence ask **reverses** ADR-0009's "in-session view-state only, no localStorage" clause and amends agentic-workflow-012's sort behavior — specified as a worker-written ADR-0009 addendum (infrastructure-010 precedent). Wrote Why + What + 13 testable acceptance criteria, a new pure `board-group.js` transform (project→sort→group), styleguide-gate `depends_on: [design-system-001]`, prior_art [aw-006, aw-012], related_adrs [0009]. Flagged the open styleguide-component question (reuse `TreeGroup` collapsible vs board-local + design-system capture) for the worker to settle during TDD. Considered splitting the sort-persistence flip into its own task; kept as one commit (shared localStorage store). Left in backlog pending promote decision.
**Split into:** none
**ADRs written:** none yet (ADR-0009 addendum specified as worker deliverable)

---

## 2026-06-08 14:40 -- Release shipped: v0.8.4

**Type:** Release
**Version:** 0.8.3 → 0.8.4 (patch — infrastructure-010: env-independent `/dashboard` launcher resolver, fixing the empty-`$CLAUDE_PLUGIN_ROOT` field failure that made the dashboard unlaunchable from consumer projects)
**Manifest:** `.claude-plugin/plugin.json` bumped, committed `9b8d783` (`chore(release): v0.8.4`)
**Pushed to main:** yes (`99179c6..9b8d783` on `origin/main`)
**Tag:** `v0.8.4` (annotated) → `9b8d783`, pushed to origin
**GitHub Release:** deferred (gh unavailable — `gh release create` line handed to builder)

---

## 2026-06-08 14:36 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (f74cd97 infrastructure-010)
**Note:** Only ready task was infrastructure-010. Three backlog items remain unrefined (agentic-workflow-014, agentic-workflow-015, design-system-004) — not ready work; need `modeling` to refine/promote.

---

## 2026-06-08 14:35 -- Task verified and completed: infrastructure-010 - $CLAUDE_PLUGIN_ROOT empty at /dashboard runtime

**Type:** Work / Task completion
**Task:** infrastructure-010 - $CLAUDE_PLUGIN_ROOT is empty at /dashboard runtime — 008's fix collapses to the broken project path
**Summary:** Replaced the empty-`$CLAUDE_PLUGIN_ROOT` `/dashboard` launcher locator with an env-var-independent resolver (`dashboard/resolve-launcher.mjs`) that derives the plugin cache from `os.homedir()`, picks newest version by **semver** (not lexical), fails loud, and spawns `launch.mjs` cwd-inherited so foreign-project discovery still resolves. Card now uses a minimal env-free `node -e` bootstrap delegating to the resolver.
**Verification:** PASS (iteration 1)
**Commit:** f74cd97
**Files changed:** 9
**Tests added:** resolve-launcher.test.mjs (semver-max incl. 0.8.10>0.8.9 trap, homedir→cache on win32+POSIX, fail-loud, repo-local short-circuit); foreign-launch.test.mjs amended to DELETE the env var from the child; command-card guard updated. Full dashboard suite 150/150 green.
**ADRs written:** 0002-dashboard-runtime-transport.md (addendum — env-independent locator contract)
**Caveat:** Installed-plugin end-to-end run + cross-shell `node -e` quoting confirmable only by the maintainer post-release (repo-bound worker cannot observe a real Claude Code `/dashboard` invocation). Flagged, not falsely claimed verified.

---

## 2026-06-08 14:20 -- Batch started: [infrastructure-010]

**Type:** Work / Batch start
**Tasks:** infrastructure-010 - $CLAUDE_PLUGIN_ROOT empty at /dashboard runtime — env-independent Node resolver
**Parallel:** no (1 worker — sole ready task)

---

## 2026-06-08 14:10 -- Modeling / Refined: infrastructure-010 - $CLAUDE_PLUGIN_ROOT empty at /dashboard runtime

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo
**Summary:** Routed to claude-code-guide (platform ground truth) + orchestrator/architect (mechanism). Confirmed `$CLAUDE_PLUGIN_ROOT` is doc-gapped for command-card Bash calls and empirically empty on Windows; decided fix is a stdlib Node resolver (`dashboard/resolve-launcher.mjs`) that derives the cache path from `os.homedir()`, picks newest version by SEMVER (not lexical), fails loudly, and spawns the real launcher with cwd inherited (script-in-cache + cwd-in-project preserved). Sharpened to 11 testable acceptance criteria; infrastructure-009 test seam to be amended to delete the env var from the child. Flagged one worker-settles-empirically open question (the `node -e` bootstrap that locates the resolver itself has the same chicken-and-egg) and a verification-realism caveat: a repo-bound worker can build + simulate but only the maintainer can confirm end-to-end as an installed plugin post-release (the exact gap that let 008 ship broken). ADR-0002 addendum to be written by the worker. Promoted backlog → todo.
**Split into:** none
**ADRs written:** none yet (ADR-0002 addendum specified as worker deliverable)

---

## 2026-06-08 14:00 -- Modeling / Captured: infrastructure-010 - $CLAUDE_PLUGIN_ROOT empty at /dashboard runtime

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** backlog
**Summary:** Real v0.8.3 run from a foreign project (jump_n_rogue/dorc) proves infrastructure-008's central assumption false: `$CLAUDE_PLUGIN_ROOT` comes through **empty** in the /dashboard command's Bash context, so the `${VAR:-.}` fallback collapses to the project path and reproduces the exact module-not-found error 008 set out to fix. Captured as a distinct follow-up bug (008 is done, not re-openable). Mechanism — resolve the launcher without relying on the env var — left to refinement.

---

## 2026-06-08 13:35 -- Release shipped: v0.8.3

**Type:** Release
**Version:** 0.8.2 → 0.8.3 (patch — infrastructure-009 test seam, no new user-facing capability)
**Manifest:** `.claude-plugin/plugin.json` bumped, committed `635cca5` (`chore(release): v0.8.3`)
**Pushed to main:** yes (`dc48448..635cca5` on `origin/main`) — this is what moves marketplace users off "already at latest"
**Tag:** `v0.8.3` (annotated) → `635cca5`, pushed to origin
**Note:** origin still points at the old lowercase URL (`heimeshoff/agentheim`); GitHub redirected to `heimeshoff/Agentheim` and both push + tag-push succeeded. Worth updating the remote URL at some point.

---

## 2026-06-08 13:30 -- Capture / Captured: agentic-workflow-015 - Show the project name next to "Agentheim" in the dashboard header

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Dashboard header should show the current project's name (from vision.md) next to the word "Agentheim".

---

## 2026-06-08 13:05 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (ac9ae4d infrastructure-009)
**Note:** A parallel capture session ran concurrently — new backlog items agentic-workflow-014 and design-system-004 were filed mid-run (backlog only, not ready work).

---

## 2026-06-08 13:04 -- Task verified and completed: infrastructure-009 - Command-card invocation test seam

**Type:** Work / Task completion
**Task:** infrastructure-009 - Add a test seam for slash-command card invocation (catch project-relative launcher paths)
**Summary:** Added a committed stdlib-only test seam guarding the /dashboard launcher invocation against the project-relative-path regression class — a static guard over commands/dashboard.md (three verbs plugin-rooted, no cd, no bare printed hint, with Red-proof meta-tests) plus a foreign-project integration test that runs the literal card command form launch→status→stop in a temp .agentheim/-only project, asserts the runfile lands under the consumer project, and tears down in finally. The infrastructure-008 hand-run simulation is now permanent.
**Verification:** PASS (iteration 1)
**Commit:** ac9ae4d
**Files changed:** 4 (command-card.test.mjs, foreign-launch.test.mjs, test/helpers/card.mjs, infrastructure BC README)
**Tests added:** new command-card + foreign-launch suites; full dashboard suite 132/132 green
**ADRs written:** none (makes the existing ADR-0002 contract testable; no new decision)

---

## 2026-06-08 12:00 -- Capture / Captured: agentic-workflow-014 - Group Kanban board columns by bounded context (collapsible)

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Add a group-by/ungroup-by-bounded-context button next to the board's sort combo box; grouped sections are collapsible.

---

## 2026-06-08 13:00 -- Capture / Captured: design-system-004 - Animated "actively working" treatment for doing-column tickets

**Type:** Capture
**BC:** design-system
**Filed to:** backlog
**Summary:** Doing-column tickets should have an animated/glowing/rotating background so it's visually obvious work is actively happening; exact visual idea still open.

---

## 2026-06-08 13:00 -- Batch started: [infrastructure-009]

**Type:** Work / Batch start
**Tasks:** infrastructure-009 - Add a test seam for slash-command card invocation (catch project-relative launcher paths)
**Parallel:** no (1 worker — sole ready task)

---

## 2026-06-08 12:48 -- Modeling / Refined: infrastructure-009 - Command-card invocation test seam

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo
**Summary:** Refined the infrastructure-008 TDD-skip follow-up. Cornered the one open decision — the "and/or" test scope — and committed to **both** approaches: a stdlib-only static guard (parse `commands/dashboard.md`, assert plugin-rooted prefix on all three verbs + no `cd`) **and** a foreign-project integration test (temp project with only `.agentheim/`, run the real launch→status→stop via `${CLAUDE_PLUGIN_ROOT}`, assert the runfile lands under it, clean up in `finally`). Also extended the static guard to the launcher's printed hint strings (the `/dashboard stop` correction 008 made). Acceptance criteria split to 5 concrete bullets; teardown/cross-platform risk noted for the worker. Promoted backlog → todo — ready to work.
**Split into:** none
**ADRs written:** none (makes an existing ADR-0002 contract testable; no new decision)

---

## 2026-06-08 12:42 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (a702143 infrastructure-008)

---

## 2026-06-08 12:42 -- Task verified and completed: infrastructure-008 - Dashboard command launcher path

**Type:** Work / Task completion
**Task:** infrastructure-008 - Dashboard command must invoke the launcher by plugin path, not project-relative
**Summary:** `/dashboard` now invokes the launcher by its plugin-rooted path (`node "${CLAUDE_PLUGIN_ROOT:-.}/dashboard/launch.mjs"`) for all three verbs while keeping the consumer project as cwd, so launch/stop/status work in a foreign project with no module-not-found error and no manual plugin-cache spelunking. The `:-.` fallback covers a run from the Agentheim repo itself.
**Verification:** PASS (iteration 1)
**Commit:** a702143
**Files changed:** 4 (commands/dashboard.md, dashboard/launch.mjs, dashboard/README.md, infrastructure BC README) + new backlog item infrastructure-009
**Tests added:** 0 (command-card change; no command-card test infra — backlog item infrastructure-009 filed to add it; behavior exercised via end-to-end simulation, existing dashboard suite 124/124 green)
**ADRs written:** none (natural consequence of ADR-0002's walk-up-from-cwd discovery clause; documented in both READMEs, sibling to infrastructure-004)

---

## 2026-06-08 12:36 -- Batch started: [infrastructure-008]

**Type:** Work / Batch start
**Tasks:** infrastructure-008 - Dashboard command must invoke the launcher by plugin path, not project-relative
**Parallel:** no (1 worker — sole ready task)

---

## 2026-06-08 -- Modeling / Captured: infrastructure-008 - Dashboard command launcher path

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** todo
**Summary:** Captured from a real foreign-project session: `/agentheim:dashboard` ran the command card's `node dashboard/launch.mjs` from the consumer project root and hit `Cannot find module '...\dorc\dashboard\launch.mjs'` — the launcher ships with the plugin, not the project, forcing manual plugin-cache spelunking and version-guessing. The command-invocation sibling of infrastructure-004 (which fixed the launcher's *internal* module-relative asset resolution): the project-root assumption survives one layer up at the slash-command → launcher seam. Fix direction: invoke the launcher by plugin path (likely `${CLAUDE_PLUGIN_ROOT}`), keeping cwd in the consumer project so `.agentheim/` discovery still works; worker to verify command-body interpolation. Prior art: infrastructure-004, infrastructure-001; governing ADR-0002.

---

## 2026-06-08 -- Work session ended (resumed)

**Type:** Work / Session end
**Completed:** 1 (infrastructure-007 — first-try PASS) — this resumed leg, after the builder authorized the full release
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (6e69b80 infrastructure-007) — landed on `main` via fast-forward merge of feature branch `Marketplace-update-not-working`.
**Release:** **SHIPPED** (builder authorized the merge-to-main path). The work was found on feature branch `Marketplace-update-not-working` (5 ahead of local `main`; local `main` was 11 ahead of `origin/main`); fast-forwarded the branch into `main` and pushed (`c0f835a..8020832`, 16 commits). Cut annotated tag **`v0.8.2`** at the bump commit `6e69b80` and pushed it — remote `refs/tags/v0.8.2` → `6e69b80`. Manifest now 0.8.2 > 0.8.0, so `/plugin` offers the update (off "already at latest"). Published `v0.8.1` tag left untouched.
**Notes:** all todo/ and doing/ are empty across every BC. Feature branch `Marketplace-update-not-working` is fully merged into `main` (safe to delete).

---

## 2026-06-08 -- Task verified and completed: infrastructure-007 - Bump plugin version to 0.8.2

**Type:** Work / Task completion
**Task:** infrastructure-007 - Bump plugin version to 0.8.2 + cut v0.8.2 tag to unblock marketplace updates
**Summary:** Bumped the sole version source `.claude-plugin/plugin.json` 0.8.0 → 0.8.2, correcting the bump skipped when `v0.8.1` was tagged. Repo-wide check confirmed no other version reference must agree (`marketplace.json` has none; no CHANGELOG/badge).
**Verification:** PASS (iteration 1) — manifest reads 0.8.2, no other field changed, no second version source; worker-satisfiable core only (tag/push are the orchestrator release act).
**Commit:** 6e69b80 (merged to `main`; pushed)
**Release tag:** v0.8.2 — annotated, at `6e69b80`, pushed to origin (`refs/tags/v0.8.2` → `6e69b80`). Manifest 0.8.2 now live on `origin/main`.
**Files changed:** 1 (`.claude-plugin/plugin.json`)
**Tests added:** 0 (manifest bump)
**ADRs written:** none (mechanics per ADR-0013 / RELEASE.md)

---

## 2026-06-08 -- Batch started: [infrastructure-007]

**Type:** Work / Batch start
**Tasks:** infrastructure-007 - Bump plugin version to 0.8.2 + cut v0.8.2 tag to unblock marketplace updates
**Parallel:** no (1 worker — picked up after the builder authorized the full release, incl. the tag-cut + push the task flagged as a builder act)

---

## 2026-06-08 -- Work session ended

**Type:** Work / Session end
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0) — agentic-workflow-013 then agentic-workflow-012
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2 (9a0db2d aw-013, 19e5870 aw-012) on `main`
**Notes:**
- Ran the DAG in two sequential waves: aw-013 (read-model mtime) had to land before aw-012 (board sort), which depended on it. Both verified PASS first try.
- A parallel `modeling`/`capture` session created **infrastructure-007** (bump plugin version 0.8.2 + cut v0.8.2 tag) mid-run; it prepended its own protocol/INDEX changes. Left untouched by this work run and **surfaced to the builder** — it is a release task whose tag-cut + push to `main` is a builder git act (per its own notes), not auto-dispatched.
- Uncommitted at session end (intentionally not swept into the task commits): `infrastructure/INDEX.md` + `infrastructure/todo/infrastructure-007-*.md` (the parallel modeling session's, awaiting the builder's release decision).

---

## 2026-06-08 -- Modeling / Captured: infrastructure-007 - Bump plugin version to 0.8.2 + cut v0.8.2 tag

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** todo
**Summary:** Tester reported `/plugin` stuck on *"already at latest"*. Verified: tag `v0.8.1` (main HEAD `6252320`) ships the `capture` skill + POSIX dashboard fixes, but `.claude-plugin/plugin.json` at that tag and on `main` still reads `0.8.0` — the manifest bump was skipped when v0.8.1 was tagged, so the marketplace never offers the update. Second occurrence of the drift `infrastructure-005` fixed, on the first release after ADR-0013 codified the discipline. Captured the immediate unblock only (builder-chosen shape: bump manifest `0.8.0 → 0.8.2` + cut a fresh `v0.8.2` tag, leaving the published `v0.8.1` untouched; mechanics per ADR-0013 / RELEASE.md). The reopen-the-checklist-vs-CI-guard decision was deliberately *not* captured. Tester's literal claim (main at 0.7.0, v0.8.1 not on main) was stale — corrected to 0.8.0 / v0.8.1-is-HEAD.

---

## 2026-06-08 -- Task verified and completed: agentic-workflow-012 - Add sorting options to Kanban board columns

**Type:** Work / Task completion
**Task:** agentic-workflow-012 - Add sorting options to Kanban board columns
**Summary:** Each board column gained an independent sort control (Name asc/desc, Modification-date desc/asc; default mod-date descending) rendered board-side as a sibling of the styleguide `ColumnHeader` (DragColumn precedent, no fork). Reordering is a pure, DOM-free `board-sort.js` comparator run after `treeToColumns`, derived at render so every live re-projection re-applies the choice; in-session view-state only (no localStorage); null `mtimeMs` sorts as oldest, ties break by id.
**Verification:** PASS (iteration 1) — all eight acceptance criteria mapped to tests/structural code; full dashboard suite 124 pass / 0 fail; styleguide `kanban.js` confirmed unforked.
**Commit:** 19e5870
**Files changed:** 7 (`board-sort.js` + test, `board.js`, `board-data.js` + test, `dist/app.js` rebuilt, BC README)
**Tests added:** 14 (12 comparator + 2 mtime pass-through)
**ADRs written:** none (mtime within ADR-0002; board-side affordance within ADR-0003/0009)

---

## 2026-06-08 -- Batch started: [agentic-workflow-012]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-012 - Add sorting options to Kanban board columns
**Parallel:** no (1 worker — sole ready task; unblocked now that aw-013 + design-system-001-styleguide are both done)

---

## 2026-06-08 -- Task verified and completed: agentic-workflow-013 - Carry task file modification time (mtimeMs) in the /api/tree projection

**Type:** Work / Task completion
**Task:** agentic-workflow-013 - Carry task file modification time (mtimeMs) in the /api/tree projection
**Summary:** `/api/tree` projection (`projectTask` in `dashboard/tree.mjs`) now carries each task file's `mtimeMs` as additive per-task metadata; a stat failure degrades to `mtimeMs: null` without aborting the walk — unblocking aw-012's mod-date-descending board sort.
**Verification:** PASS (iteration 1) — all five acceptance criteria covered; full dashboard suite 110 pass / 0 fail.
**Commit:** 9a0db2d
**Files changed:** 2 (`dashboard/tree.mjs`, `dashboard/test/tree.test.mjs`)
**Tests added:** 2 (numeric mtimeMs present; unstattable file → mtimeMs null)
**ADRs written:** none (mtime is metadata within ADR-0002's pointers+metadata contract)

---

## 2026-06-08 -- Batch started: [agentic-workflow-013]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-013 - Carry task file modification time (mtimeMs) in the /api/tree projection
**Parallel:** no (1 worker — sole ready task; aw-012 blocked on aw-013)

---

## 2026-06-08 -- Modeling / Promoted: agentic-workflow-013 + agentic-workflow-012

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo (both)
**Note:** aw-013 (tree-projection mtime) is unblocked — its only dep, aw-005, is done. aw-012 (board column sorting) is ready but blocked by aw-013; `work` resolves the DAG, so aw-012 won't be claimed until aw-013 lands.

---

## 2026-06-08 -- Modeling / Refined: agentic-workflow-012 - Add sorting options to Kanban board columns

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog (both tasks; ready to promote)
**Summary:** Interrogated the raw capture. Builder's answers: Why = surface recently-touched work (validates the mod-date-desc default); Scope = per-column independent sort; Persistence = reset to default each load, no localStorage. Two scouted findings drove the shape — (A) the `/api/tree` projection carries no file mtime, so the default sort is impossible from the current read model; (B) the styleguide `ColumnHeader` has no sort slot and ADR-0003 forbids forking it. Orchestrator (tactical-modeler + architect) resolved: split the mtime read-model change into its own task (shared contract, own commit), and render the sort control board-side as a sibling of `ColumnHeader` (the `DragColumn` precedent — no fork, no design-system task). Rewrote aw-012 with concrete acceptance criteria (per-column independent, reset-to-default, live-update re-apply, deterministic tie-breaks, pure comparator module) as a frontend-only task depending on aw-013 + design-system-001-styleguide.
**Split into:** agentic-workflow-013 (Carry task file modification time (mtimeMs) in the /api/tree projection — type: refactor, depends_on aw-005, blocks aw-012)
**ADRs written:** none (mtime is metadata within ADR-0002's pointers+metadata contract; board-side affordance governed by existing ADR-0003 — no new ADR warranted)

---

## 2026-06-08 -- Capture / Captured: agentic-workflow-012 - Add sorting options to Kanban board columns

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Board columns should be sortable by name (asc/desc) and last file modification date; default = modification date descending.

---

## 2026-06-08 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (e6ded37 infrastructure-006) — on branch `POSIX-dashboard-fixes`
**Notes:**
- infrastructure-006 (plugin release discipline) landed: ADR-0013 + top-level `RELEASE.md` + infrastructure README pointer. Verified PASS iteration 1.
- Orchestrator stripped stray tool-call markup (`</content>`/`</invoke>`) the worker accidentally wrote into the tail of both the ADR and `RELEASE.md` before commit — cosmetic, no criterion impact, flagged by the verifier.
- **All todo/ and doing/ are now empty across every BC.** Nothing left ready.
- Untouched pre-existing working-tree state (not part of this run): `skills/capture/` and `skills/capture-workspace/` (untracked) — surfaced to the builder for a separate decision.

---

## 2026-06-08 -- Task verified and completed: infrastructure-006 - Plugin release discipline

**Type:** Work / Task completion
**Task:** infrastructure-006 - Plugin release discipline — stop the manifest version from silently drifting
**Summary:** Recorded the release policy as ADR-0013 — a release is the deliberate act of cutting a `vX.Y.Z` git tag matching the sole version source (`plugin.json` `version`), enforced by a documented checklist (CI guard and commit-derived versioning weighed and rejected). Shipped the discoverable top-level `RELEASE.md` (bump → commit → push to `main` → tag, with push-to-`main` named as the step that actually moves marketplace users off "already at latest") and pointed the infrastructure BC README at it.
**Verification:** PASS (iteration 1) — all six acceptance criteria covered; orchestrator stripped stray tool-markup the worker leaked into the tail of the ADR and RELEASE.md before commit.
**Commit:** e6ded37
**Files changed:** 3 (ADR-0013, RELEASE.md, infrastructure README)
**Tests added:** 0 (doc-only decision task)
**ADRs written:** 0013-plugin-release-discipline.md

---

## 2026-06-08 -- Batch started: [infrastructure-006]

**Type:** Work / Batch start
**Tasks:** infrastructure-006 - Plugin release discipline — stop the manifest version from silently drifting
**Parallel:** no (1 worker — sole ready task)

---

## 2026-06-08 -- Modeling / Refined: infrastructure-006 - Plugin release discipline

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo (promoted backlog → todo)
**Summary:** Cornered the decision direction with the builder. Chosen: a **documented
release checklist** (CI guard and commit-derived versioning weighed and rejected), bump
triggered at **deliberate releases** = cutting a `vX.Y.Z` git tag (manifest may lag `main`
between releases), checklist bound to the tag act so the bump can't be skipped. Recon
recorded: only `plugin.json` carries a version (`marketplace.json` has none); no CI/hooks
today but a GitHub remote exists. Rewrote acceptance criteria — output is ADR + a
discoverable `RELEASE.md` checklist + BC README pointer; no follow-up tooling task
(enforcement is doc-only). Promoted to todo.
**Split into:** none
**ADRs written:** none (the ADR is this task's deliverable, written when worked)

---

## 2026-06-08 -- Work session ended (resumed)

**Type:** Work / Session end
**Completed:** 1 (agentic-workflow-010 — verification skipped: human-verified spike) — this resumed leg
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (06f0ac0 agentic-workflow-010) — on branch `POSIX-dashboard-fixes`
**Notes:**
- Resumed after the builder confirmed the POSIX contributor re-ran the infrastructure-004 fix and the foreign-project asset path now serves on POSIX. That closed agentic-workflow-010's last (environmental) criterion, so the spike moved backlog/todo → done.
- **All todo/ and doing/ are now empty across every BC.** Session total across both legs: 3 tasks completed (infrastructure-004, infrastructure-005, agentic-workflow-010), 0 bounced, 0 failed, 0 escalated.
- Open follow-up still in backlog: **infrastructure-006** (plugin release discipline) — needs a refine pass before it is workable. Not part of this run.

---

## 2026-06-08 -- Task completed (verification skipped): agentic-workflow-010 - Dashboard cross-OS verification (POSIX leg)

**Type:** Work / Task completion
**Task:** agentic-workflow-010 - Dashboard cross-OS verification — POSIX leg
**Summary:** Closed the spike. Windows + POSIX parity confirmed: the macOS leg passed clean except the one divergence it existed to catch (`defaultAssetRoot` 404 on a foreign project), which was carved to infrastructure-004, fixed module-relative (716c7f0), and re-verified on POSIX by the contributor with the fix in place. No ADR addendum — infra-004 restored the ADR-0002/0004 contract rather than shifting it. BC README left unchanged (verification status belongs in the task Outcome + protocol, not the domain-model README).
**Verification:** SKIPPED — spike completion; the substantive verification was performed by a human POSIX contributor, and the only change is the task file's own outcome bookkeeping (no code / ADR diff to audit).
**Commit:** 06f0ac0
**Files changed:** 1 (the task file)

---

## 2026-06-08 -- Batch started: [agentic-workflow-010]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-010 - Dashboard cross-OS verification (POSIX leg)
**Parallel:** no (1 worker — closing the spike now that its infra-004 blocker is fixed and the POSIX contributor confirmed the foreign-project re-check)

---

## 2026-06-08 -- Work session ended

**Type:** Work / Session end
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2 (716c7f0 infrastructure-004, 41fabcb infrastructure-005) — on branch `POSIX-dashboard-fixes`
**Notes:**
- infrastructure-004 (assetRoot module-relative) and infrastructure-005 (version bump 0.8.0) both landed, each verified PASS on iteration 1. infrastructure todo/ + doing/ are now empty.
- **agentic-workflow-010 NOT dispatched.** Its blocker (infrastructure-004) is now fixed, so it is dependency-unblocked, but its sole remaining acceptance criterion — installed-plugin-against-a-foreign-project asset serving re-checked **on a POSIX box** — is environmental and cannot be satisfied from this Windows session. Left in todo for coordination with a POSIX contributor. Dispatching a Windows worker would only bounce.
- **Pre-existing uncommitted modeling state left untouched** (predates this session, belongs to the aw-010 refine / infra-004-005-006 capture): `.agentheim/contexts/agentic-workflow/INDEX.md` (M), the aw-010 backlog→todo move (`backlog/` deletion + new `todo/`), and the infrastructure-006 backlog task. Not part of this work run — surfaced to the builder for a separate commit decision.

---

## 2026-06-08 -- Task verified and completed: infrastructure-005 - Bump plugin version to 0.8.0

**Type:** Work / Task completion
**Task:** infrastructure-005 - Bump plugin version to 0.8.0 to unblock marketplace updates
**Summary:** Bumped `.claude-plugin/plugin.json` version 0.7.0 → 0.8.0 so `/plugin` stops reporting marketplace users as already-latest and ships the ~30 commits of accumulated dashboard/design-system/infrastructure work. No other manifest field changed; no other version reference in the repo to reconcile.
**Verification:** PASS (iteration 1) — manifest reads 0.8.0, sole field changed, valid JSON; criterion 3 (other version references) N/A.
**Commit:** 41fabcb
**Files changed:** 1
**Tests added:** 0
**ADRs written:** none

---

## 2026-06-08 -- Batch started: [infrastructure-005]

**Type:** Work / Batch start
**Tasks:** infrastructure-005 - Bump plugin version to 0.8.0 to unblock marketplace updates
**Parallel:** no (1 worker)

---

## 2026-06-08 -- Task verified and completed: infrastructure-004 - Resolve dashboard assetRoot relative to the module

**Type:** Work / Task completion
**Task:** infrastructure-004 - Resolve dashboard assetRoot relative to the module, not the project root
**Summary:** `defaultAssetRoot` now resolves dist/ module-relative (via import.meta.url) instead of against the discovered project root, so an installed plugin against a foreign project serves its committed assets (no false "dist absent" 404). Added a foreign-root regression test + AGENTHEIM_DASHBOARD_DIST dev override.
**Verification:** PASS (iteration 1) — dashboard suite 108/108, lib 13/13 green; all in-suite acceptance criteria met. POSIX foreign-project box re-check deferred to aw-010 (environmental).
**Commit:** 716c7f0
**Files changed:** 4
**Tests added:** 2
**ADRs written:** none

---

## 2026-06-08 -- Batch started: [infrastructure-004]

**Type:** Work / Batch start
**Tasks:** infrastructure-004 - Resolve dashboard assetRoot relative to the module, not the project root
**Parallel:** no (1 worker — infra-005 held to next wave to avoid a same-BC-README conflict)

---

## 2026-06-08 -- Modeling / Refined: agentic-workflow-010 - Dashboard POSIX cross-OS verification

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (promoted from backlog)
**Summary:** Reconciled the spike with reality — its "keep in backlog until a POSIX box is
available" premise was stale. A macOS contributor (protocol 2026-06-08) had already run the leg
to an effectively clean full pass; builder confirmed all six criteria were exercised. Rewrote the
task to re-state the macOS pass as confirmed (criteria checked) and narrow the residual to the one
divergence the leg surfaced: the `defaultAssetRoot` bug (now **infrastructure-004**). Added
`infrastructure-004` to `depends_on` (alongside aw-001) — aw-010 is not done until that fix lands
and the installed-plugin-against-foreign-project asset path is re-checked on POSIX. The final
re-check remains environmental (needs a POSIX box).
**Split into:** none (infra-004 / infra-005 were carved out in the prior capture, not this refine)
**ADRs written:** none

---

## 2026-06-08 -- Modeling / Captured: infrastructure-006 - Plugin release discipline

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** backlog
**Summary:** Spun out infrastructure-005's open process question into a `decision` task:
decide and ADR-record how plugin version bumps are governed (bump-on-feature policy /
release checklist / CI guard / combination) so the manifest stops drifting behind `main`.
Backlog — needs a refine pass (possibly `architect` on the CI-guard option) before todo.

---

## 2026-06-08 -- Modeling / Captured: infrastructure-004 + infrastructure-005 (from macOS POSIX-verification feedback)

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** todo (both)
**Summary:** A macOS contributor verifying agentic-workflow-010 (POSIX cross-OS leg)
reported two issues outside that spike's scope, captured here:
- **infrastructure-004** (bug) — `defaultAssetRoot` resolves `dist/` against the discovered
  project root, so the installed plugin can't find its built assets against a foreign
  project (404 "dist absent"). Fix: resolve module-relative (`import.meta.url`), like the
  sibling `launch.mjs`/`build.mjs`. Routed to infrastructure as a runtime/transport concern
  (sibling to infra-001/002, governed by ADR-0004), not agentic-workflow.
- **infrastructure-005** (chore) — `.claude-plugin/plugin.json` still on 0.7.0 while `main`
  is ~30 commits ahead; `/plugin` reports "already at latest" and marketplace users can't
  pull updates. Bump to 0.8.0. Left an open process question (release discipline) for a
  possible follow-up.
The same feedback confirms agentic-workflow-010's POSIX leg ran clean (detached launch,
runfile, SSE, /api/tree) — pending PR merge before that task is moved to done.

---

## 2026-06-07 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 1 (ca3a150 — aw-011 /dashboard slash command)
**Notes:**
- Single ready task (aw-011) → one worker, verified PASS on the first iteration. todo/ and
  doing/ are now empty across all BCs; backlog holds only aw-010 (POSIX cross-OS leg,
  `depends_on: [agentic-workflow-001]`).
- **Pre-existing uncommitted changes left untouched** (predate this session): `.agentheim/vision.md`
  and `references/modes.md` (the "stale framing" resolution from a prior session). Not part of
  aw-011 — deliberately not staged. Surfaced to the builder for a separate commit decision.
- **EOL-only noise:** `dashboard/dist/app.js` + `dashboard/dist/index.html` show as modified but
  the diff is LF→CRLF only (no content change); not attributed to aw-011, not committed.

---

## 2026-06-07 -- Task verified and completed: agentic-workflow-011 - /dashboard command

**Type:** Work / Task completion
**Task:** agentic-workflow-011 - /dashboard command — launch, stop, status, auto-open
**Summary:** Added the `/dashboard` slash command — the single documented exception to the
"phrasing, not slash commands" principle — as a thin `commands/dashboard.md` trigger over the
existing launcher (aw-004), extending `dashboard/launch.mjs` with a read-only `status` verb and
a cross-OS browser auto-open step (`start`/`open`/`xdg-open`), both confined to the launcher per
ADR-0002.
**Verification:** PASS (iteration 1) — verifier ran both suites green (dashboard 106/106 incl. 6
new tests, lib 13/13) and confirmed all six acceptance criteria, scope, and the BC-README
slash-command-exception documentation.
**Commit:** ca3a150
**Files changed:** 5 (launch.mjs, commands/dashboard.md, status-open.test.mjs, dashboard/README.md, BC README)
**Tests added:** 6
**ADRs written:** none

---

## 2026-06-07 -- Batch started: [agentic-workflow-011]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-011 - /dashboard command — launch, stop, status, auto-open
**Parallel:** no (1 worker)

---

## 2026-06-07 -- Modeling / Captured: agentic-workflow-011 - /dashboard command

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** Captured a `/dashboard` command that drives the existing `dashboard/launch.mjs`
launcher (aw-004): launch (+ auto-open browser), stop, and a new status verb. Today the launcher
only runs via `node dashboard/launch.mjs`; this supplies the missing trigger. Filed straight to
todo (decisions settled, no UI authored → no styleguide gate). One ubiquitous-language change
required: document `/dashboard` as a deliberate slash-command exception to the "phrasing, not
slash commands" principle (builder decision 2026-06-07).

---

## 2026-06-06 -- Work session ended

**Type:** Work / Session end
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 3 (b1cf113 model: narrow aw-001 to Windows + carve aw-010; 8af5748 feature: close aw-001 epic; + SHA-backfill chore)
**Notes:**
- **aw-001 (the dashboard integration epic) is now done** — the dashboard cluster is fully
  closed. todo/ and doing/ are empty across all BCs.
- One mid-run modeling refinement: the epic's v1 acceptance bar was narrowed to Windows-only at
  the builder's decision (the integration pass ran from a Windows-only box); the POSIX cross-OS
  leg was carved into **agentic-workflow-010** (backlog, depends_on aw-001). Routed through a
  `model(...)` commit before dispatching the worker — `work` does not relax AC silently.
- **Pre-existing uncommitted changes left untouched** (predate this session, not mine): deleted
  backlog files aw-003 + infrastructure-002, modified infrastructure-001 (done), and untracked
  ADR-0003 (`0003-styleguide-esm-single-source.md`). Surfaced to the builder — they look like an
  earlier session's incomplete commit and need a human decision.

---

## 2026-06-06 -- Task verified and completed: agentic-workflow-001 - Dashboard (integration epic)

**Type:** Work / Task completion
**Task:** agentic-workflow-001 - Dashboard — local web UI over the project's .agentheim folder
**Summary:** Closed the dashboard integration epic on the Windows leg — all six children
(aw-004…009) confirmed done; verified end-to-end on Windows by running both suites green
(lib 13/13, dashboard 100/100) and live-launching the detached server against a throwaway temp
`.agentheim/` fixture, exercising `/api/tree` (200), `/api/doc` (200 + 403 traversal guard),
`/api/events` (200 SSE hello), `POST /api/task/move` backlog→todo (200, file moved) and an
illegal todo→done refused (422), then stopping cleanly. `dashboard` documented as a Key command.
**Verification:** PASS (iteration 1) — verifier independently re-ran both suites green, confirmed
the six children in done/, the README Key-command doc, and scope (README + task move only).
**Commit:** 8af5748
**Files changed:** 1 (BC README — Dashboard Key command)
**Tests added:** 0 (integration/verification epic; no runtime code changed)
**ADRs written:** none
**Note:** v1 bar was Windows-only by builder decision; the POSIX cross-OS leg is tracked in
agentic-workflow-010 (backlog, depends_on aw-001). No integration defect found.

---

## 2026-06-06 -- Batch started: [agentic-workflow-001]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-001 - Dashboard (local web UI over .agentheim — integration epic / gate)
**Parallel:** no (1 worker)
**Note:** Epic-closing integration pass. All six children (aw-004…009) are done; v1 bar was
narrowed to Windows-only this session (POSIX carved to aw-010). The worker runs the end-to-end
flow on Windows (launch → board → slide-over → live-update → Promote), documents `dashboard` as
a Key command of the BC, and closes the epic. Cross-OS/POSIX is explicitly out of scope here.

---

## 2026-06-06 -- Modeling / Refined: agentic-workflow-001 - Dashboard (integration epic)

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Narrowed the epic's v1 acceptance bar to the builder's Windows box (settled builder
decision) because the integration pass runs from a Windows-only environment. The "and at least
one POSIX OS" cross-OS criterion was carved out into a new follow-up task; aw-001 stays in todo,
ready for `work`.
**Split into:** agentic-workflow-010 (Dashboard cross-OS verification — POSIX leg; backlog,
`depends_on: [agentic-workflow-001]`)
**ADRs written:** none

---

## 2026-06-06 -- Modeling / Promoted: agentic-workflow-001 - Dashboard (integration epic)

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo
**Summary:** Promoted on builder request — the last remaining backlog ticket. Readiness confirmed:
its sole precondition ("all six children done": aw-004 server, aw-005 reads, aw-006 board,
aw-007 slide-over, aw-008 navigation, aw-009 live-update + Promote) is now met, and it carries
concrete integration/end-to-end acceptance criteria (launch → board → slide-over → live-update →
Promote, on Windows + one POSIX, `dashboard` documented as a Key command). Now ready for `work`
to run the end-to-end integration pass. **Note for the worker:** the POSIX leg of the end-to-end
flow (and aw-004's launch/stop) is so far verified on Windows only — the cross-OS criterion is
the substantive remaining work; may need the builder's hand on a POSIX box.

---

## 2026-06-06 -- Styleguide gate re-confirmed (design-system-003)

**Type:** Gate / Builder approval
**BC:** design-system
**Summary:** The builder re-confirmed the styleguide gate after `design-system-003` vendored the
webfonts offline — the only gated change was the token CSS `@import` → local `@font-face`, a
nil-visual-delta delivery swap. The gate stands **OPEN** against the now-fully-offline styleguide.
Recorded in the design-system README gate-status block and the ds-003 done file.

---

## 2026-06-06 -- Work session ended

**Type:** Work / Session end
**Completed:** 6 (first-try PASS: 6, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 6 (e9a41cc ds-003, 21f0fe7 aw-005, 03e0b37 aw-006, ffda30f aw-007, 78c25e6 aw-008, 5cc5aac aw-009) + 1 SHA-backfill chore
**ADRs written:** ADR-0008 (vendored webfonts, design-system) · ADR-0009 (dashboard frontend app shell + build retarget) · ADR-0010 (slide-over doc-shaped item) · ADR-0011 (library = non-task half of the tree) · ADR-0012 (applyTaskMove slug-resolution + SSE re-fetch) — all BC-scoped, none global.
**Notes:**
- The **entire dashboard cluster (aw-005…009) is now done** + design-system-003. todo/ and doing/ are empty across all BCs. The dashboard renders the live board, the universal slide-over, the library/navigation, and is live-updating + Promote-writable — fully offline.
- ADR numbering: the ds-003 worker emitted its ADR as "0004" (collided with the existing cwd ADR); the orchestrator **renumbered it to ADR-0008** and fixed the refs before commit. No other collisions (0009–0012 all clean).
- **Latent bug fixed**: aw-009 found `applyTaskMove` (aw-003) assumed a bare `<id>.md` filename but real task files are `<id>-<slug>.md` — it would never have resolved a real task. Fixed + ADR-0012; lib + dashboard suites green (13 + 100).
- **Concept candidate** (escalated to builder): `dashboard-frontend-app` / `dashboard read-projection surfaces` — flagged by 2 workers (aw-007, aw-008), converging across ADR-0009/0010/0011 + aw-005/006/007/008. A synthesis page may be worth creating.
- **aw-001 (the dashboard integration epic) is now ripe to close** — all its children (aw-005…009) are done. It stays in backlog (its AC is "all children done + end-to-end flow works"); promoting/closing it is a modeling/builder call, not work.
- **Open for the builder:** the design-system styleguide gate re-opened lightly by ds-003 (token CSS edited — visual delta nil, fonts now local) wants a quick re-confirm.

---

## 2026-06-06 -- Batch started: [agentic-workflow-009]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-009 - Dashboard interactivity (SSE live-update consumer + Promote drag → applyTaskMove write path)
**Parallel:** no (1 worker)
**Note:** Final wave of the dashboard cluster. All deps satisfied (aw-003 applyTaskMove ✓, aw-005 reads ✓, aw-006 board ✓, infra-003 SSE transport ✓). Builds the SSE consumer (re-fetch /api/tree on change), the server's POST /api/task/move write endpoint delegating to applyTaskMove, and the backlog→todo Promote drag with optimistic concurrency / 409 handling (ADR-0001). Completing this lets aw-001 (the integration epic) close.

---

## 2026-06-06 -- Task verified and completed: agentic-workflow-008 - Dashboard navigation

**Type:** Work / Task completion
**Task:** agentic-workflow-008 - Dashboard navigation (discover/browse all .agentheim artifacts)
**Summary:** Built the dashboard's discovery/library surface — `dashboard/app/library.js` over the pure `library-data.js` (`treeToLibrary`) — listing the non-task half of `/api/tree` (vision, context-map, every BC README, ADRs, research) in fixed legible groups (Product / Bounded contexts / Decisions / Research), tasks deliberately excluded so each artifact has one home. Selecting a row emits the *same* open-intent the board emits, routed into the one universal slide-over (aw-007). Added a board↔library toggle in the shell built from the styleguide `RailItem`.
**Verification:** PASS (iteration 1) — full dashboard suite 82/82 green incl. new library-data tests (every artifact type grouped, no task ever in the library, intent-shape carried); toggle switches the mounted surface; styleguide patterns (TreeGroup/TreeItem/RailItem) imported not forked, source byte-unchanged; scope clean (no SSE/Promote).
**Commit:** 78c25e6
**Files changed:** 9 (library.js, library-data.js, board.js shell toggle, library-data test, dist/app.js rebuilt, BC README, ADR-0011)
**Tests added:** ~7 (library grouping + intent shape)
**ADRs written:** ADR-0011 (library = non-task half of the tree projection, grouped client-side; scope: agentic-workflow) — number free, no collision.
**Concept signal:** worker flagged `dashboard read-projection surfaces` converging on ADR-0009/0010/0011 + aw-005 — aggregating for end-of-run (related to aw-007's `dashboard-frontend-app` signal).

---

## 2026-06-06 -- Batch started: [agentic-workflow-008]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-008 - Dashboard navigation (discover/browse all .agentheim artifacts; board↔library toggle)
**Parallel:** no (1 worker)
**Note:** Fourth wave. Slots into the app shell (ADR-0009), reuses the styleguide library/doc-row + app-rail patterns, drives off `/api/tree`'s artifact-location half (aw-005), routes selections into the slide-over (aw-007). aw-009 (interactivity) remains.

---

## 2026-06-06 -- Task verified and completed: agentic-workflow-007 - Dashboard slide-over

**Type:** Work / Task completion
**Task:** agentic-workflow-007 - Dashboard slide-over (universal detail panel + client-side markdown renderer)
**Summary:** Built the dashboard's universal right-hand slide-over (`dashboard/app/slide-over.js` over the pure, unit-tested `slide-over-data.js`) and wired it to the board's open-intent seam. Clicking any artifact opens the approved styleguide `Drawer`, which fetches `GET /api/doc?path=` and renders the markdown client-side via the styleguide `Markdown`. Tasks and every non-task artifact (BC README, vision, context-map, research, ADR) render through one identical path — a *doc-shaped* item the Drawer consumes (ADR-0010); only the fetched path differs. Esc + scrim close.
**Verification:** PASS (iteration 1) — full dashboard suite 72/72 green incl. 7 new slide-over-data tests; uniform task/non-task path verified; Drawer Esc/scrim/slide-in inherited from the approved styleguide (not reimplemented); single-source intact (Drawer/Markdown imported, styleguide source byte-unchanged); scope clean (no nav, no SSE/Promote).
**Commit:** ffda30f
**Files changed:** 9 (slide-over.js, slide-over-data.js, board.js wiring, slide-over-data test, dist/app.js rebuilt, BC README, ADR-0010)
**Tests added:** 7 (slide-over-data path resolution + doc-shaped item)
**ADRs written:** ADR-0010 (slide-over feeds the Drawer a doc-shaped item; scope: agentic-workflow) — number free, no collision.
**Concept signal:** worker flagged `dashboard-frontend-app` converging on 4 artifacts (ADR-0009, aw-006, aw-007, ADR-0010) — aggregating for end-of-run.

---

## 2026-06-06 -- Batch started: [agentic-workflow-007]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-007 - Dashboard slide-over (universal detail panel + client-side markdown renderer over /api/doc)
**Parallel:** no (1 worker)
**Note:** Third wave. Slots into the app shell ADR-0009 established — reuses the styleguide Drawer + Markdown patterns, fetches `/api/doc` (aw-005), consumes the board's open-intent seam (board.js onOpen). aw-008 (nav) + aw-009 (interactivity) remain, one-per-batch.

---

## 2026-06-06 -- Task verified and completed: agentic-workflow-006 - Dashboard board view

**Type:** Work / Task completion
**Task:** agentic-workflow-006 - Dashboard board view (flat Kanban over /api/tree)
**Summary:** Stood up the dashboard frontend app in `dashboard/app/` (the project's first real UI) — imports the approved styleguide Kanban components across the BC boundary (single-source rule intact, ADR-0003), renders the flat four-column lifecycle board over live `/api/tree` with per-card BC chips, graceful unknown-status bucketing, empty-column state, and a click-emits-open-intent seam for the slide-over (aw-007). Retargeted infrastructure's esbuild ENTRY from the styleguide canvas to the live app and re-committed `dist/`.
**Verification:** PASS (iteration 1) — full dashboard suite 65/65 green incl. new board-data tests + a dist-build assertion that the committed bundle is the live board (fetches /api/tree, no canvas hero); single-source rule verified (styleguide imported not forked, source byte-unchanged); scope clean (no slide-over/nav built).
**Commit:** 03e0b37
**Files changed:** 11 (app/{app,board,board-data}.js, build.mjs retarget, 2 tests, dist/{app.js,index.html} rebuilt, BC README, ADR-0009)
**Tests added:** ~10 (board-data bucketing + dist-build live-board assertion)
**ADRs written:** ADR-0009 (dashboard frontend app shell + build retarget; scope: agentic-workflow) — number free, no collision. Governs aw-007/aw-008 too.

---

## 2026-06-06 -- Batch started: [agentic-workflow-006]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-006 - Dashboard board view (flat Kanban over /api/tree)
**Parallel:** no (1 worker)
**Note:** Second wave. aw-005 done unblocked aw-006/007/008; aw-009 still blocked on aw-006. The three UI tasks share the dashboard app shell + the agentic-workflow README, so they run one-per-batch (Phase 3), lowest-id first. Worker briefed on the cross-BC seam: no dashboard frontend app exists yet (build.mjs bundles the styleguide *canvas*), so aw-006 must stand up the app shell and retarget the esbuild entry — architect consult + ADR, or a clean bounce if under-specified.

---

## 2026-06-06 -- Task verified and completed: design-system-003 - Vendor webfonts offline

**Type:** Work / Task completion
**Task:** design-system-003 - Vendor the dashboard's webfonts offline
**Summary:** Dropped the Google Fonts CDN `@import` from the token CSS and vendored Inter Tight + JetBrains Mono as latin-subset variable woff2 (one file per family, 44KB/31KB + OFL licenses) under `styleguide/styles/fonts/`, referenced by local `@font-face` rules. `dashboard/build.mjs` now copies `styles/fonts/` → `dist/fonts/` so the relative `url()` resolves identically in the canvas and the served dist — closing the last view-time network dependency; the dashboard renders correct type fully offline.
**Verification:** PASS (iteration 1) — by inspection (no test suite for CSS/fonts): no CDN ref remains, @font-face family names match the `--font-*` tokens, real woff2 (not placeholders), dist CSS byte-identical to source + dist/fonts present.
**Commit:** e9a41cc
**Files changed:** 13 (token CSS, 2 woff2 + 2 OFL ×{source,dist}, build.mjs, dist CSS, BC README, ADR-0008)
**Tests added:** 0 (CSS/font delivery change)
**ADRs written:** ADR-0008 (vendored-webfonts-latin-subset; scope: design-system) — **renumbered from the worker's 0004 by the orchestrator (0004 already taken by the cwd ADR)**; refs in the BC README + task file updated to match.
**Gate note:** edits the gated `colors_and_type.css` — reopens the styleguide gate for a lightweight builder re-confirm (visual delta nil: same families/weights, local delivery).

---

## 2026-06-06 -- Task verified and completed: agentic-workflow-005 - Dashboard read API

**Type:** Work / Task completion
**Task:** agentic-workflow-005 - Dashboard read API (/api/tree projection + /api/doc carrier)
**Summary:** Added the two read endpoints to the aw-004 server — `GET /api/tree` projects every BC × lifecycle folder × task frontmatter (id/title/status/type/context/path) plus artifact locations (pointers, never bodies); `GET /api/doc?path=` is a validated raw-markdown carrier. Both reuse `discovery.mjs`'s `startsWith(root)` guard; pure reads, no writes. New `tree.mjs` (stdlib frontmatter parser, graceful degradation) + `read-api.mjs` handlers.
**Verification:** PASS (iteration 1) — full dashboard suite 55/55 green; all 4 acceptance criteria evidenced (no-body projection, traversal-403 touches no file, malformed-frontmatter degradation exercised, BC+status on every card).
**Commit:** 21f0fe7
**Files changed:** 8 (tree.mjs, read-api.mjs, server.mjs, 3 tests, dashboard README, BC README)
**Tests added:** ~12 (tree projection + read-api endpoints)
**ADRs written:** none (ADR-0002 already covers the read transport)

---

## 2026-06-06 -- Batch started: [design-system-003, agentic-workflow-005]

**Type:** Work / Batch start
**Tasks:** design-system-003 - Vendor the dashboard's webfonts offline; agentic-workflow-005 - Dashboard read API (/api/tree projection + /api/doc carrier)
**Parallel:** yes (2 workers)
**Note:** First wave of the dashboard-cluster work run. Both ready (ds-003 deps none; aw-005 deps aw-004 ✓). Non-conflicting — ds-003 in styleguide CSS/fonts (design-system BC), aw-005 adds read endpoints to the aw-004 server (agentic-workflow BC). aw-006/007/008/009 stay blocked on the aw-005 chain.

---

## 2026-06-06 -- Modeling / Promoted: aw-005..009 - Dashboard UI cluster (5 tasks)

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo (×5)
**Summary:** Builder asked to promote the whole dashboard backlog. Promoted the 5 buildable
children — aw-005 (read API), aw-006 (board view), aw-007 (slide-over + renderer),
aw-008 (navigation), aw-009 (SSE live-update + Promote). All leaf deps are done
(aw-004, aw-003, infra-001/002/003, ds-001/002) and the styleguide gate is OPEN, so the
frontend gate is clear for aw-006/007/008/009. Intra-cluster deps (aw-006/007/008 → aw-005,
aw-009 → aw-005/006) are now todo→todo and the `work` DAG sequences them at claim time.
**Held back:** aw-001 — the integration epic. Not promotable until its children land done
(its own AC is "all children done + end-to-end flow works"); promoting it would queue an
empty gate. Stays in backlog and closes when aw-005..009 complete.

---

## 2026-06-06 -- Modeling / Promoted: design-system-003 - Vendor the dashboard's webfonts offline

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo
**Summary:** Promoted on builder request. Readiness confirmed — concrete acceptance criteria, clear scope, no unmet deps, styleguide gate open. Ready for `work`. (Note: working it reopens the styleguide gate for a lightweight visual re-confirm, and needs an infrastructure-002 dist rebuild downstream — both recorded in the task Notes.)

---

## 2026-06-06 -- Modeling / Captured: design-system-003 - Vendor the dashboard's webfonts offline

**Type:** Modeling / Capture
**BC:** design-system
**Filed to:** backlog
**Summary:** Captured the residual surfaced by infrastructure-002: the styleguide token CSS still @imports Inter Tight + JetBrains Mono from the Google Fonts CDN, so fonts hit the network at view time even though the framework is now fully offline. Fix = commit woff2 locally + local @font-face, drop the CDN @import (design-system-owned source). Linked prior art ds-001/ds-002 and ADR-0003. Kept in backlog per builder; notes the gate re-approval implication and the downstream infrastructure-002 dist rebuild.

---

## 2026-06-06 -- Task verified and completed: infrastructure-002 - esbuild → committed dashboard/dist

**Type:** Work / Task completion
**Task:** infrastructure-002 - Bundle the styleguide ESM source into the dashboard's committed static assets (esbuild → dist)
**Summary:** Added the esbuild build pipeline (dashboard/build.mjs + package.json devDeps) that bundles the design-system ESM styleguide source — React production / ReactDOM / marked / htm bundled in, no CDN, no Babel, minified — into a committed `dashboard/dist/` that aw-004's static handler serves directly. The dashboard now renders offline; no install to run. node_modules gitignored.
**Verification:** PASS (iteration 1) — full dashboard suite 43/43 green; render-verified live (GET / → 200 real UI, GET /app.js → 200, 0 CDN/Babel refs).
**Commit:** e37dac9
**Files changed:** 11 (build.mjs, package.json, package-lock.json, dist-build test, dist/ {index.html, app.js, 2 css}, .gitignore, infra README)
**Tests added:** ~6 (dist-build assertions)
**ADRs written:** none (ADR-0003 already covers the architecture)
**Residual:** the token CSS still `@import`s Google Fonts (Inter Tight / JetBrains Mono) from the CDN — a webfont in the design-system-owned source CSS, not editable by infrastructure. The framework is fully offline; only fonts hit the network at view time. Worth a design-system follow-up if true offline is required.

---

## 2026-06-06 -- Task started: infrastructure-002 (promoted from backlog + claimed)

**Type:** Work / Task start
**Task:** infrastructure-002 - Bundle the styleguide ESM source into the dashboard's committed static assets (esbuild → dist)
**Parallel:** no (single task)
**Note:** Builder asked to make the dashboard render. All deps now satisfied (infrastructure-001, design-system-001, design-system-002 + gate re-approved). Promoted backlog→doing and dispatched one worker. Output: a committed `dashboard/dist/` that aw-004's static handler serves; esbuild as a build-time-only dev dependency (ADR-0003).

---

## 2026-06-06 -- Styleguide gate re-approved (design-system-002)

**Type:** Gate / Builder approval
**BC:** design-system
**Summary:** The builder reviewed the migrated ESM styleguide canvas (`styleguide/index.html`)
and re-approved it ("looks good, everything works"). This closes `design-system-002`'s last
open acceptance criterion (criterion 8). **The styleguide gate is now OPEN against the
migrated ES-module source** — frontend tasks aw-006/007/008 may promote (each still subject
to its own other deps). Recorded in the design-system README, INDEX, and the ds-002 done file.
**Also noted:** running the dashboard server (aw-004) currently serves the graceful
"assets not built (dist/ absent)" fallback — the dashboard UI cannot render until
`infrastructure-002` (esbuild → committed `dist/`) is built. infrastructure-002's deps
(infrastructure-001, design-system-001, design-system-002) are now all satisfied.

---

## 2026-06-06 -- Work session ended

**Type:** Work / Session end
**Completed:** 4 (first-try PASS: 3, re-dispatched: 1, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 4 (9b09b3e aw-004, 58fafcf ds-002, 2378b0b aw-003, 1e192ba infra-003)
**ADRs written:** ADR-0004 (server cwd), ADR-0005 (styleguide htm), ADR-0006 (SSE live-update; supersedes-in-part ADR-0002), ADR-0007 (task-move side-effect boundary) — all BC-scoped, none global.
**Open items for the builder:**
- **design-system-002 styleguide gate is CLOSED pending visual re-approval** — open styleguide/index.html, check sections 05–10 + the live kanban→drawer demo (open/close, Esc, theme toggle), then re-approve. The migration is committed but the gate stays closed until sign-off.
- **aw-004 POSIX leg** — run `node dashboard/launch.mjs` + stop once on a POSIX OS (verified on Windows only).
**Note:** Two batches. ADR numbering: infra-003's earmarked "ADR-0004" was renumbered to ADR-0006 (0004/0005 taken by batch-1 workers). todo/ and doing/ now empty across all BCs; the dashboard cluster's four foundations (server, applyTaskMove, SSE transport, styleguide ESM source) are landed — aw-005/006/007/008/009 + infrastructure-002 remain in backlog.

---

## 2026-06-06 -- Task verified and completed: infrastructure-003 - Dashboard live-update transport

**Type:** Work / Task completion
**Task:** infrastructure-003 - Dashboard live-update transport (SSE endpoint + .agentheim file-watcher)
**Summary:** Added GET /api/events (SSE) on the existing stdlib server, backed by an .agentheim/ file-watcher (recursive fs.watch + debounced poll fallback) that pushes debounced, path-validated {type:"tree-changed", path} pointers. ADR-0006 records the decision and supersedes-in-part ADR-0002's request/response-only clause.
**Verification:** PASS (iteration 1) — full dashboard suite 37/37 green (no regression to aw-004's tests)
**Commit:** 1e192ba
**Files changed:** 10 (watcher.mjs, events.mjs, server.mjs, 2 tests, dashboard README, ADR-0006, ADR-0002 banner, infra README)
**Tests added:** 9 (SSE + watcher)
**ADRs written:** ADR-0006 (0006-dashboard-live-update-sse.md)

---

## 2026-06-06 -- Task verified and completed: agentic-workflow-003 - Extract applyTaskMove

**Type:** Work / Task completion
**Task:** agentic-workflow-003 - Extract applyTaskMove (one shared Task-lifecycle mover)
**Summary:** Extracted applyTaskMove into lib/task-lifecycle.mjs — the single mover enforcing the legal-move policy, the depends_on frontend gate, status-matches-folder, and the optimistic precondition, returning structured rejections. ADR-0007 settles the side-effect boundary: the mover owns only the move; INDEX/protocol side-effects stay with the skills.
**Verification:** PASS (iteration 1) — 11/11 tests green
**Commit:** 2378b0b
**Files changed:** 4 (lib/task-lifecycle.mjs + test, ADR-0007, agentic-workflow README)
**Tests added:** 11 (legal promote, illegal move, blocked depends_on, stale precondition, +more)
**ADRs written:** ADR-0007 (0007-task-move-side-effect-boundary.md)

---

## 2026-06-06 -- Batch started: [agentic-workflow-003, infrastructure-003]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-003 - Extract applyTaskMove (one shared Task-lifecycle mover); infrastructure-003 - Dashboard live-update transport (SSE endpoint + .agentheim file-watcher → ADR-0006)
**Parallel:** yes (2 workers)
**Note:** Batch 2 of the session. infra-003's decision output renumbered ADR-0004 → ADR-0006 (0004/0005 were taken by aw-004 and ds-002 in batch 1). aw-003 builds the shared mover but does NOT wire the dashboard's POST /api/task/move (that is aw-009); infra-003 adds the SSE route to aw-004's committed server — disjoint files, no conflict.

---

## 2026-06-06 -- Task verified and completed: design-system-002 - Migrate the styleguide to ES modules

**Type:** Work / Task completion
**Task:** design-system-002 - Migrate the styleguide to ES modules (buildless htm + import-map canvas, single source)
**Summary:** Migrated the 11 global-script JSX files to native ES modules (explicit import/export, no window globals, no in-browser Babel); views authored with htm tagged templates so no JSX ships to the browser; canvas rewired to load buildlessly via import map. Tokens untouched. ADR-0005 records the htm view-factory choice.
**Verification:** PASS (iteration 2 — iteration 1 failed on two wrong-ADR in-source citations; fixed)
**Commit:** 58fafcf
**Files changed:** ~24 (11 .jsx → 12 .js incl. new html.js, index.html, BC README, ADR-0005)
**Tests added:** 0 (visual artifact — verified via module-graph + render sanity check)
**ADRs written:** ADR-0005 (0005-styleguide-htm-buildless-viewfactory.md)
**Open gate:** criterion 8 (builder visual re-approval of the migrated canvas) remains a HUMAN gate — styleguide gate stays CLOSED pending the builder opening styleguide/index.html and signing off. Unblocks infrastructure-002.

---

## 2026-06-06 -- Verification failed: design-system-002 - Migrate the styleguide to ES modules

**Type:** Work / Verification failure
**Task:** design-system-002 - Migrate the styleguide to ES modules
**Iteration:** 1 of 3
**Reasons:** Two in-source comments (styleguide/index.html, app/html.js) cited the wrong ADR — "ADR-0004" (agentic-workflow's unrelated cwd decision) instead of ADR-0005 (the htm/import-map decision). Criteria 1–7 otherwise passed.
**Iteration hint:** likely-fixable
**Next:** re-dispatched worker (fixed both citations; passed on iteration 2)

---

## 2026-06-06 -- Task verified and completed: agentic-workflow-004 - Dashboard server bootstrap

**Type:** Work / Task completion
**Task:** agentic-workflow-004 - Dashboard server bootstrap (stdlib HTTP, detached launch/stop, project discovery)
**Summary:** Built the dashboard runtime skeleton per ADR-0002 — Node-stdlib-only HTTP server (static + health check, no deps/install) that launches detached on 127.0.0.1 with an ephemeral port, writes a gitignored runfile, stops by pid with reuse-or-replace, and discovers the project root by walking up for .agentheim/ while validating every served path.
**Verification:** PASS (iteration 1)
**Commit:** 9b09b3e
**Files changed:** 14 (dashboard/ runtime + 28 tests, .gitignore, ADR-0004)
**Tests added:** 28 (all passing)
**ADRs written:** ADR-0004 (0004-dashboard-detached-process-cwd.md — neutral cwd for the detached process)
**Residual:** acceptance criterion 5's POSIX launch/stop leg is verified on Windows only — builder to run launch+stop once on a POSIX OS to close it.

---

## 2026-06-06 -- Batch started: [agentic-workflow-004, design-system-002]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-004 - Dashboard server bootstrap (stdlib HTTP, detached launch/stop, project discovery); design-system-002 - Migrate the styleguide to ES modules (buildless canvas, single source) + re-approval
**Parallel:** yes (2 workers)
**Note:** aw-003 held to next batch (shares the agentic-workflow README with aw-004); infrastructure-003 held to next batch (its SSE endpoint plugs into the server aw-004 builds).

---

## 2026-06-06 -- Modeling / Promoted: agentic-workflow-004 + infrastructure-003

**Type:** Modeling / Promote (batch)
**BC:** agentic-workflow, infrastructure
**From → To:** backlog → todo (both)
**Summary:** Promoted the two unblocked roots of the new dashboard DAG. **agentic-workflow-004**
(server bootstrap — stdlib HTTP, detached launch/stop, project discovery) and **infrastructure-003**
(SSE endpoint + `.agentheim/` file-watcher → ADR-0004). Both depend only on infrastructure-001
(done) and carry concrete, testable acceptance criteria. The other four aw children + the epic
stay in backlog (blocked on aw-004/005/006, ds-002, infra-002). todo/ now holds 3 tasks
(aw-003, aw-004, infrastructure-003).

---

## 2026-06-06 -- Modeling / Refined: agentic-workflow-001 - Dashboard (decomposed into an epic + 6 children)

**Type:** Modeling / Refine
**BC:** agentic-workflow (+ infrastructure)
**Status after:** backlog (all)
**Summary:** Cornered the two open questions on the dashboard umbrella feature and decomposed it.
Two builder decisions locked: (1) **live-update, not refresh-only** — the board reflects
skill-driven file moves in near-real-time; the push channel is a *new infrastructure concern*
(SSE + `.agentheim/` file-watcher on the existing stdlib server), so a new **infrastructure-003**
owns it and records **ADR-0004** superseding ADR-0002's request/response-only clause. (2)
**Multiple BCs on the board** — first chosen as swimlanes, then **reversed to a flat board with
the BC shown on each card** (the approved `KanbanBoard` used as-is; a proposed `design-system-003`
swimlane-pattern task was dropped, no styleguide re-approval needed). agentic-workflow-001 rewritten
as a thin **epic/integration gate** depending on its six children; leaf deps pushed down onto the
child that consumes each. `blocks` re-wired on aw-003, ds-002, infra-001, infra-002.
**Split into:** agentic-workflow-004 (server bootstrap), -005 (read API), -006 (flat board view),
-007 (slide-over + renderer), -008 (navigation), -009 (SSE live-update + Promote); infrastructure-003
(SSE + file-watcher transport). agentic-workflow-001 retained as the epic.
**ADRs written:** none yet — ADR-0004 is the output of infrastructure-003 when worked (decision task).

---

## 2026-06-05 -- Modeling / Promoted: design-system-002 + agentic-workflow-003

**Type:** Modeling / Promote (batch)
**BC:** design-system, agentic-workflow
**From → To:** backlog → todo (both)
**Summary:** Promoted the two ready leaves after the infrastructure-002 refinement.
**design-system-002** (styleguide ESM migration + buildless canvas + re-approval) — only dep
`design-system-001` is done/approved, so the styleguide gate is satisfied. **agentic-workflow-003**
(extract `applyTaskMove`) — only dep `agentic-workflow-002` is done. Both carry concrete, testable
acceptance criteria. `infrastructure-002` stays in backlog (now blocked on design-system-002);
`agentic-workflow-001` stays in backlog (still multi-dep + unsplit). todo/ now holds 2 tasks.

---

## 2026-06-05 -- Modeling / Refined: infrastructure-002 - Pre-bundle the dashboard's frontend assets

**Type:** Modeling / Refine
**BC:** infrastructure, design-system
**Status after:** backlog (both tasks)
**Summary:** Settled infrastructure-002's one open choice — the build mechanism. Two builder
decisions locked: (1) **real bundler** (esbuild, chosen by the architect over Vite/Rollup for a
single ~1,800-line page, 3 deps, committed-`dist`, no dev-server need); (2) **single source of
truth = migrate the styleguide itself to ES modules** (the current 11 global-script JSX files
couple via implicit globals). Because the ESM migration reopens the *done/approved*
`design-system-001` artifact and changes the styleguide gate (canvas must re-pass review), the
work **split across BCs**: a new `design-system-002` owns the ESM migration + buildless
import-map canvas + re-approval; `infrastructure-002` narrows to "bundle the ESM source →
committed dist (esbuild)" and now `depends_on` design-system-002. ADR-0003 records the
single-source / two-consumer architecture (scope: design-system).
**Split into:** design-system-002 (new); infrastructure-002 retitled + narrowed
**ADRs written:** ADR-0003 (0003-styleguide-esm-single-source.md, scope design-system, proposed)

---

## 2026-06-05 -- Work session ended

**Type:** Work / Session end
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Commits:** 2 (526aa12 agentic-workflow-002, fd486c7 infrastructure-001)
**Note:** The two dashboard decision tasks were run sequentially (not parallel) to avoid a first-ADR collision in an empty `decisions/` dir. infrastructure-001 was scoped decision-only by builder choice — its implementation acceptance criteria defer to agentic-workflow-001. todo/ is now empty across all BCs.

---

## 2026-06-05 -- Task verified and completed: infrastructure-001 - Decide the dashboard runtime

**Type:** Work / Task completion
**Task:** infrastructure-001 - Decide the dashboard runtime — Node static+JSON transport, launch/stop, project discovery
**Summary:** Recorded ADR-0002 — Node-stdlib (no deps/install), `127.0.0.1`-only HTTP transport; single detached `launch.mjs` on an ephemeral port recorded in `.agentheim/.dashboard/runtime.json`; explicit stop (kill-by-pid + clear runfile, Windows `taskkill` fallback); project discovery by walking up for `.agentheim/` with absolute-root path validation; write endpoint delegates to `applyTaskMove` (transport-only, never decides legality).
**Verification:** PASS (iteration 1)
**Commit:** fd486c7
**Files changed:** 2 (ADR-0002, infrastructure README)
**Tests added:** 0 (decision task)
**ADRs written:** ADR-0002 (0002-dashboard-runtime-transport.md)
**Scope:** decision-only this run (builder decision); implementation + its acceptance criteria deferred to agentic-workflow-001.

---

## 2026-06-05 -- Batch started: [infrastructure-001]

**Type:** Work / Batch start
**Tasks:** infrastructure-001 - Decide the dashboard runtime — Node static+JSON transport, launch/stop, project discovery
**Parallel:** no (1 worker)
**Scope note:** Builder set scope to **decision-only** this run — deliver ADR-0002 + infra README. The implementation acceptance criteria (running server, write endpoint delegating to `applyTaskMove`) defer to agentic-workflow-001, since agentic-workflow-003 (`applyTaskMove`) and the pre-bundled assets are not yet built.

---

## 2026-06-05 -- Task verified and completed: agentic-workflow-002 - Decide dashboard write-semantics

**Type:** Work / Task completion
**Task:** agentic-workflow-002 - Decide dashboard write-semantics — legal Task moves, shared move logic, concurrency
**Summary:** Recorded ADR-0001 — v1 UI card moves are Promote-only (`backlog→todo`) honoring the styleguide/`depends_on` frontend gate; all other transitions rejected with domain reasons; a single shared `applyTaskMove` is mandated as the sole lifecycle writer; optimistic concurrency via `from`+mtime precondition with refetch-on-reject.
**Verification:** PASS (iteration 1)
**Commit:** 526aa12
**Files changed:** 2 (ADR-0001, agentic-workflow README)
**Tests added:** 0 (decision task)
**ADRs written:** ADR-0001 (0001-dashboard-write-semantics.md)

---

## 2026-06-05 -- Batch started: [agentic-workflow-002]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-002 - Decide dashboard write-semantics — legal Task moves, shared move logic, concurrency
**Parallel:** no (1 worker) — sequenced ahead of infrastructure-001 to avoid first-ADR collision in an empty decisions/ dir

---

## 2026-06-05 -- Modeling / Refined: dependency edge infrastructure-002 → agentic-workflow-001

**Type:** Modeling / Refine
**BC:** infrastructure, agentic-workflow
**Status after:** backlog (both)
**Summary:** Builder decision: `infrastructure-002` (pre-bundle the dashboard assets)
**blocks** the dashboard. The dashboard ships pre-bundled from day one — the in-browser-Babel
canvas is not an acceptable v1. Recorded both ways: `infrastructure-002.blocks =
[agentic-workflow-001]`; `agentic-workflow-001.depends_on` gains `infrastructure-002` (now
five deps: infrastructure-001, agentic-workflow-002, agentic-workflow-003, design-system-001
[done], infrastructure-002).
**ADRs written:** none

---

## 2026-06-05 -- Modeling / Captured: infrastructure-002 - Pre-bundle the dashboard's frontend assets

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** backlog
**Summary:** Captured the reconciliation surfaced while delivering the styleguide as its own
task. Turn the dashboard's frontend (React/JSX + `marked`, currently CDN + in-browser Babel)
into committed, pre-bundled static assets — production React build, no runtime CDN fetch, no
in-browser compile, still no install step to run. The production-build counterpart to
`infrastructure-001`'s "committed build output is the asset set" policy. Build mechanism left
as the one open choice (vendor+precompile vs real bundler). depends_on infrastructure-001 +
design-system-001; deliberately not added to agentic-workflow-001's depends_on yet (avoid
over-gating — that edge gets settled when the dashboard is refined).

---

## 2026-06-05 -- Modeling / Completed: design-system-001 - Dashboard styleguide (builder-approved)

**Type:** Modeling / Refine (gate closed)
**BC:** design-system
**Status after:** done (backlog → done)
**Summary:** Builder reviewed and **approved** the delivered styleguide artifact
(`contexts/design-system/styleguide/`). The styleguide gate is now **open** — frontend tasks
in any BC may be promoted (each still subject to its own other dependencies). Final
acceptance criterion (builder review) ticked; task moved to `done/`, INDEX counts and README
updated (gate open). No git commit recorded here — files were added in this session and will
be committed with the rest of the working tree.

---

## 2026-06-05 -- Modeling / Refined: design-system-001 - Dashboard styleguide (artifact delivered)

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** backlog (delivered, pending builder review — the styleguide gate)
**Summary:** The four open design axes (aesthetic, density, light/dark, framework) were
resolved on the design side via Claude Design and handed off as a bundle. Direction locked:
content-first dev tool ("Linear precision, Notion calm, Vercel restraint"), **dark-first +
light toggle**, comfortable density, **React** components, JetBrains Mono IDs (`AGH-128` /
`ADR-0007`), inline-SVG icons, color used only for ticket status + content type — derived
from the Ledger design system. Implemented the styleguide artifact into
`contexts/design-system/styleguide/`: `index.html` canvas + `styles/colors_and_type.css` &
`styles/agentheim.css` (token source of truth) + `app/*.jsx` reference components (kanban,
slide-over drawer, markdown reading surface, file-tree nav, foundations docs). Ticked all
ACs except the **builder-review gate**, which is the human approval that opens frontend
work. Reconciled with infrastructure-001: ships as plain static assets (no `node_modules` /
no install) ✓, but the canvas loads React+Babel-standalone+marked from unpkg and compiles
JSX in-browser — flagged that the dashboard (agentic-workflow-001) should vendor/pre-bundle
the committed build output rather than ship in-browser Babel.
**Split into:** none
**ADRs written:** none

---

## 2026-06-05 -- Modeling / Promoted: infrastructure-001 + agentic-workflow-002

**Type:** Modeling / Promote
**BC:** infrastructure, agentic-workflow
**From → To:** backlog → todo
**Summary:** Promoted the two dashboard decision tasks once refined — `infrastructure-001`
(runtime/transport) and `agentic-workflow-002` (write-semantics). Both carry full ADR
drafts, concrete acceptance criteria, and no unmet dependencies; neither is frontend, so
the styleguide gate doesn't apply. `agentic-workflow-003` (applyTaskMove extraction) stays
in backlog until 002 is worked; `agentic-workflow-001` (dashboard) and `design-system-001`
(styleguide) remain in backlog behind their gates.

---

## 2026-06-05 -- Brainstorm (extension): added the infrastructure bounded context

**Type:** Brainstorm
**Outcome:** vision extended
**BCs identified:** infrastructure (new)
**Summary:** Stood up `contexts/infrastructure/` the doctrinal way (brainstorm, not a
model-spawned BC), triggered by the dashboard runtime decision (agentic-workflow-002)
surfacing Agentheim's first real runtime. Scoped **tightly to the dashboard
web-server runtime/transport** at the builder's request — other cross-cutting tech
(plugin packaging, eval harness, shared tooling) folds in only if/when it appears, not
pre-emptively. README records the **transport-vs-meaning** boundary with agentic-workflow:
infrastructure supplies the transport (server, launch, static serving, project discovery,
raw write endpoints) as supplier; agentic-workflow owns what a write *means* (Task
lifecycle transitions + invariants + concurrency), with infrastructure conformist to
those rules. Classification: supporting (generic-leaning). No architect run, no
decision/spike/styleguide tasks emitted here — those belong to the 002 relocation back in
`modeling`. Top-level index bc-list updated.
**ADRs written:** none (the transport ADR comes via the relocated 002 decision task)
**Foundation tasks emitted:** none — narrow extension; the runtime decision task already
exists (agentic-workflow-002) and relocates to infrastructure/ next, in `modeling`.

---

## 2026-06-05 -- Modeling / Refined: agentic-workflow-002 - Dashboard runtime decision (split)

**Type:** Modeling / Refine
**BC:** agentic-workflow (+ infrastructure)
**Status after:** backlog (all three decision/refactor tasks; ready to promote)
**Summary:** Refined the dashboard runtime decision via the orchestrator (architect +
tactical-modeler lenses). Locked inputs: Node assumed present → Node-stdlib static+JSON
server, no deps/no install; v1 is interactive but capped at the **smallest write surface
— a single legal UI move, `backlog→todo` (Promote)**; all other moves stay skill-driven
(`doing→done` rejected to protect *one task = one commit*). The decision split along the
transport-vs-meaning seam: transport relocated to the new infrastructure BC; write-meaning
stayed here. Reconciled 001 (dropped its "read-only for v1" framing; now interactive
Promote-only) and fixed design-system-001's stale stack reference (→ infrastructure-001).
**Split into:**
- `infrastructure-001` (decision) — runtime/transport: server, cross-platform launch/stop,
  `.agentheim/` discovery, dumb `POST /api/task/move`. ADR draft in Notes.
- `agentic-workflow-002` (decision, retitled) — write-semantics: legal-move policy,
  shared mover, optimistic concurrency. ADR draft in Notes.
- `agentic-workflow-003` (refactor, NEW) — extract `applyTaskMove`, the single shared
  Task-lifecycle mover both skills and the dashboard call. depends_on: 002.
**Dependency rewiring:** agentic-workflow-001.depends_on = [infrastructure-001,
agentic-workflow-002, agentic-workflow-003, design-system-001].
**ADRs written:** none committed (two ADR drafts sit in task Notes; `work` commits them
when the decision tasks are executed).

---

## 2026-06-05 -- Modeling / Captured: dashboard feature + styleguide gate + runtime decision

**Type:** Modeling / Capture
**BC:** agentic-workflow (+ new design-system BC)
**Filed to:** backlog
**Summary:** Captured a new `dashboard` skill/command — a local web server serving a UI
over the project's `.agentheim/` folder: a Kanban board of tasks across lifecycle columns,
a Notion-style right-hand slide-over as the universal markdown detail view (tasks, READMEs,
vision, context map, research, ADRs), and discoverable navigation. Three tasks created:
agentic-workflow-001 (dashboard feature) depending on agentic-workflow-002 (type:decision —
web-server stack & launch mechanism, ADR output) and design-system-001 (styleguide). This is
Agentheim's first UI-bearing feature, so a new supporting `design-system` BC was created to
hold the styleguide gate, and the agentic-workflow README records the frontend gate +
relationship. The dashboard also introduces the first runtime into a previously
markdown-only plugin, which the decision task makes explicit.

---

## 2026-06-05 -- Brainstorm: vision for Agentheim itself

**Type:** Brainstorm
**Outcome:** vision created
**BCs identified:** none yet (context map deferred — see Summary)
**Summary:** Socratic session documenting the existing Agentheim plugin as a vision.
Established that Agentheim is now a building tool only (teaching/workshop use dropped;
the six modes survive as model-quality instruments). Acute pain named: an agreeable
agent that produces shallow domain work at speed. Confirmed five non-goals. Surfaced
the recurring "adversarial fresh-context gate" motif (verifier + research-reviewer) as
deliberate design. Logged three open questions: brainstorm-on-existing-code (next
iteration, build via skill-creator), the research-review branch/registry merge gap, and
the stale "workshop use" framing in references/modes.md.
**ADRs written:** none
**Foundation tasks emitted:** skipped — mature existing project, no greenfield
foundation pass (no running app, no frontend). Context-map + BC modeling offered to
user as the next step rather than auto-generated.

---
