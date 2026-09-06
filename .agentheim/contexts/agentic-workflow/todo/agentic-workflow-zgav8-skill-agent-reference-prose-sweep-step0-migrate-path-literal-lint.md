---
id: agentic-workflow-zgav8
title: Prose sweep for the two-root layout — every skill, agent, and reference spells `board/` and `knowledge/contexts/`, the five entry skills run `migrate` as "Before acting" step 0, and a permanent live-tree lint fails on any reappearing legacy path literal
status: todo
type: refactor
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-e896r]
blocks: [agentic-workflow-tgr31]
tags: [layout, doctrine, skills, lint, upgrade]
related_adrs: [0078, 0059, 0068, 0069, 0074, 0075]
related_research: []
prior_art: [agentic-workflow-fn59c, agentic-workflow-r7dq3, agentic-workflow-ghcaj, agentic-workflow-cj54k, agentic-workflow-e896r, agentic-workflow-hxq1g]
---

## Why

cj54k, e896r, and hxq1g are shipped: code resolves both `.agentheim/` layouts and the
`migrate` verb exists, but nothing invokes it, and the prose still sends every agent to
`contexts/<bc>/todo/`. Measured on 2026-09-06 (regex over the legacy shapes below):
`skills/work` 22 lines, `skills/brainstorm` 16, `skills/modeling` 12, `skills/whats-next` 7,
`skills/quick-capture` 5, `skills/research` 2, `agents/worker` 4, `agents/verifier` 2,
`agents/tactical-modeler` 1, and one line each in `references/{worker-return-format,
concept-template,bc-readme-template}.md`; plus doc comments in five `lib/` modules and two
`dashboard/` files, and one *live-tree lint* (`findMalformedTaskIds`) that still walks
`.agentheim/contexts/` by hand and would pass vacuously after the tree moves. This child
moves the doctrine, wires the migration trigger (ADR-0078 §4) into the skills that touch a
project first, and ships the lint that keeps the old paths from creeping back — bounded by
an enumerated walk list with a closure rule, the shape that converged the ghcaj sweep on its
next iteration.

## What

### 0. Ground truth this task is written against (verified 2026-09-06 refinement)

- `migrate` (`lib/task-lifecycle-cli.mjs migrate`, opts-arity, no positional id) returns:
  `board` → `{ok:true, verb:'migrate', noop:true, changed:[]}` (zero writes, unlocked);
  `legacy` → `{ok:true, verb:'migrate', changed:['.agentheim'], moved:[{from,to}…],
  message:'chore(agentheim): migrate .agentheim/ to the two-root layout (ADR-0078)'}`;
  rejections `{ok:false, code:'mixed-layout'|'worktree-active'|'lock-timeout', reason}`.
  The commit is `runScopedCommit(repoRoot, ['.agentheim'], manifest.message)` — one
  directory pathspec (ADR-0078 §4; `isInvalidPath` passes a directory string).
- `references/index-template.md` holds TWO templates: the top-level `knowledge/index.md`
  template and the fenced "Per-BC (LEGACY combined shape)" block, which `captureTask`'s
  empty-BC backfill reads from disk at runtime under a `legacy` tree
  (`lib/task-lifecycle-capture-dismiss.mjs`, `extractFencedTemplateAfter`). The file stays
  until g5ez5's closure deletes legacy support — it is **not** shrunk here.
- `dashboard/app/{app,board,main-pane-reader,slide-over}.js` carry 20 literal
  `../../.agentheim/contexts/design-system/styleguide/...` ESM import specifiers. hxq1g
  left them textually unchanged on purpose: ten jsdom tests import those modules directly,
  so node's own resolution must spell the on-disk path. They cannot move until tgr31 moves
  this repo's tree.
- `rewriteReadmeContent` (migrate) rewrites only `.agentheim/contexts/<own-bc>/…`, root
  `vision.md` / `context-map.md`, and `knowledge/protocol.md` mentions in a BC README;
  forms like `contexts/<bc>/done-archive/` or `.agentheim/contexts/**` survive migration.
- `knowledge/index.md`'s bc-list lines end in `contexts/<bc>/INDEX.md` — a relative link
  that is *correct* under the board layout (it resolves into `knowledge/contexts/`). A bare
  `contexts/<bc>/INDEX.md` or `contexts/<bc>/README.md` token is therefore not a legacy
  literal; `knowledge/contexts/<bc>/INDEX.md` contains that substring too.
- There is no `skills/dashboard/SKILL.md`; the dashboard skill is `commands/dashboard.md`
  (zero legacy literals today).

