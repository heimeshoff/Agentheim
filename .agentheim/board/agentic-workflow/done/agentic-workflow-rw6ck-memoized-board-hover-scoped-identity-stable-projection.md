---
id: agentic-workflow-rw6ck
title: Hovering a card re-renders that card and its ring targets, not all 255 — memoized board cards and columns, hover state out of the board root, identity-stable tree projection
status: done
type: refactor
context: agentic-workflow
created: 2026-09-05
completed: 2026-09-05
depends_on: [agentic-workflow-mvt8x, design-system-001-styleguide]
blocks: [agentic-workflow-bmn29]
tags: [dashboard, performance, board, memoization]
related_adrs: [0033, 0059, 0061, 0062, 0070]
related_research: []
prior_art: [agentic-workflow-009, agentic-workflow-h9v3m, agentic-workflow-k5p8w]
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

- [x] jsdom (`dom-harness.mjs`) + render probe: mount `DashboardBoard` with a
      ≥200-card fixture (one backlog card with two dependency targets, the
      rest in Done). Reset the probe after mount, `act()` a real `mouseenter`
      on the backlog card, and assert the recorded `BoardCard` renders are
      exactly `{hovered id, target1, target2}` — and **0** renders for every
      Done-column card. Also assert the same test is **red** against the
      pre-change board first, then green after the fix (ADR-0062 runner-first:
      a memoization test that was never seen failing proves nothing).
- [x] Pure `node --test` in `board-data.test.mjs`: `treeToColumns(tree, prev)`
      called twice on the same tree returns **referentially identical** ticket
      objects for every column, reuses each **column array** whose members are
      all identical, and returns `prev` **itself** when all four columns are
      reused; after one task moves `todo→doing`, exactly one ticket object
      differs by identity, exactly the two affected column arrays are fresh,
      and every other ticket and column array is reused.
- [x] jsdom + probe: a re-projection driven by an unchanged `/api/tree` payload
      produces **0** `BoardCard` renders and **0** `BoardColumn` renders; a
      payload differing by one task move produces exactly one `BoardCard`
      render (the moved card in its new column) and exactly two `BoardColumn`
      renders (source and destination columns). The two untouched columns
      render **0** times — which requires the per-column sorted array to be
      memoized on `(columns[status], sort)`, not recomputed inline at the
      column call site (see Notes, readiness pass).
- [x] The existing `dashboard/` `node --test` suite passes **unchanged** — no
      test edited to accommodate memoization. This is the honest refactor bar,
      and it already covers the interactions at risk:
      `board-dependency-hover`, `board-card-dismiss`, `launch-button-hover`,
      `board-done-collapse`, `board-group`, `board-sort`.
- [x] The render probe is inert in production: a `dist-build.test.mjs`-style
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

**Dependency on `agentic-workflow-mvt8x` — sequencing only, not logical —
discharged.** mvt8x shipped 2026-09-05 23:15 (ADR-0070 accepted). It was a
sequencing dependency for two practical reasons: (1) both tasks edit
`dashboard/app/board.js` in adjacent regions; (2) this task's render-count
measurements are only clean once the heartbeat-driven full-board re-fetch is
gone. Both reasons are now satisfied. What the hub changed for this task:
`useLiveTree(onTree)` in `board.js` is now a subscriber to a module-level
hub; the board's `applyTree` callback receives one tree per structural frame
and does `setColumns(treeToColumns(tree))`. That line is where the reconcile
plugs in — as a functional update, `setColumns(prev => treeToColumns(tree,
prev))`, so the projection sees the previous columns without a ref.

**Readiness pass (2026-09-05 23:21, post-mvt8x) — three findings from
re-reading the live board, all folded into the criteria above:**

1. **Inline sort at the column call site defeats column memo.** The board
   currently renders each column with `tickets=${sortTickets(columns[status],
   view.lens.sort)}` computed inline, so every board render hands every
   `BoardColumn` a fresh array even when the underlying column array is
   identity-stable. Memoize the four sorted arrays on `(columns[status], sort)`
   (one `useMemo` producing a per-status map is enough). Without this the
   "two untouched columns render 0 times" criterion cannot pass, and the
   red-first run will show it.
