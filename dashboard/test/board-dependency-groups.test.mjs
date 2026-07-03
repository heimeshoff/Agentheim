// Tests for the dashboard board's pure hidden-dependency group derivation
// (agentic-workflow-h9v3m). Given a hover session's resolved dependency
// target ids (agentic-workflow-k5p8w's waitingOn/holdingUp), this decides
// which COLLAPSED board sections and which peeked Done column currently hide
// a target — a data-layer answer geometry cannot give, since a closed
// Collapsible renders no body (ADR-0033 pt. 3). Mirrors
// rail-attention.annotateGroups's "propagate a flag to a possibly-collapsed
// header" shape. Also carries the one pure rect-math helper
// (classifyEdge) the off-viewport edge-blink DOM glue calls into.
// Pure, no DOM, no React — mirrors board-group.js / board-dependencies.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  annotateSectionHiddenDependency,
  donePeekHasHiddenDependency,
  unionTargetIds,
  classifyEdge,
} from '../app/board-dependency-groups.js';
import { groupTickets } from '../app/board-group.js';

function ticket(id, context = 'alpha') {
  return { id, title: id, status: 'backlog', context };
}

// ---- annotateSectionHiddenDependency ----

test('a COLLAPSED section holding a target id is flagged hasHiddenDependency', () => {
  const sections = groupTickets(
    [ticket('a-001', 'alpha'), ticket('a-002', 'alpha'), ticket('b-001', 'beta')],
    { grouped: true, collapsed: ['alpha'] },
  );
  const out = annotateSectionHiddenDependency(sections, new Set(['a-002']));
  const alpha = out.find((s) => s.bc === 'alpha');
  const beta = out.find((s) => s.bc === 'beta');
  assert.equal(alpha.hasHiddenDependency, true);
  assert.equal(beta.hasHiddenDependency, false);
});

test('an OPEN section holding a target id is NOT flagged — it has a real DOM node instead', () => {
  const sections = groupTickets(
    [ticket('a-001', 'alpha')],
    { grouped: true, collapsed: [] },
  );
  const out = annotateSectionHiddenDependency(sections, new Set(['a-001']));
  assert.equal(out[0].hasHiddenDependency, false);
});

test('a collapsed section with no target id inside is not flagged', () => {
  const sections = groupTickets(
    [ticket('a-001', 'alpha')],
    { grouped: true, collapsed: ['alpha'] },
  );
  const out = annotateSectionHiddenDependency(sections, new Set(['ghost-999']));
  assert.equal(out[0].hasHiddenDependency, false);
});

test('accepts a plain array of target ids as well as a Set', () => {
  const sections = groupTickets([ticket('a-001', 'alpha')], { grouped: true, collapsed: ['alpha'] });
  const out = annotateSectionHiddenDependency(sections, ['a-001']);
  assert.equal(out[0].hasHiddenDependency, true);
});

test('preserves every other section field byte-identically (count, tickets, bc)', () => {
  const sections = groupTickets([ticket('a-001', 'alpha')], { grouped: true, collapsed: [] });
  const out = annotateSectionHiddenDependency(sections, new Set());
  assert.equal(out[0].bc, 'alpha');
  assert.equal(out[0].count, 1);
  assert.deepEqual(out[0].tickets, sections[0].tickets);
});

test('degrades to [] for a non-array sections input, never a throw', () => {
  assert.deepEqual(annotateSectionHiddenDependency(null, new Set(['a'])), []);
  assert.deepEqual(annotateSectionHiddenDependency(undefined, new Set(['a'])), []);
});

test('degrades to false flags for a missing/malformed target-id set, never a throw', () => {
  const sections = groupTickets([ticket('a-001', 'alpha')], { grouped: true, collapsed: ['alpha'] });
  const out = annotateSectionHiddenDependency(sections, null);
  assert.equal(out[0].hasHiddenDependency, false);
});

// ---- donePeekHasHiddenDependency ----

test('flags true when Done is peeked AND holds at least one target id', () => {
  const done = [ticket('a-001'), ticket('a-002')];
  assert.equal(donePeekHasHiddenDependency(done, new Set(['a-002']), true), true);
});

test('flags false when Done is peeked but holds no target id', () => {
  const done = [ticket('a-001')];
  assert.equal(donePeekHasHiddenDependency(done, new Set(['ghost-999']), true), false);
});

test('flags false when Done holds a target id but is NOT peeked (expanded)', () => {
  const done = [ticket('a-001')];
  assert.equal(donePeekHasHiddenDependency(done, new Set(['a-001']), false), false);
});

test('degrades to false for malformed inputs, never a throw', () => {
  assert.equal(donePeekHasHiddenDependency(null, new Set(['a']), true), false);
  assert.equal(donePeekHasHiddenDependency([ticket('a-001')], null, true), false);
  assert.equal(donePeekHasHiddenDependency([ticket('a-001')], new Set(['a-001']), undefined), false);
});

// ---- unionTargetIds ----

test('unions waitingOn and holdingUp into one Set, deduped', () => {
  const out = unionTargetIds(new Set(['a-001', 'a-002']), new Set(['a-002', 'a-003']));
  assert.deepEqual([...out].sort(), ['a-001', 'a-002', 'a-003']);
});

test('unionTargetIds degrades to an empty Set for missing/malformed inputs', () => {
  assert.deepEqual([...unionTargetIds(null, undefined)], []);
  assert.deepEqual([...unionTargetIds(['a-001'], null)], ['a-001']);
});

// ---- classifyEdge ----

test('classifyEdge returns "above" when the rect sits entirely above the root bounds', () => {
  assert.equal(classifyEdge({ top: -200, bottom: -50 }, { top: 0, bottom: 600 }), 'above');
});

test('classifyEdge returns "below" when the rect sits entirely below the root bounds', () => {
  assert.equal(classifyEdge({ top: 700, bottom: 800 }, { top: 0, bottom: 600 }), 'below');
});

test('classifyEdge returns "visible" when the rect overlaps the root bounds', () => {
  assert.equal(classifyEdge({ top: 100, bottom: 200 }, { top: 0, bottom: 600 }), 'visible');
});

test('classifyEdge returns "visible" when the rect fully contains the root bounds', () => {
  assert.equal(classifyEdge({ top: -50, bottom: 700 }, { top: 0, bottom: 600 }), 'visible');
});

test('a rect exactly touching the root\'s top edge (no overlap) classifies as above', () => {
  assert.equal(classifyEdge({ top: -100, bottom: 0 }, { top: 0, bottom: 600 }), 'above');
});

test('a rect exactly touching the root\'s bottom edge (no overlap) classifies as below', () => {
  assert.equal(classifyEdge({ top: 600, bottom: 700 }, { top: 0, bottom: 600 }), 'below');
});

test('classifyEdge degrades to "visible" for malformed/missing rect or rootBounds, never a throw', () => {
  assert.equal(classifyEdge(null, { top: 0, bottom: 600 }), 'visible');
  assert.equal(classifyEdge({ top: 10, bottom: 20 }, null), 'visible');
  assert.equal(classifyEdge(undefined, undefined), 'visible');
});
