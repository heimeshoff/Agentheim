// GET /api/bridge (infrastructure-014, ADR-0018): the dashboard server's
// server-mediated discovery of the VS Code bridge listener. The sandboxed
// frontend is filesystem-blind, so the server reads `.agentheim/.dashboard/
// bridge.json` (written by the extension, infrastructure-013) and serves the
// subset `{ port, token, v, capabilities }` over the same localhost transport
// (`capabilities` added by infrastructure-v8r3q — belt-and-braces only; the
// authoritative check is the live `GET /health`, not this endpoint). Absent
// OR unreadable/malformed → 200 { present: false } so the frontend degrades
// silently to clipboard. NEVER a 5xx for normal absence (ADR-0018).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createDashboardServer } from '../server.mjs';

function makeProject() {
  const base = mkdtempSync(path.join(tmpdir(), 'inf014-bridge-'));
  mkdirSync(path.join(base, '.agentheim'));
  const dist = path.join(base, 'dashboard', 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>dash</title>');
  return { base, dist };
}

function writeBridge(base, contents) {
  const dir = path.join(base, '.agentheim', '.dashboard');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'bridge.json'), contents);
}

async function start(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address();
}

test('GET /api/bridge serves { port, token, v, capabilities } when bridge.json is present', async () => {
  const { base, dist } = makeProject();
  // The extension writes the full { port, token, pid, startedAt, v, capabilities }
  // shape; the endpoint must return the { port, token, v, capabilities } subset
  // (no leak of pid/startedAt).
  writeBridge(
    base,
    JSON.stringify({
      port: 51234,
      token: 'a'.repeat(32),
      pid: 4242,
      startedAt: 1,
      v: 1,
      capabilities: ['prompt', 'skipPermissions', 'name', 'model'],
    }),
  );
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const body = await res.json();
    assert.deepEqual(body, {
      port: 51234,
      token: 'a'.repeat(32),
      v: 1,
      capabilities: ['prompt', 'skipPermissions', 'name', 'model'],
    });
    // pid/startedAt must not leak through the discovery contract.
    assert.equal('pid' in body, false);
    assert.equal('startedAt' in body, false);
    assert.equal('present' in body, false);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET /api/bridge serves a bridge.json written by a pre-handshake bridge (no capabilities field) without inventing one', async () => {
  const { base, dist } = makeProject();
  // A 0.2.0-shaped bridge.json predates the capabilities field entirely — it
  // never wrote one, so the endpoint must pass that absence through rather
  // than fabricate LEGACY_CAPABILITIES itself (that inference is the
  // frontend's job, off the live /health probe, not this belt-and-braces
  // endpoint's).
  writeBridge(
    base,
    JSON.stringify({ port: 51235, token: 'b'.repeat(32), pid: 1, startedAt: 1, v: 1 }),
  );
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { port: 51235, token: 'b'.repeat(32), v: 1 });
    assert.equal('capabilities' in body, false, 'no capabilities field is fabricated when bridge.json never had one');
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET /api/bridge returns 200 { present: false } when bridge.json is absent', async () => {
  const { base, dist } = makeProject(); // no bridge.json written
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge`);
    assert.equal(res.status, 200); // never a 5xx for normal absence
    const body = await res.json();
    assert.deepEqual(body, { present: false });
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET /api/bridge returns 200 { present: false } when bridge.json is malformed', async () => {
  const { base, dist } = makeProject();
  writeBridge(base, '{ not valid json ');
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge`);
    assert.equal(res.status, 200); // a present-but-corrupt file must not 5xx
    const body = await res.json();
    assert.deepEqual(body, { present: false });
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});
