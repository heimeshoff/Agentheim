// Long-running server entry (ADR-0002). This is the process spawned DETACHED by
// launch.mjs. It binds 127.0.0.1 on a DETERMINISTIC, project-root-derived port
// (ADR-0002 addendum, infrastructure-018) so the browser origin is stable across
// relaunches — keeping the origin-keyed localStorage stores (theme, board
// view-state, skip-permissions) from being orphaned. On EADDRINUSE it walks a
// bounded ladder of 8 within window 41000–42023. It then reads the bound port
// back and writes { pid, port, startedAt } to the runfile, and serves until
// killed. Project root is discovered from cwd (the launcher sets cwd) or taken
// from AGENTHEIM_ROOT when provided.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverRoot } from './discovery.mjs';
import { createDashboardServer, defaultAssetRoot } from './server.mjs';
import { writeRunfile, readLastPort, writeLastPort } from './runfile.mjs';
import { listenOnLadder } from './port.mjs';
import { resolvePluginRoot, readPluginVersion } from './plugin-version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = process.env.AGENTHEIM_ROOT
  ? process.env.AGENTHEIM_ROOT
  : discoverRoot(process.cwd());

// The plugin identity of THIS running instance (ADR-0002 version-aware
// addendum, infrastructure-rgknz), recorded in the runfile so a later launch
// can tell a stale-but-alive server (older plugin version) from a fresh one.
// null when the manifest can't be read — an "unknown" identity a later launch
// treats as replace-worthy, never reused blind.
const pluginRoot = resolvePluginRoot(__dirname);
const pluginVersion = readPluginVersion(pluginRoot);

// Asset root is module-relative by default (infrastructure-004): the committed
// dist/ lives beside the dashboard module, NOT under the discovered project root
// (ADR-0004 decouples the two). AGENTHEIM_DASHBOARD_DIST is a dev override seam.
const assetRoot = process.env.AGENTHEIM_DASHBOARD_DIST || defaultAssetRoot();

const server = createDashboardServer({ root, assetRoot });

/**
 * One bind attempt: resolves when the server is listening on `port`, rejects
 * with an EADDRINUSE-coded error so listenOnLadder advances to the next rung.
 * The transient error listener is removed on either outcome so a later runtime
 * error never re-triggers this promise.
 */
function tryListen(port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

try {
  // Sticky origin (infrastructure-019): prefer the last successfully-bound port
  // so a transient collision can't flap the origin launch-to-launch. Absent /
  // out-of-window / busy ⇒ falls back to the derived port then the ladder. A
  // corrupt/foreign marker is ignored by bindSequence's in-window guard.
  const lastGood = readLastPort(root);
  const port = await listenOnLadder(root, tryListen, lastGood);
  writeRunfile(root, {
    pid: process.pid,
    port,
    startedAt: new Date().toISOString(),
    pluginVersion,
    pluginRoot,
  });
  // Remember this origin so the next launch sticks to it. Written at bind time
  // (not coupled to stale-reap) so it survives both a crash and a clean stop.
  writeLastPort(root, port);
  // When attached (parent kept a pipe), announce the URL; harmless when detached.
  process.stdout.write(`Dashboard listening at http://127.0.0.1:${port}/\n`);
} catch (err) {
  // A genuine third-party collision across the whole ladder (or a fatal bind
  // error): fail loudly and exit cleanly — no orphaned, never-listening process.
  process.stderr.write(`Dashboard failed to bind: ${err.message}\n`);
  process.exit(1);
}

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
