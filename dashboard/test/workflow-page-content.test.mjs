// Static guard for the Workflow guide page's layout + caption copy
// (agentic-workflow-059, governed by ADR-0003 / ADR-0017 / ADR-0025; reworked
// for first-time comprehension — at-a-glance loop map + legend + three phase
// segments with cut-down captions).
//
// The page answers a newcomer's questions in order: the WorkflowMap hero shows
// the whole shape (01 Prepare once, then the 02↔03 standing loop), the
// WorkflowLegend explains the diagram grammar, and three named segments —
// Prepare, Capture & refine, Promote & work — carry the detail with honest,
// skill-accurate captions. The page is static / built-in (no /api/doc fetch),
// read-only (ADR-0017), styleguide tokens consumed unforked (ADR-0003), and
// keeps the main-pane reader's centered reading measure (maxWidth 760,
// margin "0 auto" — aw-040).
//
// The board's React glue has no DOM render harness in this project; the established
// idiom (aw-026 / aw-027 / aw-039 / aw-058) is source-reading static guards. This
// suite follows it, asserting against the WorkflowPage function source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

// The WorkflowPage composes board-local sub-components (WorkflowSegment /
// WorkflowCaption / Wcode / the diagrams / WorkflowMap / WorkflowLegend) defined
// just above it. We slice the whole co-located block — from the first segment
// helper through the END of WorkflowPage — so every content assertion has both
// the structure and the copy in scope.
function workflowSource() {
  const start = boardSrc.indexOf('function WorkflowSegment(');
  assert.ok(start > -1, 'WorkflowSegment helper must exist in board.js');
  const pageAt = boardSrc.indexOf('function WorkflowPage(', start);
  assert.ok(pageAt > -1, 'WorkflowPage must exist in board.js');
  // End of WorkflowPage: the next top-level `function ` after the page declaration.
  const after = boardSrc.indexOf('\nfunction ', pageAt + 'function WorkflowPage('.length);
  const end = after > -1 ? after : boardSrc.length;
  return boardSrc.slice(start, end);
}

const wf = workflowSource();

// The static-safety assertions (no /api/doc fetch, no isTaskIntent) target the
// RENDERED CODE, not the explanatory comments — the doc-comment legitimately names
// `/api/doc` and `isTaskIntent` to record that the page touches neither. Strip
// single-line `//` comments before those checks.
const wfCode = wf.replace(/^\s*\/\/.*$/gm, '');

test('the page renders three NAMED segments in order: Prepare → Capture & refine → Promote & work', () => {
  const prep = wf.indexOf('title="Prepare"');
  const cap = wf.indexOf('title="Capture & refine"');
  const promote = wf.indexOf('title="Promote & work"');
  assert.ok(prep > -1, 'segment 1 must be named "Prepare"');
  assert.ok(cap > -1, 'segment 2 must be named "Capture & refine"');
  assert.ok(promote > -1, 'segment 3 must be named "Promote & work"');
  assert.ok(prep < cap && cap < promote, 'the three segments must appear in order');
});

test('each segment carries a WHEN cadence chip — the newcomer\'s "when do I do this?"', () => {
  assert.match(wf, /when="once per project"/, 'Prepare must be marked once-per-project');
  assert.match(wf, /when="any time"/, 'Capture & refine must be marked any-time');
  assert.match(wf, /when="when tasks are ready"/, 'Promote & work must be marked when-tasks-are-ready');
});

test('the page opens with the at-a-glance loop map and its legend', () => {
  const mapAt = boardSrc.indexOf('function WorkflowMap(');
  const legendAt = boardSrc.indexOf('function WorkflowLegend(');
  assert.ok(mapAt > -1, 'the WorkflowMap hero must exist');
  assert.ok(legendAt > -1, 'the WorkflowLegend key must exist');
  assert.match(wf, /<\$\{WorkflowMap\}/, 'the page must render the loop map');
  assert.match(wf, /<\$\{WorkflowLegend\}/, 'the page must render the legend');
  // The map must precede the three segments — orientation before detail.
  const mapRenderIdx = wf.indexOf('<${WorkflowMap}');
  const firstSegmentIdx = wf.indexOf('<${WorkflowSegment}');
  assert.ok(mapRenderIdx > -1 && firstSegmentIdx > -1 && mapRenderIdx < firstSegmentIdx,
    'the loop map must render before the first segment');
  // The loop-back edge is labelled — the 02↔03 standing loop is explicit.
  assert.match(wf, /ship, then capture the next idea/,
    'the map must label the return edge (ship, then capture the next idea)');
});

test('caption copy names the REAL skills/verbs honestly (Prepare segment)', () => {
  assert.match(wf, /brainstorm/, 'Prepare must name the brainstorm skill');
  assert.match(wf, /vision\.md/, 'Prepare must name vision.md');
  assert.match(wf, /context-map\.md/, 'Prepare must name context-map.md');
  assert.match(wf, /walking[- ]skeleton/i, 'Prepare must mention the walking-skeleton spike');
});

