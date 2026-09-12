// Tests for lib/command-bootstrap-dedup.mjs — the live-tree lint guarding
// against a resolver bootstrap pasted more than once into the same command
// card (infrastructure-k9t2v), generalized to any card (infrastructure-x56qm).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { countBootstrapOccurrences, BOOTSTRAP_MARKER } from '../command-bootstrap-dedup.mjs';

function makeFixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'command-bootstrap-dedup-'));
  mkdirSync(path.join(root, 'commands'), { recursive: true });
  return root;
}

// --- fixture behavior ---------------------------------------------------

test('countBootstrapOccurrences returns 0 when the named card is missing', () => {
  const root = makeFixtureRoot();
  try {
    assert.equal(countBootstrapOccurrences(root, 'setup.md'), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('countBootstrapOccurrences defaults to dashboard.md when no card name is given (backward compatibility)', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(path.join(root, 'commands', 'dashboard.md'), `${BOOTSTRAP_MARKER}rest\" $ARGUMENTS\n`);
    assert.equal(countBootstrapOccurrences(root), 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('countBootstrapOccurrences returns 0 when the named card has no bootstrap at all', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(path.join(root, 'commands', 'setup.md'), 'no bootstrap here\n');
    assert.equal(countBootstrapOccurrences(root, 'setup.md'), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('countBootstrapOccurrences returns 1 for a single-invocation card (the fixed shape)', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(
      path.join(root, 'commands', 'setup.md'),
      `\`\`\`\n${BOOTSTRAP_MARKER}rest of script...\" $ARGUMENTS\n\`\`\`\n`
    );
    assert.equal(countBootstrapOccurrences(root, 'setup.md'), 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('countBootstrapOccurrences returns 3 for the pre-infrastructure-k9t2v triple-paste shape', () => {
  const root = makeFixtureRoot();
  try {
    const one = `${BOOTSTRAP_MARKER}rest of script...\"`;
    writeFileSync(
      path.join(root, 'commands', 'setup.md'),
      ['```', one, '```', '```', `${one} stop`, '```', '```', `${one} status`, '```'].join('\n')
    );
    assert.equal(countBootstrapOccurrences(root, 'setup.md'), 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('countBootstrapOccurrences distinguishes cards by name (two cards, different counts)', () => {
  const root = makeFixtureRoot();
  try {
    writeFileSync(path.join(root, 'commands', 'setup.md'), `${BOOTSTRAP_MARKER}x\" $ARGUMENTS\n`);
    writeFileSync(path.join(root, 'commands', 'dashboard.md'), 'no bootstrap here, pointer only\n');
    assert.equal(countBootstrapOccurrences(root, 'setup.md'), 1);
    assert.equal(countBootstrapOccurrences(root, 'dashboard.md'), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- the live-tree gate --------------------------------------------------

test('the live commands/setup.md carries the resolver bootstrap EXACTLY ONCE, and commands/dashboard.md carries ZERO (pointer-only, ADR-0079)', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const setupCount = countBootstrapOccurrences(repoRoot, 'setup.md');
  assert.equal(
    setupCount,
    1,
    `expected commands/setup.md to carry the resolver bootstrap exactly once, found ${setupCount} (re-duplication regression)`
  );
  const dashboardCount = countBootstrapOccurrences(repoRoot, 'dashboard.md');
  assert.equal(
    dashboardCount,
    0,
    `expected commands/dashboard.md to carry ZERO resolver bootstraps (pointer-only, ADR-0079 §3), found ${dashboardCount}`
  );
});
