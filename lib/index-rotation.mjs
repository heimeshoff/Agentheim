#!/usr/bin/env node
// index-rotation — the deterministic cap-and-roll script for a bounded
// context's `INDEX.md` `done-list` (agentic-workflow-c8j3w). Applies the
// verbatim cap-and-roll doctrine ADR-0039 established for `protocol.md`
// (agentic-workflow-r2c7m, `lib/protocol-rotation.mjs`) to a second
// growth surface, per ADR-0041's "cap-and-roll" discipline.
//
// A k5n8f-family script (same shape as `lib/task-lifecycle.mjs` /
// `lib/protocol-rotation.mjs`): stdlib-only, git-free, deterministic, and
// returns an enumerated manifest for its caller to `git add` and commit — it
// never shells out to `git` itself.
//
// MECHANISM (mirrors ADR-0039, adapted from a line-count cap to an
// entry-count cap since a done-list line is a single-line pointer, not a
// multi-line prose entry):
//   - Each BC's `INDEX.md` `<!-- done-list:start -->...:end -->` block is
//     capped at `capEntries` (~30 live entries — roughly the recent-work
//     window a worker or `modeling` actually skims).
//   - When the live list exceeds the cap, whole OLDER months (never the
//     current/newest month, however large) roll out, oldest-first, verbatim,
//     to `contexts/<bc>/done-archive/YYYY-MM.md` — stopping as soon as the
//     live list is back under the cap or only the current month remains.
//   - "Verbatim" means literal: each done-list line's raw text is relocated
//     unchanged — never reformatted, summarized, or re-encoded. Lines are
//     split/rejoined on '\n' only (never `\r?\n`), so a CRLF-checked-out
//     `INDEX.md` round-trips its `\r` bytes unchanged (infrastructure-5w5gs's
//     CRLF-fragility caution) — this is the same technique
//     `lib/task-lifecycle.mjs`'s `removeIndexLine`/`insertIndexLineAtTop`
//     already rely on, just made deliberate here. Only the MARKER-detection
//     regex additionally tolerates an optional `\r` before its `\n`.
//   - A done-list line carries no date of its own, so an entry's month is
//     derived from the `completed:` frontmatter of the task file it points
//     at (falling back to that file's mtime, then to an `unknown` bucket, if
//     the field or file is unreadable — loss-tolerant, never abort the walk,
//     matching `dashboard/tree.mjs`'s posture).
//   - Newest-on-top ordering is preserved both in the live list (unchanged)
//     and inside each archive file (a month's entries keep their original
//     relative order).
//   - REACHABILITY: rotation never touches the actual `done/<id>-<slug>.md`
//     task files — only the one-line INDEX.md pointer is moved. Every reader
//     that resolves a task id by walking the `done/` folder directly
//     (`dashboard/tree.mjs`'s `buildTree`, and `lib/task-lifecycle.mjs`'s
//     `resolveTaskFile`) is therefore unaffected by rotation: `depends_on` /
//     `blocks` resolution and the dashboard search corpus (ADR-0023) both
//     already read `done/` on disk, never `INDEX.md`'s done-list text. The
//     one reader that DOES read the done-list's rendered text —
//     `modeling`'s Backlink lookup prior-art matcher — is pointed at
//     `done-archive/` as an additional input (see `skills/modeling/SKILL.md`).

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverRoot } from '../dashboard/discovery.mjs';

/** The live-list entry cap (task's proposed N; roughly the recent-work window). */
export const DEFAULT_CAP_ENTRIES = 30;

/** Matches the done-list marker block, capturing its inner content. Tolerates `\r?\n` after the start marker (CRLF-checkout safe). */
const DONE_LIST_BLOCK = /(<!-- done-list:start -->\r?\n)([\s\S]*?)(<!-- done-list:end -->)/;

