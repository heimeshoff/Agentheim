// Live-tree lint (temporary form, agentic-workflow-cj54k): the nine `lib/`
// modules `lib/task-system-paths.mjs` re-points must carry ZERO inline
// `.agentheim/contexts/...` or `.agentheim/knowledge/protocol.md`-shaped path
// joins any more — every path construction routes through the path module
// instead (ADR-0059's mechanize-or-drop doctrine: a re-point without an
// enforcing lint is a convention that silently rots).
//
// Scans for exactly two literal shapes, both of which only ever appeared as
// `path.join(...)` arguments before this task:
//   - the quoted string `'contexts'` (a path segment quoted either way);
//   - the quoted-pair `'knowledge', 'protocol'` (immediately adjacent
//     `path.join` arguments building `.../knowledge/protocol.md`).
// This is the TEMPORARY, enumerated-file-list form of the lint —
// agentic-workflow-zgav8 widens it to a permanent, tree-wide scan.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RE_POINTED_FILES = [
  'task-lifecycle.mjs',
  'task-lifecycle-capture-dismiss.mjs',
  'task-lifecycle-cli.mjs',
  'index-rotation.mjs',
  'protocol-rotation.mjs',
  'index-entry-length.mjs',
  'duplicate-id-check.mjs',
  'human-eye-criteria.mjs',
  'spike-stop-loss.mjs',
];

const CONTEXTS_SEGMENT_RE = /'contexts'|"contexts"/;
const KNOWLEDGE_PROTOCOL_PAIR_RE = /['"]knowledge['"]\s*,\s*['"]protocol/;

/** Scan one file's raw text for either forbidden literal shape, one violation per matching line. */
function findLiteralViolations(absFile, relFile) {
  const content = readFileSync(absFile, 'utf8');
  const violations = [];
  content.split(/\r?\n/).forEach((line, i) => {
    if (CONTEXTS_SEGMENT_RE.test(line)) {
      violations.push({ file: relFile, line: i + 1, match: 'contexts', text: line.trim() });
    }
    if (KNOWLEDGE_PROTOCOL_PAIR_RE.test(line)) {
      violations.push({ file: relFile, line: i + 1, match: "knowledge','protocol", text: line.trim() });
    }
  });
  return violations;
}

test('the nine re-pointed lib/ modules carry zero inline \'contexts\' or \'knowledge\',\'protocol\' path-segment literals', () => {
  const libDir = path.dirname(fileURLToPath(new URL('../task-system-paths.mjs', import.meta.url)));
  const violations = [];
  for (const relFile of RE_POINTED_FILES) {
    violations.push(...findLiteralViolations(path.join(libDir, relFile), relFile));
  }
  assert.deepEqual(
    violations,
    [],
    `expected zero inline path-segment literals, found: ${violations
      .map((v) => `${v.file}:${v.line} (${v.match}) -- ${v.text}`)
      .join('; ')}`
  );
});

test('the lint\'s regexes actually match the forbidden shapes (proves the live-tree test above is not passing vacuously)', () => {
  assert.ok(CONTEXTS_SEGMENT_RE.test("path.join(rootDir, '.agentheim', 'contexts', bc)"));
  assert.ok(KNOWLEDGE_PROTOCOL_PAIR_RE.test("path.join(rootDir, '.agentheim', 'knowledge', 'protocol.md')"));
  assert.equal(CONTEXTS_SEGMENT_RE.test("path.join(rootDir, '.agentheim', 'board', bc)"), false);
});
