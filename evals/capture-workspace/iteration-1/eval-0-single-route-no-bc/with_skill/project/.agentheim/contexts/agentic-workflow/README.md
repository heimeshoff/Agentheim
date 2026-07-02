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
- **Orchestrator / Specialist** — the router and the focused agents it delegates to. The
  orchestrator never writes code or does deep modeling itself.
- **Adversarial gate** — a fresh-context skeptic with no exposure to the producer's
  reasoning, judging the producer's output. `verifier` audits a worker's diff before
  commit; `research-reviewer` re-verifies a report before it's citable. A deliberate,
  recurring motif.
- **ADR** — Architecture Decision Record, global or BC-scoped; flows through the backlog as
  `type: decision`.
- **Protocol** — the chronological project diary, newest on top; every action appends.
- **Index** — a flat catalog (`knowledge/index.md` + per-BC `INDEX.md`) that *points*,
  never duplicates. The memory layer for prior-art and dependency lookup.
- **Tree projection** — the single read model the dashboard's views (board, slide-over,
  navigation) and the SSE consumer all rebuild from. `GET /api/tree` (built in
  agentic-workflow-005 as `dashboard/tree.mjs`) walks the discovered `.agentheim/` and returns,
  per BC, its four lifecycle folders and each task's frontmatter projection
  (`id, title, status, type, context, path`) plus the *locations* of vision / context-map / BC
  READMEs+INDEXes+concepts / ADRs / research — pointers and metadata only, never document
  bodies. A task whose `status`/`context` frontmatter is missing falls back to its folder / BC
  name (disk is the source of truth), and malformed frontmatter degrades gracefully — the card
  is still listed, the walk never aborts. Document bodies are carried separately by
  `GET /api/doc?path=<in-root path>`, a validated raw-markdown carrier (rendering is
  client-side). Both endpoints are pure reads and reuse the root-resolution `startsWith(root)`
  guard; neither writes nor interprets a lifecycle move. See ADR-0002.
- **Dashboard frontend app** — the live dashboard UI, owned by this BC, living in
  `dashboard/app/` (entry `dashboard/app/app.js`). It *consumes* the design-system styleguide
  source across the BC boundary (imports `Column`/`TicketCard`/`ColumnHeader`/`EmptyColumn`/
  `html` as-is — never forks them), so the styleguide stays the single source of UI truth
  (ADR-0003). esbuild bundles this app (not the styleguide canvas) into the committed
  `dashboard/dist/` the static handler serves; the canvas remains the separate buildless
  review surface. The three view tasks — **board** (agentic-workflow-006), **slide-over** (aw-007),
  and **library/navigation** (aw-008) — all built, compose into this one app shell, with a
  board↔library toggle in the shell built from the styleguide `RailItem`. See ADR-0009.
- **Board view** — the dashboard's home view (agentic-workflow-006): a **flat** Kanban of the
  four lifecycle columns (`backlog`/`todo`/`doing`/`done`) with tasks from **all** bounded
  contexts pooled into those columns — no swimlanes; each card carries its BC via the styleguide
  `context` chip. Rendered over the live tree projection (`GET /api/tree`); a status-driven,
  loss-tolerant transform (`dashboard/app/board-data.js`) buckets each task by status (unknown
  status → backlog) and shapes it for the styleguide card. Read-only here — clicking a card emits
  an *open-this-task* intent the slide-over (aw-007) consumes. Dragging a card **`backlog→todo`**
  performs a **Promote** through the shared `applyTaskMove` write path (aw-009); every other
  column is a non-drop target. The board also stays **live** — it subscribes to the SSE stream and
  re-fetches `/api/tree` on any change (see *Live-update* and *Promote write path* below). See
  ADR-0009, ADR-0001.
- **Live-update (SSE consumer)** — the board keeps itself current (agentic-workflow-009) by
  subscribing to `GET /api/events` (the SSE transport, infrastructure-003 / ADR-0006) via the
  framework-free `dashboard/app/live-update.js` (`createLiveUpdate`). On every `tree-changed`
  frame — and on every (re)connect — it does **one** thing: re-fetch `/api/tree` and re-project
  the whole board. It **never** interprets the raw pointer as a transition (the watcher stays
  transport-only); re-fetching is idempotent, so a burst of changes, or the echo of the board's
  own Promote, collapses into re-fetches with no double-apply. EventSource auto-reconnects and the
  board re-syncs on reconnect — no missed-event bookkeeping. Disk is the source of truth; the board
  is a projection rebuilt from it. See ADR-0012, ADR-0006, ADR-0001.
