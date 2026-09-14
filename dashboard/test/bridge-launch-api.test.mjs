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
  normalizeCwdForComparison,
  cwdsMatch,
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
// normalizeCwdForComparison / cwdsMatch (infrastructure-nz2e8) — pure,
// platform-injectable so win32 behaviour (backslash separators,
// case-insensitivity) is testable on any host OS.
// ---------------------------------------------------------------------------

test('normalizeCwdForComparison: non-string/empty input -> ""', () => {
  assert.equal(normalizeCwdForComparison(undefined, 'win32'), '');
  assert.equal(normalizeCwdForComparison(null, 'win32'), '');
  assert.equal(normalizeCwdForComparison(42, 'win32'), '');
  assert.equal(normalizeCwdForComparison('', 'win32'), '');
});

test('normalizeCwdForComparison (win32): forward-slash and backslash forms of the same path normalize equal', () => {
  assert.equal(normalizeCwdForComparison('C:\\src\\proj', 'win32'), normalizeCwdForComparison('C:/src/proj', 'win32'));
});

test('normalizeCwdForComparison (win32): a trailing separator does not change the result', () => {
  assert.equal(normalizeCwdForComparison('C:\\src\\proj\\', 'win32'), normalizeCwdForComparison('C:\\src\\proj', 'win32'));
  assert.equal(normalizeCwdForComparison('C:/src/proj/', 'win32'), normalizeCwdForComparison('C:/src/proj', 'win32'));
});

test('normalizeCwdForComparison (win32): case-insensitive', () => {
  assert.equal(normalizeCwdForComparison('C:\\src\\proj', 'win32'), normalizeCwdForComparison('C:\\SRC\\PROJ', 'win32'));
});

test('cwdsMatch (win32): mixed separator forms, the reverse, and a trailing-separator variant all match', () => {
  assert.equal(cwdsMatch('C:\\src\\proj', 'C:/src/proj', 'win32'), true); // pane backslash-like root, root forward
  assert.equal(cwdsMatch('C:/src/proj', 'C:\\src\\proj', 'win32'), true); // the reverse
  assert.equal(cwdsMatch('C:\\src\\proj\\', 'C:\\src\\proj', 'win32'), true); // trailing separator
  assert.equal(cwdsMatch('C:\\src\\proj', 'C:\\SRC\\PROJ', 'win32'), true); // case-insensitive
});

test('cwdsMatch: a genuinely different directory never matches', () => {
  assert.equal(cwdsMatch('C:\\src\\proj', 'C:\\src\\other', 'win32'), false);
  assert.equal(cwdsMatch('/src/proj', '/src/other', 'linux'), false);
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
    if (args[0] === 'workspace')
      return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: { pane_id: 'w1:p1' } } });
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
    if (args[0] === 'tab') return JSON.stringify({ result: { tab: 't2', root_pane: { pane_id: 'w7:p2' } } });
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

test('the pane-to-workspace read only trusts workspace_id — a matching pane carrying the old `workspace` key (no `workspace_id`) yields `--workspace undefined`, proving the `?? pane.workspace` fallback is gone (infrastructure-p3k9r Shape 1)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const calls = [];
  const exec = (bin, args) => {
    calls.push(args);
    // `workspace` (no trailing `_id`) is the shape the OLD `?? pane.workspace`
    // fallback used to read; a live install never emits it (infrastructure-
    // p3k9r's live capture: only `workspace_id` is present).
    if (args[0] === 'api') return JSON.stringify({ result: { snapshot: { panes: [{ cwd: '/proj', workspace: 'w7' }] } } });
    if (args[0] === 'tab') return JSON.stringify({ result: { tab: 't2', root_pane: { pane_id: 'w7:p2' } } });
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
  assert.equal(tabCall[tabCall.indexOf('--workspace') + 1], 'undefined');
});

