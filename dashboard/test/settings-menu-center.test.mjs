// Static guard for the SettingsMenu content-CENTERING fix (agentic-workflow-055).
//
// The top-right settings gear dropdown (SettingsMenu, aw-049) read off-center: the
// shared Menu panel has symmetric `padding: 10`, but each MenuItem is a left-aligned
// `display: flex` row that is NOT stretched in the panel's flex column, so each
// content-sized control (ThemeToggle / SkipPermissionsToggle / Stop LaunchButton)
// hugged the LEFT edge and the slack collected on the RIGHT — unequal whitespace.
//
// The fix is board-local (the smallest correct change; the shared Menu/MenuItem
// primitive stays a body-agnostic, left-aligning generic menu — centering is THIS
// consumer's choice, not a styleguide default): every MenuItem centers its content
// via `justifyContent: "center"`, applied UNIFORMLY from one shared style constant so
// all three controls stay aligned with each other. No styleguide change (ADR-0003),
// presentation-only (ADR-0017).
//
// The board's React glue has no DOM render harness in this project — the established
// idiom (aw-016/020/022/023/026/027/039/049/052/053) is source-reading static guards.

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

test('SettingsMenu centers each MenuItem content via a shared justifyContent: center style', () => {
  const comp = fn(boardSrc, 'SettingsMenu');
  // A single shared style constant carries the centering so the fix is uniform across
  // all three controls (not three independent per-item tweaks that could drift).
  assert.match(comp, /justifyContent:\s*["']center["']/,
    'SettingsMenu must center its menu-item content (justifyContent: center)');
});

test('all three MenuItem rows opt into the centered style (uniform, not per-item)', () => {
  const comp = fn(boardSrc, 'SettingsMenu');
  // Every MenuItem the SettingsMenu composes must carry the centering style, so the
  // theme toggle, skip-permissions toggle and Stop launch all sit centered together.
  const menuItems = comp.match(/<\$\{MenuItem\}/g) || [];
  assert.equal(menuItems.length, 3, 'SettingsMenu composes exactly three MenuItem rows');
  const styledItems = comp.match(/<\$\{MenuItem\}\s+style=\$\{/g) || [];
  assert.equal(styledItems.length, 3,
    'all three MenuItem rows must receive the centering style (uniform fix)');
});

test('the fix is consumer-side: the shared Menu primitive is not forked', () => {
  // The styleguide Menu/MenuItem must keep importing unforked from the design-system
  // BC (ADR-0003) — the fix lives in board.js, not in a copied/edited menu.js.
  assert.match(boardSrc,
    /import \{ Menu, MenuItem, MenuDivider \} from "\.\.\/\.\.\/\.agentheim\/knowledge\/contexts\/design-system\/styleguide\/app\/menu\.js"/,
    'SettingsMenu must consume the shared Menu/MenuItem unforked');
});