- **Promote write path** — the dashboard's **only** write (agentic-workflow-009): `POST
  /api/task/move` (`dashboard/move-api.mjs`, wired in `dashboard/server.mjs`). It is
  **transport-only** — it parses `{ id, from, to, expectedMtimeMs? }`, delegates to `applyTaskMove`
  with `policy: 'ui'` (Promote-only), and translates the structured result to HTTP (200 success;
  409 stale-precondition / blocked-dependency; 404 not-found; 422 illegal-move; 400 bad body). It
  never moves a file itself. The frontend core (`dashboard/app/promote.js`) decides which drop is
  legal (`isLegalDrop` = `backlog→todo` only) and posts the optimistic precondition; a rejected
  move surfaces the domain `reason` and the board re-fetches. There is **no UI-only writer** of
  lifecycle state — `applyTaskMove` is the sole writer. See ADR-0001, ADR-0012.
- **Slide-over** — the dashboard's universal right-hand detail panel (agentic-workflow-007):
  one Notion-style drawer that opens for *any* artifact — a board task or a non-task artifact
  (BC README, vision, context-map, research, ADR). It consumes the board's *open-this-task*
  intent (and, later, aw-008 navigation's), fetches the body via `GET /api/doc?path=`, and
  renders the markdown **client-side** (no server-side rendering) through the approved
  styleguide `Drawer` + `Markdown` — imported as-is from the committed dist, never forked
  (ADR-0003). Tasks and non-task artifacts render through one identical path; the only
  difference is which `path` is fetched. The slide-over hands the `Drawer` a *doc-shaped* item
  (`{ type, meta: <real path>, body }`) so the real in-root path is shown and the fetched
  markdown rendered uniformly (ADR-0010). Lives in `dashboard/app/slide-over.js` over the pure,
  unit-tested `dashboard/app/slide-over-data.js`. Esc and scrim-click close it. See ADR-0010,
  ADR-0009.
- **Library / navigation** — the dashboard's discovery surface (agentic-workflow-008): makes the
  *non-task* knowledge base browsable — vision, context map, every BC README, ADRs, research —
  drawn from the **artifact-location half** of the same tree projection the board uses (`tree.locations`
  + per-BC `readme`). Tasks are deliberately excluded (the board owns them), so each artifact has
  exactly one home. A pure, unit-tested transform (`dashboard/app/library-data.js` → `treeToLibrary`)
  pools the locations into fixed, legible groups — Product / Bounded contexts / Decisions / Research —
  rendered through the approved styleguide `TreeGroup`/`TreeItem` (imported as-is, never forked —
  ADR-0003) in `dashboard/app/library.js`. Selecting any row emits the *same* open-intent shape the
  board emits (`{ type, title, path }`), routed into the one universal slide-over (aw-007). A
  board↔library toggle in the shell (built from the styleguide `RailItem`) switches surfaces. See
  ADR-0011, ADR-0009.
- **Card move** — a UI drag of a task card between lifecycle columns; semantically a Task
  transition command (v1: Promote / `backlog→todo` only), never a raw file operation. Every
  other transition is a non-drop target, rejected with a domain reason. See ADR-0001.
- **`applyTaskMove`** — the single lifecycle-transition operation shared by the skills and the
  dashboard write endpoint; the sole writer of task lifecycle state and sole enforcer of
  *status matches folder* and the legal-move policy. Built in agentic-workflow-003 as
  `lib/task-lifecycle.mjs` (BC-owned domain logic, node stdlib only; the dashboard runtime
  imports it). Signature `applyTaskMove(rootDir, id, from, to, options)` — takes `rootDir`
  explicitly (no ambient cwd) so a skill context and the dashboard call it identically;
  `options.policy` is `'ui'` (default — Promote `backlog→todo` only) or `'skill'` (the fuller
  forward set: Promote, Claim, Complete); `options.expectedMtimeMs` is the optimistic mtime
  precondition. Returns `{ ok: true, state }` or a structured rejection
  `{ ok: false, code, reason }` (`code` ∈ illegal-move | blocked-dependency |
  stale-precondition | not-found). It owns ONLY the move + status rewrite + precondition;
  INDEX/protocol side-effects stay with the skills/orchestrator (ADR-0007). It is addressed by
  the **bare id** but resolves the real on-disk file `<id>-<slug>.md` (anchored so `alpha-001`
  never collides with `alpha-0010`) and preserves that filename across the move — only the folder
  changes, the id is stable (ADR-0012). See ADR-0001, ADR-0007, ADR-0012.

## Aggregates

- **Task** — protects: status always matches its folder (`backlog/` → `todo/` → `doing/` →
  `done/`); one task = one commit; IDs (`<bc>-NNN`) are stable and never renumbered.
- **Vision** — protects: a single, two-minute-readable strategic root per project.
- **Knowledge base** (protocol + ADRs + research + indexes) — protects: every action is
  logged; indexes point rather than duplicate; ADR↔task backlinks stay bidirectional.
- **Bounded context (modeled)** — protects: a task belongs to exactly one BC; the BC's
  ubiquitous language is the single source of truth its tasks, code, and ADRs conform to.

## Key events

Past-tense, domain-language. Vision created · Bounded context identified · Idea captured ·
Task refined · Task promoted · Task claimed · Task completed · Task verified · Task bounced ·
Decision recorded (ADR) · Research published · Research reviewed.

## Key commands

Intents entering the context. Brainstorm · Capture · Refine · Promote · Work · Research ·
Dashboard.

**Dashboard** launches the local web UI over the project's `.agentheim/` folder — a flat Kanban
board of every BC's tasks, a universal slide-over that renders any artifact (tasks, BC READMEs,
the vision, the context map, ADRs, research) as markdown, live-updating as skills move files on
disk, with one write-back intent: drag `backlog→todo` to Promote. Invoked via the `/dashboard`
slash command (agentic-workflow-011 — the documented slash-command exception above), with three
verbs: bare `/dashboard` launches-or-reuses the detached server and **auto-opens** the default
browser at `http://127.0.0.1:<port>/`; `/dashboard stop` terminates it and removes the runfile;
`/dashboard status` reports running/not-running + port from the runfile only (never launches or
stops). The command is a thin trigger over `dashboard/launch.mjs`; auto-open is the one new
OS-divergent path (`cmd /c start` / `open` / `xdg-open`), confined to the launcher per ADR-0002.

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
