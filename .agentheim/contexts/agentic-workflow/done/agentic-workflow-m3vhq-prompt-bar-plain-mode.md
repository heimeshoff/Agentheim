---
id: agentic-workflow-m3vhq
title: Prompt bar — add a "Plain" mode that runs the prompt directly on Claude
status: done
type: feature
context: agentic-workflow
created: 2026-07-09
completed: 2026-07-09
depends_on: [design-system-001-styleguide, agentic-workflow-q7r3x, design-system-tfhn6]
blocks: []
tags: [dashboard, prompt-bar]
related_adrs: [0050, 0003, 0018, 0016, 0051]
related_research: []
prior_art: [agentic-workflow-h7n2c, agentic-workflow-036, agentic-workflow-bz3az, agentic-workflow-p8k4d, agentic-workflow-s7gev]
---

## Why
The prompt bar's four tabs all answer one question: *which Agentheim skill routes this
prompt?* There is no way to type into the board's only text field and simply talk to
Claude — every keystroke is conscripted into ceremony. A **Plain** mode is the escape
hatch: the builder's prompt goes to Claude verbatim, with no skill, no slash command,
no routing.

That makes Plain the first mode that names the *absence* of a skill, and the first mode
that can **decline to launch** — with an empty textarea the other four still fire a
meaningful bare command (`/agentheim:modeling`), while Plain would fire the empty string.
ADR-0050's model assumed every mode always launches; this task is where that assumption
gets paid for.

## What
A fifth entry appended to `PROMPT_MODES` (`dashboard/app/prompt-mode.js`), its command
builder in `dashboard/app/modeling-command.js`, and the consumer wiring in
`BoardPromptBar` / `PromptModeTab` (`dashboard/app/board.js`). The launch path is the
existing `launchOrCopy` bridge-or-clipboard seam (ADR-0018) — unchanged; the board stays
a read-only projection of disk (ADR-0017).

Builder decisions taken during this refinement (2026-07-09):

