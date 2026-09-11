// dashboard-command-bootstrap-dedup — a live-tree lint guarding infrastructure-k9t2v's
// fix: `commands/dashboard.md`'s `node -e` resolver bootstrap (ADR-0002's
// infrastructure-010 addendum) must appear EXACTLY ONCE, with the verb forwarded
// at runtime via `$ARGUMENTS` — never pasted three times (empty / stop / status),
// which was the shape this task removed. A fourth fix to the resolver script would
// otherwise mean editing (and keeping byte-identical) three copies — exactly the
// drift shape ADR-0068's rule is about.
//
// Shape doctrine (mirrors lib/agent-spawn-namespace.mjs / lib/id-grammar.mjs):
//   - stdlib-only (node:fs, node:path) — zero dependencies;
//   - side-effect-free — a root path in, a plain count out; never writes;
//   - loss-tolerant — a missing file/dir never throws, it degrades to 0.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The literal prefix of the resolver bootstrap, up to (but excluding) the
 * trailing verb argument. Shared across all three verbs before
 * infrastructure-k9t2v; counting occurrences of this substring is how a
 * re-duplication (the regression class this lint exists for) is detected.
 */
export const BOOTSTRAP_MARKER =
  "node -e \"const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');";

/**
 * Count how many times the resolver-bootstrap literal occurs in
 * `commands/dashboard.md` under `root`. Pure substring count — no regex, so
 * there is no catastrophic-backtracking risk against a long single-line file.
 *
 * @param {string} root Absolute project root (the folder holding `commands/`).
 * @returns {number} occurrence count (0 if the file/dir is missing or unreadable).
 */
export function countBootstrapOccurrences(root) {
  const cardPath = path.join(root, 'commands', 'dashboard.md');
  if (!existsSync(cardPath)) return 0;
  let content;
  try {
    content = readFileSync(cardPath, 'utf8');
  } catch {
    return 0;
  }
  return content.split(BOOTSTRAP_MARKER).length - 1;
}
