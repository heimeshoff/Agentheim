// Tests for the dashboard board's pure, DOM-free bridge-launch decision logic
// (agentic-workflow-020). The backlog "Quick Capture" / "Modeling" buttons each
// try to LAUNCH a real interactive Claude session through the VS Code bridge
// (ADR-0018), and on ANY failure fall back SILENTLY to copying the command to the
// clipboard (the aw-016 behavior). The decision — discover the bridge via
// `GET /api/bridge`, confirm a live listener via a token-bearing `GET /health`
// (~800 ms timeout), `POST /run { prompt }`, else copy — is a pure function of an
// injected `fetch` + an injected `copy`, so it is unit-testable under
// `node --test`. The React shell in board.js is thin integration glue over this.
//
// ADR-0018 absence contract: EVERY failure mode (present:false, timeout,
// connection-refused, non-200, CORS rejection, any thrown exception) collapses
// silently to the clipboard fallback — never an error, never a throw.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BRIDGE_TOKEN_HEADER,
  launchOrCopy,
} from '../app/bridge-launch.js';

// ---- fetch test doubles -----------------------------------------------------

// A scriptable fetch: routes by URL substring to a queued response or thrower.
function makeFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    for (const [needle, responder] of routes) {
      if (String(url).includes(needle)) return responder(url, opts);
    }
    throw new Error(`unrouted fetch: ${url}`);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

// A copy double that records its argument and reports success.
function makeCopy(result = true) {
  const copied = [];
  const copy = async (text) => { copied.push(text); return result; };
  copy.copied = copied;
  return copy;
}

const PROMPT = '/agentheim:quick-capture';

// ---- the constant -----------------------------------------------------------

test('BRIDGE_TOKEN_HEADER is the contract header (ADR-0018)', () => {
  assert.equal(BRIDGE_TOKEN_HEADER, 'X-Agentheim-Bridge-Token');
});

// ---- happy path: bridge present -> launch -----------------------------------

test('bridge present + healthy + run accepted -> launches, does NOT copy', async () => {
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31425, token: 'abc', v: 1 })],
    ['/health', () => jsonResponse(200, { ok: true, v: 1 })],
    ['/run', () => jsonResponse(202, { ok: true })],
  ]);
  const copy = makeCopy();

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy });

  assert.equal(result.via, 'bridge');
  assert.equal(copy.copied.length, 0, 'must not fall back to clipboard when the bridge launched');
});

test('the POST /run carries the token header and the {prompt} JSON body (ADR-0018 shape)', async () => {
  let runCall = null;
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31426, token: 'tok-xyz', v: 1 })],
    ['/health', () => jsonResponse(200, { ok: true })],
    ['/run', (url, opts) => { runCall = { url, opts }; return jsonResponse(202, { ok: true }); }],
  ]);

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy: makeCopy() });

  assert.equal(result.via, 'bridge');
  assert.ok(runCall, 'POST /run must have fired');
  assert.equal(runCall.opts.method, 'POST');
  assert.match(String(runCall.url), /127\.0\.0\.1:31426\/run$/);
  // token header (case-insensitive lookup, since fetch headers are case-insensitive)
  const headers = runCall.opts.headers || {};
  const tokenVal = headers[BRIDGE_TOKEN_HEADER] ?? headers[BRIDGE_TOKEN_HEADER.toLowerCase()];
  assert.equal(tokenVal, 'tok-xyz');
  assert.match(String(headers['Content-Type'] ?? headers['content-type']), /application\/json/);
  assert.deepEqual(JSON.parse(runCall.opts.body), { prompt: PROMPT });
});

// ---- skipPermissions option threading (agentic-workflow-021) -----------------
//
// The armed toggle (skip-permissions-state.js) is threaded through this ONE seam.
// When `skipPermissions: true`, the POST /run body carries `skipPermissions: true`
// so the bridge (infrastructure-016) seeds `claude --dangerously-skip-permissions`.
// When OFF, the field is OMITTED (never sent `false`) so the body is byte-identical
// to today and matches the contract's strict-`true` activation (amended ADR-0018).

