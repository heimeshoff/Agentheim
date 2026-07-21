// spike-stop-loss — ADR-0065's live-tree lint for the spike stop-loss clause
// (agentic-workflow-rx630). `skills/modeling/SKILL.md`'s task-format notes and
// `agents/worker.md`'s TDD-skip notes now state: every `type: spike` task
// carries a standing stop-loss clause — "if, mid-spike, the mitigation is
// already known and cheap, record it and stop." This lint flags a NEWLY
// CREATED `type: spike` task file whose body carries neither the literal
// "stop-loss" marker nor the clause's own "record it and stop" wording.
//
// Grandfather shape mirrors lib/index-entry-length.mjs (ADR-0060) exactly: a
// spike task's "new-ness" is derived from its `created` frontmatter date.
// Dated ON OR BEFORE ADOPTION_DATE -> grandfathered, never flagged (every
// spike task on disk before this doctrine shipped predates the clause and is
// never retroactively rewritten). Only a spike task created STRICTLY AFTER
// adoption must carry the clause.
//
// Shape doctrine (mirrors lib/index-entry-length.mjs / lib/id-grammar.mjs):
//   - stdlib-only (node:fs, node:path) — zero dependencies;
//   - side-effect-free — a root path in, plain violation data out; never writes;
//   - loss-tolerant — an unparseable file, missing frontmatter, or an
//     undated/unreadable task file never aborts the scan and is never
//     flagged ("can't tell, so don't flag it" — same posture
//     `findOverLengthIndexEntries` already uses).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The date this doctrine took effect (the day agentic-workflow-rx630
 * shipped). A spike task created on or before this date is grandfathered.
 * Only a spike task created strictly after this must carry the stop-loss
 * clause. Never move this date backward.
 */
export const ADOPTION_DATE = '2026-07-21';

/** Lifecycle folders a task file can live in under a BC's context directory. */
const LIFECYCLE_FOLDERS = ['backlog', 'todo', 'doing', 'done'];

/** Either wording of the clause satisfies the lint — the literal marker term, or the clause's own words. */
const STOP_LOSS_MARKER = /stop-loss|record it and stop/i;

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

/** The body of a task file: everything after the closing `---` of frontmatter. `null` if no frontmatter fence is found. */
function bodyAfterFrontmatter(content) {
  const m = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  return m ? m[1] : null;
}

/**
 * Check one task file: not a spike, not created strictly after adoption, or
 * unreadable/unparseable -> not a violation (loss-tolerant / out of scope).
 * A spike task created strictly after adoption whose body lacks the marker
 * -> a violation.
 *
 * @param {string} absFile
 * @returns {{file:string, id:string, created:string}|null}
 */
export function checkSpikeTaskFile(absFile) {
  let content;
  try {
    content = readFileSync(absFile, 'utf8');
  } catch {
    return null;
  }
  const type = frontmatterField(content, 'type');
  if (type !== 'spike') return null;
  const created = frontmatterField(content, 'created');
  if (!created || created <= ADOPTION_DATE) return null; // grandfathered, or undated -> can't tell
  const body = bodyAfterFrontmatter(content);
  if (body === null) return null; // unparseable -> can't tell
  if (STOP_LOSS_MARKER.test(body)) return null;
  const id = frontmatterField(content, 'id') || path.basename(absFile, '.md');
  return { file: absFile, id, created };
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
 * Walk every lifecycle folder of every BC under `<root>/.agentheim/contexts/`
 * and return every `type: spike` task file created strictly after
 * `ADOPTION_DATE` whose body lacks the stop-loss clause marker.
 *
 * @param {string} root  Absolute project root (the folder holding `.agentheim/`).
 * @returns {{file:string, id:string, created:string}[]}
 */
export function findSpikeTasksMissingStopLoss(root) {
  const contextsDir = path.join(root, '.agentheim', 'contexts');
  const violations = [];
  for (const bc of contextNames(contextsDir)) {
    for (const folder of LIFECYCLE_FOLDERS) {
      const dir = path.join(contextsDir, bc, folder);
      if (!existsSync(dir)) continue;
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const violation = checkSpikeTaskFile(path.join(dir, entry.name));
        if (violation) violations.push(violation);
      }
    }
  }
  return violations;
}
