---
id: ADR-0050
title: Prompt bar gains a keyboard-committed single-selection model, superseding "no selection"
scope: agentic-workflow
status: proposed
date: 2026-07-05
related_tasks: [agentic-workflow-s7gev, agentic-workflow-bz3az, agentic-workflow-p8k4d, agentic-workflow-m3vhq, agentic-workflow-aqyqd, agentic-workflow-tkq7v, agentic-workflow-spv0k, agentic-workflow-m2vkp]
related_adrs: [ADR-0048, ADR-0051, ADR-0031, ADR-0017]
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

## Amendment — 2026-07-09 (agentic-workflow-aqyqd): decline-to-launch generalizes from Plain to every mode; `requiresPrompt` is retired

The builder used the second amendment's Plain-only decline-to-launch and wanted the same
behavior for **all five** modes. This amendment **reverses one clause** of the second
amendment while leaving everything else it, and the Decision above, established
unchanged: the single `highlightedMode` index, invariants 1–4, the two orthogonal
committed-selection/hover channels, the click-selects-only / Enter-launches / Ctrl+Space
model, and the default/reset target (Quick Capture, index 0) are all **unchanged**.

The reversed clause is the second amendment's own words:

> The four legacy modes always fire, empty prompt or not — their bare commands
> (`/agentheim:modeling`, etc.) are meaningful on an empty prompt.

That was a correct reading of the shipped code. What it treated as a *feature* —
clicking Modeling with an empty box opens a bare modeling dialogue — the builder now
reads as an accident of the launcher's origins, not something worth preserving. The
prompt bar is a **prompt console**: its purpose is to send a prompt. With no prompt
there is nothing to send, in **any** mode.

1. **No mode fires on an empty/whitespace-only/missing prompt.** `canFirePromptMode(index,
   prompt)` now answers purely from the trimmed prompt — `true` exactly when it is
   non-empty, for every index alike. It keeps its two-parameter signature (call-site and
   test stability, and a cheap door back to a future per-mode exception), but `index` is
   now deliberately **unread**.
2. **`requiresPrompt` is retired as a concept**, not set to `true` on all five
   `PROMPT_MODES` entries. The flag existed for exactly one reason: to mark Plain as the
   exception among four peers that always fired. Once there is no exception, the
   per-mode axis is a fiction — "a prompt is required" is a property of **the bar**, not
   of any one mode. No `PROMPT_MODES` entry carries the key after this amendment.
3. **The bare-skill launch is now unreachable from the board, deliberately.** The four
   bare-command constants (`QUICK_CAPTURE_COMMAND`, `MODELING_COMMAND`,
   `INQUIRE_COMMAND`, `RESEARCH_COMMAND`, `modeling-command.js`) and their builders'
   empty-prompt degrade branches are **left in place** — correct, pure, unit-tested — but
   are reachable from **exactly nowhere** on the board now that every mode declines on an
   empty prompt. Bare sessions are launched from the terminal instead. This was accepted
   knowingly (2026-07-09) as the trade for a single, uniform decline rule, rather than
   reopening `agentic-workflow-p8k4d`'s click-selects-only reversal to invent a second
   bare-launch affordance.
4. **`fire(modeIndex)`'s early-return and the Enter button's `disabled` prop are
   unchanged code**, now reachable from all five modes instead of Plain alone — both
   already consulted the shared `canFirePromptMode` predicate rather than re-deriving
   the decline independently, so generalizing the predicate generalizes both call sites
   for free.

**`promptBarKeyIntent` (invariant 4) is untouched by this amendment**, exactly as it was
untouched by the second amendment: bare Enter on an empty prompt, in any mode, still
classifies as `launch`. The decline is, and remains, a `fire()`-level concern — the
classifier has no notion of "which mode" or "is the prompt empty."

**Naming, unchanged.** The pure module stays `dashboard/app/prompt-mode.js`; its exported
shape (`PROMPT_MODES`, `DEFAULT_PROMPT_MODE_INDEX`, `clampPromptModeIndex`,
`nextPromptModeIndex`, `promptBarKeyIntent`, `PROMPT_KEY_INTENT`, `canFirePromptMode`) is
unchanged — only `canFirePromptMode`'s internal reasoning and `PROMPT_MODES`'s entries
(minus the `requiresPrompt` key) change.