test('skipPermissions:true -> POST /run body includes skipPermissions:true', async () => {
  let runCall = null;
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31430, token: 't', v: 1 })],
    ['/health', () => jsonResponse(200, { ok: true })],
    ['/run', (url, opts) => { runCall = { url, opts }; return jsonResponse(202, { ok: true }); }],
  ]);

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy: makeCopy(), skipPermissions: true });

  assert.equal(result.via, 'bridge');
  assert.deepEqual(JSON.parse(runCall.opts.body), { prompt: PROMPT, skipPermissions: true });
});

test('skipPermissions OFF (false/absent) -> body OMITS the field, never sends false', async () => {
  // absent
  let absentCall = null;
  const fAbsent = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31431, token: 't', v: 1 })],
    ['/health', () => jsonResponse(200, { ok: true })],
    ['/run', (url, opts) => { absentCall = { url, opts }; return jsonResponse(202, { ok: true }); }],
  ]);
  await launchOrCopy({ prompt: PROMPT, fetchImpl: fAbsent, copy: makeCopy() });
  const absentBody = JSON.parse(absentCall.opts.body);
  assert.deepEqual(absentBody, { prompt: PROMPT });
  assert.equal('skipPermissions' in absentBody, false, 'field must be OMITTED, not sent');

  // explicit false
  let falseCall = null;
  const fFalse = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31432, token: 't', v: 1 })],
    ['/health', () => jsonResponse(200, { ok: true })],
    ['/run', (url, opts) => { falseCall = { url, opts }; return jsonResponse(202, { ok: true }); }],
  ]);
  await launchOrCopy({ prompt: PROMPT, fetchImpl: fFalse, copy: makeCopy(), skipPermissions: false });
  const falseBody = JSON.parse(falseCall.opts.body);
  assert.deepEqual(falseBody, { prompt: PROMPT });
  assert.equal('skipPermissions' in falseBody, false, 'OFF must OMIT, never serialize skipPermissions:false');
});

test('a truthy-but-not-true skipPermissions does NOT arm (strict-true only)', async () => {
  let runCall = null;
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31433, token: 't', v: 1 })],
    ['/health', () => jsonResponse(200, { ok: true })],
    ['/run', (url, opts) => { runCall = { url, opts }; return jsonResponse(202, { ok: true }); }],
  ]);
  await launchOrCopy({ prompt: PROMPT, fetchImpl, copy: makeCopy(), skipPermissions: 1 });
  assert.equal('skipPermissions' in JSON.parse(runCall.opts.body), false);
});

test('the clipboard fallback NEVER carries the bypass — it copies only the prompt', async () => {
  // Bridge absent: even with skipPermissions armed, the clipboard copy is the bare
  // prompt (a slash command pasted into a RUNNING session; the bypass is startup-
  // only). The bridge-present/absent asymmetry is accepted (amended ADR-0018).
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { present: false })],
  ]);
  const copy = makeCopy();
  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy, skipPermissions: true });
  assert.equal(result.via, 'clipboard');
  assert.deepEqual(copy.copied, [PROMPT]); // exactly the prompt, no bypass marker.
});

// ---- typographic-quote survival (infrastructure-q8m4t) ----------------------
//
// The non-ASCII sibling of infra-020's shell-metachar guard: German Gänsefüsschen
// `„ "` and guillemets `» «` are not shell syntax, so infra-020's raw-argv fix
// does not touch them — this fixture proves the JSON-body seam (JSON.stringify
// here, mirrored by the bridge's readBody(UTF-8)->JSON.parse on the other end)
// carries them byte-for-byte, both on the POST /run path and the clipboard
// fallback path.

test('POST /run body carries German typographic quotes byte-for-byte (infrastructure-q8m4t)', async () => {
  for (const prompt of ['„Titel"', '»Titel«', '"x"']) {
    let runCall = null;
    const fetchImpl = makeFetch([
      ['/api/bridge', () => jsonResponse(200, { port: 31440, token: 'q', v: 1 })],
      ['/health', () => jsonResponse(200, { ok: true })],
      ['/run', (url, opts) => { runCall = { url, opts }; return jsonResponse(202, { ok: true }); }],
    ]);

    const result = await launchOrCopy({ prompt, fetchImpl, copy: makeCopy() });

    assert.equal(result.via, 'bridge');
    assert.deepEqual(JSON.parse(runCall.opts.body), { prompt }, `"${prompt}" must round-trip byte-for-byte through the JSON body`);
  }
});

