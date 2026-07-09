// Dashboard HTTP server (ADR-0002 + ADR-0006): node:http, stdlib-only, no deps.
// The server is READ-ONLY over task LIFECYCLE (ADR-0017): it serves static
// assets + a health check (agentic-workflow-004), the SSE live-update channel
// GET /api/events (infrastructure-003, ADR-0006), and the read endpoints
// GET /api/tree + GET /api/doc (agentic-workflow-005, ADR-0002). Task lifecycle
// is owned entirely by the skills (`modeling` / `work`); the board reflects
// their on-disk moves via the live-update stream, it never makes them.
//
// ADR-0046 carves ONE bounded, delete-only exception: DELETE /api/whats-next
// removes the whats-next advisory artifact (ADR-0027 §4.5, as amended) on an
// explicit builder dismiss — no client-supplied path, an exact-equality
// allowlist over the one resolved absolute path (whats-next-delete.mjs). This
// touches no lifecycle truth and is dispatched before the method gate below.
//
// ADR-0053 carves a SECOND, distinct exception — a third write category,
// RUNTIME SELF-LIFECYCLE — for POST /api/stop: the server ends its own
// process and removes its own runfile on an explicit builder command from
// the UI (stop-api.mjs). No client-supplied path (there is none to supply);
// also dispatched before the method gate below.

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic, serveIndexHtml } from './static.mjs';
import { handleEvents } from './events.mjs';
import { handleTree, handleDoc, handleSearch, handleBridge } from './read-api.mjs';
import { handleWhatsNextDelete } from './whats-next-delete.mjs';
import { handleStop } from './stop-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Default asset root: the committed dashboard build output, resolved relative to
 * THIS module (ADR-0002 "plugin-relative directory"). The built dist/ always
 * lives beside server.mjs in dashboard/ (committed by infrastructure-002), so
 * this is correct in both layouts — the Agentheim repo itself AND an installed
 * plugin pointed at a foreign project. Resolving against the discovered project
 * root was wrong: per ADR-0004 the dashboard module's location is deliberately
 * decoupled from the project it inspects, so the foreign root holds no dist/.
 * The `root` argument is accepted but ignored — kept for caller compatibility.
 */
export function defaultAssetRoot(_root) {
  return path.join(__dirname, 'dist');
}

/**
 * Build (do not start) the dashboard HTTP server.
 * @param {{ root: string, assetRoot?: string, sse?: object }} opts
 *   root      — discovered project root (.agentheim/ holder), absolute.
 *   assetRoot — committed asset directory; defaults to <root>/dashboard/dist.
 *   sse       — options forwarded to the SSE handler (heartbeatMs, debounceMs,
 *               pollMs); see events.mjs / watcher.mjs.
 */
export function createDashboardServer({ root, assetRoot = defaultAssetRoot(root), sse = {}, stop = {} }) {
  return http.createServer((req, res) => {
    const pathname = (req.url || '/').split('?')[0];

    if (pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'ok', root }));
      return;
    }

    // Live-update push channel (ADR-0006). Long-lived SSE stream rooted at the
    // discovered project; emits tree-changed pointers + heartbeats.
    if (pathname === '/api/events' && req.method === 'GET') {
      handleEvents(req, res, root, sse);
      return;
    }

    // The one scoped advisory DELETE (ADR-0046, amending ADR-0027 §4.5):
    // removes the whats-next advisory artifact — and only that literal file —
    // on an explicit builder dismiss. No request body, no client-supplied
    // path; the target is derived server-side and asserted by exact-equality
    // against the one allowed absolute path before any unlink
    // (whats-next-delete.mjs). Dispatched before the method gate below, same
    // as GET /api/events, so the gate still rejects every OTHER non-GET
    // method (including any other method on this same route) unchanged.
    if (pathname === '/api/whats-next' && req.method === 'DELETE') {
      handleWhatsNextDelete(req, res, root);
      return;
    }

    // The one scoped RUNTIME SELF-LIFECYCLE write (ADR-0053): ends this
    // server process and removes its own runfile on an explicit builder
    // command. No request body, no client-supplied path (stop-api.mjs).
    // Dispatched before the method gate below, same as the two routes
    // above, so the gate still rejects every OTHER non-GET method
    // (including any other method on this same route) unchanged.
    if (pathname === '/api/stop' && req.method === 'POST') {
      handleStop(req, res, root, stop);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    // Read projection of the on-disk tree (aw-005). The board, slide-over, and
    // navigation all rebuild from this single endpoint.
    if (pathname === '/api/tree') {
      handleTree(req, res, root);
      return;
    }

    // Raw-markdown carrier for one in-root artifact (aw-005). Path is validated
    // against the project root before any file is touched.
    if (pathname === '/api/doc') {
      const requestUrl = new URL(req.url, 'http://localhost');
      handleDoc(req, res, root, requestUrl);
      return;
    }

    // Content search across the corpus (aw-050, ADR-0023). The first read that
    // opens bodies in bulk — kept off /api/tree (pointers/metadata only) so the
    // tree contract stays intact. Pure read; q-guard + in-root walk live in the
    // pure core. Empty/short q returns { results: [] } with no walk.
    if (pathname === '/api/search') {
      const requestUrl = new URL(req.url, 'http://localhost');
      handleSearch(req, res, root, requestUrl);
      return;
    }

    // Server-mediated bridge discovery (infrastructure-014, ADR-0018). Reads
    // .agentheim/.dashboard/bridge.json (written by the VS Code extension) via
    // the same in-root validator and serves the { port, token, v } subset, or
    // 200 { present: false } when absent/unreadable/malformed — never a 5xx.
    if (pathname === '/api/bridge') {
      handleBridge(req, res, root);
      return;
    }

    // The index document is served with its <title> rewritten to name the
    // discovered project (infrastructure-011) — server-side so there is no flash
    // of the baked default. Only `/` and `/index.html` take this transform path;
    // every other asset streams verbatim below. Traversal/validation is reused
    // from the same in-root resolver.
    if (pathname === '/' || pathname === '/index.html') {
      serveIndexHtml(req, res, assetRoot, root);
      return;
    }

    // Static handler owns traversal rejection (403), missing-asset/absent-dist
    // (404), and streaming. Unmatched routes (e.g. /api/*) become a 404 here —
    // those endpoints belong to later tasks and are intentionally not built.
    serveStatic(req, res, assetRoot);
  });
}
