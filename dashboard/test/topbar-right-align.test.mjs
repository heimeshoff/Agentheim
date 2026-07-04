// Static guard for the topbar RIGHT-ALIGN layout fix (agentic-workflow-053).
//
// The BoardTopbar is meant to read, left → right: [ search field ] … [ ⚙ ] [ Work ]
// (aw-052 / aw-049) — search anchored left (bounded `flex: 1, maxWidth: 520`), the
// settings gear + standing Work launch flush against the RIGHT edge. Before this fix
// the right-hand control group had no left push, so on any viewport wider than the
// search cap the group floated just past the search field with empty space trailing
// to the edge. The fix is a consumer-side flex tweak (`marginLeft: "auto"` on the
// gear+Work group) — no styleguide change (ADR-0003), presentation-only (ADR-0017).
//
// The board's React glue has no DOM render harness in this project — the established
// idiom (aw-016/020/022/023/026/027/039/049/052) is source-reading static guards.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

function fn(src, name) {
  const m = src.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}`));
  assert.ok(m, `${name} must exist`);
  return m[0];
}

test('the settings gear + Work group is pushed flush right (marginLeft: auto)', () => {
  const topbar = fn(boardSrc, 'BoardTopbar');
  // The group div holding SettingsMenu + the Work LaunchButton (the `gap: 9` group)
  // must carry a left-auto margin so all unconsumed free space collects BEFORE it,
  // seating the group against the topbar's right edge.
  const groupDiv = topbar.match(/<div style=\$\{\{[^}]*gap:\s*9[^}]*\}\}>/);
  assert.ok(groupDiv, 'the gear+Work group div must exist');
  assert.match(groupDiv[0], /marginLeft:\s*["']auto["']/,
    'the gear+Work group must be right-aligned via marginLeft: auto');
});

test('the search field stays LEFT-anchored with its bounded width (not stretched full-bar)', () => {
  const comp = fn(boardSrc, 'TopbarSearch');
  // The search keeps its bounded cap so it does not consume the whole bar; the free
  // space (not the field) is what the right group pushes off of.
  assert.match(comp, /flex:\s*1/, 'the search field grows within its cap');
  assert.match(comp, /maxWidth:\s*520/, 'the search field keeps its 520px cap');
});

// agentic-workflow-064: the right group becomes a THREE-action row, left → right:
// [ ⚙ gear ] [ What's next ] [ Work ↗ ] (still flush-right via the aw-053
// marginLeft:auto). "What's next" is a new STANDING launch between the quiet gear and
// the primary Work; Work keeps its primary-surface fill (NO ochre, ADR-0016) and only
// gains the trailing up-right diagonal glyph. Source-reading static guards (no DOM
// harness in this project — the aw-049/052/053 idiom).

test('the right group renders the three actions in order: gear, What\'s next, Work', () => {
  const topbar = fn(boardSrc, 'BoardTopbar');
  const iGear = topbar.indexOf('SettingsMenu');
  const iNext = topbar.indexOf('label="What\'s next"');
  const iWork = topbar.indexOf('label="Work"');
  assert.ok(iGear >= 0, 'the settings gear must be present');
  assert.ok(iNext >= 0, 'the What\'s next launch must be present');
  assert.ok(iWork >= 0, 'the Work launch must be present');
  assert.ok(iGear < iNext && iNext < iWork,
    'order must read left → right: gear, What\'s next, Work');
});

test('What\'s next launches the WHATS_NEXT_COMMAND slash command (the /agentheim:whats-next skill, aw-069)', () => {
  const topbar = fn(boardSrc, 'BoardTopbar');
  const block = topbar.slice(topbar.indexOf('label="What\'s next"'), topbar.indexOf('label="Work"'));
  assert.match(block, /command=\$\{WHATS_NEXT_COMMAND\}/,
    'What\'s next must seed the WHATS_NEXT_COMMAND constant');
  // It is imported from the command module (the single source of truth).
  assert.match(boardSrc, /WHATS_NEXT_COMMAND/, 'WHATS_NEXT_COMMAND must be imported');
  assert.match(boardSrc, /import\s*\{[^}]*WHATS_NEXT_COMMAND[^}]*\}\s*from\s*["']\.\/modeling-command\.js["']/,
    'WHATS_NEXT_COMMAND must come from the modeling-command module');
});

test('What\'s next carries the sun glyph and threads skipPermissions, passing no onResult', () => {
  const topbar = fn(boardSrc, 'BoardTopbar');
  const block = topbar.slice(topbar.indexOf('label="What\'s next"'), topbar.indexOf('label="Work"'));
  assert.match(block, /icon="sun"/, 'What\'s next must use the sun glyph');
  assert.match(block, /skipPermissions=\$\{skipPermissions\}/,
    'What\'s next must thread the armed skipPermissions signal');
  assert.doesNotMatch(block, /onResult/, 'What\'s next passes no onResult (read-only, no prompt consumed)');
});

test('What\'s next is the ochre CTA — not the quiet gear, not the primary Work (ADR-0048 carve-out, aw-vk6mc)', () => {
  const topbar = fn(boardSrc, 'BoardTopbar');
  // Slice the LaunchButton ELEMENT (open tag through its self-close), not the gap up
  // to the next button — so a neighbouring comment never bleeds in.
  const start = topbar.indexOf('label="What\'s next"');
  const block = topbar.slice(start, topbar.indexOf('/>', start) + 2);
  // What's-next carries the dedicated `cta` emphasis — it must NOT be primary/quiet
  // (those are Work / the gear cluster respectively).
  assert.match(block, /emphasis="cta"/, 'What\'s next must carry the ochre `cta` emphasis (ADR-0048)');
  assert.doesNotMatch(block, /emphasis="primary"/, 'What\'s next is not the primary emphasis (that is Work)');
  assert.doesNotMatch(block, /emphasis="quiet"/, 'What\'s next is not the quiet emphasis (that is the gear cluster)');
});

test('Work keeps its primary fill and gains the trailing up-right diagonal glyph (no ochre)', () => {
  const topbar = fn(boardSrc, 'BoardTopbar');
  const block = topbar.slice(topbar.indexOf('label="Work"'));
  assert.match(block, /emphasis="primary"/, 'Work keeps its primary-surface emphasis (no ochre, ADR-0016)');
  assert.match(block, /command=\$\{WORK_COMMAND\}/, 'Work still launches the bare WORK_COMMAND');
  assert.match(block, /icon="square-arrow-out-up-right"/,
    'Work uses the up-right diagonal glyph (the Work ↗ read)');
  assert.match(block, /trailingIcon/, 'Work renders its icon AFTER the label (trailing)');
  assert.doesNotMatch(block, /ochre/i, 'Work must not use the reserved ochre accent');
});

test('LaunchButton supports trailing-icon placement without forking the styleguide primitive', () => {
  const lb = fn(boardSrc, 'LaunchButton');
  // A minimal board-local prop/branch renders the icon after the label when set —
  // the styleguide Icon primitive itself is consumed unchanged (ADR-0003).
  assert.match(lb, /trailingIcon/, 'LaunchButton must accept a trailingIcon flag');
});
