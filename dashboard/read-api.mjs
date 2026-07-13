// Dashboard read endpoints (agentic-workflow-005, ADR-0002):
//   GET /api/tree          — the BC × lifecycle × task projection + artifact
//                            locations (pointers/metadata, never bodies).
//   GET /api/doc?path=<rel> — raw markdown for one in-root artifact; a validated
//                            file carrier (rendering is client-side, aw-007).
// Both are PURE READS. Path safety reuses the aw-004 root guard (resolveInRoot:
// path.resolve + startsWith(root)) so no request escapes the project.

import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveInRoot } from './discovery.mjs';
import { buildTree } from './tree.mjs';
import { searchCorpus } from './search.mjs';

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
 * GET /api/bridge (infrastructure-014, ADR-0018) — server-mediated discovery of
 * the VS Code bridge listener for the sandboxed (filesystem-blind) frontend.
 *
 * Reads `.agentheim/.dashboard/bridge.json` (written by the extension,
 * infrastructure-013) through the same in-root path validator as /api/doc, and
 * returns the discovery subset `{ port, token, v, capabilities }` — never
 * pid/startedAt. `capabilities` (infrastructure-v8r3q) is belt-and-braces
 * only: bridge.json is written by a separate process on its own activation
 * lifecycle and can lag or race the listener it describes, so a caller that
 * needs a trustworthy answer probes the live `GET /health` instead. A
 * bridge.json written by a pre-handshake bridge simply has no `capabilities`
 * field, which is passed through unchanged (JSON.stringify drops it).
 *
 * Pure transport: it carries the published contract, invents no rule, runs no
 * `claude`. When the file is absent, unreadable, or malformed, it returns
 * `200 { present: false }` so the frontend degrades silently to clipboard —
 * NEVER a 5xx for normal absence.
 */
export function handleBridge(req, res, root) {
  const absent = () => {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ present: false }));
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
  res.end(JSON.stringify({ port, token, v, capabilities }));
}
