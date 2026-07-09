# Agentic Workflow

## Purpose

The one bounded context of Agentheim: running a domain-driven, human-in-the-loop agentic
workflow on top of Claude Code. Everything the tool does — turning an idea into a vision,
a vision into a modeled backlog, and a backlog into committed code — happens here. There
is no second context to map against; the workflow *is* the domain.

## Classification

**core** — this is the product. There is nothing supporting or generic to factor out yet;
if a cross-cutting infrastructure concern ever earns its own home, it would split off as a
separate BC, but today the whole tool lives in this one.

## Actors

- **Builder** — the single human user. Drives every Socratic dialogue, reviews every gate,
  and is never bypassed: no code without a no-code brainstorm first, no `work` without
  reviewed tasks, escalation on repeated verification failure.
- **Internal machinery (not external actors)** — the `orchestrator` (router, never writes
  code), the specialists (`strategic-modeler`, `tactical-modeler`, `architect`,
  `researcher`, `worker`), and the two adversarial gates (`verifier`, `research-reviewer`).
  They are how the context does its work, not parties it serves.

## Ubiquitous language

> **Note on this section.** Consolidated in place 2026-07-03 (agentic-workflow-w7q2m, ADR-0041)
> from 1006 lines: per-feature narration chains were folded into settled summaries. Every term
> and invariant below survived; only historical blow-by-blow detail was compressed.

- **Skill** — a natural-language-triggered capability: `brainstorm`, `modeling`,
  `research`, `work` (plus doctrine docs: TDD, verification-before-completion,
  research-review). Triggered by phrasing, not slash commands.
- **Slash-command exception (`/dashboard`)** — the **single, deliberate** departure from the
  "phrasing, not slash commands" rule above (decided agentic-workflow-011). The dashboard is a
  process-launcher, not a Socratic dialogue, so a literal slash command (`/dashboard`,
  `/dashboard stop`, `/dashboard status`) is the right surface. Documenting the exception here
  keeps the principle intact: skills stay phrase-triggered; `/dashboard` is the named carve-out,
  not an erosion. The command file (`commands/dashboard.md`) is a thin trigger that passes the verb
  straight through to the one cross-platform launcher `dashboard/launch.mjs` — all OS-divergent
  spawn/kill/open logic stays there (ADR-0002). See *Dashboard* under Key commands.
- **Mode** — one of six conversational stances (Interrogator, Suggestor, Challenger,
  Storyteller, Facilitator, Synthesizer) for `brainstorm` and `modeling`. Serves model
  quality; switchable mid-session.
- **Vision** — the strategic root artifact: what's being built, for whom, why.
- **Bounded context (modeled)** — a domain area *in the builder's project*, given a
  `contexts/<name>/` folder. (Note the recursion: this README is itself such a folder, for
  Agentheim's own domain.)
- **Task** — a unit of work as a markdown file with frontmatter, moving through a
  lifecycle. `type`: feature | bug | refactor | chore | spike | decision.
- **Orchestrator / Specialist** — the router agent and the focused agents it delegates to.
  The orchestrator never writes code or does deep modeling itself. Distinct from the
  **conductor**: the non-code-writing driving loop of the `work` skill itself (scan the
  DAG, dispatch worker subagents, commit, log) — a role the session plays, not an agent
  the orchestrator can route to.
- **Adversarial gate** — a fresh-context skeptic with no exposure to the producer's
  reasoning, judging the producer's output. `verifier` audits a worker's diff before
  commit; `research-reviewer` re-verifies a report before it's citable. A deliberate,
  recurring motif.
- **ADR** — Architecture Decision Record, global or BC-scoped; flows through the backlog as
  `type: decision`.
- **Protocol** — the chronological project diary, newest on top; every action appends.
- **Index** — a flat catalog (`knowledge/index.md` + per-BC `INDEX.md`) that *points*,
  never duplicates. The memory layer for prior-art and dependency lookup.
- **Commit doctrine** — every skill that produces `.agentheim/` markdown commits its own
  artifacts, scoped, so the working tree is clean after any session (ADR-0026). `work` folds
  the task-move + `INDEX.md` + `protocol.md` + ADR-backlink bookkeeping into the task's
  integrating commit **before** committing (no post-commit write); `modeling` / `quick-capture` /
  `brainstorm` each commit the `.md` they wrote at end-of-action. Every commit is a **scoped
  `git add`** of only that skill's own files — **never `git add -A`** — load-bearing because
  `modeling` can run concurrently with `work`. A task's commit is found in `git log` via the
  `[<task-id>]` message trailer; there is **no `commit:` frontmatter field** (ADR-0026 dropped
  the SHA chicken-and-egg). One task = one commit, with a bounded **trivial-squash carve-out**
  for a same-BC / same-files / no-behavior-change / same-batch wave of follow-ups. At session
  end `work` **reconciles stranded carry-over**: `git status --porcelain` surfaces every
  stranded file with an explicit per-file disposition (commit deliberately, or leave with a
  named owner) — never auto-swept, never assumed. See ADR-0026, ADR-0017, ADR-0007.
- **Per-worker git worktree isolation (ADR-0032, agentic-workflow-f6m2q)** — every parallel
  `work` worker runs in its own git worktree at `<repo-root>/.worktrees/<task-id>/` on a
  private branch `aw/<task-id>`, gitignored and outside `.agentheim/`. A **batch-start claim
  commit** moves the whole batch `todo → doing` first (the one deliberate ADR-0026 amendment:
  this half of the lifecycle move rides its own commit) so each worktree's base already holds
  its task in `doing/`; the conductor makes an ephemeral `wip` commit per iteration. The
  verifier's diff/test run are scoped to `git -C <worktree> show HEAD`, so a sibling's changes
  are structurally absent. On PASS/SKIP the conductor `git merge --squash`es the branch onto
  `main`, folds in the usual bookkeeping into **one** commit, then tears the worktree down;
  `RESULT: BOUNCED` gets the same treatment with no verifier (ADR-0037). On FAIL, `main` needs
  no rollback by construction; the worktree is reused across re-dispatch and, on iteration 3,
  **kept** for inspection. A real merge-back conflict aborts with `git reset --hard HEAD`
  (**not** `git merge --abort`, which errors on a squash merge) and surfaces to the user. Tasks
  touching `dashboard/` get a lazily-created `node_modules` junction/symlink to the main tree's
  one copy (`lib/worktree-node-modules.mjs`); **removing that link is mandatory before `git
  worktree remove`** — skipping it silently deletes the shared `node_modules`. Session-end
  reconciliation and recovery both walk `git worktree list --porcelain` alongside `git status
  --porcelain`. See ADR-0032, ADR-0037, ADR-0026, ADR-0007, ADR-0017, ADR-0028.
- **Vision-conformance check (session-end, ADR-0040, agentic-workflow-v6d4n)** — a bounded
  advisory pass folded into `work`'s end-of-run reporting, closing the Why→What loop. It reads
  exactly two named `vision.md` sections ("What success looks like", "Non-goals") plus the
  batch's completed-task summaries, and asks one judgment question per shipped task: does it
  pull toward a non-goal or away from a success criterion? It **never blocks** — always a
  `**Vision-conformance:**` protocol line, and, only when a flag is worth attention, an
  (over)write of the same single-latest `.agentheim/state/whats-next.md` artifact `whats-next`
  writes. LLM judgment is exercised by `evals/vision-conformance-check/`'s fixtures; the
  deterministic extraction/formatting halves are unit-tested.
- **README consolidation trigger / CONSOLIDATE (ADR-0041, agentic-workflow-w7q2m)** — a BC
  `README.md` at or over **~600 lines** has crossed the point where it can no longer reliably
  be read in one pass (this BC's own README, at 1006 lines, was the case that forced this
  decision). `whats-next` surfaces an over-threshold BC as a recommended-move line (`README
  <bc> is over the consolidation threshold — consolidate`); no skill auto-rewrites prose
  unattended. The `modeling` skill's fifth action, **CONSOLIDATE**, does the rewrite **in
  place**, builder-in-the-loop: merges redundant ubiquitous-language entries, folds superseded
  per-feature narration into settled summaries, never silently drops a term or invariant, never
  breaks a backlink. This is the **flag-and-consolidate** discipline (judgment, in-place, no
  archive) — the deliberate opposite of the k5n8f family's **cap-and-roll** (verbatim, scripted,
  archived) used for the protocol (ADR-0039). See ADR-0041, ADR-0022, ADR-0026, ADR-0027,
  ADR-0017.
