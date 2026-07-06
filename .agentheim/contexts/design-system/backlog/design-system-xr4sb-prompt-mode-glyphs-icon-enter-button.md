---
id: design-system-xr4sb
title: Prompt-mode tab glyphs + solid-ochre icon Enter-button variant, aligned to 1b
status: backlog
type: feature
context: design-system
created: 2026-07-06
completed:
depends_on: [design-system-001-styleguide]
blocks: [agentic-workflow-q7r3x]
tags: [dashboard-redesign, prompt-bar]
related_adrs: [0048, 0051]
related_research: []
prior_art: [design-system-r4k8m]
---

## Why
Section 1b of the UX-explorations reference (`inspiration/Agentheim UX Explorations.html`)
paints the docked prompt console with a specific mode-tab glyph set and a compact
solid-ochre **icon** Enter button. Both are styleguide-owned primitives the dashboard
consumes, so they belong in `design-system`, not in the `agentic-workflow` consumer.
This task exists to make those primitives available so `agentic-workflow-q7r3x` can wire
them without forking the styleguide (ADR-0003).

## What
Two styleguide additions, both documented in the canvas (`styleguide/index.html`):

1. **Prompt-mode tab glyphs aligned to 1b.** The four mode tabs consume these glyph
   keys from the shared set (`styleguide/app/icons.js`):

   | Mode | Glyph key | Status | Live glyph replaced |
   |---|---|---|---|
   | Quick Capture | `plus` | already in set — **keep** | `plus` (unchanged) |
   | Modeling | `diamond` | **add** (Lucide geometry) | `compass` |
   | Inquire | `message-circle-question` | already in set — **keep, do not revert** | (unchanged) |
   | Research | `circle-dot` | **add** (Lucide geometry) | `search` |

   Net icon-set additions for the mode tabs: **`diamond`** and **`circle-dot`**, added
   at verbatim upstream Lucide geometry the same way `design-system-r4k8m` /
   `design-system-017` added theirs (registry key → inner SVG path; `Icon` supplies the
   `<svg>`). Both surface in the section-04 interface-set gallery (`foundations2.js`, the
   curated `ui` array).

2. **A solid-ochre icon-square Enter-button variant** — a filled `--accent-ochre`
   background with a return-arrow glyph (Lucide **`corner-down-left`**, the `↵` shape —
   **add** it to the icon set; not the word "Enter"), a compact ~square footprint,
   distinct from the existing soft/`cta` text-button treatment. It sits within ADR-0048's
   "primed primary action" carve-out (the Enter affordance fires a launch), so it is not
   a new accent exception.

## Acceptance criteria
- [ ] `diamond` and `circle-dot` are added to the shared icon set
      (`styleguide/app/icons.js`) at verbatim upstream Lucide geometry, each rendering
      through the shared `Icon` component unchanged (no new prop, no fork), and both
      surface in the section-04 gallery. `plus` and `message-circle-question` are left
      as-is — Modeling uses `diamond`, Research uses `circle-dot`, and **Inquire keeps
      `message-circle-question`** (see the settled decision in Notes; no glyph is
      retired, no ADR is written for the mode glyphs).
- [ ] A solid-ochre icon-square Enter-button variant exists in the styleguide: filled
      `--accent-ochre`, the `corner-down-left` (`↵`) glyph, ~square footprint (radius
      near `--radius-sm`), visibly distinct from the soft `cta` text button. `corner-down-left`
      is added to the icon set (verbatim Lucide geometry) if not already present.
- [ ] Glyph contrast on the ochre fill meets the styleguide legibility bar (the glyph
      draws from a fixed dark/light on-accent foreground, not a theming surface token,
      so it stays legible on the ochre in both themes).
- [ ] All three additions are rendered in context in the styleguide canvas — the two new
      mode glyphs in the section-04 gallery, and the icon Enter-button variant documented
      as its own specimen.
- [ ] A `node --test` guard asserts each new glyph is registered and renders (the
      `icons-inquire.test.mjs` / `icons-trash.test.mjs` shape).
- [ ] Styleguide + dashboard suites green.

## Notes
- Blocks `agentic-workflow-q7r3x` (the dashboard consumer that wires these in).
- Scope is styleguide primitives only. The tab-cell **layout**, the active-tab
  **underline** paint (ADR-0051 intent), the ochre **chevron**, and the subtitle copy
  are all consumer-side and live in `agentic-workflow-q7r3x` — not here.
- Deltas were read from a side-by-side of `1b.png` (Section 1b) and `yours.png` (live
  bar) on 2026-07-06.
- **Settled open call (refine 2026-07-06): Inquire keeps `message-circle-question`.**
  1b paints a bare "?", but `design-system-r4k8m` (2026-06-18) deliberately added
  `message-circle-question` — a chat bubble carrying a "?" — as the distinct "ask the
  codebase" glyph. The builder chose to treat r4k8m as the intended post-1b evolution
  and let 1b's bare "?" be superseded, so **no shipped decision is reversed and no ADR
  is written**. "Match 1b" here means the *other three* glyphs (plus / diamond /
  circle-dot) plus the icon Enter button — Inquire stays put.
- The old Modeling (`compass`) and Research (`search`) glyphs were undeliberate defaults
  (never ADR- or task-backed — see r4k8m's "sibling cards" note), so swapping them to
  `diamond` / `circle-dot` reverses nothing.
- Live-board note (ds-021 / r4k8m precedent): `dist/` is a derived artifact (ADR-0003)
  and is **not** rebuilt here — the consuming task (`agentic-workflow-q7r3x`) rebuilds it
  when the glyphs + icon button actually render on the board. This task also reopens the
  design-system gate (visible canvas change) per the standing precedent; add the
  gate-reopen note to the BC README at execution.
