/* ============================================================
   Agentheim — dashboard live-tree hub (agentic-workflow-mvt8x, ADR-0070)

   ADR-0006 designed "a long-lived connection per open board tab." The code
   drifted: each of `useLiveTree`'s four call sites (the board, the rail's
   baseline tracker, WhatsNextPanel, InFlightLane) opened its own
   `createLiveUpdate`/`EventSource`, and every frame — advisory or structural
   — triggered every consumer's own re-fetch, regardless of what actually
   changed. This module is the fix: ONE hub per tab that owns the ONE
   `/api/events` source AND the ONE `/api/tree` fetch, with every component
   subscribing instead of constructing its own.

   - The FIRST subscriber (structural or advisory) constructs the source; the
     LAST unsubscribe closes it and clears the cached tree. Concurrent
     subscriptions in the same tick (or a fresh structural frame notifying
     several subscribers at once) share ONE in-flight /api/tree fetch.
   - A STRUCTURAL subscriber is delivered the current tree on subscribe
     (fetching it if not already cached, reusing the cache if it is) and
     again every time a structural frame (or `hello`) arrives.
   - An ADVISORY subscriber registers for one exact artifact path
     (`.agentheim/state/whats-next.md`, `.agentheim/state/in-flight.json`)
     and is invoked (no payload — it owns its own /api/doc fetch, same as
     today) only when a frame names THAT path, or on `hello` (reconnect
     catch-up, ADR-0006).
   - A RUNTIME frame (`.agentheim/.dashboard/**`) notifies nobody.
   - Frame CLASSIFICATION is delegated entirely to live-frame-router.js. This
     module only ROUTES on the result — it never inspects file content and
     never interprets a frame as a model change (ADR-0001 / ADR-0070 §3):
     every notified subscriber still re-fetches its WHOLE artifact from
     scratch and re-projects it; nothing here is diffed or patched.

   Framework-free (no React import), `node --test`-able with no DOM: both
   `sourceFactory` (passed straight through to createLiveUpdate) and
   `fetchTree` are injectable, matching live-update.js's own design
   philosophy. Production callers (board.js) pass neither — the defaults hit
   the real `EventSource`/`fetch`.
   ============================================================ */

import { createLiveUpdate } from './live-update.js';
import { classifyFramePath, FRAME_CATEGORY } from './live-frame-router.js';

const TREE_URL = '/api/tree';

async function defaultFetchTree() {
  const res = await fetch(TREE_URL);
  if (!res.ok) throw new Error(`/api/tree ${res.status}`);
  return res.json();
}

/**
 * Create a live-tree hub. One instance per tab (board.js holds a single
 * module-level instance — see its `useLiveTree` hook).
 *
 * @param {object} [opts]
 * @param {() => { addEventListener, close }} [opts.sourceFactory] — injectable
 *   EventSource-like source builder, forwarded to createLiveUpdate.
 * @param {() => Promise<object>} [opts.fetchTree] — injectable /api/tree
 *   fetch, defaults to the real fetch.
 * @param {number} [opts.reconnectMs] — forwarded to createLiveUpdate.
 * @returns {{
 *   subscribeStructural: (cb: (tree: object|null) => void) => () => void,
 *   subscribeAdvisory: (path: string, cb: () => void) => () => void,
 * }}
 */
export function createLiveTreeHub({ sourceFactory, fetchTree = defaultFetchTree, reconnectMs } = {}) {
  let live = null; // the underlying createLiveUpdate handle, or null when torn down
  let refcount = 0;
  let cachedTree; // undefined = no cached tree; anything else (including null) = cached
  let pendingFetch = null; // the shared in-flight /api/tree promise, or null

  const structuralSubs = new Set();
  const advisorySubs = new Map(); // path -> Set<callback>

  function ensureSource() {
    if (live) return;
    live = createLiveUpdate({ sourceFactory, reconnectMs, onResync: handleFrame });
  }

  function teardownSource() {
    if (live) {
      live.close();
      live = null;
    }
    cachedTree = undefined;
    pendingFetch = null;
  }

  function invalidateTree() {
    cachedTree = undefined;
  }

  /** Resolve the current tree — cached, in-flight-shared, or a fresh fetch. */
  function getTree() {
    if (cachedTree !== undefined) return Promise.resolve(cachedTree);
    if (pendingFetch) return pendingFetch;
    pendingFetch = Promise.resolve()
      .then(() => fetchTree())
      .then((tree) => {
        cachedTree = tree;
        pendingFetch = null;
        return tree;
      })
      .catch((err) => {
        pendingFetch = null;
        throw err;
      });
    return pendingFetch;
  }

  /** Re-fetch (ignoring any cache) and deliver the result to every structural subscriber. */
  function notifyStructural() {
    if (structuralSubs.size === 0) return;
    invalidateTree();
    getTree()
      .then((tree) => { for (const cb of [...structuralSubs]) cb(tree); })
      .catch(() => { for (const cb of [...structuralSubs]) cb(null); });
  }

  function notifyAdvisory(path) {
    const cbs = advisorySubs.get(path);
    if (!cbs) return;
    for (const cb of [...cbs]) cb();
  }

  /** hello / reconnect catch-up (ADR-0006): EVERY subscriber re-syncs. */
  function notifyAll() {
    notifyStructural();
    for (const cbs of advisorySubs.values()) {
      for (const cb of [...cbs]) cb();
    }
  }

  function handleFrame(evt) {
    if (evt === null || evt === undefined) {
      notifyAll();
      return;
    }
    const path = evt && typeof evt === 'object' ? evt.path : undefined;
    const category = classifyFramePath(path);
    if (category === FRAME_CATEGORY.STRUCTURAL) notifyStructural();
    else if (category === FRAME_CATEGORY.ADVISORY) notifyAdvisory(path);
    // RUNTIME: no consumer re-syncs — intentionally a no-op.
  }

  function release() {
    refcount -= 1;
    if (refcount <= 0) teardownSource();
  }

  function subscribeStructural(cb) {
    refcount += 1;
    ensureSource();
    structuralSubs.add(cb);
    getTree().then(
      (tree) => { if (structuralSubs.has(cb)) cb(tree); },
      () => { if (structuralSubs.has(cb)) cb(null); },
    );
    return function unsubscribe() {
      structuralSubs.delete(cb);
      release();
    };
  }

  function subscribeAdvisory(path, cb) {
    refcount += 1;
    ensureSource();
    if (!advisorySubs.has(path)) advisorySubs.set(path, new Set());
    advisorySubs.get(path).add(cb);
    return function unsubscribe() {
      const cbs = advisorySubs.get(path);
      if (cbs) {
        cbs.delete(cb);
        if (cbs.size === 0) advisorySubs.delete(path);
      }
      release();
    };
  }

  return { subscribeStructural, subscribeAdvisory };
}