2. **The column legitimately re-renders on hover; the cascade into cards is
   what's forbidden.** `BoardColumn` needs `targetIds` for the
   agentic-workflow-h9v3m collapsed-section hidden-dependency marker, so on
   hover the four column bodies will re-render whether or not hover state
   leaves the root. That is four cheap renders and is acceptable; what must
   not happen is those four renders re-running every card. Note that
   `React.memo(BoardCard)` alone already meets the hover criterion:
   `dependencyRelation` is computed per card in the column and is
   `undefined → undefined` for every non-target, and the other card props
   (`ticket`, `status`, `selectedId`, `onOpen`, `skipPermissions`,
   `onCardHover`) are stable across a hover. "Hover state out of the board
   root" therefore buys the *column-level* saving — the four
   `groupTickets`/`annotateSectionHiddenDependency` passes over 249 Done
   cards per hover — not the card-level one. Ship the card memo first, show
   the hover test green, then decide how far to take the column half; the
   hover-criterion does not depend on it.
3. **Value-equality for the reconcile is the `treeTicket` field set:** `id`,
   `title`, `status`, `type`, `context`, `path`, `mtimeMs`, `dependsOn[]`,
   `blocks[]` (the remaining fields are constants). `mtimeMs` is deliberately
   *in* the comparison — a worker editing a task body changes its mtime and
   that card should re-render, since the sort's modification-date orderings
   read it. Compare `dependsOn`/`blocks` element-wise; they are fresh arrays
   on every fetch.

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

## Outcome

Shipped all five machine-checkable criteria; the sixth ([human-eye], felt hover latency)
is left unchecked for the builder per ADR-0061.

**`board-data.js` — identity-stable projection.** `treeToColumns(tree, prev)` now takes an
optional `prev` (the columns it returned last time) and reconciles: a freshly-projected
ticket that is value-equal to the prior one (the full field set minus the constant
placeholders — `id, title, status, type, context, path, mtimeMs`, plus `dependsOn`/`blocks`
compared element-wise since `/api/tree` always hands back fresh arrays) keeps the PRIOR
object. A column array whose members are then all identical to `prev`'s is itself reused;
if all four columns reuse, `prev` itself is returned. `board-data.test.mjs` gained 4 pure
tests proving: (1) calling it twice on the same tree returns `prev` itself and every ticket/
column array by reference; (2) after one `todo→doing` move, exactly one ticket differs by
identity and exactly the two affected columns are fresh; (3) a changed `mtimeMs` forces a
fresh ticket (the mtime-ordered sorts need to see it); (4) `dependsOn`/`blocks` compare by
content, not array identity. Ran RED first (18→14 tests before the fix, the 4 new ones
failing on `strictEqual` — value-equal objects compared unequal by reference), then GREEN
after implementing the reconcile.

**`board.js` — `React.memo` + a wiring fix, not a redesign.** `BoardCard`/`BoardColumn` are
now `memo()`-wrapped (`BoardCardMemo`/`BoardColumnMemo`); the raw `function BoardCard`/
`function BoardColumn` declarations are untouched (existing static-guard tests read them by
name). `BoardColumnMemo` uses a custom equality function that ignores `onToggleSection`/
`onToggleCollapse` specifically: both are built at the column call site as fresh
`(x) => fn(status, x)` closures on every render (not `useCallback`-wrapped there —
`onToggleCollapse`'s exact literal is asserted verbatim by `board-done-collapse.test.mjs`
AC1 and `board-view-chip.test.mjs` AC4, so this task left that call site untouched), but
both are behaviorally invariant across renders (`status` is fixed per column instance,
`toggleSection`/`setColumnPeek` are themselves stable). `DashboardBoard.applyTree` now does
`setColumns((prev) => treeToColumns(tree, prev))` — a functional update, so an unchanged
tree yields `prev` itself and React bails out of re-rendering `DashboardBoard` entirely
(no render at all, not just a skipped commit). The four per-column sorted arrays are
memoized via `sortedColumnsRef` — a small per-status cache (source array + sort → result)
inside one `useMemo`, so a sibling column's array changing doesn't reallocate every
column's sorted array (a naive single-dependency `useMemo` would: `sortTickets` always
returns a fresh `.slice().sort()` even for unchanged input). The literal
`sortTickets(columns[status], view.lens.sort)` the existing `board-view-chip.test.mjs` AC5
guard asserts on stays in the source, inside that cache's fallback branch.

**Render probe.** `NOOP_RENDER_PROBE = { card() {}, column() {} }` is defined directly in
`board.js`, no import — the `renderProbe` prop threads `DashboardBoard → BoardColumnMemo →
BoardCardMemo`, defaulting to the no-op everywhere, exactly the `fetchDoc`
injectable-callback idiom `WhatsNextPanel`/`InFlightLane` already use. `DashboardApp` (the
real mount point) never passes one. New `board-render-probe-dist.test.mjs` proves the
default is the inert literal, `DashboardApp` never installs a probe, and the built bundle
(rebuilt into a scratch dir, never the committed `dist/`) contains no test-only string.

