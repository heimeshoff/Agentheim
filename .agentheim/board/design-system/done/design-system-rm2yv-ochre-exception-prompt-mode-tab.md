---
id: design-system-rm2yv
title: Extend the ochre wayfinding exception to the highlighted prompt-mode tab
status: done
type: decision
context: design-system
created: 2026-07-05
completed: 2026-07-05
depends_on: [design-system-vw12e]
blocks: [agentic-workflow-bz3az]
tags: [dashboard-redesign, accent, adr, color-law]
related_adrs: [0016, 0048, 0050, 0051]
related_research: []
prior_art: [design-system-vw12e, design-system-007, design-system-010]
---

## Why
ADR-0048 (design-system-vw12e) applied a discriminating test to five tension surfaces:
ochre is permitted for a **primed primary action** (fires/commits/armed) and for the **single
primary-navigation active item** (a bounded wayfinding exception), and **forbidden for passive
equivalent-state selection**. It placed the **highlighted prompt-mode tab** on the *forbidden*
side — de-emphasis per ADR-0016, no ochre.

The builder has since decided (2026-07-05) that the highlighted prompt-mode tab **should** carry
the ochre treatment — the same taste that kept the 1a ochre inset rail on the nav active item.
This directly reopens ADR-0048's classification of that one surface, so it must be recorded as a
bounded amendment, not smuggled into the [[agentic-workflow-bz3az]] build's acceptance criteria —
otherwise a future reader hits ADR-0048 saying "ochre forbidden here" while the code paints it
ochre (the "decisions get made and lost" failure the vision rails against).

This decision is **paint-only**. The prompt bar's *interaction* model (single committed
`highlightedMode`, keyboard cycling, disjoint key-intent) is settled by ADR-0050 and is untouched
here — ADR-0050 was interaction-only and explicitly deferred the paint question to ADR-0048's
ownership. This task owns exactly the paint half.

## What
Write an ADR (provisional ADR-0051) that **amends ADR-0048** — refining, not superseding — to add
the **highlighted prompt-mode tab** as a **second bounded wayfinding surface** alongside the
left-nav active item, permitted to carry ochre. Keep the discriminating test intact: the exception
list is now *two named surfaces* (primary-nav active item; highlighted prompt-mode tab), NOT a
general reopening of ADR-0016's "selection among peers is de-emphasis" default.

## Acceptance criteria
- [ ] ADR amends ADR-0048 (not ADR-0016 directly), explicitly adding the highlighted prompt-mode
      tab to the bounded wayfinding-exception set and stating why this surface is treated like the
      nav active item (a persistent "you are here / this fires on Ctrl+Enter" wayfinding mark) rather
      than ordinary peer selection.
- [ ] ADR states the boundary just as sharply as ADR-0048 did: the exception is these **two**
      enumerated surfaces only; it must not be citable to justify ochre on arbitrary
      equivalent-state selection elsewhere (segmented controls, theme toggle, sort/group chips, etc.).
- [ ] ADR reconciles with ADR-0050's Out-of-scope note (which recorded the tab as ochre-forbidden
      via ADR-0048): ADR-0050's interaction model is untouched; only ADR-0048's paint classification
      of this surface changes. No new interaction invariant is introduced.
- [ ] The three de-emphasized (non-highlighted) tabs and the ochre-permitted Enter button are named
      as the surrounding treatment, so the downstream build ([[agentic-workflow-bz3az]]) has an
      unambiguous paint contract: highlighted tab = ochre; other three tabs = de-emphasis; Enter
      button = ochre (already licensed as a primed primary action by ADR-0048).
- [ ] ADR-0048 gets a one-line "see ADR-0051" pointer under its Consequences; its own text and
      status are left untouched (same courtesy ADR-0048 paid ADR-0016).
- [ ] Whether a named token is warranted (e.g. reusing the existing `--accent-ochre` /
      `--accent-ochre-soft`, or the nav rail's `inset … var(--accent-ochre)` idiom) is decided and
      stated; no raw `rgba(...)`. If a new token is needed, the ADR names it for the palette owner,
      mirroring how ADR-0048 named `--emphasis-border` for design-system-a31e0.

## Notes
- Precedent for the bounded-exception shape: ADR-0048's own left-nav active-item carve-out
  (`inset 2px 0 0 var(--accent-ochre)`), and vw12e's Notes documenting the builder overriding the
  architect's de-emphasis default in favour of the orange rail. This is the *same move* for a
  *second* surface — extend the list, keep the fence.
- Reserved-accent discipline it must NOT erode: design-system-007 (theme toggle selects by
  de-emphasis), design-system-010 (dropped the ochre selected-ring). Those stay de-emphasis.
- Output is an ADR only — no CSS/token file change here (a palette token, if the ADR calls for one,
  is a separate design-system follow-up like a31e0 was for `--emphasis-border`).

## Outcome

Wrote provisional **ADR-0051** (`.agentheim/knowledge/decisions/0051-ochre-wayfinding-exception-extends-to-highlighted-prompt-mode-tab.md`),
amending ADR-0048 (not superseding, not touching ADR-0016 or ADR-0050 directly). The bounded
wayfinding-exception set grows from one surface (primary-nav active item) to two, adding the
highlighted prompt-mode tab, on the same "persistent you-are-here wayfinding mark" rationale as
the nav rail. The exception is stated as exactly these two enumerated surfaces — not a general
reopening of ADR-0016's de-emphasis default — so it cannot be cited for segmented controls, the
theme toggle, sort/group chips, or other peer-selection surfaces (design-system-007 and
design-system-010 stay correctly decided).

Reconciled explicitly with ADR-0050: its interaction model (committed `highlightedMode`, keyboard
cycling, disjoint key-intent) is untouched; only the paint classification its Out-of-scope note
deferred to ADR-0048 changes, from "ochre forbidden" to "ochre permitted." No new interaction
invariant introduced.

Recorded the full downstream paint contract for `agentic-workflow-bz3az`: highlighted tab = ochre
(via `--accent-ochre`, no new token — the nav rail's direct-reuse idiom, not a tunable
`--emphasis-border`-style allowance); the other three tabs = de-emphasis (ADR-0016 default,
unchanged); Enter button = ochre (already licensed by ADR-0048 as a primed primary action).

Added a one-line "see ADR-0051" pointer under ADR-0048's Consequences; ADR-0048's own text and
`status: proposed` are otherwise untouched. No CSS/token file touched — this is an ADR-only
decision task, per its own instruction; a token/value follow-up (if the concrete tab styling needs
one) is left as a separate design-system task, mirroring how a31e0 followed vw12e/ADR-0048. No BC
README change made — the README does not currently document the nav-rail exception as ubiquitous
language either, so extending it there would be a "while I'm here" scope addition, not something
this task's ADR-only output warrants.

Key files:
- `C:\src\heimeshoff\agentic\agentheim\.worktrees\design-system-rm2yv\.agentheim\knowledge\decisions\0051-ochre-wayfinding-exception-extends-to-highlighted-prompt-mode-tab.md`
- `C:\src\heimeshoff\agentic\agentheim\.worktrees\design-system-rm2yv\.agentheim\knowledge\decisions\0048-accent-carveout-primed-primary-action-not-passive-selection.md`
</content>
</invoke>
