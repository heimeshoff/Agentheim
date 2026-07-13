---
id: agentic-workflow-q7v3k
title: Make the "workers never rebuild dist/" contract structural — filter the conductor's checkpoint, don't prompt the worker
status: done
type: feature
context: agentic-workflow
created: 2026-07-13
completed: 2026-07-13
depends_on: []
blocks: []
tags: [lint, guard, worker-contract, dist, derived-artifact, worktree, merge-back]
related_adrs: [0003, 0013, 0026, 0032, 0038, 0052, 0055, 0057]
related_research: []
prior_art: [agentic-workflow-080, agentic-workflow-t4x8p, agentic-workflow-f6m2q]
---

## Why

Workers are contracted **not** to rebuild `dashboard/dist/`. It is a derived artifact
(ADR-0003: the styleguide/app source is the single source; `dist/` is bundled output),
and the `work` conductor regenerates it from **merged** source at integration time.

**Correction (worker, agentic-workflow-q7v3k, ADR-0057) — the original diagnosis below was
factually wrong; kept struck-through-in-spirit for the record, replaced by the verified
mechanism.** ~~The prompt-level prohibition does not hold. Across four sessions workers have
rebuilt it anyway... every rebuild was caught and reverted by the conductor, by hand, every
time. A rule that is violated by 100% of agents who are explicitly told the rule is not a
rule; it is a wish.~~ **This reads as defiance. It is not defiance — it is mechanically
unavoidable.** `dashboard/test/dist-build.test.mjs` has a `before()` hook that runs
`execFileSync(process.execPath, [path.join(DASHBOARD, 'build.mjs')], ...)` **on every
invocation of the suite.** TDD is the worker's execution discipline, so every worker is
required to run the suite — and therefore every worker rebuilds `dashboard/dist/` in its own
worktree whether it wants to or not, without ever typing `node build.mjs`. The four sessions
of "violation" were four sessions of workers correctly running their tests. The prohibition,
as a prompt sentence, was never satisfiable in the first place — a worker could only have
complied by refusing to run the suite. Verified directly against the test file before this
task began writing code.

**Refinement found the rule is worse off than the capture assumed — on two counts.**

1. **The contract has no durable home.** `rebuild` and `build.mjs` appear in **zero**
   files under `skills/` and `agents/` (before this task). The "HARD CONTRACT" existed only
   in whatever prose the conductor improvised into each dispatch prompt, re-typed from
   scratch every session — never a rule any worker was defying, because it was never
   written down anywhere a worker could read it as a durable rule.
2. **ADR-0032 currently *licenses* the behaviour.** Its `### Windows & node_modules`
   section, justifying the shared `node_modules` junction, says esbuild "reads deps and
   **writes each worktree's own tracked `dashboard/dist/`**, so there is no concurrent
   writer to the shared dir." A worker who reads the architecture is told building in its
   worktree is expected. The guard must land **with** an ADR-0032 amendment, or it enforces
   a rule the architecture still contradicts.

**Consequence for the chosen mechanism: this finding strengthens it, decisively, not just
supports it.** If the rebuild cannot be prevented by any amount of prompt discipline — it is
a side effect of tooling every worker must run — then no prompt-level rule can ever prevent
it, and the only workable enforcement is exactly what this task chose: drop the derived
artifact at the conductor's staging seam, so the rebuild becomes **inert** rather than
forbidden. See ADR-0057 (not ADR-0056 — that number was claimed by infrastructure-d2n8s
before this task started).

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
- **New:** ADR-0057 (renumbered at execution time — 0056 was claimed by infrastructure-d2n8s
  while this task sat in todo/) (`scope: agentic-workflow`) — *derived artifacts are unstageable from a
  worktree; the conductor's manifest is the guard, not a prompt sentence.* In the
  ADR-0026/0032/0038/0055 lineage. Its **Alternatives** section must record that (a) is
  inverted and that (c) re-litigates ADR-0013 against the wrong actor.
- **Edit:** the BC README — record the rule and where it is enforced.
- **Not touched:** `dashboard/build.mjs`, `.gitattributes`, `.git/hooks/`.

## Acceptance criteria

- [x] `lib/derived-artifact-guard.mjs` exists: pure, stdlib-only, git-free, side-effect-free.
      Exports `DERIVED_ARTIFACT_PREFIXES` and
      `partitionCheckpointFiles(worktreeRoot, fileList) → { changed, refused }`.
