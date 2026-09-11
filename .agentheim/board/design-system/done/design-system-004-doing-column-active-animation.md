---
id: design-system-004
title: Animated "actively working" treatment for doing-column tickets
status: done
type: feature
context: design-system
created: 2026-06-08
completed: 2026-06-09
commit: 86711f0
depends_on: [design-system-001]
blocks: []
tags: [captured, frontend, motion]
related_adrs: [ADR-0014]
related_research: []
prior_art: []
---

## Why
A ticket sitting in the **doing** column should read, at a glance, as *actively being
worked on* — the doing column should feel alive, not just another static pile. Today the
only signal is the ochre `--st-doing` rail color, which is indistinguishable in
"liveness" from the static backlog/todo/done rails.

## What
Give doing-status ticket cards a **calm ambient pulse** — a slow, low-amplitude
"breathing" glow on the existing ochre status rail/border (decided: calm, not a loud
rotating/glowing background). It reads as "alive" in peripheral vision but never demands
attention, extending the styleguide's *"quiet by default, color used only to signal
status"* law rather than breaking it.

The treatment is **status-driven**: every card whose `status === "doing"` pulses,
independent of the `agent` field. (The dashboard reads disk state via `/api/tree` — it
knows a card is in `doing/`, not whether a worker process is live this second — so
"in the doing column" *is* the honest signal for "actively worked.")

It lives in the **styleguide single source** — the `TicketCard` component in
`styleguide/app/kanban.js`. The dashboard imports `TicketCard` **as-is, no fork**
(`dashboard/app/board.js:37`, ADR-0003), so the pulse appears on the live dashboard
board with **no dashboard-side change**. One place to build, both surfaces get it.

## Acceptance criteria
- [ ] In the styleguide `TicketCard` (`styleguide/app/kanban.js`), a card with
      `status === "doing"` renders a continuous, looping, low-amplitude ambient
      animation on its status rail/border; a card of any other status renders no
      animation.
- [ ] The treatment is keyed strictly off `ticket.status === "doing"` — **not** the
      `agent` field. Every doing card animates whether or not it carries an agent.
- [ ] The animation is **ochre-only**: it draws solely from the existing `--st-doing`
      status color family (incl. `--st-doing-tint`) and introduces no new hue —
      "color used only to signal status" still holds.
- [ ] The loop timing is expressed as a **motion token** (e.g. `--duration-ambient`)
      added to the motion block in `styleguide/styles/colors_and_type.css` beside
      `--ease-base` / `--duration-fast` / `--duration-base` — not a magic number inline.
- [ ] Under `@media (prefers-reduced-motion: reduce)` the animation is **fully
      suppressed** — the doing card falls back to the ordinary card with its normal
      ochre rail (no looping, and no residual static glow is added). The pulse is a
      pure progressive enhancement.
- [ ] No change is required in `dashboard/app/board.js` or any dashboard module for the
      pulse to appear on the live board's doing column (verified by the dashboard
      consuming the unforked `TicketCard`).
- [ ] The styleguide canvas (`styleguide/index.html`, kanban section) shows at least one
      doing card so the new state is visible and reviewable for the styleguide gate.
- [ ] A test asserts a doing card carries the animation hook (keyframes/class/animation
      reference) and a non-doing card does not, and that a reduced-motion guard exists.
      The existing styleguide and dashboard test suites stay green.

## Notes
Refined via `modeling` (Interrogator) on 2026-06-09. Three forks cornered with the
builder:

1. **Intensity** → **calm ambient pulse**, not the capture's literal "rotating/glowing
   background." Keeps the styleguide's quiet-by-default law intact; the loud option was
   explicitly declined.
2. **Scope** → **all doing-status cards** (status-driven), not gated on a live-agent
   marker. The `/api/tree` projection cannot truthfully know a worker is live this
   second; status-in-`doing/` is the honest proxy.
3. **Reduced-motion** → **plain card** (ordinary ochre rail), no static-glow fallback.
   Motion is enhancement-only; the existing rail color still conveys "doing."

