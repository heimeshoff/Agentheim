---
id: agentic-workflow-080
title: Duplicate task-id guard across the lifecycle tree (node --test, optional insurance)
status: done
type: chore
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-18
depends_on: []
blocks: []
tags: [identity, ids, lint, test, insurance]
related_adrs: [0028, 0022, 0012]
related_research: []
prior_art: [agentic-workflow-077]
---

## Why

ADR-0028's random-token scheme is collision-free by construction at the realistic concurrent
window (≈0.005% over n≈50), but a tiny residual collision probability remains, and a token can
also clash with a legacy id only through a bug. ADR-0028 names a duplicate-id check as the
**insurance** that covers that tail (rather than a longer token). It also backstops ADR-0022's
"ids are retired, never reused" and ADR-0012's anchored id→file resolution: two files claiming
one id silently corrupts `depends_on` / `blocks` / `prior_art` edges, the `[<id>]` commit
trailer, and dismiss/retirement — exactly the failure ADR-0028 §Context warns about. This task
is explicitly **optional / not required for v1** of the id scheme.

**Refinement finding (this repo has no CI).** The original capture called this a "CI lint" and
its acceptance asked for "CI wiring". There is **no CI pipeline in this repo** — no `.github/`,
no GitHub Actions, no root `package.json`. The repo's actual guard convention is a **pure,
stdlib-only module under `lib/` unit-tested with `node --test`** (the `task-lifecycle.mjs` ↔
`lib/test/task-lifecycle.test.mjs` pairing, and the `tree.mjs` / `search.mjs` "pure core,
DOM-free, loss-tolerant, `node --test`-able" doctrine). So the guard is delivered as a
`node --test` check, **not** a CI job; "passes on the current tree" becomes a live-tree
assertion in that suite. If a CI pipeline is ever introduced, it runs the same suite — no
rework. This reframe stays within ADR-0028's "optional duplicate-id check" clause; the ratified
token grammar (§1–§3) is **not** re-litigated here.

## What

Add a pure scanner module that enumerates every task file under
`.agentheim/contexts/*/{backlog,todo,doing,done}/` across all BCs, collects each task's `id`,
and reports any id that appears in more than one file. Cover it with a `node --test` test that
both (a) exercises the scanner against fixtures and (b) runs it against the **live** `.agentheim/`
tree and asserts there are no duplicates — the recurring insurance.

Shape it like the existing pure modules: stdlib-only, DOM-free, side-effect-free (takes a root
path, returns data), so it is trivially `node --test`-able and could later be invoked from a
release preflight or a CI job without change.

## Acceptance criteria

- [ ] A pure scanner (e.g. `lib/duplicate-id-check.mjs`, exporting something like
      `findDuplicateTaskIds(root)`) walks all four lifecycle folders of every BC and collects
      each task's id. It is stdlib-only and side-effect-free (root in → data out), mirroring
      `lib/task-lifecycle.mjs` / `dashboard/tree.mjs`.
- [ ] The id is taken from the task's frontmatter `id`, falling back to the filename's `<id>-`
      prefix when frontmatter is absent/malformed (disk is the source of truth — the scanner is
      loss-tolerant and never throws on a single bad file, matching the tree-walk doctrine).
- [ ] For any id appearing in more than one file, the scanner returns the offending id **and all
      colliding file paths**; a thin reporter renders a clear failure message naming them.
- [ ] Shape-agnostic — legacy `<bc>-NNN` and new `<bc>-<token>` ids are compared as **whole ids**
      (no tail parsing, no id/slug split), so the guard is independent of the ADR-0028 grammar and
      of aw-078's `deriveContext` change.
- [ ] A `node --test` test (e.g. `lib/test/duplicate-id-check.test.mjs`) covers: two files sharing
      one id → reported with both paths; all-distinct ids → empty; a mixed legacy+token tree → still
      compared whole-id.
- [ ] The same test runs the scanner against the **live** `.agentheim/` tree and asserts **no
      duplicates** (this replaces the original "passes on the current tree" + "CI wiring" criteria;
      the `node --test` suite is the gate, since the repo has no CI).
- [ ] No CI pipeline is introduced (none exists). The guard is exercised by the existing
      `node --test` suite the maintainer / `release` skill runs.

## Notes

- Insurance only; do **not** gate the id-scheme rollout on this task (ADR-0028).
- **Independent of aw-078 / aw-079** by design — whole-id comparison means it needs neither the
  `deriveContext` dual-shape regex nor the minting sweep. `depends_on: []` is intentional; it can
  be worked anytime (before or after the rest of the ADR-0028 children).
- Keep it cheap — an O(tree) walk into a `Map<id, paths[]>`, flagging entries with >1 path;
  lifecycle folders are small.
- Natural future invocation point: the `release` skill's preflight (RELEASE.md) could call the
  scanner before tagging — out of scope here, but the side-effect-free shape leaves it open.
- Promotion-ready after this refinement, but parked in `backlog/` deliberately because it is
  explicitly optional insurance — promote when the builder wants it built.

## Outcome (2026-06-18)

Delivered the ADR-0028 duplicate-id **insurance** as a pure stdlib module, not a CI lint
(the repo has no CI; the `node --test` suite is the gate).

- **`lib/duplicate-id-check.mjs`** — exports `findDuplicateTaskIds(root)` and a thin
  `formatDuplicateReport(duplicates)`. The scanner walks every BC's four lifecycle folders
  under `<root>/.agentheim/contexts/`, collects each task's id (frontmatter `id:` first, with
  the filename stem as a loss-tolerant fallback), and returns one entry per id claimed by more
  than one file — each with all colliding absolute paths (sorted, deterministic). Stdlib-only
  (`node:fs`, `node:path`), side-effect-free (root in → data out), never throws on a single bad
  file or missing folder. **Whole-id comparison** — no tail parsing, no id/slug split — so it is
  independent of the ADR-0028 token grammar and of aw-078's `deriveContext` dual-shape regex.
- **`lib/test/duplicate-id-check.test.mjs`** — 9 `node --test` tests: all-distinct → empty;
  two files sharing one id → reported with both paths; collision across lifecycle folders and
  across BCs; mixed legacy+token compared whole-id (prefix-sharing `-001` vs `-z001x` do NOT
  collide); frontmatter wins over filename; filename fallback when frontmatter absent; absent/
  empty tree is no-throw; reporter formatting. The final test runs the scanner against the
  **live** `.agentheim/` tree and asserts **no duplicates** — the recurring insurance.
- BC README: added a `findDuplicateTaskIds` ubiquitous-language entry next to `applyTaskMove`.
- No ADR (design fully constrained by ADR-0028 + the refinement note); no new backlog items;
  no CI introduced. Full `lib/` suite green (31 tests).
