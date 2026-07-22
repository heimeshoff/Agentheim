// human-eye-criteria — ADR-0061's live-tree lint for the falsifiability gate
// (agentic-workflow-mxk6v). Refinement classifies every acceptance criterion
// as machine-checkable (the default, unmarked) or `[human-eye]` (a genuinely
// perceptual claim only a person can judge — the Dorc July-2026 review's
// worst burn was a perceptual claim smuggled into a machine-checked pixel
// metric, and three worker iterations each produced a metric tuned to pass).
//
// This module mechanizes the one sub-piece of that doctrine that IS a plain
// mechanical predicate (per ADR-0059 mechanize-or-drop's "mechanical wherever
// practical" bar): a task whose acceptance criteria are ALL `[human-eye]`
// must carry the builder-eye-only `## Notes` line by the time it is ready to
// work — added at PROMOTE (`skills/modeling/SKILL.md` step 2b, edited into the
// task file while it is still in `backlog/`, just before the `backlog→todo`
// move) or at CAPTURE only for a task landing directly in `todo/` (step 4).
// Human-eye criteria are never a `backlog/`→`todo/` blocker on their own
// (:428-431), so a `backlog/` resident is legal WITHOUT the note — the note
// is only required once a task is workable (`todo/`, `doing/`, `done/`).
// "Is this criterion genuinely perceptual, or just under-specified?" and "did
// the verifier avoid inventing a proxy metric?" are semantic judgments this
// module does NOT attempt — those stay prompt-embedded in `agents/
// verifier.md` / `skills/verification-before-completion/SKILL.md`'s check 1
// and 1b, mirroring ADR-0059's own self-referential compliance (a
// judgment-based check counts as shipped enforcement when the predicate
// itself resists mechanization).
//
// Grandfather shape mirrors lib/spike-stop-loss.mjs (ADR-0065) / lib/
// index-entry-length.mjs (ADR-0060) exactly: a task's "new-ness" is derived
// from its `created` frontmatter date. Dated ON OR BEFORE `ADOPTION_DATE` ->
// grandfathered, never flagged (every task on disk before this doctrine
// shipped predates the note requirement). Only a task created STRICTLY AFTER
// adoption must carry the note once it is all-human-eye and out of backlog.
//
// Shape doctrine (mirrors lib/id-grammar.mjs / lib/index-rotation.mjs /
// lib/index-entry-length.mjs):
//   - stdlib-only (node:fs, node:path) — zero dependencies;
//   - side-effect-free — a path in, plain violation data out; never writes;
//   - loss-tolerant — an unreadable file, a missing `## Acceptance criteria`
//     section, a task with zero parsed criteria, or a missing/unparseable
//     `created` date never aborts the scan and is never flagged; "can't
//     tell" degrades to "don't flag it."

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Matches the explicit human-eye marker on an acceptance-criteria bullet, tolerant of bold (`**[human-eye]**`) or plain (`[human-eye]`) styling. */
export const HUMAN_EYE_MARKER_RE = /\[human-eye\]/i;

/** The exact phrase the all-human-eye builder-eye-only Notes line must contain (case-insensitive substring match — the line's surrounding wording is free-form, this fragment is the anchor). */
export const REQUIRED_NOTE_RE = /builder-eye only/i;

/** One `- [ ]` / `- [x]` acceptance-criteria bullet line. */
const CRITERION_LINE_RE = /^-\s*\[[ xX]\]\s*(.*)$/;

/**
 * The date this doctrine took effect (the day agentic-workflow-mxk6v
 * shipped). A task created on or before this date is grandfathered. Only a
 * task created strictly after this must carry the note once it is
 * all-human-eye and out of backlog. Never move this date backward.
 */
export const ADOPTION_DATE = '2026-07-21';

// The note is only required once a task is workable — `backlog/` residents
// are legal without it by design (see the header comment above).
const LIFECYCLE_FOLDERS = ['todo', 'doing', 'done'];

/**
 * Read a single frontmatter field's raw value from task-file content; `null`
 * if missing or blank. Mirrors lib/index-entry-length.mjs's
 * `frontmatterField` — `[ \t]*` (never `\s*`) around the value so a blank
 * field can never bleed the match across the newline into the next line.
 */
function frontmatterField(content, field) {
  const m = content.match(new RegExp(`^${field}:[ \\t]*(\\S.*?)[ \\t]*\\r?$`, 'm'));
  if (!m) return null;
  const raw = m[1].trim().replace(/^["']|["']$/g, '').trim();
  return raw || null;
}

/**
 * Extract the `## Acceptance criteria` section's bullets from a task file's
 * raw content. Loss-tolerant: a missing section, or a section with no
 * bullets, yields `[]`.
 *
 * @param {string} content  The task file's full text.
 * @returns {{text:string, humanEye:boolean}[]}
 */
export function parseAcceptanceCriteria(content) {
  const lines = content.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => /^##\s+Acceptance criteria\s*$/i.test(l.trim()));
  if (startIdx === -1) return [];

  const criteria = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) break; // next section — stop
    const m = line.match(CRITERION_LINE_RE);
    if (!m) continue;
    criteria.push({ text: m[1].trim(), humanEye: HUMAN_EYE_MARKER_RE.test(line) });
  }
  return criteria;
}

/** True when there is at least one criterion and every one of them is `[human-eye]`. */
export function isAllHumanEye(criteria) {
  return criteria.length > 0 && criteria.every((c) => c.humanEye);
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

/** Absolute paths of every `*.md` task file directly under one lifecycle folder. */
function taskFilesUnder(dir) {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

/**
 * Walk every task file across every BC's `todo/`, `doing/`, and `done/`
 * lifecycle folders (`backlog/` residents are legal without the note by
 * design — see the header comment) and return one violation per task whose
 * acceptance criteria are ALL `[human-eye]`, whose `created` date is
 * strictly after `ADOPTION_DATE`, but whose body is missing the required
 * builder-eye-only note (ADR-0061 / agentic-workflow-mxk6v). Pure,
 * loss-tolerant, side-effect-free.
 *
 * @param {string} root  Absolute project root (the folder holding `.agentheim/`).
 * @returns {{file:string, id:string}[]}
 */
export function findAllHumanEyeTasksMissingNote(root) {
  const contextsDir = path.join(root, '.agentheim', 'contexts');
  const violations = [];

  for (const bc of contextNames(contextsDir)) {
    for (const folder of LIFECYCLE_FOLDERS) {
      for (const file of taskFilesUnder(path.join(contextsDir, bc, folder))) {
        let content;
        try {
          content = readFileSync(file, 'utf8');
        } catch {
          continue;
        }
        const criteria = parseAcceptanceCriteria(content);
        if (!isAllHumanEye(criteria)) continue;
        const created = frontmatterField(content, 'created');
        if (!created || created <= ADOPTION_DATE) continue; // grandfathered, or undated -> can't tell
        if (REQUIRED_NOTE_RE.test(content)) continue;
        violations.push({ file, id: path.basename(file, '.md') });
      }
    }
  }

  return violations;
}
