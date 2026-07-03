---
id: agentic-workflow-t4x8p
title: Fix CRLF-sensitive byte-identical guard regexes in intent-route rail-routing tests
status: backlog
type: bug
context: agentic-workflow
created: 2026-07-03
completed:
depends_on: []
blocks: []
tags: [tests, windows, crlf]
related_adrs: []
related_research: []
prior_art: []
---

## Why

Discovered during `agentic-workflow-h9v3m`'s full-suite run (Windows worktree checkout):
`test/about-rail-routing.test.mjs` and `test/workflow-rail-routing.test.mjs` each carry
one `isTaskIntent must remain byte-identical (ADR-0021 / ADR-0025 decision 2)` assertion
that matches `app/intent-route.js`'s source text against a regex using bare `\n` line
breaks. On a Windows checkout `intent-route.js` is read back with `\r\n` line endings
(the whole repo appears CRLF-checked-out on this platform — `git diff --stat -w` on
`dashboard/dist/app.js` showed no whitespace-only difference either, so this is not
new/introduced by any recent change), so the regex never matches and both tests fail
unconditionally on Windows. Confirmed pre-existing and unrelated to h9v3m's own change
set: `git stash` on the h9v3m worktree reproduced the identical two failures on the
untouched base commit.

## What

Make the two `isTaskIntent` byte-identical guards line-ending-agnostic — e.g. normalize
both the read source and the expected pattern's line breaks before comparing (`\r?\n`
in the regex, or strip `\r` from the read file before matching), so the assertion still
locks the function's exact body on any checkout line-ending convention. Grep the rest of
the dashboard test suite for the same `\n`-only pattern against `readFileSync`'d source
in case other byte-identical/static-guard tests share the same latent Windows fragility.

## Acceptance criteria
- [ ] Both `isTaskIntent` byte-identical guard tests pass on a Windows (CRLF) checkout.
- [ ] They still correctly FAIL if `isTaskIntent`'s actual body changes (the guard's
      purpose — locking ADR-0021/0025 decision 2 — must not be weakened).
- [ ] Any other `node --test` file found to share the same `\n`-only-vs-`readFileSync`
      fragility is fixed the same way.
- [ ] Full dashboard suite passes on a Windows checkout with no CRLF-related failures.

## Notes
Not fixed inside `agentic-workflow-h9v3m` — out of that task's scope (it never touches
`intent-route.js` or its routing tests); captured here instead per the worker's
"discovered a follow-up bug, drop it in backlog" instruction.
