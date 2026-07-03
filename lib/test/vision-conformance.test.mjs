// Unit tests for the deterministic half of work's session-end
// vision-conformance pass (agentic-workflow-v6d4n): vision.md section
// extraction and advisory-line formatting. The LLM judgment itself (does a
// shipped task pull toward a non-goal / away from a success criterion) is
// NOT unit-testable — it is exercised by evals/vision-conformance-check/'s
// planted-drift and clean-batch fixtures instead. See
// skills/work/SKILL.md's "Vision-conformance check (session-end)" section
// for how these helpers plug into the session-end step.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractSection,
  extractVisionSections,
  labelFor,
  formatConformanceLine,
  worthSurfacing,
} from '../vision-conformance.mjs';

const SAMPLE_VISION = `# Vision

## Purpose

Some purpose text.

## What success looks like

- A builder can go idea to shipped code without losing the why.
- Independent work runs in parallel without collisions.

## Non-goals

1. **Not a teaching/workshop tool.** The modes serve model quality, not pedagogy.
2. **Not autonomous.** The human stays in the loop at every gate.

## Ubiquitous language (seed)

- Term one.
`;

// --- extractSection ---

test('extractSection collects bullet items under a level-2 heading', () => {
  const items = extractSection(SAMPLE_VISION, 'What success looks like');
  assert.deepEqual(items, [
    'A builder can go idea to shipped code without losing the why.',
    'Independent work runs in parallel without collisions.',
  ]);
});

test('extractSection collects numbered items and stops at the next heading', () => {
  const items = extractSection(SAMPLE_VISION, 'Non-goals');
  assert.deepEqual(items, [
    '**Not a teaching/workshop tool.** The modes serve model quality, not pedagogy.',
    '**Not autonomous.** The human stays in the loop at every gate.',
  ]);
});

test('extractSection returns an empty array when the heading is absent', () => {
  assert.deepEqual(extractSection(SAMPLE_VISION, 'Open questions'), []);
});

test('extractSection ignores non-list prose lines under the heading', () => {
  const text = `## Purpose\n\nSome prose that is not a bullet.\n\n- but this is one\n\n## Next\n`;
  assert.deepEqual(extractSection(text, 'Purpose'), ['but this is one']);
});

// --- extractVisionSections ---

test('extractVisionSections reads both named sections in one pass', () => {
  const { successCriteria, nonGoals } = extractVisionSections(SAMPLE_VISION);
  assert.equal(successCriteria.length, 2);
  assert.equal(nonGoals.length, 2);
  assert.match(nonGoals[1], /Not autonomous/);
});

// --- labelFor ---

test('labelFor extracts the leading bold phrase when present', () => {
  assert.equal(
    labelFor('**Not autonomous.** The human stays in the loop at every gate.'),
    'Not autonomous.'
  );
});

test('labelFor falls back to the item text when short and unbolded', () => {
  assert.equal(labelFor('A short plain item.'), 'A short plain item.');
});

test('labelFor truncates a long unbolded item to ~60 chars', () => {
  const long = 'x'.repeat(100);
  const label = labelFor(long);
  assert.ok(label.length <= 60);
  assert.ok(label.endsWith('...'));
});

// --- formatConformanceLine ---

test('formatConformanceLine reports "none" for an empty flag set', () => {
  assert.equal(formatConformanceLine([]), 'none — batch aligns with vision');
});

test('formatConformanceLine reports "none" when flags is undefined', () => {
  assert.equal(formatConformanceLine(undefined), 'none — batch aligns with vision');
});

test('formatConformanceLine formats a single non-goal flag', () => {
  const line = formatConformanceLine([
    { taskId: 'agentic-workflow-abc12', kind: 'non-goal', label: 'Not autonomous.', note: 'auto-applies fixes with no user review' },
  ]);
  assert.equal(
    line,
    'agentic-workflow-abc12: diverges from non-goal "Not autonomous." — auto-applies fixes with no user review'
  );
});

test('formatConformanceLine formats a success-criterion flag without a note', () => {
  const line = formatConformanceLine([
    { taskId: 'agentic-workflow-xyz99', kind: 'success', label: 'Independent work runs in parallel' },
  ]);
  assert.equal(
    line,
    'agentic-workflow-xyz99: diverges from success criterion "Independent work runs in parallel"'
  );
});

test('formatConformanceLine joins multiple flags with "; "', () => {
  const line = formatConformanceLine([
    { taskId: 'a', kind: 'non-goal', label: 'Not autonomous.', note: 'note-a' },
    { taskId: 'b', kind: 'success', label: 'Some criterion', note: 'note-b' },
  ]);
  assert.equal(
    line,
    'a: diverges from non-goal "Not autonomous." — note-a; b: diverges from success criterion "Some criterion" — note-b'
  );
});

// --- worthSurfacing ---

test('worthSurfacing is false for an empty or missing flag set', () => {
  assert.equal(worthSurfacing([]), false);
  assert.equal(worthSurfacing(undefined), false);
});

test('worthSurfacing is true for any non-empty flag set', () => {
  assert.equal(worthSurfacing([{ taskId: 'a', kind: 'non-goal', label: 'x' }]), true);
});