test('caption copy shows quick-capture AND modeling as two DISTINCT intake doors (Capture & refine segment)', () => {
  assert.match(wf, /quick-capture/, 'Capture & refine must name quick-capture as one intake door');
  assert.match(wf, /modeling/, 'Capture & refine must name modeling as the other intake door');
  assert.match(wf, /research/, 'Capture & refine must mention research importing outside knowledge');
  assert.match(wf, /research-reviewer/, 'Capture & refine must name the research-reviewer gate');
  assert.match(wf, /DISMISS|[Dd]ismiss/, 'Capture & refine must include DISMISS');
});

test('caption copy names the verifier correctly (NOT "verify") and shows escalation (Promote & work segment)', () => {
  assert.match(wf, /\bverifier\b/, 'the gate must be named the "verifier"');
  // "verify" as a bare verb (not part of "verifier"/"verification") would be the
  // refinement-flagged inaccuracy. Allow "verification"; reject a standalone "verify".
  assert.doesNotMatch(wf, /\bverify\b/, 'must not call the gate "verify" — it is the verifier');
  assert.match(wf, /work/, 'Promote & work must name the work skill');
  assert.match(wf, /[Pp]romote/, 'Promote & work must name PROMOTE');
  assert.match(wf, /one task = one commit|one commit/i, 'Promote & work must state one task = one commit');
});

test('the human-in-the-loop gates are explicitly marked', () => {
  assert.match(wf, /[Gg]ate/, 'the page must explicitly call out the gates');
  assert.match(wf, /human-in-the-loop|review|escalat/i,
    'the page must mark the human-in-the-loop gates (review / escalation)');
});

test('each segment carries a diagram slot — the page renders exactly three segments', () => {
  // The diagram slot is a reusable segment primitive: WorkflowSegment renders ONE
  // `role="img"` diagram frame, and the page invokes WorkflowSegment three times — so
  // three slots render, one per segment (plus the hero map's own role="img" frame).
  assert.match(wf, /role="img"/, 'WorkflowSegment must render a role="img" diagram frame');
  assert.match(wf, /aria-label=\$\{diagramLabel\}/,
    'the diagram frame must carry a descriptive aria-label (the real flow)');
  const segments = wf.match(/<\$\{WorkflowSegment\}/g) || [];
  assert.equal(segments.length, 3, 'the page must render exactly three segments, each with its own diagram slot');
});

test('the page keeps the main-pane reader centered reading measure (maxWidth 760, margin "0 auto" — aw-040)', () => {
  assert.match(wf, /maxWidth:\s*760/, 'the page must use the 760px reading measure');
  assert.match(wf, /margin:\s*["']0 auto["']/, 'the page must center its reading column with margin "0 auto"');
});

test('the page is static / built-in: no /api/doc fetch, no isTaskIntent, read-only (ADR-0017)', () => {
  assert.doesNotMatch(wfCode, /\/api\/doc/, 'the built-in page must not fetch /api/doc (it is static)');
  assert.doesNotMatch(wfCode, /isTaskIntent/, 'the built-in page is not an open-intent');
  assert.doesNotMatch(wfCode, /method:\s*["'](POST|PUT|PATCH|DELETE)["']/i, 'the page performs no write');
});

test('styleguide is consumed unforked: copy uses design-system tokens (ADR-0003)', () => {
  assert.match(wf, /var\(--fg-1\)/, 'segment titles use the --fg-1 token');
  assert.match(wf, /var\(--font-ui\)/, 'copy uses the --font-ui token');
});

// Regression guard (agentic-workflow-q3n7k): the guide predates the `inquire` and
// `whats-next` skills, so it silently omitted them once they shipped. This locks in
// that both are named AND correctly positioned — not merely appended to a list —
// so the guide can't go stale again the same way as more skills ship.
test('the guide names both inquire and whats-next, correctly positioned in the flow', () => {
  assert.match(wf, /\bwhats-next\b/, 'the guide must name the whats-next skill');
  assert.match(wf, /\binquire\b/, 'the guide must name the inquire skill');

  // whats-next sits at the planning moment: it must precede modeling PROMOTE inside
  // the Promote & work diagram, not be tacked on after the pipeline.
  const promoteVerbIdx = wf.indexOf('verb="PROMOTE"');
  const whatsNextNodeIdx = wf.indexOf('label="whats-next"');
  assert.ok(promoteVerbIdx > -1, 'modeling PROMOTE must still be in the diagram');
  assert.ok(whatsNextNodeIdx > -1, 'whats-next must render as a diagram node');
  assert.ok(whatsNextNodeIdx < promoteVerbIdx,
    'whats-next must precede modeling PROMOTE in the Promote & work diagram (the planning moment)');

  // inquire is an any-time read-only lens, OUTSIDE the three numbered segments —
  // never merely appended into one of their skill lists. Match the rendered
  // mention specifically (`Wcode}>inquire`), not the doc-comment prose above the
  // function, which also legitimately names it.
  assert.match(wf, /any time/i, 'inquire must be framed as available any time');
  const lastSegmentCloseIdx = wf.lastIndexOf('</${WorkflowSegment}>');
  const inquireRenderedIdx = wf.indexOf('Wcode}>inquire');
  assert.ok(lastSegmentCloseIdx > -1, 'the three segments must still close normally');
  assert.ok(inquireRenderedIdx > -1, 'inquire must render inline (not just in comments)');
  assert.ok(inquireRenderedIdx > lastSegmentCloseIdx,
    'inquire must be presented outside/after the three numbered segments, not inside one');
});
