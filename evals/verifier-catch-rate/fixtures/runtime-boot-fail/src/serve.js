#!/usr/bin/env node
// Detached child entrypoint: actually binds the port and writes the runfile.
// Spawned by launch.js; never run directly by a human.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createServer, warmCache } = require('./server.js');

const RUNFILE = process.argv[2];
if (!RUNFILE) {
  console.error('serve.js requires an absolute runfile path as argv[2]');
  process.exit(1);
}

// BUG: server.js does not export a warmCache() function (it was never
// written — the worker's plan mentioned a cache warm-up step but the
// implementation only shipped createServer/buildWidgetsPayload). This
// throws synchronously, before the server ever binds a port, so no
// runfile is ever written. The unit tests never exercise this file — they
// import server.js directly — so they pass regardless of this bug.
warmCache();

const server = createServer();
server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  fs.mkdirSync(path.dirname(RUNFILE), { recursive: true });
  fs.writeFileSync(RUNFILE, JSON.stringify({ pid: process.pid, port, startedAt: Date.now() }));
});
