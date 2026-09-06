// worker-result — mechanized parsing of a worker's strict `RESULT` block
// (agentic-workflow-ghcaj, amends ADR-0032 §3/§4/§6; references/worker-
// return-format.md is the prose source of truth this module implements).
//
// Why mechanized, not conductor prose (ADR-0059 mechanize-or-drop): the
// existing one-line fields (`TASK_ID:`, `SUMMARY:`, ...) were always safely
// hand-parsed because each is exactly one line with no internal structure.
// The four new SUCCESS blocks this task adds — `README_DELTA` (JSON), `ADRS`
// (one or more full ADR file bodies, each potentially containing its OWN
// nested markdown code fences), `OUTCOME` (free-form markdown), and
// `BACKLOG_ITEMS` (one or more full task-file bodies) — are not. A hand-
// parse of "find the ADRS block" that breaks the moment an ADR quotes a
// fenced code sample is exactly the plausible-looking-but-fragile lint
// ADR-0059 warns against; this module is the mechanized alternative.
//
// Block-fence grammar: each of the four blocks is wrapped in a FOUR-backtick
// fence (` ```` `) whose opening line is the four backticks immediately
// followed by the block's name (no space) and whose closing line is the four
// backticks alone. Four backticks, not three, is the load-bearing choice: it
// lets block CONTENT freely use ordinary three-backtick fences (an ADR body
// quoting a shell command, a README delta's `body` embedding a code sample)
// without ambiguity — a standard CommonMark nesting technique, applied here
// deliberately rather than reached for.
//
// Within `ADRS` and `BACKLOG_ITEMS`, individual files are separated by an
// HTML-comment marker (`<!-- ADR: <filename> -->` / `<!-- TASK: <filename> -->`)
// — the same marker-block convention `lib/task-lifecycle.mjs` already uses
// for `INDEX.md`'s `<!-- <section>:start/end -->` markers, chosen over a
// bare heading sentinel (e.g. `### FILE: ...`) precisely because a real ADR
// legitimately contains its own `###` headings (ADR-0032's own "### Windows
// & node_modules") that a heading-shaped sentinel could collide with.
//
// Shape doctrine: stdlib-free (no imports at all), git-free, side-effect-
// free — a RESULT string in, a parsed structure or a structured rejection
// out. Never reads or writes a file.

/** One-line fields required on a SUCCESS block, in the order they appear (post-ghcaj: `BC_README_UPDATED` and `NEW_BACKLOG_ITEMS` are retired — see the block grammar below). */
const SUCCESS_FIELDS = [
  'TASK_ID',
  'SUMMARY',
  'FILES_CHANGED',
  'FILE_LIST',
  'ADRS_WRITTEN',
  'TESTS_ADDED',
  'TESTS_PASSING',
  'TDD_SKIPPED',
  'CONCEPT_CANDIDATE',
];

const BOUNCED_FIELDS = ['TASK_ID', 'REASON'];
const FAILED_FIELDS = ['TASK_ID', 'ERROR'];

/** The four SUCCESS blocks, in the exact order `references/worker-return-format.md` specifies. */
const BLOCK_NAMES = ['README_DELTA', 'ADRS', 'OUTCOME', 'BACKLOG_ITEMS'];

const FENCE = '````';

function rejection(code, reason, extra = {}) {
  return { ok: false, code, reason, ...extra };
}

/** Parse `LABEL: value` one-liner lines into `{fields, rest}` — `rest` is every non-matching, non-blank line (unused today; kept for a caller wanting to notice stray lines). */
function parseOneLiners(lines) {
  const fields = {};
  for (const line of lines) {
    if (line.trim() === '') continue;
    const m = line.match(/^([A-Z_]+):\s?(.*)$/);
    if (m) fields[m[1]] = m[2];
  }
  return fields;
}

function missingFields(fields, required) {
  return required.filter((name) => !(name in fields) || fields[name] === undefined);
}

/**
 * Split `text` (the region after the one-line fields) into an ordered list
 * of `{name, contentLines}` for every four-backtick-fenced block found, or a
 * rejection naming the first block that never closed before EOF or before
 * the next opening fence.
 */
function extractBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    const openMatch = line.match(/^````([A-Z_]+)\s*$/);
    if (!openMatch) {
      i++;
      continue;
    }
    const name = openMatch[1];
    const contentLines = [];
    let j = i + 1;
    let closed = false;
    while (j < lines.length) {
      if (lines[j].match(/^````\s*$/)) {
        closed = true;
        break;
      }
      if (lines[j].match(/^````([A-Z_]+)\s*$/)) {
        // A second opening fence before this one closed — truncated block.
        break;
      }
      contentLines.push(lines[j]);
      j++;
    }
    if (!closed) {
      return rejection('truncated-block', `The ${name} block never closed with a matching ${FENCE} fence before EOF (or before the next block began).`, { block: name });
    }
    blocks.push({ name, contentLines });
    i = j + 1;
  }
  return { ok: true, blocks };
}

