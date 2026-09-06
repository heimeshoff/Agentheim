# Changelog

All notable changes to Agentheim are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project versions
its **plugin contract** (skills, commands, `.agentheim/` layout) with
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) — see
[`RELEASE.md`](RELEASE.md) for the release discipline (ADR-0013).

## [Unreleased]

## [0.9.3] - 2026-09-06

**Bookkeeping is mechanized end-to-end, and parallel sessions stop colliding.** Every
protocol, INDEX, task-move, and git edit across `work`, `modeling`, `brainstorm`, `research`,
and quick-capture now runs through locked lifecycle CLI verbs — no skill hand-edits a
bookkeeping file anymore. Worker branches carry source and tests only; the conductor applies
the bookkeeping on `main`. Merge-back conflicts climb a ladder before they reach you, and
`/agentheim:work <id>` runs exactly the task you name.

### Added
- **Locked lifecycle verbs** — `capture` and `dismiss` (ADR-0073), `log`, `index-add`, and `scoped-commit` (ADR-0075), `bounce` and `reroute` (ADR-0077) join the task-lifecycle CLI. Every remaining hand-written protocol / INDEX / git edit in `work`, `brainstorm`, `research`, `modeling`, and quick-capture is wired onto them and the replaced prose deleted, so `main` has exactly one class of writer per bookkeeping file. `reroute` mints a fresh `<to-bc>-<token>` id, retires the old one, and re-points every project-wide backlink.
- **Concurrent modeling sessions no longer collide** on `protocol.md`, `INDEX.md`, or the git index — a project-wide advisory lifecycle lock inside every capture-side writer, an `index.lock`-retrying scoped commit, and a two-process concurrency proof whose forced overlap cannot pass by luck (ADR-0075).
- **Atomic bookkeeping writes** — every INDEX / protocol / archive write is temp-file-plus-rename with bounded `EPERM`/`EBUSY` retry; a real-process `SIGKILL` test proves a crash mid-write leaves both files intact (ADR-0076).
- **Worker branch carries source and tests only** — the conductor materializes README delta, ADRs, task moves, and backlog items on `main` at squash-merge from the worker's structured report (ADR-0074 amends ADR-0032).
- **Merge-back conflict ladder** — the abort-and-surface rule becomes seven rungs: salvage, clean derived churn, a real merge of `main` into the loser worktree (never rebase, never stash), a same-worker resolve dispatch, a mandatory re-verify against the new base, and builder escalation only as the last rung (ADR-0072).
- **`/agentheim:work <id>`** — a documented argument grammar: bare runs the whole ready set, one or more todo ids run a scoped batch with exact-match fail-closed resolution and no mid-run pickup (ADR-0071). Todo cards on the dashboard carry a bottom-right **Work** launch button seeded with that command.
- **Collision-proof ADR numbering** — workers mint a provisional number; the conductor finalizes it against `main` at squash-merge.
- **Worktree-abandonment salvage** — every `work` path that abandons a worktree captures its diff to `.agentheim/salvage/` and names it in the escalation before removal.
- **Runner-first testing** — a verdict comes only from the project's own test runner; the TDD skill's first test establishes the runner, with a SmokeGuard fallback for runner-less ecosystems.
- **Falsifiability gate** — refinement classifies each acceptance criterion as machine-checkable or `[human-eye]`; the verifier never proxies a human-eye criterion and escalates on metric drift (`lib/human-eye-criteria.mjs`).
- **Remediation-over-diagnosis dispatch ordering** and a spike stop-loss clause — an early-stopped spike is a legitimate completion, lint-enforced (ADR-0065).
- **Session-start human-churn reconciliation** — Phase 1 flags untrailered commits touching governed surfaces; advisory only, never auto-files, never gates.
- **Vacuum guard** — an empty board with open vision decisions surfaces them with their age instead of self-generating filler; session-end reports the batch mix.
- **Doctrine hygiene lints** — mechanize-or-drop (a convention-establishing task ships its enforcement or records prose-only), a ~60-word cap on new INDEX entries (date-grandfathered), the drift-twice rule (ADR-0068), and audit-closure doctrine with a ban on raw line-number pointers in doctrine prose (ADR-0069).
- **Dashboard live-tree hub** — one `/api/events` source and one `/api/tree` fetch per tab; board, rail, What's Next, and In-Flight subscribe instead of each opening their own. Advisory frames re-sync only the panel that reads that artifact (ADR-0070). A hidden tab pauses live re-sync and catches up once on return.
- **The dashboard runtime notices a plugin update** — the runfile records the serving plugin version and root; launch replaces a live server whose identity is stale or points at a removed cache dir; `status` and `GET /healthz` surface the serving version; static responses carry `Cache-Control: no-cache`.
- **Dist freshness is a failing check** — `RELEASE.md` gains a rebuild-and-stage `dashboard/dist` step ahead of the version bump, and `dist-staleness.test.mjs` fails whenever the committed bundle lags its sources.