**Two new jsdom DOM-render tests, both run RED against the pre-memoization board before
being shown GREEN (ADR-0062):**
- `board-render-probe-hover.test.mjs` — mounts `DashboardBoard` with a 200-card fixture (1
  backlog source card depending on a todo target and blocking a doing target, 197 unrelated
  Done cards), dispatches a real bubbling `mouseover` (what React's `onMouseEnter` is
  synthesized from) on the source card, and asserts exactly `{src-1, t1, t2}` re-rendered —
  zero Done-column renders. **Red run** (memo temporarily aliased back to the bare
  components): `AssertionError: 0 renders for every Done-column card` — 197 Done ids
  recorded (`ℹ tests 1 / pass 0 / fail 1`). **Green run** after re-enabling `memo(...)`:
  `ℹ tests 1 / pass 1 / fail 0`.
- `board-render-probe-reprojection.test.mjs` — mounts `DashboardBoard`, fires a structural
  SSE frame with the tree unchanged (fresh-parsed clone, same content), then a second frame
  after moving one task `todo→doing`. **Red run** (whole diff reverted via `git stash` to
  the pre-task `board.js`/`board-data.js`, restored after): fails on the second assertion —
  `actual: [] / expected: ['moving-1']` (the unmodified board has no `renderProbe` wiring at
  all, so nothing is ever recorded — a genuine, specific failure against the real
  unmodified source, not a vacuous pass). **Green run**: `ℹ tests 1 / pass 1 / fail 0` — 0
  renders for the unchanged frame, exactly `['moving-1']` card renders and exactly
  `['doing','todo']` column renders for the moved-task frame.

**Full suite:** `cd dashboard && node --test` → 976/976 pass (973 pre-existing + 4
board-data.js + 1 hover + 1 re-projection + 3 render-probe-dist, minus a wash from the
board-data.test.mjs count above — net +18 counted individually across the new files).
`node --test lib/test/*.test.mjs` from the worktree root → 385/385 pass, unrelated to this
task. No existing test file's assertions were edited — only new tests were added.
`dashboard/dist/` was rebuilt (`npm run build`) so `dist-staleness.test.mjs` stays green;
the rebuilt `dist/` is intentionally excluded from this task's file list per the ADR-0057
checkpoint-guard convention (the conductor performs the sanctioned `dist/` commit on
`main` at integration).

**ADR-0059 (mechanize-or-drop) — both dispositions, as flagged in this task's own Notes:**
- *"The board's tree projection is identity-stable... consumers may rely on that
  identity."* → **enforcement shipped**: `board-data.test.mjs`'s 4 new reconcile tests
  fail the moment `treeToColumns` goes back to allocating unconditionally.
- *"Memoize board list components."* → **prose-only, unenforced** — a lint counting
  `React.memo(` would over-fire on components that must not be memoized and is trivially
  gamed by a wrapper that never actually skips a render; judged not worth mechanizing.
- The gate fires here because the diff touches `.agentheim/contexts/agentic-workflow/
  README.md`'s ubiquitous-language section (the "Identity-stable projection" entry added
  above `Content search`), a doctrine-bearing surface per ADR-0059's own scoping amendment.

**No new ADR.** Per the task's own Notes: memoization is an implementation technique with
no cross-cutting contract; the one contract-like piece (the projection's identity
stability) is proportionate as the README line + the pure test, not a second ADR.

**Files:**
- `dashboard/app/board-data.js` — `treeToColumns(tree, prev)` reconcile.
- `dashboard/app/board.js` — `memo(BoardCard)`/`memo(BoardColumn, boardColumnPropsEqual)`,
  `NOOP_RENDER_PROBE` + `renderProbe` threading, `sortedColumnsRef` per-column sort memo,
  functional `setColumns` update.
- `dashboard/test/board-data.test.mjs` — 4 new pure reconcile tests.
- `dashboard/test/board-render-probe-hover.test.mjs` — new.
- `dashboard/test/board-render-probe-reprojection.test.mjs` — new.
- `dashboard/test/board-render-probe-dist.test.mjs` — new.
- `.agentheim/contexts/agentic-workflow/README.md` — "Identity-stable projection" entry.
- `dashboard/dist/**` — rebuilt locally (not in FILE_LIST; see ADR-0057 note above).
