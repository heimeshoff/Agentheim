---
id: agentic-workflow-g5ez5
title: Close the two-root layout (ADR-0078) — every consumer except `migrate` refuses a legacy tree with `legacy-layout`, `detectLayout`'s neither-root default flips to `board`, the legacy combined INDEX template and every transitional dual-layout branch are deleted, and a fresh-project walk-through plus the tree-wide lint prove `.agentheim/` holds exactly `knowledge/` and `board/`
status: backlog
type: refactor
context: agentic-workflow
created: 2026-09-06
completed:
depends_on: [agentic-workflow-tgr31, agentic-workflow-q8f3n]
blocks: []
tags: [layout, migration, lifecycle, protocol, index, dashboard, upgrade]
related_adrs: [0078, 0038, 0039, 0047, 0017, 0059, 0073, 0075, 0076]
related_research: []
prior_art: [agentic-workflow-bmn29, agentic-workflow-pt0gy]
---

## Why

`.agentheim/contexts/<bc>/` used to mix the BC's **description** (`README.md`) with the
**operational churn** of working the system (lifecycle folders, the count-coupled
`INDEX.md`), and `knowledge/` mixed durable knowledge with the protocol diary. The
builder's intent: **every file under `.agentheim/` is either knowledge or task-system
noise — two roots, nothing else.** ADR-0078 records the decision: `knowledge/` (vision,
context map, ADRs, research, `contexts/<bc>/README.md` + the knowledge-half INDEX +
concepts + the styleguide source) and `board/` (per-BC lifecycle folders, the task-half
INDEX, the protocol log), with a `migrate` verb every skill runs before its own reads.

This task was captured as the umbrella and split on 2026-09-06 (third refinement) into
five children plus this closure. **All five children have shipped** (cj54k, e896r, zgav8,
hxq1g on 2026-09-08–10; tgr31 on 2026-09-11 after commit `6fbaad2` moved this repo's own
tree). This repo's `.agentheim/` now detects `board`; the dashboard reports
`migrationPending: false`; `findLegacyPathViolations(root)` is `[]`.

What remains is the step that is only safe *after* the repo is board-shaped: turning
"resolve either layout" into "refuse legacy", deleting the transitional scaffolding the
children left behind on purpose, and proving the end state end to end. The fourth
refinement (2026-09-12) reconciled this task against the shipped tree — several of its
earlier assumptions were wrong and are corrected below (see Notes, "Corrections").

## What

Children (all `done/`; each carried its own What and criteria):

| Child | Delivered |
|---|---|
| agentic-workflow-cj54k | `lib/task-system-paths.mjs` (`detectLayout`, 14 getters, 2 enumerators, `opts.layout` override), nine `lib/` modules re-pointed, `references/index-template.md` split into `task-index-template.md` + `knowledge-index-template.md` (legacy combined section kept verbatim for the backfill), ADR-0078 accepted |
| agentic-workflow-e896r | `migrate` verb + `lib/layout-migration.mjs`; passes explicit `{layout:'legacy'}` / `{layout:'board'}` to every getter it calls |
| agentic-workflow-zgav8 | Prose sweep, step-0 `migrate` in the five writing skills, one-line legacy notice in `whats-next`/`inquire`, permanent `lib/legacy-path-literal-lint.mjs` (13-entry ALLOWLIST, `<!-- legacy-path-ok -->` README marker, layout-gated dashboard-specifier tolerance); **cj54k's temporary nine-file grep lint already deleted here** |
| agentic-workflow-hxq1g | Dashboard: `tree.mjs` through the path module, `mixed` short-circuit before any getter, `migrationPending`, orphan warnings, build-time styleguide redirect |
| agentic-workflow-tgr31 | Dogfood: 20 app specifiers + 6 test reads re-pointed, live-tree tests flipped to `board`, dist rebuilt |
| agentic-workflow-q8f3n | `vacuum-guard.mjs` `BOOKKEEPING_SEGMENT_RE` widened to both layouts — legacy alternatives explicitly left "for g5ez5 to retire" |

