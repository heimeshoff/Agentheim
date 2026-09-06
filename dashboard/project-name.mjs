// Project-name resolution for the dashboard browser-tab title (infrastructure-011).
//
// The dashboard runtime is decoupled from the project it inspects (ADR-0004): the
// committed dist/ ships beside server.mjs and bakes a single default <title>.
// But project discovery (ADR-0002) resolves an arbitrary project root at runtime,
// so the tab must name THAT project, not the baked default. We resolve the name
// from the discovered project and rewrite the served index.html's <title> at
// serve time — server-side injection, so there is no flash of the baked default
// and the static handler's traversal/validation guarantees stay intact.
//
// Name source, in order:
//   1. the `# Vision: <Name>` heading in vision.md — `.agentheim/vision.md` under
//      the legacy layout, `.agentheim/knowledge/vision.md` under `board`
//      (ADR-0078; resolved through `lib/task-system-paths.mjs`'s `visionPath`,
//      never a raw `path.join` here — agentic-workflow-hxq1g);
//   2. fall back to the project root folder name (path.basename(root)).
//
// Pure, stdlib-only (node:fs, node:path) — no new dependency, install step, or CDN
// (ADR-0002 / ADR-0003).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { visionPath } from '../lib/task-system-paths.mjs';

const VISION_HEADING = /^[ \t]*#[ \t]+Vision:[ \t]*(.+?)[ \t]*$/m;

/**
 * Parse the project name from a vision.md body. Matches the exact `# Vision:`
 * heading produced by brainstorm's vision template, tolerating leading
 * whitespace and trimming the captured name. Returns null when no such heading
 * is present.
 */
export function parseVisionName(visionText) {
  if (typeof visionText !== 'string') return null;
  const m = visionText.match(VISION_HEADING);
  if (!m) return null;
  const name = m[1].trim();
  return name.length > 0 ? name : null;
}

/**
 * Resolve the discovered project's name. Reads vision.md (layout-resolved via
 * `visionPath`) and uses its `# Vision:` heading; falls back to the root
 * folder basename when the file is missing, carries no heading, or the layout
 * is `'mixed'` (a `visionPath` throw — ADR-0017: the dashboard never guesses,
 * it degrades). Never throws.
 */
export function resolveProjectName(root) {
  try {
    const text = readFileSync(visionPath(root), 'utf8');
    const name = parseVisionName(text);
    if (name) return name;
  } catch {
    // vision.md absent/unreadable, or the layout is 'mixed' (visionPath
    // throws) — fall through to the folder name either way.
  }
  return path.basename(path.resolve(root));
}

/** Build the browser-tab title, preserving the ` — Dashboard` suffix/format. */
export function dashboardTitle(name) {
  return `${name} — Dashboard`;
}

/** Escape the five XML/HTML metacharacters so a project name cannot break out
 *  of the <title> element (e.g. a name containing `<` or `&`). */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Rewrite the <title> element of an index.html string to `title`. No-op when the
 * document has no <title>. The replacement value is HTML-escaped. Only the first
 * <title> is touched (index.html carries exactly one).
 */
export function injectTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
}
