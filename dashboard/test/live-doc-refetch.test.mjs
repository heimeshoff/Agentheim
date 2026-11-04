// agentic-workflow-es288: open doc readers re-fetch on every structural tree update.
// Pure-controller tests (live-doc-refetch.js) plus source checks on the wiring.
// The readers themselves are mounted in live-doc-refetch-dom.test.mjs (jsdom harness).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLiveDocRefetch, findTaskPath } from '../app/live-doc-refetch.js';

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
const src = (f) => readFileSync(path.join(appDir, f), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 0));

function harness({ resolvePath, fetchImpl, initialPath = 'a.md' }) {
  let deliver; let unsubscribed = 0;
  const calls = []; const fresh = [];
  const ctl = createLiveDocRefetch({
    subscribeTree: (cb) => { deliver = cb; return () => { unsubscribed++; }; },
    fetchDoc: (p) => { calls.push(p); return fetchImpl(p, calls.length); },
    resolvePath, initialPath,
    onFresh: (t, p) => fresh.push([t, p]),
  });
  return { ctl, calls, fresh, deliver: (t = {}) => deliver(t), unsub: () => unsubscribed };
}

test('each delivered tree re-fetches the doc path exactly once; changed text is reported', async () => {
  const h = harness({ resolvePath: () => 'a.md', fetchImpl: async () => 'new' });
  h.ctl.seed('old');
  h.deliver(); await tick();
  h.deliver(); await tick();
  assert.deepEqual(h.calls, ['a.md', 'a.md']);
  assert.deepEqual(h.fresh, [['new', 'a.md']], 'second identical text causes no update');
});

test('byte-identical text causes no update', async () => {
  const h = harness({ resolvePath: () => 'a.md', fetchImpl: async () => 'same' });
  h.ctl.seed('same');
  h.deliver(); await tick();
  assert.equal(h.fresh.length, 0);
});

test('a failed re-fetch keeps last good content (no callback)', async () => {
  const h = harness({ resolvePath: () => 'a.md', fetchImpl: async () => { throw new Error('404'); } });
  h.deliver(); await tick();
  assert.equal(h.fresh.length, 0);
});

test('moved task: re-fetch from new path and report it; tree without the id does nothing', async () => {
  const tree = (p) => ({ contexts: [{ lifecycle: { doing: p ? [{ id: 'X', path: p }] : [] } }] });
  const h = harness({
    resolvePath: (t) => findTaskPath(t, 'X'), initialPath: 'todo/X.md',
    fetchImpl: async (p) => `body of ${p}`,
  });
  h.ctl.seed('body of todo/X.md', 'todo/X.md');
  h.deliver(tree(null)); await tick();
  assert.equal(h.calls.length, 0);
  h.deliver(tree('doing/X.md')); await tick();
  assert.deepEqual(h.calls, ['doing/X.md']);
  assert.deepEqual(h.fresh, [['body of doing/X.md', 'doing/X.md']]);
});

test('last-started wins; stop() drops in-flight responses and unsubscribes', async () => {
  const resolvers = [];
  const h = harness({ resolvePath: () => 'a.md', fetchImpl: () => new Promise((r) => resolvers.push(r)) });
  h.deliver(); await tick();
  h.deliver(); await tick();
  resolvers[1]('second'); await tick();
  resolvers[0]('first'); await tick();
  assert.deepEqual(h.fresh, [['second', 'a.md']]);
  h.deliver(); await tick();
  h.ctl.stop();
  resolvers[2]('late'); await tick();
  assert.equal(h.fresh.length, 1);
  assert.equal(h.unsub(), 1);
});

test('wiring: readers take an injected subscribeTree; board.js passes a hub-backed one to both', () => {
  for (const f of ['slide-over.js', 'main-pane-reader.js']) {
    const s = src(f);
    assert.match(s, /subscribeTree = noopSubscribeTree/, `${f} defaults subscribeTree to a no-op`);
    assert.match(s, /createLiveDocRefetch\(/, `${f} uses the live re-fetch controller`);
    assert.doesNotMatch(s, /live-tree-hub|EventSource/, `${f} must not touch the hub or an EventSource`);
  }
  const b = src('board.js');
  assert.match(b, /subscribeTree = \(cb\) => liveTreeHub\.subscribeStructural\(cb\)/);
  assert.match(b, /<\$\{MainPaneReader\}[^>]*subscribeTree=\$\{subscribeTree\}/);
  assert.match(b, /<\$\{SlideOver\}[^>]*subscribeTree=\$\{subscribeTree\}/);
});
