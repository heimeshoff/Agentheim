// Pure logic behind the board's in-flight lane (agentic-workflow-m9w5c, ADR-0043).
//
// The `Stop`/`SubagentStop` hooks (lib/hook-agent-signal.mjs, ADR-0043) write
// `.agentheim/state/in-flight.json` — a SECOND advisory artifact alongside
// `state/whats-next.md` (ADR-0027 §4.1, extended by ADR-0043). This module is the
// dashboard-side READ path: parse the fetched JSON, then derive a lane view model
// that self-suppresses once the heartbeat goes stale — the crash-safety mechanism
// that keeps a killed session's leftover signal from drawing a zombie lane (AC3).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IN_FLIGHT_DOC_PATH,
  STALE_WINDOW_MS,
  parseInFlightDoc,
  deriveInFlightView,
} from '../app/in-flight-state.js';

const T0 = '2026-07-03T12:00:00.000Z';
const T0_MS = Date.parse(T0);

function validState(overrides = {}) {
  return {
    version: 1,
    sessionId: 'sess-1',
    startedAt: T0,
    lastHeartbeat: T0,
    agents: [],
    ...overrides,
  };
}

test('IN_FLIGHT_DOC_PATH points at the ADR-0043 artifact under .agentheim/state/', () => {
  assert.equal(IN_FLIGHT_DOC_PATH, '.agentheim/state/in-flight.json');
});

test('parseInFlightDoc parses a well-formed document', () => {
  const parsed = parseInFlightDoc(JSON.stringify(validState()));
  assert.equal(parsed.sessionId, 'sess-1');
  assert.equal(parsed.startedAt, T0);
});

test('parseInFlightDoc returns null for absent/blank/malformed/wrong-shape input', () => {
  for (const bad of [null, undefined, '', '   ', 'not json {{{', '42', '[]', '"a string"', JSON.stringify({ version: 2, lastHeartbeat: T0 }), JSON.stringify({ version: 1 })]) {
    assert.equal(parseInFlightDoc(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('deriveInFlightView returns null for an absent/malformed document — renders nothing', () => {
  assert.equal(deriveInFlightView(null, T0_MS), null);
  assert.equal(deriveInFlightView('not json', T0_MS), null);
});

test('deriveInFlightView returns a live view when the heartbeat is fresh', () => {
  const raw = JSON.stringify(validState({
    agents: [
      { agentType: 'worker', agentId: 'w-1', completedAt: T0 },
      { agentType: 'worker', agentId: 'w-2', completedAt: T0 },
      { agentType: 'verifier', agentId: 'v-1', completedAt: T0 },
    ],
  }));
  const view = deriveInFlightView(raw, T0_MS + 10_000); // 10s later — well within the window.
  assert.ok(view);
  assert.equal(view.startedAt, T0);
  assert.equal(view.lastHeartbeat, T0);
  assert.equal(view.workerCount, 2);
  assert.equal(view.verifierCount, 1);
  assert.equal(view.agentCount, 3);
});

test('deriveInFlightView returns null once the heartbeat is past the staleness window — no zombie lane (AC3)', () => {
  const raw = JSON.stringify(validState());
  const view = deriveInFlightView(raw, T0_MS + STALE_WINDOW_MS + 1);
  assert.equal(view, null);
});

test('deriveInFlightView is inclusive at exactly the staleness boundary and null just past it', () => {
  const raw = JSON.stringify(validState());
  assert.ok(deriveInFlightView(raw, T0_MS + STALE_WINDOW_MS));
  assert.equal(deriveInFlightView(raw, T0_MS + STALE_WINDOW_MS + 1), null);
});

test('deriveInFlightView tolerates a missing/non-array agents field — treats as zero agents', () => {
  const raw = JSON.stringify(validState({ agents: undefined }));
  const view = deriveInFlightView(raw, T0_MS);
  assert.ok(view);
  assert.equal(view.agentCount, 0);
  assert.equal(view.workerCount, 0);
  assert.equal(view.verifierCount, 0);
});

test('deriveInFlightView falls back startedAt to lastHeartbeat when startedAt is missing/non-string', () => {
  const raw = JSON.stringify(validState({ startedAt: undefined }));
  const view = deriveInFlightView(raw, T0_MS);
  assert.equal(view.startedAt, T0);
});

test('STALE_WINDOW_MS is a positive finite number matching the hook-side window (lib/agent-heartbeat.mjs)', () => {
  assert.equal(typeof STALE_WINDOW_MS, 'number');
  assert.ok(Number.isFinite(STALE_WINDOW_MS) && STALE_WINDOW_MS > 0);
});
