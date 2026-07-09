---
id: design-system-v08qq
title: TicketCard — condense to 1b: no context chip, no estimate, no timestamp, smaller type
status: doing
type: refactor
context: design-system
created: 2026-07-09
completed:
depends_on: [design-system-001]
blocks: []
tags: [dashboard-redesign, ticket-card, typography]
related_adrs: [0003]
related_research: []
prior_art: [design-system-t896s, design-system-006, design-system-008, design-system-010, design-system-xr4sb]
---

## Why
1b's board card ("Command deck", `inspiration/Agentheim UX Explorations.html`) is a status dot,
a mono id, and a title — nothing else. Ours carries a bottom meta row with a folder-glyph
bounded-context chip, an estimate chip, and an `updated` timestamp, and sets its type two steps
larger than 1b does. The builder wants the card to read as 1b's does.

The bounded-context chip is the only one of the three that actually renders on the dashboard
board today, and it is **redundant there**: task ids are `<bc>-<token>` (ADR-0028), so
`infrastructure-h8k2m` already names its bounded context in the mono id at the top of the card.
The chip restates, in a bordered glyph-prefixed pill at the bottom, what the id says at the top.

## What
Condense `TicketCard` (`.agentheim/contexts/design-system/styleguide/app/kanban.js`) toward 1b:

- **Empty the meta row of content.** Drop the context `MetaChip` (line 135), the estimate
  `MetaChip` (line 136), and the `updated` timestamp (lines 138–140).
- **Keep the `cornerAction` slot.** It is the only surviving occupant of the row and it is
  load-bearing — backlog cards render aw-022's Refine/Promote pair through it. The row should
  render *only* when a `cornerAction` is supplied, so an ordinary card ends at its title exactly
  as 1b's does.
- **Condense the type scale to 1b's.** Mono id `11.5px → 10px`; title `14px → 12px` with
  `line-height` `1.4 → 1.5`.

Card padding, corner radius, the status rail, the `bot` agent icon, the two-line title clamp, the
hover shadow, and the dependency ring are all **out of scope** — this task moves type sizes and
removes meta-row content, nothing else.

## Acceptance criteria
- [ ] `TicketCard`'s meta row renders no bounded-context chip.
- [ ] `TicketCard`'s meta row renders no estimate chip.
- [ ] `TicketCard`'s meta row renders no `updated` timestamp.
- [ ] The meta row renders **only** when `cornerAction` is supplied. A card without one ends at
      its title, with no dangling bottom gap (the title's `marginBottom: 12` must not survive as
      trailing whitespace on a rowless card).
- [ ] `cornerAction` still renders in the bottom-right and still stops click/key propagation, so
      the Refine/Promote pair (design-system-006, agentic-workflow-022) is unbroken. Its two
      existing tests stay green **unchanged**.
- [ ] The mono id renders at 10px and the title at 12px / line-height 1.5, in both the `rail` and
      `badge` variants.
- [ ] **`MonoId` sizing strategy is justified in the task notes, checked against every RENDER
      site — not merely every import.** Either bump the shared primitive or give it a `size` prop.
      This is the `--radius-md` trap from design-system-t896s: `app/app.js` *imports* `MonoId` on
      line 13 but appears never to render it, so a global bump may well be safe here where a
      global `--radius-md` bump was not. Re-verify at work time; record the check.
- [ ] **`showEstimate`'s disposition is decided and justified** (retire `app/card.js`'s helper
      along with its two pure-function tests, or retain it as an unreferenced export). Either way
      design-system-006's estimate-visibility rule is superseded — record the supersession in the
      BC README.
- [ ] **Anti-deletion:** `test/ticket-card.test.mjs`'s `'the card renders the estimate chip behind
      the showEstimate decision'` encodes the OLD contract and will go red. It must be **rewritten**
      to pin the new one (the card renders no estimate chip) — never deleted to make the suite
      green. Same discipline for any other test whose title asserts the removed elements.
- [ ] `dashboard/dist/` is **rebuilt by this task itself** — a style-only change to an
      already-consumed primitive, no separate agentic-workflow wiring task (the t896s precedent).
      The build runs in the task's **own worktree**, never in the main tree.
- [ ] Reopens the styleguide gate for a lightweight re-review (the ds-008 / ds-010 / t896s
      precedent).
- [ ] BC README updated.

## Notes
- **The board is not losing information.** Grouping is an *optional* per-column view lens
  (`dashboard/app/board-group.js`, `FLAT_BC`), so a flat column has no BC section header to carry
  the context. Raised with the builder; dismissed on the grounds that the mono id already leads
  with the bounded-context name (ADR-0028's `<bc>-<token>` grammar). Accepted knowingly — the chip
  is redundant in grouped *and* flat columns alike.

- **The estimate chip and timestamp already never render on the real board.**
  `dashboard/app/board-data.js:75-76` projects `est: '—'` and `updated: ''`; `showEstimate('—')`
  is `false` and `''` is falsy. Both are visible **only** in the styleguide canvas specimen, which
  feeds `TICKETS` from `app/data.js`. So the sole change visible on the dashboard board is the
  disappearance of the context chip — worth knowing before wondering why the board barely moves.

- **Follow-up, not this task:** once `TicketCard` ignores them, `board-data.js`'s `est` / `updated`
  placeholder fields are dead. That file belongs to the `agentic-workflow` BC, so it is out of a
  design-system task's scope — capture separately if it's worth the churn.

- **`MonoId` render sites** at capture time: `kanban.js:112` (rail variant) and `kanban.js:122`
  (badge variant). `app/app.js:13` imports it but no render was found. `MetaChip` *is* still
  rendered elsewhere (the specimen gallery in `app.js`) — leave the primitive itself alone; this
  task only stops `TicketCard` from calling it.

- **1b's card, for reference** (`inspiration/Agentheim UX Explorations.html`, §1b "Command deck"):
  ```
  background:#121826; border:1px solid #232e42; border-radius:10px; padding:10px 12px
    ├─ row: 5px status dot + mono id, font-size:10px, color:#7d8794
    └─ title: font-size:12px; line-height:1.5; font-weight:500
  (no meta row)
  ```
  We already carry 1b's 10px radius from [[design-system-t896s]]. Padding is left at today's
  values deliberately.

- TicketCard look history: ds-006 (corner action / estimate chip), ds-008 (hover shadow, no lift),
  ds-010 (dropped the ochre selected-ring), [[design-system-w4t9k]] (dependency ring),
  [[design-system-t896s]] (10px radius). This task is the first to *remove* content from the card.

- Known Windows papercut for the worker: `dashboard/dist/index.html` reports as modified with zero
  changed lines (`git diff --numstat`) — the EOL phantom. Do not commit it. `dist/app.js` showing
  real line deltas is a genuine rebuild and should be committed.
