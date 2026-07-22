// doctrine-line-pointer — the audit-closure doctrine's (ADR-0069,
// agentic-workflow-f3wqm) live-tree lint banning raw line-number pointers in
// doctrine prose. Doctrine under `skills/`, `agents/`, `references/` must
// reference another doctrine passage by a greppable anchor (a step name, a
// section heading, a rule name) instead of a raw line number, which silently
// goes stale the moment the referenced file is edited — the recurring class
// of finding that resurfaced across three consecutive doctrine audits
// (agentic-workflow-e7dnq, agentic-workflow-k9pbh, and the residual this
// task closes).
//
// Recognized raw-pointer shapes (all banned):
//   - `~:NNN` or `~:NNN-NNN`         (e.g. "SKILL.md ~:55")
//   - `(:NNN)` or `(:NNN-NNN)`        (e.g. "(:428-431)")
//   - `name.md:NNN` / `name.mjs:NNN`  (a bare file:line reference)
//   - `#LNNN` or `#LNNN-LMMM`         (GitHub-style line-anchor links)
// A step/section/rule-name anchor ("Phase 3 step 4", "Runner-first step 2")
// never matches any of these shapes, so ordinary greppable cross-references
// are never flagged.
//
// Shape doctrine (mirrors lib/index-entry-length.mjs):
//   - stdlib-only (node:fs, node:path) — zero dependencies;
//   - side-effect-free — a root path in, plain violation data out; never
//     writes;
//   - loss-tolerant — an unreadable file or directory is skipped, never
//     thrown.
//
// Unlike the INDEX entry-length cap (agentic-workflow-ngzwz), this lint is
// NOT date-grandfathered: a raw line-number pointer has never been a
// legitimate design choice in this codebase, only a drift bug, so there is
// no "old entries are fine" boundary to draw. The escape hatch instead is an
// explicit, enumerated ALLOWLIST below — empty today (grep found nothing to
// grandfather when this lint shipped) — each entry carrying its own
// rationale for why the specific occurrence is not actually a stale-prone
// cross-doctrine pointer.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Directories (relative to repo root) this lint scans, recursively, for `.md` files. */
const SCAN_DIRS = ['skills', 'agents', 'references'];

/** Each shape is tried independently; the first match on a line wins. */
const LINE_POINTER_RES = [
  /~:\d+(?:-\d+)?/,
  /\(:\d+(?:-\d+)?\)/,
  /\b[\w-]+\.(?:md|mjs):\d+\b/,
  /#L\d+(?:-L?\d+)?\b/,
];

/**
 * Explicit, enumerated allowlist. Empty today. Add an entry here only with
 * an inline `rationale` explaining why the specific line is not actually a
 * stale-prone cross-doctrine pointer (e.g. a literal code sample being
 * quoted verbatim, not a doctrine cross-reference). Each entry suppresses
 * only the exact `file` + a line containing `match` (a literal substring),
 * never a whole file or a whole pattern class.
 * @type {{file: string, match: string, rationale: string}[]}
 */
export const ALLOWLIST = [];

function isAllowlisted(relFile, lineText) {
  return ALLOWLIST.some((e) => e.file === relFile && lineText.includes(e.match));
}

/** Recursively collect every `.md` file under `dir`; loss-tolerant on an unreadable directory. */
function walkMarkdownFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Scan `skills/`, `agents/`, `references/` under `root` for raw
 * line-number-pointer shapes. Pure, loss-tolerant, side-effect-free.
 *
 * @param {string} root  Absolute project root (the folder holding skills/, agents/, references/).
 * @returns {{file: string, line: number, text: string, match: string}[]}
 */
export function findLinePointerViolations(root) {
  const violations = [];
  for (const dirName of SCAN_DIRS) {
    const dir = path.join(root, dirName);
    for (const file of walkMarkdownFiles(dir)) {
      let content;
      try {
        content = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const relFile = path.relative(root, file).split(path.sep).join('/');
      const lines = content.split(/\r?\n/);
      lines.forEach((lineText, idx) => {
        if (isAllowlisted(relFile, lineText)) return;
        for (const re of LINE_POINTER_RES) {
          const m = lineText.match(re);
          if (m) {
            violations.push({ file: relFile, line: idx + 1, text: lineText.trim(), match: m[0] });
            break;
          }
        }
      });
    }
  }
  return violations;
}