### 1. Step 0 in the five writing skills — one recipe, five pointers (ADR-0068)

Add **§7 "`migrate` — step 0 of every writing skill"** to `references/lib-bootstrap.md`:
the usual homedir→cache→semver-max bootstrap targeting `lib/task-lifecycle-cli.mjs` with
verb `migrate` and no opts, then the four outcomes — `noop:true` → say nothing;
`ok:true` → `runScopedCommit(repoRoot, ['.agentheim'], manifest.message)` via
`lib/scoped-commit.mjs` and one line to the builder ("migrated `.agentheim/` to the
two-root layout — N entries moved", N = `moved.length`); `mixed-layout` /
`worktree-active` / `lock-timeout` → stop the skill and surface `reason` verbatim. Then
each of the five skills gains a two-line item **0** that names the verb, the four outcomes
by code, and points at §7 — never a second copy of the recipe:

| Skill | Where item 0 goes |
|---|---|
| `modeling` | first item of "## Before acting", ahead of the `vision.md` read |
| `quick-capture` | first item of "## Before acting", ahead of the README read |
| `work` | first paragraph of "## Phase 1: Recovery check", ahead of the `doing/` scan, the worktree list, and the churn reconciliation; reword Phase 1's own "Before anything else" so only one step claims to come first |
| `brainstorm` | first line of "## Before you start", ahead of the `vision.md` existence check |
| `research` | a new two-line "## Before acting" section above "## Scope" |

The two read-only skills get **no** step 0 (they never commit): `whats-next` step 1 and
`inquire`'s method gain one line — "if `.agentheim/contexts/` exists the tree has not been
migrated; run any writing skill first (ADR-0078 §4)" — the prose twin of the dashboard's
migration-pending notice.

### 2. Path sweep — the lint's walk list is the surface, the lint's pass is the closure

Rewrite every legacy shape in the files the lint walks (item 4) to its ADR-0078 path:

| Legacy shape | Becomes |
|---|---|
| `.agentheim/contexts/<bc>/{backlog,todo,doing,done,done-archive}/`, `contexts/*/<lifecycle>/`, `contexts/<bc>/<lifecycle>/` | `board/<bc>/<lifecycle>/` (`.agentheim/board/…` where the original was root-anchored) |
| `.agentheim/contexts/<bc>/INDEX.md` meaning the task half | `board/<bc>/INDEX.md`; meaning the ADR/research/concepts half → `knowledge/contexts/<bc>/INDEX.md` |
| `.agentheim/contexts/<bc>/README.md`, `.agentheim/contexts/*/README.md`, `contexts/<bc>/concepts/` | `knowledge/contexts/<bc>/README.md`, `knowledge/contexts/*/README.md`, `knowledge/contexts/<bc>/concepts/` |
| `.agentheim/vision.md`, `.agentheim/context-map.md` | `.agentheim/knowledge/vision.md`, `.agentheim/knowledge/context-map.md` |
| `.agentheim/knowledge/protocol.md`, `knowledge/protocol/YYYY-MM.md` | `.agentheim/board/protocol.md`, `board/protocol/YYYY-MM.md` |

`brainstorm`'s foundation step writes each new BC's `README.md` and knowledge-half INDEX
(`references/knowledge-index-template.md`) under `knowledge/contexts/<bc>/` and lets
`capture` create `board/<bc>/` plus the task-half INDEX (ADR-0078 §6). `work`'s
description line ("claim ready tasks from `contexts/*/todo/`") is part of the sweep.
Where a skill restates a path rule that also lives in `references/lib-bootstrap.md`,
replace the restatement with a pointer (ADR-0068). A line the lint allowlists (a quoted
historical example, a definition of the legacy shape) is left verbatim.

`references/index-template.md`: the top-level template's Pointers block names
`../board/protocol.md` / `../board/protocol/YYYY-MM.md` (exactly what
`rewriteTopIndexPointers` produces on a migrated `knowledge/index.md`); the bc-list line
stays `contexts/<bc-name>/INDEX.md` (relative, correct); the legacy fenced block stays
byte-verbatim and is allowlisted.

This repo's own BC READMEs (`.agentheim/contexts/agentic-workflow/README.md`, 8 lines;
`.agentheim/contexts/infrastructure/README.md`, 1 line) are swept through the worker's
`README_DELTA` report — the conductor materializes it on `main` (ADR-0074), the worker
never edits under `.agentheim/`. The one line that *defines* the legacy layout (the
"Layout (`legacy` / `board` / `mixed`)" ubiquitous-language entry) keeps its spelling and
gains the marker from item 4.

