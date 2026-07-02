---
id: ADR-0034
title: A relational dependency-highlight is a third ambient signal — its own dedicated token, direction coded by line-style, static under reduced motion
scope: design-system
status: proposed
date: 2026-07-02
related_tasks: [design-system-w4t9k, design-system-b7n2s]
related_adrs: [0014, 0029, 0016, 0003]
---

# ADR-0034: A relational dependency-highlight is a third ambient signal — its own dedicated token, direction coded by line-style, static under reduced motion

## Context

ADR-0014 established the system's first ambient (looping) motion signal — the
doing-card breathe, carrying *active status*, drawing exclusively from the existing
`--st-doing` hue. ADR-0029 established a second, distinct signal — the rail
attention-dot, carrying *new/arrival*, drawing from the existing `--st-todo` hue —
and set a standing principle: *"future ambient signals should pick a distinct
existing status token and a distinct mechanism."*

`agentic-workflow-r9k2p` asks for a third signal: a hover-revealed cue meaning "this
card is a dependency of the card you're pointing at," in **two directions**
(`depends_on` / "waiting on" and `blocks` / "holding up") that must remain
distinguishable even after `prefers-reduced-motion` strips all animation. Unlike the
first two signals, this one is not a *status* at all — it is *relational*, true only
transiently, only during a hover, only about the relationship between two specific
cards — so ADR-0029's "reuse an existing status token" guidance does not have an
honest answer here: every existing status token already carries a meaning (`doing` =
active, `todo` = new/attention, and the reserved ochre = selection, ADR-0016), and
borrowing any of them for "is a dependency" would make one hue mean two unrelated
things depending on which surface it appeared on.

Two further design questions had no precedent to draw on: how to carry *two
directions* without doubling the palette cost, and where on the card the cue should
live, given the doing-pulse already occupies the card's rail.

## Decision

**The ambient-motion taxonomy gains a third member: a relational dependency-highlight
ring, on its own dedicated (non-status) token, direction-coded by line-style, and
card-perimeter rather than rail-based.**

1. **A dedicated new token, `--rel-dep`** (added to both theme blocks of
   `styles/agentheim.css`) — the taxonomy's first token that is not a status color
   and not the reserved selection accent (`--accent-ochre-soft`, ADR-0016). This is a
   deliberate departure from ADR-0029's "reuse an existing status token" guidance:
   that guidance assumed every future ambient signal would itself be status-shaped;
   a relational signal is not, and forcing it onto a status hue would create a false
   equivalence between "this card is `doing`" and "this card is a dependency of the
   card you're hovering," two unrelated facts about the card.

