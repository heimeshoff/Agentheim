---
id: agentic-workflow-aqyqd
title: Every prompt-bar mode requires a prompt — the decline-to-launch rule generalizes from Plain to all five
status: todo
type: feature
context: agentic-workflow
created: 2026-07-09
completed:
depends_on: [design-system-001-styleguide, agentic-workflow-m3vhq]
blocks: []
tags: [dashboard, prompt-bar]
related_adrs: [0050, 0003, 0016]
related_research: []
prior_art: [agentic-workflow-m3vhq, agentic-workflow-p8k4d, agentic-workflow-bz3az]
---

## Why
`agentic-workflow-m3vhq` (shipped 2026-07-09) gave the prompt bar its first mode that can
**decline to launch**: with Plain highlighted and the textarea empty, the Enter button
renders disabled and `fire()` no-ops. The builder used it and wants that behavior for
**all five** modes.

This reverses, deliberately, the clause m3vhq's own ADR-0050 amendment wrote down:

> The four legacy modes always fire, empty prompt or not — their bare commands
> (`/agentheim:modeling`, etc.) are meaningful on an empty prompt.

That clause was a correct reading of the code as it stood. What it treated as a *feature*
— clicking **Modeling** with an empty box opens a bare modeling dialogue — the builder
reads as an accident of the launcher's origins. The prompt bar is a **prompt console**:
its purpose is to send a prompt. With no prompt there is nothing to send, in any mode.

**The trade, accepted explicitly (2026-07-09).** The four bare-command constants
(`QUICK_CAPTURE_COMMAND`, `MODELING_COMMAND`, `INQUIRE_COMMAND`, `RESEARCH_COMMAND`) are
reachable from **exactly one** place today: a mode's `commandFor('')` on an empty prompt.
Verified — they have no consumer anywhere outside `modeling-command.js`
(`refineCommandFor` / `promoteCommandFor` / `WORK_COMMAND` / `WHATS_NEXT_COMMAND` are
separate paths and are untouched by this task). So gating every mode on a non-empty prompt
makes the bare-skill launch **unreachable from the board**. Bare sessions get launched from
the terminal. The builder chose this knowingly over preserving a second bare-launch
affordance, which would have reopened `agentic-workflow-p8k4d`'s click-selects-only rule.

## What
`requiresPrompt` is **removed entirely** from the model — not set to `true` five times.

The flag existed for exactly one reason: to mark Plain as *the exception* among peers. Once
there is no exception, the per-mode axis is a fiction — "a prompt is required" becomes a
property of **the bar**, not of a mode. Keeping a `requiresPrompt: true` on all five entries
would encode that fiction as five redundant booleans the predicate must still read.

`canFirePromptMode(index, prompt)` keeps its two-parameter signature so both call sites and
their tests stay stable, and so a future per-mode exception can return without a
re-plumbing. `index` becomes deliberately unread.

