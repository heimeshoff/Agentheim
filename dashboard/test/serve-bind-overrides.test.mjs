import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runfilePath, lastPortPath, dashboardDir } from '../runfile.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const serveEntry = path.join(here, '..', 'serve.mjs');

function makeRoot() {
  const base = mkdtempSync(path.join(tmpdir(), 't6qqg-'));
  mkdirSync(path.join(base, '.agentheim'));
  return base;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

function runServe(root, env) {
  const child = spawn(process.execPath, [serveEntry], {
    cwd: tmpdir(),
    env: { ...process.env, AGENTHEIM_ROOT: root, AGENTHEIM_DASHBOARD_HOST: '', AGENTHEIM_DASHBOARD_PORT: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const state = { stdout: '', stderr: '', exited: null };
  child.stdout.on('data', (d) => (state.stdout += d));
  child.stderr.on('data', (d) => (state.stderr += d));
  state.exit = new Promise((r) => child.on('exit', (code) => { state.exited = code; r(code); }));
  state.child = child;
  return state;
}

async function waitFor(pred, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await pred()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

test('serve.mjs: invalid AGENTHEIM_DASHBOARD_PORT exits 1, names variable on stderr, writes no runfile', async () => {
  const root = makeRoot();
  const s = runServe(root, { AGENTHEIM_DASHBOARD_PORT: 'abc' });
  try {
    const code = await Promise.race([s.exit, new Promise((r) => setTimeout(() => r('timeout'), 8000))]);
    assert.equal(code, 1);
    assert.match(s.stderr, /AGENTHEIM_DASHBOARD_PORT/);
    assert.match(s.stderr, /abc/);
    assert.ok(!existsSync(runfilePath(root)), 'no runfile');
    assert.ok(!existsSync(lastPortPath(root)), 'no last-good marker');
  } finally {
    s.child.kill();
    rmSync(root, { recursive: true, force: true });
  }
});

test('serve.mjs: fixed port binds exactly that port and leaves the last-good marker untouched', async () => {
  const root = makeRoot();
  const port = await freePort();
  let s = runServe(root, { AGENTHEIM_DASHBOARD_PORT: String(port) });
  try {
    assert.ok(await waitFor(() => existsSync(runfilePath(root))), 'runfile written');
    assert.equal(JSON.parse(readFileSync(runfilePath(root), 'utf8')).port, port);
    assert.equal((await fetch(`http://127.0.0.1:${port}/healthz`)).status, 200);
    assert.match(s.stdout, new RegExp(`http://127\\.0\\.0\\.1:${port}/`));
    assert.ok(!existsSync(lastPortPath(root)), 'marker not created');
    s.child.kill();
    await s.exit;

    // An existing marker stays byte-identical across a fixed-port launch.
    mkdirSync(dashboardDir(root), { recursive: true });
    const marker = JSON.stringify({ port: 41234 });
    writeFileSync(lastPortPath(root), marker);
    rmSync(runfilePath(root), { force: true });
    s = runServe(root, { AGENTHEIM_DASHBOARD_PORT: String(port) });
    assert.ok(await waitFor(() => existsSync(runfilePath(root))), 'runfile written again');
    assert.equal(readFileSync(lastPortPath(root), 'utf8'), marker);
  } finally {
    s.child.kill();
    rmSync(root, { recursive: true, force: true });
  }
});

test('serve.mjs: busy fixed port exits 1 naming the port and variable, no other port tried', async () => {
  const root = makeRoot();
  const blocker = createServer();
  await new Promise((r) => blocker.listen(0, '127.0.0.1', r));
  const port = blocker.address().port;
  const s = runServe(root, { AGENTHEIM_DASHBOARD_PORT: String(port) });
  try {
    assert.equal(await s.exit, 1);
    assert.match(s.stderr, new RegExp(String(port)));
    assert.match(s.stderr, /AGENTHEIM_DASHBOARD_PORT/);
    assert.ok(!existsSync(runfilePath(root)));
  } finally {
    s.child.kill();
    blocker.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('serve.mjs: AGENTHEIM_DASHBOARD_HOST=0.0.0.0 binds the wildcard and prints a 127.0.0.1 URL', async () => {
  const root = makeRoot();
  const port = await freePort();
  const s = runServe(root, { AGENTHEIM_DASHBOARD_HOST: '0.0.0.0', AGENTHEIM_DASHBOARD_PORT: String(port) });
  try {
    assert.ok(await waitFor(() => /Dashboard listening at/.test(s.stdout)), 'listening line printed');
    assert.match(s.stdout, new RegExp(`http://127\\.0\\.0\\.1:${port}/`));
    assert.equal((await fetch(`http://127.0.0.1:${port}/healthz`)).status, 200);
    // Bound to the wildcard: the port is busy on a non-loopback-specific probe too.
    const probe = createServer();
    const err = await new Promise((r) => {
      probe.once('error', r);
      probe.listen(port, '0.0.0.0', () => r(null));
    });
    probe.close();
    assert.equal(err && err.code, 'EADDRINUSE', 'server holds 0.0.0.0:<port>');
  } finally {
    s.child.kill();
    rmSync(root, { recursive: true, force: true });
  }
});
