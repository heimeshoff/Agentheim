---
id: ADR-0050
title: Prompt bar gains a keyboard-committed single-selection model, superseding "no selection"
scope: agentic-workflow
status: proposed
date: 2026-07-05
related_tasks: [agentic-workflow-s7gev, agentic-workflow-bz3az, agentic-workflow-p8k4d, agentic-workflow-m3vhq]
related_adrs: [ADR-0048]
---

# ADR-0050: Prompt bar gains a keyboard-committed single-selection model, superseding "no selection"

## Context

The board prompt bar's four launch cards — Quick Capture / Modeling / Inquire / Research
(`PromptLaunchCard`, `dashboard/app/board.js`) — have never had a selection model. Each
card is an independent button: click it, it launches its own seeded command. aw-065's
Outcome is explicit about this ("No selection model introduced" — Quick Capture's visual
emphasis is a static style choice, not a selected state); aw-h7n2c added the Inquire card
the same way, again with "no emphasis prop, no ochre" and no selected-state logic.

The builder's redesign of this bar into a docked two-row console
([[agentic-workflow-bz3az]]) introduces a real keyboard model: Ctrl+←/→ moves a highlight
among the four modes, Ctrl+Enter fires whichever mode is currently highlighted. That is a
genuine invariant — exactly one of four is highlighted at all times, and a key can commit
to it — where before there was none. This reverses the "no selection model" stance on
record and needs to be written down before `dashboard/app/prompt-mode.js` (the pure module
that will carry the judgment) gets built, mirroring the existing pure-module precedent
(`board-sort.js`, `search-state.js`, `board-group.js`).

