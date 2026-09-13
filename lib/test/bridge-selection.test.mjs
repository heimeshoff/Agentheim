// Tests for lib/bridge-selection.mjs — the per-machine bridge-choice config
// file (ADR-0082 §1, infrastructure-e8h9f). Every fixture uses a fake home
// dir under os.tmpdir(), never the builder's real home.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bridgeConfigPath, readBridgeSelection, writeBridgeSelection, BRIDGE_KINDS } from '../bridge-selection.mjs';

function tmp() {
  return mkdtempSync(path.join(tmpdir(), 'agentheim-bridge-selection-'));
}

test('bridgeConfigPath joins <home>/.config/agentheim/config.json', () => {
  const home = tmp();
  assert.equal(bridgeConfigPath(home), path.join(home, '.config', 'agentheim', 'config.json'));
});

test('readBridgeSelection returns {bridge: null} when the config file does not exist', () => {
  const home = tmp();
  assert.deepEqual(readBridgeSelection(home), { bridge: null });
});

test('readBridgeSelection returns {bridge: null} for a malformed (non-JSON) file', () => {
  const home = tmp();
  const configPath = bridgeConfigPath(home);
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, 'not json{{{');
  assert.deepEqual(readBridgeSelection(home), { bridge: null });
});

test('readBridgeSelection returns {bridge: null} for valid JSON that is not an object', () => {
  const home = tmp();
  const configPath = bridgeConfigPath(home);
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, '[1,2,3]');
  assert.deepEqual(readBridgeSelection(home), { bridge: null });
});

test('readBridgeSelection returns {bridge: null} for an unrecognized bridge value', () => {
  const home = tmp();
  const configPath = bridgeConfigPath(home);
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify({ schema: 1, bridge: 'not-a-real-bridge' }));
  assert.deepEqual(readBridgeSelection(home), { bridge: null });
});

for (const kind of BRIDGE_KINDS) {
  test(`writeBridgeSelection then readBridgeSelection round-trips '${kind}'`, () => {
    const home = tmp();
    const written = writeBridgeSelection(home, kind);
    assert.deepEqual(written, { schema: 1, bridge: kind });
    assert.ok(existsSync(bridgeConfigPath(home)));
    assert.deepEqual(readBridgeSelection(home), { bridge: kind });
  });
}

test('writeBridgeSelection creates the <home>/.config/agentheim/ directory when absent', () => {
  const home = tmp();
  assert.ok(!existsSync(path.join(home, '.config')));
  writeBridgeSelection(home, 'herdr');
  assert.ok(existsSync(bridgeConfigPath(home)));
});

test('writeBridgeSelection overwrites a previous selection', () => {
  const home = tmp();
  writeBridgeSelection(home, 'vscode');
  writeBridgeSelection(home, 'none');
  assert.deepEqual(readBridgeSelection(home), { bridge: 'none' });
});

test('writeBridgeSelection throws for an unrecognized kind (never silently writes garbage)', () => {
  const home = tmp();
  assert.throws(() => writeBridgeSelection(home, 'bogus'));
  assert.equal(existsSync(bridgeConfigPath(home)), false);
});

test('the written file is valid JSON on disk matching {schema:1, bridge}', () => {
  const home = tmp();
  writeBridgeSelection(home, 'herdr');
  const raw = readFileSync(bridgeConfigPath(home), 'utf8');
  assert.deepEqual(JSON.parse(raw), { schema: 1, bridge: 'herdr' });
});