**Paint untouched.** ADR-0048 / ADR-0051 (the ochre highlighted-tab and Enter-button
carve-outs) and ADR-0016 govern every mode's tab and the Enter button's disabled state
exactly as before — `EnterButton`'s `disabled` prop (`design-system-tfhn6`) was already
consumed unforked and painted opacity-only; nothing about how the disabled state is
painted changes, only when it applies.

**Armed launches, unchanged.** An armed launch still threads `skipPermissions: true` for
every mode regardless of this amendment — this amendment narrows *when* a launch can
fire, not *what* an armed launch carries. Not re-litigated here.

## Amendment — 2026-07-13 (agentic-workflow-tkq7v): cycle trigger moves from Ctrl+←/→ to Tab/Shift+Tab; Escape blurs the field

The builder tried to use Ctrl+←/→ for what it means in every text field — jump the
caret a word at a time — and the prompt bar ate it to cycle mode tabs instead. Since
[[agentic-workflow-p8k4d]] made the field genuinely multi-line, word navigation inside
the prompt matters; stealing it was a real editing cost. Worse, the shipped classifier
never checked `shiftKey` on the cycle branch, so Ctrl+Shift+←/→ (word-select) was
hijacked too — there was no way to select by word in the prompt field at all. This
amendment **reverses one clause** of invariant 4 (disjoint key-intent classification)
while leaving every other clause of the Decision above and of the three prior
amendments (the single `highlightedMode` index, invariants 1–3, the two orthogonal
committed-selection/hover channels, the default/reset target, the click-selects-only /
Enter-launches / Shift+Enter-newlines / Ctrl+Space-focuses model, and every-mode
decline-to-launch) **unchanged**.

The reversed clause is the original Decision's own words (invariant 4, and carried
forward unchanged by all three prior amendments):

> **cycle** (Ctrl+← / Ctrl+→ — moves `highlightedMode`, wraps per invariant 3)

1. **The cycle trigger moves from Ctrl+←/→ to Tab / Shift+Tab.** `promptBarKeyIntent`
   classifies a bare Tab (no Ctrl, no Alt) or Shift+Tab as `cycle`; the caller reads
   `event.shiftKey` to pick direction (Tab → forward, Shift+Tab → backward) instead of
   reading `event.key` for ArrowLeft/ArrowRight. Ctrl+Tab and Alt+Tab are deliberately
   left classified `pass` — the browser's own tab-switch chords are never shadowed.
   The handler `preventDefault()`s on the `cycle` branch so Tab does not move focus out
   of the textarea while cycling — matching the previous Ctrl+←/→ branch's
   `preventDefault()` behavior exactly, just retargeted to the new trigger key.
2. **Ctrl+←/→ (with or without Shift) is freed entirely — it now classifies `pass`.**
   Native word-jump (Ctrl+←/→) and word-select (Ctrl+Shift+←/→) work in the prompt
   field again, restoring ordinary text-field behavior the builder expects everywhere
   else.
3. **Escape blurs the prompt textarea — the keyboard exit.** Because Tab is hijacked
   while the field has focus, an unmitigated Tab-hijack would be a WCAG 2.1.2 keyboard
   trap: a keyboard-only user could enter the field via Tab (or Ctrl+Space) but never
   leave it via Tab again. Escape is checked in the handler *before*
   `promptBarKeyIntent` classification runs (Escape itself still classifies `pass`
   under the classifier — this is a separate check layered outside invariant 4, not a
   fifth intent label) and blurs the textarea, handing focus navigation back to native
   Tab. Escape never mutates the typed prompt — a decline-to-clear guarantee, not just
   an omission.

