// Tests for dashboard/bridge-launch-api.mjs — POST /api/bridge/launch, the
// MEDIATED LAUNCH write category (ADR-0082 §2-§6, infrastructure-xh8tw).
// Every Herdr CLI call is an injected fake `exec`/`spawnFn` — no real
// `herdr` binary is ever spawned. `resolveHerdrBinaryFn` is likewise faked
// so no test ever touches the builder's real Herdr install or PATH.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  BRIDGE_TOKEN_HEADER,
  HERDR_CAPABILITIES,
  MODEL_ALLOWLIST,
  sanitizeModel,
  sanitizeName,
  deriveNameFromPrompt,
  resolveSessionName,
  buildClaudeArgv,
  deriveHerdrAgentName,
  handleBridgeLaunch,
} from '../bridge-launch-api.mjs';
import { createDashboardServer } from '../server.mjs';
import { bridgeConfigPath } from '../../lib/bridge-selection.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// vscode-extension/src/bridge.js is plain CommonJS (node:http/crypto/fs/path
// only — no `require('vscode')`), so it can be required directly here rather
// than regex-scraped, mirroring dashboard/test/prompt-model.test.mjs's own
// discipline of pinning against the real exported value.
const vscodeBridge = require(path.join(__dirname, '..', '..', 'vscode-extension', 'src', 'bridge.js'));

// ---------------------------------------------------------------------------
// Structural guard: this module's MODEL_ALLOWLIST / capability set must never
// silently drift from the VS Code extension's own constants — two
// independent bridge implementations, one shared vocabulary.
// ---------------------------------------------------------------------------

test('MODEL_ALLOWLIST is value-identical to the VS Code extension bridge.js allowlist', () => {
  assert.deepEqual(MODEL_ALLOWLIST, vscodeBridge.MODEL_ALLOWLIST);
});

test('HERDR_CAPABILITIES is value-identical to the VS Code extension bridge.js CAPABILITIES', () => {
  assert.deepEqual(HERDR_CAPABILITIES, vscodeBridge.CAPABILITIES);
});

// ---------------------------------------------------------------------------
// sanitizeModel
// ---------------------------------------------------------------------------

test('sanitizeModel accepts exact allowlist members', () => {
  for (const id of MODEL_ALLOWLIST) {
    assert.equal(sanitizeModel(id), id);
  }
});

test('sanitizeModel rejects anything outside the allowlist (never throws, never a flag)', () => {
  for (const bad of ['Opus', 'claude-sonnet-5', ' opus', 'opus;rm -rf', 42, null, undefined, {}]) {
    assert.equal(sanitizeModel(bad), '');
  }
});

// ---------------------------------------------------------------------------
// sanitizeName / deriveNameFromPrompt / resolveSessionName
// ---------------------------------------------------------------------------

test('sanitizeName strips control characters, trims, and caps length', () => {
  assert.equal(sanitizeName('  hello\tworld\n  '), 'hello\tworld'.replace(/[\x00-\x1F\x7F]/g, ''));
  assert.equal(sanitizeName(42), '');
  assert.equal(sanitizeName('a'.repeat(200)).length, 60);
});

test('deriveNameFromPrompt: /agentheim:<skill> <rest> -> "<skill>: <rest>"', () => {
  assert.equal(deriveNameFromPrompt('/agentheim:quick-capture fix the bug'), 'quick-capture: fix the bug');
});

test('deriveNameFromPrompt: modeling carve-out drops the "modeling: " prefix (infrastructure-w6p4k)', () => {
  assert.equal(deriveNameFromPrompt('/agentheim:modeling refine the herdr task'), 'refine the herdr task');
});

test('deriveNameFromPrompt: bare /agentheim:modeling with no rest falls through to plain "modeling"', () => {
  assert.equal(deriveNameFromPrompt('/agentheim:modeling'), 'modeling');
});

test('deriveNameFromPrompt: plain text -> the prompt itself', () => {
  assert.equal(deriveNameFromPrompt('just a plain prompt'), 'just a plain prompt');
});

test('resolveSessionName: explicit name wins when present and sanitizes to non-empty', () => {
  assert.equal(resolveSessionName({ name: 'my session', prompt: 'ignored' }), 'my session');
});

