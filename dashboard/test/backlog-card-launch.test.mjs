// Static guard for the per-card backlog Refine / Promote launch group
// (agentic-workflow-022).
//
// The board's React glue (the cornerAction button group) has no DOM render harness
// in this project — the idiom (aw-016 / aw-020) is: the pure command strings get
// node --test coverage (modeling-command.test.mjs), the bridge decision gets
// coverage (bridge-launch.test.mjs), and the board's wiring is guarded by reading
// its source. This suite locks the aw-022 acceptance criteria that are NOT pure
// string logic:
//   - backlog cards wire the cornerAction slot to the Refine/Promote pair, not the
//     retired Copy affordance (aw-016);
//   - the pair is supplied THROUGH the styleguide TicketCard's cornerAction
//     render-prop (unforked consumption, ADR-0003) — the styleguide is not edited;
//   - the styleguide slot's stop-propagation wrapper that keeps a slot click from
//     opening the slide-over still exists, and the board's buttons also isolate
//     their own click defensively (belt-and-suspenders);
//   - Refine is emphasised (primary) and Promote is de-emphasised (quiet).
//
// Reading source is deliberately blunt, but it catches the regression classes this
// task cares about (Copy resurfacing, the slot getting forked, the verbs swapping
// emphasis) without standing up a React+DOM test rig the project doesn't have.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { styleguideDir } from '../../lib/task-system-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');
const kanbanSrc = readFileSync(
  path.join(styleguideDir(path.join(dashboardDir, '..')), 'app', 'kanban.js'),
  'utf8',
);

test('backlog cards wire cornerAction to the Refine/Promote launch pair', () => {
  assert.match(
    boardSrc,
    /status === "backlog"[\s\S]{0,200}BacklogCardLaunchPair/,
    'backlog cards must supply the BacklogCardLaunchPair into cornerAction',
  );
  assert.match(boardSrc, /label="Refine"/, 'the pair must render a Refine button');
  assert.match(boardSrc, /label="Promote"/, 'the pair must render a Promote button');
});

test('the retired per-card Copy affordance (aw-016) is gone', () => {
  assert.doesNotMatch(
    boardSrc,
    /function CopyCommandButton\b/,
    'CopyCommandButton must be removed (replaced by the launch pair)',
  );
  // The per-CARD pair must NOT seed cards with the bare modelingCommandFor — the
  // card path is the explicit-verb refine/promote builders. (aw-023 reintroduced
  // modelingCommandFor with NEW prompt semantics for the board PROMPT BAR's
  // relocated column button, so we no longer assert the symbol is absent
  // wholesale; we assert the per-card pair never seeds with it.)
  const cardPair = boardSrc.match(/function BacklogCardLaunchPair[\s\S]*?\n}/);
  assert.ok(cardPair, 'BacklogCardLaunchPair not found');
  assert.doesNotMatch(
    cardPair[0],
    /modelingCommandFor\b/,
    'the per-card pair must seed with refine/promote builders, not modelingCommandFor',
  );
});

test('the Refine/Promote buttons seed the explicit-verb commands for the card id', () => {
  assert.match(
    boardSrc,
    /command=\$\{refineCommandFor\(id\)\}/,
    'Refine must seed refineCommandFor(id)',
  );
  assert.match(
    boardSrc,
    /command=\$\{promoteCommandFor\(id\)\}/,
    'Promote must seed promoteCommandFor(id)',
  );
});

test('Refine is emphasised (primary), Promote is de-emphasised (quiet)', () => {
  const refine = boardSrc.match(/label="Refine"[\s\S]{0,240}?\/>/);
  const promote = boardSrc.match(/label="Promote"[\s\S]{0,240}?\/>/);
  assert.ok(refine, 'Refine button literal not found');
  assert.ok(promote, 'Promote button literal not found');
  assert.match(refine[0], /emphasis="primary"/, 'Refine must be emphasis="primary"');
  assert.match(promote[0], /emphasis="quiet"/, 'Promote must be emphasis="quiet"');
});

// aw-068: the card actions follow the SAME in-theme hover+press scheme as the prompt-bar
// cards and the topbar launches — both opt into liftOnHover so they brighten (never
// invert) on hover/press.
test('both card buttons opt into the shared hover+press scheme (liftOnHover)', () => {
  const refine = boardSrc.match(/label="Refine"[\s\S]{0,240}?\/>/);
  const promote = boardSrc.match(/label="Promote"[\s\S]{0,240}?\/>/);
  assert.ok(refine && promote, 'Refine and Promote button literals not found');
  assert.match(refine[0], /liftOnHover=\$\{true\}/, 'Refine must opt into liftOnHover');
  assert.match(promote[0], /liftOnHover=\$\{true\}/, 'Promote must opt into liftOnHover');
});

test('both card buttons defensively isolate their click (do not bubble to the card onClick)', () => {
  const refine = boardSrc.match(/label="Refine"[\s\S]{0,240}?\/>/);
  const promote = boardSrc.match(/label="Promote"[\s\S]{0,240}?\/>/);
  assert.match(refine[0], /isolateClick=\$\{true\}/, 'Refine must isolate its click');
  assert.match(promote[0], /isolateClick=\$\{true\}/, 'Promote must isolate its click');
  // And the LaunchButton actually honors isolateClick with a stopPropagation.
  assert.match(
    boardSrc,
    /isolateClick && e && typeof e\.stopPropagation === "function"\) e\.stopPropagation\(\)/,
    'LaunchButton must stopPropagation when isolateClick is set',
  );
});

test('the pair is consumed through the styleguide cornerAction render-prop, unforked (ADR-0003)', () => {
  // The board hands a render-prop into the styleguide TicketCard's cornerAction.
  assert.match(
    boardSrc,
    /cornerAction=\$\{cornerAction\}/,
    'board must pass cornerAction into the styleguide TicketCard',
  );
  // And the styleguide still owns the slot's propagation-stopping wrapper — the
  // single line that keeps a slot click from opening the slide-over. If the
  // styleguide ever drops it, this guard fails (and the board buttons fall back to
  // their own defensive isolateClick, asserted above).
  assert.match(
    kanbanSrc,
    /cornerAction[\s\S]{0,200}onClick=\$\{\(e\) => e\.stopPropagation\(\)\}/,
    'styleguide cornerAction slot must keep its stop-propagation wrapper (ds-006)',
  );
});