### Changed
- Board cards and columns are memoized over an identity-stable tree projection, so a hover re-renders one card and its dependency targets instead of the whole board.
- Ambient rail animations are compositor-only (opacity-only keyframes, glow on a pre-painted layer); a new lint fails on any non-compositable property in an infinite keyframe (ADR-0014 amended).
- The five big doctrine files state each rule once, imperatively, with an ADR pointer — `work` + `modeling` + `verifier` shrank from 1610 to 1427 lines with no rule lost.
- Both session reconciliations are consumer-tuned: session-start churn recognizes every commit-doctrine machine shape and prints one summary line; session-end carry-over scopes the per-file ask to `.agentheim/` paths and batches user WIP (ADR-0066).
- Batch-mix classification is path-aware — a consumer product bug or refactor touching only product files no longer reads as meta-work drift (ADR-0064).
- Mechanize-or-drop checks fire only when a diff touches doctrine-bearing surfaces; consumer product tasks skip them.
- The four conductor helper modules run in consumer installs via a shared `references/lib-bootstrap.md` pointer at every call site.
- Dashboard-launched and bridge-derived session names drop the `Modeling:` prefix.
- `research` gets its own scoped Committing section (report + INDEX + protocol) and a commit-doctrine table row.

### Fixed
- The `checkpoint` verb detects a worker's `doing → done/backlog` move from the file list and stages the vacated `doing/` path, so the wip commit no longer holds the task file in both lifecycle folders — and the detection is separator-insensitive on Windows.
- BOUNCE integration checkpoints the task file before its squash-merge, so the `doing → backlog` move actually reaches `main`.
- `archivedDoneHeader` no longer emits a phantom "most recent N" cap; a non-rotating session-end run heals a stale archive-naming header and `work` commits the heal (ADR-0047 amended).
- The verifier judges the recorded mitigation, not the skipped diagnosis, on a stop-lossed spike (ADR-0065 carve-out).
- Two undocumented 2026-07-02 survey dispositions are recorded in ADR-0067.
- A sweep of doctrine drifts from the 2026-07-22 audits: `verification-before-completion` synced to `verifier.md` on all six drifts, the TDD skill's runner-verdict and UI-skip restatements reduced to pointers, `lib-bootstrap.md` gained runnable consumer-install invocations, `whats-next` caught up on the vacuum-guard and remediation-first advisories, quick-capture's stale `<NNN>` id placeholder fixed, and `human-eye-criteria.mjs` aligned with its doctrine.

### Docs
- The bridge upgrade path and the "older version" banner are documented.

## [0.9.2] - 2026-07-13

**Pick the model you launch with.** The prompt bar's Enter button widens into a split
button that names the session model and lets you change it — and because an old bridge
would silently swallow the field, the bridge now says out loud what it can honour.

### Added
- **Model selector in the prompt bar** — the ochre Enter button becomes a labelled `ModelSplitButton`: a launch region plus a caret opening a roving-tabindex model menu (locked/disabled variants, full keyboard + ARIA). `Ctrl+M` cycles the model from anywhere on the board as its own disjoint key intent, Quick Capture projects to Haiku at read time without overwriting your stored choice, and both mode and model survive a launch.
- **The bridge advertises what it can honour** — `GET /health` carries a live capability handshake (absent ⇒ legacy baseline), and the dashboard omits `model`/`name` at the wire level whenever the fire-time-probed listener lacks them. A structural guard stops a future `POST /run` field from drifting out of sync with the advertised set.
- **Capability skew is visible, never silent** — with no live bridge, or one too old to advertise `model`, the prompt bar greys out the selector (naming no model) and a dismissible board-local banner announces the skew. A stale-but-present bridge can no longer show a live selector while the wire quietly drops the model.
- `POST /run` accepts an optional allowlisted `model` (riding the launch descriptor as its own `--model <id>` argv pair) and an optional sanitized display `name` with a prompt-derived fallback, so bridge-launched sessions arrive named via `claude -n` / `createTerminal({name})`.
- **A DOM-render test harness** — jsdom plus a `module.register()` resolve hook mirroring esbuild's `nodePaths`, so a test can mount a real component, dispatch a real keydown, and assert what a source-regex suite structurally cannot.
- **The "workers never rebuild `dist/`" contract is now structural** — the conductor's checkpoint `git add` is filtered against the worker's declared file list (`lib/derived-artifact-guard.mjs` + a `checkpoint` verb on the lifecycle CLI). Workers were never defying the rule: the test suite's own `before()` hook rebuilds `dist/`, so the staging seam is the only place that can hold it.