- **Tree projection** — the single read model every dashboard view and the SSE consumer rebuild
  from. `GET /api/tree` (`dashboard/tree.mjs`, agentic-workflow-005) walks `.agentheim/` and
  returns, per BC, its four lifecycle folders, each task's frontmatter projection (`id, title,
  status, type, context, path, mtimeMs, dependsOn, blocks`), and the *locations* of vision /
  context-map / BC READMEs+INDEXes+concepts / ADRs / research — pointers and metadata only,
  never document bodies. ADR/research locations carry an additive `mtimeMs` meta map so the
  read-only dashboard can distinguish a modified doc from an untouched one (stat failure
  degrades to `mtimeMs: null`). `project.name` is parsed from `vision.md`'s heading — the one
  projection value drawn from a document body rather than frontmatter. `dependsOn`/`blocks`
  are raw, unresolved id arrays (resolved client-side, pooled across BCs). Every read is
  loss-tolerant: missing/malformed frontmatter falls back to folder/BC name. Document bodies
  are carried separately by `GET /api/doc?path=<in-root path>`. Both endpoints are pure reads,
  share the `startsWith(root)` guard. See ADR-0002.
- **Content search** — `GET /api/search?q=<term>` (`dashboard/search.mjs`, agentic-workflow-050,
  ADR-0023) is the read-only server's first endpoint to open document *bodies* in bulk: a pure
  walk/rank/excerpt core (stdlib-only, loss-tolerant, mirroring `tree.mjs`). Returns `{ query,
  results: [...] }`, matching **title + body only** (frontmatter never searched),
  case-insensitive substring. The corpus is single-sourced from the tree projection (Bounded
  contexts → Concepts → Decisions → Research → Tickets), so a new artifact kind becomes
  searchable for free. Ranking is title-hits-first, then fixed category order. Results carry
  the existing open-intent shapes (ADR-0021). An empty/short (`< 2` char) query returns no
  results with no walk. Pure read, writes nothing (ADR-0017). The topbar UI that consumes it is
  under *Global search* below.
- **Dashboard frontend app** — the live dashboard UI, owned by this BC, living in
  `dashboard/app/` (entry `dashboard/app/app.js`). It *consumes* the design-system styleguide
  source across the BC boundary (`Column`/`TicketCard`/`ColumnHeader`/`EmptyColumn`/`html`
  as-is, never forked) so the styleguide stays the single source of UI truth (ADR-0003).
  esbuild bundles this app into the committed `dashboard/dist/` the static handler serves; the
  styleguide canvas remains a separate buildless review surface. The three original view tasks
  — **board** (agentic-workflow-006), **slide-over** (aw-007), **library/navigation** (aw-008)
  — compose into this one app shell (see *Shell layout* below for the current rail/topbar
  composition). See ADR-0009, ADR-0011.
- **Board view** — the dashboard's home view (agentic-workflow-006): a **flat** Kanban of the
  four lifecycle columns (`backlog`/`todo`/`doing`/`done`) pooling tasks from **all** bounded
  contexts — no swimlanes; each card carries its BC via the styleguide `context` chip. Rendered
  over the live tree projection; a status-driven, loss-tolerant transform
  (`dashboard/app/board-data.js`) buckets each task by status (unknown status → backlog).
  **Read-only** (ADR-0017): clicking a card emits an *open-this-task* intent the slide-over
  consumes; the board never writes a lifecycle move. It stays **live** via the SSE stream,
  re-fetching `/api/tree` on any change. Backlog cards carry a *Refine / Promote* launch pair
  (see below) to seed `modeling` commands. See ADR-0009, ADR-0017.
- **Board-wide sort + grouping — the "View" chip** (agentic-workflow-012/014, rebuilt
  **board-wide** by agentic-workflow-c2ver per the ADR-0015 amendment landed by
  agentic-workflow-qf945): ONE `ViewChip`, composed on the shared `Menu` primitive (ds-015)
  unforked, drives sort + group-by-bounded-context **identically for all four lifecycle
  columns** — no column keeps an independent affordance. The chip's trigger summarizes the
  live choice ("Recently modified" / "Recently modified · grouped by context"). Orderings:
  **Name** asc/desc and **Modification-date** desc/asc (per-task `mtimeMs`); default is
  modification-date descending. `dashboard/app/board-sort.js` (`sortTickets`, unit-tested) is
  a **pure** function run board-side after `treeToColumns`; ties break by `id` ascending,
  absent/`null` `mtimeMs` sorts oldest, never a throw. Toggling group **on** partitions each
  column's cards into per-BC sections (header = BC name + card count; empty BCs render no
  section; sections sort BC-name ascending); each section is independently **collapsible**,
  **per column** (unchanged granularity — see the next bullet). Pipeline is **project → sort
  (board-wide, board-sort.js) → group (board-wide, board-group.js) → per-column collapse/peek
  applied locally** — grouping only partitions, never re-orders, so sort semantics hold inside
  each section. `groupTickets` (`dashboard/app/board-group.js`, unit-tested) is **pure**. Both
  the sort and grouped choice **persist** across reloads in the versioned `localStorage`
  view-state store as ONE board-wide `lens` (ADR-0015 amendment); a board with no stored lens
  defaults to flat + default sort. The collapsible section header is board-local (the
  styleguide `TreeGroup` primitive doesn't fit externally-persisted collapse state on
  `TicketCard`s — flagged as design-system-005 for a shared primitive). See ADR-0015,
  ADR-0009, ADR-0003.
- **Collapsible Done column** — the **Done** column (the one column that grows unbounded)
  carries a board-only **collapse/peek** control (agentic-workflow-m2v8d, replacing aw-072's
  hide control), a sibling of the sort/group controls (ADR-0003). A **double-chevron glyph
  swap** (`chevrons-up` expanded ⇄ `chevrons-down` collapsed, not a CSS rotate) toggles a
  **height-clamped peek** of the most-recent completions — `max-height` ≈3.5 average cards +
  `overflow: hidden` + a bottom `mask-image` gradient fade (a visual height target, not a node
  count). The clamp is **orthogonal to grouping**: one `max-height` on the whole column body,
  never per-section. **Expanded by default**; the choice persists via the board view-state
  store (the additive `peek` boolean). Collapsing is **presentation-only** — no `/api` write,
  Done's tasks still exist on disk (ADR-0017/ADR-0001). The clamp is derived at render by the
  pure `peekClampStyle` (`board-view-state.js`, unit-tested). See ADR-0015, ADR-0017, ADR-0003.
- **Hover dependency ring — "pulse what's rendered"** (agentic-workflow-k5p8w, building on the
  `dependsOn`/`blocks` raw id arrays the projection carries and the styleguide's directional
  ring, design-system-w4t9k / ADR-0034): hovering a **backlog** or **todo** card resolves its
  edges against the **full pooled ticket set** and rings each currently-rendered target —
  **solid** for a `depends_on` target (waiting-on), **dashed** for a `blocks` target
  (holding-up). Only backlog/todo cards are a hover *source*; a target can be any status. The
  resolution is a **pure** function, `resolveHoverDependencies`
  (`dashboard/app/board-dependencies.js`, unit-tested): dangling ids drop silently, ids dedupe,
  the hovered card's own id excludes, and a malformed id present in both lists resolves
  **waiting-on wins** (never a throw). The React glue (`hostHover` idiom, `board.js`) is thin,
  untested DOM wiring — transient, client-side only, never persisted (ADR-0017). Deliberately
  **excludes** collapsed-group markers, Done-peek markers, and off-viewport edge blinks — that's
  the next entry's layer. See ADR-0002, ADR-0003, ADR-0017.
- **Hidden and off-viewport dependency markers — "signal what isn't [rendered]"**
  (agentic-workflow-h9v3m, closing the gap k5p8w left, consuming design-system-b7n2s's
  primitives): the same hover session classifies every resolved target id into one of three
  states. **(1) Hidden in a collapsed group** — a pure, data-layer derivation, no DOM
  (`annotateSectionHiddenDependency`/`donePeekHasHiddenDependency`,
  `dashboard/app/board-dependency-groups.js`), flagging a collapsed section or peeked Done
  column holding a target id, wired onto the section header. **(2) Visible vs. off-viewport** —
  an `IntersectionObserver` on the app's sole scroll container, mounted only for an active
  hover, classifies a rendered-but-not-intersecting target **above/below** via the pure
  `classifyEdge(rect, rootBounds)`, driving a board-built edge indicator pinned to the scroll
  container's edge (scroll-reactivity is free). **(3) Done-peek refinement** — one bounded rect
  check against the clamp body tells "genuinely below the clamp" from "still visible". Every
  read is **transient hover-scoped presentation state only** — no disk write (ADR-0033 pt. 4).
  The data layer is fully `node --test`-covered; the observer wiring is untested DOM glue. See
  ADR-0033, ADR-0017, ADR-0014, ADR-0029.
- **Persisted board view-state (v2, board-wide lens)** — persisted across reloads in a
  **single versioned `localStorage` store** (`dashboard/app/board-view-state.js`, key
  `agentheim.board.viewState`; agentic-workflow-014/aw-c2ver, ADR-0015). `VIEW_STATE_VERSION`
  is **2**: the store now carries two independently-scoped pieces — a **board-wide `lens`**
  (`{ grouped, sort }`, ONE choice for the whole board, driven by the single ViewChip) and
  **`columns`** (the per-`(column, BC)` `collapsed[]` section state + the Done `peek` flag,
  retained at their original column-scoped granularity). This **reverses** ADR-0009's
  "in-session only, no `localStorage`" clause, but the reversal is bounded to **presentation
  view-state** — the store never records lifecycle truth, which stays a pure projection of disk.
  **Dormant retention**: flipping the board-wide `grouped` flag off then back on does NOT clear
  a column's stored `collapsed[]` — it goes dormant while flat and reappears intact once
  grouping is re-enabled, because `collapsed[]` lives entirely under `columns`, untouched by the
  lens. **Hard reset on version mismatch**: a blob at any version other than `2` — including the
  retired v1 per-column shape, a stale/malformed/absent blob — degrades WHOLESALE to board-wide
  defaults (flat + default sort; every column's `collapsed: []`, `peek: false`), never a throw,
  and never a field-by-field migration attempt (deliberate, per the ADR). See ADR-0015, ADR-0001.
- **Persisted theme choice (light/dark toggle)** — the dashboard consumes the styleguide's
  "dark-first with a light toggle" `ThemeToggle` **unforked** (ADR-0003), living in the topbar
  **settings menu**, feeding `ThemeCtx.Provider` and a `data-theme` effect animated by the
  styleguide `theme-fade` transition. Resolution + persistence is a **separate** versioned
  `localStorage` store (`dashboard/app/theme-state.js`, key `agentheim.dashboard.theme`), same
  safe-degradation shape as the view-state store. **First visit** (no stored override): OS
  `prefers-color-scheme` wins; once toggled, the override is remembered. A malformed/absent
  blob degrades to the system default; the resolved theme is read once on mount so an SSE
  re-projection never resets it mid-session. See ADR-0015, ADR-0009, ADR-0003.
- **Persisted skip-permissions armed toggle** — a control in the topbar **settings menu**
  (agentic-workflow-049; introduced aw-021), **off by default**, that when **armed** makes
  **every** bridge launch (Quick Capture / Modeling / Inquire / Research, Work, and the
  per-card Refine/Promote/Dismiss pair) request a skip-permissions session: `launchOrCopy`
  threads an optional `skipPermissions` flag through its one shared seam, POSTing
  `{ prompt, skipPermissions: true }`; the bridge (infrastructure-016) seeds
  `claude --dangerously-skip-permissions "<prompt>"`. When **off** the field is **omitted,
  never sent `false`**, byte-identical to unarmed. The armed choice lives in its own versioned
  `localStorage` store (`dashboard/app/skip-permissions-state.js`, default OFF) whose every
  degraded path resolves to **OFF**, never a throw, never on — presentation view-state only
  (ADR-0017/ADR-0001), carrying an **armed/danger** `--obligation` treatment (ADR-0003, never
  the reserved `--accent-ochre-soft`, ADR-0016) so it never reads as neutral. Per **amended
  ADR-0018**, when armed **each** launch button also tints its icon `--obligation`, reflecting
  the armed toggle state, never a live bridge probe; the **clipboard fallback never carries the
  bypass** (startup-only). See ADR-0019, ADR-0018, ADR-0016, ADR-0003, ADR-0015, ADR-0017,
  ADR-0001.
- **Backlog card launch pair (Refine / Promote)** — a backlog ticket invites two real next
  actions: **deepen** it or **mark it ready**. Each backlog card surfaces both
  (agentic-workflow-022) as a **two-button launch group** in the styleguide `TicketCard`'s
  `cornerAction` slot (design-system-006). **Refine** (primary) seeds `/agentheim:modeling
  refine <id>`; **Promote** (quiet) seeds `/agentheim:modeling promote <id>` — explicit verbs
  matching `modeling`'s routing, **backlog-only** since Promote only ever runs backlog → todo.
  Each button opens a real interactive Claude session through the VS Code **bridge**
  (ADR-0018), falling back **silently** to a clipboard copy when absent (`launchOrCopy`, shared
  with every other launch). Command strings are pure functions of the id
  (`refineCommandFor`/`promoteCommandFor`, `dashboard/app/modeling-command.js`, unit-tested).
  The **add-ticket affordances are backlog-only** too (agentic-workflow-018): `EmptyColumn`'s
  "Add ticket" and `ColumnHeader`'s `+` are optional slots keyed off `onAdd` (default OFF) —
  the board is a projection of disk (ADR-0001). See ADR-0018, ADR-0003, ADR-0009, ADR-0001.
- **Board card dismiss (hover-revealed trash can)** — a **backlog** or **todo** ticket
  sometimes just needs to go away. Each such card carries a **red trash-can button** in its
  **top-right corner** (agentic-workflow-048): hidden at `opacity: 0`, revealed on hover or
  focus. **Backlog + todo only** — doing/done never show it (DISMISS refuses those states,
  ADR-0022). It's a board-local overlay, not the `cornerAction` slot (Refine/Promote's home) —
  `TicketCard` stays **unforked**. The trash glyph (design-system-017) is `--obligation`-tinted
  (ADR-0016). Clicking opens the shared **`ConfirmDialog`** (design-system-018, unforked) with
  `destructive=true`; **Confirm** fires `/agentheim:modeling dismiss <id>` (`dismissCommandFor`,
  unit-tested) through `launchOrCopy`; Cancel/Esc/scrim-click close it with no effect. The
  board is **read-only** (ADR-0017): the button only *seeds-and-fires* — the spawned `modeling`
  session runs the full **cascade** dismiss with its own re-confirmation of the dependent
  subtree (ADR-0022). Threads the armed `skipPermissions` signal (agentic-workflow-051) like
  every other launch. See ADR-0022, ADR-0017, ADR-0018, ADR-0019, ADR-0003, ADR-0016.
- **Board prompt bar — the docked two-row console (Quick Capture / Modeling / Inquire /
  Research / Plain)** — rebuilt (agentic-workflow-bz3az) from aw-023/aw-065/aw-068's board-flow
  "Prompt" title + row of flat launch cards into the 1b **docked bottom-center console**, then
  conformed exactly to Section 1b's layout by agentic-workflow-q7r3x, then given a **fifth mode,
  Plain**, by agentic-workflow-m3vhq:
  `position: fixed`, ~780px, a raised `--surface-1` panel at the `--shadow-lg` elevation, above
  the board in z-order — so it never pushes board content and stays put through the aw-067
  `scroll-quiet` scroll. Two rows, separated by a horizontal `--hairline` divider: a **top row of
  FIVE EDGE-TO-EDGE, equal-width mode-tab cells** (`PromptModeTab`, one per `PROMPT_MODES` entry —
  Quick Capture · Modeling · Inquire · Research · Plain, each a name + one-line meaning), no
  inter-cell gap, no horizontal panel padding on the row — the panel's own `overflow: hidden` +
  `border-radius` clip the row's two end cells to the shell's rounded corners instead. A thin
  `--hairline` divider sits on the trailing edge of every cell but the last. Subtitles read,
  lowercased and fuller: *file it fast, no ceremony* (Quick Capture) · *shape into structure*
  (Modeling) · *ask the codebase* (Inquire) · *dig deeper* (Research) · *straight to Claude, no
  skill* (Plain). Glyphs are the concrete design-system-xr4sb set, consumed unforked (ADR-0003)
  from `styleguide/app/icons.js`: `plus` (Quick Capture) · `diamond` (Modeling) ·
  `message-circle-question` (Inquire, its deliberate design-system-r4k8m glyph, unchanged) ·
  `circle-dot` (Research) — `diamond`/`circle-dot` replace the undeliberate `compass`/`search`
  defaults Modeling and Research previously wore — · `bot` (Plain, an existing glyph reused, no
  new icon). The **bottom row** carries a bright, bold ochre `❯` chevron, a genuinely
  **multi-line auto-growing** `<textarea>` (soft-wraps, grows to a max then scrolls — aw-038's
  growth band, unchanged), a `↵` keyboard hint, and the styleguide's **`EnterButton`** primitive
  (`styleguide/app/button.js`, ADR-0003, consumed unforked) — the solid-`--accent-ochre`
  icon-square with the `corner-down-left` (`↵`) glyph drawn in the dedicated `--accent-ochre-fg`
  on-accent legibility token, wrapped in a plain `<span title=...>` (not a fork) so the tooltip
  can still reflect the live seeded command, **or** (agentic-workflow-m3vhq) the reason it can't
  fire yet.
  - **Keyboard-committed selection model (ADR-0050, amended by agentic-workflow-p8k4d,
    agentic-workflow-m3vhq, and agentic-workflow-aqyqd, `dashboard/app/prompt-mode.js`)** — the
    five modes carry a single committed `highlightedMode` **index**, not five independent
    booleans: `PROMPT_MODES` (fixed order, each `{label, subtitle, icon, commandFor}` — no
    `requiresPrompt` key on any entry; aqyqd retires it, see below), `clampPromptModeIndex` (the
    one in-range guard every call site uses,
    now bounding `0..4`), `nextPromptModeIndex(current, direction)` (total, wrapping cycle —
    Ctrl+→ past Plain wraps to Quick Capture, Ctrl+← before Quick Capture wraps to Plain), and
    `promptBarKeyIntent(event)` (classifies every keydown into exactly one of **launch** — bare
    Enter OR Ctrl+Enter (p8k4d: bare Enter now launches, reversing aw-038's original swallow
    rule; Ctrl+Enter is kept as a harmless alias) — **newline** — Shift+Enter, regardless of Ctrl
    (p8k4d, new: lets the textarea insert its own line break natively, retiring aw-038's
    single-logical-line collapse — `sanitizePromptLine` is deleted, the field stores its raw
    value) — **cycle** — Ctrl+←/→ — or **pass-through**, so no keystroke is ever double-handled;
    **untouched by m3vhq** — bare Enter on an empty Plain prompt still classifies as `launch`).
    Defaults to Quick Capture (index 0) on mount and **resets to 0 after every successful
    launch**. **Two orthogonal channels:** the committed highlight changes only on a deliberate
    act — a tab click, or Ctrl+←/→ — hover is a separate, transient, presentation-only channel
    that never reads or writes it. **p8k4d reverses click-to-launch:** clicking a tab now **only**
    moves the committed highlight; it no longer fires anything. The ONE `fire(modeIndex)`
    function in `BoardPromptBar` is now reached only by bare Enter, Ctrl+Enter, or the Enter
    button — all three behaviourally identical: the same seeded command (reached via
    `PROMPT_MODES[i].commandFor(prompt)`), the same `launchOrCopy` bridge-or-clipboard path, the
    same armed `skipPermissions` thread, the same `onResult` clear-textarea + confetti +
    highlight-reset. **Ctrl+Space** (p8k4d, new) focuses the prompt `<textarea>` from anywhere on
    the board via a window-scoped `document` keydown listener (registered/torn down in a
    `useEffect`). **Decline-to-launch, generalized to every mode (introduced Plain-only by
    agentic-workflow-m3vhq, generalized by agentic-workflow-aqyqd — ADR-0050's third
    amendment)** — the prompt bar is a prompt console: with no prompt there is nothing to send,
    in **any** mode, not just Plain. The one predicate `canFirePromptMode(index, prompt)` decides
    this — `true` exactly when the trimmed prompt is non-empty, for every index alike (`index` is
    kept in the signature for call-site/test stability but is deliberately **unread** — the
    `requiresPrompt` per-mode flag m3vhq introduced is **retired entirely**, not set `true` on all
    five entries: once there is no exception, the per-mode axis is a fiction) — consulted by
    **both** `fire()`'s guard (a decline is a true no-op: no bridge call, no clipboard, no
    confetti, no textarea clear, no highlight reset) **and** the Enter button's `disabled` state
    (the styleguide `EnterButton`'s `disabled` prop, design-system-tfhn6, consumed unforked —
    never a `pointer-events` fake). When disabled, the tooltip/`aria-label` read *"Type a prompt
    to launch \<Label\>"* for whichever mode is highlighted, rather than rendering an empty/bare
    command string. The four legacy modes' bare-command constants
    (`QUICK_CAPTURE_COMMAND`/`MODELING_COMMAND`/`INQUIRE_COMMAND`/`RESEARCH_COMMAND`,
    `modeling-command.js`) and their empty-prompt degrade branches are **left in place** —
    correct, pure, unit-tested — but are now unreachable from the board (bare sessions launch
    from the terminal instead); each constant carries a comment recording this so a later reader
    doesn't "restore" the bare launch by accident. `prompt-mode.js` is a fifth pure,
    framework-free, `node --test`-covered module in the `board-sort.js`/`board-group.js`/
    `search-results.js` family.
  - **Paint (ADR-0051 amending ADR-0048; ADR-0016 for the rest)** — the highlighted tab alone
    wears the bounded ochre wayfinding exception, now (agentic-workflow-q7r3x) a **filled cell
    background** (`--surface-2`) **plus a full-width ochre bottom inset underline**
    (`--accent-ochre` text, the nav-rail idiom turned into a horizontal underline) — replacing
    the earlier rounded-pill-with-gaps look that read as a four-sided ochre box rather than a
    wayfinding underline. This is the **second** surface ADR-0048's carve-out names, beside the
    nav-rail active item — Plain's tab (agentic-workflow-m3vhq) follows the identical rule, no
    new paint decision. The other, non-highlighted tabs de-emphasize by opacity (ADR-0016's
    unchanged default) — no ring, no new hue, no cell fill. The Enter button is the styleguide's
    `EnterButton` primitive (ADR-0003), which owns its own already-licensed ADR-0048 "primed
    primary action" paint (a solid `--accent-ochre` fill, the `corner-down-left` glyph in
    `--accent-ochre-fg`) plus (design-system-tfhn6) its own `disabled` de-emphasis by opacity
    (`0.55`, `--accent-ochre` fill kept literal) — board.js no longer re-implements any of it
    locally.
  - Every launch opens a real interactive Claude session through the VS Code **bridge**
    (ADR-0018): `GET /api/bridge` (infrastructure-014) discovers the listener, `GET /health`
    confirms it, `POST /run { prompt }` fires it. **Bridge-absence is a normal mode, never an
    error** — any failure falls back **silently** to a clipboard copy with the same quiet
    "Copied" feedback, via the same pure `launchOrCopy` (`dashboard/app/bridge-launch.js`) every
    other launch button shares. Launching a session is an **external side-effect**, not a
    lifecycle write (ADR-0001). `WhatsNextPanel` no longer composes inside this bar (it would
    float inside the fixed overlay) — it renders directly in `DashboardBoard`, in-flow, above the
    `BoardHeader` count strip, its dismiss/SSE wiring unchanged. See ADR-0050, ADR-0051,
    ADR-0048, ADR-0018, ADR-0016, ADR-0003, ADR-0001, ADR-0009.
- **`WhatsNextPanel`** (aw-073 / ADR-0027; dismiss rewired to a bounded on-disk delete by
  aw-vmk1z / ADR-0046; rebuilt into a numbered **flight-plan stepper** by agentic-workflow-a2pm1
  / ADR-0048; hoisted out of the now-fixed `BoardPromptBar` by agentic-workflow-bz3az) — renders
  directly in `DashboardBoard`, **above** the `BoardHeader` count strip: the dashboard half of
  the What's next feature, reading the single-latest advisory artifact
  (`.agentheim/state/whats-next.md`)
  through the existing `/api/doc` body carrier. It is a **glanceable advisory card, not a
  document**: the leading YAML is stripped, and the three named body sections (*where things
  stand* / *recommended move* / *next*) render as **three NUMBERED, CONNECTED steps** — a
  horizontal connector row of numbered circles above three height-capped CARDs (each scrolling
  its own overflow), one card per step — so the strip never pushes the board down. Both the
  circle numbering and the step-2 hero are **position-based, not text-matched**: step 2 (the
  *second* parsed column, whichever section actually lands there) wears the licensed
  `--emphasis-border` hero carve-out (a named token border + matching shadow, ADR-0048) — no
  other surface in the region carries it. Split by the pure, loss-tolerant
  `splitWhatsNextSections` (`dashboard/app/whats-next-state.js`) — a degraded body just yields
  fewer circles/cards, never an invented step; each card renders its content through the
  unforked styleguide `Markdown` primitive. Re-fetches on every SSE `tree-changed` frame, shows
  a staleness cue from the `generated` timestamp (render-only), and is **dismissible** —
  dismiss now issues `DELETE /api/whats-next`
  (`dashboard/whats-next-delete.mjs`), the dashboard's one bounded write exception to ADR-0017
  (ADR-0046, amending ADR-0027 §4.5): no request body, no client-supplied path, the target
  derived server-side and asserted against the one allowed absolute path by **exact string
  equality** (never a prefix match — a `state/` prefix would also match the sibling
  `state/in-flight.json`) before any `unlink`; idempotent (`204`, already-absent is success,
  never `404`). The click optimistically clears the local body (`setBody(null)`) and disk
  convergence (unlink → SSE `tree-changed` → re-fetch `404`s → renders nothing) is the durable
  truth behind it. The former `localStorage` dismiss store (`loadDismissed`/`saveDismissed`/
  `isDismissed`) is **retired entirely** — disk presence/absence is now the sole source of
  dismiss truth. Every degraded path (absent/malformed artifact) resolves to "render nothing",
  never a throw.
- **`InFlightLane`** (agentic-workflow-m9w5c / ADR-0043) — sits below the board header, above
  the columns: renders **live observability** for a running `work` batch — how many
  workers/verifiers have run this session, and since when. Reads a SECOND advisory artifact
  (`.agentheim/state/in-flight.json`, the ADR-0027 category extended by ADR-0043) through the
  same `/api/doc` carrier `WhatsNextPanel` uses. Unlike `whats-next.md` (written by a skill's
  prose), this artifact is written by real Claude Code **`Stop`/`SubagentStop` command hooks**:
  a `Stop` hook in `skills/work/SKILL.md`'s own frontmatter heartbeats it every orchestrator
  turn while `work` is active, and a `Stop` hook in each of `agents/worker.md` /
  `agents/verifier.md`'s frontmatter (auto-converted to `SubagentStop` when that subagent
  completes) records `{agentType, agentId, completedAt}`. The pure transition core
  (`lib/agent-heartbeat.mjs`) and the dashboard-side reader (`dashboard/app/in-flight-state.js`)
  share ONE crash-safety rule: a heartbeat older than the staleness window (5 minutes) is
  treated as a dead session — the hook starts a fresh record, and the panel renders **nothing**
  rather than a zombie lane surviving a crashed/killed session. Read-only over the artifact
  (ADR-0017) — only the hooks write it; the panel never does. Deliberately does **not** touch
  the existing doing-column pulse (`doingPulseClass`, design-system ADR-0014) — a different,
  already-shipped, cross-BC signal this feature leaves untouched. See ADR-0043, ADR-0027,
  ADR-0017, ADR-0014.
- **Shell layout (aw-026, styleguide §05)** — the live shell is the styleguide "Components in
  context" full-height **left rail** beside a **main column**: a ~52px **topbar** (the global
  **search field**, aw-052 — plus two standing launches: ochre-CTA **What's next** and primary
  **Work**) over the scrollable board. **Work** launches the bare `/agentheim:work` via
  `launchOrCopy`, `emphasis="primary"`, threading `skipPermissions`; as of **aw-064** it renders
  `Work ↗` with the glyph trailing the label. **What's next** (aw-064; recolored **aw-vk6mc**)
  fires the bare `/agentheim:whats-next` through the same path — the read-only `whats-next`
  skill, which itself performs **one** *advisory write* (ADR-0027): a single-latest, git-ignored
  recommendation at `.agentheim/state/whats-next.md`, an opinion *about* the state rather than a
  change *to* it, so it does not re-open ADR-0017's read-only stance. **aw-vk6mc** recolors the
  What's-next button to a new `LaunchButton` `emphasis="cta"` treatment — `--accent-ochre` text
  on an `--accent-ochre-soft` fill with an `--accent-ochre` border — licensed by ADR-0048's
  accent carve-out (design-system-vw12e): the button *fires* the whats-next skill, so it is a
  primed primary action, not the passive equivalent-state selection ADR-0016 reserves the accent
  from. **Work** is untouched (still `emphasis="primary"`, no ochre). The armed
  skip-permissions cue still wins over every idle treatment (aw-041): the launch icon tints
  `--obligation` red regardless of emphasis, including the new ochre `cta` fill. As of **aw-x4t2g** the
  advisory feeds back into planning: `modeling`'s "Before acting" and `work`'s Phase 3
  batch-planning both read it when present and surface its *recommended move* + age — never
  auto-picking, auto-promoting, or overriding the dependency DAG. The rail is composed from
  styleguide **primitives** (`Glyph`/`RailItem`/`Collapsible`/`TreeItem`), fed by the **live**
  `treeToLibrary(/api/tree)` projection, and drives a **"new item" attention cue**
  (design-system-v8k2p, aw-n4h7q): a research report or ADR created/modified during the current
  page session **blinks** until clicked or reloaded — a pure, in-memory-only session-baseline
  diff (`rail-attention.js`), no disk/`localStorage` write (ADR-0017). The outer shell frame is
  bounded to the viewport (`height: 100dvh`, `overflow: hidden`; aw-067), so rail + topbar stay
  fixed and the inner `scroll-quiet` region is the sole vertical scroll container. **1a
  single-panel shape (aw-wsfsk)**: the builder's chosen left-nav shape over 1b's split icon-rail
  + tree. The rail is **236px** wide; the tree header reads **"WORKSPACE"**; a **footer status
  line** (`"all clear · N done"`) renders below the tree, computed by the pure, unit-tested
  `library-data.footerStatusLine` off the same grouped tree projection (N counts the Decisions/ADR
  group — loss-tolerant: a missing Decisions group degrades to the bare `"all clear"`, never a
  throw). The **active primary-nav item** (Board/Workflow/About) renders an **ochre inset rail**
  (`inset 2px 0 0 var(--accent-ochre)`, via the `RailNavSlot` wrapper) — a **bounded ADR-0048
  wayfinding exception** to ADR-0016's de-emphasis-for-selection default, scoped to this one
  surface only. See ADR-0009, ADR-0003, ADR-0017, ADR-0018, ADR-0027, ADR-0048, ADR-0016.
- **Topbar settings menu (aw-049; consumes the shared primitive as of design-system-015)** —
  a **dropdown** (`SettingsMenu`) behind a single **settings gear** (`settings-2` glyph,
  unforked) sitting left of the What's next + Work launches. Collapses three utility controls —
  **Stop dashboard**, **theme** toggle, **skip-permissions** armed toggle — that were previously
  spread across the topbar; only Work stays standing. Consumes the shared styleguide
  `Menu`/`Popover` primitive (design-system-015, ADR-0003), retiring the earlier board-local
  dropdown machinery. **Dismissal:** Esc, outside click, and selecting Stop close the menu;
  flipping theme or skip-permissions **keeps it open**. The **closed gear carries no armed cue**
  — the danger hue lives only on the toggle inside the open menu. Keyboard-operable
  (focusable, Enter/Space opens, `aria-haspopup`/`aria-expanded`, Esc closes), honors
  `prefers-reduced-motion`. See ADR-0003, ADR-0017, ADR-0019.
- **Stop dashboard from the UI (aw-028; relocated aw-049; reversed to a direct server call by
  aw-h4n2v / ADR-0053)** — a quiet `StopDashboardButton` living inside the topbar settings menu;
  selecting it POSTs the scoped **runtime self-lifecycle** endpoint `POST /api/stop` directly —
  no bridge, no spawned session, no `STOP_DASHBOARD_COMMAND` (retired). The server ends its
  **own** process and removes its **own** runfile
  (`.agentheim/.dashboard/runtime.json`) on this explicit builder command; the response is fully
  flushed before the process exits (`res.on('finish')` gates the cleanup) so the browser's fetch
  always resolves. This **reverses aw-028's original seam** ("the server is never asked to stop
  itself") and, because there is no bridge in the path, **removes the bridge-present/absent
  asymmetry** aw-028 accepted — Stop now works identically in any browser tab. **No confirmation
  step.** Does **not** thread `skipPermissions` (a stop carries no danger hue). Selecting Stop
  closes the menu first, then — only on a **truthful 2xx** (not merely on dispatch) — flips a
  shell-level "stopped" state, rendering a board-local full-pane **"Dashboard stopped — safe to
  close this tab"** overlay (composed from tokens, not the `Drawer` primitive); a failed/
  unreachable POST closes the menu quietly with no overlay. `stopDashboard(root)` /
  `terminate()` and the `/dashboard stop` CLI/skill are **unchanged** — they still own the
  out-of-process kill path. See ADR-0053, ADR-0017, ADR-0046, ADR-0018, ADR-0001, ADR-0003.
- **Live-update (SSE consumer)** — the board keeps itself current (agentic-workflow-009) by
  subscribing to `GET /api/events` (infrastructure-003/ADR-0006) via the framework-free
  `createLiveUpdate` (`dashboard/app/live-update.js`). On every `tree-changed` frame or
  (re)connect it does **one** thing: re-fetch `/api/tree` and re-project the whole board —
  never interpreting the raw pointer as a transition; idempotent re-fetching means a burst of
  changes never double-applies. EventSource auto-reconnects and the board re-syncs, no
  missed-event bookkeeping. This is the **only** way state reaches the board (ADR-0017). See
  ADR-0012, ADR-0006, ADR-0017.
- **No lifecycle write path (read-only-over-lifecycle dashboard)** — the dashboard never
  writes lifecycle state (ADR-0017). The former drag-to-Promote endpoint (`POST
  /api/task/move`, agentic-workflow-009) and its client were **removed**: cards are not drag
  sources, columns are not drop targets. Task-lifecycle transitions are owned entirely by the
  skills, which move files on disk together with the readiness check, gate guard, INDEX
  update, and protocol entry; the board reflects those moves via live-update. On top of reads +
  the SSE stream + static assets, the HTTP server carries **two** narrow, non-lifecycle
  exceptions, each its own named write category (ADR-0053 amends ADR-0017's read-only framing
  and ADR-0046's earlier "exactly one write" claim to make room for the second): as of
  **aw-vmk1z / ADR-0046**, `DELETE /api/whats-next` deletes ONLY the advisory `whats-next`
  artifact (see `WhatsNextPanel` above); as of **aw-h4n2v / ADR-0053**, `POST /api/stop` — a
  **runtime self-lifecycle** write, sibling to the forbidden lifecycle category and the advisory
  category — ends the server's own process and removes its own runfile (see *Stop dashboard from
  the UI* above). Neither touches a task, `INDEX.md`, or `protocol.md`. See ADR-0017, ADR-0007,
  ADR-0046, ADR-0053.
- **Slide-over** — the dashboard's right-hand detail panel (agentic-workflow-007): a
  Notion-style drawer for a board **task**. As of **aw-027** it is **task-only** — the
  open-intent SPLITS on artifact kind (see *Open-intent routing*), so non-task documents render
  in the main pane instead. Fetches the body via `GET /api/doc?path=`, rendering markdown
  **client-side** through the approved styleguide `Drawer`+`Markdown` (unforked, ADR-0003),
  passing a *doc-shaped* item so the real in-root path is carried (ADR-0010, reshaped by
  ADR-0021). The header leads with the item `title` (design-system-014); Esc and scrim-click
  close it. An **in-place expand chevron** (`Drawer`'s ds-020 body-top chevron,
  agentic-workflow-074) widens the drawer in place to fill the main content area instead of a
  separate full-screen maximize button — the slide-over owns the controlled `expanded` state
  and the rail-aware `expandedWidth` fact, while the animation lives in the unforked `Drawer`.
  Reopening a task **resets to collapsed**. See ADR-0010, ADR-0021, ADR-0009, ADR-0003,
  ADR-0014.
- **Global search (topbar)** — the dashboard's search surface (agentic-workflow-052): the
  topbar's leading slot is the **global search field** that, as you type, queries
  `GET /api/search` and opens a floating panel of **category-grouped** results, each row a
  title + matched-text excerpt. Consumes the design-system `SearchField` combobox **unforked**
  (design-system-016, ADR-0003): ds-016 owns the input chrome and keyboard model; the dashboard
  owns the controlled query, a **~200ms debounce**, a **min-length-2 fetch gate**, and the pure
  transform (`searchResultsToGroups`, `dashboard/app/search-results.js`) that buckets ranked
  results into ds-016's `groups`. Selecting a result loads the document into the **main content
  pane** for both non-task docs and tickets (the "open in full screen" path, not the
  slide-over). Empty query shows no panel; a no-match query
  shows ds-016's honest "No matches" line. Read-only (ADR-0017). See ADR-0023, ADR-0021,
  ADR-0017, ADR-0009, ADR-0003.
- **Main-pane reader** — the dashboard's reading surface for a non-task **document**
  (agentic-workflow-027): vision, context map, BC README, ADR, research. Selecting a rail row
  opens its document in the **main content area** (where the board otherwise sits), not the
  slide-over. Reuses the `/api/doc` fetch, rendering markdown client-side through the unforked
  styleguide `Markdown` primitive, with a comfortable centered measure (`maxWidth: 760`,
  agentic-workflow-040) and a header leading with `doc.title`. Shows EITHER the selected
  document OR the board (default); the rail's **Board** item returns to the board. See
  ADR-0021.
- **Frontmatter folding** — both render surfaces share one pure helper,
  `dashboard/app/frontmatter.js` (`parseFrontmatter`/`frontmatterSection`/
  `withFrontmatterSection`, unit-tested, agentic-workflow-043), that strips a document's leading
  YAML frontmatter (which `marked` would otherwise render as one large bold setext heading) and
  re-emits it as a quiet, collapsed-by-default native `<details><summary>Front matter</summary>`
  table prepended to the stripped body — upstream of `Markdown`, so the same composed string
  flows through both the `Drawer` and the direct `Markdown` reader, both unforked. A document
  with no frontmatter passes through unchanged.
- **Open-intent routing** — the shell (`DashboardApp`) routes every clicked artifact on
  artifact KIND via the pure `isTaskIntent` (`dashboard/app/intent-route.js`,
  agentic-workflow-027): a `status`-carrying intent is a **task** → slide-over; a `type`-carrying,
  `status`-less intent is a **non-task document** → main pane (`openIntent` / `selectedDoc`
  state pair). See ADR-0021. As of **aw-058 (ADR-0025)** a third state, `mainView` (`"board" |
  "workflow" | "about"`, default `"board"`), sits beside them for **built-in static pages**
  (neither a task nor a disk-fetched document), mutually exclusive by construction. **aw-062**
  added the `"about"` page (builder bio + Ko-fi card). The `"workflow"` page (aw-059) carries
  three named segments — **Preparation** (`brainstorm`), **Capturing** (`quick-capture`/
  `modeling`/`research` gated by `research-reviewer`/DISMISS), **Promote & Work** (`modeling`
  PROMOTE → `work`'s parallel TDD workers → the `verifier` gate → one task = one commit) — each
  carried (aw-060) by a hand-authored flow diagram (board-local HTML+CSS, no SVG, no
  diagramming library, gates as edge checkpoints). Stays static/read-only, styleguide unforked.
  As of **aw-q3n7k** the guide covers the two later skills: **Promote & Work opens with `whats-next`**
  (a `WNode`+`WArrow` "recommends" ahead of `modeling` PROMOTE, at the planning moment — advisory,
  never moves a task), and a fourth **un-numbered "Any time" note** below the segments names `inquire`
  as a read-only, code-grounded lens *outside* the flow (deliberately not appended into any segment's
  skill list, since it isn't a step).
- **Library / navigation** — the dashboard's discovery surface (agentic-workflow-008): makes
  the *non-task* knowledge base browsable — vision, context map, every BC README, **per-BC
  concept pages**, ADRs, research — drawn from the artifact-location half of the tree
  projection (tasks deliberately excluded; the board owns them). The pure, unit-tested
  `treeToLibrary` (`dashboard/app/library-data.js`) pools locations into fixed groups — Product
  / Bounded contexts / **Concepts** / Research / Decisions — rendered through the approved
  styleguide `Collapsible`/`TreeItem` (unforked; `concept` is a ds-021 registry entry).
  Selecting any row routes to the **main-pane reader**. As of **aw-026** this tree is **always
  visible in the left rail** — the separate board↔library toggle is retired. See ADR-0011,
  ADR-0021, ADR-0009.
- **Task transition** — a lifecycle move of a task between folders (`backlog→todo` Promote,
  `todo→doing` Claim, `doing→done` Complete), never a raw file operation: it is a command on the
  **Task** aggregate, enforcing *status matches folder*. Owned by the skills (`modeling` /
  `work`), not the dashboard, which is read-only (ADR-0017).
- **`applyTaskMove`** — the canonical lifecycle-transition operation, owned by
  agentic-workflow and available to the skills; enforcer of *status matches folder* and the
  legal-move policy. Built in agentic-workflow-003 as `lib/task-lifecycle.mjs` (BC-owned domain
  logic, node stdlib only). The dashboard does **not** call it (ADR-0017). Signature
  `applyTaskMove(rootDir, id, from, to, options)` — `options.policy` is `'skill'` (the forward
  set: Promote, Claim, Complete) or `'ui'` (a retained, no-longer-wired restricted set);
  `options.expectedMtimeMs` is the optimistic mtime precondition. Returns `{ ok: true, state }`
  or `{ ok: false, code, reason }`. It owns ONLY the move + status rewrite + precondition;
  INDEX/protocol side-effects stay with the skills (ADR-0007). Resolves the real on-disk
  `<id>-<slug>.md` filename, preserved across the move (ADR-0012). See ADR-0017, ADR-0007,
  ADR-0012.
- **`promoteTask` / the `task-lifecycle` CLI** — the git-free, mechanized PROMOTE lifecycle
  script (ADR-0038, agentic-workflow-k5n8f). Three concentric layers, one owner each: (1)
  `applyTaskMove` (above); (2) `promoteTask(rootDir, id, opts)` in `lib/task-lifecycle.mjs` —
  calls the mover, then performs deterministic bookkeeping (INDEX marker + count delta,
  protocol prepend); NEVER runs `git`; outputs an enumerated manifest `{ changed, message,
  verb, id }` or `applyTaskMove`'s rejection verbatim; (3) `lib/task-lifecycle-cli.mjs` — a thin
  argv → `discoverRoot(cwd)` → handler → print-manifest wrapper; (4) `modeling`'s PROMOTE flow
  owns the remaining judgment (readiness) and git (scoped add + commit). See ADR-0038, ADR-0007,
  ADR-0026.
- **Compute-then-write atomicity (ADR-0054, agentic-workflow-wq7fn).** All three mechanized
  verbs — `promoteTask`, `claimBatch`, `completeTask` — resolve their source read-only, then
  compute the FULL new `INDEX.md` + `protocol.md` content PURELY (no disk writes) inside a
  `try`; a throw from `removeIndexLine`/`insertIndexLineAtTop`/`adjustIndexCount`/
  `prependProtocolEntry` is caught and returned as `{ok:false, code:'bookkeeping-marker-mismatch',
  reason}` with nothing moved and nothing written. `applyTaskMove` is the only disk mutation,
  and the last one before the two writes. This supersedes k5n8f's AC #5 dry-run marker mirror
  (`validateBookkeepingMarkers` — deleted): the computation itself is now the guard, so every
  future throw site is fail-closed for free, with no second hand-maintained copy of "what could
  go wrong" to keep in sync. `adjustIndexCount` additionally (a) rejects a decrement that would
  take a count below zero — naming the label/current value/delta — instead of silently writing
  e.g. `-1` (which previously made the label's own regex unmatchable for every subsequent
  mutation in that BC), and (b) scopes its replace to inside the `<!-- task-counts:start/end
  -->` block, mirroring `removeIndexLine`'s block capture, so a colliding same-labeled line
  elsewhere in the file is never the one edited. `applyTaskMove`'s own source-resolution
  precondition is extracted into `resolveSourceOrReject` — one implementation, called by both
  `applyTaskMove` and every verb's compute phase, so a source-missing rejection is never
  re-derived by speculatively invoking the mover as an oracle. See ADR-0054, ADR-0038.
- **`claimBatch` / `completeTask`** — the git-free CLAIM and COMPLETE lifecycle scripts, matched to
  the ADR-0032 worktree/squash-merge model (agentic-workflow-t7m4c), same three-layer boundary as
  `promoteTask`. **`claimBatch(rootDir, ids, opts)` is BATCH-shaped**: it claims a whole ready set
  `todo → doing` and returns ONE manifest — every id's move via `applyTaskMove`, INDEX marker/count
  edits grouped **per BC** (a batch may span contexts), and one `protocol.md` "Batch started" entry;
  fail-loud (all ids pre-checked to resolve in `todo/` before any move, so one bad id aborts the
  batch with nothing moved; a rarer mid-batch vanish race after the pre-check surfaces the split
  `claimed` manifest with neither file written — ADR-0054 left this residual race unchanged), and
  the commit `message` drops the `<bc>` token when the batch spans contexts. **`completeTask(rootDir,
  id, opts)` is single-task-shaped** and **idempotent** w.r.t. a file already in `done/` (under
  ADR-0032 the worker's worktree does the `doing → done` move, so by the time the conductor runs
  `complete` on `main` after the squash-merge the file is already there): it resolves its source
  `doing/`, else `done/`, before any move (ADR-0054) — the `done/` case is the idempotent no-op
  move, and bookkeeping proceeds against the file already there. **ADR-0042:** `completeTask` has no
  batch mode — the trivial-squash carve-out is composed by the CALLER (`work` runs `complete` once
  per task and folds the manifests' `changed` paths + `[<id>]` trailers into one commit), since a
  batch-complete verb would have to invent a shared summary/`<type>` across tasks, the judgment
  ADR-0038 reserves for the skill. Both reuse `lib/task-lifecycle-cli.mjs` — `claim <id-1>,<id-2>,…`
  and `complete <task-id>` (with an optional JSON opts positional for `complete`'s richer
  bookkeeping fields). See ADR-0038, ADR-0007, ADR-0026, ADR-0032, ADR-0042, ADR-0054.
- **`lib/resolve-plugin-file.mjs`** — the env-independent in-plugin file resolver
  (generalizes infrastructure-010's `dashboard/resolve-launcher.mjs`, which now delegates to
  it — agentic-workflow-k5n8f). `locatePluginFile(relPath, opts)` resolves a path inside the
  installed plugin cache, or short-circuits to a repo-local copy when running from the
  Agentheim repo itself. Never trusts `$CLAUDE_PLUGIN_ROOT` for correctness; fails loud, never
  a `.`-relative fallback. How the `task-lifecycle` CLI above is meant to be located from an
  installed-plugin consumer's skill invocation, not just the dashboard's launcher.
- **`rotateProtocol` / protocol rotation** — the deterministic, git-free cap-and-roll script
  for `.agentheim/knowledge/protocol.md` (ADR-0039, agentic-workflow-r2c7m; a k5n8f-family
  script). `rotateProtocol(rootDir, opts)` (`lib/protocol-rotation.mjs`) caps the live file at
  `capLines` (default ≈1,000) and, when exceeded, rolls whole **older** months out **verbatim**
  — oldest-first, stopping once back under the cap — to dated
  `.agentheim/knowledge/protocol/YYYY-MM.md` archive files. The **current month is never
  rolled**, so every archive file is written exactly once; newest-on-top order is preserved
  both live and per-archive. Returns `{ok:true, rotated, changed, rolledMonths, liveLines}`;
  invocable directly (`node lib/protocol-rotation.mjs`, no verb/id argv). Every skill's
  first-~100-line read is unaffected by construction. **Trigger wired (ADR-0045,
  agentic-workflow-v8n3t):** `work`'s end-of-run flow invokes it once per session, immediately
  after the session-end protocol entry is committed, via the standard env-free plugin bootstrap;
  a `rotated: true` manifest gets its own scoped commit of the `changed` paths, closing ADR-0039's
  previously-deferred "who invokes it" non-decision. See ADR-0039, ADR-0045, ADR-0038, ADR-0026,
  ADR-0032.
- **`rotateIndexDoneList` / INDEX done-list rotation** — the deterministic, git-free cap-and-roll
  script for a BC's `INDEX.md` `done-list` block (agentic-workflow-c8j3w; applies ADR-0039's
  convention, established for `protocol.md`, to a second growth surface — a k5n8f-family
  script). `rotateIndexDoneList(rootDir, context, opts)` (`lib/index-rotation.mjs`) caps the live
  list at `capEntries` (default ≈30) and, when exceeded, rolls whole **older** months out
  **verbatim** — oldest-first, stopping once back under the cap — to dated
  `contexts/<bc>/done-archive/YYYY-MM.md` archive files. A done-list line carries no date of its
  own, so an entry's month is derived from the `completed:` frontmatter of the task file it
  points at (mtime, then `'unknown'`, as loss-tolerant fallbacks). The **current month is never
  rolled**; the `### Done (...)` header is rewritten to name the archive location only when a
  rotation actually happens; the `**Done:** N` lifetime count and the actual
  `done/<id>-<slug>.md` task files are never touched, so `depends_on`/`blocks` resolution
  (`resolveTaskFile` walks `done/` directly) and the dashboard search corpus (`buildTree`,
  ADR-0023) stay unaffected by rotation by construction — only `modeling`'s Backlink-lookup
  prior-art matcher, which reads the done-list's rendered text, needed pointing at
  `done-archive/` as an additional input. `rotateAllIndexDoneLists(rootDir, opts)` rotates every
  BC found under `contexts/`; returns `{ok:true, rotated, changed, contexts}`; invocable directly
  (`node lib/index-rotation.mjs`, no verb/id argv, no context argv). **Trigger wired (ADR-0047,
  agentic-workflow-d4q7f):** `work`'s end-of-run flow invokes `rotateAllIndexDoneLists` once per
  session, immediately after the ADR-0045 protocol-rotation check, via the same standard env-free
  plugin bootstrap; a `rotated: true` manifest gets its own scoped commit of the top-level
  `changed` paths, closing ADR-0045's previously-deferred sibling-surface scope boundary. First
  real run against this repo (2026-07-04) rolled `agentic-workflow`'s 2026-06 done-list entries to
  `contexts/agentic-workflow/done-archive/2026-06.md`; `design-system` and `infrastructure` were
  already under cap and did not rotate. **Fail-closed on an unparseable done-list (ADR-0047
  amendment, agentic-workflow-dk3vz):** a BC's per-BC result is one of three shapes, not two — beside
  `rotated:true`/`rotated:false`, a BC can REFUSE (`{ok:false, code:'unparseable-done-list' |
  'missing-done-list-markers', context, reason}`, writing nothing) whenever the cap question is
  unanswerable (zero done-list lines matched the expected shape) or a pending rewrite would silently
  drop unmatched lines; a partially-parseable list that isn't destructive to skip instead reports
  `{ok:true, rotated:false, liveEntries, unmatched:K}` (`K > 0`), visible but not fatal.
  `rotateAllIndexDoneLists` catches a per-BC throw (missing markers) rather than letting it escape and
  strand an already-rotated, alphabetically-earlier BC's manifest; the top-level manifest always stays
  `{ok:true, ...}` with a refusing BC simply absent from top-level `changed`. `work`'s session-end
  check surfaces every refusal and every unmatched report in its end-of-run summary; its old
  unqualified "`rotated:false` ⇒ silent no-op" rule is narrowed to apply only when no BC refused and
  none reported unmatched lines. See ADR-0039, ADR-0041, ADR-0023, ADR-0038, ADR-0026, ADR-0045,
  ADR-0047.
