// Committed .vsix release-artifact lint (infrastructure-j3rsn).
//
// Mirrors dashboard's dist-staleness pattern (infrastructure-w45ce) in spirit
// only, NOT in mechanism: a .vsix is a zip, not byte-reproducible across
// builds (timestamps embedded), so there is no content-hash stamp to compare
// against. This check is compare-only against the LIVE tree: exactly one
// `agentheim-bridge-*.vsix` exists under `vscode-extension/`, and its
// filename's version segment equals `package.json`'s `version`. It never
// invokes `vsce` or `npm`, never rebuilds anything.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

import { checkVsixArtifact } from '../vsix-lint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VSCODE_EXTENSION_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(VSCODE_EXTENSION_DIR, '..');

function makeScratch() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agentheim-vsix-lint-'));
  return dir;
}

function writePackageJson(dir, version) {
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }, null, 2) + '\n', 'utf8');
}

test('the committed vscode-extension/ tree has exactly one agentheim-bridge-*.vsix matching package.json version', () => {
  const result = checkVsixArtifact({ vscodeExtensionDir: VSCODE_EXTENSION_DIR });
  assert.ok(result.ok, result.message);
});

test('checkVsixArtifact fails, naming the package command, when no .vsix is present', () => {
  const scratch = makeScratch();
  try {
    writePackageJson(scratch, '0.5.0');
    const result = checkVsixArtifact({ vscodeExtensionDir: scratch });
    assert.equal(result.ok, false);
    assert.ok(result.message.includes('vsce package'), 'failure message must name the package command');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('checkVsixArtifact fails when more than one agentheim-bridge-*.vsix is present', () => {
  const scratch = makeScratch();
  try {
    writePackageJson(scratch, '0.5.0');
    writeFileSync(path.join(scratch, 'agentheim-bridge-0.4.0.vsix'), 'stale');
    writeFileSync(path.join(scratch, 'agentheim-bridge-0.5.0.vsix'), 'fresh');
    const result = checkVsixArtifact({ vscodeExtensionDir: scratch });
    assert.equal(result.ok, false);
    assert.match(result.message, /exactly one/i);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('checkVsixArtifact fails when the .vsix version segment does not match package.json version', () => {
  const scratch = makeScratch();
  try {
    writePackageJson(scratch, '0.5.0');
    writeFileSync(path.join(scratch, 'agentheim-bridge-0.4.0.vsix'), 'stale');
    const result = checkVsixArtifact({ vscodeExtensionDir: scratch });
    assert.equal(result.ok, false);
    assert.match(result.message, /0\.4\.0/);
    assert.match(result.message, /0\.5\.0/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('checkVsixArtifact passes once the single .vsix version segment matches package.json version', () => {
  const scratch = makeScratch();
  try {
    writePackageJson(scratch, '0.7.3');
    writeFileSync(path.join(scratch, 'agentheim-bridge-0.7.3.vsix'), 'fresh');
    const result = checkVsixArtifact({ vscodeExtensionDir: scratch });
    assert.ok(result.ok, result.message);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('checkVsixArtifact ignores non-matching filenames (e.g. an unrelated .vsix or a .vsix.map)', () => {
  const scratch = makeScratch();
  try {
    writePackageJson(scratch, '0.7.3');
    writeFileSync(path.join(scratch, 'agentheim-bridge-0.7.3.vsix'), 'fresh');
    writeFileSync(path.join(scratch, 'some-other-thing.vsix'), 'noise');
    mkdirSync(path.join(scratch, 'node_modules'));
    const result = checkVsixArtifact({ vscodeExtensionDir: scratch });
    assert.ok(result.ok, result.message);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('.gitignore no longer matches the committed .vsix path', () => {
  const pkg = JSON.parse(readFileSync(path.join(VSCODE_EXTENSION_DIR, 'package.json'), 'utf8'));
  const relPath = `vscode-extension/agentheim-bridge-${pkg.version}.vsix`;
  let exitCode = 0;
  try {
    execFileSync('git', ['check-ignore', relPath], { cwd: REPO_ROOT, stdio: 'pipe' });
  } catch (err) {
    exitCode = err.status;
  }
  assert.notEqual(exitCode, 0, `git check-ignore must exit non-zero (not ignored) for ${relPath}`);
});

test('vscode-extension/.vscodeignore contains *.vsix so a previously committed .vsix never nests in the next package', () => {
  const vscodeignore = readFileSync(path.join(VSCODE_EXTENSION_DIR, '.vscodeignore'), 'utf8');
  const lines = vscodeignore.split(/\r?\n/).map((l) => l.trim());
  assert.ok(lines.includes('*.vsix'), '.vscodeignore must contain a literal *.vsix line');
});