- [x] The guard operates on the **declared `FILE_LIST`**, never the working tree. It neither
      runs nor needs `git status` / `git diff` — so it is structurally immune to the known
      `autocrlf` phantom-modification of `dashboard/dist/app.js`.
- [x] The guard refuses the **real input shape**: an absolute, OS-native-separator path
      (`references/worker-return-format.md` line 17 — `FILE_LIST` is comma-separated
      **absolute** paths). The test fixture must be built with
      `path.join(worktreeRoot, 'dashboard', 'dist', 'app.js')`, **not** a hardcoded
      POSIX-relative literal — a guard written against `'dashboard/dist/app.js'` will pass
      its own test and be **inert against every real input**.
- [x] The guard refuses nested paths (`dashboard/dist/fonts/x.woff2`) and does **not** refuse
      `dashboard/dist-notes.md` — segment-boundary matching, never `includes('dist')`.
- [x] The guard refuses a path resolving outside the worktree with a distinct
      `outside-worktree` reason.
- [x] `lib/test/derived-artifact-guard.test.mjs` **proves the guard can go red**: the task's
      Outcome names the mutation (e.g. emptying `DERIVED_ARTIFACT_PREFIXES`, or reverting to
      a naive relative-string match) and which test flips to failing under it. This session
      shipped **two** tests that were structurally incapable of failing on their own
      criterion — do not add a third.
- [x] `lib/task-lifecycle-cli.mjs` exposes `checkpoint` with the manifest shape above, and
      `refusalReason` **states why**: it names ADR-0003 and the tree-shaking /
      never-existed-source-tree hazard, so an agent that trips it learns the reason.
- [x] `skills/work/SKILL.md` invokes `checkpoint` instead of hand-composing the `git add`,
      stages `changed` verbatim, and a refusal **drops the path and continues** — it never
      fails the task or the batch. (The worker's actual work is fine; only its derived
      artifact is dropped.)
- [x] The conductor's sanctioned main-tree rebuild is demonstrably **unreachable** by the
      guard — because `checkpoint` only ever runs against a worktree, **not** because of any
      actor/identity check. There must be no "is this the conductor?" test in the code.
- [x] ADR-0032's `### Windows & node_modules` passage no longer describes a worker writing
      its worktree's `dashboard/dist/` as expected.
- [x] ADR-0057 is written (renumbered from 0056 — see Notes), `scope: agentic-workflow`, with
      the Alternatives section above.
- [x] The BC README records the rule and its enforcement point.
- [x] **Do not** add any test or criterion asserting "`dist/` matches a fresh build of
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
- **Open thread — resolved, not spun out.** The capture speculated rebuilds were "caught by
  the conductor noticing a dirty `dist/` in `git status`," which would be impossible for a
  worktree-scoped rebuild under ADR-0032 unless the conductor inspected worktrees directly or
  a worker escaped its assigned tree. Direct observation in the session immediately preceding
  this one (infrastructure-d2n8s) showed a worker's rebuilt `dashboard/dist/` appearing in
  **its own worktree's** `git status`, with `main` staying clean. **No worktree-escape defect
  exists.** The rebuild is in-worktree and test-induced (`dist-build.test.mjs`'s `before()`
  hook — see the corrected `## Why` above). No sibling task filed.
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

## Outcome

Made the "workers never merge a rebuilt `dashboard/dist/`" contract structural instead of
prompt-level, by filtering the conductor's checkpoint `git add` against the worker's
self-reported `FILE_LIST`, never the working tree.

**Correction landed first (see `## Why`):** the original diagnosis — "workers defy the
contract" — was verified false against `dashboard/test/dist-build.test.mjs`, whose
`before()` hook rebuilds `dashboard/dist/` on every suite run. Since TDD requires running
the suite, every worker rebuilds the artifact unavoidably; the four sessions of "violation"
were four sessions of correct test execution. This is recorded in the task's `## Why` and in
ADR-0057's Context, and it *strengthens* the chosen mechanism: no prompt rule can stop an
outcome the required tooling produces as a side effect, so dropping the artifact at the one
staging seam it must cross is the only workable enforcement.

