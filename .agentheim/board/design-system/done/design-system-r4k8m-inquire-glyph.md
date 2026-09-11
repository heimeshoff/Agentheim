---
id: design-system-r4k8m
title: Add an inquiry/question glyph to the shared icon set
status: done
type: feature
context: design-system
created: 2026-06-18
completed: 2026-06-18
depends_on: []
blocks: [agentic-workflow-h7n2c]
tags: [icons, frontend, ui]
related_adrs: [0003]
related_research: []
prior_art: [design-system-017]
---

## Why
The board prompt bar is gaining an **Inquire** launch card (agentic-workflow-h7n2c) that
fires the `inquire` skill — "ask a question toward the codebase". Its sibling cards use
`plus` (Quick Capture), `compass` (Modeling) and `search` (Research). There is **no**
question/inquiry glyph in the shared icon registry today, and `search` / `compass` are
already taken by the neighbouring cards — so the new card has nothing to wear. This is the
exact gap design-system-017 closed for the dismiss trash can.

## What
Add one lucide glyph to the shared icon set
(`contexts/design-system/styleguide/app/icons.js`) that reads as "ask a question". The
natural fit is lucide **`message-circle-question`** (a chat bubble carrying a question mark)
— a question-mark glyph distinct from `search` and `compass`. `circle-help` is an
acceptable fallback. Mirror the existing registry entries (key → inner SVG path string) and
the `node --test` coverage pattern (`styleguide/test/icons-trash.test.mjs` is the ds-017
precedent). Consumed unforked by the dashboard (ADR-0003).

## Acceptance criteria
- [ ] A new glyph keyed for inquiry (e.g. `message-circle-question`) exists in `icons.js`,
      its inner SVG path matching the lucide source, sitting alongside the other 24×24
      stroke glyphs.
- [ ] The glyph renders through the shared `Icon` component unchanged (no new prop, no fork).
- [ ] A `node --test` guard asserts the glyph is registered and renders (the
      `icons-trash.test.mjs` shape).
- [ ] The styleguide icon gallery / canvas shows the new glyph (if the gallery enumerates
      the registry).

## Notes
- Precedent: design-system-017 added `trash-2` the same way for the board dismiss button.
- Pick the glyph key the dashboard task (aw-h7n2c) will import; keep the two in sync.
- This unblocks agentic-workflow-h7n2c — that task wires the Inquire card and consumes
  this glyph by name.

## Outcome
Added the Lucide **`message-circle-question`** glyph to the shared icon set so the board's
Inquire launch card (`agentic-workflow-h7n2c`) can consume it unforked via
`Icon name="message-circle-question"`.

- **Dictionary entry** — `LUCIDE["message-circle-question"]` added to
  `styleguide/app/icons.js` with the exact upstream Lucide inner geometry: the chat-bubble
  outline with tail (`M7.9 20A9 9 0 1 0 4 16.1L2 22Z`), the question-mark curve
  (`M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3`), and the question-mark dot (`M12 17h.01`). Inner
  markup only; the wrapping `<svg>` is supplied by `Icon` (API unchanged).
- **Gallery entry** — appended `"message-circle-question"` to the curated `ui` array in
  `IconSection` (`styleguide/app/foundations2.js`), so the glyph renders in the section-04
  "Interface set · 1.5px · monochrome" grid on the canvas. The `ui` array is hand-picked,
  not auto-derived from `LUCIDE`.
- **Tests** — added `styleguide/test/icons-inquire.test.mjs` (3 source-guard tests, mirroring
  the trash-2 guard): the glyph resolves with non-empty inner markup and no self-wrapped
  `<svg>`; the geometry matches the upstream bubble / question-mark curve / dot; the curated
  gallery surfaces it. Full styleguide suite green: 116/116.
- **Gate** — this is a visible canvas change (section 04 gallery), so it reopens the
  design-system gate per the ds-005/007/009/014/015/017 precedent; gate-reopen note added to
  the BC README. `dist/` deliberately NOT rebuilt (derived artifact per ADR-0003;
  agentic-workflow-h7n2c rebuilds it when the Inquire card renders the glyph on the board).

Key files:
- `styleguide/app/icons.js` (LUCIDE entry)
- `styleguide/app/foundations2.js` (gallery `ui` array)
- `styleguide/test/icons-inquire.test.mjs` (new tests)
- `.agentheim/contexts/design-system/README.md` (gate-reopen note)
