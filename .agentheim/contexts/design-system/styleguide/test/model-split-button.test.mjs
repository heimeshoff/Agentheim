// Tests for ModelSplitButton (design-system-r9dtm) — the ochre EnterButton
// widened into a labelled split button.
//
// ADR-0048 (surface 2, the prompt Enter button — FIRES/commits, so ochre is
// PERMITTED) and ADR-0051 (restates: "Enter button = ochre") license the
// filled --accent-ochre surface; the caret region is part of that SAME
// primed action (not a second neutral button beside it).
//
// button.js renders via htm/React with no DOM under a plain `node --test`
// run FROM the styleguide's own test/ (see enter-button.test.mjs /
// menu.test.mjs), so:
//   1. The load-bearing KEYBOARD/MENU decisions are factored into
//      button-state.js, framework-free, and tested directly (real unit
//      tests, mirroring menu-state.js / search-state.js) — the pure
//      resolution functions' own in/out contract.
//   2. The click-region split, the locked variant, the disabled treatment,
//      the ARIA contract, and the token usage are tested as source-reading
//      static guards against button.js and the canvas (app.js), mirroring
//      enter-button.test.mjs / menu.test.mjs.
//   3. infrastructure-d2n8s adds a jsdom DOM-render harness — but it lives in
//      dashboard/package.json (the ONE tree in the repo with a real
//      node_modules), not here. `dashboard/test/model-split-button-dom.test.mjs`
//      mounts THIS component (relative import, consumed unforked, ADR-0003)
//      and drives its menu keyboard contract with REAL DOM KeyboardEvents —
//      ArrowUp/ArrowDown roving focus, Enter-selects, Escape-dismisses,
//      focus-returns-to-caret (WCAG 2.1.2) — replacing the one regex
//      assertion that used to "prove" delegation here by string-matching
//      `arrowDirection(e.key)` etc. (which cannot distinguish "wired
//      correctly" from "wired backwards"). See that file's header for the
//      full account; every other guard in THIS file (structure, ARIA
//      attributes, tokens, the icon registry, the canvas specimens, the
//      no-hardcoded-model-name guard) is untouched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  initialHighlightIndex, nextHighlightIndex, arrowDirection,
  isSelectKey, isDismissKey, widestOptionLength,
} from '../app/button-state.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');

const buttonSrc = readFileSync(join(APP, 'button.js'), 'utf8');
const appSrc = readFileSync(join(APP, 'app.js'), 'utf8');
const iconsSrc = readFileSync(join(APP, 'icons.js'), 'utf8');
const stateSrc = readFileSync(join(APP, 'button-state.js'), 'utf8');
const thisTestSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

const modelSplitButtonFn = buttonSrc.match(/export function ModelSplitButton[\s\S]*/)[0];

// ---- Pure keyboard/menu decisions (button-state.js) ----

test('initialHighlightIndex starts on the current value, or the first option when not found', () => {
  assert.equal(initialHighlightIndex(['Alpha', 'Beta', 'Gamma'], 'Beta'), 1);
  assert.equal(initialHighlightIndex(['Alpha', 'Beta', 'Gamma'], 'Nope'), 0, 'unknown value falls back to the first option');
  assert.equal(initialHighlightIndex([], 'Alpha'), 0, 'empty options list is safe');
  assert.equal(initialHighlightIndex(undefined, 'Alpha'), 0, 'non-array options is safe');
});

test('nextHighlightIndex moves down/up and CLAMPS at the ends (no wraparound)', () => {
  assert.equal(nextHighlightIndex(0, 3, 'down'), 1);
  assert.equal(nextHighlightIndex(1, 3, 'down'), 2);
  assert.equal(nextHighlightIndex(2, 3, 'down'), 2, 'ArrowDown past the last option stays on the last');
  assert.equal(nextHighlightIndex(2, 3, 'up'), 1);
  assert.equal(nextHighlightIndex(0, 3, 'up'), 0, 'ArrowUp before the first option stays on the first');
  assert.equal(nextHighlightIndex(0, 0, 'down'), 0, 'an empty option list is safe');
});

test('arrowDirection maps ArrowDown/ArrowUp and nothing else', () => {
  assert.equal(arrowDirection('ArrowDown'), 'down');
  assert.equal(arrowDirection('ArrowUp'), 'up');
  assert.equal(arrowDirection('Enter'), null);
  assert.equal(arrowDirection('a'), null);
});

test('only Enter selects the highlighted option', () => {
  assert.equal(isSelectKey('Enter'), true);
  assert.equal(isSelectKey(' '), false);
  assert.equal(isSelectKey('Escape'), false);
});

test('only Escape dismisses the menu (and returns focus to the caret at the call site)', () => {
  assert.equal(isDismissKey('Escape'), true);
  assert.equal(isDismissKey('Enter'), false);
  assert.equal(isDismissKey('Tab'), false);
});