2. **Two directions, one hue, split by line-style, not color.** `waiting-on`
   (the hovered card's `depends_on`) renders a **solid** ring; `holding-up` (the
   hovered card's `blocks`) renders a **dashed** ring of the same `--rel-dep` hue.
   A second hue was considered and rejected: the palette is already hue-dense (eight
   status/content-type colors plus the obligation/danger family), a second dependency
   hue would read as *two unrelated signals* rather than one bidirectional relation,
   and — the decisive reason — a hue/opacity distinction is too subtle to survive the
   reduced-motion strip, whereas solid-vs-dashed line-style remains fully legible
   with the breathing loop removed.

3. **Card perimeter, not rail.** The doing-pulse (ADR-0014) already occupies the
   card's rail; a target of the new cue may simultaneously *be* a doing
   card (rail already pulsing) or carry the attention dot (ADR-0029, also
   rail-adjacent). Placing a third signal on the rail would force visual competition
   between three meanings on one narrow strip. The dependency ring instead takes the
   full card **perimeter** (an inset `::after` ring, clip-safe under the card's
   existing `overflow: hidden`) — free of both existing rail-based cues, and a
   closer visual match to the original ask ("a pulsing ring... an ambient breathing
   outline around the card").

4. **Reduced motion keeps the ring, strips only the loop — the ADR-0029 pattern, not
   ADR-0014's.** The doing-pulse can vanish under reduced motion because the static
   rail color alone still conveys "doing." The dependency relationship has **no
   such static fallback** — nothing else on the target card says "you're looking at
   a dependency" — so stripping the ring entirely would erase the hover's entire
   message. The ring therefore keeps a static solid/dashed border (loop removed,
   `opacity: 1`) under `prefers-reduced-motion: reduce`, and because direction rides
   line-style rather than motion or opacity, it stays fully legible in that static
   state.

5. **Opt-in, default off, byte-identical when off (ADR-0003 single source).**
   `TicketCard`'s new `dependencyRelation` prop defaults to `null`/`undefined`; an
   unflagged card renders identically to today. Detection of which cards are targets
   and the hover lifecycle belong entirely to the consumer
   (`agentic-workflow-k5p8w`/`h9v3m`); the styleguide only turns the cue on or off
   from a value.

6. **The "hidden dependency" presence marker (`design-system-b7n2s`) is a sibling
   mechanism, not a variant of this ring or of ADR-0029's `attention` cue.** It
   reuses `--rel-dep` (one shared visual language across "pulsing on the card" and
   "present but hidden") but is deliberately **hollow** (border, not filled) to stay
   distinct from the *filled* `--st-todo` attention dot, and deliberately
   **direction-agnostic** (one marker, "expand to see" — direction stays on the
   on-card ring, not duplicated onto every group header).

## Consequences

**Positive**
- The taxonomy now documents a clear branching rule for future ambient signals:
  status-shaped signals reuse an existing status token (ADR-0029's guidance,
  unchanged for that case); *relational* signals (true of a relationship between two
  specific items, not of one item's own state) may introduce a dedicated token, and
  should default to a non-hue channel (line-style, shape) for any sub-distinction
  that must survive the reduced-motion strip.
- One token, one duration, three consumption points (`TicketCard`'s ring, the group
  presence marker, the off-viewport edge blink) — no palette sprawl even though the
  feature spans three visual contexts.
- Establishes the reduced-motion decision rule explicitly: "does the target still
  encode the signal's meaning without the cue?" — no → keep a static marker; yes →
  (as with the doing-pulse) may vanish.

**Negative / cost**
- A fourth hue-family now exists in a system whose founding law was "color signals
  status/content-type only" — this ADR is itself the second deliberate widening of
  that law (after ADR-0014 admitted motion as a status channel), and future
  reviewers should hold new ambient signals to the same bar this one and ADR-0029
  cleared: quiet, low-amplitude, and — now — either status-token-reusing or, when
  genuinely relational, carrying its own narrowly-scoped dedicated token.
- The exact `--rel-dep` hue is not finalized by this ADR (proposed cyan/aqua,
  `#1E88A8` light / `#5FC7DE` dark, distinct from context-teal) — pending the
  builder's confirmation at the styleguide gate review of `design-system-w4t9k`'s
  canvas specimen.
- The committed dashboard `dist/` is a derived artifact (ADR-0003) and must be
  rebuilt by the consuming board tasks; the styleguide source change alone does not
  update the served bundle.

**Neutral**
- Editing the gated styleguide source/canvas reopens the styleguide gate per the
  established precedent chain (ds-004/005/.../v8k2p/c3p9k) — the builder re-reviews
  before the board wiring ships.

## Alternatives considered

- **Reuse `--st-todo` for one direction, a new token for the other.** Rejected:
  `--st-todo` already means "new/attention" on `Collapsible` headers (ADR-0029);
  reusing it here for "waiting on" would make the same hue mean two unrelated things
  depending on which component renders it — a false equivalence, not a genuine reuse.
- **Two fully separate dedicated tokens for the two directions.** Rejected: doubles
  the palette cost for a single bidirectional relation, and a hue-opacity distinction
  between two close hues would not reliably survive the reduced-motion strip to a
  static state the way line-style does.
- **Rail-based treatment (matching the doing-pulse's mechanism).** Rejected: direct
  visual collision with a target that is simultaneously a doing card or an
  attention-flagged card — both already claim the rail.
- **Vanish under reduced motion (the ADR-0014 pattern).** Rejected: unlike doing-
  status, the dependency relationship has no other static encoding on the target
  card; vanishing would silently drop the hover's entire meaning for
  reduced-motion users.
