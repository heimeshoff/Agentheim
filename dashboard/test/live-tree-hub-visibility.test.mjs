// Tests for the hub's injectable `visibility` gate (agentic-workflow-bmn29,
// ADR-0070 §6) — no DOM, no React, matching live-update-hub.test.mjs's own
// idiom. A fake `visibility` (`{ isHidden, onChange }`) lets a hidden tab be
// simulated deterministically: while hidden, `handleFrame` delivers NOTHING
// and records what it would have done per ADR-0070 category in a pending
// set; on becoming visible, the pending set replays AT MOST ONCE per
// category, then clears — an empty pending set replays nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLiveTreeHub } from '../app/live-tree-hub.js';

const WHATS_NEXT = '.agentheim/state/whats-next.md';
const IN_FLIGHT = '.agentheim/state/in-flight.json';

/** A minimal EventSource double, matching live-update-hub.test.mjs's own fake. */
function makeFakeSource() {
  const listeners = {};
  const src = {
    closed: false,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    close() { this.closed = true; },
    _emit(type, data) {
      for (const fn of listeners[type] || []) fn({ data });
    },
  };
  return src;
}

/** A fake `visibility` adapter: toggled by the test, dispatches on change. */
function makeFakeVisibility(initiallyHidden = false) {
  let hidden = initiallyHidden;
  const listeners = new Set();
  return {
    isHidden: () => hidden,
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    listenerCount: () => listeners.size,
    setHidden(next) {
      hidden = next;
      for (const cb of [...listeners]) cb();
    },
  };
}

/** Flush the promise microtask queue between actions. */
function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function structuralFrame(path) {
  return JSON.stringify({ type: 'tree-changed', path });
}

function advisoryFrame(path) {
  return JSON.stringify({ type: 'tree-changed', path });
}

function makeHub(visibility, extra = {}) {
  let constructions = 0;
  const sources = [];
  const sourceFactory = () => {
    constructions += 1;
    const src = makeFakeSource();
    sources.push(src);
    return src;
  };
  let fetchTreeCalls = 0;
  const fetchTree = () => {
    fetchTreeCalls += 1;
    return Promise.resolve({ contexts: [], call: fetchTreeCalls });
  };
  const hub = createLiveTreeHub({ sourceFactory, fetchTree, visibility, ...extra });
  return {
    hub,
    sources,
    counts: {
      get constructions() { return constructions; },
      get fetchTree() { return fetchTreeCalls; },
    },
  };
}

test('hidden: three structural + five in-flight frames deliver nothing; visible: one fetchTree, each structural subscriber once, in-flight once, whats-next never', async () => {
  const visibility = makeFakeVisibility(true);
  const { hub, sources, counts } = makeHub(visibility);

  const structuralCalls = [0, 0];
  const inFlightCalls = { count: 0 };
  const whatsNextCalls = { count: 0 };

  const unsub1 = hub.subscribeStructural((tree) => { structuralCalls[0] += 1; });
  const unsub2 = hub.subscribeStructural((tree) => { structuralCalls[1] += 1; });
  const unsub3 = hub.subscribeAdvisory(IN_FLIGHT, () => { inFlightCalls.count += 1; });
  const unsub4 = hub.subscribeAdvisory(WHATS_NEXT, () => { whatsNextCalls.count += 1; });
  await tick();

  // Reset mount-time delivery counts — the assertions below are about
  // FRAME-triggered (and replay-triggered) callbacks only.
  structuralCalls[0] = 0;
  structuralCalls[1] = 0;
  inFlightCalls.count = 0;
  whatsNextCalls.count = 0;
  const fetchTreeBefore = counts.fetchTree;

  const src = sources[0];
  for (let i = 0; i < 3; i += 1) {
    src._emit('tree-changed', structuralFrame(`.agentheim/contexts/agentic-workflow/todo/x-${i}.md`));
  }
  for (let i = 0; i < 5; i += 1) {
    src._emit('tree-changed', advisoryFrame(IN_FLIGHT));
  }
  await tick();

  assert.equal(counts.fetchTree - fetchTreeBefore, 0, 'zero fetchTree calls while hidden');
  assert.equal(structuralCalls[0], 0, 'zero structural callbacks while hidden');
  assert.equal(structuralCalls[1], 0, 'zero structural callbacks while hidden');
  assert.equal(inFlightCalls.count, 0, 'zero advisory callbacks while hidden');

  visibility.setHidden(false);
  await tick();

  assert.equal(counts.fetchTree - fetchTreeBefore, 1, 'exactly one fetchTree call on return');
  assert.equal(structuralCalls[0], 1, 'first structural subscriber called once with the new tree');
  assert.equal(structuralCalls[1], 1, 'second structural subscriber called once with the new tree');
  assert.equal(inFlightCalls.count, 1, 'in-flight subscriber called once');
  assert.equal(whatsNextCalls.count, 0, 'whats-next subscriber never called — no frame named its artifact');

  unsub1(); unsub2(); unsub3(); unsub4();
});

