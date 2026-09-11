---
id: agentic-workflow-065
title: Prompt-bar buttons redesign — icon tile + title/subtitle cards, Quick Capture emphasised, ⌘↵ hint
status: done
type: feature
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
commit: cf06395
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, prompt-bar, ui]
related_adrs: [0003, 0016, 0020]
related_research: []
prior_art: [agentic-workflow-036, agentic-workflow-023, agentic-workflow-038, agentic-workflow-054, agentic-workflow-030, agentic-workflow-033]
related_tasks: [agentic-workflow-064]
---

## Why
A screenshot mock the builder produced (root `Screenshot 2026-06-17 112241.png`) reshapes
the three launch buttons beneath the prompt field. Today they are three small flat chips
(`Quick Capture` / `Modeling` / `Research`, aw-023/aw-036). The design upgrades them into
richer cards so the "type a prompt, then choose how to file it" intent reads clearly.

## What
Restyle the `BoardPromptBar` launch row in `dashboard/app/board.js`. **Interaction is
unchanged** — each button still launches its own session on click (aw-023's
`launchOrCopy` + the per-button seeded command, the armed-`skipPermissions` threading,
the confetti-on-success). This is a **visual restyle only**, no selection model and no
Enter-to-launch (aw-038's swallowed Enter stays as-is).

Each of the three buttons becomes a card with:
1. A **square icon tile** on the left (a `+` for Quick Capture, a target/concentric
   glyph for Modeling, a magnifier for Research). **None of the tiles use the reserved
   ochre accent** — see the settled token decision below; the tiles are neutral
   (token-styled `--surface`/`--fg`), and Quick Capture's emphasis lives in the *card*
   chrome, not a coloured tile.
2. A **two-line label** — a bold title over a quiet subtitle:
   - **Quick Capture** / "File it fast"
   - **Modeling** / "Shape into structure"
   - **Research** / "Dig deeper"
3. **Quick Capture carries the emphasised treatment via the existing primary surface**
   — **not** ochre. It reuses the aw-033 primary-button treatment: `--surface-2` fill,
   `--fg-1` text, `--hairline-strong` border (the same chrome the topbar Work launch
   wears). Modeling and Research stay quiet/secondary — transparent/`--surface-1` on a
   plain `--hairline` border. This is *emphasis*, not a selected state (there is no
   selection behaviour), and it deliberately leaves the reserved selection accent
   `--accent-ochre-soft` untouched (ADR-0016 honoured).

To the **right of the row**, a quiet helper: the text **"Type a prompt to begin"** and a
**⌘↵** keyboard-shortcut chip. Per the captured decision this hint is **decorative** — it
does not wire Enter/⌘↵ to a launch (consistent with aw-038 swallowing Enter in the field).

## Acceptance criteria
- [x] The three buttons render as icon-tile + title + subtitle cards with the copy above.
- [x] Clicking any button still launches its own seeded session (Quick Capture /
      Modeling / Research commands unchanged), with the silent clipboard fallback,
      armed-`skipPermissions` threading, and the success confetti all preserved.
- [x] Quick Capture wears the emphasised treatment using the **primary surface** chrome
      (`--surface-2` fill, `--fg-1` text, `--hairline-strong` border — the aw-033 Work
      treatment); Modeling and Research are quiet/secondary (`--hairline` border). **No
      ochre** anywhere, and the reserved `--accent-ochre-soft` selection accent is
      untouched (ADR-0016 honoured). No selected-state logic is introduced.
- [x] The right-side "Type a prompt to begin" + ⌘↵ hint renders as shown and is
      decorative — Enter/⌘↵ launches nothing (aw-038's swallowed Enter is untouched).
- [x] Styleguide consumed unforked (ADR-0003); the buttons stay board-local, token-styled
      composites — no styleguide primitive forked, no new token minted.
- [x] `dashboard/dist/app.js` rebuilt (esbuild) so the deployed app carries the change.

## Notes
**Settled (refinement 2026-06-17) — the accent fill: no ochre, use the existing primary
surface.** The capture flagged a token tension: the mock paints Quick Capture (and Work,
in aw-064) in ochre, but ADR-0016 reserves `--accent-ochre-soft` for the selection accent.
The builder settled it by **not using ochre at all** — Quick Capture's emphasis is the
existing **primary-surface** treatment (`--surface-2` + `--fg-1` + `--hairline-strong`, the
aw-033 Work-button chrome), Modeling/Research stay quiet on a `--hairline` border. This
dissolves the tension cleanly: ADR-0016 is untouched, **no token is repurposed, no
design-system child task, and no new ADR is needed** (we are choosing *not* to touch the
reserved accent — fully consistent with existing colour law, so there is nothing to
record beyond this note). Trade-off accepted: the restyle is intentionally **off-mock on
colour** (no ochre), keeping the icon-tile + title/subtitle structure but carrying the
emphasis in card chrome rather than a coloured fill. **This decision is shared with aw-064**
(the Work restyle) — settled once for both; aw-064's Work button takes the same
primary-surface emphasis, no ochre.

**⌘↵ decorative, by decision.** A keyboard hint that fires nothing is a deliberate choice
(captured 2026-06-17): the restyle does not change the launch model. If the builder later
wants Enter/⌘↵ to actually launch a selected mode, that is a separate behavioural task that
would reverse aw-038.

Frontend task — gated on the approved styleguide (`design-system-001`, done). Shares the
`dashboard/dist/app.js` bundle with aw-064, so the two cannot build in parallel (the `work`
skill conflict-serializes shared-dist tasks).

## Outcome
Visual restyle of the board prompt-bar launch row from three flat chips into icon-tile +
title/subtitle cards, with the launch model fully preserved.

- New board-local **`PromptLaunchCard`** component in `dashboard/app/board.js` (placed just
  before `BoardPromptBar`). It runs the same pure `launchOrCopy` with the silent clipboard
  fallback, threads the armed `skipPermissions` flag (icon hue → `--obligation` while armed),
  and shares the bar's `onResult` clear-textarea + confetti path. The shared `LaunchButton`
  chip used elsewhere on the board (column pairs, per-card pairs, topbar Work, Stop) was left
  untouched — the restyle is isolated to the prompt bar.
- Each card: a square **neutral** icon tile (`plus` / `compass` / `search`, all confirmed in
  the styleguide icon registry — no new icon minted) over a bold title + quiet `--fg-3`
  subtitle (Quick Capture / "File it fast", Modeling / "Shape into structure", Research /
  "Dig deeper"). `compass` is the registry's concentric-glyph; there is no `target` icon and
  forking one would violate ADR-0003.
- Quick Capture carries `emphasis="primary"` = the aw-033 Work chrome (`--surface-2` /
  `--fg-1` / `--hairline-strong`); Modeling & Research quiet on `--hairline`. **No ochre**;
  `--accent-ochre-soft` untouched (ADR-0016). No selection model introduced.
- Decorative right-of-row helper ("Type a prompt to begin" + a `⌘↵` `<kbd>` chip) — not a
  control, wires no launch; aw-038's swallowed Enter is untouched.
- Tests: extended `dashboard/test/board-prompt-bar.test.mjs` with 6 new static-source guards
  (card structure, the three subtitles, the icon-tile glyphs, the primary-surface emphasis,
  no applied ochre token, the decorative hint). Full dashboard suite green (521 tests).
- Rebuilt `dashboard/dist/app.js` (`node build.mjs`) so the served bundle carries the restyle.

No ADR written — the token decision (no ochre, primary-surface emphasis) was settled at
refinement and is fully consistent with existing colour law (nothing new to record).

Key files: `dashboard/app/board.js` (PromptLaunchCard + BoardPromptBar row),
`dashboard/test/board-prompt-bar.test.mjs`, `dashboard/dist/app.js`,
`.agentheim/contexts/agentic-workflow/README.md`.
</content>
