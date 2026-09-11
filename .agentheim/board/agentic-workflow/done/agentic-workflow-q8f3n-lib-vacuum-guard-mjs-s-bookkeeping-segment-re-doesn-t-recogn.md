---
id: agentic-workflow-q8f3n
title: `lib/vacuum-guard.mjs`'s `BOOKKEEPING_SEGMENT_RE` doesn't recognize `board/`/`knowledge/contexts/` INDEX paths
status: done
type: bug
context: agentic-workflow
created: 2026-09-11
completed:
depends_on: []
blocks: [agentic-workflow-g5ez5]
tags: [layout, vacuum-guard, batch-mix]
related_adrs: [0078, 0064]
related_research: []
prior_art: [agentic-workflow-zgav8, agentic-workflow-qz1h7, agentic-workflow-r4gcz, agentic-workflow-cj54k]
---

## Why

`lib/vacuum-guard.mjs`'s "Batch-mix classification" section carries this regex:

```js
const BOOKKEEPING_SEGMENT_RE =
  /[\\/]\.agentheim[\\/](knowledge[\\/]protocol\.md$|contexts[\\/][^\\/]+[\\/]INDEX\.md$|state[\\/])/;
```

`classifyTask` (ADR-0064 bucket 1) uses it to decide whether a `type: chore` task's
`FILE_LIST` is *entirely* bookkeeping surfaces. It only knows the pre-ADR-0078 shapes:
`.agentheim/knowledge/protocol.md` and `.agentheim/contexts/<bc>/INDEX.md`. It has never
been taught the two-root layout's `.agentheim/board/<bc>/INDEX.md` (task-half INDEX),
`.agentheim/knowledge/contexts/<bc>/INDEX.md` (knowledge-half INDEX), or
`.agentheim/board/protocol.md`.

**This is live, not prospective, as of 2026-09-11** — this repo's own tree was migrated to
the board layout (commit `6fbaad2`, agentic-workflow-tgr31's dogfood run; `detectLayout`
now returns `board`). From this session on, a `chore` whose `FILE_LIST` touches only a BC
INDEX or the protocol fails bucket 1's "entirely bookkeeping" test and falls to
**harness** — a quiet drift in `work`'s session-end `**Batch mix:**` line (ADR-0064,
descriptive only, never a gate), not a crash. The same drift reaches every consumer project
the moment its own step-0 `migrate` runs.

Found during agentic-workflow-zgav8's prose/doc-comment sweep and deliberately left out of
it: zgav8's mandate over this file was prose only, and this is a functional-behavior change
that needs its own fixtures. ADR-0078's *Neutral* consequences sentence ("`lib/vacuum-guard.mjs`
… carry no path literals — their callers pass paths") is true of the `extractOpenQuestions`
half and false of this regex; that sentence is amended by this task (below).

## What

Widen `BOOKKEEPING_SEGMENT_RE` so it matches **every** bookkeeping shape of **both** layouts
at once, layout-agnostically:

| Surface | legacy (kept through the transition window) | board (new) |
|---|---|---|
| live protocol | `.agentheim/knowledge/protocol.md` | `.agentheim/board/protocol.md` |
| per-BC INDEX | `.agentheim/contexts/<bc>/INDEX.md` | `.agentheim/board/<bc>/INDEX.md` **and** `.agentheim/knowledge/contexts/<bc>/INDEX.md` |
| advisory state | `.agentheim/state/…` | `.agentheim/state/…` (unchanged) |

**Design decision (settled at refinement, 2026-09-11) — a regex, not the path getters.**
The task's original either/or ("widen the regex, or call `lib/task-system-paths.mjs`'s
getters under whichever layout `detectLayout` resolves") resolves to the regex:

- `classifyTask` is pure by contract — the module header says it is stdlib-only, git-free,
  and "callers hand in already-known task metadata (`type`, `files`) rather than this module
  shelling out". `work` invokes it through the `references/lib-bootstrap.md` §3 one-liner
  with nothing but `[{type, files}]` — there is **no `rootDir` at the call site** to run
  `detectLayout` against, and inventing one would add an fs dependency to a text-shaping
  helper for no gain.
- Layout detection buys nothing here: a `FILE_LIST` path either has a bookkeeping shape or
  it doesn't. Under a board tree no `.agentheim/contexts/…` path can appear in a
  `FILE_LIST`, and under a legacy tree no `.agentheim/board/…` path can — accepting both
  unconditionally is exactly as precise as gating on layout, with zero I/O.
