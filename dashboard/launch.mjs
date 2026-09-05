#!/usr/bin/env node
// Dashboard launcher (ADR-0002): ONE launcher, not a .sh + .bat pair. All OS
// differences are confined to the spawn options and the kill path below.
//
// Usage:
//   node dashboard/launch.mjs           # or: launch (+ auto-open browser)
//   node dashboard/launch.mjs stop      # stop the detached server
//   node dashboard/launch.mjs status    # report running/not-running (read-only)
//
// `launch` spawns serve.mjs DETACHED so the terminal returns to a prompt; the
// child binds 127.0.0.1 on an ephemeral port and writes the runfile itself.
// The launcher then prints the served URL — it does NOT open a browser; the
// builder opens the printed URL themselves (agentic-workflow-032).

import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverRoot } from './discovery.mjs';
import {
  readRunfile,
  deleteRunfile,
  isPidAlive,
  inspectExisting,
} from './runfile.mjs';
import { resolvePluginRoot, readPluginVersion } from './plugin-version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVE_ENTRY = path.join(__dirname, 'serve.mjs');

/**
 * Pure reuse/replace decision (ADR-0002 version-aware addendum,
 * infrastructure-rgknz): compares a live runfile's recorded plugin identity
 * against the launcher's own. No I/O — `rootExists` is probed by the caller
 * (`existsSync` on `existing.pluginRoot`) and passed in, so this decision is
 * unit-testable without spawning a process.
 *
 * Fails TOWARD FRESHNESS on every unknown: a runfile missing either field (an
 * older runfile written before this task) or whose recorded pluginRoot no
 * longer exists on disk (the cache dir was removed on update) is treated as
 * "unknown → replace", never reused blind. Equal version AND an existing root
 * is the only path that reuses.
 *
 * @param {{pluginVersion?: string|null, pluginRoot?: string|null}} existing  from the live runfile
 * @param {{pluginVersion: string|null, pluginRoot: string}} launcher         this launcher's own identity
 * @param {boolean} rootExists  whether existing.pluginRoot exists on disk
 * @returns {{action: 'reuse'|'replace', reason: string, from?: string|null, to?: string|null}}
 */
export function decideReuseOrReplace(existing, launcher, rootExists) {
  const from = existing.pluginVersion ?? null;
  const to = launcher.pluginVersion ?? null;
  if (existing.pluginVersion == null || existing.pluginRoot == null) {
    return { action: 'replace', reason: 'unknown-version', from, to };
  }
  if (!rootExists) {
    return { action: 'replace', reason: 'missing-root', from, to };
  }
  if (existing.pluginVersion !== launcher.pluginVersion) {
    return { action: 'replace', reason: 'version-mismatch', from, to };
  }
  return { action: 'reuse', reason: 'same-version' };
}

