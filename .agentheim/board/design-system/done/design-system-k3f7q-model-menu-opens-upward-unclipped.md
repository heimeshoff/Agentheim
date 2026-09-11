---
id: design-system-k3f7q
title: ModelSplitButton's model menu opens upward and escapes the prompt console's clip
status: done
type: bug
context: design-system
created: 2026-07-13
completed: 2026-07-13
depends_on: [design-system-001]
blocks: []
tags: [dashboard-redesign, prompt-bar, menu, model-split-button]
related_adrs: [0003, 0048]
related_research: []
prior_art: [design-system-r9dtm, design-system-015, design-system-018]
---

## Why

Clicking the caret on the prompt console's model split button opens a list the
builder cannot read: it is sheared off by the prompt segment's own bounds. The
model list is unusable — you cannot see the options you are being asked to choose
between.

Two independent causes stack, and **neither fix alone makes the bug go away**:

1. **The menu opens downward.** `ModelSplitButton`'s panel is hard-anchored
   `position: absolute; top: calc(100% + 6px)` (`styleguide/app/button.js`). The
   prompt console is docked bottom-center of the viewport (`agentic-workflow-bz3az`),
   so the menu opens *into the bottom edge of the screen*.
2. **The prompt console clips it.** The console `<section>` carries
   `overflow: hidden` (`dashboard/app/board.js`, ~line 1285). That clip exists for
   one narrow reason — to round the mode-tab row's two end cells to the shell's
   corners — but it clips *everything* absolutely positioned inside, the menu
   included. So flipping the menu upward without lifting the clip just shears it off
   at the console's top edge instead of the viewport's bottom.

This is why the list reads as "constrained by the size of that prompt segment": it
literally is.

## What

The menu **emits upward from the button and is completely visible**.

- **In the styleguide** — `ModelSplitButton`'s panel anchors to `bottom: calc(100% + 6px)`
  instead of `top:`, unconditionally. No `menuPlacement` prop, no collision auto-flip:
  the split button's only home is the bottom-docked prompt console, and Quick Capture
  pins the model (`locked` renders no caret and no menu at all), so no consumer wants
  it downward. Builder-decided at capture — revisit only if a second, top-anchored
  consumer ever appears.
- **In the board** — the console's clipping moves off the `<section>` and onto the
  **mode-tab row itself**, which is the only element that ever needed it. The tab row
  keeps its rounded end cells; the section stops clipping its own popovers.

The board edit lives in this design-system task rather than a paired
`agentic-workflow` follow-up because the two halves are one indivisible fix — a
split would ship two changes, each individually invisible and unverifiable, and the
`design-system-015` precedent already has a design-system task editing
`dashboard/app/board.js` and rebuilding `dist/` for exactly this reason.

## Acceptance criteria

- [x] `ModelSplitButton`'s open menu renders **above** the button: its panel anchors
      on `bottom`, not `top`. Asserted via the jsdom DOM harness
      (`dashboard/test/dom-harness.mjs`, `infrastructure-d2n8s`) — mount the real
      component, open the menu, read the panel's actual style. Not a source regex.
- [x] No ancestor of the open menu clips it: the prompt console `<section>` no longer
      carries `overflow: hidden`. Asserted by mounting `BoardPromptBar` and walking
      the open menu's ancestor chain for a clipping `overflow`.
