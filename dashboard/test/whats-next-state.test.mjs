// Tests for the dashboard's WHAT'S-NEXT panel pure helpers (agentic-workflow-073;
// the dismiss store retired by agentic-workflow-vmk1z / ADR-0046).
//
// The What's next advisory recommendation (ADR-0027) renders as a dismissible panel
// above the board prompt bar. As of ADR-0046, dismiss issues `DELETE /api/whats-next`
// (removing the artifact from disk) instead of a client-side localStorage hide — so
// the former `loadDismissed` / `saveDismissed` / `isDismissed` store and its
// `WHATS_NEXT_KEY` / `WHATS_NEXT_VERSION` constants no longer exist in this module.
// This suite covers what remains: the doc-path constant and the two pure render
// helpers.
//
// `formatStaleness` is a pure staleness formatter over the `generated` timestamp — a
// rendering cue only (ADR-0027 §4: nothing keys behaviour off it). Pure,
// framework-free, unit-tested under `node --test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WHATS_NEXT_DOC_PATH,
  formatStaleness,
} from '../app/whats-next-state.js';

test('the doc path is the ADR-0027 advisory artifact', () => {
  assert.equal(WHATS_NEXT_DOC_PATH, '.agentheim/state/whats-next.md');
});

test('the retired dismiss-store exports no longer exist (ADR-0046)', async () => {
  const mod = await import('../app/whats-next-state.js');
  for (const name of ['loadDismissed', 'saveDismissed', 'isDismissed', 'WHATS_NEXT_KEY', 'WHATS_NEXT_VERSION']) {
    assert.equal(name in mod, false, `${name} must be retired`);
  }
});

// ---- formatStaleness (pure rendering cue, ADR-0027 §4) ---------------------

test('formatStaleness reads "just now" within the first minute', () => {
  const now = Date.parse('2026-06-17T20:00:30Z');
  assert.equal(formatStaleness('2026-06-17T20:00:00Z', now), 'just now');
});

test('formatStaleness reads minutes / hours / days ago', () => {
  const base = Date.parse('2026-06-17T20:00:00Z');
  assert.equal(formatStaleness('2026-06-17T19:55:00Z', base), '5 minutes ago');
  assert.equal(formatStaleness('2026-06-17T19:59:00Z', base), '1 minute ago');
  assert.equal(formatStaleness('2026-06-17T17:00:00Z', base), '3 hours ago');
  assert.equal(formatStaleness('2026-06-17T19:00:00Z', base), '1 hour ago');
  assert.equal(formatStaleness('2026-06-15T20:00:00Z', base), '2 days ago');
  assert.equal(formatStaleness('2026-06-16T20:00:00Z', base), '1 day ago');
});

test('formatStaleness returns "" for an unparseable / missing timestamp (never throws)', () => {
  const now = Date.parse('2026-06-17T20:00:00Z');
  assert.equal(formatStaleness('not a date', now), '');
  assert.equal(formatStaleness('', now), '');
  assert.equal(formatStaleness(null, now), '');
  assert.equal(formatStaleness(undefined, now), '');
});

test('formatStaleness clamps a FUTURE timestamp to "just now" (never negative)', () => {
  const now = Date.parse('2026-06-17T20:00:00Z');
  assert.equal(formatStaleness('2026-06-17T20:05:00Z', now), 'just now');
});
