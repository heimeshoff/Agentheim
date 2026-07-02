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
  the task-move + `INDEX.md` + `protocol.md` + ADR-backlink bookkeeping into the task commit
  **before** committing (no post-commit write), and `modeling` / `quick-capture` / `brainstorm`
  each commit the `.md` they wrote at end-of-action. Every commit is a **scoped `git add`** of
  only that skill's own files — **never `git add -A`** — which is load-bearing because
  `modeling` can run concurrently with `work`. A task's commit is found in `git log` via the
  `[<task-id>]` message trailer; there is **no `commit:` frontmatter field** (ADR-0026 dropped
  the SHA chicken-and-egg). One task = one commit, with a bounded **trivial-squash carve-out**
  for a same-BC / same-files / no-behavior-change / same-batch wave of follow-ups (e.g.
  aw-064/065/066/067). At session end `work` **reconciles stranded carry-over**: it runs
  `git status --porcelain`, and for every stranded tracked-modified or untracked file the
  scoped-add rule left behind it surfaces an explicit per-file disposition to the user —
  commit deliberately (own scoped, labeled commit) or leave behind with a named owner — never
  auto-swept, never the old "untouched, as in prior sessions" boilerplate (a live concurrent
  session's in-flight files look identical, so it asks, never assumes). See ADR-0026, ADR-0017, ADR-0007.
- **Tree projection** — the single read model the dashboard's views (board, slide-over,
  navigation) and the SSE consumer all rebuild from. `GET /api/tree` (built in
  agentic-workflow-005 as `dashboard/tree.mjs`) walks the discovered `.agentheim/` and returns,
  per BC, its four lifecycle folders and each task's frontmatter projection
  (`id, title, status, type, context, path`) plus the *locations* of vision / context-map / BC
  READMEs+INDEXes+concepts / ADRs / research — pointers and metadata only, never document
  bodies. The ADR and research locations also carry an **additive parallel meta map**
  (`locations.adrsMeta` / `locations.researchMeta`, keyed by the same in-root path) whose
  values carry each file's `mtimeMs` (aw-t3b9k), so the read-only dashboard (ADR-0017) can tell
  a *modified* doc from an untouched one (aw-n4h7q's "modified blinks"); a stat failure degrades
  to `mtimeMs: null` and the flat `locations.adrs` / `locations.research` string arrays stay
  byte-compatible for `library-data` and the search corpus. It also carries `project: { name }` — the project name parsed server-side from
  `vision.md`'s `# Vision: <name>` heading (aw-015), so the dashboard header can show which
  project's `.agentheim/` is being viewed; missing/headingless vision degrades to `null`. This
  is the one projection value drawn from a markdown *body* rather than frontmatter, kept to a
  single trimmed string so the pointers-and-metadata-only contract still holds. A task whose
  `status`/`context` frontmatter is missing falls back to its folder / BC
  name (disk is the source of truth), and malformed frontmatter degrades gracefully — the card
  is still listed, the walk never aborts. Document bodies are carried separately by
  `GET /api/doc?path=<in-root path>`, a validated raw-markdown carrier (rendering is
  client-side). Both endpoints are pure reads and reuse the root-resolution `startsWith(root)`
  guard; neither writes nor interprets a lifecycle move. See ADR-0002.
- **Content search** — `GET /api/search?q=<term>` (agentic-workflow-050, ADR-0023) is the
  read-only server's **first** endpoint that opens document *bodies* in bulk: a pure walk/rank/
  excerpt core in `dashboard/search.mjs` (mirroring `tree.mjs` — stdlib-only, DOM-free,
  `node --test`-able, loss-tolerant) behind a thin `handleSearch` route. It returns
  `{ query, results: [...] }`; each result is `{ category, title, excerpt, path, ...intent }`.
  **Match scope is title + body only** — frontmatter (ids, tags, type, dates) is **not** searched
  — case-insensitive substring. **Corpus is single-sourced from the tree projection**
  (`buildTree`): Bounded contexts (READMEs) → Concepts (per-BC synthesis pages) → Decisions (ADRs)
  → Research → Tickets (tasks), so a
  new artifact kind added to the tree becomes searchable for free. **Ranking is title-hits-first,
  then fixed category order** (BCs → Concepts → Decisions → Research → Tickets; the search order's
  `search.mjs` `CATEGORY_ORDER` and the topbar `search-results.js` `GROUP_ORDER` stay byte-identical,
  aw-075). The `excerpt` is a
  whitespace-collapsed ~60-char window around the *first* occurrence (original-case slice, matched
  case-insensitively; title-only matches excerpt from the title). Results carry the *existing*
  open-intent shapes (ADR-0021) so the client routes with no new code — non-task docs
  library-data-compatible (`{ type, title, path }`), tasks board-data-compatible
  (`{ status, id, title, path, context }`). An empty/whitespace `q` or `q.length < 2` returns
  `{ query, results: [] }` **with no walk**. Pure read, reuses the same `startsWith(root)` guard,
  writes nothing (read-only contract, ADR-0017). The **topbar search UI** that consumes it
  shipped in **agentic-workflow-052** (see *Global search (topbar)* below).
- **Dashboard frontend app** — the live dashboard UI, owned by this BC, living in
  `dashboard/app/` (entry `dashboard/app/app.js`). It *consumes* the design-system styleguide
  source across the BC boundary (imports `Column`/`TicketCard`/`ColumnHeader`/`EmptyColumn`/
  `html` as-is — never forks them), so the styleguide stays the single source of UI truth
  (ADR-0003). esbuild bundles this app (not the styleguide canvas) into the committed
  `dashboard/dist/` the static handler serves; the canvas remains the separate buildless
  review surface. The three view tasks — **board** (agentic-workflow-006), **slide-over** (aw-007),
  and **library/navigation** (aw-008) — all built, compose into this one app shell. As of
  **aw-026** the shell is the styleguide §05 "Components in context" layout: a full-height
  **left rail** (`ShellRail`) beside a **main column** (a ~52px topbar over the scrollable
  board). The rail carries brand → a **Board** `RailItem` → (as of **aw-058**) a
  **Workflow** `RailItem` directly below it → divider → "Workspace"
  label → the **live** library tree (`treeToLibrary`, the always-visible tree *is* the
  library). As of **aw-049** the three utility controls — **Stop dashboard**, the **theme
  toggle** and the **skip-permissions armed toggle** — are collapsed behind a single
  **settings gear** (`SettingsMenu`, the reused `settings-2` glyph) that opens a dropdown built
  on the shared styleguide `Menu`/`Popover` primitive (design-system-015, consumed unforked —
  ADR-0003); the gear sits immediately **left** of the **What's next** + **Work** launches,
  so the topbar's right group reads `[⚙] [What's next] [Work ↗]` and the bar overall reads
  `[search field] … [⚙] [What's next] [Work ↗]` (aw-064; the leading slot was the
  dead breadcrumb until **aw-052** replaced it with the global search field). (Earlier: aw-029 put the
  theme + skip-perms toggles inline in the topbar and aw-028 added a far-left Stop launch;
  aw-049 supersedes both by tucking all three into the gear. aw-064 then added **What's next**
  beside Work as a second standing launch.) The **closed gear carries no armed cue** — the skip-permissions `--obligation`
  danger hue lives only on the toggle inside the open menu; the menu dismisses on Esc,
  outside click, and selecting Stop, while the two toggles keep it open. See *Stop dashboard
  from the UI* below. The old horizontal header
  and the board↔library toggle are retired (the separate full-pane library surface is
  formally removed in aw-027). See ADR-0009 / ADR-0011.
