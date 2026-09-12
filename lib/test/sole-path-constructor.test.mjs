// Sole path-constructor test (agentic-workflow-g5ez5, What item 5, sharpened
// from cj54k's already-false "exactly one module" wording — `lifecycle-lock.mjs`,
// `hook-agent-signal.mjs`, `derived-artifact-guard.mjs`, and `discovery.mjs`
// legitimately construct non-layout-bearing `.agentheim/` paths). Two static
// proofs, both walking `lib/*.mjs`, `dashboard/*.mjs`, `dashboard/app/*.js`
// (production source only — never `lib/test/`/`dashboard/test/`):
//
//   1. Every occurrence of the literal string `.agentheim` inside a quoted
//      string, template literal, or regex literal (doc-comment mentions do
//      not count) is in an enumerated ALLOWLIST — an enumerated, reviewed
//      set, so a NEW file quietly duplicating `task-system-paths.mjs`'s job
//      is a test failure, not a silent hundred-place hunt later.
//   2. A `layout:` opt literal (`layout: 'legacy'` / `layout: 'board'`, or
//      the `LEGACY`/`BOARD` const form) appears ONLY in
//      `lib/layout-migration.mjs` — the static proof that `migrate` is the
//      sole caller allowed to override `resolveLayout`'s detected layout.
//      (Test files are exempt from this second check — `lib/test/task-
//      system-paths.test.mjs` and `lib/test/layout-migration.test.mjs`
//      legitimately exercise the override mechanism directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Enumerated, reviewed set of every file allowed to spell `.agentheim` inside
 *  a quoted string / template literal / regex literal. Each entry names WHY.
 *  @type {{file: string, rationale: string}[]} */
const ALLOWLIST = [
  { file: 'lib/task-system-paths.mjs', rationale: 'the canonical layout module (ADR-0078) — the ONE module every other path-resolving call site is supposed to go through.' },
  { file: 'lib/layout-migration.mjs', rationale: 'the `migrate` verb (ADR-0078 §4) — reads/rewrites both the legacy source paths and the board destination paths as the one, permanent migration mechanism.' },
  { file: 'lib/lifecycle-lock.mjs', rationale: 'the project-wide lifecycle lock file, `.agentheim/state/lifecycle.lock` — a stays-put runtime surface (ADR-0078 §7), not a layout-bearing path.' },
  { file: 'lib/hook-agent-signal.mjs', rationale: '`.agentheim/state/in-flight.json` — a stays-put runtime surface (ADR-0078 §7), not layout-bearing.' },
  { file: 'lib/derived-artifact-guard.mjs', rationale: '`BOOKKEEPING_PATH_PREFIXES` — the generic `.agentheim/` prefix a worker worktree write is refused under (agentic-workflow-ghcaj), independent of which layout is on disk.' },
  { file: 'lib/vacuum-guard.mjs', rationale: 'the batch-mix bookkeeping-surface segment regexes — path-SHAPE matching against a `FILE_LIST` string with no `rootDir` available to run layout detection against (agentic-workflow-q8f3n).' },
  { file: 'lib/legacy-path-literal-lint.mjs', rationale: "this lint's own ALLOWLIST match strings and SHAPES regexes quote the very legacy-path shapes it recognizes — quoting the shape IS the point, mirrored from this file's own header note." },
  { file: 'lib/task-lifecycle-capture-dismiss.mjs', rationale: "capture/dismiss/reroute's mixed-layout/legacy-layout rejection messages quote the layout name in builder-facing prose (e.g. \"refuses a 'mixed' .agentheim/ layout\") — prose, not a second path constructor." },
  { file: 'dashboard/discovery.mjs', rationale: '`discoverRoot` — walks up from cwd looking for a `.agentheim/` folder\'s mere EXISTENCE (ADR-0002); never resolves an internal layout-bearing path.' },
  { file: 'dashboard/read-api.mjs', rationale: 'the `.agentheim/.dashboard/bridge.json` runtime join — a stays-put surface (ADR-0078 §7).' },
  { file: 'dashboard/runfile.mjs', rationale: 'the `.agentheim/.dashboard/` runfile joins — a stays-put runtime surface (ADR-0078 §7).' },
  { file: 'dashboard/watcher.mjs', rationale: 'the `.agentheim/` root the fs watcher attaches to, and the `.agentheim/`-relative path it reports — no layout-bearing sub-path resolution.' },
  { file: 'dashboard/whats-next-delete.mjs', rationale: '`.agentheim/state/whats-next.md` — a stays-put runtime surface (ADR-0078 §7).' },
  { file: 'dashboard/app/app.js', rationale: "one of the 20 literal `design-system/styleguide/app/*.js` ESM import specifiers ADR-0078's own Negative Consequences name as an accepted tradeoff — jsdom/the browser must resolve an actual on-disk relative path; `build.mjs`'s `styleguideRedirectPlugin` rewrites it at bundle time." },
  { file: 'dashboard/app/board.js', rationale: 'same 20-import-specifier tradeoff as app.js.' },
  { file: 'dashboard/app/main-pane-reader.js', rationale: 'same 20-import-specifier tradeoff as app.js.' },
  { file: 'dashboard/app/slide-over.js', rationale: 'same 20-import-specifier tradeoff as app.js.' },
  { file: 'dashboard/app/in-flight-state.js', rationale: '`.agentheim/state/in-flight.json` — a stays-put runtime surface (ADR-0078 §7), read verbatim by the dashboard app.' },
  { file: 'dashboard/app/live-frame-router.js', rationale: 'the `.agentheim/state/` (ADVISORY) and `.agentheim/.dashboard/` (RUNTIME) prefix constants — both stays-put runtime surfaces (ADR-0078 §7) the live-frame router classifies against.' },
  { file: 'dashboard/app/whats-next-state.js', rationale: '`.agentheim/state/whats-next.md` — a stays-put runtime surface (ADR-0078 §7), read verbatim by the dashboard app.' },
];

