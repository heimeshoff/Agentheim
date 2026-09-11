---
id: agentic-workflow-071
title: Confetti "no @keyframes" test trips on the unrelated About-page aboutRise keyframe
status: done
type: bug
context: agentic-workflow
created: 2026-06-17
completed: 2026-06-17
depends_on: []
blocks: []
tags: [dashboard, test, confetti, about, regression]
related_adrs: []
related_research: []
prior_art: [agentic-workflow-034, agentic-workflow-062]
---

## Why
The test `the celebration is rendered by canvas-confetti, not the old CSS keyframes (aw-034 swap)`
in `dashboard/test/board-prompt-bar.test.mjs:334` asserts the WHOLE `board.js` source contains
no `@keyframes` (it was meant to prove the old CSS-burst confetti implementation is gone, aw-034).
Since the About-page visual polish landed (aw-062), `board.js` now legitimately contains a
board-local `@keyframes aboutRise` (the About card entrance reveal, `board.js:1642`) that has
nothing to do with confetti. The blanket `doesNotMatch(boardSrc, /@keyframes/)` therefore fails on
an unrelated, intentional keyframe. This is a PRE-EXISTING failure (reproducible on HEAD,
independent of aw-070) — confirmed: `node --test` under `dashboard/` reports 551/552 with this one
assertion (`board-prompt-bar.test.mjs:342`) failing.

## What
Tighten the aw-034 confetti assertion so it proves the CONFETTI keyframe implementation is gone
without forbidding every keyframe in the file.

**Decided approach (confirmed during refinement):** the old CSS-burst confetti keyframe was named
`@keyframes agentheim-confetti-rise` (verified in the aw-034 swap commit `bb953cd`). So:

1. **Remove** the over-broad `assert.doesNotMatch(boardSrc, /@keyframes/, …)` line
   (`board-prompt-bar.test.mjs:342`).
2. **Replace it with a confetti-scoped keyframe assertion** —
   `assert.doesNotMatch(boardSrc, /@keyframes[^{]*confetti/i, 'no confetti-named @keyframes (the old agentheim-confetti-rise CSS burst removed)')`.
   This still trips if the old `agentheim-confetti-rise` keyframe is reintroduced, but permits the
   unrelated `aboutRise` keyframe. It also keeps the test name ("not the old CSS keyframes")
   literally honest by retaining a direct keyframe tripwire.
3. **Leave the two sibling assertions unchanged** — `doesNotMatch(boardSrc, /agentheim-confetti-piece/)`
   and `doesNotMatch(boardSrc, /ensureConfettiStyle/)`. Together with (2) these three identifiers
   fully characterize the aw-034 swap: reintroducing the old burst necessarily brings back the
   injector (`ensureConfettiStyle`), the piece spans (`agentheim-confetti-piece`), and/or a
   confetti-named keyframe.

Do not remove or alter the legitimate `aboutRise` keyframe — it is intended About-page behavior
(`board.js:1599`, `:1642`, `:1651`).

## Acceptance criteria
- [ ] The full dashboard suite (`node --test` under `dashboard/`) is green (552/552).
- [ ] The aw-034 confetti test still fails if the old CSS-burst confetti is reintroduced — verified
      for all three vectors: the `agentheim-confetti-rise` keyframe (or any confetti-named keyframe),
      the `agentheim-confetti-piece` DOM spans, and the `ensureConfettiStyle` injector.
- [ ] No `@keyframes` outside the confetti family is forbidden — the legitimate
      `@keyframes aboutRise` About-page reveal is untouched and passes.

## Notes
- Surfaced by agentic-workflow-070 (Ko-fi button solid colour). aw-070 left the failure in place
  because fixing it is out of that task's scope (net-new test behavior).
- Failing assertion: `dashboard/test/board-prompt-bar.test.mjs:342`.
- Legitimate keyframe: `dashboard/app/board.js:1642` (`aboutRise`, from the About-page polish, aw-062).
- Old confetti keyframe name (for the tripwire): `agentheim-confetti-rise` (aw-034 commit `bb953cd`).
- Test-only change — no UI/rendering touched, so the design-system styleguide gate does not apply
  (`depends_on` stays empty).

## Outcome
Tightened the aw-034 confetti regression assertion in `dashboard/test/board-prompt-bar.test.mjs:342`
from the over-broad `assert.doesNotMatch(boardSrc, /@keyframes/, …)` to a confetti-scoped tripwire
`assert.doesNotMatch(boardSrc, /@keyframes[^{]*confetti/i, …)`. This still trips if the old
`agentheim-confetti-rise` CSS burst (or any confetti-named keyframe) is reintroduced, while
permitting the unrelated, intentional `@keyframes aboutRise` About-page entrance reveal (aw-062).
The two sibling assertions (`agentheim-confetti-piece`, `ensureConfettiStyle`) are unchanged.
Dashboard suite is now 552/552 green. No production code touched; `board.js` untouched.

Key file: `dashboard/test/board-prompt-bar.test.mjs`.
