---
id: infrastructure-yaajt
title: Dashboard build emits lazily-loaded code-split chunks (dist/app.js + dist/chunks/), dependency pins become build-stamp inputs
status: done
type: feature
context: infrastructure
created: 2026-11-03
completed:
depends_on: []
blocks: [design-system-kw15t]
tags: [dashboard, build, esbuild, dist]
related_adrs: [ADR-0002, ADR-0003, ADR-0009, ADR-0013, ADR-0057, ADR-0083]
related_research: []
prior_art: []
---

## Why
design-system-kw15t renders mermaid diagrams. Mermaid is about 3 MB (an estimate, not measured)
and must load only when a doc contains a mermaid fence (ADR-0083, accepted by the builder on
2026-11-03). Today `build.mjs` writes a single `outfile`, so a dynamic `import()` gets inlined
into `app.js`. Separately, the build stamp ignores `package.json` and the lockfile, so a
dependency bump never marks `dist/` stale.

## What
- `dashboard/build.mjs`: switch from `outfile` to `outdir: outDir` and add `splitting: true`,
  `entryNames: '[name]'` and `chunkNames: 'chunks/[name]-[hash]'`. Keep `[hash]`: esbuild names
  every shared chunk `chunk`, so names without a hash would collide.
  - Keep `format:'esm'`, the styleguide-redirect plugin, `nodePaths`, `define` and the minify
    settings as they are.
  - Raise `target` from `es2020` to `es2022` only if mermaid needs it, and record that.
- `dashboard/package.json`: add `mermaid` as a devDependency pinned to an exact version (the latest
  11.x at work time), and update `package-lock.json`.
- `dashboard/build-stamp.mjs`: add `dashboard/package.json` and `dashboard/package-lock.json` to
  `declaredInputRoots`.
- `dashboard/test/dist-build.test.mjs`: run the forbidden-CDN and no-`jsdom` assertions over
  every `.js` file under the scratch dist, recursively, not just `app.js`.
- `static.mjs`: add tests only. No handler change is expected, because nested paths, the traversal
  guard, the `.js` content type and `no-cache` already cover chunk files.
- Report a README delta for the infrastructure README's ADR-0003 section that points at ADR-0083.

## Acceptance criteria
- [ ] A fresh scratch build of the current source emits `dist/app.js` under the same name, and
  `index.html` still references only `./app.js`. Existing assertions stay green.
- [ ] Build-layout fixture: a fixture styleguide module containing `import("./lazy-fixture.js")`
  produces at least one `chunks/*.js` file, and `app.js` contains `import("./chunks/`.
- [ ] Determinism: two consecutive builds into two scratch directories give byte-identical file
  sets (same names, same bytes).
- [ ] The no-CDN and no-`jsdom` assertions check every `.js` file under the scratch dist. A planted
  `chunks/x.js` containing `esm.sh` makes the assertion fail.
- [ ] `static.test.mjs`, using a temp asset root:
  - `GET /chunks/<file>.js` returns 200 with `content-type: text/javascript; charset=utf-8` and
    `cache-control: no-cache`.
  - `GET /chunks/../../etc/passwd` and an encoded-traversal variant return 403.
  - A missing chunk returns 404.
- [ ] `build-stamp`: changing only `dashboard/package.json` (a scratch copy in a fixture) changes
  `computeSourceHash`, and `declaredInputRoots` lists both pin files.
- [ ] `dashboard/package.json` pins `mermaid` to an exact version (no `^` or `~`), and a test
  asserts this.

## Notes
- `build.mjs` belongs to infrastructure (ADR-0009). This is a change to the pipeline's shape, not a
  change of entry point.
- Adding the pin files to the stamp changes its hash, so `dist-staleness` will go red on `main`
  until the conductor or release rebuild runs (ADR-0057). That is expected.
- Workers don't commit `dist/`. The `dashboard/dist/` prefix guard already covers `dist/chunks/`,
  and RELEASE.md's `git add dashboard/dist` stages chunk deletions.
- If esbuild cannot bundle mermaid cleanly, the fallback is ADR-0083's (b′) path: vendor mermaid's
  prebuilt ESM build into `dist/vendor/`. Bounce the task back to the architect rather than
  improvising.

## Outcome

Implemented ADR-0083's build shape. `dashboard/build.mjs` now uses `outdir: outDir` with `splitting: true`, `entryNames: '[name]'` and `chunkNames: 'chunks/[name]-[hash]'`. All other options are unchanged, including `target: es2020`. `dashboard/build-stamp.mjs` declares `dashboard/package.json` and `dashboard/package-lock.json` as inputs. `mermaid` is pinned to `11.17.2` as a devDependency with the lockfile updated in lockfile-only mode. Top-level versions of esbuild, react, marked, jsdom and htm are unchanged. The static handler needed no change, and tests were added for it.

Tests added or extended:
- `dashboard/test/build-layout.test.mjs`: a fixture styleguide module with `import("./lazy-fixture.js")` yields `chunks/*.js`, and `app.js` contains `import("./chunks/`. It also checks that `index.html` still references `./app.js` and that two builds into two scratch dirs are byte-identical.
- `dashboard/test/dist-build.test.mjs`: the CDN and `jsdom` scans cover every `.js` under dist. A planted `chunks/x.js` containing `esm.sh` is caught. A new test asserts that mermaid is pinned to an exact version.
- `dashboard/test/static.test.mjs`: `/chunks/<file>.js` returns 200 with `text/javascript; charset=utf-8` and `no-cache`. A plain and an encoded traversal both return 403, and a missing chunk returns 404.
- `dashboard/test/dist-staleness.test.mjs`: `declaredInputRoots` lists both pin files, and changing only a fixture `package.json` changes `computeSourceHash`.

Measured sizes:
- `app.js` is 328,694 bytes before and 328,694 bytes after. It is byte-identical in size because nothing in the entry graph imports mermaid yet. kw15t adds the dynamic import.
- `dist/chunks/` is absent today.
- A probe build (a scratch entry doing `import("mermaid")` with the project's exact esbuild options) bundled cleanly at `target: es2020` with no warnings. It produced a 93-byte entry plus 106 chunks, about 3.6 MB on disk. Two builds were byte-identical. `target` therefore stays `es2020`, and the ADR-0083 (b') fallback is not needed.

Test status: `cd dashboard && node --test` has the same 5 pre-existing failures as the baseline on main and no new ones. The "committed dashboard/dist/ matches current declared sources" failure was already red on main in the worktree. It is also expected from this task, because the pin files now join the stamp and the conductor rebuilds `dist/` at integration (ADR-0057).