- **Board view** — the dashboard's home view (agentic-workflow-006): a **flat** Kanban of the
  four lifecycle columns (`backlog`/`todo`/`doing`/`done`) with tasks from **all** bounded
  contexts pooled into those columns — no swimlanes; each card carries its BC via the styleguide
  `context` chip. Rendered over the live tree projection (`GET /api/tree`); a status-driven,
  loss-tolerant transform (`dashboard/app/board-data.js`) buckets each task by status (unknown
  status → backlog) and shapes it for the styleguide card. **Read-only** (ADR-0017) — clicking a
  card emits an *open-this-task* intent the slide-over (aw-007) consumes; the board never writes a
  lifecycle move. Lifecycle changes are owned entirely by the skills (`modeling` / `work`); the
  board stays **live** by subscribing to the SSE stream and re-fetching `/api/tree` on any change,
  so a skill's on-disk move shows up within a frame (see *Live-update* below). To refine or promote a
  task, use `modeling` — backlog cards carry a *Refine / Promote* launch pair (aw-022, replacing
  aw-016's single Copy button) that seeds `/agentheim:modeling refine <id>` / `... promote <id>` for
  exactly this. See ADR-0009, ADR-0017.
- **Column sort** — each board column has its own **independent** sort control (agentic-workflow-012),
  a board-only `<select>` rendered as a *sibling* of the styleguide `ColumnHeader` (the board-column
  precedent — the styleguide `kanban.js` is consumed unmodified, ADR-0003). Orderings: **Name** (task
  `title`) asc/desc and **Modification-date** desc/asc, where modification time is the per-task `mtimeMs`
  the projection carries (aw-013). Default per column is **modification-date descending**, so
  recently-touched cards sit at the top. The reordering is a **pure** function of the already-projected
  list — `dashboard/app/board-sort.js` (`sortTickets`, unit-tested under `node --test`), run board-side
  *after* `treeToColumns`; it never mutates the transform, the read model, or disk. Name ties and
  mod-date ties both break by `id` ascending, and an absent/`null` `mtimeMs` sorts as oldest (never
  `NaN`, never a throw). The choice is now **persisted** (agentic-workflow-014 / ADR-0015) in the
  single versioned `localStorage` view-state store, so it survives a reload; because the order is
  derived at render, every live re-projection (SSE `tree-changed` / reconnect) re-applies the
  column's current choice rather than silently resetting it. (This supersedes aw-012's original
  in-session-only clause; aw-012 stays `done`.)
- **Column grouping (group by bounded context)** — each board column also has its own **independent**
  group-by-BC toggle (agentic-workflow-014), a board-only control rendered as a *sibling* of the sort
  `<select>` (same board-column precedent — the styleguide `kanban.js` is consumed unmodified, ADR-0003).
  Toggling a column **on** partitions its cards into per-BC sections, each with a header showing the BC
  name + a card count; a BC with zero cards in that column renders **no** section, and sections are
  ordered by BC name **ascending**. Each section is independently **collapsible** (collapsing hides its
  cards, retains the count). Cards *within* a section still obey the column's current sort — the
  pipeline is **project (`treeToColumns`) → sort (`board-sort.js`) → group (`board-group.js`)**; grouping
  only partitions, never re-orders, so all sort semantics are preserved inside each section. The
  partitioning is a **pure** function of the already-sorted list — `dashboard/app/board-group.js`
  (`groupTickets`, unit-tested under `node --test`); it never mutates the transform, the read model, or
  disk. A column with no stored state, or a brand-new BC, defaults to **flat + default sort +
  all-expanded** (never `NaN`, never a throw). The collapsible section header is **board-local**,
  token-matched (the styleguide `TreeGroup` primitive is coupled to `TreeItem` rows and owns its own
  open state — it does not fit a board section rendering `TicketCard`s with externally-persisted
  collapse state); a `design-system` capture (design-system-005) is filed for the shared primitive. See
  ADR-0015, ADR-0009, ADR-0003.
- **Collapsible Done column** — the **Done** column (and *only* Done — it is the one column that grows
  unbounded as completed tasks accumulate) carries a board-only **collapse / peek** control
  (agentic-workflow-m2v8d, which **replaces** aw-072's hide control), a *sibling* of the sort `<select>` /
  group toggle in the column's control strip (pushed to its **top-right** by an auto margin; same
  board-column precedent — the styleguide `kanban.js` is consumed unforked, ADR-0003; the affordance is
  keyed off an `onToggleCollapse` prop, default OFF, so backlog / todo / doing render no such control —
  the aw-018 precedent). The button is a **double-chevron glyph swap** (design-system-c3p9k, consumed
  unforked): **`chevrons-up`** when expanded (click to collapse) ⇄ **`chevrons-down`** when collapsed
  (click to expand) — *not* a CSS rotate on a single glyph. Clicking it collapses the Done column body to
  a **height-clamped peek** of the most-recent completions — a `max-height` ≈3.5 average cards +
  `overflow: hidden` + a bottom **`mask-image` gradient fade**, so the card the clamp cuts fades out and
  nothing renders below the clamp. The "3.5" is a **visual height target, not a node count**. The clamp is
  **orthogonal to grouping** (aw-014): it is **one** `max-height` on the whole column body — section
  headers and cards fall where they may inside the faded region, never a per-section clamp. **Expanded by
  default.** The choice **persists across reloads** via the board view-state store (the additive `peek`
  boolean, below). Collapsing is **presentation-only**: it suppresses *rendering* of the overflow only —
  no `/api` write, no lifecycle move, Done's tasks still exist on disk (ADR-0017 / ADR-0001). The clamp is
  derived at render by the pure `peekClampStyle` (`board-view-state.js`, unit-tested under `node --test`),
  so a task completing into a collapsed Done just slots into the still-clamped overflow — it never
  auto-expands. See ADR-0015, ADR-0017, ADR-0003.
- **Persisted board view-state** — the per-column **view lens** — grouped/flat, sort choice, each
  `(column, BC)` collapse state, and the per-column **`peek`** flag (the Done collapse control, aw-m2v8d) —
  is persisted across reloads in a **single versioned `localStorage` store**
  (`dashboard/app/board-view-state.js`, key `agentheim.board.viewState`; agentic-workflow-014, ADR-0015).
  This deliberately **reverses** ADR-0009's "in-session view-state only — no `localStorage`" clause, but
  the reversal is bounded to **presentation view-state**: the store never records lifecycle truth — which
  task is in which column stays a pure projection of disk (`/api/tree`), re-fetched on every SSE frame.
  The `peek` field is **additive and back-compatible** — an old stored blob that predates it loads as
  `peek: false` (expanded), so **no `VIEW_STATE_VERSION` bump**; an old blob still carrying aw-072's retired
  **`hidden`** flag is **ignored** (not read or written), degrading a previously-hidden Done to
  **shown + expanded** rather than blanking the board, and the retired field drops out on the next save. A
  stale-version / malformed / absent blob degrades to "every column defaults" rather than throwing — a
  corrupt preference can never blank the board. See ADR-0015, ADR-0001.
- **Persisted theme choice (light/dark toggle)** — the dashboard consumes the styleguide's "dark-first
  with a light toggle" theme switch **unforked** (ADR-0003): the `ThemeToggle` Dark/Light control (from
  `styleguide/app/live.js`) lives in the topbar **settings menu** (the gear dropdown, aw-049;
  inline in the topbar over aw-029, after a brief stint in the aw-026 rail footer; originally in the
  retired horizontal header), feeding the existing `ThemeCtx.Provider` and a `data-theme` documentElement effect that animates
  the flip with the styleguide `theme-fade` transition (agentic-workflow-017). **Theme resolution +
  persistence** is a sibling presentation concern to the board view-state: a **separate** versioned
  `localStorage` store (`dashboard/app/theme-state.js`, key `agentheim.dashboard.theme`) with the same
  safe-degradation shape. On a **first visit** (no stored override) the OS `prefers-color-scheme` wins;
  once the user toggles, that override is remembered across reloads. A malformed / stale-version / absent
  blob degrades to the **system default**, and the resolved theme is read once on mount so an SSE
  re-projection never resets it mid-session. See ADR-0015, ADR-0009, ADR-0003.
