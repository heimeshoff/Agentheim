---
id: agentic-workflow-q7r3x
title: Prompt area matches Section 1b of the UX explorations reference exactly
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-06
completed:
depends_on: [design-system-001-styleguide, design-system-xr4sb]
blocks: []
tags: [dashboard-redesign, prompt-bar]
related_adrs: [0051, 0048, 0016, 0050]
related_research: []
prior_art: [agentic-workflow-bz3az, agentic-workflow-p8k4d, agentic-workflow-s7gev]
---

## Why
The docked prompt console must match the reviewed 1b direction. `bz3az` / `s7gev` /
`p8k4d` already built the console's structural shape and interaction model; a fresh
side-by-side of Section 1b (`1b.png`) against the live bar (`yours.png`) surfaces the
concrete visual deltas that remain. Closing them makes the console a faithful 1b render
**without regressing p8k4d's settled behavior** — because 1b is an older mock that
predates p8k4d's bare-Enter-launch model, we match 1b's *look* but keep the affordances
p8k4d fixed (builder decision, 2026-07-06).

## What
Consumer-side conformance in `dashboard/app/board.js` (`BoardPromptBar` + `PromptModeTab`)
— layout, active-tab paint, chevron, and subtitle copy — plus consuming the
`design-system-xr4sb` glyphs and solid-ochre icon Enter button. No interaction-model
change (p8k4d stands); the placeholder is unchanged.

## Acceptance criteria
- [ ] The tab row renders as **four edge-to-edge equal-width cells** filling the panel
      width, separated by thin vertical `--hairline` dividers — no inter-tab gaps and no
      horizontal panel padding on the tab row (replaces the current gapped inline-block
      layout).
- [ ] A horizontal `--hairline` divider separates the tab row from the input row.
- [ ] The highlighted tab paints as a **filled cell background + a full-width ochre
      bottom underline** (ADR-0051's inset-underline intent), replacing the current
      four-sided ochre box. The other three tabs de-emphasize by opacity (ADR-0016),
      unchanged. *(Box → underline is a bug fix toward the existing ADR-0051 contract —
      no new ADR.)*
- [ ] The leading chevron is a **bright ochre bold `❯`** (was a thin grey `›`).
- [ ] The tab subtitles read, lowercased and fuller, exactly: `file it fast, no ceremony`
      / `shape into structure` / `ask the codebase` / `dig deeper`.
- [ ] The Enter affordance is the **`design-system-xr4sb` solid-ochre icon-square button**
      (`↵` glyph), replacing the soft-ochre "Enter" text button. Clicking it still routes
      through the one `fire(highlightedMode)` path (p8k4d) — behavior identical.
- [ ] The mode-tab glyphs are the **`design-system-xr4sb` 1b-aligned set** (plus /
      diamond / question / ring).
- [ ] The keyboard hint chip stays behavior-accurate to p8k4d's model — it shows `↵`
      (bare Enter launches), **not** 1b's stale `⌘↵`. Its chip *styling* may match 1b's
      bordered pill.
- [ ] The placeholder copy is unchanged (`Type a prompt, then choose a mode to launch
      it…`).
- [ ] Dashboard suite green; the verifier drives the runtime surface clean.

## Notes
- Deltas enumerated from a side-by-side of Section 1b (`1b.png`) vs the live bar
  (`yours.png`), 2026-07-06. Reference lives in the untracked `inspiration/` folder.
- **Why the `⌘↵` / placeholder carve-outs:** 1b predates `p8k4d`'s bare-Enter-launch
  model; the builder chose "match 1b's look, keep current affordances." So the visual
  language conforms while the affordances p8k4d settled are preserved (hint-chip content,
  no placeholder change).
- **Depends on `design-system-xr4sb`** for the glyphs + icon button (styleguide gate +
  primitive availability). Do not start q7r3x until xr4sb is done.
- `PromptModeTab` is a `board.js` consumer component (not a styleguide primitive), so the
  tab-cell layout and active-tab underline paint are this task's, consumed unforked
  (ADR-0003). Governing ADRs: ADR-0051 (tab paint), ADR-0048 (ochre carve-out),
  ADR-0016 (de-emphasis), ADR-0050 (interaction model — unchanged).
