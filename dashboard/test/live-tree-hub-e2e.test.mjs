// End-to-end proof, driven through jsdom (agentic-workflow-mvt8x, ADR-0070),
// that the live-tree hub's routing reaches all the way through the REAL React
// tree — not just the isolated hub core (live-update-hub.test.mjs) or the
// board's own source-reading guards. Mounting the whole app (board + rail +
// WhatsNextPanel + InFlightLane, all inside DashboardApp) constructs exactly
// ONE EventSource; a structural frame issues exactly one /api/tree fetch and
// zero /api/doc fetches; an advisory frame naming ONE artifact issues zero
// /api/tree fetches and exactly one matching /api/doc fetch. That last
// assertion is the direct proof of the parent's "an in-flight heartbeat write
// does not re-render the board's cards" — the board issues no fetch at all, so
// it cannot re-project.
//
// globalThis.EventSource is set to a counting fake BEFORE board.js is
// imported (its module-level live-tree hub is constructed at import time),
// and fetch is stubbed per-URL — the same dependency-injection idiom
// WhatsNextPanel/InFlightLane already use for fetchDoc, just at the ambient
// global level since the hub's production defaults read `EventSource`/`fetch`
// directly (dom-harness.mjs's own header comment: import it FIRST).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mount, flush, act, dom } from './dom-harness.mjs';

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
    FakeEventSource.instances.push(this);
    FakeEventSource.constructions += 1;
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  close() { this.closed = true; }
  emit(type, data) {
    for (const fn of this.listeners[type] || []) fn({ data });
  }
}
FakeEventSource.instances = [];
FakeEventSource.constructions = 0;
globalThis.EventSource = FakeEventSource;

const EMPTY_TREE = { project: { name: 'Agentheim' }, contexts: [] };

const calls = { tree: 0, doc: {} };
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/api/tree')) {
    calls.tree += 1;
    return { ok: true, json: async () => EMPTY_TREE, text: async () => JSON.stringify(EMPTY_TREE) };
  }
  if (u.includes('/api/doc')) {
    const key = u.includes('in-flight.json') ? 'in-flight' : u.includes('whats-next.md') ? 'whats-next' : 'other';
    calls.doc[key] = (calls.doc[key] || 0) + 1;
    return { ok: false, status: 404, text: async () => '' };
  }
  return { ok: false, status: 404, text: async () => '', json: async () => null };
};

const { DashboardApp } = await import('../app/board.js');

test('mounting the app opens exactly one EventSource; a structural frame issues one /api/tree and zero /api/doc; an advisory frame issues zero /api/tree and exactly one matching /api/doc', async () => {
  const { root } = await mount(DashboardApp);
  try {
    await flush();

    assert.equal(
      FakeEventSource.constructions,
      1,
      'mounting the app (board + rail + WhatsNextPanel + InFlightLane) constructs exactly one EventSource for the whole tab',
    );
    const src = FakeEventSource.instances[FakeEventSource.instances.length - 1];

    // Reset the mount-time fetch counts (initial tree load + each panel's own
    // initial /api/doc read) — the assertions below are about FRAME-triggered
    // fetches only.
    calls.tree = 0;
    calls.doc = {};

    src.emit('tree-changed', JSON.stringify({ type: 'tree-changed', path: '.agentheim/contexts/agentic-workflow/todo/x-1.md' }));
    await flush();
    assert.equal(calls.tree, 1, 'a structural frame issues exactly one /api/tree fetch');
    assert.equal(calls.doc['in-flight'] || 0, 0, 'a structural frame issues zero /api/doc fetches for in-flight.json');
    assert.equal(calls.doc['whats-next'] || 0, 0, 'a structural frame issues zero /api/doc fetches for whats-next.md');

    calls.tree = 0;
    calls.doc = {};

    src.emit('tree-changed', JSON.stringify({ type: 'tree-changed', path: '.agentheim/state/in-flight.json' }));
    await flush();
    assert.equal(
      calls.tree,
      0,
      'an advisory frame issues ZERO /api/tree fetches — the board issues no fetch at all, so a heartbeat write cannot re-render its cards',
    );
    assert.equal(calls.doc['in-flight'], 1, 'the in-flight frame issues exactly one matching /api/doc fetch');
    assert.equal(calls.doc['whats-next'] || 0, 0, 'the in-flight frame does not also re-fetch the unrelated whats-next artifact');
  } finally {
    await act(async () => root.unmount());
  }
});

// agentic-workflow-bmn29, ADR-0070 §6 — the proof the PRODUCTION visibility
// adapter (not the injected fake live-tree-hub-visibility.test.mjs uses)
// actually reads `document`: overriding `document.visibilityState` and
// dispatching a real `visibilitychange` through jsdom must gate the hub the
// same way the fake does.
test('a hidden document drops a structural frame (zero /api/tree fetches); back to visible replays it (exactly one /api/tree fetch, zero /api/doc fetches)', async () => {
  const { root } = await mount(DashboardApp);
  try {
    await flush();

    const src = FakeEventSource.instances[FakeEventSource.instances.length - 1];
    calls.tree = 0;
    calls.doc = {};

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new dom.window.Event('visibilitychange'));

    src.emit('tree-changed', JSON.stringify({ type: 'tree-changed', path: '.agentheim/contexts/agentic-workflow/todo/x-1.md' }));
    await flush();
    assert.equal(calls.tree, 0, 'a structural frame while the document is hidden issues zero /api/tree fetches');

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new dom.window.Event('visibilitychange'));
    await flush();

    assert.equal(calls.tree, 1, 'becoming visible again replays the pending structural frame exactly once');
    assert.equal(calls.doc['in-flight'] || 0, 0, 'the replay issues zero /api/doc fetches for in-flight.json');
    assert.equal(calls.doc['whats-next'] || 0, 0, 'the replay issues zero /api/doc fetches for whats-next.md');
  } finally {
    await act(async () => root.unmount());
  }
});
