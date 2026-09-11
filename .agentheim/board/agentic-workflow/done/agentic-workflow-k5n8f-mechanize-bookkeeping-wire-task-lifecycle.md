---
id: agentic-workflow-k5n8f
title: Mechanize the bookkeeping (MVP) — generalized plugin-file resolver + git-free PROMOTE lifecycle script
status: done
type: refactor
context: agentic-workflow
created: 2026-07-02
completed: 2026-07-03
depends_on: [agentic-workflow-p3v9k]
blocks: [agentic-workflow-c8j3w, agentic-workflow-r2c7m, agentic-workflow-t7m4c]
tags: [harness-audit, bookkeeping, task-lifecycle, scripts, index, protocol]
related_adrs: ["0007", "0026", "0032", "0038"]
related_research: []
prior_art: [agentic-workflow-003, agentic-workflow-078, agentic-workflow-080, agentic-workflow-063]
---

## Why

Two findings compound (harness audit 2026-07-02, confirmed defect #2 + the single
highest-leverage recommendation):

1. **`lib/task-lifecycle.mjs` is wired to nothing.** Its header says it's "owned by
   and used by the skills" — but no skill references it (grep-confirmed 2026-07-03:
   only `modeling/SKILL.md` even names `applyTaskMove`, in prose). The invariants it
   encodes and tests (legal-move policy, status-rewrite-plus-rename atomicity, mtime
   precondition, `depends_on` promote gate) live in dead code, while live enforcement
   is prompt prose re-stated across four skills — and they disagree (the
   missing-`depends_on` divergence, now ruled fail-closed by [[agentic-workflow-p3v9k]]).
2. **The main `work`/`modeling` context is a bookkeeping clerk.** Hand-edited INDEX
   marker lists and counts, line-4 protocol prepends, bidirectional ADR↔task backlink
   reconciliation, enumerated `git add` lists — roughly half of `work/SKILL.md` and a
   third of `modeling/SKILL.md` is mechanical text surgery. It burns orchestrator
   context and is the harness's largest error surface; `scripts/backfill-indexes.ps1`
   proves the indexes are regenerable, yet five skills maintain them by hand.

## What

This is the **pattern-MVP cut** (refined 2026-07-03). It proves the entire mechanized
pattern end-to-end on the **PROMOTE** path only — the clean single-tree, single-git-owner
operation with **zero ADR-0032 coupling** — and lands the shared infrastructure the
whole script family reuses. CLAIM + COMPLETE (entangled with the worktree /
squash-merge model, and colliding with the in-flight [[agentic-workflow-f6m2q]]) are
descoped to sibling [[agentic-workflow-t7m4c]]; CAPTURE / DISMISS / rotate follow the
same single-tree pattern as PROMOTE.

Deliver, against the [[agentic-workflow-p3v9k]] boundary decision:

- **`lib/resolve-plugin-file.mjs`** (new, stdlib-only) — generalize
  `dashboard/resolve-launcher.mjs`'s field-proven env-free resolver: derive
  `<homedir>/.claude/plugins/cache/agentheim/agentheim`, pick newest version by
  semver-max, resolve an arbitrary in-plugin `relPath`, fail loud, with the repo-local
  short-circuit via `import.meta.url`. Port `resolve-launcher.mjs` to delegate to it
  (behavior-preserving; its 14 tests stay green). Load-bearing because
  `$CLAUDE_PLUGIN_ROOT` comes through **empty** in an installed consumer project
  (infrastructure-010) — a bare `node scripts/…` is inert there.
- **`lib/task-lifecycle.mjs`** — wire the dead lib: add a `promoteTask(rootDir, id, opts)`
  handler that calls `applyTaskMove(rootDir, id, 'backlog', 'todo', {policy:'skill'})`,
  then does the deterministic INDEX marker edits (+ count deltas), the line-4 protocol
  prepend, and any backlink reconciliation — returning an **enumerated manifest**
  `{ changed: [paths], message, verb, id }`. **Git-free** (per p3v9k Ruling B).