test('resolveSessionName: falls back to the prompt-derived name when name is absent/invalid', () => {
  assert.equal(resolveSessionName({ name: undefined, prompt: '/agentheim:quick-capture do it' }), 'quick-capture: do it');
  assert.equal(resolveSessionName({ name: 42, prompt: 'plain' }), 'plain');
});

// ---------------------------------------------------------------------------
// buildClaudeArgv — ADR-0018's exact order
// ---------------------------------------------------------------------------

test('buildClaudeArgv: name only', () => {
  assert.deepEqual(
    buildClaudeArgv({ name: 'sess', model: '', skipPermissions: false, prompt: 'do it' }),
    ['-n', 'sess', 'do it'],
  );
});

test('buildClaudeArgv: name + model', () => {
  assert.deepEqual(
    buildClaudeArgv({ name: 'sess', model: 'opus', skipPermissions: false, prompt: 'do it' }),
    ['-n', 'sess', '--model', 'opus', 'do it'],
  );
});

test('buildClaudeArgv: name + skipPermissions', () => {
  assert.deepEqual(
    buildClaudeArgv({ name: 'sess', model: '', skipPermissions: true, prompt: 'do it' }),
    ['-n', 'sess', '--dangerously-skip-permissions', 'do it'],
  );
});

test('buildClaudeArgv: name + model + skipPermissions, all armed, ADR-0018 exact order', () => {
  assert.deepEqual(
    buildClaudeArgv({ name: 'sess', model: 'opus', skipPermissions: true, prompt: 'do it' }),
    ['-n', 'sess', '--model', 'opus', '--dangerously-skip-permissions', 'do it'],
  );
});

test('buildClaudeArgv: a rejected model value never rides as sanitizeModel("") -> no --model flag', () => {
  assert.deepEqual(
    buildClaudeArgv({ name: 'sess', model: sanitizeModel('not-a-real-model'), skipPermissions: false, prompt: 'do it' }),
    ['-n', 'sess', 'do it'],
  );
});

// ---------------------------------------------------------------------------
// deriveHerdrAgentName — pure, Herdr's naming grammar
// ---------------------------------------------------------------------------

const AGENT_NAME_RE = /^[a-z][a-z0-9_-]{0,31}$/;

test('deriveHerdrAgentName lower-cases and collapses non-grammar characters', () => {
  const name = deriveHerdrAgentName('Quick Capture: fix the bug!', []);
  assert.match(name, AGENT_NAME_RE);
});

test('deriveHerdrAgentName against the display names the VS Code path already derives (infrastructure-c6fzb/-w6p4k)', () => {
  for (const displayName of [
    resolveSessionName({ prompt: '/agentheim:quick-capture fix the bug' }),
    resolveSessionName({ prompt: '/agentheim:modeling refine the herdr task' }),
    resolveSessionName({ prompt: 'plain prompt with spaces' }),
    resolveSessionName({ name: 'Explicit Name', prompt: 'ignored' }),
  ]) {
    assert.match(deriveHerdrAgentName(displayName, []), AGENT_NAME_RE);
  }
});

test('deriveHerdrAgentName forces a leading letter, falling back to "agent" when nothing survives', () => {
  assert.match(deriveHerdrAgentName('123', []), AGENT_NAME_RE);
  assert.match(deriveHerdrAgentName('!!!', []), AGENT_NAME_RE);
  assert.match(deriveHerdrAgentName('', []), AGENT_NAME_RE);
});

test('deriveHerdrAgentName never exceeds 32 characters', () => {
  const name = deriveHerdrAgentName('a'.repeat(200), []);
  assert.ok(name.length <= 32);
  assert.match(name, AGENT_NAME_RE);
});

test('deriveHerdrAgentName is unique against the injected live-agent list', () => {
  const first = deriveHerdrAgentName('fix the bug', []);
  const second = deriveHerdrAgentName('fix the bug', [first]);
  assert.notEqual(first, second);
  assert.match(second, AGENT_NAME_RE);
  const third = deriveHerdrAgentName('fix the bug', [first, second]);
  assert.notEqual(third, first);
  assert.notEqual(third, second);
  assert.match(third, AGENT_NAME_RE);
});

