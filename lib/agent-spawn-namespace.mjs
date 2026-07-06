// agent-spawn-namespace — a live-tree lint guarding the convention set by
// infrastructure-nz6k4 / ADR (namespace-agent-spawn-identifiers): every
// internal `subagent_type` spawn identifier that names an Agentheim-provided
// agent MUST be qualified with the `agentheim:` plugin namespace, because
// Claude Code registers a plugin's agents under the plugin's own namespace —
// there is no bare `worker`, only `agentheim:worker`. A bare spawn resolves
// only by undocumented harness auto-qualification (the `Agent type 'worker'
// not found` failure mode this task fixed).
//
// Shape doctrine (mirrors lib/id-grammar.mjs's live-tree lint):
//   - stdlib-only (node:fs, node:path) — zero dependencies;
//   - side-effect-free — a root path in, plain data out; never writes;
//   - loss-tolerant on the tree walk — an unreadable file is skipped, never
//     throwing and aborting the scan.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Every agent name Agentheim itself provides (the `name:` frontmatter values
 * under `agents/*.md`). A `subagent_type` spawn naming one of these bare —
 * without the `agentheim:` prefix — is the defect this lint catches.
 */
export const AGENTHEIM_AGENT_NAMES = Object.freeze([
  'worker',
  'verifier',
  'orchestrator',
  'research-reviewer',
  'researcher',
  'tactical-modeler',
  'strategic-modeler',
  'architect',
]);

const SPAWN_RE = /subagent_type:\s*"([^"]+)"/g;

/**
 * Matches an exact, standalone backtick-code span — `` `name` `` with
 * nothing else inside the backticks. Deliberately narrower than "the word
 * appears in backticks anywhere in the sentence": a Signal→Specialist
 * routing-table row (`agents/worker.md`, `agents/orchestrator.md`) names its
 * dispatch target as the row's own code span, so this pattern catches that
 * row while leaving ordinary prose ("the `worker` is the executor tier")
 * alone — narrowed further below to table-row lines only.
 */
const BACKTICK_NAME_RE = /`([a-z][a-z-]*)`/g;

/** `true` for a markdown table-row line: starts and ends with `|` (ignoring surrounding whitespace). */
function isTableRow(lineText) {
  const trimmed = lineText.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|');
}

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

/**
 * Scan every `.md` file under `<root>/skills/` and `<root>/agents/` for a
 * `subagent_type: "<name>"` spawn whose `<name>` is an exact, unqualified
 * Agentheim agent name (present in `AGENTHEIM_AGENT_NAMES`, missing the
 * `agentheim:` prefix). Pure and side-effect-free; loss-tolerant like
 * `findMalformedTaskIds`.
 *
 * @param {string} root Absolute project root (the folder holding `skills/`
 *   and `agents/`).
 * @returns {{file: string, line: number, name: string}[]} every bare spawn
 *   found, sorted by file then line.
 */
export function findBareAgentSpawns(root) {
  const dirs = [path.join(root, 'skills'), path.join(root, 'agents')];
  const found = [];

  for (const dir of dirs) {
    for (const file of markdownFilesUnder(dir)) {
      let content;
      try {
        content = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      lines.forEach((lineText, idx) => {
        SPAWN_RE.lastIndex = 0;
        let m;
        while ((m = SPAWN_RE.exec(lineText)) !== null) {
          const name = m[1];
          if (AGENTHEIM_AGENT_NAMES.includes(name)) {
            found.push({ file, line: idx + 1, name });
          }
        }

        // Routing-table rows (Signal -> Specialist) name their dispatch
        // target as a standalone code span in a table cell — the operative
        // identifier a worker/orchestrator turns straight into a
        // subagent_type, even though no literal `Agent(...)` call appears on
        // this line. Only checked on table-row lines so ordinary prose
        // mentions ("the `worker` is the executor tier") are left alone.
        if (isTableRow(lineText)) {
          BACKTICK_NAME_RE.lastIndex = 0;
          let tm;
          while ((tm = BACKTICK_NAME_RE.exec(lineText)) !== null) {
            const name = tm[1];
            if (AGENTHEIM_AGENT_NAMES.includes(name)) {
              found.push({ file, line: idx + 1, name });
            }
          }
        }
      });
    }
  }

  return found;
}
