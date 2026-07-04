# Agentic Workflow — Index

Catalog of everything in this bounded context: tasks by status, ADRs scoped to this BC,
research touching this BC, and concept synthesis pages.

> Updated by: `modeling` (tasks), `work` (BC-scoped ADRs, concept page links), `research` (BC-scoped reports).

---

## Tasks by status

<!-- task-counts:start -->
- **Backlog:** 0
- **Todo:** 1
- **Doing:** 1
- **Done:** 121
<!-- task-counts:end -->

### Todo
<!-- todo-list:start -->
- **agentic-workflow-vmk1z** — Dismissing the What's next panel deletes its advisory artifact (feature) — `todo/agentic-workflow-vmk1z-dismiss-deletes-whats-next-artifact.md`
<!-- todo-list:end -->

### Doing
<!-- doing-list:start -->
- **agentic-workflow-d4q7f** — Wire a trigger for INDEX done-list rotation — rotateIndexDoneList is never invoked (bug) — `doing/agentic-workflow-d4q7f-wire-index-done-list-rotation-trigger.md`
<!-- doing-list:end -->

### Done (most recent first; older entries kept for prior-art search)
<!-- done-list:start -->
- **agentic-workflow-g7p2x** — Observability hook command path breaks in consumer plugin installs (bug) — `done/agentic-workflow-g7p2x-fix-observability-hook-path-consumer-installs.md`
- **agentic-workflow-v8n3t** — Wire a trigger for protocol rotation — rotateProtocol is never invoked (bug) — `done/agentic-workflow-v8n3t-wire-protocol-rotation-trigger.md`
- **agentic-workflow-q7x2k** — Verifier check 6 gate gap — decisions narrated only in task-file prose are not flagged for an ADR (bug) — `done/agentic-workflow-q7x2k-verifier-check6-task-prose-gate-gap.md`
- **agentic-workflow-bx7k5** — A/B the verifier's model routing (opus vs sonnet) using the verifier-catch-rate fixtures (spike) — `done/agentic-workflow-bx7k5-ab-verifier-model-routing-opus-vs-sonnet.md`
- **agentic-workflow-n7q4d** — Harden the verifier-catch-rate corpus with discriminating fixtures (opus ceilings the current set) (spike) — `done/agentic-workflow-n7q4d-harden-verifier-catch-rate-corpus-discriminating-fixtures.md`
- **agentic-workflow-hz9m3** — Add a check-8 (runtime drive, ADR-0036) fixture to the verifier-catch-rate eval (spike) — `done/agentic-workflow-hz9m3-add-check8-runtime-drive-fixture-to-verifier-eval.md`
- **agentic-workflow-fq2j8** — Complete the verifier-catch-rate eval — one coherent full 9-fixture pass against the current verifier (spike) — `done/agentic-workflow-fq2j8-run-remaining-verifier-catch-rate-fixtures.md`
- **agentic-workflow-m9w5c** — Live observability — hooks write agent status to state/, dashboard renders an in-flight lane (feature) — `done/agentic-workflow-m9w5c-live-observability-hooks-inflight-lane.md`
- **agentic-workflow-c8j3w** — INDEX done-list rotation — cap the done-list and roll older entries to a dated archive (feature) — `done/agentic-workflow-c8j3w-index-done-list-rotation.md`
- **agentic-workflow-r9k2p** — Hover a backlog/todo ticket to highlight its dependencies with a pulsing ring (feature) — `done/agentic-workflow-r9k2p-hover-ticket-highlights-dependency-pulsing-ring.md`
- **agentic-workflow-w7q2m** — BC README consolidation — size trigger + human-in-loop consolidation procedure (feature) — `done/agentic-workflow-w7q2m-bc-readme-consolidation.md`
- **agentic-workflow-q3n7k** — Update the workflow guide to reflect new features like inquire and what's next (feature) — `done/agentic-workflow-q3n7k-update-workflow-guide-inquire-whats-next.md`
- **agentic-workflow-t7m4c** — Mechanize CLAIM + COMPLETE lifecycle scripts against the ADR-0032 worktree / squash-merge model (refactor) — `done/agentic-workflow-t7m4c-claim-complete-lifecycle-scripts-worktree.md`
- **agentic-workflow-v6d4n** — Vision-conformance check — flag in-flight work that drifts from vision success criteria / non-goals (feature) — `done/agentic-workflow-v6d4n-vision-conformance-check-session-end-verify.md`
- **agentic-workflow-r2c7m** — Protocol rotation — cap protocol.md and roll to monthly files (feature) — `done/agentic-workflow-r2c7m-protocol-rotation.md`
- **agentic-workflow-z2f7s** — Fan-out caps — MAX_PARALLEL as a knob, research cap, global nested-spawn ceiling (feature) — `done/agentic-workflow-z2f7s-fanout-caps-and-spawn-budget.md`
- **agentic-workflow-k5n8f** — Mechanize the bookkeeping (MVP) — generalized plugin-file resolver + git-free PROMOTE lifecycle script (refactor) — `done/agentic-workflow-k5n8f-mechanize-bookkeeping-wire-task-lifecycle.md`
- **agentic-workflow-v3h6p** — Eval-harness the verifier — measure its catch rate against planted defects (spike) — `done/agentic-workflow-v3h6p-eval-harness-the-verifier.md`
- **agentic-workflow-p3v9k** — Decide the lifecycle-mechanization boundary — fail-closed depends_on ruling + 3-layer bookkeeping ADR (decision) — `done/agentic-workflow-p3v9k-lifecycle-mechanization-boundary-decision.md`
- **agentic-workflow-y8b4q** — End-to-end verification step for tasks with a runtime surface (feature) — `done/agentic-workflow-y8b4q-end-to-end-verification-runtime-surface.md`
- **agentic-workflow-t4x8p** — Fix CRLF-sensitive byte-identical guard regexes in intent-route rail-routing tests (bug) — `done/agentic-workflow-t4x8p-fix-crlf-sensitive-byte-identical-guard-regexes.md`
- **agentic-workflow-x4t2g** — whats-next feeds back into planning — modeling and work read the advisory at session start (feature) — `done/agentic-workflow-x4t2g-whats-next-feeds-back-into-planning.md`
- **agentic-workflow-h9v3m** — Board wiring — collapsed-group markers and scroll-reactive off-viewport edge blinks (feature) — `done/agentic-workflow-h9v3m-board-wiring-collapsed-group-offviewport-blinks.md`
- **agentic-workflow-s7d3k** — Single-source the duplicated doctrine into references/ files (refactor) — `done/agentic-workflow-s7d3k-single-source-duplicated-doctrine.md`
- **agentic-workflow-j7d4k** — Ratify ADR-0036 — verifier runtime-drive end-to-end check (decision) — `done/agentic-workflow-j7d4k-ratify-adr-0036-verifier-runtime-drive.md`
- **agentic-workflow-n6r8j** — Flatten single-specialist consultations — worker spawns the specialist directly (refactor) — `done/agentic-workflow-n6r8j-flatten-single-specialist-consultation.md`
- **agentic-workflow-k5p8w** — Board wiring — resolve hover dependencies and drive the on-card ring for visible targets (feature) — `done/agentic-workflow-k5p8w-board-wiring-resolve-hover-drive-ring.md`
- **agentic-workflow-f6m2q** — Implement per-worker worktree isolation in work's git model (feature) — `done/agentic-workflow-f6m2q-implement-worktree-isolation-work-git-model.md`
- **agentic-workflow-d8q3n** — Carry depends_on/blocks through the /api/tree per-task projection (feature) — `done/agentic-workflow-d8q3n-carry-depends-on-blocks-tree-projection.md`
- **agentic-workflow-h3z5b** — Resolve the two-orchestrators naming ambiguity (chore) — `done/agentic-workflow-h3z5b-rename-orchestrator-ambiguity.md`
- **agentic-workflow-k9t3w** — Ratify ADR-0032 — per-worker git worktree isolation model (decision) — `done/agentic-workflow-k9t3w-ratify-adr-0032-worktree-isolation.md`
- **agentic-workflow-g9s3w** — Pre-load the test command into the verifier spawn prompt (feature) — `done/agentic-workflow-g9s3w-preload-test-command-into-verifier.md`
- **agentic-workflow-d6q4h** — Work session-end reconciliation of stranded working-tree carry-over (feature) — `done/agentic-workflow-d6q4h-work-session-end-carryover-reconciliation.md`
- **agentic-workflow-j4m6r** — Pin model frontmatter on the eight agents — decorrelate the adversarial gates, cut worker-fleet cost (feature) — `done/agentic-workflow-j4m6r-pin-model-frontmatter-agent-routing.md`
- **agentic-workflow-b8x2v** — Work protocol entries carry Duration and verification Iterations (feature) — `done/agentic-workflow-b8x2v-protocol-entries-duration-iterations.md`
- **agentic-workflow-w3p8n** — Fix stale README claim — dashboard has no drag-to-promote write-back (bug) — `done/agentic-workflow-w3p8n-fix-stale-readme-dashboard-drag-claim.md`
- **agentic-workflow-f7k2d** — Fix TESTS_* return-format drift — work spawn template omits the fields the verifier gates on (bug) — `done/agentic-workflow-f7k2d-fix-tests-return-format-drift.md`
- **agentic-workflow-m2v8d** — Done column collapse control — clamp to ~3.5 faded tickets instead of hiding the column (feature) — `done/agentic-workflow-m2v8d-done-column-collapse-to-clamped-fade.md`
- **agentic-workflow-n4h7q** — Left rail blinks new or updated research docs and ADRs until clicked or reloaded (feature) — `done/agentic-workflow-n4h7q-rail-blinks-new-research-and-adrs-until-acknowledged.md`
- **agentic-workflow-t3b9k** — Carry mtimeMs on research/ADR location pointers in /api/tree (feature) — `done/agentic-workflow-t3b9k-research-adr-pointer-mtime.md`
- **agentic-workflow-h7n2c** — Board prompt bar — Inquire launch button between Modeling and Research (feature) — `done/agentic-workflow-h7n2c-board-prompt-bar-inquire-button.md`
- **agentic-workflow-c4t8m** — What's Next columns become their own capped, scrollable cards (feature) — `done/agentic-workflow-c4t8m-whats-next-columns-as-capped-scrollable-cards.md`
- **agentic-workflow-q7m4k** — What's Next card drops the front matter and lays its three sections out as columns (feature) — `done/agentic-workflow-q7m4k-whats-next-card-three-columns-no-frontmatter.md`
- **agentic-workflow-079** — Minting call-site token sweep across the three live skills (chore) — `done/agentic-workflow-079-minting-call-site-token-sweep.md`
- **agentic-workflow-075** — Concepts are a first-class artifact kind — left-rail nav group + searchable category (feature) — `done/agentic-workflow-075-concepts-first-class-rail-and-search.md`
- **agentic-workflow-074** — Slide-over gets an expand/collapse-width chevron, replacing the full-screen button (feature) — `done/agentic-workflow-074-slide-over-expand-collapse-width-chevron.md`
- **agentic-workflow-080** — Duplicate task-id guard across the tree (chore, node --test, optional insurance) — `done/agentic-workflow-080-duplicate-task-id-guard.md`
- **agentic-workflow-078** — `deriveContext` dual-shape token regex in `lib/task-lifecycle.mjs` + tests (refactor) — `done/agentic-workflow-078-derivecontext-dual-shape-token-regex.md`
- **agentic-workflow-077** — Collision-resistant task IDs for multi-user / multi-branch work (replace sequential integers) (decision) — `done/agentic-workflow-077-collision-resistant-task-ids.md`
- **agentic-workflow-073** — Dashboard renders the What's next recommendation as a dismissible panel above the board prompt bar (feature) — `done/agentic-workflow-073-whats-next-renders-on-dashboard.md`
- **agentic-workflow-076** — What's next persists its recommendation as a single-latest advisory artifact (advisory write) (feature) — `done/agentic-workflow-076-whats-next-persists-advisory-recommendation.md`
- **agentic-workflow-072** — Done column should be hideable (it can grow infinitely large) (feature) — `done/agentic-workflow-072-hideable-done-column.md`
- **agentic-workflow-071** — Confetti "no @keyframes" test trips on the unrelated About-page aboutRise keyframe (bug) — `done/agentic-workflow-071-confetti-keyframes-test-trips-on-aboutrise.md`
- **agentic-workflow-070** — About-page Ko-fi button uses a solid colour, not a gradient (refactor) — `done/agentic-workflow-070-kofi-button-solid-colour.md`
- **agentic-workflow-057** — Workflow guide page — a visual left-rail explainer of the Agentheim workflow (feature, umbrella — delivered via aw-058/059/060) — `done/agentic-workflow-057-workflow-guide-page.md`
- **agentic-workflow-060** — Workflow guide diagrams (hand-authored flow visuals) (feature) — `done/agentic-workflow-060-workflow-guide-diagrams.md`
- **agentic-workflow-063** — Analyze and optimize the committing pattern (refactor) — `done/agentic-workflow-063-optimize-committing-pattern.md`
- **agentic-workflow-069** — Topbar "What's next" button fires the /agentheim:whats-next skill (replaces the interim raw prompt) (feature) — `done/agentic-workflow-069-whats-next-button-fires-whats-next-skill.md`
- **agentic-workflow-067** — Topbar stays fixed at the top of the viewport when the board or a document scrolls (bug) — `done/agentic-workflow-067-topbar-sticky-stays-fixed-on-scroll.md`
- **agentic-workflow-066** — Left rail — Research group opens by default, Decisions collapses by default (feature) — `done/agentic-workflow-066-rail-research-open-decisions-collapsed-by-default.md`
- **agentic-workflow-064** — Topbar "What's next" launch button + Work button restyle (trailing ↗, primary-surface fill) (feature) — `done/agentic-workflow-064-topbar-whats-next-button-work-restyle.md`
- **agentic-workflow-065** — Prompt-bar buttons redesign — icon tile + title/subtitle cards, Quick Capture emphasised, ⌘↵ hint (feature) — `done/agentic-workflow-065-prompt-bar-buttons-icon-tile-subtitle-redesign.md`
- **agentic-workflow-059** — Workflow page shell + three-segment layout (feature) — `done/agentic-workflow-059-workflow-page-shell-three-segment-layout.md`
- **agentic-workflow-062** — Dashboard About page — left-rail item below Board, profile bio + Ko-fi support (feature) — `done/agentic-workflow-062-dashboard-about-page.md`
- **agentic-workflow-061** — Board "Name A→Z / Z→A" sort orders by the title's readable text, in true alphabetical order (bug) — `done/agentic-workflow-061-board-name-sort-true-alphabetical-by-title.md`
- **agentic-workflow-058** — Workflow rail item + main-pane routing scaffold (third selection state) (feature) — `done/agentic-workflow-058-workflow-rail-item-main-pane-routing-scaffold.md`
- **agentic-workflow-056** — Left rail — Research group sits above Decisions (bug) — `done/agentic-workflow-056-rail-research-before-decisions.md`
- **agentic-workflow-055** — Settings menu content is off-center — equal whitespace left and right (bug) — `done/agentic-workflow-055-settings-menu-content-off-center.md`
- **agentic-workflow-054** — Board prompt bar gets a "Prompt" title; whitespace separates it from the "Board" title (feature) — `done/agentic-workflow-054-prompt-title-and-board-spacing.md`
- **agentic-workflow-053** — Topbar layout — search on the left, settings gear + Work flush right (bug) — `done/agentic-workflow-053-topbar-right-align-settings-work.md`
- **agentic-workflow-052** — Topbar global search UI — search field replaces the breadcrumb; grouped-results popover routing to the main pane (feature) — `done/agentic-workflow-052-topbar-global-search-ui.md`
- **agentic-workflow-050** — GET /api/search read endpoint — content search across BC READMEs, ADRs, research & tasks (title + body, title-first ranking, body excerpts) (feature) — `done/agentic-workflow-050-api-search-read-endpoint.md`
- **agentic-workflow-051** — Dismiss (trash-can) button threads the armed skip-permissions signal like the launch buttons (feature) — `done/agentic-workflow-051-dismiss-button-threads-armed-skip-permissions.md`
- **agentic-workflow-048** — Board card dismiss — hover-revealed red trash can with a confirmation dialog (feature) — `done/agentic-workflow-048-board-card-dismiss-trash-can.md`
- **agentic-workflow-046** — Modeling DISMISS verb — hard-delete a backlog/todo task with bookkeeping (feature) — `done/agentic-workflow-046-modeling-dismiss-verb.md`
- **agentic-workflow-049** — Topbar settings menu — collapse Stop dashboard / theme / skip-permissions into a gear dropdown (feature) — `done/agentic-workflow-049-topbar-settings-menu-dropdown.md`
- **agentic-workflow-047** — Both detail surfaces lead with the item title, not the file path (feature) — `done/agentic-workflow-047-detail-surfaces-lead-with-title-not-path.md`
- **agentic-workflow-045** — Folded frontmatter glues onto the body so a task's first heading renders as literal "## Why" (bug) — `done/agentic-workflow-045-frontmatter-section-glues-to-body-first-heading-literal.md`
- **agentic-workflow-044** — Remove the temporary "Replay celebration" button (chore) — `done/agentic-workflow-044-remove-replay-celebration-button.md`
- **agentic-workflow-043** — Dashboard hides document frontmatter behind a collapsible, structured "Front matter" section (slide-over + main pane) (feature) — `done/agentic-workflow-043-frontmatter-collapsible-structured-section.md`
- **agentic-workflow-039** — Slide-over "Open in full screen" renders the task in the main content pane (feature) — `done/agentic-workflow-039-slide-over-open-in-full-screen-main-pane.md`
- **agentic-workflow-042** — Confetti uses canvas-confetti's realistic multi-fire preset, centered on screen (feature) — `done/agentic-workflow-042-confetti-realistic-multi-fire-centered.md`
- **agentic-workflow-041** — Armed skip-permissions per-launch cue becomes a red icon, not a separate dot (feature) — `done/agentic-workflow-041-armed-cue-red-icon-not-dot.md`
- **agentic-workflow-040** — Main-pane document reader centers its reading column in the content area (bug) — `done/agentic-workflow-040-main-pane-reader-center-content-column.md`
- **agentic-workflow-038** — Board prompt bar — single-line auto-growing input replaces the multi-line textarea (feature) — `done/agentic-workflow-038-board-prompt-bar-single-line-autogrow-input.md`
- **agentic-workflow-037** — Confetti launches from the page center and shoots up toward the prompt-bar textarea (feature) — `done/agentic-workflow-037-confetti-from-page-center-up-toward-textarea.md`
- **agentic-workflow-036** — Board prompt bar — Research launch button next to Quick Capture / Modeling (feature) — `done/agentic-workflow-036-board-prompt-bar-research-button.md`
- **agentic-workflow-035** — Confetti bursts from the prompt-bar textarea center, aimed at the viewport center (feature) — `done/agentic-workflow-035-confetti-burst-from-textarea-center-aim-viewport.md`
- **agentic-workflow-034** — Fire the celebration with canvas-confetti instead of the CSS-keyframe burst (feature) — `done/agentic-workflow-034-celebration-canvas-confetti.md`
- **agentic-workflow-033** — Work button follows the active theme instead of the inverse light/dark treatment (bug) — `done/agentic-workflow-033-work-button-follows-theme.md`
- **agentic-workflow-032** — Dashboard launch no longer auto-opens the browser (chore) — `done/agentic-workflow-032-dashboard-launch-no-auto-open.md`
- **agentic-workflow-030** — Board buttons — hover shadow + background highlight; armed launch cue keeps only the dot (no red border/text) (feature) — `done/agentic-workflow-030-board-buttons-hover-drop-skip-permissions-cue.md`
- **agentic-workflow-028** — Add a button to stop the dashboard from the dashboard (feature) — `done/agentic-workflow-028-board-stop-dashboard-button.md`
- **agentic-workflow-029** — Move the theme + skip-permissions toggles to the topbar, left of the Work button (feature) — `done/agentic-workflow-029-topbar-theme-skip-permissions-toggles.md`
- **agentic-workflow-025** — Add a temporary board button that fires the celebration animation (feature) — `done/agentic-workflow-025-board-celebration-animation-test-button.md`
- **agentic-workflow-027** — Non-task documents render in the main content pane; the slide-over becomes task-only (decision) — `done/agentic-workflow-027-non-task-docs-render-in-main-pane.md`
- **agentic-workflow-026** — Rewrite the dashboard shell to the styleguide's left-rail layout (Components in context) (refactor) — `done/agentic-workflow-026-dashboard-left-rail-shell-relayout.md`
- **agentic-workflow-024** — Board prompt bar — textarea to two-thirds width, Work launch button on the right (feature) — `done/agentic-workflow-024-board-prompt-bar-work-button.md`
- **agentic-workflow-023** — Board prompt bar — type a prompt, Quick Capture / Modeling launch seeded with it (feature) — `done/agentic-workflow-023-board-prompt-bar-launch-buttons.md`
- **agentic-workflow-021** — Dashboard armed-launch setting — all bridge launches skip permissions when armed (feature) — `done/agentic-workflow-021-dashboard-skip-permissions-setting.md`
- **agentic-workflow-022** — Backlog cards get Refine & Promote launch buttons, each seeded with the ticket id — `done/agentic-workflow-022-backlog-card-refine-promote-launch-buttons.md`
- **agentic-workflow-020** — Backlog "Add ticket" becomes two launch buttons — Quick Capture & Modeling — that start a seeded Claude session — `done/agentic-workflow-020-backlog-two-launch-buttons.md`
- **agentic-workflow-019** — Rename the `capture` skill to `quick-capture` — `done/agentic-workflow-019-rename-capture-skill-quick-capture.md`
- **agentic-workflow-018** — Remove the non-functional "Add ticket" affordances from non-backlog columns — `done/agentic-workflow-018-remove-dead-add-ticket-affordances.md`
- **agentic-workflow-017** — Wire the styleguide light/dark theme toggle into the dashboard — `done/agentic-workflow-017-dashboard-theme-toggle.md`
- **agentic-workflow-016** — Backlog cards & the add-ticket button copy the matching /modeling command to the clipboard — `done/agentic-workflow-016-backlog-copy-modeling-command.md`
- **agentic-workflow-015** — Show the project name next to "Agentheim" in the dashboard header — `done/agentic-workflow-015-header-show-project-name.md`
- **agentic-workflow-014** — Group Kanban board columns by bounded context (collapsible) — `done/agentic-workflow-014-board-group-by-bounded-context.md`
- **agentic-workflow-012** — Add sorting options to Kanban board columns — `done/agentic-workflow-012-board-column-sorting.md`
- **agentic-workflow-013** — Carry task file modification time (mtimeMs) in the /api/tree projection — `done/agentic-workflow-013-tree-projection-mtime.md`
- **agentic-workflow-010** — Dashboard cross-OS verification: POSIX leg (spike) — `done/agentic-workflow-010-dashboard-posix-cross-os-verification.md`
- **agentic-workflow-011** — /dashboard command — launch, stop, status, auto-open (feature) — `done/agentic-workflow-011-dashboard-slash-command.md`
- **agentic-workflow-001** — Dashboard — local web UI over the project's .agentheim folder (epic / integration gate; Windows v1) — `done/agentic-workflow-001-dashboard.md`
- **agentic-workflow-009** — Dashboard interactivity: SSE live-update consumer + Promote → applyTaskMove (feature) — `done/agentic-workflow-009-dashboard-live-update-and-promote.md`
- **agentic-workflow-008** — Dashboard navigation: discover and browse all .agentheim artifacts (feature) — `done/agentic-workflow-008-dashboard-navigation.md`
- **agentic-workflow-007** — Dashboard slide-over: universal detail panel + client-side markdown renderer (feature) — `done/agentic-workflow-007-dashboard-slide-over-renderer.md`
- **agentic-workflow-006** — Dashboard board view: flat Kanban (lifecycle columns, BC on the card) (feature) — `done/agentic-workflow-006-dashboard-board-view.md`
- **agentic-workflow-005** — Dashboard read API: /api/tree projection + /api/doc carrier (feature) — `done/agentic-workflow-005-dashboard-read-api.md`
- **agentic-workflow-003** — Extract applyTaskMove: one shared Task-lifecycle mover for skills and the dashboard (refactor) — `done/agentic-workflow-003-extract-apply-task-move.md`
- **agentic-workflow-004** — Dashboard server bootstrap: stdlib HTTP, detached launch/stop, project discovery (feature) — `done/agentic-workflow-004-dashboard-server-bootstrap.md`
- **agentic-workflow-002** — Decide dashboard write-semantics: legal Task moves, shared mover, concurrency (decision) — `done/agentic-workflow-002-dashboard-write-semantics.md`
<!-- done-list:end -->