test('deriveHerdrAgentName stays unique even when the base name is already at the 32-char cap', () => {
  const base = deriveHerdrAgentName('a'.repeat(200), []);
  assert.equal(base.length, 32);
  const unique = deriveHerdrAgentName('a'.repeat(200), [base]);
  assert.notEqual(unique, base);
  assert.match(unique, AGENT_NAME_RE);
  assert.ok(unique.length <= 32);
});

// ---------------------------------------------------------------------------
// handleBridgeLaunch — the HTTP handler, driven with a fake req/res so every
// status code and every Herdr CLI failure mode is asserted without a real
// server or a real `herdr` binary.
// ---------------------------------------------------------------------------

const VALID_TOKEN = 'a'.repeat(32);

function makeReq({ headers = {}, body = '' } = {}) {
  const req = new EventEmitter();
  req.headers = headers;
  process.nextTick(() => {
    if (body) req.emit('data', Buffer.from(body));
    req.emit('end');
  });
  return req;
}

function makeRes() {
  const res = {};
  res.statusCode = null;
  res.headers = null;
  res.body = null;
  res.writeHead = (status, headers) => {
    res.statusCode = status;
    res.headers = headers;
  };
  res.end = (body) => {
    res.body = body;
  };
  return res;
}

function tokenHeaders(token = VALID_TOKEN) {
  return { [BRIDGE_TOKEN_HEADER.toLowerCase()]: token };
}

test('missing token -> 401, never a hang, never a 5xx', async () => {
  const req = makeReq({ headers: {}, body: JSON.stringify({ prompt: 'x' }) });
  const res = makeRes();
  await handleBridgeLaunch(req, res, '/proj', { token: VALID_TOKEN });
  assert.equal(res.statusCode, 401);
});

test('mismatched token -> 401', async () => {
  const req = makeReq({ headers: tokenHeaders('b'.repeat(32)), body: JSON.stringify({ prompt: 'x' }) });
  const res = makeRes();
  await handleBridgeLaunch(req, res, '/proj', { token: VALID_TOKEN });
  assert.equal(res.statusCode, 401);
});

test('malformed JSON body -> 400', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: '{ not json' });
  const res = makeRes();
  await handleBridgeLaunch(req, res, '/proj', { token: VALID_TOKEN });
  assert.equal(res.statusCode, 400);
});

test('missing/empty prompt -> 400', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: '   ' }) });
  const res = makeRes();
  await handleBridgeLaunch(req, res, '/proj', { token: VALID_TOKEN });
  assert.equal(res.statusCode, 400);
});

test('herdr binary not resolvable -> non-2xx (never a hang, never a 5xx crash)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  await handleBridgeLaunch(req, res, '/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: null, source: null, version: null }),
  });
  assert.ok(res.statusCode >= 400 && res.statusCode < 600);
  assert.notEqual(res.statusCode, 200);
  assert.notEqual(res.statusCode, 202);
});

test('resolveHerdrBinaryFn THROWING (not just returning path:null) -> non-2xx, never an unhandled rejection (verifier iteration 1)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  await handleBridgeLaunch(req, res, '/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => {
      throw new Error('boom: resolver exploded');
    },
  });
  assert.ok(res.statusCode >= 400 && res.statusCode < 600);
  assert.notEqual(res.statusCode, 200);
  assert.notEqual(res.statusCode, 202);
});

test('herdr api snapshot failure -> non-2xx before any 202', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const exec = () => {
    throw new Error('herdr: socket not found');
  };
  await handleBridgeLaunch(req, res, '/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
  });
  assert.ok(res.statusCode >= 400 && res.statusCode < 600);
  assert.notEqual(res.statusCode, 202);
});

test('herdr tab/workspace create failure -> non-2xx before any 202', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const calls = [];
  const exec = (bin, args) => {
    calls.push(args);
    if (args[0] === 'api' && args[1] === 'snapshot') {
      return JSON.stringify({ result: { snapshot: { panes: [] } } });
    }
    throw new Error('herdr: workspace create failed');
  };
  await handleBridgeLaunch(req, res, '/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
  });
  assert.ok(res.statusCode >= 400 && res.statusCode < 600);
  assert.notEqual(res.statusCode, 202);
  assert.ok(calls.some((a) => a[0] === 'workspace' && a[1] === 'create'));
});

