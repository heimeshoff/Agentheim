---
id: design-system-001
title: Dashboard styleguide (visual language for Agentheim's UI)
status: done
type: feature
context: design-system
created: 2026-06-05
completed: 2026-06-05
commit:
depends_on: []
blocks: [agentic-workflow-001]
tags: [styleguide, design-system, ui, frontend]
related_adrs: []
related_research: []
prior_art: []
---

## Why

Agentheim is about to grow its first UI — the `dashboard` (agentic-workflow-001). The
styleguide gate requires a reviewed visual language to exist *before* any UI is
implemented, so the dashboard doesn't invent its own ad-hoc look and so future UI work
has one source of truth. This is the gate task the dashboard depends on.

## What

A styleguide artifact defining the visual language for Agentheim's dashboard UI:
color palette, typography, spacing/layout scale, and the component patterns the
dashboard needs — Kanban columns and task cards, the right-hand Notion-style slide-over
panel, and the navigation/discovery chrome. Output is a reviewable styleguide (and any
reference tokens/components), not the dashboard itself.

## Acceptance criteria

- [x] A styleguide document exists defining color, typography, spacing, and layout scale.
      → `styleguide/index.html` (canvas) + `styleguide/styles/colors_and_type.css`
      (surfaces, fg, hairlines, ochre accent, type scale, spacing, radii, motion) and
      `styleguide/styles/agentheim.css` (status + content-type palettes, elevation, the
      long-form markdown reading scale).
- [x] Component patterns are specified for: Kanban board (columns + cards, two status
      directions), the right-hand slide-over detail panel (two header directions + entrance
      motion), markdown rendering inside the panel (headings/links/code/blockquote/lists/
      task-lists/tables), and the navigation chrome (file tree with colored content-type
      icons). Demonstrated in context in `styleguide/index.html` sections 05–10.
- [x] The styleguide is reviewed and explicitly **approved by the builder (2026-06-05)**
      before any dashboard UI is implemented. The gate is open.
- [x] The styleguide is consistent with the runtime/transport decision (infrastructure-001):
      it ships as plain static assets (HTML/CSS/JSX), **no `node_modules`, no install step**.
      One caveat to carry into the dashboard build — see the reconciliation note in Delivery.

## Delivery

**Design direction — decided** (resolved on the design side via Claude Design; see
`chats/chat1.md` in the source bundle). The four axes that were open at capture are now
locked:

- **Aesthetic** — refined, content-first developer tool: "Linear's precision, Notion's
  calm, Vercel/Raycast restraint." Quiet by default; color used sparingly and only to
  signal **ticket status** and **content type**. Derived from the Ledger design system.
- **Theme** — **dark-first** with a working live toggle to a light variant. Both sets of
  token values shipped.
- **Density** — **comfortable**: ticket ID + two-line title + two meta chips, with room
  to breathe.
- **Framework** — **React** (component patterns expressed as JSX), JetBrains Mono for IDs
  (`AGH-128` for tickets, `ADR-0007` for decision records), inline-SVG icons (no icon
  library). Content types: ticket, bounded context, vision, context map, research, ADR.

**Artifact delivered** to `contexts/design-system/styleguide/`:
- `index.html` — the styleguide canvas (tokens documented up top, then components rendered
  in context, plus a live interactive kanban→drawer demo).
- `styles/colors_and_type.css`, `styles/agentheim.css` — the token source of truth.
- `app/*.jsx` — the reference components (primitives, kanban, drawer, library/file-tree,
  markdown renderer, foundations docs).

**Reconciliation note for the dashboard (agentic-workflow-001):** the canvas loads React +
ReactDOM + Babel-standalone + `marked` from the unpkg CDN and compiles JSX in-browser. That
satisfies infrastructure-001's *no-install / no-`node_modules`* rule but (a) needs network
at view time and (b) is slow to first paint. Per infrastructure-001's "if the UI needs a
build, that build's committed output is the asset set," the dashboard should **vendor or
pre-bundle** these (commit the built output as the static asset set) rather than ship
in-browser Babel. The tokens and component patterns carry over unchanged.

## Notes

- Scope answer to the capture-time open question ("how much of a design system does a single
  internal dashboard warrant?"): kept **as light as the dashboard needs** — tokens plus the
  named component patterns, not a multi-product system. Derived from Ledger rather than
  invented from scratch.
- Gate: **open** — the builder reviewed and approved the styleguide on 2026-06-05. Frontend
  tasks in any BC may now be promoted (each still subject to its own other dependencies).
- Follow-on: the dashboard must ship the styleguide's tokens/components as committed,
  pre-bundled static assets (drop in-browser Babel) — tracked as `infrastructure-002`.