test('widestOptionLength finds the longest option label, for the no-reflow min-width', () => {
  assert.equal(widestOptionLength(['Nova', 'Zephyr', 'Echo', 'Iota']), 6, '"Zephyr" is the longest at 6 chars');
  assert.equal(widestOptionLength([]), 0);
  assert.equal(widestOptionLength(undefined), 0);
});

// ---- Source guards: click-region split, locked, disabled, ARIA, tokens ----

test('ModelSplitButton is exported from button.js and consumes the shared Icon unforked', () => {
  assert.match(buttonSrc, /export function ModelSplitButton/, 'button.js must export ModelSplitButton');
  assert.match(modelSplitButtonFn, /<\$\{Icon\}/, 'ModelSplitButton must render via the shared Icon component');
});

test('EnterButton is left in place, unchanged and still exported', () => {
  assert.match(buttonSrc, /export function EnterButton/, 'EnterButton must remain exported');
  assert.match(buttonSrc, /name="corner-down-left"/, 'EnterButton must still render its corner-down-left glyph');
});

test('the primary region calls onClick and the caret region never does', () => {
  // Two distinct <button> elements: the primary fires onClick directly; the
  // caret fires its own handler (onCaretClick), which must not reference the
  // onClick prop at all.
  const primaryOnClick = modelSplitButtonFn.match(/aria-label=\$\{ariaLabel\}[\s\S]*?onClick=\$\{([^}]*)\}/);
  assert.ok(primaryOnClick, 'the primary <button> must have an onClick handler');
  assert.match(primaryOnClick[1], /onClick/, 'the primary region\'s handler must call the onClick prop');

  const caretHandlerDef = modelSplitButtonFn.match(/const onCaretClick = \(\) => \{([\s\S]*?)\};/);
  assert.ok(caretHandlerDef, 'onCaretClick must be defined');
  assert.doesNotMatch(caretHandlerDef[1], /\bonClick\(/, 'the caret click handler must never call the onClick prop (never launches)');
});

