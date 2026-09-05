// Table-driven tests for the pure live-frame classifier (agentic-workflow-mvt8x,
// ADR-0070). See live-frame-router.js's header comment for the category
// definitions; this suite just locks the boundary cases, including fail-open.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyFramePath, FRAME_CATEGORY } from '../app/live-frame-router.js';

const CASES = [
  ['.agentheim/state/in-flight.json', FRAME_CATEGORY.ADVISORY],
  ['.agentheim/state/whats-next.md', FRAME_CATEGORY.ADVISORY],
  ['.agentheim/contexts/agentic-workflow/todo/x.md', FRAME_CATEGORY.STRUCTURAL],
  ['.agentheim/knowledge/decisions/0006-dashboard-live-update-sse.md', FRAME_CATEGORY.STRUCTURAL],
  ['.agentheim/.dashboard/runtime.json', FRAME_CATEGORY.RUNTIME],
  [null, FRAME_CATEGORY.STRUCTURAL],
  [undefined, FRAME_CATEGORY.STRUCTURAL],
  [{}, FRAME_CATEGORY.STRUCTURAL],
  [42, FRAME_CATEGORY.STRUCTURAL],
  ['', FRAME_CATEGORY.STRUCTURAL],
  ['outside/.agentheim/state/whats-next.md', FRAME_CATEGORY.STRUCTURAL],
  ['README.md', FRAME_CATEGORY.STRUCTURAL],
];

for (const [path, expected] of CASES) {
  test(`classifyFramePath(${JSON.stringify(path)}) -> ${expected}`, () => {
    assert.equal(classifyFramePath(path), expected);
  });
}

test('a malformed/unrecognized/non-string path fails OPEN to structural, never advisory or runtime (ADR-0070 §4)', () => {
  for (const bad of [null, undefined, {}, 42, [], true, '']) {
    assert.equal(classifyFramePath(bad), FRAME_CATEGORY.STRUCTURAL);
  }
});

test('the three categories are mutually exclusive string constants', () => {
  const values = Object.values(FRAME_CATEGORY);
  assert.equal(new Set(values).size, values.length);
});
