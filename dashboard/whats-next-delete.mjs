// DELETE /api/whats-next (ADR-0046, amending ADR-0027 §4.5): the dashboard's one
// scoped write since ADR-0017 — deleting the whats-next advisory artifact, and
// ONLY that literal file, on an explicit builder dismiss. No request body, no
// client-supplied path: the target is derived server-side from the hardcoded
// artifact path through the same in-root guard every read uses (resolveInRoot,
// discovery.mjs), then asserted against the one precomputed allowed absolute
// path by EXACT STRING EQUALITY — never a prefix/glob match — before any unlink.
// A prefix match against `.agentheim/state/` would also match the sibling
// advisory artifact `state/in-flight.json` (ADR-0043); exact equality can only
// ever authorize this one file.
//
// Idempotent: an already-absent file is success (204), never 404 — two browsers
// dismissing the same recommendation, or a dismiss racing a `whats-next`
// re-run, are both normal outcomes. A genuine non-ENOENT filesystem failure is a
// real error (500) and deletes nothing.

import { unlinkSync } from 'node:fs';
import { resolveInRoot } from './discovery.mjs';

/** The one advisory artifact this endpoint may ever delete (ADR-0027 §2 / ADR-0046). */
export const WHATS_NEXT_RELATIVE_PATH = '.agentheim/state/whats-next.md';

/**
 * Resolve `relativePath` under `root` (through the shared in-root traversal
 * guard) and assert it is EXACTLY the one allowed absolute path — never a
 * prefix/glob match. `relativePath` defaults to the hardcoded constant; the
 * parameter exists so the exact-equality guard itself is unit-testable against
 * an adversarial candidate (e.g. the sibling `state/in-flight.json`), even
 * though the production caller (the DELETE handler below) never supplies one —
 * there is no client-supplied path in the real request at all.
 *
 * @param {string} root — the discovered project root.
 * @param {string} [relativePath] — candidate path to assert; defaults to the
 *   one allowed artifact.
 * @returns {string} the resolved absolute path, when it is the allowed target.
 * @throws when `relativePath` escapes root (resolveInRoot's traversal guard) OR
 *   resolves to any path other than the one allowed target (exact-equality
 *   guard).
 */
export function assertWhatsNextTarget(root, relativePath = WHATS_NEXT_RELATIVE_PATH) {
  const target = resolveInRoot(root, relativePath);
  const allowed = resolveInRoot(root, WHATS_NEXT_RELATIVE_PATH);
  if (target !== allowed) {
    throw new Error(
      `Refusing to delete "${relativePath}": only the whats-next advisory artifact may be deleted.`,
    );
  }
  return target;
}

/**
 * DELETE /api/whats-next — remove the whats-next advisory artifact. Reads no
 * query parameters and no request body; the target is always the hardcoded
 * constant. Returns 204 on success, 204 when already absent (idempotent —
 * never 404), and 500 on a genuine (non-ENOENT) filesystem failure, deleting
 * nothing in that case.
 */
export function handleWhatsNextDelete(req, res, root) {
  let target;
  try {
    target = assertWhatsNextTarget(root);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Failed to delete whats-next artifact: ${err.message}`);
    return;
  }

  try {
    unlinkSync(target);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Failed to delete whats-next artifact: ${err.message}`);
    return;
  }

  res.writeHead(204);
  res.end();
}
