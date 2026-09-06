#!/usr/bin/env node
// Dashboard asset build (infrastructure-002 + agentic-workflow-006,
// ADR-0003 / ADR-0002 / ADR-0009).
//
// Bundles the LIVE dashboard frontend app (dashboard/app/app.js, owned by
// agentic-workflow) — which CONSUMES the design-system styleguide ES-module
// source across the BC boundary (the SINGLE source of UI truth, ADR-0003;
// read-only here, never copied or forked) — and emits a COMMITTED
// dashboard/dist/ that ADR-0002's static handler serves directly. The token CSS
// + vendored webfonts are still copied verbatim from the styleguide source.
//
// (Before aw-006 the ENTRY was the styleguide CANVAS — the demo page with sample
// data. aw-006 retargets it at the dashboard app so dist/ serves the real board
// over /api/tree. Per ADR-0009, build.mjs stays infrastructure's pipeline file;
// only its ENTRY moved.)
//
//   esbuild bundles React (production) / ReactDOM / marked / htm IN, transforms
//   at build time, minifies. No runtime CDN for the framework, no in-browser
//   Babel, no import map. One command regenerates dist/:
//
//       cd dashboard && npm install && npm run build
//
// esbuild is a BUILD-TIME dependency only — never installed or invoked to RUN
// the dashboard.

import { build } from 'esbuild';
import { mkdir, rm, writeFile, copyFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeBuildStamp } from './build-stamp.mjs';
import { styleguideDir } from '../lib/task-system-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// dashboard/ -> repo root. The styleguide source itself is resolved PER BUILD
// via `styleguideDir(repoRoot)` (ADR-0078, agentic-workflow-hxq1g) — it lives
// at `.agentheim/contexts/design-system/styleguide/` under the legacy layout
// or `.agentheim/knowledge/contexts/design-system/styleguide/` under `board`,
// and `repoRoot` is itself overridable (see `runBuild` below) so a test can
// prove the build succeeds against either shape without touching this repo's
// own (still-legacy) tree.
const REPO_ROOT = path.resolve(__dirname, '..');
// ENTRY is the LIVE dashboard frontend app (agentic-workflow-006, ADR-0009),
// which imports the styleguide components across the BC boundary via 20
// literal relative specifiers ending in `design-system/styleguide/app/*.js`
// (unchanged text — ADR-0003/ADR-0009 precedent, no fork). `styleguideRedirectPlugin`
// below intercepts every such specifier at BUILD time and resolves it against
// the CORRECT physical directory for whichever `repoRoot` this build targets,
// so the bundle works from either layout during the transition without a
// single import statement changing.
const ENTRY = path.join(__dirname, 'app', 'app.js');
// Static binary assets owned by the dashboard app (agentic-workflow-062): the About
// page's profile photo. These live in dashboard/assets/ (the build's SOURCE), copied
// verbatim into dist/ on every build so they survive the dist wipe below and the
// static handler serves them by URL (e.g. /heimeshoff.jpg).
const ASSETS_DIR = path.join(__dirname, 'assets');
// Output dir defaults to the committed dashboard/dist/. An optional CLI arg
// (dashboard/test/dist-build.test.mjs's before() hook uses this) redirects
// the build into a scratch directory instead, so the suite's own fresh-build
// assertions never touch — and never re-freshen — the COMMITTED dist/ that
// dist-staleness.test.mjs checks (infrastructure-w45ce, ADR-0013 amendment /
// ADR-0057 doctrine note: see that test file's header for why this matters).
const DIST = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'dist');

// Any literal ESM import ending in `design-system/styleguide/app/<file>.js` —
// regardless of which root prefix precedes it (`.agentheim/contexts/...` or
// `.agentheim/knowledge/contexts/...`) — is redirected to `<styleguideAppDir>/
// <file>.js`. esbuild's own `alias` option only accepts package-name-shaped
// keys (proven empirically: a relative-looking alias key throws "Invalid
// alias name"), so a plugin `onResolve` filter is the mechanism, not `alias`.
const STYLEGUIDE_IMPORT_FILTER = /\/design-system\/styleguide\/app\/[^/]+\.js$/;

function styleguideRedirectPlugin(styleguideAppDir) {
  return {
    name: 'styleguide-redirect',
    setup(buildApi) {
      buildApi.onResolve({ filter: STYLEGUIDE_IMPORT_FILTER }, (args) => {
        const file = args.path.split('/').pop();
        return { path: path.join(styleguideAppDir, file) };
      });
    },
  };
}

const CSS_FILES = ['colors_and_type.css', 'agentheim.css'];
const BUNDLE_NAME = 'app.js';

