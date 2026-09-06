// index-entry-length — ADR-0060's live-tree lint for the INDEX entry-length
// cap (agentic-workflow-ngzwz). Flags a NEWLY WRITTEN INDEX.md task or ADR
// bullet whose descriptive prose exceeds the ~2-3 sentence / ~60-word cap
// `skills/work/SKILL.md`'s "Index updates" and `skills/modeling/SKILL.md`'s
// "Updating indexes" now state: the claim + the pointer, detail lives in the
// linked artifact.
//
// Per the task's no-retroactive-rewrite decision (mirrors ADR-0039's verbatim
// cap-and-roll discipline and ADR-0044's GRANDFATHERED_IDS shape), an
// existing over-length entry is never flagged or rewritten. Rather than an
// explicit per-id allowlist (impractical here — dozens of pre-existing
// entries would need enumerating, unlike ADR-0044's single stray id),
// grandfathering is done by DATE: an entry's "new-ness" is derived from the
// `completed`/`created` frontmatter of the task file it points at (task
// lines) or the `date` frontmatter of the ADR it points at (ADR lines). An
// entry dated ON OR BEFORE `ADOPTION_DATE` is grandfathered; only an entry
// dated STRICTLY AFTER adoption must satisfy the cap. This is the "entries
// newer than adoption" scoping ADR-0059/agentic-workflow-z394j's
// mechanize-or-drop doctrine names as one of the two sanctioned lint shapes,
// and it is what keeps this lint GREEN on the current tree despite the many
// pre-existing long entries this task's own Why section names as the problem
// (see `lib/test/index-entry-length.test.mjs`'s live-tree test).
//
// Known limitation, recorded rather than hidden (see ADR-0060 Consequences):
// an entry written ON the adoption date itself is indistinguishable from a
// pre-adoption entry (both compare `<= ADOPTION_DATE`) and is grandfathered
// too — enforcement is effectively "starting the day after adoption ships."
// Moving `ADOPTION_DATE` backward would silently un-grandfather already-
// shipped entries and must never be done.
//
// Shape doctrine (mirrors lib/id-grammar.mjs / lib/index-rotation.mjs):
//   - stdlib-only (node:fs, node:path) — zero dependencies;
//   - side-effect-free — a path in, plain violation data out; never writes;
//   - loss-tolerant — an unparseable line, an unreadable linked file, or a
//     missing/unrecognized date never aborts the scan; it degrades to "can't
//     tell, so don't flag it" (grandfathered by default), the same posture
//     `deriveEntryMonth` (lib/index-rotation.mjs) and `idForFile`
//     (lib/id-grammar.mjs) already use for their own unreadable-file cases.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  detectLayout,
  listBoardContexts,
  listKnowledgeContexts,
  taskIndexPath,
  knowledgeIndexPath,
  topIndexPath as resolveTopIndexPath,
} from './task-system-paths.mjs';

/**
 * The date this doctrine took effect (the day agentic-workflow-ngzwz
 * shipped). An entry dated on or before this date is grandfathered — left
 * verbatim, per the no-retroactive-rewrite decision. Only an entry dated
 * strictly after this is held to `MAX_WORDS`. Never move this date backward.
 */
export const ADOPTION_DATE = '2026-07-21';

/** The hard cap: an entry's descriptive prose may run at most this many words (~2-3 sentences). */
export const MAX_WORDS = 60;

/**
 * One INDEX.md task/ADR bullet, tolerant of every on-disk shape this project
 * uses:
 *   - per-BC task/ADR line:  `- **<id>** — <prose...> — \`<pointer>\``
 *   - top-level adr-global:  `- **ADR-NNNN — <title>** (<date>, <status>) — <prose...> — \`<pointer>\``
 * Group 1 is the first bold span's raw content (id-only, or id+title
 * combined); group 2 is everything between the bold span and the final
 * pointer (greedy, so embedded em-dashes/backticks inside the prose itself
 * stay in group 2 — the pattern is right-anchored on the LAST
 * ` — \`...\`` before end-of-line, which is always the pointer).
 */
