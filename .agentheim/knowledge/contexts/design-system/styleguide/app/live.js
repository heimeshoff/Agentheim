/* ============================================================
   Agentheim — live demo pieces: top bar, board topbar,
   library grid, and the framed interactive app.
   ============================================================ */
import { useState } from "react";
import { html } from "./html.js";
import { Icon } from "./icons.js";
import { TypePill } from "./primitives.js";
import { AppRail } from "./library.js";
import { KanbanBoard } from "./kanban.js";
import { Drawer } from "./drawer.js";
import { CONTENT_TYPES, LIBRARY } from "./data.js";

// ---- Segmented control ----
export function Segmented({ options, value, onChange }) {
  return html`
    <div style=${{ display: "inline-flex", padding: 2, gap: 2, background: "var(--surface-1)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-sm)" }}>
      ${options.map((o) => {
        const active = o.value === value;
        return html`
          <button key=${o.value} className="focusable" onClick=${() => onChange(o.value)} style=${{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 11px", border: "none", borderRadius: 3, cursor: "pointer",
            background: active ? "var(--surface-inverse)" : "transparent",
            color: active ? "var(--surface-0)" : "var(--fg-2)",
            fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 500,
            transition: "background var(--duration-fast) var(--ease-base), color var(--duration-fast) var(--ease-base)",
          }}>
            ${o.icon && html`<${Icon} name=${o.icon} size=${13} />`}
            ${o.label}
          </button>`;
      })}
    </div>`;
}

// ---- Theme toggle (dedicated; design-system-007, ADR-0016) ----
// Unlike the generic `Segmented` — which fills the SELECTED option with the
// flipping `--surface-inverse` and so reads BACKWARDS for a Dark/Light control —
// each ThemeToggle button PREVIEWS the theme it switches to via FIXED swatch
// tokens (`--swatch-dark` / `--swatch-light`) that never flip with `[data-theme]`.
// Selection is signalled by DE-EMPHASIS: the active option sits at full strength,
// the other is dimmed (opacity). No accent, no ochre, no ring — color stays
// reserved for status / content-type (ADR-0014). Fixed on-swatch foreground
// tokens keep the labels + moon/sun icons legible on each swatch in BOTH themes.
// Drop-in compatible with Segmented's theme usage: same `value` / `onChange` /
// `options` ({ value, label, icon }) contract.
export function ThemeToggle({ value, onChange, options }) {
  // Per-theme fixed swatch palette, keyed by option value. Light bg -> dark fg,
  // dark bg -> light fg; both frozen so they don't track the active theme.
  const SWATCH = {
    light: { bg: "var(--swatch-light)", fg: "var(--swatch-light-fg)" },
    dark: { bg: "var(--swatch-dark)", fg: "var(--swatch-dark-fg)" },
  };
  return html`
    <div role="group" aria-label="Theme" style=${{ display: "inline-flex", padding: 2, gap: 2, background: "var(--surface-1)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-sm)" }}>
      ${options.map((o) => {
        const active = o.value === value;
        const sw = SWATCH[o.value] || SWATCH.dark;
        return html`
          <button key=${o.value} className="focusable" type="button"
            aria-pressed=${active} title=${o.label}
            onClick=${() => onChange(o.value)} style=${{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 11px", border: "none", borderRadius: 3, cursor: "pointer",
            background: sw.bg, color: sw.fg,
            // De-emphasis, NOT accent: the unselected option dims; the selected
            // one stands at full strength. Quiet-motion law — transition only.
            opacity: active ? 1 : 0.42,
            fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 500,
            transition: "opacity var(--duration-fast) var(--ease-base)",
          }}>
            ${o.icon && html`<${Icon} name=${o.icon} size=${13} />`}
            ${o.label}
          </button>`;
      })}
    </div>`;
}