/** Matches one done-list line: `- **<id>** — <title> (<type>) — \`done/<file>\``. */
const ENTRY_LINE = /^- \*\*([^*]+)\*\* .+ `done\/([^`]+)`\r?$/;

/** Matches the `### Done (...)` header line immediately above the done-list block. */
const DONE_HEADER_LINE = /^### Done \(.*\)(\r?)$/m;

/**
 * Parse the `done-list` marker block out of an `INDEX.md`'s content into an
 * array of `{ raw, id, fileName }`, in the file's original (newest-first)
 * order. `raw` is the line's EXACT verbatim text (including a trailing `\r`
 * on a CRLF-checked-out file) so rotation never rewrites a line's bytes.
 * Blank lines are skipped; a non-blank line that doesn't match the expected
 * shape is skipped too (loss-tolerant — never abort on one malformed line).
 *
 * @param {string} content
 * @returns {{raw: string, id: string, fileName: string}[]}
 */
export function parseDoneListEntries(content) {
  const m = content.match(DONE_LIST_BLOCK);
  if (!m) {
    throw new Error('INDEX.md is missing the done-list markers.');
  }
  const lines = m[2].split('\n');
  const entries = [];
  for (const line of lines) {
    if (line.trim() === '') continue;
    const lm = line.match(ENTRY_LINE);
    if (!lm) continue;
    entries.push({ raw: line, id: lm[1], fileName: lm[2] });
  }
  return entries;
}

/**
 * Derive an entry's `YYYY-MM` month from the `completed:` frontmatter of the
 * task file it points at, falling back to the file's mtime, then to the
 * literal string `'unknown'` if the file can't be read at all — loss-tolerant
 * by design, since a rotation run must never throw over one unreadable file.
 */
function deriveEntryMonth(doneDir, fileName) {
  const filePath = path.join(doneDir, fileName);
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return 'unknown';
  }
  const m = content.match(/^completed:\s*(\d{4})-(\d{2})-\d{2}\s*$/m);
  if (m) return `${m[1]}-${m[2]}`;
  try {
    const mtime = statSync(filePath).mtime;
    return `${mtime.getFullYear()}-${String(mtime.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return 'unknown';
  }
}

/** Group entries (already in file order) into contiguous same-month runs. */
function groupByMonth(entries) {
  const buckets = [];
  for (const e of entries) {
    const last = buckets[buckets.length - 1];
    if (last && last.month === e.month) {
      last.entries.push(e);
    } else {
      buckets.push({ month: e.month, entries: [e] });
    }
  }
  return buckets;
}

function archiveHeader(context, month) {
  return (
    `# ${context} done-list archive — ${month}\n\n` +
    `Entries rolled verbatim out of the live \`contexts/${context}/INDEX.md\` done-list once ` +
    `the live list exceeded its entry cap and ${month} was no longer within it (ADR-0039's ` +
    `cap-and-roll convention, applied to the INDEX done-list by agentic-workflow-c8j3w). ` +
    `Newest-on-top order is preserved. See \`../INDEX.md\` for the live done-list.\n\n---\n\n`
  );
}

/** The header line rotation writes above the done-list block once it has rolled at least one month out. */
function archivedDoneHeader(capEntries) {
  return (
    `### Done (most recent ${capEntries}; older entries archived verbatim under ` +
    `\`done-archive/\` — kept for prior-art search, ADR-0039 convention)`
  );
}