test('every awaited exec call (api snapshot, workspace create, agent list) AND the fire-and-forget spawn receive windowsHide:true — the dashboard server owns no console (infrastructure-nz2e8)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const execCalls = [];
  const exec = (bin, args, options) => {
    execCalls.push({ args, options });
    if (args[0] === 'api') return JSON.stringify({ result: { snapshot: { panes: [] } } });
    if (args[0] === 'workspace')
      return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: { pane_id: 'w1:p1' } } });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  let spawnOptions = null;
  const spawnFn = (bin, args, options) => {
    spawnOptions = options;
  };
  await handleBridgeLaunch(req, res, '/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
  });
  assert.equal(res.statusCode, 202);
  await new Promise((resolve) => process.nextTick(resolve));
  // api snapshot + workspace create must both have fired (awaited path).
  assert.ok(execCalls.some((c) => c.args[0] === 'api' && c.args[1] === 'snapshot'));
  assert.ok(execCalls.some((c) => c.args[0] === 'workspace' && c.args[1] === 'create'));
  assert.ok(execCalls.some((c) => c.args[0] === 'agent' && c.args[1] === 'list'));
  for (const { args, options } of execCalls) {
    assert.equal(options && options.windowsHide, true, `exec(${args.join(' ')}) must receive windowsHide:true`);
  }
  assert.ok(spawnOptions, 'agent start must have been spawned');
  assert.equal(spawnOptions.windowsHide, true);
});

test('workspace-reuse: a path-FORM difference alone (backslash pane cwd vs forward-slash root) still takes tab-create, never workspace-create, and the tab-create exec receives windowsHide:true (win32) (infrastructure-nz2e8)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const calls = [];
  const exec = (bin, args, options) => {
    calls.push({ args, options });
    if (args[0] === 'api')
      return JSON.stringify({ result: { snapshot: { panes: [{ cwd: 'C:\\src\\proj', workspace_id: 'w9' }] } } });
    if (args[0] === 'tab') return JSON.stringify({ result: { tab: 't2', root_pane: { pane_id: 'w9:p2' } } });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  const spawnFn = () => {};
  await handleBridgeLaunch(req, res, 'C:/src/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
    platform: 'win32',
  });
  assert.equal(res.statusCode, 202);
  assert.ok(calls.some((c) => c.args[0] === 'tab' && c.args[1] === 'create'));
  assert.equal(calls.some((c) => c.args[0] === 'workspace' && c.args[1] === 'create'), false);
  const tabCall = calls.find((c) => c.args[0] === 'tab' && c.args[1] === 'create');
  assert.equal(tabCall.options && tabCall.options.windowsHide, true, 'tab create exec must receive windowsHide:true');
});

test('workspace-reuse: the reverse form (backslash root vs forward-slash pane cwd) still takes tab-create, and the tab-create exec receives windowsHide:true (win32) (infrastructure-nz2e8)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const calls = [];
  const exec = (bin, args, options) => {
    calls.push({ args, options });
    if (args[0] === 'api')
      return JSON.stringify({ result: { snapshot: { panes: [{ cwd: 'C:/src/proj', workspace_id: 'w9' }] } } });
    if (args[0] === 'tab') return JSON.stringify({ result: { tab: 't2', root_pane: { pane_id: 'w9:p2' } } });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  const spawnFn = () => {};
  await handleBridgeLaunch(req, res, 'C:\\src\\proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
    platform: 'win32',
  });
  assert.equal(res.statusCode, 202);
  assert.ok(calls.some((c) => c.args[0] === 'tab' && c.args[1] === 'create'));
  assert.equal(calls.some((c) => c.args[0] === 'workspace' && c.args[1] === 'create'), false);
  const tabCall = calls.find((c) => c.args[0] === 'tab' && c.args[1] === 'create');
  assert.equal(tabCall.options && tabCall.options.windowsHide, true, 'tab create exec must receive windowsHide:true');
});

