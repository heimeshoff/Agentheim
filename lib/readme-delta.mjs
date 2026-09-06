// readme-delta — a pure, git-free README delta grammar (agentic-workflow-ghcaj,
// amends ADR-0032 §3/§4/§6).
//
// Why this exists: once a worker's private branch carries source and tests
// only, it can no longer edit its BC README directly — it REPORTS a delta
// (the `README_DELTA` block in `references/worker-return-format.md`), and the
// conductor applies it on `main`, sequentially, one document at a time. This
// module is the pure application function both the conductor's integration
// step and this task's own fixtures call: `content` in, `{content,
// dispositions}` out — never a disk write (ADR-0038 layer 2, ADR-0054's
// compute-then-write rule: the conductor writes the returned content ONCE).
//
// Two ops only, deliberately — `append` and `replace` — chosen over a
// free-form patch or a full-document rewrite because README entries are
// CURATED PROSE (ADR-0041), not atomic list lines: a script cannot safely
// delete or restructure them, only add a new bullet or replace one whole
// bullet whose extent it can compute unambiguously. The invariant this
// grammar preserves is ADR-0041's own — delta application is MONOTONE in the
// set of terms and invariants a README states; only CONSOLIDATE (builder in
// the loop) may reduce it. There is no `remove`, no `rename-section`, no
// section creation here, on purpose.
//
// Shape doctrine (mirrors lib/task-lifecycle.mjs / lib/adr-allocation.mjs):
//   - stdlib-free — this module needs no imports at all;
//   - git-free — never runs `git`, never touches the filesystem;
//   - side-effect-free — a content string + a delta in, plain data out.

/** Every delta not naming an existing section lands here (ADR-0041's own doctrine home). */
export const FALLBACK_SECTION = 'Ubiquitous language';

const SECTION_HEADER_RE = /^## (.+)$/;
const BULLET_START_RE = /^- /;
const MARKER_RE = /^<!--/;

/** Collapse all whitespace runs (including newlines) to a single space, then trim. */
function collapseWs(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

/**
 * Locate a top-level (`## `) section's BODY line range within `lines`
 * (`[start, end)`, `start` the line right after the header, `end` the line
 * index of the next `## ` header or `lines.length`). Returns `null` when no
 * section with this exact (trimmed) name exists.
 */
function findSectionLineRange(lines, sectionName) {
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SECTION_HEADER_RE);
    if (!m) continue;
    if (start === -1) {
      if (m[1].trim() === sectionName) start = i + 1;
    } else {
      end = i;
      break;
    }
  }
  return start === -1 ? null : { start, end };
}

/**
 * Every col-0 `- ` bullet's extent inside `[start, end)`: a bullet runs from
 * its own `- ` line up to (but not including) the next col-0 `- ` line, a
 * `#` header, an `<!-- ` marker, or `end` — trailing blank lines are trimmed
 * back OUT of the extent (they stay put in the document, untouched, between
 * bullets or before the next header).
 */
function findBulletsInRange(lines, start, end) {
  const bullets = [];
  let i = start;
  while (i < end) {
    if (!BULLET_START_RE.test(lines[i])) {
      i++;
      continue;
    }
    const bstart = i;
    i++;
    while (i < end && !BULLET_START_RE.test(lines[i]) && !lines[i].startsWith('#') && !MARKER_RE.test(lines[i])) {
      i++;
    }
    let bend = i;
    while (bend > bstart + 1 && lines[bend - 1].trim() === '') bend--;
    bullets.push({ start: bstart, end: bend });
  }
  return bullets;
}

function bulletText(lines, bullet) {
  return lines.slice(bullet.start, bullet.end).join('\n');
}

/**
 * The anchor key for a bullet: its bold lead-in (`- **<head>**...`) truncated
 * at its FIRST `(`, whitespace-collapsed. `null` when the bullet has no bold
 * lead-in at all (never matches any anchor — such a bullet is simply never a
 * `replace` target).
 */
function termHeadOf(text) {
  const m = text.match(/^- \*\*(.+?)\*\*/);
  if (!m) return null;
  let head = m[1];
  const parenIdx = head.indexOf('(');
  if (parenIdx !== -1) head = head.slice(0, parenIdx);
  return collapseWs(head);
}

/** End-of-bullet-list insertion point: `range.end` with trailing blank lines trimmed back out. */
function endOfBulletList(lines, range) {
  let at = range.end;
  while (at > range.start && lines[at - 1].trim() === '') at--;
  return at;
}

function spliceIn(lines, atLine, bodyText) {
  const bodyLines = bodyText.split('\n');
  return [...lines.slice(0, atLine), ...bodyLines, ...lines.slice(atLine)];
}