**Invariant framing preserved.** Invariants 1 (exactly-one-highlighted), 2
(index-always-in-range), and 3 (total deterministic wraparound) are **untouched** by
this amendment. Invariant 4 (disjoint key-intent classification) **still holds as a
shape** — every keydown still classifies into exactly one of four mutually exclusive
labels (`newline` | `cycle` | `launch` | `pass`), so no keystroke is ever
double-handled — only the trigger keys `cycle` responds to have changed. Enter,
Shift+Enter, Ctrl+Enter, and the window-scoped Ctrl+Space focus listener are all
**untouched**.

**Naming, unchanged.** The pure module stays `dashboard/app/prompt-mode.js`; its
exported shape (`PROMPT_MODES`, `DEFAULT_PROMPT_MODE_INDEX`, `clampPromptModeIndex`,
`nextPromptModeIndex`, `promptBarKeyIntent`, `PROMPT_KEY_INTENT`, `canFirePromptMode`)
is unchanged — only `promptBarKeyIntent`'s internal branching (which keys trigger
`cycle` vs `pass`) changes, and `dashboard/app/board.js`'s `onPromptKeyDown` (the
CYCLE branch's direction read, plus the new Escape-blur check ahead of the
classifier).

**Paint untouched.** ADR-0048 / ADR-0051 (the ochre highlighted-tab and Enter-button
carve-outs) and ADR-0016 are unaffected — this amendment, like every amendment in this
chain, is interaction-only.
## Amendment — 2026-07-13 (agentic-workflow-spv0k): the transient flash reads a `firedMode` index, not `highlightedMode` — a rendering-defect fix, not a new decision

The Decision's "two orthogonal channels" clause said the transient flash "never reads or
writes `highlightedMode`." The shipped code violated its own clause: `PromptModeTab`
derived `flashed` as `highlighted && feedback !== "idle"` — i.e. it *did* read
`highlightedMode` (via the `highlighted` prop) to decide which tab paints the flash.
That derivation happened to look right only because nothing yet moved `highlightedMode`
between fire and flash. Once a non-default mode fired, `onResult`'s success-reset
(`setHighlightedMode(DEFAULT_PROMPT_MODE_INDEX)`) and the feedback update batched into
the same React re-render, so the flash always painted on Quick Capture regardless of
which mode actually launched — the reset of the committed-selection channel hijacked the
render of the transient-feedback channel.

