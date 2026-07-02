---
id: agentic-workflow-k5n8f
title: Mechanize the bookkeeping (MVP) — generalized plugin-file resolver + git-free PROMOTE lifecycle script
status: backlog
type: refactor
context: agentic-workflow
created: 2026-07-02
completed:
depends_on: [agentic-workflow-p3v9k]
blocks: [agentic-workflow-c8j3w, agentic-workflow-r2c7m, agentic-workflow-t7m4c]
tags: [harness-audit, bookkeeping, task-lifecycle, scripts, index, protocol]
related_adrs: ["0007", "0026", "0032"]
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
