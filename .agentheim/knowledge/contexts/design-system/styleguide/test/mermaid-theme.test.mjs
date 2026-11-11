// mermaidThemeVariables — pure token -> themeVariables mapping (design-system-kw15t).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mermaidThemeVariables } from '../app/mermaid-render.js';

const DARK = { '--surface-0': '#090C12', '--surface-1': '#0D1119', '--surface-2': ' #121826', '--hairline': '#1C2330',
  '--hairline-strong': '#2B3548', '--fg-1': '#F2F5F9', '--fg-2': '#AEB8C4', '--fg-3': '#7D8794',
  '--font-ui': " 'Inter Tight', system-ui, sans-serif", '--accent-ochre': '#FF00FF', '--accent-ochre-soft': '#FF00FE' };
const LIGHT = { ...DARK, '--surface-0': '#FAF8F4', '--surface-1': '#EFF1F4', '--surface-2': '#E4E7ED', '--fg-1': '#0C0E12' };
const reader = (t) => (name) => t[name];

test('every colour value is a hex colour (values trimmed)', () => {
  const v = mermaidThemeVariables(reader(DARK), 'dark');
  for (const [k, val] of Object.entries(v)) {
    if (k === 'fontFamily' || k === 'darkMode') continue;
    assert.match(val, /^#[0-9a-f]{3,8}$/i, k);
  }
  assert.equal(v.primaryColor, '#121826');
});

test('dark and light differ in primaryColor and primaryTextColor; darkMode follows the theme', () => {
  const d = mermaidThemeVariables(reader(DARK), 'dark');
  const l = mermaidThemeVariables(reader(LIGHT), 'light');
  assert.notEqual(d.primaryColor, l.primaryColor);
  assert.notEqual(d.primaryTextColor, l.primaryTextColor);
  assert.equal(d.darkMode, true);
  assert.equal(l.darkMode, false);
});

test('no value comes from an accent-ochre token; fontFamily comes from --font-ui', () => {
  const v = mermaidThemeVariables(reader(DARK), 'dark');
  assert.ok(!Object.values(v).some((x) => /ff00fe?/i.test(String(x))));
  assert.equal(v.fontFamily, "'Inter Tight', system-ui, sans-serif");
  const asked = [];
  mermaidThemeVariables((n) => { asked.push(n); return '#000'; }, 'dark');
  assert.ok(!asked.some((n) => n.startsWith('--accent-ochre')));
});

test('maps tokens per the task table', () => {
  const v = mermaidThemeVariables(reader(DARK), 'dark');
  assert.equal(v.mainBkg, v.primaryColor);
  assert.equal(v.nodeBorder, '#2B3548');
  assert.equal(v.clusterBorder, '#1C2330');
  assert.equal(v.lineColor, '#7D8794');
  assert.equal(v.textColor, '#AEB8C4');
  assert.equal(v.background, '#090C12');
});
