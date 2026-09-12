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
// Three verbs (`status` | `install cli` | `remove cli`), no `install both` and
// no default choice (infrastructure-js62b adds the bridge verbs later): the
// model presents the menu conversationally and calls this script with an
// explicit verb per the table in the task's `## What`.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  copyFileSync,
  chmodSync,
  rmSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cacheRoot, resolvePluginFile } from './resolve-plugin-file.mjs';

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
  return {
    schema: 1,
    source: { kind: source.kind, version: source.version, root: source.root },
    binDir,
    cli: { state, files, path: pathInfo },
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

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const USAGE = 'usage: setup-cli <status|install cli|remove cli>';

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
 * @param {object} [opts.resolveOpts]     forwarded to `resolveCliSource` (moduleDir/repoRoot/repoLocalPath)
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
  };

  const [verb, target] = argv;

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
