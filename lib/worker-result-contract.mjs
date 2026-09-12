// worker-result-contract — a live-tree lint keeping every restatement of the
// worker RESULT contract honest (ADR-0059 mechanize-or-drop declaration,
// ADR-0080 §6, ADR-0068 "drift-twice" second-drift rule). Mirrors
// lib/agent-spawn-namespace.mjs's shape:
//   - stdlib-only (node:fs, node:path) — zero dependencies;
//   - side-effect-free — a root path in, plain data out; never writes;
//   - loss-tolerant on the tree walk — an unreadable file is skipped, never
//     throwing and aborting the scan.
//
// `references/worker-return-format.md` is the ONE source of truth for the
// worker's strict RESULT shape (`SUCCESS_FIELDS` in `lib/worker-result.mjs`).
// Every other `agents/`/`skills/` markdown file must point at it rather than
// restate it — this drifted once already (agentic-workflow-f7k2d), which is
// exactly the "second-drift" pattern ADR-0068 says a lint, not a review
// habit, must guard from now on.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** The nine SUCCESS one-line fields, in the exact order `lib/worker-result.mjs`'s `SUCCESS_FIELDS` requires. */
export const SUCCESS_FIELDS_ORDER = Object.freeze([
  'TASK_ID',
  'SUMMARY',
  'FILES_CHANGED',
  'FILE_LIST',
  'ADRS_WRITTEN',
  'TESTS_ADDED',
  'TESTS_PASSING',
  'TDD_SKIPPED',
  'CONCEPT_CANDIDATE',
]);

/** Literal strings the reference must carry (ADR-0080). */
const REQUIRED_REFERENCE_STRINGS = Object.freeze(['RESULT_END', 'Result file:', '.worktrees/.results/']);

/** Recursively list every `.md` file under `dir`; loss-tolerant, sorted. */
function markdownFilesUnder(dir) {
  if (!existsSync(dir)) return [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...markdownFilesUnder(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(full);
    }
  }
  return files.sort();
}

function readFileLoose(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Extract the ordered list of one-line field names inside the reference's
 * `RESULT: SUCCESS` triple-backtick code sample, or `null` if that sample
 * isn't found at all.
 *
 * @param {string} referenceContent
 * @returns {string[]|null}
 */
export function extractSuccessFieldOrder(referenceContent) {
  const normalized = referenceContent.replace(/\r\n/g, '\n');
  const m = normalized.match(/```\nRESULT: SUCCESS\n([\s\S]*?)\n```/);
  if (!m) return null;
  const names = [];
  for (const line of m[1].split('\n')) {
    const fm = line.match(/^([A-Z_]+):/);
    if (fm) names.push(fm[1]);
  }
  return names;
}

/**
 * Slice out the `## Subagent Prompt Template` section of `skills/work/SKILL.md` (from its
 * heading to the next top-level `## ` heading, or EOF). Empty string if the heading isn't
 * found. Tracks triple-backtick fence state line-by-line so a `## Your task` line INSIDE the
 * template's own fenced prompt sample is never mistaken for the section's end.
 */
export function extractSubagentPromptTemplateSection(skillContent) {
  const normalized = skillContent.replace(/\r\n/g, '\n');
  const idx = normalized.indexOf('## Subagent Prompt Template');
  if (idx === -1) return '';
  const lines = normalized.slice(idx).split('\n');
  let inFence = false;
  let endLine = lines.length;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && /^## /.test(line)) {
      endLine = i;
      break;
    }
  }
  return lines.slice(0, endLine).join('\n');
}

/**
 * `true` when `line` names every one of the nine SUCCESS field names — the
 * ADR-0068 "restated field list" shape (a parenthetical like
 * `(TASK_ID, SUMMARY, ...)`) that must live ONLY in the reference file.
 */
function lineRestatesAllFields(line) {
  return SUCCESS_FIELDS_ORDER.every((name) => new RegExp(`\\b${name}\\b`).test(line));
}

/**
 * Scan every `.md` under `<root>/agents/` and `<root>/skills/` (excluding
 * `references/worker-return-format.md` itself, which is never under either
 * directory but is excluded defensively by basename) for a line restating
 * all nine SUCCESS field names.
 *
 * @param {string} root
 * @returns {{file: string, line: number}[]}
 */
export function findRestatedFieldLists(root) {
  const dirs = [path.join(root, 'agents'), path.join(root, 'skills')];
  const hits = [];
  for (const dir of dirs) {
    for (const file of markdownFilesUnder(dir)) {
      if (path.basename(file) === 'worker-return-format.md') continue;
      const content = readFileLoose(file);
      if (content === null) continue;
      const lines = content.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (lineRestatesAllFields(line)) {
          hits.push({ file, line: idx + 1 });
        }
      });
    }
  }
  return hits;
}

/**
 * Run every ADR-0080/ADR-0059/ADR-0068 contract check against the live tree
 * rooted at `root`. Returns an empty array when the tree is compliant, else
 * one entry per violation.
 *
 * @param {string} root - absolute project root (the folder holding `references/`, `agents/`, `skills/`)
 * @returns {Array<{code: string, file: string, detail?: string, line?: number}>}
 */
export function checkWorkerResultContract(root) {
  const violations = [];

  const referencePath = path.join(root, 'references', 'worker-return-format.md');
  const referenceContent = readFileLoose(referencePath);
  if (referenceContent === null) {
    return [{ code: 'reference-missing', file: referencePath }];
  }

  // (a) The SUCCESS code sample must list exactly SUCCESS_FIELDS_ORDER, in order.
  const fieldOrder = extractSuccessFieldOrder(referenceContent);
  const fieldsMatch = Array.isArray(fieldOrder) && fieldOrder.length === SUCCESS_FIELDS_ORDER.length && fieldOrder.every((f, i) => f === SUCCESS_FIELDS_ORDER[i]);
  if (!fieldsMatch) {
    violations.push({
      code: 'fields-order-drift',
      file: referencePath,
      detail: `expected [${SUCCESS_FIELDS_ORDER.join(', ')}], found [${(fieldOrder || []).join(', ')}]`,
    });
  }

  // (b) The reference must carry the literal ADR-0080 vocabulary.
  for (const needle of REQUIRED_REFERENCE_STRINGS) {
    if (!referenceContent.includes(needle)) {
      violations.push({ code: 'missing-required-string', file: referencePath, detail: needle });
    }
  }

  // (c) agents/worker.md AND the Subagent Prompt Template must each name `Result file:`.
  const workerMdPath = path.join(root, 'agents', 'worker.md');
  const workerMdContent = readFileLoose(workerMdPath) ?? '';
  if (!workerMdContent.includes('Result file:')) {
    violations.push({ code: 'missing-result-file-field', file: workerMdPath });
  }

  const skillPath = path.join(root, 'skills', 'work', 'SKILL.md');
  const skillContent = readFileLoose(skillPath) ?? '';
  const templateSection = extractSubagentPromptTemplateSection(skillContent);
  if (!templateSection.includes('Result file:')) {
    violations.push({ code: 'missing-result-file-field', file: skillPath, detail: 'Subagent Prompt Template' });
  }

  // (d) No other agents/skills markdown restates all nine field names on one line.
  for (const hit of findRestatedFieldLists(root)) {
    violations.push({ code: 'restated-field-list', file: hit.file, line: hit.line });
  }

  return violations;
}
