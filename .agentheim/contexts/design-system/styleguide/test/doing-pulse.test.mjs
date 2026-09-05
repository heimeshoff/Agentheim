// Tests for the doing-column ambient pulse (design-system-004).
//
// The pulse is the styleguide's first continuous/ambient animation (motion now
// signals active status, not just hue). TicketCard renders via htm/React with no
// DOM in `node --test`, so — mirroring the dashboard suite — the load-bearing,
// framework-free contract is tested directly:
//   1. the pure status->class decision (`doingPulseClass`) keys strictly off
//      `status === "doing"`, independent of the agent field;
//   2. the CSS carries the keyframes + the `--duration-ambient` motion token;
//   3. a `prefers-reduced-motion: reduce` guard fully suppresses the animation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Imported from the react-free motion module so the pure decision is testable
// under plain `node --test` without resolving the canvas import map (react etc.).
import { doingPulseClass } from '../app/motion.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES = join(HERE, '..', 'styles');
const motionCss = readFileSync(join(STYLES, 'colors_and_type.css'), 'utf8');
const statusCss = readFileSync(join(STYLES, 'agentheim.css'), 'utf8');

test('doingPulseClass returns the pulse hook only for status "doing"', () => {
  assert.equal(doingPulseClass('doing'), 'ticket-rail--pulse');
  for (const status of ['backlog', 'todo', 'done', undefined, 'whatever']) {
    assert.equal(doingPulseClass(status), '', `status ${status} must not pulse`);
  }
});

test('the pulse is keyed off status, not the agent field', () => {
  // Same status, agent present vs absent -> identical class. The decision cannot
  // read `agent`, so passing only the status proves agent-independence.
  assert.equal(doingPulseClass('doing'), doingPulseClass('doing'));
  assert.equal(doingPulseClass('todo'), '');
});

test('the motion block defines a --duration-ambient loop token', () => {
  assert.match(motionCss, /--duration-ambient:\s*\d+m?s/, 'no --duration-ambient token');
});

test('the status CSS defines the ambient-pulse keyframes and rail class', () => {
  assert.match(statusCss, /@keyframes\s+ambient-rail-pulse/, 'no @keyframes ambient-rail-pulse');
  assert.match(statusCss, /\.ticket-rail--pulse\b/, 'no .ticket-rail--pulse rule');
  // ochre-only: the glow draws from the doing status color family, no new hue.
  assert.match(statusCss, /\.ticket-rail--pulse[\s\S]*var\(--st-doing/, 'pulse must use --st-doing');
  // expressed via the motion token, not a magic inline number.
  assert.match(statusCss, /\.ticket-rail--pulse[\s\S]*var\(--duration-ambient\)/, 'pulse must use --duration-ambient');
});

test('a prefers-reduced-motion guard fully suppresses the pulse', () => {
  const guard = statusCss.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/);
  assert.ok(guard, 'no prefers-reduced-motion guard');
  const block = guard[0];
  assert.match(block, /\.ticket-rail--pulse/, 'guard must target the pulse rail');
  assert.match(block, /animation:\s*none/, 'guard must set animation: none');
});

// Additive (design-system-pk4qd): the pulse's box-shadow is now painted on a
// separate pre-painted glow layer (::after) that breathes its own opacity, so
// the ambient-rail-pulse keyframes stay compositor-only (opacity only). The
// glow layer must be REMOVED under reduced motion, not merely stopped — a
// stopped-but-present layer would leave a permanent static halo, which
// ADR-0014 explicitly rejects (the pulse strips to NOTHING).
test('ambient-rail-pulse keyframes declare only opacity — compositor-only', () => {
  const match = statusCss.match(/@keyframes\s+ambient-rail-pulse\s*\{[\s\S]*?\n\}/);
  assert.ok(match, 'no @keyframes ambient-rail-pulse block found');
  const block = match[0];
  assert.doesNotMatch(block, /box-shadow/, 'ambient-rail-pulse must not declare box-shadow');
  assert.doesNotMatch(block, /color-mix/, 'ambient-rail-pulse must not re-evaluate color-mix per step');
});

test('the pulse ships a pre-painted glow layer whose own opacity breathes', () => {
  assert.match(statusCss, /@keyframes\s+ambient-rail-glow/, 'no @keyframes ambient-rail-glow');
  assert.match(statusCss, /\.ticket-rail--pulse::after\b/, 'no .ticket-rail--pulse::after glow layer');
  assert.match(statusCss, /\.ticket-rail--pulse::after[\s\S]*?var\(--st-doing/, 'glow layer must draw from --st-doing');
  assert.match(statusCss, /\.ticket-rail--pulse::after[\s\S]*?animation:\s*ambient-rail-glow/, 'glow layer must animate ambient-rail-glow');
});

test('reduced motion removes the glow layer outright, not merely stops it', () => {
  const guard = statusCss.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/);
  assert.ok(guard, 'no prefers-reduced-motion guard');
  const block = guard[0];
  assert.match(block, /\.ticket-rail--pulse::after\s*\{[^}]*content:\s*none/, 'guard must remove the glow layer (content: none), not merely stop its animation');
});
