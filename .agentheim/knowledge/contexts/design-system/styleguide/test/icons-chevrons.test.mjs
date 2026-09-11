// Tests for the double-chevron glyph pair (design-system-c3p9k):
// chevrons-up / chevrons-down.
//
// icons.js renders glyphs as static inline SVG (no runtime / DOM under
// `node --test`), so — mirroring the trash-2 / message-circle-question
// source-guard suites — the load-bearing contracts are tested as
// source-reading static guards:
//   1. The LUCIDE map defines non-empty "chevrons-up" / "chevrons-down"
//      entries (inner markup only, no wrapping <svg> — Icon supplies it).
//   2. Each carries TWO stacked chevron paths (the doubled glyph), at the
//      verbatim upstream Lucide geometry.
//   3. The curated `ui` gallery array in foundations2.js surfaces both
//      (it is hand-picked, not auto-derived from LUCIDE).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const iconsSrc = readFileSync(join(APP, 'icons.js'), 'utf8');
const foundationsSrc = readFileSync(join(APP, 'foundations2.js'), 'utf8');

for (const name of ['chevrons-up', 'chevrons-down']) {
  test(`the ${name} glyph resolves in the icon set (non-empty inner markup)`, () => {
    const re = new RegExp(`"${name}":\\s*'<path`);
    assert.match(iconsSrc, re, `icons.js LUCIDE map must define a non-empty "${name}" glyph`);
    const entry = iconsSrc.match(new RegExp(`"${name}":\\s*'([^']*)'`));
    assert.ok(entry, `the ${name} entry must be a single-quoted string of inner SVG markup`);
    assert.doesNotMatch(entry[1], /<svg/, `the ${name} entry must NOT carry its own <svg> wrapper`);
  });

  test(`the ${name} glyph is a DOUBLED chevron (two stacked paths)`, () => {
    const entry = iconsSrc.match(new RegExp(`"${name}":\\s*'([^']*)'`))[1];
    const paths = entry.match(/<path/g) || [];
    assert.equal(paths.length, 2, `the ${name} glyph must carry exactly two stacked chevron paths`);
  });

  test(`the section-04 interface-set gallery surfaces ${name}`, () => {
    const uiArray = foundationsSrc.match(/const ui = \[([^\]]*)\]/);
    assert.ok(uiArray, 'IconSection must declare a `ui` gallery array');
    assert.match(uiArray[1], new RegExp(`"${name}"`), `the curated gallery must include "${name}"`);
  });
}

test('chevrons-up uses the verbatim upstream Lucide geometry (two up-chevrons)', () => {
  const entry = iconsSrc.match(/"chevrons-up":\s*'([^']*)'/)[1];
  assert.match(entry, /m17 11-5-5-5 5/, 'chevrons-up upper chevron geometry');
  assert.match(entry, /m17 18-5-5-5 5/, 'chevrons-up lower chevron geometry');
});

test('chevrons-down uses the verbatim upstream Lucide geometry (two down-chevrons)', () => {
  const entry = iconsSrc.match(/"chevrons-down":\s*'([^']*)'/)[1];
  assert.match(entry, /m7 6 5 5 5-5/, 'chevrons-down upper chevron geometry');
  assert.match(entry, /m7 13 5 5 5-5/, 'chevrons-down lower chevron geometry');
});
