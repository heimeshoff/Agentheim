// command-bootstrap-dedup — a live-tree lint guarding against a resolver
// bootstrap being pasted more than once into the SAME command card (the
// infrastructure-k9t2v regression class), generalized (infrastructure-x56qm,
// ADR-0068 single-source) beyond its original single card
// (`commands/dashboard.md`) to cover any card carrying the env-independent
// `node -e` resolver bootstrap — today `commands/setup.md`. A fourth fix to a
// resolver script would otherwise mean editing (and keeping byte-identical)
// several copies across cards — exactly the drift shape ADR-0068's rule is
// about.
//
// infrastructure-x56qm ALSO mechanizes the "pointer-only" half of ADR-0079 §3:
// the live-tree gate below asserts `commands/setup.md -> 1` AND
// `commands/dashboard.md -> 0` — the second assertion is what makes
// `/dashboard`'s demotion to a zero-`node`-invocation pointer a structural
// guarantee, not merely a one-time edit that could silently regress.
//
// Shape doctrine (mirrors lib/agent-spawn-namespace.mjs / lib/id-grammar.mjs):
//   - stdlib-only (node:fs, node:path) — zero dependencies;
//   - side-effect-free — a root path + card name in, a plain count out; never writes;
//   - loss-tolerant — a missing file/dir never throws, it degrades to 0.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The literal prefix of the resolver bootstrap, up to (but excluding) the
 * trailing target-module / verb argument. Shared across every card that
 * carries the env-independent `node -e` bootstrap (`references/lib-bootstrap.md`);
 * counting occurrences of this substring is how a re-duplication (the
 * regression class this lint exists for) is detected.
 */
export const BOOTSTRAP_MARKER =
  "node -e \"const fs=require('node:fs'),os=require('node:os'),p=require('node:path'),u=require('node:url');";

/**
 * Count how many times the resolver-bootstrap literal occurs in
 * `commands/<cardName>` under `root`. Pure substring count — no regex, so
 * there is no catastrophic-backtracking risk against a long single-line file.
 *
 * @param {string} root Absolute project root (the folder holding `commands/`).
 * @param {string} [cardName] The card filename under `commands/`; defaults to
 *   `dashboard.md` (infrastructure-k9t2v's original, sole caller, preserved
 *   for backward compatibility with any existing callsite that omits it).
 * @returns {number} occurrence count (0 if the file/dir is missing or unreadable).
 */
export function countBootstrapOccurrences(root, cardName = 'dashboard.md') {
  const cardPath = path.join(root, 'commands', cardName);
  if (!existsSync(cardPath)) return 0;
  let content;
  try {
    content = readFileSync(cardPath, 'utf8');
  } catch {
    return 0;
  }
  return content.split(BOOTSTRAP_MARKER).length - 1;
}
