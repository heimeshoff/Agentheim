/* ============================================================
   Agentheim — mermaid diagram rendering for the Markdown primitive
   (design-system-kw15t, ADR-0083)

   A fenced block with language `mermaid` is wrapped in a
   div.md-mermaid and swapped for an SVG once mermaid has rendered it.
   Mermaid itself is a lazily-loaded chunk: the ONLY way to reach it is
   the dynamic import in `defaultLoadMermaid` below — a static import
   would pull ~3.6 MB into app.js.
   ============================================================ */

// The dynamic import is the single, deliberate reach into mermaid.
export function defaultLoadMermaid() {
  return import("mermaid").then((m) => m.default || m);
}

// ---- token -> themeVariables --------------------------------------------
// Only hex tokens: color-mix() values break mermaid's colour parser. The
// reserved ochre accent (ADR-0016, ADR-0048) is never read.
const COLOR_MAP = [
  ["--surface-2", ["primaryColor", "mainBkg"]],
  ["--surface-1", ["secondaryColor", "tertiaryColor", "clusterBkg", "edgeLabelBackground"]],
  ["--hairline-strong", ["primaryBorderColor", "nodeBorder"]],
  ["--hairline", ["clusterBorder"]],
  ["--fg-1", ["primaryTextColor", "titleColor"]],
  ["--fg-2", ["textColor"]],
  ["--fg-3", ["lineColor"]],
  ["--surface-0", ["background"]],
];

export function mermaidThemeVariables(readToken, theme = "dark") {
  const vars = {};
  for (const [token, keys] of COLOR_MAP) {
    const v = String(readToken(token) ?? "").trim();
    if (!v) continue;
    for (const k of keys) vars[k] = v;
  }
  const font = String(readToken("--font-ui") ?? "").trim();
  if (font) vars.fontFamily = font;
  vars.darkMode = theme === "dark";
  return vars;
}

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function defaultReadToken(name) {
  return window.getComputedStyle(document.documentElement).getPropertyValue(name);
}

// ---- cache --------------------------------------------------------------
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36) + ":" + s.length;
}

const CACHE_MAX = 50;
const cache = new Map(); // key -> { svg, id }

function cacheGet(key) {
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); }
  return hit;
}
function cachePut(key, value) {
  cache.set(key, value);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

// ---- state --------------------------------------------------------------
let idCounter = 0;
let queue = Promise.resolve();
const mounted = new Map(); // container -> { src, loadMermaid, readToken, gen }
let observer = null;

function nextId() {
  return `agentheim-mmd-${++idCounter}-`;
}

function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

function cleanupStray(id) {
  for (const sel of [id, "d" + id]) {
    const el = document.getElementById(sel);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
}

function clearOutput(container) {
  container.querySelectorAll(":scope > .md-mermaid-svg, :scope > .md-mermaid-error").forEach((n) => n.remove());
}

function showSvg(container, svg) {
  clearOutput(container);
  const holder = document.createElement("div");
  holder.className = "md-mermaid-svg";
  holder.innerHTML = svg;
  const pre = container.querySelector(":scope > pre");
  if (pre) { pre.hidden = true; pre.before(holder); } else container.appendChild(holder);
}

function showError(container, message) {
  clearOutput(container);
  const pre = container.querySelector(":scope > pre");
  if (pre) pre.hidden = false;
  const note = document.createElement("div");
  note.className = "md-mermaid-error";
  note.setAttribute("role", "note");
  note.textContent = "Diagram could not be rendered" + (message ? " — " + message : ".");
  if (pre) pre.after(note); else container.appendChild(note);
}

async function renderOne(container, state) {
  const gen = ++state.gen;
  const stale = () => state.gen !== gen || !container.isConnected;
  return enqueue(async () => {
    if (stale()) return;
    const theme = currentTheme();
    const vars = mermaidThemeVariables(state.readToken, theme);
    const key = hash(state.src) + "|" + hash(JSON.stringify(vars));
    const hit = cacheGet(key);
    if (hit) {
      const id = nextId();
      showSvg(container, hit.svg.split(hit.id).join(id));
      return;
    }
    const id = nextId();
    try {
      const mermaid = await state.loadMermaid();
      if (typeof document !== "undefined" && document.fonts && document.fonts.ready) await document.fonts.ready;
      if (stale()) return;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        theme: "base",
        darkMode: theme === "dark",
        themeVariables: vars,
      });
      await mermaid.parse(state.src);
      const { svg } = await mermaid.render(id, state.src);
      cleanupStray(id);
      cachePut(key, { svg, id });
      if (stale()) return;
      showSvg(container, svg);
    } catch (err) {
      cleanupStray(id);
      if (stale()) return;
      showError(container, err && err.message ? String(err.message).split("\n")[0] : "");
    }
  });
}

function ensureObserver() {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver(() => {
    for (const [container, state] of [...mounted]) {
      if (!container.isConnected) { mounted.delete(container); continue; }
      renderOne(container, state);
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

/**
 * Wrap every `pre > code.language-mermaid` under rootEl in div.md-mermaid and
 * render it. Resolves when the queued renders for this root have settled.
 * The loader is only called if the root actually contains a mermaid fence.
 */
export function renderMermaidBlocks(rootEl, { loadMermaid = defaultLoadMermaid, readToken = defaultReadToken } = {}) {
  const codes = [...rootEl.querySelectorAll("pre > code.language-mermaid")];
  if (!codes.length) return Promise.resolve();
  ensureObserver();
  const pending = [];
  for (const code of codes) {
    const pre = code.parentElement;
    const container = document.createElement("div");
    container.className = "md-mermaid";
    pre.replaceWith(container);
    container.appendChild(pre);
    const state = { src: code.textContent, loadMermaid, readToken, gen: 0 };
    mounted.set(container, state);
    pending.push(renderOne(container, state));
  }
  return Promise.all(pending).then(() => {});
}