This closure task, in order:

1. **Refuse detected legacy at the one chokepoint** (ADR-0078 §5 second phase; architect
   round 2). In `lib/task-system-paths.mjs`'s `resolveLayout`, when the *detected* layout is
   `'legacy'` and the caller passed no `opts.layout` override, throw a structured `Error`
   with `.code === 'legacy-layout'` (plus `.layout` and the function name), exactly
   mirroring `mixedLayoutError`. An explicit `opts.layout === 'legacy'` override **still
   resolves** — that is how `lib/layout-migration.mjs` keeps reading source paths with zero
   code change. **The getters' legacy branches therefore stay** (they are `migrate`'s
   permanent legacy-reading path); only `detectLayout`'s *default* behaviour changes
   (item 2) and only *consumer-side* legacy branches are deleted (item 3).
   - Every CLI verb surfaces it as `{ok:false, code:'legacy-layout', reason}` the same way
     it surfaces `mixed-layout` today (`capture`/`dismiss`/`reroute` already `reject(...)`
     on mixed; the mover verbs, `log`, `index-add`, and both rotations surface the throw
     through whichever path surfaces `mixed-layout` for them now). `migrate` is the only verb
     that still proceeds on `legacy`.
   - `dashboard/tree.mjs`'s `buildTree` short-circuits `'legacy'` exactly as it short-circuits
     `'mixed'` today — before any getter call — returning `{layout:'legacy',
     migrationPending:true, contexts:[], locations:{}, warnings:[]}`. `board.js`'s
     migration-pending notice is unchanged. `project-name.mjs`'s `visionPath` throw already
     degrades to the folder-basename fallback; keep that.
   - `legacy-path-literal-lint`, `id-grammar`'s `findMalformedTaskIds`, `human-eye-criteria`,
     `spike-stop-loss`, `duplicate-id-check`, `index-entry-length`: each surfaces the throw
     (a legacy consumer tree is a lint failure that names `legacy-layout`, not a silent `[]`).

2. **Flip `detectLayout`'s neither-root branch to `'board'`** (architect round 2). cj54k made
   an existing `.agentheim/` with neither `contexts/` nor `board/` resolve `'legacy'` as a
   transition-window crutch for ~20 `lib/test` fixtures that create only `.agentheim/knowledge/`.
   Once legacy is refused that convention is a trap: those fixtures, and a fresh consumer
   project right after `brainstorm` writes `knowledge/vision.md`, would all fail
   `legacy-layout`. ADR-0078 §5 defines legacy as "`contexts/` exists, `board/` does not" —
   a neither-root tree is `board` by the ADR's own definition. Consequences to carry:
   - `migrate` on a neither-root tree now detects `board` and returns its idempotent
     `{ok:true, noop:true}`; the unconditional `board/` mkdir moves *inside* the legacy
     migration path (still needed for a `contexts/`-present-but-empty tree).
   - Audit every **writer** for a `board`-detected tree whose `board/` directory does not
     exist yet: `capture`'s empty-BC backfill, `writeFileAtomic` into `board/<bc>/INDEX.md`
     and `board/protocol.md`, `protocol-rotation`/`index-rotation`, `log`, `index-add`. Any
     of them that would ENOENT gets a `mkdirSync(dirname, {recursive:true})` before the
     write. The enumerators are already safe (`readSubdirNames` guards `existsSync`).
   - `lib/test/task-system-paths.test.mjs`: the "existing-but-otherwise-empty `.agentheim/`
     resolves legacy" case flips to `'board'`; the "completely absent" case is unchanged; add
     "`contexts/` present, `board/` absent → `'legacy'`" if not already covered.