**Fix, not a new decision:** `BoardPromptBar` now owns a second, independent piece of
state, `firedMode` (`useState(null)`), set inside `fire()`'s own success branches
(alongside `setFeedback("launched"|"copied")`) to the `idx` that actually launched —
never touched by `onResult`. `PromptModeTab` takes `flashed` as a prop
(`firedMode === index && feedback !== "idle"`) instead of deriving it from `highlighted`.
The default/reset target is **unchanged** — `highlightedMode` still resets to Quick
Capture (index 0) after every successful launch; only the flash's anchor no longer rides
along with that reset. A decline (`agentic-workflow-aqyqd`'s `canFirePromptMode` guard)
still runs before `setFiredMode` is ever reached, so a declined launch continues to leave
every tab unflashed.

This restores the Decision's own invariant rather than changing it — no new module
export, no new invariant number, no `PROMPT_MODES`/`prompt-mode.js` shape change.

## Amendment — 2026-07-13 (agentic-workflow-m2vkp): a second, orthogonal selection axis (model), a fifth `promptBarKeyIntent` label (`CYCLE_MODEL`), and the post-launch reset is retired on BOTH axes

The prompt bar's ochre launch button used to be a mute square — the session it
was about to launch could inherit any model, invisibly, with no way to change
it short of leaving the board. This amendment adds a **second, orthogonal
selection channel** — which MODEL the launched session runs on — governed by
its own pure module, `dashboard/app/prompt-model.js`, sibling to
`prompt-mode.js` on this new axis. It also **reverses** the Decision's
original default/reset rule, this time on both axes at once. Every other
clause of the Decision above and of the four prior amendments (the single
`highlightedMode` index, invariants 1–3, the two orthogonal
committed-selection/hover channels, the click-selects-only /
Enter-launches / Shift+Enter-newlines / Ctrl+Space-focuses model,
every-mode decline-to-launch, the Tab/Shift+Tab cycle trigger, Escape's
keyboard-exit, and the `firedMode`-anchored flash) is **unchanged**.

1. **A second axis, orthogonal to `highlightedMode`.** `BoardPromptBar` gains
   `selectedModel`, a single committed index into `prompt-model.js`'s
   `PROMPT_MODELS` (Fable · Opus · Sonnet · Haiku — the exact short aliases
   the bridge's `MODEL_ALLOWLIST` accepts, `infrastructure-h5wnq`), defaulting
   to Opus (`DEFAULT_PROMPT_MODEL_INDEX = 1`) on mount. It is a peer of
   `highlightedMode`, not a property of it — the mode axis says WHICH SKILL
   fires; the model axis says WHAT MODEL runs it. `prompt-model.js` mirrors
   `prompt-mode.js`'s shape (`clampPromptModelIndex`, `nextPromptModelIndex`)
   but does NOT duplicate the keydown classifier — that stays singular, in
   `prompt-mode.js`, per point 2 below.
2. **`promptBarKeyIntent` gains a FIFTH disjoint label, `CYCLE_MODEL` (Ctrl+M),
   invariant 4 now covers five labels, not four.** The new intent is
   classified in the ONE place a keydown becomes an intent — `prompt-mode.js`'s
   `promptBarKeyIntent`, NOT a second handler in `board.js` that agrees not to
   collide with the other four. This is deliberate, not incidental: a keystroke
   double-handled by two branches is exactly the class of bug this bar kept
   producing (`swallow` vs `newline`; the tkq7v Ctrl+←/→ hijack of native
   word-jump). Wiring `CYCLE_MODEL` as a fifth label, rather than a second
   `if (ctrlKey && key === 'm')` check bolted onto the existing branches, keeps
   "exactly one intent per keystroke" true **by construction**. In a browser
   `keydown`, Ctrl+M reports `key === 'm'` with `ctrlKey` — it does **not**
   masquerade as `Enter` (the ASCII-CR reading is a terminal concept; the
   dashboard runs in VS Code's Simple Browser, not a terminal) — so `launch`
   is never at risk of colliding with the new branch. Ctrl+M is wired in BOTH
   places the bar already listens for keys: the field-focused
   `onPromptKeyDown` (via the classifier) AND the window-scoped `document`
   keydown effect that already handles Ctrl+Space — so cycling the model
   works from anywhere on the board, exactly like focusing the field does.

   **Iteration-1 correction (caught by verification, fixed in iteration 2):**
   wiring Ctrl+M into BOTH places is necessary but not, on its own,
   sufficient — the first cut left the two handlers able to fire on the
   SAME keystroke. React (`createRoot`) delegates keydown to the field's own
   `onPromptKeyDown`, but the native event still bubbles on to `document`
   afterward, where the window-scoped listener ALSO fired, re-deriving its
   own `ctrlKey && key === 'm'` check independently of the classifier. With
   four models, a double-handled Ctrl+M steps by two, not one — a parity
   trap that made Fable and Sonnet unreachable from a focused field. The
   fix is a small, explicit mutual-exclusion guard,
   `shouldWindowCtrlMHandle(event, promptFieldEl)` (`prompt-model.js`): the
   window-scoped listener consults it and refuses to act whenever the
   keydown's `target` IS the prompt field, leaving that case entirely to
   `onPromptKeyDown`. This does not reopen point 2's "singular classifier"
   rule — `promptBarKeyIntent` is still the ONE place a keystroke becomes an
   *intent* (CYCLE_MODEL vs. the other four). What the guard adds is a
   *dispatch*-level rule, one layer below classification: of the two
   handlers wired to act on that intent (field-focused vs. window-scoped),
   exactly one may actually run for any given physical keystroke. The lesson
   generalizes beyond Ctrl+M: whenever a key is wired into both the field's
   classifier-driven handler and the window-scoped fallback (as opposed to
   Ctrl+Space, which the classifier deliberately classifies `pass` and which
   therefore has only ONE handler to begin with), the window-scoped side
   needs an explicit "does the field already own this?" guard, not an
   independent re-derivation of the same key check.
3. **The pin is a projection at READ time, never a mutation.**
   `isModelLockedForMode` / `modelForMode` (`prompt-model.js`) pin Quick
   Capture's resolved model to Haiku, but `selectedModel` itself is never
   overwritten to do it. Selecting Opus on Modeling, switching to Quick
   Capture (which resolves and shows Haiku), then switching back to Modeling
   restores Opus — because the stored selection was never touched. This is the
   load-bearing shape: storing the pin instead would silently eat the
   builder's choice every time they filed a quick idea. `modelForMode(modeIndex,
   selectedModelIndex)` is the ONE resolver both the split button's label and
   `fire()`'s launch payload consult — never re-derived at either call site.
4. **No bridge, no model promise.** `probeBridge` (`infrastructure-h5wnq`,
   `bridge-launch.js`) is called once on mount; its result (`bridgePresent`)
   ORs with the Quick Capture pin to produce `modelLocked`. A clipboard-copied
   command can never carry a `--model` flag, so with no bridge reachable the
   split button renders `locked`, names no model (`"Default"`), and Ctrl+M is
   a true no-op — exactly as it is on Quick Capture. The launch itself is
   unaffected either way: it still fires via the clipboard fallback.
5. **The post-launch reset is retired on BOTH axes.** The original Decision's
   "resets to `0` after every successful launch" clause — already carried
   forward unchanged by all four prior amendments — is now **reversed**:
   `onResult` no longer calls `setHighlightedMode`, and the model axis was
   never reset to begin with (there was nothing to reverse there; this
   amendment simply never introduces a reset for it). Firing three Modeling
   prompts back to back, on Sonnet, no longer means re-selecting Modeling and
   re-picking Sonnet three times. `agentic-workflow-spv0k`'s `firedMode`/flash
   fix — which existed specifically to survive the old reset without
   relocating the flash — continues to work unchanged: with no reset left to
   race against, `firedMode` and `highlightedMode` simply track two
   independent things, exactly as spv0k's fix already made them do.
   Persistence remains **in-page only** (ADR-0017's read-only dashboard is
   untouched) — no `localStorage`, no server write. A reload starts fresh at
   Quick Capture + Opus, same as mount always has.
6. **This does not touch ADR-0031.** ADR-0031 pins a model **per agent**
   (`worker` → sonnet, `verifier` → opus) inside the Agentheim workflow engine.
   `--model` (what this selector controls) sets the **main-loop / session**
   model for a dashboard-launched Claude Code session. The two **compose**,
   they do not conflict: a session launched on Haiku from this selector still
   spawns its `worker`/`verifier` subagents on whatever ADR-0031 pins them to,
   because those are a different axis entirely (which agent role runs, not
   which top-level session was started). Nothing here amends ADR-0031, and no
   future reader should read this amendment as reconciling the two — there
   was nothing to reconcile.

**Naming.** `dashboard/app/prompt-model.js` is a new pure, framework-free,
`node --test`-covered module — a sibling to `prompt-mode.js` in the
`board-sort.js`/`board-group.js`/`search-results.js` family — exporting
`PROMPT_MODELS`, `DEFAULT_PROMPT_MODEL_INDEX`, `clampPromptModelIndex`,
`nextPromptModelIndex`, `isModelLockedForMode`, `modelForMode`, and (added in
the iteration-2 correction above) `shouldWindowCtrlMHandle` — the pure
mutual-exclusion guard between the field-focused and window-scoped Ctrl+M
handlers.
`prompt-mode.js`'s exported shape gains one new `PROMPT_KEY_INTENT` member,
`CYCLE_MODEL` (`'cycle_model'`) — `PROMPT_MODES`, `DEFAULT_PROMPT_MODE_INDEX`,
`clampPromptModeIndex`, `nextPromptModeIndex`, `canFirePromptMode`, and
`nameForPromptMode` are otherwise unchanged.

**Paint.** The `↵` hint span (row 2 of the console) is deleted outright — its
"Enter launches · Shift+Enter for a new line" affordance moves into the new
`ModelSplitButton` primitive's (`design-system-r9dtm`) tooltip/`aria-label`.
`ModelSplitButton` replaces `EnterButton` as the console's one launch
affordance, consumed **unforked** (ADR-0003) — it is already licensed to wear
ochre by ADR-0048's primed-primary-action carve-out (restated by ADR-0051);
no new paint decision is made here. `locked` renders no caret region at all,
matching the same "absent, not merely disabled" treatment `EnterButton`'s
`disabled` prop used for a different state.

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
- **(Amended by agentic-workflow-aqyqd)** m3vhq's "the four legacy modes always fire"
  clause is reversed: `canFirePromptMode` now declines on an empty/whitespace-only prompt
  for **every** mode, not Plain alone. `requiresPrompt` is retired — no `PROMPT_MODES`
  entry carries it — and `canFirePromptMode`'s `index` parameter is kept but deliberately
  unread. The four legacy modes' bare-command constants and builders are left in place
  but are now unreachable from the board; bare sessions launch from the terminal.
  `promptBarKeyIntent` (invariant 4) remains untouched.
- **(Amended by agentic-workflow-tkq7v)** invariant 4's `cycle` trigger moves from
  Ctrl+←/→ to Tab/Shift+Tab (direction now read from `e.shiftKey`, not `e.key`);
  Ctrl+←/→ (with or without Shift) is freed and now classifies `pass`, restoring
  native word-jump/word-select in the multi-line field. Ctrl+Tab/Alt+Tab stay
  `pass` so browser tab-switch chords are never shadowed. Escape blurs the prompt
  textarea (checked ahead of `promptBarKeyIntent`, not a fifth intent label) as the
  WCAG 2.1.2 keyboard-trap mitigation for hijacking Tab inside the field, and never
  clears the typed prompt. Enter/Shift+Enter/Ctrl+Enter/Ctrl+Space are untouched.
- **(Amended by agentic-workflow-spv0k)** the transient flash is anchored to a new
  `firedMode` index (set in `fire()`'s own success branches, never by `onResult`),
  not to `highlightedMode` — `PromptModeTab` now takes `flashed` as a prop instead of
  deriving it from `highlighted && feedback !== "idle"`. This *restores* the Decision's
  "two orthogonal channels" clause, which the shipped code had violated: the
  success-reset of the committed-selection channel was hijacking the render of the
  transient-feedback channel, so every launch flashed on Quick Capture. The
  success-reset itself is unchanged, and a declined launch still flashes on no tab.
- **(Amended by agentic-workflow-m2vkp)** a second, orthogonal selection axis —
  `selectedModel`, governed by the new sibling module `prompt-model.js`
  (`PROMPT_MODELS`, `DEFAULT_PROMPT_MODEL_INDEX`, `clampPromptModelIndex`,
  `nextPromptModelIndex`, `isModelLockedForMode`, `modelForMode`) — sits alongside
  `highlightedMode`. Invariant 4 (`promptBarKeyIntent`) gains a fifth disjoint label,
  `CYCLE_MODEL` (Ctrl+M), classified in the ONE classifier rather than a second
  handler. `modelForMode` pins Quick Capture to Haiku as a read-time projection,
  never mutating the stored selection. `probeBridge` gates the selector: no bridge
  reachable locks it and names no model, since a clipboard-copied command can never
  carry `--model`. The Decision's original "resets to 0 after every successful
  launch" clause is **reversed on both axes** — `onResult` no longer resets
  `highlightedMode`, and the model axis was never reset — so both selections survive
  a launch; a reload (not a launch) is what returns the bar to Quick Capture + Opus.
  ADR-0031 (per-agent model routing) is untouched — the two compose, they do not
  conflict. `EnterButton` is replaced by the styleguide's `ModelSplitButton`
  (design-system-r9dtm), consumed unforked; the `↵` hint span is deleted, its
  affordance folded into the split button's tooltip/aria-label.
