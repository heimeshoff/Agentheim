// Tests for the Drawer in-place expandable-width seam (design-system-020).
//
// Two kinds of guard, same conventions as drawer.test.mjs:
//   1. A PURE, React-free controlled-vs-uncontrolled resolution
//      (`isExpandControlled`) exercised directly under `node --test` — the
//      load-bearing `expanded !== undefined ⇒ controlled` decision (ds-005
//      isControlled precedent).
//   2. Source-reading static guards against drawer.js / icons.js / app.js for
//      the contracts that can't run without a DOM (the width selection, the
//      width transition segment, the reduced-motion strip, the body-top chevron,
//      and the canvas specimen).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isExpandControlled } from '../app/drawer-state.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const drawerSrc = readFileSync(join(APP, 'drawer.js'), 'utf8');
const iconsSrc = readFileSync(join(APP, 'icons.js'), 'utf8');
const appSrc = readFileSync(join(APP, 'app.js'), 'utf8');

// ── 1. pure decision ──────────────────────────────────────────────

test('isExpandControlled: a defined expanded prop is controlled (parent owns the truth)', () => {
  assert.equal(isExpandControlled(true), true, 'expanded=true ⇒ controlled');
  assert.equal(isExpandControlled(false), true, 'expanded=false is STILL controlled — a parent owning a collapsed panel');
});

test('isExpandControlled: an omitted expanded prop is uncontrolled (primitive holds its own state)', () => {
  assert.equal(isExpandControlled(undefined), false, 'expanded omitted ⇒ uncontrolled');
});

// ── 2. signature ──────────────────────────────────────────────────

test('Drawer carries expanded, onToggleExpand and expandedWidth props', () => {
  const sig = drawerSrc.match(/export function Drawer\(\{([^}]*)\}\)/s);
  assert.ok(sig, 'Drawer destructures a props object');
  assert.match(sig[1], /\bexpanded\b/, 'Drawer must accept expanded');
  assert.match(sig[1], /\bonToggleExpand\b/, 'Drawer must accept onToggleExpand');
  assert.match(sig[1], /\bexpandedWidth\b/, 'Drawer must accept expandedWidth');
});

// ── 3. width selection ────────────────────────────────────────────

test('panel width selects by expand state — collapsed default present, expanded reads the prop, no rail literals', () => {
  assert.match(drawerSrc, /min\(560px,\s*78%\)/, 'the collapsed default width must stay in the primitive');
  // Expanded width must come from the prop, not a hard-coded rail-aware literal.
  assert.match(drawerSrc, /\?\s*expandedWidth\s*:/, 'the expanded branch must read the expandedWidth prop');
  assert.doesNotMatch(drawerSrc, /\b248\b/, 'no rail literal 248 may leak into the primitive');
  assert.doesNotMatch(drawerSrc, /calc\(100vw/, 'no hard-coded calc(100vw - …) rail math in the primitive');
});

// ── 4. width transition + reduced-motion strip ────────────────────

test('the panel transition includes a width segment alongside the existing transform segment', () => {
  // The panel style must transition both transform and width.
  assert.match(drawerSrc, /transform [^"`]*var\(--ease-base\)/, 'the transform transition segment must remain');
  assert.match(drawerSrc, /width [^"`]*var\(--ease-base\)/, 'a width transition segment must be added');
});

test('prefers-reduced-motion strips the width transition to instant (ADR-0014 motion contract)', () => {
  // The matchMedia reduced-motion read (modal/menu/search precedent) must drive
  // the width transition to none/0 under reduce.
  assert.match(drawerSrc, /prefers-reduced-motion:\s*reduce/, 'the Drawer must read prefers-reduced-motion');
  assert.match(drawerSrc, /\breduce\b/, 'a reduce flag must gate the width transition');
});

// ── 5. body-top chevron ───────────────────────────────────────────

test('a body-top chevron IconButton toggles expand, flipping label and glyph by state', () => {
  assert.match(drawerSrc, /Expand panel/, 'collapsed chevron reads "Expand panel"');
  assert.match(drawerSrc, /Collapse panel/, 'expanded chevron reads "Collapse panel"');
  assert.match(drawerSrc, /panel-right-open/, 'collapsed glyph is panel-right-open');
  assert.match(drawerSrc, /panel-right-close/, 'expanded glyph is panel-right-close');
  // The chevron toggle must call onToggleExpand.
  assert.match(drawerSrc, /onToggleExpand/, 'the chevron must announce onToggleExpand');
});

test('the chevron sits in the scrollable body ABOVE the Markdown render, not in the header', () => {
  const bodyStart = drawerSrc.indexOf('Scrollable body');
  assert.ok(bodyStart > -1, 'the scrollable body region must exist');
  const body = drawerSrc.slice(bodyStart);
  const chevronAt = body.indexOf('panel-right-open');
  const markdownAt = body.indexOf('<${Markdown}');
  assert.ok(chevronAt > -1, 'the chevron must render within the scrollable body');
  assert.ok(markdownAt > -1, 'the Markdown render must be in the body');
  assert.ok(chevronAt < markdownAt, 'the chevron must render ABOVE the Markdown body');
  // The header must NOT carry the expand chevron — only the body does.
  const headerEnd = drawerSrc.indexOf('export function Drawer');
  const headers = drawerSrc.slice(0, headerEnd);
  assert.doesNotMatch(headers, /panel-right-open|panel-right-close/, 'the expand chevron must not live in the headers');
});

// ── 6. glyphs ─────────────────────────────────────────────────────

test('icons.js LUCIDE map defines non-empty panel-right-open and panel-right-close glyphs', () => {
  assert.match(iconsSrc, /"panel-right-open":\s*'<rect/, 'panel-right-open must be a non-empty Lucide glyph');
  assert.match(iconsSrc, /"panel-right-close":\s*'<rect/, 'panel-right-close must be a non-empty Lucide glyph');
});

// ── 7. onOpenFullScreen untouched ─────────────────────────────────

test('the existing onOpenFullScreen maximize thread is untouched (both headers, guarded)', () => {
  const openLines = drawerSrc.split('\n').filter((l) => /name="maximize"/.test(l));
  assert.equal(openLines.length, 2, 'both header maximize render lines must remain');
  for (const line of openLines) {
    assert.match(line, /onOpenFullScreen\s*&&/, 'maximize stays guarded by onOpenFullScreen &&');
  }
});

// ── 8. canvas specimen ────────────────────────────────────────────

test('the canvas Drawer section demonstrates an expanded-driven specimen for the gate', () => {
  assert.match(appSrc, /expandedWidth=/, 'the canvas must supply an expandedWidth so the expand state is visible');
  assert.match(appSrc, /onToggleExpand=\$\{|expanded=\$\{/, 'the canvas must drive the expand seam');
});
