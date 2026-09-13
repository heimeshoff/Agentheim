// Tests for lib/resolve-herdr.mjs — the shared Herdr binary/liveness
// resolver (ADR-0082 §9, infrastructure-e8h9f). Every fixture is hermetic: a
// fake home dir under os.tmpdir(), injected platform/env/which/exec/clock —
// never the builder's real PATH, home directory, or a real Herdr install.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  resolveHerdrBinary,
  checkHerdrLiveness,
  releasesRoot,
  socketPath,
  defaultLocalAppData,
  defaultAppData,
} from '../resolve-herdr.mjs';

function tmp() {
  return mkdtempSync(path.join(tmpdir(), 'agentheim-resolve-herdr-'));
}

function writeFile(p, content = '') {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content);
}

// --- resolveHerdrBinary: PATH-found ----------------------------------------

test('resolveHerdrBinary finds herdr on PATH first, via the injected which', () => {
  const home = tmp();
  const which = (name, ctx) => {
    assert.equal(name, 'herdr');
    assert.equal(ctx.platform, 'linux');
    return '/usr/local/bin/herdr';
  };
  const result = resolveHerdrBinary({ homedir: home, platform: 'linux', env: {}, which });
  assert.deepEqual(result, { path: '/usr/local/bin/herdr', source: 'path', version: null });
});

// --- resolveHerdrBinary: known-root-found (releases dir) -------------------

test('resolveHerdrBinary falls back to the newest-semver standalone release dir when not on PATH (posix)', () => {
  const home = tmp();
  writeFile(path.join(releasesRoot(home), '0.8.0-x86_64-unknown-linux-gnu', 'herdr'), '#!/bin/sh\n');
  writeFile(path.join(releasesRoot(home), '0.9.0-x86_64-unknown-linux-gnu', 'herdr'), '#!/bin/sh\n');
  const which = () => null;
  const result = resolveHerdrBinary({ homedir: home, platform: 'linux', env: {}, which });
  assert.equal(result.source, 'releases');
  assert.equal(result.version, '0.9.0');
  assert.equal(result.path, path.join(releasesRoot(home), '0.9.0-x86_64-unknown-linux-gnu', 'herdr'));
});

test('resolveHerdrBinary picks numeric-max semver, not lexical (0.9.0 over 0.10.0 would be a bug)', () => {
  const home = tmp();
  writeFile(path.join(releasesRoot(home), '0.9.0-x86_64-pc-windows-msvc', 'herdr.exe'), 'x');
  writeFile(path.join(releasesRoot(home), '0.10.0-x86_64-pc-windows-msvc', 'herdr.exe'), 'x');
  const which = () => null;
  const result = resolveHerdrBinary({ homedir: home, platform: 'win32', env: {}, which });
  assert.equal(result.version, '0.10.0');
});

test('resolveHerdrBinary skips a release dir whose binary is missing (half-written newer dir)', () => {
  const home = tmp();
  mkdirSync(path.join(releasesRoot(home), '0.9.5-x86_64-unknown-linux-gnu'), { recursive: true }); // no herdr binary inside
  writeFile(path.join(releasesRoot(home), '0.9.0-x86_64-unknown-linux-gnu', 'herdr'), 'x');
  const which = () => null;
  const result = resolveHerdrBinary({ homedir: home, platform: 'linux', env: {}, which });
  assert.equal(result.version, '0.9.0');
});

// --- resolveHerdrBinary: known-root-found (win32 Programs dir) -------------

test('resolveHerdrBinary falls back to the known win32 Programs dir when PATH and releases both miss', () => {
  const home = tmp();
  const localAppData = path.join(home, 'AppData', 'Local');
  writeFile(path.join(localAppData, 'Programs', 'Herdr', 'bin', 'herdr.exe'), 'x');
  const which = () => null;
  const result = resolveHerdrBinary({ homedir: home, platform: 'win32', env: {}, which, localAppData });
  assert.deepEqual(result, {
    path: path.join(localAppData, 'Programs', 'Herdr', 'bin', 'herdr.exe'),
    source: 'known-root',
    version: null,
  });
});

test('resolveHerdrBinary never attempts the win32 Programs dir fallback on posix', () => {
  const home = tmp();
  // A posix platform has no localAppData concept at all -- assert this never throws
  // reaching for one, and simply reports not-found.
  const which = () => null;
  const result = resolveHerdrBinary({ homedir: home, platform: 'linux', env: {}, which });
  assert.deepEqual(result, { path: null, source: null, version: null });
});

test('defaultLocalAppData derives purely from homedir (never a bare env/process.env.LOCALAPPDATA read)', () => {
  const home = tmp();
  assert.equal(defaultLocalAppData(home), path.join(home, 'AppData', 'Local'));
});

test('resolveHerdrBinary ignores env.LOCALAPPDATA entirely -- a faked homedir yields a faked known-root path, never the real one', () => {
  const home = tmp();
  const which = () => null;
  // A real-shaped env.LOCALAPPDATA must never leak into the known-root
  // fallback path -- only the injected homedir may.
  const result = resolveHerdrBinary({
    homedir: home,
    platform: 'win32',
    env: { LOCALAPPDATA: 'C:\\Users\\someone-else\\AppData\\Local' },
    which,
  });
  assert.deepEqual(result, { path: null, source: null, version: null });
});

