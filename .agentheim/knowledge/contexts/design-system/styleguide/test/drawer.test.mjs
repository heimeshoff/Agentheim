// Tests for the Drawer header actions (design-system-009).
//
// The Drawer renders via htm/React with no DOM under `node --test`, so —
// mirroring the ticket-card / doing-pulse suites — the load-bearing contracts
// are tested as source-reading static guards against drawer.js:
//   1. Neither header (HeaderMinimal / HeaderContextual) renders a "Copy path"
//      button anymore — the dead Copy IconButton is gone.
//   2. The remaining action reads "Open in full screen" (title + aria-label),
//      not "Open in editor".
//   3. That action fires an optional `onOpenFullScreen` callback supplied by the
//      consumer, threaded through Drawer → both headers (ds-006 cornerAction
//      consumer-owns-behavior precedent).
//   4. When `onOpenFullScreen` is absent, the button is NOT rendered — for BOTH
//      headers (absent-slot → nothing).
//   5. The HeaderMinimal divider before Close does not dangle: it renders only
//      when an action button precedes it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const drawerSrc = readFileSync(join(APP, 'drawer.js'), 'utf8');
const appSrc = readFileSync(join(APP, 'app.js'), 'utf8');

test('neither header renders a "Copy path" button anymore', () => {
  assert.doesNotMatch(drawerSrc, /Copy path/, 'the dead Copy button must be removed from the Drawer headers');
  assert.doesNotMatch(drawerSrc, /name="copy"/, 'the copy IconButton must no longer be used in the Drawer');
});

test('the remaining action reads "Open in full screen", not "Open in editor"', () => {
  assert.doesNotMatch(drawerSrc, /Open in editor/, 'the old "Open in editor" label must be gone');
  assert.match(drawerSrc, /Open in full screen/, 'the action must be relabelled "Open in full screen"');
  // It must wear the maximize/fullscreen glyph (ds-013), not the external-link
  // square-arrow-out-up-right — "open elsewhere" is the wrong mental model.
  assert.match(drawerSrc, /name="maximize"/, 'the open action uses the maximize glyph');
  assert.doesNotMatch(drawerSrc, /name="square-arrow-out-up-right"/, 'the external-link glyph must no longer dress the open action');
});

test('the maximize glyph resolves in the icon set (no empty inner)', () => {
  const iconsSrc = readFileSync(join(APP, 'icons.js'), 'utf8');
  assert.match(iconsSrc, /"maximize":\s*'<path/, 'icons.js LUCIDE map must define a non-empty "maximize" glyph');
});

test('the "Open in full screen" button is wired to an onOpenFullScreen callback', () => {
  // The IconButton onClick must call onOpenFullScreen (bare, no-arg).
  assert.match(drawerSrc, /onClick=\$\{onOpenFullScreen\}/, 'the open action must fire onOpenFullScreen');
});

test('onOpenFullScreen is threaded through Drawer to both headers', () => {
  // Drawer accepts the prop...
  assert.match(drawerSrc, /export function Drawer\(\{[^}]*onOpenFullScreen[^}]*\}\)/s, 'Drawer must accept onOpenFullScreen');
  // ...and passes it to whichever header it renders.
  const headerPasses = drawerSrc.match(/onOpenFullScreen=\$\{onOpenFullScreen\}/g) || [];
  assert.ok(headerPasses.length >= 2, 'onOpenFullScreen must be passed to both HeaderMinimal and HeaderContextual');
  // Both headers must accept the prop.
  assert.match(drawerSrc, /export function HeaderMinimal\(\{[^}]*onOpenFullScreen[^}]*\}\)/s, 'HeaderMinimal must accept onOpenFullScreen');
  assert.match(drawerSrc, /export function HeaderContextual\(\{[^}]*onOpenFullScreen[^}]*\}\)/s, 'HeaderContextual must accept onOpenFullScreen');
});

test('the open button is conditional on onOpenFullScreen — absent callback renders nothing (both headers)', () => {
  // Mirrors the cornerAction absent-slot contract: the maximize IconButton
  // must only render when onOpenFullScreen is supplied. Each header carries one
  // guarded render line.
  const openLines = drawerSrc
    .split('\n')
    .filter((line) => /name="maximize"/.test(line));
  assert.equal(openLines.length, 2, 'exactly two open-action render lines expected (one per header)');
  for (const line of openLines) {
    assert.match(line, /onOpenFullScreen\s*&&/, 'the open action must be guarded by onOpenFullScreen &&');
  }
});

