---
id: infrastructure-d2n8s
title: A DOM-render test harness — so a test can mount the board, dispatch a real keydown, and see what a source-regex suite structurally cannot
status: doing
type: feature
context: infrastructure
created: 2026-07-13
completed:
depends_on: []
blocks: []
tags: [testing, test-infrastructure, dom, jsdom, dashboard, styleguide, dev-dependency]
related_adrs: [0002, 0003, 0032, 0050]
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

Stand up a **jsdom** DOM-render harness as a **test-time dev dependency of `dashboard/`**, so a
test can mount a real component, dispatch a **real** `keydown`, and assert **observable
behavior** end-to-end — collapsing the two half-proofs above into one true assertion.

Refinement (2026-07-13) closed the three scope questions the capture left open. **These are
decided — a worker should not relitigate them.**

**1. The library is jsdom.** Not a spike. It is the reference DOM implementation, it dispatches
synchronously through the full spec capture/bubble algorithm, and React 18 `createRoot` attaches
its delegated listeners to the *root container element* — so the m2vkp mechanism (container
listener fires, event bubbles on to a `document` listener) is plain DOM behavior, not
browser-specific behavior, and should reproduce. **"Should" is not "does": the AC below still
gates on actually reproducing it, and a jsdom that cannot is a BOUNCE, not an invitation to
substitute happy-dom.**

**2. It lives in `dashboard/package.json`, and it reaches the styleguide from there.**
`dashboard/` is the only tree in the repo with a dependency graph and a real `node_modules/` —
and `react`, `react-dom`, and `htm` are **already `devDependencies` there**. jsdom is one more
line in the same block. The styleguide has *no `package.json` at all*, so it cannot host the
harness; but `dashboard/build.mjs` already reaches across the BC boundary into
`styleguide/app/` (the styleguide is *consumed, not forked*), so a test in `dashboard/test/`
can mount a styleguide component by relative import. One tree, one `node_modules`, both suites
served. This is why the task is correctly routed to `infrastructure`.

**3. Scope is: harness + the Ctrl+M collapse + the ModelSplitButton keyboard contract.**
Not a big-bang regex migration. But *also not* harness-plus-one-test: converting
`ModelSplitButton`'s menu keyboard behavior is what **proves the cross-BC reach actually
works**. Without it, nobody learns whether a styleguide component can be mounted until the next
a11y task discovers it can't.

**The ADR-0002 / ADR-0003 "no install step" objection is dead on the facts.** Both ADRs
constrain *running* the dashboard; ADR-0003 explicitly blesses esbuild as *"a build-time
dependency only — it never ships and is never installed to run the dashboard."* `react` and
`react-dom` are **already devDependencies that never reach `dist/` as installed packages**.
jsdom is the same category. Confirmed at capture, re-confirmed at refinement — do not spend a
turn on it, but **do** verify empirically that jsdom never lands in `dashboard/dist/`.

## Acceptance criteria

- [ ] **A bare-specifier resolver hook exists, because without it nothing else in this task is
      possible.** `dashboard/app/board.js` imports `react` as a bare specifier, and so do the
      styleguide modules it pulls in (`styleguide/app/html.js` imports `react` and `htm`).
      Node ESM resolves bare specifiers by walking up from the **importing file** — from a
      styleguide module that walk finds no `node_modules` anywhere, so
      `import('../app/board.js')` in a test throws `ERR_MODULE_NOT_FOUND`. esbuild only works
      today because `build.mjs` hands it `nodePaths: [dashboard/node_modules]`. **Node has no
      `nodePaths`, and `NODE_PATH` is ignored for ESM.** Ship the Node analogue: a
      `module.register()` resolve hook (loaded via `node --test --import ./test/setup.mjs`)
      that re-resolves the handful of bare specifiers against `dashboard/node_modules` and
      defers everything else to `nextResolve`. **Zero source changes.** See Notes for the
      rejected alternative and why it is dangerous.
- [ ] jsdom is added to **`dashboard/package.json` `devDependencies`**, never a runtime one,
      and the harness is documented (how to write a mounting test).
- [ ] The dashboard still **runs** with **no install step** (ADR-0002/0003 unbroken), and jsdom
      never reaches `dashboard/dist/`. **Verified, not asserted.**