- **`lib/task-lifecycle-cli.mjs`** (new) — thin argv/flag parse → `discoverRoot(cwd)` →
  handler → print manifest → exit code, with an `isMain` guard. Invoked from skill prose
  via the same minimal env-free `node -e` bootstrap infrastructure-010 settled
  (homedir→cache→semver-max→`import()`), running **in-process** (no spawn — short sync op),
  cwd = consumer project so `discoverRoot(process.cwd())` finds the foreign `.agentheim/`.
- **`modeling/SKILL.md` PROMOTE flow** — delegate the mechanical steps to the script; the
  skill keeps only the *judgment* (readiness gate) and *git* (scoped `git add` of the
  manifest's `changed` + commit). The replaced prose is **deleted**, not duplicated —
  the human-readable contract stays as a short pointer.

## Acceptance criteria

- [ ] Gated on [[agentic-workflow-p3v9k]] being accepted: the missing-`depends_on`-target semantics is fail-closed in both `dependencySatisfied()` (already) and the `work/SKILL.md:25` prose (rewritten from "satisfied-with-warning").
- [ ] `lib/resolve-plugin-file.mjs` resolves an arbitrary in-plugin file env-independently (homedir-derived cache, semver-max, fail-loud, repo-local short-circuit); `dashboard/resolve-launcher.mjs` delegates to it with its existing tests green.
- [ ] `lib/task-lifecycle.mjs` is invoked live on the PROMOTE path — `promoteTask` calls `applyTaskMove` and the lib is no longer dead code.
- [ ] The PROMOTE handler performs the INDEX marker edits + count deltas, the protocol line-4 prepend, and backlink reconciliation deterministically, and returns an enumerated manifest — **it runs no `git` command** (caller commits the manifest's paths).
- [ ] `modeling/SKILL.md`'s PROMOTE flow delegates those steps to the script; the removed prompt-prose is gone, not duplicated; readiness-judgment and the scoped commit stay with the skill.
- [ ] Covered by `node --test` (extend the existing lib tests): the resolver's pure parts, `promoteTask`'s manifest + fail-closed gate, and the CLI's argv/exit behavior.

## Notes

- **Git-free by design (p3v9k Ruling B).** The script never runs `git` — it emits the
  scoped pathspec, the caller (here: the `modeling` skill) runs `git add <changed> &&
  git commit`. This keeps a single git owner per flow under the shared index (memory:
  concurrent sessions share one git index) and lets CLAIM/COMPLETE later fold their
  manifest into `work`'s ADR-0032 squash-merge.
- **Cross-shell bootstrap caveat (infrastructure-010).** The `node -e` form was only ever
  confirmed under the `Bash(node:*)` tool context; PowerShell / installed-plugin behavior
  is a post-release maintainer confirmation, not verifiable in-repo. Do not mark
  end-to-end verified on simulation alone.
- **Follow-on flagged by the architect:** `discoverRoot` becomes shared by dashboard +
  lifecycle — small follow-on to promote it from `dashboard/discovery.mjs` to `lib/`
  (avoids a `lib → dashboard` import direction). Not blocking this task.
- Descoped from the original broad capture on 2026-07-03: CLAIM + COMPLETE →
  [[agentic-workflow-t7m4c]] (`depends_on` f6m2q, built against the final worktree
  choreography); rotate stays [[agentic-workflow-c8j3w]]. The audit's "four findings at
  once" argument still holds across the family; this task lands the reusable spine.

## Outcome

Landed the ADR-0038 pattern-MVP end-to-end on the PROMOTE path.

- **`lib/resolve-plugin-file.mjs`** (new) — generalizes `dashboard/resolve-launcher.mjs`'s
  env-free resolver to an arbitrary in-plugin `relPath`: `resolvePluginFile(root, relPath,
  label)` walks version dirs newest-first by semver; `locatePluginFile(relPath, opts)` adds
  the repo-local short-circuit (default: derived from this module's own `import.meta.url` one
  level under the repo root; `opts.repoLocalPath`/`repoRoot`/`moduleDir` let a caller with its
  own neighbor, like the launcher, override it). `dashboard/resolve-launcher.mjs` now delegates
  `cacheRoot`/`pickNewestVersion`/`resolveLauncher`/`locateLauncher` to it — byte-identical
  fail-loud message ("no cached launcher found…") preserved via a `label` param — and its
  original 14 tests stay green untouched, plus the full 710-test dashboard suite passes.
- **`lib/task-lifecycle.mjs`**: added `promoteTask(rootDir, id, opts)` — calls `applyTaskMove`
  (unchanged, ADR-0007), then performs the INDEX.md marker edit + count delta and the
  protocol.md prepend (git-free; never runs `git`); backlink reconciliation is an explicit
  no-op for PROMOTE (a folder move invalidates no other task's/ADR's backlinks) kept for shape
  parity with the sibling CLAIM/COMPLETE scripts. Returns `{ok:true, changed, message, verb:
  'promote', id}` on success or `applyTaskMove`'s own rejection verbatim (nothing written) on
  a fail-closed `depends_on`/illegal-move/stale-precondition reject.
- **`lib/task-lifecycle-cli.mjs`** (new) — `runCli(argv, opts)` (verb/id parse →
  `discoverRoot` → handler → `{exitCode, output}`, injectable for tests) and an exported
  `main(argv)` for the `node -e` bootstrap (mirrors `resolve-launcher.mjs`'s `run()`) plus an
  `isMain` guard for direct `node lib/task-lifecycle-cli.mjs promote <id>` use. `discoverRoot`
  is reused from `dashboard/discovery.mjs` as-is (the architect's flagged `lib`→`dashboard`
  follow-on, not done here).
- **`skills/modeling/SKILL.md`**: PROMOTE flow rewritten — steps 1/2/4 (judgment) and step 5
  (git) kept; step 3 now runs the CLI via the same env-free `node -e` bootstrap pattern as
  `/dashboard`. Removed the hand-edit PROMOTE row from "Updating indexes" and the "Modeling /
  Promoted" protocol-entry template (replaced with pointers — the CLI now generates both).
- **`skills/work/SKILL.md`** (AC#1): Phase 2 step 5's "treat missing as satisfied, but warn"
  rewritten to fail-closed, matching `dependencySatisfied()` and ADR-0038 Ruling A.
- **BC README**: added `promoteTask`/CLI and `lib/resolve-plugin-file.mjs` entries under
  Domain logic.
- **Tests** (`node --test`, TDD red→green throughout): `lib/test/resolve-plugin-file.test.mjs`
  (new, 12), `lib/test/task-lifecycle.test.mjs` (+4 `promoteTask` tests, extending the existing
  22 → 26), `lib/test/task-lifecycle-cli.test.mjs` (new, 7, incl. one real `execFileSync`
  spawn proving the `isMain` guard + argv wiring). Full `lib/test/` suite: 65/65 green. Full
  `dashboard` suite: 710/710 green (unchanged, proving the resolver port is behavior-preserving).
  Manually booted `node dashboard/launch.mjs` and confirmed `/healthz` + `/api/tree` respond,
  then `stop` — the runtime-surface check the recent-activity note flagged.
- **Verification-realism caveat carried forward (infrastructure-010)**: the `node -e`
  bootstrap syntax pasted into `modeling/SKILL.md`'s PROMOTE flow (and the CLI it targets) is
  simulated/unit-tested here (real `node lib/task-lifecycle-cli.mjs promote <id>` spawn,
  real `discoverRoot`, real files) but never actually run through the literal cross-shell
  `node -e "…"` invocation form as a skill would type it — that confirmation is a post-release
  maintainer step, same caveat infrastructure-010 recorded for `/dashboard`.
- **Not done here (explicitly out of scope)**: CLAIM/COMPLETE lifecycle scripts
  ([[agentic-workflow-t7m4c]]); promoting `discoverRoot` from `dashboard/discovery.mjs` to
  `lib/` (architect-flagged follow-on, not blocking).
