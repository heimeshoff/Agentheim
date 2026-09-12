// Unit tests for lib/legacy-path-literal-lint.mjs — the ADR-0078 sweep's
// permanent live-tree lint (agentic-workflow-zgav8, hardened to refuse a
// detected legacy/mixed tree by agentic-workflow-g5ez5), mirroring
// lib/doctrine-line-pointer.mjs's test shape (ADR-0069): each forbidden
// shape gets flagged in isolation, the ALLOWLIST and the BC-README-only
// `<!-- legacy-path-ok -->` marker suppress exactly what they should (and
// nothing else), a detected legacy/mixed repo root throws rather than scans,
// a no-dead-ALLOWLIST-entry check, and the recurring live-tree gate: the
// merged tree must have zero non-allowlisted legacy path literals.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findLegacyPathViolations, ALLOWLIST } from '../legacy-path-literal-lint.mjs';

function scratchProject(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function write(root, relPath, content) {
  const full = path.join(root, relPath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

/** Minimal legacy-shaped `.agentheim/` marker so `detectLayout` resolves `'legacy'`. */
function markLegacy(root) {
  mkdirSync(path.join(root, '.agentheim', 'contexts'), { recursive: true });
}

/** Minimal board-shaped `.agentheim/` marker so `detectLayout` resolves `'board'`. */
function markBoard(root) {
  mkdirSync(path.join(root, '.agentheim', 'board'), { recursive: true });
}

// --- Forbidden shapes (a)-(g), one file each, exactly one violation apiece ---

test('shape (a) `.agentheim/contexts/` is flagged', () => {
  const root = scratchProject('aw-legacy-lint-a-');
  write(root, 'skills/work/SKILL.md', 'See `.agentheim/contexts/<bc>/README.md` for the shape.\n');
  const violations = findLegacyPathViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, 'skills/work/SKILL.md');
  assert.equal(violations[0].line, 1);
  assert.equal(violations[0].match, '.agentheim/contexts/');
  cleanup(root);
});

test('shape (b) a lifecycle folder under `contexts/<bc>/` is flagged unconditionally (no `.agentheim/` prefix needed)', () => {
  const root = scratchProject('aw-legacy-lint-b-');
  write(root, 'skills/modeling/SKILL.md', 'Files live under `contexts/widgets/todo/<id>.md`.\n');
  const violations = findLegacyPathViolations(root);
  assert.equal(violations.length, 1);
  assert.match(violations[0].match, /contexts\/widgets\/todo\//);
  cleanup(root);
});

test('shape (c) the bare wildcard `contexts/*/` is flagged (isolated from shape (b) by not naming a lifecycle folder)', () => {
  const root = scratchProject('aw-legacy-lint-c-');
  write(root, 'skills/whats-next/SKILL.md', 'Each `contexts/*/README.md` line count is a cheap check.\n');
  const violations = findLegacyPathViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].match, 'contexts/*/');
  cleanup(root);
});

test('shape (d) `.agentheim/vision.md` is flagged', () => {
  const root = scratchProject('aw-legacy-lint-d-');
  write(root, 'skills/brainstorm/SKILL.md', 'Check `.agentheim/vision.md` first.\n');
  const violations = findLegacyPathViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].match, '.agentheim/vision.md');
  cleanup(root);
});

test('shape (e) `.agentheim/context-map.md` is flagged', () => {
  const root = scratchProject('aw-legacy-lint-e-');
  write(root, 'skills/brainstorm/SKILL.md', 'Read `.agentheim/context-map.md` too.\n');
  const violations = findLegacyPathViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].match, '.agentheim/context-map.md');
  cleanup(root);
});

test('shape (f) `knowledge/protocol` is flagged (catches both protocol.md and the archive dir)', () => {
  const root = scratchProject('aw-legacy-lint-f-');
  write(root, 'skills/research/SKILL.md', 'Log to `.agentheim/knowledge/protocol.md`.\n');
  const violations = findLegacyPathViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].match, 'knowledge/protocol');
  cleanup(root);
});

test('shape (g1) a quoted `path.join` \'contexts\' segment is flagged in lib/ and dashboard/ only', () => {
  const root = scratchProject('aw-legacy-lint-g1-');
  write(root, 'lib/some-module.mjs', "const dir = path.join(rootDir, '.agentheim', 'contexts', bc);\n");
  const violations = findLegacyPathViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, 'lib/some-module.mjs');
  assert.equal(violations[0].match, "'contexts'");
  cleanup(root);
});

test('shape (g2) an adjacent `\'knowledge\', \'protocol` `path.join` pair is flagged in lib/ and dashboard/ only', () => {
  const root = scratchProject('aw-legacy-lint-g2-');
  write(root, 'dashboard/some-module.mjs', "const p = path.join(rootDir, '.agentheim', 'knowledge', 'protocol.md');\n");
  const violations = findLegacyPathViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, 'dashboard/some-module.mjs');
  assert.match(violations[0].match, /'knowledge', 'protocol/);
  cleanup(root);
});

test('shape (g) is NOT applied outside lib/ and dashboard/ — a quoted "contexts" in skills/ prose is not this shape', () => {
  const root = scratchProject('aw-legacy-lint-g-scope-');
  write(root, 'skills/work/SKILL.md', 'The word "contexts" appears here with no path at all.\n');
  const violations = findLegacyPathViolations(root);
  assert.deepEqual(violations, []);
  cleanup(root);
});

