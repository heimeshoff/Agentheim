import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

import { createDashboardServer } from '../server.mjs';
import { resolvePluginRoot, readPluginVersion } from '../plugin-version.mjs';

const serverModuleDir = path.dirname(fileURLToPath(new URL('../server.mjs', import.meta.url)));

function makeProjectWithDist() {
  const base = mkdtempSync(path.join(tmpdir(), 'aw004-srv-'));
  mkdirSync(path.join(base, '.agentheim'));
  const dist = path.join(base, 'dashboard', 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>dash</title>');
  writeFileSync(path.join(dist, 'app.js'), 'console.log(1)');
  return { base, dist };
}

async function start(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port, address } = server.address();
  return { port, address };
}

test('server binds 127.0.0.1 on an ephemeral port', async () => {
  const { base, dist } = makeProjectWithDist();
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port, address } = await start(server);
    assert.equal(address, '127.0.0.1');
    assert.ok(port > 0);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET /healthz returns 200 with ok status JSON', async () => {
  const { base, dist } = makeProjectWithDist();
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.root, base);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

// ADR-0002 version-aware addendum (infrastructure-rgknz): the serving plugin's
// own version, exposed on the read API so skew is visible without a launch.
test('GET /healthz reports the serving plugin version', async () => {
  const { base, dist } = makeProjectWithDist();
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    const body = await res.json();
    assert.equal(body.version, readPluginVersion(resolvePluginRoot(serverModuleDir)));
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

// ADR-0002 version-aware addendum (infrastructure-rgknz): every asset response
// carries Cache-Control: no-cache so a tab left open across a plugin update
// revalidates against the new server instead of replaying a cached bundle.
test('a static asset response carries Cache-Control: no-cache', async () => {
  const { base, dist } = makeProjectWithDist();
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/app.js`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('the served index document also carries Cache-Control: no-cache', async () => {
  const { base, dist } = makeProjectWithDist();
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET / serves the index document as HTML (title rewritten per infrastructure-011)', async () => {
  const { base, dist } = makeProjectWithDist();
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    // The index <title> is now rewritten to name the discovered project
    // (no vision.md here → the folder basename), not streamed verbatim.
    assert.match(await res.text(), new RegExp(`<title>${path.basename(base)} — Dashboard</title>`));
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET / injects the discovered project name into the served <title> (vision heading)', async () => {
  const { base, dist } = makeProjectWithDist();
  // Real index.html ships the baked default title; the runtime rewrites it.
  writeFileSync(
    path.join(dist, 'index.html'),
    '<!doctype html><head><title>Agentheim — Dashboard</title></head>',
  );
  writeFileSync(path.join(base, '.agentheim', 'vision.md'), '# Vision: Books\n\n## Purpose\n');
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.match(html, /<title>Books — Dashboard<\/title>/);
    assert.equal(html.includes('Agentheim — Dashboard'), false);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET / falls back to the folder name when vision.md has no `# Vision:` heading', async () => {
  const base = mkdtempSync(path.join(tmpdir(), 'aw004-fallback-'));
  mkdirSync(path.join(base, '.agentheim'));
  const dist = path.join(base, 'dashboard', 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(
    path.join(dist, 'index.html'),
    '<!doctype html><head><title>Agentheim — Dashboard</title></head>',
  );
  // vision.md present but with no `# Vision:` heading → folder basename wins.
  writeFileSync(path.join(base, '.agentheim', 'vision.md'), '## Purpose only\n');
  const folderName = path.basename(base);
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, new RegExp(`<title>${folderName} — Dashboard</title>`));
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('a traversal request returns 4xx and touches no file', async () => {
  const { base, dist } = makeProjectWithDist();
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    // encoded traversal that would escape the asset root
    const res = await fetch(`http://127.0.0.1:${port}/..%2f..%2f..%2fetc%2fpasswd`);
    assert.ok(res.status >= 400 && res.status < 500, `expected 4xx, got ${res.status}`);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET / returns a graceful 404 when dist/ is absent (assets not built)', async () => {
  const base = mkdtempSync(path.join(tmpdir(), 'aw004-nodist-'));
  mkdirSync(path.join(base, '.agentheim'));
  const missingDist = path.join(base, 'dashboard', 'dist');
  const server = createDashboardServer({ root: base, assetRoot: missingDist });
  try {
    const { port } = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 404);
    assert.match(await res.text(), /not built|absent/i);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

// /api/tree is wired in by agentic-workflow-005 (covered by read-api.test.mjs).
// The dashboard is READ-ONLY (ADR-0017): there is NO write path. The former
// POST /api/task/move endpoint was removed when drag-to-Promote was retired, so
// skills are the sole owners of task lifecycle. Here we pin that the route is
// gone — a POST is not a mounted endpoint, it falls through to the read-only
// 405 (non-GET/HEAD rejected), and a GET is a plain static 404, never a live
// route. Either way nothing on disk can be mutated through the server.
test('the dashboard exposes no write path — POST /api/task/move is not a route', async () => {
  const { base, dist } = makeProjectWithDist();
  const server = createDashboardServer({ root: base, assetRoot: dist });
  try {
    const { port } = await start(server);
    // POST is refused by the read-only method guard (405), NOT handled.
    const post = await fetch(`http://127.0.0.1:${port}/api/task/move`, { method: 'POST' });
    assert.equal(post.status, 405);
    // And there is no special-cased route for it: a GET is just a static miss.
    const get = await fetch(`http://127.0.0.1:${port}/api/task/move`);
    assert.equal(get.status, 404);
    assert.equal(get.headers.get('allow'), null);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});