const WALK_TARGETS = [
  { dir: 'lib', ext: '.mjs' },
  { dir: 'dashboard', ext: '.mjs' },
  { dir: path.join('dashboard', 'app'), ext: '.js' },
];

function listTargetFiles() {
  const out = [];
  for (const { dir, ext } of WALK_TARGETS) {
    const abs = path.join(REPO_ROOT, dir);
    for (const name of readdirSync(abs, { withFileTypes: true })) {
      if (name.isFile() && name.name.endsWith(ext)) {
        out.push(path.join(dir, name.name).split(path.sep).join('/'));
      }
    }
  }
  return out;
}

/** Blank out block comments (JSDoc or decorative), preserving line breaks. */
function stripBlockComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Every non-comment line containing the literal substring `.agentheim`. */
function findAgentheimLines(content) {
  const stripped = stripBlockComments(content);
  const hits = [];
  stripped.split('\n').forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) return;
    if (line.includes('.agentheim')) hits.push({ line: idx + 1, text: line.trim() });
  });
  return hits;
}

const LAYOUT_OVERRIDE_RE = /layout:\s*['"](?:legacy|board)['"]|(?:^|\s)(?:const|let|var)\s+(?:LEGACY|BOARD)\s*=/;

function findLayoutOverrideLines(content) {
  const stripped = stripBlockComments(content);
  const hits = [];
  stripped.split('\n').forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) return;
    if (LAYOUT_OVERRIDE_RE.test(line)) hits.push({ line: idx + 1, text: line.trim() });
  });
  return hits;
}

test('every quoted/template/regex `.agentheim` literal across lib/*.mjs, dashboard/*.mjs, dashboard/app/*.js is in the enumerated ALLOWLIST', () => {
  const allowedFiles = new Set(ALLOWLIST.map((e) => e.file));
  const stray = [];
  for (const relFile of listTargetFiles()) {
    if (allowedFiles.has(relFile)) continue;
    const content = readFileSync(path.join(REPO_ROOT, relFile), 'utf8');
    const hits = findAgentheimLines(content);
    for (const hit of hits) stray.push(`${relFile}:${hit.line}: ${hit.text}`);
  }
  assert.deepEqual(stray, [], `found .agentheim literal(s) outside the ALLOWLIST:\n${stray.join('\n')}`);
});

test('every ALLOWLIST entry still names a file that actually carries a `.agentheim` literal', () => {
  const dead = [];
  for (const entry of ALLOWLIST) {
    const abs = path.join(REPO_ROOT, ...entry.file.split('/'));
    let content;
    try {
      content = readFileSync(abs, 'utf8');
    } catch {
      dead.push(`${entry.file} (unreadable)`);
      continue;
    }
    if (findAgentheimLines(content).length === 0) dead.push(entry.file);
  }
  assert.deepEqual(dead, [], `dead ALLOWLIST entries (no .agentheim literal found): ${dead.join(', ')}`);
});

test('a `layout:` override literal (or the LEGACY/BOARD const form) appears only in lib/layout-migration.mjs (production source; migrate is the sole override caller)', () => {
  const stray = [];
  for (const relFile of listTargetFiles()) {
    if (relFile === 'lib/layout-migration.mjs') continue;
    const content = readFileSync(path.join(REPO_ROOT, relFile), 'utf8');
    const hits = findLayoutOverrideLines(content);
    for (const hit of hits) stray.push(`${relFile}:${hit.line}: ${hit.text}`);
  }
  assert.deepEqual(stray, [], `found a layout-override literal outside lib/layout-migration.mjs:\n${stray.join('\n')}`);
});

test('lib/layout-migration.mjs itself DOES carry the LEGACY/BOARD override literals (sanity — the scan is not vacuously true)', () => {
  const content = readFileSync(path.join(REPO_ROOT, 'lib', 'layout-migration.mjs'), 'utf8');
  const hits = findLayoutOverrideLines(content);
  assert.ok(hits.length >= 2, 'expected at least the LEGACY and BOARD const definitions');
});
