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
//
// ADR-0080 extends the shape above with redundancy against a lossy transport
// (the harness's per-subagent transcript is sometimes empty, and the
// fallback completion-notification copy is HTML-escaped and can be
// top-truncated). Two additions:
//   - a SUCCESS RESULT repeats its header block verbatim after the last
//     fenced block, then a final `RESULT_END` sentinel line (BOUNCED/FAILED
//     get the sentinel alone, no repeated header) — `parseWorkerResult`
//     tolerates either copy, both, or neither, and reports what it found in
//     the `layout` field of every `ok:true` result;
//   - `resultSidecarRelativePath`, `unescapeNotificationCopy`, and
//     `selectResultSource` support the conductor's sidecar → transcript →
//     notification source ladder, never a prose choice.

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

/** Fields whose mismatch between a leading and trailing header copy is a hard rejection (ADR-0080 §3). `RESULT` itself is compared too, even though it never lands in `fields`. */
const MECHANICAL_FIELDS = ['TASK_ID', 'FILES_CHANGED', 'FILE_LIST', 'ADRS_WRITTEN', 'TESTS_ADDED', 'TESTS_PASSING', 'TDD_SKIPPED'];

/** Prose fields whose mismatch between copies is reported as `layout.softMismatch`, never rejected — the leading copy wins. */
const PROSE_FIELDS = ['SUMMARY', 'CONCEPT_CANDIDATE'];

/** The four SUCCESS blocks, in the exact order `references/worker-return-format.md` specifies. */
const BLOCK_NAMES = ['README_DELTA', 'ADRS', 'OUTCOME', 'BACKLOG_ITEMS'];

const FENCE = '````';
const END_SENTINEL = 'RESULT_END';

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

function requiredFieldsFor(resultType) {
  if (resultType === 'SUCCESS') return SUCCESS_FIELDS;
  if (resultType === 'BOUNCED') return BOUNCED_FIELDS;
  if (resultType === 'FAILED') return FAILED_FIELDS;
  return null;
}

