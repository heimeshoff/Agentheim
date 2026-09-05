---
id: agentic-workflow-rw6ck
title: Hovering a card re-renders that card and its ring targets, not all 255 — memoized board cards and columns, hover state out of the board root, identity-stable tree projection
status: backlog
type: refactor
context: agentic-workflow
created: 2026-09-05
completed:
depends_on: [agentic-workflow-mvt8x, design-system-001-styleguide]
blocks: [agentic-workflow-bmn29]
tags: [dashboard, performance, board, memoization]
related_adrs: [0033, 0059, 0061]
related_research: []
prior_art: [agentic-workflow-009, agentic-workflow-h9v3m]
---

## Why

Two different events currently cost the same thing: a full re-render of every
card on the board. There is **no `React.memo` anywhere** in `board.js`.

The first is a **hover**, which involves no disk, no frame, and no projection
at all. `BoardCard`'s `onMouseEnter` lifts the hovered id into the board root
(`setHoveredId`); `resolveHoverDependencies` re-runs; the ADR-0033 hover-scoped
`IntersectionObserver` effect re-subscribes on
`[hoveredTicket, targetIds, columns.done, …]`; and all ~255 cards re-render —
each a `TicketCard` with several inline-SVG icons injected via
`dangerouslySetInnerHTML`. The Done column's 249 cards are always mounted;
`peek` only height-clamps them. ADR-0033 was careful to keep the *observer*
hover-scoped; the *render* is not.

The second is a genuine **structural frame** — a real task move. The board is
a projection of disk and re-projects wholesale, which is correct and must stay
correct. But an ordinary work session moves one task out of ~255, and today
that costs 255 renders. Even with the advisory fan-out gone
(`agentic-workflow-mvt8x`), every real lifecycle move still pays full price.
And plain `React.memo` alone would **not** fix this case: `/api/tree` returns
fresh objects on every fetch, so a shallow prop compare on `ticket` fails for
every card. The projection has to become identity-stable for memoization to
bite on a re-fetch at all.

## What

- **`React.memo` on `BoardCard` and `BoardColumn`.** `onCardHover` and `onOpen`
  are already `useCallback`-stable, so the remaining varying props are
  `ticket`, `selectedId` and `dependencyRelation`.
- **Scope hover away from the board root.** Ring membership reaches a card
  without every card re-rendering — e.g. the resolved `waitingOn`/`holdingUp`
  sets read through a context by the card itself, or the hovered id kept in a
  subscribable store rather than board-root `useState`. The ADR-0033 observer
  effect and the Done-peek clamp check stay exactly as they are; only the
  render fan-out changes.
- **Identity-stable projection.** `treeToColumns`
  (`dashboard/app/board-data.js`, already pure and unit-tested) gains a
  reconcile against the previous columns: when a task's projected ticket is
  value-equal to the prior one, the **prior object is reused**. A re-fetch of
  an unchanged tree then yields referentially identical tickets and commits
  nothing; a re-fetch after one task move re-renders one card. Pure logic,
  `node --test`-able with no DOM — the BC's existing convention.
- **A test-only render probe.** One no-op line in `BoardCard`/`BoardColumn`
  reporting to an injectable probe, so render counts are directly observable
  instead of inferred. This is the DI-for-testability idiom the BC already
  uses (`fetchDoc`, `sourceFactory`, `lib/hook-agent-signal.mjs`). A
  DOM-mutation-based test would be a **false green**: without memo, a card
  re-renders to identical output and mutates nothing, so mutation counting
  cannot distinguish "skipped" from "re-rendered identically." Say this
  explicitly in the diff/PR notes so a reviewer doesn't reach for the cheaper,
  worthless check.

## Acceptance criteria

- [ ] jsdom (`dom-harness.mjs`) + render probe: mount `DashboardBoard` with a
      ≥200-card fixture (one backlog card with two dependency targets, the
      rest in Done). Reset the probe after mount, `act()` a real `mouseenter`
      on the backlog card, and assert the recorded `BoardCard` renders are
      exactly `{hovered id, target1, target2}` — and **0** renders for every
      Done-column card. Also assert the same test is **red** against the
      pre-change board first, then green after the fix (ADR-0062 runner-first:
      a memoization test that was never seen failing proves nothing).
- [ ] Pure `node --test` in `board-data.test.mjs`: `treeToColumns(tree, prev)`
      called twice on the same tree returns **referentially identical** ticket
      objects for every column; after one task moves `todo→doing`, exactly one
      ticket object differs by identity and all others are reused.
- [ ] jsdom + probe: a re-projection driven by an unchanged `/api/tree` payload
      produces **0** `BoardCard` renders; a payload differing by one task move
      produces ≤2 renders (the moved card in its new column, plus the column
      bodies).
- [ ] The existing `dashboard/` `node --test` suite passes **unchanged** — no
      test edited to accommodate memoization. This is the honest refactor bar,
      and it already covers the interactions at risk:
      `board-dependency-hover`, `board-card-dismiss`, `launch-button-hover`,
      `board-done-collapse`, `board-group`, `board-sort`.
- [ ] The render probe is inert in production: a `dist-build.test.mjs`-style
      assertion that no probe is installed by default and the built bundle
      contains no test-only import.