function replaceRange(lines, bullet, bodyText) {
  const bodyLines = bodyText.split('\n');
  return [...lines.slice(0, bullet.start), ...bodyLines, ...lines.slice(bullet.end)];
}

/** `append` — a new bullet at the end of the named section's bullet list, or a no-op if it's already there verbatim. */
function applyAppend(lines, range, bullets, body) {
  const already = bullets.some((b) => collapseWs(bulletText(lines, b)) === collapseWs(body));
  if (already) return { lines, disposition: 'noop-already' };
  const at = endOfBulletList(lines, range);
  return { lines: spliceIn(lines, at, body), disposition: 'applied' };
}

/** `replace` — anchor on `(section, termHead)`, `expected` compared whitespace-collapsed. */
function applyReplace(lines, range, bullets, op) {
  const { anchor, body, expected } = op;
  const anchorKey = collapseWs(anchor);
  const target = bullets.find((b) => termHeadOf(bulletText(lines, b)) === anchorKey);

  if (!target) {
    // Anchor is gone (e.g. a sibling's earlier CONSOLIDATE, or a section
    // reshaped since the worker read it) — no current bullet to merge onto,
    // so the incoming intent is appended at the end of the list rather than
    // silently dropped. Grouped with the collision family per the grammar's
    // own doctrine: never a refusal, never a strand.
    const at = endOfBulletList(lines, range);
    return { lines: spliceIn(lines, at, body), disposition: 'merged' };
  }

  const currentText = bulletText(lines, target);
  if (collapseWs(currentText) === collapseWs(body)) {
    // The bullet already reads as the incoming body — a re-dispatched
    // worker re-reporting the same delta. Checked BEFORE the expected
    // comparison: the end state already matches, regardless of whether
    // `expected` (a stale read) happens to match too.
    return { lines, disposition: 'noop-already' };
  }

  if (collapseWs(expected) === collapseWs(currentText)) {
    return { lines: replaceRange(lines, target, body), disposition: 'applied' };
  }

  // Collision: `expected` no longer matches the current bullet (a sibling
  // integrated earlier this batch, the conductor's own earlier write, or a
  // concurrent `modeling` session). Never undo the other change — re-express
  // the incoming body as its own bullet immediately after the anchor's
  // extent, so BOTH intents survive in the document.
  return { lines: spliceIn(lines, target.end, body), disposition: 'merged' };
}

/**
 * A delta naming a section that does not exist lands as an `append` into
 * `FALLBACK_SECTION` — never a silently created section, never a refusal
 * that strands already-merged code without its README entry.
 */
function applyFallback(lines, op) {
  const body = op.op === 'replace' ? op.body : op.body;
  const range = findSectionLineRange(lines, FALLBACK_SECTION);
  if (!range) {
    // Even the fallback section is absent (a document with no ubiquitous-
    // language section at all, e.g. a fresh context-map.md) — append at the
    // very end of the document rather than throwing.
    const at = lines.length;
    return { lines: spliceIn(lines, at, body), disposition: 'appended-fallback' };
  }
  const at = endOfBulletList(lines, range);
  return { lines: spliceIn(lines, at, body), disposition: 'appended-fallback' };
}

/**
 * Apply one README/context-map delta — `{section, ops}` — to `content`,
 * returning the new content plus one disposition per op, in order. Ops
 * within one delta are applied SEQUENTIALLY (each sees the previous op's
 * effect), matching how the conductor folds several ops from one worker's
 * report into one document pass.
 *
 * @param {string} content   The full document text.
 * @param {{section: string, ops: Array<
 *   {op:'append', body:string} |
 *   {op:'replace', anchor:string, body:string, expected:string}
 * >}} delta
 * @returns {{content: string, dispositions: string[]}}
 */
export function applyReadmeDelta(content, delta) {
  const { section, ops } = delta;
  let lines = String(content).split('\n');
  const dispositions = [];

  for (const op of ops) {
    const range = findSectionLineRange(lines, section);
    if (!range) {
      const result = applyFallback(lines, op);
      lines = result.lines;
      dispositions.push(result.disposition);
      continue;
    }

    const bullets = findBulletsInRange(lines, range.start, range.end);
    let result;
    if (op.op === 'append') {
      result = applyAppend(lines, range, bullets, op.body);
    } else if (op.op === 'replace') {
      result = applyReplace(lines, range, bullets, op);
    } else {
      throw new Error(`applyReadmeDelta: unknown op "${op.op}" (must be "append" or "replace")`);
    }
    lines = result.lines;
    dispositions.push(result.disposition);
  }

  return { content: lines.join('\n'), dispositions };
}