test('no matching-cwd pane -> workspace create (not tab create)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const calls = [];
  const exec = (bin, args) => {
    calls.push(args);
    if (args[0] === 'api') return JSON.stringify({ result: { snapshot: { panes: [{ cwd: '/other' }] } } });
    if (args[0] === 'workspace') return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: 'w1:p1' } });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  const spawnCalls = [];
  const spawnFn = (bin, args) => spawnCalls.push({ bin, args });
  await handleBridgeLaunch(req, res, '/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
  });
  assert.equal(res.statusCode, 202);
  assert.deepEqual(JSON.parse(res.body), { ok: true });
  assert.ok(calls.some((a) => a[0] === 'workspace' && a[1] === 'create'));
  assert.equal(
    calls.some((a) => a[0] === 'tab' && a[1] === 'create'),
    false,
  );
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].args[0], 'agent');
  assert.equal(spawnCalls[0].args[1], 'start');
});

test('matching-cwd pane -> tab create --workspace <id> (not workspace create)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const calls = [];
  const exec = (bin, args) => {
    calls.push(args);
    if (args[0] === 'api')
      return JSON.stringify({ result: { snapshot: { panes: [{ cwd: '/proj', workspace_id: 'w7' }] } } });
    if (args[0] === 'tab') return JSON.stringify({ result: { tab: 't2', root_pane: 'w7:p2' } });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  const spawnFn = () => {};
  await handleBridgeLaunch(req, res, '/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
  });
  assert.equal(res.statusCode, 202);
  const tabCall = calls.find((a) => a[0] === 'tab' && a[1] === 'create');
  assert.ok(tabCall);
  assert.ok(tabCall.includes('--workspace'));
  assert.equal(tabCall[tabCall.indexOf('--workspace') + 1], 'w7');
});

test('202 fires BEFORE agent start is spawned, and agent start failure is never surfaced', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const exec = (bin, args) => {
    if (args[0] === 'api') return JSON.stringify({ result: { snapshot: { panes: [] } } });
    if (args[0] === 'workspace') return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: 'w1:p1' } });
    if (args[0] === 'agent' && args[1] === 'list') throw new Error('agent list failed');
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  const spawnFn = () => {
    throw new Error('spawn EPERM');
  };
  await handleBridgeLaunch(req, res, '/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
  });
  assert.equal(res.statusCode, 202);
});

test('name/model/skipPermissions ride the spawned agent-start argv in ADR-0018 exact order', async () => {
  const req = makeReq({
    headers: tokenHeaders(),
    body: JSON.stringify({ prompt: 'do it', name: 'My Session', model: 'opus', skipPermissions: true }),
  });
  const res = makeRes();
  const exec = (bin, args) => {
    if (args[0] === 'api') return JSON.stringify({ result: { snapshot: { panes: [] } } });
    if (args[0] === 'workspace') return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: 'w1:p1' } });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  let spawnedArgs = null;
  const spawnFn = (bin, args) => {
    spawnedArgs = args;
  };
  await handleBridgeLaunch(req, res, '/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
    timeoutMs: 5000,
  });
  assert.equal(res.statusCode, 202);
  await new Promise((resolve) => process.nextTick(resolve));
  assert.ok(spawnedArgs, 'agent start must have been spawned');
  assert.equal(spawnedArgs[0], 'agent');
  assert.equal(spawnedArgs[1], 'start');
  assert.equal(spawnedArgs[3], '--kind');
  assert.equal(spawnedArgs[4], 'claude');
  assert.equal(spawnedArgs[5], '--pane');
  assert.equal(spawnedArgs[6], 'w1:p1');
  assert.equal(spawnedArgs[7], '--timeout');
  assert.equal(spawnedArgs[8], '5000');
  assert.equal(spawnedArgs[9], '--');
  const claudeArgv = spawnedArgs.slice(10);
  assert.deepEqual(claudeArgv, ['-n', 'My Session', '--model', 'opus', '--dangerously-skip-permissions', 'do it']);
});

