// Runfile management (ADR-0002): `.agentheim/.dashboard/runtime.json` is the
// sole runtime state on disk = { pid, port, startedAt, pluginVersion, pluginRoot }.
// Provides the reuse-or-replace logic that keeps a relaunch from orphaning a
// process. `pluginVersion`/`pluginRoot` (ADR-0002 version-aware addendum,
// infrastructure-rgknz) identify WHICH installed plugin instance is serving —
// an older runfile written before this task simply lacks the two fields, and
// every reader here tolerates their absence (undefined, not a parse error);
// the reuse-vs-replace DECISION over that absence is launch.mjs's job.

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const DASHBOARD_DIR = '.dashboard';
const RUNFILE_NAME = 'runtime.json';
const LAST_PORT_NAME = 'last-port.json';

/** Absolute path to the runfile for a project root. */
export function runfilePath(root) {
  return path.join(root, '.agentheim', DASHBOARD_DIR, RUNFILE_NAME);
}

/** Absolute path to the gitignored dashboard runtime dir. */
export function dashboardDir(root) {
  return path.join(root, '.agentheim', DASHBOARD_DIR);
}

/**
 * Write { pid, port, startedAt, pluginVersion, pluginRoot } atomically-ish to
 * the runfile. `pluginVersion`/`pluginRoot` are optional — a caller that omits
 * them (or passes null/undefined, e.g. the manifest couldn't be read) still
 * gets a valid runfile; the value is written through as-is so an "unknown"
 * plugin identity is recorded explicitly rather than silently dropped.
 */
export function writeRunfile(root, { pid, port, startedAt, pluginVersion = null, pluginRoot = null }) {
  const dir = dashboardDir(root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    runfilePath(root),
    JSON.stringify({ pid, port, startedAt, pluginVersion, pluginRoot }, null, 2)
  );
}

/** Read the runfile, or null if it does not exist / is unreadable. */
export function readRunfile(root) {
  const p = runfilePath(root);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** Delete the runfile if present. */
export function deleteRunfile(root) {
  const p = runfilePath(root);
  if (existsSync(p)) rmSync(p, { force: true });
}

// ── last-good port marker (infrastructure-019) ───────────────────────────────
//
// `.agentheim/.dashboard/last-port.json` = { port } is a SEPARATE sibling of
// runtime.json: a pure memory of the last successfully-bound port that OUTLIVES
// the server (written at bind time, untouched by stop/reap). Keeping it apart
// preserves runtime.json's contract ("present ⇒ a live runtime, gated by pid")
// — inspectExisting / stopDashboard never learn about it. The child's bind path
// reads it to make the origin sticky across relaunches (last-good → derived →
// ladder). Mirrors how bridge.json sits beside runtime.json (ADR-0018).

/** Absolute path to the last-good-port marker for a project root. */
export function lastPortPath(root) {
  return path.join(root, '.agentheim', DASHBOARD_DIR, LAST_PORT_NAME);
}

/** Record the last successfully-bound port as the sticky-origin memory. */
export function writeLastPort(root, port) {
  const dir = dashboardDir(root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(lastPortPath(root), JSON.stringify({ port }, null, 2));
}

/**
 * Read the last-good port, or null when the marker is absent (first launch),
 * unreadable, malformed, or lacks an integer `port`. Range-checking against the
 * derivation window is the bind path's job (port.mjs `bindSequence`); here we
 * only guarantee a clean integer-or-null so a corrupt marker never crashes the
 * launch.
 */
export function readLastPort(root) {
  const p = lastPortPath(root);
  if (!existsSync(p)) return null;
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8'));
    return Number.isInteger(parsed.port) ? parsed.port : null;
  } catch {
    return null;
  }
}

/**
 * Is a process with `pid` alive? `process.kill(pid, 0)` probes without
 * delivering a signal: ESRCH ⇒ dead, EPERM ⇒ alive (exists, not ours).
 */
export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/**
 * Inspect any existing runfile and classify it:
 * - { state: 'none' }                 — no runfile
 * - { state: 'live', runfile }        — pid alive: caller should reuse-or-replace
 * - { state: 'stale' }                — pid dead: runfile reaped here so a relaunch
 *                                        never reuses a dead port / orphans nothing
 */
export function inspectExisting(root) {
  const runfile = readRunfile(root);
  if (!runfile) return { state: 'none' };
  if (isPidAlive(runfile.pid)) return { state: 'live', runfile };
  deleteRunfile(root);
  return { state: 'stale' };
}