- **Persisted skip-permissions armed toggle** — a control that lives in the topbar **settings menu**
  (the gear dropdown, agentic-workflow-049; inline in the topbar over aw-029, after a brief stint in
  the aw-026 rail footer; introduced aw-021), **off
  by default**, that when **armed** makes **every** bridge launch request a skip-permissions session:
  `launchOrCopy` threads an optional `skipPermissions` flag through its one shared seam, so all
  bridge launches — the prompt-bar Quick Capture / Modeling pair (aw-020, relocated to the board
  prompt bar in aw-023), the **topbar Work** button (aw-024's prompt-bar Work button, relocated to
  the main-column topbar in aw-026) **and** the per-card Refine / Promote
  pair (aw-022) — POST
  `{ prompt, skipPermissions: true }`, and the bridge (infrastructure-016)
  seeds `claude --dangerously-skip-permissions "<prompt>"`. When **off** the field is **omitted, never
  sent `false`**, so the OFF path is byte-identical to today and matches the contract's strict-`true`
  activation (amended ADR-0018). The bypass is **never silently on**: the armed choice is a **separate**
  versioned `localStorage` store (`dashboard/app/skip-permissions-state.js`, key
  `agentheim.dashboard.skipPermissions`, default OFF) — a sibling of `theme-state.js` (aw-017) and the
  board view-state (aw-014 / ADR-0015) — whose every degraded path (malformed / stale-version / absent
  / non-boolean / no backend / throwing backend) resolves to **OFF**, never a throw, never on. It is
  presentation view-state only — never a disk lifecycle write — so the dashboard stays read-only over
  `.agentheim/` (ADR-0017 / ADR-0001) and the armed choice survives every SSE re-projection untouched.
  The control lives in the topbar **settings menu** next to the theme toggle and the Stop dashboard launch
  (the aw-017 persisted-control precedent; inline in the topbar over aw-029, collapsed into the gear in aw-049,
  which supersedes aw-021's "not a settings panel — one setting today" micro-decision now that three controls
  collapse together), and carries an **armed / danger**
  treatment so it never reads as a neutral preference. Inside the open menu the toggle keeps its full
  `--obligation` danger hue (the menu stays open when it is flipped); the **closed gear carries no armed cue**
  (aw-049 decision 3 / amended ADR-0019). Per the **amended ADR-0018** mandate, when armed
  **each** of the four launch buttons also shows an at-a-glance per-launch "skips permissions" cue —
  the button's **icon tinted with `--obligation`** (narrowed by **aw-030 then aw-041 / amended ADR-0019**
  from the original `--obligation` border + label tint, down to a separate dot, down to just the
  always-rendered icon tinted red, so the **toggle** is the single control wearing the full danger hue;
  the red icon still satisfies the amended ADR-0018 per-launch mandate)
  reflecting the **armed toggle state, not a live
  bridge probe** — it never probes `/api/bridge` on render (that would break the silent-absence
  contract and add a probe to every paint). The **clipboard fallback never carries the bypass** (it
  copies a slash command to paste into a *running* session; `--dangerously-skip-permissions` is
  startup-only), so the indicator signals armed **intent**; the bridge-present/absent asymmetry is
  **accepted** (amended ADR-0018), not a defect. The armed/danger hue is the **existing** styleguide
  `--obligation` token family, consumed **unforked** (ADR-0003) — deliberately **not** the reserved
  selection accent `--accent-ochre-soft` (ADR-0016), and **no** new design-system child task (refinement
  decision); repurposing a money-named token for a generic danger cue is flagged for the design-system
  README to reconcile later (ADR-0019). The store and the `launchOrCopy` flag-threading are covered by
  **pure** unit tests under `node --test` (both armed states + the omit-not-false body shape). See
  ADR-0019, ADR-0018, ADR-0016, ADR-0003, ADR-0015, ADR-0017, ADR-0001.
