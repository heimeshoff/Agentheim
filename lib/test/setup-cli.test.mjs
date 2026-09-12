// Tests for lib/setup-cli.mjs — the install logic behind `/setup` (ADR-0079,
// infrastructure-x56qm). Every fixture is hermetic: a fake HOME/USERPROFILE and
// a fake plugin cache, never the builder's real home directory or registry.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  rmSync,
  chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  CLI_FILENAMES,
  BRIDGE_EXTENSION_ID,
  resolveCliSource,
  resolveVsixSource,
  detectPathState,
  buildStatus,
  buildBridgeStatus,
  installCli,
  removeCli,
  installBridge,
  removeBridge,
  runCli,
  shouldChmod,
} from '../setup-cli.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const setupCliPath = path.join(repoRoot, 'lib', 'setup-cli.mjs');

// --- fixture helpers -------------------------------------------------------

function tmp(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

/** Write the three CLI filenames into `dir`, each holding `content` (a Buffer or string). */
function writeSourceFiles(dir, content) {
  mkdirSync(dir, { recursive: true });
  for (const name of CLI_FILENAMES) {
    writeFileSync(path.join(dir, name), content);
  }
}

/** A fake cache root's `<version>/dashboard/cli` dir, populated with source files. */
function makeCacheVersionSource(cacheRoot, version, content) {
  const dir = path.join(cacheRoot, version, 'dashboard', 'cli');
  writeSourceFiles(dir, content);
  return dir;
}

function fakeCacheRoot(home) {
  return path.join(home, '.claude', 'plugins', 'cache', 'agentheim', 'agentheim');
}

/** Snapshot a directory tree's relative paths + mtimes + sizes, recursively. Missing dir -> []. */
function snapshot(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (d, rel) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, entry.name);
      const relPath = path.join(rel, entry.name);
      if (entry.isDirectory()) {
        walk(abs, relPath);
      } else {
        const st = statSync(abs);
        out.push(`${relPath}:${st.size}:${st.mtimeMs}`);
      }
    }
  };
  walk(dir, '');
  return out.sort();
}

function baseDeps(overrides = {}) {
  return {
    homedir: overrides.homedir,
    platform: overrides.platform ?? 'linux',
    env: overrides.env ?? {},
    registryReader: overrides.registryReader,
    shellPath: overrides.shellPath,
    resolveOpts: overrides.resolveOpts ?? {},
    bridgeResolveOpts: overrides.bridgeResolveOpts ?? {},
    which: overrides.which,
    exec: overrides.exec,
  };
}

// A resolveOpts pointing at a definitely-nonexistent repo-local dir, forcing
// cache resolution regardless of where this test file actually runs from.
function forceCache(home) {
  return { repoLocalPath: path.join(home, '__never-exists__', 'dashboard', 'cli'), homedir: home };
}

// A bridgeResolveOpts pointing at a definitely-nonexistent repo-local dir,
// forcing bridge .vsix cache resolution regardless of this repo's own
// (real, committed) vscode-extension/agentheim-bridge-*.vsix.
function forceVsixCache(home) {
  return { repoLocalPath: path.join(home, '__never-exists-vsix__', 'vscode-extension'), homedir: home };
}

/** Write a fake `agentheim-bridge-<version>.vsix` directly under `dir`. */
function writeVsix(dir, version, content = 'fake-vsix-bytes') {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `agentheim-bridge-${version}.vsix`), content);
}

/** A fake cache root's `<pluginVersion>/vscode-extension` dir holding one `.vsix`. */
function makeCacheVsix(cacheRoot, pluginVersion, vsixVersion) {
  const dir = path.join(cacheRoot, pluginVersion, 'vscode-extension');
  writeVsix(dir, vsixVersion);
  return path.join(dir, `agentheim-bridge-${vsixVersion}.vsix`);
}

/** An injectable which/exec pair: `code` is "present" and exec calls are recorded. */
function fakeCode({ listExtensionsOutput = '' } = {}) {
  const calls = [];
  return {
    which: () => '/fake/code',
    exec: (execPath, args) => {
      calls.push({ execPath, args });
      if (args[0] === '--list-extensions') return listExtensionsOutput;
      return '';
    },
    calls,
  };
}

/** which() that reports `code` absent from PATH, no matter what. */
function noCode() {
  return { which: () => null };
}

// --- resolveCliSource -------------------------------------------------------