test('hidden: only in-flight advisory frames arrive; visible: zero fetchTree calls, in-flight subscriber once', async () => {
  const visibility = makeFakeVisibility(true);
  const { hub, sources, counts } = makeHub(visibility);

  let inFlight = 0;
  const unsub1 = hub.subscribeStructural(() => {});
  const unsub2 = hub.subscribeAdvisory(IN_FLIGHT, () => { inFlight += 1; });
  await tick();
  inFlight = 0;
  const fetchTreeBefore = counts.fetchTree;

  const src = sources[0];
  src._emit('tree-changed', advisoryFrame(IN_FLIGHT));
  src._emit('tree-changed', advisoryFrame(IN_FLIGHT));
  await tick();

  visibility.setHidden(false);
  await tick();

  assert.equal(counts.fetchTree - fetchTreeBefore, 0, 'zero fetchTree calls — no structural frame arrived');
  assert.equal(inFlight, 1, 'in-flight subscriber called exactly once (ADR-0070 audience rule holds across the pause)');

  unsub1(); unsub2();
});

test('hidden: no frames; visible: zero fetches, zero callbacks — a tab switch with no change costs nothing', async () => {
  const visibility = makeFakeVisibility(true);
  const { hub, counts } = makeHub(visibility);

  let structural = 0;
  let advisory = 0;
  const unsub1 = hub.subscribeStructural(() => { structural += 1; });
  const unsub2 = hub.subscribeAdvisory(IN_FLIGHT, () => { advisory += 1; });
  await tick();
  structural = 0;
  advisory = 0;
  const fetchTreeBefore = counts.fetchTree;

  visibility.setHidden(false);
  await tick();

  assert.equal(counts.fetchTree - fetchTreeBefore, 0, 'zero fetches on an empty pending set');
  assert.equal(structural, 0, 'zero structural callbacks on an empty pending set');
  assert.equal(advisory, 0, 'zero advisory callbacks on an empty pending set');

  unsub1(); unsub2();
});

test('hidden: a hello frame arrives; visible: every subscriber once, one fetchTree', async () => {
  const visibility = makeFakeVisibility(true);
  const { hub, sources, counts } = makeHub(visibility);

  let structural = 0;
  let inFlight = 0;
  let whatsNext = 0;
  const unsub1 = hub.subscribeStructural(() => { structural += 1; });
  const unsub2 = hub.subscribeAdvisory(IN_FLIGHT, () => { inFlight += 1; });
  const unsub3 = hub.subscribeAdvisory(WHATS_NEXT, () => { whatsNext += 1; });
  await tick();
  structural = 0; inFlight = 0; whatsNext = 0;
  const fetchTreeBefore = counts.fetchTree;

  const src = sources[0];
  src._emit('hello', null);
  await tick();

  visibility.setHidden(false);
  await tick();

  assert.equal(counts.fetchTree - fetchTreeBefore, 1, 'exactly one fetchTree call on hello replay');
  assert.equal(structural, 1, 'structural subscriber called once');
  assert.equal(inFlight, 1, 'in-flight subscriber called once');
  assert.equal(whatsNext, 1, 'whats-next subscriber called once — hello re-syncs EVERYONE (ADR-0006)');

  unsub1(); unsub2(); unsub3();
});

test('the source is never closed or reconstructed across a hidden -> visible transition; the last unsubscribe removes the visibility listener, a fresh subscribe re-registers exactly one', async () => {
  const visibility = makeFakeVisibility(true);
  const { hub, sources, counts } = makeHub(visibility);

  const unsub1 = hub.subscribeStructural(() => {});
  await tick();
  assert.equal(counts.constructions, 1, 'one source construction on first subscribe');
  assert.equal(visibility.listenerCount(), 1, 'one visibilitychange listener registered with the first subscriber');

  const src = sources[0];
  src._emit('tree-changed', structuralFrame('.agentheim/contexts/agentic-workflow/todo/x.md'));
  await tick();
  visibility.setHidden(false);
  await tick();

  assert.equal(counts.constructions, 1, 'still exactly one source construction across the pause');
  assert.equal(src.closed, false, 'the source is never closed on hide');

  unsub1();
  assert.equal(visibility.listenerCount(), 0, 'the visibility listener is removed on the last unsubscribe');

  const unsub2 = hub.subscribeStructural(() => {});
  await tick();
  assert.equal(visibility.listenerCount(), 1, 'a fresh subscribe re-registers exactly one visibility listener');
  unsub2();
});