### Changed
- **Prompt-bar mode cycling moves to `Tab` / `Shift+Tab`**, freeing `Ctrl+arrows` for native word-jump and word-select in the multi-line prompt field; `Escape` blurs the textarea as the keyboard exit for the hijacked `Tab`.
- Quick Capture is pinned to Haiku.

### Fixed
- The prompt field shrinks back to one line after a launch — the re-measure moved to a `useLayoutEffect` keyed on the prompt, so it observes the DOM after React commits the clear.
- The Launched/Copied flash anchors to the mode that actually fired, instead of painting on Quick Capture after the success-reset snaps the highlight back to index 0.
- `ModelSplitButton`'s menu opens upward and escapes the prompt console's clip; its `disabled` state gates the launch region only, so the caret stays clickable, keyboard-reachable and full-opacity — a blank prompt no longer blocks picking a model.
- `applyTaskMove` writes the status-rewritten body to the destination (backfilling a missing lifecycle folder) and only then unlinks the source, never rewriting the source in place (ADR-0055); a genuine pre-unlink failure now rejects cleanly instead of throwing.

## [0.9.1] - 2026-07-10

Two field defects in the mechanized task-lifecycle scripts — both now fail closed
rather than reporting success on a corrupt board — plus a rebuilt Workflow guide page.

### Fixed
- **INDEX done-list rotation fails closed on an unparseable done-list** — a bounded context whose done-list parses to zero entries, or whose rewrite would silently drop unmatched lines, now refuses and writes nothing instead of reporting `{ok:true, liveEntries:0}`. A refusal is scoped to its own BC: a missing-markers throw in one context no longer strands an already-rotated healthy one, because per-BC refusals never flip the top-level `ok` or the exit code.
- **Lifecycle bookkeeping computes before it moves** (ADR-0054) — `promoteTask`, `claimBatch`, and `completeTask` replace the hand-maintained dry-run marker mirror with compute-then-write atomicity, closing the gap where the fail-closed pre-check missed the INDEX task-count lines. `adjustIndexCount` no longer admits negative counts or leaks across block scopes, and the source-resolution predicate the three verbs shared is extracted into one place.

### Docs
- The dashboard's built-in **Workflow guide page** is rebuilt for first-time comprehension: an at-a-glance loop map (`01 Prepare` once, then the standing `02 ↔ 03` loop with a labelled return edge) and a legend for the two-voice grammar (ochre = your moves, neutral = the harness's).
- `skills/work/SKILL.md` documents the three per-BC shapes the rotation manifest can carry, and when the session-end check must commit, refuse, or stay silent.

## [0.9.0] - 2026-07-09

The **Command-deck redesign** — the dashboard is retokenized to a cool-neutral
palette and the board grows a docked prompt console you drive from the keyboard.

### Added
- **Docked prompt console** — the flat launch-card row is replaced by a bottom-center console with keyboard-committed mode tabs and its own pure `prompt-mode.js` keyboard model (cycle / launch / swallow), specified by ADR-0050 and ADR-0051.
  - **Plain mode**, a fifth tab that sends your prompt to Claude verbatim.
  - Bare `Enter` (and `Ctrl+Enter`) launches, `Shift+Enter` inserts a newline, `Ctrl+Space` focuses the field, and clicking a tab only selects it.
  - Per-mode glyphs (diamond / circle-dot) and a solid-ochre icon-square Enter button.
