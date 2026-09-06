// findDuplicateTaskIds — the duplicate task-id guard (ADR-0028 insurance).
//
// This is agentic-workflow DOMAIN logic: a pure, side-effect-free scanner that
// reads the task-lifecycle tree and reports any id claimed by more than one file.
//
// ADR-0028 makes new task ids `<bc>-<token>` (a random 5-char tail), collision-
// free *by construction* at the realistic concurrent window — but a tiny residual
// birthday-collision tail remains, and a token could also clash with a legacy id
// only through a bug. ADR-0028 §Consequences names a duplicate-id check as the
// cheap INSURANCE against that tail, rather than a longer token. This module is
// that insurance. It backstops the invariants the id keys:
//   - ADR-0012's anchored id→file resolution (one id must name one file);
//   - ADR-0022's "ids are retired, never reused";
//   - the `[<id>]` commit trailer (ADR-0026) and the backlink edges
//     (`depends_on` / `blocks` / `prior_art` / `related_tasks`).
// Two files claiming one id silently corrupts all of the above.
//
// Shape doctrine (mirrors lib/task-lifecycle.mjs and dashboard/tree.mjs):
//   - stdlib-only (node:fs, node:path) — zero dependencies;
//   - side-effect-free — a root path in, plain data out; it never writes or moves;
//   - loss-tolerant — disk is the source of truth, so a single bad file (missing
//     frontmatter, unreadable) degrades to a filename-derived id or is skipped,
//     never throwing and aborting the whole scan;
//   - SHAPE-AGNOSTIC — ids are compared as WHOLE strings. It never parses the tail,
//     never splits id/slug, so it is independent of the ADR-0028 token grammar and
//     of deriveContext's dual-shape regex. Legacy `<bc>-NNN` and new `<bc>-<token>`
//     ids collide iff their whole id strings are equal.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { listBoardContexts, taskFolderPath } from './task-system-paths.mjs';

/** The four lifecycle folders walked for every bounded context. */
export const LIFECYCLE_FOLDERS = ['backlog', 'todo', 'doing', 'done'];

/**
 * Extract a task's id from a file. The frontmatter `id:` is the source of truth;
 * when it is absent or malformed, fall back to the filename's `<id>-…` prefix or
 * bare `<id>.md` (disk is the source of truth — the scanner is loss-tolerant and
 * never throws on a single bad file). Returns null only when nothing usable can be
 * derived (e.g. an empty filename), so that file is simply not counted.
 *
 * @param {string} absFile  Absolute path to a `.md` task file.
 * @param {string} fileName Its basename (passed in to avoid a re-derive).
 * @returns {string|null}
 */
function idForFile(absFile, fileName) {
  // 1. Frontmatter `id:` — whole value, trimmed. Quotes (rare) are stripped.
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

  // 2. Filename fallback: `<id>-<slug>.md` or `<id>.md`. We take the basename
  //    minus the `.md` extension; that whole stem is the id when there is no
  //    slug, or `<id>-<slug>` when there is. Since the id and slug are not
  //    distinguishable from the filename alone without parsing the tail (which we
  //    refuse to do), this fallback is best-effort: it is only reached when
  //    frontmatter is missing, and a frontmatter-less task is already malformed.
  //    Using the full stem keeps the comparison whole-string and never throws.
  const stem = fileName.replace(/\.md$/i, '');
  return stem || null;
}

/**
 * List the `.md` files directly inside one directory. Loss-tolerant: an absent or
 * unreadable directory yields `[]` rather than throwing, so one missing lifecycle
 * folder never aborts the whole-tree scan.
 *
 * @returns {string[]} basenames of `.md` files (not absolute paths).
 */
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

/**
 * Walk every BC's four lifecycle folders (`lib/task-system-paths.mjs` resolves
 * the actual root — `contexts/` under `'legacy'`, `board/` under `'board'`),
 * collect each task file's id, and report every id claimed by more than one file.
 *
 * Pure and side-effect-free: a root path in, plain data out. Loss-tolerant: a
 * single bad file or missing folder never throws or aborts the scan. Ids are
 * compared as WHOLE strings — shape-agnostic, independent of the ADR-0028 grammar.
 *
 * @param {string} root  Absolute project root (the folder holding `.agentheim/`).
 * @returns {Array<{id: string, paths: string[]}>}
 *   One entry per duplicated id, each with the SORTED absolute paths of every
 *   colliding file. Empty array when every id is unique. Sorted by id for a
 *   deterministic report.
 */
export function findDuplicateTaskIds(root) {
  /** @type {Map<string, string[]>} id → absolute paths claiming it. */
  const seen = new Map();

  for (const bc of listBoardContexts(root)) {
    for (const folder of LIFECYCLE_FOLDERS) {
      const dir = taskFolderPath(root, bc, folder);
      for (const fileName of mdFilesIn(dir)) {
        const absFile = path.join(dir, fileName);
        const id = idForFile(absFile, fileName);
        if (!id) continue;
        const paths = seen.get(id);
        if (paths) paths.push(absFile);
        else seen.set(id, [absFile]);
      }
    }
  }

  const duplicates = [];
  for (const [id, paths] of seen) {
    if (paths.length > 1) {
      duplicates.push({ id, paths: [...paths].sort() });
    }
  }
  duplicates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return duplicates;
}

/**
 * Render a clear, multi-line failure message naming each duplicated id and all of
 * its colliding files. Returns the empty string when there are no duplicates, so a
 * caller can `if (msg) fail(msg)`.
 *
 * @param {Array<{id: string, paths: string[]}>} duplicates
 * @returns {string}
 */
export function formatDuplicateReport(duplicates) {
  if (!duplicates || duplicates.length === 0) return '';
  const lines = [
    `Duplicate task id(s) found — ${duplicates.length} id(s) claimed by more than one file:`,
  ];
  for (const { id, paths } of duplicates) {
    lines.push(`  ${id} (${paths.length} files):`);
    for (const p of paths) lines.push(`    - ${p}`);
  }
  return lines.join('\n');
}
