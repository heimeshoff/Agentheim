// Tests for the TicketCard condensed ("1b") anatomy + corner-action slot
// (design-system-006, design-system-v08qq).
//
// TicketCard renders via htm/React with no DOM under `node --test`, so —
// mirroring the doing-pulse suite — the load-bearing, framework-free contracts
// are tested directly by reading the source:
//   1. design-system-v08qq condensed the card toward 1b's "Command deck" anatomy:
//      the meta row's context chip, estimate chip, and updated timestamp are all
//      gone. `showEstimate` (design-system-006, `app/card.js`) is retired along
//      with it — the estimate chip it gated no longer exists.
//   2. the card exposes an optional `cornerAction` render-prop occupying the
//      bottom-right meta slot, whose activation stops propagation so it never
//      opens the card. The meta row now renders ONLY when `cornerAction` is
//      supplied — an ordinary card ends at its title, exactly as 1b's does.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const kanbanSrc = readFileSync(join(APP, 'kanban.js'), 'utf8');

test('showEstimate (design-system-006) is retired: app/card.js no longer exists', () => {
  // design-system-v08qq removes the estimate chip entirely, so the pure decision
  // that gated it has no remaining caller. Retired rather than left as dead code
  // (design-system-v08qq AC 8's "retire" disposition).
  assert.equal(existsSync(join(APP, 'card.js')), false, 'app/card.js (showEstimate) must be retired, not left unreferenced');
});

test('the card renders no context chip, no estimate chip, and no updated timestamp', () => {
  // 1b's condensed card carries a status dot + mono id + title and nothing else
  // (design-system-v08qq). Catches a regression to any of the three dropped
  // meta-row elements.
  assert.doesNotMatch(kanbanSrc, /MetaChip/, 'TicketCard must no longer render any MetaChip (context or estimate)');
  assert.doesNotMatch(kanbanSrc, /ticket\.context/, 'TicketCard must no longer render the bounded-context chip');
  assert.doesNotMatch(kanbanSrc, /ticket\.est\b/, 'TicketCard must no longer render the estimate chip');
  assert.doesNotMatch(kanbanSrc, /ticket\.updated/, 'TicketCard must no longer render the updated timestamp');
  assert.doesNotMatch(kanbanSrc, /showEstimate/, 'TicketCard must no longer import or reference the retired showEstimate');
});