/** Split an ADRS/BACKLOG_ITEMS block's content on its `<!-- <marker>: <filename> -->` separators. */
function splitMarkedFiles(contentLines, markerLabel) {
  const markerRe = new RegExp(`^<!-- ${markerLabel}: (.+) -->\\s*$`);
  const files = [];
  let current = null;
  for (const line of contentLines) {
    const m = line.match(markerRe);
    if (m) {
      if (current) files.push(current);
      current = { filename: m[1].trim(), bodyLines: [] };
    } else if (current) {
      current.bodyLines.push(line);
    }
    // Lines before the first marker (should only be blank padding) are ignored.
  }
  if (current) files.push(current);
  return files.map((f) => ({ filename: f.filename, body: f.bodyLines.join('\n').replace(/^\n+|\n+$/g, '') }));
}

/**
 * Parse a worker's strict `RESULT` return text.
 *
 * @param {string} text
 * @returns {
 *   {ok:true, result:'SUCCESS', fields:object, blocks:{readmeDelta:Array, adrs:Array<{filename:string,body:string}>, outcome:string, backlogItems:Array<{filename:string,body:string}>}} |
 *   {ok:true, result:'BOUNCED'|'FAILED', fields:object, blocks:null} |
 *   {ok:false, code:string, reason:string, block?:string}
 * }
 */
export function parseWorkerResult(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return rejection('empty-result', 'The worker returned an empty or non-string RESULT text.');
  }

  const allLines = text.replace(/\r\n/g, '\n').split('\n');
  const firstContentIdx = allLines.findIndex((l) => l.trim() !== '');
  if (firstContentIdx === -1) {
    return rejection('empty-result', 'The worker returned only blank lines.');
  }

  const resultLineMatch = allLines[firstContentIdx].match(/^RESULT:\s?(\S+)\s*$/);
  if (!resultLineMatch) {
    return rejection('missing-result-line', 'The first non-blank line must be exactly "RESULT: SUCCESS|BOUNCED|FAILED".');
  }
  const resultType = resultLineMatch[1];
  if (!['SUCCESS', 'BOUNCED', 'FAILED'].includes(resultType)) {
    return rejection('unknown-result', `Unrecognized RESULT value "${resultType}" — must be SUCCESS, BOUNCED, or FAILED.`);
  }

  const remaining = allLines.slice(firstContentIdx + 1);

  if (resultType === 'BOUNCED' || resultType === 'FAILED') {
    const fields = parseOneLiners(remaining);
    const required = resultType === 'BOUNCED' ? BOUNCED_FIELDS : FAILED_FIELDS;
    const missing = missingFields(fields, required);
    if (missing.length > 0) {
      return rejection('missing-field', `${resultType} block is missing required field(s): ${missing.join(', ')}.`);
    }
    return { ok: true, result: resultType, fields, blocks: null };
  }

  // --- SUCCESS: one-line fields, THEN the four fenced blocks. ---
  const firstFenceIdx = remaining.findIndex((l) => /^````[A-Z_]+\s*$/.test(l));
  const headerLines = firstFenceIdx === -1 ? remaining : remaining.slice(0, firstFenceIdx);
  const blockLines = firstFenceIdx === -1 ? [] : remaining.slice(firstFenceIdx);

  const fields = parseOneLiners(headerLines);
  const missing = missingFields(fields, SUCCESS_FIELDS);
  if (missing.length > 0) {
    return rejection('missing-field', `SUCCESS block is missing required field(s): ${missing.join(', ')}.`);
  }

  const extracted = extractBlocks(blockLines);
  if (!extracted.ok) return extracted;

  const foundNames = extracted.blocks.map((b) => b.name);
  for (let idx = 0; idx < BLOCK_NAMES.length; idx++) {
    if (foundNames[idx] !== BLOCK_NAMES[idx]) {
      return rejection(
        'missing-block',
        `Expected the SUCCESS blocks in order [${BLOCK_NAMES.join(', ')}]; found [${foundNames.join(', ') || '(none)'}] — missing or out of order at position ${idx + 1} (expected ${BLOCK_NAMES[idx]}).`,
        { block: BLOCK_NAMES[idx] }
      );
    }
  }

  const byName = Object.fromEntries(extracted.blocks.map((b) => [b.name, b.contentLines]));

  let readmeDelta;
  const readmeDeltaText = byName.README_DELTA.join('\n').trim();
  try {
    readmeDelta = readmeDeltaText === '' ? [] : JSON.parse(readmeDeltaText);
  } catch (err) {
    return rejection('malformed-block', `README_DELTA block is not valid JSON: ${err.message}`, { block: 'README_DELTA' });
  }
  if (!Array.isArray(readmeDelta)) {
    return rejection('malformed-block', 'README_DELTA block must parse to a JSON array (possibly empty).', { block: 'README_DELTA' });
  }

  const adrs = splitMarkedFiles(byName.ADRS, 'ADR');
  const outcome = byName.OUTCOME.join('\n').trim();
  const backlogItems = splitMarkedFiles(byName.BACKLOG_ITEMS, 'TASK');

  return {
    ok: true,
    result: 'SUCCESS',
    fields,
    blocks: { readmeDelta, adrs, outcome, backlogItems },
  };
}
