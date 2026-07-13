---
id: design-system-me97j
title: ModelSplitButton's `disabled` deadens the model caret along with Enter — an empty prompt shouldn't block picking a model
status: done
type: bug
context: design-system
created: 2026-07-13
completed: 2026-07-13
depends_on: [design-system-001]
blocks: []
tags: [model-split-button, prompt-console, disabled, affordance]
related_adrs: []
related_research: []
prior_art: [design-system-r9dtm, design-system-tfhn6, design-system-k3f7q]
---

## Why

With an empty prompt the dashboard's prompt console correctly greys out the Enter
button — there is nothing to launch. But it greys out the **model caret beside it**
too, so the builder cannot open the model menu until they have typed something. That
is backwards: choosing which model a future launch will use is exactly the kind of
thing you do *before* writing the prompt, and nothing about a blank prompt makes the
choice invalid.

The cause is that `ModelSplitButton` has only ever had **one** interactivity gate for
**two** regions. `design-system-r9dtm` widened `EnterButton` into the split button and
carried `EnterButton`'s `disabled` prop (`design-system-tfhn6`) across the whole new
widget wholesale — `.agentheim/contexts/design-system/styleguide/app/button.js`:

- `canOpenMenu = !locked && !disabled` (~L229) — `disabled` suppresses the caret click,
- the caret `<button>` gets the real `disabled` attribute (~L330), taking it out of the
  tab order as well,
- and `opacity: disabled ? 0.55 : 1` sits on the flex wrapper that *encloses both*
  regions (~L299), so the caret is painted dead too.

The consumer supplies the truth that exposes it: `dashboard/app/board.js` (~L1373)
passes `disabled=${!canFire}`, and `canFire` is derived purely from prompt-blankness
(`canFirePromptMode(highlightedMode, prompt)`, ~L1276). There is no in-flight or
launching state folded into it. So the *only* thing `disabled` ever means here is
**"there is nothing to launch"** — a statement about the primary region that has no
bearing whatever on the caret.

## What

