// Static guard for the board's WHAT'S-NEXT advisory recommendation panel
// (agentic-workflow-073 / ADR-0027).
//
// The `whats-next` skill writes a single-latest advisory artifact at
// `.agentheim/state/whats-next.md` (aw-076). This panel READS it via the existing
// /api/doc body carrier and renders it above the board prompt bar's "Prompt" title,
// through the SAME withFrontmatterSection + styleguide Markdown path the slide-over /
// main-pane reader use. It self-suppresses when the artifact is absent or the current
// recommendation was dismissed (keyed by `generated`), re-fetches on every SSE frame,
// and shows a staleness cue.
//
// The board's React glue has no DOM render harness in this project — the idiom
// (aw-023/043/065) is: pure logic gets node --test coverage (whats-next-state.test.mjs),
// and the board's wiring is guarded by reading its source. This suite locks the aw-073
// acceptance criteria that are not pure helper logic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.join(here, '..');
const boardSrc = readFileSync(path.join(dashboardDir, 'app', 'board.js'), 'utf8');

function panel() {
  // The component body runs from its declaration to the start of the helper that
  // immediately follows it (defaultFetchWhatsNext).
  const m = boardSrc.match(/function WhatsNextPanel[\s\S]*?(?=\/\*\* Default fetch for the advisory artifact)/);
  assert.ok(m, 'WhatsNextPanel component must exist');
  return m[0];
}

test('a WhatsNextPanel component exists and renders the styleguide Markdown primitive', () => {
  assert.match(panel(), /<\$\{Markdown\}/, 'the panel must render through the unforked Markdown primitive (ADR-0003)');
});

test('the panel DROPS the folded "Front matter" render — no withFrontmatterSection (aw-q7m4k)', () => {
  // The glanceable card strips the leading YAML rather than folding it into a <details>.
  assert.doesNotMatch(panel(), /withFrontmatterSection/, 'the panel must not fold a "Front matter" section anymore');
});

test('the panel splits the body into named columns via splitWhatsNextSections (aw-q7m4k)', () => {
  assert.match(panel(), /splitWhatsNextSections\(body\)/, 'the body is split into its named sections, not rendered as one stream');
});

