// Tests for the trash-2 glyph in the shared icon set (design-system-017).
//
// icons.js renders glyphs as static inline SVG (no runtime / DOM under
// `node --test`), so — mirroring the drawer suite's maximize-glyph guard —
// the load-bearing contracts are tested as source-reading static guards:
//   1. The LUCIDE map defines a non-empty "trash-2" entry (inner markup only,
//      no wrapping <svg> — the wrapper is supplied by Icon).
//   2. The trash-2 geometry matches upstream Lucide, including the SYMMETRIC
//      lid-handle control points `c1 0 2 1 2 2` (not the asymmetric draft
//      variant that would ship a distorted lid).
//   3. The curated `ui` gallery array in foundations2.js surfaces "trash-2"
//      so it renders in the section-04 interface set (it is hand-picked, not
//      auto-derived from LUCIDE).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const iconsSrc = readFileSync(join(APP, 'icons.js'), 'utf8');
const foundationsSrc = readFileSync(join(APP, 'foundations2.js'), 'utf8');

test('the trash-2 glyph resolves in the icon set (non-empty inner markup)', () => {
  assert.match(iconsSrc, /"trash-2":\s*'<path/, 'icons.js LUCIDE map must define a non-empty "trash-2" glyph');
  // The entry is inner markup only — no wrapping <svg>, which Icon supplies.
  const entry = iconsSrc.match(/"trash-2":\s*'([^']*)'/);
  assert.ok(entry, 'the trash-2 entry must be a single-quoted string of inner SVG markup');
  assert.doesNotMatch(entry[1], /<svg/, 'the trash-2 entry must NOT carry its own <svg> wrapper');
});

test('the trash-2 geometry uses the symmetric upstream Lucide lid handle', () => {
  const entry = iconsSrc.match(/"trash-2":\s*'([^']*)'/)[1];
  // Lid-handle control points must be symmetric `c1 0 2 1 2 2`, not the
  // asymmetric `c1 0 1 1 2 2` draft variant.
  assert.match(entry, /c1 0 2 1 2 2/, 'the lid handle must use the symmetric control points');
  assert.doesNotMatch(entry, /c1 0 1 1 2 2/, 'the asymmetric (distorted-lid) lid handle must not ship');
  // The two body slats of the can.
  assert.match(entry, /<line x1="10"[^>]*y1="11"[^>]*y2="17"/, 'trash-2 must carry the left slat line');
  assert.match(entry, /<line x1="14"[^>]*y1="11"[^>]*y2="17"/, 'trash-2 must carry the right slat line');
});

test('the section-04 interface-set gallery surfaces trash-2', () => {
  // The `ui` array in IconSection is hand-curated, not derived from LUCIDE,
  // so the glyph is invisible on the canvas unless explicitly listed.
  const uiArray = foundationsSrc.match(/const ui = \[([^\]]*)\]/);
  assert.ok(uiArray, 'IconSection must declare a `ui` gallery array');
  assert.match(uiArray[1], /"trash-2"/, 'the curated gallery must include "trash-2"');
});
