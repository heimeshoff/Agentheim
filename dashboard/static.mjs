// Minimal static asset handler (ADR-0002): resolve a request path against an
// asset root, reject path traversal, stream with a minimal content-type map.
// No runtime bundler, no in-browser Babel — streams whatever committed assets
// exist under dist/ (produced later by infrastructure-002), with a graceful
// response when dist/ is absent.

import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveInRoot } from './discovery.mjs';
import { resolveProjectName, dashboardTitle, injectTitle } from './project-name.mjs';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** Map a filename/path to a content-type, defaulting to octet-stream. */
export function contentTypeFor(filename) {
  const ext = path.extname(String(filename)).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Serve a GET request for a static asset out of `assetRoot`.
 * - rejects traversal with 403 (touches no file)
 * - 404 when the asset is missing or dist/ is absent (graceful)
 * - streams the file with its content-type otherwise
 * Returns true if it handled the request, false to let other routes try.
 */
export function serveStatic(req, res, assetRoot) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath;

  let target;
  try {
    target = resolveInRoot(assetRoot, rel);
  } catch {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: path traversal rejected');
    return true;
  }

  if (!existsSync(assetRoot)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Dashboard assets not built yet (dist/ is absent). Run the asset build (infrastructure-002).');
    return true;
  }

  if (!existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return true;
  }

  // Cache-Control: no-cache (infrastructure-rgknz) — NOT no-store: the browser
  // still caches the response body but must revalidate with the server on
  // every request before reusing it. A cheap hardening against a browser or
  // VS Code Simple Browser tab left open across a plugin update replaying a
  // stale bundle from its own cache rather than fetching the new server's
  // asset (the server itself already changed underneath the open tab once
  // launch.mjs's version-aware reuse/replace decision swapped it in).
  res.writeHead(200, { 'content-type': contentTypeFor(target), 'cache-control': 'no-cache' });
  createReadStream(target).pipe(res);
  return true;
}

/**
 * Serve dist/index.html with its <title> rewritten to name the discovered
 * project (infrastructure-011). The committed index.html bakes a default title
 * (ADR-0003); since project discovery resolves an arbitrary project root at
 * runtime, the served document must name THAT project. This is a transform of
 * the index response ONLY — every other asset still streams verbatim via
 * serveStatic. Reuses the same in-root resolution as serveStatic, so the
 * traversal/validation guarantees (ADR-0002) are unchanged; falls back to a
 * plain stream if the transform cannot read the file.
 *
 * @param {object} req
 * @param {object} res
 * @param {string} assetRoot — committed dist/ directory.
 * @param {string} root — discovered project root (.agentheim/ holder), absolute.
 */
export function serveIndexHtml(req, res, assetRoot, root) {
  const target = resolveInRoot(assetRoot, 'index.html');

  if (!existsSync(assetRoot)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Dashboard assets not built yet (dist/ is absent). Run the asset build (infrastructure-002).');
    return true;
  }

  if (!existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return true;
  }

  let html;
  try {
    html = readFileSync(target, 'utf8');
    html = injectTitle(html, dashboardTitle(resolveProjectName(root)));
  } catch {
    // Could not transform — stream the committed file unchanged rather than 500.
    res.writeHead(200, { 'content-type': contentTypeFor(target), 'cache-control': 'no-cache' });
    createReadStream(target).pipe(res);
    return true;
  }

  // Cache-Control: no-cache (infrastructure-rgknz) — see serveStatic's 200
  // response for the rationale; the index document gets the same treatment.
  const body = Buffer.from(html, 'utf8');
  res.writeHead(200, {
    'content-type': contentTypeFor(target),
    'content-length': body.length,
    'cache-control': 'no-cache',
  });
  if (req.method === 'HEAD') {
    res.end();
  } else {
    res.end(body);
  }
  return true;
}