test('name field: present only when armed — bare prompt still gets a prompt-derived -n (never omitted)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const exec = (bin, args) => {
    if (args[0] === 'api') return JSON.stringify({ result: { snapshot: { panes: [] } } });
    if (args[0] === 'workspace') return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: 'w1:p1' } });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  let spawnedArgs = null;
  const spawnFn = (bin, args) => {
    spawnedArgs = args;
  };
  await handleBridgeLaunch(req, res, '/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
  });
  await new Promise((resolve) => process.nextTick(resolve));
  const claudeArgv = spawnedArgs.slice(spawnedArgs.indexOf('--') + 1);
  assert.deepEqual(claudeArgv, ['-n', 'do it', 'do it']);
});

test('model field: rejected value -> no --model flag (never a rejection)', async () => {
  const req = makeReq({
    headers: tokenHeaders(),
    body: JSON.stringify({ prompt: 'do it', model: 'not-a-real-model' }),
  });
  const res = makeRes();
  const exec = (bin, args) => {
    if (args[0] === 'api') return JSON.stringify({ result: { snapshot: { panes: [] } } });
    if (args[0] === 'workspace') return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: 'w1:p1' } });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  let spawnedArgs = null;
  const spawnFn = (bin, args) => {
    spawnedArgs = args;
  };
  await handleBridgeLaunch(req, res, '/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
  });
  await new Promise((resolve) => process.nextTick(resolve));
  const claudeArgv = spawnedArgs.slice(spawnedArgs.indexOf('--') + 1);
  assert.deepEqual(claudeArgv, ['-n', 'do it', 'do it']);
  assert.equal(claudeArgv.includes('--model'), false);
});

test('skipPermissions field: present only when strictly true', async () => {
  const req = makeReq({
    headers: tokenHeaders(),
    body: JSON.stringify({ prompt: 'do it', skipPermissions: 'true' }), // string, not boolean
  });
  const res = makeRes();
  const exec = (bin, args) => {
    if (args[0] === 'api') return JSON.stringify({ result: { snapshot: { panes: [] } } });
    if (args[0] === 'workspace') return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: 'w1:p1' } });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  let spawnedArgs = null;
  const spawnFn = (bin, args) => {
    spawnedArgs = args;
  };
  await handleBridgeLaunch(req, res, '/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
  });
  await new Promise((resolve) => process.nextTick(resolve));
  const claudeArgv = spawnedArgs.slice(spawnedArgs.indexOf('--') + 1);
  assert.equal(claudeArgv.includes('--dangerously-skip-permissions'), false);
});

// ---------------------------------------------------------------------------
// HTTP route wiring through the REAL `createDashboardServer` (verifier
// iteration 1: every prior test above drove `handleBridgeLaunch` directly —
// nothing proved the dispatch block in server.mjs actually reaches it, sits
// ahead of the 405 gate, or shares the SAME per-process token `GET
// /api/bridge` hands out. Mirrors the house pattern in
// dashboard/test/stop-api.test.mjs and dashboard/test/whats-next-delete.test.mjs.
// ---------------------------------------------------------------------------

function makeServerProject() {
  const base = mkdtempSync(path.join(tmpdir(), 'xh8tw-bridge-launch-'));
  mkdirSync(path.join(base, '.agentheim'));
  const dist = path.join(base, 'dashboard', 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>dash</title>');
  const home = mkdtempSync(path.join(tmpdir(), 'xh8tw-bridge-launch-home-'));
  const configPath = bridgeConfigPath(home);
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify({ schema: 1, bridge: 'herdr' }));
  return { base, dist, home };
}

