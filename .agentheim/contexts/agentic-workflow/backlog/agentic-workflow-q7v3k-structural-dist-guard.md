---
id: agentic-workflow-q7v3k
title: Make the "workers never rebuild dist/" contract structural — filter the conductor's checkpoint, don't prompt the worker
status: backlog
type: feature
context: agentic-workflow
created: 2026-07-13
completed:
depends_on: []
blocks: []
tags: [lint, guard, worker-contract, dist, derived-artifact, worktree, merge-back]
related_adrs: [0003, 0013, 0026, 0032, 0038, 0052, 0055]
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

**Refinement found the rule is worse off than the capture assumed — on two counts.**

1. **The contract has no durable home.** `rebuild` and `build.mjs` appear in **zero**
   files under `skills/` and `agents/`. The "HARD CONTRACT" exists only in whatever prose
   the conductor improvises into each dispatch prompt, re-typed from scratch every session.
   Workers weren't defying a written rule — they were defying a rule that was never
   written down.
2. **ADR-0032 currently *licenses* the behaviour.** Its `### Windows & node_modules`
   section, justifying the shared `node_modules` junction, says esbuild "reads deps and
   **writes each worktree's own tracked `dashboard/dist/`**, so there is no concurrent
   writer to the shared dir." A worker who reads the architecture is told building in its
   worktree is expected. The guard must land **with** an ADR-0032 amendment, or it enforces
   a rule the architecture still contradicts.

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

So the correct doctrine is already known. What's missing is **enforcement**.

## What

**The enforcement point is decided** (this was the capture's open question; refinement
closed it): filter the **conductor's checkpoint `git add`**, mechanically. Do not lint the
tree, do not prompt the worker harder.

**The insight that decides it:** a rebuilt `dist/` has exactly **one channel** by which it
can escape a worktree and reach `main` — the conductor's enumerated stage at the
wip-checkpoint (`skills/work/SKILL.md` ~line 111), which today stages the worker's
self-reported `FILE_LIST` **verbatim, on trust, unfiltered**. A worker can dirty its
worktree all it likes; if the derived artifact is never *staged*, it never reaches the
squash-merge, and the violation is inert. So the guard replaces **judgment with
transcription** at the one seam that already exists — the same move ADR-0038 made for the
lifecycle verbs.

**This also answers the task's stated crux — how to tell the sanctioned writer from the
forbidden one — structurally, with no actor check anywhere.** The guard lives inside a
verb that only ever runs against a *worktree*. The conductor's sanctioned
rebuild-from-merged-source happens on `main` at integration and never routes through it.
It is not *exempted*; it is **out of the guard's reach by construction**. No identity
test, no "is this the conductor?" flag — the two writers are separated by which code path
they travel.

### The two rejected alternatives — and why (a) is *inverted*, not merely weak

- **(a) A suite test asserting `dist/` matches a fresh build of current source — REJECTED,
  and it is actively harmful.** The verifier runs the suite **from the worker's worktree**
  (`skills/work/SKILL.md` lines 168/178). So that assertion is **true exactly when the
  worker committed the violation** (they rebuilt, so dist matches), and **false whenever a
  worker correctly left `dist/` untouched while changing source that feeds it**. Such a
  test would have *coerced every dashboard-touching worker into rebuilding `dist/` to go
  green* — it enforces the precise opposite of the contract. This is not a close call and
  must be argued explicitly in the ADR, so nobody re-proposes it.
- **(c) A git-level guard (hook / merge driver / `.gitattributes`) — REJECTED, wrong actor
  and already-settled ground.** **Workers never run git** (ADR-0032, ADR-0026: the
  conductor owns all git). A pre-commit hook would fire on the *conductor* — guarding the
  one actor that isn't violating anything — and never on the violator. Separately, this
  repo has no CI, no `core.hooksPath`, no installed hooks and no `.gitattributes`
  (verified), and **ADR-0013 already decided** against CI/git-hooks for this repo
  deliberately. Re-litigating that here would be a large decision smuggled in as a lint.

