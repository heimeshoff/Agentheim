---
id: ADR-0029
title: An ambient attention cue is a second motion signal — distinct from the active-status pulse, and it keeps its marker under reduced motion
scope: design-system
status: accepted
date: 2026-06-19
related_tasks: [design-system-v8k2p]
related_adrs: [ADR-0014, ADR-0016, ADR-0003]
---

# ADR-0029: An ambient attention cue is a second motion signal — distinct from the active-status pulse, and it keeps its marker under reduced motion

## Context

ADR-0014 established the system's first ambient (looping) motion signal: the
doing-card breathe, carrying *active status*. It set a standing contract that
ambient motion stays quiet (low amplitude, slow cadence, palette-only, no new
hue) and is **always strippable to a static, still-legible baseline** under
`prefers-reduced-motion: reduce` — where "strip" for the pulse meant *remove it
entirely*, since the ochre rail color alone still conveys "doing."

`design-system-v8k2p` asks for a *second* ambient signal on the left rail: a
"this just arrived — look here" cue on a freshly-created research report / ADR,
applied to a `TreeItem` row and the shared `Collapsible` group header (so an
arrival under a collapsed group is still visible). The detection of *which* rows
are new and the until-acknowledged lifecycle belong to the consumer
(`agentic-workflow-n4h7q`); the styleguide half is the reusable cue. This is the
first time the system carries **two different ambient signals**, raising three
decisions the doing-card precedent did not have to answer.

## Decision

**1. The attention cue is a distinct ambient signal, not a reuse of the pulse.**
The doing-pulse says *"work is happening here, continuously"*; the attention cue
says *"this is new — notice it once, then it is acknowledged."* They are
different meanings and must be visually separable. The cue is therefore a
separate mechanism — a small breathing **left-edge dot** (`@keyframes
rail-attention-breathe`, `.rail-attention::before`) rather than the rail's
opacity/box-shadow breathe — and is driven by its own duration token,
`--duration-attention` (2200ms, slightly quicker than `--duration-ambient`'s
2600ms so "just arrived" reads with marginally more urgency without ever
becoming an aggressive blink).

**2. It draws from `--st-todo`, not `--st-doing` and never the ochre accent.**
Each ambient signal stays palette-only and introduces no new hue (ADR-0014).
The cue uses the existing `--st-todo` "incoming / new work" status token — which
is both semantically apt (a new arrival is *incoming*) and visually separable
from the ochre `--st-doing` pulse. It must **never** borrow the reserved
selection/focus accent `--accent-ochre-soft` (ADR-0016): a "new" signal and a
"selected" signal are different axes and must not collide on the same color.

**3. Under reduced motion the cue keeps a steady, still-legible marker — it is
NOT stripped to nothing.** This is the one place the attention cue *diverges*
from the doing-pulse's reduced-motion behavior, and the divergence is principled.
The pulse can vanish under reduced motion because the static ochre rail still
encodes "doing" on its own — the information survives. The attention cue has **no
such static fallback**: "new" is not otherwise encoded on the row, so stripping
the cue entirely would erase the information. ADR-0014's standing contract is
"strippable to a still-legible *baseline*," and for an attention cue the
legible baseline is a **steady static dot** (loop removed, `opacity: 1`), not
emptiness. Reduced motion removes the *motion*, never the *signal*.

**4. Opt-in, default OFF, byte-identical when off (ADR-0003 single source).**
Both surfaces take an `attention` boolean (default `false`); off adds no class,
so an unflagged row/header renders identically to today and the dashboard
inherits the capability unforked. The styleguide owns the cue; the consumer owns
when it fires. `dist/` is a derived artifact (ADR-0003) and is rebuilt by the
consumer, not here.

## Consequences

- The system now has a small **taxonomy of ambient signals**, each a quiet,
  palette-only loop keyed to a meaning: `--st-doing` breathe = *active status*;
  `--st-todo` dot = *new / attention*. Future ambient signals should pick a
  distinct existing status token and a distinct mechanism, and must answer the
  reduced-motion question explicitly (strip-to-nothing only when the information
  survives without the cue).
- The pure on/off decision is React-free and `node --test`-able
  (`attentionCueClass` in `app/motion.js`, mirroring `doingPulseClass`).
- This is a visible styleguide/canvas change → it reopens the design-system gate
  for builder re-review (section 09 gains the attention specimen). The exact
  visual (breathing dot vs. flash vs. badge) was a gate-level choice; the quiet
  breathing dot was picked to stay consistent with the breathe-pulse tone.

See `design-system-v8k2p`, ADR-0014 (the precedent), ADR-0016 (reserved accent),
ADR-0003 (single source / derived `dist/`).