- **`findDuplicateTaskIds`** — the duplicate-id guard (`lib/duplicate-id-check.mjs`, BC-owned,
  node stdlib only), the ADR-0028 **insurance** against the residual token-collision tail and
  the legacy-vs-token clash a bug could produce. A pure, loss-tolerant whole-tree walk collects
  each task file's id (frontmatter first, filename-stem fallback) and returns every id claimed
  by more than one file, **shape-agnostic** (compared as whole strings). Exercised by
  `node --test` (the repo has no CI), whose suite also asserts the **live** tree has no
  duplicates. See ADR-0028, ADR-0022, ADR-0012.
- **`lib/agent-heartbeat.mjs` / `lib/hook-agent-signal.mjs`** (agentic-workflow-m9w5c, ADR-0043)
  — the live-observability hook signal behind `InFlightLane` above. `agent-heartbeat.mjs` is the
  PURE transition core (`applyHeartbeat`, `applyAgentCompletion`, `isStale`, `STALE_WINDOW_MS`) —
  I/O-free, fully unit-tested. `hook-agent-signal.mjs` is the thin CLI glue a Claude Code `Stop`/
  `SubagentStop` command hook invokes: reads the hook's stdin JSON payload, resolves the project
  root (`${CLAUDE_PROJECT_DIR}` first, `discoverRoot` fallback), applies the matching pure
  transition, and writes `.agentheim/state/in-flight.json` — an ADVISORY write (ADR-0027
  category), never a lifecycle write. `runHook(mode, deps)` is exported so tests drive it with
  injected stdin/root/clock rather than a real subprocess; a real-subprocess smoke test additionally
  confirms the CLI entrypoint itself (real stdin, real `${CLAUDE_PROJECT_DIR}`) works end to end.
  Every failure path (unreadable stdin, unresolvable root, an unwritable `state/` dir) is
  swallowed and the script exits 0 — a hook must never crash the session it observes. See
  ADR-0043, ADR-0027.
