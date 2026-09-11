---
id: infrastructure-004
title: Resolve dashboard assetRoot relative to the module, not the project root
status: done
type: bug
context: infrastructure
created: 2026-06-08
completed: 2026-06-08
commit: 716c7f0
depends_on: [agentic-workflow-001]
blocks: []
tags: [dashboard, runtime, plugin, assets, static, cross-os]
related_adrs: [ADR-0002, ADR-0004]
related_research: []
prior_art: [infrastructure-001, infrastructure-002, agentic-workflow-004]
---

## Why

When Agentheim runs as an **installed plugin** against a foreign project, the dashboard
serves its built static assets from the wrong directory and responds
*"Dashboard assets not built yet (dist/ is absent)"* even though the assets are built.

Root cause (`dashboard/server.mjs:16`):

```js
export function defaultAssetRoot(root) {
  return path.join(root, 'dashboard', 'dist');
}
```

`root` is the **discovered project root** (the foreign project's `.agentheim/` holder).
The built `dist/` does not live there — it lives beside the dashboard module, in the
plugin cache. The current resolution only works by coincidence when `root` happens to
equal the Agentheim repo itself (where `.agentheim/` and `dashboard/dist` sit side by
side). This is the asset-serving sibling of the same separation ADR-0004 names: the
detached dashboard process and its assets live apart from the project it points at.

Found during the POSIX cross-OS pass (agentic-workflow-010): the dashboard otherwise ran
clean on macOS, but the asset path had to be bridged with a manual symlink
(`<project>/dashboard/dist` → cache `dist`) to load at all.

## What

Resolve the default asset root from the **dashboard module's own location**, not the
discovered project root. The sibling modules already do this pattern
(`launch.mjs:27`, `build.mjs:31`):

```js
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export function defaultAssetRoot() {
  return path.join(__dirname, 'dist');
}
```

This is correct in **both** scenarios — repo-self and installed-plugin — because the
built `dist/` always lives beside `server.mjs` in `dashboard/`. Update the one default
caller (`serve.mjs:15`) accordingly. Optionally thread an env override (e.g.
`AGENTHEIM_DASHBOARD_DIST`) through `serve.mjs` for dev flexibility.

The explicit `assetRoot` parameter on `createDashboardServer` must stay — the test suite
passes it directly and it is the override seam.

## Acceptance criteria

- [ ] `defaultAssetRoot` resolves to the dashboard module's own `dist/` (module-relative
      via `import.meta.url`), independent of the discovered project root.
- [ ] Running the installed plugin against a foreign project (project root ≠ plugin dir)
      serves the built assets — no false `dist/ is absent` 404 when `dist` exists beside
      the module.
- [ ] Running against the Agentheim repo itself still works (no regression).
- [ ] The explicit `assetRoot` override on `createDashboardServer` is preserved.
- [ ] A regression test covers the plugin scenario: `root` pointed elsewhere, `dist`
      beside the module, asset served 200.
- [ ] Both suites (lib + dashboard) run green.

## Notes

- Reported by a macOS contributor verifying agentic-workflow-010; worked around with a
  symlink, but module-relative resolution is the clean fix.
- Governing decisions: ADR-0002 (Node-stdlib static transport, `defaultAssetRoot` origin
  in aw-004), ADR-0004 (neutral cwd + `AGENTHEIM_ROOT` — the plugin-install separation
  this bug is a consequence of). If the fix changes the documented runtime contract, add
  an ADR addendum and update `dashboard/README.md`.
- Prior art: infrastructure-001 (runtime transport), infrastructure-002 (bundles the
  `dist/` this bug fails to locate), aw-004 (where `defaultAssetRoot` was first written).

## Outcome

`defaultAssetRoot()` (`dashboard/server.mjs`) now resolves `dist/` **module-relative**
via `import.meta.url` (`path.join(__dirname, 'dist')`), independent of the discovered
project root — mirroring `launch.mjs` / `build.mjs`. The `root` argument is accepted but
ignored (kept for caller compatibility). The single production default-caller,
`dashboard/serve.mjs`, now calls `defaultAssetRoot()` with no root and honours an optional
`AGENTHEIM_DASHBOARD_DIST` dev override. The explicit `assetRoot` parameter on
`createDashboardServer` is preserved as the test/override seam.

This restores (does not change) the ADR-0002 "plugin-relative directory" contract, and is
the asset-serving consequence of ADR-0004's cwd/root decoupling — so no ADR addendum was
needed. The dashboard README gains a "Static assets: module-relative asset root" section.

Regression test: `dashboard/test/asset-root.test.mjs` — (1) `defaultAssetRoot` returns the
module-relative path whether given a foreign root or no argument; (2) plugin scenario:
foreign project root with only `.agentheim/` (no local `dashboard/dist`), default server
serves `index.html` 200 from the committed module-relative `dist/`. Both failed Red against
the old project-root resolution (404 / wrong path), pass Green after the fix.

Suites: dashboard 108/108, lib 13/13. The foreign-project-on-POSIX final re-check is
environmental and belongs to agentic-workflow-010 (not tickable on this Windows run).

Key files: `dashboard/server.mjs`, `dashboard/serve.mjs`,
`dashboard/test/asset-root.test.mjs`, `dashboard/README.md`.