/**
 * Cap one bounded context's live `INDEX.md` done-list at `capEntries` and
 * roll whole older (non-current) months out to dated archive files under
 * `contexts/<context>/done-archive/YYYY-MM.md`, verbatim, oldest-first,
 * stopping as soon as the live list is back under the cap or only the
 * current month remains (the current month is NEVER rolled, however large it
 * grows — mirrors ADR-0039).
 *
 * Git-free: never runs `git`. Writes nothing when there is nothing to roll.
 * Never touches the `**Done:** N` lifetime count (that's a total-ever-
 * completed counter owned by `completeTask`, not a live-list size) or the
 * actual `done/<id>-<slug>.md` task files (reachability for `depends_on` /
 * `blocks` resolution and the dashboard search corpus is unaffected by
 * construction — see the module doc comment).
 *
 * @param {string} rootDir  Absolute project root (the folder holding `.agentheim/`).
 * @param {string} context  Bounded-context name (e.g. `agentic-workflow`).
 * @param {object} [opts]
 * @param {number} [opts.capEntries]  Live-list entry cap. Default `DEFAULT_CAP_ENTRIES` (~30).
 * @param {string} [opts.indexPath]   Override for tests; defaults to
 *                                    `<rootDir>/.agentheim/contexts/<context>/INDEX.md`.
 * @param {string} [opts.archiveDir]  Override for tests; defaults to
 *                                    `<rootDir>/.agentheim/contexts/<context>/done-archive/`.
 * @param {string} [opts.doneDir]     Override for tests; defaults to
 *                                    `<rootDir>/.agentheim/contexts/<context>/done/`.
 * @returns {{ok:true, rotated:boolean, changed:string[], rolledMonths:string[], liveEntries:number}}
 */
export function rotateIndexDoneList(rootDir, context, opts = {}) {
  const capEntries = opts.capEntries ?? DEFAULT_CAP_ENTRIES;
  const indexPath =
    opts.indexPath ?? path.join(rootDir, '.agentheim', 'contexts', context, 'INDEX.md');
  const archiveDir =
    opts.archiveDir ?? path.join(rootDir, '.agentheim', 'contexts', context, 'done-archive');
  const doneDir = opts.doneDir ?? path.join(rootDir, '.agentheim', 'contexts', context, 'done');

  if (!existsSync(indexPath)) {
    return { ok: true, rotated: false, changed: [], rolledMonths: [], liveEntries: 0 };
  }

  const content = readFileSync(indexPath, 'utf8');
  const rawEntries = parseDoneListEntries(content);
  if (rawEntries.length <= capEntries) {
    return { ok: true, rotated: false, changed: [], rolledMonths: [], liveEntries: rawEntries.length };
  }

  const entries = rawEntries.map((e) => ({ ...e, month: deriveEntryMonth(doneDir, e.fileName) }));
  const buckets = groupByMonth(entries);

  // Walk from the oldest bucket toward the current one, rolling whole buckets
  // out while the live list is still over cap. `buckets[0]` (the current
  // month) is never popped — the loop guard `keptBucketCount > 1` guarantees it.
  let keptBucketCount = buckets.length;
  const changed = new Set();
  const rolledMonths = [];

  while (keptBucketCount > 1) {
    const liveCount = buckets.slice(0, keptBucketCount).reduce((n, b) => n + b.entries.length, 0);
    if (liveCount <= capEntries) break;

    const oldest = buckets[keptBucketCount - 1];
    mkdirSync(archiveDir, { recursive: true });
    const archivePath = path.join(archiveDir, `${oldest.month}.md`);
    const archiveBody = oldest.entries.map((e) => e.raw).join('\n') + '\n';
    // An archive file for a given month is normally written exactly once (a
    // non-current month, once closed, never gains new done-list entries) —
    // but append defensively rather than clobber if one somehow already exists.
    const archiveContent = existsSync(archivePath)
      ? readFileSync(archivePath, 'utf8') + archiveBody
      : archiveHeader(context, oldest.month) + archiveBody;
    writeFileSync(archivePath, archiveContent);
    changed.add(archivePath);
    rolledMonths.push(oldest.month);
    keptBucketCount -= 1;
  }

  if (rolledMonths.length === 0) {
    return { ok: true, rotated: false, changed: [], rolledMonths: [], liveEntries: rawEntries.length };
  }

  const keptEntries = buckets.slice(0, keptBucketCount).flatMap((b) => b.entries);
  const newBlockInner = keptEntries.map((e) => e.raw).join('\n') + '\n';
  let newContent = content.replace(
    DONE_LIST_BLOCK,
    (_full, startMarker, _inner, endMarker) => `${startMarker}${newBlockInner}${endMarker}`
  );

  // Name the archive location in the header immediately above the block —
  // acceptance criterion: "the done-list header / INDEX pointers name the
  // archive location". Only rewritten when a rotation actually happens.
  newContent = newContent.replace(DONE_HEADER_LINE, (_full, cr) => `${archivedDoneHeader(capEntries)}${cr}`);

  writeFileSync(indexPath, newContent);
  changed.add(indexPath);

  return {
    ok: true,
    rotated: true,
    changed: [...changed],
    rolledMonths,
    liveEntries: keptEntries.length,
  };
}

