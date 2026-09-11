---
id: agentic-workflow-kp7dq
title: checkpoint's moved-from detection is Windows-separator-sensitive — a forward-slash fileList silently misses the doing/ deletion, reintroducing the both-folders bug w2njd closed
status: done
type: bug
context: agentic-workflow
created: 2026-07-22
completed: 2026-07-22
depends_on: []
blocks: []
tags: [checkpoint, worktree, task-lifecycle, staging, windows, path-separator]
related_adrs: [0057, 0032, 0038]
related_research: []
prior_art: [agentic-workflow-w2njd]
---

## Why

`agentic-workflow-w2njd` made the `checkpoint` verb stage the deletion half of a
task-file move by folding the vacated `doing/` path into the manifest's `changed`
(so a wip commit's tree never holds the task file in two lifecycle folders — ADR-0057).
The detection helper `findMovedFromDoingPath` in `lib/task-lifecycle-cli.mjs` matches a
fileList entry against its lifecycle folder with:

```js
filePath.startsWith(path.join(rootDir, '.agentheim','contexts',context,folder) + path.sep)
```

`path.join` / `path.sep` yield **native** separators — backslashes on Windows. So a caller
that passes **forward-slash** absolute paths in its `fileList` on Windows fails the
`startsWith` match: detection silently misses, the `doing/` path is omitted from `changed`,
and the moved-from deletion is never staged — reintroducing exactly the "wip tree holds the
task file in both lifecycle folders" bug w2njd closed.

Observed live during the 2026-07-22 work session: the conductor passed forward-slash paths
(to dodge JSON backslash-escaping in the shell) and had to stage the `doing/` deletion by
hand for every task. The doctrine's checkpoint invocation is *meant* to pass the worker's
native-separator FILE_LIST, where the match holds (w2njd's own tests confirm) — so the w2njd
fix is **correct as specified**. This is a robustness hardening against a legitimate
caller-side path shape, not a regression in w2njd.

## What

Make `findMovedFromDoingPath`'s folder-membership comparison **separator-insensitive**, so
detection fires whether the caller's `fileList` entries use `/` or `\` on Windows. Normalize
both sides before comparing (e.g. `path.normalize` / `path.resolve` on the fileList entry and
the derived folder prefix, or compare via `path.relative(folderDir, filePath)` not starting
with `..` and not absolute) — worker's choice, recorded in a short comment. The `!existsSync`
guard on the derived `doing/` counterpart is unaffected and stays.

Keep the change confined to `lib/task-lifecycle-cli.mjs` (and its test). No doctrine prose
change is required — the checkpoint invocation contract is unchanged; this only makes the
helper tolerant of a path shape it should always have accepted.

## Acceptance criteria

- [x] `findMovedFromDoingPath` detects the vacated `doing/` path for a moved task file whose
      fileList entry is given with **forward slashes** on a `path.sep === '\\'` platform (and
      still for native-separator paths) — the manifest's `changed` names both the new and the
      moved-from path in both cases.
- [x] A `node --test` case in `lib/test/task-lifecycle-cli.test.mjs` (or sibling) exercises
      the cross-separator input and would FAIL against the current native-only `startsWith`.
      Prefer driving the live `runCli(['checkpoint', ...])` entrypoint, as w2njd's tests do,
      rather than the helper in isolation.
- [x] The existing w2njd checkpoint tests stay green; the full suite
      (`node --test lib/test/*.test.mjs`) is green.

## Outcome

Fixed `findMovedFromDoingPath` in `lib/task-lifecycle-cli.mjs`: both sides of the
folder-membership `startsWith` comparison are now run through `path.normalize` before
comparing, so a `fileList` entry given with forward slashes on a backslash-native (Windows)
platform still matches its lifecycle folder prefix and the vacated `doing/` counterpart is
still detected and folded into `changed` (ADR-0057 / w2njd). The `!existsSync` guard is
unchanged. Verified TDD: added
`runCli checkpoint: detects the vacated doing/ path even when fileList uses forward slashes on
a backslash-native platform (agentic-workflow-kp7dq)` in `lib/test/task-lifecycle-cli.test.mjs`,
confirmed it failed against the pre-fix native-only `startsWith`, then confirmed it (and the
full 375-test suite via `node --test lib/test/*.test.mjs`) passes after the fix. Key files:
`lib/task-lifecycle-cli.mjs`, `lib/test/task-lifecycle-cli.test.mjs`.

## Notes

Root observed in the 2026-07-22 audit-followup work session (see the session-end protocol
entry). Enforcement ships **in-task** via the `node --test` case (ADR-0059 satisfied) — this
is a correctness fix on a doctrine-bearing `lib/` surface, not a new convention, so no
convention marker is required beyond the shipped regression test. Prior art
[[agentic-workflow-w2njd]] carries the original moved-from-staging fix this hardens; mind
CRLF on any `.agentheim` fixture the test touches (known lifecycle-script hazard).
