// Static guard for the per-card todo Work launch button (agentic-workflow-g4zce).
//
// Mirrors dashboard/test/backlog-card-launch.test.mjs exactly in idiom: the board's
// React glue has no DOM render harness in this project, so the pure command string
// gets node --test coverage (modeling-command.test.mjs) and the board's wiring is
// guarded here by reading its source. This suite locks the acceptance criteria that
// are NOT pure string logic:
//   - todo cards wire the cornerAction slot to a single Work launch button, seeded
//     with workCommandFor(ticket.id) — the scoped-run grammar ADR-0071 gives `work`;
//   - the button is supplied THROUGH the styleguide TicketCard's cornerAction
//     render-prop (unforked consumption, ADR-0003) — the styleguide is not edited;
//   - backlog cards keep their Refine/Promote pair unchanged; doing/done cards
//     render no cornerAction;
//   - Work is emphasised (primary) with a trailing icon, like the topbar Work
//     button (agentic-workflow-064);
//   - the button threads skipPermissions and defensively isolates its click
//     (same as the backlog pair), so launching never opens the slide-over;
//   - the top-right dismiss trash can still applies to todo cards alongside the
//     new bottom-right Work button (both are reachable, no overlap).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

test('todo cards wire cornerAction to a Work launch button', () => {
  assert.match(
    boardSrc,
    /status === "todo"[\s\S]{0,200}TodoCardLaunch/,
    'todo cards must supply a Work launch component into cornerAction',
  );
  assert.match(boardSrc, /label="Work"/, 'the todo cornerAction must render a Work button');
});

test('the Work button seeds workCommandFor(ticket.id)', () => {
  const todoLaunch = boardSrc.match(/function TodoCardLaunch[\s\S]*?\n}/);
  assert.ok(todoLaunch, 'TodoCardLaunch not found');
  assert.match(
    todoLaunch[0],
    /command=\$\{workCommandFor\(id\)\}/,
    'Work must seed workCommandFor(id)',
  );
});

test('the Work button is emphasised (primary) with a trailing icon, like the topbar Work button', () => {
  const todoLaunch = boardSrc.match(/function TodoCardLaunch[\s\S]*?\n}/);
  assert.ok(todoLaunch, 'TodoCardLaunch not found');
  assert.match(todoLaunch[0], /emphasis="primary"/, 'Work must be emphasis="primary"');
  assert.match(todoLaunch[0], /trailingIcon=\$\{true\}/, 'Work must render its icon trailing the label');
});

test('the Work button defensively isolates its click and threads skipPermissions', () => {
  const todoLaunch = boardSrc.match(/function TodoCardLaunch[\s\S]*?\n}/);
  assert.ok(todoLaunch, 'TodoCardLaunch not found');
  assert.match(todoLaunch[0], /isolateClick=\$\{true\}/, 'Work must isolate its click');
  assert.match(todoLaunch[0], /skipPermissions=\$\{skipPermissions\}/, 'Work must thread skipPermissions');
});

test('backlog cards still render Refine + Promote; doing/done cards render no cornerAction', () => {
  assert.match(
    boardSrc,
    /const cornerAction = status === "backlog"[\s\S]{0,300}status === "todo"[\s\S]{0,120}: undefined;/,
    'cornerAction must branch backlog -> pair, todo -> Work launch, else undefined',
  );
});

test('the top-right dismiss trash can still applies to todo cards (coexists with the new Work button)', () => {
  assert.match(
    boardSrc,
    /const showTrash = status === "backlog" \|\| status === "todo";/,
    'todo cards must keep the top-right dismiss trash can',
  );
});
