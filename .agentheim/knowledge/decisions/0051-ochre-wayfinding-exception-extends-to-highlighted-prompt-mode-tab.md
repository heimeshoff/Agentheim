---
id: ADR-0051
title: Ochre wayfinding exception extends to the highlighted prompt-mode tab
scope: design-system
status: proposed
date: 2026-07-05
related_tasks: [design-system-rm2yv]
related_adrs: [ADR-0048, ADR-0016, ADR-0050]
---

# ADR-0051: Ochre wayfinding exception extends to the highlighted prompt-mode tab

## Context

ADR-0048 applied a discriminating test — *does the surface fire/commit, or
record a passive equivalent-state?* — to five tension surfaces raised by the
dashboard "Command deck" redesign. It classified the **highlighted
prompt-mode tab** (surface 3: one of Quick Capture / Modeling / Inquire /
Research, per ADR-0050) as passive equivalent-state selection and therefore
**ochre-forbidden**, de-emphasis per ADR-0016. Separately, ADR-0048 classified
the **left-nav active item** (surface 5) the same way by the test — also
passive equivalent-state selection — yet permitted ochre there anyway, as a
**bounded, single-surface wayfinding exception**, explicitly scoped so it
could not be cited to justify ochre anywhere else.

The builder has since decided (2026-07-05) that the highlighted prompt-mode
tab should carry the same ochre treatment as the nav rail. This is the same
kind of override the nav rail already received, on the same grounds: the
highlighted tab is not an ordinary in-page selection choice made once and
forgotten — it is a persistent "you are here, and this is what Ctrl+Enter
will fire" mark, looked at repeatedly while the operator decides what to type
and whether to commit it. That is closer in kind to primary-nav wayfinding
than to a segmented control or a list-item selection, which is why ADR-0048's
own nav-rail carve-out is the right precedent to extend, rather than a
wholesale reopening of ADR-0016's de-emphasis default.

This ADR **amends ADR-0048**, refining its exception set from one surface to
two. It does not touch ADR-0016 (which ADR-0048 already amended once) and it
does not reopen or restate ADR-0050. ADR-0050 is interaction-only: it defines
the committed `highlightedMode` index, keyboard cycling, and disjoint
key-intent classification for the four prompt modes, and explicitly deferred
the paint question to ADR-0048's ownership. That deferral resolved, at the
time ADR-0050 was written, to "ochre forbidden, via ADR-0048." This ADR
changes only what that pointer resolves to — the paint classification of one
named surface — and introduces no new interaction invariant. ADR-0050's four
invariants (exactly-one-highlighted, index-in-range, deterministic
wraparound, disjoint key-intent) stand exactly as written.

## Decision

**ADR-0048's discriminating test is unchanged.** What changes is the bounded
wayfinding exception carved out alongside it: it now names **two** surfaces,
not one.

1. **Primary-nav active item** (ADR-0048 surface 5) — unchanged: ochre via
   `inset 2px 0 0 var(--accent-ochre)`.
2. **Highlighted prompt-mode tab** (ADR-0048 surface 3) — **newly added.**
   By the fires/commits test alone this remains passive equivalent-state
   selection (choosing Quick Capture over Modeling over Inquire over Research
   does not itself fire anything) and would be forbidden, exactly as ADR-0048
   originally concluded. It is added to the exception set for the same reason
   as the nav rail: it is a persistent, repeatedly-consulted "you are here /
   this is what will fire" wayfinding mark, not a one-off equivalent-state
   choice, and the builder judged the same stronger cue worth the same kind
   of one-time exception.

**The exception set is exactly these two enumerated surfaces — no more.** It
remains, as ADR-0048 stated of the nav rail alone, a bounded, non-precedential
carve-out: it may **not** be cited to justify ochre on segmented controls, the
theme toggle, sort/group chips, list-item selection, or any other
equivalent-state peer-selection surface. Each of those stays governed by
ADR-0016's de-emphasis default (reinforced by design-system-007 and
design-system-010, both of which remain correctly decided and untouched by
this ADR). A third surface wanting the same treatment needs its own ADR
amendment, on its own wayfinding argument — this ADR does not generalize the
test itself, it only lengthens the enumerated list by one.

### Paint contract for the prompt bar (for the downstream build)

Combining this ADR's tab classification with ADR-0048's existing Enter-button
classification gives the prompt bar's complete paint contract:

- **Highlighted prompt-mode tab** (1 of 4) — ochre permitted, via the
  wayfinding exception established here.
- **The other three (non-highlighted) prompt-mode tabs** — de-emphasis
  (dimmed), per ADR-0016's unchanged default. Not touched by this ADR.
- **Prompt Enter button** — ochre permitted, already licensed by ADR-0048
  surface 2 as a primed/armed-to-fire primary action. Not touched by this
  ADR; restated here only so the four-tabs-plus-button surface has one place
  that states the whole contract.

### Token

Reuse `--accent-ochre` directly, in the same form as the nav rail's inset
idiom where applicable (e.g. `inset 2px 0 0 var(--accent-ochre)` or an
equivalent ochre fill/underline consistent with however the tab is already
painted). No new token is warranted: the highlighted tab is the same kind of
allowance as the nav rail (a direct wayfinding use of the accent, not a
tunable emphasis border like ADR-0048's `--emphasis-border`), so it should
track the same token rather than fork a new one. If the concrete tab styling
needs a value not expressible via `--accent-ochre` alone, naming and adding
that value is a separate design-system follow-up (mirroring how ADR-0048
named `--emphasis-border` for design-system-a31e0) — no CSS or token file is
added or changed by this ADR.

## Consequences

- ADR-0048's discriminating test (fires/commits → ochre permitted; passive
  equivalent-state → de-emphasis) stands unchanged.
- ADR-0048's bounded wayfinding exception now names **two** surfaces instead
  of one: the primary-nav active item, and the highlighted prompt-mode tab.
  Both are direct uses of `--accent-ochre`, both scoped as
  non-precedential one-off wayfinding allowances.
- ADR-0016's de-emphasis default stands unchanged for every other
  equivalent-state selection surface (segmented controls, theme toggle,
  sort/group chips, list-item selection, and the three non-highlighted
  prompt-mode tabs).
- ADR-0050's interaction model (committed `highlightedMode`, keyboard
  cycling, disjoint key-intent) is untouched; its Out-of-scope note's pointer
  to ADR-0048 for the paint question now resolves, via this ADR, to "ochre
  permitted" rather than "ochre forbidden." No interaction invariant changes.
- The prompt bar's complete paint contract for the downstream build
  ([[agentic-workflow-bz3az]]): highlighted tab = ochre; other three tabs =
  de-emphasis; Enter button = ochre.
- Future ochre-on-selection proposals must satisfy the fires/commits test or
  cite a fresh, scoped ADR — this exception set (now two surfaces) may not be
  cited as general precedent for a third.
- ADR-0048 gets a one-line pointer to this ADR under its Consequences; its
  own text and `status: proposed` are otherwise untouched.
