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
related_adrs: [0021, 0025]
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

Make the two `isTaskIntent` byte-identical guards line-ending-agnostic — normalize
both the read source and the expected pattern's line breaks before comparing (`\r?\n`
in the regex, or strip `\r` from the read file before matching), so the assertion still
locks the function's exact body on any checkout line-ending convention.

**Scope is confirmed to exactly two lines, in two files** (resolved during refinement — see
Notes; the "grep the rest of the suite" hunt is done and came back empty, so no third file
is in play):

- `test/about-rail-routing.test.mjs:187`
- `test/workflow-rail-routing.test.mjs:161`

Both carry the *identical* regex literal
`/export function isTaskIntent\(intent\) \{\n  return Boolean\(intent && intent\.status\);\n\}/`.
The fragility is specifically a **literal character immediately followed by a bare `\n`
in a `/…/` regex literal** (`\{\n` and `;\n` here) matched against `readFileSync`'d source:
on a CRLF checkout the source's `\r` wedges between the literal char and the `\n`, so the
match never fires. This is a narrower signature than "any `\n` in a test regex" — patterns
using a `[\s\S]`-class or dynamic ``new RegExp(`…\\n…`)`` absorb the `\r` and are **not**
fragile, which is why only these two lines are affected.

## Acceptance criteria
- [ ] Both `isTaskIntent` byte-identical guard tests pass on a Windows (CRLF) checkout
      (`test/about-rail-routing.test.mjs`, `test/workflow-rail-routing.test.mjs`).
- [ ] They still correctly FAIL if `isTaskIntent`'s actual body changes (the guard's
      purpose — locking ADR-0021/0025 decision 2 — must not be weakened; keep matching the
      exact body, only line breaks become `\r?\n`).
- [ ] Full dashboard suite passes on a Windows checkout with no CRLF-related failures
      (confirms no third file shares the fragility — refinement verified none does, this AC
      is the regression backstop).

## Notes
Not fixed inside `agentic-workflow-h9v3m` — out of that task's scope (it never touches
`intent-route.js` or its routing tests); captured here instead per the worker's
"discovered a follow-up bug, drop it in backlog" instruction.

**Refinement 2026-07-03 (scope resolution).** Swept the whole `dashboard/test/` suite for
the literal-char-then-`\n` regex-literal signature (`\{\n` / `;\n` / `\)\n` / `\]\n` before a
bare `\n`, excluding `[\s\S]`-class and `new RegExp` template forms that absorb `\r`). It
matches **exactly** the two lines above and nowhere else; the only other `byte-identical`
mentions in the suite are prose comments or non-source-regex assertions, not CRLF-fragile
guards. So this is a closed, two-line fix — the worker does not need to re-run the hunt, only
to preserve the guard's body-locking intent (AC #2). The two `related_adrs` (ADR-0021 /
ADR-0025) are the decisions the guard exists to protect — decision 2's `isTaskIntent`
discriminator must stay byte-identical after the fix.
