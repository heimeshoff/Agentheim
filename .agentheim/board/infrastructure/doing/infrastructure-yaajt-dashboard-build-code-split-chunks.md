---
id: infrastructure-yaajt
title: Dashboard build emits lazily-loaded code-split chunks (dist/app.js + dist/chunks/), dependency pins become build-stamp inputs
status: doing
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
