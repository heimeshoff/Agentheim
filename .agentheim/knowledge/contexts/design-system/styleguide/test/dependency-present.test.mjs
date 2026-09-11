// Tests for the hidden/off-viewport dependency PRESENCE marker
// (design-system-b7n2s, ADR-0034 pt. 6).
//
// A sibling mechanism to the on-card dependency ring (design-system-w4t9k /
// ADR-0034), not a variant of it or of the rail attention dot (ADR-0029): says
// "a highlighted dependency target is present but not visible right now" on a
// COLLAPSED Collapsible header, or standalone on any other element. Collapsible
// renders via htm/React with no DOM under `node --test`, so — mirroring the
// attention-cue and dependency-ring suites — the load-bearing, framework-free
// contract is tested directly:
//   1. the pure boolean->class decision (`dependencyPresentClass`) keys
//      strictly off a truthy flag, default OFF;
//   2. the CSS carries the keyframes + reuses --duration-relation / --rel-dep
//      (one shared visual language with the on-card ring) but renders a
//      HOLLOW (border-only, non-filled) dot, distinct from the filled
//      --st-todo attention dot;
//   3. a `prefers-reduced-motion: reduce` guard strips the loop but keeps a
//      still-legible STATIC marker, not nothing;
//   4. `Collapsible` accepts `hasHiddenDependency` (default false), wires it
//      through `dependencyPresentClass` SEPARATELY from `attention` — a
//      distinct prop, not an overload (ADR-0029).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Imported from the react-free motion module so the pure decision is testable
// under plain `node --test` without resolving the canvas import map (react etc.).
import { dependencyPresentClass } from '../app/motion.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES = join(HERE, '..', 'styles');
const APP = join(HERE, '..', 'app');
const statusCss = readFileSync(join(STYLES, 'agentheim.css'), 'utf8');
const collapsibleSrc = readFileSync(join(APP, 'collapsible.js'), 'utf8');

test('dependencyPresentClass returns the marker hook only when the flag is truthy', () => {
  assert.equal(dependencyPresentClass(true), 'rel-present');
  for (const off of [false, undefined, null, 0, '']) {
    assert.equal(dependencyPresentClass(off), '', `flag ${String(off)} must render no marker`);
  }
});

test('dependencyPresentClass called with no argument is OFF — byte-identical render', () => {
  assert.equal(dependencyPresentClass(), '');
});

test('the status CSS defines the presence-marker keyframes and class', () => {
  assert.match(statusCss, /@keyframes\s+rel-present-breathe/, 'no @keyframes rel-present-breathe');
  assert.match(statusCss, /\.rel-present::after\b/, 'no .rel-present::after rule');
  // expressed via the shared motion token, not a magic inline number.
  assert.match(statusCss, /\.rel-present::after[\s\S]*?var\(--duration-relation\)/, 'marker must use --duration-relation');
});

test('the presence marker reuses --rel-dep and is HOLLOW (border, not filled)', () => {
  const start = statusCss.indexOf('.rel-present::after');
  assert.ok(start >= 0, 'presence-marker CSS block not found');
  const block = statusCss.slice(start, start + 400);
  assert.match(block, /border:\s*[\d.]+px\s+solid\s+var\(--rel-dep\)/, 'marker must be a border-only ring drawn from --rel-dep');
  assert.match(block, /background:\s*transparent/, 'marker must be hollow (transparent fill), not a filled dot');
});

test('the presence marker is a SEPARATE class/pseudo-element from the rail attention dot', () => {
  // .rail-attention paints via ::before; .rel-present paints via ::after, on a
  // different pseudo-element, so the two can be applied to the same header
  // simultaneously without colliding.
  assert.doesNotMatch(statusCss.slice(statusCss.indexOf('.rel-present')), /\.rel-present::before/, 'the presence marker must not reuse ::before (that is .rail-attention\'s pseudo-element)');
});

test('a prefers-reduced-motion guard strips the loop but keeps the marker visible', () => {
  const guard = [...statusCss.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/g)]
    .map((m) => m[0])
    .find((b) => /\.rel-present::after/.test(b));
  assert.ok(guard, 'no prefers-reduced-motion guard for the presence marker');
  assert.match(guard, /animation:\s*none/, 'guard must stop the loop');
  assert.match(guard, /\.rel-present::after[\s\S]*?opacity:\s*1\b/, 'guard must keep the marker visible');
});

test('Collapsible accepts hasHiddenDependency, default false', () => {
  assert.match(
    collapsibleSrc,
    /hasHiddenDependency\s*=\s*false/,
    'Collapsible must declare hasHiddenDependency with a default of false (byte-identical when absent)',
  );
});

test('Collapsible wires hasHiddenDependency through dependencyPresentClass, separately from attention', () => {
  assert.match(
    collapsibleSrc,
    /dependencyPresentClass\(hasHiddenDependency\)/,
    'Collapsible must pass hasHiddenDependency through dependencyPresentClass',
  );
  assert.match(
    collapsibleSrc,
    /attentionCueClass\(attention\)/,
    'the existing attentionCueClass(attention) wiring must remain, untouched',
  );
});

test('Collapsible imports dependencyPresentClass alongside attentionCueClass', () => {
  assert.match(
    collapsibleSrc,
    /import\s*\{\s*attentionCueClass,\s*dependencyPresentClass\s*\}\s*from\s*["']\.\/motion\.js["']/,
    'Collapsible must import dependencyPresentClass from motion.js',
  );
});
