// Tests for the dashboard board's pure hover-dependency resolver
// (agentic-workflow-k5p8w). Given a hovered ticket and the full pooled ticket
// universe (across all four columns/BCs), this turns the RAW, unresolved
// dependsOn/blocks id arrays the /api/tree projection carries (aw-d8q3n,
// ADR-0002) into concrete, directional target-id sets the board can ring.
// Pure, no DOM, no React — mirrors board-sort.js / board-group.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveHoverDependencies } from '../app/board-dependencies.js';

function ticket(overrides) {
  return {
    id: 'x', title: 'x', status: 'todo', context: 'alpha',
    dependsOn: [], blocks: [],
    ...overrides,
  };
}

test('resolveHoverDependencies resolves depends_on targets as waitingOn', () => {
  const hovered = ticket({ id: 'a-002', status: 'todo', dependsOn: ['a-001'] });
  const all = [hovered, ticket({ id: 'a-001' })];
  const { waitingOn, holdingUp } = resolveHoverDependencies(hovered, all);
  assert.ok(waitingOn instanceof Set);
  assert.ok(holdingUp instanceof Set);
  assert.deepEqual([...waitingOn], ['a-001']);
  assert.deepEqual([...holdingUp], []);
});

test('resolveHoverDependencies resolves blocks targets as holdingUp', () => {
  const hovered = ticket({ id: 'a-002', status: 'backlog', blocks: ['a-003'] });
  const all = [hovered, ticket({ id: 'a-003' })];
  const { waitingOn, holdingUp } = resolveHoverDependencies(hovered, all);
  assert.deepEqual([...waitingOn], []);
  assert.deepEqual([...holdingUp], ['a-003']);
});

test('dangling ids (target not in the live universe) are dropped, not thrown', () => {
  const hovered = ticket({ id: 'a-002', status: 'todo', dependsOn: ['ghost-999'], blocks: ['ghost-998'] });
  const all = [hovered];
  const { waitingOn, holdingUp } = resolveHoverDependencies(hovered, all);
  assert.deepEqual([...waitingOn], []);
  assert.deepEqual([...holdingUp], []);
});

test('duplicate ids in dependsOn/blocks are deduped via the returned Set', () => {
  const hovered = ticket({ id: 'a-002', status: 'todo', dependsOn: ['a-001', 'a-001'] });
  const all = [hovered, ticket({ id: 'a-001' })];
  const { waitingOn } = resolveHoverDependencies(hovered, all);
  assert.equal(waitingOn.size, 1);
  assert.ok(waitingOn.has('a-001'));
});

test('the hovered card excludes its own id even if self-referenced', () => {
  const hovered = ticket({ id: 'a-002', status: 'todo', dependsOn: ['a-002'], blocks: ['a-002'] });
  const all = [hovered];
  const { waitingOn, holdingUp } = resolveHoverDependencies(hovered, all);
  assert.deepEqual([...waitingOn], []);
  assert.deepEqual([...holdingUp], []);
});

test('a ticket appearing in both dependsOn and blocks resolves deterministically — waitingOn wins', () => {
  const hovered = ticket({ id: 'a-002', status: 'todo', dependsOn: ['a-001'], blocks: ['a-001'] });
  const all = [hovered, ticket({ id: 'a-001' })];
  const { waitingOn, holdingUp } = resolveHoverDependencies(hovered, all);
  assert.ok(waitingOn.has('a-001'));
  assert.ok(!holdingUp.has('a-001'));
});

test('only backlog/todo hover sources trigger resolution — doing/done yield two empty sets', () => {
  const all = [ticket({ id: 'a-001' })];
  for (const status of ['doing', 'done']) {
    const hovered = ticket({ id: 'a-002', status, dependsOn: ['a-001'], blocks: ['a-001'] });
    const { waitingOn, holdingUp } = resolveHoverDependencies(hovered, [hovered, ...all]);
    assert.deepEqual([...waitingOn], [], `status ${status} should not resolve waitingOn`);
    assert.deepEqual([...holdingUp], [], `status ${status} should not resolve holdingUp`);
  }
});

test('a ticket with neither dependsOn nor blocks entries yields two empty sets', () => {
  const hovered = ticket({ id: 'a-002', status: 'backlog' });
  const all = [hovered, ticket({ id: 'a-001' })];
  const { waitingOn, holdingUp } = resolveHoverDependencies(hovered, all);
  assert.deepEqual([...waitingOn], []);
  assert.deepEqual([...holdingUp], []);
});

test('multiple entries in either direction all resolve when present in the live universe', () => {
  const hovered = ticket({
    id: 'a-002', status: 'todo',
    dependsOn: ['a-001', 'a-000'],
    blocks: ['a-003', 'a-004'],
  });
  const all = [
    hovered,
    ticket({ id: 'a-001' }), ticket({ id: 'a-000' }),
    ticket({ id: 'a-003' }), ticket({ id: 'a-004' }),
  ];
  const { waitingOn, holdingUp } = resolveHoverDependencies(hovered, all);
  assert.deepEqual([...waitingOn].sort(), ['a-000', 'a-001']);
  assert.deepEqual([...holdingUp].sort(), ['a-003', 'a-004']);
});

test('degrades to two empty sets for a null/undefined hovered ticket, never a throw', () => {
  const all = [ticket({ id: 'a-001' })];
  const result = resolveHoverDependencies(null, all);
  assert.deepEqual([...result.waitingOn], []);
  assert.deepEqual([...result.holdingUp], []);
  const result2 = resolveHoverDependencies(undefined, all);
  assert.deepEqual([...result2.waitingOn], []);
  assert.deepEqual([...result2.holdingUp], []);
});

test('degrades to two empty sets for a null/non-array allTickets, never a throw', () => {
  const hovered = ticket({ id: 'a-002', status: 'todo', dependsOn: ['a-001'] });
  const result = resolveHoverDependencies(hovered, null);
  assert.deepEqual([...result.waitingOn], []);
  assert.deepEqual([...result.holdingUp], []);
});
