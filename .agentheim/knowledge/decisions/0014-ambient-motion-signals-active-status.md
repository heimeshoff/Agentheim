---
id: ADR-0014
title: Ambient motion may signal active status — the doing-card pulse
scope: design-system
status: accepted
date: 2026-06-09
related_tasks: [design-system-004]
---

# ADR-0014: Ambient motion may signal active status — the doing-card pulse

## Context

The styleguide's visual law is *"quiet by default; color is used only to signal
**ticket status** and **content type**."* Until now, status was carried by **hue
alone** — each status has an `--st-*` rail/chip color — and **all motion in the
system was transition-only**: short, event-triggered eases (`--duration-fast` /
`--duration-base`) on hover, theme flip, drawer open. There were **no
`@keyframes`** anywhere; nothing looped.

This left a gap. A ticket in the **doing** column should read, at a glance, as
*actively being worked on*. But the doing rail's ochre (`--st-doing`) is, in
"liveness," indistinguishable from the static backlog/todo/done rails — the
doing column looks like just another static pile. `design-system-004` asked for
a treatment that makes "in the doing column" legible as *alive*.

The honest signal is **status**, not a live-process marker. The dashboard reads
disk state via `/api/tree` — it knows which lifecycle folder a task sits in, not
whether a worker process is running this second. So `status === "doing"` ("in the
`doing/` folder") *is* the truthful proxy for actively-worked, and the treatment
keys off it — never off the `agent` field.

Two forks were settled during refinement: **intensity** → a *calm* pulse, not a
loud rotating/glowing background (the loud option was explicitly declined);
**reduced-motion** → strip to a *plain* card, no static-glow fallback.

## Decision

**Ambient (continuous, looping) motion is now an admissible status signal** — a
deliberate, scoped extension of the visual law. Motion, not just hue, may carry a
status signal, *provided it stays quiet*: low amplitude, slow cadence, and drawing
**only** from the status's existing color family (no new hue). This is the
system's **first continuous animation** and its **first `@keyframes`**.

Concretely, the doing-card treatment:

1. **A breathing glow on the ochre status rail.** `@keyframes ambient-rail-pulse`
   (in `styles/agentheim.css`, beside the status palette it draws from) animates
   the rail's `opacity` (0.9 → 0.62 → 0.9) and a soft `box-shadow` glow that
   `color-mix`es **`--st-doing`** in and out. Opacity + box-shadow only — cheap to
   composite continuously. **Ochre-only:** no hue outside the doing status family
   is introduced, so "color used only to signal status" still holds. **(Stale as
   of the amendment below, design-system-pk4qd — the mechanism this point
   describes was replaced; the box-shadow is no longer inside the keyframes.)**

2. **The first loop motion token — `--duration-ambient`.** Added to the motion
   block in `styles/colors_and_type.css` beside `--ease-base` /`--duration-fast`
   / `--duration-base`, value `2600ms` — a slow "breathing" cadence chosen to read
   as alive in peripheral vision, never as a blink. The cadence is a token, not a
   magic inline number; transition durations and the ambient loop now live in one
   motion vocabulary.

3. **Status-keyed in one place.** A framework-free helper
   `doingPulseClass(status)` (`app/motion.js`, re-exported from `app/kanban.js`)
   returns `"ticket-rail--pulse"` iff `status === "doing"`, else `""`. The
   styleguide `TicketCard` puts that class on the rail span. **Single source
   (ADR-0003):** the dashboard imports `TicketCard` unforked
   (`dashboard/app/board.js`), so the pulse appears on the live board's doing
   column with **zero dashboard-side change**.

4. **Reduced-motion strips to a plain card.** Under
   `@media (prefers-reduced-motion: reduce)` the `.ticket-rail--pulse` rule is
   fully suppressed — `animation: none`, no residual `box-shadow` glow, rail back
   to its normal ochre at opacity 0.9. The pulse is **pure progressive
   enhancement**: the rail *color* still conveys "doing," so nothing is lost. This
   is the standing contract for any future ambient motion — **ambient motion is
   always strippable to a static, still-legible baseline.**

**Scope guard.** The pulse rides the **rail** variant only (the `badge` variant
has no rail). In practice doing cards render rail-variant on both the canvas and
the dashboard board, so this covers every live surface; a doing *badge* card
(used only as a documentation alternative in the styleguide) shows no pulse, by
design — extending it there is out of scope until a surface needs it.

## Consequences

**Positive**
- The doing column reads as alive at a glance without breaking the quiet-by-default
  law: low amplitude, ochre-only, slow cadence.
- One place to build (the styleguide `TicketCard`), both surfaces (canvas +
  dashboard) inherit it — no dashboard fork.
- Establishes a reusable, named ambient-motion vocabulary: the `--duration-ambient`
  token and the strip-to-plain reduced-motion contract for any future ambient cue.

**Negative / cost**
- The visual law now admits *motion* as a status channel, not just hue — a small
  but real widening of the language. Future ambient motion must clear the same bar
  (quiet, palette-only, strippable) or it erodes the law.
- The committed dashboard `dist/` is a derived artifact (ADR-0003) and must be
  **rebuilt** for the live board to show the pulse; the styleguide source change
  alone does not update the served bundle. (Rebuild owned by infrastructure's
  build pipeline, not by this task.)
- Editing the gated styleguide source/canvas lightly **reopens the styleguide
  gate** — the builder re-reviews the doing-card state on the canvas (section 06 +
  the live board in 05) before this is final.

**Neutral**
- ~~`box-shadow`/`opacity` keyframes are compositor-friendly; the continuous animation
  is effectively free on the GPU and pauses when the tab is backgrounded.~~ **Retracted
  (amendment below, design-system-pk4qd):** only the opacity half was ever true. The
  animation still pauses when the tab is backgrounded.

## Alternatives considered

- **Loud rotating / glowing background** (the original capture's literal ask).
  Rejected at refinement: it shouts, breaking quiet-by-default.
- **Gate on a live-`agent` marker** instead of status. Rejected: `/api/tree` cannot
  truthfully know a worker is live this second; status-in-`doing/` is the honest
  proxy.
- **Reduced-motion → static glow** (a dimmed non-animated halo). Rejected: motion
  is enhancement-only and the rail color already conveys "doing"; a residual glow
  would add a second always-on signal for no gain.
- **CSS transition trick instead of `@keyframes`.** Rejected: a loop is what's
  wanted; `@keyframes` is the natural, legible fit (and the system's first).

## Compositor-only is the third clause of the ambient-motion contract (amendment, design-system-pk4qd, 2026-09-05)

Two artifacts asserted a property the doing-pulse's CSS did not actually have: Decision
point 1's mechanism sentence, and the Consequences→Neutral bullet claiming the continuous
animation was "effectively free on the GPU." Both described `box-shadow` as declared
*inside* `@keyframes ambient-rail-pulse`, re-evaluating a `color-mix()` per step. That is
a paint property, not a compositor-only one — the browser must repaint every frame, for
the life of the tab, on every doing card carrying the class. `design-system-pk4qd` found
this while investigating the resource-waste finding in `agentic-workflow-bmn29`; it also
found the sibling `rail-attention-breathe` (ADR-0029) had the identical defect.

**The mechanism sentence in Decision point 1 and the Neutral bullet above are corrected by
this amendment, not by editing the original prose out from under its own history:**
`ambient-rail-pulse` now animates the rail's `opacity` only (0.9 → 0.62 → 0.9). The soft
`box-shadow` glow is painted ONCE, at its peak value, on a separate pre-painted glow layer
(`.ticket-rail--pulse::after`) whose OWN opacity breathes in a second keyframes block
(`ambient-rail-glow`) — the rail's animated opacity multiplies the glow layer exactly as it
previously multiplied the shadow, so the composited alpha at every point in the loop is
unchanged. Reduced motion now removes the glow layer outright (`content: none`), not
merely its animation, so no residual static halo can survive — the pulse still strips to
NOTHING, per this ADR's original reduced-motion contract.

**The cheapness claim was only ever half true.** `opacity`/`transform` keyframes composite
for free; `box-shadow` does not, regardless of what else rides in the same keyframes block.
The "pauses when the tab is backgrounded" half of the retracted Neutral bullet is broadly
correct and stands.

**This discovery adds a third clause to the ambient-motion contract, standing beside the
two ADR-0014 already established (quiet; strippable to a still-legible baseline) and the
one ADR-0029 added (a signal with no static fallback keeps a steady marker instead of
stripping to nothing):** an ambient cue must also be **compositor-only** — a `@keyframes`
block driven by an `infinite` animation may declare **only** `opacity` / `transform` (and
the transform-family longhands `translate` / `rotate` / `scale`). Any paint property that
is part of the look must be a static declaration, painted once, on a glow layer (or, when
no spare pseudo-element exists to host one, a static declaration on the animated element
itself, multiplied by that element's own opacity — the path this amendment's fix to
`rail-attention-breathe` took, since `::after` on that host was already spoken for by
`design-system-b7n2s`'s hidden-dependency marker).

**The clause was discovered on this cue, not invented for it.** `rel-ring-breathe`,
`rel-present-breathe` and `rel-edge-blink-breathe` (ADR-0034 / `design-system-b7n2s`) were
already compositor-only from the start — they are the pattern the two corrected cues now
match, and no changes were needed to their record.

**Enforced by `styleguide/test/ambient-motion-compositor.test.mjs`** (per ADR-0059's
mechanize-or-drop doctrine): it resolves every `@keyframes` block referenced by an
`infinite` animation across `styleguide/styles/*.css` and fails if any of its declared
properties fall outside the allowlist `{opacity, transform, translate, rotate, scale}` —
an allowlist, not a denylist, so the next paint property someone reaches for is caught by
default rather than by enumeration. It also fails structurally green: zero `infinite`
animations found, or any referenced name that doesn't resolve to a defined `@keyframes`
block, is itself a failure.

See `design-system-pk4qd`, ADR-0029 (its Decision point 1 gains a matching one-line
footnote), ADR-0059 (mechanize-or-drop), ADR-0061 (falsifiability gate — the visual-parity
criteria on this fix are marked `[human-eye]`).
