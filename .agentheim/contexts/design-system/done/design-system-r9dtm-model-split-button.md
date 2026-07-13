---
id: design-system-r9dtm
title: ModelSplitButton — the ochre Enter button widens into a labelled split button with a caret
status: done
type: feature
context: design-system
created: 2026-07-13
completed: 2026-07-13
depends_on: []
blocks: [agentic-workflow-m2vkp]
tags: [styleguide, button, prompt-bar, accent, menu]
related_adrs: [0003, 0048, 0051]
related_research: []
prior_art: [design-system-xr4sb, design-system-r4k8m]
---

## Why
The prompt bar's launch affordance is currently two things: a small bordered `↵`
hint glyph and, next to it, the 34×34 ochre `EnterButton` (`styleguide/app/button.js`).
The builder only wants **one** control there — the ochre one — and wants it to
carry information it does not carry today: **which model the session it launches
will run on**, plus a way to change that model.

That turns the square icon-only `EnterButton` into a **split button**: a wide
primary region (still the launch), a label (the model name — "Opus", "Haiku",
"Sonnet", "Fable"), and a caret region on the right that opens a menu. That is a
new *shape*, not a new *color*: ADR-0048's carve-out already licenses ochre for
the primed primary action, and ADR-0051 extends the ochre wayfinding exception to
the prompt bar. The primitive lives here, not in `board.js`, because ADR-0003 is
explicit that the board consumes styleguide primitives **unforked** — the board
must not hand-roll its own ochre split button.

## What
Add a `ModelSplitButton` to `.agentheim/contexts/design-system/styleguide/app/button.js`
(sibling to `EnterButton`, which stays for any other caller) and show it in the
styleguide page alongside the existing button specimens.

Shape:

```
┌────────────────────────────┬────┐
│  ↵   Opus                  │  ▾ │   ← one ochre surface, one hairline divider
└────────────────────────────┴────┘
   primary region: launches      caret region: opens the model menu
```

- **Primary region** — the `corner-down-left` glyph the `EnterButton` already
  uses, plus the model label. Clicking it fires `onClick` (the launch).
- **Caret region** — a small chevron/triangle, visually separated from the primary
  region by a divider on the ochre surface. Clicking it fires `onOpenMenu`, never
  the launch. The two regions are two `<button>`s inside one bordered group, not
  one button with a click-position test.
- **Menu** — a small popover listing the model options, current one marked. The
  primitive owns the popover's paint and keyboard behavior (↑/↓/Enter/Escape,
  click-outside to close); the *contents* (which models exist, which is current)
  are props, so the styleguide never learns Agentheim's model list.
- **Locked state** — a `locked` prop renders the label but no caret and no menu
  (the caret region is absent, not merely disabled), for the Quick Capture case
  where the model is pinned. The primary region still launches.
- **Disabled state** — `disabled` keeps `EnterButton`'s current semantics (0.55
  opacity, default cursor, no click) and applies to both regions.

## Acceptance criteria
- [ ] `ModelSplitButton` is exported from `styleguide/app/button.js` and rendered
      in the styleguide page with specimens for: normal, locked, disabled, and
      menu-open.
- [ ] Props: `{ label, onClick, onOpenMenu, options, value, onSelect, locked, disabled, ariaLabel }`.
      No Agentheim-specific model names appear anywhere in the styleguide — the
      model list arrives as `options`.
- [ ] Clicking the primary region calls `onClick` and never opens the menu;
      clicking the caret calls `onOpenMenu` / toggles the menu and never calls
      `onClick`.
- [ ] `locked` renders no caret region at all and the menu is unreachable by mouse
      or keyboard; the primary region still launches.
- [ ] `disabled` renders both regions non-interactive at 0.55 opacity, matching
      `EnterButton`'s existing disabled treatment.
