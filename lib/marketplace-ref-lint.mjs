// Marketplace ref-pin lint (infrastructure-hnv3d, ADR-0081).
//
// Why this exists: the marketplace does not install the tag a release cuts —
// it copies whatever `marketplace.json`'s plugin `source` resolves to at
// update time. A relative-path `source` (`"./"`) has no ref/sha pin, so it
// always serves whatever ref the marketplace's own clone happens to be on
// (`main`), which can be a mid-rollout snapshot ahead of its own promises
// (see ADR-0081). Pinning `source` to a `github` entry whose `ref` names the
// release tag closes that window — but only if the ref actually stays in
// lockstep with `plugin.json`'s `version` on every commit, which is the
// invariant this lint enforces.
//
// Compare-only, like `vscode-extension/vsix-lint.mjs`: it reads the two
// manifests and asserts a structural invariant, never mutates either file
// and never invokes git/npm/network.
//
// Invariant: `marketplace.json`'s plugin entry whose `name` matches
// `plugin.json`'s `name` has a `source` that is a `{"source": "github", ...}`
// object, carries a `ref`, and that `ref` equals `"v" + plugin.json.version`.

import { readFileSync } from 'node:fs';

/**
 * Compare-only lint against a live marketplace.json + plugin.json pair.
 * Never mutates either file, never invokes git/npm/network.
 *
 * @param {{ marketplaceJsonPath: string, pluginJsonPath: string }} opts
 * @returns {{ ok: boolean, message: string }}
 */
export function checkMarketplaceRef({ marketplaceJsonPath, pluginJsonPath }) {
  const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
  const marketplaceJson = JSON.parse(readFileSync(marketplaceJsonPath, 'utf8'));

  const expectedRef = `v${pluginJson.version}`;
  const entry = (marketplaceJson.plugins || []).find((p) => p.name === pluginJson.name);

  if (!entry) {
    return {
      ok: false,
      message: `marketplace.json has no plugin entry named "${pluginJson.name}" (from plugin.json) to check.`,
    };
  }

  const { source } = entry;
  if (typeof source !== 'object' || source === null || source.source !== 'github') {
    return {
      ok: false,
      message: `marketplace.json's "${pluginJson.name}" entry must be a {"source": "github", "repo": ..., "ref": "${expectedRef}"} source pinned to the release tag; got ${JSON.stringify(source)}.`,
    };
  }

  if (!source.ref) {
    return {
      ok: false,
      message: `marketplace.json's "${pluginJson.name}" entry has a github source with no "ref" set — pin it to "${expectedRef}".`,
    };
  }

  if (source.ref !== expectedRef) {
    return {
      ok: false,
      message: `marketplace.json's "${pluginJson.name}" entry ref ("${source.ref}") does not match plugin.json version ("${expectedRef}"). Update the ref whenever the version is bumped.`,
    };
  }

  return {
    ok: true,
    message: `marketplace.json ref "${source.ref}" matches plugin.json version "${pluginJson.version}".`,
  };
}