Nothing else about the launch model moves. `promptBarKeyIntent` stays untouched (bare Enter
still classifies as `launch`; the decline is a `fire()`-level concern, never a fifth
intent). The Enter button's `title`/`aria-label` already read `Type a prompt to launch
<Label>` on decline and need no change — that string was written mode-agnostically. Paint is
untouched: `EnterButton`'s `disabled` prop (`design-system-tfhn6`) is already consumed
unforked (ADR-0003) and already painted opacity-only (ADR-0016).

## Acceptance criteria
- [ ] `requiresPrompt` is deleted from the `plain` entry in `PROMPT_MODES`
      (`dashboard/app/prompt-mode.js`) and is **not** added to any other entry. The key
      appears nowhere in the module after this task.
- [ ] `canFirePromptMode(index, prompt)` returns `true` exactly when the trimmed prompt is
      non-empty, for **every** index; `false` otherwise. A missing / non-string / whitespace-
      only prompt is treated as empty. It keeps its two-parameter signature, does not read
      `index`, and never throws — including on an out-of-range or non-numeric `index` (the
      old `clampPromptModeIndex` call inside it goes away with the mode lookup, so nothing
      remains that could throw). Its doc comment states why `index` is retained and unread.
- [ ] `fire(modeIndex)` still early-returns **before** `launchOrCopy` when
      `canFirePromptMode` is false — unchanged code, but now reachable from all five modes:
      no bridge call, no clipboard write, no confetti, no textarea clear, no highlight
      reset, no feedback chip.
- [ ] The Enter button renders **disabled** exactly when the trimmed prompt is empty,
      whichever mode is highlighted — via `EnterButton`'s `disabled` prop, consumed unforked
      (ADR-0003), never re-implemented in `board.js` and never faked with a
      `pointer-events: none` wrapper. Its `title` / `aria-label` read
      `Type a prompt to launch <Label>` for each of the five labels.
- [ ] `promptBarKeyIntent` is **untouched**. A test asserts bare Enter on an empty prompt
      still classifies as `launch` for every mode — the decline happens in `fire()`, not in
      the classifier (ADR-0050 invariant 4 stays a disjoint, keyboard-only classification).
- [ ] **The inverted assertion is re-pinned, not deleted.** `prompt-mode.test.mjs`'s
      `canFirePromptMode is true for all four legacy modes regardless of an empty prompt —
      their bare commands are meaningful` (line ~250) asserts the exact behavior this task
      reverses. It must be **rewritten to assert the opposite** (no mode fires on an empty
      prompt; every mode fires on a real one), not removed. Likewise the module doc comment
      at ~line 69 that explains Plain's uniqueness.
- [ ] `board-prompt-bar.test.mjs`'s disabled-Enter assertion is widened from "Plain
      highlighted + blank prompt" to cover a legacy mode highlighted + blank prompt.
- [ ] The four bare-command constants and their builders' empty-prompt degrade branches are
      **left in place, not deleted.** They remain correct, pure, and unit-tested; they are
      simply no longer reachable from the board. A comment on each constant records that the
      board no longer reaches it (so a later reader doesn't "restore" the bare launch by
      accident). `plainCommandFor`'s `''`-on-empty degrade likewise stays.
- [ ] ADR-0050 gains a **third** `## Amendment` section — no new ADR, same precedent as
      `agentic-workflow-p8k4d` and m3vhq. It records: the second amendment's
      "four legacy modes always fire" clause is **reversed**; `requiresPrompt` is retired as
      a concept; "a mode may decline to launch" generalizes to "the bar declines to launch
      without a prompt"; the bare-skill launch is now unreachable from the board, deliberately;
      and invariants 1–4 plus the default/reset target are all **unchanged**.
- [ ] `dashboard/dist/` is **rebuilt** (`node build.mjs`) — `board.js` and `prompt-mode.js`
      are both bundled.
- [ ] Dashboard suite green (`node --test dashboard/test/*.test.mjs`); the verifier drives
      the runtime surface clean.

## Notes
- **Why this is `todo/` and not `backlog/`.** Both open design questions were settled with
  the builder at capture time (2026-07-09): *(a)* losing the board's bare-skill launch is
  the intent, not a casualty; *(b)* `requiresPrompt` is dropped rather than set true five
  times. Nothing is left to refine — the change is a deletion, an inversion of one
  predicate, and one ADR amendment.
- **Blast radius is small but the tests lie in the opposite direction.** The two assertions
  named in the ACs *currently pass* and *encode the old rule in their titles*. A worker who
  only makes the suite green could satisfy it by deleting them. AC 6 exists to forbid that:
  they must be re-pinned to the new contract, so a future reader can see the rule was
  reversed on purpose rather than quietly dropped.
- **`index` becomes an unread parameter.** This is deliberate (call-site + test stability,
  and a cheap door back to a per-mode exception). If the project's lint objects, prefix it
  rather than removing it from the signature — do not change the two call sites.
- **Armed Plain, unchanged.** m3vhq's recorded non-change stands: an armed launch threads
  `skipPermissions: true` for every mode, so an armed Plain runs an unconstrained prompt
  under `--dangerously-skip-permissions`. This task narrows *when* a launch can fire; it does
  not touch *what* an armed launch carries. Not re-litigated here.
- **No `design-system` dependency.** `EnterButton`'s `disabled` prop already shipped
  (`design-system-tfhn6`) and this task adds no new styleguide surface, glyph, or paint. The
  `design-system-001-styleguide` dep is the standing frontend gate, already satisfied.
- Prior art: `agentic-workflow-m3vhq` built the predicate and the disabled button this task
  generalizes; `agentic-workflow-p8k4d` is the precedent for amending ADR-0050 in place while
  reversing one of its clauses; `agentic-workflow-bz3az` built the tab row and keyboard model.
