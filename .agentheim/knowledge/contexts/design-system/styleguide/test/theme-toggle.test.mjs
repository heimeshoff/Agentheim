// Tests for the dedicated ThemeToggle control (design-system-007, ADR-0016).
//
// The old Dark/Light control reused the generic `Segmented`, which fills the
// SELECTED option with --surface-inverse — a token that FLIPS under [data-theme].
// In dark mode that made the selected "Dark" button bright and "Light" dark, the
// opposite of the labels. The fix is a dedicated `ThemeToggle` whose two buttons
// each PREVIEW their own theme via FIXED swatch tokens, with selection shown by
// de-emphasis (dimming the unselected), never by the reserved accent.
//
// Views render via htm/React with no DOM under `node --test`, so — mirroring the
// ticket-card / doing-pulse suites — the load-bearing contracts are asserted as
// source-guards against the styleguide source + token CSS:
//   1. the FIXED swatch tokens exist in :root and are NOT redefined under dark;
//   2. ThemeToggle's Dark button uses --swatch-dark, Light button --swatch-light
//      (so the swatch does not flip with data-theme), with the fixed on-swatch fg;
//   3. selection is by de-emphasis (opacity) and uses NO accent/ochre hue;
//   4. the generic `Segmented` source is untouched (its --surface-inverse fill
//      remains — the card-variant / drawer-header / Board↔Library switchers stay).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const STYLES = join(HERE, '..', 'styles');
const liveSrc = readFileSync(join(APP, 'live.js'), 'utf8');
const appSrc = readFileSync(join(APP, 'app.js'), 'utf8');
const colorsCss = readFileSync(join(STYLES, 'colors_and_type.css'), 'utf8');

// The :root block (everything before the dark override) vs the dark block.
// Split on the actual dark-mode SELECTOR (`.dark, [data-theme="dark"]`), not a
// stray ".dark" mention in a comment.
const darkSel = colorsCss.search(/^\.dark,\s*\[data-theme="dark"\]/m);
const rootBlock = colorsCss.slice(0, darkSel);
const darkBlock = colorsCss.slice(darkSel);