- **Board-wide View chip** — one `View` control replaces the four per-column Sort and Group-by-BC controls, composed unforked on the shared `Menu` primitive under a `COLUMNS` label (ADR-0015 amended: the view lens is board-wide; collapse and Done-peek stay column-scoped).
- `EnterButton` gains a `disabled` prop, painted opacity-only per ADR-0016.
- A `--radius-card: 10px` token and an `--emphasis-border` token pair.

### Changed
- **Command-deck palette** (ADR-0049) — both `[data-theme]` blocks retokenized to the 1b dark stack with a derived light counterpart, superseding the Ledger warm-paper heritage. Names and roles are frozen; only values move.
- **Accent discipline sharpened** (ADR-0048) — a fires/commits-vs-passive-selection test applied across all five accent tension surfaces, with the left-nav active item keeping its ochre inset rail as a bounded wayfinding exception.
- `ShellRail` matches the 1a single-panel shape: 236px width, `WORKSPACE` tree header, loss-tolerant footer status line, ochre inset rail on the active primary-nav item.
- `WhatsNextPanel` is now a numbered, connected flight-plan stepper; its topbar launcher wears an ochre CTA emphasis.
- `TicketCard` condensed — no context chip, no estimate chip, no timestamp; the meta row survives only for a corner action.
- Every prompt-bar mode declines to launch without a prompt; `requiresPrompt` is retired.
- The dashboard `Stop` menu item POSTs a scoped `/api/stop` endpoint directly instead of spawning a bridge session.
- `modeling` REFINE auto-promotes a task on readiness instead of prompting.

### Fixed
- **Agentheim works as an installed plugin again** — every internal agent-spawn identifier across `skills/` and `agents/` is namespaced with `agentheim:`, fixing `Agent type 'worker' not found` for anyone who installed Agentheim rather than cloning it. A live-tree lint guards the regression (ADR-0052).

### Changed
- **What's Next dismiss deletes its artifact** — dismissing the panel now issues `DELETE /api/whats-next`, which unlinks the advisory `state/whats-next.md` via an exact-equality allowlist that provably cannot touch the sibling `state/in-flight.json`; the localStorage dismiss store is retired (ADR-0046).

### Fixed
- INDEX done-list rotation is now wired into the work session-end flow (ADR-0047, closing the ADR-0045 sibling non-decision) — the first real rotation ran on this repo, rolling the agentic-workflow 2026-06 entries to `done-archive/2026-06.md`.

## [0.8.9] - 2026-07-04

### Added
- **Live work-session activity** — Stop/SubagentStop hooks heartbeat an advisory `state/in-flight.json` (ADR-0043); a read-only InFlightLane renders in-flight work on the board and self-suppresses when the heartbeat goes stale.
- **Dependency-aware board** — hovering a ticket resolves its dependencies and drives an on-card ring; hidden and off-viewport dependencies surface as presence markers and edge blinks; collapsed groups carry markers; `depends_on`/`blocks` now flow through the `/api/tree` projection.
- **Per-worker git worktree isolation** in the `work` skill's git model (ADR-0032) — parallel workers no longer contend on a shared working tree.
- **Verifier runtime-drive check** (check 8, ADR-0036) — the verifier boots the runtime surface end-to-end from a per-task runtime-surface manifest, and the resolved test command is pre-loaded into its spawn prompt.
- Fan-out caps — a `MAX_PARALLEL` knob, a research fan-out cap, and a documented nested-spawn budget.
- Verbatim monthly rotation for `protocol.md` and the INDEX done-list (ADR-0039), each keeping a live cap and archiving older months intact.
- Session-end advisories — a vision-conformance check and reconciliation of stranded working-tree carry-over; protocol entries now carry Duration and mandatory verification-iteration counts.
- **What's Next** advisory now feeds back into modeling and work planning; the workflow guide surfaces `inquire` and `whats-next`.

### Changed
- **Lifecycle bookkeeping mechanized** — PROMOTE, CLAIM, and COMPLETE run through git-free lifecycle scripts with an env-free plugin-file resolver, ratifying the mechanization boundary (ADR-0038).
- Per-agent model tiers are pinned to decorrelate the adversarial verifier/worker gates.
- Single-specialist consultation flattened — a worker spawns the specialist directly (ADR-0035); the "two orchestrators" naming resolved (the work loop is the conductor).
- BC READMEs gain a CONSOLIDATE verb and consolidation doctrine; duplicated doctrine single-sourced into `references/` files.

