---
id: ADR-0057
title: Derived artifacts are unstageable from a worktree — the conductor's checkpoint manifest is the guard, not a prompt sentence
scope: agentic-workflow
status: accepted
date: 2026-07-13
related_tasks: [agentic-workflow-q7v3k]
related_adrs: [0003, 0013, 0026, 0032, 0038, 0052, 0055]
---

# ADR-0057: derived artifacts are unstageable from a worktree — the checkpoint manifest is the guard

## Context

Workers are contracted **not** to rebuild `dashboard/dist/`. It is a derived, bundled
artifact (ADR-0003: `dashboard/`'s `app/` source is the single source of truth; `dist/` is
esbuild's build-time output), and the `work` conductor regenerates it from **merged** source
at integration. Across four sessions the prompt-level prohibition failed to hold: workers'
worktrees showed `dashboard/dist/` rebuilt, every time, despite an explicit "HARD CONTRACT"
framing in at least one dispatch prompt.

**The apparent defiance is not defiance — it is mechanically unavoidable, and this is the
central finding this ADR records.** `dashboard/test/dist-build.test.mjs` has a `before()`
hook that runs `execFileSync(process.execPath, [path.join(DASHBOARD, 'build.mjs')], ...)`
**on every invocation of the suite.** A worker's execution discipline is TDD, which requires
running the suite. Therefore every worker rebuilds `dashboard/dist/` in its own worktree
whether it intends to or not, without ever typing `node build.mjs`. The four sessions of
"violation" were four sessions of workers correctly running their tests. **No prompt-level
rule can prevent an outcome the worker's own required tooling produces as a side effect** —
the prohibition, as a prompt sentence, was never satisfiable in the first place. (Separately:
`rebuild` and `build.mjs` appeared in **zero** files under `skills/` or `agents/` before this
task — the rule had no durable home to begin with, only whatever prose a conductor
improvised per dispatch.)

**Why this is a correctness problem, not tidiness.** The bundle is not a pure function of
one worker's diff:

- esbuild **tree-shakes unused exports**. `probeBridge` was absent from one worker's bundle
  because nothing consumed it yet — a sibling task landed the consumer later. A worker's
  bundle and a post-merge bundle legitimately differ, invisibly, without knowledge of the
  whole merged tree.
- Under ADR-0032's per-worker worktrees, two workers who both rebuild produce two divergent
  minified bundles from two different bases. A textual 3-way merge of those yields an
  artifact **built from a source tree that never existed** — plausible-looking, silently
  missing a shipped fix, and invisible to the test suite (which imports `app/`, never
  `dist/`). One session hit exactly this and had to discard both sides and rebuild from
  merged source.
- The minified bundle is also not diff-stable across rebuilds of *changed* source (esbuild's
  identifier mangling shifts even on pure renames) — but rebuilding *unchanged* source
  reproduces the committed bundle byte-for-byte. This is background, not the mechanism this
  ADR relies on: the guard below never compares bundles, so bundle instability is sidestepped
  entirely.

**ADR-0032 licensed the very behaviour being guarded against.** Its `### Windows &
node_modules` section justified the shared `node_modules` junction by saying esbuild "reads
deps and writes each worktree's own tracked `dashboard/dist/`, so there is no concurrent
writer to the shared dir" — describing a worker writing its worktree's `dist/` as expected.
This ADR amends that passage (see Consequences).

## Decision

### The enforcement point: filter the conductor's checkpoint `git add`

A rebuilt `dashboard/dist/` has exactly **one** channel by which it can escape a worktree and
reach `main`: the conductor's enumerated stage at the wip-checkpoint (`skills/work/SKILL.md`,
before diff capture), which previously staged the worker's self-reported `FILE_LIST`
verbatim, on trust, unfiltered. If the derived artifact is never *staged*, it never reaches
the squash-merge, and the rebuild — however unavoidable — is rendered **inert**. The guard
replaces judgment with transcription at the one seam that already exists, the same move
ADR-0038 made for the lifecycle verbs.

**This finding strengthens the mechanism decisively, not incidentally.** If the rebuild
cannot be prevented by any amount of prompt discipline, then the *only* workable enforcement
is exactly this: make the artifact structurally unable to escape the worktree, rather than
merely forbidden to produce.

### Structural separation of the two writers, with no actor check

The conductor's own sanctioned rebuild-from-merged-source happens on `main`, at integration,
and never routes through `checkpoint` — `checkpoint` only ever runs against a worktree. The
sanctioned writer is not *exempted* by any "is this the conductor?" identity test; it is out
of the guard's reach **by construction**, because the two writers travel different code
paths. No actor/identity test exists anywhere in this guard.

### Implementation

- **`lib/derived-artifact-guard.mjs`** — pure, stdlib-only (`node:path`), git-free,
  side-effect-free, the `lib/agent-spawn-namespace.mjs` (ADR-0052) purity doctrine, but a
  *filter over declared data*, not a tree walk. Exports:
  - `DERIVED_ARTIFACT_PREFIXES` — frozen, `['dashboard/dist/']` today. The trailing `/` makes
    every match a segment-boundary match (`dashboard/dist-notes.md` is never caught;
    `dashboard/dist/fonts/x.woff2` is).
  - `partitionCheckpointFiles(worktreeRoot, fileList) → { changed, refused }` — operates on
    the caller-supplied `fileList` only, never the working tree, so it neither runs nor needs
    `git status`/`git diff` and is structurally immune to the known `autocrlf`
    phantom-modification of `dashboard/dist/app.js`. Each `refused` entry carries
    `{ path, reason: 'derived-artifact' | 'outside-worktree' }`.
  - Built and tested against **absolute, OS-native-separator paths**
    (`references/worker-return-format.md` line 17 — the real `FILE_LIST` shape), not
    POSIX-relative literals — a guard tested only against `'dashboard/dist/app.js'` would
    pass its own test while being inert against every real input.
