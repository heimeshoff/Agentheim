// ADR-0078 two-root layout (agentic-workflow-hxq1g): a legacy or mixed
// `.agentheim/` tree must render a clear migration notice instead of an
// empty or half-shaped board. `tree.mjs`'s `migrationPending` flag drives
// this — this is the DOM-level proof that the flag actually reaches the
// rendered board and suppresses every column.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mount, flush, act } from './dom-harness.mjs';

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  close() { this.closed = true; }
  emit(type, data) {
    for (const fn of this.listeners[type] || []) fn({ data });
  }
}
globalThis.EventSource = FakeEventSource;

const MIGRATION_PENDING_TREE = {
  root: '/fake/project',
  layout: 'legacy',
  migrationPending: true,
  project: { name: 'Fake Project' },
  locations: {},
  contexts: [],
  warnings: [],
};

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/api/tree')) {
    return { ok: true, json: async () => MIGRATION_PENDING_TREE, text: async () => JSON.stringify(MIGRATION_PENDING_TREE) };
  }
  return { ok: false, status: 404, text: async () => '', json: async () => null };
};

const { DashboardBoard } = await import('../app/board.js');

test('a migrationPending:true tree renders the layout-migration notice and draws no task columns', async () => {
  const { root, container } = await mount(DashboardBoard);
  try {
    await flush();

    assert.ok(
      container.textContent.includes('Layout migration pending'),
      'the migration-pending notice text must be rendered'
    );
    assert.equal(
      container.querySelectorAll('[data-ticket-id]').length,
      0,
      'no ticket cards should render while migration is pending'
    );
    // No lifecycle column headers ("Backlog"/"Todo"/"Doing"/"Done") either —
    // the board renders ONLY the notice, not an empty-but-present board.
    for (const label of ['Backlog', 'Todo', 'Doing', 'Done']) {
      assert.equal(
        container.textContent.includes(label),
        false,
        `no "${label}" column header should render while migration is pending`
      );
    }
  } finally {
    await act(async () => root.unmount());
  }
});