- The legacy alternatives **stay** for now (a consumer install is legacy until its own
  step-0 `migrate` runs). Dropping them is agentic-workflow-g5ez5's business when it hardens
  every consumer to refuse `legacy` — hence `blocks: [g5ez5]`.

Keep the segment-match shape (leading separator, either slash style, matched anywhere in an
absolute path — agentic-workflow-v4gmt's caveat, and the reason the caller must pass
absolute paths). Refresh the regex's doc comment to name both layouts and the transition
window. No change to `HARNESS_SEGMENT_RE` / `ADR_SEGMENT_RE` (`.agentheim/knowledge/
decisions/` is the same path under both layouts).

Also amend ADR-0078's *Neutral* consequences sentence with one clause: `lib/vacuum-guard.mjs`
carries one path-shaped regex (`BOOKKEEPING_SEGMENT_RE`, fixed under agentic-workflow-q8f3n);
the no-literals claim holds for the other two modules. Reported through the worker's `ADRS`
block as an amendment of the existing ADR (conductor materializes it on `main`; it is never a
new number and never goes through `finalizeAdrNumbering`).

## Acceptance criteria

- [ ] `classifyTask({type:'chore', files})` returns `bookkeeping` when every path in `files`
      is one of the board-layout bookkeeping shapes — `.agentheim/board/<bc>/INDEX.md`,
      `.agentheim/knowledge/contexts/<bc>/INDEX.md`, `.agentheim/board/protocol.md` — in
      either slash style (at least one fixture uses a `C:\…` Windows path for a
      `board\<bc>\INDEX.md`).
- [ ] The legacy shapes keep classifying `bookkeeping`: every existing `classifyTask` test in
      `lib/test/vacuum-guard.test.mjs` passes **unmodified** (no fixture edited or removed).
- [ ] A mixed legacy+board `FILE_LIST` (e.g. `.agentheim/board/protocol.md` plus
      `.agentheim/contexts/<bc>/INDEX.md`) still classifies `bookkeeping` — the regex is
      layout-agnostic, not layout-gated.
- [ ] Negative fixtures pin the boundary at INDEX/protocol/state exactly as before: a `chore`
      touching `.agentheim/knowledge/contexts/<bc>/README.md`, or
      `.agentheim/board/<bc>/backlog/<id>.md`, or `.agentheim/board/<bc>/done-archive/2026-07.md`
      classifies `harness`, matching today's legacy-shape behaviour for the same surfaces.
- [ ] `lib/vacuum-guard.mjs` stays pure: it imports nothing from `node:fs` or
      `lib/task-system-paths.mjs`, and `classifyTask`'s signature is unchanged (`{type, files}`
      only — no `rootDir` / `layout` parameter). Searching `lib/vacuum-guard.mjs` for
      `node:fs` or `task-system-paths` finds nothing.
