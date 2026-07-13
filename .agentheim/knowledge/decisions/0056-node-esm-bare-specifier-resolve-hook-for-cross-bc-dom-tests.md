---
id: ADR-0056
title: A module.register() resolve hook, self-registered per test file, re-resolves the styleguide's bare specifiers against dashboard/node_modules — the Node-ESM analogue of esbuild's nodePaths
scope: infrastructure
status: accepted
date: 2026-07-13
related_tasks: [infrastructure-d2n8s]
related_adrs: [0002, 0003, 0032]
---

# ADR-0056: a self-registered Node ESM resolve hook, not a second `node_modules`, resolves the styleguide's bare specifiers for cross-BC DOM tests

## Context

infrastructure-d2n8s stands up a jsdom DOM-render test harness so a `node --test` file can
mount a real component and dispatch a real DOM event (see the task and dom-harness.mjs for
the motivating m2vkp double-dispatch bug this exists to catch). The harness's first, load-
bearing blocker — before any jsdom code runs at all — is that **mounting a styleguide
component throws `ERR_MODULE_NOT_FOUND`** under a plain `node --test`.

`dashboard/app/board.js` imports `react` as a bare specifier and resolves it fine: Node's
ESM loader walks `node_modules` UP from the *importing file's own directory*, and
`dashboard/app/` sits directly inside `dashboard/`, which has a real, installed
`node_modules/` (ADR-0002/ADR-0003's build/test-time-only carve-out). But `board.js` also
imports the design-system styleguide across the BC boundary — e.g.
`.agentheim/contexts/design-system/styleguide/app/button.js` — consumed unforked (ADR-0003).
That file, and `html.js` beneath it, themselves `import { createElement } from "react"` and
`import htm from "htm"`. Walking `node_modules` up from *their* directory
(`.agentheim/contexts/design-system/styleguide/app/`) never finds one — the styleguide has no
`package.json` and no `node_modules` anywhere up its own tree — so the import throws the
moment a test tries to mount anything that pulls a styleguide module in.

This is not a new problem. `dashboard/build.mjs` (infrastructure-002) already solved the
identical problem at **build** time: esbuild's own bare-specifier resolution has the same
walk-up-from-importer behavior, and `build.mjs` redirects it with
`nodePaths: [dashboard/node_modules]`. Node's own loader has no `nodePaths` equivalent, and
`NODE_PATH` is explicitly ignored by the ESM resolver (documented Node behavior, not an
oversight) — so esbuild's fix does not transfer, and a Node-side analogue is needed.

## Decision

### 1. A `module.register()` resolve hook, not a second `node_modules`

`dashboard/test/resolve-hook.mjs` exports a `resolve(specifier, context, nextResolve)`
customization hook. For a fixed, explicit set of bare specifiers the styleguide actually
imports (`react`, `react-dom`, `react-dom/client`, `htm`, `marked` — not a blanket "redirect
everything"), it re-invokes Node's own `nextResolve` with a **synthetic `parentURL`** pointed
at a (never-created, never-read) path directly inside `dashboard/`. Node's real walk-up
algorithm then finds `dashboard/node_modules` on its very first step, exactly as if the
importing file lived there — reusing Node's own resolution algorithm (package.json
`exports`/`main`, conditions, subpath resolution) rather than hand-rolling a second one. Every
other specifier passes through to `nextResolve` untouched.

**Zero source changes** to `board.js` or any styleguide file. The one sanctioned change this
task's own AC calls for — `BoardPromptBar` gaining an `export` keyword — is unrelated to this
hook.

### 2. Registered by each test file, not globally via `--import`

`dashboard/test/dom-harness.mjs` calls `register('./resolve-hook.mjs', import.meta.url)` as
its own first statement, before importing jsdom or anything downstream. Every DOM-render test
file imports `dom-harness.mjs` first. `node --test` runs each matched test **file** in its own
child process, so this registration is scoped to whichever file opts in — it has **zero
effect** on any test file that does not import `dom-harness.mjs`, and it cannot mask an
unrelated resolution failure elsewhere in the 1300+-test suite. This was verified, not
assumed: `node --test dashboard/test/*.test.mjs ...` (the project's actual full-suite
invocation) carries no `--import` flag anywhere, and the DOM tests still resolve correctly
under it — self-registration is what makes that true.

### 3. Rejected: junctioning `styleguide/node_modules` → `dashboard/node_modules`

The obvious-looking alternative — create a second Windows junction, mirroring ADR-0032's
existing `dashboard/node_modules` link, so the styleguide's own walk-up finds a
`node_modules` directly — is a **data-loss trap**, not merely inelegant. ADR-0032's
`lib/worktree-node-modules.mjs` carries a spike-confirmed finding: `git worktree remove
--force` does not stop at an un-removed junction, it **recurses through it and silently
deletes the real target directory's contents**. `unlinkDashboardNodeModules` — the one
function every worktree teardown path calls before `git worktree remove` — only knows about
`dashboard/node_modules`; a second junction it has never heard of is exactly the shape of that
accident, and a worktree teardown that forgets to unlink it would delete the *real*, shared
`dashboard/node_modules` (or the styleguide directory itself, if junctioned the other
direction) out from under every other worktree. A ~30-line resolve hook with no filesystem
mutation carries none of that risk.

## Consequences

**Positive:**
- The styleguide gains no `package.json`, no `node_modules`, no build tooling of its own —
  its "no `package.json` at all" shape (a deliberate ADR-0003 property: the dashboard is the
  one tree with a dependency graph) is preserved exactly.
- No new filesystem link for worktree teardown to forget; ADR-0032's existing
  `unlinkDashboardNodeModules` contract is untouched.
- The hook is inert everywhere it isn't explicitly imported — adding it carries no risk to the
  other ~1300 tests in the suite.
- Mirrors an existing, already-reviewed pattern (`build.mjs`'s `nodePaths`) rather than
  inventing a new resolution strategy.

**Negative:**
- A second place (alongside `build.mjs`'s `nodePaths` array) that enumerates "the specifiers
  the styleguide needs from dashboard/node_modules." A new styleguide module importing an
  as-yet-unlisted bare specifier (e.g. a future canvas-only dependency) would need this file's
  `REDIRECTED_SPECIFIERS` set updated too, alongside `build.mjs`'s own list, or a DOM test
  exercising it would throw `ERR_MODULE_NOT_FOUND`. Accepted: the set is small, changes rarely,
  and the failure mode is a loud, immediate throw, not a silent behavior drift.
- Node's `module.register()` customization-hooks API is comparatively young; this decision
  accepts that surface as build/test tooling (never shipped, never installed to run the
  dashboard — same ADR-0002/ADR-0003 carve-out esbuild and jsdom itself already occupy).

## Alternatives considered

- **Junction `styleguide/node_modules` → `dashboard/node_modules`.** Rejected — see Decision
  point 3; a spike-confirmed data-loss trap under `git worktree remove --force`.
- **Copy/vendor `react`/`htm`/`marked` into the styleguide tree.** Rejected: reintroduces
  exactly the "hand-maintained copy that can drift" failure ADR-0003 already eliminated for the
  dashboard's own asset build; would need to happen twice (once for the build, once for tests)
  or the two could disagree on versions.
- **Global `--import ./test/setup.mjs` on the `node --test` invocation.** Considered and
  rejected in favor of per-file self-registration: the project's actual full-suite command
  (fixed by convention, not owned by this task) has no `--import` flag, and adding one there
  would apply the hook to every test file in the suite — including ones with no reason to
  trust a redirected `react`/`htm`/`marked` resolution — for no benefit over each DOM test file
  importing `dom-harness.mjs` itself.
- **Give the styleguide its own `package.json` + `node_modules`.** Rejected as by far the
  heaviest option: a second install surface, a second `dist/`-adjacent build concern, and a
  direct reversal of ADR-0003's "the dashboard is the one tree with a dependency graph"
  property, for a problem a 30-line hook solves without touching the styleguide at all.

## References

- ADR-0002 — dashboard runtime/transport; the no-install-step constraint this hook's
  build/test-time-only status does not touch.
- ADR-0003 — styleguide ESM single source; the esbuild `nodePaths` precedent this hook mirrors
  on the Node-test side, and the "no `package.json` in the styleguide" property it preserves.
- ADR-0032 — worker worktree isolation; `lib/worktree-node-modules.mjs`'s spike-confirmed
  junction-recursion finding, the reason a second junction was rejected.
- `infrastructure-d2n8s` — this task; `dashboard/test/resolve-hook.mjs` /
  `dashboard/test/dom-harness.mjs` are the implementation.