test('the named sections render as a multi-column grid, each heading + Markdown (aw-q7m4k)', () => {
  const p = panel();
  // A CSS grid lays the sections out side by side (with a responsive collapse track).
  assert.match(p, /display:\s*"grid"/, 'the columns lay out in a grid');
  assert.match(p, /gridTemplateColumns:\s*"repeat\(auto-fit/, 'auto-fit columns collapse on a narrow board');
  // Each column maps to a heading label + its content through the unforked Markdown.
  assert.match(p, /columns\.map\(/, 'one column per parsed section');
  assert.match(p, /col\.heading/, 'each column keeps its section heading');
  assert.match(p, /<\$\{Markdown\}\s+source=\$\{col\.content\}/, 'each column renders its content through the unforked Markdown primitive');
});

test('the panel fetches the ADR-0027 artifact via /api/doc, NOT /api/tree', () => {
  // The default fetcher targets the advisory artifact through the docUrl (/api/doc) carrier.
  assert.match(boardSrc, /defaultFetchWhatsNext[\s\S]*?docUrl\(WHATS_NEXT_DOC_PATH\)/);
  // The panel never folds the recommendation into the always-fetched tree projection.
  assert.doesNotMatch(panel(), /api\/tree/, 'the recommendation must not enter /api/tree (ADR-0023)');
});

test('an absent artifact (fetch failure) resolves to render NOTHING (no shell, no error)', () => {
  // The fetch .catch sets body to null; a null/blank body returns null (renders nothing).
  assert.match(panel(), /\.catch\([\s\S]*?setBody\(null\)/);
  assert.match(panel(), /if \(typeof body !== "string" \|\| body\.trim\(\) === ""\) return null;/);
});

test('the panel re-fetches live on every SSE frame (ADR-0006)', () => {
  assert.match(panel(), /useLiveTree\(reload\)/);
});

test('the panel shows a staleness cue derived from the generated stamp (ADR-0027 §4)', () => {
  assert.match(panel(), /formatStaleness\(generated, Date\.now\(\)\)/);
  assert.match(panel(), /\$\{staleness\}/);
});

test('the panel is dismissible and dismiss deletes the artifact via DELETE /api/whats-next (ADR-0046)', () => {
  const p = panel();
  assert.match(p, /setBody\(null\)/, 'dismiss optimistically clears the local body');
  assert.match(p, /fetch\("\/api\/whats-next",\s*\{\s*method:\s*"DELETE"\s*\}\)/, 'dismiss issues the ADR-0046 delete-only endpoint');
  assert.match(p, /Dismiss the What's next recommendation/, 'a dismiss control must exist');
});

test('the retired localStorage dismiss store is not referenced by the panel (ADR-0046)', () => {
  const p = panel();
  assert.doesNotMatch(p, /isDismissed\(/, 'the localStorage dismiss gate must be removed');
  assert.doesNotMatch(p, /saveDismissed\(/, 'the localStorage dismiss persist must be removed');
});

// agentic-workflow-bz3az: BoardPromptBar is rebuilt into the ADR-0050 docked
// bottom-center console (position: fixed) — WhatsNextPanel no longer lives inside
// it (that would float the advisory panel inside a fixed overlay with no "Prompt"
// title left to sit above). It renders instead directly in DashboardBoard, in-flow,
// above the BoardHeader count strip — the same relative position it held before
// (above the board's own header/content), just hoisted out of the now-fixed bar.
test('the panel is composed in DashboardBoard, above the BoardHeader count strip', () => {
  const render = boardSrc.match(/return html`\s*<div>[\s\S]*?<\$\{WhatsNextPanel\}[\s\S]*?<\$\{BoardHeader\}/);
  assert.ok(render, 'DashboardBoard must render WhatsNextPanel before (above) BoardHeader');
});

test('WhatsNextPanel is no longer composed inside BoardPromptBar', () => {
  const bar = boardSrc.match(/function BoardPromptBar[\s\S]*?\n}/);
  assert.ok(bar, 'BoardPromptBar must exist');
  assert.doesNotMatch(bar[0], /<\$\{WhatsNextPanel\}/, 'BoardPromptBar (now a fixed docked console) must not host WhatsNextPanel');
});

test('the panel is styleguide-consumed unforked — token-styled, no new design-system child', () => {
  // Token-referencing styles only (light/dark aware for free); no hardcoded hex chrome.
  assert.match(panel(), /var\(--surface-1\)/);
  assert.match(panel(), /var\(--hairline\)/);
});

// The per-column wrapper that the columns.map(...) renders — its style object. The
// card chrome + cap + scroll live here (aw-c4t8m). Matched from the mapped <div key=...>
// up to the heading render that follows.
function columnCard() {
  const p = panel();
  const m = p.match(/columns\.map\(\(col, i\) => html`[\s\S]*?<div key=\$\{i\}[\s\S]*?style=\$\{\{[\s\S]*?\}\}>/);
  assert.ok(m, 'the per-column wrapper card must exist');
  return m[0];
}

test('each What\'s Next column is its own card — board-local, token-matched chrome (aw-c4t8m)', () => {
  const card = columnCard();
  // Surface fill + --hairline border + radius + padding, all token-referencing
  // (no hardcoded hex; light/dark aware for free; styleguide consumed unforked, ADR-0003).
  assert.match(card, /background:\s*"var\(--surface-1\)"/, 'card carries a token surface fill');
  // The border is conditional since agentic-workflow-a2pm1 (step 2 wears the
  // --emphasis-border hero) — every non-hero card still falls back to --hairline.
  assert.match(card, /:\s*"1px solid var\(--hairline\)"/, 'card carries a --hairline border in the non-hero branch');
  assert.match(card, /borderRadius:\s*"var\(--radius/, 'card carries a token radius');
  assert.match(card, /padding:/, 'card carries padding');
});

test('each column card is height-bounded and scrolls its overflow internally (aw-c4t8m)', () => {
  const card = columnCard();
  // A bounded max-height (roughly two ticket cards) keeps the row a compact top strip…
  assert.match(card, /maxHeight:/, 'the card caps its height');
  // …and content past the cap scrolls vertically INSIDE the card rather than growing it.
  assert.match(card, /overflowY:\s*"auto"/, 'overflow scrolls inside the card');
});

test('the column card uses the quiet styleguide scrollbar treatment (aw-c4t8m)', () => {
  // The existing styleguide `scroll-quiet` class (agentheim.css) — consumed unforked,
  // not a bespoke scrollbar.
  assert.match(columnCard(), /className="scroll-quiet"/, 'the capped card wears the quiet scrollbar');
});

test('the capped cards keep the responsive auto-fit grid (aw-q7m4k preserved)', () => {
  // The height cap is layered ON the existing responsive grid — it is not replaced.
  assert.match(panel(), /gridTemplateColumns:\s*"repeat\(auto-fit, minmax\(220px, 1fr\)\)"/, 'auto-fit grid preserved');
});

// The flight-plan stepper (agentic-workflow-a2pm1): three plain columns become three
// NUMBERED, CONNECTED steps — a numbered circle per parsed column joined by a
// horizontal connector line, POSITION-based (never text-matched) so the loss-tolerant
// splitWhatsNextSections contract (aw-q7m4k / aw-073) still holds for a degraded body.

test('the panel renders one numbered stepper circle per parsed column, position-based (agentic-workflow-a2pm1)', () => {
  const p = panel();
  assert.match(p, /columns\.flatMap\(\(col, i\) => \{/, 'the stepper walks the parsed columns in document order');
  assert.match(p, /\$\{i \+ 1\}/, 'each circle is labelled by its 1-based position, not by the section text');
});

test('consecutive stepper circles are joined by a horizontal connector line, one fewer than the circle count (agentic-workflow-a2pm1)', () => {
  const p = panel();
  assert.match(p, /i < columns\.length - 1/, 'a connector only renders BETWEEN two circles — never after the last step');
  assert.match(p, /height: 1,[\s\S]{0,80}background: "var\(--hairline\)"/, 'the connector is a plain hairline-token horizontal line');
});

test('step 2 (the second parsed column) wears the --emphasis-border hero treatment, keyed to position not text (agentic-workflow-a2pm1 / ADR-0048)', () => {
  const p = panel();
  assert.match(p, /i === 1 \? "1px solid var\(--emphasis-border\)"/, 'the hero border is keyed to the SECOND column position, whichever section actually lands there');
  assert.match(p, /boxShadow:\s*i === 1 \? "[^"]*var\(--emphasis-border\)[^"]*"/, 'the hero also carries a matching token-driven shadow');
  assert.doesNotMatch(p, /rgba\(/, 'no raw rgba hero color — the named token only (ADR-0048)');
});

test('exactly one surface in the region references --emphasis-border — no second hero (agentic-workflow-a2pm1)', () => {
  const p = panel();
  const hits = p.match(/var\(--emphasis-border\)/g) || [];
  // The border reference and its matching shadow both belong to the SAME single step-2
  // hero card — nowhere else (not the stepper circles, not any other card) uses the token.
  assert.equal(hits.length, 2, 'the emphasis-border token must appear only on the one step-2 hero card (border + shadow)');
});

test('the flight-plan stepper does not disturb the existing single X-dismiss control (aw-vmk1z regression) — no reload button', () => {
  const p = panel();
  assert.match(p, /Dismiss the What's next recommendation/, 'the dismiss control still renders');
  assert.match(p, /fetch\("\/api\/whats-next",\s*\{\s*method:\s*"DELETE"\s*\}\)/, 'dismiss still issues the ADR-0046 delete-only endpoint');
  const buttons = p.match(/<button/g) || [];
  assert.equal(buttons.length, 1, 'exactly one <button> renders in the panel — the X-dismiss; no reload button introduced');
});