### 3. `lib/legacy-path-literal-lint.mjs` (+ `lib/test/legacy-path-literal-lint.test.mjs`)

Shape mirrors `lib/doctrine-line-pointer.mjs` (ADR-0069): stdlib-only, side-effect-free,
loss-tolerant, `findLegacyPathViolations(repoRoot) → [{file, line, match, text}]`, with
the test walking the real repo root (`path.resolve(here, '..', '..')`).

- **Walk roots (recursive):** `skills/`, `agents/`, `references/`, `commands/`, `lib/`,
  `dashboard/` (`.md`, `.mjs`, `.js`) plus every BC README resolved through
  `detectLayout(repoRoot)` + `listKnowledgeContexts` + `bcReadmePath` (so the walk finds
  READMEs under either layout). Never descends into `**/test/**`, `dashboard/dist/`,
  `node_modules/`, `.worktrees/`, `evals/`, `.agentheim/knowledge/decisions/`,
  `.agentheim/**/protocol*`, or task files (ADR-0039 verbatim-history discipline).
- **Forbidden shapes (each a named regex, one violation per matching line):**
  (a) `.agentheim/contexts/`; (b) `contexts/<segment>/(backlog|todo|doing|done|done-archive)/`
  — unconditionally, lifecycle folders never live under `knowledge/`; (c) `contexts/*/`;
  (d) `.agentheim/vision.md`; (e) `.agentheim/context-map.md`; (f) `knowledge/protocol`;
  (g) the two `path.join` segment shapes ported verbatim from cj54k's temporary lint —
  quoted `'contexts'` / `"contexts"` and the adjacent pair `'knowledge', 'protocol` — applied
  to `lib/` and `dashboard/` only. Bare `contexts/<bc>/INDEX.md` and
  `contexts/<bc>/README.md` are **allowed** (item 0).
- **Exemptions — an enumerated `ALLOWLIST` of `{file, match, rationale}` entries**, exactly
  `doctrine-line-pointer.mjs`'s mechanism, for every authoring-time-known line: the two
  layout modules (`lib/task-system-paths.mjs` legacy branches, `lib/layout-migration.mjs`),
  `references/index-template.md`'s legacy section, the transition paragraphs of
  `references/{task,knowledge}-index-template.md`, `dashboard/build.mjs`'s legacy-layout
  comments, `lib/id-grammar.mjs`'s `GRANDFATHERED_IDS` neighbourhood if any survives, and
  nothing else without a rationale.
- **One per-line marker, for the one dynamically discovered surface:** a BC README line
  containing `legacy-path-ok` inside an HTML comment (`<!-- legacy-path-ok -->`) is
  skipped. The marker is recognized **only** in BC README files — anywhere else it is
  ignored and the line is still a violation, so the allowlist stays the single record for
  doctrine.
- **Layout-gated tolerance for the 20 styleguide import specifiers:** a line in
  `dashboard/app/*.js` matching `^import .* from "\.\./\.\./\.agentheim/contexts/design-system/styleguide/`
  is tolerated while `detectLayout(repoRoot) === 'legacy'` and a violation once it is
  `'board'`. That makes tgr31's own "npm test green" criterion force the re-point + dist
  rebuild inside tgr31, instead of a permanent exemption nobody removes.
- **Deletes `lib/test/task-system-paths-literal-lint.test.mjs`** (cj54k's temporary form)
  in the same change, since its two regexes now live in shape (g) — the new lint alone
  would otherwise miss a regression of the old `path.join` bug. g5ez5's scaffolding list
  still names that file; the parent finds it already gone.

### 4. Re-point the fifth live-tree lint

`lib/id-grammar.mjs`'s `findMalformedTaskIds` (walked against the real repo by
`lib/test/id-grammar.test.mjs`) hardcodes `path.join(root, '.agentheim', 'contexts')`.
Resolve it through `listBoardContexts` + `taskFolderPath` with a single `detectLayout`
call threaded as `{layout}` (the cj54k discipline), keeping its loss-tolerant shape. Sweep
the remaining legacy doc comments in `lib/{protocol-rotation,index-rotation,atomic-write,
vacuum-guard}.mjs` and `dashboard/app/live-frame-router.js` (each becomes the board path,
or an allowlist entry with a rationale where the comment genuinely describes legacy).

