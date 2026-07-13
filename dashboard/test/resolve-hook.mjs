// Agentheim — bare-specifier resolve hook for DOM-render tests (infrastructure-d2n8s)
//
// Node ESM resolves a bare specifier by walking node_modules UP from the
// IMPORTING FILE's own directory. `dashboard/app/board.js` sits inside
// dashboard/, so its own `import ... from "react"` already resolves fine
// (the walk finds dashboard/node_modules directly). The STYLEGUIDE
// (.agentheim/contexts/design-system/styleguide/app/*.js) it consumes across
// the BC boundary (ADR-0003, unforked) is a different story: it has no
// node_modules anywhere up ITS tree, so `html.js`'s `import htm from "htm"`
// (and `import { createElement } from "react"`, primitives.js's
// `import { marked } from "marked"`) throw ERR_MODULE_NOT_FOUND the moment a
// test tries to mount a component that pulls one of those files in.
//
// esbuild solves the IDENTICAL problem at BUILD time via `build.mjs`'s
// `nodePaths: [dashboard/node_modules]` (infrastructure-002). Node's loader
// has no `nodePaths`, and `NODE_PATH` is ignored for ESM — this hook is the
// Node-side analogue: for the handful of bare specifiers the styleguide
// needs, redirect resolution by re-running Node's OWN bare-specifier
// algorithm (via `nextResolve`) with a synthetic `parentURL` rooted at
// dashboard/ itself, so dashboard/node_modules is found on the walk's very
// first step — exactly as if the importing file lived inside dashboard/.
// ZERO changes to board.js or any styleguide source file.
//
// Loaded via `module.register()` (see dom-harness.mjs), which each
// DOM-render test file calls on itself, as its own first import. `node
// --test` runs every matched test FILE in its own child process, so
// registering this hook has no effect whatsoever on any test file that does
// not opt in — it cannot mask an unrelated resolution failure elsewhere in
// the suite.

import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
// dashboard/test/ -> dashboard/ — the ONE tree in the repo with a real,
// installed node_modules/ (ADR-0002/ADR-0003's build/test-time-only carve-out).
const DASHBOARD_DIR = path.join(here, '..');
// A synthetic path INSIDE dashboard/ — never read, never created. Node's
// node_modules walk starts at `dirname(parentURL)`, so pointing the walk's
// parent at a file that would live directly inside dashboard/ makes the walk
// find dashboard/node_modules on its first step, mirroring esbuild's
// nodePaths redirect without touching or copying any source.
const SYNTHETIC_PARENT = pathToFileURL(path.join(DASHBOARD_DIR, '__resolve-hook-synthetic__.mjs')).href;

// The handful of bare specifiers the styleguide imports that live OUTSIDE
// its own (nonexistent) node_modules walk-up chain. Not a blanket "redirect
// everything" — an unlisted bare specifier still falls through to
// `nextResolve` completely untouched.
const REDIRECTED_SPECIFIERS = new Set(['react', 'react-dom', 'react-dom/client', 'htm', 'marked']);

export async function resolve(specifier, context, nextResolve) {
  if (!REDIRECTED_SPECIFIERS.has(specifier)) {
    return nextResolve(specifier, context);
  }
  return nextResolve(specifier, { ...context, parentURL: SYNTHETIC_PARENT });
}
