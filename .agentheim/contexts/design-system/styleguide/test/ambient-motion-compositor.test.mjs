// Compositor-only lint for the ambient-motion contract's third clause
// (design-system-pk4qd, ADR-0014 amendment).
//
// The contract: a `@keyframes` block driven by an `infinite` animation may
// declare ONLY `opacity` / `transform` (and the transform-family longhands
// `translate` / `rotate` / `scale`) inside its step bodies. Any paint
// property that is part of the look (`box-shadow`, `filter`, `border`,
// `background`, ...) must be a STATIC declaration outside the keyframes,
// painted once — animating it every frame forces a main-thread repaint for
// the life of the tab. `ambient-rail-pulse` and `rail-attention-breathe`
// violated this before design-system-pk4qd fixed them; `rel-ring-breathe`,
// `rel-present-breathe` and `rel-edge-blink-breathe` were compliant from the
// start and are the pattern.
//
// This is an ALLOWLIST, not a denylist — a denylist would miss the next
// paint property someone reaches for. The predicate below is pure and
// exported so it is unit-tested against synthetic fixtures (a compliant
// block must pass; a `box-shadow` / `filter` / `width` block must fail),
// proving the check is able to trip, not merely observed to be green today.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES_DIR = join(HERE, '..', 'styles');

/** Properties an `infinite`-driven `@keyframes` block may declare. Allowlist,
 *  not denylist, per design-system-pk4qd: the next paint property someone
 *  reaches for (box-shadow, filter, border, background, width, ...) must
 *  fail by default, not by enumeration. */
export const COMPOSITOR_SAFE_PROPERTIES = ['opacity', 'transform', 'translate', 'rotate', 'scale'];

/**
 * Extract every `@keyframes <name> { ... }` block from a CSS source via
 * brace-depth matching (robust to any step-selector/declaration layout,
 * single- or multi-line). Pure.
 *
 * @param {string} css
 * @returns {{name:string, body:string}[]}
 */
export function extractKeyframesBlocks(css) {
  const blocks = [];
  const openRe = /@keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = openRe.exec(css))) {
    const name = m[1];
    const bodyStart = openRe.lastIndex;
    let depth = 1;
    let i = bodyStart;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    blocks.push({ name, body: css.slice(bodyStart, i - 1) });
    openRe.lastIndex = i;
  }
  return blocks;
}

/**
 * The set of CSS property names declared anywhere inside a `@keyframes`
 * block's body (across all its step selectors). Pure.
 *
 * @param {string} body  A keyframes block's body, as returned by
 *   `extractKeyframesBlocks`.
 * @returns {string[]}
 */
export function propertiesInKeyframesBody(body) {
  const props = new Set();
  const declRe = /([a-zA-Z-]+)\s*:/g;
  let m;
  while ((m = declRe.exec(body))) {
    props.add(m[1]);
  }
  return [...props];
}

/**
 * Every `@keyframes` name referenced by a rule whose `animation` shorthand,
 * or whose `animation-iteration-count`, contains `infinite`. One entry per
 * referencing declaration (a name may repeat if reused by multiple rules).
 * Pure.
 *
 * @param {string} css
 * @returns {string[]}
 */
export function findInfiniteAnimationNames(css) {
  const names = [];

  // The `animation` shorthand: `animation: <name> <duration> <easing> infinite;`
  const shorthandRe = /animation\s*:\s*([^;]+);/g;
  let m;
  while ((m = shorthandRe.exec(css))) {
    const decl = m[1];
    if (!/\binfinite\b/.test(decl)) continue;
    const nameMatch = decl.trim().match(/^([A-Za-z_-][\w-]*)/);
    if (nameMatch && nameMatch[1] !== 'none') names.push(nameMatch[1]);
  }

  // The longhand pair: `animation-iteration-count: infinite;` with a sibling
  // `animation-name: <name>;` somewhere in the same rule. Not used anywhere
  // in this stylesheet today (every cue uses the shorthand above), but the
  // acceptance criteria names this form explicitly, so it is honoured here.
  const iterRe = /animation-iteration-count\s*:\s*infinite\s*;/g;
  while ((m = iterRe.exec(css))) {
    const context = css.slice(Math.max(0, m.index - 300), m.index);
    const nameMatch = [...context.matchAll(/animation-name\s*:\s*([\w-]+)\s*;/g)].pop();
    if (nameMatch) names.push(nameMatch[1]);
  }

  return names;
}

/**
 * The compositor-only predicate. Resolves every `@keyframes` name referenced
 * by an `infinite` animation and checks its declared properties against the
 * allowlist. Pure — a CSS string in, a plain result object out.
 *
 * @param {string} css
 * @returns {{
 *   infiniteAnimationCount: number,
 *   referencedNames: string[],
 *   unresolvedNames: string[],
 *   violations: {keyframesName:string, property:string}[],
 * }}
 */
export function checkCompositorOnly(css) {
  const keyframesByName = new Map(extractKeyframesBlocks(css).map((b) => [b.name, b]));
  const referencedNames = findInfiniteAnimationNames(css);
  const unresolvedNames = [...new Set(referencedNames.filter((n) => !keyframesByName.has(n)))];

  const violations = [];
  const checked = new Set();
  for (const name of referencedNames) {
    if (checked.has(name)) continue;
    checked.add(name);
    const block = keyframesByName.get(name);
    if (!block) continue; // reported via unresolvedNames instead
    for (const prop of propertiesInKeyframesBody(block.body)) {
      if (!COMPOSITOR_SAFE_PROPERTIES.includes(prop)) {
        violations.push({ keyframesName: name, property: prop });
      }
    }
  }

  return {
    infiniteAnimationCount: referencedNames.length,
    referencedNames,
    unresolvedNames,
    violations,
  };
}

