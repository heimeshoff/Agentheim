// Tests for the shared Modal / ConfirmDialog primitive family (design-system-018).
//
// Modal renders via htm/React with no DOM under `node --test`, so — mirroring the
// menu / collapsible suites — the load-bearing, framework-free contract is tested
// directly against the pure decisions the primitive delegates to (modal-state.js):
//   1. `isDismissKey(key)` — ONLY Escape dismisses (Esc / scrim-click / Cancel all
//      route through the consumer's onClose; the key predicate is the testable seam).
//   2. `nextTrapFocusIndex(count, activeIndex, shift)` — the focus-trap wrap math:
//      Tab past the last focusable returns to the first; Shift-Tab before the first
//      wraps to the last; everything in between steps by one. This is the pure core
//      of the "Tab/Shift-Tab stay contained within the panel" contract.
//   3. `isTrapKey(key)` — only Tab participates in the trap.
// Plus source-guards that the primitives own the scrim/elevation/reveal, draw danger
// from --obligation (not the reserved accent, ADR-0016), stack above the Drawer's
// z-index 40, strip motion under prefers-reduced-motion (ADR-0014), and that the
// canvas documents Button / Modal / ConfirmDialog (incl. a destructive specimen).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  isDismissKey, isTrapKey, nextTrapFocusIndex,
} from '../app/modal-state.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');

const modalSrc = readFileSync(join(APP, 'modal.js'), 'utf8');
const buttonSrc = readFileSync(join(APP, 'button.js'), 'utf8');
const confirmSrc = readFileSync(join(APP, 'confirm-dialog.js'), 'utf8');
const appSrc = readFileSync(join(APP, 'app.js'), 'utf8');

// ---- 1. pure dismiss-key predicate ----
test('only Escape dismisses the modal', () => {
  assert.equal(isDismissKey('Escape'), true);
  assert.equal(isDismissKey('Enter'), false);
  assert.equal(isDismissKey('Tab'), false);
  assert.equal(isDismissKey('a'), false);
});

// ---- 2. focus-trap wrap math ----
test('only Tab participates in the focus trap', () => {
  assert.equal(isTrapKey('Tab'), true);
  assert.equal(isTrapKey('Escape'), false);
  assert.equal(isTrapKey('Enter'), false);
  assert.equal(isTrapKey(' '), false);
});

test('Tab steps forward and wraps past the last focusable back to the first', () => {
  // 3 focusables, indices 0,1,2; forward (shift=false)
  assert.equal(nextTrapFocusIndex(3, 0, false), 1, 'step forward');
  assert.equal(nextTrapFocusIndex(3, 1, false), 2, 'step forward');
  assert.equal(nextTrapFocusIndex(3, 2, false), 0, 'wrap past last → first (the trap)');
});

test('Shift-Tab steps backward and wraps before the first back to the last', () => {
  assert.equal(nextTrapFocusIndex(3, 2, true), 1, 'step back');
  assert.equal(nextTrapFocusIndex(3, 1, true), 0, 'step back');
  assert.equal(nextTrapFocusIndex(3, 0, true), 2, 'wrap before first → last (the trap)');
});

test('an unknown active index (focus outside the panel) is pulled to an edge', () => {
  // activeIndex === -1 means focus is not on a known focusable: Tab → first,
  // Shift-Tab → last, so the trap always lands focus back inside the panel.
  assert.equal(nextTrapFocusIndex(3, -1, false), 0, 'Tab from outside → first');
  assert.equal(nextTrapFocusIndex(3, -1, true), 2, 'Shift-Tab from outside → last');
});

test('a single focusable always cycles to itself (trap of one)', () => {
  assert.equal(nextTrapFocusIndex(1, 0, false), 0);
  assert.equal(nextTrapFocusIndex(1, 0, true), 0);
});

test('an empty panel reports no focus target', () => {
  assert.equal(nextTrapFocusIndex(0, -1, false), -1, 'nothing to focus → -1');
  assert.equal(nextTrapFocusIndex(0, 0, true), -1);
});

// ---- 3. Modal source-guards: scrim, fixed/centered, z-index, reveal, dismissal ----
test('Modal is viewport-fixed and centered (not the Drawer s contained absolute overlay)', () => {
  assert.match(modalSrc, /position:\s*"fixed"/, 'Modal pins position:fixed over the whole viewport');
  assert.match(modalSrc, /justifyContent:\s*"center"/, 'the overlay centers its panel');
  assert.match(modalSrc, /alignItems:\s*"center"/, 'the overlay centers its panel');
});

test('the scrim reuses the Drawer s exact rgba(8,9,12,0.40) dim (no new --scrim token)', () => {
  assert.match(modalSrc, /rgba\(8,\s*9,\s*12,\s*0\.40\)/, 'scrim matches the Drawer dim verbatim');
});