- [ ] **The harness reproduces the m2vkp bug.** A test mounts the prompt bar, dispatches a real
      `Ctrl+M` keydown with the prompt field focused, and asserts the model advances by
      **exactly one** (Opus → **Sonnet**; the bug yields **Haiku**). Then: **removing the
      `shouldWindowCtrlMHandle` guard from `board.js` must turn it RED.** Perform this mutation
      — do not reason about it. If jsdom cannot reproduce React 18's root-container delegation,
      it has failed its one job: **say so plainly and bounce**, rather than shipping a harness
      that manufactures false confidence.
- [ ] **The test reaches a state where the bug is actually live.** This is the criterion most
      likely to be faked, and faking it is the whole failure mode this task exists to kill. On a
      freshly-mounted `BoardPromptBar`, `modelLocked = !bridgePresent || isModelLockedForMode(mode)`
      — and on mount `bridgePresent` is `false` **and** the mode is Quick Capture, so **Ctrl+M
      is a no-op on both counts**. A naive mount-and-dispatch test passes *trivially, because
      nothing happens at all* — and would survive the mutation check above. The test MUST
      therefore (a) stub `fetch` so the bridge probe succeeds, and (b) move off Quick Capture,
      before pressing the key. **A reviewer must be able to see that this test can go red.**
- [ ] The two-file split proof for `Ctrl+M` is collapsed into one end-to-end test, and the
      superseded source-regex assertions are retired (or the task explains, with evidence, why
      one must stay — pinning a *call site and its ordering* is a thing a behavioral test
      genuinely does not do, so keeping one is a legitimate outcome, not a failure).
- [ ] **The cross-BC reach is proven:** `ModelSplitButton`'s menu keyboard contract (↑/↓ roving,
      Enter, Escape, focus return to the trigger, WCAG 2.1.2 no-keyboard-trap) is mounted from
      styleguide source and asserted **behaviorally**, replacing the source-guards that
      currently "prove" it. A11y proven by regex is a11y not proven.
- [ ] The full suite stays green and the runtime remains bootable
      (`node dashboard/launch.mjs` — ADR-0036's runtime-drive check still passes).
- [ ] The BC README documents the harness, when to reach for it, and — honestly — what it still
      cannot see.

## Notes

**Pre-flight intelligence (architect, 2026-07-13).** Gathered at refinement so the worker
doesn't rediscover it the hard way. Nothing here was *executed* (jsdom isn't installed yet) —
it is read from source, and the two genuinely unverified claims are flagged as such.

- **The resolver hook is the first blocker, and the obvious workaround is a data-loss trap.**
  The tempting fix is to junction `styleguide/node_modules` → `dashboard/node_modules`.
  **Do not.** ADR-0032's `lib/worktree-node-modules.mjs` carries a spike-confirmed finding that
  `git worktree remove --force` **recurses through an un-unlinked junction and silently deletes
  the real target's contents**. `unlinkDashboardNodeModules` only knows about
  `dashboard/node_modules`; a second junction it has never heard of is exactly the shape of
  that accident. The `module.register()` resolve hook (~30 lines, no source changes,
  worktree-safe) is the sanctioned path. **This decision — how Node-side tests resolve bare
  specifiers across the BC boundary, mirroring esbuild's `nodePaths` — is worth an ADR.**

- **`npm install` from inside a worktree writes THROUGH the junction into the MAIN tree.**
  Confirmed by construction: a Windows directory junction is transparent to file I/O, there is
  no copy-on-write. `taskTouchesDashboard` **will** fire for this task (its FILE_LIST includes
  `dashboard/package.json`), so the worktree gets the junction — and a bare `npm install` in
  it then materializes jsdom's ~40 transitive packages into the *shared, real* directory. It
  "works", which is the danger. It also violates ADR-0032's own stated safety premise
  (*"safe because node_modules is read-only during a build … there is no concurrent writer"*) —
  an install **is** that concurrent writer, and a parallel session's esbuild build reading
  node_modules mid-install can break on Windows.
  **Safe sequence:** (a) edit `dashboard/package.json` + `package-lock.json` in the worktree —
  ordinary tracked changes; (b) run the install **explicitly against the main tree, once,
  announced, with no concurrent build**: `npm install --prefix <mainRoot>/dashboard`. Never a
  bare `npm install` from inside the worktree's `dashboard/`, where the write target is
  invisible. (c) Do **not** replace the junction with a real per-worktree `node_modules` —
  `unlinkDashboardNodeModules` would then refuse to touch it and the teardown doctrine stops
  covering you. Expect large `package-lock.json` churn in the diff; don't let it hide the real
  changes.