- **Hook COMMAND path is env-independent (agentic-workflow-g7p2x, ADR-0043 amendment).**
  The three `Stop` hook registrations above (`skills/work/SKILL.md`, `agents/worker.md`,
  `agents/verifier.md`) do **not** locate `lib/hook-agent-signal.mjs` via
  `${CLAUDE_PROJECT_DIR}` — that reuse was the bug (`${CLAUDE_PROJECT_DIR}` is the
  *write target* the script resolves internally, correct only for that role; using it
  to find the *script itself* only works when the project **is** the plugin). Each
  hook command is instead a self-contained `node -e` bootstrap — homedir -> plugin
  cache -> semver-max version dir -> `lib/hook-agent-signal.mjs`, with a repo-local
  `process.cwd()` short-circuit for dogfood development — the same pattern
  `lib/resolve-plugin-file.mjs` (infrastructure-010) and the `work` skill's
  claim/complete verbs already use. `${CLAUDE_PLUGIN_ROOT}` was investigated and
  rejected as the fix: documented for hook contexts, but confirmed to have open,
  unresolved non-injection bugs upstream (anthropics/claude-code #43380, #66557,
  #24529) as of the investigation. See `lib/test/hook-command-path.test.mjs` for the
  real-subprocess reproduction (foreign-project write succeeds; the old literal
  command string reproducibly does not) and the ADR-0043 amendment for the full
  writeup.

## Aggregates

- **Task** — protects: status always matches its folder (`backlog/` → `todo/` → `doing/` →
  `done/`); one task = one commit (with a bounded **trivial-squash carve-out**, ADR-0026);
  IDs are stable and never renumbered. New ids are `<bc>-<token>` — a 5-char random token,
  leading letter, collision-free by construction for multi-branch capture (ADR-0028); legacy
  `<bc>-NNN` sequential ids coexist untouched (go-forward, no rewrite). The two shapes are
  disjoint (token leads with a letter, legacy tail is all digits). A **dismissed** id
  (ADR-0022) is retired, not reused — by construction for tokens, by the next-free-number
  rule for legacy ids.
- **Vision** — protects: a single, two-minute-readable strategic root per project.
- **Knowledge base** (protocol + ADRs + research + indexes) — protects: every action is
  logged; indexes point rather than duplicate; ADR↔task backlinks stay bidirectional.
- **Bounded context (modeled)** — protects: a task belongs to exactly one BC; the BC's
  ubiquitous language is the single source of truth its tasks, code, and ADRs conform to; its
  `README.md` stays consolidated under the ~600-line trigger (ADR-0041) so it stays Read-able
  in one pass.

## Key events

Past-tense, domain-language. Vision created · Bounded context identified · Idea captured ·
Task refined · Task promoted · Task claimed · Task completed · Task verified · Task bounced ·
Task dismissed · README consolidated · Decision recorded (ADR) · Research published · Research
reviewed.

## Key commands

Intents entering the context. Brainstorm · Quick Capture · Refine · Promote · Dismiss ·
Consolidate · Work · Research · Dashboard.

**Dismiss** (the `modeling` skill's fourth action, agentic-workflow-046) hard-deletes a
`backlog/`/`todo/` task under one confirmation, cascading to its **entire transitive dependent
subtree** (ADR-0022). Refuses the whole operation if any task in the set is in `doing/`/`done/`.
Around the raw `.md` deletes the skill reconciles bookkeeping for the whole set (INDEX
line+count per dismissed id, stripped backlinks from surviving tasks/ADRs, one bare protocol
entry); dismissed ids are retired, never reused. The removal lives entirely in the skill, never
a server endpoint (ADR-0017) — the dashboard's per-card trash-can only *seeds and fires* the
command through the bridge. See ADR-0022, ADR-0017, ADR-0007.

**Consolidate** (the `modeling` skill's fifth action, ADR-0041) rewrites a BC's `README.md`
**in place** once it crosses the ~600-line trigger — builder-in-the-loop, no archive, never
silently dropping a term, invariant, or backlink. Flagged by `whats-next`'s advisory line;
actually run by the builder via `modeling`. See ADR-0041, ADR-0027, ADR-0017.

**Dashboard** launches the local web UI over the project's `.agentheim/` folder — a flat Kanban
board, a task-only slide-over, and a main-pane reader for non-task documents, live-updating as
skills move files on disk. **Read-only** (ADR-0017): the board reflects the skills' moves,
never makes them. Invoked via the `/dashboard` slash command (agentic-workflow-011 — the
documented slash-command exception above), with three verbs: bare `/dashboard`
launches-or-reuses the detached server and **prints** the served URL (it does not open a
browser itself); `/dashboard stop` terminates it; `/dashboard status` reports running/not +
port from the runfile only. Thin trigger over `dashboard/launch.mjs`.

## Runtime surface

The manifest the verifier's **runtime-drive check** (check 8, ADR-0036) resolves once per batch
and reuses across every re-dispatch iteration — mirroring how the pre-resolved test command is
resolved once and reused. Declares what to boot, how, and what "up" means for this BC's one
runtime surface, the dashboard. Absent-manifest BCs get no check 8 at all; a manifest present but
un-touched by a given diff (no changed path matches `surfacePaths`) also draws no drive for that
task — exempt by default, no cargo-cult ceremony.

```yaml
surfacePaths:
  - dashboard/**
launch: node dashboard/launch.mjs
stop: node dashboard/launch.mjs stop
runfile: .agentheim/.dashboard/runtime.json   # read the ACTUAL bound port from here — never
                                               # assume the derived value; the 8-rung ladder
                                               # (ADR-0002 §infra-018/019) can move it
probes:
  - path: /healthz
    method: GET
    status: 200
    bodyShape: '{ status: "ok", root: string }'
  - path: /api/tree
    method: GET
    status: 200
    bodyShape: '{ contexts/lifecycle/task projection per ADR-0002 — pointers+metadata, not bodies }'
renderPaths: []   # opt-in only via a task's `runtime_render: true`; no browser capability is
                  # wired into this project yet, so the render tier never fires today
```

`launch`/`stop` delegate all OS-divergent spawn/kill logic to the one cross-platform launcher,
`dashboard/launch.mjs` (ADR-0002) — the check never hand-rolls `process.kill`. Both probes are
**reads** (ADR-0017: the dashboard is read-only, so every `probes` entry here must stay a read
endpoint). `launch` binds `cwd: tmpdir()` (ADR-0004), so a leaked server from a failed teardown
holds no lock on the worktree that spawned it.

## Relationships with other contexts

- **design-system** — this BC's first UI-bearing feature (the `dashboard`,
  agentic-workflow-001) depends on the design-system styleguide. **Frontend gate:** every
  UI/frontend task here must list `design-system-001-styleguide` in its `depends_on`, and
  no frontend task may be promoted to `todo` ahead of the approved styleguide.

A `context-map.md` may now be warranted as the BC count grows beyond one; revisit during
the next modeling pass.

## Open questions

- **Brainstorm on existing code (next iteration).** When `brainstorm` runs in a folder that
  already contains code, it should reverse-engineer a best-guess vision and domain from the
  code, present it, then continue the Socratic dialogue. Likely multi-agent; to be built via
  the skill-creator. Not present today.
- **Does `infrastructure/` ever split out?** For a markdown-and-prompts plugin there's no
  runtime infrastructure yet. Revisit if a genuine cross-cutting concern appears.
- **Merge gap.** `research-reviewer` + the `research-review` doctrine doc exist, but
  `skills/research/SKILL.md` is the older copy that doesn't call the gate. Reconcile on merge.
- **Stale framing.** `references/modes.md` still says modes are "designed for workshop use";
  with teaching dropped, rephrase toward model quality.