/** Wait until a fresh runfile (pid !== excludePid) appears, or time out. */
async function waitForRunfile(root, excludePid, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rf = readRunfile(root);
    if (rf && rf.pid !== excludePid && isPidAlive(rf.pid)) return rf;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

/**
 * Spawn a fresh detached server for `root` and wait for its runfile.
 * Differences across OSes live ONLY in these spawn options.
 * POSIX: detached:true lets the child outlive the shell.
 * Windows: detached:true + windowsHide:true; do NOT rely on shell job control
 *          or `start /b` semantics that tie the child to the console window.
 * cwd is a neutral temp dir, NOT the project root: a running process locks its
 * cwd on Windows, and the dashboard must never hold a lock on the project. The
 * child discovers the root from AGENTHEIM_ROOT instead of cwd.
 */
async function spawnServer(root) {
  const child = spawn(process.execPath, [SERVE_ENTRY], {
    cwd: tmpdir(),
    env: { ...process.env, AGENTHEIM_ROOT: root },
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  });
  child.unref();

  const rf = await waitForRunfile(root, /* excludePid */ undefined);
  if (!rf) {
    throw new Error('Dashboard server did not report a runfile within the timeout.');
  }
  return { pid: rf.pid, port: rf.port };
}

/**
 * Launch the dashboard for `root`. Reuses a live server ONLY when it serves the
 * SAME plugin version this launcher resolves to (ADR-0002 version-aware
 * addendum, infrastructure-rgknz); a dead pid, an unknown/missing plugin
 * identity, or a version mismatch is a REPLACE, not a reuse — the old process
 * is stopped and a fresh one launched from the current plugin.
 * Returns { action: 'launched'|'reused'|'replaced', pid, port, from?, to? }
 * (or throws on failure).
 */
export async function launchDashboard(root) {
  const existing = inspectExisting(root); // reaps a stale (dead-pid) runfile as a side effect
  if (existing.state === 'live') {
    const rf = existing.runfile;
    const launcherRoot = resolvePluginRoot(__dirname);
    const launcherVersion = readPluginVersion(launcherRoot);
    const rootExists = rf.pluginRoot ? existsSync(rf.pluginRoot) : false;
    const decision = decideReuseOrReplace(
      { pluginVersion: rf.pluginVersion, pluginRoot: rf.pluginRoot },
      { pluginVersion: launcherVersion, pluginRoot: launcherRoot },
      rootExists
    );
    if (decision.action === 'reuse') {
      return { action: 'reused', pid: rf.pid, port: rf.port };
    }
    // Version skew (or an unknown/missing-root runfile): stop the outgoing
    // process through the existing external kill path before launching fresh —
    // never orphan it.
    terminate(rf.pid);
    deleteRunfile(root);
    const spawned = await spawnServer(root);
    return { action: 'replaced', pid: spawned.pid, port: spawned.port, from: decision.from, to: decision.to };
  }

  const spawned = await spawnServer(root);
  return { action: 'launched', pid: spawned.pid, port: spawned.port };
}

/**
 * Terminate `pid`. process.kill works on both OSes; on Windows, if the process
 * is stubborn we fall back to `taskkill /PID <pid> /F /T` (documented in ADR-0002).
 */
export function terminate(pid) {
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

/**
 * Stop the dashboard for `root`: kill by pid, remove the runfile.
 * Returns { action: 'stopped'|'none', pid? }.
 */
export async function stopDashboard(root) {
  const rf = readRunfile(root);
  if (!rf) return { action: 'none' };
  terminate(rf.pid);
  deleteRunfile(root);
  return { action: 'stopped', pid: rf.pid };
}

/**
 * Report whether a dashboard is running for `root` WITHOUT launching or stopping.
 * Pure read over the runfile via inspectExisting (which reaps a stale file).
 * Returns { state: 'running', port, pid, pluginVersion } or { state: 'none' }.
 * `pluginVersion` is the SERVING version recorded in the runfile (null when
 * unknown — an older runfile, or a manifest that couldn't be read).
 */
export function statusDashboard(root) {
  const existing = inspectExisting(root); // reaps a stale runfile as a side effect
  if (existing.state === 'live') {
    return {
      state: 'running',
      port: existing.runfile.port,
      pid: existing.runfile.pid,
      pluginVersion: existing.runfile.pluginVersion ?? null,
    };
  }
  return { state: 'none' };
}

// ---- CLI ----
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const cmd = process.argv[2] || 'launch';
  const root = discoverRoot(process.cwd());
  if (cmd === 'stop') {
    const r = await stopDashboard(root);
    if (r.action === 'stopped') console.log(`Dashboard stopped (pid ${r.pid}); runfile removed.`);
    else console.log('No dashboard running (no runfile).');
  } else if (cmd === 'status') {
    const r = statusDashboard(root);
    if (r.state === 'running') {
      const versionSuffix = r.pluginVersion ? ` [v${r.pluginVersion}]` : '';
      console.log(`Dashboard running at http://127.0.0.1:${r.port}/ (pid ${r.pid})${versionSuffix}.`);
    } else {
      console.log('No dashboard running.');
    }
  } else {
    const r = await launchDashboard(root);
    const url = `http://127.0.0.1:${r.port}/`;
    let verb;
    if (r.action === 'reused') verb = 'already running';
    else if (r.action === 'replaced') verb = `replaced ${r.from} → ${r.to}`;
    else verb = 'launched';
    console.log(`Dashboard ${verb} at ${url} (pid ${r.pid}).`);
    console.log('Stop it with: /dashboard stop');
  }
}