3. **Delete the transitional scaffolding** (consumer side only — never `detectLayout`'s legacy
   value, the getters' legacy branches, or anything in `lib/layout-migration.mjs`):
   - **Legacy combined INDEX template.** `references/index-template.md` is a 155-line file
     holding TWO things: the top-level `knowledge/index.md` template (its only copy anywhere)
     and the "Per-BC (LEGACY combined shape)" section `captureTask`'s legacy backfill reads.
     `git mv` it to `references/top-index-template.md`, cut the legacy Per-BC section and the
     "When the index file doesn't exist yet" legacy prose, keep the top-level section
     byte-verbatim. Re-point every `references/index-template.md` mention: `skills/{brainstorm,
     modeling,quick-capture,research,work}/SKILL.md` (the `index-missing` "build it from the
     template" lines point at `top-index-template.md` for `knowledge/index.md` and at
     `task-index-template.md` / `knowledge-index-template.md` for a per-BC file), the doc
     comments in `lib/index-rotation.mjs`, `lib/layout-migration.mjs`, `lib/task-lifecycle-cli.mjs`,
     and the two lint ALLOWLIST entries for it.
   - **`lib/task-lifecycle-capture-dismiss.mjs`:** delete `loadIndexTemplateRaw`,
     `extractPerBcTemplate`, `renderCombinedLegacyIndexTemplate`; `renderIndexTemplate(context)`
     loses its `layout` argument and always renders the task half. `lib/test/task-index-template-
     split.test.mjs` is reshaped: the marker-union assertion diffs against a literal 8-marker
     set (not the deleted legacy section); the legacy-fixture backfill case is dropped.
   - **`lib/index-entry-length.mjs`** `findOverLengthIndexEntries`: drop the `'legacy'`
     branch (one combined INDEX) — only the task-half + knowledge-half walk remains.
   - **`lib/vacuum-guard.mjs`** `BOOKKEEPING_SEGMENT_RE`: retire the two legacy alternatives
     (`knowledge/protocol.md`, `contexts/<bc>/INDEX.md`) and the comment at its head that
     defers to this task; q8f3n's legacy-path fixtures flip to assert *not* bookkeeping (or
     are removed if that leaves a duplicate case).
   - **`lib/legacy-path-literal-lint.mjs`:** delete the layout-gated tolerance for the
     `dashboard/app/*.js` styleguide specifiers (dead since tgr31 — on a `board` tree it is
     never taken; the `detectLayout(repoRoot)` call it needed goes with it) and its header
     paragraph. Reduce the `ALLOWLIST` to entries whose file still carries a *permanent*
     legacy literal: `lib/task-system-paths.mjs` (getter legacy branches + `detectLayout`),
     `lib/layout-migration.mjs`, this lint's own header quotes, the one-line legacy notices in
     `skills/whats-next/SKILL.md` and `skills/inquire/SKILL.md`, and `dashboard/project-name.mjs`
     / `dashboard/build.mjs` only if the quoted line survives. Every `references/*index-template.md`
     entry goes (the two surviving templates lose their "transitional `'legacy'`-layout" preamble
     paragraphs, so they no longer quote the legacy path). Add a test asserting **every ALLOWLIST
     entry still matches at least one line in its file** — a dead exemption is a lint failure, so
     the list can never silently go stale again.
   - **Transition-window prose in code comments:** `lib/task-system-paths.mjs`'s "TRANSITION
     WINDOW" header paragraph, `dashboard/tree.mjs`'s "under `'legacy'` every getter resolves
     into the same `contexts/<bc>/`" comment on `projectContext`, `lib/duplicate-id-check.mjs:92`,
     `lib/index-entry-length.mjs` doc comments — rewrite to describe the refusal, not the window.
   - **Test fixtures.** Every test whose fixture builds `.agentheim/contexts/` to exercise a
     *consumer* is rewritten to the board shape, or — where it asserts dual-layout equivalence
     (`dashboard/test/tree-layout.test.mjs`'s legacy/board diff, `build-layout.test.mjs`'s
     dual-layout ternary, `project-name.test.mjs`'s legacy cases, `id-grammar.test.mjs`'s legacy
     fixture) — reduced to the board case **plus one legacy-refusal case**. Exempt: `lib/test/
     layout-migration.test.mjs` (unmodified, by criterion), `task-system-paths.test.mjs`'s
     detection cases, and `legacy-path-literal-lint.test.mjs`'s own violation fixtures. At work
     start, enumerate with the grep in Notes (roughly 22 `lib/test` + 22 `dashboard/test` files
     mention `legacy`/`contexts` today; many are comments only).

