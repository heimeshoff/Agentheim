// Tests for the off-viewport edge-blink PRIMITIVE (design-system-b7n2s).
//
// Mirrors the ADR-0003 "styleguide owns look/mechanics, consumer owns
// placement" seam used for cornerAction (ds-006): the styleguide ships only
// the CSS + a direction-aware helper (edgeBlinkClass); the board
// (agentic-workflow-h9v3m) builds and places the actual small edge indicator
// using its own scroll geometry. No new component is added here — the
// load-bearing, framework-free contract is tested directly:
//   1. the pure edge->class decision (`edgeBlinkClass`) keys strictly off
//      "top" / "bottom", anything else -> "";
//   2. the CSS carries the keyframes + reuses --duration-relation / --rel-dep
//      (the shared dependency-relation visual language);
//   3. .rel-edge-blink--top and .rel-edge-blink--bottom render distinctly
//      (an edge-oriented glow direction);
//   4. a `prefers-reduced-motion: reduce` guard stops the loop but KEEPS the
//      indicator visible.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Imported from the react-free motion module so the pure decision is testable
// under plain `node --test` without resolving the canvas import map (react etc.).
import { edgeBlinkClass } from '../app/motion.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES = join(HERE, '..', 'styles');
const statusCss = readFileSync(join(STYLES, 'agentheim.css'), 'utf8');

test('edgeBlinkClass returns a distinct hook for "top"', () => {
  assert.equal(edgeBlinkClass('top'), 'rel-edge-blink rel-edge-blink--top');
});

test('edgeBlinkClass returns a distinct hook for "bottom"', () => {
  assert.equal(edgeBlinkClass('bottom'), 'rel-edge-blink rel-edge-blink--bottom');
});

test('edgeBlinkClass returns "" for any other input — default OFF', () => {
  for (const edge of [null, undefined, '', 'left', 'right', 'TOP']) {
    assert.equal(edgeBlinkClass(edge), '', `edge ${String(edge)} must render no indicator`);
  }
});

test('the status CSS defines the edge-blink keyframes and base class', () => {
  assert.match(statusCss, /@keyframes\s+rel-edge-blink-breathe/, 'no @keyframes rel-edge-blink-breathe');
  assert.match(statusCss, /\.rel-edge-blink\b/, 'no .rel-edge-blink rule');
  assert.match(statusCss, /\.rel-edge-blink[\s\S]*?var\(--duration-relation\)/, 'edge-blink must use --duration-relation');
  assert.match(statusCss, /\.rel-edge-blink[\s\S]*?var\(--rel-dep\)/, 'edge-blink must draw from --rel-dep');
});

test('.rel-edge-blink--top and .rel-edge-blink--bottom render a distinct, edge-oriented treatment', () => {
  assert.match(statusCss, /\.rel-edge-blink--top\s*\{[^}]*\}/, 'no .rel-edge-blink--top rule');
  assert.match(statusCss, /\.rel-edge-blink--bottom\s*\{[^}]*\}/, 'no .rel-edge-blink--bottom rule');
  const topRule = statusCss.match(/\.rel-edge-blink--top\s*\{([^}]*)\}/)[1];
  const bottomRule = statusCss.match(/\.rel-edge-blink--bottom\s*\{([^}]*)\}/)[1];
  assert.notEqual(topRule.trim(), bottomRule.trim(), 'top and bottom modifiers must differ (oriented toward their own edge)');
});

test('a prefers-reduced-motion guard stops the loop but KEEPS the indicator visible', () => {
  const guard = [...statusCss.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/g)]
    .map((m) => m[0])
    .find((b) => /\.rel-edge-blink\b/.test(b) && !/--top|--bottom/.test(b));
  assert.ok(guard, 'no prefers-reduced-motion guard for the edge-blink primitive');
  assert.match(guard, /animation:\s*none/, 'guard must stop the loop');
  assert.match(guard, /\.rel-edge-blink[\s\S]*?opacity:\s*1\b/, 'guard must keep the indicator visible');
});
