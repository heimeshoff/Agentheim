import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  runfilePath,
  writeRunfile,
  readRunfile,
  deleteRunfile,
  isPidAlive,
  inspectExisting,
  lastPortPath,
  writeLastPort,
  readLastPort,
} from '../runfile.mjs';

function makeRoot() {
  const base = mkdtempSync(path.join(tmpdir(), 'aw004-rf-'));
  mkdirSync(path.join(base, '.agentheim'));
  return base;
}

test('runfilePath lives under .agentheim/.dashboard/runtime.json', () => {
  const root = makeRoot();
  try {
    assert.equal(
      runfilePath(root),
      path.join(root, '.agentheim', '.dashboard', 'runtime.json')
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('writeRunfile then readRunfile round-trips {pid, port, startedAt}', () => {
  const root = makeRoot();
  try {
    writeRunfile(root, { pid: 4242, port: 51001, startedAt: '2026-06-06T00:00:00.000Z' });
    const rf = readRunfile(root);
    assert.equal(rf.pid, 4242);
    assert.equal(rf.port, 51001);
    assert.equal(rf.startedAt, '2026-06-06T00:00:00.000Z');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('writeRunfile then readRunfile round-trips pluginVersion + pluginRoot (ADR-0002 version-aware addendum)', () => {
  const root = makeRoot();
  try {
    writeRunfile(root, {
      pid: 4242,
      port: 51001,
      startedAt: '2026-06-06T00:00:00.000Z',
      pluginVersion: '0.9.2',
      pluginRoot: path.join(root, 'plugin'),
    });
    const rf = readRunfile(root);
    assert.equal(rf.pluginVersion, '0.9.2');
    assert.equal(rf.pluginRoot, path.join(root, 'plugin'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an older runfile written without pluginVersion/pluginRoot is tolerated (undefined, not a parse error)', () => {
  const root = makeRoot();
  try {
    mkdirSync(path.join(root, '.agentheim', '.dashboard'), { recursive: true });
    writeFileSync(
      runfilePath(root),
      JSON.stringify({ pid: 4242, port: 51001, startedAt: 'x' })
    );
    const rf = readRunfile(root);
    assert.equal(rf.pid, 4242);
    assert.equal(rf.pluginVersion, undefined);
    assert.equal(rf.pluginRoot, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readRunfile returns null when no runfile exists', () => {
  const root = makeRoot();
  try {
    assert.equal(readRunfile(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('deleteRunfile removes the runfile', () => {
  const root = makeRoot();
  try {
    writeRunfile(root, { pid: 1, port: 2, startedAt: 'x' });
    assert.ok(existsSync(runfilePath(root)));
    deleteRunfile(root);
    assert.ok(!existsSync(runfilePath(root)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('isPidAlive is true for the current process and false for an impossible pid', () => {
  assert.equal(isPidAlive(process.pid), true);
  assert.equal(isPidAlive(2147483600), false);
});

test('inspectExisting reports "none" when there is no runfile', () => {
  const root = makeRoot();
  try {
    assert.deepEqual(inspectExisting(root), { state: 'none' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inspectExisting reports "live" with the runfile when the pid is alive', () => {
  const root = makeRoot();
  try {
    writeRunfile(root, { pid: process.pid, port: 9999, startedAt: 'x' });
    const r = inspectExisting(root);
    assert.equal(r.state, 'live');
    assert.equal(r.runfile.port, 9999);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inspectExisting reports "stale" and clears the runfile when the pid is dead', () => {
  const root = makeRoot();
  try {
    writeRunfile(root, { pid: 2147483600, port: 9999, startedAt: 'x' });
    const r = inspectExisting(root);
    assert.equal(r.state, 'stale');
    // stale runfile is reaped so a relaunch never orphans / never reuses a dead port
    assert.ok(!existsSync(runfilePath(root)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── last-port marker (infrastructure-019): a memory of the last good origin ──

test('lastPortPath lives beside runtime.json in .agentheim/.dashboard/last-port.json', () => {
  const root = makeRoot();
  try {
    assert.equal(
      lastPortPath(root),
      path.join(root, '.agentheim', '.dashboard', 'last-port.json')
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('writeLastPort then readLastPort round-trips the port', () => {
  const root = makeRoot();
  try {
    writeLastPort(root, 41500);
    assert.equal(readLastPort(root), 41500);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readLastPort returns null when no marker exists (first launch)', () => {
  const root = makeRoot();
  try {
    assert.equal(readLastPort(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readLastPort returns null on a malformed / non-JSON marker (never crashes)', () => {
  const root = makeRoot();
  try {
    mkdirSync(path.join(root, '.agentheim', '.dashboard'), { recursive: true });
    writeFileSync(lastPortPath(root), 'not json at all {');
    assert.equal(readLastPort(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readLastPort returns null when the marker has no integer port field', () => {
  const root = makeRoot();
  try {
    mkdirSync(path.join(root, '.agentheim', '.dashboard'), { recursive: true });
    writeFileSync(lastPortPath(root), JSON.stringify({ port: 'forty-one-thousand' }));
    assert.equal(readLastPort(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the last-port marker is independent of the runfile: reaping the runfile leaves it intact', () => {
  const root = makeRoot();
  try {
    writeRunfile(root, { pid: 2147483600, port: 41500, startedAt: 'x' });
    writeLastPort(root, 41500);
    // A dead pid reaps the runfile (runtime.json's contract), but the marker —
    // a pure memory of the origin — must survive so the next launch sticks.
    inspectExisting(root);
    assert.ok(!existsSync(runfilePath(root)), 'runfile reaped');
    assert.equal(readLastPort(root), 41500, 'marker survives reaping');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
