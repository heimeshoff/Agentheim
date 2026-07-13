---
id: infrastructure-d2n8s
title: A DOM-render test harness — so a test can mount the board, dispatch a real keydown, and see what a source-regex suite structurally cannot
status: backlog
type: feature
context: infrastructure
created: 2026-07-13
completed:
depends_on: []
blocks: []
tags: [testing, test-infrastructure, dom, jsdom, dashboard, styleguide, dev-dependency]
related_adrs: [0002, 0003, 0050]
related_research: []
prior_art: [infrastructure-009, infrastructure-002]
---

## Why

The dashboard's board tests (`dashboard/test/board-prompt-bar.test.mjs`) are a
**source-regex suite** — they read `board.js` as *text* and assert that certain strings
appear in it. This is not a stylistic quirk; it is forced. `board.js` renders via htm/React
and there is **no DOM under `node --test`**, so there is no way to mount the component and
observe it. The styleguide's tests (`styleguide/test/*.test.mjs`) are the same shape for the
same reason — `enter-button.test.mjs` says so in its own header.

**This has a real, measured cost. It shipped a bug this session.**

`agentic-workflow-m2vkp` (2026-07-13) landed a **double-handled `Ctrl+M`**. Under React 18
`createRoot`, the delegated `keydown` fires at the root container and the event then
**continues bubbling to `document`**, where a window-scoped listener also fired. Neither
called `stopPropagation()`, and `preventDefault()` does not stop propagation. Both functional
setters queued → the model advanced by **+2**. With exactly four models that is a parity
trap: from the Opus default it cycled Opus → Haiku → Opus → Haiku, leaving **Fable and Sonnet
unreachable whenever the prompt field had focus** — the normal case, while typing a prompt.

**1279 tests were green.** No source-regex test could have seen it. The defect is a *live
event-propagation behavior*; reading `board.js` as a string cannot tell you what happens when
two listeners are both attached and one bubbles into the other. Only a fresh-context verifier
reasoning about React's delegation model caught it.

**And the fix's proof is still split across two files, because the harness doesn't exist.**
The eventual guard (`shouldWindowCtrlMHandle`) is proven by:
1. a **behavioral** test against the pure exports (`prompt-model.test.mjs`) — proves the
   guard's semantics and the net `+1` step, but it *re-implements board.js's two dispatch
   paths in its own body* rather than driving `board.js`; and
2. a **source-regex** test (`board-prompt-bar.test.mjs`) — pins the actual call site and its
   ordering in `board.js`, but proves nothing about behavior.

Together they close the loop; **neither alone is airtight**, and the seam between them is
exactly where a future regression can slip through. The verifier flagged this explicitly as
*"a backlog-worthy improvement, not a blocker."* This task is that improvement.

## What

Stand up a **DOM-render test harness** (jsdom, happy-dom, or similar) as a **test-time dev
dependency**, so a test can mount a real component, dispatch a **real** `keydown`, and assert
**observable behavior** end-to-end — collapsing the two half-proofs above into one true
assertion.

**The ADR-0002 / ADR-0003 constraint does NOT block this — confirm it once and move on.**
Both ADRs constrain *running* the dashboard: *"no install step to **run**"*, *"no framework,
no `node_modules`, no install step"* (ADR-0002), and ADR-0003 is explicit that
**"esbuild is a build-time dependency only — it never ships and is never installed to *run*
the dashboard."** A DOM library used only by `node --test` sits in exactly that category:
`devDependencies`, never bundled, never required to serve the board. The invariant is
untouched. (This reading was confirmed against both ADRs at capture — a worker should not
relitigate it, but *must* verify the chosen library is genuinely dev-only and never reaches
`dist/`.)

Scope questions left for refinement:

- **Which library.** jsdom (heavy, complete, the de-facto standard) vs. happy-dom (lighter,
  faster, less complete). The deciding axis is whether React 18's `createRoot` **event
  delegation** — the precise mechanism that produced the `m2vkp` bug — is faithfully
  reproduced. **A harness that cannot reproduce the double-dispatch bug is not worth
  installing**, so that is the acceptance test for the library choice, not a footnote.
- **How much to migrate.** This should almost certainly **not** be a big-bang rewrite of every
  source-regex test. Prefer: stand the harness up, prove it on the `Ctrl+M` case, and let the
  regex suites be retired incrementally where a real assertion is available. Note the regex
  tests are not worthless — they pin *call sites and ordering* in a way a behavioral test
  doesn't, so some may be worth keeping alongside.
- **Whether the styleguide gets it too.** `styleguide/test/` has the identical limitation
  (`ModelSplitButton`'s menu keyboard behavior — ↑/↓/Enter/Escape, focus return, no keyboard
  trap — is currently proven by *source guards*, which is precisely the weakest place to prove
  a11y). If the harness is shared, this task's routing to `infrastructure` is right; if it
  turns out to be dashboard-only, it belongs in `agentic-workflow`.

## Acceptance criteria

- [ ] A DOM-render harness is available to `node --test` and documented (how to write a
      mounting test) — added as a **`devDependency`**, never a runtime one.
- [ ] The dashboard still **runs** with **no install step** (ADR-0002/0003 unbroken), and the
      harness never reaches `dashboard/dist/`. Verified, not asserted.
- [ ] **The harness reproduces the `m2vkp` bug.** Write a test that mounts the prompt bar,
      dispatches a real `Ctrl+M` keydown with the prompt field focused, and asserts the model
      advances by **exactly one**. Then confirm that **removing the `shouldWindowCtrlMHandle`
      guard turns it RED.** If the harness cannot reproduce React 18's root-container event
      delegation, it has failed its one job — say so plainly and bounce rather than shipping a
      harness that gives false confidence.
- [ ] At least one existing source-regex test is replaced by a real behavioral assertion, and
      the two-file split proof for `Ctrl+M` is collapsed into one end-to-end test (or the task
      explains, with evidence, why it cannot be).
- [ ] The full suite stays green and the runtime remains bootable
      (`node dashboard/launch.mjs` — ADR-0036's runtime-drive check still passes).
- [ ] The BC README documents the harness, when to reach for it, and — honestly — what it
      still cannot see.

## Notes

- **Prior art:** `infrastructure-009` (command-card invocation test infra) is the closest
  in-BC precedent for standing up test infrastructure. `infrastructure-002` (the esbuild
  pre-bundle pipeline) is the precedent that a **build/test-time dev dependency is
  acceptable** — it is the reason the ADR-0002/0003 objection above dissolves.
- **The real target is a class of bug, not one bug.** Every keyboard/focus/ARIA contract in
  this project is currently proven by reading source as text: ADR-0050's five amendments'
  worth of prompt-bar key handling, `ModelSplitButton`'s menu keyboard behavior and WCAG
  2.1.2 no-keyboard-trap rule, Escape-blurs, roving tabindex. These are *exactly* the
  behaviors a source regex is worst at and a DOM harness is best at.
- **Motivating failure, in one line, for whoever picks this up:** React 18 `createRoot`
  delegates `keydown` at the root container; the event then bubbles on to `document`. Two
  handlers, no `stopPropagation()`, `preventDefault()` doesn't stop propagation → the model
  cycled by 2, and half the models became unreachable, with a green suite. See ADR-0050's
  fifth amendment and the 2026-07-13 12:30 protocol entry (observation 1).
- **A caution earned this session:** two workers wrote tests that were *structurally incapable
  of failing* on the criterion they were named for (one asserted the buggy shape and passed
  *because* the bug was present). A DOM harness makes it **easier** to write a test that
  genuinely fails — that is the point of it. Do not let it become a more elaborate way to
  write a test that always passes.