### Fixed
- Task-lifecycle bookkeeping no longer strands the board on CRLF/BOM `INDEX.md`/`protocol.md` (EOL/BOM boundary-normalization with fail-closed marker validation before any move).
- `applyTaskMove` enumerates the vacated source path so a scoped `git add` stages a lifecycle move atomically (no stale duplicate left in `todo/`).
- `deriveContext` tolerates leading-digit token tails, with a mint-time id-grammar lint and grandfather allowlist (ADR-0044).
- Typographic quotes survive the raw-argv round-trip; `isTaskIntent` byte-identical guards made CRLF-agnostic.
- Verifier check 6 sharpened to close the task-file-prose-narration loophole — a decision narrated only in a task file still requires an ADR.
- README dashboard section corrected (read-only, bridge-launched); `work` SUCCESS return template carries the `TESTS_*` fields.

## [0.8.8] - 2026-06-19

### Added
- **Inquire** skill — structure-aware codebase Q&A, surfaced as a launch card in the dashboard prompt bar (with a message-circle-question glyph).
- Dashboard left rail blinks new or updated research docs and ADRs until acknowledged (rail "new item" attention cue; `mtimeMs` carried on research/ADR pointers in `/api/tree`).

### Changed
- Done column gains a collapse/peek control (replacing the hide control), with a right-aligned group toggle and a chevrons-up/chevrons-down glyph pair.
- README restructured to researched conventions — hero light/dark dashboard screenshots via `<picture>`, install/update and VS Code-bridge sections folded into `<details>`; maintainer "releasing" content moved to `RELEASE.md`.

## [0.8.7] - 2026-06-18

### Added
- **What's Next** skill — topbar launcher plus a dismissible board recommendation panel that persists an advisory artifact; capped, scrollable columns and a three-column card layout.
- **Workflow guide** page — three-segment layout (Preparation / Capturing / Promote & Work) with hand-authored diagrams; new About page (profile bio, Ko-fi support).
- **Global search** — `GET /api/search` content-search endpoint, topbar search UI, and a SearchField + grouped-results combobox styleguide pattern.
- Concepts as a first-class rail group and searchable category; concept content-type (lightbulb glyph, magenta tokens).
- Drawer in-place expandable width — a chevron control replaces the full-screen button.

### Changed
- ADR-0028: collision-resistant task IDs via a short random-token scheme; id-minting prose swept across the skills; duplicate task-id guard scanner added.

### Fixed
- Numerous dashboard fixes — fixed topbar/rail with inner-region scrolling, locale-aware Name sort, settings-dropdown centering, confetti keyframe guard, and more.

## [0.8.6] - 2026-06-16

### Added
- **DISMISS** as the modeling skill's fourth verb (cascade delete + bookkeeping reconciliation); a hover-revealed trash-can in the dashboard fires it through a shared ConfirmDialog.
- Shared design-system primitives — Button, Modal, ConfirmDialog, and Menu/Popover (consumed unforked by the dashboard); trash-2 glyph.
- Dashboard celebration via canvas-confetti; a Research launch button on the prompt bar; a settings gear dropdown consolidating Stop / theme / skip-permissions.

### Changed
- Both detail surfaces lead with the item title rather than the file path; document frontmatter folds into a quiet collapsible section; prompt bar is a single-line auto-growing field.

### Fixed
- Dashboard binds a deterministic project-root port for a stable origin across relaunches; bridge spawns `claude` directly so prompt metacharacters survive verbatim.

## [0.8.5] - 2026-06-14

### Added
- **VS Code bridge** extension — a `127.0.0.1` listener that opens a seeded Claude terminal; backlog Quick Capture & Modeling launch buttons; `GET /api/bridge`; opt-in skip-permissions threaded through bridge launches.
- Board grouping by bounded context (persisted view-state); project name in the header; styleguide light/dark theme toggle wired in; ambient pulse on doing-status cards; shared Collapsible primitive.

### Changed
- Dashboard made read-only — skills own the task lifecycle (ADR-0017); the `capture` skill renamed to `quick-capture`.

### Fixed
- A malformed task status no longer blanks the board; done-task dependencies matched by `<id>-<slug>` via `resolveTaskFile`.

## [0.8.4] - 2026-06-08

### Added
- **/release** command automating the `RELEASE.md` checklist; guarded to the Agentheim source repo and made project-local (never shipped to plugin consumers).

