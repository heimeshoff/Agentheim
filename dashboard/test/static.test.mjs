import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentTypeFor } from '../static.mjs';

test('contentTypeFor maps common dashboard asset extensions', () => {
  assert.equal(contentTypeFor('index.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeFor('app.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeFor('app.mjs'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeFor('styles.css'), 'text/css; charset=utf-8');
  assert.equal(contentTypeFor('data.json'), 'application/json; charset=utf-8');
  assert.equal(contentTypeFor('icon.svg'), 'image/svg+xml');
  assert.equal(contentTypeFor('logo.png'), 'image/png');
  assert.equal(contentTypeFor('font.woff2'), 'font/woff2');
});

test('contentTypeFor falls back to octet-stream for unknown extensions', () => {
  assert.equal(contentTypeFor('mystery.zzz'), 'application/octet-stream');
  assert.equal(contentTypeFor('noext'), 'application/octet-stream');
});

test('contentTypeFor is case-insensitive on the extension', () => {
  assert.equal(contentTypeFor('INDEX.HTML'), 'text/html; charset=utf-8');
});

// infrastructure-yaajt / ADR-0083: code-split chunks under dist/chunks/ are
// served by the unchanged handler (nested path, traversal guard, no-cache).
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serveStatic } from '../static.mjs';

function fakeRes() {
  const res = { status: null, headers: null, body: '' };
  res.writeHead = (s, h) => { res.status = s; res.headers = h; };
  res.end = (b) => { res.body += b ?? ''; res.ended = true; };
  res.write = (b) => { res.body += b; };
  res.on = () => res; res.once = () => res; res.emit = () => true;
  return res;
}

async function getStatic(root, url) {
  const res = fakeRes();
  const { PassThrough } = await import('node:stream');
  const sink = new PassThrough();
  const chunks = [];
  sink.on('data', (c) => chunks.push(c));
  const done = new Promise((r) => sink.on('end', r));
  const out = Object.assign(sink, { writeHead: res.writeHead });
  const origEnd = sink.end.bind(sink);
  out.end = (b) => { if (b != null) sink.write(b); origEnd(); };
  serveStatic({ url }, out, root);
  await done;
  return { status: res.status, headers: res.headers, body: Buffer.concat(chunks).toString() };
}

test('GET /chunks/<file>.js serves 200, text/javascript, no-cache; traversal 403; missing 404 (ADR-0083)', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'yaajt-static-'));
  try {
    mkdirSync(path.join(root, 'chunks'));
    writeFileSync(path.join(root, 'chunks', 'mermaid-ABC123.js'), 'export default 1;');
    const ok = await getStatic(root, '/chunks/mermaid-ABC123.js');
    assert.equal(ok.status, 200);
    assert.equal(ok.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal(ok.headers['cache-control'], 'no-cache');
    assert.equal(ok.body, 'export default 1;');

    assert.equal((await getStatic(root, '/chunks/../../etc/passwd')).status, 403);
    assert.equal((await getStatic(root, '/chunks/%2e%2e/%2e%2e/etc/passwd')).status, 403);
    assert.equal((await getStatic(root, '/chunks/nope-000.js')).status, 404);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