This decision is **interaction-only**. It does not touch, and does not depend on, how the
highlight is painted — that is the accent carve-out's job
([[design-system-vw12e]] / ADR-0048), which already settled that a highlighted peer-mode
tab is a *passive equivalent-state selection* and must render via de-emphasis of the
non-highlighted tabs (ADR-0016's rule), not via the ochre accent.

## Decision

The prompt bar's four modes carry a single committed **`highlightedMode`** index into
`PROMPT_MODES` (`0` = Quick Capture, in the fixed order Quick Capture · Modeling · Inquire
· Research), not four independent per-card booleans. Four invariants govern it:

1. **Exactly-one-highlighted.** At every point in time, exactly one of the four modes is
   the highlighted one — never zero, never more than one. `highlightedMode` is a single
   index, not a per-card flag set, so "more than one highlighted" and "none highlighted"
   are both unrepresentable by construction rather than states the code must separately
   guard against.
2. **Index always in range.** `highlightedMode` is always a valid index into
   `PROMPT_MODES` (`0..3`). Any operation that could move it — cycling, a reset, a
   mount-time default — clamps into range; a stray out-of-range value is never produced
   or tolerated. `clampPromptModeIndex` is the pure guard other call sites use rather than
   re-deriving the bound inline.
3. **Total, deterministic wraparound.** Cycling via Ctrl+← / Ctrl+→ is defined for every
   current index and every direction: Ctrl+→ past Research (index 3) wraps to Quick
   Capture (index 0); Ctrl+← before Quick Capture (index 0) wraps to Research (index 3).
   `nextPromptModeIndex(current, direction)` is the pure, total function — it never
   throws and never returns out-of-range — mirroring design-system's `nextActiveIndex`
   wraparound precedent named in this task's Notes.
4. **Disjoint key-intent classification.** Every keydown the prompt bar's input receives
   is classified into exactly one of four mutually exclusive intents by a single function,
   `promptBarKeyIntent(event)`: **swallow** (bare Enter — no newline, no launch, per
   aw-038, untouched by this decision), **cycle** (Ctrl+← / Ctrl+→ — moves
   `highlightedMode`, wraps per invariant 3), **launch** (Ctrl+Enter — fires the
   highlighted mode's command exactly as a click on that card would), or **pass-through**
   (everything else — ordinary typing, unmodified navigation keys). Because the
   classification is one function returning one of four disjoint labels, bare Enter and
   Ctrl+Enter cannot collide or be double-handled — there is no code path where both
   "swallow" and "launch" logic run for the same keystroke.
   **(Reversed by agentic-workflow-p8k4d — see Amendment below: `swallow` is retired;
   bare Enter now classifies as `launch`, and a new `newline` intent — Shift+Enter —
   takes its place as the fourth disjoint label.)**

**Two orthogonal channels: committed selection vs. transient hover.** The highlight
(`highlightedMode`) is the **committed selection channel** — it changes only on a
deliberate act: clicking a card, or cycling with Ctrl+←/→. Hovering a card is a separate,
**transient pointer-feedback channel** that never reads or writes `highlightedMode`. The
two channels may both be visually true of the same card at once (a card can be both
highlighted and hovered) but neither implies or overwrites the other. Concretely:

- **Clicking a card** moves the committed highlight to that card *and* launches it
  (unchanged click-to-launch behavior, now additionally updating the highlight before it
  fires). **(Reversed by agentic-workflow-p8k4d — see Amendment below: a click now only
  moves the committed highlight; it no longer launches.)**
- **Ctrl+←/→** moves the committed highlight without launching anything.
- **Ctrl+Enter** launches the currently committed highlight without requiring a click.
  **(agentic-workflow-p8k4d additionally makes bare Enter an equivalent launch trigger —
  see Amendment below — Ctrl+Enter is kept only as a harmless alias.)**
- **Hover** (mouseenter/mouseleave, or an equivalent focus-visible affordance) never moves
  `highlightedMode` and never launches anything — it is presentation-only pointer
  feedback, the same kind of transient, non-persisted signal the board's existing hover
  affordances use (e.g. the dependency-ring hover, ADR-0033/ADR-0029), not a state the
  prompt-bar's selection model owns.

**Default / reset target.** `highlightedMode` defaults to `0` (Quick Capture) on mount,
and resets to `0` after every successful launch — mirroring the existing "clear textarea
+ confetti" reset path (aw-023/aw-038) rather than leaving the highlight wherever the
builder last left it.

**Supersession.** This ADR **supersedes** `PromptLaunchCard`'s recorded "no selection
model" stance (aw-065's Outcome: "No selection model introduced"; aw-h7n2c's Outcome: "no
selected-state logic is introduced"). Those statements were correct when written — the
four cards were independent buttons with no shared state — and remain historically
accurate as a record of what shipped at the time. Going forward, the prompt bar **does**
carry a selection model, defined above, and any future work on `PromptLaunchCard` /
`BoardPromptBar` should treat this ADR, not the superseded comments, as the standing
statement of the interaction model.

**Naming.** The pure module carrying this judgment is `dashboard/app/prompt-mode.js`,
exporting `PROMPT_MODES`, `nextPromptModeIndex`, `clampPromptModeIndex`, and
`promptBarKeyIntent` — a fifth pure, framework-free, `node --test`-covered module in the
family of `board-sort.js` / `board-group.js` / `search-results.js`. This ADR names the
module and its exported shape; **it does not implement it** — building it, and wiring it
into `BoardPromptBar`, is the job of the downstream task
([[agentic-workflow-bz3az]]).

## Out of scope

**Color / accent treatment of the highlight is explicitly OUT of scope for this
decision.** This ADR is interaction-only: it settles *that* one mode is always highlighted
and *how* keyboard/click/hover interact with that highlight, never *how the highlight is
painted*. The paint question — whether/how ochre may render the highlighted tab — is
already settled by the accent carve-out ADR-0048 ([[design-system-vw12e]]), which
classifies a highlighted peer-mode tab as passive equivalent-state selection (ADR-0016's
de-emphasis rule applies; ochre is forbidden there). This ADR does not restate, depend on,
or reopen that classification.

## Amendment — 2026-07-06 (agentic-workflow-p8k4d): Enter launches, Shift+Enter newlines, Ctrl+Space focuses, tab-click selects only

The builder found the console's interaction model surprising in four ways once they
tried to use it like an ordinary chat console. This amendment **reverses four clauses**
of the Decision above — three from this ADR, one inherited from aw-038 — while leaving
every other clause (the single `highlightedMode` index, invariants 1–3, the two
orthogonal committed-selection/hover channels, the default/reset target, the
supersession of `PromptLaunchCard`'s "no selection model" stance) unchanged. **This is
stated explicitly so the aw-038 record — "Enter is SWALLOWED... Shift+Enter is no
special case" — is not left silently contradicting the shipped behavior**: aw-038's
swallow rule and its single-logical-line collapse are both **intentionally reversed**
by this amendment, the same way this ADR itself already reversed aw-065/aw-h7n2c's "no
selection model" stance.

The four reversed points:

1. **Bare Enter now launches** (invariant 4's `swallow` → `launch`). Pressing Enter with
   no modifiers fires the highlighted mode's command — identical to clicking the Enter
   button. `swallow` is retired as a label entirely; `promptBarKeyIntent` no longer
   returns it. Ctrl+Enter stays classified `launch` too (a harmless alias, kept rather
   than freed, per the builder's deprioritization) — bare Enter and Ctrl+Enter are now
   deliberately equivalent, not deliberately distinct as invariant 4 originally read.
2. **A new `newline` intent — Shift+Enter.** `promptBarKeyIntent` gains a fourth label,
   `newline`, returned for Shift+Enter regardless of Ctrl. The handler does **not**
   `preventDefault` on this branch, so the `<textarea>` inserts its line break natively.
   This **retires aw-038's single-logical-line collapse**: `sanitizePromptLine` (the
   function that ran every newline in the stored value down to a single space) is
   deleted outright, and the field's `onChange` now stores the textarea's raw value.
   The field is genuinely multi-line going forward; aw-038's auto-grow band
   (`autoGrowField`/`PROMPT_FIELD_MAX_PX`) is unchanged — only what it grows to fit has
   changed. Multi-line prompts are safe end-to-end without further change: the bridge
   carries the seeded command as a single raw argv element with no shell wrap
   (ADR-0018, amended by infrastructure-020), the clipboard fallback copies verbatim,
   and `safePrompt` (`modeling-command.js`) trims only the leading/trailing ends —
   interior newlines pass through untouched at every layer.
3. **Tab click only selects, never launches.** The "Clicking a card... *and* launches
   it" clause above is reversed: `onTabClick` now only moves `highlightedMode`; the
   `fire(index)` call is removed from the click handler. The launch is reachable only
   via Enter, Ctrl+Enter, or the Enter button — never on contact with a tab. This
   restores a cleaner reading of "two orthogonal channels": click becomes purely a
   *selection* act (like Ctrl+←/→), and launch becomes purely a *commit* act (Enter /
   Ctrl+Enter / the Enter button) — selecting a mode and committing to it are no longer
   conflated into a single click.
4. **Ctrl+Space focuses the prompt field, window-scoped.** New, additive — no prior
   clause to reverse. A `document`-level `keydown` listener (registered and torn down
   in a `useEffect`) moves keyboard focus into the prompt `<textarea>` from anywhere on
   the board, `preventDefault`-ing the browser default. Because the prompt textarea is
   the only editable field on the board, "never steal an in-progress edit elsewhere"
   reduces to "just focus it" — there is no other editable surface an edit could be in
   progress in.

**Invariant framing preserved.** Invariants 1 (exactly-one-highlighted), 2
(index-always-in-range), and 3 (total deterministic wraparound) are **untouched** by
this amendment. Invariant 4 (disjoint key-intent classification) **still holds as a
shape** — every keydown still classifies into exactly one of four mutually exclusive
labels, so no keystroke is ever double-handled — but the four labels themselves change:
`swallow` is replaced by `newline`, and what used to select `swallow` (bare Enter) now
selects `launch`. `cycle` and `pass` are unchanged.

**Naming, unchanged.** The pure module stays `dashboard/app/prompt-mode.js`, still
exporting `PROMPT_MODES`, `nextPromptModeIndex`, `clampPromptModeIndex`, and
`promptBarKeyIntent` — only the fourth intent label and the Enter/Shift-Enter branching
inside `promptBarKeyIntent` change; the module's shape and its `node --test` coverage
family membership are unaffected.

**Paint untouched.** ADR-0048 / ADR-0051 (the ochre highlighted-tab and Enter-button
carve-outs) and ADR-0016 are unaffected — this amendment, like the ADR it amends, is
interaction-only.

## Amendment — 2026-07-09 (agentic-workflow-m3vhq): a fifth mode, Plain, and a mode may now decline to launch

A fifth mode, **Plain**, is appended LAST to `PROMPT_MODES` — the typed prompt goes to
Claude verbatim, with no skill, no slash command, no routing (`plainCommandFor`,
`modeling-command.js`). This amendment extends three of this ADR's mechanics from four
modes to five, and — for the first time — makes a genuinely new property of the model
explicit: **a mode may decline to launch.** Every other clause of the Decision above and
of the p8k4d amendment (the single `highlightedMode` index, invariants 1 and 4, the two
orthogonal committed-selection/hover channels, the default/reset target, the
click-selects-only / Enter-launches / Ctrl+Space model) is **unchanged**.

1. **Mode count four → five; index bound `0..3` → `0..4`.** `PROMPT_MODES.length` is now
   5. `clampPromptModeIndex` bounds `0..4`, not `0..3` — `clampPromptModeIndex(5)` (not
   `4`) is now the first out-of-range input that degrades to the default. Quick Capture
   stays index `0` — the mount default and post-launch reset target are **unchanged**;
   Plain is a peer appended at the end, never promoted to the baseline the others are
   shortcuts from.
2. **Wrap targets change accordingly (invariant 3, otherwise untouched).** Ctrl+→ past
   Plain (index 4, was Research/index 3) wraps to Quick Capture (0); Ctrl+← before Quick
   Capture (0) wraps to Plain (4, was Research/3). The wraparound is still total and
   deterministic for every index and direction — only the boundary index moved from 3 to
   4.
3. **A mode may now DECLINE to launch — the genuinely new property.** Every mode before
   Plain always fired: an empty prompt still produced a meaningful bare command
   (`/agentheim:modeling`, etc.), so `fire()` never needed to ask "can this mode launch
   right now?" — the answer was always yes. Plain's command *is* the prompt
   (`plainCommandFor`), so an empty/whitespace-only prompt has nothing to send. This
   introduces `requiresPrompt: true` on a `PROMPT_MODES` entry (false/absent on the four
   legacy modes) and a new pure predicate, `canFirePromptMode(index, prompt)`
   (`prompt-mode.js`), consulted by both `fire()`'s guard and the Enter button's
   `disabled` state — the ONE place "can this mode fire?" is answered, rather than two
   call sites re-deriving it independently. A decline is a true no-op: no bridge call, no
   clipboard write, no confetti, no textarea clear, no highlight reset, no feedback chip.
   **`promptBarKeyIntent` (invariant 4) is untouched by this** — bare Enter on an empty
   Plain prompt still classifies as `launch`; the decline happens downstream in `fire()`,
   not in the classifier, so invariant 4 stays a disjoint, keyboard-only classification
   with no notion of "which mode" or "is the prompt empty."

**Naming, unchanged.** The pure module stays `dashboard/app/prompt-mode.js`; it gains one
new export, `canFirePromptMode`, alongside the four already named
(`PROMPT_MODES`, `nextPromptModeIndex`, `clampPromptModeIndex`, `promptBarKeyIntent`).

**Paint untouched.** ADR-0048 / ADR-0051 (the ochre highlighted-tab and Enter-button
carve-outs) and ADR-0016 govern Plain's tab exactly as they govern the other four — no new
paint decision. The Enter button's `disabled` prop (`design-system-tfhn6`) is consumed
unforked, painted as opacity de-emphasis per ADR-0016 (already how `EnterButton` renders
disabled — no new CSS here).

## Consequences

- `dashboard/app/prompt-mode.js` (not yet written) has a named contract before
  implementation begins: `PROMPT_MODES`, `nextPromptModeIndex`, `clampPromptModeIndex`,
  `promptBarKeyIntent` — [[agentic-workflow-bz3az]] builds to this shape rather than
  inventing its own.
- `PromptLaunchCard` / `BoardPromptBar`'s prior "no selection model" record (aw-065,
  aw-h7n2c) is superseded going forward; those tasks' own Outcome sections are left
  untouched as historical record, per this project's rule that a `done/` task is frozen.
- The four invariants (exactly-one-highlighted, in-range index, total deterministic
  wraparound, disjoint key-intent classification) are the acceptance surface the
  downstream implementation task's tests must cover.
- Hover remains exactly what it was before this decision — transient, presentation-only,
  never mutating persisted or committed state — now made explicit as one of the two
  orthogonal channels rather than "the only signal there ever was."
- No color/token/CSS decision is made or implied here; that stays entirely within
  ADR-0048 / design-system's ownership.
- **(Amended by agentic-workflow-p8k4d)** aw-038's swallow + single-logical-line record
  is superseded going forward the same way aw-065/aw-h7n2c's "no selection model" record
  was superseded by this ADR's original Decision — aw-038's own Outcome section is left
  untouched as historical record (frozen `done/` task), but its swallow/single-line
  behavior no longer describes the shipped console.
- **(Amended by agentic-workflow-p8k4d)** `sanitizePromptLine` is deleted from
  `dashboard/app/board.js`; the prompt field is genuinely multi-line going forward.
- **(Amended by agentic-workflow-p8k4d)** click and commit are now cleanly separated:
  clicking a tab is purely selection, launching is purely Enter/Ctrl+Enter/the Enter
  button — no trigger both selects and launches in the same gesture any more.
- **(Amended by agentic-workflow-m3vhq)** `PROMPT_MODES` holds five modes, not four;
  `clampPromptModeIndex` bounds `0..4`; Ctrl+←/→ wrap against Plain (index 4) instead of
  Research (index 3). The model gains its first decline-to-launch mode (Plain,
  `requiresPrompt: true`), governed by the new `canFirePromptMode` predicate — invariant
  4 (`promptBarKeyIntent`) is untouched by this; the decline is a `fire()`-level concern.