### Deliverables

- **New:** `lib/derived-artifact-guard.mjs` — pure, stdlib-only, git-free, side-effect-free
  (the `lib/agent-spawn-namespace.mjs` / ADR-0052 family: root path in, plain data out,
  never writes). Exports a frozen `DERIVED_ARTIFACT_PREFIXES` (starting with
  `['dashboard/dist/']`) and `partitionCheckpointFiles(worktreeRoot, fileList) →
  { changed, refused }`, each `refused` entry carrying
  `{ path, reason: 'derived-artifact' | 'outside-worktree' }`.
- **New:** `lib/test/derived-artifact-guard.test.mjs`.
- **Edit:** `lib/task-lifecycle-cli.mjs` — add a `checkpoint` verb returning
  `{ ok, changed, refused, refusalReason, message, verb: 'checkpoint' }`, mirroring
  `claim`/`complete`'s manifest convention and reusing the conductor's existing bootstrap
  blob. (If the worker judges `checkpoint` doesn't belong on the *lifecycle* CLI — it moves
  no task and edits no INDEX — a separate small CLI is an acceptable, argued departure.)
- **Edit:** `skills/work/SKILL.md` ~line 111 — replace the hand-composed
  `git -C .worktrees/<id> add <FILE_LIST + ...>` with the `checkpoint` verb; stage
  `changed` verbatim; surface `refused` entries in the end-of-run summary and prepend them
  to any FAIL re-dispatch prompt.
- **Edit:** `skills/work/SKILL.md`'s Subagent Prompt Template `## Rules — CRITICAL` — give
  the rule its first durable home, stated as the **mechanism**, not a plea: *"a
  `dashboard/dist/` rebuild in your worktree will be dropped at checkpoint, not merged."*
- **Edit:** `.agentheim/knowledge/decisions/0032-worker-worktree-isolation-git-model.md` —
  amend the `### Windows & node_modules` passage so it no longer describes workers writing
  their worktree's `dist/` as expected behaviour.
- **New:** ADR-0056 (`scope: agentic-workflow`) — *derived artifacts are unstageable from a
  worktree; the conductor's manifest is the guard, not a prompt sentence.* In the
  ADR-0026/0032/0038/0055 lineage. Its **Alternatives** section must record that (a) is
  inverted and that (c) re-litigates ADR-0013 against the wrong actor.
- **Edit:** the BC README — record the rule and where it is enforced.
- **Not touched:** `dashboard/build.mjs`, `.gitattributes`, `.git/hooks/`.

## Acceptance criteria

- [ ] `lib/derived-artifact-guard.mjs` exists: pure, stdlib-only, git-free, side-effect-free.
      Exports `DERIVED_ARTIFACT_PREFIXES` and
      `partitionCheckpointFiles(worktreeRoot, fileList) → { changed, refused }`.
- [ ] The guard operates on the **declared `FILE_LIST`**, never the working tree. It neither
      runs nor needs `git status` / `git diff` — so it is structurally immune to the known
      `autocrlf` phantom-modification of `dashboard/dist/app.js`.
- [ ] The guard refuses the **real input shape**: an absolute, OS-native-separator path
      (`references/worker-return-format.md` line 17 — `FILE_LIST` is comma-separated
      **absolute** paths). The test fixture must be built with
      `path.join(worktreeRoot, 'dashboard', 'dist', 'app.js')`, **not** a hardcoded
      POSIX-relative literal — a guard written against `'dashboard/dist/app.js'` will pass
      its own test and be **inert against every real input**.
- [ ] The guard refuses nested paths (`dashboard/dist/fonts/x.woff2`) and does **not** refuse
      `dashboard/dist-notes.md` — segment-boundary matching, never `includes('dist')`.
- [ ] The guard refuses a path resolving outside the worktree with a distinct
      `outside-worktree` reason.
