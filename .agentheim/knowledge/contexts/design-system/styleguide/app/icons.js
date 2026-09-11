/* ============================================================
   Agentheim — inline SVG icon set (Lucide geometry, no runtime).
   Rendering icons as static SVG avoids any DOM-mutation library,
   so there is no observer/createIcons feedback loop.
   ============================================================ */
import { html } from "./html.js";

export const LUCIDE = {
  "square-kanban": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7"/><path d="M12 7v4"/><path d="M16 7v9"/>',
  "library": '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
  "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  "plus": '<path d="M5 12h14"/><path d="M12 5v14"/>',
  "folder": '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  "copy": '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  "square-arrow-out-up-right": '<path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/>',
  "bot": '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  "inbox": '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  "folder-git-2": '<path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v3"/><circle cx="13" cy="12" r="2"/><path d="M18 19c-2.8 0-5-2.2-5-5v8"/><circle cx="20" cy="19" r="2"/>',
  "settings-2": '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  "box": '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  "compass": '<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/>',
  "git-fork": '<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/>',
  "flask-conical": '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
  "scale": '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  "moon": '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  "git-commit-horizontal": '<circle cx="12" cy="12" r="3"/><line x1="3" x2="9" y1="12" y2="12"/><line x1="15" x2="21" y1="12" y2="12"/>',
  "file-text": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  "maximize": '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  "trash-2": '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  // Inquiry glyph for the board's Inquire launch card (design-system-r4k8m /
  // agentic-workflow-h7n2c): a chat bubble carrying a question mark — "ask a
  // question toward the codebase". Distinct from `search` and `compass` already
  // worn by the sibling cards. Lucide `message-circle-question` geometry copied
  // verbatim — bubble outline + tail, question-mark curve, and the dot. Inner
  // markup only; Icon supplies the <svg> wrapper.
  "message-circle-question": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  // Content-type glyph for `concept` (design-system-021): idea / insight / synthesis.
  // Lucide `lightbulb` geometry copied verbatim — bulb dome path, filament base
  // (y=18), screw base (y=22). Inner markup only; Icon supplies the <svg> wrapper.
  "lightbulb": '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  // Right-anchored panel "widen in place" pair (design-system-020). Distinct from
  // `maximize` (four-corner promote) — these read as resizing this right panel.
  // Lucide geometry copied verbatim: shared rounded frame + right divider (x=15);
  // open = chevron pointing left into content, close = chevron pointing right.
  "panel-right-open": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m10 15-3-3 3-3"/>',
  "panel-right-close": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m8 9 3 3-3 3"/>',
  // Double-chevron collapse/expand pair (design-system-c3p9k): the Done-column
  // collapse control (agentic-workflow-m2v8d) needs "two arrows pointing up" to
  // collapse, flipping to point down when collapsed. The registry only carried
  // single `chevron-right`. Lucide `chevrons-up` / `chevrons-down` geometry copied
  // verbatim — two stacked chevrons each. Inner markup only; Icon supplies <svg>.
  "chevrons-up": '<path d="m17 11-5-5-5 5"/><path d="m17 18-5-5-5 5"/>',
  "chevrons-down": '<path d="m7 6 5 5 5-5"/><path d="m7 13 5 5 5-5"/>',
  // Prompt-mode tab glyphs aligned to Section 1b (design-system-xr4sb). The
  // Modeling and Research tabs wore undeliberate defaults (`compass` /
  // `search`, never ADR- or task-backed — see r4k8m's "sibling cards" note),
  // so they are replaced here. Lucide `diamond` / `circle-dot` geometry
  // copied verbatim. Inner markup only; Icon supplies the <svg> wrapper.
  "diamond": '<path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z"/>',
  "circle-dot": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
  // The return-arrow ("↵") glyph for the solid-ochre icon Enter button
  // (design-system-xr4sb, button.js EnterButton) — ADR-0048 surface 2 /
  // ADR-0051. Lucide `corner-down-left` geometry copied verbatim.
  "corner-down-left": '<path d="M20 4v7a4 4 0 0 1-4 4H4"/><path d="m9 10-5 5 5 5"/>',
  // The caret glyph for the ModelSplitButton's menu-opening region
  // (design-system-r9dtm, button.js). Lucide `chevron-down` geometry copied
  // verbatim. Distinct from the existing `chevron-right` (used for expand
  // affordances, not a dropdown caret).
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
};

export function Icon({ name, size = 16, stroke = 1.5, color = "currentColor", style }) {
  const inner = LUCIDE[name] || "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="display:block">${inner}</svg>`;
  return html`
    <span aria-hidden="true"
      style=${{ width: size, height: size, color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...style }}
      dangerouslySetInnerHTML=${{ __html: svg }} />`;
}