test('the meta row renders only when cornerAction is supplied, with no dangling title margin', () => {
  // A rowless card must end at its title exactly as 1b's does — no trailing
  // whitespace from a fixed title marginBottom.
  assert.match(kanbanSrc, /\$\{cornerAction\s*&&\s*html`/, 'the meta row must be gated on cornerAction, mirroring the pattern used elsewhere for optional slots');
  assert.match(kanbanSrc, /marginBottom:\s*cornerAction\s*\?\s*12\s*:\s*0/, 'the title marginBottom must collapse to 0 when there is no meta row to separate from');
});

test('mono id renders at 10px and the title at 12px / line-height 1.5', () => {
  // MonoId's size lives in the shared primitive (primitives.js), not kanban.js —
  // read it there.
  const primitivesSrc = readFileSync(join(APP, 'primitives.js'), 'utf8');
  const monoIdStart = primitivesSrc.indexOf('export function MonoId(');
  assert.notEqual(monoIdStart, -1, 'MonoId must be defined in primitives.js');
  const monoIdBody = primitivesSrc.slice(monoIdStart, primitivesSrc.indexOf('}', primitivesSrc.indexOf('}', monoIdStart) + 1));
  assert.match(monoIdBody, /fontSize:\s*10\b/, 'MonoId must render at 10px (bumped from 11.5px)');

  const titleStart = kanbanSrc.indexOf('<!-- Title -->');
  assert.notEqual(titleStart, -1, 'TicketCard must have a Title block');
  const titleEnd = kanbanSrc.indexOf('</div>', titleStart);
  const titleBlock = kanbanSrc.slice(titleStart, titleEnd);
  assert.match(titleBlock, /fontSize:\s*12\b/, 'the title must render at 12px (condensed from 14px)');
  assert.match(titleBlock, /lineHeight:\s*1\.5\b/, 'the title lineHeight must be 1.5 (condensed from 1.4)');
});

test('the card exposes an optional cornerAction slot in the bottom-right meta position', () => {
  // Render-prop: the styleguide owns look/placement, the consumer owns behavior.
  assert.match(kanbanSrc, /cornerAction/, 'TicketCard must accept a cornerAction');
});

test('activating the corner action stops propagation so it never opens the card', () => {
  // The card itself is a button (role="button", onClick opens the slide-over). The
  // action sits inside it, so its click MUST be isolated. The card wraps the slot
  // in a propagation-stopping container.
  assert.match(kanbanSrc, /stopPropagation\(\)/, 'corner action must stop click propagation');
});

// Hover treatment (design-system-008): hover should read as a *raised* card —
// a stronger shadow with NO vertical content lift. The card no longer translates
// on hover, so text stays put rather than jumping.
//
// The base style object lines between `const base = {` and the closing `};` carry
// the hover branch; we read those directly (no DOM under `node --test`).
const baseStyleSrc = (() => {
  const start = kanbanSrc.indexOf('const base = {');
  assert.notEqual(start, -1, 'TicketCard must define a base style object');
  const end = kanbanSrc.indexOf('};', start);
  assert.notEqual(end, -1, 'base style object must be closed');
  return kanbanSrc.slice(start, end);
})();

test('hover box-shadow is the stronger --shadow-md, not --shadow-sm', () => {
  const boxShadowLine = baseStyleSrc
    .split('\n')
    .find((line) => /boxShadow:\s*isHover/.test(line));
  assert.ok(boxShadowLine, 'the base style must set boxShadow on the hover branch');
  assert.match(boxShadowLine, /var\(--shadow-md\)/, 'hover must raise to --shadow-md');
  assert.doesNotMatch(boxShadowLine, /--shadow-sm/, 'hover must no longer use --shadow-sm');
});

test('hover applies no transform / translateY — content does not move upward', () => {
  assert.doesNotMatch(baseStyleSrc, /transform:/, 'the base hover style must not set any transform');
  assert.doesNotMatch(baseStyleSrc, /translateY/, 'the hover must not translate the card');
  // The transition should no longer animate `transform` once the offset is gone.
  const transitionLine = baseStyleSrc
    .split('\n')
    .find((line) => /transition:/.test(line));
  assert.ok(transitionLine, 'the base style must declare a transition');
  assert.doesNotMatch(transitionLine, /\btransform\b/, 'the transition must drop the transform segment');
});

// Corner radius (design-system-t896s): 1b's condensed card calls for a 10px
// radius, larger than the shared --radius-md (8px, used by Menu/Modal/Drawer).
// A dedicated --radius-card token isolates the bump to TicketCard alone.
test('the base style uses a dedicated --radius-card token, not the shared --radius-md', () => {
  const radiusLine = baseStyleSrc
    .split('\n')
    .find((line) => /borderRadius:/.test(line));
  assert.ok(radiusLine, 'the base style must set borderRadius');
  assert.match(radiusLine, /var\(--radius-card\)/, 'TicketCard must use the dedicated --radius-card token');
  assert.doesNotMatch(radiusLine, /--radius-md/, 'TicketCard must no longer share --radius-md with Menu/Modal/Drawer');
});

test('--radius-card resolves to 10px, larger than the shared --radius-md (8px)', () => {
  const cssPath = join(HERE, '..', 'styles', 'colors_and_type.css');
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /--radius-card:\s*10px;/, '--radius-card must be defined as 10px');
  assert.match(css, /--radius-md:\s*8px;/, '--radius-md must remain 8px for Menu/Modal/Drawer');
});

test('the selected state carries no ochre / accent ring (selected looks identical to unselected)', () => {
  // ADR-0016: ordinary selection is never signalled by the reserved accent.
  // design-system-010 removed the TicketCard's ochre border + 1px accent ring;
  // the `selected` prop is now purely semantic (aria-pressed), with no visual cue.
  const base = baseStyleSrc;

  // no `if (selected)` shadow override anywhere in the source
  assert.doesNotMatch(
    kanbanSrc,
    /if \(selected\)\s*base\.boxShadow/,
    'selected must not set its own box-shadow (no accent ring)',
  );
  // the borderColor must not branch on `selected`
  const borderLine = base
    .split('\n')
    .find((line) => /borderColor:/.test(line));
  assert.ok(borderLine, 'the base style must set borderColor');
  assert.doesNotMatch(borderLine, /selected/, 'borderColor must not branch on `selected`');
  // accent-reservation: no ochre / accent cue tied to selection in the base style
  assert.doesNotMatch(base, /accent|ochre/, 'the selected cue must not use the reserved accent / ochre');
});