// index.html shell — reproduces styleguide/index.html (head, token CSS order,
// #root, dark-first) but loads LOCAL css + the BUNDLED js instead of the import
// map + esm.sh. No CDN/import-map/Babel for the framework.
function indexHtml() {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- Default/template title. The runtime rewrites this per request to name the
       discovered project as "ProjectName — Dashboard" (infrastructure-011,
       static.mjs serveIndexHtml). The baked literal is only ever seen if that
       server-side injection is bypassed; against the Agentheim repo itself it
       already reads the right name. -->
  <title>Agentheim — Dashboard</title>
  <link rel="stylesheet" href="./colors_and_type.css" />
  <link rel="stylesheet" href="./agentheim.css" />
  <style>
    html, body { margin: 0; padding: 0; min-height: 100%; }
    body { background: var(--surface-0); color: var(--fg-1); }
    *, *::before, *::after { box-sizing: border-box; }
    button { font-family: inherit; }
    ::selection { background: var(--accent-ochre-soft); color: var(--fg-1); }
  </style>

  <!--
    Pre-bundled dashboard assets (infrastructure-002 + agentic-workflow-006,
    ADR-0003 / ADR-0002 / ADR-0009). The dashboard frontend app
    (dashboard/app/*.js), which consumes the styleguide ES-module source
    (.agentheim/contexts/design-system/styleguide/app/*.js), is bundled by
    esbuild into ./${BUNDLE_NAME} with React (production) / ReactDOM / marked /
    htm bundled IN. No import map and no remote framework script: the UI loads
    offline from this committed dist/.
    Regenerate with:  cd dashboard && npm install && npm run build
  -->
</head>
<body>
  <div id="root"></div>

  <script type="module" src="./${BUNDLE_NAME}"></script>
</body>
</html>
`;
}

/**
 * Run the real build against `repoRoot` (the STYLEGUIDE source, resolved via
 * `styleguideDir`, is read from there), emitting into `outDir`. Exported so a
 * test can drive it directly against a fixture root without shelling out
 * (`dashboard/test/build-layout.test.mjs`); the CLI entry below calls it with
 * the repo's own real root and the CLI-selected dist dir.
 */
export async function runBuild({ repoRoot = REPO_ROOT, outDir = DIST } = {}) {
  const styleguideRoot = styleguideDir(repoRoot);
  const styleguideAppDir = path.join(styleguideRoot, 'app');
  const stylesDir = path.join(styleguideRoot, 'styles');
  const fontsDir = path.join(stylesDir, 'fonts');

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // Bundle the styleguide entry. esbuild resolves react / react-dom/client /
  // marked / htm from dashboard/node_modules at build time and inlines them.
  await build({
    entryPoints: [ENTRY],
    outfile: path.join(outDir, BUNDLE_NAME),
    bundle: true,
    // The styleguide source lives OUTSIDE dashboard/, so esbuild's default
    // node_modules walk (rooted at each importing file) never reaches our
    // build-time deps. nodePaths points the resolver at dashboard/node_modules
    // for the bare specifiers (react, react-dom/client, marked, htm) without
    // touching or copying the source.
    nodePaths: [path.join(__dirname, 'node_modules')],
    plugins: [styleguideRedirectPlugin(styleguideAppDir)],
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    // Select React's PRODUCTION build (drops dev-only warnings/DCE).
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'none',
    logLevel: 'warning',
  });

  // Copy the token CSS (single source of truth — referenced, not edited).
  for (const css of CSS_FILES) {
    await copyFile(path.join(stylesDir, css), path.join(outDir, css));
  }

  // Copy the vendored webfonts (design-system-003). The token CSS @font-face
  // rules reference url('fonts/<file>.woff2') relative to the CSS. The CSS is
  // copied to dist root (flat), so the fonts must sit at dist/fonts/ for that
  // relative path to resolve when served from dashboard/dist/. Mirrors the CSS
  // copy above — the woff2 (+ OFL licenses) remain owned by design-system; this
  // pipeline only relocates them into the derived dist artifact.
  await cp(fontsDir, path.join(outDir, 'fonts'), { recursive: true });

  // Copy the dashboard's own static binary assets (agentic-workflow-062) flat into
  // dist/ root, so the static handler serves each by a top-level URL (the About page
  // references /heimeshoff.jpg). Copied AFTER the dist wipe so they always survive.
  await cp(ASSETS_DIR, outDir, { recursive: true });

  // Emit the HTML shell.
  await writeFile(path.join(outDir, 'index.html'), indexHtml(), 'utf8');

  // Stamp the build (infrastructure-w45ce): a content hash over the declared
  // inputs, written alongside the output. dashboard/test/dist-staleness.test.mjs
  // compares this stamp against a fresh hash of current sources without ever
  // invoking esbuild, so "is dist/ stale" is checkable stdlib-only.
  writeBuildStamp({ dashboardDir: __dirname, repoRoot, outDir });

  return { outDir };
}

async function main() {
  const { outDir } = await runBuild({ repoRoot: REPO_ROOT, outDir: DIST });
  process.stdout.write(`Built ${path.relative(REPO_ROOT, outDir)}/ (${BUNDLE_NAME} + ${CSS_FILES.join(', ')} + fonts/ + index.html + .build-stamp.json)\n`);
}

// Only run the CLI entry when this file is EXECUTED, not when it is imported
// (dashboard/test/build-layout.test.mjs imports `runBuild` directly).
if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
