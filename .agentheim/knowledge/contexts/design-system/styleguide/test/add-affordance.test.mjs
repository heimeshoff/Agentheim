// Tests for the optional "add ticket" affordance on the EmptyColumn empty-state
// card and the ColumnHeader (agentic-workflow-018).
//
// Per the ds-006 `cornerAction` precedent, the add affordance is an OPTIONAL slot
// the consumer supplies — `onAdd` — default OFF: absent -> nothing renders. This
// suite asserts ONLY the styleguide-owned guard contract: both primitives gate the
// affordance behind an `onAdd &&` guard, never rendering it unconditionally.
// Whether (and where) a consumer supplies `onAdd` is the consumer's concern and is
// covered by the dashboard suite — not asserted here (ADR-0003).
//
// EmptyColumn / ColumnHeader render via htm/React with no DOM under `node --test`,
// so — mirroring the ticket-card / collapsible suites — the load-bearing,
// framework-free contract is verified against the component SOURCE: the add
// affordance is rendered ONLY behind an `onAdd` guard, never unconditionally.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');

const emptySrc = readFileSync(join(APP, 'empty.js'), 'utf8');
const kanbanSrc = readFileSync(join(APP, 'kanban.js'), 'utf8');

// --- EmptyColumn: the empty-state "Add ticket →" button is now an optional slot ---

test('EmptyColumn accepts an optional onAdd slot', () => {
  assert.match(emptySrc, /export function EmptyColumn\(\{[^}]*onAdd/,
    'EmptyColumn must accept an onAdd prop');
});

test('EmptyColumn renders the "Add ticket" button ONLY when onAdd is supplied (default off)', () => {
  // The "Add ticket" button text must appear on a render line guarded by onAdd —
  // never as a bare unconditional render. Catches a regression to the old
  // always-on dead button.
  // Match the render line (the button label next to the arrow-right Icon), not
  // prose comments that mention the words "Add ticket".
  const addLines = emptySrc
    .split('\n')
    .filter((line) => /Add ticket\s*<\$\{Icon\}/.test(line));
  assert.equal(addLines.length, 1, 'exactly one "Add ticket" render line expected');
  // The button must be wired to onAdd, and the whole affordance must sit behind an
  // `onAdd && ...` guard so it does not render by default.
  assert.match(emptySrc, /onAdd\s*&&/,
    'the Add-ticket affordance must be guarded by `onAdd &&` (default off)');
  assert.match(emptySrc, /onClick=\$\{onAdd\}/,
    'the Add-ticket button must invoke the supplied onAdd');
});

// --- ColumnHeader: the `+` add button is now an optional slot ---

test('ColumnHeader renders the `+` add button ONLY when onAdd is supplied (default off)', () => {
  // The plus Icon + its wrapping button must sit behind an `onAdd &&` guard. The
  // old header rendered the button unconditionally with onClick=${onAdd}.
  assert.match(kanbanSrc, /onAdd\s*&&/,
    'the header `+` button must be guarded by `onAdd &&` (default off)');
  // The plus glyph must only ever appear inside that guarded affordance.
  const plusLines = kanbanSrc
    .split('\n')
    .filter((line) => /name="plus"/.test(line));
  assert.equal(plusLines.length, 1, 'exactly one plus-icon render line expected');
});
