import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { resolvePluginRoot, readPluginVersion } from '../plugin-version.mjs';

function makePluginRoot(manifest) {
  const root = mkdtempSync(path.join(tmpdir(), 'infra-rgknz-pv-'));
  if (manifest !== undefined) {
    mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
    writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), manifest);
  }
  return root;
}

test('resolvePluginRoot resolves one level up from a dashboard/ module dir', () => {
  const moduleDir = path.join('C:', 'plugin', 'dashboard');
  assert.equal(resolvePluginRoot(moduleDir), path.join('C:', 'plugin'));
});

test('readPluginVersion reads the version field out of .claude-plugin/plugin.json', () => {
  const root = makePluginRoot(JSON.stringify({ name: 'agentheim', version: '1.2.3' }));
  try {
    assert.equal(readPluginVersion(root), '1.2.3');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readPluginVersion returns null when the manifest is absent', () => {
  const root = makePluginRoot(undefined);
  try {
    assert.equal(readPluginVersion(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readPluginVersion returns null on malformed JSON (never throws)', () => {
  const root = makePluginRoot('not json {');
  try {
    assert.equal(readPluginVersion(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readPluginVersion returns null when version is missing or not a string', () => {
  const root = makePluginRoot(JSON.stringify({ name: 'agentheim', version: 42 }));
  try {
    assert.equal(readPluginVersion(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
