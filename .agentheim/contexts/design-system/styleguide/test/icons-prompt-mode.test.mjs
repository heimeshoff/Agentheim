// Tests for the prompt-mode tab glyphs (design-system-xr4sb): `diamond`
// (Modeling, replaces the undeliberate `compass`), `circle-dot` (Research,
// replaces the undeliberate `search`), and `corner-down-left` (the `↵` glyph
// for the solid-ochre icon Enter button, section-12 specimen — not a
// section-04 gallery entry, mirroring how `maximize` is used by IconButton
// without also being curated into the `ui` gallery array).
//
// icons.js renders glyphs as static inline SVG (no runtime / DOM under
// `node --test`), so — mirroring the trash-2 / inquire / chevrons-pair
// source-guard suites — the load-bearing contracts are tested as
// source-reading static guards:
//   1. The LUCIDE map defines non-empty entries (inner markup only, no
//      wrapping <svg> — Icon supplies it) for all three glyphs.
//   2. Each carries the verbatim upstream Lucide geometry.
//   3. The curated `ui` gallery array in foundations2.js surfaces `diamond`
//      and `circle-dot` (NOT `corner-down-left`, which is documented via its
//      own Enter-button specimen instead — see enter-button.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const iconsSrc = readFileSync(join(APP, 'icons.js'), 'utf8');
const foundationsSrc = readFileSync(join(APP, 'foundations2.js'), 'utf8');

for (const name of ['diamond', 'circle-dot', 'corner-down-left']) {
  test(`the ${name} glyph resolves in the icon set (non-empty inner markup)`, () => {
    const re = new RegExp(`"${name}":\\s*'<(path|circle)`);
    assert.match(iconsSrc, re, `icons.js LUCIDE map must define a non-empty "${name}" glyph`);
    const entry = iconsSrc.match(new RegExp(`"${name}":\\s*'([^']*)'`));
    assert.ok(entry, `the ${name} entry must be a single-quoted string of inner SVG markup`);
    assert.doesNotMatch(entry[1], /<svg/, `the ${name} entry must NOT carry its own <svg> wrapper`);
  });
}

test('diamond uses the verbatim upstream Lucide geometry (rounded rhombus outline)', () => {
  const entry = iconsSrc.match(/"diamond":\s*'([^']*)'/)[1];
  assert.match(
    entry,
    /M2\.7 10\.3a2\.41 2\.41 0 0 0 0 3\.41l7\.59 7\.59a2\.41 2\.41 0 0 0 3\.41 0l7\.59-7\.59a2\.41 2\.41 0 0 0 0-3\.41l-7\.59-7\.59a2\.41 2\.41 0 0 0-3\.41 0Z/,
    'must carry the upstream rounded-rhombus path',
  );
});

test('circle-dot uses the verbatim upstream Lucide geometry (outer ring + center dot)', () => {
  const entry = iconsSrc.match(/"circle-dot":\s*'([^']*)'/)[1];
  assert.match(entry, /<circle cx="12" cy="12" r="10"\/>/, 'must carry the outer ring');
  assert.match(entry, /<circle cx="12" cy="12" r="1"\/>/, 'must carry the center dot');
});

test('corner-down-left uses the verbatim upstream Lucide geometry (the return-arrow "↵" shape)', () => {
  const entry = iconsSrc.match(/"corner-down-left":\s*'([^']*)'/)[1];
  assert.match(entry, /M20 4v7a4 4 0 0 1-4 4H4/, 'must carry the vertical stem + corner turn');
  assert.match(entry, /m9 10-5 5 5 5/, 'must carry the arrowhead');
});

test('the section-04 interface-set gallery surfaces diamond and circle-dot, but NOT corner-down-left', () => {
  const uiArray = foundationsSrc.match(/const ui = \[([^\]]*)\]/);
  assert.ok(uiArray, 'IconSection must declare a `ui` gallery array');
  assert.match(uiArray[1], /"diamond"/, 'the curated gallery must include "diamond"');
  assert.match(uiArray[1], /"circle-dot"/, 'the curated gallery must include "circle-dot"');
  assert.doesNotMatch(uiArray[1], /"corner-down-left"/, 'corner-down-left is documented via its own Enter-button specimen, not the gallery');
});