- [ ] With the full board on the MacBook, hovering a backlog card feels
      immediate — no perceptible lag before the ring appears, no fan spin-up
      while sweeping the pointer across the Done column. **[human-eye]** — this
      resists mechanization because it is felt input latency: jsdom performs
      no layout and no paint, so any millisecond threshold measured under
      `node --test` would be a number about jsdom, not about the builder's
      browser — a fabricated proxy for a perceptual claim, exactly the failure
      ADR-0061 exists to prevent. The render-count criterion above is the
      honest machine-checkable half; the "feels immediate" half stays with the
      builder's eye.

Five of six criteria are machine-checkable, so no builder-eye-only `## Notes`
line (ADR-0061) is required.

## Notes

**Type: `refactor`** (not `bug`). Test applied: does the code contradict a
documented claim? No README or ADR asserts the board memoizes or that its
projection is identity-stable — this is an unstated performance property, and
the change's contract is *identical rendered output, fewer commits*. This also
sets the right verifier bar (prove nothing visibly changed). `bug` is
defensible if the builder prefers symptom-first typing (the felt hover lag is
real) — builder's call; default to `refactor` unless told otherwise.

**Dependency on `agentic-workflow-mvt8x` — sequencing only, not logical.** A
hover never touches the SSE path, so this task is reachable and independently
measurable even if mvt8x never shipped. The dependency exists for two
practical reasons: (1) both tasks edit `dashboard/app/board.js` in adjacent
regions (mvt8x touches `useLiveTree` around the hook definition and its four
call sites, one of which sits a few dozen lines from this task's hover-state
block) — sequencing avoids two workers colliding on the same file under
worktree isolation; (2) this task's render-count measurements are only clean
once mvt8x removes the heartbeat-driven full-board re-fetch — profiling a
hover pre-mvt8x risks conflating heartbeat-driven commits with hover-driven
ones. Do not re-litigate the split; if mvt8x is bounced back to backlog for
rework, this task should wait.

**Mechanize-or-drop (ADR-0059) — two conventions, two verdicts:**

- The gate only fires if this task's diff touches a doctrine-bearing surface
  (per the z3grd scoping). Recommend including one ubiquitous-language line in
  `.agentheim/contexts/agentic-workflow/README.md` for "identity-stable
  projection" (see below) specifically so the gate fires and the convention is
  visible — if the diff stays confined to `dashboard/app/**` +
  `dashboard/test/**`, the gate would skip, and the task should say so
  explicitly ("scope: dashboard product surface only; ADR-0059 gate skipped")
  rather than silently omitting the question.
- **Convention — "the board's tree projection is identity-stable: re-projecting
  an unchanged tree yields referentially identical ticket objects, and
  consumers may rely on that identity."** → **Ship enforcement.** This is
  free: the pure identity-reconcile test above *is* the lint — it fails the
  moment someone makes `treeToColumns` allocate unconditionally again.
- **Non-convention — "memoize board list components."** → **Prose-only,
  unenforced.** A lint counting `React.memo(` occurrences would over-fire on
  components that must not be memoized and is trivially gamed by a wrapper
  that never actually skips a render. This is the exact escape hatch ADR-0059
  describes ("mechanizing this would require X, judged not worth it because
  Y" fully satisfies the doctrine) — state this reasoning in the task/PR, do
  not just skip it silently.

**No ADR for this task.** Memoization is an implementation technique with no
cross-cutting contract. The one mildly contract-like piece — "the projection
is identity-stable and consumers may rely on it" — is proportionate as the
README line + the pure test above, not a second ADR. (ADR-0070, written for
the sibling task, covers the live-tree hub and frame routing only; if the
builder later wants the identity-stable-projection contract recorded more
formally, it would fit as a short addendum to ADR-0070 rather than a new ADR.)

**Ubiquitous language to add to `.agentheim/contexts/agentic-workflow/README.md`:**

```markdown
- **Identity-stable projection** — `treeToColumns` reconciles against the previous
  projection: a task whose projected ticket is value-equal to the prior one keeps the
  **same object**. Re-projecting an unchanged tree therefore commits nothing, and a
  single task move re-renders a single card. Memoized `BoardCard`/`BoardColumn` depend
  on this — without it a re-fetch allocates fresh objects and every shallow prop
  compare fails. Consumers may rely on the identity. See board-data.js.
```

**Implementation guidance.**
- `WhatsNextPanel`/`InFlightLane` already model the injectable-callback
  pattern this task should follow for the render probe (an optional
  `onRender`-style callback, default no-op, never exercised in production).
- The render probe must be shown **red** against the current (unmodified)
  board before it is shown green — do not write the test only against the
  fixed code.
- A DOM-mutation-observer-based render check is explicitly the WRONG
  mechanism (see "What" above) — it produces a false green because an
  unmemoized-but-identical re-render mutates nothing observable in the DOM. Use
  the render-count probe, not mutation counting.
- Keep the ADR-0033 `IntersectionObserver` hover-scoping untouched; this task
  changes *what re-renders on hover*, not the observer's own mount/unmount
  discipline.

**Open question for the promoter.** Confirm `type: refactor` vs `bug` with the
builder before promotion if there's any doubt — the acceptance criteria and
enforcement plan are identical either way, only the verifier's framing
("prove nothing changed" vs "prove the symptom is gone") shifts.

**Resolution of the open question above (at refinement):** filed as `type: refactor` — the
contract is identical rendered output with fewer commits, and no README or ADR claim is
contradicted. Change it to `bug` before promotion if you prefer symptom-first typing; the
criteria do not move.

Split from `agentic-workflow-bmn29` at refinement (2026-09-05); the parent keeps the full
diagnosis and the residual hidden-tab scope.
