---
id: agentic-workflow-023
title: Board prompt bar — type a prompt, Quick Capture / Modeling launch seeded with it
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: d75d820
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, bridge, ui]
related_adrs: [0020, 0018, 0003, 0009, 0001, 0014]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [agentic-workflow-020, agentic-workflow-016, agentic-workflow-022]
---

## Why

Today the only way to start a capture/modeling session from the dashboard is to
click bare **Quick Capture** / **Modeling** buttons that live inside the backlog
column (aw-020) and seed the *bare* command — the builder then has to type the
actual idea into the terminal afterwards. The natural flow is the other way round:
*think of the idea, type it, then choose how to file it.* Giving the board a
first-class prompt field — and lifting the two launch buttons out of the backlog
column to sit beneath it, above the board — lets the builder author a prompt once
and hand it straight to whichever skill they pick, without round-tripping through
the terminal.

## What

Relocate and extend aw-020's backlog launch buttons into a **board-level prompt
bar**:

- A multi-line **prompt textarea** rendered on the **board view only**, between the
  shell header (project name / board↔library switch / theme toggle) and the board
  columns.
- The existing **Quick Capture** and **Modeling** buttons move out of the backlog
  column to sit **beneath the textarea, above the board**.
- Clicking a button seeds the matching command **with the typed prompt appended**
  (`/agentheim:quick-capture <prompt>` / `/agentheim:modeling <prompt>`) and opens a
  real Claude session through the VS Code bridge, or copies that exact string to the
  clipboard on the bridge-absent fallback — reusing aw-020's `launchOrCopy` unchanged
  (ADR-0018). The board stays a projection of disk (ADR-0001): launching is an
  external side-effect, never a lifecycle write.

Builder decisions (2026-06-15): empty textarea → **bare command** (byte-identical to
aw-020); after a successful launch/copy → **clear the textarea and play a confetti
animation** over it; the bar lives on the **board surface only** (not Library). Scope
is the **two column buttons only** — the per-card Refine / Promote pair (aw-022) stays
id-seeded and does **not** pick up the prompt.

## Acceptance criteria

- [ ] A multi-line **prompt textarea** renders on the **board view only**, between the
      shell header and the board columns (above the `BoardHeader` count strip). It is a
      board-local, token-matched control (the styleguide has no text-input primitive;
      board-control precedent — sort `<select>`, group toggle — keeps the styleguide
      consumed **unforked**, ADR-0003).
- [ ] The **Quick Capture** and **Modeling** buttons are **removed from the backlog
      column** (`BacklogLaunchPair` no longer rendered inside `BoardColumn`) and shown
      **beneath the textarea, above the board**. The backlog column no longer carries
      them; todo / doing / done remain unaffected (still no add affordance, aw-018).
- [ ] Clicking **Quick Capture** seeds `/agentheim:quick-capture <prompt>` and
      **Modeling** seeds `/agentheim:modeling <prompt>`, where `<prompt>` is the trimmed
      textarea contents, separated from the command by a single space.
- [ ] When the textarea is **empty / whitespace-only**, both buttons fall back to the
      **bare command** (`/agentheim:quick-capture` / `/agentheim:modeling`) —
      byte-identical to aw-020.
- [ ] Each button still opens a real Claude session via the **bridge** and falls back
      **silently** to clipboard copy when the bridge is absent — `launchOrCopy` /
      `LaunchButton` reused **unchanged** (ADR-0018); only the command **string** now
      carries the prompt.
- [ ] On a **successful launch or clipboard copy**, the textarea is **cleared** and a
      **confetti animation** plays over/around it to mark the clearance. Confetti is
      board-local, token-aware, honours `prefers-reduced-motion`, and avoids ADR-0016's
      reserved accent. No clear / no confetti when the action stays silent (clipboard
      blocked too).
- [ ] The command **string builders are pure and unit-tested** (`node --test`):
      `modeling-command.js` gains prompt-taking builders (e.g.
      `quickCaptureCommandFor(prompt)` / `modelingCommandFor(prompt)`) that append a
      single space + trimmed prompt when present, else return the bare command; a
      missing / non-string / whitespace prompt degrades to the bare command (never
      `[object Object]`, never a doubled space, never a throw). The existing
      `QUICK_CAPTURE_COMMAND` / `MODELING_COMMAND` constants stay (the builders'
      bare-command base).
- [ ] The board stays a **projection of disk** (ADR-0001): no change to `/api/tree`,
      the SSE consumer, or the read-only contract (ADR-0017).
- [ ] `dashboard/dist/` is rebuilt (esbuild) so the served bundle carries the change;
      the dashboard test suite stays green.

## Notes

- **Seam — command builders.** `dashboard/app/modeling-command.js` exports the bare
  `QUICK_CAPTURE_COMMAND` / `MODELING_COMMAND` constants today; this adds prompt-taking
  builders alongside them (mirroring aw-022's `refineCommandFor` / `promoteCommandFor`
  shape and `safeId` degradation). The aw-022 per-card builders are **not** touched —
  the prompt is scoped to the two column buttons only.
