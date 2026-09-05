// build-stamp — the dist-vs-source staleness check (infrastructure-w45ce,
// ADR-0013 amendment).
//
// Stdlib-only (node:crypto, node:fs, node:path) at CHECK time — no esbuild,
// no dashboard/node_modules needed to *check* freshness, only to *rebuild*
// (`build.mjs` imports `writeBuildStamp` from here and calls it after every
// real build; that call site is the only one that needs esbuild present).
//
// Declared inputs (the tree whose content decides whether `dashboard/dist/`
// is fresh): `dashboard/app/**`, `dashboard/assets/**`, `build.mjs` itself,
// and the design-system styleguide source `build.mjs` consumes across the BC
// boundary (`app/**` — imported by dashboard/app/board.js et al — and
// `styles/**`, copied verbatim into dist as token CSS + vendored webfonts).
// `dashboard/dist/` itself, and `node_modules/`, are never inputs.
//
// Windows autocrlf note: this module HASHES SOURCE FILES, never bundle bytes
// (dashboard/dist/app.js is the file known to phantom-modify under autocrlf —
// see lib/derived-artifact-guard.mjs's header and infrastructure-w45ce's task
// Notes). Text source files are read and their line endings normalised to LF
// before hashing, so a clean checkout on any platform hashes identically.
// Binary inputs (webfonts) are hashed as raw bytes — CRLF normalisation does
// not apply to them and must never be attempted (it would corrupt the hash).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.jsx', '.css', '.html', '.json', '.md']);

/** The one command a builder runs to heal a stale `dashboard/dist/`. */
export const REBUILD_COMMAND = 'cd dashboard && npm run build';

/** The stamp file's name, relative to whatever dist dir it is written into. */
export const STAMP_FILENAME = '.build-stamp.json';

function collectFiles(rootDir) {
  const out = [];
  if (!existsSync(rootDir)) return out;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(rootDir);
  return out;
}

function normalizedBytes(absPath) {
  const buf = readFileSync(absPath);
  const isText = TEXT_EXTENSIONS.has(path.extname(absPath).toLowerCase());
  if (!isText) return buf;
  return Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
}

/**
 * The declared input roots, as `{ label, dir }` (a directory, walked
 * recursively) or `{ label, file }` (a single file) entries. `label` is the
 * stable, hash-relevant identifier for each entry — independent of the
 * absolute path on disk, so the hash is identical across machines/checkouts.
 */
export function declaredInputRoots({ dashboardDir, repoRoot }) {
  const styleguide = path.join(repoRoot, '.agentheim', 'contexts', 'design-system', 'styleguide');
  return [
    { label: 'dashboard/app', dir: path.join(dashboardDir, 'app') },
    { label: 'dashboard/assets', dir: path.join(dashboardDir, 'assets') },
    { label: 'dashboard/build.mjs', file: path.join(dashboardDir, 'build.mjs') },
    { label: 'styleguide/app', dir: path.join(styleguide, 'app') },
    { label: 'styleguide/styles', dir: path.join(styleguide, 'styles') },
  ];
}

/**
 * Compute a stable content hash over every declared input, sorted by label
 * so the result is independent of filesystem enumeration order.
 * @returns {string} hex sha256
 */
export function computeSourceHash({ dashboardDir, repoRoot }) {
  const hash = createHash('sha256');
  const roots = declaredInputRoots({ dashboardDir, repoRoot });

  const entries = [];
  for (const root of roots) {
    if (root.file) {
      entries.push({ label: root.label, abs: root.file });
      continue;
    }
    for (const abs of collectFiles(root.dir)) {
      const rel = path.relative(root.dir, abs).split(path.sep).join('/');
      entries.push({ label: `${root.label}/${rel}`, abs });
    }
  }
  entries.sort((a, b) => a.label.localeCompare(b.label));

  for (const entry of entries) {
    hash.update(entry.label);
    hash.update('\0');
    hash.update(normalizedBytes(entry.abs));
    hash.update('\0');
  }
  return hash.digest('hex');
}

/**
 * Write `<outDir>/.build-stamp.json` recording the current source hash.
 * Called by `build.mjs` after every real build. Requires nothing beyond the
 * stdlib — a rebuild's esbuild step is a separate concern from stamping it.
 */
export function writeBuildStamp({ dashboardDir, repoRoot, outDir }) {
  const hash = computeSourceHash({ dashboardDir, repoRoot });
  mkdirSync(outDir, { recursive: true });
  const stamp = { hash, algorithm: 'sha256', rebuildCommand: REBUILD_COMMAND };
  writeFileSync(path.join(outDir, STAMP_FILENAME), `${JSON.stringify(stamp, null, 2)}\n`, 'utf8');
  return stamp;
}

/**
 * Check whether `distDir`'s committed stamp matches a fresh hash of the
 * current declared inputs. Never rebuilds, never touches esbuild — pure
 * comparison. Returns `{ fresh, message }`; `message` always names
 * `REBUILD_COMMAND` when `fresh` is false, per this task's acceptance
 * criterion ("the failure text names the rebuild command").
 */
export function checkDistFreshness({ dashboardDir, repoRoot, distDir }) {
  const stampPath = path.join(distDir, STAMP_FILENAME);

  if (!existsSync(stampPath)) {
    return {
      fresh: false,
      message: `${stampPath} is missing — dashboard/dist/ has never been stamped as built. Run: ${REBUILD_COMMAND}`,
    };
  }

  let recorded;
  try {
    recorded = JSON.parse(readFileSync(stampPath, 'utf8'));
  } catch (err) {
    return {
      fresh: false,
      message: `${stampPath} is unreadable (${err.message}). Run: ${REBUILD_COMMAND}`,
    };
  }

  const current = computeSourceHash({ dashboardDir, repoRoot });
  if (recorded.hash !== current) {
    const recordedShort = typeof recorded.hash === 'string' ? recorded.hash.slice(0, 12) : String(recorded.hash);
    return {
      fresh: false,
      message:
        `dashboard/dist/ is stale: its build stamp (${recordedShort}…) does not match the ` +
        `current source tree (${current.slice(0, 12)}…). Run: ${REBUILD_COMMAND}`,
    };
  }

  return { fresh: true, message: 'dashboard/dist/ matches its current declared sources.' };
}
