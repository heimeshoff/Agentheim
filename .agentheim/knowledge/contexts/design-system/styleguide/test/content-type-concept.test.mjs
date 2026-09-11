// Tests for the `concept` content type (design-system-021).
//
// aw-075 makes Concepts a first-class artifact kind; the styleguide `TreeItem`
// does `const t = CONTENT_TYPES[item.type]` then `<Icon name=${t.icon} ... />`.
// Before this task CONTENT_TYPES had no `concept` key, so a `type: 'concept'`
// row dereferenced `t.icon` on `undefined` and THREW. These guards lock the
// closed gap.
//
// icons.js / data.js render through htm + react (bare specifiers that need the
// canvas import map, not resolvable under `node --test`), so — mirroring the
// trash-2 and panel-glyph suites — the load-bearing contracts are tested as
// source-reading static guards:
//   1. The LUCIDE map defines a non-empty "lightbulb" entry (inner markup only).
//   2. CONTENT_TYPES has a `concept` entry pointing at icon "lightbulb" and the
//      --ct-concept token pair, placed after `adr` (registry order preserved).
//   3. The `concept` entry's icon resolves to a real LUCIDE glyph — the exact
//      deref `TreeItem` does, so a `type: 'concept'` row renders WITHOUT throwing.
//   4. --ct-concept / --ct-concept-tint are defined in BOTH the light (:root) and
//      the dark theme blocks of agentheim.css, and never alias the reserved
//      selection accent --accent-ochre-soft (ADR-0016).
//   5. A `type: 'concept'` library row is present in the demo data so the canvas
//      TreeSpecimen renders the new TreeItem for the gate re-review.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const STYLES = join(HERE, '..', 'styles');
const iconsSrc = readFileSync(join(APP, 'icons.js'), 'utf8');
const dataSrc = readFileSync(join(APP, 'data.js'), 'utf8');
const foundationsSrc = readFileSync(join(APP, 'foundations2.js'), 'utf8');
const cssSrc = readFileSync(join(STYLES, 'agentheim.css'), 'utf8');

test('the lightbulb glyph resolves in the icon set (non-empty inner markup)', () => {
  assert.match(iconsSrc, /"lightbulb":\s*'<path/, 'icons.js LUCIDE map must define a non-empty "lightbulb" glyph');
  const entry = iconsSrc.match(/"lightbulb":\s*'([^']*)'/);
  assert.ok(entry, 'the lightbulb entry must be a single-quoted string of inner SVG markup');
  assert.doesNotMatch(entry[1], /<svg/, 'the lightbulb entry must NOT carry its own <svg> wrapper (Icon supplies it)');
  // The two base lines (filament base y=18, screw base y=22) of the upstream bulb.
  assert.match(entry[1], /<path d="M9 18h6"\/>/, 'lightbulb must carry the filament-base line');
  assert.match(entry[1], /<path d="M10 22h4"\/>/, 'lightbulb must carry the screw-base line');
});

test('CONTENT_TYPES has a `concept` entry placed after `adr`', () => {
  assert.match(
    dataSrc,
    /concept:\s*\{[^}]*label:\s*"Concept"[^}]*icon:\s*"lightbulb"[^}]*color:\s*"var\(--ct-concept\)"[^}]*tint:\s*"var\(--ct-concept-tint\)"/,
    'CONTENT_TYPES must define a `concept` entry with label/icon/color/tint',
  );
  const adrAt = dataSrc.indexOf('adr:');
  const conceptAt = dataSrc.indexOf('concept:');
  assert.ok(adrAt !== -1 && conceptAt !== -1, 'both adr and concept entries must exist');
  assert.ok(conceptAt > adrAt, 'the concept entry must be placed AFTER the adr entry (registry order)');
});

test("the concept entry's icon resolves to a real glyph — TreeItem deref never throws", () => {
  // Mirror TreeItem: t = CONTENT_TYPES['concept']; Icon name = t.icon.
  const conceptIcon = dataSrc.match(/concept:\s*\{[^}]*icon:\s*"([^"]+)"/);
  assert.ok(conceptIcon, 'the concept entry must name an icon');
  const iconName = conceptIcon[1];
  // The resolved icon name must be a defined LUCIDE key (else Icon renders empty
  // — but more importantly the registry deref itself must not be undefined).
  const keyRe = new RegExp(`"${iconName}":\\s*'<`);
  assert.match(iconsSrc, keyRe, `CONTENT_TYPES['concept'].icon ("${iconName}") must resolve to a defined LUCIDE glyph`);
});

test('--ct-concept token pair is defined in BOTH light and dark theme blocks (never the reserved accent)', () => {
  // Two definitions of each token (one in :root / light, one in the dark block).
  const concept = cssSrc.match(/--ct-concept:/g) || [];
  const conceptTint = cssSrc.match(/--ct-concept-tint:/g) || [];
  assert.equal(concept.length, 2, '--ct-concept must be defined exactly twice (light + dark)');
  assert.equal(conceptTint.length, 2, '--ct-concept-tint must be defined exactly twice (light + dark)');
  // ADR-0016: never repurpose / alias the reserved selection accent.
  assert.doesNotMatch(cssSrc, /--ct-concept(-tint)?:\s*var\(--accent-ochre-soft\)/, '--ct-concept must never alias --accent-ochre-soft (ADR-0016)');
});

test('a type:"concept" library row exists so the canvas TreeSpecimen renders it for the gate', () => {
  assert.match(dataSrc, /type:\s*"concept"/, 'the LIBRARY demo data must carry at least one type:"concept" row for the canvas specimen');
});

test('the section-04 interface-set gallery surfaces lightbulb', () => {
  const uiArray = foundationsSrc.match(/const ui = \[([^\]]*)\]/);
  assert.ok(uiArray, 'IconSection must declare a `ui` gallery array');
  assert.match(uiArray[1], /"lightbulb"/, 'the curated gallery must include "lightbulb"');
});