4. **End-state proof:** a fresh-project fixture driven the way `brainstorm` + `capture` create
   a project lands `vision.md`, `context-map.md`, `index.md`, `contexts/<bc>/README.md`, and the
   knowledge-half INDEX under `knowledge/`, and lifecycle folders, the task-half INDEX, and
   `protocol.md` only under `board/` — with `detectLayout` reporting `board` at every step
   (including the moment only `knowledge/vision.md` exists, per item 2).

5. **Sole path-constructor test**, sharpened (the earlier "exactly one module" wording was
   already false: `lifecycle-lock.mjs`, `hook-agent-signal.mjs`, `derived-artifact-guard.mjs`,
   `discovery.mjs` legitimately construct `.agentheim/` paths that are not layout-bearing). A
   `node --test` greps `lib/*.mjs`, `dashboard/*.mjs`, `dashboard/app/**/*.js` for the string
   literal `.agentheim` **inside quotes or a template literal** (doc-comment mentions do not
   count) and asserts every hit is in an enumerated allowlist: `lib/task-system-paths.mjs`,
   `lib/layout-migration.mjs`, `lib/lifecycle-lock.mjs` (the lock), `lib/hook-agent-signal.mjs`
   (`state/in-flight.json`), `lib/derived-artifact-guard.mjs` (`BOOKKEEPING_PATH_PREFIXES`),
   `lib/vacuum-guard.mjs` (segment regexes), `dashboard/discovery.mjs` (`discoverRoot`), and the
   `.agentheim/state/` / `.agentheim/.dashboard/` joins in `dashboard/` (ADR-0078 §7 stays-put
   surfaces). Same test, second scan: a `layout:` opt literal (`layout: 'legacy'` or the
   `LEGACY`/`BOARD` const form) appears only in `lib/layout-migration.mjs` and its test — the
   static proof that `migrate` is the sole override caller (architect round 2).

6. **Prose + ADR.** README delta for the agentic-workflow BC: the "Layout (`legacy` / `board` /
   `mixed`)" ubiquitous-language entry (README ~line 1251) drops "today's shape, this repo's
   own tree included" and states the refusal; INDEX / Protocol / lifecycle-folder entries name
   only `board/` and `knowledge/contexts/` paths; anything restating `lib-bootstrap` §7 becomes
   a pointer (ADR-0068). ADR-0078 gains a Consequences addendum (in place — no second ADR)
   naming the date the legacy refusal shipped, the neither-root default flip and why (§5's own
   definition of legacy), and this task id.

7. **`dashboard/dist/`** rebuilt and staged by the conductor at integration (ADR-0057) if
   `tree.mjs` or any `dashboard/app/` file changed.

## Acceptance criteria

- [ ] A parametrized `node --test` over every `task-system-paths` consumer — the twelve `lib/`
      importers plus `dashboard/tree.mjs`, `project-name.mjs`, `build.mjs`, `build-stamp.mjs` —
      asserts on a legacy fixture: every CLI verb except `migrate` returns
      `{ok:false, code:'legacy-layout'}`; every live-tree lint throws an error with
      `.code === 'legacy-layout'`; `buildTree` returns `migrationPending:true` with empty
      `contexts` and never calls a getter. On a mixed fixture the same set yields `mixed-layout`.
      On a board fixture every one operates normally.
