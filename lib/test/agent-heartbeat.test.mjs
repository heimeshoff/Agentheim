// Pure logic behind the live-observability hook signal (agentic-workflow-m9w5c).
//
// `.agentheim/state/in-flight.json` is a SECOND advisory artifact (ADR-0027 §4.1
// sanctions exactly one — this feature's ADR-0043 extends the category to a bounded
// second file). It is written by two Claude Code hooks:
//   - a `Stop` hook scoped to the `work` skill's own frontmatter — fires on every
//     orchestrator turn while `work` is active, the session-liveness heartbeat.
//   - a `Stop` hook scoped to `agents/worker.md` / `agents/verifier.md` frontmatter —
//     auto-converted to `SubagentStop` when that subagent completes (per the
//     work-terminal-completion-signal research), recording "this agent just finished".
//
// This module is the pure state-transition core the hook CLI script
// (lib/hook-agent-signal.mjs) calls — no I/O here, fully unit-testable.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STALE_WINDOW_MS,
  isStale,
  applyHeartbeat,
  applyAgentCompletion,
} from '../agent-heartbeat.mjs';

const T0 = '2026-07-03T12:00:00.000Z';
const T0_MS = Date.parse(T0);

test('applyHeartbeat on no prior state creates a fresh session with startedAt === lastHeartbeat', () => {
  const state = applyHeartbeat(null, { sessionId: 'sess-1', nowIso: T0 });
  assert.equal(state.version, 1);
  assert.equal(state.sessionId, 'sess-1');
  assert.equal(state.startedAt, T0);
  assert.equal(state.lastHeartbeat, T0);
  assert.deepEqual(state.agents, []);
});

test('applyHeartbeat on a FRESH prior state bumps lastHeartbeat but keeps startedAt', () => {
  const prior = applyHeartbeat(null, { sessionId: 'sess-1', nowIso: T0 });
  const laterIso = new Date(T0_MS + 60_000).toISOString(); // 1 minute later — well within window
  const next = applyHeartbeat(prior, { sessionId: 'sess-1', nowIso: laterIso });
  assert.equal(next.startedAt, T0, 'startedAt must not move on a live heartbeat');
  assert.equal(next.lastHeartbeat, laterIso);
});

test('applyHeartbeat on a STALE prior state (past the window) resets startedAt — a new session', () => {
  const prior = applyHeartbeat(null, { sessionId: 'sess-1', nowIso: T0 });
  const muchLaterIso = new Date(T0_MS + STALE_WINDOW_MS + 60_000).toISOString();
  const next = applyHeartbeat(prior, { sessionId: 'sess-2', nowIso: muchLaterIso });
  assert.equal(next.startedAt, muchLaterIso, 'a stale prior heartbeat starts a fresh session');
  assert.equal(next.lastHeartbeat, muchLaterIso);
  assert.equal(next.sessionId, 'sess-2');
  assert.deepEqual(next.agents, [], 'a fresh session carries no stale agent completions forward');
});

test('applyHeartbeat tolerates malformed/corrupt prior state — never throws, starts fresh', () => {
  for (const bad of [undefined, {}, { version: 2 }, { version: 1, lastHeartbeat: 'not-a-date' }, 'garbage', 42]) {
    const next = applyHeartbeat(bad, { sessionId: 's', nowIso: T0 });
    assert.equal(next.startedAt, T0);
    assert.equal(next.lastHeartbeat, T0);
  }
});

test('isStale is true for null/malformed state and for a heartbeat older than the window', () => {
  assert.equal(isStale(null, T0_MS), true);
  assert.equal(isStale({ version: 1, lastHeartbeat: 'nonsense' }, T0_MS), true);
  const fresh = applyHeartbeat(null, { sessionId: 's', nowIso: T0 });
  assert.equal(isStale(fresh, T0_MS + 1000), false);
  assert.equal(isStale(fresh, T0_MS + STALE_WINDOW_MS + 1), true);
});

test('applyAgentCompletion records a worker completion and bumps the heartbeat', () => {
  const state = applyAgentCompletion(null, {
    agentType: 'worker', agentId: 'w-1', sessionId: 'sess-1', nowIso: T0,
  });
  assert.equal(state.lastHeartbeat, T0);
  assert.deepEqual(state.agents, [{ agentType: 'worker', agentId: 'w-1', completedAt: T0 }]);
});

test('applyAgentCompletion accumulates distinct agents across calls', () => {
  let state = applyAgentCompletion(null, { agentType: 'worker', agentId: 'w-1', sessionId: 's', nowIso: T0 });
  const t1 = new Date(T0_MS + 30_000).toISOString();
  state = applyAgentCompletion(state, { agentType: 'verifier', agentId: 'v-1', sessionId: 's', nowIso: t1 });
  assert.equal(state.agents.length, 2);
  assert.ok(state.agents.some((a) => a.agentType === 'worker' && a.agentId === 'w-1'));
  assert.ok(state.agents.some((a) => a.agentType === 'verifier' && a.agentId === 'v-1'));
});

test('applyAgentCompletion replaces (not duplicates) a repeated agentId', () => {
  let state = applyAgentCompletion(null, { agentType: 'worker', agentId: 'w-1', sessionId: 's', nowIso: T0 });
  const t1 = new Date(T0_MS + 30_000).toISOString();
  state = applyAgentCompletion(state, { agentType: 'worker', agentId: 'w-1', sessionId: 's', nowIso: t1 });
  assert.equal(state.agents.length, 1);
  assert.equal(state.agents[0].completedAt, t1);
});

test('applyAgentCompletion prunes agent entries older than the staleness window — the file never grows unbounded', () => {
  let state = applyAgentCompletion(null, { agentType: 'worker', agentId: 'w-1', sessionId: 's', nowIso: T0 });
  const muchLaterIso = new Date(T0_MS + STALE_WINDOW_MS + 60_000).toISOString();
  state = applyAgentCompletion(state, { agentType: 'verifier', agentId: 'v-1', sessionId: 's', nowIso: muchLaterIso });
  // The heartbeat itself was stale too, so this is a fresh session — w-1's old entry is gone.
  assert.equal(state.agents.length, 1);
  assert.equal(state.agents[0].agentId, 'v-1');
});

test('applyAgentCompletion with no agentType still bumps the heartbeat but records nothing', () => {
  const state = applyAgentCompletion(null, { sessionId: 's', nowIso: T0 });
  assert.equal(state.lastHeartbeat, T0);
  assert.deepEqual(state.agents, []);
});

test('the exported STALE_WINDOW_MS is a positive, finite number of milliseconds', () => {
  assert.equal(typeof STALE_WINDOW_MS, 'number');
  assert.ok(Number.isFinite(STALE_WINDOW_MS) && STALE_WINDOW_MS > 0);
});
