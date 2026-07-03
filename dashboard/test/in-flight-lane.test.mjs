// Static guard for the board's IN-FLIGHT LANE (agentic-workflow-m9w5c, ADR-0043).
//
// Two Claude Code hooks (lib/hook-agent-signal.mjs) write a session-liveness
// heartbeat + recent worker/verifier completions to
// `.agentheim/state/in-flight.json` (a SECOND advisory artifact, ADR-0027
// extended by ADR-0043). This panel READS it via the existing /api/doc body
// carrier and self-suppresses once stale — no zombie lane (AC3).
//
// The board's React glue has no DOM render harness in this project — the idiom
// (aw-023/043/073) is: pure logic gets node --test coverage
// (in-flight-state.test.mjs), and the board's wiring is guarded by reading its
// source. This suite locks the m9w5c acceptance criteria that are not pure
// helper logic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

function lane() {
  const m = boardSrc.match(/function InFlightLane[\s\S]*?(?=\/\*\* Default fetch for the in-flight)/);
  assert.ok(m, 'InFlightLane component must exist');
  return m[0];
}

test('an InFlightLane component exists', () => {
  assert.ok(lane());
});

test('the lane fetches the ADR-0043 artifact via /api/doc, NOT /api/tree', () => {
  assert.match(boardSrc, /defaultFetchInFlight[\s\S]*?docUrl\(IN_FLIGHT_DOC_PATH\)/);
  assert.doesNotMatch(lane(), /api\/tree/, 'the in-flight signal must not enter /api/tree (ADR-0023)');
});

test('an absent or stale artifact resolves to render NOTHING — no zombie lane (AC3)', () => {
  // deriveInFlightView already collapses absent/malformed/stale to null (ADR-0043);
  // the component must render nothing when that is what it gets back.
  assert.match(lane(), /deriveInFlightView\(/);
  assert.match(lane(), /if \(!view\) return null;/);
});

test('the lane re-fetches live on every SSE frame (ADR-0006)', () => {
  assert.match(lane(), /useLiveTree\(reload\)/);
});

test('the lane shows a since-when cue derived from startedAt (AC1)', () => {
  assert.match(lane(), /formatStaleness\(view\.startedAt, Date\.now\(\)\)/);
});

test('the lane shows worker and verifier counts (AC1 — which workers/verifiers)', () => {
  assert.match(lane(), /view\.workerCount/);
  assert.match(lane(), /view\.verifierCount/);
});

test('the lane is read-only — it contains no fetch method other than GET (ADR-0017)', () => {
  assert.doesNotMatch(lane(), /method:\s*["'](POST|PUT|PATCH|DELETE)["']/);
});

test('the lane is styleguide-consumed unforked — token-styled, no new design-system child', () => {
  assert.match(lane(), /var\(--surface-1\)/);
  assert.match(lane(), /var\(--hairline\)/);
});

test('the lane is composed on the board view (rendered from the top-level Board tree)', () => {
  assert.match(boardSrc, /<\$\{InFlightLane\}/);
});
