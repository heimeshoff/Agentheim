// marketplace-ref-lint tests (infrastructure-hnv3d, ADR-0081).
//
// Compare-only lint against a live marketplace.json + plugin.json pair:
// asserts the `agentheim` plugin entry is a `github` source pinned to
// `ref: "v" + plugin.json version`. Never mutates, never invokes git/npm.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';

import { checkMarketplaceRef } from '../marketplace-ref-lint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIVE_MARKETPLACE_JSON = path.join(REPO_ROOT, '.claude-plugin', 'marketplace.json');
const LIVE_PLUGIN_JSON = path.join(REPO_ROOT, '.claude-plugin', 'plugin.json');

function makeScratch() {
  return mkdtempSync(path.join(os.tmpdir(), 'agentheim-marketplace-ref-lint-'));
}

function writeFixture(dir, { pluginVersion, pluginName = 'agentheim', entryName = 'agentheim', source }) {
  const pluginJsonPath = path.join(dir, 'plugin.json');
  const marketplaceJsonPath = path.join(dir, 'marketplace.json');
  writeFileSync(pluginJsonPath, JSON.stringify({ name: pluginName, version: pluginVersion }, null, 2) + '\n', 'utf8');
  writeFileSync(
    marketplaceJsonPath,
    JSON.stringify({ name: 'agentheim', plugins: [{ name: entryName, source }] }, null, 2) + '\n',
    'utf8',
  );
  return { pluginJsonPath, marketplaceJsonPath };
}

test('the live tree pins marketplace.json ref to "v" + plugin.json version', () => {
  const result = checkMarketplaceRef({ marketplaceJsonPath: LIVE_MARKETPLACE_JSON, pluginJsonPath: LIVE_PLUGIN_JSON });
  assert.ok(result.ok, result.message);
});

test('fails when the plugin entry source is a relative-path string, not a github source', () => {
  const scratch = makeScratch();
  try {
    const { pluginJsonPath, marketplaceJsonPath } = writeFixture(scratch, {
      pluginVersion: '0.9.3',
      source: './',
    });
    const result = checkMarketplaceRef({ marketplaceJsonPath, pluginJsonPath });
    assert.equal(result.ok, false);
    assert.match(result.message, /github/i);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('fails when the source is a github object but carries no ref', () => {
  const scratch = makeScratch();
  try {
    const { pluginJsonPath, marketplaceJsonPath } = writeFixture(scratch, {
      pluginVersion: '0.9.3',
      source: { source: 'github', repo: 'heimeshoff/Agentheim' },
    });
    const result = checkMarketplaceRef({ marketplaceJsonPath, pluginJsonPath });
    assert.equal(result.ok, false);
    assert.match(result.message, /ref/i);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('fails when the ref does not match "v" + plugin.json version', () => {
  const scratch = makeScratch();
  try {
    const { pluginJsonPath, marketplaceJsonPath } = writeFixture(scratch, {
      pluginVersion: '0.9.3',
      source: { source: 'github', repo: 'heimeshoff/Agentheim', ref: 'v0.9.2' },
    });
    const result = checkMarketplaceRef({ marketplaceJsonPath, pluginJsonPath });
    assert.equal(result.ok, false);
    assert.match(result.message, /0\.9\.2/);
    assert.match(result.message, /0\.9\.3/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('passes when the source is a github source whose ref equals "v" + plugin.json version', () => {
  const scratch = makeScratch();
  try {
    const { pluginJsonPath, marketplaceJsonPath } = writeFixture(scratch, {
      pluginVersion: '0.9.3',
      source: { source: 'github', repo: 'heimeshoff/Agentheim', ref: 'v0.9.3' },
    });
    const result = checkMarketplaceRef({ marketplaceJsonPath, pluginJsonPath });
    assert.ok(result.ok, result.message);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('fails, naming the plugin name, when marketplace.json has no matching plugin entry', () => {
  const scratch = makeScratch();
  try {
    const { pluginJsonPath, marketplaceJsonPath } = writeFixture(scratch, {
      pluginVersion: '0.9.3',
      entryName: 'some-other-plugin',
      source: { source: 'github', repo: 'heimeshoff/Agentheim', ref: 'v0.9.3' },
    });
    const result = checkMarketplaceRef({ marketplaceJsonPath, pluginJsonPath });
    assert.equal(result.ok, false);
    assert.match(result.message, /agentheim/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