- [ ] `migrateLayout` still migrates the same legacy fixture with no code change to
      `lib/layout-migration.mjs`; `lib/test/layout-migration.test.mjs` passes unmodified.
- [ ] `detectLayout` returns `'board'` for an absent `.agentheim/` AND for an existing
      `.agentheim/` holding neither `contexts/` nor `board/`; `'legacy'` only when `contexts/`
      exists without `board/`; `'mixed'` unchanged. The neither-root case is a named test.
- [ ] A fresh-project fixture (empty `.agentheim/`, then the brainstorm-shaped writes and one
      `capture`) contains no top-level `contexts/`, `vision.md`, or `context-map.md`;
      `vision.md`, `context-map.md`, `index.md`, `contexts/<bc>/README.md`, and
      `contexts/<bc>/INDEX.md` exist under `knowledge/`; `board/<bc>/{backlog,todo,doing,done}/`,
      `board/<bc>/INDEX.md`, and `board/protocol.md` exist and nothing else under `board/`;
      `detectLayout` is `'board'` before and after every write; no write ENOENTs on the
      not-yet-existing `board/`.
- [ ] `references/index-template.md` no longer exists; `references/top-index-template.md`
      holds the top-level `knowledge/index.md` template byte-identical to the old file's
      "Top-level" section; `task-index-template.md` and `knowledge-index-template.md` are the
      only per-BC templates; `renderIndexTemplate(context)` takes no layout argument and
      `capture`'s backfill renders the task half; `grep -rn "index-template.md" skills agents
      references lib dashboard` matches only the three surviving template names.
- [ ] `legacy-path-literal-lint` passes on the merged tree; its `ALLOWLIST` contains no
      `references/*index-template.md` entry and no layout-gated tolerance; a new test fails if
      any `ALLOWLIST` entry matches zero lines in its file.
- [ ] `BOOKKEEPING_SEGMENT_RE` no longer matches `.agentheim/knowledge/protocol.md` or
      `.agentheim/contexts/<bc>/INDEX.md`; q8f3n's board-shape fixtures (incl. the Windows
      path) still match.
- [ ] The sole-path-constructor test (What item 5) passes with exactly the enumerated
      allowlist; the `layout:` override scan finds `lib/layout-migration.mjs` and its test only.
- [ ] `node --test lib/test/*.test.mjs` and `cd dashboard && npm test` are green on the
      merged tree (the two fixed-port bridge tests and `dist-staleness` on the branch are the
      known pre-existing exceptions); `dashboard/dist/` rebuilt and staged (ADR-0057) if
      `tree.mjs` or app files changed.
- [ ] ADR-0078 carries a dated Consequences addendum naming the legacy refusal, the neither-root
      default flip, and this task id; the agentic-workflow README's Layout entry describes the
      refusal and names no legacy path as current.

## Notes

**Corrections made at refinement 4 (2026-09-12) against the shipped tree** — the worker should
trust these over any older prose elsewhere:
- cj54k's "temporary enumerated grep lint" was **already deleted by zgav8** (ADR-0078
  Enforcement addendum); there is nothing to remove.
- The earlier text said to delete "the legacy branch of every getter except `detectLayout`"
  and that `taskIndexPath`/`knowledgeIndexPath` "no longer alias under legacy". Both are
  **wrong**: `lib/layout-migration.mjs` line ~296 calls `taskIndexPath(rootDir, bc, LEGACY)`
  to find the combined INDEX it splits, and every other rename uses a getter with the
  `LEGACY` override. The getters' legacy branches are `migrate`'s permanent read path (ADR-0078
  §5). Refusal lives in `resolveLayout` and keys on *detected* legacy without an override.
- `references/index-template.md` is not "the pointer zgav8 left" — it is the only copy of the
  top-level `knowledge/index.md` template, plus the legacy per-BC section. Hence the
  `git mv` to `top-index-template.md`, not a delete.
- The earlier lint-exemption criterion named `knowledge/decisions/` and `board/protocol*` as
  exemptions; the lint never walks those directories (WALK_DIRS is `skills agents references
  commands lib dashboard` + BC READMEs). Replaced by the "no dead ALLOWLIST entry" test.
- "Exactly one `lib/` module constructs `.agentheim/` paths" was never true (lock, in-flight
  signal, derived-artifact prefix, discoverRoot). Replaced by the enumerated-allowlist test.

**Design settled with the architect (round 2, 2026-09-12):**
- Refusal mechanism: throw-on-detected-legacy in `resolveLayout`, override intact. A parallel
  `resolveLegacy*` API was rejected — it duplicates 14 getters and forces a `migrate` rewrite
  while its suite must pass unmodified.
- Neither-root default flips to `board`. Rewriting ~20 fixtures to `mkdir board/` would hide
  a real first-run bug for consumers (post-`brainstorm`, only `knowledge/vision.md` exists).
  Writers must tolerate a missing `board/` dir (`mkdirSync recursive`), which is also what
  makes the fresh-project criterion above pass.

**Settled at refinement 3 (2026-09-06, builder):** folder name `board/`; knowledge-half INDEX
keeps the name `INDEX.md`; migration trigger is the `migrate` verb run from each skill's
"Before acting" step 0; `knowledge/contexts/` is the authoritative BC list; `state/`,
`salvage/`, `.dashboard/`, `.worktrees/` stay put. All recorded in ADR-0078.

**Resulting tree** (ADR-0078 §1):

```
.agentheim/
  knowledge/
    vision.md
    context-map.md
    index.md                     (bc-list → contexts/<bc>/README.md)
    decisions/
    research/
    contexts/<bc>/README.md
    contexts/<bc>/INDEX.md       (knowledge half: adr-local / research-local / concepts)
    contexts/<bc>/concepts/
    contexts/design-system/styleguide/   (app source; dashboard build reads it here)
  board/
    protocol.md
    protocol/YYYY-MM.md
    <bc>/{backlog,todo,doing,done,done-archive}/
    <bc>/INDEX.md                (task half: task-counts + four status lists)
  state/  salvage/  .dashboard/  .worktrees/  (gitignored runtime, unchanged)
```

**Fixture enumeration at work start** (run before touching tests; treat comment-only hits as
no-ops):

```
grep -lE "'legacy'|contexts/alpha|'contexts'|agentheim/contexts" lib/test/*.test.mjs dashboard/test/*.test.mjs
```

**Findings from the architect round 1 that still hold:** `lib/scoped-commit.mjs` accepts a
plain directory pathspec (migrate's commit is `runScopedCommit(root, ['.agentheim'], msg)`);
`lib/vision-conformance.mjs` and `lib/session-start-churn.mjs` carry no path literals;
`dashboard/app/live-frame-router.js` needs no change.

**Risks:** a consumer install on a stale plugin cache (pre-this-task `lib/`) keeps resolving
legacy until a release refreshes it — acceptable, it never re-creates `contexts/`. A consumer
whose tree is still legacy after this ships sees `legacy-layout` from every verb and the
dashboard's migration-pending notice until any writing skill's step-0 `migrate` runs — the
intended behaviour, documented by `whats-next`/`inquire`'s one-line notice. Historical protocol
entries and ADR bodies keep old paths verbatim (ADR-0039); the lint does not walk them.

**Out of scope, noted for the builder:** `state/whats-next.md` (2026-09-11) suggests adding the
modeling step-0 `chore(agentheim): migrate .agentheim/ …` commit subject to
`recognizeMachineShape`'s set so it stops reading as human churn — a separate
`lib/session-start-churn.mjs` capture, not this task.

**Convention check (ADR-0059):** enforced — the tree-wide `legacy-path-literal-lint` (plus its
new no-dead-entry test), the parametrized refusal test, and the sole-path-constructor /
override-scan test. No `[human-eye]` criteria.