- [ ] `lib/test/derived-artifact-guard.test.mjs` **proves the guard can go red**: the task's
      Outcome names the mutation (e.g. emptying `DERIVED_ARTIFACT_PREFIXES`, or reverting to
      a naive relative-string match) and which test flips to failing under it. This session
      shipped **two** tests that were structurally incapable of failing on their own
      criterion — do not add a third.
- [ ] `lib/task-lifecycle-cli.mjs` exposes `checkpoint` with the manifest shape above, and
      `refusalReason` **states why**: it names ADR-0003 and the tree-shaking /
      never-existed-source-tree hazard, so an agent that trips it learns the reason.
- [ ] `skills/work/SKILL.md` invokes `checkpoint` instead of hand-composing the `git add`,
      stages `changed` verbatim, and a refusal **drops the path and continues** — it never
      fails the task or the batch. (The worker's actual work is fine; only its derived
      artifact is dropped.)
- [ ] The conductor's sanctioned main-tree rebuild is demonstrably **unreachable** by the
      guard — because `checkpoint` only ever runs against a worktree, **not** because of any
      actor/identity check. There must be no "is this the conductor?" test in the code.
- [ ] ADR-0032's `### Windows & node_modules` passage no longer describes a worker writing
      its worktree's `dashboard/dist/` as expected.
- [ ] ADR-0056 is written, `scope: agentic-workflow`, with the Alternatives section above.
- [ ] The BC README records the rule and its enforcement point.
- [ ] **Do not** add any test or criterion asserting "`dist/` matches a fresh build of
      source." That criterion is rejected as inverted (see What) and is satisfiable only by
      the mechanism this task exists to avoid.

## Notes

- **Highest-priority trap: `FILE_LIST` is absolute, OS-native-separator paths.** A guard or
  test written against a POSIX-relative literal will look correct, pass, and be structurally
  inert on every real input. Verified at `references/worker-return-format.md` line 17.
- **Read `lib/agent-spawn-namespace.mjs` first** — closest prior art (a live-tree lint over a
  forbidden pattern, ADR-0052) and the module shape to follow. `agentic-workflow-080`
  (duplicate-task-id guard) is the family's second member. This guard is the third, but note
  it is a *filter over declared data*, not a tree walk — follow the purity doctrine, not the
  scanning shape.
- **The minified bundle is not diff-stable across rebuilds of *changed* source** — esbuild's
  identifier mangling shifts (observed: 56 changed lines that were pure `jl`↔`Hl` renames,
  zero semantic delta). Rebuilding *unchanged* source **does** reproduce the committed bundle
  byte-for-byte. This is background for why the merge hazard is real; the chosen guard never
  compares bundles, so it sidesteps the instability entirely.
- **Open thread to resolve before implementing (may spawn a sibling task).** The capture says
  rebuilds were "caught by the conductor noticing a dirty `dist/` in `git status`" — but under
  ADR-0032 a *worktree-only* rebuild would not appear in `main`'s `git status` at all. Either
  the conductor was inspecting worktrees, or **some workers ran the build from the main tree
  directly**, escaping their assigned `Workspace`. That second possibility is a distinct
  defect: this guard's `outside-worktree` refusal catches the *staging* half of it, but
  nothing here stops a worker from dirtying `main` in the first place. Check the evidence
  before starting; if workers escaped the worktree, file that separately.
- **Spin-out, deliberately out of scope:** a `.gitattributes` entry
  (`dashboard/dist/** -text -merge`) is a genuine fix for two adjacent problems — the
  `autocrlf` phantom-modification, and forcing a *loud* conflict instead of a silent bad
  merge. Worth doing as its own `infrastructure` task. Beware: adding `-text` to an
  already-committed file under `autocrlf=true` triggers a one-time whole-file renormalization
  diff.
- **Routing confirmed: stays in `agentic-workflow`.** The capture's own test was "if the
  enforcement point turns out to be the build pipeline, move it to `infrastructure`." It
  isn't — `dashboard/build.mjs` is untouched entirely, and every deliverable lands in the
  work loop (`skills/work/SKILL.md`, the lifecycle CLI, the worker contract). That is this
  BC's territory.
