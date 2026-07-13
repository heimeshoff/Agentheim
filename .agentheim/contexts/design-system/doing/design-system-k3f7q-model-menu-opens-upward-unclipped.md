---
id: design-system-k3f7q
title: ModelSplitButton's model menu opens upward and escapes the prompt console's clip
status: doing
type: bug
context: design-system
created: 2026-07-13
completed:
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

- [ ] `ModelSplitButton`'s open menu renders **above** the button: its panel anchors
      on `bottom`, not `top`. Asserted via the jsdom DOM harness
      (`dashboard/test/dom-harness.mjs`, `infrastructure-d2n8s`) — mount the real
      component, open the menu, read the panel's actual style. Not a source regex.
- [ ] No ancestor of the open menu clips it: the prompt console `<section>` no longer
      carries `overflow: hidden`. Asserted by mounting `BoardPromptBar` and walking
      the open menu's ancestor chain for a clipping `overflow`.
- [ ] The mode-tab row's end cells are **still** clipped to the shell's rounded
      corners — the clip moved, it did not disappear. (Regression guard: this is the
      one thing the section's `overflow: hidden` was actually for.)
- [ ] Every option in the list is fully readable with the console docked at the
      bottom of the viewport — the whole panel, not a partial one.
- [ ] The existing `ModelSplitButton` keyboard model is untouched and still green:
      roving tabindex, ArrowUp/ArrowDown clamped (no wraparound), Enter selects,
      Escape closes and returns focus to the caret. **ArrowUp/ArrowDown keep their
      current meaning** — the menu moving above the button does not invert them.
      (`styleguide/test/model-split-button.test.mjs`,
      `dashboard/test/model-split-button-dom.test.mjs`.)
- [ ] `locked` still renders no caret and no menu at all (Quick Capture's pinned model).
- [ ] Each fix is **mutation-proven**: revert the anchor to `top:` → the placement test
      goes red; restore `overflow: hidden` on the section → the clip test goes red.
      Two tests that cannot fail are the exact trap this BC has been bitten by.
- [ ] `dashboard/dist/` rebuilt (`node build.mjs`) — this change has a live consumer
      and must reach the served board.

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