// --- Bare `contexts/<bc>/INDEX.md` / `README.md` (no `.agentheim/` prefix, no lifecycle folder) is allowed ---

test('a bare `contexts/<bc>/INDEX.md` (correct relative link under board layout) is never flagged', () => {
  const root = scratchProject('aw-legacy-lint-bare-index-');
  write(root, 'skills/modeling/SKILL.md', 'See `contexts/<bc-name>/INDEX.md` for the per-BC catalog.\n');
  const violations = findLegacyPathViolations(root);
  assert.deepEqual(violations, []);
  cleanup(root);
});

// --- ALLOWLIST -------------------------------------------------------------

test('an explicit ALLOWLIST entry suppresses a specific occurrence', () => {
  const root = scratchProject('aw-legacy-lint-allow-');
  write(root, 'skills/work/SKILL.md', 'Fixture line carrying .agentheim/vision.md for allowlist testing.\n');
  const originalLength = ALLOWLIST.length;
  ALLOWLIST.push({
    file: 'skills/work/SKILL.md',
    match: 'Fixture line carrying .agentheim/vision.md for allowlist testing.',
    rationale: 'test-only fixture entry, removed immediately after assertion',
  });
  try {
    const violations = findLegacyPathViolations(root);
    assert.deepEqual(violations, []);
  } finally {
    ALLOWLIST.length = originalLength;
  }
  cleanup(root);
});

// --- `<!-- legacy-path-ok -->` marker — BC READMEs only ---------------------

test('the `<!-- legacy-path-ok -->` marker suppresses a violation on a BC README line', () => {
  const root = scratchProject('aw-legacy-lint-marker-readme-');
  markBoard(root);
  write(
    root,
    '.agentheim/knowledge/contexts/widgets/README.md',
    '# Widgets\n\n- **Layout** — legacy: `.agentheim/contexts/<bc>/...` <!-- legacy-path-ok -->\n'
  );
  const violations = findLegacyPathViolations(root);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('the same marker OUTSIDE a BC README does not suppress — the line is still a violation', () => {
  const root = scratchProject('aw-legacy-lint-marker-outside-');
  write(
    root,
    'skills/work/SKILL.md',
    'Legacy shape: `.agentheim/contexts/<bc>/...` <!-- legacy-path-ok -->\n'
  );
  const violations = findLegacyPathViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, 'skills/work/SKILL.md');
  cleanup(root);
});

// --- legacy/mixed refusal (agentic-workflow-g5ez5, ADR-0078 §5 2nd phase) ---
// The layout-gated styleguide-import tolerance (hxq1g's transitional carve-out
// for the 20 literal `dashboard/app/*.js` specifiers) is GONE — a detected
// legacy or mixed repo root is now a lint FAILURE, not a partial scan that
// happens to tolerate one more shape.

test('findLegacyPathViolations throws a structured "legacy-layout" error on a detected legacy repo root', () => {
  const root = scratchProject('aw-legacy-lint-legacy-refusal-');
  markLegacy(root);
  write(root, 'skills/work/SKILL.md', 'Nothing forbidden here.\n');
  assert.throws(() => findLegacyPathViolations(root), (err) => err.code === 'legacy-layout');
  cleanup(root);
});

test('findLegacyPathViolations throws a structured "mixed-layout" error on a mixed repo root', () => {
  const root = scratchProject('aw-legacy-lint-mixed-refusal-');
  markLegacy(root);
  markBoard(root);
  write(root, 'skills/work/SKILL.md', 'Nothing forbidden here.\n');
  assert.throws(() => findLegacyPathViolations(root), (err) => err.code === 'mixed-layout');
  cleanup(root);
});

// --- ALLOWLIST hygiene: no dead entry ---------------------------------------
// A dead exemption (naming a file/match no longer present) is itself a lint
// failure — the list can never silently go stale (agentic-workflow-g5ez5).

test('every ALLOWLIST entry still matches at least one line in its named file', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const dead = [];
  for (const entry of ALLOWLIST) {
    const abs = path.join(repoRoot, ...entry.file.split('/'));
    let content;
    try {
      content = readFileSync(abs, 'utf8');
    } catch {
      dead.push(`${entry.file} (unreadable)`);
      continue;
    }
    const lines = content.split(/\r?\n/);
    if (!lines.some((l) => l.includes(entry.match))) {
      dead.push(`${entry.file}: "${entry.match}"`);
    }
  }
  assert.deepEqual(dead, [], `dead ALLOWLIST entries (no matching line found): ${dead.join('; ')}`);
});

// --- The recurring live-tree gate -------------------------------------------
// Mirrors lib/doctrine-line-pointer.mjs's / lib/id-grammar.mjs's final test:
// the sweep's closure rule — the merged tree (with this repo's `.agentheim/`
// still `legacy`) must have zero non-allowlisted legacy path literals. No
// separate hand count; this IS the acceptance criterion.

test("findLegacyPathViolations(<repo root>) returns [] on the merged tree, this repo's .agentheim/ now board (6fbaad2)", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const violations = findLegacyPathViolations(repoRoot);
  assert.deepEqual(
    violations,
    [],
    `expected no legacy path literals, found: ${violations
      .map((v) => `${v.file}:${v.line} (${v.match})`)
      .join('; ')}`
  );
});
