// Markdown primitive renders ```mermaid fences as diagrams (design-system-kw15t, ADR-0083).
// Real mermaid is never loaded here (jsdom has no getBBox) — a fake loader is injected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mount, act, flush, dom } from './dom-harness.mjs';

globalThis.MutationObserver = dom.window.MutationObserver;
const { Markdown } = await import('../../.agentheim/knowledge/contexts/design-system/styleguide/app/primitives.js');
const { createElement } = await import('react');

const root$ = document.documentElement;
const tokens = (dark) => {
  const t = dark
    ? { '--surface-2': '#121826', '--fg-1': '#F2F5F9', '--font-ui': 'Inter' }
    : { '--surface-2': '#E4E7ED', '--fg-1': '#0C0E12', '--font-ui': 'Inter' };
  for (const [k, v] of Object.entries(t)) root$.style.setProperty(k, v);
};
tokens(true);
root$.setAttribute('data-theme', 'dark');

function fakeMermaid({ failOn } = {}) {
  const f = { inits: [], renders: [], parses: [] };
  f.mermaid = {
    initialize: (c) => f.inits.push(c),
    parse: async (src) => { f.parses.push(src); if (failOn && src.includes(failOn)) throw new Error('Parse error on line 2\nmore'); },
    render: async (id, src) => {
      f.renders.push({ id, src, vars: f.inits[f.inits.length - 1].themeVariables });
      if (failOn && src.includes(failOn)) {
        const stray = document.createElement('div'); stray.id = 'd' + id; document.body.appendChild(stray);
        throw new Error('render failed');
      }
      return { svg: `<svg id="${id}" xmlns="http://www.w3.org/2000/svg"><style>#${id} .n{fill:${f.inits[f.inits.length - 1].themeVariables.primaryColor}}</style><marker id="${id}_m"></marker><text>${src.length}</text></svg>` };
    },
  };
  f.loader = async () => f.mermaid;
  f.calls = 0;
  const loader = f.loader;
  f.loader = async () => { f.calls++; return loader(); };
  return f;
}

const fence = (s) => '```mermaid\n' + s + '\n```';
async function mountMd(source, loader) {
  const m = await mount(Markdown, { source, mermaidLoader: loader });
  await flush(5);
  return m;
}
const unmount = (m) => act(async () => m.root.unmount());

test('a mermaid fence becomes div.md-mermaid with the svg; js fence still highlighted; no-mermaid doc never loads', async () => {
  const f = fakeMermaid();
  const m = await mountMd(`# T\n\n${fence('flowchart LR\n A-->B')}\n\n\`\`\`js\nconst x = 1\n\`\`\`\n`, f.loader);
  try {
    const box = m.container.querySelector('div.md-mermaid');
    assert.ok(box && box.querySelector('svg'));
    assert.ok(m.container.querySelector('pre code .c-key'), 'js highlighted');
    assert.equal(m.container.querySelectorAll('div.md-mermaid').length, 1);
  } finally { await unmount(m); }
  const g = fakeMermaid();
  const m2 = await mountMd('# Plain\n\n```js\nconst y = 2\n```\n', g.loader);
  try { assert.equal(g.calls, 0); assert.equal(m2.container.querySelector('.md-mermaid'), null); } finally { await unmount(m2); }
});

test('config: initialize gets strict / startOnLoad false / base', async () => {
  const f = fakeMermaid();
  const m = await mountMd(fence('flowchart LR\n C-->D'), f.loader);
  try {
    const c = f.inits[0];
    assert.equal(c.securityLevel, 'strict');
    assert.equal(c.startOnLoad, false);
    assert.equal(c.theme, 'base');
    assert.equal(c.suppressErrorRendering, true);
  } finally { await unmount(m); }
});

