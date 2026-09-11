---
id: design-system-pk4qd
title: Two ambient cues repaint every frame — ambient-rail-pulse and rail-attention-breathe animate box-shadow inside their keyframes, contradicting the compositor-only claim
status: done
type: bug
context: design-system
created: 2026-09-05
completed: 2026-09-05
depends_on: [design-system-001-styleguide]
blocks: [agentic-workflow-bmn29]
tags: [motion, ambient-signal, keyframes, performance, css]
related_adrs: [0014, 0029, 0059, 0061]
related_research: []
prior_art: [design-system-004, design-system-v8k2p, design-system-w4t9k, design-system-b7n2s]
---

## Why

The design system's ambient-motion contract (ADR-0014, extended by ADR-0029)
has two clauses: an ambient cue stays **quiet** (low amplitude, slow cadence,
palette-only, no new hue) and is **strippable to a still-legible baseline**
under reduced motion. It was assumed to have a third, unstated clause — that a
continuous cue is **cheap**, because it "composites on opacity." Two of the
five ambient keyframes do not honour that assumption: `ambient-rail-pulse`
(the doing-card breathe) and `rail-attention-breathe` (the rail attention dot)
both declare `box-shadow` *inside* the `@keyframes` body, with a `color-mix()`
re-evaluated per step. `box-shadow` is a paint property, not a compositor-only
one, so each of these cues forces a repaint every frame, for the life of the
tab, on every card/row carrying the class. The quiet-by-default law is about
how loud a cue *looks*; nothing in the language said how expensive it is
allowed to be while looking quiet. This task makes **compositor-only** the
third clause of the contract, fixes the two cues that violate it, and ships
the lint that keeps the next ambient signal honest.

The three sibling cues are already correct and are the pattern to copy:
`rel-ring-breathe`, `rel-present-breathe` and `rel-edge-blink-breathe` animate
`opacity` only; their `box-shadow` / `border` sits in a **static** rule outside
the keyframes, painted once. They are also hover-scoped rather than always-on.
**They must not be touched.**

Two artifacts assert a property the code does not have and must be corrected
in this same diff: the CSS comment `"Composited on opacity + box-shadow only
(cheap to run continuously)"` (near `ambient-rail-pulse`, ~line 303) and the
sibling comment `"Composited on a cheap box-shadow + opacity loop"` (near
`rail-attention-breathe`, ~line 349) in
`.agentheim/contexts/design-system/styleguide/styles/agentheim.css`.

## What

Purely a compositing-technique fix. Every design decision — meaning,
mechanism-as-seen, hue, cadence token, amplitude, reduced-motion behaviour per
cue — is preserved exactly. No JS change: `kanban.js`, `motion.js`,
`TreeItem`, `Collapsible` are all untouched; `doingPulseClass` /
`attentionCueClass` keep their exact contracts. The only edited source is
`styleguide/styles/agentheim.css`, plus the new test, the README addition, and
the ADR-0014 amendment.

**1. Doing-card pulse — split into a rail layer and a pre-painted glow layer.**
The rail `<span>` is already `position: absolute; left:0; top:0; bottom:0;
width:3; background: s.color; opacity: 0.9` (inline, `kanban.js` ~line 106),
so it is already a containing block for its own `::after` — **no component
change, no new prop, no markup edit**. The glow layer takes the shadow at its
own fixed value and breathes its opacity; the rail's own animated opacity
multiplies the layer exactly as it previously multiplied the shadow, so the
composited alpha at every point in the loop is unchanged.

```css
@keyframes ambient-rail-pulse {
  0%, 100% { opacity: 0.9; }
  50%      { opacity: 0.62; }
}
@keyframes ambient-rail-glow {
  0%, 100% { opacity: 0; }
  50%      { opacity: 1; }
}

.ticket-rail--pulse {
  animation: ambient-rail-pulse var(--duration-ambient) var(--ease-base) infinite;
  will-change: opacity;
}
/* Pre-painted glow layer: the shadow is painted ONCE at its peak value; only
   this layer's opacity breathes. inset:0 gives it the rail's exact box, so the
   shadow geometry is identical. An outer shadow paints regardless of the
   layer's transparent background, and is clipped to outside the border box —
   so it never covers the rail's own ochre fill. */
.ticket-rail--pulse::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: 0 0 7px 0 color-mix(in oklab, var(--st-doing) 38%, transparent);
  animation: ambient-rail-glow var(--duration-ambient) var(--ease-base) infinite;
  will-change: opacity;
}

@media (prefers-reduced-motion: reduce) {
  .ticket-rail--pulse { animation: none; box-shadow: none; opacity: 0.9; }
  /* The glow layer must be REMOVED, not merely stopped: a stopped layer leaves
     a permanent static halo, which ADR-0014 explicitly rejects — the pulse
     strips to NOTHING. */
  .ticket-rail--pulse::after { content: none; }
}
```

