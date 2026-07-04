// Tests for lib/id-grammar.mjs — the ADR-0028 §1 grammar's single source of
// truth (ADR-0044): classification, well-formedness, and the live-tree lint.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifyTaskId,
  isWellFormedTaskId,
  findMalformedTaskIds,
  GRANDFATHERED_IDS,
} from '../id-grammar.mjs';

// --- classifyTaskId ---------------------------------------------------------

test('classifyTaskId: a well-formed leading-letter token classifies "token"', () => {
  assert.equal(classifyTaskId('agentic-workflow-k3f9q'), 'token');
});

test('classifyTaskId: a legacy all-digit tail classifies "legacy"', () => {
  assert.equal(classifyTaskId('agentic-workflow-077'), 'legacy');
  assert.equal(classifyTaskId('design-system-001'), 'legacy');
});

test('classifyTaskId: the real grandfathered out-of-spec id classifies "malformed"', () => {
  // infrastructure-5w5gs leads with a digit — malformed under the STRICT
  // grammar even though deriveContext (the forgiving resolver) accepts it.
  // Grandfathering is a separate concern, checked by findMalformedTaskIds, not
  // by classifyTaskId itself.
  assert.equal(classifyTaskId('infrastructure-5w5gs'), 'malformed');
});

test('classifyTaskId: the look-alike `u` is out of charset -> "malformed"', () => {
  assert.equal(classifyTaskId('agentic-workflow-uuuuu'), 'malformed');
});

test('classifyTaskId: a 6-char tail is the wrong length -> "malformed"', () => {
  assert.equal(classifyTaskId('agentic-workflow-3f9qxz'), 'malformed');
});

test('classifyTaskId: no recognizable tail -> "malformed"', () => {
  assert.equal(classifyTaskId('nodashhere'), 'malformed');
});

// --- isWellFormedTaskId ------------------------------------------------------

test('isWellFormedTaskId: true for token and legacy shapes, false for malformed', () => {
  assert.equal(isWellFormedTaskId('agentic-workflow-k3f9q'), true);
  assert.equal(isWellFormedTaskId('agentic-workflow-077'), true);
  assert.equal(isWellFormedTaskId('infrastructure-5w5gs'), false);
  assert.equal(isWellFormedTaskId('agentic-workflow-uuuuu'), false);
});

// --- GRANDFATHERED_IDS --------------------------------------------------------

test('GRANDFATHERED_IDS is frozen and lists exactly infrastructure-5w5gs (ADR-0028 §5)', () => {
  assert.deepEqual(GRANDFATHERED_IDS, ['infrastructure-5w5gs']);
  assert.equal(Object.isFrozen(GRANDFATHERED_IDS), true);
});

// --- findMalformedTaskIds: the recurring live-tree gate ---------------------
// Mirrors agentic-workflow-080's final live-tree duplicate-id test: the LIVE
// .agentheim/ tree must have zero non-grandfathered malformed ids.

test('the live .agentheim/ tree has NO malformed task ids beyond the grandfathered allowlist', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const malformed = findMalformedTaskIds(repoRoot);
  assert.deepEqual(
    malformed,
    [],
    `expected no non-grandfathered malformed ids, found: ${malformed.join(', ')}`
  );
});
