#!/usr/bin/env node
// protocol-rotation — the deterministic cap-and-roll script for
// `.agentheim/knowledge/protocol.md` (ADR-0039, agentic-workflow-r2c7m).
//
// A k5n8f-family script (same shape as `lib/task-lifecycle.mjs` /
// `lib/task-lifecycle-cli.mjs`): stdlib-only, git-free, deterministic, and
// returns an enumerated manifest (or a structured rejection) for its caller to
// `git add` and commit — it never shells out to `git` itself.
//
// MECHANISM (ADR-0039):
//   - `protocol.md` is capped at `capLines` (~1,000 lines, ~10x every reader's
//     first-~100-line "recent activity" window).
//   - When the live file exceeds the cap, whole OLDER months (never the
//     current/newest month, however large) roll out, oldest-first, verbatim,
//     to `knowledge/protocol/YYYY-MM.md` — stopping as soon as the live file is
//     back under the cap or only the current month remains.
//   - "Verbatim" means literal: each entry's raw text (heading line through its
//     trailing separator, exactly as it sits in the live file) is relocated
//     unchanged — never reformatted, summarized, or re-encoded. This also makes
//     rotation immune to whichever line-ending convention (`\n` vs `\r\n`) the
//     live file happens to be checked out with.
//   - Newest-on-top ordering is preserved both in the live file (unchanged) and
//     inside each archive file (a month's entries keep their original relative
//     order).

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverRoot } from '../dashboard/discovery.mjs';
import {
  protocolPath as resolveProtocolPath,
  protocolArchiveDir as resolveProtocolArchiveDir,
} from './task-system-paths.mjs';
import { withLifecycleLock } from './lifecycle-lock.mjs';
import { writeFileAtomic } from './atomic-write.mjs';

/** The live-file line cap (ADR-0039): ~10x every reader's ~100-line recent-activity window. */
export const DEFAULT_CAP_LINES = 1000;

/** Matches one entry heading line: `## YYYY-MM-DD[ HH:MM] -- <rest>`. */
const ENTRY_HEADING = /^## (\d{4})-(\d{2})-\d{2}(?: \d{2}:\d{2})? -- .*$/gm;

/** Count lines the same way `wc -l` does (a newline count, EOL-convention-agnostic). */
function countLines(content) {
  return (content.match(/\n/g) || []).length;
}

/**
 * Parse `content` into `{ header, entries }`.
 *
 * `header` is everything before the first entry heading (the `# Protocol` /
 * intro / top `---` block). `entries` is an array of `{ raw, month }` in the
 * file's original order (assumed newest-on-top): `raw` is the EXACT verbatim
 * substring from this entry's heading line up to (not including) the next
 * entry's heading line, or end-of-file for the last entry — so whatever
 * separator/whitespace convention the file uses travels with the entry
 * untouched. `month` is the `YYYY-MM` derived from the heading's date.
 *
 * @param {string} content
 * @returns {{header: string, entries: {raw: string, month: string}[]}}
 */