**2. Attention dot — static halo on the existing dot; no second layer is
available.** `.rail-attention::after` is **taken**: design-system-b7n2s puts
the hollow hidden-dependency presence marker there, on the opposite edge of
the same host, specifically so both markers can apply to one header
simultaneously. Pseudo-elements have no pseudo-elements, so there is nowhere
to put a separate glow layer without editing `TreeItem`/`Collapsible` markup —
out of scope for a technique fix. The halo therefore becomes a **static
declaration on the dot itself**; the dot's animated opacity multiplies it, so
the halo still breathes with the dot.

```css
@keyframes rail-attention-breathe {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}

.rail-attention::before {
  /* geometry / background / left offset unchanged */
  box-shadow: 0 0 5px 0 color-mix(in oklab, var(--st-todo) 45%, transparent);
  animation: rail-attention-breathe var(--duration-attention) var(--ease-base) infinite;
  will-change: opacity;
}

/* guard unchanged — box-shadow:none now strips a static declaration instead of
   a keyframe-set one; the rendered steady-marker baseline is identical. */
@media (prefers-reduced-motion: reduce) {
  .rail-attention::before { animation: none; box-shadow: none; opacity: 1; }
}
```

**3. Two honest visual deltas** — name them explicitly; they are the whole
content of the `[human-eye]` bullet below:
- *Doing rail:* today the halo's **blur radius grows** 0 → 7px as it fades in;
  with the fix it fades in at full 7px extent from the start. There is no
  compositor-only equivalent of an animated blur radius. If the eye-check
  finds the "grow" is missed and matters, the compositor-safe restoration is
  two pre-painted layers at different blur radii, cross-faded — still
  opacity-only (see Open questions).
- *Attention dot:* at the trough the halo is now ~`0.55 × 45% ≈ 0.25` alpha
  where today it is exactly `0` — a faint residual halo on a 5px dot. Lever if
  it reads too glowy: drop the static mix from `45%` toward `30–38%` (see Open
  questions).

**4. Third clause of the ambient-motion contract + its lint** (see
mechanize-or-drop below).

**5. Non-goals.** `rel-ring-breathe`, `rel-present-breathe`,
`rel-edge-blink-breathe` and their rules stay byte-identical. No component,
prop, token, hue, or cadence changes. No new duration token.

## Acceptance criteria

- [ ] `@keyframes ambient-rail-pulse` and `@keyframes rail-attention-breathe`
      declare **only** `opacity` (and/or `transform`) inside their step
      bodies — no `box-shadow`, no `color-mix()`, no other paint/layout
      property.
- [ ] A new lint, `styleguide/test/ambient-motion-compositor.test.mjs`,
      enforces the general rule over every `.css` under `styleguide/styles/`:
      for every rule whose `animation` shorthand (or
      `animation-iteration-count`) contains `infinite`, resolve the referenced
      `@keyframes` name and assert every property declared inside that block
      is in the allowlist `{opacity, transform, translate, rotate, scale}`.
      **Allowlist, not denylist** — a denylist would miss the next paint
      property someone reaches for.
- [ ] The lint cannot pass structurally green: it fails if it finds **zero**
      `infinite` animations, and fails if any referenced keyframes name does
      not resolve to a defined `@keyframes` block (so a rename cannot silently
      escape the check). It should currently find five `infinite` animations
      in the live tree once this task ships.
- [ ] The lint's predicate is a pure exported function unit-tested against
      synthetic CSS fixtures — a compliant block passes, a block declaring
      `box-shadow` / `filter` / `width` inside an `infinite` keyframes fails —
      so the check is proven to trip, not merely proven to be green.
