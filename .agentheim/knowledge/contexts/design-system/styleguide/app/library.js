/* ============================================================
   Agentheim — left navigation / file tree
   Browses the project's agent workspace. Content-type icons
   are colored by their token so a README, an ADR, and a
   research note are distinguishable at a glance.
   ============================================================ */
import { useState } from "react";
import { html } from "./html.js";
import { Icon } from "./icons.js";
import { Glyph } from "./foundations.js";
import { Collapsible } from "./collapsible.js";
import { attentionCueClass } from "./motion.js";
import { CONTENT_TYPES, TICKETS, LIBRARY } from "./data.js";

// ---- A single document row in the tree ----
// `attention` (opt-in, default OFF) renders the quiet "new item" ambient cue
// (design-system-v8k2p): a breathing left-edge dot drawing the eye to a
// freshly-arrived artifact. OFF (the default) adds no class — byte-identical to
// today. The consumer (agentic-workflow-n4h7q) owns which rows are new and the
// until-acknowledged lifecycle; the styleguide only renders the cue.
export function TreeItem({ item, selected, onOpen, attention = false }) {
  const [hover, setHover] = useState(false);
  const t = CONTENT_TYPES[item.type];
  return html`
    <button className=${["focusable", attentionCueClass(attention)].filter(Boolean).join(" ")}
      onClick=${() => onOpen(item)}
      onMouseEnter=${() => setHover(true)} onMouseLeave=${() => setHover(false)}
      style=${{
        display: "flex", alignItems: "center", gap: 9, width: "100%",
        padding: "6px 8px 6px 10px", borderRadius: "var(--radius-sm)",
        border: "none", cursor: "pointer", textAlign: "left",
        background: selected ? "var(--surface-2)" : (hover ? "var(--surface-1)" : "transparent"),
        boxShadow: selected ? "inset 2px 0 0 " + t.color : "none",
        transition: "background var(--duration-fast) var(--ease-base)",
      }}>
      <${Icon} name=${t.icon} size=${14.5} color=${t.color} />
      <span style=${{
        flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontFamily: "var(--font-ui)", fontSize: 13,
        fontWeight: selected ? 500 : 400,
        color: selected ? "var(--fg-1)" : "var(--fg-2)",
      }}>${item.title}</span>
    </button>`;
}

// ---- A collapsible group ----
// Composes the shared Collapsible primitive (design-system-005), UNCONTROLLED:
// the tree owns no external collapse state, so it hands `defaultOpen` to the
// primitive and lets it hold its own open `useState`. The primitive renders the
// canonical unified header (chevron + ellipsis-truncated uppercase label +
// right-aligned mono count) and reveals the body — TreeGroup only supplies the
// TreeItem children and the tree's own body spacing (`gap 1 / paddingLeft 8`).
export function TreeGroup({ group, items, selectedId, onOpen, defaultOpen = true }) {
  return html`
    <${Collapsible} label=${group} count=${items.length} defaultOpen=${defaultOpen}
      bodyStyle=${{ gap: 1, paddingLeft: 8 }}>
      ${items.map((it) => html`
        <${TreeItem} key=${it.id} item=${it} selected=${selectedId === it.id} onOpen=${onOpen} />`)}
    </${Collapsible}>`;
}

// ---- Primary nav item (Board / Library) ----
export function RailItem({ icon, label, active, badge, onClick }) {
  const [hover, setHover] = useState(false);
  return html`
    <button className="focusable" onClick=${onClick}
      onMouseEnter=${() => setHover(true)} onMouseLeave=${() => setHover(false)}
      style=${{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "7px 10px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", textAlign: "left",
        background: active ? "var(--surface-2)" : (hover ? "var(--surface-1)" : "transparent"),
        color: active ? "var(--fg-1)" : "var(--fg-2)",
        fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: active ? 500 : 400,
        transition: "background var(--duration-fast) var(--ease-base), color var(--duration-fast) var(--ease-base)",
      }}>
      <${Icon} name=${icon} size=${15.5} color=${active ? "var(--fg-1)" : "var(--fg-3)"} />
      ${label}
      <div style=${{ flex: 1 }} />
      ${badge != null && html`<span style=${{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>${badge}</span>`}
    </button>`;
}

// ---- The full left rail used in the live demo ----
export function AppRail({ view, onView, selectedId, onOpen }) {
  return html`
    <nav style=${{
      width: 248, flexShrink: 0, height: "100%", boxSizing: "border-box",
      background: "var(--surface-0)", borderRight: "1px solid var(--hairline)",
      display: "flex", flexDirection: "column",
    }}>
      <!-- Brand -->
      <div style=${{ display: "flex", alignItems: "center", gap: 9, padding: "16px 16px 14px" }}>
        <${Glyph} size=${22} />
        <span style=${{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--fg-1)" }}>Agentheim</span>
        <div style=${{ flex: 1 }} />
        <span style=${{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)", padding: "2px 6px", border: "1px solid var(--hairline)", borderRadius: "var(--radius-sm)" }}>0.1</span>
      </div>

      <!-- Primary nav -->
      <div style=${{ padding: "4px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        <${RailItem} icon="square-kanban" label="Board" active=${view === "board"} badge=${TICKETS.length} onClick=${() => onView("board")} />
        <${RailItem} icon="library" label="Library" active=${view === "library"} badge=${LIBRARY.reduce((n, g) => n + g.items.length, 0)} onClick=${() => onView("library")} />
      </div>

      <div style=${{ height: 1, background: "var(--hairline)", margin: "12px 16px" }} />

      <!-- File tree -->
      <div className="scroll-quiet" style=${{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
        <div style=${{ padding: "0 8px 8px", fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fg-3)" }}>
          Workspace
        </div>
        ${LIBRARY.map((g) => html`
          <${TreeGroup} key=${g.group} group=${g.group} items=${g.items} selectedId=${selectedId} onOpen=${onOpen} />`)}
      </div>

      <!-- Footer -->
      <div style=${{ padding: "10px 16px", borderTop: "1px solid var(--hairline)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", lineHeight: 1.6 }}>
        <div style=${{ display: "flex", alignItems: "center", gap: 5 }}>
          <${Icon} name="folder-git-2" size=${11} color="var(--fg-3)" /> ~/projects/agentheim
        </div>
      </div>
    </nav>`;
}
