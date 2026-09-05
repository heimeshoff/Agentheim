// jsdom DOM-render proof (agentic-workflow-rw6ck) that an ordinary structural
// re-projection — the board's response to a real task-lifecycle move on disk
// — re-renders only the card and columns the move actually touched.
//
// Before this task, `treeToColumns` allocated a fresh ticket object and a
// fresh column array on EVERY call, even when the /api/tree payload was
// byte-for-byte unchanged (a re-fetch always parses a fresh JSON graph). A
// shallow `React.memo` prop compare could never bite: every card's `ticket`
// prop failed reference equality on every re-fetch regardless of whether the
// underlying task actually changed. board-data.js's identity-stable
// `treeToColumns(tree, prev)` reconcile (board-data.test.mjs covers the pure
// logic) is what makes the memoized board components above actually skip a
// render — this test proves the reconcile reaches all the way through the
// real React tree via the live-tree hub, the same shape
// live-tree-hub-e2e.test.mjs already uses for ADR-0070's frame routing.
//
// Uses the render-count PROBE (see board-render-probe-hover.test.mjs's header
// comment for why a DOM-mutation check would be a false green here).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mount, flush, act } from './dom-harness.mjs';

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
    FakeEventSource.instances.push(this);
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  close() { this.closed = true; }
  emit(type, data) {
    for (const fn of this.listeners[type] || []) fn({ data });
  }
}
FakeEventSource.instances = [];
globalThis.EventSource = FakeEventSource;

// All four lifecycle columns populated, so "the two untouched columns render
// 0 times" is a real, checkable claim (not vacuously true for an empty
// column). `moving-1` starts in todo and is moved to doing between the two
// SSE frames below.
function fixture({ movingStatus }) {
  return {
    contexts: [
      {
        name: 'alpha',
        lifecycle: {
          backlog: [
            { id: 'b-1', title: 'Backlog one', status: 'backlog', type: 'feature', context: 'alpha', path: '.agentheim/contexts/alpha/backlog/b-1.md' },
          ],
          todo: movingStatus === 'todo'
            ? [{ id: 'moving-1', title: 'Moving task', status: 'todo', type: 'feature', context: 'alpha', path: '.agentheim/contexts/alpha/todo/moving-1.md' }]
            : [],
          doing: movingStatus === 'doing'
            ? [
              { id: 'd-1', title: 'Doing one', status: 'doing', type: 'feature', context: 'alpha', path: '.agentheim/contexts/alpha/doing/d-1.md' },
              { id: 'moving-1', title: 'Moving task', status: 'doing', type: 'feature', context: 'alpha', path: '.agentheim/contexts/alpha/doing/moving-1.md' },
            ]
            : [{ id: 'd-1', title: 'Doing one', status: 'doing', type: 'feature', context: 'alpha', path: '.agentheim/contexts/alpha/doing/d-1.md' }],
          done: [
            { id: 'done-1', title: 'Done one', status: 'done', type: 'chore', context: 'alpha', path: '.agentheim/contexts/alpha/done/done-1.md' },
            { id: 'done-2', title: 'Done two', status: 'done', type: 'chore', context: 'alpha', path: '.agentheim/contexts/alpha/done/done-2.md' },
          ],
        },
      },
    ],
  };
}

let currentTree = fixture({ movingStatus: 'todo' });

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/api/tree')) {
    // A REAL /api/tree re-fetch always hands back a freshly-parsed JSON
    // graph, never the same object instance twice — clone here so the
    // reconcile is proven against genuinely fresh objects, not an
    // accidentally-shared reference.
    const snapshot = JSON.parse(JSON.stringify(currentTree));
    return { ok: true, json: async () => snapshot, text: async () => JSON.stringify(snapshot) };
  }
  return { ok: false, status: 404, text: async () => '', json: async () => null };
};

const { DashboardBoard } = await import('../app/board.js');

test('an unchanged /api/tree payload re-renders nothing; a payload differing by one task move re-renders exactly that card and its two affected columns', async () => {
  const cardRenders = [];
  const columnRenders = [];
  const renderProbe = {
    card: (id) => cardRenders.push(id),
    column: (status) => columnRenders.push(status),
  };

  const { root, container } = await mount(DashboardBoard, { renderProbe });
  try {
    await flush();
    assert.ok(container.querySelector('[data-ticket-id="moving-1"]'), 'the moving task must be mounted');

    // Reach the constructed source the same way live-tree-hub-e2e.test.mjs
    // does — via the class's own instance-tracking.
    const instance = FakeEventSource.instances[FakeEventSource.instances.length - 1];

    // Reset the probe AFTER mount.
    cardRenders.length = 0;
    columnRenders.length = 0;

    // --- Frame 1: structural frame, tree UNCHANGED on disk -----------------
    instance.emit('tree-changed', JSON.stringify({ type: 'tree-changed', path: '.agentheim/contexts/alpha/todo/unrelated.md' }));
    await flush();

    assert.deepEqual(cardRenders, [], 'an unchanged /api/tree payload must produce ZERO BoardCard renders');
    assert.deepEqual(columnRenders, [], 'an unchanged /api/tree payload must produce ZERO BoardColumn renders');

    // --- Frame 2: the real move, todo -> doing ------------------------------
    currentTree = fixture({ movingStatus: 'doing' });
    instance.emit('tree-changed', JSON.stringify({ type: 'tree-changed', path: '.agentheim/contexts/alpha/todo/moving-1.md' }));
    await flush();

    assert.deepEqual(cardRenders, ['moving-1'], 'exactly one BoardCard (the moved card, in its new column) must render');
    assert.deepEqual(
      columnRenders.slice().sort(),
      ['doing', 'todo'],
      'exactly the source (todo) and destination (doing) BoardColumns must render',
    );
    assert.equal(columnRenders.includes('backlog'), false, 'the untouched backlog column must render zero times');
    assert.equal(columnRenders.includes('done'), false, 'the untouched done column must render zero times');
  } finally {
    await act(async () => root.unmount());
  }
});
