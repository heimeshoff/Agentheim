// GET /api/bridge (infrastructure-014, ADR-0018; grown a `kind` field and a
// distinct Herdr shape by ADR-0082 §1/§3, infrastructure-xh8tw): the
// dashboard server's server-mediated bridge discovery. The sandboxed
// frontend is filesystem-blind, so the server reads `.agentheim/.dashboard/
// bridge.json` (written by the VS Code extension, infrastructure-013) and
// serves the subset `{ port, token, v, capabilities }` over the same
// localhost transport (`capabilities` added by infrastructure-v8r3q —
// belt-and-braces only; the authoritative check is the live `GET /health`,
// not this endpoint). Absent OR unreadable/malformed → 200 { present: false }
// so the frontend degrades silently to clipboard. NEVER a 5xx for normal
// absence (ADR-0018). Every response additively carries `kind` (the
// per-machine bridge selection, `null` when unset); when `kind==='herdr'`
// the response is a wholly different shape carrying `token`/`capabilities`/
// `live` instead of reading bridge.json at all.
//
// EVERY TEST INJECTS A FAKE `homedir` — a server created without one would
// read the BUILDER's real `~/.config/agentheim/config.json` and could find a
// real, live Herdr install (the e8h9f worker hit exactly this hazard).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createDashboardServer } from '../server.mjs';
import { bridgeConfigPath } from '../../lib/bridge-selection.mjs';

function makeProject() {
  const base = mkdtempSync(path.join(tmpdir(), 'inf014-bridge-'));
  mkdirSync(path.join(base, '.agentheim'));
  const dist = path.join(base, 'dashboard', 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>dash</title>');
  const home = mkdtempSync(path.join(tmpdir(), 'inf014-bridge-home-'));
  return { base, dist, home };
}

function writeBridge(base, contents) {
  const dir = path.join(base, '.agentheim', '.dashboard');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'bridge.json'), contents);
}

function writeBridgeSelectionFile(home, bridge) {
  const configPath = bridgeConfigPath(home);
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify({ schema: 1, bridge }));
}

async function start(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address();
}

