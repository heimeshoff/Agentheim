// Tests for the solid-ochre icon Enter-button variant (design-system-xr4sb).
//
// ADR-0048 (surface 2, the prompt Enter button — FIRES/commits, so ochre is
// PERMITTED as a primed-primary-action carve-out) and ADR-0051 ("Enter button
// = ochre; already licensed by ADR-0048 surface 2") license a filled
// --accent-ochre background here. This is a NEW icon-square variant, distinct
// from the existing neutral/destructive text `Button` (button.js) and from
// the ghost `IconButton` (drawer.js, transparent/hover-only, no fill).
//
// button.js renders via htm/React with no DOM under `node --test`, so —
// mirroring modal.test.mjs's Button source-guards — the load-bearing
// contract is tested as source-reading static guards against button.js and
// the canvas (app.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const STYLES = join(HERE, '..', 'styles');

const buttonSrc = readFileSync(join(APP, 'button.js'), 'utf8');
const appSrc = readFileSync(join(APP, 'app.js'), 'utf8');
const tokenSrc = readFileSync(join(STYLES, 'colors_and_type.css'), 'utf8');

test('EnterButton is exported from button.js and consumes the shared Icon unforked', () => {
  assert.match(buttonSrc, /export function EnterButton/, 'button.js must export an EnterButton component');
  assert.match(buttonSrc, /import\s*\{[^}]*Icon[^}]*\}\s*from\s*["']\.\/icons\.js["']/, 'EnterButton must consume the shared Icon component unforked');
});

test('EnterButton renders the corner-down-left glyph on a filled --accent-ochre background', () => {
  const fn = buttonSrc.match(/export function EnterButton[\s\S]*?\n\}/);
  assert.ok(fn, 'EnterButton function body must be present');
  const body = fn[0];
  assert.match(body, /name=["']corner-down-left["']/, 'EnterButton must render the corner-down-left ("↵") glyph');
  assert.match(body, /background:\s*["']var\(--accent-ochre\)["']/, 'EnterButton must fill with --accent-ochre directly (a fill, per ADR-0048)');
});

test('EnterButton is a compact ~square footprint at radius-sm, distinct from the soft text Button', () => {
  const fn = buttonSrc.match(/export function EnterButton[\s\S]*?\n\}/)[0];
  assert.match(fn, /borderRadius:\s*["']var\(--radius-sm\)["']/, 'EnterButton corners must use --radius-sm');
  // Equal width/height keeps the footprint square, distinct from the padded
  // text Button (which has no fixed width/height and radius-sm padding-driven shape).
  const width = fn.match(/width:\s*(\w+)/);
  const height = fn.match(/height:\s*(\w+)/);
  assert.ok(width && height, 'EnterButton must set explicit width and height');
  assert.equal(width[1], height[1], 'EnterButton width and height must match (square footprint)');
});

test('EnterButton glyph foreground draws from the dedicated --accent-ochre-fg token, not a generic surface token', () => {
  const fn = buttonSrc.match(/export function EnterButton[\s\S]*?\n\}/)[0];
  assert.match(fn, /--accent-ochre-fg/, 'EnterButton must use the dedicated on-accent-ochre foreground token');
  assert.doesNotMatch(fn, /var\(--fg-1\)|var\(--surface-0\)/, 'EnterButton must NOT reuse a generic theming surface/foreground token for the glyph color (inverted contrast vs. --fg-1 in dark theme)');
});

test('--accent-ochre-fg is a dedicated fixed pair distinct per theme (inverted relative to --fg-1)', () => {
  const rootBlock = tokenSrc.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
  const darkBlock = tokenSrc.match(/\.dark,\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(rootBlock, /--accent-ochre-fg:\s*#[0-9a-fA-F]{6}/, ':root must define --accent-ochre-fg (light-theme value, for the darker light-theme ochre)');
  assert.match(darkBlock, /--accent-ochre-fg:\s*#[0-9a-fA-F]{6}/, '[data-theme="dark"] must define --accent-ochre-fg (dark-theme value, for the lighter dark-theme ochre)');
  const lightVal = rootBlock.match(/--accent-ochre-fg:\s*(#[0-9a-fA-F]{6})/)[1];
  const darkVal = darkBlock.match(/--accent-ochre-fg:\s*(#[0-9a-fA-F]{6})/)[1];
  assert.notEqual(lightVal, darkVal, '--accent-ochre-fg must actually differ between themes (contrast tracks the flipped ochre lightness)');
});

test('the styleguide canvas documents the EnterButton as its own specimen', () => {
  assert.match(appSrc, /import\s*\{[^}]*EnterButton[^}]*\}\s*from\s*["']\.\/button\.js["']/, 'app.js must import EnterButton from button.js');
  assert.match(appSrc, /<\$\{EnterButton\}/, 'the canvas must render an EnterButton specimen in context');
});

// design-system-tfhn6: EnterButton gains a disabled state.
//
// ADR-0016's color doctrine calls for de-emphasis by opacity, never a fill
// swap: the disabled branch must NOT touch the --accent-ochre fill or the
// --accent-ochre-fg glyph color (the five assertions above stay green
// unmodified — that IS the proof the fill was not swapped). Instead the
// disabled branch dims via `opacity` and swaps `cursor` to "default", while
// the real `disabled` attribute reaches the underlying <button> so the
// control leaves the tab order and cannot be activated by click or keyboard
// (ADR-0003: same primitive, no fork, no variant).

test('EnterButton accepts a disabled prop defaulting to false', () => {
  const sig = buttonSrc.match(/export function EnterButton\(\{([^}]*)\}\)/);
  assert.ok(sig, 'EnterButton must have a destructured props signature');
  assert.match(sig[1], /disabled\s*=\s*false/, 'EnterButton must declare `disabled = false` in its props');
});

test('EnterButton forwards disabled to the underlying <button> as the real disabled attribute', () => {
  const fn = buttonSrc.match(/export function EnterButton[\s\S]*?\n\}/)[0];
  assert.match(fn, /<button[\s\S]*?disabled=\$\{disabled\}/, 'the <button> element must receive disabled=${disabled}');
});

test('EnterButton disabled branch dims via opacity below 1 and sets cursor to default, without touching the ochre fill/glyph', () => {
  const fn = buttonSrc.match(/export function EnterButton[\s\S]*?\n\}/)[0];
  assert.match(fn, /opacity:\s*disabled\s*\?\s*0\.55\s*:\s*1/, 'opacity must be conditional on disabled: 0.55 when disabled, 1 when enabled');
  assert.match(fn, /cursor:\s*disabled\s*\?\s*["']default["']\s*:\s*["']pointer["']/, 'cursor must be conditional on disabled: "default" when disabled, "pointer" when enabled');
  // The fill and glyph guards above (literal --accent-ochre / --accent-ochre-fg
  // matches) already prove these are untouched by the disabled branch — a
  // conditional there would break those literal-string assertions.
});

test('the canvas documents a second, disabled EnterButton specimen beside the enabled one', () => {
  const matches = appSrc.match(/<\$\{EnterButton\}[^/]*\/>/g) || [];
  assert.equal(matches.length, 2, 'the canvas must render exactly two EnterButton specimens (enabled + disabled)');
  assert.ok(matches.some((m) => !/disabled/.test(m)), 'one specimen must be the enabled EnterButton');
  assert.ok(matches.some((m) => /disabled/.test(m)), 'one specimen must render the disabled EnterButton');
});
