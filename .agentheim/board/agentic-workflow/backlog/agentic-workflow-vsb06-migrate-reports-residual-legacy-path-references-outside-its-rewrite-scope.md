---
id: agentic-workflow-vsb06
title: The `migrate` verb reports the legacy `.agentheim/contexts/` references it does not rewrite — project files outside `.agentheim/` such as `CLAUDE.md` and `.claude/commands/` — as a read-only manifest field the step-0 notice names, so a consumer learns what still points at the old layout instead of finding out when a command breaks
status: backlog
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
   paths, sorted), present on the moved manifest and on the `noop` manifest alike (a
   second run on an already-migrated tree still tells you what is stale).
3. `references/lib-bootstrap.md` §7's "moved" outcome line grows one sentence: when
   `residualReferences` is non-empty, the skill's one-line notice appends *"N file(s)
   outside `.agentheim/` still name the old layout: a, b, c"* (first three, then "…and K
   more"). The `noop` outcome stays silent — no nagging on every skill run.
4. The scan is bounded: stop after 5000 files or 2 seconds and mark the field
   `residualReferencesTruncated: true`, so a huge monorepo never makes step 0 slow.

## Acceptance criteria

- [ ] A fixture tree with a legacy `.agentheim/`, a `CLAUDE.md` naming
      `.agentheim/contexts/foo/todo/`, a `.claude/commands/x.md` naming it twice, a binary
      file containing the bytes, and a `node_modules/` copy migrates to `board` and returns
      `residualReferences` of exactly the two text files with counts 1 and 2.
- [ ] A `noop` run on the migrated fixture returns the same `residualReferences`.
- [ ] Occurrences inside `.agentheim/` (a done task body, a protocol entry) are not
      reported.
- [ ] The truncation guard triggers on a synthetic tree above the file cap and sets
      `residualReferencesTruncated: true` without throwing.
- [ ] `references/lib-bootstrap.md` §7 names the field and the notice wording;
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