test('GET /api/bridge serves { port, token, v, capabilities, kind } when bridge.json is present and no selection is recorded', async () => {
  const { base, dist, home } = makeProject();
  // The extension writes the full { port, token, pid, startedAt, v, capabilities }
  // shape; the endpoint must return the { port, token, v, capabilities } subset
  // (no leak of pid/startedAt), plus the new additive `kind` (null: no
  // per-machine selection recorded in this fake home).
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
  const server = createDashboardServer({ root: base, assetRoot: dist, homedir: home });
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
      kind: null,
    });
    // pid/startedAt must not leak through the discovery contract.
    assert.equal('pid' in body, false);
    assert.equal('startedAt' in body, false);
    assert.equal('present' in body, false);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('GET /api/bridge serves a bridge.json written by a pre-handshake bridge (no capabilities field) without inventing one', async () => {
  const { base, dist, home } = makeProject();
  // A 0.2.0-shaped bridge.json predates the capabilities field entirely — it
  // never wrote one, so the endpoint must pass that absence through rather
  // than fabricate LEGACY_CAPABILITIES itself (that inference is the
  // frontend's job, off the live /health probe, not this belt-and-braces
  // endpoint's).
  writeBridge(
    base,
    JSON.stringify({ port: 51235, token: 'b'.repeat(32), pid: 1, startedAt: 1, v: 1 }),
  );
  const server = createDashboardServer({ root: base, assetRoot: dist, homedir: home });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { port: 51235, token: 'b'.repeat(32), v: 1, kind: null });
    assert.equal('capabilities' in body, false, 'no capabilities field is fabricated when bridge.json never had one');
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('GET /api/bridge returns 200 { present: false, kind: null } when bridge.json is absent and no selection is recorded', async () => {
  const { base, dist, home } = makeProject(); // no bridge.json written
  const server = createDashboardServer({ root: base, assetRoot: dist, homedir: home });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge`);
    assert.equal(res.status, 200); // never a 5xx for normal absence
    const body = await res.json();
    assert.deepEqual(body, { present: false, kind: null });
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('GET /api/bridge returns 200 { present: false, kind: null } when bridge.json is malformed', async () => {
  const { base, dist, home } = makeProject();
  writeBridge(base, '{ not valid json ');
  const server = createDashboardServer({ root: base, assetRoot: dist, homedir: home });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge`);
    assert.equal(res.status, 200); // a present-but-corrupt file must not 5xx
    const body = await res.json();
    assert.deepEqual(body, { present: false, kind: null });
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('GET /api/bridge returns kind:"vscode" additively when that selection is recorded (bridge.json still drives the rest)', async () => {
  const { base, dist, home } = makeProject();
  writeBridgeSelectionFile(home, 'vscode');
  const server = createDashboardServer({ root: base, assetRoot: dist, homedir: home });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { present: false, kind: 'vscode' });
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// kind === 'herdr' — ADR-0082 §1/§3: a wholly different shape, bridge.json is
// never read at all.
// ---------------------------------------------------------------------------

test('GET /api/bridge with kind:"herdr" recorded serves { present:true, kind, token, capabilities, live } and NEVER reads bridge.json', async () => {
  const { base, dist, home } = makeProject();
  writeBridgeSelectionFile(home, 'herdr');
  // A stray bridge.json in place must be ignored entirely for the herdr branch.
  writeBridge(base, JSON.stringify({ port: 1, token: 'x'.repeat(32), v: 1 }));
  const server = createDashboardServer({
    root: base,
    assetRoot: dist,
    homedir: home,
    herdr: {
      resolve: { which: () => null },
      liveness: { existsSync: () => false, cache: { value: false, expiresAt: 0 } },
    },
  });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.present, true);
    assert.equal(body.kind, 'herdr');
    assert.equal(typeof body.token, 'string');
    assert.equal(body.token.length, 32);
    assert.deepEqual(body.capabilities, ['prompt', 'skipPermissions', 'name', 'model']);
    assert.equal(body.live, false); // socket absent (existsSync faked to false)
    assert.equal('port' in body, false, 'the herdr shape carries no VS Code port field');
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('the herdr token is stable across repeated GETs within one server instance', async () => {
  const { base, dist, home } = makeProject();
  writeBridgeSelectionFile(home, 'herdr');
  const server = createDashboardServer({
    root: base,
    assetRoot: dist,
    homedir: home,
    herdr: {
      resolve: { which: () => null },
      liveness: { existsSync: () => false, cache: { value: false, expiresAt: 0 } },
    },
  });
  try {
    const { port } = await start(server);
    const first = await (await fetch(`http://127.0.0.1:${port}/api/bridge`)).json();
    const second = await (await fetch(`http://127.0.0.1:${port}/api/bridge`)).json();
    assert.equal(first.token, second.token);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('two independently-created server instances mint different tokens', async () => {
  const { base, dist, home } = makeProject();
  writeBridgeSelectionFile(home, 'herdr');
  const opts = {
    root: base,
    assetRoot: dist,
    homedir: home,
    herdr: {
      resolve: { which: () => null },
      liveness: { existsSync: () => false, cache: { value: false, expiresAt: 0 } },
    },
  };
  const serverA = createDashboardServer(opts);
  const serverB = createDashboardServer(opts);
  try {
    const a = await start(serverA);
    const b = await start(serverB);
    const bodyA = await (await fetch(`http://127.0.0.1:${a.port}/api/bridge`)).json();
    const bodyB = await (await fetch(`http://127.0.0.1:${b.port}/api/bridge`)).json();
    assert.notEqual(bodyA.token, bodyB.token);
  } finally {
    serverA.close();
    serverB.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('token is absent from the response body when kind !== "herdr"', async () => {
  const { base, dist, home } = makeProject(); // no selection recorded -> kind: null
  const server = createDashboardServer({ root: base, assetRoot: dist, homedir: home });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge`);
    const body = await res.json();
    assert.equal('token' in body, false);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('GET /api/bridge reports live:true when the herdr socket exists and `herdr status` succeeds', async () => {
  const { base, dist, home } = makeProject();
  writeBridgeSelectionFile(home, 'herdr');
  const server = createDashboardServer({
    root: base,
    assetRoot: dist,
    homedir: home,
    herdr: {
      resolve: { which: () => '/fake/bin/herdr' },
      liveness: { existsSync: () => true, exec: () => '{"ok":true}', cache: { value: false, expiresAt: 0 } },
    },
  });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge`);
    const body = await res.json();
    assert.equal(body.live, true);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