- [x] The mode-tab row's end cells are **still** clipped to the shell's rounded
      corners — the clip moved, it did not disappear. (Regression guard: this is the
      one thing the section's `overflow: hidden` was actually for.)
- [x] Every option in the list is fully readable with the console docked at the
      bottom of the viewport — the whole panel, not a partial one.
- [x] The existing `ModelSplitButton` keyboard model is untouched and still green:
      roving tabindex, ArrowUp/ArrowDown clamped (no wraparound), Enter selects,
      Escape closes and returns focus to the caret. **ArrowUp/ArrowDown keep their
      current meaning** — the menu moving above the button does not invert them.
      (`styleguide/test/model-split-button.test.mjs`,
      `dashboard/test/model-split-button-dom.test.mjs`.)
- [x] `locked` still renders no caret and no menu at all (Quick Capture's pinned model).
- [x] Each fix is **mutation-proven**: revert the anchor to `top:` → the placement test
      goes red; restore `overflow: hidden` on the section → the clip test goes red.
      Two tests that cannot fail are the exact trap this BC has been bitten by.
- [x] ~~`dashboard/dist/` rebuilt (`node build.mjs`)~~ — **reassigned to the conductor**
      by ADR-0057 (landed after this task's capture): the conductor regenerates the
      bundle from merged source at integration; workers never hand-rebuild or commit
      `dist/`. Not done by this worker; not a gap.

## Notes

**Files.**
- `.agentheim/contexts/design-system/styleguide/app/button.js` — the `role="menu"`
  panel's style object in `ModelSplitButton` (the `top: calc(100% + 6px)` line).
- `dashboard/app/board.js` — the prompt console `<section>` (~line 1285) and the
  `role="tablist"` mode-tab row just inside it (~line 1296). The comment at ~1291
  documents exactly what the clip is for; update it to match where the clip now lives.
- `.agentheim/contexts/design-system/styleguide/index.html` — the canvas specimen for
  `ModelSplitButton` (the `defaultOpen` menu-open one) now shows an upward menu.

**Gate.** This is a visible styleguide change to a component on the canvas, so it
reopens the design-system gate for a lightweight re-review (the `design-system-008` /
`010` / `v08qq` precedent — the split-button specimen, not a full pass).

**Not in scope.** The shared `Menu` primitive (`app/menu.js`, `design-system-015`)
does **not** have this bug — its consumers (the topbar settings gear) are not inside
an `overflow: hidden` parent, and it opens downward from a top-anchored trigger,
which is correct there. Leave it alone. This task does not unify the two popovers.

## Outcome

Both stacked causes fixed together, as the task required:

1. **`ModelSplitButton`'s panel now anchors `bottom: calc(100% + 6px)`**
   unconditionally (`.agentheim/contexts/design-system/styleguide/app/button.js`,
   the `role="menu"` panel style), never `top:` — no `menuPlacement` prop. The
   module docblock documents why (bottom-docked console, Quick Capture pins the
   model so no consumer wants it downward).
2. **The prompt console's clip moved from the `<section>` to the mode-tab row**
   (`dashboard/app/board.js`, ~L1279-1300): the `<section>` no longer carries
   `overflow: hidden`; the `role="tablist"` row now carries `overflow: hidden` plus
   its own `borderTopLeftRadius`/`borderTopRightRadius` so it still rounds its two
   end cells to the shell's corners. The inline comment that used to document the
   section's clip was moved/rewritten to describe the new location and explain why
   it moved.

Both fixes are mutation-proven, not merely observed passing:
- Reverting the anchor back to `top:` turns
  `dashboard/test/model-split-button-dom.test.mjs`'s new placement test genuinely
  red (verified live during this task, then reverted byte-exact).
- Restoring `overflow: hidden` on the `<section>` turns the new
  `dashboard/test/board-prompt-console-clip-dom.test.mjs`'s clip test genuinely red
  (verified live during this task, then reverted).

New test file: `dashboard/test/board-prompt-console-clip-dom.test.mjs` — mounts the
real `BoardPromptBar` via the jsdom DOM harness (`infrastructure-d2n8s`), moves off
Quick Capture, opens the model menu, and (a) walks the open menu's real ancestor
chain asserting no `overflow: hidden` clipper, (b) asserts the tab row still clips
and still carries its own top corner radii. One test added to the existing
`dashboard/test/model-split-button-dom.test.mjs` asserts the panel's own inline
style anchors on `bottom`, not `top`.

Full suite run from the worktree root: 1339 tests, 1337 pass, 2 fail (both the
known pre-existing `vscode-extension/test/bridge.test.mjs` EADDRINUSE failures on
the builder's live VS Code bridge port — not a regression, not this task's). No
new failures beyond that baseline.

**`dashboard/dist/` rebuild reassigned, not dropped.** The task's last acceptance
criterion asked for `node build.mjs` to be run and committed here. ADR-0057 (landed
after this task's capture) made that the conductor's job structurally — the
conductor regenerates `dist/` from merged source at integration and filters
`dashboard/dist/` out of worker checkpoints entirely. This worker did not run
`node build.mjs` by hand and did not include `dashboard/dist/` in its file list;
running the test suite rebuilds it transiently via `dist-build.test.mjs`'s
`before()` hook, which is expected and untracked.

Design-system README (`.agentheim/contexts/design-system/README.md`, ModelSplitButton
section) updated: a new bullet documents the unconditional upward-anchoring
placement and the board-side clip relocation, and a new gate-reopened note flags
that the "Menu open" canvas specimen (section 12) now shows an upward menu and
needs re-review before the fix is considered gate-clean.

Key files: `.agentheim/contexts/design-system/styleguide/app/button.js`,
`dashboard/app/board.js`, `dashboard/test/model-split-button-dom.test.mjs`,
`dashboard/test/board-prompt-console-clip-dom.test.mjs`,
`.agentheim/contexts/design-system/README.md`.