- [ ] Reduced motion, doing-pulse strips to **NOTHING**: the
      `prefers-reduced-motion: reduce` block still sets `animation: none` on
      `.ticket-rail--pulse`, and additionally suppresses the new glow layer
      outright (`.ticket-rail--pulse::after { content: none }` or
      `display: none`), so no residual static halo can survive. Machine-checkable:
      a declaration-level contract, decidable from the artifact — the same
      assertion shape `doing-pulse.test.mjs` already uses.
- [ ] Reduced motion, attention dot stays a **STEADY STATIC marker**: the guard
      still sets `animation: none`, `box-shadow: none`, `opacity: 1` on
      `.rail-attention::before`. Machine-checkable, same reasoning as above.
- [ ] Palette and cadence unchanged: the pulse block still references
      `var(--st-doing)` and `var(--duration-ambient)`; the attention block
      still references `var(--st-todo)` and `var(--duration-attention)` and
      still never references `--accent-ochre-soft`. The five existing motion
      tests (`doing-pulse`, `attention-cue`, `dependency-ring`,
      `dependency-present`, `edge-blink`) pass **unmodified** except for
      additive assertions.
- [ ] `rel-ring-breathe`, `rel-present-breathe`, `rel-edge-blink-breathe` and
      their rules are untouched — the diff to `agentheim.css` is confined to
      the two cue blocks and their comments.
- [ ] `dashboard/dist/` rebuilt via `cd dashboard && npm run build` and staged,
      so `dist-staleness.test.mjs` is green. `styleguide/styles/**` is a
      declared dist input (`dashboard/build-stamp.mjs` →
      `declaredInputRoots`), and `agentheim.css` is copied verbatim into
      `dashboard/dist/agentheim.css` — a CSS-only change makes committed dist
      stale otherwise. Full design-system + dashboard suites green.
- [ ] The doing-card breathe and the rail attention dot read the same as
      before — same amplitude, same cadence, same ochre / `--st-todo` hue, no
      new "hard fade-in" character on the rail glow, no distracting residual
      halo on the dot at its trough. **[human-eye]** — what to show the
      builder: the styleguide canvas (`styleguide/index.html` → section 06
      doing-card specimen, section 09 attention specimen) plus the live
      board's doing column, as a **before/after screen recording pair** (a
      still screenshot cannot show a 2.2–2.6 s breathe; a short capture of one
      full loop can). This is a visible styleguide/canvas change and therefore
      **reopens the design-system gate for builder re-review**, per ADR-0014's
      and ADR-0029's own Consequences sections and prior precedent.
- [ ] With the OS reduced-motion setting on, the doing rail renders as a plain
      ochre rail with **no halo at all**, and the attention dot renders as a
      steady, still-visible dot. **[human-eye]** — the two machine-checkable
      reduced-motion bullets above decide the declarations; this one confirms
      they actually render, which matters here specifically because the
      change introduces a **new pseudo-element** into the guard's blast
      radius — a cascade/specificity miss would satisfy the text check and
      still leave a permanent halo. Show the same two canvas sections with
      reduced motion forced.

Not all criteria are `[human-eye]`, so ADR-0061's "builder-eye-only" `## Notes`
line is **not** required.

## Notes

**Type: `bug`** (not refactor). Refactor means "no defect, no behaviour
change." Two things make this a defect: (1) there is observable harm — a
main-thread paint every frame at 60 fps for as long as the tab is open, on
every doing card and every attention row — the resource waste
`agentic-workflow-bmn29` was filed against; (2) two artifacts assert a
property the code does not have — the CSS comment
`"Composited on opacity + box-shadow only (cheap to run continuously)"` and
ADR-0014's Consequences→Neutral `"box-shadow/opacity keyframes are
compositor-friendly; the continuous animation is effectively free on the
GPU."` A false documented claim about a live surface is a bug in the record,
not a refactor opportunity. The fix happens to be visually
behaviour-preserving, which is exactly why the `[human-eye]` criteria above
carry the whole risk.

**Mechanize-or-drop (ADR-0059): ship the lint in the same task.** This task
establishes a convention in the doctrine's exact sense: *"no infinite
keyframe may animate a non-compositable property"* is a structural rule every
future ambient signal is expected to follow, not a one-off choice. It also
lands on a **doctrine-bearing surface** (the design-system README's
convention/ubiquitous-language section, plus an ADR-0014 amendment), so the
z3grd scoping does not exempt it and verifier check 6c will fire. Ship
enforcement, **not** the prose-only marker — the predicate is plainly
mechanical (which keyframes are referenced by an `infinite` animation, and
what properties do their bodies declare), the same tier ADR-0044's id-grammar
lint and ADR-0052's namespace grep occupy, needing no semantic reading.