- **Label:** `Plain` (confirms the capture's voice-transcript reading of "Plane").
- **Position:** fifth peer, **appended last**. Quick Capture stays index 0 — still the
  mount default and the post-launch reset target. Plain is *not* promoted to the baseline
  the other four are shortcuts from.
- **Empty prompt:** **no-op.** Nothing fires — no bridge call, no clipboard, no confetti.
- **Glyph:** reuse the existing `bot` key (verified present in `icons.js`). No new glyph.

Amended in a second refinement pass (2026-07-09), after `agentic-workflow-q7r3x` shipped:

- **Disabled Enter button:** the styleguide's `EnterButton` primitive learns a `disabled`
  state — `design-system-tfhn6` — which this task then consumes unforked. The first pass
  concluded "no new glyph, so no `design-system` dependency"; that reasoning was about the
  *glyph* and never reached the *button*. At the time it was also invisible: board.js still
  had a board-local Enter button it could dim freely. q7r3x then swapped in the styleguide
  primitive (ADR-0003, unforked), whose props are exactly `{ onClick, size, ariaLabel }` —
  no disabled state, and no styleguide primitive has one. So AC 6 became unimplementable
  without a `design-system` change. Hence the dependency this task previously (wrongly)
  claimed it didn't need.

## Acceptance criteria
- [ ] `PROMPT_MODES` gains a fifth entry, **appended last**:
      `{ id: 'plain', label: 'Plain', subtitle: 'straight to Claude, no skill',
      icon: 'bot', commandFor: plainCommandFor, requiresPrompt: true }`.
      `DEFAULT_PROMPT_MODE_INDEX` stays `0` (Quick Capture) — unchanged.
- [ ] `plainCommandFor(prompt)` lands in `modeling-command.js` beside the other four
      builders and reuses the shared `safePrompt` helper: a real prompt returns the
      **trimmed prompt verbatim, with no command prefix**; an empty / whitespace-only /
      non-string prompt returns `''`. Pure, never throws. It is deliberately the one
      builder with **no bare-command constant** — there is no skill to name.
- [ ] A new pure predicate `canFirePromptMode(index, prompt)` in `prompt-mode.js` returns
      `false` exactly when the mode's `requiresPrompt` is true **and** the trimmed prompt
      is empty; `true` otherwise. The four legacy modes always fire, empty prompt or not —
      their bare commands are meaningful. Both call sites (the `fire()` guard and the Enter
      button's disabled state) consult this **one** function rather than re-deriving it.
- [ ] `fire(modeIndex)` early-returns **before** `launchOrCopy` when `canFirePromptMode` is
      false: no bridge call, no clipboard write, no confetti, no textarea clear, no
      highlight reset, no feedback chip.
- [ ] `promptBarKeyIntent` is **untouched** — bare Enter on an empty Plain still classifies
      as `launch` (ADR-0050 invariant 4 stays a disjoint, keyboard-only classification).
      The decline happens in `fire()`, not in the classifier. A test asserts this explicitly
      so a later worker doesn't "fix" the classifier into a fifth intent.
- [ ] The Enter button renders **disabled** exactly when
      `canFirePromptMode(highlightedMode, prompt)` is false, via the styleguide primitive's
      new `disabled` prop (`design-system-tfhn6`) — passed through, **consumed unforked**
      (ADR-0003), never re-implemented in board.js and never faked with a
      `pointer-events: none` wrapper. Its `title` / `aria-label` never render an empty
      command string: with Plain highlighted and the prompt blank they read
      `Type a prompt to launch Plain`, not `Launch Plain — `. (The `title` sits on the
      existing wrapper `<span>`, which is not itself disabled, so the tooltip still shows.)
- [ ] Ctrl+← / Ctrl+→ cycles a total **5-cycle**: forward past Plain (index 4) wraps to
      Quick Capture (0); backward before Quick Capture wraps to Plain (4).
      `clampPromptModeIndex` bounds `0..4`.
- [ ] Plain's tab renders as an **equal-width peer cell** in the same edge-to-edge row
      q7r3x ships (now five cells), de-emphasized by opacity when not highlighted
      (ADR-0016) and highlighted identically to the others (ADR-0051's underline). The
      `bot` glyph is consumed **unforked** from
      `.agentheim/contexts/design-system/styleguide/app/icons.js` (ADR-0003) — no new
      glyph, no local copy.
- [ ] ADR-0050 gains an `## Amendment` section — **no new ADR**, mirroring the precedent
      `agentic-workflow-p8k4d` set when it reversed the bare-Enter rule. It records: mode
      count four → five and the index bound `0..3` → `0..4`; the changed wrap targets; that
      the default/reset target is explicitly **unchanged**; and the genuinely new property
      of the model — **a mode may decline to launch**, which ADR-0050's original text
      assumed away.
- [ ] `prompt-mode.test.mjs`'s length / order / cycle / wrap assertions move to five
      (`nextPromptModeIndex(4, 1) === 0`, `nextPromptModeIndex(0, -1) === 4`), and new tests
      cover `plainCommandFor` (verbatim passthrough + empty degrade) and
      `canFirePromptMode` (all four legacy modes fire on an empty prompt; Plain does not).
      Two assertions in that suite flip meaning once `4` is a valid index and must be
      re-pinned, not merely re-run: `clampPromptModeIndex(4) === 0` becomes
      `clampPromptModeIndex(5) === 0`, and `4` must leave the `invalid` array (replaced by
      `5`). `board-prompt-bar.test.mjs`'s four-tab source assertions move to five and gain
      the disabled-Enter assertion.
- [ ] `dashboard/dist/` is **rebuilt** (`node build.mjs`) — `board.js`, `prompt-mode.js` and
      `modeling-command.js` are all bundled, so without it the served board keeps rendering
      the four-tab bundle.
- [ ] Dashboard suite green (`node --test dashboard/test/*.test.mjs`); the verifier drives
      the runtime surface clean.

## Notes
- **Why `depends_on: agentic-workflow-q7r3x`.** q7r3x is in `todo/`, hard-codes *"four
  edge-to-edge equal-width cells"* and the four mode glyphs, and rewrites the same
  `BoardPromptBar` / `PromptModeTab` pair. Sequencing behind it avoids two workers
  colliding in one file. q7r3x's shipped ACs stay historically true — it ships four cells;
  m3vhq then adds the fifth.
- **Why `depends_on: design-system-tfhn6`.** It teaches `EnterButton` the `disabled` prop
  AC 6 needs. Same shape as `design-system-xr4sb` → `agentic-workflow-q7r3x`: the
  styleguide ships the primitive, the dashboard consumes it unforked. tfhn6's own deps are
  met, so it can be worked immediately; m3vhq queues behind it.
- **Two paths decline, one predicate decides.** The `disabled` attribute blocks the *click*
  path — a disabled `<button>` fires no `onClick` and leaves the tab order. It does nothing
  about the *keyboard* path: bare Enter typed in the textarea still reaches
  `promptBarKeyIntent` → `launch` → `fire()` (AC 5 pins that the classifier stays
  untouched). That is why AC 4's `fire()` guard and AC 6's disabled button both exist and
  neither is redundant — two independent entry points, both consulting the one
  `canFirePromptMode` predicate from AC 3.
- **Subtitle copy** (`straight to Claude, no skill`) is a proposal in q7r3x's settled
  lowercase register (`file it fast, no ceremony` / `shape into structure` /
  `ask the codebase` / `dig deeper`). Cheap to overrule at implementation time.
- **Armed launches (explicit non-change).** When the board is armed, `fire()` threads
  `skipPermissions: true` into `launchOrCopy` for every mode. Plain inherits that, so an
  armed Plain launch runs an unconstrained prompt under
  `--dangerously-skip-permissions` — the one mode with no skill guardrail behind it. This
  is not a new hazard class (the same flag already reaches `/agentheim:work`), and this
  task deliberately does **not** special-case it. Recorded so the choice is visible rather
  than accidental.
- **Orchestrator not spawned** (either pass). The first pass reasoned that no open
  architectural question remained — "consumer-side wiring against primitives already
  shipped". The second pass found one it had missed (the disabled `EnterButton`), but found
  it by *reading the code q7r3x had just landed*, which is what actually made it visible;
  the resolution then followed the xr4sb precedent directly and needed a builder decision,
  not a specialist. Worth noting as a pattern: a task refined against code that has not
  landed yet can go stale in exactly this way, and re-reading the dependency's diff at
  promotion time is what catches it.
- Prior art is the two "add a tab" precedents — `agentic-workflow-h7n2c` (Inquire, the
  fourth tab) and `agentic-workflow-036` (Research, the third) — plus the console's own
  lineage: `bz3az` (built the tab row + keyboard model), `s7gev` (the selection-model
  decision behind ADR-0050), `p8k4d` (amended it).

## Outcome

Shipped the fifth prompt-bar mode, Plain, and — for the first time in this model — a mode
that can decline to launch.

- `dashboard/app/modeling-command.js` — added `plainCommandFor(prompt)`, the one builder
  with **no bare-command constant**: it returns `safePrompt(prompt)` verbatim (trimmed
  ends, interior whitespace preserved), degrading to `''` for a missing/whitespace-only/
  non-string prompt. Pure, never throws.
- `dashboard/app/prompt-mode.js` — `PROMPT_MODES` gains a fifth entry, **appended last**
  (`{ id: 'plain', label: 'Plain', subtitle: 'straight to Claude, no skill', icon: 'bot',
  commandFor: plainCommandFor, requiresPrompt: true }`); `DEFAULT_PROMPT_MODE_INDEX` stays
  `0`. `clampPromptModeIndex` now bounds `0..4`; `nextPromptModeIndex`'s wrap targets moved
  from Research (3) to Plain (4) at both ends. Added the new pure predicate
  `canFirePromptMode(index, prompt)` — `false` exactly when the mode's `requiresPrompt` is
  true and the trimmed prompt is empty, `true` otherwise — the ONE function both `fire()`'s
  guard and the Enter button's `disabled` state consult. `promptBarKeyIntent` is
  byte-unchanged: bare Enter on an empty Plain prompt still classifies `launch`; a test
  pins this explicitly (asserts the function's arity stays 1 — no mode/prompt params were
  added).
- `dashboard/app/board.js` `BoardPromptBar` — imports `canFirePromptMode`; `fire(modeIndex)`
  early-returns (before computing the command or calling `launchOrCopy`) when
  `!canFirePromptMode(idx, prompt)` — a decline is a true no-op: no bridge call, no
  clipboard write, no confetti, no textarea clear, no highlight reset, no feedback chip.
  The Enter button now forwards `disabled=${!canFire}` to the styleguide's `EnterButton`
  primitive (its new prop from `design-system-tfhn6`, consumed unforked — never
  re-implemented, never a `pointer-events` fake). The wrapper `<span>`'s `title` and the
  button's `ariaLabel` share one `enterHint` string that reads `Type a prompt to launch
  Plain` when declining, instead of rendering the (empty) command string. The fifth tab
  renders automatically through the existing `PROMPT_MODES.map(...)` / `PromptModeTab`
  loop — no new tab-rendering code — reusing the existing `bot` glyph (no new glyph) and
  painted exactly like the other four (ADR-0051's ochre highlight / ADR-0016 de-emphasis;
  no new paint decision).
- ADR-0050 (`.agentheim/knowledge/decisions/0050-prompt-bar-keyboard-committed-selection-model.md`)
  gained a second `## Amendment` section (2026-07-09, agentic-workflow-m3vhq) recording: the
  mode-count/index-bound move (four→five, `0..3`→`0..4`), the changed wrap targets, that the
  default/reset target is explicitly unchanged, and the new decline-to-launch property —
  mirroring the `agentic-workflow-p8k4d` amendment precedent. No new ADR was written (AC 9).
- Tests: `dashboard/test/modeling-command.test.mjs` (+6 `plainCommandFor` cases —
  verbatim passthrough, padding trim, interior-whitespace preservation, empty/missing/
  whitespace/non-string degrade, never-throws). `dashboard/test/prompt-mode.test.mjs` —
  five-mode shape/order/subtitle/glyph assertions (re-pinned from four), the `requiresPrompt`
  shape test, five-cycle wraparound assertions (re-pinned `clampPromptModeIndex(4)===0` →
  `clampPromptModeIndex(5)===0`, `4` moved out of the `invalid` array to `5`), the
  classifier-untouched-by-Plain test, and 4 new `canFirePromptMode` tests.
  `dashboard/test/board-prompt-bar.test.mjs` — +4 tests (import guard, `fire()`
  early-return-before-`launchOrCopy` ordering, disabled-Enter-button wiring, decline-hint
  text). Full dashboard suite: 799/799 passing (was 767 per p8k4d's Outcome baseline).
- `dashboard/dist/app.js` rebuilt (confirmed via `git diff --numstat`: 228/226 lines
  changed, a real rebuild, not the recurring EOL phantom) — the served bundle carries the
  fifth tab, `plainCommandFor`, `canFirePromptMode`, and the disabled Enter button.
- BC README — the *Board prompt bar* bullet rewritten to describe five modes, Plain's
  subtitle/glyph, the `requiresPrompt`/`canFirePromptMode` decline-to-launch mechanics, the
  disabled Enter button (and its de-emphasis paint), and the re-pinned wrap targets.

No new backlog items. No concept candidate noted beyond what's already tracked.
