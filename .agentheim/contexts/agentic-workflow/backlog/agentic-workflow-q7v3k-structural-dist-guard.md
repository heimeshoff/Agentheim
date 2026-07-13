---
id: agentic-workflow-q7v3k
title: Make the "workers never rebuild dist/" contract structural — a lint, not a prompt sentence
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-13
completed:
depends_on: []
blocks: []
tags: [lint, guard, worker-contract, dist, derived-artifact, worktree, merge-back]
related_adrs: [0003, 0032, 0026, 0052]
related_research: []
prior_art: [agentic-workflow-080, agentic-workflow-t4x8p, agentic-workflow-f6m2q]
---

## Why

Workers are contracted **not** to rebuild `dashboard/dist/`. It is a derived artifact
(ADR-0003: the styleguide/app source is the single source; `dist/` is bundled output),
and the `work` conductor regenerates it from **merged** source at integration time.

**The prompt-level prohibition does not hold.** Across **four sessions** workers have
rebuilt it anyway. In the 2026-07-13 12:30 session *all three* workers did it on their
first pass — including one that had been handed an explicit
*"HARD CONTRACT, not a preference"* framing in its dispatch prompt. Every rebuild was
caught and reverted by the conductor, by hand, every time. A rule that is violated by
100% of agents who are explicitly told the rule is not a rule; it is a wish.

**Why this is a correctness problem, not tidiness.** The bundle is *not* a pure function
of one worker's diff:

- esbuild **tree-shakes unused exports**. In the 2026-07-13 session `probeBridge` was
  absent from `infrastructure-h5wnq`'s bundle because *nothing consumed it yet* —
  `agentic-workflow-m2vkp` only landed later. So a worker's bundle and a post-merge
  bundle **legitimately differ**, and the difference is invisible without knowing the
  whole merged tree.
- Under ADR-0032's per-worker worktrees, two workers who both rebuild produce two
  divergent minified bundles from two different bases. A textual 3-way merge of those
  would yield **an artifact built from a source tree that never existed** — plausible-
  looking, silently missing a shipped fix, and **invisible to the test suite**, which
  imports `app/`, never `dist/`. The 2026-07-09 session hit exactly this and had to
  discard both sides and rebuild from merged source.

So the correct doctrine is already known and already written down — *generated artifacts
are regenerated at merge-back, never merged*. What's missing is **enforcement**. Today
the only thing standing between that failure and `main` is the conductor noticing a dirty
`dist/` in `git status` and reverting it by hand, on every task, forever.

## What

Make the contract **structural**: a worker's diff that touches `dashboard/dist/**` should
**fail**, mechanically, rather than relying on a sentence in a dispatch prompt that four
sessions of evidence say agents will ignore.

The precedent for this exact move already exists in the repo — `lib/agent-spawn-namespace.mjs`
(ADR-0052) is a live-tree lint that fails when a forbidden pattern (a bare, un-namespaced
`subagent_type`) reappears. `agentic-workflow-080`'s duplicate-task-id guard is the same
family. This task asks for a third member of that family.

**The open design question — where the guard fires — is the real work here, and is
deliberately left for refinement.** The candidates are not equivalent:

- **A test in the suite** (`node --test`) asserting `dist/` matches a fresh build of the
  current source. Cheap and consistent with the existing lint family — but note it would
  fail for the *conductor* too, mid-integration, before it rebuilds. It also can't
  distinguish "a worker rebuilt this" from "the bundle is legitimately stale."
- **A conductor-side check in `work`** — assert `dashboard/dist/` is clean in the worker's
  worktree before the wip-checkpoint, and hard-fail (or auto-revert, as today) with a loud
  protocol line. This is where the knowledge actually lives (only the conductor knows a
  worktree belongs to a worker), but it is a skill-prose rule again — the very thing that
  isn't holding.
- **A git-level guard** (`.gitattributes`, a pre-commit hook, or a merge driver marking
  `dist/*` binary/ours). Strongest, but git hooks are not installed by the plugin and the
  repo has no CI (per the BC README), so this may not be reachable.

A worker should pick one **with an argument**, not assemble all three.

Note the guard must not break the **legitimate** writer: the `work` conductor *does*
rebuild `dist/` on `main` at integration, and `dashboard/build.mjs` must keep working.
Whatever fires, it must distinguish the sanctioned regeneration from the forbidden one —
that distinction is the crux of the task.

## Acceptance criteria

- [ ] A worker diff that modifies any path under `dashboard/dist/**` is caught
      **mechanically** — not by a human or a conductor reading `git status`.
- [ ] The conductor's own sanctioned rebuild-from-merged-source at integration
      (`node dashboard/build.mjs` on `main`, then committing `dist/`) still works and is
      **not** flagged. The guard distinguishes the sanctioned writer from the forbidden one.
- [ ] The guard states *why* on failure — it names ADR-0003 and the tree-shaking /
      never-existed-source-tree hazard, so an agent that trips it learns the reason rather
      than just seeing red.
- [ ] The chosen enforcement point is **justified in the task's Outcome** against the
      alternatives above (suite test vs. conductor-side check vs. git-level guard), not
      merely implemented.
- [ ] The guard is itself unit-tested — it must go **red** when a `dist/` modification is
      introduced. (This session produced two tests that were structurally incapable of
      failing on their own criterion; do not add a third.)
- [ ] If the enforcement lands conductor-side, `skills/work/SKILL.md`'s worker-dispatch
      contract is updated to point at the mechanism rather than repeating the prohibition
      in prose.
- [ ] The BC README records the rule and where it is enforced.

## Notes

- **Read `lib/agent-spawn-namespace.mjs` first** — it is the closest prior art (a live-tree
  lint over a forbidden pattern, ADR-0052) and the shape to follow or consciously depart from.
  `agentic-workflow-080` (duplicate-task-id guard) is the second member of that family.
- **Beware CRLF.** `agentic-workflow-t4x8p` had to fix guard regexes that were
  CRLF-sensitive on this Windows box. A `dist/`-comparison guard that diffs bytes will walk
  straight into `autocrlf=true`. Related: `dashboard/dist/app.js` is known to show as
  modified in `git status` while its bytes match `HEAD` — confirm any "is it dirty" check
  against `git diff --numstat`, not `git status` alone.
- **The minified bundle is not diff-stable across rebuilds of *changed* source.** esbuild's
  identifier mangling shifts (observed: 56 changed lines that were pure `jl`↔`Hl` renames
  with zero semantic delta). A guard that asserts "dist matches a fresh build" must be robust
  to that, or it will produce false positives. Rebuilding *unchanged* source **does** reproduce
  the committed bundle byte-for-byte — that was verified in the 2026-07-13 session — so the
  property is "reproducible given the same source", not "stable across source changes".
- **Routing note (challengeable at refinement).** Filed to `agentic-workflow` rather than
  `infrastructure` because the thing being protected is the **worker/conductor contract** and
  the integrity of ADR-0032's parallel merge-back — i.e. the workflow itself. ADR-0003 does
  assign the *build pipeline and committed dist* to `infrastructure`, so an argument exists for
  filing it there instead; if the chosen enforcement point turns out to be the build pipeline
  (a `build.mjs` change) rather than the work loop, moving this task to `infrastructure` is the
  right call.