**Tier placement: BC-local, not repo-root.** Put the lint at
`styleguide/test/ambient-motion-compositor.test.mjs`, not `lib/`. The five
sibling motion tests already assert CSS invariants by reading
`styles/agentheim.css` from `styleguide/test/`; `lib/` is for harness-wide
live-tree conventions that walk every BC (`human-eye-criteria`,
`index-entry-length`, `spike-stop-loss`). This rule governs one BC's
stylesheet, so it belongs in that BC's suite.

**ADR-touch: dated amendment to ADR-0014, one-line footnote to ADR-0029 — no
new ADR, no status/decision change.** The decisions are untouched: ADR-0014
decides ambient motion may signal status, keyed off `status === "doing"`,
quiet, ochre-only, on `--duration-ambient`, stripped to nothing under reduced
motion; ADR-0029 decides the attention cue is a distinct signal on
`--st-todo`/`--duration-attention` that keeps a steady marker. Every one of
those survives verbatim. But ADR-0014 still needs a short **dated amendment**
for three reasons, and this task's worker should write it (per this project's
pattern of workers authoring amendments for the decisions their diff
executes, e.g. ADR-0043's amendment was written by the task that found the
bug):
1. Its Decision point 1 specifies the mechanism being removed —
   *"animates the rail's `opacity` (0.9 → 0.62 → 0.9) and a soft `box-shadow`
   glow that `color-mix`es `--st-doing` in and out."* That sentence will
   describe CSS that no longer exists.
2. Its Consequences→Neutral bullet is factually false —
   *"`box-shadow`/`opacity` keyframes are compositor-friendly; the continuous
   animation is effectively free on the GPU."* Only the opacity half was ever
   true. (The bullet's *"pauses when the tab is backgrounded"* half is
   broadly correct and should be left alone.)
