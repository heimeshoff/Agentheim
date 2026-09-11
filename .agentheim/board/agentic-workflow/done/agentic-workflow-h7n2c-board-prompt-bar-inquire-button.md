---
id: agentic-workflow-h7n2c
title: Board prompt bar — Inquire launch button between Modeling and Research
status: done
type: feature
context: agentic-workflow
created: 2026-06-18
completed: 2026-06-18
depends_on: [design-system-001, design-system-r4k8m]
blocks: []
tags: [dashboard, frontend, bridge, ui]
related_adrs: [0018, 0003, 0009]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: [agentic-workflow-036, agentic-workflow-065]
---

## Why
The board prompt bar lets the builder author a prompt once and hand it to whichever
authoring skill they pick. Today that's three cards — Quick Capture / Modeling / Research
(aw-023, aw-036, restyled into icon-tile cards by aw-065). The `inquire` skill
(`skills/inquire/`) answers questions *toward* the codebase — how a feature works, where
something lives, what was decided and why, whether something is built yet — and there is no
prompt-bar entry point for it. The builder wants to type a question and hand it straight to
`inquire` from the board, the same way they hand a capture to Quick Capture.

## What
Add a **fourth** `PromptLaunchCard` to the board prompt bar, **between Modeling and
Research**, so the row reads **Quick Capture · Modeling · Inquire · Research**. The card:

- Title **Inquire**, with a quiet subtitle in the established voice (the trio uses "File it
  fast" / "Shape into structure" / "Dig deeper"; Inquire is "Ask the codebase" or similar).
- Wears the new inquiry glyph from the icon registry (design-system-r4k8m —
  `message-circle-question`), in the same neutral square icon tile as Modeling / Research
  (`--surface-2` fill, never a coloured fill; quiet/secondary `--hairline` border — only
  Quick Capture carries the emphasised primary surface, and no ochre, ADR-0016).
- Seeds `/agentheim:inquire <prompt>` via a new `INQUIRE_COMMAND` constant +
  `inquireCommandFor(prompt)` builder in `dashboard/app/modeling-command.js`, exactly
  mirroring `RESEARCH_COMMAND` / `researchCommandFor` (bare + fully-qualified; appends a
  single space + the trimmed sanitized prompt, else degrades to the bare command).
- Reuses the existing `launchOrCopy` bridge path (ADR-0018) unchanged: real interactive
  session when the bridge is present, silent clipboard fallback when absent.
- Threads the armed `skipPermissions` signal like every other launch (aw-021 / ADR-0019),
  and runs the same `onResult` clear-textarea + confetti success path as its siblings.

## Acceptance criteria
- [ ] The board prompt bar renders four launch cards in the order Quick Capture · Modeling ·
      **Inquire** · Research.
- [ ] `INQUIRE_COMMAND` (`/agentheim:inquire`) and `inquireCommandFor(prompt)` exist in
      `modeling-command.js`, mirroring the Research builder; a non-string / empty prompt
      degrades to the bare command (never `[object Object]`, never a throw).
- [ ] Clicking Inquire with a typed prompt launches `/agentheim:inquire <trimmed prompt>`
      through the bridge, and falls back silently to clipboard copy when the bridge is absent.
- [ ] Inquire threads `skipPermissions` only when armed (field omitted, never sent `false`,
      when off — byte-identical OFF path).
- [ ] The card matches the quiet/secondary treatment of Modeling/Research (neutral icon
      tile, no ochre, no primary-surface emphasis) and wears the new inquiry glyph.
- [ ] `inquireCommandFor` is covered by `node --test` (both armed states / empty-prompt
      fallback), alongside the existing `researchCommandFor` tests.
- [ ] `dashboard/dist/` is rebuilt (esbuild) so the deployed app carries the new card.

## Notes
- Depends on **design-system-r4k8m** (the new glyph) — without it the card has no icon.
  Also carries the standing styleguide gate **design-system-001**.
- Direct lineage: aw-036 added Research as the third card the same way; aw-065 turned the
  trio into `PromptLaunchCard`s. This is "do exactly that, once more, for Inquire" — same
  files (`board.js`, `modeling-command.js`, `bridge-launch.js` reused unchanged), same
  unforked styleguide consumption (ADR-0003).
- The `inquire` skill is read-only over `.agentheim/` and the source — launching it is an
  external side-effect like the other cards, not a lifecycle write; the board stays a
  projection of disk (ADR-0017 / ADR-0001).

## Outcome

A fourth **Inquire** `PromptLaunchCard` now sits in the board prompt bar **between
Modeling and Research** — the row reads Quick Capture · Modeling · **Inquire** · Research.
A straight extension of the aw-036 / aw-065 pattern: no new launch infrastructure, only a
new command string + the new glyph.

- `dashboard/app/modeling-command.js` — added `INQUIRE_COMMAND = "/agentheim:inquire"`
  and the pure `inquireCommandFor(prompt)` builder, mirroring `researchCommandFor` exactly
  (single space + trimmed prompt when present, else bare; missing / non-string /
  whitespace degrades to bare — never `[object Object]`, never a doubled space, never a throw).
- `dashboard/app/board.js` `BoardPromptBar` — a fourth `PromptLaunchCard` ("Inquire" /
  "Ask the codebase", icon `message-circle-question`) placed between the Modeling and
  Research cards, computing its command via `inquireCommandFor(prompt)` at click time,
  threading the armed `skipPermissions` (field OMITTED when off, never sent `false` — the
  OFF path is byte-identical via the shared `launchOrCopy`) and sharing the bar's `onResult`
  (clear textarea + confetti). Quiet/secondary treatment, NO emphasis prop, no ochre
  (ADR-0016). `PromptLaunchCard` / `launchOrCopy` reused unchanged; no `/api/tree` / SSE /
  lifecycle-write touch (ADR-0001/0017). The glyph is consumed by name from the shared
  styleguide registry (design-system-r4k8m), unforked (ADR-0003).
- Tests: `dashboard/test/modeling-command.test.mjs` (+8 `inquireCommandFor` /
  `INQUIRE_COMMAND` cases — armed-prompt, empty/missing, whitespace-only, padded, non-string
  fallback, interior-whitespace, distinctness) and
  `dashboard/test/board-prompt-bar.test.mjs` (+5 render / order / glyph / thread+no-emphasis /
  import guards). Full dashboard suite 627 green (was 614).
- `dashboard/dist/` rebuilt via `node build.mjs` — the served bundle carries
  `/agentheim:inquire`, the Inquire card, and the `message-circle-question` glyph (verified).
- BC README — the *Board prompt bar* bullet now lists Inquire as the fourth card between
  Modeling and Research (heading, card list, glyph list, and the authoring-intents paragraph).

No ADR (no new decision — precedent-following). No new backlog items.
