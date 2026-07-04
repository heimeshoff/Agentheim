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

// Note: no end-to-end test hits GET /widgets over real HTTP — the worker
// considered buildWidgetsPayload()'s unit coverage (above) sufficient for
// the /widgets acceptance criterion. That gap is exactly what the runtime
// drive (check 8) is designed to expose.
