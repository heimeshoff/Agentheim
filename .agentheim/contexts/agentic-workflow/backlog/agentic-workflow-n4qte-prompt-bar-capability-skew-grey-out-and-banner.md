---
id: agentic-workflow-n4qte
title: Prompt bar greys out the model selector — and warns loudly — when the live bridge is too old to honour it
status: backlog
type: bug
context: agentic-workflow
created: 2026-07-13
completed:
depends_on: [infrastructure-v8r3q]
blocks: []
tags: [bridge, prompt-bar, model-selector, silent-failure, ux]
related_adrs: [0018, 0050]
related_research: []
prior_art: [agentic-workflow-m2vkp, infrastructure-h5wnq, infrastructure-c6fzb]
---

## Why

`infrastructure-v8r3q` ships a trustworthy `{ present, capabilities }` signal
(`probeBridge`) and a wire-level guarantee that `launchOrCopy` never sends `model`/`name` to a
bridge that can't honour them. But the prompt bar itself still only asks "is a bridge there at
all?" (`bridgePresent`, `agentic-workflow-m2vkp`) — it has no notion of "is a bridge there
*that supports what I'm about to send it*?" A builder on a stale-but-present bridge (0.4.0 on
disk, 0.2.0 running in the live extension host — the exact scenario that motivated
`infrastructure-v8r3q`) sees a fully live, unlocked model selector, picks Sonnet, and — thanks
to `infrastructure-v8r3q`'s wire guarantee — the field is now silently dropped *before it ever
reaches the bridge* rather than dropped by the bridge. That is strictly safer than before (no
model runs that wasn't chosen), but it is **still silent**: the selector looks live, claims to
launch on Sonnet, and the session runs on whatever the bridge defaults to, with nothing telling
the builder why.

`infrastructure-h5wnq` already established the precedent for exactly this shape of honesty:
the model selector greys out (`locked`) when **no** bridge is reachable, because a
clipboard-copied command can't carry `--model`. This task extends that same honesty from
*bridge absent* to *bridge present but too old* — the builder's own ruling
(`infrastructure-v8r3q`'s Notes) — and adds a **one-time dismissible banner**, because a
builder who never opens the model selector would otherwise never learn his extension is stale
at all: the skew affects launching generally (every launch silently names every session
"Claude" too — see below), not just the one control a grey-out can cover.

**There is no session-name control to grey out.** The original backlog task's acceptance
criteria asked for "the session-name field" to become unavailable the same way the model
selector does. There is no such control in the UI: the prompt bar always derives a launch name
from the highlighted mode via `nameForPromptMode(index, prompt)`
(`dashboard/app/prompt-mode.js`) — there is nothing to disable. A stale bridge silently naming
every dashboard-launched tab "Claude" (ignoring the `-n <name>` pair entirely) is precisely
the scenario the banner exists to announce; this task does not invent a name control that
doesn't belong.

## What

1. **Extend the model-lock condition from presence to capability.** `board.js`'s
   `BoardPromptBar` currently derives `bridgePresent` from `probeBridge` and computes
   `modelLocked = !bridgePresent || isModelLockedForMode(highlightedMode)`. Change the mount
   probe to consume `probeBridge`'s new `{ present, capabilities }` shape and derive
   `bridgeSupportsModel = present && capabilities.includes('model')`; `modelLocked` becomes
   `!bridgeSupportsModel || isModelLockedForMode(highlightedMode)`. The split button renders
   `locked` in both the absent case and the present-but-too-old case — same visual/keyboard
   treatment `infrastructure-h5wnq` already built (no caret, no menu, Ctrl+M a no-op), because
   from the selector's point of view "can't reach a bridge that supports this" and "no bridge
   at all" are the same fact.

2. **Name the real remedy in the tooltip.** `splitButtonTitle`'s `modelHint` currently has two
   branches (`!bridgePresent` → "No bridge reachable…"; Quick-Capture-locked → "…always runs on
   Haiku"). Add a third, distinct from both: bridge present but `capabilities` lacks `'model'`
   → something naming the actual fix, e.g. *"Your VS Code bridge is running an older version —
   reload your VS Code window to pick up model selection."* Do not reuse the "no bridge
   reachable" wording; the remedies differ (there is nothing to reload for a genuinely absent
   bridge — install/open the extension instead).

3. **A one-time, dismissible banner on skew detection.** When the mount-time probe detects
   `present === true && !capabilities.includes('model')` (the stale-bridge case, distinct from
   plain absence — absence stays silent per ADR-0018's absence-detection contract, which this
   task does not touch), render a dismissible banner in the prompt bar's docked console:
   *"Your VS Code bridge is running an older version. Model and session-name selection are
   unavailable until you reload the window."* Dismiss is session-local UI state (no
   persistence, ADR-0017) — it should not re-appear on every re-render while mounted, but a
   fresh page load re-probes and can show it again if the skew is still there.
   - **Not absence.** No bridge at all stays exactly as silent as `infrastructure-h5wnq` left
     it (absence is a normal mode, ADR-0018) — the banner fires only for the *present-but-old*
     case.
   - **Build it board-local, not a new styleguide primitive.** Checked the styleguide source
     (`.agentheim/contexts/design-system/styleguide/app/`) — there is no existing
     Banner/Alert/Callout/Toast component to reuse, and this is a **first-time** consumer.
     `design-system-015`'s own precedent (Menu/Popover) explicitly defers promotion to a
     shared primitive until a *second* consumer appears ("a single board-local control can
     stand un-promoted indefinitely"); do the same here — build the banner directly in
     `board.js`, token-styled (the `--obligation` / `--obligation-soft` advisory-tint family
     `button.js`'s `destructive` variant already uses is the closest existing semantic match
     for "something needs your attention," per ADR-0016), not a hand-rolled color. Promote it
     to the styleguide only if/when a second banner-shaped consumer shows up.

4. **Regression coverage via the DOM harness, not a source-regex suite.** The AC below ("the
   UI must not report a successful model/name launch against a legacy bridge") is a *live
   render + event* behavior — exactly what `dashboard/test/dom-harness.mjs` +
   `resolve-hook.mjs` (ADR-0056) exist for, and exactly what a regex-over-source assertion
   structurally cannot see (it can pin that a string like `"reload your VS Code window"`
   appears in `board.js`, but not that the split button actually renders `locked`, that a
   click on it doesn't open the menu, or that a mocked legacy `/health` actually produces the
   banner in the DOM). Add DOM tests (new file, e.g.
   `dashboard/test/board-prompt-bar-capability-dom.test.mjs`, following
   `board-prompt-bar-dom.test.mjs`'s and `model-split-button-dom.test.mjs`'s pattern) that
   mount `BoardPromptBar` with a mocked `fetch` returning a legacy-shaped `/health` (`present`
   but no `capabilities`) and assert: the split button renders locked (no caret, `aria-haspopup`
   absent or `locked`'s equivalent DOM signature), the tooltip carries the reload message, and
   the banner is present in the DOM with the correct copy. Existing regex-suited assertions
   (layout/token/structure guards, the tooltip string itself) can stay in the existing
   `board-prompt-bar.test.mjs`/regex files — this task is not a big-bang migration, per the BC
   README's own "what it still cannot see" note.

## Acceptance criteria

- [ ] `modelLocked` is true whenever the mount-time `probeBridge` result is absent **or**
      present-but-missing `'model'` from `capabilities`, in addition to the existing
      Quick-Capture pin — i.e. `bridgeSupportsModel = present && capabilities.includes('model')`,
      `modelLocked = !bridgeSupportsModel || isModelLockedForMode(highlightedMode)`.
- [ ] The split button's `locked` rendering (no caret, no menu, Ctrl+M no-op) is visually and
      behaviorally identical for "bridge absent" and "bridge present but too old" — verified by
      a DOM test that mounts each case and asserts the same locked DOM shape.
- [ ] `modelHint`/`splitButtonTitle` names the real remedy for the too-old case ("reload your
      VS Code window…"), textually distinct from the "no bridge reachable" wording.
- [ ] A dismissible banner renders when (and only when) `present === true` and `'model'` is
      missing from `capabilities`; it does not render for plain absence, and it does not
      persist across a fresh mount's re-probe (session-local dismiss only).
- [ ] The banner's copy names both affected features and the remedy: "Model and session-name
      selection are unavailable until you reload the window."
- [ ] The Notes/rationale above (no session-name control exists to grey out) is reflected by
      NOT inventing one — confirmed by review that no new disabled/greyed name affordance was
      added anywhere in this diff.
- [ ] DOM-harness regression test(s) (`dashboard/test/*-dom.test.mjs`, ADR-0056 pattern):
      mounting `BoardPromptBar` against a mocked legacy-shaped `/health` and firing a launch
      does **not** produce a "launched on \<model\>" success signal for a non-default model —
      the resolved/displayed model reads the locked/default state, matching what
      `infrastructure-v8r3q`'s wire-level omission guarantees actually sends.
- [ ] `dashboard/dist/` is rebuilt from source (`node build.mjs`) since `board.js` changes.
- [ ] Full dashboard + design-system-styleguide test suites stay green (noting the two
      pre-existing, environmental `bridge.test.mjs` `EADDRINUSE` failures are out of this BC's
      scope entirely — this task never touches `vscode-extension/`).

## Notes

- **Depends on `infrastructure-v8r3q`**, not merely "related to" it — this task needs
  `probeBridge`'s `{ present, capabilities }` contract and `LEGACY_CAPABILITIES` to exist
  before it can consume them. Do not start before that task's `probeBridge` change lands.
- Read `dashboard/app/board.js` around the `BoardPromptBar` component (the `bridgePresent`
  state, `modelLocked` derivation, and `splitButtonTitle`/`modelHint` construction, roughly
  L1053-1293 as of 2026-07-13) before touching it — this task is a narrow extension of
  existing, well-commented logic, not a rewrite.
- `design-system-r9dtm`'s `ModelSplitButton` already has both `locked` and `disabled` props
  with distinct semantics (`locked` = caret/menu genuinely absent; `disabled` = both regions
  dimmed but present) — this task reuses `locked` exactly as `infrastructure-h5wnq` already
  does for the absent-bridge case; it does not need a third visual state.
- The banner is new UI surface with no existing precedent in this codebase to copy verbatim —
  if the worker's placement/interaction choices (exact position in the docked console,
  dismiss-icon vs text link, re-probe-on-focus vs mount-only) raise a genuine design-system
  question beyond "which token family," consult the architect or tactical-modeler directly
  (single-specialist question) rather than guessing silently.
- `agentic-workflow-m2vkp`'s README entry (`.agentheim/contexts/agentic-workflow/README.md`,
  the "model axis" bullet, ~L406-437) is the ubiquitous-language home for this control; update
  it to mention the capability-aware lock and the banner rather than leaving it describing only
  the absent-bridge case.