test('workspace-reuse: a trailing-separator variant still takes tab-create, and the tab-create exec receives windowsHide:true (win32) (infrastructure-nz2e8)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const calls = [];
  const exec = (bin, args, options) => {
    calls.push({ args, options });
    if (args[0] === 'api')
      return JSON.stringify({ result: { snapshot: { panes: [{ cwd: 'C:\\src\\proj\\', workspace_id: 'w9' }] } } });
    if (args[0] === 'tab') return JSON.stringify({ result: { tab: 't2', root_pane: { pane_id: 'w9:p2' } } });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  const spawnFn = () => {};
  await handleBridgeLaunch(req, res, 'C:\\src\\proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
    platform: 'win32',
  });
  assert.equal(res.statusCode, 202);
  assert.ok(calls.some((c) => c.args[0] === 'tab' && c.args[1] === 'create'));
  assert.equal(calls.some((c) => c.args[0] === 'workspace' && c.args[1] === 'create'), false);
  const tabCall = calls.find((c) => c.args[0] === 'tab' && c.args[1] === 'create');
  assert.equal(tabCall.options && tabCall.options.windowsHide, true, 'tab create exec must receive windowsHide:true');
});

test('workspace-reuse: a genuinely different directory still takes workspace-create, never tab-create, and the workspace-create exec receives windowsHide:true (win32) (infrastructure-nz2e8)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const calls = [];
  const exec = (bin, args, options) => {
    calls.push({ args, options });
    if (args[0] === 'api')
      return JSON.stringify({ result: { snapshot: { panes: [{ cwd: 'C:\\src\\other', workspace_id: 'w9' }] } } });
    if (args[0] === 'workspace')
      return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: { pane_id: 'w1:p1' } } });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  const spawnFn = () => {};
  await handleBridgeLaunch(req, res, 'C:/src/proj', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
    platform: 'win32',
  });
  assert.equal(res.statusCode, 202);
  assert.ok(calls.some((c) => c.args[0] === 'workspace' && c.args[1] === 'create'));
  assert.equal(calls.some((c) => c.args[0] === 'tab' && c.args[1] === 'create'), false);
  const workspaceCall = calls.find((c) => c.args[0] === 'workspace' && c.args[1] === 'create');
  assert.equal(
    workspaceCall.options && workspaceCall.options.windowsHide,
    true,
    'workspace create exec must receive windowsHide:true',
  );
});

test('topology result.root_pane missing entirely -> 502 "herdr did not report a pane id" (never a spawn)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const exec = (bin, args) => {
    if (args[0] === 'api') return JSON.stringify({ result: { snapshot: { panes: [] } } });
    if (args[0] === 'workspace') return JSON.stringify({ result: { workspace: 'w1', tab: 't1' } }); // no root_pane at all
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
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.parse(res.body).error, 'herdr did not report a pane id');
  assert.equal(spawnCalls.length, 0);
});

test('topology result.root_pane present as an OBJECT with no `.pane_id` -> 502 "herdr did not report a pane id" (the object-without-id case a bare-string read would have missed)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const exec = (bin, args) => {
    if (args[0] === 'api') return JSON.stringify({ result: { snapshot: { panes: [] } } });
    if (args[0] === 'workspace') return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: { tab_id: 'w1:t1' } } });
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
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.parse(res.body).error, 'herdr did not report a pane id');
  assert.equal(spawnCalls.length, 0);
});

// ---------------------------------------------------------------------------
// Captured-JSON fixtures (infrastructure-p3k9r, 2026-09-14) — verbatim
// `.result` subtrees from a REAL `herdr 0.9.0` install (protocol 22),
// captured in a disposable `p3k9r-probe` workspace/tab and closed
// immediately after. Sibling panes trimmed; ids/paths otherwise as
// captured. These pin the two shapes the handler actually has to parse:
// `api snapshot`'s panes[] key the owning workspace as `workspace_id`
// (Shape 1, confirmed — no `workspace` fallback exists on a live install),
// and `workspace create`/`tab create` type `.result.root_pane` as a
// PaneInfo OBJECT whose id lives at `.pane_id`, never a bare string
// (Shape 2, corrected by this task).
// ---------------------------------------------------------------------------

const CAPTURED_HERDR_VERSION = '0.9.0';
const CAPTURED_HERDR_PROTOCOL = 22;
const CAPTURED_PROBE_CWD =
  'C:\\Users\\marco\\AppData\\Local\\Temp\\claude\\C--src-heimeshoff-agentic-agentheim\\9490a32c-3ddd-474b-b91c-b4b34e409415\\scratchpad\\p3k9r-probe';

