// Committed .vsix release-artifact lint (infrastructure-j3rsn, ADR-0013 addendum).
//
// The VS Code bridge's packaged `.vsix` is a second committed derived
// artifact, mirroring `dashboard/dist/` (ADR-0013's infrastructure-w45ce
// amendment): the marketplace copies `main`, not a tag, so the artifact must
// be fresh ON MAIN, not merely at some release tag.
//
// Unlike `dashboard/dist/`, a `.vsix` is a zip archive and is NOT
// byte-reproducible across builds (it embeds a timestamp), so the
// content-hash `.build-stamp.json` pattern (`dashboard/build-stamp.mjs`)
// does not transfer. This check is deliberately COMPARE-ONLY: it reads the
// live tree and asserts an invariant, and never invokes `vsce` or `npm`.
//
// Invariant: exactly one `agentheim-bridge-<version>.vsix` exists directly
// under `vscode-extension/`, and its version segment equals
// `vscode-extension/package.json`'s `version`.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const VSIX_NAME_RE = /^agentheim-bridge-(\d+\.\d+\.\d+)\.vsix$/;

const PACKAGE_COMMAND =
  'cd vscode-extension && npm install && npx vsce package --allow-missing-repository';

/**
 * Compare-only lint against a live `vscode-extension/`-shaped directory.
 * Never rebuilds, never invokes `vsce`/`npm`.
 *
 * @param {{ vscodeExtensionDir: string }} opts
 * @returns {{ ok: boolean, message: string }}
 */
export function checkVsixArtifact({ vscodeExtensionDir }) {
  const pkg = JSON.parse(readFileSync(path.join(vscodeExtensionDir, 'package.json'), 'utf8'));
  const expectedVersion = pkg.version;

  const entries = readdirSync(vscodeExtensionDir);
  const matches = entries.filter((name) => VSIX_NAME_RE.test(name));

  if (matches.length === 0) {
    return {
      ok: false,
      message: `No agentheim-bridge-*.vsix found under ${vscodeExtensionDir}. Package one: ${PACKAGE_COMMAND}`,
    };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      message: `Exactly one agentheim-bridge-*.vsix must be tracked under ${vscodeExtensionDir}; found ${matches.length}: ${matches.join(', ')}. Delete stale versions rather than committing them.`,
    };
  }

  const [, version] = matches[0].match(VSIX_NAME_RE);
  if (version !== expectedVersion) {
    return {
      ok: false,
      message: `Committed ${matches[0]} version (${version}) does not match package.json version (${expectedVersion}). Repackage: ${PACKAGE_COMMAND}`,
    };
  }

  return { ok: true, message: `${matches[0]} matches package.json version ${expectedVersion}` };
}

export { VSIX_NAME_RE, PACKAGE_COMMAND };