- [ ] Keyboard: the caret region is reachable by Tab, opens on Enter/Space; inside
      the open menu ↑/↓ move, Enter selects, Escape closes and returns focus to the
      caret (no keyboard trap — same WCAG 2.1.2 discipline as
      agentic-workflow-tkq7v's Escape-blurs rule).
- [ ] The open menu has `role="menu"` with `role="menuitemradio"` items and
      `aria-checked` on the current one; the caret carries `aria-haspopup="menu"`
      and `aria-expanded`.
- [ ] Ochre comes from `var(--accent-ochre)` / `var(--accent-ochre-fg)` — no new
      color token, no hard-coded hex. The menu surface uses `--surface-*` /
      `--hairline*` like every other popover.
- [ ] `EnterButton` is left in place, unchanged and still exported (nothing else
      that consumes it breaks).
- [ ] The styleguide's own tests cover the click-region split, the locked variant,
      and the menu's keyboard behavior.

## Notes
- **ADR-0003 is the reason this task exists separately** from the board work: the
  board must consume this primitive, not fork it. `agentic-workflow-m2vkp` (the
  prompt-bar task) `depends_on` this one.
- ADR-0048 licenses the ochre on the *primed primary action*. The caret region is
  part of the same primed action, so it stays on the ochre surface (divider, not a
  second color). Don't introduce a neutral caret button beside an ochre one —
  that reads as two actions of different weight, which is exactly what the builder
  is asking to collapse.
- The width: no fixed px. The button grows to fit its longest label so switching
  Opus → Fable doesn't reflow the row — set a `min-width` from the longest option,
  or size the label region to the widest of `options`.

## Outcome
Added `ModelSplitButton` to `styleguide/app/button.js`, sibling to the unchanged
`EnterButton`: one `--accent-ochre` bordered group holding two `<button>`s — a
primary launch region (glyph + model label) and a caret region (divider, then a
`chevron-down` glyph) that opens a model menu. `locked` removes the caret region
and the menu entirely (absent, not disabled); `disabled` dims both regions to
0.55 opacity, matching `EnterButton`. The menu is a roving-tabindex popover — a
third distinct focus model from `Menu` and `SearchField` — with
`role="menu"`/`role="menuitemradio"`/`aria-checked`, `aria-haspopup="menu"` +
`aria-expanded` on the caret, ArrowUp/ArrowDown moving the highlight (clamped),
Enter selecting, and Escape closing while returning focus to the caret (WCAG
2.1.2, no trap). The keyboard/menu decisions are factored into a new pure
module, `styleguide/app/button-state.js` (`initialHighlightIndex`,
`nextHighlightIndex`, `arrowDirection`, `isSelectKey`, `isDismissKey`,
`widestOptionLength`), tested directly under `node --test`. The label's
`min-width` is sized in `ch` units from the longest `options` entry so
switching models never reflows the prompt bar. `options`/`value`/`onSelect`
are body-agnostic props — no Agentheim model name appears in the styleguide
source or canvas (canvas specimens use placeholder labels "Alpha"/"Beta"/
"Gamma"). Documented in the canvas (section 12, `ModelSplitButtonRow`) with
four specimens: normal, locked, disabled, and menu-open (via a new
`defaultOpen` prop mirroring `Menu`'s idiom).

Key files:
- `.agentheim/contexts/design-system/styleguide/app/button.js` (`ModelSplitButton`)
- `.agentheim/contexts/design-system/styleguide/app/button-state.js` (new, pure keyboard/menu decisions)
- `.agentheim/contexts/design-system/styleguide/app/icons.js` (`chevron-down` glyph)
- `.agentheim/contexts/design-system/styleguide/app/app.js` (canvas specimens + import, section 12)
- `.agentheim/contexts/design-system/styleguide/test/model-split-button.test.mjs` (new — 6 pure-logic tests + 17 source-guard tests)
- `.agentheim/contexts/design-system/README.md` (new subsection + gate-reopen note + Pointers entry)

Full resolved suite (`dashboard/test`, `lib/test`, styleguide `test`): 1237/1237
green (1214 baseline + 23 new, 0 fail). `dist/` deliberately NOT rebuilt — a
derived artifact (ADR-0003) with no shipped dashboard consumer yet;
`agentic-workflow-m2vkp` rebuilds it when the split button actually renders on
the board's prompt bar.

**Iteration 2 fix (post-verifier):** the `widestOptionLength` JSDoc in
`button-state.js` no longer names real models — it now reads
`"Alpha" → "Gamma"`. The `test/model-split-button.test.mjs` fixture for
`widestOptionLength` now uses `['Nova', 'Zephyr', 'Echo', 'Iota']` instead of
the real model list. The "no Agentheim-specific model names" guard now also
scans `button-state.js`'s source (the file that actually leaked) and its own
test-file source (excluding its own body, which legitimately names the
forbidden words), and its regex includes `Fable` (previously missing). The
guard also asserts, by construction, that the regex matches each of the five
forbidden names individually, so it cannot silently regress to
non-catching again. Full suite re-run: 1237/1237 green, 0 fail.

## Verifier note (iteration 1)

**REASONS:**
- AC #2 ("No Agentheim-specific model names appear anywhere in the styleguide") is violated in **styleguide source**: `styleguide/app/button-state.js:93` — the `widestOptionLength` JSDoc reads `* selected model's name changes length (e.g. "Opus" → "Fable"). Deliberately`. `button-state.js` is shipped styleguide source (imported by `button.js`, bundled into `dashboard/dist` by esbuild), so two real Agentheim model names now live inside the styleguide, which the task explicitly forbids ("the model list arrives as `options`" — the styleguide must never learn Agentheim's models). Everything else about the component is correctly body-agnostic: props, canvas specimens (`Alpha`/`Beta`/`Gamma`), and the README.
- The worker's own guard test for this criterion is scoped too narrowly to catch it: `styleguide/test/model-split-button.test.mjs:187-191` (`test('no Agentheim-specific model names appear anywhere in the styleguide')`) asserts only against `buttonSrc` and `appSrc`, never `button-state.js` — the one file that leaks — and its regex `/\b(Opus|Haiku|Sonnet|Claude)\b/` omits `Fable` entirely. A test named after the criterion that cannot fail on the criterion's actual violation is not coverage of it.
- Same file, line 78: `assert.equal(widestOptionLength(['Opus', 'Haiku', 'Sonnet', 'Fable']), 6, …)` uses the real model list as fixture data inside `styleguide/test/`, where neutral placeholders (as used everywhere else in this diff) are the correct choice.

**Everything else audited CLEAN and must be preserved on the fix pass** — do not redo or regress it: full suite green at 1237/1237 (1214 baseline + 23 genuinely new tests, independently recounted, `TESTS_ADDED: 23` is honest); `ModelSplitButton` exported from `button.js` with `EnterButton` untouched and still exported; the click-region split is two real `<button>`s in one ochre group; `locked` renders caret+menu genuinely absent (not disabled); `disabled` forwards the real attribute on both regions at 0.55 opacity; keyboard/ARIA all match the ACs (no trap, Escape refocuses the caret); zero hex literals (all `var(--accent-ochre)` / `--surface-*` / `--hairline`); scope clean; BC README correct; `button-state.js` is a justified extraction consistent with the established `collapsible-state` / `menu-state` / `search-state` pattern, not scope creep. ADR-0003 / 0048 / 0051 all honored.

**SUGGESTED_FIX:** Rewrite the `widestOptionLength` JSDoc in `styleguide/app/button-state.js` to use neutral placeholders (e.g. `"Alpha" → "Gamma"`), swap the real model list at `model-split-button.test.mjs:78` for placeholders, and widen the existing "no Agentheim-specific model names" guard to scan `button-state.js` (and its own source) with a regex that includes `Fable`, so the guard actually fails on this criterion's violation.

**ITERATION_HINT:** likely-fixable
