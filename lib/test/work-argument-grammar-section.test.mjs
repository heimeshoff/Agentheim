// Unit tests for lib/work-argument-grammar-section.mjs — the ADR-0059
// enforcement half of ADR-0071's `work` argument grammar
// (agentic-workflow-swj2q, verifier iteration 1). Covers: a present section
// is never flagged, a missing section is flagged, a missing/unreadable file
// is flagged, and the recurring live-tree gate (mirrors
// lib/doctrine-line-pointer.mjs's / lib/id-grammar.mjs's final test): the
// real `skills/work/SKILL.md` must carry the section today.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findArgumentGrammarSectionViolations } from '../work-argument-grammar-section.mjs';

function scratchProject() {
  return mkdtempSync(path.join(tmpdir(), 'aw-arggrammar-'));
}

function writeSkillFile(root, content) {
  const dir = path.join(root, 'skills', 'work');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), content);
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test('a SKILL.md carrying "## Argument grammar" is never flagged', () => {
  const root = scratchProject();
  writeSkillFile(
    root,
    '# Work\n\n## Argument grammar (ADR-0071, agentic-workflow-swj2q)\n\nBare / one id / several ids.\n'
  );
  const violations = findArgumentGrammarSectionViolations(root);
  assert.deepEqual(violations, []);
  cleanup(root);
});

test('a SKILL.md missing the section is flagged', () => {
  const root = scratchProject();
  writeSkillFile(root, '# Work\n\n## Phase 1: Recovery check\n\nNo grammar section here.\n');
  const violations = findArgumentGrammarSectionViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, 'skills/work/SKILL.md');
  cleanup(root);
});

test('a missing SKILL.md file is flagged, not thrown', () => {
  const root = scratchProject();
  const violations = findArgumentGrammarSectionViolations(root);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].file, 'skills/work/SKILL.md');
  cleanup(root);
});

test('a heading that merely mentions "argument grammar" mid-sentence (not a top-level heading) is flagged', () => {
  const root = scratchProject();
  writeSkillFile(
    root,
    '# Work\n\nSee the argument grammar rules described informally below, no heading exists.\n'
  );
  const violations = findArgumentGrammarSectionViolations(root);
  assert.equal(violations.length, 1);
  cleanup(root);
});

// --- the recurring live-tree gate -------------------------------------------
// Mirrors lib/doctrine-line-pointer.mjs's / lib/id-grammar.mjs's final test:
// the LIVE `skills/work/SKILL.md` must carry the "Argument grammar" section
// that the BC README and ADR-0071 both cite by name.

test('the live skills/work/SKILL.md carries the "Argument grammar" section', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const violations = findArgumentGrammarSectionViolations(repoRoot);
  assert.deepEqual(
    violations,
    [],
    `expected the Argument grammar section to be present, found: ${violations
      .map((v) => `${v.file}: ${v.reason}`)
      .join('; ')}`
  );
});