const ENTRY_LINE = /^- \*\*(.+?)\*\*(.*)\s+—\s+`([^`]+)`\s*\r?$/;

/** Sections holding task lines (per-BC INDEX.md only) — date comes from the linked task's frontmatter. */
const TASK_SECTIONS = ['todo-list', 'doing-list', 'done-list', 'backlog-list'];

/** Sections holding ADR lines (per-BC `adr-local` + top-level `adr-global`) — date comes from the linked ADR's frontmatter. */
const ADR_SECTIONS = ['adr-local', 'adr-global'];

function blockRe(section) {
  return new RegExp(`<!-- ${section}:start -->\\r?\\n([\\s\\S]*?)<!-- ${section}:end -->`);
}

/** Extract every matched entry from one marker block; a non-matching line (or a missing block) is loss-tolerantly skipped. */
function entriesInSection(content, section) {
  const m = content.match(blockRe(section));
  if (!m) return [];
  const out = [];
  for (const line of m[1].split('\n')) {
    if (line.trim() === '') continue;
    const lm = line.match(ENTRY_LINE);
    if (!lm) continue;
    const head = lm[1];
    const idMatch = head.match(/^(\S+)/);
    out.push({ id: idMatch ? idMatch[1] : head, prose: lm[2], pointer: lm[3] });
  }
  return out;
}

/** Word count of an entry's descriptive prose, stripping a leading `— ` separator if present (the per-BC line shape). */
function proseWordCount(raw) {
  const stripped = raw.replace(/^\s*—\s*/, '').trim();
  if (!stripped) return 0;
  return stripped.split(/\s+/).filter(Boolean).length;
}

/**
 * Read a single frontmatter field's raw value from a file; `null` if
 * unreadable, missing, or blank. Deliberately uses `[ \t]*` (never `\s*`)
 * around the value so a BLANK field (e.g. an in-progress task's
 * `completed: `) can never let the match bleed across the newline into the
 * next frontmatter line or the `---` closing fence — a real bug this
 * function's own tests caught (`\s*` silently captured the next line's `-`
 * lead-in as the "date").
 */
function frontmatterField(absFile, field) {
  let content;
  try {
    content = readFileSync(absFile, 'utf8');
  } catch {
    return null;
  }
  const m = content.match(new RegExp(`^${field}:[ \\t]*(\\S.*?)[ \\t]*\\r?$`, 'm'));
  if (!m) return null;
  const raw = m[1].trim().replace(/^["']|["']$/g, '').trim();
  return raw || null;
}

/** A task entry's date: `completed` (done tasks) if present, else `created`. */
function taskEntryDate(absFile) {
  return frontmatterField(absFile, 'completed') || frontmatterField(absFile, 'created');
}

/** An ADR entry's date: its `date` frontmatter field. */
function adrEntryDate(absFile) {
  return frontmatterField(absFile, 'date');
}

/**
 * Check one INDEX.md's task + ADR sections for over-length, non-grandfathered
 * entries. Pure, loss-tolerant, side-effect-free.
 *
 * @param {string} indexPath  Absolute path to an INDEX.md (per-BC or top-level).
 * @param {string} baseDir    Absolute directory pointer paths inside this file
 *                             are relative to. Per-BC `INDEX.md` pointers are
 *                             relative to the file's OWN directory; the
 *                             top-level `.agentheim/knowledge/index.md`'s
 *                             pointers (`knowledge/decisions/...`) are
 *                             relative to `.agentheim/` instead — one level
 *                             above the file itself — so callers must pass
 *                             the right base rather than deriving it from
 *                             `indexPath`.
 * @param {string[]} [sections] Which marker sections to check. Defaults to
 *                             every task + ADR section (the `'legacy'`-layout
 *                             shape, where one file carries both halves).
 * @returns {{file:string, section:string, id:string, words:number, date:string}[]}
 */
export function findOverLengthEntriesInIndex(
  indexPath,
  baseDir,
  sections = [...TASK_SECTIONS, ...ADR_SECTIONS]
) {
  if (!existsSync(indexPath)) return [];
  let content;
  try {
    content = readFileSync(indexPath, 'utf8');
  } catch {
    return [];
  }
  const violations = [];

  const check = (checkSections, dateFn) => {
    for (const section of checkSections) {
      for (const entry of entriesInSection(content, section)) {
        const words = proseWordCount(entry.prose);
        if (words <= MAX_WORDS) continue;
        const absFile = path.join(baseDir, entry.pointer);
        const date = dateFn(absFile);
        if (!date || date <= ADOPTION_DATE) continue; // grandfathered, or undated -> can't tell
        violations.push({ file: indexPath, section, id: entry.id, words, date });
      }
    }
  };

  check(sections.filter((s) => TASK_SECTIONS.includes(s)), taskEntryDate);
  check(sections.filter((s) => ADR_SECTIONS.includes(s)), adrEntryDate);

  return violations;
}

/**
 * Walk every per-BC INDEX (task half + knowledge half — under `'legacy'` the
 * two halves are the SAME file, so it is checked once with both section
 * groups) plus the top-level `.agentheim/knowledge/index.md`, and return
 * every over-length, non-grandfathered task/ADR entry found.
 *
 * @param {string} root  Absolute project root (the folder holding `.agentheim/`).
 * @returns {{file:string, section:string, id:string, words:number, date:string}[]}
 */
export function findOverLengthIndexEntries(root) {
  const layout = detectLayout(root);
  const violations = [];

  if (layout === 'legacy') {
    for (const bc of listBoardContexts(root)) {
      const indexPath = taskIndexPath(root, bc);
      violations.push(...findOverLengthEntriesInIndex(indexPath, path.dirname(indexPath)));
    }
  } else {
    for (const bc of listBoardContexts(root)) {
      const indexPath = taskIndexPath(root, bc);
      violations.push(
        ...findOverLengthEntriesInIndex(indexPath, path.dirname(indexPath), TASK_SECTIONS)
      );
    }
    for (const bc of listKnowledgeContexts(root)) {
      const indexPath = knowledgeIndexPath(root, bc);
      violations.push(
        ...findOverLengthEntriesInIndex(indexPath, path.dirname(indexPath), ADR_SECTIONS)
      );
    }
  }

  const topIndexPath = resolveTopIndexPath(root);
  violations.push(
    ...findOverLengthEntriesInIndex(topIndexPath, path.dirname(path.dirname(topIndexPath)), ADR_SECTIONS)
  );

  return violations;
}
