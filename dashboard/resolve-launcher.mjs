#!/usr/bin/env node
// Env-independent launcher resolver (infrastructure-010; addendum to ADR-0002).
//
// WHY THIS EXISTS
// The /dashboard slash-command card cannot reach launch.mjs via
// `${CLAUDE_PLUGIN_ROOT:-.}/dashboard/launch.mjs`: in an INSTALLED plugin's
// command Bash context, $CLAUDE_PLUGIN_ROOT comes through EMPTY (verified in the
// field, v0.8.3, Windows 11), and `${VAR:-.}` collapses to `.` → the consumer
// project root, where no dashboard/ exists → `Cannot find module`. So the card
// must locate the launcher WITHOUT trusting that env var for correctness.
//
// MECHANISM — delegated to `lib/resolve-plugin-file.mjs` (agentic-workflow-k5n8f
// generalized this module's original walk so the `task-lifecycle` CLI, ADR-0038,
// could reuse it for a different in-plugin file). This module is now a thin,
// behavior-preserving delegate:
//   1. Derive the plugin cache root from os.homedir() — `cacheRoot`/`pickNewestVersion`
//      are re-exported directly from the shared resolver.
//   2. `resolveLauncher(root)` = `resolvePluginFile(root, 'dashboard/launch.mjs', 'launcher')`
//      — same fail-loud message shape as before ("no cached launcher found under …").
//   3. `locateLauncher(opts)` = `locatePluginFile('dashboard/launch.mjs', …)`, with the
//      repo-local candidate pinned to `path.join(moduleDir, 'launch.mjs')` exactly as
//      before (this module and launch.mjs are siblings in dashboard/).
//   4. `run(verbArgs, opts)` spawns the resolved launcher, cwd INHERITED (the consumer
//      project) and stdio: 'inherit', exiting with the child's code — unchanged.
//
// $CLAUDE_PLUGIN_ROOT is treated as an OPTIONAL fast-path only (forward-compatible
// if Claude Code ever populates it reliably); correctness NEVER depends on it.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cacheRoot, pickNewestVersion, resolvePluginFile, locatePluginFile } from '../lib/resolve-plugin-file.mjs';

export { cacheRoot, pickNewestVersion };

const LAUNCHER_REL_PATH = 'dashboard/launch.mjs';

/**
 * Resolve the path to the newest cached dashboard/launch.mjs under a cache root.
 * Delegates to the generalized resolver, preserving the exact fail-loud message
 * shape ("no cached launcher found under …") existing callers/tests depend on.
 * @param {string} root  the agentheim/agentheim cache root (see cacheRoot)
 * @returns {string} absolute path to launch.mjs
 */
export function resolveLauncher(root) {
  return resolvePluginFile(root, LAUNCHER_REL_PATH, 'launcher');
}

/**
 * Full resolution for the CLI: prefer the repo-local launcher (Agentheim's own
 * repo, where launch.mjs sits beside this module), else the newest cached one.
 * @param {object} [opts]
 * @param {string} [opts.moduleDir]  dir of this module (defaults to import.meta.url)
 * @param {string} [opts.homedir]    home dir (defaults to os.homedir())
 * @returns {string} absolute path to launch.mjs
 */
export function locateLauncher(opts = {}) {
  const moduleDir = opts.moduleDir || path.dirname(fileURLToPath(import.meta.url));
  return locatePluginFile(LAUNCHER_REL_PATH, {
    repoLocalPath: path.join(moduleDir, 'launch.mjs'),
    homedir: opts.homedir,
    label: 'launcher',
  });
}

/**
 * Locate the launcher and spawn it, cwd untouched, exiting with the child's code.
 * This is the whole runtime behavior of the resolver, exported so the card's
 * `node -e` bootstrap (which only finds THIS module via the same cache walk) can
 * delegate the rest here — keeping the un-testable inline bootstrap minimal.
 * @param {string[]} verbArgs  the /dashboard verb (stop | status | <empty>=launch)
 * @param {object}  [opts]     forwarded to locateLauncher (moduleDir, homedir)
 */
export function run(verbArgs = [], opts = {}) {
  let launcher;
  try {
    launcher = locateLauncher(opts);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
    return;
  }
  // cwd inherited (the consumer project) so launch.mjs's discoverRoot(process.cwd())
  // finds the foreign .agentheim/. stdio inherited so the URL/pid/status print through.
  const child = spawn(process.execPath, [launcher, ...verbArgs], { stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
  child.on('error', (err) => {
    console.error(`Failed to start the dashboard launcher: ${err.message}`);
    process.exit(1);
  });
}

// ---- CLI: delegate to the real launcher, cwd untouched ----
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  run(process.argv.slice(2));
}
