// Unit tests for the generalized env-independent plugin-file resolver
// (agentic-workflow-k5n8f, generalizing infrastructure-010's launcher-only resolver).
//
// These exercise the PURE helpers in isolation — no real installed cache, no
// spawning. cacheRoot/resolvePluginFile/locatePluginFile all take their inputs as
// arguments so they're deterministic on any platform. dashboard/test/resolve-launcher.test.mjs
// covers the SAME mechanism through the launcher-specific delegate; these tests
// prove the generalized arbitrary-relPath contract the CLI relies on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  cacheRoot,
  pickNewestVersion,
  resolvePluginFile,
  locatePluginFile,
} from '../resolve-plugin-file.mjs';

// --- cacheRoot ---

test('cacheRoot derives the plugin cache path under a POSIX-shaped homedir', () => {
  assert.equal(
    cacheRoot('/home/marco'),
    path.join('/home/marco', '.claude', 'plugins', 'cache', 'agentheim', 'agentheim')
  );
});

test('cacheRoot derives the plugin cache path under a win32-shaped homedir', () => {
  assert.equal(
    cacheRoot('C:\\Users\\marco'),
    path.join('C:\\Users\\marco', '.claude', 'plugins', 'cache', 'agentheim', 'agentheim')
  );
});

// --- pickNewestVersion: SEMVER maximum, NOT lexical ---

test('pickNewestVersion picks the semver maximum (the 0.8.10 > 0.8.9 lexical trap)', () => {
  assert.equal(pickNewestVersion(['0.8.3', '0.8.9', '0.8.10']), '0.8.10');
});

test('pickNewestVersion ignores non-semver dir names and returns null when none qualify', () => {
  assert.equal(pickNewestVersion(['latest', '.tmp', 'node_modules']), null);
  assert.equal(pickNewestVersion(['0.8.3', '.tmp', '0.8.10']), '0.8.10');
});

// --- resolvePluginFile: arbitrary relPath, not just dashboard/launch.mjs ---

function makeCache(versions, relPath) {
  const cache = mkdtempSync(path.join(tmpdir(), 'resolve-plugin-file-'));
  for (const v of versions) {
    const full = path.join(cache, v, relPath);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, '// stub\n');
  }
  return cache;
}

test('resolvePluginFile resolves an arbitrary in-plugin relPath from the newest version', () => {
  const relPath = path.join('lib', 'task-lifecycle-cli.mjs');
  const cache = makeCache(['0.8.3', '0.8.9', '0.8.10'], relPath);
  try {
    const resolved = resolvePluginFile(cache, relPath);
    assert.equal(resolved, path.join(cache, '0.8.10', relPath));
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});

test('resolvePluginFile skips a newer version dir that lacks relPath, falling to the next', () => {
  const relPath = path.join('lib', 'task-lifecycle-cli.mjs');
  const cache = mkdtempSync(path.join(tmpdir(), 'resolve-plugin-file-gap-'));
  try {
    mkdirSync(path.join(cache, '0.9.0'), { recursive: true }); // newest, but incomplete
    const good = path.join(cache, '0.8.0', 'lib');
    mkdirSync(good, { recursive: true });
    writeFileSync(path.join(good, 'task-lifecycle-cli.mjs'), '// stub\n');
    const resolved = resolvePluginFile(cache, relPath);
    assert.equal(resolved, path.join(cache, '0.8.0', relPath));
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});

test('resolvePluginFile fails loudly, naming the searched cache path and relPath, never falling back', () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'resolve-plugin-file-empty-'));
  try {
    assert.throws(
      () => resolvePluginFile(empty, 'lib/task-lifecycle-cli.mjs'),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /no cached lib\/task-lifecycle-cli\.mjs/i);
        assert.ok(err.message.includes(empty), 'error message must name the searched cache path');
        assert.doesNotMatch(err.message, /falling back/i);
        return true;
      }
    );
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test('resolvePluginFile accepts a custom label for the fail-loud message (resolveLauncher-style delegation)', () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'resolve-plugin-file-label-'));
  try {
    assert.throws(
      () => resolvePluginFile(empty, 'dashboard/launch.mjs', 'launcher'),
      /no cached launcher found under/i
    );
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

// --- locatePluginFile: repo-local short-circuit, cache fall-through, arbitrary relPath ---

test('locatePluginFile uses an explicit repoLocalPath override, skipping the cache entirely', () => {
  const moduleDir = mkdtempSync(path.join(tmpdir(), 'resolve-plugin-file-repo-'));
  try {
    const local = path.join(moduleDir, 'task-lifecycle-cli.mjs');
    writeFileSync(local, '// repo-local\n');
    const resolved = locatePluginFile('lib/task-lifecycle-cli.mjs', {
      repoLocalPath: local,
      homedir: '/no/such/home/should/never/be/read',
    });
    assert.equal(resolved, local);
  } finally {
    rmSync(moduleDir, { recursive: true, force: true });
  }
});

test('locatePluginFile derives the repo-local candidate from moduleDir/repoRoot when no repoLocalPath is given', () => {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'resolve-plugin-file-derived-'));
  try {
    const moduleDir = path.join(repoRoot, 'lib');
    mkdirSync(moduleDir, { recursive: true });
    const target = path.join(repoRoot, 'dashboard', 'launch.mjs');
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, '// repo-local launch\n');
    const resolved = locatePluginFile('dashboard/launch.mjs', {
      moduleDir,
      homedir: '/no/such/home/should/never/be/read',
    });
    assert.equal(resolved, target);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('locatePluginFile falls through to the home cache when no repo-local file exists', () => {
  const relPath = path.join('lib', 'task-lifecycle-cli.mjs');
  const moduleDir = mkdtempSync(path.join(tmpdir(), 'resolve-plugin-file-nolocal-'));
  const cache = makeCache(['0.8.3', '0.8.10'], relPath);
  const home = mkdtempSync(path.join(tmpdir(), 'resolve-plugin-file-home-'));
  const target = cacheRoot(home);
  mkdirSync(path.dirname(target), { recursive: true });
  try {
    // symlink the agentheim/agentheim dir to our prebuilt cache
    symlinkSync(cache, target, 'junction');
    const resolved = locatePluginFile('lib/task-lifecycle-cli.mjs', { moduleDir, homedir: home });
    assert.ok(existsSync(resolved), 'resolved file must exist');
    // Resolved THROUGH the home-cache junction, so compare the trailing segments
    // (version + relPath) rather than the raw prebuilt-cache dir identity.
    assert.equal(
      path.join('0.8.10', relPath),
      resolved.split(path.sep).slice(-3).join(path.sep),
      `expected newest-version file, got ${resolved}`
    );
  } finally {
    rmSync(moduleDir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    rmSync(cache, { recursive: true, force: true });
  }
});

test('locatePluginFile with no opts resolves the real repo-local dashboard/launch.mjs (production default path)', () => {
  // No opts at all: moduleDir defaults to this module's own dir (lib/), repoRoot
  // one level up (the real Agentheim repo root in this worktree), and
  // dashboard/launch.mjs genuinely exists there — proving the zero-config default
  // actually works against the real repo layout, not just a fixture.
  const resolved = locatePluginFile('dashboard/launch.mjs');
  assert.ok(existsSync(resolved));
  assert.match(resolved.replace(/\\/g, '/'), /\/dashboard\/launch\.mjs$/);
});
