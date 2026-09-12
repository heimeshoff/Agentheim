---
id: agentic-workflow-vsb06
title: The `migrate` verb reports the legacy `.agentheim/contexts/` references it does not rewrite — project files outside `.agentheim/` such as `CLAUDE.md` and `.claude/commands/` — as a read-only manifest field the step-0 notice names, so a consumer learns what still points at the old layout instead of finding out when a command breaks
status: todo
type: feature
context: agentic-workflow
created: 2026-09-12
completed:
depends_on: []
blocks: []
tags: [layout, migration, upgrade, lifecycle, consumer-experience]
related_adrs: [0078, 0038, 0075]
related_research: []
prior_art: [agentic-workflow-e896r, agentic-workflow-zgav8, agentic-workflow-hxq1g, agentic-workflow-tgr31]
---

## Why

`migrate` (agentic-workflow-e896r, ADR-0078 §4) moves the tree and rewrites exactly two
stale-pointer surfaces: the per-BC INDEX split and the BC READMEs. Everything else that
names the old shape is left alone by design — done-task bodies and protocol entries are
history, and files outside `.agentheim/` are the consumer's own.

Roman's project ("Souls") shows the gap: his session counted 104 references to
`.agentheim/contexts/...`, five of them outside `.agentheim/` — `CLAUDE.md`,
`specs/README.md`, and three files under `.claude/commands/`. After migration those three
project-local commands will read a path that no longer exists, and nothing tells him. The
99 inside `.agentheim/` are mostly historical prose and fine to leave.

Rewriting the consumer's files is wrong (`migrate` is scoped to `.agentheim/`, ADR-0078;
a project-local command is not ours to edit). Telling them is cheap and right.

## What

1. `migrateLayout` gains a read-only post-move scan: walk the project root, skipping
   `.git/`, `node_modules/`, `.worktrees/`, and the whole `.agentheim/` tree (the part the
   verb owns; its interior history is deliberately not reported), and count occurrences
   of the literal `.agentheim/contexts/` in text files. Text-ness by a small extension
   allowlist (`.md .txt .json .yaml .yml .toml .js .mjs .cjs .ts .sh .ps1`) plus any
   extension-less file that sniffs as UTF-8 without NUL bytes; anything else is skipped.
2. The manifest gains `residualReferences: [{file, count}]` (project-relative forward-slash
   paths, sorted). **When the scan runs:** automatically on the moved (`legacy` → `board`)
   manifest only. A plain `noop` run stays exactly as cheap as today — `detectLayout`
   and nothing else, no scan, no field — because `migrate` is step 0 of every writing
   skill and a silent noop has no reader for the result. A new opt
   `migrate '{"scanResiduals":true}'` runs the same scan on a `noop` (`board`) tree and
   returns the field there too, so a builder who migrated before this shipped — or who
   wants to re-check after fixing files — can ask on demand. The opt is ignored on the
   moved path (it always scans) and on refusals (`mixed-layout` etc. return unchanged).
3. `references/lib-bootstrap.md` §7's "moved" outcome line grows one sentence: when
   `residualReferences` is non-empty, the skill's one-line notice appends *"N file(s)
   outside `.agentheim/` still name the old layout: a, b, c"* (first three, then "…and K
   more"). The `noop` outcome stays silent — no nagging on every skill run — and §7
   documents the `scanResiduals` opt as the on-demand re-check.
4. The scan is bounded: stop after 5000 files or 2 seconds and mark the field
   `residualReferencesTruncated: true`, so a huge monorepo never makes the migrating run
   slow. The walk is loss-tolerant (an unreadable file/dir is skipped, never thrown) and
   runs after the locked write phase has finished, outside `withLifecycleLock` — it is
   read-only and must not extend the lock hold.

## Acceptance criteria

- [ ] A fixture tree with a legacy `.agentheim/`, a `CLAUDE.md` naming
      `.agentheim/contexts/foo/todo/`, a `.claude/commands/x.md` naming it twice, a binary
      file containing the bytes, and a `node_modules/` copy migrates to `board` and returns
      `residualReferences` of exactly the two text files with counts 1 and 2.
- [ ] A plain `migrate` on the migrated fixture returns exactly
      `{ok:true, verb:'migrate', noop:true, changed:[]}` — no `residualReferences` key —
      and the scan function is not invoked (asserted via an injected/spied walker, not
      timing).
- [ ] `migrate '{"scanResiduals":true}'` on the migrated fixture returns the noop manifest
      plus the same `residualReferences` as the migrating run; on a `mixed` fixture it
      still returns the unchanged `mixed-layout` refusal.
- [ ] The scan runs outside the lifecycle lock (the lock file is released before the walk
      starts — assert via an injected walker that checks the lock is not held).
- [ ] Occurrences inside `.agentheim/` (a done task body, a protocol entry) are not
      reported.
- [ ] The truncation guard triggers on a synthetic tree above the file cap and sets
      `residualReferencesTruncated: true` without throwing.
- [ ] `references/lib-bootstrap.md` §7 names the field, the notice wording, and the
      `scanResiduals` opt;
      `lib/legacy-path-literal-lint.mjs` still passes on the live tree (the literal this scan
      matches must live in an allowlisted line, as the lint's own header does).
- [ ] `node --test lib/test/*.test.mjs` green.

## Notes

- Triggered by Roman's 0.9.3 incident (infrastructure-hnv3d holds the release-side half).
- Reporting, never rewriting: the verb's write scope stays `.agentheim/` (ADR-0078,
  ADR-0038 mover boundary). If the builder later wants an opt-in rewrite of their own
  files, that is a separate task with its own confirmation gesture.
- The literal matched is the full `.agentheim/contexts/` prefix, not bare `contexts/`, to
  keep false positives near zero.
- Refinement 2026-09-12 (builder decision): the noop does not scan by default. Scanning on
  every step 0 would add up to 2s latency to every writing skill for a result the silent
  noop never shows. Moved-only plus the opt-in `scanResiduals` gives the one-time notice at
  the moment it matters and an on-demand re-check, without a per-invocation cost.
- `migrate`'s CLI arity is already `'opts'` (`lib/task-lifecycle-cli.mjs`), so the new
  opt needs no CLI plumbing change beyond `migrateLayout` reading it.
- The new `.agentheim/contexts/` literal in `lib/layout-migration.mjs` needs its own
  `{file, match, rationale}` entry in `lib/legacy-path-literal-lint.mjs`'s ALLOWLIST
  (`lib/layout-migration.mjs` already has four entries there).
- Pre-existing reds, not regressions: `index-entry-length.test.mjs` fails on main (qwfq3's
  62-word INDEX entry), and two `bridge.test.mjs` fixed-port tests EADDRINUSE while a live
  bridge runs — the "suite green" criterion means no new failures beyond those.
- Not a convention-establishing task (ADR-0059 check n/a); no `[human-eye]` criteria.