3. The new clause needs a home, and ADR-0014 is it — the ambient-motion
   contract lives there (ADR-0029's Consequences already extends it in place
   with "future ambient signals must answer the reduced-motion question
   explicitly").

Add to ADR-0014 a dated amendment section titled something like
"Compositor-only is the third clause of the ambient-motion contract
(amendment, design-system-pk4qd, <date>)" that: corrects the mechanism
sentence, retracts the cheapness claim, and states the new clause plus its
lint. Add to ADR-0029 a one-line dated footnote noting its Decision point 1
phrase *"rather than the rail's opacity/box-shadow breathe"* goes stale (the
decision itself is unaffected). No changes needed to ADR-0034 or
design-system-b7n2s's record — their three cues were already compliant; worth
stating explicitly in the ADR-0014 amendment that the clause was *discovered*
there, not invented for them.

**Ubiquitous language to add to `.agentheim/contexts/design-system/README.md`**
(after the ADR-0029 attention-cue paragraph, ~line 166, before the
dependency-ring section):

```markdown
**The compositor-only clause (`design-system-pk4qd`, ADR-0014 amendment).** The
ambient-motion contract has **three** clauses, not two. An ambient cue must be
**quiet** (low amplitude, slow cadence, palette-only — no new hue),
**strippable to a still-legible baseline** under `prefers-reduced-motion` (to
*nothing* when the information survives without the cue, to a *steady static
marker* when it does not — ADR-0029), and **compositor-only**: a `@keyframes`
block driven by an `infinite` animation may declare **only** `opacity` /
`transform`. Any paint property that is part of the look — `box-shadow`,
`filter`, `border`, `background` — must be a **static declaration**, painted
once, on a **glow layer**; what breathes is that layer's *opacity*. Animating
`box-shadow` (or re-evaluating a `color-mix()` per keyframe step) forces a
main-thread repaint every frame for the life of the tab; opacity does not.
`rel-ring`, `rel-present` and `rel-edge-blink` were built this way from the
start and are the pattern; the two older cues were corrected to match.

- **Glow layer** — a pseudo-element sized to its host
  (`position: absolute; inset: 0`) that carries a halo/shadow at a single
  fixed value and does nothing but fade. It is how a paint effect
  participates in an ambient loop without costing a paint. A glow layer that a
  reduced-motion guard merely *stops* leaves a permanent static halo, so a
  strip-to-nothing cue must remove the layer outright (`content: none`), not
  just its animation.
- **Pre-painted state layers, cross-faded** — the general compositor-safe
  technique for animating any paint property: render each visual state once
  as its own static layer, then animate only their opacities. Two layers at
  different blur radii approximate an animated blur; the same trick
  generalises to colour, border, and shadow transitions.

Enforced by `styleguide/test/ambient-motion-compositor.test.mjs`, which
resolves every `@keyframes` referenced by an `infinite` animation across
`styles/*.css` and fails on any declaration outside the
`{opacity, transform, translate, rotate, scale}` allowlist.
```

**Implementation guidance.**
- The rail needs no `position: relative` change — `kanban.js` (~line 106)
  already renders it `position: "absolute"`, which makes it a containing
  block for its own `::after`. Confirm before writing the rule; if the rail
  is ever restyled to static, the glow layer breaks silently.
- **Regex trap in the existing guard test.** `doing-pulse.test.mjs` finds the
  reduced-motion block with a non-greedy
  `@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}` — that
  stops at the **first** inner rule. Adding a second selector to that
  `@media` block is safe only if `.ticket-rail--pulse` (with
  `animation: none`) stays **first** inside it. Put it first, and prefer
  *extending* that test to cover `::after` over reordering CSS to satisfy a
  fragile pattern.
- Update the two stale CSS comments in the same diff (see Why).
- `will-change: opacity` on both the rail and its glow layer promotes two
  compositor layers per doing card — trivial at the handful of doing cards a
  real board carries. If the doing column ever grows large, dropping
  `will-change` is safe (a running opacity animation promotes on its own).
- The dist rebuild is this task's responsibility, not infrastructure's — run
  `cd dashboard && npm run build` and stage the result; the
  `build-stamp.mjs`/`dist-staleness.test.mjs` gate fails the suite otherwise.
- Cheap local proof, not a criterion: DevTools → Rendering → Paint flashing on
  the styleguide canvas, before and after, with a doing card idle. Before:
  the rail region flashes continuously. After: no repaint. Useful evidence
  for the verifier note; the end-to-end MacBook energy measurement stays with
  the parent `agentic-workflow-bmn29` / sibling `agentic-workflow-mvt8x`.

**Relationship to the parent task.** `agentic-workflow-bmn29` finding #5 and
its acceptance line *"No infinite keyframe animates `box-shadow`, `filter`, or
any other non-compositable property; the doing-card breathe and attention dot
still read the same visually"* is fully delegated to this task — recommend
the parent keeps a one-line pointer rather than duplicating the criterion, so
the same claim is not verified twice against two different diffs. This task
has no dependency on the SSE-consolidation (`agentic-workflow-mvt8x`) or
memoization (`agentic-workflow-rw6ck`) slices and can ship in any order
relative to them.

**Open questions for the builder / worker:**
1. **Attention-dot trough halo** — accept the faint residual glow at `~0.25`
   alpha, or drop the static mix from `45%` toward `30–38%` to quiet it (at
   the cost of a dimmer peak)? A gate-level judgment for the builder, same
   tier as ADR-0029's original "breathing dot vs. flash vs. badge" choice.
   Default recommendation: ship at `45%` (peak fidelity) and let the eye-check
   decide.
2. **Rail glow "grow"** — if the eye-check flags the missing blur-radius
   expansion, is a two-layer cross-fade worth the extra pseudo-element, or is
   fade-in-at-full-extent good enough? Default recommendation: good enough;
   the cross-fade is documented above as the available lever if needed.
3. **Lint scope** — should the compositor-only check also cover
   `dashboard/app/board.js`'s injected `@keyframes aboutRise`? It is currently
   compliant (`opacity` + `transform`, and it is a one-shot entrance, not
   `infinite`), and it lives in another BC with its own keyframes guard, so no
   cross-BC work is implied by leaving it out — flagging only so the choice is
   visible rather than defaulted.

**Resolutions at refinement (2026-09-05):** open question 1 — ship at 45% and let the
`[human-eye]` check decide; question 2 — fade-in at full extent is good enough, the cross-fade
stays a documented lever; question 3 — leave `aboutRise` out (one-shot, other BC). None of the
three changes a criterion.

Split from `agentic-workflow-bmn29` at refinement; no dependency on its agentic-workflow
siblings (`mvt8x`, `rw6ck`) — ships in any order relative to them.

## Outcome

Both violating cues are now compositor-only. `ambient-rail-pulse` animates only `opacity`;
its box-shadow moved to a new pre-painted glow layer (`.ticket-rail--pulse::after`,
`@keyframes ambient-rail-glow`) whose own opacity breathes — the rail's existing `position:
absolute` (kanban.js ~line 107) makes it the layer's containing block, so no component/markup
change was needed. Reduced motion now removes the glow layer outright (`content: none`), not
merely its animation, so the pulse still strips to NOTHING. `rail-attention-breathe` animates
only `opacity`; its halo became a static `box-shadow` declared once on `.rail-attention::before`
itself (`::after` on that host is already spoken for by `design-system-b7n2s`'s hollow
dependency marker, so no second layer was available there) — the dot's own opacity multiplies
the static halo exactly as it previously multiplied the animated one. `rel-ring-breathe`,
`rel-present-breathe`, `rel-edge-blink-breathe` were untouched (confirmed via `git diff` hunk
ranges confined to the two corrected cue blocks and their comments).

Shipped `styleguide/test/ambient-motion-compositor.test.mjs`: a pure, exported
`checkCompositorOnly(css)` predicate (allowlist `{opacity, transform, translate, rotate,
scale}`) built on `extractKeyframesBlocks` / `propertiesInKeyframesBody` /
`findInfiniteAnimationNames`, unit-tested against synthetic fixtures (compliant
opacity/transform blocks pass; `box-shadow` / `filter` / `width` blocks fail; a non-infinite
entrance animation is ignored; an unresolved keyframes name is reported; the
`animation-iteration-count: infinite` longhand form resolves too), then run against the live
`styleguide/styles/*.css` tree asserting a non-zero infinite-animation count, zero unresolved
names, and zero allowlist violations. The live tree currently carries **six** infinite
animations, not five — the compositor-only split for the doing-pulse deliberately adds a
second infinite animation (`ambient-rail-glow`, on the new glow layer), a design decision
made explicit in the task's own "What" section; this is recorded as its own test rather than
left as a silent surprise against the task description's original estimate.

Both sibling motion tests (`doing-pulse.test.mjs`, `attention-cue.test.mjs`) gained additive
compositor-only assertions; their five pre-existing tests each pass unmodified. Extended
`doing-pulse.test.mjs`'s reduced-motion guard test rather than reordering CSS, per the task's
regex-trap note (`.ticket-rail--pulse` stays first inside the `@media` block).

ADR-0014 gained a dated amendment section ("Compositor-only is the third clause...") that
corrects the Decision-point-1 mechanism sentence, retracts (strikethrough) the false
Consequences→Neutral cheapness claim, and states the new clause plus its lint. ADR-0029 gained
a one-line dated footnote flagging its Decision point 1 phrase as stale; its decision is
unaffected. BC README gained the "compositor-only clause" ubiquitous-language paragraph
(glow layer / pre-painted state layers concepts) between the ADR-0029 attention-cue paragraph
and the dependency-ring section.

`dashboard/dist/` was rebuilt locally (`cd dashboard && npm run build`) so `dist-staleness.test.mjs`
and the full dashboard suite (930 tests) are green in this worktree; per this task's guidance the
rebuilt `dist/` is intentionally excluded from `FILE_LIST` (ADR-0057 checkpoint guard / conductor's
sanctioned integration rebuild). Full design-system styleguide suite: 218/218 green. Both
`[human-eye]` acceptance criteria are left unchecked for the builder's eye-check (before/after
recording of the styleguide canvas sections 06 and 09, plus the live board's doing column, with
and without OS reduced-motion forced).

Key files: `.agentheim/contexts/design-system/styleguide/styles/agentheim.css`,
`.agentheim/contexts/design-system/styleguide/test/ambient-motion-compositor.test.mjs` (new),
`.agentheim/contexts/design-system/styleguide/test/doing-pulse.test.mjs`,
`.agentheim/contexts/design-system/styleguide/test/attention-cue.test.mjs`,
`.agentheim/contexts/design-system/README.md`,
`.agentheim/knowledge/decisions/0014-ambient-motion-signals-active-status.md`,
`.agentheim/knowledge/decisions/0029-ambient-attention-cue-distinct-from-active-status-pulse.md`.
