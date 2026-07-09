// POST /api/stop (ADR-0053): the dashboard's third write category — RUNTIME
// SELF-LIFECYCLE. On an explicit builder command the server ends its OWN
// process and removes its OWN runfile. Two surfaces are tested:
//
//   1. The pure handler `handleStop`, driven with a controllable fake `res`
//      so the RESPOND -> 'finish' -> remove-runfile -> exit ORDERING can be
//      pinned precisely — an implementation that kills the process (calls
//      `exit`) or removes the runfile before the response has finished
//      flushing must fail this test.
//   2. The HTTP route through the real server: dispatch order relative to
//      the 405 gate, and that a stray body/query changes nothing. `exit` is
//      always injected in these tests so the test runner's own process is
//      never actually terminated.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createDashboardServer } from '../server.mjs';
import { handleStop } from '../stop-api.mjs';
import { runfilePath, writeRunfile, readRunfile } from '../runfile.mjs';

function makeProject() {
  const base = mkdtempSync(path.join(tmpdir(), 'aw-h4n2v-stop-'));
  const dist = path.join(base, 'dashboard', 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>dash</title>');
  return { base, dist };
}

/**
 * A minimal fake `res` that mimics the two facts this handler relies on:
 * `end()` does not synchronously emit `'finish'` (Node flushes
 * asynchronously), and `'finish'` listeners registered before `end()` still
 * fire. Every call is timestamped into `events` so ordering is provable.
 */
function makeFakeRes(events) {
  const res = new EventEmitter();
  res.writeHead = (code) => events.push(`writeHead:${code}`);
  res.end = () => {
    events.push('end');
    setImmediate(() => res.emit('finish'));
  };
  return res;
}

async function start(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

// ---- the pinned ordering (the load-bearing contract) -----------------------

test('handleStop responds and flushes BEFORE it removes the runfile or exits — a kill-first implementation would fail this', async () => {
  const { base } = makeProject();
  writeRunfile(base, { pid: process.pid, port: 1, startedAt: 'x' });
  const target = runfilePath(base);
  const events = [];
  const res = makeFakeRes(events);

  let exitCalled = false;
  const exit = (code) => { exitCalled = true; events.push(`exit:${code}`); };

  try {
    handleStop({}, res, base, { exit });

    // Synchronously after the call returns: the response must have been
    // written, but 'finish' has not fired yet (it's scheduled via
    // setImmediate), so nothing downstream of it may have happened.
    assert.deepEqual(events, ['writeHead:204', 'end'], 'writeHead + end must happen synchronously, nothing else yet');
    assert.equal(existsSync(target), true, 'the runfile must still be present before finish fires');
    assert.equal(exitCalled, false, 'exit must not be called before finish fires');

    // Let the scheduled 'finish' event (and its listener) run.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(existsSync(target), false, 'the runfile must be removed once finish has fired');
    assert.equal(exitCalled, true, 'exit must be called once finish has fired');
    assert.deepEqual(events, ['writeHead:204', 'end', 'exit:0'], 'exit must be the LAST thing that happens');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('handleStop is idempotent in effect: no runfile present still responds and still exits', async () => {
  const { base } = makeProject();
  const events = [];
  const res = makeFakeRes(events);
  let exitCalled = false;
  try {
    handleStop({}, res, base, { exit: () => { exitCalled = true; } });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(events, ['writeHead:204', 'end']);
    assert.equal(exitCalled, true, 'exit must still be called even when there was no runfile to remove');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

// ---- the HTTP route ---------------------------------------------------------

test('POST /api/stop is dispatched BEFORE the 405 gate (reachable via POST) and responds 204', async () => {
  const { base, dist } = makeProject();
  writeRunfile(base, { pid: process.pid, port: 1, startedAt: 'x' });
  const exitCalls = [];
  const server = createDashboardServer({ root: base, assetRoot: dist, stop: { exit: (code) => exitCalls.push(code) } });
  try {
    const port = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/stop`, { method: 'POST' });
    assert.equal(res.status, 204);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(exitCalls, [0], 'exit must be called exactly once, after the response finished');
    assert.equal(existsSync(runfilePath(base)), false, 'the runfile must be gone once the request completes');
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('the 405 gate still rejects every OTHER non-GET method, including other methods on /api/stop', async () => {
  const { base, dist } = makeProject();
  const server = createDashboardServer({ root: base, assetRoot: dist, stop: { exit: () => {} } });
  try {
    const port = await start(server);
    // GET is allowed THROUGH the method gate (it isn't rejected there); since
    // no GET route matches /api/stop it falls through to the unmatched-route
    // 404 — the same "no GET handler on a write-only route" shape whats-next
    // already exhibits, not a 405 (405 is only for the REJECTED methods).
    const get = await fetch(`http://127.0.0.1:${port}/api/stop`, { method: 'GET' });
    assert.equal(get.status, 404, 'GET /api/stop has no matching route and falls through to 404');
    const put = await fetch(`http://127.0.0.1:${port}/api/stop`, { method: 'PUT' });
    assert.equal(put.status, 405);
    // unrelated route, unrelated non-GET method: unchanged 405 behaviour.
    const postDoc = await fetch(`http://127.0.0.1:${port}/api/doc`, { method: 'POST' });
    assert.equal(postDoc.status, 405);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('the handler takes no body and no query parameters — a stray body/query changes nothing about the target', async () => {
  const { base, dist } = makeProject();
  writeRunfile(base, { pid: process.pid, port: 1, startedAt: 'x' });
  const exitCalls = [];
  const server = createDashboardServer({ root: base, assetRoot: dist, stop: { exit: (code) => exitCalls.push(code) } });
  try {
    const port = await start(server);
    const res = await fetch(
      `http://127.0.0.1:${port}/api/stop?path=${encodeURIComponent('../../etc/whatever')}`,
      { method: 'POST', body: JSON.stringify({ path: '../../etc/whatever' }) },
    );
    assert.equal(res.status, 204);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(exitCalls, [0]);
    assert.equal(existsSync(runfilePath(base)), false, 'only the server-derived runfile is ever touched');
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('readRunfile confirms writeRunfile actually wrote a real runfile for these tests to remove', () => {
  const { base } = makeProject();
  try {
    writeRunfile(base, { pid: 999, port: 1, startedAt: 'x' });
    const rf = readRunfile(base);
    assert.ok(rf && rf.pid === 999, 'sanity: the test helper writes a readable runfile');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
