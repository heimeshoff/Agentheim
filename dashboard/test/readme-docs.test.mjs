// Literal-substring doc guard over the root README's dashboard section
// (ADR-0079, infrastructure-x56qm): the old `/dashboard` launch/stop/status
// table must be replaced by the pointer description plus an
// `agentheim-dashboard` table naming `/setup` as the install path, and the
// bridge <details> block must be left untouched (js62b owns it).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');
const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

test('README names /setup as the install path for the dashboard CLI', () => {
  assert.ok(readme.includes('/setup'), 'README must mention /setup');
});

test('README carries the agentheim-dashboard / stop / status table', () => {
  assert.ok(readme.includes('`agentheim-dashboard`'), 'README must name the literal agentheim-dashboard command');
  assert.ok(readme.includes('`agentheim-dashboard stop`'), 'README must name the literal agentheim-dashboard stop command');
  assert.ok(readme.includes('`agentheim-dashboard status`'), 'README must name the literal agentheim-dashboard status command');
});

test('README no longer documents /dashboard as a working launcher table', () => {
  assert.ok(!readme.includes('| `/dashboard` | Launch'), 'README must not keep the old /dashboard launch table row');
});

test('README describes /dashboard as a pointer', () => {
  assert.match(readme, /`\/dashboard`.*pointer/s, 'README must describe /dashboard as a pointer');
});

test('the bridge <details> block is unchanged (js62b owns it)', () => {
  assert.ok(readme.includes('<summary><b>Optional: VS Code bridge'), 'the bridge <details> block must still be present verbatim');
  assert.ok(
    readme.includes('npx vsce package --allow-missing-repository    # → agentheim-bridge-<version>.vsix'),
    'the bridge install snippet must be unchanged'
  );
});