- **jsdom setup, minimal correct shape.** `new JSDOM('<!doctype html><body></body>', {
  pretendToBeVisual: true, url: 'http://localhost/' })`, then copy `window`, `document`, and the
  constructors (`KeyboardEvent`, `Element`, `HTMLElement`, `Node`, `MessageChannel`) onto
  `globalThis`. Two traps:
  - `globalThis.navigator` is a **getter-only accessor** on modern Node — a plain assignment
    throws in ESM strict mode. Use `Object.defineProperty(globalThis, 'navigator', { value:
    dom.window.navigator, configurable: true })`.
  - **The container must be attached to the document** (`document.body.appendChild(container)`)
    *before* `createRoot(container)`. Mount on a detached div and the event never reaches
    `document` — **the bug silently does not reproduce and the harness gives a false green.**
    This is the single easiest way to ship something worthless here.

- **Getting the bug live (expanding the AC above).** `probeBridge` takes `window.fetch`, and
  `bridge-launch.js` requires **two** successful calls — `discoverBridge` (→ `{port, token}`)
  **and** `probeHealth` (`http://127.0.0.1:<port>/health`, token header). Stub **both** on
  `dom.window.fetch`. Do not stub only the first: **Marco's real bridge may be listening on this
  box**, and an un-stubbed health ping would make the test's outcome depend on whether his VS
  Code happens to be open. Then move off Quick Capture before dispatching.

- **`BoardPromptBar` is not exported** (plain `function` in `board.js`). Add `export` — one
  word, harmless. The alternative (mounting `DashboardApp`) drags in a `/api/tree` fetch and is
  far heavier. `EventSource` is already guarded (`typeof EventSource === "undefined"` → bail),
  so the SSE path is safe under jsdom.

- **`act()` discipline.** Set `globalThis.IS_REACT_ACT_ENVIRONMENT = true`. Wrap **both** the
  render and the dispatch in `await act(async () => { … })` — the `document`-scoped handler's
  `setSelectedModel` is a non-React-triggered update and will otherwise not have flushed when
  the assertion reads the DOM. **That is also precisely how you would *miss* the +2.** Prefer
  `React.act` if React 18.3.1 exports it (*unverified*), else `react-dom/test-utils`'s (which
  emits a deprecation warning). **Always `root.unmount()` in teardown** — board.js registers its
  `document` keydown listener in a `useEffect`, and a leaked mount makes the *next* test's
  dispatch double-fire, producing a bogus RED.

- **Assert on rendered text, not internal state.** The model label rendered by
  `ModelSplitButton` is the observable surface. Opus (default) → one Ctrl+M → **Sonnet**; the
  bug produces **Haiku**. That asymmetry is what makes the test genuinely falsifiable.

- **Prior art:** `infrastructure-009` (command-card invocation test infra) is the closest in-BC
  precedent for standing up test infrastructure. `infrastructure-002` (the esbuild pre-bundle
  pipeline) is the precedent that a **build/test-time dev dependency is acceptable** — it is why
  the ADR-0002/0003 objection dissolves.

- **The real target is a class of bug, not one bug.** Every keyboard/focus/ARIA contract in this
  project is currently proven by reading source as text: ADR-0050's five amendments' worth of
  prompt-bar key handling, `ModelSplitButton`'s menu keyboard behavior and WCAG 2.1.2
  no-keyboard-trap rule, Escape-blurs, roving tabindex. These are *exactly* the behaviors a
  source regex is worst at and a DOM harness is best at.

- **Motivating failure, in one line:** React 18 `createRoot` delegates `keydown` at the root
  container; the event then bubbles on to `document`. Two handlers, no `stopPropagation()`,
  `preventDefault()` doesn't stop propagation → the model cycled by 2, half the models became
  unreachable, suite green. See ADR-0050's fifth amendment and the 2026-07-13 12:30 protocol
  entry (observation 1).

- **A caution earned this session, and the reason two ACs above are written as traps.** Two
  workers wrote tests that were *structurally incapable of failing* on the criterion they were
  named for — one asserted the buggy shape and passed *because* the bug was present. A DOM
  harness makes it **easier** to write a test that genuinely fails; that is the entire point of
  it. **Do not let it become a more elaborate way to write a test that always passes.**
</content>
</invoke>
