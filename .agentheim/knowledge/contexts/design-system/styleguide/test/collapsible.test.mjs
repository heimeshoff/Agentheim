// Tests for the shared Collapsible primitive (design-system-005).
//
// Collapsible renders via htm/React with no DOM under `node --test`, so —
// mirroring the ticket-card / doing-pulse suites — the load-bearing, framework-
// free contract is tested directly against the pure decision the primitive
// delegates to:
//   1. `isControlled(open)` — the standard React resolution: a component is
//      CONTROLLED when `open` is supplied (the board drives it from persisted
//      view-state, ADR-0015), UNCONTROLLED when it is omitted (the TreeGroup
//      behavior — the primitive holds its own useState(defaultOpen)).
//   2. the source wires that decision: a toggle ALWAYS fires `onToggle` (so a
//      controlled parent hears every intent) and only writes internal state when
//      uncontrolled.
// Plus source-guards that BOTH consumers compose the primitive and the board's
// duplicate header is gone (no token drift, AC: BCSectionHeader deleted).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { isControlled } from '../app/collapsible-state.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const REPO = join(HERE, '..', '..', '..', '..', '..');

const collapsibleSrc = readFileSync(join(APP, 'collapsible.js'), 'utf8');
const librarySrc = readFileSync(join(APP, 'library.js'), 'utf8');
const boardSrc = readFileSync(join(REPO, 'dashboard', 'app', 'board.js'), 'utf8');

test('isControlled is true only when an explicit open value is supplied', () => {
  assert.equal(isControlled(true), true);
  assert.equal(isControlled(false), true, 'open=false is still controlled — the parent owns a closed section');
  assert.equal(isControlled(undefined), false, 'omitted open → uncontrolled (the TreeGroup default)');
});

test('Collapsible owns the open/close reveal — the body render lives in one place', () => {
  // The primitive conditionally renders the body it reveals, so no consumer has
  // to duplicate `${open && ...}`. The reveal guard must live HERE.
  assert.match(collapsibleSrc, /open\s*&&/, 'Collapsible must conditionally render the body it reveals');
  assert.match(collapsibleSrc, /bodyStyle/, 'the body container must accept a bodyStyle override per consumer');
});

test('a toggle always fires onToggle and only writes internal state when uncontrolled', () => {
  // Controlled parents (the board, ADR-0015) must hear EVERY toggle intent; the
  // primitive must never swallow it. And it must not fight a controlled parent by
  // also writing internal state.
  assert.match(collapsibleSrc, /onToggle\s*&&\s*onToggle\(/, 'every toggle must fire onToggle when provided');
  assert.match(collapsibleSrc, /!\s*controlled|!controlled/, 'internal state writes must be gated on being uncontrolled');
});

test('TreeGroup composes Collapsible uncontrolled (defaultOpen), no longer owning the reveal', () => {
  assert.match(librarySrc, /import\s*\{\s*Collapsible\s*\}\s*from\s*["']\.\/collapsible\.js["']/, 'library.js imports the shared primitive');
  assert.match(librarySrc, /<\$\{Collapsible\}/, 'TreeGroup renders the Collapsible primitive');
  assert.match(librarySrc, /defaultOpen=\$\{defaultOpen\}/, 'TreeGroup passes its defaultOpen through (uncontrolled)');
});

test('the board consumes Collapsible controlled and the duplicate BCSectionHeader is deleted', () => {
  assert.match(boardSrc, /import\s*\{\s*Collapsible\s*\}\s*from/, 'board.js imports the shared primitive across the BC boundary (unforked, ADR-0003)');
  assert.match(boardSrc, /<\$\{Collapsible\}/, 'the board renders Collapsible for its per-BC section');
  assert.doesNotMatch(boardSrc, /BCSectionHeader/, 'the board-local duplicate header must be deleted — no token drift');
});