export function parseProtocolEntries(content) {
  const matches = [...content.matchAll(ENTRY_HEADING)];
  if (matches.length === 0) {
    return { header: content, entries: [] };
  }
  const header = content.slice(0, matches[0].index);
  const entries = matches.map((m, i) => {
    const start = m.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    return { raw: content.slice(start, end), month: `${m[1]}-${m[2]}` };
  });
  return { header, entries };
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

function archiveHeader(month) {
  return (
    `# Protocol archive — ${month}\n\n` +
    `Entries rolled verbatim out of the live \`.agentheim/knowledge/protocol.md\` once ` +
    `${month} was no longer the current month and the live file exceeded its line cap ` +
    `(ADR-0039, agentic-workflow-r2c7m). Newest-on-top order is preserved. See ` +
    `\`../protocol.md\` for the live log.\n\n---\n\n`
  );
}

/**
 * Cap the live `protocol.md` and roll whole older (non-current) months out to
 * dated archive files under `knowledge/protocol/YYYY-MM.md`, verbatim,
 * oldest-first, stopping as soon as the live file is back under the cap or
 * only the current month remains (the current month is NEVER rolled, however
 * large it grows — ADR-0039).
 *
 * Git-free: never runs `git`. Writes nothing when there is nothing to roll.
 *
 * @param {string} rootDir  Absolute project root (the folder holding `.agentheim/`).
 * @param {object} [opts]
 * @param {number} [opts.capLines]      Live-file line cap. Default `DEFAULT_CAP_LINES` (~1000).
 * @param {string} [opts.protocolPath]  Override for tests; defaults to
 *                                      `<rootDir>/.agentheim/knowledge/protocol.md`.
 * @param {string} [opts.archiveDir]    Override for tests; defaults to
 *                                      `<rootDir>/.agentheim/knowledge/protocol/`.
 * @returns {{ok:true, rotated:boolean, changed:string[], rolledMonths:string[], liveLines:number}}
 */
export function rotateProtocol(rootDir, opts = {}) {
  return withLifecycleLock(rootDir, () => rotateProtocolLocked(rootDir, opts), opts.lock);
}

/**
 * The actual rotation body, run while `rotateProtocol` holds the one
 * project-wide lifecycle lock (agentic-workflow-pt0gy) — never call this
 * directly. `rotateProtocol` is an independent CLI entry point `work`
 * bootstraps directly, never through `task-lifecycle-cli.mjs`, so the lock
 * lives HERE rather than at any dispatch layer this script doesn't have.
 */
function rotateProtocolLocked(rootDir, opts) {
  const capLines = opts.capLines ?? DEFAULT_CAP_LINES;
  const protocolPath = opts.protocolPath ?? resolveProtocolPath(rootDir);
  const archiveDir = opts.archiveDir ?? resolveProtocolArchiveDir(rootDir);

  if (!existsSync(protocolPath)) {
    return { ok: true, rotated: false, changed: [], rolledMonths: [], liveLines: 0 };
  }

  const content = readFileSync(protocolPath, 'utf8');
  const totalLines = countLines(content);
  if (totalLines <= capLines) {
    return { ok: true, rotated: false, changed: [], rolledMonths: [], liveLines: totalLines };
  }

  const { header, entries } = parseProtocolEntries(content);
  if (entries.length === 0) {
    // Nothing structured to roll (header-only or an unrecognized format) — leave untouched.
    return { ok: true, rotated: false, changed: [], rolledMonths: [], liveLines: totalLines };
  }

  const buckets = groupByMonth(entries);

  // Walk from the oldest bucket toward the current one, rolling whole buckets
  // out while the live file is still over cap. `buckets[0]` (the current
  // month) is never popped — the loop guard `keptBucketCount > 1` guarantees it.
  let keptBucketCount = buckets.length;
  const changed = new Set();
  const rolledMonths = [];

  while (keptBucketCount > 1) {
    const liveEntries = buckets.slice(0, keptBucketCount).flatMap((b) => b.entries);
    const liveContent = header + liveEntries.map((e) => e.raw).join('');
    if (countLines(liveContent) <= capLines) break;

    const oldest = buckets[keptBucketCount - 1];
    mkdirSync(archiveDir, { recursive: true });
    const archivePath = path.join(archiveDir, `${oldest.month}.md`);
    const archiveBody = oldest.entries.map((e) => e.raw).join('');
    // An archive file for a given month is normally written exactly once (a
    // non-current month, once closed, never gains new entries) — but append
    // defensively rather than clobber if one somehow already exists.
    const archiveContent = existsSync(archivePath)
      ? readFileSync(archivePath, 'utf8') + archiveBody
      : archiveHeader(oldest.month) + archiveBody;
    writeFileAtomic(archivePath, archiveContent);
    changed.add(archivePath);
    rolledMonths.push(oldest.month);
    keptBucketCount -= 1;
  }

  if (rolledMonths.length === 0) {
    return { ok: true, rotated: false, changed: [], rolledMonths: [], liveLines: totalLines };
  }

  const liveEntries = buckets.slice(0, keptBucketCount).flatMap((b) => b.entries);
  const newLiveContent = header + liveEntries.map((e) => e.raw).join('');
  writeFileAtomic(protocolPath, newLiveContent);
  changed.add(protocolPath);

  return {
    ok: true,
    rotated: true,
    changed: [...changed],
    rolledMonths,
    liveLines: countLines(newLiveContent),
  };
}

// ---------------------------------------------------------------------------
// Thin CLI wrapper — same testable-CLI shape as `lib/task-lifecycle-cli.mjs`
// (`runCli` exported for direct in-process testing, `main` for the real
// `node lib/protocol-rotation.mjs` invocation). Unlike the task-lifecycle CLI,
// this script takes no verb/id argv — rotation is a single, parameterless,
// idempotent operation.
// ---------------------------------------------------------------------------

/**
 * Run rotation against an injectable `discoverRoot`/`rotateOpts`, exported so
 * tests can drive it without spawning a child process.
 * @param {object} [opts]
 * @param {string} [opts.cwd]            defaults to `process.cwd()`
 * @param {Function} [opts.discoverRoot] override for tests; defaults to the real `discoverRoot`
 * @param {object} [opts.rotateOpts]     forwarded to `rotateProtocol` (e.g. `capLines` for tests)
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
  const result = rotateProtocol(rootDir, opts.rotateOpts ?? {});
  return { exitCode: result.ok ? 0 : 1, output: result };
}

/**
 * Print the manifest as JSON on stdout and exit with the matching code — the
 * whole runtime behavior of `node lib/protocol-rotation.mjs`.
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