**What shipped:**
- `lib/derived-artifact-guard.mjs` — pure, stdlib-only, git-free, side-effect-free.
  `DERIVED_ARTIFACT_PREFIXES` (`['dashboard/dist/']`, frozen) and
  `partitionCheckpointFiles(worktreeRoot, fileList) → { changed, refused }`, matching on
  POSIX-converted, worktree-relative segment boundaries (the trailing `/` on each prefix is
  what makes `dashboard/dist-notes.md` safe and `dashboard/dist/fonts/x.woff2` caught).
  Refusal reasons: `'derived-artifact'` and `'outside-worktree'` (path climbs out of the
  worktree, or resolves onto a different root/drive entirely).
- `lib/test/derived-artifact-guard.test.mjs` — 9 tests, all fixtures built with
  `path.join(worktreeRoot, ...)` per the task's named trap (never a POSIX-relative literal).
  **Mutation proof performed, not just reasoned about:** emptied `DERIVED_ARTIFACT_PREFIXES`
  to `[]`, re-ran the suite, and observed 4 tests flip to failing (the derived-artifact
  refusal test, the nested-path test, the mixed-FILE_LIST partition test, and the
  filesystem-independence test) — each asserting a `refused.length === 1` /
  `reason: 'derived-artifact'` that the mutation removes. Reverted immediately after
  confirming RED; suite is GREEN again on the restored code.
- `lib/task-lifecycle-cli.mjs` — new `checkpoint` verb: `(rootDir, id, opts) → { ok, changed,
  refused, refusalReason, message, verb: 'checkpoint' }`. `rootDir` doubles as the worktree
  root (discovered from cwd, exactly as the other three verbs already do). `refusalReason`
  names ADR-0003 and the tree-shaking / never-existed-source-tree hazard whenever `refused`
  is non-empty, else `null`. `message` is `"wip [<id>] iter <N>"`, matching the existing
  checkpoint-commit convention verbatim. Kept on this CLI as an argued departure (moves no
  task, edits no INDEX) because it's git-free and reuses the same bootstrap/manifest shape.
  4 new tests added to `lib/test/task-lifecycle-cli.test.mjs` (both `runCli` direct-call and
  one real child-process spawn), all TDD (RED confirmed as `unknown-verb` before the verb
  existed, GREEN after).
- `skills/work/SKILL.md` — the checkpoint step (~line 111) now invokes `checkpoint` instead
  of hand-composing `git -C .worktrees/<id> add <FILE_LIST + ...>`; stages the manifest's
  `changed` list verbatim; a non-empty `refused` is surfaced (with `refusalReason`) in the
  end-of-run summary and any FAIL re-dispatch prompt, but never fails the task or batch. The
  Subagent Prompt Template's `## Rules — CRITICAL` block gained item 9, the rule's first
  durable home, stated as the mechanism (suite rebuilds are expected and inert, not
  forbidden-yet-happening) rather than a plea.
- `.agentheim/knowledge/decisions/0032-worker-worktree-isolation-git-model.md` — the
  `### Windows & node_modules` passage no longer describes a worker's worktree-local
  `dashboard/dist/` write as expected/licensed; it now attributes it to the test suite's
  `before()` hook and points at ADR-0057's guard, while preserving the original point (the
  `node_modules` junction is safe because esbuild only *reads* the shared copy).
- `.agentheim/knowledge/decisions/0057-derived-artifacts-unstageable-from-worktree-checkpoint-guard.md`
  — new ADR (renumbered from the task's stated 0056, which infrastructure-d2n8s claimed
  first). Alternatives section records (a) as actively harmful (not merely inverted — the
  `before()` hook would make a "dist matches fresh build" test permanently, structurally
  green) and (c) as re-litigating ADR-0013 against the wrong actor; also records the
  worktree-escape hypothesis as investigated and ruled out.
- `.agentheim/contexts/agentic-workflow/README.md` — new bullet under the worktree-isolation
  entry recording the rule, the enforcement seam, and the ADR-0057 pointer.

**Tests:** 13 new (9 guard + 4 checkpoint verb). Full batch suite
(`node --test lib/test/*.test.mjs dashboard/test/*.test.mjs
.agentheim/contexts/design-system/styleguide/test/*.test.mjs vscode-extension/test/*.test.mjs`)
run from the worktree root: 1336 total, 1334 pass, 2 fail — the two pre-existing
`vscode-extension/test/bridge.test.mjs` EADDRINUSE failures (the builder's live VS Code
bridge holding port 31425 on this machine), unrelated to this task and present before it
started. No other regressions. `dashboard/dist/` went dirty in the worktree from running
the suite, exactly as diagnosed — left untouched, not staged, not part of `FILE_LIST`.