test('the HeaderMinimal divider does not dangle — it renders only when the action precedes it', () => {
  // The vertical hairline divider must be guarded by onOpenFullScreen so it does
  // not float orphaned beside Close when no action is present.
  const dividerLines = drawerSrc
    .split('\n')
    .filter((line) => /width:\s*1,\s*height:\s*18/.test(line));
  assert.equal(dividerLines.length, 1, 'the minimal-header divider should appear exactly once');
  assert.match(dividerLines[0], /onOpenFullScreen\s*&&/, 'the divider must be guarded by onOpenFullScreen so it never dangles');
});

test('the canvas demo supplies an onOpenFullScreen handler so the button is visibly rendered', () => {
  // ds-007 precedent: a visible header change must be documented on the canvas so
  // the builder can re-review the gate. The demo must pass onOpenFullScreen.
  assert.match(appSrc, /onOpenFullScreen=\$\{/, 'the canvas Drawer demo must supply an onOpenFullScreen handler');
});

// ── design-system-014: contextual header leads with the title, path demoted ──
// Same source-reading static-guard convention (no DOM under `node --test`).

test('describeItem carries title from item.title on both the doc and ticket branches', () => {
  // Slice on the branch markers (line-ending-agnostic).
  const docStart = drawerSrc.indexOf('kind: "doc"');
  const ticketStart = drawerSrc.indexOf('kind: "ticket"');
  assert.ok(docStart > -1 && ticketStart > -1, 'both describeItem branches must exist');
  const ticketBranch = drawerSrc.slice(ticketStart, docStart);
  const docBranch = drawerSrc.slice(docStart);
  assert.match(docBranch, /title:\s*item\.title/, 'the doc branch of describeItem must carry title from item.title');
  assert.match(ticketBranch, /title:\s*item\.title/, 'the ticket branch of describeItem must carry title from item.title');
});

test('HeaderContextual renders a prominent title line: UI font, larger than the path, --fg-1, heavier weight', () => {
  const header = drawerSrc.slice(
    drawerSrc.indexOf('export function HeaderContextual'),
    drawerSrc.indexOf('export function Drawer'),
  );
  // A title line referencing info.title must exist.
  assert.match(header, /info\.title/, 'HeaderContextual must render info.title');
  // The title style must use the UI font, a larger-than-11.5 size, strong fg, and a heavier weight.
  // Pull the style object that carries fontFamily: var(--font-ui) and a fontSize.
  const titleStyle = header.match(/style=\$\{\{[^}]*fontFamily:\s*"var\(--font-ui\)"[^}]*color:\s*"var\(--fg-1\)"[^}]*\}\}/s);
  assert.ok(titleStyle, 'the title line must combine var(--font-ui) with color var(--fg-1)');
  const sizeMatch = titleStyle[0].match(/fontSize:\s*(\d+(?:\.\d+)?)/);
  assert.ok(sizeMatch, 'the title line must set an explicit fontSize');
  assert.ok(Number(sizeMatch[1]) > 11.5, 'the title fontSize must be larger than the 11.5px path');
  const weightMatch = titleStyle[0].match(/fontWeight:\s*(\d+)/);
  assert.ok(weightMatch, 'the title line must set an explicit fontWeight');
  assert.ok(Number(weightMatch[1]) >= 500, 'the title fontWeight must be medium/semibold (>=500), heavier than the path');
});

test('the path is demoted to a quiet sub-line beneath the title, keeping its mono / --fg-3 treatment', () => {
  const header = drawerSrc.slice(
    drawerSrc.indexOf('export function HeaderContextual'),
    drawerSrc.indexOf('export function Drawer'),
  );
  // The path line retains the mono + 11.5 + --fg-3 quiet treatment.
  const pathLine = header.match(/style=\$\{\{[^}]*fontFamily:\s*"var\(--font-mono\)"[^}]*\}\}>\$\{info\.path\}/s);
  assert.ok(pathLine, 'info.path must still render in var(--font-mono)');
  assert.match(pathLine[0], /fontSize:\s*11\.5/, 'the path keeps its 11.5px size');
  assert.match(pathLine[0], /color:\s*"var\(--fg-3\)"/, 'the path keeps its quiet --fg-3 colour');
});

test('the contextual header falls back to the path when no title is present (no blank lead)', () => {
  const header = drawerSrc.slice(
    drawerSrc.indexOf('export function HeaderContextual'),
    drawerSrc.indexOf('export function Drawer'),
  );
  // The title rendering must be guarded / fall back so a title-less item still
  // shows the path as the lead — reference info.title with a fallback to info.path.
  assert.match(
    header,
    /info\.title\s*(\|\||\?[^:]*:|&&)[^]*info\.path|info\.title\s*\?\?\s*info\.path/,
    'the lead heading must fall back to info.path when info.title is absent',
  );
});
