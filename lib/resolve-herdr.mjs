// resolve-herdr — find the `herdr` binary and check whether its server is
// live (ADR-0082 §9, infrastructure-e8h9f). Shared verbatim by `/setup`'s
// `status` verb and the dashboard server's later Herdr launch endpoint
// (infrastructure-xh8tw imports this module directly rather than
// re-implementing binary discovery) -- one resolver, two callers, mirroring
// `resolve-plugin-file.mjs`'s existing reuse pattern.
//
// RESOLUTION ORDER (ground truth verified on the builder's machine,
// 2026-09-13 -- see the task's Notes): PATH first, via an injectable
// which-style probe (herdr is NOT reliably on PATH: `where.exe herdr` fails
// in a shell started before the install even though the Windows *User* PATH
// names the release dir -- "on PATH" is necessary-but-insufficient); else a
// newest-semver walk of `<home>/.herdr/packages/standalone/releases/
// <semver>-<triple>/herdr(.exe)`; else, win32 only, the known
// `<home>/AppData/Local/Programs/Herdr/bin/herdr.exe` install root.
//
// EVERY FIXTURE MUST BE HERMETIC: homedir, platform, env, `which`, `exec`,
// `localAppData` (never a bare `process.env.LOCALAPPDATA` read), the socket
// existence check, and the clock are all injected parameters with real
// defaults -- no test ever touches the builder's real home directory, PATH,
// or a real Herdr install.

import { existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const RELEASE_DIR_RE = /^(\d+)\.(\d+)\.(\d+)-(.+)$/;

function compareSemverTriples(a, b) {
  for (let i = 0; i < 3; i++) {
    const d = a[i] - b[i];
    if (d !== 0) return d;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// which -- an injectable PATH probe (default mirrors `lib/setup-cli.mjs`'s
// own `defaultWhich`, duplicated rather than imported: this module is meant
// to stand alone so the dashboard server can import it without also pulling
// in setup-cli's install/remove machinery).
// ---------------------------------------------------------------------------

/**
 * @param {string} name
 * @param {{env: NodeJS.ProcessEnv, platform: string}} ctx
 * @returns {string|null}
 */
export function defaultWhich(name, { env, platform }) {
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

// ---------------------------------------------------------------------------
// Known-root fallbacks
// ---------------------------------------------------------------------------

/** `<home>/.herdr/packages/standalone/releases` -- the standalone release cache root. */
export function releasesRoot(homedir) {
  return path.join(homedir, '.herdr', 'packages', 'standalone', 'releases');
}

/**
 * The newest-semver `<semver>-<triple>` release dir's `herdr`/`herdr.exe`
 * under `releasesRoot(homedir)`, or `null` when the root is absent or holds
 * no directory with the binary actually present (a half-written newer
 * release dir can't break resolution -- mirrors `resolvePluginFile`'s own
 * "walk newest-first, skip ones missing the file" discipline).
 * @returns {{path: string, version: string}|null}
 */
function findInReleases(homedir, platform) {
  const root = releasesRoot(homedir);
  let names;
  try {
    names = readdirSync(root);
  } catch {
    return null;
  }
  const matches = names
    .map((name) => ({ name, m: name.match(RELEASE_DIR_RE) }))
    .filter((x) => x.m)
    .map((x) => ({
      name: x.name,
      version: [Number(x.m[1]), Number(x.m[2]), Number(x.m[3])],
      versionString: `${x.m[1]}.${x.m[2]}.${x.m[3]}`,
    }))
    .sort((a, b) => compareSemverTriples(b.version, a.version));

  const binName = platform === 'win32' ? 'herdr.exe' : 'herdr';
  for (const match of matches) {
    const candidate = path.join(root, match.name, binName);
    if (existsSync(candidate)) {
      return { path: candidate, version: match.versionString };
    }
  }
  return null;
}

/**
 * The real-world default for `localAppData`, derived purely from the
 * already-injected `homedir` (never a bare `process.env.LOCALAPPDATA` read,
 * and deliberately NOT `env.LOCALAPPDATA` either -- a caller that fakes
 * `homedir` for a test must get an entirely faked known-root path too,
 * without a real env var silently pointing back at the builder's actual
 * Herdr install).
 */
export function defaultLocalAppData(homedir) {
  return path.join(homedir, 'AppData', 'Local');
}

/** win32-only known install root: `<localAppData>/Programs/Herdr/bin/herdr.exe`. */
function findInKnownWindowsRoot(localAppData) {
  const candidate = path.join(localAppData, 'Programs', 'Herdr', 'bin', 'herdr.exe');
  return existsSync(candidate) ? { path: candidate, version: null } : null;
}

// ---------------------------------------------------------------------------
// resolveHerdrBinary
// ---------------------------------------------------------------------------

/**
 * Resolve the `herdr` binary. Never throws -- returns
 * `{path: null, source: null, version: null}` when nothing is found
 * ("Herdr isn't installed" is a legitimate, reportable state).
 *
 * @param {object} [deps]
 * @param {string} [deps.homedir]        defaults to `os.homedir()`
 * @param {string} [deps.platform]       defaults to `process.platform`
 * @param {NodeJS.ProcessEnv} [deps.env] defaults to `process.env`
 * @param {(name: string, ctx: {env: object, platform: string}) => (string|null)} [deps.which] injectable PATH probe
 * @param {string} [deps.localAppData]   win32 only; defaults per `defaultLocalAppData`
 * @returns {{path: string|null, source: 'path'|'releases'|'known-root'|null, version: string|null}}
 */
export function resolveHerdrBinary(deps = {}) {
  const homedir = deps.homedir ?? os.homedir();
  const platform = deps.platform ?? process.platform;
  const env = deps.env ?? process.env;
  const which = deps.which ?? defaultWhich;

  const onPath = which('herdr', { env, platform });
  if (onPath) {
    return { path: onPath, source: 'path', version: null };
  }

  const fromReleases = findInReleases(homedir, platform);
  if (fromReleases) {
    return { path: fromReleases.path, source: 'releases', version: fromReleases.version };
  }

  if (platform === 'win32') {
    const localAppData = deps.localAppData ?? defaultLocalAppData(homedir);
    const fromKnownRoot = findInKnownWindowsRoot(localAppData);
    if (fromKnownRoot) {
      return { path: fromKnownRoot.path, source: 'known-root', version: null };
    }
  }

  return { path: null, source: null, version: null };
}

// ---------------------------------------------------------------------------
// checkHerdrLiveness -- socket-file check, then a short, injectable
// `herdr status` spawn, boolean cached with a short TTL so repeated status
// requests (e.g. several dashboard page loads) don't each spawn a process.
// ---------------------------------------------------------------------------

const DEFAULT_TTL_MS = 5000;

// ---------------------------------------------------------------------------
// HERDR_CHILD_OPTIONS (infrastructure-nz2e8) -- the dashboard server itself
// is spawned `detached: true` / `windowsHide: true` / `stdio: 'ignore'`
// (dashboard/launch.mjs), i.e. on win32 it owns NO console
// (DETACHED_PROCESS + CREATE_NO_WINDOW). A console-subsystem child of a
// console-less parent is allocated a fresh, VISIBLE console on Windows
// unless `windowsHide` is set -- so every `herdr` child this server spawns,
// awaited or fire-and-forget, must carry it. Harmless on POSIX (ignored),
// so it is applied unconditionally, never platform-gated. Threaded through
// the `exec`/`spawnFn` seams themselves (not just baked into a default
// implementation's internals) so a test can assert it on every call without
// spawning a real child. Shared with dashboard/bridge-launch-api.mjs (the
// other herdr-child spawner) -- one constant, two callers.
// ---------------------------------------------------------------------------

export const HERDR_CHILD_OPTIONS = Object.freeze({ windowsHide: true });

/**
 * The real-world default for `appData` (win32's socket dir lives under it),
 * derived purely from the already-injected `homedir` -- never a bare
 * `process.env.APPDATA` read, and deliberately NOT `env.APPDATA` either, for
 * the same reason `defaultLocalAppData` avoids `env.LOCALAPPDATA`: a faked
 * `homedir` must yield an entirely faked socket path.
 */
export function defaultAppData(homedir, platform) {
  return platform === 'win32' ? path.join(homedir, 'AppData', 'Roaming') : path.join(homedir, '.config');
}

/**
 * The platform socket file `herdr`'s server listens on -- verified on win32
 * as `%APPDATA%\herdr\herdr.sock` (a 25-byte file); the POSIX shape mirrors
 * it under `<home>/.herdr/`.
 */
export function socketPath(deps = {}) {
  const homedir = deps.homedir ?? os.homedir();
  const platform = deps.platform ?? process.platform;
  const appData = deps.appData ?? defaultAppData(homedir, platform);
  return platform === 'win32' ? path.join(appData, 'herdr', 'herdr.sock') : path.join(homedir, '.herdr', 'herdr.sock');
}

/**
 * Default exec: a short, bounded `<binaryPath> status` (2s timeout); throws
 * on any failure. `options` (`HERDR_CHILD_OPTIONS` by default -- see above)
 * is spread last so a caller-supplied override always wins.
 */
function defaultExec(binaryPath, options) {
  return execFileSync(binaryPath, ['status'], { encoding: 'utf8', timeout: 2000, ...options });
}

// The module-level default cache instance -- a long-running caller (the
// dashboard server) shares this across repeated calls so the TTL actually
// caches something; a test that wants a clean slate passes its own
// `deps.cache` object instead of fighting over this one.
const defaultCache = { value: false, expiresAt: 0 };

/**
 * Check whether the Herdr server is live: the socket file must exist, and
 * (only then) a short `herdr status` must succeed. The result is cached as a
 * plain boolean for `ttlMs` (default 5s) so bursts of calls don't each spawn
 * a process.
 *
 * @param {object} [deps]
 * @param {string} [deps.homedir]
 * @param {string} [deps.platform]
 * @param {string} [deps.appData]        win32 only; defaults per `defaultAppData`
 * @param {string} [deps.binaryPath]     the resolved `herdr` binary to invoke; defaults to bare `'herdr'`
 * @param {(binaryPath: string, options: object) => string} [deps.exec]  injectable `herdr status` invoker (receives `HERDR_CHILD_OPTIONS` as its second argument -- infrastructure-nz2e8); throws = not live
 * @param {(path: string) => boolean} [deps.existsSync] injectable socket-existence check
 * @param {() => number} [deps.now]      injectable clock (ms); defaults to `Date.now`
 * @param {number} [deps.ttlMs]          cache TTL in ms; defaults to 5000
 * @param {{value: boolean, expiresAt: number}} [deps.cache]  the cache instance; defaults to a shared module-level one
 * @returns {boolean}
 */
export function checkHerdrLiveness(deps = {}) {
  const homedir = deps.homedir ?? os.homedir();
  const platform = deps.platform ?? process.platform;
  const exec = deps.exec ?? defaultExec;
  const existsFn = deps.existsSync ?? existsSync;
  const now = deps.now ?? Date.now;
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
  const cache = deps.cache ?? defaultCache;
  const binaryPath = deps.binaryPath ?? 'herdr';

  const nowMs = now();
  if (nowMs < cache.expiresAt) {
    return cache.value;
  }

  const sock = socketPath({ homedir, platform, appData: deps.appData });
  let live = false;
  if (existsFn(sock)) {
    try {
      exec(binaryPath, HERDR_CHILD_OPTIONS);
      live = true;
    } catch {
      live = false;
    }
  }
  cache.value = live;
  cache.expiresAt = nowMs + ttlMs;
  return live;
}
