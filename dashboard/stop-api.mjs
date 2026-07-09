// POST /api/stop (ADR-0053): the dashboard's third write category —
// RUNTIME SELF-LIFECYCLE — sibling to the forbidden lifecycle-write ban
// (ADR-0017) and the advisory-write carve-outs (ADR-0027/ADR-0043/ADR-0046).
// On an explicit builder command from the UI, the server ends its OWN process
// and removes its OWN runfile (`.agentheim/.dashboard/runtime.json`) — a
// runtime artifact the dashboard's own launch path already wrote
// (runfile.mjs) and no skill reads. No task lifecycle truth is touched: no
// task moves, no `status` rewrite, no `INDEX.md`/`protocol.md` change.
//
// No request body, no client-supplied path (mirrors whats-next-delete.mjs):
// the target is always `.agentheim/.dashboard/runtime.json`, resolved
// server-side through runfile.mjs's own hardcoded join. There is no path
// parameter to validate because none is ever accepted.
//
// LOAD-BEARING ORDERING: this handler kills the very process serving the
// request (`rf.pid === process.pid`), so the HTTP response MUST be fully
// flushed to the socket before the process exits, or the browser's `fetch`
// rejects and the "Dashboard stopped" overlay never renders. The response is
// written and ended FIRST; only once Node's `res` emits `'finish'` (the
// signal that the response has been handed off to the underlying system) do
// we remove the runfile and exit. An implementation that deletes the runfile
// or exits before `res.end()` — or before `finish` fires — breaks this
// contract; see stop-api.test.mjs for the pinned ordering test.
//
// `exit` is injectable (defaults to `process.exit`) purely so tests can
// observe the call without terminating the test runner's own process.

import { deleteRunfile } from './runfile.mjs';

/**
 * Handle `POST /api/stop`. Responds `204 No Content` immediately, then — only
 * after the response has finished flushing — removes the runfile and ends
 * the process. Idempotent in effect: `deleteRunfile` is already a no-op when
 * the runfile is absent (runfile.mjs), so a stray/duplicate call still
 * responds 204 and still exits.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} root — the discovered project root.
 * @param {{ exit?: (code?: number) => void }} [opts]
 */
export function handleStop(req, res, root, opts = {}) {
  const exit = typeof opts.exit === 'function' ? opts.exit : process.exit;

  res.writeHead(204);
  res.on('finish', () => {
    deleteRunfile(root);
    exit(0);
  });
  res.end();
}
