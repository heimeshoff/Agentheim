#!/usr/bin/env node
// setup-cli — install logic for `/setup` (ADR-0079, infrastructure-x56qm).
//
// WHY THIS LIVES OUTSIDE dashboard/cli/
// `dashboard/cli/` is shipped VERBATIM into a consumer's `<home>/.local/bin` —
// its entire contents are what lands on PATH (AC: exactly three files, byte-
// identical). The install LOGIC that copies those files there cannot live
// inside that directory without becoming a fourth shipped file. This module is
// the ADR-0038 `lib/` shape: stdlib-only, git-free, a `main(argv)` reached from
// `commands/setup.md`'s env-independent `node -e` bootstrap (the SAME
// homedir->cache->semver-max walk `references/lib-bootstrap.md` already
// documents for `migrate`), never `$CLAUDE_PLUGIN_ROOT`.
//
// EVERY FIXTURE MUST BE HERMETIC (worker/verifier briefing): every environment
// input this module needs — home dir, platform, process env (for PATH), a
// registry reader (win32 only), and the resolver's own moduleDir/repoRoot —
// is a parameter with a real-world default, never a bare `os.homedir()` /
// `process.env` read buried where a test can't reach it.
//
// Five verbs (`status` | `install cli` | `remove cli` | `install bridge` |
// `remove bridge`, infrastructure-js62b), no `install both` and no default
// choice: the model presents the menu conversationally and calls this script
// with an explicit verb per the table in the task's `## What`. The bridge
// verbs resolve the committed `.vsix` (infrastructure-j3rsn) the same
// repo-local-then-newest-cached-semver way the CLI resolves its own source,
// but through an entirely separate `resolveVsixSource`/`bridgeResolveOpts`
// pair -- the two source directories (`vscode-extension/` vs `dashboard/cli/`)
// are unrelated, so nothing is shared beyond the pattern.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  copyFileSync,
  chmodSync,
  rmSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cacheRoot, resolvePluginFile } from './resolve-plugin-file.mjs';
import { BRIDGE_KINDS, readBridgeSelection, writeBridgeSelection } from './bridge-selection.mjs';
import { resolveHerdrBinary, checkHerdrLiveness } from './resolve-herdr.mjs';

// Built from separate publisher/name parts, never a single '<publisher>.<name>'
// string literal: that literal spelling collides byte-for-byte with the
// `.agentheim` PROJECT-DIRECTORY literal `lib/test/sole-path-constructor.test.mjs`
// scans every lib/*.mjs source line for (an unrelated coincidence of spelling --
// the bridge's own PUBLISHER happens to be named "agentheim" too).
const BRIDGE_PUBLISHER = 'agentheim';
const BRIDGE_NAME = 'agentheim-bridge';
/** The bridge's marketplace-style extension id (vscode-extension/package.json's publisher.name). */
export const BRIDGE_EXTENSION_ID = `${BRIDGE_PUBLISHER}.${BRIDGE_NAME}`;

const VSIX_NAME_RE = /^agentheim-bridge-(\d+\.\d+\.\d+)\.vsix$/;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const INSTALLED_BRIDGE_VERSION_RE = new RegExp(`^${escapeRegExp(BRIDGE_EXTENSION_ID)}@(\\d+\\.\\d+\\.\\d+)$`);

/** The exact three files that ship in `dashboard/cli/` and land in `<home>/.local/bin`. Nothing else. */
export const CLI_FILENAMES = ['agentheim-dashboard.mjs', 'agentheim-dashboard.cmd', 'agentheim-dashboard'];

/** Files that need the executable bit on POSIX (the `.cmd` is Windows-only and irrelevant there). */
const CHMOD_FILENAMES = ['agentheim-dashboard.mjs', 'agentheim-dashboard'];

// ---------------------------------------------------------------------------
// Source resolution — repo-local-first / newest-cached-semver, mirroring
// dashboard/resolve-launcher.mjs's `locateLauncher`, generalized to a whole
// directory of files rather than one.
// ---------------------------------------------------------------------------