// `herdr api snapshot` (herdr 0.9.0, protocol 22) — verbatim `.result`
// subtree for the probe's own pane, other live panes trimmed.
const CAPTURED_API_SNAPSHOT_RESULT = {
  snapshot: {
    panes: [
      {
        agent_status: 'unknown',
        cwd: CAPTURED_PROBE_CWD,
        focused: false,
        pane_id: 'w7:p1',
        revision: 0,
        scroll: { max_offset_from_bottom: 0, offset_from_bottom: 0, viewport_rows: 40 },
        tab_id: 'w7:t1',
        terminal_id: 'term_65b6e6452612ba',
        workspace_id: 'w7',
      },
    ],
    protocol: CAPTURED_HERDR_PROTOCOL,
    version: CAPTURED_HERDR_VERSION,
  },
  type: 'session_snapshot',
};

// `herdr workspace create --cwd <probe> --label p3k9r-probe --no-focus`
// (herdr 0.9.0, protocol 22) — verbatim `.result`. Note `root_pane.cwd`
// carries a trailing `\` that the LATER `api snapshot` read above does not
// for the identical pane — a Herdr-side quirk of the create response, not
// something the workspace-reuse comparison (which only ever reads
// `api snapshot`'s panes[]) is exposed to.
const CAPTURED_WORKSPACE_CREATE_RESULT = {
  type: 'workspace_created',
  workspace: {
    active_tab_id: 'w7:t1',
    agent_status: 'unknown',
    focused: false,
    label: 'p3k9r-probe',
    number: 2,
    pane_count: 1,
    tab_count: 1,
    workspace_id: 'w7',
  },
  tab: {
    agent_status: 'unknown',
    focused: false,
    label: '1',
    number: 1,
    pane_count: 1,
    tab_id: 'w7:t1',
    workspace_id: 'w7',
  },
  root_pane: {
    agent_status: 'unknown',
    cwd: `${CAPTURED_PROBE_CWD}\\`,
    focused: false,
    pane_id: 'w7:p1',
    revision: 0,
    scroll: { max_offset_from_bottom: 0, offset_from_bottom: 0, viewport_rows: 40 },
    tab_id: 'w7:t1',
    terminal_id: 'term_65b6e6452612ba',
    workspace_id: 'w7',
  },
};

// `herdr tab create --workspace w7 --cwd <probe> --label p3k9r-probe
// --no-focus` (herdr 0.9.0, protocol 22) — verbatim `.result`, captured
// immediately after the `workspace create` above, reusing its workspace.
const CAPTURED_TAB_CREATE_RESULT = {
  type: 'tab_created',
  tab: {
    agent_status: 'unknown',
    focused: false,
    label: 'p3k9r-probe',
    number: 2,
    pane_count: 1,
    tab_id: 'w7:t2',
    workspace_id: 'w7',
  },
  root_pane: {
    agent_status: 'unknown',
    cwd: `${CAPTURED_PROBE_CWD}\\`,
    focused: false,
    pane_id: 'w7:p2',
    revision: 0,
    scroll: { max_offset_from_bottom: 0, offset_from_bottom: 0, viewport_rows: 40 },
    tab_id: 'w7:t2',
    terminal_id: 'term_65b6e649002e6b',
    workspace_id: 'w7',
  },
};

