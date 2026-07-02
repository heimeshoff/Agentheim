---
id: agentic-workflow-r9k2p
title: Hover a backlog/todo ticket to highlight its dependencies with a pulsing ring
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: [design-system-001]
blocks: []
tags: [dashboard, board, motion, dependencies]
related_adrs: [0014, 0016, 0017, 0029]
related_research: []
prior_art: [agentic-workflow-030, agentic-workflow-013, agentic-workflow-t3b9k]
---

## Why
Dependencies between tickets are invisible on the board today — a card in backlog or
todo gives no hint of what it is waiting on. When triaging or refining, the builder has
to open the task and read `depends_on` to learn what blocks it. A hover-revealed cue
turns that into an at-a-glance, zero-click answer: "what does this ticket depend on?"

## What
When the pointer hovers a ticket card **in the backlog or to-do column**, the card(s)
that ticket **depends on** (its `depends_on`) light up with a **pulsing ring** — an
ambient breathing outline around the depended-upon card(s), wherever they sit on the
board (any column, any BC). Moving the pointer away clears the ring.

Direction is the **depends_on** edge: hovering a ticket surfaces *what it is waiting on*.
(Highlighting the reverse edge — what the ticket *blocks* — is an open question below,
not assumed here.)

This is presentation only: the board stays read-only over `.agentheim/` (ADR-0017). No
lifecycle move, no `/api` write — hover in, ring on; hover out, ring off.

## Acceptance criteria
- [ ] Hovering a **backlog** or **todo** card pulses a ring around each card it
      `depends_on`.
- [ ] The depended-upon card is highlighted **wherever it lives** — any lifecycle column,
      any bounded context — not only backlog/todo.
- [ ] The ring is an **ambient pulse** (breathing loop), consistent with the existing
      motion taxonomy (doing-breathe ds-004, attention-dot ds-v8k2p), and clears the
      moment the hover ends.
- [ ] A ticket with **no** dependencies pulses nothing on hover.
- [ ] A ticket with **multiple** dependencies pulses all of them.
- [ ] The ring is **stripped to a static outline under `prefers-reduced-motion`** (the
      standing ambient-motion contract — ADR-0014 / ADR-0029).
- [ ] The ring does **not** use the reserved ochre selection accent
      `--accent-ochre-soft` (ADR-0016) — ds-010 deliberately removed the ochre ring from
      the card; this must not resurrect it.
- [ ] Hover-highlighting writes nothing to disk (read-only dashboard, ADR-0017).

## Notes

Anticipated decomposition (for REFINE / orchestrator — this parent is under-refined and
almost certainly splits three ways):

1. **Projection carry (`agentic-workflow`).** `/api/tree` currently projects only
   `id, title, status, type, context, path` — it carries **no `depends_on`**, so the
   board cannot resolve a card's dependencies today. A sub-task must add `depends_on`
   (and possibly `blocks`, if the reverse-edge question below lands) to the per-task
   projection in `dashboard/tree.mjs`. Direct precedent: **aw-013** (added `mtimeMs`) and
   **aw-t3b9k** (added `mtimeMs` to pointer meta) — same shape of change, loss-tolerant,
   `node --test`-able.

2. **Styleguide capability (`design-system`).** The pulsing ring is a **new ambient cue
   on `TicketCard`**, consumed unforked (ADR-0003). It joins the ambient-motion taxonomy
   already established by **ds-004** (`--st-doing` breathe = *active status*) and
   **ds-v8k2p** (`--st-todo` dot = *new / attention*) — this would be a third member
   (*dependency / related*), so it needs its own token/keyframes and a React-free
   `*Class()` helper in `app/motion.js` (mirroring `doingPulseClass` / `attentionCueClass`).
   A new `design-system` task should be created at refine; **it, not `design-system-001`,
   is this feature's real styleguide blocker.** `depends_on` here currently points at the
   styleguide gate task (`design-system-001`) to satisfy the frontend gate; swap it to
   the new ds task once created.

3. **Board wiring (`agentic-workflow`).** The consumer: on card hover, resolve the
   hovered ticket's `depends_on` to the target card ids and drive the ds ring on those
   cards. Pure hover→id-set resolution belongs in a small unit-tested board helper (the
   `board-sort.js` / `board-group.js` precedent). Hover-highlight precedent for the
   interaction feel: **aw-030** (hover shadow + background highlight), **ds-008**
   (TicketCard hover).

Open questions to corner in REFINE:
- **Direction.** Only `depends_on` (what it waits on), or also `blocks` (what it holds
  up)? If both, the ring likely needs to distinguish the two directions (or the hover
  source column decides). Default captured: `depends_on` only.
- **Off-screen / collapsed dependencies.** A dependency may live in a collapsed BC group
  or the clamped Done peek (aw-m2v8d). Do we scroll it into view, briefly expand, or just
  pulse it where visible and no-op when it's clamped away?
- **Ring color token.** Not ochre (ADR-0016). Reuse `--st-todo` like the attention dot,
  a neutral hairline-strong, or a dedicated token? A refine decision for design-system.
- **Trigger scope.** Spec says hover a **backlog/todo** card. Should hovering a doing/done
  card also reveal its dependencies, or is the affordance deliberately backlog/todo-only
  (the triage context where "what's blocking this?" matters most)?