/**
 * Resolve the directory holding the three reference CLI files: the repo-local
 * `dashboard/cli/` when running inside the Agentheim repo (this module lives
 * one level under the repo root, at `lib/`), else the newest cached plugin
 * version's `dashboard/cli/`.
 *
 * @param {object} [opts]
 * @param {string} [opts.moduleDir]      dir of this module (defaults to
 *                                       `import.meta.url`'s dirname, normally `<repo>/lib`)
 * @param {string} [opts.repoRoot]       repo root override; defaults to
 *                                       `path.dirname(moduleDir)`
 * @param {string} [opts.repoLocalPath]  full override of the repo-local candidate dir
 * @param {string} [opts.homedir]        home dir (defaults to `os.homedir()`)
 * @returns {{kind: 'repo-local'|'cache', version: string|null, root: string}}
 */
export function resolveCliSource(opts = {}) {
  const moduleDir = opts.moduleDir || path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = opts.repoRoot || path.dirname(moduleDir);
  const repoLocalDir = opts.repoLocalPath || path.join(repoRoot, 'dashboard', 'cli');
  if (existsSync(repoLocalDir)) {
    return { kind: 'repo-local', version: null, root: repoLocalDir };
  }
  const homedir = opts.homedir || os.homedir();
  const root = cacheRoot(homedir);
  const resolvedDir = resolvePluginFile(root, 'dashboard/cli', 'CLI source directory');
  const rel = path.relative(root, resolvedDir);
  const version = rel.split(path.sep)[0];
  return { kind: 'cache', version, root: resolvedDir };
}

// ---------------------------------------------------------------------------
// Bridge .vsix resolution — repo-local `vscode-extension/agentheim-bridge-*.vsix`
// first, else the newest cached plugin version's own copy (infrastructure-js62b).
// Deliberately independent of resolveCliSource's own repo-local/cache split
// above: the two resolve DIFFERENT directories (`vscode-extension/` vs
// `dashboard/cli/`) and are injected via their own `bridgeResolveOpts`, never
// sharing `resolveOpts`, so a test forcing CLI cache resolution never
// accidentally forces bridge cache resolution too (or vice versa).
// ---------------------------------------------------------------------------

function compareSemverStrings(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = pa[i] - pb[i];
    if (d !== 0) return d;
  }
  return 0;
}

/** Newest `agentheim-bridge-<semver>.vsix` directly under `dir`, or `null`. */
function findVsix(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }
  const matches = names
    .map((name) => ({ name, m: name.match(VSIX_NAME_RE) }))
    .filter((x) => x.m)
    .map((x) => ({ name: x.name, version: x.m[1], path: path.join(dir, x.name) }));
  if (matches.length === 0) return null;
  matches.sort((a, b) => compareSemverStrings(b.version, a.version));
  return matches[0];
}

/**
 * Resolve the bridge `.vsix`: repo-local `vscode-extension/agentheim-bridge-*.vsix`
 * first (this module's own repo, mirroring resolveCliSource), else the newest
 * cached plugin version's own `vscode-extension/agentheim-bridge-*.vsix`.
 * Returns `null` (never throws) when neither is found — "no shipped .vsix
 * anywhere" is a legitimate, reportable state, not an error.
 *
 * @param {object} [opts]
 * @param {string} [opts.moduleDir]      dir of this module (defaults as resolveCliSource)
 * @param {string} [opts.repoRoot]       repo root override
 * @param {string} [opts.repoLocalPath]  full override of the repo-local candidate dir
 * @param {string} [opts.homedir]        home dir (defaults to `os.homedir()`)
 * @returns {{kind: 'repo-local'|'cache', version: string, path: string}|null}
 */