async function startServer(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

test('POST /api/bridge/launch is dispatched BEFORE the 405 gate (reachable via POST), end-to-end through the token GET /api/bridge hands out', async () => {
  const { base, dist, home } = makeServerProject();
  const calls = [];
  const exec = (bin, args) => {
    calls.push(args);
    if (args[0] === 'api') return JSON.stringify({ result: { snapshot: { panes: [] } } });
    if (args[0] === 'workspace') return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: 'w1:p1' } });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  let spawnedArgs = null;
  const spawnFn = (bin, args) => {
    spawnedArgs = args;
  };
  const server = createDashboardServer({
    root: base,
    assetRoot: dist,
    homedir: home,
    herdr: { resolve: { which: () => '/fake/herdr' }, liveness: { existsSync: () => false } },
    bridgeLaunch: {
      resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
      exec,
      spawnFn,
    },
  });
  try {
    const port = await startServer(server);

    // Learn the token the ONLY sanctioned way (GET /api/bridge), so this test
    // proves the launch endpoint accepts the SAME per-process token, not a
    // second independently-constructed one.
    const bridgeBody = await (await fetch(`http://127.0.0.1:${port}/api/bridge`)).json();
    assert.equal(bridgeBody.kind, 'herdr');
    assert.equal(typeof bridgeBody.token, 'string');

    const res = await fetch(`http://127.0.0.1:${port}/api/bridge/launch`, {
      method: 'POST',
      headers: { [BRIDGE_TOKEN_HEADER]: bridgeBody.token, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'do it', name: 'My Session', model: 'opus', skipPermissions: true }),
    });
    assert.equal(res.status, 202);
    assert.deepEqual(await res.json(), { ok: true });

    // The fire-and-forget spawn happens synchronously inside the handler
    // before it returns, but give the event loop one tick of slack anyway.
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(spawnedArgs, 'agent start must have been spawned');
    assert.equal(spawnedArgs[0], 'agent');
    assert.equal(spawnedArgs[1], 'start');
    const claudeArgv = spawnedArgs.slice(spawnedArgs.indexOf('--') + 1);
    assert.deepEqual(claudeArgv, ['-n', 'My Session', '--model', 'opus', '--dangerously-skip-permissions', 'do it']);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('POST /api/bridge/launch rejects a wrong token with 401 through the real server (not the same as no route match)', async () => {
  const { base, dist, home } = makeServerProject();
  const server = createDashboardServer({
    root: base,
    assetRoot: dist,
    homedir: home,
    herdr: { resolve: { which: () => null }, liveness: { existsSync: () => false } },
  });
  try {
    const port = await startServer(server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge/launch`, {
      method: 'POST',
      headers: { [BRIDGE_TOKEN_HEADER]: 'not-the-real-token', 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'do it' }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('a throwing resolveHerdrBinaryFn yields a non-2xx through the REAL server, not a process crash (verifier iteration 1)', async () => {
  const { base, dist, home } = makeServerProject();
  const server = createDashboardServer({
    root: base,
    assetRoot: dist,
    homedir: home,
    herdr: { resolve: { which: () => '/fake/herdr' }, liveness: { existsSync: () => false } },
    bridgeLaunch: {
      resolveHerdrBinaryFn: () => {
        throw new Error('boom: resolver exploded');
      },
    },
  });
  try {
    const port = await startServer(server);
    const bridgeBody = await (await fetch(`http://127.0.0.1:${port}/api/bridge`)).json();
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge/launch`, {
      method: 'POST',
      headers: { [BRIDGE_TOKEN_HEADER]: bridgeBody.token, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'do it' }),
    });
    // The server process itself must still be alive to answer at all; a
    // 500 (or any non-2xx) proves the throw did NOT become an unhandled
    // rejection that killed the process.
    assert.ok(res.status >= 400 && res.status < 600);
    assert.notEqual(res.status, 202);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('the 405 gate still rejects every OTHER non-GET method on /api/bridge/launch; GET falls through to 404', async () => {
  const { base, dist, home } = makeServerProject();
  const server = createDashboardServer({
    root: base,
    assetRoot: dist,
    homedir: home,
    herdr: { resolve: { which: () => null }, liveness: { existsSync: () => false } },
  });
  try {
    const port = await startServer(server);
    // GET is allowed THROUGH the method gate (never rejected there); no GET
    // route matches /api/bridge/launch, so it falls through to the
    // unmatched-route 404 — mirrors stop-api.test.mjs's own GET-on-a-
    // write-only-route assertion, not a 405 (405 is only for the rejected
    // methods below).
    const get = await fetch(`http://127.0.0.1:${port}/api/bridge/launch`, { method: 'GET' });
    assert.equal(get.status, 404, 'GET /api/bridge/launch has no matching route and falls through to 404');
    const put = await fetch(`http://127.0.0.1:${port}/api/bridge/launch`, { method: 'PUT' });
    assert.equal(put.status, 405);
    const del = await fetch(`http://127.0.0.1:${port}/api/bridge/launch`, { method: 'DELETE' });
    assert.equal(del.status, 405);
  } finally {
    server.close();
    rmSync(base, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
