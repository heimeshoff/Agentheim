// work-argument-grammar-section — ADR-0059 (mechanize-or-drop) enforcement
// half of ADR-0071's `work` argument grammar (agentic-workflow-swj2q). The
// BC README's ubiquitous-language entry and ADR-0071 both cite
// `skills/work/SKILL.md`'s "Argument grammar" section BY NAME as the single
// source of truth for the `/agentheim:work` positional-id contract that
// agentic-workflow-g4zce's dashboard Work button seeds commands from. A
// convention cited by name from two other doctrine surfaces but never
// mechanically checked is exactly the ADR-0059 gap the verifier flagged
// (iteration 1 of agentic-workflow-swj2q): nothing on disk would notice if a
// future edit renamed or deleted the section out from under those citations.
//
// This lint mechanizes the one piece of that convention that IS a plain
// mechanical predicate (per ADR-0059's "mechanical wherever practical" bar):
// does `skills/work/SKILL.md` still carry a top-level "## Argument grammar"
// heading? It does NOT attempt to verify the section's prose content is
// still semantically correct (grammar composes with `--no-verify`, id
// resolution is fail-closed, etc.) — that stays a verifier/human judgment
// call, mirroring how lib/human-eye-criteria.mjs's own doc explains ADR-0059
// self-referential compliance for judgment-based checks.
//
// Shape doctrine (mirrors lib/doctrine-line-pointer.mjs / lib/id-grammar.mjs):
//   - stdlib-only (node:fs, node:path) — zero dependencies;
//   - side-effect-free — a root path in, plain violation data out; never writes;
//   - loss-tolerant — a missing/unreadable `skills/work/SKILL.md` is reported
//     as a violation (the doctrine surface itself is gone), never thrown.

import { readFileSync } from 'node:fs';
import path from 'node:path';

/** The file this lint guards, relative to the project root. */
export const WORK_SKILL_PATH = path.join('skills', 'work', 'SKILL.md');

/** A top-level markdown heading literally titled "Argument grammar" (any suffix, e.g. an ADR/task-id parenthetical). */
export const ARGUMENT_GRAMMAR_HEADING_RE = /^##\s+Argument grammar\b/m;

/**
 * Check that `skills/work/SKILL.md` still carries its "Argument grammar"
 * section (ADR-0071). Pure, loss-tolerant, side-effect-free.
 *
 * @param {string} root  Absolute project root (the folder holding skills/).
 * @returns {{file: string, reason: string}[]} empty when the section is present.
 */
export function findArgumentGrammarSectionViolations(root) {
  const full = path.join(root, WORK_SKILL_PATH);
  const relFile = WORK_SKILL_PATH.split(path.sep).join('/');
  let content;
  try {
    content = readFileSync(full, 'utf8');
  } catch {
    return [{ file: relFile, reason: 'file is missing or unreadable' }];
  }
  if (!ARGUMENT_GRAMMAR_HEADING_RE.test(content)) {
    return [{ file: relFile, reason: 'no "## Argument grammar" heading found' }];
  }
  return [];
}
