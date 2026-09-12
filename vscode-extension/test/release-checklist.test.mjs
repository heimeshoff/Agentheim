// Literal-substring doc check (infrastructure-j3rsn acceptance criterion):
// RELEASE.md's checklist must contain a .vsix package-verify-stage step,
// adjacent to the existing dashboard/dist step, naming the lint file by name.
// This never runs vsce/npm; it only reads the checklist text.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RELEASE_MD = readFileSync(path.join(REPO_ROOT, 'RELEASE.md'), 'utf8');

test('RELEASE.md names the .vsix lint file by name', () => {
  assert.ok(
    RELEASE_MD.includes('vsix-artifact.test.mjs'),
    'RELEASE.md must name vscode-extension/test/vsix-artifact.test.mjs',
  );
});

test('RELEASE.md contains a vsix package/verify/stage step adjacent to the dashboard/dist step', () => {
  // Collect every top-level numbered checklist heading, in document order.
  const headingRe = /\n\d+\. \*\*(.+?)\*\*/g;
  const headings = [...RELEASE_MD.matchAll(headingRe)].map((m) => m[1]);

  const distStepPos = headings.findIndex((h) => h.startsWith('Rebuild and verify the dashboard bundle'));
  assert.ok(distStepPos !== -1, 'dashboard/dist step must exist');

  const nextHeading = headings[distStepPos + 1];
  assert.ok(nextHeading !== undefined, 'a step must immediately follow the dashboard/dist step');
  assert.ok(
    nextHeading.startsWith('Package, verify, and stage the VS Code bridge'),
    `the step immediately after the dashboard/dist step must be the .vsix package-verify-stage step; found "${nextHeading}"`,
  );
});

test('RELEASE.md documents the .vsix step as compare-only (never rebuild/repackage automatically)', () => {
  assert.ok(
    RELEASE_MD.includes('compare-only'),
    'RELEASE.md must call out the vsix lint as compare-only, mirroring the dist-staleness contrast',
  );
});
