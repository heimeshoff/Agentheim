---
id: ADR-0048
title: Accent carve-out — ochre marks the primed primary action, not passive selection
scope: design-system
status: proposed
date: 2026-07-05
related_tasks: [design-system-vw12e]
related_adrs: [ADR-0016]
---

# ADR-0048: Accent carve-out — ochre marks the primed primary action, not passive selection

## Context

ADR-0016 reserves the accent (ochre) for status/focus and settles, as a general
rule, that *selection among peers* is signalled by de-emphasis (dimming the
unselected options), never by the accent — reinforced since by design-system-007
(theme toggle), design-system-010 (dropped the TicketCard's ochre selected ring),
and design-system-016 (the sanctioned exception: `--accent-ochre` on the search
field's *focus* ring).

The dashboard redesign's chosen palette direction (builder's "Command deck," 1b)
puts ochre on several new surfaces, and it isn't obvious from ADR-0016's text
alone which of them are consistent with "de-emphasis for selection" and which
are a different kind of signal entirely:

1. The **What's-next CTA** — the button that fires the "what's next" action.
2. The **prompt Enter button** — the control that submits/commits the prompt.
3. The **highlighted prompt-mode tab** — one of several peer modes (e.g. Ask /
   Build / Plan) shown as currently active.
4. The **flight-plan step-2 hero border** — a border treatment emphasising one
   step of the What's-next flight plan.
5. The **left-nav active item** — the single highlighted row in primary
   navigation, marking "you are here."

Without a discriminating rule, each of these reads as "selection among peers"
on its face, and ADR-0016 would forbid ochre on all five. But surfaces 1–2 are
not selection at all — they are actions about to fire — and surface 5 was
explicitly overridden by the builder in favour of an ochre inset rail
(2026-07-05), which needs a bounded, stated exception rather than a silent
contradiction of ADR-0016. This ADR does not reopen ADR-0016's general rule; it
refines it with a test that resolves all five surfaces and draws the
exception's boundary explicitly.

Note: the palette this ADR's surfaces are drawn from ("Command deck") is
governed by the Command-deck palette identity (ADR-0049, sibling decision) —
this ADR is scoped to *accent usage*, not palette identity, and does not
depend on or restate ADR-0049's content.

## Decision

**The discriminating test: does the surface fire/commit, or does it record a
passive equivalent-state?**

- **Fires / commits / is armed-to-fire** → ochre is permitted. This is a
  surface whose entire job is to be activated — pressing it (or the thing it
  represents becoming imminent) causes something to happen. The accent here is
  consistent with ADR-0014's ochre-only status-motion precedent and
  design-system-016's focus-ring precedent: ochre signals "this is live /
  about to act," not "this is the chosen one among equals."
- **Records a passive equivalent-state** (marks one of several peers as the
  current selection, with no imminent action implied) → ochre is **forbidden**;
  selection is signalled by de-emphasis, per ADR-0016.

Applied to the five tension surfaces:

1. **What's-next CTA** — **fires.** Pressing it commits to the next action. Ochre
   permitted.
2. **Prompt Enter button** — **commits.** Submitting the prompt is the
   button's entire purpose; it is armed-to-fire the moment there's a prompt to
   send. Ochre permitted.
3. **Highlighted prompt-mode tab** — **passive equivalent-state selection.**
   Choosing "Ask" over "Build" over "Plan" does not itself fire anything; it
   marks which of several peer modes is current, exactly the case ADR-0016
   already covers. Ochre **forbidden** — de-emphasis (dim the unselected tabs)
   per ADR-0016.
4. **Flight-plan step-2 hero border** — **a bounded emphasis allowance, not a
   selection cue.** The step-2 border does not mark "the selected step among
   peers" — it draws the eye to the one step in the flight plan that is
   currently primed to run next (functionally closer to "armed-to-fire" than to
   passive selection, since the flight plan advances step-by-step and step 2 is
   next-up). Ochre is permitted here, but **only via a single named token**,
   never a raw `rgba(...)` — see Token below. This keeps the allowance
   auditable and non-precedential: a future "highlight the current item in a
   list" ask must satisfy the fires/commits test on its own, not point at this
   border as prior art for arbitrary emphasis.
5. **Left-nav active item** — **passive equivalent-state selection, and yet
   ochre is permitted here as a bounded exception.** The nav rail marks which
   of several peer sections is current — by the fires/commits test alone this
   would be forbidden, same as the prompt-mode tab. The builder overrode this
   default (2026-07-05) in favour of 1a's ochre inset rail
   (`inset 2px 0 0 var(--accent-ochre)`) for **wayfinding**: primary navigation
   is looked at far more often and far more peripherally than an in-page tab
   group, and a stronger, always-legible "you are here" cue was judged worth
   the one-time exception. **This exception is scoped to exactly one surface —
   the single primary-navigation active item — and does not reopen ADR-0016
   for any other equivalent-state selection.** It may not be cited to justify
   ochre on the prompt-mode tab, a segmented control, a list-item selection, or
   any other peer-selection surface; each of those stays governed by
   ADR-0016's de-emphasis default and, if a future case wants an exception, it
   needs its own ADR, not this one.

### Token: `--emphasis-border`

The flight-plan step-2 hero-border allowance (surface 4) is specified as a
**named token**, `--emphasis-border`, rather than a raw `rgba(...)` or a reuse
of `--accent-ochre` directly. Naming it separately from `--accent-ochre` keeps
the border's specific value independently tunable (e.g. a softened alpha
suited to a border rather than a fill or ring) without touching the accent
token itself, and gives future audits a single grep target for "where does the
hero-border emphasis come from." This ADR specifies the token **by name and
intent only** — it does **not** define its value or add it to any CSS file.
Adding `--emphasis-border` to both theme blocks (`styles/agentheim.css`) is
the job of the downstream palette task, `design-system-a31e0`.

The left-nav active item (surface 5) uses `--accent-ochre` directly via the
inset-rail form `inset 2px 0 0 var(--accent-ochre)` (per the builder's 1a
resolution) — it does **not** use `--emphasis-border`; the two allowances are
independent and use different tokens deliberately, since the nav rail is an
existing accent use (inset shadow) rather than a border.

## Consequences

- ADR-0016's general rule (selection by de-emphasis, accent reserved) **stands
  unchanged** for the prompt-mode tab and every other peer-selection surface
  not named here.
- Two new, narrow, explicitly-bounded accent allowances exist:
  (a) any surface that fires/commits/is armed-to-fire (What's-next CTA, prompt
  Enter button, and the flight-plan step-2 border read as "next to run") may
  use ochre, generally via `--accent-ochre` for fills/rings/rails or the new
  `--emphasis-border` token for the specific hero-border treatment; and
  (b) the single primary-navigation active item may use `--accent-ochre` as a
  wayfinding exception, and only that one surface.
- Future tasks proposing ochre on a peer-selection surface must satisfy the
  fires/commits test or cite a fresh, scoped ADR — neither the nav-rail
  exception nor the hero-border token may be cited as general precedent for
  ochre-on-selection.
- `design-system-a31e0` (the palette task) is responsible for adding
  `--emphasis-border` to both theme blocks of `styles/agentheim.css`; this ADR
  makes no CSS change.
- ADR-0016 gets a one-line pointer to this ADR (see below); its own text and
  `status: accepted` are otherwise untouched.
- See ADR-0051: the highlighted prompt-mode tab's classification (surface 3
  above) was subsequently amended — it joins the left-nav active item as a
  second bounded wayfinding exception. This ADR's text and status are
  otherwise unchanged by that amendment.
