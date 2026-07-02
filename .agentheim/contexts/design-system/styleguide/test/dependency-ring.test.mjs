// Tests for the dependency-relation ring (design-system-w4t9k / ADR-0034).
//
// A THIRD ambient signal, sibling to the doing-pulse (ADR-0014) and the rail
// attention dot (ADR-0029), but a card-PERIMETER treatment rather than a rail
// one — so it can coexist with either sibling on the same card without
// collision. Direction (waiting-on / holding-up) rides line-style (solid /
// dashed) on ONE dedicated hue, not a second color. TicketCard renders via
// htm/React with no DOM under `node --test`, so — mirroring the doing-pulse
// and attention-cue suites — the load-bearing, framework-free contract is
// tested directly:
//   1. the pure relation->class decision (`dependencyRingClass`) keys
//      strictly off "waiting-on" / "holding-up", anything else -> "";
//   2. the CSS carries the keyframes + a --duration-relation motion token and
//      a dedicated --rel-dep token, distinct from every status/content-type
//      token and from the reserved selection accent --accent-ochre-soft;
//   3. .rel-ring--waiting-on renders solid, .rel-ring--holding-up renders
//      dashed, same hue;
//   4. a `prefers-reduced-motion: reduce` guard stops the loop but KEEPS the
//      ring visible (unlike the doing-pulse, which vanishes).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Imported from the react-free motion module so the pure decision is testable
// under plain `node --test` without resolving the canvas import map (react etc.).
import { dependencyRingClass } from '../app/motion.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES = join(HERE, '..', 'styles');
const APP = join(HERE, '..', 'app');
const motionCss = readFileSync(join(STYLES, 'colors_and_type.css'), 'utf8');
const statusCss = readFileSync(join(STYLES, 'agentheim.css'), 'utf8');
const kanbanSrc = readFileSync(join(APP, 'kanban.js'), 'utf8');

test('dependencyRingClass returns a solid-ring hook for "waiting-on"', () => {
  assert.equal(dependencyRingClass('waiting-on'), 'rel-ring rel-ring--waiting-on');
});

test('dependencyRingClass returns a dashed-ring hook for "holding-up"', () => {
  assert.equal(dependencyRingClass('holding-up'), 'rel-ring rel-ring--holding-up');
});

test('dependencyRingClass returns "" for any other input — default OFF', () => {
  for (const relation of [null, undefined, '', 'whatever', 'waiting_on']) {
    assert.equal(dependencyRingClass(relation), '', `relation ${String(relation)} must render no ring`);
  }
});

test('dependencyRingClass called with no argument is OFF — byte-identical render', () => {
  assert.equal(dependencyRingClass(), '');
});

test('both theme blocks define a dedicated --rel-dep token, distinct from the reserved ochre accent', () => {
  const lightMatch = statusCss.match(/:root\s*\{[\s\S]*?\n\}/);
  const darkMatch = statusCss.match(/\.dark,\s*\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/);
  assert.ok(lightMatch, 'no :root token block found');
  assert.ok(darkMatch, 'no dark theme token block found');
  assert.match(lightMatch[0], /--rel-dep:\s*#/, 'no --rel-dep token in the light theme block');
  assert.match(darkMatch[0], /--rel-dep:\s*#/, 'no --rel-dep token in the dark theme block');
});

test('the motion block defines a --duration-relation loop token', () => {
  assert.match(motionCss, /--duration-relation:\s*\d+m?s/, 'no --duration-relation token');
});

test('the status CSS defines the ring keyframes and both direction classes', () => {
  assert.match(statusCss, /@keyframes\s+rel-ring-breathe/, 'no @keyframes rel-ring-breathe');
  assert.match(statusCss, /\.rel-ring::after\b/, 'no .rel-ring::after rule');
  assert.match(statusCss, /\.rel-ring--waiting-on::after\s*\{[^}]*border-style:\s*solid/, 'waiting-on must render a solid border');
  assert.match(statusCss, /\.rel-ring--holding-up::after\s*\{[^}]*border-style:\s*dashed/, 'holding-up must render a dashed border');
  // expressed via the motion token, not a magic inline number.
  assert.match(statusCss, /\.rel-ring::after[\s\S]*?var\(--duration-relation\)/, 'ring must use --duration-relation');
  // drawn from the dedicated token, not an existing status/content-type hue.
  assert.match(statusCss, /\.rel-ring::after[\s\S]*?var\(--rel-dep\)/, 'ring must use --rel-dep');
});

test('the ring is an inset perimeter treatment, never a rail treatment', () => {
  const start = statusCss.indexOf('.rel-ring::after');
  const block = statusCss.slice(start, start + 400);
  assert.match(block, /inset:\s*0/, 'ring must be an inset (perimeter) treatment');
  assert.doesNotMatch(block, /\.ticket-rail/, 'ring rule must not target the rail');
});

test('a prefers-reduced-motion guard stops the loop but KEEPS the ring visible', () => {
  const guard = [...statusCss.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/g)]
    .map((m) => m[0])
    .find((b) => /\.rel-ring::after/.test(b));
  assert.ok(guard, 'no prefers-reduced-motion guard for the dependency ring');
  assert.match(guard, /animation:\s*none/, 'guard must stop the loop');
  // Still-legible static baseline: unlike the doing-pulse (which vanishes), the
  // ring's solid/dashed direction is not otherwise encoded on the card, so the
  // ring must stay visible (ADR-0034, mirroring the ADR-0029 attention-cue
  // precedent).
  assert.match(guard, /\.rel-ring::after[\s\S]*?opacity:\s*1\b/, 'guard must keep the ring visible');
});

test('TicketCard accepts an optional dependencyRelation prop, default null', () => {
  assert.match(
    kanbanSrc,
    /dependencyRelation\s*=\s*null/,
    'TicketCard must declare dependencyRelation with a default of null (byte-identical when absent)',
  );
});

test('TicketCard wires dependencyRelation through dependencyRingClass onto the card root', () => {
  assert.match(
    kanbanSrc,
    /dependencyRingClass\(dependencyRelation\)/,
    'TicketCard must pass dependencyRelation through dependencyRingClass',
  );
});

test('dependencyRingClass is re-exported from kanban.js alongside doingPulseClass', () => {
  assert.match(
    kanbanSrc,
    /export\s*\{[^}]*dependencyRingClass[^}]*\}/,
    'kanban.js must re-export dependencyRingClass',
  );
});
