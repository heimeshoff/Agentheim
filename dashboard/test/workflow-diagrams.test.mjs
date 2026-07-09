// Static guard for the Workflow guide page's HAND-AUTHORED flow diagrams
// (agentic-workflow-060, governed by ADR-0003 / ADR-0017; reworked for
// first-time comprehension). The diagrams speak a TWO-VOICE grammar: ochre
// elements are the builder's moves (WNode kind="skill" boxes you invoke, WYou
// pills for calls only you make); neutral elements are Agentheim's machinery
// (artifact boxes) and its adversarial checks (WGuard pills on edges). Every
// phase diagram OPENS with a WYou pill quoting the phrase that starts the
// phase — "I say this → this happens".
//
// The board's React glue has no DOM render harness in this project; the established
// idiom (aw-026 / aw-027 / aw-039 / aw-058 / aw-059) is source-reading static guards.
// This suite follows it, asserting against the diagram primitives + the three diagram
// component sources in board.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

// Slice the diagram block: from the first diagram primitive (WNode) through the END
// of PromoteWorkDiagram, so every assertion has the primitives AND the three diagram
// components in scope.
function diagramSource() {
  const start = boardSrc.indexOf('function WNode(');
  assert.ok(start > -1, 'the WNode diagram primitive must exist in board.js');
  const lastAt = boardSrc.indexOf('function PromoteWorkDiagram(');
  assert.ok(lastAt > -1, 'PromoteWorkDiagram must exist in board.js');
  const after = boardSrc.indexOf('\nfunction ', lastAt + 'function PromoteWorkDiagram('.length);
  const end = after > -1 ? after : boardSrc.length;
  return boardSrc.slice(start, end);
}

// One diagram function's own source, for per-diagram shape assertions.
function fnSource(name) {
  const start = boardSrc.indexOf(`function ${name}(`);
  assert.ok(start > -1, `${name} must exist in board.js`);
  const after = boardSrc.indexOf('\nfunction ', start + name.length + 10);
  return boardSrc.slice(start, after > -1 ? after : boardSrc.length);
}

const dg = diagramSource();
// Strip single-line // comments for the "no library / no SVG" structural checks so
// the doc-comments (which legitimately mention SVG / library to record their absence)
// don't trip the assertions.
const dgCode = dg.replace(/^\s*\/\/.*$/gm, '');