**Out of scope:** editing the 20 `dashboard/app/*.js` import specifiers and rebuilding
`dist/` (tgr31, whose task file is amended in this refinement to carry exactly that);
running the migration on this repo (tgr31); flipping `legacy` to refused (g5ez5 closure);
any other dashboard source edit.

## Acceptance criteria

- [ ] `lib/test/legacy-path-literal-lint.test.mjs` builds a fixture tree containing each
      forbidden shape (a)–(g) once and asserts exactly one violation per shape with
      `file` + `line`; asserts an allowlisted line and a `legacy-path-ok` BC-README line
      produce none; asserts the marker outside a BC README still produces a violation.
- [ ] The same test asserts a `dashboard/app/board.js` fixture line carrying a styleguide
      import specifier is tolerated under a `legacy` fixture root and reported under a
      `board` fixture root (the tolerance is layout-gated, not permanent).
- [ ] `findLegacyPathViolations(<repo root>)` returns `[]` on the merged tree with this
      repo's `.agentheim/` still legacy — the sweep's closure rule; no separate hand count.
- [ ] `references/lib-bootstrap.md` carries §7 with the `migrate` bootstrap, the four
      outcomes by code, and the `runScopedCommit(repoRoot, ['.agentheim'], message)` line;
      a grep of the five entry skills shows item 0 as the first item of each section named
      in item 1's table (in `work`, ahead of the `doing/` scan), each naming the four
      outcome codes and pointing at §7 rather than restating it.
- [ ] `whats-next` and `inquire` each carry the one-line legacy-tree notice; neither
      invokes `migrate` or `scoped-commit`.
- [ ] `brainstorm`'s foundation walk-through names `knowledge/contexts/<bc>/README.md`, the
      knowledge-half INDEX beside it, and `board/<bc>/` created by `capture` — and no
      `contexts/<bc>/` lifecycle path.
- [ ] `references/index-template.md` still holds both fenced templates byte-verbatim apart
      from the top-level Pointers block naming `../board/protocol.md`; the existing
      `captureTask` empty-BC backfill test on a legacy fixture stays green.
- [ ] `lib/test/id-grammar.test.mjs` gains a `board`-layout fixture in which a malformed id
      placed under `board/<bc>/todo/` is found by `findMalformedTaskIds`, and the live-tree
      gate stays green.
- [ ] `lib/test/task-system-paths-literal-lint.test.mjs` no longer exists and the new
      lint's fixture covers both of its former shapes.
- [ ] The worker's `README_DELTA` report rewrites the 8 + 1 legacy-literal lines in the two
      BC READMEs (the "Layout" definition line kept, marked `legacy-path-ok`); after the
      conductor materializes it, the lint's README walk reports zero violations.
- [ ] `node --test "lib/test/**/*.test.mjs"` and `node --test "dashboard/test/**/*.test.mjs"`
      (run from `dashboard/`) are green on the merged tree with the repo still legacy.

## Notes

- **ADR-0059 disposition:** the path-literal convention is enforced by
  `legacy-path-literal-lint`; the `legacy-path-ok` marker convention is enforced by the
  same lint (only the exact token, only in BC READMEs). The step-0 *ordering* ("migrate
  before any other read") is **prose-only, unenforced** — the same limitation ADR-0074
  recorded for conductor sequencing; a skill's own step order cannot be linted.
- ADR-0068 (drift-twice): the migrate recipe lives once in `references/lib-bootstrap.md`
  §7; the five skills point at it. Where a skill restates a path rule that also lives in
  `lib-bootstrap.md`, replace the restatement with a pointer rather than synchronizing a
  second copy.
- Hand the worker the walk list and the rewrite table up front (conductor gotcha from the
  ghcaj sweep); the verifier judges against `findLegacyPathViolations(repoRoot) === []`
  plus the enumerated criteria, never a widening "every surface agrees" bar.
- Self-hosting note: the repo-root-first bootstrap resolves this repo's `lib/`, so step 0
  in the repo's own skills would migrate this repo the first time a skill runs after this
  task ships — but the installed plugin cache (0.9.3) carries none of it. tgr31 is the
  deliberate, conductor-owned first run; until then conduct from the repo's `skills/` and
  do not run step 0 by hand on this repo.
- Sibling amendment made in this refinement: tgr31's "no code change" note now carries
  the one exception — re-pointing the 20 styleguide import specifiers and rebuilding
  `dashboard/dist/` — which the layout-gated lint tolerance forces there.
- Parent: agentic-workflow-g5ez5; decision record: ADR-0078.