test('invalid source: code block stays, role=note follows, rest renders, no stray body element', async () => {
  const f = fakeMermaid({ failOn: 'BROKEN' });
  const m = await mountMd(`# Title\n\n${fence('BROKEN ((')}\n\nafter paragraph\n`, f.loader);
  try {
    const box = m.container.querySelector('.md-mermaid');
    const pre = box.querySelector('pre');
    assert.ok(pre && !pre.hidden);
    assert.equal(pre.nextElementSibling.className, 'md-mermaid-error');
    assert.equal(pre.nextElementSibling.getAttribute('role'), 'note');
    assert.match(m.container.textContent, /after paragraph/);
    assert.equal(document.querySelectorAll('body > div[id^="dagentheim-mmd"]').length, 0);
    assert.equal(document.querySelector('[id^="dagentheim-mmd"]'), null);
  } finally { await unmount(m); }
});

test('theme switch re-renders once with new themeVariables; flipping back uses the cache', async () => {
  tokens(true); root$.setAttribute('data-theme', 'dark');
  const f = fakeMermaid();
  const m = await mountMd(fence('flowchart LR\n theme-a-->b') + '\n\n' + fence('flowchart LR\n theme-c-->d'), f.loader);
  try {
    assert.equal(f.renders.length, 2);
    tokens(false); root$.setAttribute('data-theme', 'light');
    await flush(10);
    assert.equal(f.renders.length, 4, 'one re-render per diagram');
    assert.equal(f.renders[2].vars.primaryColor, '#E4E7ED');
    assert.equal(f.inits[f.inits.length - 1].darkMode, false);
    tokens(true); root$.setAttribute('data-theme', 'dark');
    await flush(10);
    assert.equal(f.renders.length, 4, 'dark again comes from the cache');
    assert.equal(m.container.querySelectorAll('.md-mermaid svg').length, 2);
  } finally { await unmount(m); }
});

test('source change renders only the edited diagram; svg ids stay unique', async () => {
  tokens(true); root$.setAttribute('data-theme', 'dark');
  const f = fakeMermaid();
  const same = fence('flowchart LR\n same-->one');
  const m = await mountMd(same + '\n\n' + fence('flowchart LR\n edit-->v1'), f.loader);
  try {
    assert.equal(f.renders.length, 2);
    await act(async () => { m.root.render(createElement(Markdown, { source: same + '\n\n' + fence('flowchart LR\n edit-->v2'), mermaidLoader: f.loader })); });
    await flush(10);
    assert.equal(f.renders.length, 3);
    assert.match(f.renders[2].src, /v2/);
    const ids = [...m.container.querySelectorAll('[id]')].map((e) => e.id);
    assert.equal(ids.length, new Set(ids).size, ids.join(','));
    assert.equal(m.container.querySelectorAll('.md-mermaid svg').length, 2);
  } finally { await unmount(m); }
});

test('the same diagram in two Markdown mounts never shares an id (cache reuse rewrites ids)', async () => {
  tokens(true); root$.setAttribute('data-theme', 'dark');
  const f = fakeMermaid();
  const src = fence('flowchart LR\n shared-->twice');
  const a = await mountMd(src, f.loader);
  const b = await mountMd(src, f.loader);
  try {
    assert.equal(f.renders.length, 1);
    const ids = [...document.querySelectorAll('.md-mermaid [id]')].map((e) => e.id);
    assert.equal(ids.length, new Set(ids).size);
    assert.ok(!b.container.innerHTML.includes(f.renders[0].id));
  } finally { await unmount(a); await unmount(b); }
});

test('canvas import map pins mermaid/marked/react/htm to the exact dashboard/package.json versions', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8'));
  const idx = readFileSync(path.join(here, '..', '..', '.agentheim/knowledge/contexts/design-system/styleguide/index.html'), 'utf8');
  const map = JSON.parse(idx.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [spec, name, rx] of [
    ['mermaid', 'mermaid', /^https:\/\/esm\.sh\/mermaid@(.+)$/],
    ['marked', 'marked', /^https:\/\/esm\.sh\/marked@(.+)$/],
    ['react', 'react', /^https:\/\/esm\.sh\/react@(.+)$/],
    ['htm', 'htm', /^https:\/\/esm\.sh\/htm@(.+)$/],
  ]) {
    const v = map[spec].match(rx)[1];
    assert.equal(v, deps[name], spec);
  }
});
