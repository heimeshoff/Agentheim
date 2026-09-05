// Plugin identity resolution (ADR-0002 addendum, infrastructure-rgknz).
//
// `launch.mjs`, `serve.mjs`, and `server.mjs` each need to answer "which plugin
// version am I?" so a live runtime's version can be compared against the plugin
// currently on disk — the version-skew signal that turns a stale live server
// into a replace, not a reuse (see runfile.mjs / launch.mjs's decideReuseOrReplace).
//
// Both layouts (the Agentheim repo itself, and an installed plugin's cached
// version dir) put `dashboard/` exactly one level under the plugin root, beside
// `.claude-plugin/plugin.json` — the SAME relationship `resolve-plugin-file.mjs`
// already relies on for locating in-plugin files. Each caller passes its OWN
// `__dirname` so the answer reflects the ACTUAL module instance running (the
// version dir it was loaded from), not a hardcoded path.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The plugin root for a dashboard module directory: `dashboard/` sits one level
 * under the plugin root in both layouts.
 * @param {string} moduleDir  the calling module's own __dirname (dashboard/)
 * @returns {string} the resolved plugin root, absolute
 */
export function resolvePluginRoot(moduleDir) {
  return path.resolve(moduleDir, '..');
}

/**
 * Read `<pluginRoot>/.claude-plugin/plugin.json`'s `version` field.
 * Tolerant by design: an absent, unreadable, malformed manifest, or one lacking
 * a string `version`, returns null rather than throwing — "unknown version" is a
 * legitimate state callers fail toward freshness on (replace, never reuse blind).
 * @param {string} pluginRoot
 * @returns {string|null}
 */
export function readPluginVersion(pluginRoot) {
  const manifestPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifestPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
}
