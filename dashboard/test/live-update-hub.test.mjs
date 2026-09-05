// Tests for the live-tree hub core (agentic-workflow-mvt8x, ADR-0070) — no DOM,
// no React. Covers:
//   1. Source refcounting: N subscribers share ONE EventSource-like source;
//      the source only closes once every subscriber has dropped, and a fresh
//      subscribe after full teardown opens a genuinely new one.
//   2. Fetch dedupe: one structural frame -> exactly one /api/tree call
//      regardless of subscriber count; concurrent subscribes in the same tick
//      share one in-flight fetch; a late subscriber reuses the cache.
//   3. Hub-level fan-out: a frame's category selects its audience — advisory
//      reaches only its own artifact's subscriber, runtime reaches nobody,
//      structural reaches every structural subscriber, hello reaches everyone
//      (reconnect catch-up).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLiveTreeHub } from '../app/live-tree-hub.js';

/** A minimal EventSource double, matching live-update.test.mjs's own fake. */
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

/** Flush the promise microtask queue (getTree()'s chain) between actions. */
function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function structuralFrame(path) {
  return JSON.stringify({ type: 'tree-changed', path });
}

// --- 1. Source refcounting -------------------------------------------------

test('four subscribers share exactly one source construction; the source stays open until the last unsubscribe; a fresh subscribe after full teardown opens a genuinely new one', async () => {
  let constructions = 0;
  const sources = [];
  const sourceFactory = () => {
    constructions += 1;
    const src = makeFakeSource();
    sources.push(src);
    return src;
  };
  const hub = createLiveTreeHub({ sourceFactory, fetchTree: () => Promise.resolve({ contexts: [] }) });

  const unsub1 = hub.subscribeStructural(() => {});
  const unsub2 = hub.subscribeStructural(() => {});
  const unsub3 = hub.subscribeAdvisory('.agentheim/state/whats-next.md', () => {});
  const unsub4 = hub.subscribeAdvisory('.agentheim/state/in-flight.json', () => {});
  await tick();

  assert.equal(constructions, 1, 'four subscribers -> exactly one source construction');

  const firstSource = sources[0];
  unsub1();
  unsub2();
  unsub3();
  assert.equal(firstSource.closed, false, 'dropping three of four subscribers leaves the source open (0 closes)');

  unsub4();
  assert.equal(firstSource.closed, true, 'dropping the last subscriber closes the source (exactly 1 close)');

  const unsub5 = hub.subscribeStructural(() => {});
  await tick();
  assert.equal(constructions, 2, 're-subscribing after full teardown constructs exactly 1 new source');
  unsub5();
});

// --- 2. Fetch dedupe --------------------------------------------------------

test('one structural frame triggers exactly one /api/tree fetch regardless of subscriber count; concurrent subscribes in the same tick share one fetch; a late subscriber reuses the cache', async () => {
  let fetches = 0;
  const tree = { contexts: [] };
  const src = makeFakeSource();
  const hub = createLiveTreeHub({
    sourceFactory: () => src,
    fetchTree: () => { fetches += 1; return Promise.resolve(tree); },
  });

  const seenA = [];
  const seenB = [];
  const unsubA = hub.subscribeStructural((t) => seenA.push(t));
  const unsubB = hub.subscribeStructural((t) => seenB.push(t));
  await tick();
  assert.equal(fetches, 1, 'two consumers subscribing in the same tick share one in-flight fetch');
  assert.equal(seenA.length, 1);
  assert.equal(seenB.length, 1);

  src._emit('tree-changed', structuralFrame('.agentheim/contexts/agentic-workflow/todo/x-1.md'));
  await tick();
  assert.equal(fetches, 2, 'one structural frame -> exactly one NEW /api/tree call, regardless of consumer count');
  assert.equal(seenA.length, 2);
  assert.equal(seenB.length, 2);

  const seenC = [];
  const unsubC = hub.subscribeStructural((t) => seenC.push(t));
  await tick();
  assert.equal(fetches, 2, 'a consumer subscribing after the tree is cached receives it with 0 additional fetches');
  assert.equal(seenC.length, 1);

  unsubA(); unsubB(); unsubC();
});

// --- 3. Hub-level fan-out ----------------------------------------------------

test('a frame\'s category selects its audience: advisory reaches only its own artifact, runtime reaches nobody, structural reaches all structural subscribers, hello reaches everyone', async () => {
  const src = makeFakeSource();
  const hub = createLiveTreeHub({ sourceFactory: () => src, fetchTree: () => Promise.resolve({ contexts: [] }) });

  const counts = { board: 0, rail: 0, whatsNext: 0, inFlight: 0 };
  const unsubBoard = hub.subscribeStructural(() => { counts.board += 1; });
  const unsubRail = hub.subscribeStructural(() => { counts.rail += 1; });
  const unsubWhatsNext = hub.subscribeAdvisory('.agentheim/state/whats-next.md', () => { counts.whatsNext += 1; });
  const unsubInFlight = hub.subscribeAdvisory('.agentheim/state/in-flight.json', () => { counts.inFlight += 1; });
  await tick();
  // Subscribing itself delivers the initial tree to the two structural subscribers
  // (board, rail) — reset so the assertions below are about FRAME routing only.
  counts.board = 0; counts.rail = 0; counts.whatsNext = 0; counts.inFlight = 0;

  src._emit('tree-changed', structuralFrame('.agentheim/state/in-flight.json'));
  await tick();
  assert.deepEqual(counts, { board: 0, rail: 0, whatsNext: 0, inFlight: 1 }, 'an advisory frame naming in-flight.json invokes ONLY the in-flight subscriber');

  src._emit('tree-changed', structuralFrame('.agentheim/state/whats-next.md'));
  await tick();
  assert.deepEqual(counts, { board: 0, rail: 0, whatsNext: 1, inFlight: 1 }, 'an advisory frame naming whats-next.md invokes ONLY the whats-next subscriber');

  src._emit('tree-changed', structuralFrame('.agentheim/.dashboard/runtime.json'));
  await tick();
  assert.deepEqual(counts, { board: 0, rail: 0, whatsNext: 1, inFlight: 1 }, 'a runtime frame invokes nobody');

  src._emit('tree-changed', structuralFrame('.agentheim/contexts/agentic-workflow/todo/x.md'));
  await tick();
  assert.deepEqual(counts, { board: 1, rail: 1, whatsNext: 1, inFlight: 1 }, 'a structural frame invokes all structural subscribers, and no advisory ones');

  src._emit('hello', null);
  await tick();
  assert.deepEqual(counts, { board: 2, rail: 2, whatsNext: 2, inFlight: 2 }, 'a hello frame invokes EVERY subscriber (reconnect catch-up, ADR-0006)');

  unsubBoard(); unsubRail(); unsubWhatsNext(); unsubInFlight();
});
