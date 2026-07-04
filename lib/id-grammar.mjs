// id-grammar — the ADR-0028 §1 task-id grammar's single source of truth, plus a
// live-tree well-formedness lint (ADR-0044).
//
// This is agentic-workflow DOMAIN logic: a pure, side-effect-free classifier for
// a task id's TAIL shape, plus a scanner that reports any on-disk id that fails
// the grammar and is not explicitly grandfathered.
//
// Why this exists (ADR-0044, amending ADR-0028 §3-4): `deriveContext`
// (lib/task-lifecycle.mjs) was loosened to be digit-lead-TOLERANT — it resolves
// a BC from a 5-char in-charset tail whether or not it leads with a letter,
// because a real out-of-spec id (`infrastructure-5w5gs`) already shipped and the
// resolver must not strand it. But that loosening only fixes READING an
// already-bad id; nothing stops a future MINT from producing another one, since
// ids are minted by agent prose (references/id-grammar.md) with no code
// generator in the loop. This module is the strict half of that split: the
// grammar's single source of truth for what a WELL-FORMED new token looks like,
// used both by the minting skills (verify-and-re-mint) and by a live-tree test
// (the always-on backstop, mirroring agentic-workflow-080's duplicate-id guard).
//
// Deliberately NOT folded into lib/duplicate-id-check.mjs: that module is
// charter-bound (its own header, lines 24-27) to compare ids as WHOLE strings and
// never parse the tail. Well-formedness logic — which must parse the tail —
// belongs in its own module.
//
// Shape doctrine (mirrors lib/duplicate-id-check.mjs and lib/task-lifecycle.mjs):
//   - stdlib-only (node:fs, node:path) — zero dependencies;
//   - side-effect-free — a root path (or bare id) in, plain data out; never
//     writes or moves anything;
//   - loss-tolerant on the tree walk — a single bad file degrades to a
//     filename-derived id or is skipped, never throwing and aborting the scan.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** The four lifecycle folders walked for every bounded context (mirrors duplicate-id-check.mjs). */
const LIFECYCLE_FOLDERS = ['backlog', 'todo', 'doing', 'done'];

/**
 * Ids that are `malformed` per the strict grammar but must NEVER be flagged or
 * renumbered, because ADR-0028 §5 (never-renumber) forbids rewriting an id once
 * it has shipped. Currently a single entry: `infrastructure-5w5gs`, the
 * out-of-spec (digit-leading) token that motivated ADR-0044. Extend this list
 * only for an id that has ALREADY shipped on disk before this lint existed —
 * never as a way to permit a new out-of-spec mint.
 */
export const GRANDFATHERED_IDS = Object.freeze(['infrastructure-5w5gs']);

/** Strict ADR-0028 §1 token grammar: 5 chars, Crockford-minus-`ilou`, leading letter. */
const STRICT_TOKEN_RE = /^[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{4}$/;

/** Legacy tail: all digits (any length ≥ 1), e.g. `077`, `001`, `5w5gs`'s sibling `020`. */
const LEGACY_TAIL_RE = /^\d+$/;

/**
 * Classify a bare task id's tail against the ADR-0028 §1 grammar.
 *
 * - `'legacy'` — the tail after the last `-` is all digits (`-077`, reserved
 *   foundation ids like `-001` included — they need no grandfather entry).
 * - `'token'` — the tail is the STRICT well-formed shape: exactly 5 chars,
 *   Crockford base32 minus the look-alikes `i l o u`, leading with a letter.
 *   Deliberately stricter than `deriveContext`'s resolver regex (ADR-0044) —
 *   this is the minting-time bar, not the reading-time one.
 * - `'malformed'` — anything else: no recognizable tail, wrong length, an
 *   out-of-charset character, or (the ADR-0044 case) a digit-leading 5-char
 *   tail such as `infrastructure-5w5gs`'s `5w5gs`.
 *
 * @param {string} id
 * @returns {'token'|'legacy'|'malformed'}
 */
export function classifyTaskId(id) {
  const s = String(id);
  const idx = s.lastIndexOf('-');
  if (idx === -1) return 'malformed';
  const tail = s.slice(idx + 1);
  if (!tail) return 'malformed';
  if (LEGACY_TAIL_RE.test(tail)) return 'legacy';
  if (STRICT_TOKEN_RE.test(tail)) return 'token';
  return 'malformed';
}

/**
 * `true` when an id is well-formed under the strict grammar — either a legacy
 * all-digit tail or a strict ADR-0028 §1 token. `false` for `'malformed'`.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function isWellFormedTaskId(id) {
  return classifyTaskId(id) !== 'malformed';
}

/** Extract a task's id from a file, frontmatter-`id`-first (mirrors duplicate-id-check.mjs). */
function idForFile(absFile, fileName) {
  try {
    const content = readFileSync(absFile, 'utf8');
    const m = content.match(/^id:\s*(.+?)\s*$/m);
    if (m) {
      const raw = m[1].trim().replace(/^["']|["']$/g, '').trim();
      if (raw) return raw;
    }
  } catch {
    // Unreadable file → fall through to the filename. Never abort the walk.
  }
  const stem = fileName.replace(/\.md$/i, '');
  return stem || null;
}

/** List the `.md` files directly inside one directory; loss-tolerant. */
function mdFilesIn(dir) {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/** Bounded-context directory names under `<root>/.agentheim/contexts/`. */
function contextNames(contextsDir) {
  if (!existsSync(contextsDir)) return [];
  try {
    return readdirSync(contextsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Walk every BC's four lifecycle folders under `<root>/.agentheim/contexts/`
 * and return every id that classifies `malformed` and is NOT in
 * `GRANDFATHERED_IDS`. Pure and side-effect-free; loss-tolerant like
 * `findDuplicateTaskIds`.
 *
 * @param {string} root Absolute project root (the folder holding `.agentheim/`).
 * @returns {string[]} malformed, non-grandfathered ids, sorted.
 */
export function findMalformedTaskIds(root) {
  const contextsDir = path.join(root, '.agentheim', 'contexts');
  const seen = new Set();

  for (const bc of contextNames(contextsDir)) {
    for (const folder of LIFECYCLE_FOLDERS) {
      const dir = path.join(contextsDir, bc, folder);
      for (const fileName of mdFilesIn(dir)) {
        const absFile = path.join(dir, fileName);
        const id = idForFile(absFile, fileName);
        if (!id) continue;
        if (classifyTaskId(id) !== 'malformed') continue;
        if (GRANDFATHERED_IDS.includes(id)) continue;
        seen.add(id);
      }
    }
  }

  return [...seen].sort();
}