- [ ] `node --test lib/test/legacy-path-literal-lint.test.mjs` reports **no** violation in
      `lib/vacuum-guard.mjs` — either the rewritten regex source still evades the lint's
      literal patterns (as today's does) or, if the chosen spelling trips it, an allowlist
      entry for `lib/vacuum-guard.mjs` with a transition-window rationale is added in the same
      change (mirroring the `lib/task-system-paths.mjs` entries). Never satisfy the lint by
      dropping the legacy alternatives.
- [ ] ADR-0078's *Neutral* consequences paragraph carries the one-clause amendment above,
      attributed to agentic-workflow-q8f3n, and ADR-0078's `related_tasks` gains
      `agentic-workflow-q8f3n` (this task's `related_adrs` already lists 0078).
- [ ] `node --test lib/test/vacuum-guard.test.mjs` and the full `node --test lib/test/*.test.mjs`
      suite are green, apart from failures that pre-exist on `main` at dispatch time and are
      unrelated to this change (see Notes).

## Notes

- **ADR-0059 disposition:** no convention established — a targeted fix, enforced by the same
  test file it lands in. No new ADR; only the one-clause ADR-0078 amendment.
- **ADR-0061:** every criterion above is machine-checkable; none is `[human-eye]`.
- **Do not edit ADR-0064.** Its bucket-1 wording (`.agentheim/knowledge/protocol.md`, "a
  BC's `INDEX.md`") is a historical ADR body and keeps the old spelling verbatim by
  ADR-0078's own *Negative* consequence; the path-literal lint exempts it. `skills/work/
  SKILL.md` step 6 already says "protocol/INDEX/state bookkeeping surfaces" without a literal
  path — nothing to re-point there either.
- **Deliberately not widened:** the protocol *archive* (`board/protocol/YYYY-MM.md`, legacy
  `knowledge/protocol/YYYY-MM.md`) and a BC's `done-archive/` never matched under the legacy
  regex either. Rotation is conductor-owned at session end (ADR-0045 / ADR-0047), so those
  paths never appear in a worker's `FILE_LIST`; keeping them out preserves the legacy
  boundary one-for-one. If a task-shaped rotation ever exists, widen then.
- **Pre-existing red on `main` at refinement time (2026-09-11):** the legacy-path lint's
  live-tree test fails on the 20 un-re-pointed `dashboard/app/*.js` styleguide import
  specifiers — that is agentic-workflow-tgr31's step 5, not this task. Two `bridge.test.mjs`
  cases also `EADDRINUSE` on :31425 whenever the builder's VS Code bridge is running. The
  conductor should brief the worker and verifier on both so a correct fix isn't failed for
  them.
- Discovered during agentic-workflow-zgav8 (out of its prose-only scope on purpose). The
  repo migrated under agentic-workflow-tgr31 the same day this was refined, which turned the
  gap from prospective to live.

## Outcome

Widened `lib/vacuum-guard.mjs`'s `BOOKKEEPING_SEGMENT_RE` (the `classifyTask` bucket-1
predicate behind the session-end batch-mix line, ADR-0064) to a single layout-agnostic
regex recognizing every bookkeeping shape of both the pre-ADR-0078 combined-`contexts/`
layout and the two-root `board`/`knowledge` layout at once: `.agentheim/knowledge/
protocol.md`, `.agentheim/board/protocol.md`, `.agentheim/contexts/<bc>/INDEX.md`,
`.agentheim/board/<bc>/INDEX.md`, `.agentheim/knowledge/contexts/<bc>/INDEX.md`, and
`.agentheim/state/…` (unchanged). A mixed legacy+board `FILE_LIST` still classifies
`bookkeeping`. Negative fixtures (a knowledge-half BC README, a board backlog task file, a
board done-archive rotation file) still classify `harness`, matching legacy-shape behaviour
one-for-one. `classifyTask`'s signature and purity are unchanged — no `node:fs` /
`task-system-paths` import, no new parameter; `HARNESS_SEGMENT_RE` / `ADR_SEGMENT_RE` were
untouched (same path under both layouts, per the task's own note).

Followed TDD: added 7 tests to `lib/test/vacuum-guard.test.mjs` (board protocol, board
task-half INDEX with a Windows-path fixture, board knowledge-half INDEX, mixed
legacy+board, and three negative fixtures — README/backlog/done-archive), confirmed red
for the right reason (3 of the 7 failing pre-fix, actual `'harness'` vs expected
`'bookkeeping'`), then widened the regex to green. All 41 tests in
`lib/test/vacuum-guard.test.mjs` pass (34 pre-existing, unmodified, still green; 7 new).

`node --test lib/test/legacy-path-literal-lint.test.mjs`: the new regex spelling evades the
lint exactly as the old one did (no allowlist entry needed) — the live-tree violation list
contains only the 20 pre-briefed `dashboard/app/*.js` styleguide specifiers (tgr31's job),
zero violations naming `lib/vacuum-guard.mjs`.

Full suite: `node --test lib/test/*.test.mjs` from the worktree root reports 655 tests,
653 pass, 2 fail — both are the pre-briefed, pre-existing failures explicitly called out
for this task (the legacy-path lint's live-tree test on the 20 dashboard specifiers and
`detectLayout: the live repo root resolves "legacy" today`, both sibling task
agentic-workflow-tgr31's responsibility, integrated in the same batch). No
`bridge.test.mjs` EADDRINUSE or `lifecycle-lock.test.mjs` EPERM occurred on this run.

ADR-0078's *Neutral* consequences paragraph is amended with a one-clause carve-out
attributed to agentic-workflow-q8f3n (`lib/vacuum-guard.mjs` carries one path-shaped regex,
now widened layout-agnostically, unlike `lib/vision-conformance.mjs` and
`lib/session-start-churn.mjs` which remain literal-free), and `agentic-workflow-q8f3n` is
appended to its `related_tasks` — an amendment of the existing ADR applied in place by the
conductor on `main`, not a new ADR number.

No README ubiquitous-language change — per the task's own Notes, `skills/work/SKILL.md`
step 6 and the BC README already describe the surfaces prose-only, without a literal path,
so nothing there needed re-pointing.

Files touched: `lib/vacuum-guard.mjs` (regex + doc comment), `lib/test/vacuum-guard.test.mjs`
(7 new tests). Verified PASS at iteration 1.
