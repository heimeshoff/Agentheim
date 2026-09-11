---
id: agentic-workflow-036
title: Board prompt bar — Research launch button next to Quick Capture / Modeling
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: 1cfbccf
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, bridge, ui]
related_adrs: [0018, 0003, 0009, 0001]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [agentic-workflow-023, agentic-workflow-024, agentic-workflow-020]
---

## Why

The board prompt bar (aw-023) lets the builder author a prompt once and hand it to
**Quick Capture** or **Modeling**. The same authored-once-then-route flow fits
**research**: the builder often types a question they want investigated, not filed.
Today they'd have to copy the text and start a research session by hand. Adding a
third **Research** button beside the existing pair closes that gap — type the
question, click Research, and a `/agentheim:research <prompt>` session opens (or the
command lands on the clipboard when the bridge is absent), exactly like the other two.

## What

Add a third launch button — **Research** — to the board prompt bar, alongside the
existing Quick Capture / Modeling pair, with **identical behaviour**:

- Clicking **Research** seeds `/agentheim:research <prompt>`, where `<prompt>` is the
  **trimmed** textarea contents joined to the command by a single space; an
  **empty / whitespace-only** textarea falls back to the **bare** `/agentheim:research`.
- It reuses the same launch path unchanged — `launchOrCopy` / `LaunchButton`
  (`bridge-launch.js`), opening a real Claude session through the VS Code bridge and
  falling back **silently** to clipboard copy when the bridge is absent (ADR-0018).
- It threads `skipPermissions` the same way the other prompt-bar buttons do (aw-021),
  and shares the prompt-bar's `onResult` so a successful launch/copy **clears the
  textarea and fires the confetti** burst, identical to Quick Capture / Modeling.
- Launching is an external side-effect, **not** a lifecycle write — the board stays a
  projection of disk (ADR-0001 / ADR-0017).

## Acceptance criteria

- [ ] A third **Research** button renders in the board prompt bar, next to Quick
      Capture and Modeling (board view only), consuming the styleguide `LaunchButton`
      **unforked** (ADR-0003).
- [ ] Clicking **Research** seeds `/agentheim:research <prompt>` where `<prompt>` is
      the trimmed textarea contents, separated from the command by a single space.
- [ ] An **empty / whitespace-only** textarea falls back to the **bare**
      `/agentheim:research` (no trailing space, never `[object Object]`, never a throw).
- [ ] The button opens a real Claude session via the **bridge** and falls back
      **silently** to clipboard copy when the bridge is absent — `launchOrCopy` /
      `LaunchButton` reused **unchanged** (ADR-0018); only the command **string** is new.
- [ ] It threads `skipPermissions` (aw-021) like the sibling prompt-bar buttons, and
      wears the armed per-launch indicator dot when the skip-permissions toggle is armed
      (aw-030 / ADR-0019), consistent with the other two.
- [ ] On a **successful launch or landed clipboard copy**, the textarea is **cleared**
      and the confetti burst plays (shared `onResult` path); a fully-silent action
      (clipboard blocked too) clears nothing and plays nothing.
- [ ] The command **string is built by a pure, unit-tested builder** (`node --test`):
      `modeling-command.js` gains a bare `RESEARCH_COMMAND` constant **and** a
      prompt-taking `researchCommandFor(prompt)` mirroring `quickCaptureCommandFor` /
      `modelingCommandFor` (append single space + trimmed prompt when present, else the
      bare command; missing / non-string / whitespace degrades to bare).
- [ ] The board stays a **projection of disk** (ADR-0001): no change to `/api/tree`, the
      SSE consumer, or the read-only contract (ADR-0017).
- [ ] `dashboard/dist/` is rebuilt (esbuild) so the served bundle carries the change; the
      dashboard test suite stays green.

## Notes

- **Seam — command builder.** `dashboard/app/modeling-command.js` already exports
  `QUICK_CAPTURE_COMMAND` / `MODELING_COMMAND` / `WORK_COMMAND` constants and the
  prompt-taking `quickCaptureCommandFor(prompt)` / `modelingCommandFor(prompt)` builders
  (aw-023). Add `RESEARCH_COMMAND = "/agentheim:research"` and
  `researchCommandFor(prompt)` in the same shape — one source of truth for both the
  launch and the clipboard-fallback strings.
- **Seam — prompt bar.** The third button lives in the `BoardPromptBar` component in
  `dashboard/app/board.js` (built in aw-023, owns the textarea + confetti state). It
  computes the command from the live textarea value at click time via
  `researchCommandFor`, threads `skipPermissions`, and shares the existing `onResult`
  (clear + confetti). No new launch infrastructure — only a new `LaunchButton` instance
  plus its command string.
- **Slash-command form is correct.** Skills are phrase-triggered, but the prompt-bar
  buttons deliberately seed the `/agentheim:<skill>` slash form (the launched session
  invokes the skill), consistent with `quick-capture` / `modeling`. `research` is already
  listed under the BC README's "Key commands" intents, so this is no new surface — just a
  new entry point to an existing skill.
- **Prior art:** direct extension of **aw-023** (the prompt bar + builders), **aw-024**
  (the Work launch button added to the same bar), **aw-020** (the original launch
  buttons). Bridge contract from the **vscode-dashboard-terminal-bridge** research
  (2026-06-09) and ADR-0018; armed-cue treatment from ADR-0019 (aw-021 / aw-030).
- **README follow-up.** The *Board prompt bar (Quick Capture / Modeling)* bullet in this
  BC's README should gain Research as a third button when this is worked.

## Outcome

A third **Research** launch button now sits in the board prompt bar beside Quick
Capture / Modeling. A straight extension of the aw-023 pattern — no new launch
infrastructure, only a new command string.

- `dashboard/app/modeling-command.js` — added `RESEARCH_COMMAND = "/agentheim:research"`
  and the pure `researchCommandFor(prompt)` builder, mirroring `quickCaptureCommandFor` /
  `modelingCommandFor` exactly (single space + trimmed prompt when present, else bare;
  missing / non-string / whitespace degrades to bare — never `[object Object]`, never a
  doubled space, never a throw).
- `dashboard/app/board.js` `BoardPromptBar` — a third `LaunchButton` (icon `search`)
  computing its command via `researchCommandFor(prompt)` at click time, threading
  `skipPermissions` (so it wears the aw-030/ADR-0019 armed dot) and sharing the existing
  `onResult` (clear textarea + confetti). `launchOrCopy` / `LaunchButton` reused unchanged
  — only the command string is new; no `/api/tree` / SSE / lifecycle-write touch (ADR-0001/0017).
- Tests: `dashboard/test/modeling-command.test.mjs` (+8 `researchCommandFor` / `RESEARCH_COMMAND`
  cases) and `dashboard/test/board-prompt-bar.test.mjs` (+4 render/seed/thread/import guards).
  Suite: 331 green (was 319).
- `dashboard/dist/` rebuilt via `node build.mjs` — the served bundle carries `/agentheim:research`
  and the Research button.
- BC README — the *Board prompt bar* bullet now lists Research as a third authoring button.

No ADR (no new decision). No new backlog items.
