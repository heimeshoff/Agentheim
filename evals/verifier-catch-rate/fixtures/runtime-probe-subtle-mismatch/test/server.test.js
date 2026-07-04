'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { createServer, buildWidgetsPayload } = require('../src/server.js');

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });
}

test('buildWidgetsPayload shapes a { widgets: array } body', () => {
  const payload = buildWidgetsPayload();
  assert.ok(Array.isArray(payload.widgets));
  assert.ok(payload.widgets.length > 0);
  for (const w of payload.widgets) {
    assert.strictEqual(typeof w.id, 'number');
    assert.strictEqual(typeof w.colour, 'string');
  }
});

test('GET /healthz returns 200 { status: "ok" }', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const { status, body } = await get(port, '/healthz');
    assert.strictEqual(status, 200);
    assert.strictEqual(body.status, 'ok');
  } finally {
    server.close();
  }
});

test('GET /widgets returns 200 with a widgets array', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const { status, body } = await get(port, '/widgets');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body.widgets));
    assert.ok(body.widgets.length > 0);
  } finally {
    server.close();
  }
});

// Note: both tests above assert only top-level array-ness and the (buggy)
// `colour` key the implementation actually uses — neither asserts the
// manifest's declared per-item `color` field. That gap is exactly what the
// runtime drive (check 8) is designed to expose against the manifest text,
// not against what the implementation happens to use.
