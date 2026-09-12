import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createDashboardServer } from '../server.mjs';

function makeProject() {
  const base = mkdtempSync(path.join(tmpdir(), 'aw005-api-'));
  const ah = path.join(base, '.agentheim');
  mkdirSync(ah);
  mkdirSync(path.join(ah, 'knowledge'), { recursive: true });
  writeFileSync(path.join(ah, 'knowledge', 'vision.md'), '# Vision body');

  const knowledgeBc = path.join(ah, 'knowledge', 'contexts', 'alpha');
  mkdirSync(knowledgeBc, { recursive: true });
  writeFileSync(path.join(knowledgeBc, 'README.md'), '# Alpha');

  const bc = path.join(ah, 'board', 'alpha');
  for (const f of ['backlog', 'todo', 'doing', 'done']) {
    mkdirSync(path.join(bc, f), { recursive: true });
  }
  writeFileSync(
    path.join(bc, 'backlog', 'alpha-001-thing.md'),
    '---\nid: alpha-001\ntitle: Thing\nstatus: backlog\ntype: feature\ncontext: alpha\n---\n\nbody'
  );
  return { base };
}

async function start(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

test('GET /api/tree returns the BC × lifecycle × task projection as JSON', async () => {
  const { base } = makeProject();
  const server = createDashboardServer({ root: base });
  try {
    const port = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/tree`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const tree = await res.json();
    assert.equal(tree.contexts[0].name, 'alpha');
    const task = tree.contexts[0].lifecycle.backlog[0];
    assert.equal(task.id, 'alpha-001');
    assert.equal(task.context, 'alpha');
    assert.equal(task.status, 'backlog');
    assert.equal(tree.locations.vision, '.agentheim/knowledge/vision.md');
    // no document body in the tree response
    assert.equal(JSON.stringify(tree).includes('Vision body'), false);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET /api/doc returns raw markdown for a valid in-root path', async () => {
  const { base } = makeProject();
  const server = createDashboardServer({ root: base });
  try {
    const port = await start(server);
    const res = await fetch(
      `http://127.0.0.1:${port}/api/doc?path=${encodeURIComponent('.agentheim/knowledge/vision.md')}`
    );
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/markdown|text\/plain/);
    assert.match(await res.text(), /Vision body/);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET /api/doc rejects an escaping path with 4xx and touches no file', async () => {
  const { base } = makeProject();
  const server = createDashboardServer({ root: base });
  try {
    const port = await start(server);
    const res = await fetch(
      `http://127.0.0.1:${port}/api/doc?path=${encodeURIComponent('../../../etc/passwd')}`
    );
    assert.ok(res.status >= 400 && res.status < 500, `expected 4xx, got ${res.status}`);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET /api/doc 400s when the path query is missing', async () => {
  const { base } = makeProject();
  const server = createDashboardServer({ root: base });
  try {
    const port = await start(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/doc`);
    assert.equal(res.status, 400);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET /api/doc 404s for an in-root path that does not exist', async () => {
  const { base } = makeProject();
  const server = createDashboardServer({ root: base });
  try {
    const port = await start(server);
    const res = await fetch(
      `http://127.0.0.1:${port}/api/doc?path=${encodeURIComponent('.agentheim/nope.md')}`
    );
    assert.equal(res.status, 404);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});

test('GET /api/doc refuses to serve a directory (400/404, not a stream)', async () => {
  const { base } = makeProject();
  const server = createDashboardServer({ root: base });
  try {
    const port = await start(server);
    const res = await fetch(
      `http://127.0.0.1:${port}/api/doc?path=${encodeURIComponent('.agentheim/contexts')}`
    );
    assert.ok(res.status >= 400 && res.status < 500, `expected 4xx, got ${res.status}`);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
  }
});
