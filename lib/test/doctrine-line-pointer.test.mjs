// Unit tests for lib/doctrine-line-pointer.mjs — the audit-closure doctrine's
// (ADR-0069, agentic-workflow-f3wqm) live-tree lint banning raw line-number
// pointers in doctrine prose. Covers: each recognized raw-pointer shape gets
// flagged, a greppable anchor reference (step/section name) is never
// flagged, an explicit allowlist entry suppresses a specific occurrence, and
// the recurring live-tree gate (mirrors lib/index-entry-length.mjs's and
// lib/id-grammar.mjs's final test): the real skills/agents/references tree
// must have zero non-allowlisted raw-pointer violations today.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findLinePointerViolations, ALLOWLIST } from '../doctrine-line-pointer.mjs';

function scratchProject() {
  const root = mkdtempSync(path.join(tmpdir(), 'aw-linepointer-'));
  return root;
}

function write(root, relPath, content) {
  const full = path.join(root, relPath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test('a `~:NNN` raw line-number pointer in skills/ prose is flagged', () => {
  const root = scratchProject();
  write(root, 'skills/work/SKILL.md', 'See `references/foo.md` ~:45 for the rule.\n');
  const violations = findLinePointerViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, 'skills/work/SKILL.md');
  assert.equal(violations[0].line, 1);
  assert.equal(violations[0].match, '~:45');
  cleanup(root);
});

test('a `~:NNN-NNN` ranged pointer in agents/ prose is flagged', () => {
  const root = scratchProject();
  write(root, 'agents/worker.md', 'The rule lives at `foo.mjs` ~:66-69.\n');
  const violations = findLinePointerViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, 'agents/worker.md');
  cleanup(root);
});

test('a `(:NNN-NNN)` parenthetical pointer in references/ prose is flagged', () => {
  const root = scratchProject();
  write(root, 'references/commit-doctrine.md', 'See the header (:428-431) for detail.\n');
  const violations = findLinePointerViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, 'references/commit-doctrine.md');
  cleanup(root);
});

test('a bare `file.md:NNN` pointer is flagged', () => {
  const root = scratchProject();
  write(root, 'skills/modeling/SKILL.md', 'See SKILL.md:120 for the step.\n');
  const violations = findLinePointerViolations(root);
  assert.equal(violations.length, 1);
  cleanup(root);
});

test('a GitHub-style `#L123` anchor is flagged', () => {
  const root = scratchProject();
  write(root, 'references/id-grammar.md', 'See lib/id-grammar.mjs#L123 for the check.\n');
  const violations = findLinePointerViolations(root);
  assert.equal(violations.length, 1);
  cleanup(root);
});

test('a greppable anchor reference (step / section name) is never flagged', () => {
  const root = scratchProject();
  write(
    root,
    'skills/work/SKILL.md',
    'See `skills/work/SKILL.md` Phase 3 step 4 for the rationale, or ' +
      '"Runner-first step 2" in the TDD skill.\n'
  );
  const violations = findLinePointerViolations(root);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('files outside skills/, agents/, references/ are never scanned', () => {
  const root = scratchProject();
  write(root, 'lib/some-lib.mjs', '// stale pointer ~:99, not scanned here\n');
  const violations = findLinePointerViolations(root);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('an explicit ALLOWLIST entry suppresses a specific occurrence', () => {
  const root = scratchProject();
  write(root, 'skills/work/SKILL.md', 'Fixture line carrying ~:1 for allowlist testing.\n');
  const originalLength = ALLOWLIST.length;
  ALLOWLIST.push({
    file: 'skills/work/SKILL.md',
    match: 'Fixture line carrying ~:1 for allowlist testing.',
    rationale: 'test-only fixture entry, removed immediately after assertion',
  });
  try {
    const violations = findLinePointerViolations(root);
    assert.deepEqual(violations, []);
  } finally {
    ALLOWLIST.length = originalLength;
  }
  cleanup(root);
});

// --- the recurring live-tree gate -------------------------------------------
// Mirrors lib/index-entry-length.mjs's / lib/id-grammar.mjs's final test: the
// LIVE skills/, agents/, references/ tree must have zero non-allowlisted raw
// line-number pointers. This is what proves the tree is green today.

test('the live skills/agents/references tree has NO non-allowlisted raw line-number pointers', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const violations = findLinePointerViolations(repoRoot);
  assert.deepEqual(
    violations,
    [],
    `expected no raw line-number pointers, found: ${violations
      .map((v) => `${v.file}:${v.line} (${v.match})`)
      .join('; ')}`
  );
});