test('clipboard fallback copies German typographic quotes verbatim (infrastructure-q8m4t)', async () => {
  for (const prompt of ['„Titel"', '»Titel«', '"x"']) {
    const fetchImpl = makeFetch([
      ['/api/bridge', () => jsonResponse(200, { present: false })],
    ]);
    const copy = makeCopy();

    const result = await launchOrCopy({ prompt, fetchImpl, copy });

    assert.equal(result.via, 'clipboard');
    assert.deepEqual(copy.copied, [prompt], `clipboard fallback must copy "${prompt}" verbatim`);
  }
});

// ---- name threading (infrastructure-c6fzb) ----------------------------------
//
// The prompt bar now derives a display name for the launched session
// (`nameForPromptMode`, prompt-mode.js) and passes it through launchOrCopy so
// POST /run's optional `name` field carries it. Absent/blank OMITS the field
// (never sends an empty/whitespace string) so the bridge falls back to its
// own prompt-derived name.

test('a real name -> POST /run body includes name', async () => {
  let runCall = null;
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31450, token: 'n', v: 1 })],
    ['/health', () => jsonResponse(200, { ok: true })],
    ['/run', (url, opts) => { runCall = { url, opts }; return jsonResponse(202, { ok: true }); }],
  ]);

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy: makeCopy(), name: 'Modeling: dark mode toggle' });

  assert.equal(result.via, 'bridge');
  assert.deepEqual(JSON.parse(runCall.opts.body), { prompt: PROMPT, name: 'Modeling: dark mode toggle' });
});

test('name absent/blank -> body OMITS the field, never sends an empty/whitespace string', async () => {
  // absent
  let absentCall = null;
  const fAbsent = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31451, token: 'n', v: 1 })],
    ['/health', () => jsonResponse(200, { ok: true })],
    ['/run', (url, opts) => { absentCall = { url, opts }; return jsonResponse(202, { ok: true }); }],
  ]);
  await launchOrCopy({ prompt: PROMPT, fetchImpl: fAbsent, copy: makeCopy() });
  assert.equal('name' in JSON.parse(absentCall.opts.body), false, 'field must be OMITTED when no name is supplied');

  // whitespace-only
  let blankCall = null;
  const fBlank = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31452, token: 'n', v: 1 })],
    ['/health', () => jsonResponse(200, { ok: true })],
    ['/run', (url, opts) => { blankCall = { url, opts }; return jsonResponse(202, { ok: true }); }],
  ]);
  await launchOrCopy({ prompt: PROMPT, fetchImpl: fBlank, copy: makeCopy(), name: '   ' });
  assert.equal('name' in JSON.parse(blankCall.opts.body), false, 'a whitespace-only name must be omitted, not sent verbatim');
});

test('name composes with skipPermissions in the same POST /run body', async () => {
  let runCall = null;
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31453, token: 'n', v: 1 })],
    ['/health', () => jsonResponse(200, { ok: true })],
    ['/run', (url, opts) => { runCall = { url, opts }; return jsonResponse(202, { ok: true }); }],
  ]);

  await launchOrCopy({ prompt: PROMPT, fetchImpl, copy: makeCopy(), name: 'Armed Launch', skipPermissions: true });

  assert.deepEqual(JSON.parse(runCall.opts.body), { prompt: PROMPT, skipPermissions: true, name: 'Armed Launch' });
});

test('the clipboard fallback never carries a name — there is no launch to name', async () => {
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { present: false })],
  ]);
  const copy = makeCopy();
  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy, name: 'Modeling: dark mode toggle' });
  assert.equal(result.via, 'clipboard');
  assert.deepEqual(copy.copied, [PROMPT], 'the clipboard copy is the bare prompt, never the name');
});

test('the health probe carries the token header and targets the advertised port', async () => {
  let healthCall = null;
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31427, token: 'h-tok', v: 1 })],
    ['/health', (url, opts) => { healthCall = { url, opts }; return jsonResponse(200, { ok: true }); }],
    ['/run', () => jsonResponse(202, { ok: true })],
  ]);

  await launchOrCopy({ prompt: PROMPT, fetchImpl, copy: makeCopy() });

  assert.ok(healthCall, 'GET /health must have fired');
  assert.match(String(healthCall.url), /127\.0\.0\.1:31427\/health$/);
  const headers = healthCall.opts.headers || {};
  const tokenVal = headers[BRIDGE_TOKEN_HEADER] ?? headers[BRIDGE_TOKEN_HEADER.toLowerCase()];
  assert.equal(tokenVal, 'h-tok');
});

