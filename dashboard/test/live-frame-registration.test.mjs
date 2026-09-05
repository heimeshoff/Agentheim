// Registration-consistency guard (agentic-workflow-mvt8x, ADR-0070 §2 /
// mechanize-or-drop C2's mechanical half): every advisory doc-path constant the
// app exports must (a) classify as advisory under the pure router, and (b)
// resolve to EXACTLY ONE registered live-tree subscriber in board.js. A future
// third advisory artifact that follows the established `..._DOC_PATH` naming
// convention (WHATS_NEXT_DOC_PATH, IN_FLIGHT_DOC_PATH) but is never wired to a
// `useLiveTree(..., { artifactPath })` subscriber fails this suite instead of
// silently going stale on the dashboard.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyFramePath, FRAME_CATEGORY } from '../app/live-frame-router.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const boardSrc = readFileSync(path.join(appDir, 'board.js'), 'utf8');

/** Every `export const X_DOC_PATH = '...'` across the app modules. */
function discoverDocPathConstants() {
  const found = [];
  for (const file of readdirSync(appDir)) {
    if (!file.endsWith('.js')) continue;
    const src = readFileSync(path.join(appDir, file), 'utf8');
    const re = /export const (\w+_DOC_PATH)\s*=\s*(['"])([^'"]+)\2/g;
    let m;
    while ((m = re.exec(src))) found.push({ name: m[1], value: m[3], file });
  }
  return found;
}

const docPathConstants = discoverDocPathConstants();

test('the discovery regex finds at least the two known advisory doc-path constants (sanity check)', () => {
  const names = docPathConstants.map((c) => c.name);
  assert.ok(names.includes('WHATS_NEXT_DOC_PATH'), 'WHATS_NEXT_DOC_PATH must be discoverable');
  assert.ok(names.includes('IN_FLIGHT_DOC_PATH'), 'IN_FLIGHT_DOC_PATH must be discoverable');
});

for (const { name, value, file } of docPathConstants) {
  test(`${name} (${file}, "${value}") classifies as advisory under the live-frame router`, () => {
    assert.equal(
      classifyFramePath(value),
      FRAME_CATEGORY.ADVISORY,
      `${name} = "${value}" must live under .agentheim/state/** to classify as advisory (ADR-0070)`,
    );
  });

  test(`${name} resolves to exactly one registered live-tree subscriber in board.js`, () => {
    const re = new RegExp(`useLiveTree\\([^;]*?artifactPath:\\s*${name}\\b`, 'g');
    const hits = boardSrc.match(re) || [];
    assert.equal(
      hits.length,
      1,
      `${name} must be wired to exactly one useLiveTree(reload, { artifactPath: ${name} }) subscriber — a new advisory artifact must register with the router (ADR-0070 §2)`,
    );
  });
}
