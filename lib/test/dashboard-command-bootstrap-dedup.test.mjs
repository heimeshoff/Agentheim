// Tests for lib/dashboard-command-bootstrap-dedup.mjs — the live-tree lint
// guarding infrastructure-k9t2v's fix: `commands/dashboard.md`'s resolver
// bootstrap must occur exactly once.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { countBootstrapOccurrences, BOOTSTRAP_MARKER } from '../dashboard-command-bootstrap-dedup.mjs';

function makeFixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'dashboard-command-bootstrap-dedup-'));
  mkdirSync(path.join(root, 'commands'), { recursive: true });
  return root;
}

// --- fixture behavior ---------------------------------------------------

test('countBootstrapOccurrences returns 0 when commands/dashboard.md is missing', () => {
  const root = makeFixtureRoot();
  try {
    assert.equal(countBootstrapOccurrences(root), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('countBootstrapOccurrences returns 0 when the file has no bootstrap at all', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(path.join(root, 'commands', 'dashboard.md'), 'no bootstrap here\n');
    assert.equal(countBootstrapOccurrences(root), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('countBootstrapOccurrences returns 1 for a single-invocation card (the fixed shape)', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(
      path.join(root, 'commands', 'dashboard.md'),
      `\`\`\`\n${BOOTSTRAP_MARKER}rest of script...\" $ARGUMENTS\n\`\`\`\n`
    );
    assert.equal(countBootstrapOccurrences(root), 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('countBootstrapOccurrences returns 3 for the pre-infrastructure-k9t2v triple-paste shape', () => {
  const root = makeFixtureRoot();
  try {
    const one = `${BOOTSTRAP_MARKER}rest of script...\"`;
    writeFileSync(
      path.join(root, 'commands', 'dashboard.md'),
      [
        '```',
        one,
        '```',
        '```',
        `${one} stop`,
        '```',
        '```',
        `${one} status`,
        '```',
      ].join('\n')
    );
    assert.equal(countBootstrapOccurrences(root), 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- the live-tree gate --------------------------------------------------

test('the live commands/dashboard.md carries the resolver bootstrap EXACTLY ONCE', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const count = countBootstrapOccurrences(repoRoot);
  assert.equal(
    count,
    1,
    `expected commands/dashboard.md to carry the resolver bootstrap exactly once, found ${count} ` +
      `(re-duplication regression, infrastructure-k9t2v)`
  );
});