// --- resolveHerdrBinary: not-found ------------------------------------------

test('resolveHerdrBinary returns {path: null, source: null, version: null} when nothing is found anywhere', () => {
  const home = tmp();
  const which = () => null;
  const result = resolveHerdrBinary({ homedir: home, platform: 'win32', env: {}, which });
  assert.deepEqual(result, { path: null, source: null, version: null });
});

test('resolveHerdrBinary never throws when releasesRoot does not exist at all', () => {
  const home = tmp();
  const which = () => null;
  assert.doesNotThrow(() => resolveHerdrBinary({ homedir: home, platform: 'linux', env: {}, which }));
});

// --- socketPath --------------------------------------------------------------

test('socketPath on win32 joins <appData>/herdr/herdr.sock', () => {
  const home = tmp();
  assert.equal(
    socketPath({ homedir: home, platform: 'win32', env: {}, appData: path.join(home, 'AppData', 'Roaming') }),
    path.join(home, 'AppData', 'Roaming', 'herdr', 'herdr.sock')
  );
});

test('socketPath on posix joins <home>/.herdr/herdr.sock', () => {
  const home = tmp();
  assert.equal(socketPath({ homedir: home, platform: 'linux', env: {} }), path.join(home, '.herdr', 'herdr.sock'));
});

test('defaultAppData derives purely from homedir (never a bare env/process.env.APPDATA read)', () => {
  const home = tmp();
  assert.equal(defaultAppData(home, 'win32'), path.join(home, 'AppData', 'Roaming'));
  assert.equal(defaultAppData(home, 'linux'), path.join(home, '.config'));
});

test('socketPath ignores env.APPDATA entirely -- a faked homedir yields a faked socket path, never the real one', () => {
  const home = tmp();
  assert.equal(
    socketPath({ homedir: home, platform: 'win32', env: { APPDATA: 'C:\\Users\\someone-else\\AppData\\Roaming' } }),
    path.join(home, 'AppData', 'Roaming', 'herdr', 'herdr.sock')
  );
});

// --- checkHerdrLiveness: socket-file gate -----------------------------------

test('checkHerdrLiveness is false when the socket file does not exist, without ever invoking exec', () => {
  const home = tmp();
  let execCalls = 0;
  const exec = () => {
    execCalls++;
    return 'server: status: running';
  };
  const live = checkHerdrLiveness({
    homedir: home,
    platform: 'linux',
    env: {},
    exec,
    existsSync: () => false,
    now: () => 0,
    cache: { value: false, expiresAt: 0 },
  });
  assert.equal(live, false);
  assert.equal(execCalls, 0);
});

test('checkHerdrLiveness is true when the socket exists and the injected exec succeeds', () => {
  const home = tmp();
  const exec = (binaryPath) => {
    assert.equal(binaryPath, '/fake/herdr');
    return 'client: 0.9.0\nserver: status: running\n';
  };
  const live = checkHerdrLiveness({
    homedir: home,
    platform: 'linux',
    env: {},
    binaryPath: '/fake/herdr',
    exec,
    existsSync: () => true,
    now: () => 0,
    cache: { value: false, expiresAt: 0 },
  });
  assert.equal(live, true);
});

test('checkHerdrLiveness is false when the socket exists but the injected exec throws', () => {
  const home = tmp();
  const exec = () => {
    throw new Error('spawn failed');
  };
  const live = checkHerdrLiveness({
    homedir: home,
    platform: 'linux',
    env: {},
    exec,
    existsSync: () => true,
    now: () => 0,
    cache: { value: false, expiresAt: 0 },
  });
  assert.equal(live, false);
});

// --- checkHerdrLiveness: TTL cache -------------------------------------------

test('checkHerdrLiveness caches its result for ttlMs and does not re-invoke exec within the window', () => {
  const home = tmp();
  let execCalls = 0;
  let clock = 1000;
  const exec = () => {
    execCalls++;
    return 'server: status: running';
  };
  const cache = { value: false, expiresAt: 0 };
  const deps = {
    homedir: home,
    platform: 'linux',
    env: {},
    exec,
    existsSync: () => true,
    now: () => clock,
    ttlMs: 5000,
    cache,
  };

  assert.equal(checkHerdrLiveness(deps), true);
  assert.equal(execCalls, 1);

  clock += 1000; // still within the 5000ms TTL
  assert.equal(checkHerdrLiveness(deps), true);
  assert.equal(execCalls, 1, 'a call inside the TTL window must not re-invoke exec');

  clock += 4001; // now past the TTL
  assert.equal(checkHerdrLiveness(deps), true);
  assert.equal(execCalls, 2, 'a call past the TTL window must re-invoke exec');
});

test('checkHerdrLiveness with distinct cache instances never share state', () => {
  const home = tmp();
  let calls = 0;
  const exec = () => {
    calls++;
    return 'ok';
  };
  const depsBase = { homedir: home, platform: 'linux', env: {}, exec, existsSync: () => true, now: () => 0 };
  checkHerdrLiveness({ ...depsBase, cache: { value: false, expiresAt: 0 } });
  checkHerdrLiveness({ ...depsBase, cache: { value: false, expiresAt: 0 } });
  assert.equal(calls, 2, 'two fresh cache instances must each trigger their own exec call');
});
