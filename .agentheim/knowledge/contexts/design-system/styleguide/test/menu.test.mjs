// Tests for the shared Menu / Popover primitive (design-system-015).
//
// Menu renders via htm/React with no DOM under `node --test`, so — mirroring the
// collapsible / ticket-card / doing-pulse suites — the load-bearing, framework-
// free contract is tested directly against the pure decisions the primitive
// delegates to (menu-state.js):
//   1. `isControlled(open)` — controlled when `open` is supplied (a parent owns
//      the truth), uncontrolled when omitted (the board's gear; the primitive
//      holds useState(defaultOpen)).
//   2. `isDismissKey(key)` — ONLY Escape dismisses.
//   3. `shouldDismissOnOutsideClick(open, inside)` — dismiss exactly when open
//      AND the click landed outside the menu root (an in-panel click survives).
//   4. `isOpenKey(key)` — Enter / Space open the trigger.
// Plus source-guards that the primitive owns the reveal + elevation, and that
// the board consumes it with NO duplicate popover machinery left (aw-049's
// board-local SettingsMenu deleted).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  isControlled, isDismissKey, shouldDismissOnOutsideClick, isOpenKey,
} from '../app/menu-state.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const REPO = join(HERE, '..', '..', '..', '..', '..');

const menuSrc = readFileSync(join(APP, 'menu.js'), 'utf8');
const appSrc = readFileSync(join(APP, 'app.js'), 'utf8');
const boardSrc = readFileSync(join(REPO, 'dashboard', 'app', 'board.js'), 'utf8');

test('isControlled is true only when an explicit open value is supplied', () => {
  assert.equal(isControlled(true), true);
  assert.equal(isControlled(false), true, 'open=false is still controlled — a parent owning a closed menu');
  assert.equal(isControlled(undefined), false, 'omitted open → uncontrolled (the board gear default)');
});

test('only Escape dismisses the menu', () => {
  assert.equal(isDismissKey('Escape'), true);
  assert.equal(isDismissKey('Enter'), false);
  assert.equal(isDismissKey('Tab'), false);
  assert.equal(isDismissKey('a'), false);
});

test('Enter and Space open the trigger; nothing else does', () => {
  assert.equal(isOpenKey('Enter'), true);
  assert.equal(isOpenKey(' '), true, 'Space opens');
  assert.equal(isOpenKey('Spacebar'), true, 'legacy Space key value');
  assert.equal(isOpenKey('Escape'), false);
  assert.equal(isOpenKey('x'), false);
});

test('outside-click dismisses only when open AND the click is outside the root', () => {
  assert.equal(shouldDismissOnOutsideClick(true, false), true, 'open + outside → dismiss');
  assert.equal(shouldDismissOnOutsideClick(true, true), false, 'an in-panel click (a toggle flip) must NOT dismiss');
  assert.equal(shouldDismissOnOutsideClick(false, false), false, 'a closed menu has nothing to dismiss');
});

test('Menu owns the open/close reveal — the panel render lives in one place', () => {
  // The primitive conditionally renders the floating panel it reveals, so no
  // consumer duplicates `${open && ...}`. The reveal guard must live HERE.
  assert.match(menuSrc, /isOpen\s*\?/, 'Menu must conditionally render the panel it reveals');
  assert.match(menuSrc, /role="menu"/, 'the floating panel carries the menu role');
});

test('the floating panel elevates at --shadow-md (the Popovers elevation role)', () => {
  assert.match(menuSrc, /boxShadow:\s*"var\(--shadow-md\)"/, 'the popover sits at --shadow-md');
});

test('a toggle always announces via onOpenChange and only writes internal state when uncontrolled', () => {
  assert.match(menuSrc, /onOpenChange\s*&&\s*onOpenChange\(/, 'every open/close must fire onOpenChange when provided');
  assert.match(menuSrc, /!\s*controlled|!controlled/, 'internal state writes must be gated on being uncontrolled');
});

test('dismissal is keyboard + outside-click, scoped by the root ref', () => {
  assert.match(menuSrc, /isDismissKey\(/, 'Esc dismissal delegates to the pure predicate');
  assert.match(menuSrc, /shouldDismissOnOutsideClick\(/, 'outside-click dismissal delegates to the pure predicate');
  assert.match(menuSrc, /rootRef\.current\s*&&\s*rootRef\.current\.contains/, 'an in-root click is scoped out so the popover survives in-menu interaction');
});

test('the styleguide canvas documents the Menu primitive as a pattern', () => {
  assert.match(appSrc, /import\s*\{[^}]*Menu[^}]*\}\s*from\s*["']\.\/menu\.js["']/, 'app.js imports the primitive');
  assert.match(appSrc, /<\$\{Menu\}/, 'the canvas renders the Menu specimen in context');
});

test('the board consumes the shared Menu and the board-local SettingsMenu popover machinery is deleted', () => {
  assert.match(boardSrc, /import\s*\{[^}]*Menu[^}]*\}\s*from\s*["'][^"']*\/menu\.js["']/, 'board.js imports the shared primitive across the BC boundary (unforked, ADR-0003)');
  assert.match(boardSrc, /<\$\{Menu\}/, 'the board renders the shared Menu for its settings popover');
  // No duplicate popover machinery may remain: the board must not re-implement
  // the outside-click / Esc / reveal listeners it now delegates to the primitive.
  // (The gear trigger + its aria-haspopup legitimately stay in the consumer — the
  // primitive owns the panel + dismissal, not the trigger's look/semantics.)
  assert.doesNotMatch(boardSrc, /addEventListener\("mousedown"/, 'the board no longer wires its own outside-click dismissal — the primitive owns it');
  assert.doesNotMatch(boardSrc, /requestAnimationFrame\(\(\)\s*=>\s*setShown/, 'the board no longer holds its own reveal-transition machinery — the primitive owns it');
});