test('Modal stacks above the Drawer (z-index greater than the Drawer s 40)', () => {
  const m = modalSrc.match(/zIndex:\s*(\d+)/);
  assert.ok(m, 'Modal sets an explicit zIndex');
  assert.ok(Number(m[1]) > 40, `Modal z-index ${m && m[1]} must exceed the Drawer's 40`);
});

test('Modal scrim-click and Esc both route to the consumer onClose', () => {
  assert.match(modalSrc, /onClick=\$\{onClose\}/, 'scrim click invokes onClose');
  assert.match(modalSrc, /isDismissKey\(/, 'Esc dismissal delegates to the pure predicate');
});

test('Modal reveal is fade + scale-up, stripped under prefers-reduced-motion', () => {
  assert.match(modalSrc, /scale\(0\.97\)/, 'panel eases from scale(0.97)');
  assert.match(modalSrc, /prefers-reduced-motion/, 'a reduced-motion query gates the transition');
  assert.match(modalSrc, /reduce\s*\?\s*"none"/, 'under reduce the transition is stripped to a hard show');
});

test('Modal traps focus: it delegates to the trap predicates and restores focus on close', () => {
  assert.match(modalSrc, /isTrapKey\(/, 'Tab handling delegates to the pure trap predicate');
  assert.match(modalSrc, /nextTrapFocusIndex\(/, 'the wrap math is delegated to the pure decision');
  assert.match(modalSrc, /activeElement/, 'the trigger is captured on open so focus can return to it');
});

// ---- 4. Button source-guards: token-composed, two variants, --obligation danger ----
test('Button is token-composed (font-ui, radius, hairline) and has neutral + destructive variants', () => {
  assert.match(buttonSrc, /var\(--font-ui\)/, 'labelled button uses the UI font');
  assert.match(buttonSrc, /destructive/, 'a destructive variant exists');
  assert.match(buttonSrc, /var\(--obligation/, 'destructive draws from the --obligation danger family');
});

test('Button destructive does NOT use the reserved selection accent (ADR-0016)', () => {
  // Scoped to the Button() function itself — button.js also exports EnterButton
  // (design-system-xr4sb), which DOES use --accent-ochre under ADR-0048's surface-2
  // "primed primary action" carve-out (it fires/commits, so ochre is permitted
  // there). That is a separate, licensed exception, not the destructive danger path
  // this guard protects.
  const buttonFn = buttonSrc.slice(
    buttonSrc.indexOf('export function Button('),
    buttonSrc.indexOf('The solid-ochre icon Enter button'),
  );
  assert.doesNotMatch(buttonFn, /--accent-ochre/, 'danger must not borrow the reserved accent');
});

// ---- 5. ConfirmDialog source-guards: composes Modal + Button, cancel/confirm seam ----
test('ConfirmDialog composes over Modal and Button', () => {
  assert.match(confirmSrc, /import\s*\{[^}]*Modal[^}]*\}\s*from\s*["']\.\/modal\.js["']/, 'consumes the Modal shell unforked');
  assert.match(confirmSrc, /import\s*\{[^}]*Button[^}]*\}\s*from\s*["']\.\/button\.js["']/, 'consumes the Button unforked');
  assert.match(confirmSrc, /<\$\{Modal\}/, 'renders inside the Modal');
  assert.match(confirmSrc, /<\$\{Button\}/, 'renders Button controls');
});

test('ConfirmDialog routes Cancel + Esc + scrim to onClose and Confirm to onConfirm', () => {
  assert.match(confirmSrc, /onConfirm/, 'a confirm callback is invoked by the Confirm control');
  assert.match(confirmSrc, /onClose/, 'cancel/scrim/Esc all route through the Modal onClose');
});

test('ConfirmDialog destructive flag renders the destructive Confirm Button', () => {
  assert.match(confirmSrc, /destructive/, 'a destructive flag exists and is forwarded to the Confirm Button');
});

// ---- 6. canvas documents the family ----
test('the styleguide canvas documents Button, Modal and ConfirmDialog (with a destructive specimen)', () => {
  assert.match(appSrc, /from\s*["']\.\/button\.js["']/, 'app.js imports the Button primitive');
  assert.match(appSrc, /from\s*["']\.\/modal\.js["']/, 'app.js imports the Modal primitive');
  assert.match(appSrc, /from\s*["']\.\/confirm-dialog\.js["']/, 'app.js imports the ConfirmDialog primitive');
  assert.match(appSrc, /<\$\{ConfirmDialog\}/, 'the canvas renders a ConfirmDialog specimen in context');
  assert.match(appSrc, /destructive/, 'a destructive ConfirmDialog specimen is shown');
});