Narrow `disabled` to govern the **primary (launch) region only**. The caret region's
sole gate becomes `locked` — which already removes the caret *entirely* (Quick
Capture's pinned model), so a locked split button is unaffected by this change.

Concretely, in `styleguide/app/button.js`'s `ModelSplitButton`:

- `canOpenMenu = !locked` — drop the `&& !disabled`.
- Remove the `disabled` attribute from the caret `<button>`; it keeps its pointer
  cursor and stays in the tab order (a blank prompt must not make the model menu
  keyboard-unreachable either).
- Move `opacity: 0.55` **off the wrapper and onto the primary `<button>` alone**, so
  the Enter half reads dead and the caret half reads live. The builder chose this at
  capture over keeping the whole surface dimmed: a control that is painted disabled but
  still responds to clicks is a lying affordance. The hairline divider and the shared
  ochre surface stay as they are — this is an opacity change on one child, not a new
  colour or a second button.
- The primary `<button>`'s own `disabled` attribute, its `default` cursor, and the
  `onClick` guard are all unchanged. `EnterButton` (the icon-only sibling) is
  untouched — its single region *is* the primary, so `tfhn6`'s semantics still hold
  there verbatim.
- Update the `disabled` prop's docblock, which currently promises "both regions
  non-interactive at 0.55 opacity" — that sentence is the bug, written down.

`dashboard/app/board.js` needs **no change**: it keeps passing `disabled=${!canFire}`,
and that now means what it always should have meant. The styleguide canvas's disabled
`ModelSplitButton` specimen (`styleguide/app/app.js`) should show the new two-tone
state, since a specimen that still paints the caret dead would contradict the
component.

## Acceptance criteria

- [ ] With `disabled` true and `locked` false, the caret is clickable and the menu
      opens — asserted in the DOM harness, not by reading source
      (`dashboard/test/model-split-button-dom.test.mjs` /
      `.agentheim/contexts/design-system/styleguide/test/model-split-button.test.mjs`).
- [ ] With `disabled` true, the caret `<button>` carries no `disabled` attribute and is
      keyboard-reachable; opening it via Enter/Space and selecting a model with the
      arrow keys still fires `onSelect`.
- [ ] With `disabled` true, the **primary** `<button>` is still genuinely disabled:
      `disabled` attribute present, `onClick` never fires.
- [ ] With `disabled` true, the 0.55 opacity is on the primary region only — the caret
      region renders at full opacity.
- [ ] `locked` still removes the caret region entirely, regardless of `disabled`
      (existing behaviour must not regress).
- [ ] In the dashboard prompt console with an empty prompt: Enter is greyed and inert,
      the model menu opens and a selection sticks.
- [ ] The `disabled` docblock in `button.js` no longer claims both regions go
      non-interactive.
- [ ] Full test suite green (`node --test lib/test/*.test.mjs`, plus the dashboard and
      styleguide suites).

## Notes

- **Do not run `node build.mjs`.** Per ADR-0057 the conductor regenerates
  `dashboard/dist/` from merged source at integration; workers leave `dashboard/dist/`
  out of their file list entirely. `board.js` imports `button.js` directly from the
  styleguide, so the bundled dashboard picks this up on that rebuild — the worker does
  not need to (and must not) do it.
- Two bridge tests in `dashboard/test/bridge.test.mjs` fail with `EADDRINUSE` on
  :31425 whenever the builder's real bridge is live in VS Code, and
  `foreign-launch.test.mjs` can flake `EPERM` in teardown on this Windows box. Both are
  pre-existing and unrelated to this change — do not chase them.
- Prior art: `design-system-r9dtm` introduced `ModelSplitButton` and is where the
  single-gate `disabled` came from; `design-system-tfhn6` is the `EnterButton` disabled
  state it inherited (correctly, for a one-region button); `design-system-k3f7q` was the
  previous fix to this same widget (menu placement + the console clip) and established
  that a `ModelSplitButton` bug is provable through the DOM harness rather than by
  regex over source.

## Outcome

`ModelSplitButton` (`styleguide/app/button.js`) now narrows `disabled` to the
primary (launch) region only:

- `canOpenMenu = !locked` (dropped `&& !disabled`) — the caret opens the menu
  regardless of `disabled`.
- The caret `<button>` no longer receives the `disabled` attribute, stays in
  the tab order, and its cursor is a plain `"pointer"`.
- `opacity: disabled ? 0.55 : 1` moved off the shared wrapper `<div>` and onto
  the primary `<button>` alone; the caret renders at full opacity.
- The `disabled` prop's docblock now states it governs the primary region
  only (was: "both regions non-interactive at 0.55 opacity").
- The canvas's "Disabled" `ModelSplitButtonRow` specimen already passed
  `options`/`value`, so it now shows the two-tone state with no source change
  needed.
- `dashboard/app/board.js` required no change — `disabled=${!canFire}` now
  means what it always should have.

Tests (all through the DOM harness / structural source guards, per
`design-system-k3f7q`'s established precedent — never regex-inferring
interactivity):
- `dashboard/test/model-split-button-dom.test.mjs` — 5 new tests: caret
  clickable + menu opens while `disabled`; caret carries no `disabled`
  attribute and Enter/ArrowDown selection still works; primary stays
  genuinely disabled (attribute present, `onClick` never fires); opacity 0.55
  on the primary only, caret at full opacity; `locked` still removes the
  caret regardless of `disabled` (regression guard).
- `dashboard/test/board-prompt-bar-dom.test.mjs` — 1 new test mounting the
  real `BoardPromptBar` with a blank prompt: Enter disabled, caret opens the
  menu, selecting Sonnet sticks and Enter stays disabled.
- `.agentheim/contexts/design-system/styleguide/test/model-split-button.test.mjs`
  — updated the stale `disabled` structural guard (previously asserted the
  bug: both regions dim/disable) to assert the primary-only wiring, plus a
  new test pinning the corrected docblock wording.

Full suite green: `node --test lib/test/*.test.mjs` (229 pass),
`.agentheim/contexts/design-system/styleguide/test/*.test.mjs` (201 pass),
`dashboard` (`npm test`, 892 pass, 0 fail — no EADDRINUSE/EPERM hit this run).

BC README updated: `.agentheim/contexts/design-system/README.md`'s
`ModelSplitButton` section's `disabled` bullet now documents the primary-only
gating and the "lying affordance" rationale for rejecting a whole-surface dim.
A gate re-review blockquote (beside the `k3f7q` note, README:1005-1010) names
`design-system-me97j` and points the builder at section 12's "Disabled"
specimen, which now paints two-tone — matching the unbroken gate-note
convention for every visible styleguide change since `design-system-005`.

No ADR written — the design decision (dim only the Enter half, not the whole
surface) was already settled and recorded at capture in this task's own "Why"/
"What" sections; the README update carries it forward into ubiquitous
documentation.

## Verifier note (iteration 1)

**VERDICT: FAIL** — one narrow gap. The implementation itself is correct and complete;
do not change code, tests, or `styleguide/app/app.js`.

**REASONS:**

- **Check 5 (BC README sync) — incomplete.** The change is a *visible* styleguide change:
  the canvas's "Disabled" `ModelSplitButton` specimen
  (`.agentheim/contexts/design-system/styleguide/app/app.js:710-718`) now paints two-tone
  (primary at 0.55, caret at full opacity) where it previously dimmed the whole ochre group.
  The README's unbroken convention for every visible styleguide change since
  `design-system-005` is a `> **Gate re-review reopened by …**` blockquote naming the task and
  the canvas section to re-review — including `design-system-k3f7q` (README:1005-1008), the
  immediately-prior bug fix to this same widget, whose only visible delta was likewise a
  section-12 specimen's appearance. The README diff adds only the `disabled` bullet
  (README:935-946) and no gate note, so the design-system gate now reads as standing open
  against a canvas that has changed and the builder is never prompted to re-review it.

- **Everything else audited clean.** All 8 acceptance criteria are covered by real DOM-harness
  behavior (not source regex) — `dashboard/test/model-split-button-dom.test.mjs` (caret
  clickable + menu opens while disabled; caret carries no `disabled` attribute and
  Enter/ArrowDown still fires `onSelect`; primary genuinely disabled with `onClick` never
  firing; 0.55 opacity on the primary only; `locked` + `disabled` still removes the caret),
  `dashboard/test/board-prompt-bar-dom.test.mjs` (blank prompt: Enter inert, menu opens,
  Sonnet selection sticks), and the styleguide structural guards for the wrapper-opacity move
  + the corrected docblock. All three suites green from the worktree: lib 229 pass, styleguide
  201 pass, dashboard 892 pass, 0 fail. Scope, ubiquitous language, ADR honoring
  (`related_adrs` empty), and no protocol/index/git tampering all check out.

- **The `styleguide/app/app.js` question resolves as GENUINELY FINE, not a gap — do NOT "fix"
  it.** The "Disabled" specimen already passes `options`/`value` and renders the live
  `ModelSplitButton`, so it picks the two-tone state up with zero source change; the absent
  `onSelect` cannot throw because `selectAt` guards it
  (`if (opt !== undefined) onSelect && onSelect(opt);`, `button.js:269`). The canvas does not
  contradict the component.

**SUGGESTED_FIX:** Add the missing gate re-review blockquote to
`.agentheim/contexts/design-system/README.md`'s ModelSplitButton section (beside the k3f7q
note at README:1005), naming `design-system-me97j` and pointing the builder at section 12's
"Disabled" specimen — the caret is no longer painted dead alongside Enter. No code, test, or
`app.js` change is needed; the implementation is correct as it stands.

**ITERATION_HINT:** likely-fixable
