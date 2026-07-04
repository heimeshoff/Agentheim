#!/usr/bin/env node
// Detached child entrypoint: actually binds the port and writes the runfile.
// Spawned by launch.js; never run directly by a human.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./server.js');

const RUNFILE = process.argv[2];
if (!RUNFILE) {
  console.error('serve.js requires an absolute runfile path as argv[2]');
  process.exit(1);
}

const server = createServer();
server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  fs.mkdirSync(path.dirname(RUNFILE), { recursive: true });
  fs.writeFileSync(RUNFILE, JSON.stringify({ pid: process.pid, port, startedAt: Date.now() }));
});
