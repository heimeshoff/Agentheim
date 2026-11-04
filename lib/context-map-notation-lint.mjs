// context-map-notation-lint — live-tree doctrine lint (ADR-0059, ADR-0068,
// agentic-workflow-dd8yn) guarding the surfaces that carry the context-map
// mermaid diagram convention. stdlib-only, side-effect-free, loss-tolerant.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const NOTATION = 'references/context-map-notation.md';
const BRAINSTORM = 'skills/brainstorm/SKILL.md';
const MODELER = 'agents/strategic-modeler.md';
const WORKER = 'agents/worker.md';

/** Stable phrase pinned in agents/worker.md. */
export const WORKER_SENTENCE = 'never edit the context map\'s `## Diagram` fence';

function read(root, rel) {
  try {
    return readFileSync(path.join(root, rel), 'utf8');
  } catch {
    return null;
  }
}

function mermaidFences(text) {
  return [...text.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
}

/**
 * @param {string} root
 * @returns {{file: string, problem: string}[]}
 */
export function findContextMapNotationViolations(root) {
  const v = [];
  const add = (file, problem) => v.push({ file, problem });

  const notation = read(root, NOTATION);
  if (notation === null) {
    add(NOTATION, 'missing');
  } else {
    const ex = mermaidFences(notation).find((f) => f.trimStart().startsWith('flowchart LR'));
    if (!ex) add(NOTATION, 'no mermaid example starting with `flowchart LR`');
    else if (/\b(fill|color)\s*:|stroke\s*:\s*(#|rgb|hsl|[a-z]+\b(?!-))/i.test(ex)) {
      add(NOTATION, 'example contains a colour value (fill/color/stroke colour)');
    }
  }

  const brainstorm = read(root, BRAINSTORM);
  if (brainstorm === null) add(BRAINSTORM, 'missing');
  else {
    const m = brainstorm.match(/## Diagram\n+```mermaid\n/);
    if (!m) add(BRAINSTORM, 'context-map template has no `## Diagram` section with a mermaid fence');
    if (!brainstorm.includes(NOTATION)) add(BRAINSTORM, `no pointer to ${NOTATION}`);
  }

  const modeler = read(root, MODELER);
  if (modeler === null) add(MODELER, 'missing');
  else {
    if (!modeler.includes('## Diagram')) add(MODELER, 'does not mention the `## Diagram` section');
    if (!modeler.includes(NOTATION)) add(MODELER, `no pointer to ${NOTATION}`);
  }

  const worker = read(root, WORKER);
  if (worker === null) add(WORKER, 'missing');
  else if (!worker.includes(WORKER_SENTENCE)) add(WORKER, 'lost the "never edit the diagram fence" sentence');

  return v;
}
