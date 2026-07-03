// I/O-glue tests for the Claude Code hook entrypoint (agentic-workflow-m9w5c).
//
// runHook() is exported specifically so tests can drive it with injected
// stdin/root/clock rather than spawning a real subprocess with real stdin — the
// pure state-transition logic itself is covered by agent-heartbeat.test.mjs;
// this suite only proves the I/O glue (payload parsing, file read/write,
// mode dispatch, resilience) behaves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runHook } from '../hook-agent-signal.mjs';

function withTempRoot(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'aw-hook-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('session-heartbeat mode writes a fresh in-flight.json under .agentheim/state/', () => {
  withTempRoot((root) => {
    const result = runHook('session-heartbeat', {
      stdin: JSON.stringify({ session_id: 'sess-1', hook_event_name: 'Stop' }),
      root,
      now: () => '2026-07-03T12:00:00.000Z',
    });
    assert.equal(result.ok, true);
    const target = path.join(root, '.agentheim', 'state', 'in-flight.json');
    assert.ok(existsSync(target));
    const state = JSON.parse(readFileSync(target, 'utf8'));
    assert.equal(state.sessionId, 'sess-1');
    assert.equal(state.startedAt, '2026-07-03T12:00:00.000Z');
    assert.equal(state.lastHeartbeat, '2026-07-03T12:00:00.000Z');
    assert.deepEqual(state.agents, []);
  });
});

test('worker-stop mode records a worker completion, verifier-stop records a verifier', () => {
  withTempRoot((root) => {
    runHook('worker-stop', {
      stdin: JSON.stringify({ session_id: 's1', agent_id: 'w-9', agent_type: 'worker' }),
      root,
      now: () => '2026-07-03T12:00:00.000Z',
    });
    runHook('verifier-stop', {
      stdin: JSON.stringify({ session_id: 's1', agent_id: 'v-9', agent_type: 'verifier' }),
      root,
      now: () => '2026-07-03T12:00:30.000Z',
    });
    const target = path.join(root, '.agentheim', 'state', 'in-flight.json');
    const state = JSON.parse(readFileSync(target, 'utf8'));
    assert.equal(state.agents.length, 2);
    assert.ok(state.agents.find((a) => a.agentType === 'worker' && a.agentId === 'w-9'));
    assert.ok(state.agents.find((a) => a.agentType === 'verifier' && a.agentId === 'v-9'));
  });
});

test('a malformed stdin payload degrades to a plain heartbeat — never throws', () => {
  withTempRoot((root) => {
    const result = runHook('session-heartbeat', {
      stdin: '{not json',
      root,
      now: () => '2026-07-03T12:00:00.000Z',
    });
    assert.equal(result.ok, true);
    const state = JSON.parse(readFileSync(path.join(root, '.agentheim', 'state', 'in-flight.json'), 'utf8'));
    assert.equal(state.sessionId, null);
  });
});

test('a pre-existing corrupt in-flight.json is tolerated — the hook starts fresh, never throws', () => {
  withTempRoot((root) => {
    const stateDir = path.join(root, '.agentheim', 'state');
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(path.join(stateDir, 'in-flight.json'), 'not valid json {{{', 'utf8');

    const result = runHook('session-heartbeat', {
      stdin: JSON.stringify({ session_id: 's1' }),
      root,
      now: () => '2026-07-03T12:00:00.000Z',
    });
    assert.equal(result.ok, true);
    const state = JSON.parse(readFileSync(path.join(stateDir, 'in-flight.json'), 'utf8'));
    assert.equal(state.sessionId, 's1');
  });
});

test('an unresolvable root returns a structured failure — never throws', () => {
  // '' is not nullish (unlike null/undefined) so it is NOT overridden by the real
  // resolveRoot() fallback — this exercises the `!root` guard directly, deterministic
  // regardless of which real project this suite happens to run inside.
  const result = runHook('session-heartbeat', { stdin: '{}', root: '' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-project-root');
});

test('an unrecognized mode degrades to a plain heartbeat rather than failing', () => {
  withTempRoot((root) => {
    const result = runHook('some-future-mode', {
      stdin: JSON.stringify({ session_id: 's1' }),
      root,
      now: () => '2026-07-03T12:00:00.000Z',
    });
    assert.equal(result.ok, true);
    const state = JSON.parse(readFileSync(path.join(root, '.agentheim', 'state', 'in-flight.json'), 'utf8'));
    assert.equal(state.sessionId, 's1');
    assert.deepEqual(state.agents, []);
  });
});