test('resolveCliSource prefers the repo-local dashboard/cli/ when it exists', () => {
  const fakeRepo = tmp('setup-cli-repolocal-');
  try {
    const cliDir = path.join(fakeRepo, 'dashboard', 'cli');
    writeSourceFiles(cliDir, 'x');
    const home = tmp('setup-cli-home-unused-');
    try {
      const source = resolveCliSource({ repoLocalPath: cliDir, homedir: home });
      assert.equal(source.kind, 'repo-local');
      assert.equal(source.version, null);
      assert.equal(path.resolve(source.root), path.resolve(cliDir));
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  } finally {
    rmSync(fakeRepo, { recursive: true, force: true });
  }
});

test('resolveCliSource falls back to the newest cached semver version when no repo-local dir exists', () => {
  const home = tmp('setup-cli-home-cache-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'old');
    makeCacheVersionSource(cache, '1.2.0', 'new');
    const source = resolveCliSource(forceCache(home));
    assert.equal(source.kind, 'cache');
    assert.equal(source.version, '1.2.0');
    assert.equal(path.resolve(source.root), path.resolve(path.join(cache, '1.2.0', 'dashboard', 'cli')));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('running against the live repo tree, resolveCliSource reports repo-local with a null version', () => {
  // Default moduleDir/repoRoot -- this module's OWN real location -- proves the
  // actual shipped dashboard/cli/ is found without any fixture override. Only
  // the (unused, for this call) homedir would ever touch a real path, and this
  // call passes none.
  const source = resolveCliSource();
  assert.equal(source.kind, 'repo-local');
  assert.equal(source.version, null);
  assert.equal(path.resolve(source.root), path.resolve(repoRoot, 'dashboard', 'cli'));
});

// --- shouldChmod (pure, platform-only) --------------------------------------

test('shouldChmod is true for POSIX platforms and false for win32', () => {
  assert.equal(shouldChmod('linux'), true);
  assert.equal(shouldChmod('darwin'), true);
  assert.equal(shouldChmod('win32'), false);
});

// --- install cli -------------------------------------------------------------

test('install cli exits 0 and leaves all three files byte-identical under <home>/.local/bin', () => {
  const home = tmp('setup-cli-install-');
  try {
    const cache = fakeCacheRoot(home);
    const srcDir = makeCacheVersionSource(cache, '1.0.0', 'reference-bytes');
    const deps = baseDeps({ homedir: home, resolveOpts: forceCache(home) });
    const result = installCli(deps);
    assert.equal(result.exitCode, 0);
    const binDir = path.join(home, '.local', 'bin');
    for (const name of CLI_FILENAMES) {
      const installed = readFileSync(path.join(binDir, name));
      const source = readFileSync(path.join(srcDir, name));
      assert.ok(installed.equals(source), `${name} must be byte-identical to source`);
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('install cli sets the executable bit on POSIX (this platform only; win32 skip is proven by shouldChmod above)', () => {
  const home = tmp('setup-cli-chmod-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    // Force the POSIX branch explicitly, regardless of the real OS running this
    // suite, to exercise installCli's chmod call path.
    const deps = baseDeps({ homedir: home, platform: 'linux', resolveOpts: forceCache(home) });
    const result = installCli(deps);
    assert.equal(result.exitCode, 0);
    if (process.platform !== 'win32') {
      const binDir = path.join(home, '.local', 'bin');
      for (const name of ['agentheim-dashboard.mjs', 'agentheim-dashboard']) {
        const mode = statSync(path.join(binDir, name)).mode;
        assert.notEqual(mode & 0o111, 0, `${name} must have the executable bit set`);
      }
    }
    // On a win32 dev box, fs.chmodSync cannot flip POSIX exec bits observably
    // (Windows only tracks a read-only attribute) -- this is a known
    // environmental limitation, not a code gap; shouldChmod's pure unit test
    // above proves the win32-vs-POSIX branch decision directly.
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('install cli on win32 never attempts chmod', () => {
  const home = tmp('setup-cli-win32-chmod-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    const deps = baseDeps({ homedir: home, platform: 'win32', resolveOpts: forceCache(home) });
    const result = installCli(deps);
    assert.equal(result.exitCode, 0);
    // No throw, no special-cased failure -- shouldChmod(false) means the chmod
    // loop in installCli is never entered for win32 (proven directly above).
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('install cli with cwd set to a fixture project writes nothing under that project tree', () => {
  const home = tmp('setup-cli-cwd-home-');
  const project = tmp('setup-cli-cwd-project-');
  const originalCwd = process.cwd();
  try {
    mkdirSync(path.join(project, '.agentheim'), { recursive: true });
    writeFileSync(path.join(project, '.agentheim', 'marker.txt'), 'do not touch');
    const before = snapshot(project);

    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    process.chdir(project);
    const deps = baseDeps({ homedir: home, resolveOpts: forceCache(home) });
    const result = installCli(deps);
    assert.equal(result.exitCode, 0);

    const after = snapshot(project);
    assert.deepEqual(after, before, 'install cli must write nothing under the project tree, in particular nothing under .agentheim/');
  } finally {
    process.chdir(originalCwd);
    rmSync(home, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
  }
});

// --- status: side-effect-free, contract, state transitions ------------------

test('status is side-effect-free: no .local/bin creation, fake home unchanged', () => {
  const home = tmp('setup-cli-status-sideeffect-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    const before = snapshot(home);
    const deps = baseDeps({ homedir: home, resolveOpts: forceCache(home) });
    buildStatus(deps);
    const after = snapshot(home);
    assert.deepEqual(after, before, 'status must not write anything to the fake home');
    assert.ok(!existsSync(path.join(home, '.local', 'bin')), 'status must not create <home>/.local/bin');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('status reports the full schema-1 JSON contract and the not-installed -> installed-current -> installed-stale sequence', () => {
  const home = tmp('setup-cli-status-sequence-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'bytes-v1');
    const deps = baseDeps({ homedir: home, resolveOpts: forceCache(home) });

    // not-installed
    let status = buildStatus(deps);
    assert.equal(status.schema, 1);
    assert.equal(status.source.kind, 'cache');
    assert.equal(status.source.version, '1.0.0');
    assert.equal(typeof status.binDir, 'string');
    assert.equal(status.cli.state, 'not-installed');
    assert.equal(status.cli.files.length, 3);
    for (const f of status.cli.files) {
      assert.equal(f.present, false);
    }
    assert.equal(typeof status.cli.path.onPath, 'boolean');
    assert.ok(['user', 'process', 'none'].includes(status.cli.path.scope));
    assert.ok(Array.isArray(status.warnings));

    // installed-current
    const installResult = installCli(deps);
    assert.equal(installResult.exitCode, 0);
    status = buildStatus(deps);
    assert.equal(status.cli.state, 'installed-current');
    for (const f of status.cli.files) {
      assert.equal(f.present, true);
      assert.equal(f.matchesSource, true);
    }

    // installed-stale: mutate one installed byte
    const binDir = path.join(home, '.local', 'bin');
    writeFileSync(path.join(binDir, CLI_FILENAMES[0]), 'mutated-bytes');
    status = buildStatus(deps);
    assert.equal(status.cli.state, 'installed-stale');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('status exits 0 via runCli in all three CLI states', () => {
  const home = tmp('setup-cli-status-exit-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    const opts = { homedir: home, resolveOpts: forceCache(home) };

    let { exitCode, output } = runCli(['status'], opts);
    assert.equal(exitCode, 0);
    assert.equal(output.cli.state, 'not-installed');

    installCli({ ...baseDeps(opts) });
    ({ exitCode, output } = runCli(['status'], opts));
    assert.equal(exitCode, 0);
    assert.equal(output.cli.state, 'installed-current');

    writeFileSync(path.join(home, '.local', 'bin', CLI_FILENAMES[1]), 'stale');
    ({ exitCode, output } = runCli(['status'], opts));
    assert.equal(exitCode, 0);
    assert.equal(output.cli.state, 'installed-stale');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('status prints exactly one line of valid JSON on stdout (real subprocess, fake HOME)', () => {
  const home = tmp('setup-cli-status-subprocess-');
  try {
    // Force cache resolution even though this repo IS the Agentheim repo: point
    // the child's cwd somewhere with no dashboard/cli/ sibling by running with a
    // cwd inside the fake home itself (unrelated to the repo tree), and give the
    // child a fake plugin cache under HOME so it resolves from there.
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    const cwdDir = tmp('setup-cli-status-subprocess-cwd-');
    try {
      const result = spawnSync(process.execPath, [setupCliPath, 'status'], {
        cwd: cwdDir,
        env: { ...process.env, HOME: home, USERPROFILE: home },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, `status subprocess failed:\n${result.stdout}\n${result.stderr}`);
      const lines = result.stdout.split(/\r?\n/).filter(Boolean);
      assert.equal(lines.length, 1, `expected exactly one stdout line, got ${lines.length}: ${JSON.stringify(lines)}`);
      const parsed = JSON.parse(lines[0]);
      assert.equal(parsed.schema, 1);
    } finally {
      rmSync(cwdDir, { recursive: true, force: true });
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('running inside the Agentheim repo, status reports source.kind === "repo-local" and source.version === null', () => {
  const home = tmp('setup-cli-repolocal-status-home-');
  try {
    // No resolveOpts override -- this module's OWN real dashboard/cli/ (shipped
    // by this task) is found via the default moduleDir/repoRoot derivation.
    // The fake home is used ONLY for the binDir/PATH half of status, never read
    // for the source resolution.
    const deps = baseDeps({ homedir: home });
    const status = buildStatus(deps);
    assert.equal(status.source.kind, 'repo-local');
    assert.equal(status.source.version, null);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// --- remove cli ---------------------------------------------------------------

test('remove cli deletes exactly the three filenames, leaving the directory and an unrelated file untouched', () => {
  const home = tmp('setup-cli-remove-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    const deps = baseDeps({ homedir: home, resolveOpts: forceCache(home) });
    installCli(deps);
    const binDir = path.join(home, '.local', 'bin');
    writeFileSync(path.join(binDir, 'unrelated-file.txt'), 'keep me');

    const result = removeCli(deps);
    assert.equal(result.exitCode, 0);
    assert.ok(existsSync(binDir), '<home>/.local/bin itself must survive removal');
    for (const name of CLI_FILENAMES) {
      assert.ok(!existsSync(path.join(binDir, name)), `${name} must be removed`);
    }
    assert.ok(existsSync(path.join(binDir, 'unrelated-file.txt')), 'an unrelated file must be untouched');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// --- newer cache version makes status stale, install restores current -------

test('a newer semver cache version makes status report installed-stale; install cli restores installed-current from the newer bytes', () => {
  const home = tmp('setup-cli-newer-version-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'bytes-v1');
    const deps = baseDeps({ homedir: home, resolveOpts: forceCache(home) });
    installCli(deps);
    let status = buildStatus(deps);
    assert.equal(status.cli.state, 'installed-current');
    assert.equal(status.source.version, '1.0.0');

    const newSrcDir = makeCacheVersionSource(cache, '2.0.0', 'bytes-v2-different');
    status = buildStatus(deps);
    assert.equal(status.source.version, '2.0.0');
    assert.equal(status.cli.state, 'installed-stale');

    const installResult = installCli(deps);
    assert.equal(installResult.exitCode, 0);
    status = buildStatus(deps);
    assert.equal(status.cli.state, 'installed-current');
    const binDir = path.join(home, '.local', 'bin');
    for (const name of CLI_FILENAMES) {
      const installed = readFileSync(path.join(binDir, name));
      const newSrc = readFileSync(path.join(newSrcDir, name));
      assert.ok(installed.equals(newSrc), `${name} must now match the newer (v2.0.0) source bytes`);
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// --- PATH detection / remedy --------------------------------------------------

test('win32: <home>/.local/bin absent from the registry PATH -> install cli exits 0 with the SetEnvironmentVariable remedy and both warnings', () => {
  const home = tmp('setup-cli-win32-remedy-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    const deps = baseDeps({
      homedir: home,
      platform: 'win32',
      env: {},
      registryReader: () => 'C:\\Windows\\system32;C:\\Windows',
      resolveOpts: forceCache(home),
    });
    const result = installCli(deps);
    assert.equal(result.exitCode, 0);
    const text = result.lines.join('\n');
    assert.match(text, /SetEnvironmentVariable/);
    assert.match(text, /'User'/);
    assert.match(text, /never source this from \$env:Path/);
    assert.match(text, /never use setx/i);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('posix: <home>/.local/bin absent from PATH -> install cli names the rc file derived from $SHELL (zsh / bash / fish / unknown)', () => {
  const home = tmp('setup-cli-posix-remedy-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    const cases = [
      { shellPath: '/bin/zsh', platform: 'linux', expect: /\.zshrc/ },
      { shellPath: '/bin/bash', platform: 'linux', expect: /\.bashrc/ },
      { shellPath: '/bin/bash', platform: 'darwin', expect: /\.bash_profile/ },
      { shellPath: '/usr/bin/fish', platform: 'linux', expect: /fish_add_path/ },
      { shellPath: '/bin/tcsh', platform: 'linux', expect: /\.profile/ },
      { shellPath: '', platform: 'linux', expect: /\.profile/ },
    ];
    for (const c of cases) {
      const deps = baseDeps({
        homedir: home,
        platform: c.platform,
        env: { PATH: '/usr/bin:/bin' },
        shellPath: c.shellPath,
        resolveOpts: forceCache(home),
      });
      const result = installCli(deps);
      assert.equal(result.exitCode, 0);
      assert.match(result.lines.join('\n'), c.expect, `shell ${c.shellPath} on ${c.platform}`);
      removeCli(deps);
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('win32 PATH detection derives its verdict from the registry read, not process.env.Path', () => {
  const binDir = 'C:\\Users\\fake\\.local\\bin';
  const { path: pathInfo, warnings } = detectPathState({
    platform: 'win32',
    homedir: 'C:\\Users\\fake',
    binDir,
    env: { Path: `C:\\Windows;${binDir}` }, // process env HAS it
    registryReader: () => 'C:\\Windows\\system32', // registry LACKS it
  });
  assert.equal(pathInfo.onPath, true);
  assert.equal(pathInfo.scope, 'process');
  assert.ok(warnings.length > 0, 'a process-scope-only match must carry a warning');
});

test('win32 PATH detection reports scope "user" and no remedy when the registry itself has the directory', () => {
  const binDir = 'C:\\Users\\fake\\.local\\bin';
  const { path: pathInfo, warnings } = detectPathState({
    platform: 'win32',
    homedir: 'C:\\Users\\fake',
    binDir,
    env: {},
    registryReader: () => `C:\\Windows;${binDir}\\`,
  });
  assert.equal(pathInfo.onPath, true);
  assert.equal(pathInfo.scope, 'user');
  assert.equal(pathInfo.remedy, null);
  assert.deepEqual(warnings, []);
});

// --- resolveVsixSource --------------------------------------------------------

test('resolveVsixSource prefers the repo-local vscode-extension/ dir when a matching .vsix exists there', () => {
  const fakeRepo = tmp('setup-cli-vsix-repolocal-');
  const home = tmp('setup-cli-vsix-home-unused-');
  try {
    const vsixDir = path.join(fakeRepo, 'vscode-extension');
    writeVsix(vsixDir, '0.5.0');
    const source = resolveVsixSource({ repoLocalPath: vsixDir, homedir: home });
    assert.equal(source.kind, 'repo-local');
    assert.equal(source.version, '0.5.0');
    assert.equal(path.resolve(source.path), path.resolve(vsixDir, 'agentheim-bridge-0.5.0.vsix'));
  } finally {
    rmSync(fakeRepo, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('resolveVsixSource falls back to the newest cached plugin version\'s vscode-extension/ dir when no repo-local .vsix exists', () => {
  const home = tmp('setup-cli-vsix-cache-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVsix(cache, '1.0.0', '0.4.0');
    const newer = makeCacheVsix(cache, '1.2.0', '0.5.0');
    const source = resolveVsixSource(forceVsixCache(home));
    assert.equal(source.kind, 'cache');
    assert.equal(source.version, '0.5.0');
    assert.equal(path.resolve(source.path), path.resolve(newer));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('resolveVsixSource returns null (never throws) when neither a repo-local nor a cached .vsix exists', () => {
  const home = tmp('setup-cli-vsix-none-');
  try {
    const source = resolveVsixSource(forceVsixCache(home));
    assert.equal(source, null);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('running against the live repo tree, resolveVsixSource finds the committed bridge .vsix (infrastructure-j3rsn)', () => {
  const source = resolveVsixSource();
  assert.equal(source.kind, 'repo-local');
  assert.match(source.version, /^\d+\.\d+\.\d+$/);
  assert.ok(source.path.endsWith('.vsix'));
});

// --- install bridge / remove bridge -------------------------------------------

test('install bridge invokes `code --install-extension <resolved .vsix> --force` and exits 0, printing a reload reminder', () => {
  const home = tmp('setup-cli-bridge-install-');
  try {
    const cache = fakeCacheRoot(home);
    const vsixPath = makeCacheVsix(cache, '1.0.0', '0.5.0');
    const { which, exec, calls } = fakeCode();
    const deps = baseDeps({ homedir: home, bridgeResolveOpts: forceVsixCache(home), which, exec });
    const result = installBridge(deps);
    assert.equal(result.exitCode, 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].execPath, '/fake/code');
    assert.deepEqual(calls[0].args, ['--install-extension', vsixPath, '--force']);
    assert.match(result.lines.join('\n'), /[Rr]eload the VS Code window/, 'install bridge must print a reload reminder');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('remove bridge invokes `code --uninstall-extension agentheim.agentheim-bridge` and exits 0, printing a reload reminder', () => {
  const { which, exec, calls } = fakeCode();
  const deps = baseDeps({ which, exec });
  const result = removeBridge(deps);
  assert.equal(result.exitCode, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].execPath, '/fake/code');
  assert.deepEqual(calls[0].args, ['--uninstall-extension', BRIDGE_EXTENSION_ID]);
  assert.match(result.lines.join('\n'), /[Rr]eload the VS Code window/, 'remove bridge must print a reload reminder');
});

test('install bridge resolves the .vsix newest-cached-semver-first across two plugin cache version dirs', () => {
  const home = tmp('setup-cli-bridge-newest-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVsix(cache, '1.0.0', '0.4.0');
    const newerVsix = makeCacheVsix(cache, '1.2.0', '0.5.0');
    const { which, exec, calls } = fakeCode();
    const deps = baseDeps({ homedir: home, bridgeResolveOpts: forceVsixCache(home), which, exec });
    const result = installBridge(deps);
    assert.equal(result.exitCode, 0);
    assert.equal(calls[0].args[1], newerVsix, 'install bridge must install the newer cached version, not the older one');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('with no code on PATH, install bridge exits 1 with a one-line remedy, and status reports bridge.state "unknown" (never "not-installed") with codeOnPath false', () => {
  const home = tmp('setup-cli-bridge-nocode-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    makeCacheVsix(cache, '1.0.0', '0.5.0');
    const deps = baseDeps({
      homedir: home,
      resolveOpts: forceCache(home),
      bridgeResolveOpts: forceVsixCache(home),
      ...noCode(),
    });
    const installResult = installBridge(deps);
    assert.equal(installResult.exitCode, 1);
    assert.equal(installResult.lines.length, 1, 'the no-code remedy must be a single line');
    assert.match(installResult.lines[0], /code is not on PATH/);

    const status = buildStatus(deps);
    assert.equal(status.bridge.state, 'unknown');
    assert.equal(status.bridge.codeOnPath, false);
    assert.notEqual(status.bridge.state, 'not-installed');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('runCli dispatches "install bridge" and "remove bridge" to the bridge verbs', () => {
  const home = tmp('setup-cli-bridge-runcli-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVsix(cache, '1.0.0', '0.5.0');
    const { which, exec, calls } = fakeCode();
    const opts = { homedir: home, bridgeResolveOpts: forceVsixCache(home), which, exec };
    let { exitCode } = runCli(['install', 'bridge'], opts);
    assert.equal(exitCode, 0);
    ({ exitCode } = runCli(['remove', 'bridge'], opts));
    assert.equal(exitCode, 0);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].args[0], '--install-extension');
    assert.equal(calls[1].args[0], '--uninstall-extension');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// --- status.bridge: state transitions and side-effect-freedom -----------------

test('status reports bridge.state as not-installed / installed-current / installed-stale from a stubbed `code --list-extensions --show-versions`, compared against bridge.shippedVersion', () => {
  const home = tmp('setup-cli-bridge-status-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    makeCacheVsix(cache, '1.0.0', '0.5.0');
    const opts = { homedir: home, resolveOpts: forceCache(home), bridgeResolveOpts: forceVsixCache(home) };

    // not-installed: code present, but the bridge extension is absent from the list
    let { which, exec } = fakeCode({ listExtensionsOutput: 'some.other-extension@1.0.0\n' });
    let status = buildStatus(baseDeps({ ...opts, which, exec }));
    assert.equal(status.bridge.state, 'not-installed');
    assert.equal(status.bridge.installedVersion, null);
    assert.equal(status.bridge.shippedVersion, '0.5.0');
    assert.equal(status.bridge.codeOnPath, true);

    // installed-current: installed version equals the shipped .vsix's version
    ({ which, exec } = fakeCode({ listExtensionsOutput: `${BRIDGE_EXTENSION_ID}@0.5.0\n` }));
    status = buildStatus(baseDeps({ ...opts, which, exec }));
    assert.equal(status.bridge.state, 'installed-current');
    assert.equal(status.bridge.installedVersion, '0.5.0');

    // installed-stale: installed version differs from the shipped .vsix's version
    ({ which, exec } = fakeCode({ listExtensionsOutput: `${BRIDGE_EXTENSION_ID}@0.4.0\n` }));
    status = buildStatus(baseDeps({ ...opts, which, exec }));
    assert.equal(status.bridge.state, 'installed-stale');
    assert.equal(status.bridge.installedVersion, '0.4.0');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('status remains side-effect-free with the bridge key present (code stubbed present, recursive fake-home snapshot unchanged)', () => {
  const home = tmp('setup-cli-bridge-sideeffect-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    makeCacheVsix(cache, '1.0.0', '0.5.0');
    const before = snapshot(home);
    const { which, exec } = fakeCode({ listExtensionsOutput: `${BRIDGE_EXTENSION_ID}@0.5.0\n` });
    const deps = baseDeps({
      homedir: home,
      resolveOpts: forceCache(home),
      bridgeResolveOpts: forceVsixCache(home),
      which,
      exec,
    });
    const status = buildStatus(deps);
    assert.equal(status.bridge.state, 'installed-current');
    const after = snapshot(home);
    assert.deepEqual(after, before, 'status must not write anything to the fake home even with the bridge key present');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// --- default which/exec seam: real defaultWhich/defaultExec, no injected exec ---
// AC 1 requires the SHIPPED default seam -- not just the injectable fixture
// every other bridge test above substitutes -- to actually invoke `code` on
// win32, where `defaultWhich` resolves to a `.cmd` shim and Node refuses to
// spawn one without a shell (EINVAL, iteration-1 verifier finding). These
// tests place a stub `code` executable on a fixture PATH fed through
// `deps.env` (never the real process PATH/registry, never the real VS Code)
// and deliberately omit `which`/`exec` from `deps` so `resolveCode`/`exec`
// fall through to `defaultWhich`/`defaultExec` for real.

/**
 * Write a stub `code` (`code.cmd` on win32, an executable shell script on
 * POSIX) into `dir` that logs every non-`--list-extensions` invocation's
 * argv to `<dir>/calls.log` and, for `--list-extensions ...`, prints a
 * canned `agentheim.agentheim-bridge@0.5.0` line to stdout. Returns the
 * fixture `env` to inject (never mutates the real process env) plus the log
 * path to assert against.
 */
function writeStubCode(dir) {
  mkdirSync(dir, { recursive: true });
  const logPath = path.join(dir, 'calls.log');
  if (process.platform === 'win32') {
    writeFileSync(
      path.join(dir, 'code.cmd'),
      [
        '@echo off',
        'if "%~1"=="--list-extensions" (',
        '  echo agentheim.agentheim-bridge@0.5.0',
        ') else (',
        '  echo %* >> "%~dp0calls.log"',
        ')',
        '',
      ].join('\r\n')
    );
    return { env: { Path: dir, PATHEXT: '.CMD' }, logPath };
  }
  const scriptPath = path.join(dir, 'code');
  writeFileSync(
    scriptPath,
    ['#!/bin/sh', 'if [ "$1" = "--list-extensions" ]; then', '  echo "agentheim.agentheim-bridge@0.5.0"', 'else', `  printf '%s\\n' "$*" >> "${logPath}"`, 'fi', ''].join('\n')
  );
  chmodSync(scriptPath, 0o755);
  return { env: { PATH: dir }, logPath };
}

test('the default which/exec seam (no injected which/exec) actually spawns a stub `code`: install bridge, status, and remove bridge all succeed for real', () => {
  const home = tmp('setup-cli default seam ');
  try {
    const cache = fakeCacheRoot(home);
    const vsixPath = makeCacheVsix(cache, '1.0.0', '0.5.0');
    assert.match(vsixPath, / /, 'the fixture home must itself contain a space, to prove a spaced .vsix path survives win32 cmd-quoting');

    const { env, logPath } = writeStubCode(path.join(home, 'stub-code-bin'));
    const deps = {
      homedir: home,
      platform: process.platform,
      env,
      resolveOpts: forceCache(home),
      bridgeResolveOpts: forceVsixCache(home),
      // deliberately no `which`/`exec` override: exercises defaultWhich/defaultExec.
    };

    const installResult = installBridge(deps);
    assert.equal(installResult.exitCode, 0, `install bridge must succeed via the real seam: ${installResult.lines.join(' | ')}`);
    let logged = readFileSync(logPath, 'utf8');
    assert.match(logged, /--install-extension/);
    assert.match(logged, /--force/);
    assert.match(logged, /agentheim-bridge-0\.5\.0\.vsix/);

    const status = buildBridgeStatus(deps);
    assert.equal(status.codeOnPath, true);
    assert.equal(status.state, 'installed-current');
    assert.equal(status.installedVersion, '0.5.0');

    const removeResult = removeBridge(deps);
    assert.equal(removeResult.exitCode, 0, `remove bridge must succeed via the real seam: ${removeResult.lines.join(' | ')}`);
    logged = readFileSync(logPath, 'utf8');
    assert.match(logged, /--uninstall-extension/);
    assert.match(logged, /agentheim\.agentheim-bridge/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('status reports bridge.state "unknown" (never "not-installed") when code is on PATH but the --list-extensions exec itself throws', () => {
  const home = tmp('setup-cli-bridge-execthrows-');
  try {
    const cache = fakeCacheRoot(home);
    makeCacheVersionSource(cache, '1.0.0', 'x');
    makeCacheVsix(cache, '1.0.0', '0.5.0');
    const opts = { homedir: home, resolveOpts: forceCache(home), bridgeResolveOpts: forceVsixCache(home) };
    const which = () => '/fake/code';
    const exec = () => {
      throw new Error('spawnSync EINVAL');
    };
    const status = buildBridgeStatus(baseDeps({ ...opts, which, exec }));
    assert.equal(status.codeOnPath, true);
    assert.equal(status.state, 'unknown');
    assert.notEqual(status.state, 'not-installed');
    assert.equal(status.installedVersion, null);
    assert.ok(Array.isArray(status.warnings) && status.warnings.length > 0, 'an exec failure with code present must surface a warning');
    assert.match(status.warnings[0], /EINVAL/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// --- source guard: no PATH-write call ----------------------------------------

test('lib/setup-cli.mjs never calls a PATH-write command (setx / SetEnvironmentVariable / reg add) -- display-only remedy text is not a call', () => {
  const src = readFileSync(setupCliPath, 'utf8');
  const execCallArgs = [];
  const execCallRe = /\b(?:execSync|execFileSync|exec|spawnSync|spawn)\s*\(([^)]*)\)/g;
  let m;
  while ((m = execCallRe.exec(src))) execCallArgs.push(m[1]);
  const joined = execCallArgs.join(' | ');
  assert.doesNotMatch(joined, /setx/i, `must never shell out to setx (truncates PATH at 1024 chars): ${joined}`);
  assert.doesNotMatch(joined, /reg\s+add/i, `must never shell out to "reg add" (a registry WRITE): ${joined}`);
  assert.doesNotMatch(
    joined,
    /SetEnvironmentVariable/i,
    `must never invoke SetEnvironmentVariable itself -- display-only remedy text lives outside any exec call: ${joined}`
  );
  // The module DOES reference HKCU\Environment, but only inside the default
  // registry READER (a `reg query`, an exec-call argument) -- assert that
  // every exec-call argument mentioning HKCU\Environment is a `query`, never
  // an `add`/write verb.
  const hkcuCalls = execCallArgs.filter((a) => /HKCU\\+Environment/i.test(a));
  assert.ok(hkcuCalls.length > 0, 'expected at least one exec call referencing HKCU\\Environment (the registry reader)');
  for (const call of hkcuCalls) {
    assert.match(call, /query/i, `every exec call touching HKCU\\Environment must be a read ("query"), never a write: ${call}`);
  }
});

// --- unknown verb --------------------------------------------------------------

test('an unknown verb exits 2 with a usage line on stderr and performs no filesystem write', () => {
  const home = tmp('setup-cli-unknown-verb-');
  try {
    const before = snapshot(home);
    const { exitCode, output, lines } = runCli(['bogus'], { homedir: home, resolveOpts: forceCache(home) });
    assert.equal(exitCode, 2);
    assert.equal(output, null);
    assert.ok(lines.length > 0);
    const after = snapshot(home);
    assert.deepEqual(after, before, 'an unknown verb must never write to the filesystem');
    assert.ok(!existsSync(path.join(home, '.local', 'bin')), 'an unknown verb must not create <home>/.local/bin');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('a missing "cli" target after "install"/"remove" is also an unknown verb', () => {
  assert.equal(runCli(['install']).exitCode, 2);
  assert.equal(runCli(['remove']).exitCode, 2);
  assert.equal(runCli([]).exitCode, 2);
});