### Fixed
- `/dashboard` launcher located via an env-independent resolver rather than an empty `$CLAUDE_PLUGIN_ROOT`.

### Docs
- GitHub Release notes step added to the release checklist.

## [0.8.3] - 2026-06-08

### Fixed
- `/dashboard` invoked by a plugin-rooted path, not a project-relative one; command-card + foreign-launch test seam added.

## [0.8.2] - 2026-06-08

### Added
- Independent per-column sort on the dashboard board.

### Changed
- Task file `mtimeMs` carried in the `/api/tree` projection.

## [0.8.1] - 2026-06-08

### Added
- **capture** (quick-jot) skill — a fast backlog entry point.
- Plugin release discipline codified (ADR-0013 + `RELEASE.md`).

### Fixed
- Dashboard `assetRoot` resolved module-relative.

### Other
- Dashboard cross-OS verification (Windows + POSIX parity).

## [0.8.0] - 2026-06-08

### Added
- **Dashboard** — a local stdlib-Node HTTP server with a read API (`/api/tree`, `/api/doc`), a flat Kanban board, a universal markdown slide-over, a browsable artifact library, live updates over SSE, and a `backlog→todo` Promote write path; the `/dashboard` slash command (launch / stop / status); offline-vendored webfonts; an esbuild→`dist` build pipeline.
- Research gated behind a review loop with a `research-reviewer` agent.

### Docs
- `/dashboard` documented in the README and the workflow guide (HTML/PDF).

## [0.6.0] - 2026-05-14

### Changed
- **Renamed to Agentheim**; the narrator extracted into its own standalone plugin.

### Added
- Memory layer — per-BC and top-level indexes, task backlinks, prior-art lookup, concept candidates.
- `infrastructure` promoted to a first-class bounded context with global vs BC-local routing.
- TDD and a verification-before-completion gate added to the `work` skill.

## [0.5.0] - 2026-05-12

### Changed
- Renamed the `/voice` command to `/narrator`.

## [0.4.1] - 2026-05-12

### Changed
- `/voice` prints a flat two-category list instead of an `AskUserQuestion` picker.

## [0.4.0] - 2026-05-12

### Changed
- Replaced system-beep hooks with Mockingbird TTS; added the `/voice` picker.

## [0.3.0] - 2026-05-06

### Added
- Six switchable conversational modes added to the `brainstorm` and `model` skills.

## [0.2.0] - 2026-04-27

### Added
- Architecture and design-system integration; `marketplace.json` so the plugin is installable; sound hooks (Windows only); initial README.

### Docs
- Documented plugin update behavior in the README.

## [0.1.0] - 2026-04-24

### Added
- Initial plugin design.

[Unreleased]: https://github.com/heimeshoff/Agentheim/compare/v0.9.3...HEAD
[0.9.3]: https://github.com/heimeshoff/Agentheim/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/heimeshoff/Agentheim/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/heimeshoff/Agentheim/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/heimeshoff/Agentheim/compare/v0.8.10...v0.9.0
[0.8.10]: https://github.com/heimeshoff/Agentheim/compare/v0.8.9...v0.8.10
[0.8.9]: https://github.com/heimeshoff/Agentheim/compare/v0.8.8...v0.8.9
[0.8.8]: https://github.com/heimeshoff/Agentheim/compare/v0.8.7...v0.8.8
[0.8.7]: https://github.com/heimeshoff/Agentheim/compare/v0.8.6...v0.8.7
[0.8.6]: https://github.com/heimeshoff/Agentheim/compare/v0.8.5...v0.8.6
[0.8.5]: https://github.com/heimeshoff/Agentheim/compare/v0.8.4...v0.8.5
[0.8.4]: https://github.com/heimeshoff/Agentheim/compare/v0.8.3...v0.8.4
[0.8.3]: https://github.com/heimeshoff/Agentheim/compare/v0.8.2...v0.8.3
[0.8.2]: https://github.com/heimeshoff/Agentheim/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/heimeshoff/Agentheim/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/heimeshoff/Agentheim/compare/v0.6.0...v0.8.0
[0.6.0]: https://github.com/heimeshoff/Agentheim/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/heimeshoff/Agentheim/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/heimeshoff/Agentheim/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/heimeshoff/Agentheim/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/heimeshoff/Agentheim/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/heimeshoff/Agentheim/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/heimeshoff/Agentheim/releases/tag/v0.1.0