/** Trimmed + internal-whitespace-collapsed comparison value — never byte-exact (ADR-0080 §3, "Alternatives considered"). */
function normalize(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Structural scan of the ENTIRE line array for four-backtick-fenced blocks —
 * the only source of fence-boundary truth (ADR-0080 §3: "never a raw
 * re-scan for a four-backtick line"). Returns the ordered blocks found, plus
 * `leadingLines` (everything before the first opening fence) and
 * `trailingLines` (everything after the last closing fence consumed) — or a
 * structured rejection (`truncated-block` / `stray-fence`).
 */
function scanBlocks(lines) {
  const blocks = [];
  let leadingEnd = null;
  let lastCloseEnd = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const openMatch = line.match(/^````([A-Z_]+)\s*$/);
    if (openMatch) {
      if (leadingEnd === null) leadingEnd = i;
      const name = openMatch[1];
      const contentLines = [];
      let j = i + 1;
      let closed = false;
      while (j < lines.length) {
        if (/^````\s*$/.test(lines[j])) {
          closed = true;
          break;
        }
        if (/^````([A-Z_]+)\s*$/.test(lines[j])) {
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
      lastCloseEnd = j + 1;
      i = j + 1;
      continue;
    }
    if (/^````/.test(line)) {
      // A four-backtick line that is neither a well-formed opening fence nor
      // consumed as a matching close above (a bare closing fence with no
      // preceding open, or a malformed name) — reject, never silently skip.
      return rejection('stray-fence', `Unexpected four-backtick fence line outside any open block: "${line}"`);
    }
    i++;
  }
  const leadingLines = leadingEnd === null ? lines.slice() : lines.slice(0, leadingEnd);
  const trailingLines = lastCloseEnd === null ? [] : lines.slice(lastCloseEnd);
  return { ok: true, blocks, leadingLines, trailingLines };
}

/**
 * Attempt to read a header (`RESULT: <TYPE>` plus one-line fields) from the
 * start of a candidate region. Returns `{attempted:false}` when the region's
 * first non-blank line isn't a `RESULT:` line at all — never an error, a
 * header copy simply isn't present here.
 */
function parseHeaderAttempt(lines) {
  const idx = lines.findIndex((l) => l.trim() !== '');
  if (idx === -1) return { attempted: false };
  const m = lines[idx].match(/^RESULT:\s?(\S+)\s*$/);
  if (!m) return { attempted: false };
  const resultType = m[1];
  const rest = lines.slice(idx + 1);
  const fields = parseOneLiners(rest);
  return { attempted: true, resultType, fields, rest };
}

function isCompleteHeader(attempt) {
  if (!attempt.attempted) return false;
  const required = requiredFieldsFor(attempt.resultType);
  if (!required) return false;
  return missingFields(attempt.fields, required).length === 0;
}

function hasEndSentinel(lines) {
  return lines.some((l) => l.trim() === END_SENTINEL);
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

function parseBlocklessResult(lines) {
  const attempt = parseHeaderAttempt(lines);
  if (!attempt.attempted) {
    return rejection('missing-result-line', 'The first non-blank line must be exactly "RESULT: SUCCESS|BOUNCED|FAILED".');
  }
  const { resultType, fields } = attempt;
  if (!['SUCCESS', 'BOUNCED', 'FAILED'].includes(resultType)) {
    return rejection('unknown-result', `Unrecognized RESULT value "${resultType}" — must be SUCCESS, BOUNCED, or FAILED.`);
  }
  const endSentinel = hasEndSentinel(attempt.rest);

  if (resultType === 'SUCCESS') {
    const missing = missingFields(fields, SUCCESS_FIELDS);
    if (missing.length > 0) {
      return rejection('missing-field', `SUCCESS block is missing required field(s): ${missing.join(', ')}.`);
    }
    // Fields are complete but not one fenced block was found — the first
    // expected block (README_DELTA) is simply absent.
    return rejection('missing-block', `Expected the SUCCESS blocks in order [${BLOCK_NAMES.join(', ')}]; found none.`, { block: BLOCK_NAMES[0] });
  }

  const required = resultType === 'BOUNCED' ? BOUNCED_FIELDS : FAILED_FIELDS;
  const missing = missingFields(fields, required);
  if (missing.length > 0) {
    return rejection('missing-field', `${resultType} block is missing required field(s): ${missing.join(', ')}.`);
  }
  return {
    ok: true,
    result: resultType,
    fields,
    blocks: null,
    layout: { leadingHeader: true, trailingHeader: false, endSentinel, softMismatch: [] },
  };
}

function parseFencedResult(leadingLines, trailingLines, blocks) {
  const leadingAttempt = parseHeaderAttempt(leadingLines);
  const trailingAttempt = parseHeaderAttempt(trailingLines);

  // A completed or attempted BOUNCED/FAILED header alongside fenced SUCCESS
  // blocks is structurally contradictory — reject outright (ADR-0080 §3).
  if ((leadingAttempt.attempted && ['BOUNCED', 'FAILED'].includes(leadingAttempt.resultType)) ||
      (trailingAttempt.attempted && ['BOUNCED', 'FAILED'].includes(trailingAttempt.resultType))) {
    return rejection('layout-conflict', 'A BOUNCED/FAILED header copy cannot coexist with fenced SUCCESS blocks.');
  }

  if (leadingAttempt.attempted && !['SUCCESS', 'BOUNCED', 'FAILED'].includes(leadingAttempt.resultType)) {
    return rejection('unknown-result', `Unrecognized RESULT value "${leadingAttempt.resultType}" — must be SUCCESS, BOUNCED, or FAILED.`);
  }
  if (trailingAttempt.attempted && !['SUCCESS', 'BOUNCED', 'FAILED'].includes(trailingAttempt.resultType)) {
    return rejection('unknown-result', `Unrecognized RESULT value "${trailingAttempt.resultType}" — must be SUCCESS, BOUNCED, or FAILED.`);
  }

  const leadingComplete = isCompleteHeader(leadingAttempt);
  const trailingComplete = isCompleteHeader(trailingAttempt);

  if (!leadingComplete && !trailingComplete) {
    if (leadingAttempt.attempted) {
      const missing = missingFields(leadingAttempt.fields, SUCCESS_FIELDS);
      return rejection('missing-field', `SUCCESS block is missing required field(s): ${missing.join(', ')}.`);
    }
    if (trailingAttempt.attempted) {
      const missing = missingFields(trailingAttempt.fields, SUCCESS_FIELDS);
      return rejection('missing-field', `SUCCESS block is missing required field(s): ${missing.join(', ')}.`);
    }
    return rejection('missing-result-line', 'The first non-blank line must be exactly "RESULT: SUCCESS|BOUNCED|FAILED".');
  }

  const softMismatch = [];
  if (leadingComplete && trailingComplete) {
    if (normalize(leadingAttempt.resultType) !== normalize(trailingAttempt.resultType)) {
      return rejection('header-mismatch', 'The leading and trailing RESULT header copies disagree.', { field: 'RESULT' });
    }
    for (const field of MECHANICAL_FIELDS) {
      if (normalize(leadingAttempt.fields[field]) !== normalize(trailingAttempt.fields[field])) {
        return rejection('header-mismatch', `The leading and trailing header copies disagree on ${field}.`, { field });
      }
    }
    for (const field of PROSE_FIELDS) {
      if (normalize(leadingAttempt.fields[field]) !== normalize(trailingAttempt.fields[field])) {
        softMismatch.push(field);
      }
    }
  }

  const fields = leadingComplete ? leadingAttempt.fields : trailingAttempt.fields;

  const extracted = extractBlocksFromParsed(blocks);
  if (!extracted.ok) return extracted;

  const endSentinel = hasEndSentinel(trailingLines);

  return {
    ok: true,
    result: 'SUCCESS',
    fields,
    blocks: extracted.blocks,
    layout: { leadingHeader: leadingComplete, trailingHeader: trailingComplete, endSentinel, softMismatch },
  };
}

/** Validate block order/names and parse each of the four SUCCESS blocks' content. `blocks` is `scanBlocks`'s ordered list (may carry extra, tolerated blocks after BACKLOG_ITEMS). */
function extractBlocksFromParsed(blocks) {
  const foundNames = blocks.map((b) => b.name);
  for (let idx = 0; idx < BLOCK_NAMES.length; idx++) {
    if (foundNames[idx] !== BLOCK_NAMES[idx]) {
      return rejection(
        'missing-block',
        `Expected the SUCCESS blocks in order [${BLOCK_NAMES.join(', ')}]; found [${foundNames.join(', ') || '(none)'}] — missing or out of order at position ${idx + 1} (expected ${BLOCK_NAMES[idx]}).`,
        { block: BLOCK_NAMES[idx] }
      );
    }
  }

  const byName = Object.fromEntries(blocks.map((b) => [b.name, b.contentLines]));

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

  return { ok: true, blocks: { readmeDelta, adrs, outcome, backlogItems } };
}

/**
 * Parse a worker's strict `RESULT` return text.
 *
 * @param {string} text
 * @returns {
 *   {ok:true, result:'SUCCESS', fields:object, blocks:{readmeDelta:Array, adrs:Array<{filename:string,body:string}>, outcome:string, backlogItems:Array<{filename:string,body:string}>}, layout:{leadingHeader:boolean, trailingHeader:boolean, endSentinel:boolean, softMismatch:string[]}} |
 *   {ok:true, result:'BOUNCED'|'FAILED', fields:object, blocks:null, layout:{leadingHeader:boolean, trailingHeader:boolean, endSentinel:boolean, softMismatch:string[]}} |
 *   {ok:false, code:string, reason:string, block?:string, field?:string}
 * }
 */
export function parseWorkerResult(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return rejection('empty-result', 'The worker returned an empty or non-string RESULT text.');
  }

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const firstContentIdx = lines.findIndex((l) => l.trim() !== '');
  if (firstContentIdx === -1) {
    return rejection('empty-result', 'The worker returned only blank lines.');
  }

  const firstLine = lines[firstContentIdx];
  const startsWithResult = /^RESULT:\s?(\S+)\s*$/.test(firstLine);
  const startsWithFence = /^````([A-Z_]+)\s*$/.test(firstLine);
  if (!startsWithResult && !startsWithFence) {
    return rejection('missing-result-line', 'The first non-blank line must be exactly "RESULT: SUCCESS|BOUNCED|FAILED".');
  }

  const scan = scanBlocks(lines);
  if (!scan.ok) return scan;

  if (scan.blocks.length === 0) {
    return parseBlocklessResult(scan.leadingLines);
  }

  return parseFencedResult(scan.leadingLines, scan.trailingLines, scan.blocks);
}

/**
 * The conductor-designated sidecar path (ADR-0080 §1) a worker writes its
 * exact RESULT text to as its final action, for every RESULT kind — the one
 * sanctioned worker write outside its worktree. Relative to the repo root,
 * forward slashes always (Windows-safe as a literal path string).
 *
 * @param {string} taskId
 * @param {number} iteration - the verification iteration this dispatch is judged at (1-based)
 * @returns {string} `.worktrees/.results/<task-id>.iter-<N>.md`
 */
export function resultSidecarRelativePath(taskId, iteration) {
  if (typeof taskId !== 'string' || taskId.length === 0) {
    throw new TypeError(`resultSidecarRelativePath: taskId must be a non-empty string, got: ${JSON.stringify(taskId)}`);
  }
  if (!Number.isInteger(iteration) || iteration <= 0) {
    throw new TypeError(`resultSidecarRelativePath: iteration must be a positive integer, got: ${JSON.stringify(iteration)}`);
  }
  return `.worktrees/.results/${taskId}.iter-${iteration}.md`;
}

const ENTITY_RE = /&lt;|&gt;|&amp;|&quot;|&#39;|&#\d+;|&#x[0-9a-fA-F]+;/g;

function decodeEntity(entity) {
  switch (entity) {
    case '&lt;':
      return '<';
    case '&gt;':
      return '>';
    case '&amp;':
      return '&';
    case '&quot;':
      return '"';
    case '&#39;':
      return "'";
    default: {
      const numeric = entity.match(/^&#(\d+);$/);
      if (numeric) return String.fromCharCode(parseInt(numeric[1], 10));
      const hex = entity.match(/^&#x([0-9a-fA-F]+);$/);
      if (hex) return String.fromCharCode(parseInt(hex[1], 16));
      return entity;
    }
  }
}

const STRAY_CLOSING_TAG_RE = new RegExp(`^</(?:${BLOCK_NAMES.join('|')})>\\s*$`);

/**
 * Undo the harness's HTML-entity escaping of a completion-notification copy
 * of a worker's RESULT (ADR-0080 §4): a single left-to-right pass over
 * `&lt; &gt; &amp; &quot; &#39;` and numeric entities, so `&amp;lt;` becomes
 * `&lt;`, never `<` (the harness escapes the whole text exactly once — a
 * second unescape pass would be wrong), plus dropping any line that is
 * solely `</NAME>` for one of the four SUCCESS block names (a stray artifact
 * the notification generator sometimes injects). Plain text — no entities,
 * no stray closing-tag lines — is returned byte-identical.
 *
 * @param {string} text
 * @returns {string}
 */
export function unescapeNotificationCopy(text) {
  if (typeof text !== 'string') return text;
  const unescaped = text.replace(ENTITY_RE, decodeEntity);
  const lines = unescaped.split('\n');
  const filtered = lines.filter((line) => !STRAY_CLOSING_TAG_RE.test(line.trim()));
  return filtered.join('\n');
}

/**
 * Mechanized selection among the three possible copies of a worker's RESULT
 * (ADR-0080 §4) — sidecar, transcript, notification, in that priority order.
 * A candidate counts only if it parses AND its `TASK_ID` matches `taskId`.
 * Never a conductor prose choice.
 *
 * @param {{taskId:string, sidecar?:string, transcript?:string, notification?:string}} opts
 * @returns {{ok:true, source:'sidecar'|'transcript'|'notification', parsed:object, attempts:Array<{source:string, code:string}>} | {ok:false, code:'no-valid-source', attempts:Array<{source:string, code:string}>}}
 */
export function selectResultSource({ taskId, sidecar, transcript, notification } = {}) {
  const attempts = [];
  const candidates = [
    { source: 'sidecar', text: sidecar },
    { source: 'transcript', text: transcript },
    { source: 'notification', text: typeof notification === 'string' ? unescapeNotificationCopy(notification) : notification },
  ];

  for (const { source, text } of candidates) {
    if (typeof text !== 'string' || text.trim() === '') {
      attempts.push({ source, code: 'empty' });
      continue;
    }
    const parsed = parseWorkerResult(text);
    if (!parsed.ok) {
      attempts.push({ source, code: parsed.code });
      continue;
    }
    if (parsed.fields.TASK_ID !== taskId) {
      attempts.push({ source, code: 'task-id-mismatch' });
      continue;
    }
    return { ok: true, source, parsed, attempts };
  }

  return { ok: false, code: 'no-valid-source', attempts };
}
