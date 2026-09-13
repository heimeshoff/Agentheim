// Literal-substring doc guard over the root README's dashboard section
// (ADR-0079, infrastructure-x56qm): the old `/dashboard` launch/stop/status
// table must be replaced by the pointer description plus an
// `agentheim-dashboard` table naming `/setup` as the install path. The bridge
// <details> block is infrastructure-js62b's: `/setup` becomes the primary
// bridge install path, and the four-command `vsce package` sequence survives
// below it, relabelled the from-source alternative.

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

test('the bridge <details> block names /setup as the primary install path and keeps the vsce sequence as the from-source alternative (infrastructure-js62b)', () => {
  assert.ok(readme.includes('<summary><b>Optional: VS Code bridge'), 'the bridge <details> block must still be present');
  const [bridgeBlock] = readme.match(/<summary><b>Optional: VS Code bridge[\s\S]*?<\/details>/) || [];
  assert.ok(bridgeBlock, 'the bridge <details> block must be extractable');
  assert.match(bridgeBlock, /`\/setup`/, 'the bridge block must name /setup');
  assert.match(bridgeBlock, /primary install path/i, 'the bridge block must call /setup the primary install path');
  assert.match(bridgeBlock, /from-source alternative/i, 'the vsce package sequence must be labelled the from-source alternative');
  assert.ok(
    bridgeBlock.includes('npx vsce package --allow-missing-repository    # → agentheim-bridge-<version>.vsix'),
    'the from-source vsce sequence must still be present'
  );
});

// infrastructure-vpbks (ADR-0082): the bridge <details> block now explains
// there are THREE selectable bridge kinds, not just the VS Code extension
// documented in the rest of the block, and that the clipboard fallback is
// the floor regardless of which one is chosen.
test('the bridge <details> block explains the three-way bridge selection (vscode/herdr/none) and the clipboard floor (ADR-0082, infrastructure-vpbks)', () => {
  const [bridgeBlock] = readme.match(/<summary><b>Optional: VS Code bridge[\s\S]*?<\/details>/) || [];
  assert.ok(bridgeBlock, 'the bridge <details> block must be extractable');
  assert.match(bridgeBlock, /`\/setup use bridge <kind>`/, 'the block must name the literal /setup use bridge <kind> command');
  assert.match(bridgeBlock, /`vscode`/, 'the block must name the vscode kind');
  assert.match(bridgeBlock, /`herdr`/, 'the block must name the herdr kind');
  assert.match(bridgeBlock, /`none`/, 'the block must name the none kind');
  assert.match(bridgeBlock, /clipboard fallback is always the floor/i, 'the block must state the clipboard-floor guarantee, independent of the selected kind');
});
