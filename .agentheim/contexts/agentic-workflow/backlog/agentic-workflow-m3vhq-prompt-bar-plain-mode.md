---
id: agentic-workflow-m3vhq
title: Prompt bar — add a "Plain" mode that runs the prompt directly on Claude
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-09
completed:
depends_on: [design-system-001-styleguide, agentic-workflow-q7r3x]
blocks: []
tags: [dashboard, prompt-bar]
related_adrs: [0050, 0003, 0018, 0016]
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
- **Glyph:** reuse the existing `bot` key. No new glyph, so no `design-system` dependency.

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
- [ ] The Enter button renders **disabled** (visually dimmed, no hover affordance) exactly
      when `canFirePromptMode(highlightedMode, prompt)` is false. Its `title` / `aria-label`
      never render an empty command string — with Plain highlighted and the prompt blank
      they read `Type a prompt to launch Plain`, not `Launch Plain — `.
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
      `board-prompt-bar.test.mjs`'s four-tab source assertions move to five and gain the
      disabled-Enter assertion.
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
- **Orchestrator not spawned.** After the four builder decisions above, no open domain or
  architectural question remained: single BC, consumer-side wiring against primitives
  already shipped, one ADR amendment whose shape p8k4d fixed by precedent. Delegating
  would have added latency without new information.
- Prior art is the two "add a tab" precedents — `agentic-workflow-h7n2c` (Inquire, the
  fourth tab) and `agentic-workflow-036` (Research, the third) — plus the console's own
  lineage: `bz3az` (built the tab row + keyboard model), `s7gev` (the selection-model
  decision behind ADR-0050), `p8k4d` (amended it).
