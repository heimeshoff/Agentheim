// Tests for the TicketCard estimate-chip visibility + corner-action slot
// (design-system-006).
//
// TicketCard renders via htm/React with no DOM under `node --test`, so —
// mirroring the doing-pulse suite — the load-bearing, framework-free contracts
// are tested directly against the pure decision the card delegates to:
//   1. `showEstimate(est)` — the empty "— pt" chip is dead space on every
//      dashboard card (the /api/tree projection carries no estimate, ADR-0002,
//      so board-data feeds the '—' placeholder). The chip must render ONLY for a
//      real estimate, never for absent / empty / the em-dash placeholder.
//   2. the card source wires that decision (no chip when showEstimate is false)
//      and exposes an optional `cornerAction` render-prop occupying the
//      bottom-right meta slot, whose activation stops propagation so it never
//      opens the card.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { showEstimate } from '../app/card.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const kanbanSrc = readFileSync(join(APP, 'kanban.js'), 'utf8');

test('showEstimate is true only for a real estimate value', () => {
  assert.equal(showEstimate('3'), true);
  assert.equal(showEstimate('1'), true);
  assert.equal(showEstimate('?'), true, 'an explicit unknown-marker is still a value the author chose to show');
});

test('showEstimate is false for absent / empty / em-dash placeholder', () => {
  for (const est of ['—', '', '  ', undefined, null]) {
    assert.equal(showEstimate(est), false, `est ${JSON.stringify(est)} must hide the chip`);
  }
});

test('the card renders the estimate chip behind the showEstimate decision', () => {
  // The chip must be conditional on showEstimate — never unconditional. Catches a
  // regression to the old `${ticket.est} pt` that always rendered.
  // The "… pt" chip must appear ONLY guarded by showEstimate(...) on the same
  // line — never as a bare unconditional render. This catches a regression to the
  // old `<${MetaChip} mono>${ticket.est} pt` that always rendered.
  const estChipLines = kanbanSrc
    .split('\n')
    .filter((line) => /\$\{ticket\.est\}\s*pt/.test(line));
  assert.equal(estChipLines.length, 1, 'exactly one estimate-chip render line expected');
  assert.match(estChipLines[0], /showEstimate\(ticket\.est\)\s*&&/, 'the estimate chip must be guarded by showEstimate(ticket.est)');
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
