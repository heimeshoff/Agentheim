// Tests for the message-circle-question glyph in the shared icon set
// (design-system-r4k8m). Mirrors the trash-2 guard (design-system-017).
//
// icons.js renders glyphs as static inline SVG (no runtime / DOM under
// `node --test`), so the load-bearing contracts are tested as source-reading
// static guards:
//   1. The LUCIDE map defines a non-empty "message-circle-question" entry
//      (inner markup only, no wrapping <svg> — the wrapper is supplied by Icon).
//   2. The geometry matches upstream Lucide: the chat-bubble path, the
//      question-mark curve, and the question-mark dot.
//   3. The curated `ui` gallery array in foundations2.js surfaces the glyph so
//      it renders in the section-04 interface set (it is hand-picked, not
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

test('the message-circle-question glyph resolves in the icon set (non-empty inner markup)', () => {
  assert.match(iconsSrc, /"message-circle-question":\s*'<path/, 'icons.js LUCIDE map must define a non-empty "message-circle-question" glyph');
  // The entry is inner markup only — no wrapping <svg>, which Icon supplies.
  const entry = iconsSrc.match(/"message-circle-question":\s*'([^']*)'/);
  assert.ok(entry, 'the message-circle-question entry must be a single-quoted string of inner SVG markup');
  assert.doesNotMatch(entry[1], /<svg/, 'the message-circle-question entry must NOT carry its own <svg> wrapper');
});

test('the message-circle-question geometry matches upstream Lucide', () => {
  const entry = iconsSrc.match(/"message-circle-question":\s*'([^']*)'/)[1];
  // Chat-bubble outline (speech bubble with the tail).
  assert.match(entry, /M7\.9 20A9 9 0 1 0 4 16\.1L2 22Z/, 'must carry the upstream chat-bubble path');
  // The question-mark curve.
  assert.match(entry, /M9\.09 9a3 3 0 0 1 5\.83 1c0 2-3 3-3 3/, 'must carry the question-mark curve');
  // The question-mark dot.
  assert.match(entry, /M12 17h\.01/, 'must carry the question-mark dot');
});

test('the section-04 interface-set gallery surfaces message-circle-question', () => {
  // The `ui` array in IconSection is hand-curated, not derived from LUCIDE,
  // so the glyph is invisible on the canvas unless explicitly listed.
  const uiArray = foundationsSrc.match(/const ui = \[([^\]]*)\]/);
  assert.ok(uiArray, 'IconSection must declare a `ui` gallery array');
  assert.match(uiArray[1], /"message-circle-question"/, 'the curated gallery must include "message-circle-question"');
});
