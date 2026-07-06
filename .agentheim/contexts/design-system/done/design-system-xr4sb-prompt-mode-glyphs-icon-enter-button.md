---
id: design-system-xr4sb
title: Prompt-mode tab glyphs + solid-ochre icon Enter-button variant, aligned to 1b
status: done
type: feature
context: design-system
created: 2026-07-06
completed: 2026-07-06
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

## Outcome
Added the three styleguide primitives Section 1b calls for, all consumed unforked
(ADR-0003) by `agentic-workflow-q7r3x`:

- **Glyphs** (`styleguide/app/icons.js`, `LUCIDE` map) — `diamond` (Modeling),
  `circle-dot` (Research), and `corner-down-left` (the Enter button's return arrow),
  all at verbatim upstream Lucide geometry (fetched from
  raw.githubusercontent.com/lucide-icons/lucide). `diamond` and `circle-dot` are
  surfaced in the section-04 interface-set gallery (`foundations2.js`, the curated `ui`
  array); `corner-down-left` is documented via its own Enter-button specimen instead
  (mirroring how `maximize` isn't duplicated into the gallery). `plus` and
  `message-circle-question` are untouched — Inquire keeps its deliberate r4k8m glyph.
- **`EnterButton`** (`styleguide/app/button.js`) — a new icon-square variant alongside
  the existing `Button`: filled `--accent-ochre` directly, `corner-down-left` glyph,
  `--radius-sm` corners, compact square footprint. Sits within ADR-0048's surface-2
  "primed primary action" carve-out (fires/commits the prompt) per ADR-0051. Documented
  as its own specimen in the canvas, section 12 ("Button — neutral, destructive &
  Enter").
- **`--accent-ochre-fg`** (`styles/colors_and_type.css`) — a new dedicated fixed
  per-theme foreground pair for the glyph, added because `--accent-ochre` inverts
  lightness across themes (darker in light theme, lighter in dark theme) — the
  opposite of how `--fg-1` flips — so reusing a generic surface/foreground token would
  go illegible in one theme.
- **Tests** — `styleguide/test/icons-prompt-mode.test.mjs` (13 assertions across the
  three glyphs: registration, verbatim geometry, gallery membership) and
  `styleguide/test/enter-button.test.mjs` (6 assertions: export/Icon consumption, fill +
  glyph, square footprint, dedicated on-accent token, canvas specimen). Also narrowed
  an existing over-broad guard in `modal.test.mjs` ("Button destructive does NOT use
  the reserved selection accent") to scope to the `Button()` function body only, since
  it previously asserted `--accent-ochre` absent from the whole `button.js` file — which
  the new (licensed) `EnterButton` legitimately breaks. Full styleguide suite: 173/173
  green (160 baseline + 13 new). Dashboard suite: 767/767 green (one `events.test.mjs`
  timing-flake reproduced as a false failure once, confirmed green in isolation and on
  a clean rerun — unrelated to this task).
- **Gate** — visible canvas change (section 04 gallery + section 12 specimen); gate-
  reopen note added to the BC README. `dist/` deliberately NOT rebuilt (derived
  artifact per ADR-0003; `agentic-workflow-q7r3x` rebuilds it when the tab layout +
  Enter button actually render on the board).

Key files:
- `styleguide/app/icons.js` (three new `LUCIDE` entries)
- `styleguide/app/foundations2.js` (`ui` gallery array)
- `styleguide/app/button.js` (`EnterButton`)
- `styleguide/app/app.js` (canvas specimen + import)
- `styleguide/styles/colors_and_type.css` (`--accent-ochre-fg` token pair)
- `styleguide/test/icons-prompt-mode.test.mjs` (new)
- `styleguide/test/enter-button.test.mjs` (new)
- `styleguide/test/modal.test.mjs` (narrowed pre-existing guard scope)
- `.agentheim/contexts/design-system/README.md` (gate-reopen note + Pointers entry)
