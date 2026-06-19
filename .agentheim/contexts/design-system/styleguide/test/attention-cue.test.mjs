// Tests for the rail "new item" attention cue (design-system-v8k2p).
//
// Sibling of the doing-column ambient pulse (design-system-004 / ADR-0014): a
// quiet ambient marker that draws the eye to a freshly-arrived rail row or its
// (possibly collapsed) parent group header, until the consumer clears the flag.
// TreeItem / Collapsible render via htm/React with no DOM under `node --test`,
// so — mirroring the doing-pulse suite — the load-bearing, framework-free
// contract is tested directly:
//   1. the pure boolean->class decision (`attentionCueClass`) keys strictly off
//      a truthy flag, default OFF (no flag => no class => byte-identical render);
//   2. the CSS carries the keyframes + a duration motion token and draws ONLY
//      from an existing status token (--st-todo), NEVER the reserved selection
//      accent --accent-ochre-soft (ADR-0016), no new hue;
//   3. a `prefers-reduced-motion: reduce` guard strips the loop but keeps a
//      still-legible STATIC baseline (a steady marker), not nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Imported from the react-free motion module so the pure decision is testable
// under plain `node --test` without resolving the canvas import map (react etc.).
import { attentionCueClass } from '../app/motion.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES = join(HERE, '..', 'styles');
const motionCss = readFileSync(join(STYLES, 'colors_and_type.css'), 'utf8');
const statusCss = readFileSync(join(STYLES, 'agentheim.css'), 'utf8');

test('attentionCueClass returns the cue hook only when the flag is truthy', () => {
  assert.equal(attentionCueClass(true), 'rail-attention');
  for (const off of [false, undefined, null, 0, '']) {
    assert.equal(attentionCueClass(off), '', `flag ${String(off)} must render no cue`);
  }
});

test('attentionCueClass default (no flag) is OFF — byte-identical render', () => {
  // Called with no argument, exactly as an unflagged row would: empty class, so
  // the row/header markup is identical to today.
  assert.equal(attentionCueClass(), '');
});

test('the motion block defines an attention loop duration token', () => {
  assert.match(motionCss, /--duration-attention:\s*\d+m?s/, 'no --duration-attention token');
});

test('the status CSS defines the attention keyframes and class', () => {
  assert.match(statusCss, /@keyframes\s+rail-attention-breathe/, 'no @keyframes rail-attention-breathe');
  assert.match(statusCss, /\.rail-attention\b/, 'no .rail-attention rule');
  // expressed via the motion token, not a magic inline number.
  assert.match(statusCss, /\.rail-attention[\s\S]*?var\(--duration-attention\)/, 'cue must use --duration-attention');
});

test('the attention cue draws from --st-todo and never the reserved ochre accent', () => {
  // Slice out the cue rules so the assertion is scoped to this feature.
  const start = statusCss.indexOf('@keyframes rail-attention-breathe');
  assert.ok(start >= 0, 'attention CSS block not found');
  const cueCss = statusCss.slice(start);
  assert.match(cueCss, /var\(--st-todo/, 'cue must draw from the existing --st-todo token');
  assert.doesNotMatch(cueCss, /--accent-ochre-soft/, 'cue must NOT borrow the reserved selection accent (ADR-0016)');
});

test('a prefers-reduced-motion guard strips the loop but keeps a static marker', () => {
  // There are several reduced-motion @media blocks in the sheet; find the one
  // that targets the attention cue specifically.
  const guard = [...statusCss.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/g)]
    .map((m) => m[0])
    .find((b) => /\.rail-attention/.test(b));
  assert.ok(guard, 'no prefers-reduced-motion guard for the attention cue');
  const block = guard;
  assert.match(block, /\.rail-attention/, 'guard must target the attention cue');
  assert.match(block, /animation:\s*none/, 'guard must stop the loop');
  // Still-legible static baseline: the marker stays visible (opacity: 1), it is
  // NOT stripped to invisible — that is the ADR-0014 reduced-motion contract for
  // an attention cue (unlike the doing-pulse, the marker must remain readable).
  assert.match(block, /\.rail-attention[\s\S]*?opacity:\s*1\b/, 'guard must keep the marker visible');
});