/**
 * Rotate every bounded context's done-list under `<rootDir>/.agentheim/contexts/`,
 * aggregating each BC's manifest. This is the CLI's default (parameterless)
 * operation, mirroring `rotateProtocol`'s "single, idempotent operation over
 * whatever currently exists" shape.
 *
 * @param {string} rootDir
 * @param {object} [opts]  Forwarded to `rotateIndexDoneList` for every BC.
 * @returns {{ok:true, rotated:boolean, changed:string[], contexts:Object<string,object>}}
 */
export function rotateAllIndexDoneLists(rootDir, opts = {}) {
  const contextsDir = path.join(rootDir, '.agentheim', 'contexts');
  let bcNames = [];
  if (existsSync(contextsDir)) {
    try {
      bcNames = readdirSync(contextsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
    } catch {
      bcNames = [];
    }
  }

  const results = {};
  const changed = [];
  let rotatedAny = false;
  for (const bc of bcNames) {
    const result = rotateIndexDoneList(rootDir, bc, opts);
    results[bc] = result;
    if (result.rotated) {
      rotatedAny = true;
      changed.push(...result.changed);
    }
  }

  return { ok: true, rotated: rotatedAny, changed, contexts: results };
}

// ---------------------------------------------------------------------------
// Thin CLI wrapper — same testable-CLI shape as `lib/protocol-rotation.mjs`
// (`runCli` exported for direct in-process testing, `main` for the real
// `node lib/index-rotation.mjs` invocation). Takes no verb/id argv — rotation
// is a single, parameterless, idempotent operation over every BC found.
// ---------------------------------------------------------------------------

/**
 * Run rotation against an injectable `discoverRoot`/`rotateOpts`, exported so
 * tests can drive it without spawning a child process.
 * @param {object} [opts]
 * @param {string} [opts.cwd]            defaults to `process.cwd()`
 * @param {Function} [opts.discoverRoot] override for tests; defaults to the real `discoverRoot`
 * @param {object} [opts.rotateOpts]     forwarded to `rotateAllIndexDoneLists` (e.g. `capEntries` for tests)
 * @returns {{exitCode:number, output:object}}
 */
export function runCli(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  let rootDir;
  try {
    rootDir = (opts.discoverRoot ?? discoverRoot)(cwd);
  } catch (err) {
    return { exitCode: 1, output: { ok: false, code: 'no-project-root', reason: err.message } };
  }
  const result = rotateAllIndexDoneLists(rootDir, opts.rotateOpts ?? {});
  return { exitCode: result.ok ? 0 : 1, output: result };
}

/**
 * Print the manifest as JSON on stdout and exit with the matching code — the
 * whole runtime behavior of `node lib/index-rotation.mjs`.
 * @param {string[]} [argv]  unused (no verb/id) — accepted only for signature
 *                           parity with the rest of the k5n8f-family CLIs.
 */
export function main(argv = process.argv.slice(2)) { // eslint-disable-line no-unused-vars
  const { exitCode, output } = runCli();
  console.log(JSON.stringify(output));
  process.exit(exitCode);
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