test('captured herdr 0.9.0 (protocol 22): no matching pane -> workspace create, pane id derived from the verbatim .result.root_pane.pane_id (an OBJECT, not a string)', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const calls = [];
  const exec = (bin, args) => {
    calls.push(args);
    if (args[0] === 'api') return JSON.stringify({ result: CAPTURED_API_SNAPSHOT_RESULT });
    if (args[0] === 'workspace' && args[1] === 'create') return JSON.stringify({ result: CAPTURED_WORKSPACE_CREATE_RESULT });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  let spawnedArgs = null;
  const spawnFn = (bin, args) => {
    spawnedArgs = args;
  };
  // No pane in the captured snapshot has this cwd, so `workspace create` is used.
  await handleBridgeLaunch(req, res, '/no/pane/has/this/cwd', {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
  });
  assert.equal(res.statusCode, 202);
  // infrastructure-w506e: a board launch is the builder's own explicit
  // gesture, so the created workspace must be focused — parity with
  // ADR-0018's terminal.show(). `--no-focus` must never appear.
  const workspaceCreateCall = calls.find((a) => a[0] === 'workspace' && a[1] === 'create');
  assert.deepEqual(workspaceCreateCall, [
    'workspace',
    'create',
    '--cwd',
    '/no/pane/has/this/cwd',
    '--label',
    'do it',
    '--focus',
  ]);
  await new Promise((resolve) => process.nextTick(resolve));
  assert.ok(spawnedArgs, 'agent start must have been spawned');
  assert.equal(spawnedArgs[spawnedArgs.indexOf('--pane') + 1], 'w7:p1');
});

test('captured herdr 0.9.0 (protocol 22): matching pane -> tab create reusing its workspace_id, pane id derived from the verbatim .result.root_pane.pane_id', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const calls = [];
  const exec = (bin, args) => {
    calls.push(args);
    if (args[0] === 'api') return JSON.stringify({ result: CAPTURED_API_SNAPSHOT_RESULT });
    if (args[0] === 'tab' && args[1] === 'create') return JSON.stringify({ result: CAPTURED_TAB_CREATE_RESULT });
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [] } });
    throw new Error(`unexpected exec call: ${args.join(' ')}`);
  };
  let spawnedArgs = null;
  const spawnFn = (bin, args) => {
    spawnedArgs = args;
  };
  // `root` is the EXACT captured pane cwd — the workspace-reuse comparison
  // (`pane.cwd === root`) matches as-is (infrastructure-p3k9r AC4): the
  // `api snapshot` pane cwd this comparison actually reads carries no
  // trailing separator, matching `discoverRoot()`'s `path.resolve()` output.
  await handleBridgeLaunch(req, res, CAPTURED_PROBE_CWD, {
    token: VALID_TOKEN,
    resolveHerdrBinaryFn: () => ({ path: '/fake/herdr', source: 'path', version: null }),
    exec,
    spawnFn,
  });
  assert.equal(res.statusCode, 202);
  const tabCall = calls.find((a) => a[0] === 'tab' && a[1] === 'create');
  assert.ok(tabCall);
  assert.equal(tabCall[tabCall.indexOf('--workspace') + 1], 'w7');
  // infrastructure-w506e: parity with the workspace-create branch — the
  // reused-workspace tab must also be focused, never `--no-focus`.
  assert.deepEqual(tabCall, [
    'tab',
    'create',
    '--workspace',
    'w7',
    '--cwd',
    CAPTURED_PROBE_CWD,
    '--label',
    'do it',
    '--focus',
  ]);
  await new Promise((resolve) => process.nextTick(resolve));
  assert.ok(spawnedArgs, 'agent start must have been spawned');
  assert.equal(spawnedArgs[spawnedArgs.indexOf('--pane') + 1], 'w7:p2');
});

test('202 fires BEFORE agent start is spawned, and agent start failure is never surfaced', async () => {
  const req = makeReq({ headers: tokenHeaders(), body: JSON.stringify({ prompt: 'do it' }) });
  const res = makeRes();
  const exec = (bin, args) => {
    if (args[0] === 'api') return JSON.stringify({ result: { snapshot: { panes: [] } } });
    if (args[0] === 'workspace')
      return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: { pane_id: 'w1:p1' } } });
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
    if (args[0] === 'workspace')
      return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: { pane_id: 'w1:p1' } } });
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
    if (args[0] === 'workspace')
      return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: { pane_id: 'w1:p1' } } });
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
    if (args[0] === 'workspace')
      return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: { pane_id: 'w1:p1' } } });
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
    if (args[0] === 'workspace')
      return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: { pane_id: 'w1:p1' } } });
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
    if (args[0] === 'workspace')
      return JSON.stringify({ result: { workspace: 'w1', tab: 't1', root_pane: { pane_id: 'w1:p1' } } });
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