// ---- The board's own topbar (inside the demo frame) ----
export function BoardTopbar({ view }) {
  return html`
    <div style=${{
      display: "flex", alignItems: "center", gap: 12,
      padding: "0 18px", height: 52, flexShrink: 0,
      borderBottom: "1px solid var(--hairline)", background: "var(--surface-0)",
    }}>
      <span style=${{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>
        ${view === "board" ? "Board" : "Library"}
      </span>
      <span style=${{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
        ${view === "board" ? "agentheim / tickets" : "agentheim / docs"}
      </span>
      <div style=${{ flex: 1 }} />
      <div style=${{
        display: "flex", alignItems: "center", gap: 7, height: 30, padding: "0 10px",
        border: "1px solid var(--hairline)", borderRadius: "var(--radius-sm)", color: "var(--fg-3)",
        background: "var(--surface-0)", minWidth: 168,
      }}>
        <${Icon} name="search" size=${14} />
        <span style=${{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--fg-3)" }}>Search</span>
        <div style=${{ flex: 1 }} />
        <span style=${{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)", border: "1px solid var(--hairline)", borderRadius: 3, padding: "0 4px" }}>/</span>
      </div>
      <button className="focusable" style=${{
        display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px",
        border: "1px solid var(--fg-1)", borderRadius: "var(--radius-sm)", cursor: "pointer",
        background: "var(--fg-1)", color: "var(--surface-0)",
        fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 500,
      }}>
        <${Icon} name="plus" size=${14} /> New ticket
      </button>
    </div>`;
}

// ---- Library main panel ----
export function LibraryGrid({ selectedId, onOpen }) {
  return html`
    <div className="scroll-quiet" style=${{ flex: 1, overflowY: "auto", padding: "26px 28px 40px" }}>
      <div style=${{ maxWidth: 720 }}>
        ${LIBRARY.map((g) => html`
          <div key=${g.group} style=${{ marginBottom: 30 }}>
            <div style=${{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span style=${{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-3)" }}>${g.group}</span>
              <div style=${{ flex: 1, height: 1, background: "var(--hairline)" }} />
            </div>
            <div style=${{ display: "flex", flexDirection: "column", gap: 8 }}>
              ${g.items.map((it) => html`
                <${DocRow} key=${it.id} item=${it} selected=${selectedId === it.id} onOpen=${onOpen} />`)}
            </div>
          </div>`)}
      </div>
    </div>`;
}

export function DocRow({ item, selected, onOpen }) {
  const [hover, setHover] = useState(false);
  const t = CONTENT_TYPES[item.type];
  return html`
    <button className="focusable" onClick=${() => onOpen(item)}
      onMouseEnter=${() => setHover(true)} onMouseLeave=${() => setHover(false)}
      style=${{
        display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left",
        padding: "12px 14px", borderRadius: "var(--radius-md)", cursor: "pointer",
        background: selected ? "var(--surface-2)" : "var(--surface-1)",
        border: "1px solid " + (selected ? "var(--accent-ochre)" : (hover ? "var(--hairline-strong)" : "var(--hairline)")),
        boxShadow: hover ? "var(--shadow-sm)" : "none",
        transition: "border-color var(--duration-fast) var(--ease-base), box-shadow var(--duration-fast) var(--ease-base)",
      }}>
      <div style=${{ width: 34, height: 34, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", background: t.tint }}>
        <${Icon} name=${t.icon} size=${17} color=${t.color} />
      </div>
      <div style=${{ flex: 1, minWidth: 0 }}>
        <div style=${{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: "var(--fg-1)" }}>${item.title}</div>
        <div style=${{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>${item.meta}</div>
      </div>
      <span style=${{ marginLeft: "auto" }}><${TypePill} type=${item.type} /></span>
      <${Icon} name="chevron-right" size=${16} color="var(--fg-4)" />
    </button>`;
}

// ---- The framed live application ----
export function LiveApp({ cardVariant, headerVariant }) {
  const [view, setView] = useState("board");
  const [open, setOpen] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const openItem = (it) => { setOpen(it); setSelectedId(it.id); };
  const close = () => { setOpen(null); setSelectedId(null); };

  return html`
    <div style=${{
      position: "relative", height: 580, display: "flex",
      border: "1px solid var(--hairline-strong)", borderRadius: "var(--radius-md)",
      overflow: "hidden", background: "var(--surface-0)", boxShadow: "var(--shadow-md)",
    }}>
      <${AppRail} view=${view} onView=${(v) => { setView(v); }} selectedId=${selectedId} onOpen=${openItem} />

      <div style=${{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--surface-0)" }}>
        <${BoardTopbar} view=${view} />
        ${view === "board"
          ? html`
            <div className="scroll-quiet" style=${{ flex: 1, overflowY: "auto", overflowX: "auto", padding: "20px 18px 28px" }}>
              <div style=${{ minWidth: 880 }}>
                <${KanbanBoard} variant=${cardVariant} selectedId=${selectedId} onOpen=${openItem} />
              </div>
            </div>`
          : html`<${LibraryGrid} selectedId=${selectedId} onOpen=${openItem} />`}
      </div>

      <${Drawer} item=${open} headerVariant=${headerVariant} onClose=${close} />
    </div>`;
}
