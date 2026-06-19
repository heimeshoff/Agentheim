// Source guard for the left-rail "new item" attention cue WIRING in board.js
// (agentic-workflow-n4h7q).
//
// The detection/clearing brain is the pure rail-attention.js (covered by
// rail-attention.test.mjs). This guard locks the integration glue in the ShellRail
// render — the board has no DOM render harness, so (per the aw-016/066 idiom) we read
// the source and assert the cue is actually threaded through:
//   - the rail composes the styleguide Collapsible + TreeItem directly (so the
//     design-system-v8k2p `attention` flag can be passed — TreeGroup has no seam),
//   - each group header gets the DERIVED group cue (attention=${g.attention}),
//   - each leaf gets its per-row cue (attention=${it.attention}),
//   - clicking routes through openAndClear (per-entry, mtime-versioned clearing),
//   - the baseline/cleared state stays in-memory (no /api write, no localStorage).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

test('the rail imports the pure rail-attention transform', () => {
  assert.match(
    boardSrc,
    /import \{[^}]*railMtimeIndex[^}]*flaggedPaths[^}]*annotateGroups[^}]*\} from "\.\/rail-attention\.js"/,
    'board.js must consume the pure rail-attention detection helpers',
  );
});

test('the rail composes Collapsible + TreeItem directly (not TreeGroup) so it can thread attention', () => {
  assert.match(boardSrc, /cuedGroups\.map\(\(g\) =>/, 'the rail maps the cue-annotated groups');
  assert.match(boardSrc, /<\$\{Collapsible}[\s\S]*?attention=\$\{g\.attention}/, 'the group header carries the derived cue');
  assert.match(boardSrc, /<\$\{TreeItem}[\s\S]*?attention=\$\{it\.attention}/, 'each leaf carries its per-row cue');
});

test('clicking a rail row routes through openAndClear (per-entry, mtime-versioned clearing)', () => {
  assert.match(boardSrc, /onOpen=\$\{openAndClear}/, 'rail rows clear on click via openAndClear');
  assert.match(boardSrc, /const openAndClear = useCallback/, 'openAndClear is defined in the rail');
  assert.match(boardSrc, /setCleared\(\(prev\) => \(\{ \.\.\.prev,/, 'clearing records only the clicked entry');
});

test('the cue state stays in-memory presentation state — no /api write, no localStorage (ADR-0017)', () => {
  // The rail render region must not introduce a write path for the cue. We scope the
  // check to the ShellRail function body so unrelated board localStorage (theme,
  // whats-next dismiss) does not trip it.
  const start = boardSrc.indexOf('function ShellRail(');
  const end = boardSrc.indexOf('function StoppedOverlay(');
  assert.ok(start >= 0 && end > start, 'ShellRail body is locatable');
  const railBody = boardSrc.slice(start, end);
  // No localStorage ACCESS (a .getItem/.setItem call or a window.localStorage read) —
  // the bare word appears only in the explanatory comment, which we tolerate.
  assert.doesNotMatch(railBody, /localStorage\s*\./, 'the rail cue must not access localStorage');
  assert.doesNotMatch(railBody, /\.(setItem|removeItem)\s*\(/, 'the rail cue must not write storage');
  assert.doesNotMatch(railBody, /method:\s*["'](POST|PUT|PATCH|DELETE)/i, 'the rail cue must not issue a write fetch');
  assert.match(railBody, /baselineRef/, 'the session baseline is held in-memory');
});
