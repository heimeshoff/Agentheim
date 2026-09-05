import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { launchDashboard, stopDashboard, decideReuseOrReplace, statusDashboard } from '../launch.mjs';
import { readRunfile, runfilePath, isPidAlive, writeRunfile } from '../runfile.mjs';
import { resolvePluginRoot, readPluginVersion } from '../plugin-version.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const serveEntry = path.join(here, '..', 'serve.mjs');

function makeRoot() {
  const base = mkdtempSync(path.join(tmpdir(), 'aw004-lnch-'));
  mkdirSync(path.join(base, '.agentheim'));
  return base;
}

async function waitFor(pred, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await pred()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

test('launchDashboard spawns a detached server, writes a runfile, and is reachable', async () => {
  const root = makeRoot();
  try {
    const result = await launchDashboard(root);
    assert.equal(result.action, 'launched');
    assert.ok(result.port > 0);
    assert.ok(result.pid > 0);

    // runfile written with {pid, port, startedAt}
    const ready = await waitFor(() => !!readRunfile(root));
    assert.ok(ready, 'runfile should be written');
    const rf = readRunfile(root);
    assert.equal(rf.pid, result.pid);
    assert.equal(rf.port, result.port);
    assert.ok(rf.startedAt);

    // server is actually serving the health check
    const res = await fetch(`http://127.0.0.1:${result.port}/healthz`);
    assert.equal(res.status, 200);

    // stop kills the process and removes the runfile
    const stopped = await stopDashboard(root);
    assert.equal(stopped.action, 'stopped');
    const gone = await waitFor(() => !isPidAlive(result.pid));
    assert.ok(gone, 'process should be terminated by stop');
    assert.ok(!existsSync(runfilePath(root)), 'runfile should be removed by stop');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('launchDashboard reuses a live server instead of spawning a second', async () => {
  const root = makeRoot();
  try {
    const first = await launchDashboard(root);
    await waitFor(() => !!readRunfile(root));

    const second = await launchDashboard(root);
    assert.equal(second.action, 'reused');
    assert.equal(second.port, first.port);
    assert.equal(second.pid, first.pid);

    await stopDashboard(root);
    await waitFor(() => !isPidAlive(first.pid));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('launchDashboard replaces a stale runfile (dead pid) and never orphans', async () => {
  const root = makeRoot();
  try {
    // plant a stale runfile pointing at a dead pid
    writeRunfile(root, { pid: 2147483600, port: 65000, startedAt: 'old' });

    const result = await launchDashboard(root);
    assert.equal(result.action, 'launched');
    assert.notEqual(result.pid, 2147483600);

    await waitFor(() => !!readRunfile(root));
    const rf = readRunfile(root);
    assert.equal(rf.pid, result.pid);

    await stopDashboard(root);
    await waitFor(() => !isPidAlive(result.pid));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('stopDashboard on no runfile reports nothing to stop (no throw)', async () => {
  const root = makeRoot();
  try {
    const r = await stopDashboard(root);
    assert.equal(r.action, 'none');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── version-aware reuse/replace (ADR-0002 addendum, infrastructure-rgknz) ────
// A live server that serves an OLDER plugin version is a REPLACE condition,
// not a reuse. `decideReuseOrReplace` is the pure decision (no I/O — injectable
// via `rootExists`) so it is unit-testable without a live process.

test('decideReuseOrReplace: equal version + existing root -> reuse', () => {
  const decision = decideReuseOrReplace(
    { pluginVersion: '0.9.2', pluginRoot: '/plugin/0.9.2' },
    { pluginVersion: '0.9.2', pluginRoot: '/plugin/0.9.2' },
    /* rootExists */ true
  );
  assert.deepEqual(decision, { action: 'reuse', reason: 'same-version' });
});

test('decideReuseOrReplace: different version -> replace, from/to carried through', () => {
  const decision = decideReuseOrReplace(
    { pluginVersion: '0.9.2', pluginRoot: '/plugin/0.9.2' },
    { pluginVersion: '0.9.3', pluginRoot: '/plugin/0.9.3' },
    true
  );
  assert.equal(decision.action, 'replace');
  assert.equal(decision.reason, 'version-mismatch');
  assert.equal(decision.from, '0.9.2');
  assert.equal(decision.to, '0.9.3');
});

test('decideReuseOrReplace: missing pluginVersion/pluginRoot fields (older runfile) -> replace, unknown', () => {
  const decision = decideReuseOrReplace(
    { pluginVersion: undefined, pluginRoot: undefined },
    { pluginVersion: '0.9.3', pluginRoot: '/plugin/0.9.3' },
    false
  );
  assert.equal(decision.action, 'replace');
  assert.equal(decision.reason, 'unknown-version');
  assert.equal(decision.from, null);
  assert.equal(decision.to, '0.9.3');
});

test('decideReuseOrReplace: same version but recorded pluginRoot no longer exists -> replace', () => {
  const decision = decideReuseOrReplace(
    { pluginVersion: '0.9.2', pluginRoot: '/plugin/0.9.2-removed' },
    { pluginVersion: '0.9.2', pluginRoot: '/plugin/0.9.2-removed' },
    /* rootExists */ false
  );
  assert.equal(decision.action, 'replace');
  assert.equal(decision.reason, 'missing-root');
});

test('launchDashboard replaces a live server on a version-mismatched runfile, stopping the old pid', async () => {
  const root = makeRoot();
  try {
    // First launch — real plugin version, real root (this worktree's own).
    const first = await launchDashboard(root);
    await waitFor(() => !!readRunfile(root));
    assert.ok(isPidAlive(first.pid));

    // Force a version mismatch by overwriting the live runfile's recorded
    // identity — the pid is still alive, but the "plugin" it claims to serve
    // is not the one this launcher resolves to.
    writeRunfile(root, {
      pid: first.pid,
      port: first.port,
      startedAt: 'old',
      pluginVersion: '0.0.1-older',
      pluginRoot: resolvePluginRoot(path.join(here, '..')),
    });

    const second = await launchDashboard(root);
    assert.equal(second.action, 'replaced');
    assert.equal(second.from, '0.0.1-older');
    assert.equal(second.to, readPluginVersion(resolvePluginRoot(path.join(here, '..'))));
    assert.notEqual(second.pid, first.pid);

    const oldGone = await waitFor(() => !isPidAlive(first.pid));
    assert.ok(oldGone, 'the outgoing (older-version) process must be stopped, never orphaned');

    await stopDashboard(root);
    await waitFor(() => !isPidAlive(second.pid));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('statusDashboard reports the serving pluginVersion', async () => {
  const root = makeRoot();
  try {
    const result = await launchDashboard(root);
    await waitFor(() => !!readRunfile(root));

    const status = statusDashboard(root);
    assert.equal(status.state, 'running');
    assert.equal(status.pluginVersion, readPluginVersion(resolvePluginRoot(path.join(here, '..'))));

    await stopDashboard(root);
    await waitFor(() => !isPidAlive(result.pid));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
