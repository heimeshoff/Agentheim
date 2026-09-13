// Dashboard read endpoints (agentic-workflow-005, ADR-0002):
//   GET /api/tree          — the BC × lifecycle × task projection + artifact
//                            locations (pointers/metadata, never bodies).
//   GET /api/doc?path=<rel> — raw markdown for one in-root artifact; a validated
//                            file carrier (rendering is client-side, aw-007).
// Both are PURE READS. Path safety reuses the aw-004 root guard (resolveInRoot:
// path.resolve + startsWith(root)) so no request escapes the project.

import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveInRoot } from './discovery.mjs';
import { buildTree } from './tree.mjs';
import { searchCorpus } from './search.mjs';
import { readBridgeSelection } from '../lib/bridge-selection.mjs';
import { resolveHerdrBinary, checkHerdrLiveness } from '../lib/resolve-herdr.mjs';
import { HERDR_CAPABILITIES } from './bridge-launch-api.mjs';

/** GET /api/tree — serialize the read projection of the discovered root. */
export function handleTree(req, res, root) {
  let body;
  try {
    body = JSON.stringify(buildTree(root));
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Failed to build tree projection: ${err.message}`);
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
}

/**
 * GET /api/doc?path=<.agentheim-relative-or-project-relative path> — stream the
 * raw markdown of one in-root file. Validates the requested path against the
 * project root; an escaping path is rejected 403 and touches no file.
 */
export function handleDoc(req, res, root, requestUrl) {
  const rawPath = requestUrl.searchParams.get('path');
  if (!rawPath) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Missing required query parameter: path');
    return;
  }

  let target;
  try {
    target = resolveInRoot(root, rawPath);
  } catch {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: path traversal rejected');
    return;
  }

  if (!existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(target).pipe(res);
}

/**
 * GET /api/search?q=<term> — the read-only server's first CONTENT search
 * (agentic-workflow-050, ADR-0023). A pure corpus walk reads bodies, ranks
 * title-first, returns body-excerpted matches as `{ query, results: [...] }`.
 *
 * This route is THIN: it reads `q`, then delegates the walk/rank/excerpt to the
 * pure searchCorpus core, which itself reuses the in-root guard so the walk can
 * never traverse out. An empty/whitespace/short `q` returns `{ query, results: []
 * }` with no walk (searchCorpus short-circuits). Pure read: no file written.
 */
export function handleSearch(req, res, root, requestUrl) {
  const query = requestUrl.searchParams.get('q') || '';
  let body;
  try {
    body = JSON.stringify({ query, results: searchCorpus(root, query) });
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Failed to search corpus: ${err.message}`);
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body);
}

/**
 * GET /api/bridge (infrastructure-014, ADR-0018; grown a `kind` field and a
 * distinct Herdr shape by ADR-0082 §1/§3, infrastructure-xh8tw) —
 * server-mediated bridge discovery for the sandboxed (filesystem-blind)
 * frontend.
 *
 * Every response additively carries `kind` — the per-machine bridge
 * selection recorded by `/setup use bridge <kind>`
 * (`readBridgeSelection(homedir)`), verbatim, `null` when unset.
 *
 * When the recorded selection is `'herdr'`, this endpoint takes a WHOLLY
 * DIFFERENT branch — it never reads `bridge.json` (Herdr writes none; the
 * launch is server-mediated, not browser-mediated) — and returns
 * `{ present: true, kind: 'herdr', token, capabilities, live }`: `token` is
 * the per-process token minted once at server start (server.mjs), the only
 * way the frontend can ever learn it; `capabilities` is
 * `HERDR_CAPABILITIES` (bridge-launch-api.mjs); `live` is a bounded,
 * short-TTL-cached `checkHerdrLiveness` call (socket-file check + a bounded
 * `herdr status` spawn — no second network hop, producer and consumer are
 * the same process).
 *
 * Otherwise (kind is `'vscode'`, `'none'`, or `null`) — UNCHANGED from
 * ADR-0018: reads `.agentheim/.dashboard/bridge.json` (written by the VS
 * Code extension, infrastructure-013) through the same in-root path
 * validator as /api/doc, and returns the discovery subset
 * `{ port, token, v, capabilities }` — never pid/startedAt — plus the new
 * additive `kind`. `capabilities` here (infrastructure-v8r3q) is
 * belt-and-braces only: bridge.json is written by a separate process on its
 * own activation lifecycle and can lag or race the listener it describes, so
 * a caller that needs a trustworthy answer probes the live `GET /health`
 * instead. A bridge.json written by a pre-handshake bridge simply has no
 * `capabilities` field, passed through unchanged (JSON.stringify drops it).
 * Absent/unreadable/malformed bridge.json → `200 { present: false, kind }` —
 * NEVER a 5xx for normal absence.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} root
 * @param {object} [opts]
 * @param {string} [opts.homedir] — defaults to `os.homedir()`.
 * @param {string} [opts.token] — the per-process bridge token; only surfaced when `kind === 'herdr'`.
 * @param {{resolve?: object, liveness?: object}} [opts.herdr] — deps forwarded to `resolveHerdrBinary`/`checkHerdrLiveness`.
 */
export function handleBridge(req, res, root, opts = {}) {
  const homedir = opts.homedir ?? os.homedir();
  const { bridge: kind } = readBridgeSelection(homedir);

  if (kind === 'herdr') {
    const resolveDeps = opts.herdr?.resolve ?? {};
    const livenessDeps = opts.herdr?.liveness ?? {};
    const resolved = resolveHerdrBinary({ homedir, ...resolveDeps });
    const live = checkHerdrLiveness({ homedir, binaryPath: resolved.path ?? undefined, ...livenessDeps });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        present: true,
        kind: 'herdr',
        token: opts.token,
        capabilities: HERDR_CAPABILITIES,
        live,
      }),
    );
    return;
  }

  const absent = () => {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ present: false, kind }));
  };

  let bridge;
  try {
    const target = resolveInRoot(root, path.join('.agentheim', '.dashboard', 'bridge.json'));
    bridge = JSON.parse(readFileSync(target, 'utf8'));
  } catch {
    // Missing file, unreadable, or malformed JSON all collapse to absence.
    absent();
    return;
  }

  if (!bridge || typeof bridge !== 'object') {
    absent();
    return;
  }

  const { port, token, v, capabilities } = bridge;
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ port, token, v, capabilities, kind }));
}