**Placement is settled, not open:** the treatment goes in the styleguide `TicketCard`
(`styleguide/app/kanban.js`); the dashboard inherits it via the unforked import
(`board.js:37`, ADR-0003). Do not add a dashboard-side card variant.

**Worker settles during TDD (implementation, not scope):**
- The exact pulse mechanism — animated `box-shadow`/glow on the rail vs. opacity/brightness
  breathing on the rail span vs. a border-glow keyframe. Pick the one that reads calmly and
  is cheap to run continuously. (The rail is the `position:absolute` left span in the `rail`
  variant; the `badge` variant has no rail — decide whether the pulse rides the card border
  there, or whether doing cards are always shown rail-variant in practice.)
- The token value for `--duration-ambient` (a slow loop — order of ~2–3s — chosen to read
  as "breathing," not "blinking").
- Whether to express the loop as `@keyframes` (the styleguide has **none** today — this is
  the first) or a CSS transition trick; `@keyframes` is the natural fit for a loop.

**ADR deliverable (worker writes it):** this introduces the first *continuous/ambient*
animation in a system that was transition-only, the first loop motion token, and a small
design-language extension — **ambient motion may signal active status** (motion, not just
hue, now carries a status signal). Record it as a short ADR in
`.agentheim/knowledge/decisions/` capturing: the motion-as-status-signal principle, the
`--duration-ambient` token, and the reduced-motion-strips-to-plain-card contract. Add the
ADR id to this task's `related_adrs` and the task id to the ADR's `related_tasks`
(bidirectional link).

**Styleguide gate:** `depends_on: [design-system-001]` per the styleguide gate; the gate is
**OPEN** (re-approved 2026-06-06), so this is promotable. Editing the gated styleguide
source/canvas lightly reopens the gate — the builder reviews the doing-card state on the
canvas before this is considered done.

## Outcome

Doing-status ticket cards now carry a **calm ambient pulse** — a slow,
low-amplitude breathing glow on the ochre status rail — so the doing column reads
as *actively worked* at a glance. The system's first continuous animation /
first `@keyframes` / first loop motion token, and a small design-language
extension recorded in **ADR-0014** (*ambient motion may signal active status*).

- **Mechanism:** `@keyframes ambient-rail-pulse` (opacity 0.9→0.62→0.9 + a soft
  `--st-doing` `box-shadow` glow) on `.ticket-rail--pulse`, in
  `styleguide/styles/agentheim.css`. Ochre-only, no new hue.
- **Token:** `--duration-ambient: 2600ms` in the motion block of
  `styleguide/styles/colors_and_type.css`.
- **Status-keyed:** `doingPulseClass(status)` in `styleguide/app/motion.js`
  (re-exported from `app/kanban.js`); the `TicketCard` rail span gets the class
  iff `status === "doing"` — independent of the `agent` field.
- **Single source (ADR-0003):** `dashboard/app/board.js` imports `TicketCard`
  unforked, so the pulse reaches the live board with **zero dashboard-side
  change** (verified by reading the import, not editing dashboard/).
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` fully strips the
  pulse to a plain ochre rail — pure progressive enhancement.
- **Canvas:** section 06 (Ticket card) gains an explicit "Doing — ambient pulse ·
  vs. static" row (doing card beside a non-doing card) for the gate review; the
  live board in section 05 already renders doing cards.
- **Tests:** `styleguide/test/doing-pulse.test.mjs` (5 tests, `node --test`) —
  asserts the pulse class is status-keyed and agent-independent, the
  `--duration-ambient` token exists, the keyframes/class are ochre-only and use
  the token, and a `prefers-reduced-motion` guard sets `animation: none`. Both the
  styleguide (5) and dashboard (171) suites are green.

**Gate:** editing the gated styleguide source/canvas lightly reopens the gate —
the builder reviews the doing-card state on canvas sections 05/06.

**Rebuild note:** the served dashboard `dist/` is a derived artifact (ADR-0003);
it must be rebuilt to show the pulse on the live board. Rebuild deliberately NOT
done here (a parallel sibling owns `dashboard/` this wave).

See ADR-0014 (`.agentheim/knowledge/decisions/0014-ambient-motion-signals-active-status.md`).