// ----------------------------------------------------------------------
// Unit tests against synthetic fixtures — proves the predicate can trip.
// ----------------------------------------------------------------------

test('checkCompositorOnly passes a compliant opacity-only infinite keyframes block', () => {
  const css = `
    @keyframes glow-breathe { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
    .glow { animation: glow-breathe 2s ease infinite; }
  `;
  const result = checkCompositorOnly(css);
  assert.equal(result.infiniteAnimationCount, 1);
  assert.deepEqual(result.unresolvedNames, []);
  assert.deepEqual(result.violations, []);
});

test('checkCompositorOnly passes a compliant transform-only infinite keyframes block', () => {
  const css = `
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .spinner { animation: spin 1s linear infinite; }
  `;
  const result = checkCompositorOnly(css);
  assert.deepEqual(result.violations, []);
});

test('checkCompositorOnly fails a keyframes block declaring box-shadow', () => {
  const css = `
    @keyframes bad-glow { 0%, 100% { opacity: 0.5; box-shadow: 0 0 5px red; } 50% { opacity: 1; } }
    .bad { animation: bad-glow 2s ease infinite; }
  `;
  const result = checkCompositorOnly(css);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].keyframesName, 'bad-glow');
  assert.equal(result.violations[0].property, 'box-shadow');
});

test('checkCompositorOnly fails a keyframes block declaring filter', () => {
  const css = `
    @keyframes bad-blur { 0% { filter: blur(0px); } 100% { filter: blur(4px); } }
    .bad { animation: bad-blur 2s ease infinite; }
  `;
  const result = checkCompositorOnly(css);
  assert.deepEqual(
    result.violations.map((v) => v.property),
    ['filter'],
  );
});

test('checkCompositorOnly fails a keyframes block declaring width', () => {
  const css = `
    @keyframes bad-grow { 0% { width: 10px; } 100% { width: 40px; } }
    .bad { animation: bad-grow 2s ease infinite; }
  `;
  const result = checkCompositorOnly(css);
  assert.deepEqual(
    result.violations.map((v) => v.property),
    ['width'],
  );
});

test('checkCompositorOnly ignores non-infinite (one-shot) animations', () => {
  const css = `
    @keyframes enter { from { opacity: 0; box-shadow: 0 0 5px red; } to { opacity: 1; } }
    .entrance { animation: enter 300ms ease-out; }
  `;
  const result = checkCompositorOnly(css);
  assert.equal(result.infiniteAnimationCount, 0);
  assert.deepEqual(result.violations, []);
});

test('checkCompositorOnly reports a referenced keyframes name that does not resolve', () => {
  const css = `.ghost { animation: nowhere-to-be-found 2s ease infinite; }`;
  const result = checkCompositorOnly(css);
  assert.equal(result.infiniteAnimationCount, 1);
  assert.deepEqual(result.unresolvedNames, ['nowhere-to-be-found']);
});

test('checkCompositorOnly resolves the animation-iteration-count longhand form', () => {
  const css = `
    @keyframes long-glow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
    .long { animation-name: long-glow; animation-duration: 2s; animation-iteration-count: infinite; }
  `;
  const result = checkCompositorOnly(css);
  assert.equal(result.infiniteAnimationCount, 1);
  assert.deepEqual(result.referencedNames, ['long-glow']);
  assert.deepEqual(result.violations, []);
});

// ----------------------------------------------------------------------
// Live-tree enforcement — every `.css` under styleguide/styles/.
// ----------------------------------------------------------------------

function liveTreeCss() {
  return readdirSync(STYLES_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.css'))
    .map((e) => readFileSync(join(STYLES_DIR, e.name), 'utf8'))
    .join('\n');
}

test('the lint cannot pass structurally green: the live tree has at least one infinite animation', () => {
  const result = checkCompositorOnly(liveTreeCss());
  assert.ok(result.infiniteAnimationCount > 0, 'expected at least one infinite animation in styles/*.css — a check that always finds zero is not proving anything');
});

test('every infinite animation in the live tree resolves to a defined @keyframes block', () => {
  const result = checkCompositorOnly(liveTreeCss());
  assert.deepEqual(result.unresolvedNames, [], `unresolved @keyframes name(s) referenced by an infinite animation: ${result.unresolvedNames.join(', ')} — a rename must not silently escape this check`);
});

test('no infinite keyframes block in the live tree declares a non-compositable property', () => {
  const result = checkCompositorOnly(liveTreeCss());
  assert.deepEqual(
    result.violations,
    [],
    `compositor-only violation(s): ${result.violations.map((v) => `${v.keyframesName} declares ${v.property}`).join('; ')}`,
  );
});

test('the live tree currently carries six infinite animations (design-system-pk4qd)', () => {
  // Documents the current count so a future addition/removal is a visible,
  // deliberate edit to this test rather than a silent drift. Pre-fix there
  // were five ambient keyframes total (ambient-rail-pulse, rail-attention-
  // breathe, rel-ring-breathe, rel-present-breathe, rel-edge-blink-breathe);
  // this task's own fix ADDS a sixth — the doing-pulse's pre-painted glow
  // layer (`ambient-rail-glow`, on `.ticket-rail--pulse::after`) is a
  // SEPARATE infinite animation from the rail's own `ambient-rail-pulse`, by
  // design (see the task's "What" section) — the attention dot's fix adds no
  // new rule/animation (its halo became a static declaration instead).
  const result = checkCompositorOnly(liveTreeCss());
  assert.equal(result.infiniteAnimationCount, 6);
});
