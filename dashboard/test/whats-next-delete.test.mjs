// DELETE /api/whats-next (ADR-0046, amending ADR-0027 §4.5): the dashboard's one
// scoped write since ADR-0017. Dismissing the What's next panel deletes the
// underlying advisory artifact `.agentheim/state/whats-next.md` — and ONLY that
// literal file — instead of merely hiding it in localStorage (aw-073's prior
// behaviour, retired by this task).
//
// Two surfaces are tested:
//   1. The pure guard `assertWhatsNextTarget` — the exact-equality allowlist
//      that must reject every path other than the one allowed artifact,
//      explicitly including the sibling advisory artifact `in-flight.json`
//      (ADR-0043 / aw-m9w5c) that a naive prefix match on `state/` would also
//      match, and any `contexts/`-lifecycle path.
//   2. The HTTP route itself, through the real server: dispatch order relative
//      to the 405 gate, idempotency, and the 204/500 status contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createDashboardServer } from '../server.mjs';
import { assertWhatsNextTarget, WHATS_NEXT_RELATIVE_PATH } from '../whats-next-delete.mjs';

function makeProject() {
  const base = mkdtempSync(path.join(tmpdir(), 'aw046-del-'));
  const state = path.join(base, '.agentheim', 'state');
  mkdirSync(state, { recursive: true });
  const dist = path.join(base, 'dashboard', 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>dash</title>');
  return { base, dist, state };
}

async function start(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

// ---- the pure exact-equality allowlist guard -------------------------------

test('the allowed relative path is the ADR-0027 advisory artifact', () => {
  assert.equal(WHATS_NEXT_RELATIVE_PATH, '.agentheim/state/whats-next.md');
});

test('assertWhatsNextTarget resolves the default (allowed) path', () => {
  const { base } = makeProject();
  try {
    const target = assertWhatsNextTarget(base);
    assert.equal(target, path.resolve(base, '.agentheim', 'state', 'whats-next.md'));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('assertWhatsNextTarget rejects the sibling advisory artifact in-flight.json (exact-equality, not a prefix match) and touches no file', () => {
  const { base, state } = makeProject();
  const inFlight = path.join(state, 'in-flight.json');
  writeFileSync(inFlight, JSON.stringify({ heartbeatAt: 'x' }));
  try {
    // A prefix match on `.agentheim/state/` would ALSO match this sibling file —
    // that is exactly what the exact-equality assertion must prevent.
    assert.throws(() => assertWhatsNextTarget(base, '.agentheim/state/in-flight.json'));
    assert.ok(existsSync(inFlight), 'the sibling advisory artifact must be verifiably untouched');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('assertWhatsNextTarget rejects a contexts/-lifecycle path', () => {
  const { base } = makeProject();
  const task = path.join(base, '.agentheim', 'contexts', 'alpha', 'todo', 'alpha-001.md');
  mkdirSync(path.dirname(task), { recursive: true });
  writeFileSync(task, 'lifecycle file');
  try {
    assert.throws(() => assertWhatsNextTarget(base, '.agentheim/contexts/alpha/todo/alpha-001.md'));
    assert.ok(existsSync(task), 'a lifecycle file must be verifiably untouched');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('assertWhatsNextTarget still exercises the in-root traversal guard (resolveInRoot)', () => {
  const { base } = makeProject();
  try {
    assert.throws(() => assertWhatsNextTarget(base, '../../../etc/passwd'));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

// ---- the HTTP route ---------------------------------------------------------

test('DELETE /api/whats-next removes the artifact and returns 204', async () => {
  const { base, dist, state } = makeProject();
  const target = path.join(state, 'whats-next.md');
  writeFileSync(target, '---\ngenerated: 2026-07-04T00:00:00Z\n---\n\nbody');
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const port = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/whats-next`, { method: 'DELETE' });
    assert.equal(res.status, 204);
    assert.equal(existsSync(target), false);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('DELETE /api/whats-next is idempotent: already-absent is 204, never 404', async () => {
  const { base, dist, state } = makeProject();
  const target = path.join(state, 'whats-next.md');
  assert.equal(existsSync(target), false); // never written in this test
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const port = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/whats-next`, { method: 'DELETE' });
    assert.equal(res.status, 204);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('DELETE /api/whats-next twice in a row both return 204', async () => {
  const { base, dist, state } = makeProject();
  const target = path.join(state, 'whats-next.md');
  writeFileSync(target, 'body');
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const port = await start(server);
    const first = await fetch(`http://127.0.0.1:${port}/api/whats-next`, { method: 'DELETE' });
    const second = await fetch(`http://127.0.0.1:${port}/api/whats-next`, { method: 'DELETE' });
    assert.equal(first.status, 204);
    assert.equal(second.status, 204);
    assert.equal(existsSync(target), false);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('a genuine non-ENOENT filesystem failure returns 500 and deletes nothing', async () => {
  const { base, dist, state } = makeProject();
  const target = path.join(state, 'whats-next.md');
  // A directory in place of the file makes unlink fail for a REAL reason
  // (EPERM/EISDIR), never ENOENT — the idempotent-absence path must not fire.
  mkdirSync(target);
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const port = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/whats-next`, { method: 'DELETE' });
    assert.equal(res.status, 500);
    assert.ok(existsSync(target), 'the failed delete must leave the target untouched');
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('DELETE /api/whats-next is dispatched BEFORE the 405 gate (reachable via DELETE)', async () => {
  const { base, dist } = makeProject();
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const port = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/whats-next`, { method: 'DELETE' });
    assert.notEqual(res.status, 405);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('the 405 gate still rejects every OTHER non-GET method, including other methods on /api/whats-next', async () => {
  const { base, dist } = makeProject();
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const port = await start(server);
    const post = await fetch(`http://127.0.0.1:${port}/api/whats-next`, { method: 'POST' });
    assert.equal(post.status, 405);
    const put = await fetch(`http://127.0.0.1:${port}/api/whats-next`, { method: 'PUT' });
    assert.equal(put.status, 405);
    // unrelated route, unrelated non-GET method: unchanged 405 behaviour.
    const postDoc = await fetch(`http://127.0.0.1:${port}/api/doc`, { method: 'POST' });
    assert.equal(postDoc.status, 405);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('the handler takes no ?path= and reads no body — a supplied path/body changes nothing', async () => {
  const { base, dist, state } = makeProject();
  const target = path.join(state, 'whats-next.md');
  const inFlight = path.join(state, 'in-flight.json');
  writeFileSync(target, 'body');
  writeFileSync(inFlight, JSON.stringify({ heartbeatAt: 'x' }));
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const port = await start(server);
    // An attacker-style ?path= aimed at the sibling artifact must be ignored:
    // only the hardcoded constant is ever deleted.
    const res = await fetch(
      `http://127.0.0.1:${port}/api/whats-next?path=${encodeURIComponent('.agentheim/state/in-flight.json')}`,
      { method: 'DELETE', body: JSON.stringify({ path: '.agentheim/state/in-flight.json' }) },
    );
    assert.equal(res.status, 204);
    assert.equal(existsSync(target), false, 'the one allowed artifact is deleted');
    assert.ok(existsSync(inFlight), 'the sibling artifact must be verifiably untouched');
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});