test('each segment is carried by a hand-authored diagram component', () => {
  assert.match(dg, /function PreparationDiagram\(/, 'Prepare must have an authored diagram');
  assert.match(dg, /function CapturingDiagram\(/, 'Capture & refine must have an authored diagram');
  assert.match(dg, /function PromoteWorkDiagram\(/, 'Promote & work must have an authored diagram');
});

test('the diagrams are built with HTML + CSS — NO inline SVG, NO diagramming library', () => {
  assert.doesNotMatch(dgCode, /<svg|createElement\(['"]svg|\bpath d=/i, 'no inline SVG allowed');
  assert.doesNotMatch(dgCode, /mermaid|d3|reactflow|react-flow|cytoscape|gojs|dagre/i,
    'no diagramming library may be referenced');
});

test('the two-voice grammar: every phase diagram OPENS with a WYou pill (the phrase you say)', () => {
  for (const name of ['PreparationDiagram', 'CapturingDiagram', 'PromoteWorkDiagram']) {
    const src = fnSource(name);
    const youIdx = src.indexOf('<${WYou}>');
    const nodeIdx = src.indexOf('<${WNode}');
    assert.ok(youIdx > -1, `${name} must open with a WYou pill`);
    assert.ok(nodeIdx > -1, `${name} must contain WNode boxes`);
    assert.ok(youIdx < nodeIdx, `${name}: the WYou opening phrase must come before any node`);
  }
});

test('Prepare is linear then FANS OUT to the foundation outputs', () => {
  // YOU → brainstorm → (vision.md + context-map.md) → YOU approves → fan-out
  assert.match(dg, /label="brainstorm"/, 'Prepare names the brainstorm skill');
  assert.match(dg, /label="vision\.md"/, 'Prepare names the vision.md artifact');
  assert.match(dg, /label="context-map\.md"/, 'Prepare names the context-map.md artifact');
  assert.match(dg, /WFanRow/, 'Prepare uses a fan-out row for the foundation outputs');
  for (const out of ['infrastructure BC', 'foundation tasks', 'walking skeleton', 'styleguide']) {
    assert.ok(dg.includes(`label="${out}"`), `Prepare fan-out must include "${out}"`);
  }
});

test('Capture & refine converges two intake doors on the backlog, with the shaping loop attached', () => {
  assert.match(dg, /label="quick-capture"/, 'names the quick-capture intake door');
  assert.match(dg, /label="modeling"[\s\S]*?verb="CAPTURE"/, 'names the modeling CAPTURE intake door');
  assert.match(dg, /label="backlog\/"/, 'has a central backlog node');
  assert.match(dg, /verb="REFINE"/, 'shows the modeling REFINE loop');
  assert.match(dg, /label="research"/, 'shows the research feed-in');
  assert.match(dg, /verb="DISMISS"/, 'shows the modeling DISMISS loop');
  assert.match(dg, /while it waits/, 'the shaping operations read as an in-place loop on the backlog');
});

test('Promote & work is a PIPELINE with the verifier FAIL → ×2 → escalate retry loop', () => {
  assert.match(dg, /verb="PROMOTE"/, 'Promote & work shows modeling PROMOTE');
  assert.match(dg, /backlog → todo/, 'Promote & work shows the backlog → todo transition');
  assert.match(dg, /label="work"/, 'Promote & work names the work skill');
  assert.match(dg, /WGuard\} label="verifier"/, 'the verifier renders as an edge pill');
  assert.match(dg, /FAIL → re-dispatch ×2 → escalate/, 'the FAIL retry loop is shown');
  assert.match(dg, /one task = one commit/, 'Promote & work states one task = one commit');
});

test('gates / human checks render as edge PILLS (WYou / WGuard), never as agent boxes', () => {
  assert.match(dg, /function WYou\(/, 'a dedicated builder-move pill primitive must exist');
  assert.match(dg, /function WGuard\(/, 'a dedicated adversarial-check pill primitive must exist');
  // No orchestrator / specialist / research-reviewer agent BOXES (WNode label=...).
  assert.doesNotMatch(dg, /label="orchestrator"/, 'orchestrator must not be a node box');
  assert.doesNotMatch(dg, /WNode\}[^>]*label="research-reviewer"/, 'research-reviewer must not be a node box');
  assert.doesNotMatch(dg, /<\$\{WNode\}[^>]*label="verifier"/, 'verifier must be an edge pill, not a node box');
  assert.doesNotMatch(dg, /<\$\{WNode\}[^>]*label="specialist"/, 'no specialist node box');
});

test('every color / border / fill is a design-system CSS var (light/dark theme tracking)', () => {
  // The diagram primitives must use var(--…) tokens, and must NOT hardcode hex colors.
  assert.match(dg, /var\(--accent-ochre\)/, 'the builder voice tints from the accent token');
  assert.match(dg, /var\(--hairline-strong\)/, 'connectors / artifact borders use a hairline token');
  assert.match(dg, /var\(--obligation\)/, 'the FAIL loop colors from the obligation token');
  assert.doesNotMatch(dg, /#[0-9a-fA-F]{3,8}\b/, 'no hardcoded hex colors — tokens only, for theme tracking');
});

test('the diagrams are read-only and static: no fetch, no write, no motion by default', () => {
  assert.doesNotMatch(dgCode, /fetch\(|\/api\//, 'diagrams perform no fetch (read-only, ADR-0017)');
  assert.doesNotMatch(dgCode, /method:\s*["'](POST|PUT|PATCH|DELETE)["']/i, 'diagrams perform no write');
  // No motion is added; if it ever were, it must sit behind prefers-reduced-motion.
  if (/animation|transition:\s*[^;]*(transform|opacity)/i.test(dgCode)) {
    assert.match(dgCode, /prefers-reduced-motion/, 'any motion must honor prefers-reduced-motion');
  }
});

test('the segment diagram frame keeps role="img" with a descriptive aria-label (real flow)', () => {
  const seg = boardSrc.slice(boardSrc.indexOf('function WorkflowSegment('));
  assert.match(seg, /role="img"/, 'the segment diagram frame stays role="img"');
  assert.match(seg, /aria-label=\$\{diagramLabel\}/, 'the frame uses the passed-in descriptive aria-label');
  // The page passes a real-flow aria-label per segment — never "placeholder".
  const page = boardSrc.slice(boardSrc.indexOf('function WorkflowPage('));
  assert.match(page, /diagramLabel="Prepare flow:/, 'Prepare passes a real-flow aria-label');
  assert.match(page, /diagramLabel="Capture and refine flow:/, 'Capture & refine passes a real-flow aria-label');
  assert.match(page, /diagramLabel="Promote and work flow:/, 'Promote & work passes a real-flow aria-label');
  assert.doesNotMatch(page, /diagramLabel="[^"]*placeholder/i, 'no aria-label may say "placeholder"');
});

test('the at-a-glance loop map keeps the same rules: tokens only, no SVG, labelled return edge', () => {
  const map = fnSource('WorkflowMapCard') + fnSource('WorkflowMap');
  assert.doesNotMatch(map.replace(/^\s*\/\/.*$/gm, ''), /<svg/i, 'no inline SVG in the map');
  assert.doesNotMatch(map, /#[0-9a-fA-F]{3,8}\b/, 'no hardcoded hex colors in the map');
  assert.match(map, /ship, then capture the next idea/, 'the return edge is labelled');
  assert.match(map, /once per project/, 'phase 01 carries its cadence');
  assert.match(map, /any time/, 'phase 02 carries its cadence');
});
