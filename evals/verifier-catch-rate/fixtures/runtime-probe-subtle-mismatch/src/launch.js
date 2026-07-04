#!/usr/bin/env node
// Cross-platform launcher for the widgets status server (mirrors
// dashboard/launch.mjs's detached-spawn + runfile pattern, ADR-0036 pt 4).
//
// Usage:
//   node src/launch.js         # boot detached, wait for runfile, print pid/port
//   node src/launch.js stop    # read runfile, kill pid, remove runfile
'use strict';

const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = process.cwd();
const RUNFILE = path.join(ROOT, '.tmp', 'runtime.json');
const SERVE_ENTRY = path.join(__dirname, 'serve.js');

function readRunfile() {
  try {
    return JSON.parse(fs.readFileSync(RUNFILE, 'utf8'));
  } catch {
    return null;
  }
}

function deleteRunfile() {
  try {
    fs.unlinkSync(RUNFILE);
  } catch {
    /* already gone */
  }
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForRunfile(timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rf = readRunfile();
    if (rf && isPidAlive(rf.pid)) return rf;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

async function launch() {
  deleteRunfile(); // reap any stale runfile before boot
  const child = spawn(process.execPath, [SERVE_ENTRY, RUNFILE], {
    cwd: os.tmpdir(),
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  });
  child.unref();

  const rf = await waitForRunfile();
  if (!rf) {
    console.error('widgets status server did not report a runfile within the timeout (boot failure)');
    process.exitCode = 1;
    return;
  }
  console.log(`launched pid ${rf.pid} port ${rf.port}`);
}

function terminate(pid) {
  if (!isPidAlive(pid)) return;
  try {
    process.kill(pid);
  } catch {
    /* fall through to platform fallback */
  }
  if (process.platform === 'win32' && isPidAlive(pid)) {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/F', '/T'], { stdio: 'ignore' });
    } catch {
      /* best effort */
    }
  }
}

function stop() {
  const rf = readRunfile();
  if (!rf) {
    console.log('no runfile; nothing to stop');
    return;
  }
  terminate(rf.pid);
  deleteRunfile();
  console.log(`stopped pid ${rf.pid}`);
}

const cmd = process.argv[2];
if (cmd === 'stop') {
  stop();
} else {
  launch();
}