- **Seam — board layout.** `BacklogLaunchPair` (board.js) moves out of `BoardColumn`
  (currently rendered at the `status === "backlog"` line) into a new board-view
  component owning the textarea state, rendered inside `DashboardBoard` above
  `BoardHeader`. `LaunchButton` already takes a `command` string — the bar computes the
  command from the live textarea value at click time and clears + fires confetti on the
  `launchOrCopy` resolution.
- **Coordinate with aw-021 (in `doing/`).** aw-021 threads a `skipPermissions` option
  through `launchOrCopy` and adds an armed shell-header control; this task threads a
  *prompt* into the command **string**. Different seams, but both touch `board.js` and
  the launch path — whoever picks this up should rebase on aw-021's merge to avoid a
  `board.js` collision. (Not a hard `depends_on`.)
- **Two design-system follow-ups (non-blocking, board-local precedent).** (1) a shared
  **TextArea / prompt-input** primitive (no styleguide input exists today); (2) a shared
  **confetti / celebration motion** treatment (motion is design-system territory, see
  ADR-0014's "ambient motion may signal status"). Both are built board-local here and
  worth a `design-system` capture for the reusable primitive — the worker may only edit
  this BC's README, so flag both for the orchestrator.
- **Prior art:** extends **aw-020** (the buttons being relocated), **aw-016** (the
  copy-command origin), **aw-022** (the per-card launch pair / builder shape). Bridge
  contract from the **vscode-dashboard-terminal-bridge** research (2026-06-09) and
  ADR-0018.
- **ADR written:** `0020-board-confetti-board-local-transient-ack.md` — why the
  confetti is a board-local transient ACK (injected `@keyframes`), not a styleguide
  motion primitive like ADR-0014's status pulse, and how it honours reduced-motion
  (ADR-0014) and the reserved hues (ADR-0016 / ADR-0019).

## Outcome
aw-020's bare Quick Capture / Modeling launch buttons were **relocated** out of the
backlog column into a new **board-level prompt bar** (`BoardPromptBar`): a multi-line
textarea rendered on the board view only, between the shell header and the columns
(above the `BoardHeader` count strip), with the two buttons beneath it. Clicking a
button seeds the matching command **with the typed prompt appended** —
`/agentheim:quick-capture <prompt>` / `/agentheim:modeling <prompt>` (trimmed, single
separating space) — or the **bare** command when the textarea is empty (byte-identical
to aw-020). On a **successful launch or landed clipboard copy** the textarea is
**cleared** and a board-local **confetti** burst plays; a fully-silent action
(clipboard blocked too) does neither. Launch reuses aw-020's `launchOrCopy` /
`LaunchButton` unchanged (ADR-0018); only the command **string** now carries the
prompt. aw-021's `skipPermissions` threading is **preserved** — the prompt bar carries
it through to both relocated buttons, so an armed launch still skips permissions. The
per-card Refine / Promote pair (aw-022) stays **id-seeded**, untouched. The board stays
a projection of disk (ADR-0001).

Key files:
- `dashboard/app/modeling-command.js` — added pure `quickCaptureCommandFor(prompt)` /
  `modelingCommandFor(prompt)` (append single space + trimmed prompt, else the bare
  `QUICK_CAPTURE_COMMAND` / `MODELING_COMMAND`; missing / non-string / whitespace
  degrades to bare — never `[object Object]`, never a doubled space, never a throw).
  The bare constants stay as the builders' base.
- `dashboard/app/board.js` — new `BoardPromptBar` (owns textarea + confetti state,
  rendered in `DashboardBoard` above `BoardHeader`, threads `skipPermissions`) and
  `BoardConfetti` + idempotent `ensureConfettiStyle` (board-local injected keyframes,
  reduced-motion-aware, status-palette only). `LaunchButton` gained an optional
  `onResult` callback (the bar clears + celebrates off the `launchOrCopy` resolution;
  every existing caller unchanged). `BacklogLaunchPair` removed from `BoardColumn`.
- `dashboard/test/modeling-command.test.mjs` — +7 cases for the prompt-taking builders
  (append, bare-on-empty, whitespace collapse, trim, non-string degrade, interior
  whitespace preserved).
- `dashboard/test/board-prompt-bar.test.mjs` (new) — static board-glue guard: the bar
  owns the textarea, renders above `BoardHeader`, the relocated buttons left the
  column, seed the prompt-taking builders, thread `skipPermissions`, clear + confetti
  on success only, confetti honours reduced-motion and avoids the reserved accent.
- `dashboard/test/backlog-card-launch.test.mjs` — relaxed the wholesale
  `modelingCommandFor` absence guard to a per-card-scoped guard (the symbol now exists
  again for the prompt bar with NEW prompt semantics; the per-card pair must still seed
  refine/promote).
- `dashboard/dist/` rebuilt (esbuild) so the served bundle carries the change.
- `.agentheim/contexts/agentic-workflow/README.md` — the *Backlog launch buttons*
  bullet became *Board prompt bar*; the skip-permissions bullet's "column pair"
  phrasing updated to "prompt-bar pair".
- `.agentheim/knowledge/decisions/0020-board-confetti-board-local-transient-ack.md`
  (new ADR).

Full dashboard suite: **255 green** (was 226 at aw-022; aw-021 + this task added).
