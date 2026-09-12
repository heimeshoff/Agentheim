// Static guards over the shipped CLI directory, `dashboard/cli/` (ADR-0079,
// infrastructure-x56qm). Its entire contents are what a consumer's `/setup`
// plain-copies into `<home>/.local/bin` — every byte here is load-bearing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isEnvIndependentResolverSource } from './helpers/card.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');
const cliDir = path.join(repoRoot, 'dashboard', 'cli');
const gitattributesPath = path.join(repoRoot, '.gitattributes');

const EXPECTED_FILES = ['agentheim-dashboard', 'agentheim-dashboard.cmd', 'agentheim-dashboard.mjs'];

test('dashboard/cli/ contains exactly the three shipped entries, nothing else', () => {
  const entries = readdirSync(cliDir).sort();
  assert.deepEqual(entries, EXPECTED_FILES, `expected exactly ${JSON.stringify(EXPECTED_FILES)}, found ${JSON.stringify(entries)}`);
});

test('agentheim-dashboard.mjs resolves via the repo-local-first / newest-cached-semver walk and never references $CLAUDE_PLUGIN_ROOT', () => {
  const src = readFileSync(path.join(cliDir, 'agentheim-dashboard.mjs'), 'utf8');
  assert.ok(
    isEnvIndependentResolverSource(src),
    'dashboard/cli/agentheim-dashboard.mjs must derive its cache path from os.homedir() and never mention $CLAUDE_PLUGIN_ROOT'
  );
});

test('predicate REJECTS a $CLAUDE_PLUGIN_ROOT-dependent source (Red proof)', () => {
  const bad = "const root = process.env.CLAUDE_PLUGIN_ROOT || '.'; os.homedir();";
  assert.ok(!isEnvIndependentResolverSource(bad));
});

test('none of the three committed CLI files contains a \\r byte', () => {
  for (const name of EXPECTED_FILES) {
    const buf = readFileSync(path.join(cliDir, name));
    assert.ok(!buf.includes(0x0d), `${name} must not contain a CR byte (a CRLF shebang breaks the shim on macOS/Linux)`);
  }
});

test('.gitattributes pins dashboard/cli/** to LF', () => {
  const content = readFileSync(gitattributesPath, 'utf8');
  assert.match(content, /dashboard\/cli\/\*\*\s+text\s+eol=lf/, '.gitattributes must pin dashboard/cli/** to eol=lf');
});
