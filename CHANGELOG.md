# Changelog

All notable changes to Agentheim are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project versions
its **plugin contract** (skills, commands, `.agentheim/` layout) with
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) — see
[`RELEASE.md`](RELEASE.md) for the release discipline (ADR-0013).

## [Unreleased]

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

[Unreleased]: https://github.com/heimeshoff/Agentheim/compare/v0.8.9...HEAD
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