test('the caret region calls onOpenMenu (via setMenuOpen) and never onClick', () => {
  assert.match(modelSplitButtonFn, /setMenuOpen\s*=\s*useCallback\(\(next\)\s*=>\s*\{\s*setOpen\(next\);\s*onOpenMenu\s*&&\s*onOpenMenu\(next\);/,
    'toggling the menu must always announce via onOpenMenu when supplied');
  assert.match(modelSplitButtonFn, /onClick=\$\{onCaretClick\}/, 'the caret <button> must wire onCaretClick, not the primary onClick');
});

test('the primary and caret regions are two separate <button>s inside one bordered group, not a click-position test on one button', () => {
  const buttonTags = modelSplitButtonFn.match(/<button/g) || [];
  assert.equal(buttonTags.length, 2, 'ModelSplitButton must render exactly two <button> elements');
});

test('locked renders NO caret region at all — absent, not merely disabled', () => {
  assert.match(modelSplitButtonFn, /\$\{!locked\s*\?\s*html`/, 'the caret region + divider must be conditionally rendered on !locked');
  // The caret <button> markup (aria-haspopup) must sit INSIDE that !locked guard.
  const lockedGuardBody = modelSplitButtonFn.match(/\$\{!locked\s*\?\s*html`([\s\S]*?)`\s*:\s*null\}/);
  assert.ok(lockedGuardBody, 'the !locked-guarded block must exist');
  assert.match(lockedGuardBody[1], /aria-haspopup="menu"/, 'the caret trigger must live inside the !locked guard');
});

test('locked leaves the primary region able to launch (onClick still wired unconditionally)', () => {
  // The primary button's onClick wiring must not be gated on `locked` at all.
  assert.doesNotMatch(modelSplitButtonFn.match(/aria-label=\$\{ariaLabel\}[\s\S]*?<\/button>/)[0], /locked/,
    'the primary region must not reference `locked` anywhere in its own markup');
});

test('the menu itself is also gated on !locked, so it is unreachable when locked', () => {
  assert.match(modelSplitButtonFn, /\$\{open\s*&&\s*!locked\s*\?\s*html`/, 'the menu panel must render only when open AND !locked');
});

test('disabled renders both regions non-interactive at 0.55 opacity, matching EnterButton', () => {
  assert.match(modelSplitButtonFn, /opacity:\s*disabled\s*\?\s*0\.55\s*:\s*1/, 'the group wrapper must dim to 0.55 opacity when disabled');
  assert.match(modelSplitButtonFn, /disabled=\$\{disabled\}[\s\S]*?disabled=\$\{disabled\}/, 'both the primary and caret <button>s must forward the real disabled attribute');
});

test('the caret carries aria-haspopup="menu" and aria-expanded', () => {
  assert.match(modelSplitButtonFn, /aria-haspopup="menu"/, 'the caret must declare aria-haspopup="menu"');
  assert.match(modelSplitButtonFn, /aria-expanded=\$\{open\}/, 'the caret must declare aria-expanded tracking the open state');
});

test('the open menu has role="menu" with menuitemradio items and aria-checked on the current one', () => {
  assert.match(modelSplitButtonFn, /role="menu"/, 'the panel must carry role="menu"');
  assert.match(modelSplitButtonFn, /role="menuitemradio"/, 'each option row must carry role="menuitemradio"');
  assert.match(modelSplitButtonFn, /aria-checked=\$\{opt\s*===\s*value\}/, 'the current option must be marked aria-checked');
});

// RETIRED (infrastructure-d2n8s): a regex assertion that `arrowDirection(e.key)`
// / `isSelectKey(e.key)` / `isDismissKey(e.key)` appear somewhere in
// button.js's source could not distinguish "wired correctly" from "wired
// backwards", nor prove a real keystroke ever reaches them. See
// dashboard/test/model-split-button-dom.test.mjs for the genuine, mounted,
// real-DOM-KeyboardEvent replacement (mutation-tested: flipping
// arrowDirection's up/down mapping in button-state.js turned two of that
// file's tests RED; reverted byte-exact — see this task's Outcome).

test('ochre draws from --accent-ochre / --accent-ochre-fg only — no new color token, no hard-coded hex', () => {
  assert.match(modelSplitButtonFn, /var\(--accent-ochre\)/, 'the group surface must fill with --accent-ochre');
  assert.match(modelSplitButtonFn, /var\(--accent-ochre-fg\)/, 'the glyph/label/caret foreground must use --accent-ochre-fg');
  assert.doesNotMatch(modelSplitButtonFn, /#[0-9a-fA-F]{3,8}\b/, 'no hard-coded hex color in ModelSplitButton');
});

test('the menu surface uses --surface- / --hairline- tokens like every other popover', () => {
  const menuPanel = modelSplitButtonFn.match(/role="menu"[\s\S]*?boxShadow:\s*"var\(--shadow-md\)"/);
  assert.ok(menuPanel, 'the menu panel style block must be present');
  assert.match(menuPanel[0], /var\(--surface-1\)/, 'the panel must sit on --surface-1');
  assert.match(menuPanel[0], /var\(--hairline\)/, 'the panel must use a --hairline border');
});

test('the caret glyph (chevron-down) is registered in the shared icon set', () => {
  assert.match(iconsSrc, /"chevron-down":/, 'chevron-down must be added to the LUCIDE registry');
  assert.match(modelSplitButtonFn, /name="chevron-down"/, 'the caret must render the chevron-down glyph');
});

test('the canvas documents ModelSplitButton with normal, locked, disabled, and menu-open specimens', () => {
  assert.match(appSrc, /import\s*\{[^}]*ModelSplitButton[^}]*\}\s*from\s*["']\.\/button\.js["']/, 'app.js must import ModelSplitButton from button.js');
  const specimenFn = appSrc.match(/function ModelSplitButtonRow\(\)[\s\S]*?\n\}/)[0];
  const renders = specimenFn.match(/<\$\{ModelSplitButton\}/g) || [];
  assert.equal(renders.length, 4, 'the canvas must render four ModelSplitButton specimens');
  assert.match(specimenFn, /locked/, 'one specimen must render the locked variant');
  assert.match(specimenFn, /disabled/, 'one specimen must render the disabled variant');
  assert.match(specimenFn, /defaultOpen/, 'one specimen must render the menu-open variant');
});

test('no Agentheim-specific model names appear anywhere in the styleguide', () => {
  const forbidden = /\b(Opus|Haiku|Sonnet|Claude|Fable)\b/;
  assert.doesNotMatch(buttonSrc, forbidden, 'button.js must not hardcode a real Agentheim model name');
  assert.doesNotMatch(appSrc, forbidden, 'app.js must not hardcode a real Agentheim model name');
  assert.doesNotMatch(stateSrc, forbidden, 'button-state.js must not hardcode a real Agentheim model name');

  // Guard the guard: scan this test file's own source too, EXCLUDING this
  // guard test's own body (which legitimately names the forbidden words —
  // both in the regex literal and in the self-verification below), so a
  // future edit can't quietly reintroduce a real model name as fixture data
  // elsewhere in the file without this test noticing.
  const guardTestStart = thisTestSrc.indexOf("test('no Agentheim-specific model names");
  assert.ok(guardTestStart >= 0, 'sanity: this guard test must be findable in its own source');
  const selfSrcExcludingGuardBody = thisTestSrc.slice(0, guardTestStart);
  assert.doesNotMatch(selfSrcExcludingGuardBody, forbidden,
    'this test file must not hardcode a real Agentheim model name outside this guard\'s own body');

  // Prove the regex is actually capable of failing on the exact violation
  // this guard exists to catch (a bare "Fable" was previously missing from
  // it and slipped through unnoticed).
  for (const name of ['Opus', 'Haiku', 'Sonnet', 'Claude', 'Fable']) {
    assert.match(name, forbidden, `the guard regex must catch "${name}"`);
  }
});