- **`lib/task-lifecycle-cli.mjs`** — a new `checkpoint` verb: `(rootDir, id, opts) →
  { ok, changed, refused, refusalReason, message, verb: 'checkpoint' }`, sharing the
  claim/complete manifest convention. `refusalReason` names ADR-0003 and the tree-shaking /
  never-existed-source-tree hazard whenever `refused` is non-empty, so an agent that trips it
  learns *why*, not just *that*. `checkpoint` moves no task and edits no INDEX — an argued
  departure from the other three verbs' shape, kept on this CLI anyway because it is
  git-free and reuses the same bootstrap and manifest convention.
- **`skills/work/SKILL.md`** — the checkpoint step now invokes the `checkpoint` verb instead
  of hand-composing `git -C .worktrees/<id> add <FILE_LIST + ...>`; stages `changed`
  verbatim; a non-empty `refused` drops those paths and **continues** (never fails the task
  or the batch — the worker's actual work is fine, only its derived artifact is dropped).
  The Subagent Prompt Template's Rules — CRITICAL block gets the rule's first durable home,
  stated as the mechanism: running the suite rebuilds `dashboard/dist/` in the worktree, that
  is expected and fine, and it will be dropped at checkpoint and never merged.

## Consequences

**Positive:** the "no rebuild reaches `main`" invariant no longer depends on any agent's
prompt-reading discipline — it holds even when a worker never saw the rule at all, because
the mechanism producing the artifact (the test suite) is orthogonal to the mechanism
preventing its escape (the checkpoint filter). ADR-0032's `### Windows & node_modules`
section is amended: it no longer describes a worker writing its worktree's `dashboard/dist/`
as expected/licensed behaviour, while its actual point (the shared `node_modules` junction is
safe because esbuild only *reads* it) is preserved and sharpened.

**Negative:** the guard is a maintained allowlist-adjacent list (`DERIVED_ARTIFACT_PREFIXES`)
that must be extended if a future derived artifact needs the same protection; it will not
catch a derived artifact nobody thought to add.

**Neutral:** `checkpoint` does not replace or touch `promoteTask` / `claimBatch` /
`completeTask` — it is a fourth, structurally different verb (no task move, no INDEX edit)
sharing only the CLI's argv/manifest conventions.

## Alternatives considered

- **(a) A suite test asserting `dist/` matches a fresh build of current source — REJECTED,
  and actively harmful, not merely weak.** The verifier runs the suite from the worker's
  worktree. That assertion is true exactly when the worker committed the violation (they
  rebuilt, so `dist/` matches) and false whenever a worker correctly left `dist/` untouched
  while changing source that feeds it — the test would coerce every dashboard-touching worker
  into rebuilding to go green, enforcing the precise opposite of the contract. It is **worse**
  than merely inverted, given the finding above: `dist-build.test.mjs`'s own `before()` hook
  rebuilds `dist/` **immediately before** such an assertion would read it, so the assertion
  could never fail — it would be the third test this project shipped in two days that is
  structurally incapable of failing on its own named criterion. Rejected outright.
- **(c) A git-level guard (hook / merge driver / `.gitattributes`) — REJECTED, wrong actor and
  already-settled ground.** Workers never run git (ADR-0032, ADR-0026: the conductor owns all
  git). A pre-commit hook would fire on the conductor — guarding the one actor that isn't
  violating anything — and never on the source of the artifact. This repo also has no CI, no
  `core.hooksPath`, no installed hooks, and no `.gitattributes` (verified), and ADR-0013
  already decided against CI/git-hooks for this repo deliberately; re-litigating that here
  would smuggle a large decision in as a lint.
- **A worktree-escape hypothesis (workers running `build.mjs` from the main tree, escaping
  their assigned worktree) — investigated and ruled out, not fixed.** The task's own capture
  speculated that rebuilds were "caught by the conductor noticing a dirty `dist/` in `git
  status`," which would be impossible for a worktree-scoped rebuild under ADR-0032 unless the
  conductor inspected worktrees directly or a worker escaped its assigned tree. Direct
  observation in the session immediately preceding this one showed a worker's rebuilt
  `dashboard/dist/` appearing in **its own worktree's** `git status`, with `main` staying
  clean — the rebuild is in-worktree and test-induced, exactly as this ADR's Context section
  describes. No worktree-escape defect exists; no sibling task was filed for it.

## References

- ADR-0003 — `dashboard/`'s single-source doctrine; the root of why `dist/` is derived.
- ADR-0013 — plugin release discipline; the deliberate no-CI/no-git-hooks decision alternative
  (c) would have re-litigated against the wrong actor.
- ADR-0026 — committing doctrine; the scoped-`git add` rule the checkpoint step still honors.
- ADR-0032 — worker worktree isolation; amended by this ADR (`### Windows & node_modules`).
- ADR-0038 — lifecycle mechanization boundary; the script/skill split `checkpoint` joins.
- ADR-0052 — `lib/agent-spawn-namespace.mjs`'s purity doctrine, the module shape this guard
  follows (not its live-tree scanning shape).
- ADR-0055 — `applyTaskMove`'s write-then-unlink discipline; part of the same lifecycle-CLI
  lineage `checkpoint` joins.
- `agentic-workflow-q7v3k` — this task.