// Extract a top-level function's source, with // line-comments stripped — the
// "must NOT use X" guards check actual style usage, not the explanatory prose
// (which deliberately names what is reserved / not used).
function fnBody(src, name) {
  const start = src.indexOf(`export function ${name}`);
  const end = src.indexOf('export function', start + 1);
  return src
    .slice(start, end === -1 ? undefined : end)
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

test('the fixed swatch tokens exist in :root with the locked values (re-pinned to the Command-deck --surface-0 values, ADR-0049)', () => {
  assert.match(rootBlock, /--swatch-light:\s*#FAF8F4/i, '--swatch-light must be #FAF8F4 in :root (unchanged light --surface-0 anchor)');
  assert.match(rootBlock, /--swatch-dark:\s*#090C12/i, '--swatch-dark must be #090C12 in :root (re-pinned to the new dark --surface-0)');
});

test('the swatch tokens are NOT redefined under .dark / [data-theme="dark"]', () => {
  // The whole point: the preview swatches must not flip with the theme.
  assert.doesNotMatch(darkBlock, /--swatch-light\s*:/, '--swatch-light must not flip under dark');
  assert.doesNotMatch(darkBlock, /--swatch-dark\s*:/, '--swatch-dark must not flip under dark');
});

test('fixed on-swatch foreground tokens exist (dark swatch -> light fg, light swatch -> dark fg)', () => {
  assert.match(rootBlock, /--swatch-light-fg\s*:/, 'a fixed fg for the light swatch must exist');
  assert.match(rootBlock, /--swatch-dark-fg\s*:/, 'a fixed fg for the dark swatch must exist');
  assert.doesNotMatch(darkBlock, /--swatch-light-fg\s*:/, 'on-swatch fg must not flip under dark');
  assert.doesNotMatch(darkBlock, /--swatch-dark-fg\s*:/, 'on-swatch fg must not flip under dark');
});

test('a dedicated ThemeToggle component is exported from live.js', () => {
  assert.match(liveSrc, /export function ThemeToggle\b/, 'ThemeToggle must be a dedicated exported component');
});

test('ThemeToggle swatches each button with the FIXED swatch tokens (does not flip)', () => {
  const body = fnBody(liveSrc, 'ThemeToggle');
  // each button previews its own theme via the frozen tokens
  assert.match(body, /var\(--swatch-dark\)/, 'the Dark button must use the fixed --swatch-dark background');
  assert.match(body, /var\(--swatch-light\)/, 'the Light button must use the fixed --swatch-light background');
  // and uses the fixed on-swatch foregrounds, not the theming --fg-* tokens
  assert.match(body, /var\(--swatch-dark-fg\)/, 'the Dark button must use the fixed --swatch-dark-fg');
  assert.match(body, /var\(--swatch-light-fg\)/, 'the Light button must use the fixed --swatch-light-fg');
  // the swatch backgrounds must NOT be the flipping surface tokens
  assert.doesNotMatch(body, /--surface-inverse/, 'ThemeToggle must not use the flipping --surface-inverse');
});

test('ThemeToggle signals selection by de-emphasis (opacity), never the reserved accent', () => {
  const body = fnBody(liveSrc, 'ThemeToggle');
  assert.match(body, /opacity/, 'selection must be signalled by de-emphasis (opacity)');
  // accent-reservation: no ochre / accent / ring cue for the selected state
  assert.doesNotMatch(body, /accent|ochre|focus-ring/, 'the selected cue must not use the reserved accent / ochre / ring');
});

test('the generic Segmented control is left UNCHANGED (its inverse-fill selection remains)', () => {
  // Regression guard: the card-variant, drawer-header, and Board<->Library
  // switchers still ride Segmented; its selected option must still fill with the
  // flipping --surface-inverse. Touching it would break those untouched switchers.
  assert.match(liveSrc, /export function Segmented\b/, 'Segmented must remain exported');
  // Bound the body to Segmented's own closing brace (its first top-level `\n}`), so
  // the following component's source is not pulled in by the guard.
  const start = liveSrc.indexOf('export function Segmented');
  const close = liveSrc.indexOf('\n}', start);
  const body = liveSrc.slice(start, close === -1 ? undefined : close + 2);
  assert.match(body, /var\(--surface-inverse\)/, 'Segmented must keep its --surface-inverse selected fill');
  assert.doesNotMatch(body, /--swatch-/, 'Segmented must not gain swatch tokens — it is the generic control');
});

test('the styleguide TopBar uses ThemeToggle (not Segmented) for the theme control', () => {
  // The theme control swapped to ThemeToggle; the only Segmented usages left in
  // app.js are the card-variant and drawer-header switchers (section 05).
  assert.match(appSrc, /<\$\{ThemeToggle\}/, 'app.js TopBar must render ThemeToggle');
  assert.match(appSrc, /import\s*\{[^}]*\bThemeToggle\b[^}]*\}\s*from\s*["']\.\/live\.js["']/, 'app.js must import ThemeToggle from live.js');
});

// --emphasis-border (ADR-0048, wired by design-system-a31e0's Command-deck
// retokenization). The accent-carve-out border token named/intent-only in
// ADR-0048 — a softened-alpha ochre-derived border, distinct from a direct
// --accent-ochre reuse, added to agentheim.css (not colors_and_type.css).
const agentheimCss = readFileSync(join(STYLES, 'agentheim.css'), 'utf8');
const agentheimDarkSel = agentheimCss.search(/^\.dark,\s*\[data-theme="dark"\]/m);
const agentheimRootBlock = agentheimCss.slice(0, agentheimDarkSel);
const agentheimDarkBlock = agentheimCss.slice(agentheimDarkSel);

test('the --emphasis-border token exists in both theme blocks of agentheim.css (ADR-0048)', () => {
  assert.match(agentheimRootBlock, /--emphasis-border\s*:/, '--emphasis-border must be defined in the light :root block');
  assert.match(agentheimDarkBlock, /--emphasis-border\s*:/, '--emphasis-border must be defined in the dark block');
  // It is a border-suited softened alpha, not a direct reuse of --accent-ochre.
  assert.doesNotMatch(agentheimRootBlock.match(/--emphasis-border\s*:[^;]+/)[0], /^--emphasis-border\s*:\s*var\(--accent-ochre\)\s*$/, 'must not be a bare alias of --accent-ochre');
});