// ---- fallback paths: every failure mode -> clipboard ------------------------

test('bridge absent (present:false) -> copies the prompt, never errors', async () => {
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { present: false })],
  ]);
  const copy = makeCopy();

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy });

  assert.equal(result.via, 'clipboard');
  assert.deepEqual(copy.copied, [PROMPT]);
});

test('/api/bridge itself throwing (e.g. not in Simple Browser, no origin) -> copies', async () => {
  const fetchImpl = makeFetch([
    ['/api/bridge', () => { throw new Error('Failed to fetch'); }],
  ]);
  const copy = makeCopy();

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy });

  assert.equal(result.via, 'clipboard');
  assert.deepEqual(copy.copied, [PROMPT]);
});

test('/api/bridge non-200 -> copies', async () => {
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(500, { error: 'boom' })],
  ]);
  const copy = makeCopy();

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy });

  assert.equal(result.via, 'clipboard');
});

test('bridge advertised but /health fails (connection-refused, stale bridge.json) -> copies', async () => {
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31425, token: 'stale', v: 1 })],
    ['/health', () => { throw new Error('ECONNREFUSED'); }],
  ]);
  const copy = makeCopy();

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy });

  assert.equal(result.via, 'clipboard');
  assert.deepEqual(copy.copied, [PROMPT]);
});

test('bridge advertised + /health 401 (token mismatch on a stale file) -> copies', async () => {
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31425, token: 'stale', v: 1 })],
    ['/health', () => jsonResponse(401, { error: 'unauthorized' })],
  ]);
  const copy = makeCopy();

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy });

  assert.equal(result.via, 'clipboard');
});

test('bridge healthy but POST /run fails (non-2xx) -> copies', async () => {
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31425, token: 'ok', v: 1 })],
    ['/health', () => jsonResponse(200, { ok: true })],
    ['/run', () => jsonResponse(500, { error: 'launch failed' })],
  ]);
  const copy = makeCopy();

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy });

  assert.equal(result.via, 'clipboard');
});

test('bridge healthy but POST /run throws (CORS rejection) -> copies', async () => {
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31425, token: 'ok', v: 1 })],
    ['/health', () => jsonResponse(200, { ok: true })],
    ['/run', () => { throw new Error('blocked by CORS'); }],
  ]);
  const copy = makeCopy();

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy });

  assert.equal(result.via, 'clipboard');
});

test('a missing port/token in the /api/bridge payload -> treated as absent -> copies', async () => {
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { v: 1 })], // no port, no token
  ]);
  const copy = makeCopy();

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy });

  assert.equal(result.via, 'clipboard');
});

// ---- never-throw guarantee --------------------------------------------------

test('launchOrCopy never rejects even if the clipboard copy itself fails', async () => {
  const fetchImpl = makeFetch([
    ['/api/bridge', () => { throw new Error('no origin'); }],
  ]);
  const copy = makeCopy(false); // clipboard blocked too

  // Must resolve, not reject. via is clipboard (the attempted fallback), ok flags
  // that the copy itself did not land.
  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy });
  assert.equal(result.via, 'clipboard');
  assert.equal(result.copied, false);
});

test('no fetch available at all (undefined fetchImpl) -> copies, never throws', async () => {
  const copy = makeCopy();
  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl: undefined, copy });
  assert.equal(result.via, 'clipboard');
  assert.deepEqual(copy.copied, [PROMPT]);
});

// ---- the health timeout is applied ------------------------------------------

test('a hanging /health is bounded by the timeout and falls back to clipboard', async () => {
  const fetchImpl = makeFetch([
    ['/api/bridge', () => jsonResponse(200, { port: 31425, token: 'ok', v: 1 })],
    // /health hangs unless the abort signal fires; honor the injected AbortSignal.
    ['/health', (url, opts) => new Promise((_resolve, reject) => {
      const signal = opts && opts.signal;
      if (signal) {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      }
    })],
  ]);
  const copy = makeCopy();

  const result = await launchOrCopy({ prompt: PROMPT, fetchImpl, copy, healthTimeoutMs: 30 });

  assert.equal(result.via, 'clipboard');
  assert.deepEqual(copy.copied, [PROMPT]);
});