- **Backlog card launch pair (Refine / Promote)** -- a backlog ticket invites two real next actions:
  **deepen** it or **mark it ready**. Each **backlog** card surfaces both (agentic-workflow-022,
  replacing aw-016's single **Copy** button) as a **two-button launch group** supplied *into* the
  styleguide `TicketCard`'s single `cornerAction` slot (design-system-006) -- the card's bottom-right
  meta slot where the now-dropped `... pt` estimate chip used to sit. **Refine** (primary / emphasised)
  seeds `/agentheim:modeling refine <id>` (the full Socratic refinement) and **Promote** (quiet /
  de-emphasised) seeds `/agentheim:modeling promote <id>` (the readiness check + backlog → todo move);
  the verbs are explicit on purpose so they read unambiguously to the `modeling` skill's REFINE /
  PROMOTE routing. Promote only ever runs backlog → todo, so the group is **backlog-only** -- other
  columns pass no `cornerAction`. Each button opens a **real, interactive Claude session** through the
  VS Code **bridge** (ADR-0018), falling back **silently** to copying its own command to the clipboard
  when the bridge is absent -- it reuses aw-020's `launchOrCopy` (`dashboard/app/bridge-launch.js`)
  unchanged (see *Backlog launch buttons* below for the full bridge contract). The slot is
  click-isolated by the styleguide, and each button also stops propagation defensively, so launching
  never opens the slide-over. **`cornerAction` is now demonstrated carrying a consumer-composed
  multi-control group, not just a single icon button** -- this stays *within* ds-006's render-prop
  contract ("consumer owns what renders"; the styleguide keeps owning the slot's placement +
  stop-propagation wrapper), so it is **unforked** consumption (ADR-0003), not an extension of the
  primitive, and filed **no** design-system child task. (A matching one-liner is worth adding to the
  design-system README; the worker may only edit this BC's README -- flagged for the orchestrator.)
  The command **strings** are **pure** functions of the id -- `dashboard/app/modeling-command.js`
  (`refineCommandFor`, `promoteCommandFor`, unit-tested under `node --test`; the old per-card
  `modelingCommandFor` is retired with its sole caller, `MODELING_COMMAND` / `QUICK_CAPTURE_COMMAND`
  stay for the column pair); a missing/non-string id degrades to the bare verb command (never
  `[object Object]`, never a throw). The **add-ticket affordances are backlog-only**
  (agentic-workflow-018): the styleguide `EmptyColumn` empty-state **"Add ticket"** button and the
  `ColumnHeader` **`+`** are now **optional slots** keyed off an `onAdd` prop (default OFF, mirroring
  ds-006's `cornerAction`); todo / doing / done render the empty-state icon + "No tickets in
  &lt;status&gt;." copy and a header with **no `+`** -- the board is a projection of disk (ADR-0001),
  you don't *add* tickets to those columns from here. Launching a session is an **external
  side-effect**, not a lifecycle write: the board stays a projection of disk. See ADR-0018, ADR-0003,
  ADR-0009, ADR-0001.
- **Board card dismiss (hover-revealed trash can)** -- a **backlog** or **todo** ticket sometimes just
  needs to go away (a duplicate, a stray capture, an abandoned idea). Each backlog/todo card carries a
  **red trash-can button** in its **top-right corner** (agentic-workflow-048): hidden at `opacity: 0`,
  revealed on **card hover** *or* the button's **own keyboard focus**, and highlighting (intensified
  `--obligation` fill) on its own hover. **Backlog + todo only** -- doing/done never show it (DISMISS
  refuses those states, ADR-0022). Placement is a **board-local overlay**, *not* the `cornerAction`
  slot: `cornerAction` is the card's **bottom-right** meta row (where Refine/Promote sit), so the board
  wraps each card in a `position: relative` host and absolutely positions the trash at the host's
  **top-right** as a **sibling** of the card -- the styleguide `TicketCard` is consumed **unforked**, no
  new prop, no styleguide edit for placement. On backlog cards the trash (top-right) coexists with the
  Refine/Promote pair (bottom-right); on todo cards it stands alone. The trash glyph is the shared
  `Icon name="trash-2"` (design-system-017) tinted with the `--obligation` danger token (ADR-0016),
  consumed unforked -- never the reserved selection accent `--accent-ochre-soft`. Clicking opens the
  shared styleguide **`ConfirmDialog`** (design-system-018, consumed **unforked** -- ADR-0003) with
  `destructive=true`, naming the card; **Confirm** fires `/agentheim:modeling dismiss <id>`
  (`dismissCommandFor`, the pure explicit-verb builder beside `refineCommandFor`/`promoteCommandFor`,
  unit-tested under `node --test`) through the existing `launchOrCopy` bridge path (silent clipboard
  fallback when the bridge is absent), and **Cancel / Esc / scrim-click** (all the dialog's own
  `onClose`) close it with no effect. The board is **read-only** (ADR-0017): the button only
  *seeds-and-fires* -- the spawned `modeling` session runs the **cascade** dismiss and **lists +
  re-confirms the full dependent subtree** before deleting anything (ADR-0022), so the dialog body says
  so (the card can only name itself). The card disappears via the existing SSE live-update once the
  agent deletes the file -- **no** dashboard write path. Like every other launch, the dismiss now
  **threads the armed `skipPermissions` signal** (agentic-workflow-051, reversing aw-048): the armed
  value arrives as a prop from the single `skip-permissions-state.js` store -- no second source, no
  `/api/bridge` probe on render -- and the bridge POSTs `{ prompt, skipPermissions: true }` **only when
  armed**, omitting the field otherwise (strict-`true` contract, never sends `false`; OFF path stays
  byte-identical to aw-048). The clipboard fallback still carries **no** bypass
  (`--dangerously-skip-permissions` is startup-only). Dropping the prompt on a hard-deleting cascade is
  safe because the spawned `modeling` session re-confirms the full subtree **inside** the session
  (ADR-0022) -- that guard survives `--dangerously-skip-permissions`. No distinct per-launch armed cue
  is needed: the trash glyph is **already** `--obligation`-tinted because it is destructive (aw-048), and
  under aw-041 doctrine the toggle is the single control wearing the danger hue, so dismiss satisfies
  ADR-0018's per-launch mandate trivially. The click is propagation-isolated so dismissing never
  opens the slide-over. The dashboard `dist/` was rebuilt (esbuild) so the deployed app carries the
  change. See ADR-0022, ADR-0017, ADR-0018, ADR-0019, ADR-0003, ADR-0016.
- **Board prompt bar (Quick Capture / Modeling / Inquire / Research)** -- the backlog column's former single
  add-ticket **`+`** first became **two** labelled launch buttons inside the backlog column
  (agentic-workflow-020), then those two buttons were **relocated** (agentic-workflow-023) out of the
  column into a **board-level prompt bar**: a prompt **field** rendered on the **board view
  only**, above the `Board` count strip, with the two buttons beneath it. In **agentic-workflow-024** the
  bar briefly carried a right-side **Work** button in a two-thirds/one-third split; **aw-026 removes it**
  -- the Work launch moves to the **main-column topbar** (see *Shell layout* below), so the prompt bar
  collapses back to a **full-width field** above the unchanged Quick Capture / Modeling pair. There is
  now **one** Work entry point. `WORK_COMMAND` and the `launchOrCopy` / `LaunchButton` wiring are reused
  unchanged -- only the button's *home* changed. The field + buttons are board-local, token-matched
  layout (flex), the styleguide consumed **unforked** (ADR-0003).
  **The field is a single-logical-line, auto-growing control (aw-038):** a `<textarea>` element whose
  ref drives the auto-grow measurement, constrained to author **one
  line of text** -- it soft-wraps with **no horizontal scrollbar** (`overflowX: hidden`), **auto-grows**
  in height to fit the wrapped content (`autoGrowField` measures `scrollHeight`) up to a max then
  **scrolls vertically**. **Enter is swallowed** (`onKeyDown` `preventDefault` -- no newline, no launch;
  Shift+Enter is no special case), and every change runs through the pure **`sanitizePromptLine`** so the
  stored value can **never hold a newline** -- a multi-line **paste collapses to one line**. The launch
  builders read this sanitized value, so the seeded-command contract and the empty/whitespace bare
  fallback are unchanged.
  **The bar carries a board-local `Prompt` title above the field (aw-054)**, token-matched to the
  `Board` title (same `--font-ui` / 15px / 600 / `--fg-1`) so the capture region and the board below
  read as two labelled zones; vertical whitespace above the `Board` title separates them. Both are
  board-local, token-matched elements -- the styleguide stays unforked (ADR-0003).
  **The three launch buttons are icon-tile + title/subtitle cards (aw-065):** a visual restyle of the
  former flat chips into a board-local **`PromptLaunchCard`** -- a square **neutral** icon tile
  (`plus` / `compass` / `message-circle-question` / `search` from the registry, `--surface-2` fill,
  never a coloured fill) over a
  bold **title** and a quiet **subtitle** (Quick Capture / "File it fast", Modeling / "Shape into
  structure", Inquire / "Ask the codebase", Research / "Dig deeper"). A **fourth** card --
  **Inquire** (aw-h7n2c) -- sits **between Modeling and Research**, wearing the
  `message-circle-question` glyph (design-system-r4k8m), in the same quiet/secondary treatment as
  Modeling/Research; it seeds `/agentheim:inquire <prompt>` (`inquireCommandFor`) to launch the
  read-only **`inquire`** skill (answers questions *toward* the codebase, ADR-0017). **Quick Capture carries the emphasised treatment via the
  primary surface** -- the aw-033 Work chrome (`--surface-2` fill, `--fg-1` text, `--hairline-strong`
  border); Modeling and Research stay **quiet/secondary** on a plain `--hairline` border. This is
  *emphasis*, not a selected state (no selection model), and it deliberately **does not use ochre** --
  the reserved `--accent-ochre-soft` selection accent is untouched (**ADR-0016**), so the restyle is
  intentionally off-mock on colour. The card's interaction is **byte-identical** to the former chips:
  the same `launchOrCopy`, per-button seeded commands, armed `skipPermissions` threading and the
  `onResult` clear-textarea + confetti success path. A **decorative** right-of-row helper ("Type a
  prompt to begin" + a `⌘↵` chip) hints the flow but **fires nothing** -- aw-038's swallowed Enter is
  untouched (no Enter-to-launch). This decision is shared with aw-064 (the Work-button restyle).
  **A `WhatsNextPanel` sits ABOVE the `Prompt` title (aw-073 / ADR-0027):** the **dashboard half** of
  the What's next feature, the read surface for the skill's *advisory write* (aw-076). It fetches the
  single-latest recommendation artifact (`.agentheim/state/whats-next.md`) through the **existing
  `/api/doc` body carrier** (the in-root-guarded transport, **not** `/api/tree`, which stays
  pointers/metadata only -- ADR-0023). Unlike the slide-over / main-pane reader, it is a **glanceable
  advisory card, not a document**: the leading YAML is **stripped** (no folded "Front matter" `<details>`)
  and the **three named body sections** (*where things stand* / *recommended move* / *next*) lay out as
  **three side-by-side columns** instead of one stacked stream (aw-q7m4k), each column wrapped in its own
  **board-local, token-matched CARD** (a `--surface-1` fill on a `--hairline` border, token radius +
  padding) that is **height-capped** (~two ticket cards, `maxHeight: 196`) and **scrolls its overflow
  internally** (`overflowY: auto`, the quiet styleguide `scroll-quiet` scrollbar) so the advisory strip
  stays a compact top strip and never pushes the board down regardless of recommendation length (aw-c4t8m).
  The body is split by the pure
  **`splitWhatsNextSections`** (`dashboard/app/whats-next-state.js`) -- **loss-tolerant**: a degraded body
  yields whatever columns are parseable, never throws. Each column's content still renders through the
  **unforked styleguide `Markdown` primitive** (ADR-0003) -- board-local token-matched layout (auto-fit
  grid collapsing to one column on a narrow board), **no bespoke renderer, no new design-system child**,
  light/dark aware. It **re-fetches on every SSE `tree-changed` frame** (a new
  advisory write surfaces live, ADR-0006), shows a **staleness cue** derived from the `generated`
  timestamp (rendering only -- nothing keys behaviour off it, ADR-0027 §4), and is **dismissible**: the
  dismissed state persists across reload in a new versioned `localStorage` store
  **`dashboard/app/whats-next-state.js`** (sibling of `theme-state.js` / `board-view-state.js`), **keyed
  by `generated`** so a *newer* recommendation re-shows. The panel is **read-only over the artifact**
  (ADR-0017): dismiss touches `localStorage` only, never the file. Every degraded path -- **absent**
  artifact, **malformed/partial** body, stale-version / non-string / no-backend store -- resolves to
  "render nothing" or "not dismissed" and **never throws**.
- **Shell layout (aw-026, styleguide §05)** -- the live shell is the styleguide "Components in context"
  full-height **left rail** beside a **main column**. The main column is a ~52px **topbar** (the global
  **search field** — aw-052; was a dead breadcrumb until then — plus **two standing launches**: the
  secondary **What's next** chip and the **primary** Work action that **follows the active theme**) over
  the scrollable
  board. The primary button **is the Work launch**: a read-only launch of the bare `/agentheim:work` (`WORK_COMMAND`) via
  `launchOrCopy` -- `emphasis="primary"` (`idleBg: var(--surface-2)`, `idleColor: var(--fg-1)`,
  `idleBorder: var(--hairline-strong)` — light fill+dark text in light mode, dark fill+light text in dark
  mode; aw-033 switched it off the §05 `inverse` opposite-scheme treatment, which read as the wrong theme),
  threading `skipPermissions` (aw-021 / ADR-0019), passing **no**
  `onResult`. As of **aw-064** Work renders `Work ↗`: its glyph moved to the **right** of the label
  (the `LaunchButton` `trailingIcon` prop — a board-local order flip, the styleguide `Icon` consumed
  unchanged, ADR-0003) and became the up-right diagonal `square-arrow-out-up-right`. Work keeps its
  primary-surface fill — **no ochre** (ADR-0016 untouched). Beside it, **What's next** (aw-064) is a
  second standing launch (the bordered secondary chip, the `sun` glyph consumed unforked) that fires the
  bare slash command `/agentheim:whats-next` (`WHATS_NEXT_COMMAND`) — the read-only `whats-next` skill
  (aw-069 swapped it from the interim raw prompt aw-064 shipped) — through the same `launchOrCopy` path,
  threading `skipPermissions`, passing no `onResult`, writing no lifecycle state (read-only, ADR-0017).
  The `whats-next` skill is read-only **over lifecycle**, but it performs **one** *advisory write* (aw-076,
  ADR-0027): a single-latest, overwritten, git-ignored recommendation artifact at `.agentheim/state/whats-next.md`
  (frontmatter `generated` ISO-8601 timestamp + three sections — *where things stand* / *recommended move* /
  *next*). An **advisory write** is an opinion *about* the state, not a change *to* it — distinct from a
  lifecycle write, so it re-opens neither ADR-0017 nor the skill's read-only-over-lifecycle stance; the skill
  still moves no task, promotes nothing, edits no `INDEX.md` / `protocol.md`, and runs no `git` action. The
  `state/` directory is a third top-level write location under `.agentheim/` (sibling of `knowledge/` and
  `contexts/`), the git-ignored home for advisory machine-written signals; the dashboard reads this artifact
  (aw-073) and never writes it.
  The topbar's leading slot now hosts the **global search field** (aw-052, see *Global search
  (topbar)* below). The rail is composed
  from styleguide **primitives** (`Glyph` / `RailItem` / `Collapsible` / `TreeItem`), **not** the demo
  `AppRail`, and its tree is the **live** `treeToLibrary(/api/tree)` projection (re-fetched on every SSE
  frame, ADR-0011). As of **aw-n4h7q** the rail composes the group header `Collapsible` + row `TreeItem`
  **directly** (rather than the `TreeGroup` convenience, which has no attention seam) so it can drive the
  **"new item" attention cue** (design-system-v8k2p): a research report or ADR that is **created or
  modified** during the current page session **blinks** in the rail until clicked or the page is
  reloaded. The detection/clearing brain is the pure `rail-attention.js` (`railMtimeIndex` /
  `flaggedPaths` / `annotateGroups`): on first projection it freezes a **session baseline** map of
  research/ADR `path → mtimeMs` (from aw-t3b9k's `locations.adrsMeta` / `researchMeta`); each live
  re-projection diffs against it — a path absent from the baseline (**created**) or carrying a newer
  `mtimeMs` (**modified**) flags, **reconciled** against the live projection (a vanished doc drops out,
  no orphaned blink) with **no cap**. A flagged leaf propagates a **derived** cue to its group header
  (so an arrival under the collapsed Decisions group still shows). Clicking a flagged row clears **only**
  that entry, **mtime-versioned** (a still-newer edit re-flags). The baseline + cleared maps are
  **in-memory presentation state only** — a reload resets them (the acknowledgement-by-reload model);
  no `/api` write, no `localStorage`, no disk (ADR-0017). The outer shell frame is **bounded to the viewport** (`height: 100dvh`,
  `overflow: hidden`; aw-067) so the **rail and topbar stay fixed** and the inner `scroll-quiet` content
  region (`flex: 1`, `minHeight: 0`, `overflowY: auto` — holding the board / main-pane reader / workflow /
  about page) is the **sole vertical scroll container** — the window itself never scrolls. The topbar is a
  sibling **above** that scroll region, so its search-results popover (ds-016) is not clipped.
  See ADR-0009, ADR-0003, ADR-0017, ADR-0018.
- **Topbar settings menu (aw-049; consumes the shared primitive as of design-system-015)** -- a
  **dropdown** (`SettingsMenu`) behind a single **settings gear** (the reused `settings-2` glyph from the
  styleguide icon set — consumed **unforked**, no styleguide edit, no new glyph) that sits immediately
  **left** of the standing What's next + Work launches, so the topbar reads `[search field] … [⚙] [What's next] [Work ↗]` (aw-052 / aw-064). It collapses the
  three utility controls — the **Stop dashboard** launch, the **theme** toggle and the **skip-permissions**
  armed toggle — that aw-029 (toggles) and aw-028 (Stop) had spread across the topbar; only Work stays
  standing. aw-049 first shipped this as a **board-local** token-matched dropdown (the sort-`<select>` /
  group-by precedent); **design-system-015** then extracted the shared styleguide `Menu`/`Popover` primitive
  and retired the board-local machinery, so the gear dropdown now **consumes that primitive unforked**
  (ADR-0003) — the aw-014 → ds-005 sequencing, completed. The three relocated controls
  keep their behavior + persistence **as-is** (relocation, not rewrite). **Dismissal:** Esc, outside click,
  and selecting Stop dashboard close the menu; flipping the **theme** or **skip-permissions** toggle **keeps
  it open** (so both can be adjusted in one visit; inside clicks are scoped by a container ref). The
  **closed gear carries no armed cue** — the skip-permissions `--obligation` danger hue lives only on the
  toggle inside the open menu (amended ADR-0019). The gear is keyboard-operable (focusable, Enter/Space
  opens, `aria-haspopup`/`aria-expanded`, Esc closes) and the reveal honors `prefers-reduced-motion`. See
  ADR-0003, ADR-0017, ADR-0019.
- **Stop dashboard from the UI (aw-028; relocated aw-049)** -- a quiet `LaunchButton` (`emphasis="quiet"`)
  that, as of **aw-049**, lives inside the topbar **settings menu** (the gear dropdown) rather than inline
  at the far left of the topbar; **selecting it closes the menu** before flipping the stopped overlay. It
  **reuses the existing bridge launch path
  unchanged** (`launchOrCopy`, no new server endpoint) to run the bare `STOP_DASHBOARD_COMMAND`
  (`/agentheim:dashboard stop`, a plain constant in `modeling-command.js`, mirroring `WORK_COMMAND`).
  The spawned session runs `/dashboard stop` -> `stopDashboard(root)` (aw-011), so the server is
  **never asked to stop itself** -- `server.mjs` stays purely read-only (ADR-0017; the seam decision
  was bridge-reuse over a self-stop endpoint). **No confirmation step** (a single click stops). It does
  **not** thread `skipPermissions`, so it never wears the armed/danger `--obligation` per-launch cue
  (aw-021/ADR-0019 is a non-goal for a stop). The outcome is driven off `launchOrCopy`'s discriminated
  return: `res.via === "bridge"` flips a shell-level "stopped" state, rendering a board-local,
  token-matched full-pane **"Dashboard stopped -- safe to close this tab"** overlay (`StoppedOverlay`)
  over the main content area (optimistic on dispatch; the SSE stream dropping corroborates it). A
  `res.via === "clipboard"` fallback stopped nothing, so it shows **no** overlay -- just the existing
  quiet "Copied" flash. The overlay is composed from tokens, **not** the `Drawer` side panel (there is
  no full-screen modal primitive; ADR-0003 unforked). See ADR-0017, ADR-0018, ADR-0001, ADR-0003.
  The textarea is a board-local, token-matched control (the styleguide has no
  text-input primitive; the board-control precedent -- the sort `<select>`, the group toggle -- keeps
  the styleguide consumed **unforked**, ADR-0003). The builder **authors a prompt once and hands it to
  whichever authoring skill they pick**: clicking **Quick Capture** seeds `/agentheim:quick-capture <prompt>`
  (the fast idea-dump, renamed in aw-019), **Modeling** seeds `/agentheim:modeling <prompt>` (the
  full Socratic session), **Inquire** (aw-h7n2c, a fourth card between Modeling and Research) seeds
  `/agentheim:inquire <prompt>` (the read-only inquire skill), and **Research** (aw-036, a third button
  beside the pair) seeds
  `/agentheim:research <prompt>` (the research skill), where `<prompt>` is the **trimmed** textarea contents joined to the command
  by a single space. An **empty / whitespace-only** textarea falls back to the **bare** command
  (byte-identical to aw-020). On a **successful launch or landed clipboard copy** the textarea is
  **cleared** and a board-local **confetti** burst plays; a fully-silent action
  (clipboard blocked too) clears nothing and plays nothing. The burst is rendered by **canvas-confetti**
  (aw-034 swapped out the original hand-rolled CSS-keyframe burst -- it is the dashboard's first
  **bundled** frontend runtime dependency, `import`ed in `board.js` and folded into `dist/app.js` by
  esbuild, **no CDN**). It is canvas-confetti's canonical **"realistic look"** preset (aw-042):
  a **layered multi-fire burst of five overlaid `confetti()` shots** (a shared `count: 200` with
  per-shot `particleRatio` / `spread` / `startVelocity` / `decay` / `scalar`), all fired from a
  **centered origin** `{x:0.5, y:0.7}` with **no angle aim** -- a symmetric upward spray from the
  center of the screen, retiring aw-037's single textarea-aimed burst (the `getBoundingClientRect`
  read, the aim helper and the textarea-ref-to-confetti plumbing are gone; the textarea ref now serves
  aw-038's auto-grow only). The five-shot profile lives in the pure `confettiFireSequence`
  (`confetti-launch.js`); `fireConfetti` walks it, issuing one `confetti()` call per shot with
  `particleCount = Math.floor(count * particleRatio)` -- board-**owned** and not a styleguide motion
  primitive (ADR-0020 amended: "board-local" means ownership, not pixel footprint; origin / tuning is
  considered settled per aw-034/aw-042, and the temporary aw-025 replay-loop dial has been removed,
  aw-044). The confetti honours
  `prefers-reduced-motion` (ADR-0014's strip-to-plain contract -- the `matchMedia` guard means
  `confetti()` is never invoked under reduce, so it renders nothing) and draws its colors from the four
  **status-palette bases** (`--st-done` / `--st-todo` / `--st-doing` / `--st-backlog`), **resolved at
  fire time** via `getComputedStyle` so the burst tracks the active light/dark theme; never the reserved
  selection accent `--accent-ochre-soft` (ADR-0016) nor the `--obligation` skip-permissions danger hue
  (aw-021). The
  per-card Refine / Promote pair (aw-022) stays **id-seeded** and does **not** pick up the prompt.
  Each button opens a **real, interactive Claude session**
  through the VS Code **bridge** (ADR-0018): the frontend discovers the listener via the dashboard's
  own `GET /api/bridge` (port + per-activation token, never hardcoded -- infrastructure-014), confirms
  it is live with a token-bearing `GET /health` (~800 ms timeout), then `POST /run { prompt }` with the
  `X-Agentheim-Bridge-Token` header; the extension wraps the prompt as `claude "<prompt>"` and opens
  the terminal. **Bridge-absence is a normal mode, never an error**: when the page is not in VS Code's
  Simple Browser, or the listener is unreachable, or `/health`/`/run` time out / refuse / reject CORS /
  return non-200 -- *any* failure -- the button falls back **silently** to copying its command to the
  clipboard (the aw-016 `copyToClipboard` no-throw guard + the same quiet "Copied" feedback). No toast,
  no console crash, no broken-looking button. The **launch-vs-copy decision** is a **pure**, framework-free
  function of an injected `fetch` + `copy` -- `dashboard/app/bridge-launch.js` (`launchOrCopy`,
  `BRIDGE_TOKEN_HEADER`, unit-tested under `node --test`); it never throws or rejects. The exact
  launched/copied command **strings** come from `dashboard/app/modeling-command.js`
  (the bare `QUICK_CAPTURE_COMMAND` / `MODELING_COMMAND` / `WORK_COMMAND` constants, plus the prompt-taking
  `quickCaptureCommandFor(prompt)` / `modelingCommandFor(prompt)` builders that append a single space +
  the trimmed prompt or degrade to the bare command -- aw-023; `WORK_COMMAND` is a bare constant with no
  builder, since Work never appends the prompt -- aw-024; `WHATS_NEXT_COMMAND` -- aw-064 button, aw-069
  swap -- is likewise a bare constant, the fully-qualified `/agentheim:whats-next` slash command firing
  the read-only `whats-next` skill, since the topbar's What's next launch ignores the prompt-bar too)
  -- one source of truth for both paths.
  Launching a
  session is an **external side-effect** (like the clipboard copy), **not** a lifecycle write: the board
  stays a projection of disk (ADR-0001). See ADR-0018, ADR-0003, ADR-0001, ADR-0009.
- **Live-update (SSE consumer)** — the board keeps itself current (agentic-workflow-009) by
  subscribing to `GET /api/events` (the SSE transport, infrastructure-003 / ADR-0006) via the
  framework-free `dashboard/app/live-update.js` (`createLiveUpdate`). On every `tree-changed`
  frame — and on every (re)connect — it does **one** thing: re-fetch `/api/tree` and re-project
  the whole board. It **never** interprets the raw pointer as a transition (the watcher stays
  transport-only); re-fetching is idempotent, so a burst of changes collapses into re-fetches with
  no double-apply. EventSource auto-reconnects and the board re-syncs on reconnect — no
  missed-event bookkeeping. Disk is the source of truth; the board is a projection rebuilt from it.
  This is the **only** way state reaches the board — there is no UI write to echo (ADR-0017). See
  ADR-0012, ADR-0006, ADR-0017.
- **No write path (read-only dashboard)** — the dashboard never writes lifecycle state (ADR-0017).
  The former drag-to-Promote endpoint (`POST /api/task/move`, agentic-workflow-009) and its client
  (`dashboard/app/promote.js`) were **removed**: cards are not drag sources, columns are not drop
  targets, and the HTTP server exposes only reads + the SSE stream + static assets. Task-lifecycle
  transitions are owned entirely by the skills (`modeling` promotes, `work` claims/completes),
  which move files on disk together with the readiness check, `depends_on`/gate guard, INDEX
  update, and protocol entry; the board reflects those moves via the live-update stream. See
  ADR-0017, ADR-0007.
- **Slide-over** — the dashboard's right-hand detail panel (agentic-workflow-007): a
  Notion-style drawer for a board **task**. As of **aw-027** it is **task-only** — the
  open-intent now SPLITS on artifact kind (see *Open-intent routing*), so non-task documents
  render in the main pane, not here. It consumes the board's *open-this-task* intent, fetches
  the body via `GET /api/doc?path=`, and renders the markdown **client-side** (no SSR) through
  the approved styleguide `Drawer` + `Markdown` — imported as-is from the committed dist, never
  forked (ADR-0003). The slide-over hands the `Drawer` a *doc-shaped* item
  (`{ type, meta: <real path>, title, body }`) so the real in-root path is carried and the
  fetched markdown rendered (ADR-0010, reshaped by ADR-0021). The header **leads with the
  item `title`** (styleguide Drawer, design-system-014) and demotes the path to a quiet mono
  sub-line — `intentToDrawerItem` threads `intent.title` onto the doc item (agentic-workflow-047).
  Lives in `dashboard/app/slide-over.js`
  over the pure, unit-tested `dashboard/app/slide-over-data.js`. Esc and scrim-click close it.
  To get more reading room the header's old "Open in full screen" maximize button was **replaced
  (agentic-workflow-074)** by an **in-place expand chevron** (the styleguide `Drawer`'s ds-020
  body-top chevron): clicking it **widens the drawer where it is** to fill the main content area —
  everything right of the 248px `ShellRail` — and clicking again collapses it back. The slide-over
  **owns the controlled expand state** (`expanded` / `onToggleExpand`) and supplies the only
  rail-aware fact, `expandedWidth = calc(100vw - 248px)`; the chevron, the collapsed default, the
  animated width transition and its reduced-motion strip all live in the unforked `Drawer` (ds-020,
  ADR-0003 / ADR-0014). Reopening a task **resets to collapsed** (no persisted expand state); Esc
  still closes the slide-over outright. Reopening starts narrow because the expand flag resets on
  every open-intent change. The slide-over **no longer forwards `onOpenFullScreen`** to the `Drawer`,
  so the maximize button is gone — but the **aw-039 "promote out → main pane" path itself stays**
  (`setSelectedDoc(openIntent); setOpenIntent(null)`, board.js); it is now reached from **global
  search** (aw-052) routing tickets through the main pane, not from the slide-over header. The
  **Board** rail item returns to the board. See ADR-0010, ADR-0021, ADR-0009, ADR-0003, ADR-0014.
- **Global search (topbar)** — the dashboard's search surface (agentic-workflow-052): the topbar's
  leading slot (the former dead breadcrumb) is the **global search field** that, as you type, queries
  `GET /api/search` (aw-050) and opens a floating panel of **category-grouped** results
  (Bounded contexts → Concepts → Decisions → Research → Tickets, aw-075), each row a title + a matched-text excerpt with
  the term marked. It **consumes the design-system `SearchField` combobox unforked** (design-system-016,
  ADR-0003): ds-016 owns the input chrome, the floating panel, and the active-descendant keyboard model
  (up/down across all rows, Enter opens, Esc closes + clears); the dashboard owns the controlled query
  `value`, the **~200ms debounce**, the **min-length-2 fetch gate** (the field still shows every typed
  char — the gate only suppresses the network call), and the one pure transform
  (`dashboard/app/search-results.js` → `searchResultsToGroups`) that buckets aw-050's **flat** ranked
  `results` into ds-016's `groups: [{label, items}]` in fixed order, preserving the within-category
  ranking. Selecting a result loads the document into the **main content pane** (`MainPaneReader`) for
  **both** kinds — non-task docs as aw-027 does **and** tickets via the aw-039 "open in full screen"
  path (not the slide-over) — routed through the unchanged `isTaskIntent` (ADR-0021) over the intent
  shape the result already carries. An empty/whitespace query shows no panel; any non-empty query with
  no matches (incl. a sub-min query the backend never walks) shows ds-016's honest "No matches" line.
  Read-only (ADR-0017). See ADR-0023, ADR-0021, ADR-0017, ADR-0009, ADR-0003.
- **Main-pane reader** — the dashboard's reading surface for a non-task **document**
  (agentic-workflow-027): vision, context map, BC README, ADR, research. Selecting a rail row
  opens its document in the **main content area** (where the board otherwise sits), not the
  slide-over. It reuses the one `/api/doc` fetch (`docUrl`) and renders the markdown
  client-side through the styleguide `Markdown` primitive, consumed unforked (ADR-0003). Lives
  in `dashboard/app/main-pane-reader.js`. The reading column keeps a comfortable measure
  (`maxWidth: 760`) and is centered **horizontally** in the content area (`margin: 0 auto`,
  agentic-workflow-040) — block centering, not center-aligned text. Its ready-state header
  **leads with `doc.title`** (`--font-ui`, strong `--fg-1`) over a demoted quiet mono path
  sub-line (agentic-workflow-047). The main pane shows EITHER
  the selected document OR the board (the default); the rail's **Board** item returns it to the
  board. See ADR-0021.
- **Frontmatter folding** — both render surfaces share one pure helper,
  `dashboard/app/frontmatter.js` (`parseFrontmatter` / `frontmatterSection` /
  `withFrontmatterSection`, unit-tested under `node --test`, agentic-workflow-043). A document's
  leading YAML frontmatter would otherwise reach the styleguide `Markdown` primitive raw and be
  rendered by `marked` as one large bold setext heading (the trailing `---` reads as an
  underline). The helper runs **upstream of `Markdown`**: it strips the first `---`…`---` block
  out of the body and re-emits it as a quiet, token-styled, collapsed-by-default native
  `<details><summary>Front matter</summary>` table (one row per field, HTML-escaped) prepended to
  the stripped body. `marked` passes the raw HTML through (ADR-0003), so the same composed string
  flows through the `Drawer` (slide-over) and the direct `Markdown` (main-pane reader) — both
  primitives stay **unforked**, no design-system change. A document with no frontmatter passes
  through unchanged. Wired in `slide-over.js` (success path only) and `main-pane-reader.js`.
- **Open-intent routing** — the shell (`DashboardApp`) routes every clicked artifact on
  artifact KIND via the pure `dashboard/app/intent-route.js` → `isTaskIntent`
  (agentic-workflow-027): an intent carrying a lifecycle `status` is a **task** → slide-over; an
  intent carrying a content `type` and no `status` is a **non-task document** → main pane. No
  new intent field is needed — the discriminator falls out of the data the board and the rail
  already emit. The shell holds two open-intent states: `openIntent` (task →
  slide-over) and `selectedDoc` (doc → main pane). See ADR-0021. As of **aw-058**
  (**ADR-0025**) a **third main-pane view state** `mainView`
  (`"board" | "workflow" | "about"`, default `"board"`) sits beside them for
  **built-in static pages** — a page that is neither a task (no `status`) nor a
  disk-fetched document (no `path`), selected by its own `onSelectWorkflow` /
  `onSelectAbout` handler, **not** the `onOpen`/`isTaskIntent` machinery (which stays
  byte-unchanged). Main-pane render precedence is **workflow → about → document →
  board**; the states are mutually exclusive *by construction* (each `onSelect*` handler
  clears the other selections; every board/doc handler resets `mainView` to `"board"`).
  The `mainView` enum is built to extend — **aw-062** added the `"about"` page (the
  builder bio + a Ko-fi support card) as the one-line extension ADR-0025 anticipated.
  As of **aw-059** the `"workflow"` page carries its real layout: **three named
  segments** — **Preparation** (`brainstorm` → vision/context-map + the foundation
  pass), **Capturing** (`quick-capture` and `modeling` as two intake doors, `research`
  gated by the `research-reviewer`, `modeling` DISMISS), **Promote & Work** (`modeling`
  PROMOTE → `work`'s parallel TDD workers → the `verifier` gate → one task = one commit)
  — each a labelled section with honest, skill-accurate caption copy and the human-in-the-loop
  gates marked. As of **aw-060** each segment is carried by a **hand-authored flow diagram**
  above its captions: board-local HTML+CSS primitives (`WNode` skill/artifact boxes,
  `WCheckpoint` edge markers, `WArrow`/`WFanRow` CSS connectors — no inline SVG, no
  diagramming library, every fill/border a design-system token so light/dark tracks
  automatically) compose three **honest per-segment topologies** — Preparation fans out to
  the four foundation outputs, Capturing is a `backlog` **hub** with the refine/research/dismiss
  **loops**, Promote & Work is a **pipeline** with the `verifier` FAIL→×2→escalate retry loop.
  Gates render as **checkpoints on edges**, never as agent boxes. The `role="img"` frame
  carries a real-flow `aria-label`. It keeps the main-pane reader's centered reading measure
  (maxWidth 760, margin `0 auto` — aw-040) and stays static / read-only, styleguide consumed unforked.
- **Library / navigation** — the dashboard's discovery surface (agentic-workflow-008): makes the
  *non-task* knowledge base browsable — vision, context map, every BC README, **per-BC concept pages**,
  ADRs, research —
  drawn from the **artifact-location half** of the same tree projection the board uses (`tree.locations`
  + per-BC `readme` + per-BC `concepts`). Tasks are deliberately excluded (the board owns them), so each artifact has
  exactly one home. A pure, unit-tested transform (`dashboard/app/library-data.js` → `treeToLibrary`)
  pools the locations into fixed, legible groups — Product / Bounded contexts / **Concepts** / Research /
  Decisions (Concepts sits immediately after Bounded contexts, aw-075; the rail keeps its own
  Research-above-Decisions order from aw-056, which is **not** mirrored to search) —
  rendered through the approved styleguide `Collapsible`/`TreeItem` (the rail composes these two
  directly as of aw-n4h7q so the attention cue can be threaded; imported as-is, never forked —
  ADR-0003; the `concept` content type + glyph + `--ct-concept` tokens are the ds-021 registry entry).
  Concept rows are per-BC (`tree.contexts[].concepts`, paths-only) and titled by `baseName`, like
  ADRs/research. Selecting any row emits the open-intent shape `{ type, title, path }`, which the
  shell routes to the **main-pane reader** (aw-027 — non-task documents) rather than the
  slide-over. As of **aw-026** this tree is **always visible in the left rail** (it *is* the
  library — the separate board↔library toggle and the full-pane library surface are retired;
  the standalone `dashboard/app/library.js` view is removed in aw-027). The pure
  `treeToLibrary` transform is unchanged and now feeds the rail tree. See ADR-0011, ADR-0021,
  ADR-0009.
- **Task transition** — a lifecycle move of a task between folders (`backlog→todo` Promote,
  `todo→doing` Claim, `doing→done` Complete), never a raw file operation: it is a command on the
  **Task** aggregate, enforcing *status matches folder*. Owned by the skills (`modeling` / `work`),
  not the dashboard, which is read-only (ADR-0017).
- **`applyTaskMove`** — the canonical lifecycle-transition operation, owned by agentic-workflow and
  available to the skills; enforcer of *status matches folder* and the legal-move policy. Built in
  agentic-workflow-003 as `lib/task-lifecycle.mjs` (BC-owned domain logic, node stdlib only). The
  dashboard does **not** call it — the board is read-only (ADR-0017). Signature
  `applyTaskMove(rootDir, id, from, to, options)` — takes `rootDir` explicitly (no ambient cwd);
  `options.policy` is `'skill'` (the forward set: Promote, Claim, Complete) or `'ui'` (a retained
  restricted Promote-only set, no longer wired to a caller); `options.expectedMtimeMs` is the
  optimistic mtime precondition. Returns `{ ok: true, state }` or a structured rejection
  `{ ok: false, code, reason }` (`code` ∈ illegal-move | blocked-dependency |
  stale-precondition | not-found). It owns ONLY the move + status rewrite + precondition;
  INDEX/protocol side-effects stay with the skills/orchestrator (ADR-0007). It is addressed by
  the **bare id** but resolves the real on-disk file `<id>-<slug>.md` (anchored so `alpha-001`
  never collides with `alpha-0010`) and preserves that filename across the move — only the folder
  changes, the id is stable (ADR-0012). See ADR-0017, ADR-0007, ADR-0012.
- **`findDuplicateTaskIds`** — the duplicate-id guard (`lib/duplicate-id-check.mjs`, BC-owned
  domain logic, node stdlib only), the ADR-0028 **insurance** against the residual token-collision
  tail and the legacy-vs-token clash a bug could produce. A pure, side-effect-free, loss-tolerant
  whole-tree walk (`root` in → data out; one bad file never aborts the scan): it collects each task
  file's id (frontmatter `id:` first, filename stem fallback) across every BC's four lifecycle
  folders and returns every id claimed by more than one file, each with all colliding paths.
  **Shape-agnostic** — ids are compared as whole strings, so it is independent of the ADR-0028
  grammar and `deriveContext`'s dual-shape regex (no tail parsing). Exercised by `node --test`
  (the repo has no CI), whose suite also asserts the **live** `.agentheim/` tree has no duplicates;
  a future `release` preflight can call it unchanged. See ADR-0028, ADR-0022, ADR-0012.

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
  ubiquitous language is the single source of truth its tasks, code, and ADRs conform to.

## Key events

Past-tense, domain-language. Vision created · Bounded context identified · Idea captured ·
Task refined · Task promoted · Task claimed · Task completed · Task verified · Task bounced ·
Task dismissed · Decision recorded (ADR) · Research published · Research reviewed.

## Key commands

Intents entering the context. Brainstorm · Quick Capture · Refine · Promote · Dismiss · Work ·
Research · Dashboard.

**Dismiss** (the `modeling` skill's fourth action, agentic-workflow-046) hard-deletes a
`backlog/`/`todo/` task that will never be worked — a stray capture, a duplicate, an abandoned
idea — together with its **entire transitive dependent subtree** under one confirmation that
names every task in the set (ADR-0022's cascade). It **refuses** the whole operation if any task
in the set is in `doing/` or `done/` (you don't dismiss work in flight or shipped), and the
removal lives entirely in the skill — never a server write endpoint — so the dashboard stays
read-only (ADR-0017). Around the raw `.md` deletes the skill reconciles bookkeeping for the whole
set: INDEX line + count per dismissed id (across every BC the set spans — the one sanctioned
multi-BC-index exception), every dismissed id stripped from surviving tasks'
`depends_on`/`blocks`/`prior_art` and any ADR `related_tasks`, and one bare `Modeling / Dismissed`
protocol entry. Dismissed IDs are retired, never reused (consistent with never-renumber). The
dashboard's per-card trash-can (agentic-workflow-048) only *seeds and fires* the
`/agentheim:modeling dismiss <id>` command through the bridge. See ADR-0022, ADR-0017, ADR-0007.

**Dashboard** launches the local web UI over the project's `.agentheim/` folder — a flat Kanban
board of every BC's tasks, a task-only slide-over for board cards, and a main-pane reader for
non-task documents (BC READMEs, the vision, the context map, ADRs, research) rendered as
markdown (aw-027), live-updating as skills move files on disk. It is **read-only** (ADR-0017): no write-back — task lifecycle is owned by the skills, and
the board reflects their moves rather than making them. Invoked via the `/dashboard`
slash command (agentic-workflow-011 — the documented slash-command exception above), with three
verbs: bare `/dashboard` launches-or-reuses the detached server and **prints** the served URL
(`http://127.0.0.1:<port>/`) for the builder to open — it does not open a browser itself
(agentic-workflow-032 removed the auto-open: starting the server and opening a tab are separate
decisions); `/dashboard stop` terminates it and removes the runfile; `/dashboard status` reports
running/not-running + port from the runfile only (never launches or stops). The command is a thin
trigger over `dashboard/launch.mjs`.

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
</content>