### Backlog
<!-- backlog-list:start -->
<!-- backlog-list:end -->

## ADRs scoped to this BC

<!-- adr-local:start -->
- **ADR-0046** — The dashboard may perform one scoped advisory write — a delete-only, advisory-only `DELETE /api/whats-next` endpoint that removes `.agentheim/state/whats-next.md` (and only that literal file, exact-equality allowlist) on explicit panel dismiss; the first dashboard write since ADR-0017 (bounded exception — read-only stance is over *lifecycle*, untouched here) and a narrowing amendment to ADR-0027 §4.5; idempotent `204`, no client-supplied path, no lifecycle side-effects, `localStorage` dismiss store retired (proposed) — `../../knowledge/decisions/0046-dashboard-scoped-advisory-delete-on-dismiss.md`
- **ADR-0045** — Protocol rotation trigger: `work`'s session-end check invokes `rotateProtocol` (via the env-free homedir→cache→semver-max plugin bootstrap, script stays git-free, skill owns the scoped `git add` + commit — the ADR-0038 three-layer boundary), closing ADR-0039's deferred "who invokes it" non-decision; the first real rotation on this repo rolled 2026-06 out to `knowledge/protocol/2026-06.md` (live `protocol.md` back near the ~1,000-line cap); accepted — `../../knowledge/decisions/0045-protocol-rotation-trigger-work-session-end-check.md`
- **ADR-0043** — Live observability: a `Stop`/`SubagentStop` hook heartbeat is a second advisory artifact — the hooks write `.agentheim/state/in-flight.json` (an advisory write extending ADR-0027, git-ignored, machine-written) and the dashboard's read-only `InFlightLane` (ADR-0017) renders live worker/verifier activity for the current `work` session, self-suppressing via a staleness window so a crashed/killed session draws no zombie lane; accepted — `../../knowledge/decisions/0043-live-observability-hook-heartbeat-second-advisory-artifact.md`
- **ADR-0041** — Artifact-growth doctrine: two disciplines for the three growth surfaces — **cap-and-roll** (verbatim, scripted, rolled to a dated archive: protocol ADR-0039 / INDEX done-list c8j3w) vs **flag-and-consolidate** (judgment, human-in-the-loop, rewritten *in place*, nothing archived: BC READMEs). Adds the `modeling` **CONSOLIDATE** verb (5th beside CAPTURE/REFINE/PROMOTE/DISMISS) with a frozen contract mirroring DISMISS/ADR-0022: a ~600-line README trigger `whats-next` surfaces as a recommended move (no skill auto-rewrites prose unattended), builder-in-the-loop consolidation that merges/rewrites but **never silently drops a term, invariant, or backlink**, committing its own scoped markdown (ADR-0026); accepted — `../../knowledge/decisions/0041-artifact-growth-two-disciplines-consolidate-verb.md`
- **ADR-0042** — The COMPLETE lifecycle script stays single-task: `completeTask` mirrors `promoteTask`'s single-id shape (moves one task, edits one BC `INDEX.md`, prepends one protocol entry) and is idempotent w.r.t. an already-in-`done/` file (worktree already moved it); the ADR-0032 trivial-squash carve-out is composed by the *caller* (the conductor runs `complete` once per task, collects N manifests, and writes the one multi-`[task-id]` squash commit) rather than built into the script — a batch-complete verb would have to invent a shared summary/`<type>` across N tasks, the judgment ADR-0038's three-layer boundary reserves for the skill; accepted — `../../knowledge/decisions/0042-complete-script-single-task-carve-out-composed-by-caller.md`
- **ADR-0040** — Vision-conformance check lives at `work`'s session-end as an **advisory** read of two named `vision.md` sections ("What success looks like" + "Non-goals") against the just-shipped batch; flags drift via a session-end protocol line and, when warranted, a `whats-next` advisory line (ADR-0027 advisory-write family) — **never a gate** (human-in-the-loop non-goal holds); deterministic extraction/formatting in `lib/vision-conformance.mjs`, the LLM judgment exercised by should-flag/should-not-flag eval fixtures under `evals/vision-conformance-check/`; accepted — `../../knowledge/decisions/0040-vision-conformance-check-session-end-advisory.md`
- **ADR-0039** — Protocol rotation doctrine: the live `protocol.md` is capped (~1,000 lines) and whole older months roll out **verbatim** (never rewritten/summarized) to dated `knowledge/protocol/YYYY-MM.md` archive files, newest-on-top order preserved; the current month is never rolled (steady-state cap, not a hard ceiling); implemented as the git-free k5n8f-family script `lib/protocol-rotation.mjs` (`rotateProtocol`, no `Date.now()` — month derived from entry headings, byte-for-byte slices); accepted — `../../knowledge/decisions/0039-protocol-rotation-doctrine-verbatim-monthly-archive-live-cap.md`
- **ADR-0038** — Lifecycle-mechanization boundary: fail-closed `depends_on` (a `depends_on` id in no lifecycle folder = unsatisfied → refuse) + three concentric bookkeeping layers, one owner each (`applyTaskMove` mover / git-free `task-lifecycle` CLI emitting an enumerated manifest / skill-or-orchestrator owning judgment + scoped git); builds on ADR-0007 (mover boundary intact), ADR-0026 (scoped-add doctrine), ADR-0032 (git-free folds into squash-merge); supersedes the duplicated bookkeeping prose across the four skills; becomes the contract for agentic-workflow-k5n8f (accepted) — `../../knowledge/decisions/0038-lifecycle-mechanization-boundary-fail-closed-dependency-three-layer-bookkeeping.md`
- **ADR-0036** — Verifier runtime-drive check: boot-and-observe the app end-to-end in its worktree — a per-BC `## Runtime surface` README manifest (surfacePaths allowlist + launch/stop/probes) that `work` resolves once per batch, and a new final verifier "Check 8" that boots via the launcher, asserts a stdlib HTTP floor + opt-in render tier, guarantees teardown, FAILs on any floor miss; ratified from proposed (accepted) — `../../knowledge/decisions/0036-verifier-runtime-drive-end-to-end-check.md`
- **ADR-0033** — Ephemeral, hover-scoped DOM/viewport observation (IntersectionObserver rooted on the sole scroll container, mounted per-hover) is admissible board-side; ADR-0017 constrains writes to disk/lifecycle, not transient client geometry reads. Collapsed-group hiding stays a pure data derivation (no DOM node to observe) (proposed) — `../../knowledge/decisions/0033-ephemeral-hover-scoped-dom-viewport-observation-admissible-board-side.md`
- **ADR-0032** — Per-worker git worktree isolation: batch-start claim commit → private `aw/<id>` branch per worker → verifier runs in the worktree → `git merge --squash` to main folding bookkeeping into one commit (ADR-0026 preserved, one deliberate amendment: the `todo → doing` move rides in the batch-start commit); FAIL leaves main pristine by construction; pre-scan demoted to advisory (accepted) — `../../knowledge/decisions/0032-worker-worktree-isolation-git-model.md`
- **ADR-0030** — The rail "new item" cue is consumer-driven from an in-memory session baseline (path → mtimeMs, reconciled each frame, mtime-versioned clearing, no cap), rendered by composing `Collapsible` + `TreeItem` directly instead of the seam-less `TreeGroup` convenience — keeps the styleguide unforked (ADR-0003) while threading the design-system-v8k2p `attention` cue (accepted) — `../../knowledge/decisions/0030-rail-attention-consumer-session-baseline-and-direct-primitive-composition.md`
- **ADR-0027** — Advisory writes are distinct from lifecycle writes; the `whats-next` recommendation is an advisory write (`.agentheim/state/whats-next.md`, single-latest, git-ignored, read via `/api/doc`) (proposed) — `../../knowledge/decisions/0027-advisory-writes-distinct-from-lifecycle-writes.md`
- **ADR-0026** — Committing doctrine: every artifact-producing skill commits its own scoped `.md`; `work` folds bookkeeping into the task commit, `commit:` field dropped, trivial-squash carve-out (accepted) — `../../knowledge/decisions/0026-committing-doctrine-bookkeeping-in-task-commit.md`
- **ADR-0025** — The dashboard main pane gains a third view state (`mainView`) for built-in static pages, beside the task/document split; reshapes ADR-0021 (proposed) — `../../knowledge/decisions/0025-dashboard-main-pane-third-view-state-builtin-static-page.md`
- **ADR-0023** — The dashboard's `/api/search` is the read-only server's first content-search endpoint — pure corpus walk, title-first ranking, body excerpts (proposed) — `../../knowledge/decisions/0023-dashboard-search-read-endpoint.md`
- **ADR-0022** — DISMISS cascades the whole dependent subtree; refuses if it touches doing/ or done/ (proposed) — `../../knowledge/decisions/0022-dismiss-cascades-dependent-subtree.md`
- **ADR-0021** — The dashboard open-intent splits on artifact kind: tasks → slide-over, non-task documents → main pane (accepted; reshapes ADR-0010 & ADR-0011 §5) — `../../knowledge/decisions/0021-open-intent-split-task-slide-over-doc-main-pane.md`
- **ADR-0020** — Board prompt-bar confetti is a board-local transient ACK, not a styleguide motion primitive (accepted) — `../../knowledge/decisions/0020-board-confetti-board-local-transient-ack.md`
- **ADR-0019** — Armed skip-permissions launch reuses the existing `--obligation` token as its danger hue, unforked (accepted) — `../../knowledge/decisions/0019-dashboard-armed-launch-danger-token.md`
- **ADR-0001** — Dashboard write-semantics — Promote-only UI moves, one shared mover, optimistic concurrency (superseded by ADR-0017) — `../../knowledge/decisions/0001-dashboard-write-semantics.md`
- **ADR-0017** — Dashboard is read-only; skills are the sole owners of task lifecycle (accepted) — `../../knowledge/decisions/0017-dashboard-read-only-skills-own-lifecycle.md`
- **ADR-0004** — Detached dashboard server uses a neutral cwd and AGENTHEIM_ROOT, not the project dir (proposed) — `../../knowledge/decisions/0004-dashboard-detached-process-cwd.md`
- **ADR-0007** — applyTaskMove owns only the move; INDEX/protocol side-effects stay with skills (proposed) — `../../knowledge/decisions/0007-task-move-side-effect-boundary.md`
- **ADR-0009** — Dashboard frontend app lives in `dashboard/app/`, consumes the styleguide; build retargets to it (proposed) — `../../knowledge/decisions/0009-dashboard-frontend-app-shell.md`
- **ADR-0010** — The dashboard slide-over feeds the styleguide Drawer a doc-shaped item (accepted) — `../../knowledge/decisions/0010-slide-over-doc-shaped-item.md`
- **ADR-0011** — The dashboard library/navigation surface is the non-task half of the tree projection, grouped client-side (accepted) — `../../knowledge/decisions/0011-dashboard-library-groups-from-tree-locations.md`
- **ADR-0012** — applyTaskMove resolves slugged task filenames from a bare id; the SSE consumer re-fetches, never interprets (proposed) — `../../knowledge/decisions/0012-applytaskmove-resolves-slugged-filenames-by-bare-id.md`
- **ADR-0015** — Board per-column view-state (group + sort + collapse) persists in versioned `localStorage` (proposed) — `../../knowledge/decisions/0015-board-view-state-persisted-localstorage.md`
<!-- adr-local:end -->

## Research touching this BC

<!-- research-local:start -->
<!-- research-local:end -->

## Concepts (opt-in synthesis pages)

<!-- concepts:start -->
<!-- concepts:end -->

## Pointers

- BC README (ubiquitous language, invariants): `README.md`
