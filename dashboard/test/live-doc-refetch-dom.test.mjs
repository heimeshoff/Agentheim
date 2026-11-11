// agentic-workflow-es288: DOM-render proof that MainPaneReader and SlideOver
// re-fetch their open doc on every delivered structural tree, driven through
// dom-harness.mjs (jsdom) with an injected fake `subscribeTree` and a
// `fetchDoc` spy. (The pure controller is covered in live-doc-refetch.test.mjs.)
import { mount, act, flush } from './dom-harness.mjs';
globalThis.requestAnimationFrame ??= (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { MainPaneReader } = await import('../app/main-pane-reader.js');
const { SlideOver } = await import('../app/slide-over.js');
const { createRoot } = await import('react-dom/client');
const { createElement } = await import('react');

function fakeHub() {
  const subs = new Set(); let unsubs = 0;
  return {
    subscribeTree: (cb) => { subs.add(cb); return () => { subs.delete(cb); unsubs++; }; },
    deliver: async (tree = {}) => { await act(async () => { for (const cb of [...subs]) cb(tree); await new Promise((r) => setTimeout(r, 0)); }); },
    unsubs: () => unsubs, live: () => subs.size,
  };
}
// fetchDoc spy whose per-path responses can be swapped; a value of Error rejects.
function fetchSpy(initial) {
  const calls = []; const bodies = { ...initial }; let hold = null;
  const fn = (p) => {
    calls.push(p);
    const v = bodies[p];
    const settle = () => (v instanceof Error ? Promise.reject(v) : Promise.resolve(v));
    return hold ? hold(settle) : settle();
  };
  fn.calls = calls; fn.bodies = bodies; fn.holdWith = (h) => { hold = h; };
  return fn;
}
function observe(container) {
  let n = 0;
  const obs = new window.MutationObserver((recs) => { n += recs.length; });
  obs.observe(container, { childList: true, subtree: true, characterData: true, attributes: true });
  return { count: () => { n += obs.takeRecords().length; return n; }, reset: () => { obs.takeRecords(); n = 0; } };
}

const task = (id, p) => ({ contexts: [{ lifecycle: { todo: [], doing: p ? [{ id, path: p }] : [] } }] });

test('MainPaneReader: one re-fetch per tree (even after an unrelated-path frame), changed text replaces body, no loading state', async () => {
  const hub = fakeHub(); const f = fetchSpy({ 'doc.md': '# One' });
  const { root, container } = await mount(MainPaneReader, { doc: { path: 'doc.md', title: 'Doc' }, fetchDoc: f, subscribeTree: hub.subscribeTree });
  try {
    await flush();
    assert.match(container.textContent, /One/);
    f.bodies['doc.md'] = '# Two';
    // a tree delivered after a frame naming protocol.md is just a tree: no path is consulted
    await hub.deliver({ lastPath: '.agentheim/board/protocol.md' });
    assert.deepEqual(f.calls, ['doc.md', 'doc.md']);
    assert.match(container.textContent, /Two/);
    assert.doesNotMatch(container.textContent, /Loading document/);
    await hub.deliver();
    assert.equal(f.calls.length, 3);
  } finally { await act(async () => root.unmount()); }
});

test('MainPaneReader: byte-identical text causes no DOM mutation; a failed / non-OK re-fetch keeps the last good body', async () => {
  const hub = fakeHub(); const f = fetchSpy({ 'doc.md': '# Same' });
  const { root, container } = await mount(MainPaneReader, { doc: { path: 'doc.md', title: 'Doc' }, fetchDoc: f, subscribeTree: hub.subscribeTree });
  try {
    await flush();
    const probe = observe(container); probe.reset();
    await hub.deliver();
    assert.equal(f.calls.length, 2);
    assert.equal(probe.count(), 0, 'identical text must not re-render anything');
    f.bodies['doc.md'] = new Error('/api/doc 404');
    await hub.deliver();
    assert.equal(f.calls.length, 3);
    assert.match(container.textContent, /Same/);
    assert.doesNotMatch(container.textContent, /Could not load/);
    assert.equal(probe.count(), 0);
  } finally { await act(async () => root.unmount()); }
});

test('MainPaneReader: unsubscribes on unmount and on doc change; a late response after a doc change is dropped', async () => {
  const hub = fakeHub(); const f = fetchSpy({ 'a.md': '# A1', 'b.md': '# B1' });
  const { root, container } = await mount(MainPaneReader, { doc: { path: 'a.md', title: 'A' }, fetchDoc: f, subscribeTree: hub.subscribeTree });
  await flush();
  // start a live re-fetch that stays in flight
  let release;
  f.holdWith((settle) => new Promise((r) => { release = () => r(settle()); }));
  f.bodies['a.md'] = '# A2-LATE';
  await hub.deliver(); // fetch started, held
  f.holdWith(null);
  await act(async () => { root.render(createElement(MainPaneReader, { doc: { path: 'b.md', title: 'B' }, fetchDoc: f, subscribeTree: hub.subscribeTree })); });
  await flush();
  assert.equal(hub.unsubs(), 1, 'doc change unsubscribes the old doc');
  await act(async () => { release(); await new Promise((r) => setTimeout(r, 0)); });
  assert.match(container.textContent, /B1/);
  assert.doesNotMatch(container.textContent, /A2-LATE/);
  await act(async () => root.unmount());
  assert.equal(hub.unsubs(), 2);
  assert.equal(hub.live(), 0);
});

const intentFor = (over = {}) => ({ id: 'X', title: 'Task X', status: 'todo', type: 'feature', path: 'todo/X.md', ...over });

test('SlideOver: re-fetch per tree, changed body, no _Loading_, expanded preserved, identical text no mutation', async () => {
  const hub = fakeHub(); const f = fetchSpy({ 'todo/X.md': '# Body one' });
  const { root, container } = await mount(SlideOver, { intent: intentFor(), onClose() {}, fetchDoc: f, subscribeTree: hub.subscribeTree });
  try {
    await flush();
    assert.match(container.textContent, /Body one/);
    await act(async () => { container.querySelector('[aria-label="Expand panel"]').click(); });
    assert.ok(container.querySelector('[aria-label="Collapse panel"]'));
    const probe = observe(container); probe.reset();
    await hub.deliver(task('X', 'todo/X.md'));
    assert.deepEqual(f.calls, ['todo/X.md', 'todo/X.md']);
    assert.equal(probe.count(), 0, 'identical text: no mutation, no _Loading_ flash');
    f.bodies['todo/X.md'] = '# Body two';
    await hub.deliver(task('X', 'todo/X.md'));
    assert.equal(f.calls.length, 3);
    assert.match(container.textContent, /Body two/);
    assert.doesNotMatch(container.textContent, /Loading…/);
    assert.ok(container.querySelector('[aria-label="Collapse panel"]'), 'expanded survives a live re-fetch');
  } finally { await act(async () => root.unmount()); }
});

test('SlideOver: failed re-fetch keeps last good body (no error body)', async () => {
  const hub = fakeHub(); const f = fetchSpy({ 'todo/X.md': '# Good body' });
  const { root, container } = await mount(SlideOver, { intent: intentFor(), onClose() {}, fetchDoc: f, subscribeTree: hub.subscribeTree });
  try {
    await flush();
    f.bodies['todo/X.md'] = new Error('/api/doc 500');
    await hub.deliver(task('X', 'todo/X.md'));
    assert.equal(f.calls.length, 2);
    assert.match(container.textContent, /Good body/);
    assert.doesNotMatch(container.textContent, /Could not load/);
  } finally { await act(async () => root.unmount()); }
});

test('SlideOver: moved task is followed by id to the new path (sub-line updates); absent id does nothing', async () => {
  const hub = fakeHub(); const f = fetchSpy({ 'todo/X.md': '# Old', 'doing/X.md': '# Moved body' });
  const { root, container } = await mount(SlideOver, { intent: intentFor(), onClose() {}, fetchDoc: f, subscribeTree: hub.subscribeTree });
  try {
    await flush();
    assert.match(container.textContent, /todo\/X\.md/);
    await hub.deliver(task('X', null));
    assert.equal(f.calls.length, 1, 'no re-fetch when the id is gone');
    assert.match(container.textContent, /Old/);
    await hub.deliver(task('X', 'doing/X.md'));
    assert.deepEqual(f.calls, ['todo/X.md', 'doing/X.md']);
    assert.match(container.textContent, /Moved body/);
    assert.match(container.textContent, /doing\/X\.md/);
    assert.doesNotMatch(container.textContent, /todo\/X\.md/);
  } finally { await act(async () => root.unmount()); }
});

test('SlideOver: unsubscribes on close (intent -> null), on intent change and on unmount; late response dropped', async () => {
  const hub = fakeHub(); const f = fetchSpy({ 'todo/X.md': '# X1', 'todo/Y.md': '# Y1' });
  const { root, container } = await mount(SlideOver, { intent: intentFor(), onClose() {}, fetchDoc: f, subscribeTree: hub.subscribeTree });
  await flush();
  let release;
  f.holdWith((settle) => new Promise((r) => { release = () => r(settle()); }));
  f.bodies['todo/X.md'] = '# X-LATE';
  await hub.deliver(task('X', 'todo/X.md'));
  f.holdWith(null);
  const render = (props) => act(async () => { root.render(createElement(SlideOver, { onClose() {}, fetchDoc: f, subscribeTree: hub.subscribeTree, ...props })); });
  await render({ intent: intentFor({ id: 'Y', title: 'Task Y', path: 'todo/Y.md' }) });
  await flush();
  assert.equal(hub.unsubs(), 1, 'intent change unsubscribes');
  await act(async () => { release(); await new Promise((r) => setTimeout(r, 0)); });
  assert.doesNotMatch(container.textContent, /X-LATE/);
  assert.match(container.textContent, /Y1/);
  await render({ intent: null });
  assert.equal(hub.unsubs(), 2, 'closing unsubscribes');
  assert.equal(hub.live(), 0);
  await render({ intent: intentFor() });
  await flush();
  assert.equal(hub.live(), 1);
  await act(async () => root.unmount());
  assert.equal(hub.live(), 0);
});
