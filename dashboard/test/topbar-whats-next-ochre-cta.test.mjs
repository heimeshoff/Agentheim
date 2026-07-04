// Static guards for the topbar What's-next OCHRE CTA recolor (agentic-workflow-vk6mc).
//
// ADR-0048 (the accent carve-out, refining ADR-0016) permits ochre on a "primed
// primary action" — a surface that FIRES/commits, as opposed to a passive
// equivalent-state selection. The What's-next launch fires the whats-next skill
// (aw-069), so it qualifies: it is recolored to a dedicated `cta` LaunchButton
// emphasis — --accent-ochre text on an --accent-ochre-soft fill with an
// --accent-ochre border, all named tokens (never a raw hex). Work is UNTOUCHED
// (still its `primary` emphasis, no ochre).
//
// Three adjacent brief items were already true before this task and only need
// explicit regression protection here: the global search stays the topbar's
// leftmost element (1a); the settings gear sits immediately left of What's-next,
// which sits immediately left of Work; and the skip-permissions-armed icon still
// renders --obligation red regardless of the new ochre idle fill (aw-041).
//
// The board has no DOM render harness in this project; the established idiom
// (aw-016/020/.../068) is source-reading static guards over board.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

function fn(name) {
  const m = boardSrc.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}`));
  assert.ok(m, `${name} must exist in board.js`);
  return m[0];
}

test('LaunchButton defines a `cta` emphasis rendering from named --accent-ochre tokens (no hardcoded hex)', () => {
  const lb = fn('LaunchButton');
  assert.match(lb, /const cta = emphasis === "cta"/, 'LaunchButton must recognise a `cta` emphasis');
  assert.match(lb, /cta \? "var\(--accent-ochre\)"/, 'the cta idle text color must come from --accent-ochre');
  assert.match(lb, /cta \? "var\(--accent-ochre-soft\)"/, 'the cta idle fill must come from --accent-ochre-soft');
  assert.match(lb, /cta \? "1px solid var\(--accent-ochre\)"/, 'the cta idle border must come from --accent-ochre');
  // No hardcoded hex anywhere in the component.
  assert.doesNotMatch(lb, /#[0-9a-fA-F]{3,8}\b/, 'LaunchButton must render entirely from palette tokens, no hex literals');
});

test('the What\'s-next launch carries the ochre `cta` emphasis; Work is untouched', () => {
  const topbar = fn('BoardTopbar');
  const nextStart = topbar.indexOf('label="What\'s next"');
  const nextBlock = topbar.slice(nextStart, topbar.indexOf('/>', nextStart) + 2);
  assert.match(nextBlock, /emphasis="cta"/, 'What\'s next must use the ochre cta emphasis');

  const workStart = topbar.indexOf('label="Work"');
  const workBlock = topbar.slice(workStart, topbar.indexOf('/>', workStart) + 2);
  assert.match(workBlock, /emphasis="primary"/, 'Work must keep its existing primary emphasis, untouched');
  assert.doesNotMatch(workBlock, /emphasis="cta"/, 'Work must NOT pick up the ochre cta treatment');
  assert.doesNotMatch(workBlock, /ochre/i, 'Work must not reference ochre at all');
});

test('regression: the global search field stays the topbar\'s leftmost element (1a)', () => {
  const topbar = fn('BoardTopbar');
  const iSearch = topbar.indexOf('TopbarSearch');
  const iGear = topbar.indexOf('SettingsMenu');
  const iNext = topbar.indexOf('label="What\'s next"');
  const iWork = topbar.indexOf('label="Work"');
  assert.ok(iSearch >= 0, 'the search field must be present');
  assert.ok(iSearch < iGear && iSearch < iNext && iSearch < iWork,
    'the search field must render before the gear, What\'s next, and Work — leftmost (1a)');
});

test('regression: ordering holds — gear, then What\'s next, then Work, with nothing else between', () => {
  const topbar = fn('BoardTopbar');
  const iGear = topbar.indexOf('SettingsMenu');
  const iNext = topbar.indexOf('label="What\'s next"');
  const iWork = topbar.indexOf('label="Work"');
  assert.ok(iGear < iNext && iNext < iWork,
    'order must read left → right: gear, What\'s next, Work');
  // The right-hand group renders exactly these three controls — no fourth
  // element sneaks between the gear and What's next, or between What's next
  // and Work.
  const group = topbar.slice(topbar.indexOf('marginLeft: "auto"'));
  const labels = [...group.matchAll(/label="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["What's next", "Work"],
    'only What\'s next and Work carry a label in the right-hand group (gear is the SettingsMenu, no label prop)');
});

test('regression: the skip-permissions-armed icon still renders --obligation red on the ochre cta button (aw-041)', () => {
  const lb = fn('LaunchButton');
  // The armed branch must be checked BEFORE the cta branch in the icon color
  // ternary, so the danger cue always wins over the idle ochre fill.
  const iconEl = lb.match(/<\$\{Icon\}[\s\S]*?\/>/);
  assert.ok(iconEl, 'LaunchButton must render an Icon element');
  assert.match(iconEl[0], /armed[\s\S]*?"var\(--obligation\)"[\s\S]*?cta[\s\S]*?"var\(--accent-ochre\)"/,
    'the icon color ternary must resolve armed -> --obligation before falling through to cta -> --accent-ochre');
});

test('the What\'s-next call site threads skipPermissions so the armed cue can reach it', () => {
  const topbar = fn('BoardTopbar');
  const start = topbar.indexOf('label="What\'s next"');
  const block = topbar.slice(start, topbar.indexOf('/>', start) + 2);
  assert.match(block, /skipPermissions=\$\{skipPermissions\}/,
    'What\'s next must still thread the armed skipPermissions signal after the recolor');
});