export function resolveVsixSource(opts = {}) {
  const moduleDir = opts.moduleDir || path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = opts.repoRoot || path.dirname(moduleDir);
  const repoLocalDir = opts.repoLocalPath || path.join(repoRoot, 'vscode-extension');
  const repoLocalMatch = findVsix(repoLocalDir);
  if (repoLocalMatch) {
    return { kind: 'repo-local', version: repoLocalMatch.version, path: repoLocalMatch.path };
  }
  const homedir = opts.homedir || os.homedir();
  const root = cacheRoot(homedir);
  let versionDirs = [];
  try {
    versionDirs = readdirSync(root).filter((n) => {
      try {
        return statSync(path.join(root, n)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    versionDirs = [];
  }
  const semverDirs = versionDirs
    .filter((n) => /^\d+\.\d+\.\d+$/.test(n))
    .sort((a, b) => compareSemverStrings(b, a));
  for (const v of semverDirs) {
    const match = findVsix(path.join(root, v, 'vscode-extension'));
    if (match) return { kind: 'cache', version: match.version, path: match.path };
  }
  return null;
}

// ---------------------------------------------------------------------------
// `code` resolution and invocation — an injectable which/exec seam (worker
// briefing) so every fixture is hermetic: a test never manipulates the real
// PATH or spawns a real VS Code, it injects `which`/`exec` directly.
// ---------------------------------------------------------------------------

function defaultWhich(name, { env, platform }) {
  const pathVar = (platform === 'win32' ? env.Path || env.PATH : env.PATH) || '';
  const dirs = pathVar.split(path.delimiter).filter(Boolean);
  const candidates =
    platform === 'win32'
      ? (env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
          .split(';')
          .filter(Boolean)
          .map((ext) => name + ext.toLowerCase())
      : [name];
  for (const dir of dirs) {
    for (const candidate of candidates) {
      const full = path.join(dir, candidate);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

/**
 * Quote a single argv element for a Windows `cmd.exe /c "<command line>"`
 * invocation. Two parsing layers stack on the way into the spawned process:
 * `cmd.exe`'s own metacharacter pass (`& | ^ < > ( )` are live syntax when
 * they appear outside a quoted span) sits ABOVE the Win32 C runtime's
 * `CommandLineToArgvW` decode that the child applies to its argv afterward
 * (backslashes double before a literal quote, a literal quote is itself
 * backslash-escaped). Every argument is wrapped in double quotes
 * UNCONDITIONALLY -- not only ones containing whitespace -- because inside a
 * double-quoted span `cmd.exe` treats `& | < > ( ) ^` as ordinary literal
 * characters, which is what closes the upper layer; the inner bytes still get
 * the `CommandLineToArgvW` escaping below, which was already handling the
 * lower layer. This is what lets a `.vsix` path containing a space, or a bare
 * cmd.exe metacharacter with no whitespace at all (e.g.
 * `C:\Users\Research&Dev\...`), survive the round trip through `cmd.exe`
 * into the child's argv.
 *
 * Accepted residual, deliberately out of scope: `cmd.exe` expands `%NAME%`
 * even inside a double-quoted span, so a path segment that forms a *matched*
 * pair of percent signs naming a defined environment variable is still
 * rewritten. A single unmatched `%` is left alone by `cmd.exe` and needs no
 * handling here.
 */
export function quoteArgWindows(arg) {
  const str = String(arg);
  if (str === '') return '""';
  let result = '"';
  for (let i = 0; i <= str.length; i++) {
    let backslashes = 0;
    while (i < str.length && str[i] === '\\') {
      i++;
      backslashes++;
    }
    if (i === str.length) {
      result += '\\'.repeat(backslashes * 2);
      break;
    } else if (str[i] === '"') {
      result += '\\'.repeat(backslashes * 2 + 1) + str[i];
    } else {
      result += '\\'.repeat(backslashes) + str[i];
    }
  }
  result += '"';
  return result;
}

/**
 * Run `execPath args…` and return stdout, or throw. On win32, `code` resolves
 * to a `.cmd` shim (`defaultWhich`), and Node refuses to spawn a `.cmd`/`.bat`
 * directly without a shell (EINVAL) -- so this seam always routes win32
 * through `shell: true`, pre-quoting every argv element itself (Node's own
 * shell-mode join is a bare `[file, ...args].join(' ')`, no per-arg quoting)
 * so a `.vsix` path containing a space, or a bare cmd.exe metacharacter with
 * no whitespace at all, survives intact -- see `quoteArgWindows`'s own
 * comment for the two-layer parsing this closes. POSIX is unchanged.
 */
function defaultExec(execPath, args) {
  if (process.platform === 'win32') {
    return execFileSync(quoteArgWindows(execPath), args.map(quoteArgWindows), {
      encoding: 'utf8',
      shell: true,
    });
  }
  return execFileSync(execPath, args, { encoding: 'utf8' });
}

/** Resolve `code` via the injected (or default) which-seam. `null` when absent. */
function resolveCode(deps) {
  const which = deps.which || defaultWhich;
  return which('code', { env: deps.env || {}, platform: deps.platform });
}

const CODE_NOT_ON_PATH_MESSAGE =
  'code is not on PATH -- install the VS Code "code" CLI (Command Palette: "Shell Command: Install \'code\' command in PATH") and re-run.';

const RELOAD_REMINDER = 'Reload the VS Code window (Developer: Reload Window) to activate the change.';

function parseInstalledBridgeVersion(listExtensionsOutput) {
  const lines = String(listExtensionsOutput).split(/\r?\n/);
  for (const line of lines) {
    const m = line.trim().match(INSTALLED_BRIDGE_VERSION_RE);
    if (m) return m[1];
  }
  return null;
}

/**
 * Build the `bridge` key of the `status` JSON contract (additive to schema 1;
 * see the task's `## What`). Side-effect-free: only reads directories/files
 * and (when `code` is on PATH) runs `code --list-extensions --show-versions`
 * via the injected `exec`, never a write.
 * @param {object} deps  see `runCli`'s injected dependency shape
 */
export function buildBridgeStatus(deps) {
  const codePath = resolveCode(deps);
  const codeOnPath = codePath !== null;

  let vsixSource = null;
  try {
    vsixSource = resolveVsixSource({ homedir: deps.homedir, ...deps.bridgeResolveOpts });
  } catch {
    vsixSource = null;
  }
  const shippedVersion = vsixSource ? vsixSource.version : null;
  const vsix = vsixSource ? vsixSource.path : null;

  if (!codeOnPath) {
    return { state: 'unknown', installedVersion: null, shippedVersion, vsix, codeOnPath: false };
  }

  const exec = deps.exec || defaultExec;
  let installedVersion = null;
  let execFailed = false;
  let execErrorMessage = null;
  try {
    installedVersion = parseInstalledBridgeVersion(exec(codePath, ['--list-extensions', '--show-versions']));
  } catch (err) {
    execFailed = true;
    execErrorMessage = err.message;
  }

  // `codeOnPath` true but the exec itself threw is NOT the same fact as
  // "code ran fine and the bridge isn't in its extension list" -- collapsing
  // both into "not-installed" would misreport an actually-installed bridge
  // as absent purely because of a transient/environmental exec failure. AC 3
  // requires the honest, distinct "unknown" instead.
  if (execFailed) {
    return {
      state: 'unknown',
      installedVersion: null,
      shippedVersion,
      vsix,
      codeOnPath: true,
      warnings: [`code --list-extensions --show-versions failed: ${execErrorMessage}`],
    };
  }

  const state =
    installedVersion === null
      ? 'not-installed'
      : shippedVersion !== null && installedVersion === shippedVersion
        ? 'installed-current'
        : 'installed-stale';

  return { state, installedVersion, shippedVersion, vsix, codeOnPath: true };
}

/**
 * `install bridge` — `code --install-extension <resolved .vsix> --force`
 * (also serves as the upgrade path, per the task's table).
 * @param {object} deps
 * @returns {{exitCode: number, lines: string[]}}
 */
export function installBridge(deps) {
  const codePath = resolveCode(deps);
  if (!codePath) {
    return { exitCode: 1, lines: [CODE_NOT_ON_PATH_MESSAGE] };
  }
  let vsix;
  try {
    vsix = resolveVsixSource({ homedir: deps.homedir, ...deps.bridgeResolveOpts });
  } catch (err) {
    return { exitCode: 1, lines: [err.message] };
  }
  if (!vsix) {
    return {
      exitCode: 1,
      lines: ['No agentheim-bridge-*.vsix found (repo-local or cached). Is the Agentheim plugin installed?'],
    };
  }
  const exec = deps.exec || defaultExec;
  try {
    exec(codePath, ['--install-extension', vsix.path, '--force']);
  } catch (err) {
    return { exitCode: 1, lines: [`code --install-extension failed: ${err.message}`] };
  }
  return {
    exitCode: 0,
    lines: [`Installed ${BRIDGE_EXTENSION_ID} ${vsix.version} from ${vsix.path}`, RELOAD_REMINDER],
  };
}

/**
 * `remove bridge` — `code --uninstall-extension agentheim.agentheim-bridge`.
 * @param {object} deps
 * @returns {{exitCode: number, lines: string[]}}
 */
export function removeBridge(deps) {
  const codePath = resolveCode(deps);
  if (!codePath) {
    return { exitCode: 1, lines: [CODE_NOT_ON_PATH_MESSAGE] };
  }
  const exec = deps.exec || defaultExec;
  try {
    exec(codePath, ['--uninstall-extension', BRIDGE_EXTENSION_ID]);
  } catch (err) {
    return { exitCode: 1, lines: [`code --uninstall-extension failed: ${err.message}`] };
  }
  return { exitCode: 0, lines: [`Removed ${BRIDGE_EXTENSION_ID}`, RELOAD_REMINDER] };
}

// ---------------------------------------------------------------------------
// PATH detection — print-only, never write (ADR-0079's refinement, AC 4/16).
// ---------------------------------------------------------------------------

/**
 * Default win32 registry reader: `reg query "HKCU\Environment" /v Path`,
 * parsed for the value. Returns `null` when the value is absent (a fresh user
 * profile with no user PATH entries at all) rather than throwing — that is a
 * legitimate state, not an error. Tests inject their own reader; this default
 * is never exercised by a fixture.
 * @returns {string|null}
 */
function defaultRegistryReader() {
  let out;
  try {
    out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'Path'], { encoding: 'utf8' });
  } catch {
    return null;
  }
  // Typical line shape: "    Path    REG_EXPAND_SZ    C:\...;C:\..."
  const m = out.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.*)/);
  return m ? m[1].trim() : null;
}

function normalizeWinPathEntry(entry, homedir) {
  let e = entry.trim();
  if (e.endsWith('\\')) e = e.slice(0, -1);
  e = e.replace(/%USERPROFILE%/i, homedir);
  return e.toLowerCase();
}

function windowsRemedy(binDir) {
  return [
    `${binDir} is not on your PATH. Add it (PowerShell, run once, then open a new terminal):`,
    '',
    `[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';${binDir}', 'User')`.replace(
      '${binDir}',
      binDir
    ),
    '',
    'Warning: never source this from $env:Path -- it flattens REG_EXPAND_SZ entries and duplicates the machine PATH into the user PATH.',
    'Warning: never use setx -- it silently truncates the PATH value at 1024 characters.',
  ].join('\n');
}

function posixRemedy(shellBase, platform, binDir) {
  if (shellBase === 'fish') {
    return `fish_add_path ${binDir}`;
  }
  const rc =
    shellBase === 'zsh'
      ? '~/.zshrc'
      : shellBase === 'bash'
        ? platform === 'darwin'
          ? '~/.bash_profile'
          : '~/.bashrc'
        : '~/.profile';
  return `echo 'export PATH="${binDir}:$PATH"' >> ${rc}`;
}

/**
 * Detect whether `binDir` is on PATH, and produce a print-only remedy when it
 * is not (or is only on the process-scope PATH). Never writes anything.
 *
 * @param {object} opts
 * @param {'win32'|string} opts.platform
 * @param {string} opts.homedir
 * @param {string} opts.binDir
 * @param {NodeJS.ProcessEnv} opts.env
 * @param {() => (string|null)} [opts.registryReader]  win32 only; injectable for tests
 * @param {string} [opts.shellPath]  POSIX only; defaults to `env.SHELL`
 * @returns {{path: {onPath: boolean, scope: 'user'|'process'|'none', remedy: string|null}, warnings: string[]}}
 */
export function detectPathState(opts) {
  const { platform, homedir, binDir, env = {} } = opts;
  if (platform === 'win32') {
    const registryReader = opts.registryReader || defaultRegistryReader;
    const normalizedBinDir = normalizeWinPathEntry(binDir, homedir);

    let userPathRaw = null;
    try {
      userPathRaw = registryReader();
    } catch {
      userPathRaw = null;
    }
    const userEntries = (userPathRaw || '').split(';').filter(Boolean);
    const onUserPath = userEntries.some((e) => normalizeWinPathEntry(e, homedir) === normalizedBinDir);
    if (onUserPath) {
      return { path: { onPath: true, scope: 'user', remedy: null }, warnings: [] };
    }

    const processEntries = (env.Path || env.PATH || '').split(';').filter(Boolean);
    const onProcessPath = processEntries.some((e) => normalizeWinPathEntry(e, homedir) === normalizedBinDir);
    if (onProcessPath) {
      return {
        path: { onPath: true, scope: 'process', remedy: windowsRemedy(binDir) },
        warnings: [
          `${binDir} is only on the process-scope PATH (e.g. inherited from the machine PATH), not the persistent user PATH -- new terminals will not see it.`,
        ],
      };
    }
    return { path: { onPath: false, scope: 'none', remedy: windowsRemedy(binDir) }, warnings: [] };
  }

  // POSIX
  const shellPath = opts.shellPath ?? env.SHELL ?? '';
  const shellBase = path.posix.basename(shellPath || '');
  const resolvedBin = path.resolve(binDir);
  const entries = (env.PATH || '').split(path.delimiter).filter(Boolean);
  const onPath = entries.some((e) => path.resolve(e.replace(/^~(?=$|\/)/, homedir)) === resolvedBin);
  if (onPath) {
    return { path: { onPath: true, scope: 'user', remedy: null }, warnings: [] };
  }
  return {
    path: { onPath: false, scope: 'none', remedy: posixRemedy(shellBase, platform, binDir) },
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// Herdr bridge status — the `herdr` key of the `status` JSON contract
// (ADR-0082 §9, infrastructure-e8h9f), mirroring `buildBridgeStatus`'s own
// shape: side-effect-free except for the short, bounded, injectable
// `herdr status` spawn `checkHerdrLiveness` performs (cached with a short
// TTL), never a write.
// ---------------------------------------------------------------------------

/**
 * Build the `herdr` key of the `status` JSON contract: `{onPath, version,
 * serverRunning}`. `onPath` is true only when `herdr` was found ON the
 * process's actual PATH — not merely "found somewhere" — since a known-root
 * fallback find still means the builder's shell won't resolve `herdr` bare
 * (ADR-0082's ground-truth note: "on PATH" is necessary-but-insufficient).
 * @param {object} deps  see `runCli`'s injected dependency shape
 * @returns {{onPath: boolean, version: string|null, serverRunning: boolean}}
 */
export function buildHerdrStatus(deps) {
  const resolved = resolveHerdrBinary({
    homedir: deps.homedir,
    platform: deps.platform,
    env: deps.env,
    which: deps.herdrWhich,
    localAppData: deps.localAppData,
  });
  const onPath = resolved.source === 'path';
  const serverRunning = resolved.path
    ? checkHerdrLiveness({
        homedir: deps.homedir,
        platform: deps.platform,
        appData: deps.appData,
        binaryPath: resolved.path,
        exec: deps.herdrExec,
        existsSync: deps.herdrSocketExistsSync,
        now: deps.now,
        ttlMs: deps.herdrLivenessTtlMs,
        cache: deps.herdrLivenessCache,
      })
    : false;
  return { onPath, version: resolved.version, serverRunning };
}

// ---------------------------------------------------------------------------
// Install-state detection — byte-compare, not a version stamp (AC 3).
// ---------------------------------------------------------------------------

function fileState(srcPath, destPath) {
  let present = false;
  let matchesSource = false;
  try {
    const destBuf = readFileSync(destPath);
    present = true;
    try {
      const srcBuf = readFileSync(srcPath);
      matchesSource = destBuf.equals(srcBuf);
    } catch {
      matchesSource = false;
    }
  } catch {
    present = false;
  }
  return { present, matchesSource };
}

/**
 * Build the full `status` JSON contract (schema 1). Side-effect-free: never
 * creates `binDir`, never touches PATH.
 * @param {object} deps  see `runCli`'s injected dependency shape
 * @returns {object} the status object (see the task's `status` JSON contract)
 */
export function buildStatus(deps) {
  const { homedir, platform, env, resolveOpts } = deps;
  const binDir = path.join(homedir, '.local', 'bin');
  const source = resolveCliSource({ homedir, ...resolveOpts });
  const files = CLI_FILENAMES.map((name) => {
    const { present, matchesSource } = fileState(path.join(source.root, name), path.join(binDir, name));
    return { name, present, matchesSource };
  });
  const allPresent = files.every((f) => f.present);
  const allMatch = files.every((f) => f.matchesSource);
  const state = !allPresent ? 'not-installed' : allMatch ? 'installed-current' : 'installed-stale';
  const { path: pathInfo, warnings } = detectPathState({
    platform,
    homedir,
    binDir,
    env,
    registryReader: deps.registryReader,
    shellPath: deps.shellPath,
  });
  const bridge = buildBridgeStatus(deps);
  const herdr = buildHerdrStatus(deps);
  const activeBridge = readBridgeSelection(homedir).bridge;
  return {
    schema: 1,
    source: { kind: source.kind, version: source.version, root: source.root },
    binDir,
    cli: { state, files, path: pathInfo },
    bridge,
    activeBridge,
    herdr,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// install cli / remove cli
// ---------------------------------------------------------------------------

/**
 * `install cli` — copy the three reference files (raw bytes, never re-encoded)
 * into `<home>/.local/bin`, `chmod 0755` the two executable ones on POSIX
 * only, then report the PATH remedy (print-only, never a write).
 * @param {object} deps
 * @returns {{exitCode: number, lines: string[]}}
 */
/** Pure predicate: POSIX gets the executable bit, win32 never attempts chmod at all (AC). */
export function shouldChmod(platform) {
  return platform !== 'win32';
}

export function installCli(deps) {
  const { homedir, platform, env } = deps;
  let source;
  try {
    source = resolveCliSource({ homedir, ...deps.resolveOpts });
  } catch (err) {
    return { exitCode: 1, lines: [err.message] };
  }
  const binDir = path.join(homedir, '.local', 'bin');
  mkdirSync(binDir, { recursive: true });
  for (const name of CLI_FILENAMES) {
    copyFileSync(path.join(source.root, name), path.join(binDir, name));
  }
  if (shouldChmod(platform)) {
    for (const name of CHMOD_FILENAMES) {
      chmodSync(path.join(binDir, name), 0o755);
    }
  }
  const { path: pathInfo, warnings } = detectPathState({
    platform,
    homedir,
    binDir,
    env,
    registryReader: deps.registryReader,
    shellPath: deps.shellPath,
  });
  const lines = [`Installed agentheim-dashboard (${source.kind}${source.version ? ` ${source.version}` : ''}) to ${binDir}`];
  for (const w of warnings) lines.push(`Warning: ${w}`);
  if (pathInfo.remedy) lines.push('', pathInfo.remedy);
  return { exitCode: 0, lines };
}

/**
 * `remove cli` — delete exactly the three shipped filenames if present; never
 * remove the directory itself, and never touch any other file in it.
 * @param {object} deps
 * @returns {{exitCode: number, lines: string[]}}
 */
export function removeCli(deps) {
  const { homedir } = deps;
  const binDir = path.join(homedir, '.local', 'bin');
  const removed = [];
  for (const name of CLI_FILENAMES) {
    const target = path.join(binDir, name);
    if (existsSync(target)) {
      rmSync(target, { force: true });
      removed.push(name);
    }
  }
  return {
    exitCode: 0,
    lines: removed.length > 0 ? [`Removed: ${removed.join(', ')}`] : ['Nothing to remove (agentheim-dashboard is not installed).'],
  };
}

/**
 * `use bridge <vscode|herdr|none>` — records the per-machine bridge
 * selection (ADR-0082 §1). An unrecognized kind fails loud, print-only,
 * without writing anything.
 * @param {object} deps
 * @param {string} kind
 * @returns {{exitCode: number, lines: string[]}}
 */
export function useBridge(deps, kind) {
  if (!BRIDGE_KINDS.includes(kind)) {
    return { exitCode: 2, lines: [`usage: setup-cli use bridge <${BRIDGE_KINDS.join('|')}>`] };
  }
  writeBridgeSelection(deps.homedir, kind);
  return { exitCode: 0, lines: [`Active bridge set to '${kind}'.`] };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const USAGE =
  'usage: setup-cli <status|install cli|remove cli|install bridge|remove bridge|use bridge <vscode|herdr|none>>';

/**
 * Run the CLI against an explicit argv and an injectable environment, so
 * every fixture is hermetic (no test ever reads the real home directory or
 * registry). Exported for direct testing and for the `node -e` bootstrap.
 * @param {string[]} argv
 * @param {object} [opts]
 * @param {string} [opts.homedir]         defaults to `os.homedir()`
 * @param {string} [opts.platform]        defaults to `process.platform`
 * @param {NodeJS.ProcessEnv} [opts.env]  defaults to `process.env`
 * @param {() => (string|null)} [opts.registryReader]  win32 only
 * @param {string} [opts.shellPath]       POSIX only; defaults to `env.SHELL`
 * @param {object} [opts.resolveOpts]       forwarded to `resolveCliSource` (moduleDir/repoRoot/repoLocalPath)
 * @param {object} [opts.bridgeResolveOpts] forwarded to `resolveVsixSource` (moduleDir/repoRoot/repoLocalPath) --
 *                                          deliberately separate from `resolveOpts` (different directory, infrastructure-js62b)
 * @param {(name: string, ctx: {env: object, platform: string}) => (string|null)} [opts.which]  injectable `code` locator
 * @param {(execPath: string, args: string[]) => string} [opts.exec]  injectable `code` invoker
 * @returns {{exitCode: number, output: object|null, lines: string[]}}
 */
export function runCli(argv, opts = {}) {
  const deps = {
    homedir: opts.homedir ?? os.homedir(),
    platform: opts.platform ?? process.platform,
    env: opts.env ?? process.env,
    registryReader: opts.registryReader,
    shellPath: opts.shellPath,
    resolveOpts: opts.resolveOpts ?? {},
    bridgeResolveOpts: opts.bridgeResolveOpts ?? {},
    which: opts.which,
    exec: opts.exec,
    herdrWhich: opts.herdrWhich,
    herdrExec: opts.herdrExec,
    herdrSocketExistsSync: opts.herdrSocketExistsSync,
    herdrLivenessCache: opts.herdrLivenessCache,
    herdrLivenessTtlMs: opts.herdrLivenessTtlMs,
    localAppData: opts.localAppData,
    appData: opts.appData,
    now: opts.now,
  };

  const [verb, target, kindArg] = argv;

  if (verb === 'status' && target === undefined) {
    return { exitCode: 0, output: buildStatus(deps), lines: [] };
  }
  if (verb === 'install' && target === 'cli') {
    const { exitCode, lines } = installCli(deps);
    return { exitCode, output: null, lines };
  }
  if (verb === 'remove' && target === 'cli') {
    const { exitCode, lines } = removeCli(deps);
    return { exitCode, output: null, lines };
  }
  if (verb === 'install' && target === 'bridge') {
    const { exitCode, lines } = installBridge(deps);
    return { exitCode, output: null, lines };
  }
  if (verb === 'remove' && target === 'bridge') {
    const { exitCode, lines } = removeBridge(deps);
    return { exitCode, output: null, lines };
  }
  if (verb === 'use' && target === 'bridge') {
    const { exitCode, lines } = useBridge(deps, kindArg);
    return { exitCode, output: null, lines };
  }
  return { exitCode: 2, output: null, lines: [USAGE] };
}

/**
 * Print the result and exit with the matching code: a `status` result prints
 * exactly one JSON line on stdout; `install cli` / `remove cli` print
 * human-readable lines on stdout; an unrecognized verb prints usage on
 * stderr. This is the whole runtime behavior, exported so the `node -e`
 * bootstrap can call it directly after `import()`.
 * @param {string[]} [argv]  defaults to `process.argv.slice(2)`
 */
export function main(argv = process.argv.slice(2)) {
  const { exitCode, output, lines } = runCli(argv);
  if (output !== null) {
    console.log(JSON.stringify(output));
  } else if (exitCode === 2) {
    for (const line of lines) console.error(line);
  } else {
    for (const line of lines) console.log(line);
  }
  process.exit(exitCode);
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
