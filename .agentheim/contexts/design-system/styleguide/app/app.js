/* ============================================================
   Agentheim — design-system canvas (root app)

   Entry module for both consumers (ADR-0003): the buildless
   canvas (index.html imports this via <script type="module">)
   and the esbuild-bundled dashboard dist (this file is the
   bundler entrypoint). It mounts the App into #root.
   ============================================================ */
import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { html } from "./html.js";
import { Icon } from "./icons.js";
import { TypePill, StatusChip, MonoId, MetaChip } from "./primitives.js";
import { EmptyColumn, EmptyDrawer } from "./empty.js";
import { ColumnHeader, TicketCard } from "./kanban.js";
import { HeaderMinimal, HeaderContextual, describeItem, Drawer } from "./drawer.js";
import { TreeGroup, TreeItem } from "./library.js";
import { Collapsible } from "./collapsible.js";
import { Menu, MenuItem, MenuDivider } from "./menu.js";
import { SearchField } from "./search.js";
import { Button } from "./button.js";
import { Modal } from "./modal.js";
import { ConfirmDialog } from "./confirm-dialog.js";
import { Segmented, ThemeToggle, LiveApp } from "./live.js";
import {
  ThemeCtx, Glyph, GuideSection, SubHead, DocCard, ColorSection,
} from "./foundations.js";
import { TypographySection, SpacingSection, IconSection } from "./foundations2.js";
import { Markdown } from "./primitives.js";
import { TICKETS, LIBRARY, CONTENT_TYPES, MD_ADR } from "./data.js";

const SAMPLE_TICKET = TICKETS.find((t) => t.id === "AGH-128"); // status: doing
const SAMPLE_TICKET_STATIC = TICKETS.find((t) => t.status !== "doing"); // contrast: no pulse
// design-system-w4t9k: two more non-doing tickets so the waiting-on / holding-up
// ring specimens don't reuse the exact same card.
const SAMPLE_TICKET_WAITING = TICKETS.filter((t) => t.status !== "doing")[1] || SAMPLE_TICKET_STATIC;
const SAMPLE_TICKET_HOLDING = TICKETS.filter((t) => t.status !== "doing")[2] || SAMPLE_TICKET_STATIC;
// design-system-006: a card whose estimate is the dashboard's em-dash placeholder
// — the "… pt" chip must NOT render (a real est would still show).
const SAMPLE_TICKET_NO_EST = { ...SAMPLE_TICKET_STATIC, est: "—" };

// A quiet, token-styled icon button — the kind of control a consumer drops into
// the TicketCard corner-action slot (design-system-006). Look/placement is the
// card's; behavior is the consumer's. Reads as a subtle affordance, not a loud
// button, and brightens on hover only.
function DemoCornerButton() {
  return html`
    <button className="focusable" title="Copy command" type="button"
      onClick=${() => {}}
      style=${{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 22, height: 22, borderRadius: "var(--radius-sm)",
        border: "none", background: "transparent", color: "var(--fg-3)", cursor: "pointer",
        transition: "background var(--duration-fast) var(--ease-base), color var(--duration-fast) var(--ease-base)",
      }}
      onMouseEnter=${(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--fg-1)"; }}
      onMouseLeave=${(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-3)"; }}>
      <${Icon} name="copy" size=${13} />
    </button>`;
}
const SAMPLE_DOC = LIBRARY[2].items[0]; // ADR-0007

function TopBar({ theme, setTheme }) {
  return html`
    <header style=${{
      position: "sticky", top: 0, zIndex: 50,
      display: "flex", alignItems: "center", gap: 14, height: 60, padding: "0 28px",
      background: "var(--surface-0)", borderBottom: "1px solid var(--hairline)",
    }}>
      <${Glyph} size=${24} />
      <span style=${{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--fg-1)" }}>Agentheim</span>
      <span style=${{ width: 1, height: 18, background: "var(--hairline-strong)" }} />
      <span style=${{ fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--fg-3)" }}>Design system</span>
      <div style=${{ flex: 1 }} />
      <span style=${{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", padding: "3px 8px", border: "1px solid var(--hairline)", borderRadius: "var(--radius-sm)" }}>derived from Ledger</span>
      <${ThemeToggle} value=${theme} onChange=${setTheme} options=${[
        { value: "dark", label: "Dark", icon: "moon" },
        { value: "light", label: "Light", icon: "sun" },
      ]} />
    </header>`;
}

function Hero() {
  return html`
    <section style=${{ padding: "60px 0 56px", borderBottom: "1px solid var(--hairline)", marginBottom: 56 }}>
      <div style=${{ display: "flex", alignItems: "center", gap: 9, marginBottom: 22 }}>
        <span style=${{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-ochre)" }}>v0.1</span>
        <span style=${{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>·</span>
        <span style=${{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)" }}>dark-first · light variant</span>
      </div>
      <h1 style=${{ margin: "0 0 20px", fontFamily: "var(--font-ui)", fontSize: 46, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.05, color: "var(--fg-1)", maxWidth: 760, textWrap: "balance" }}>
        A calm, content-first control panel for an agentic dev workflow.
      </h1>
      <p style=${{ margin: "0 0 30px", fontFamily: "var(--font-ui)", fontSize: 16.5, lineHeight: 1.6, color: "var(--fg-2)", maxWidth: 620 }}>
        The visual language plus a set of styled reference components a developer can build from — tokens documented up top, then rendered in context: a kanban board, a slide-over reader, a markdown reading surface, and a browsable library of project knowledge.
      </p>
      <div style=${{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        ${["Linear precision", "Notion calm", "Vercel restraint"].map((t) => html`
          <span key=${t} style=${{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--fg-2)", padding: "5px 11px", border: "1px solid var(--hairline)", borderRadius: 99, background: "var(--surface-1)" }}>
            <span style=${{ width: 5, height: 5, borderRadius: 99, background: "var(--accent-ochre)" }} />${t}
          </span>`)}
      </div>
    </section>`;
}

// ---- 05: components in context (live) ----
function LiveSection() {
  const [cardVariant, setCardVariant] = useState("rail");
  const [headerVariant, setHeaderVariant] = useState("contextual");
  return html`
    <${GuideSection} index="05" title="Components in context"
      desc="The system, assembled and working. Click any ticket or library document to slide the reader in from the right; press Esc or the scrim to dismiss. Switch the board between the Board and Library views in the left rail. The two controls below swap the live card and drawer-header directions.">
      <div style=${{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <${SubHead} style=${{ marginBottom: 8 }}>Ticket card</${SubHead}>
          <${Segmented} value=${cardVariant} onChange=${setCardVariant} options=${[
            { value: "rail", label: "Status rail" }, { value: "badge", label: "Status badge" },
          ]} />
        </div>
        <div>
          <${SubHead} style=${{ marginBottom: 8 }}>Drawer header</${SubHead}>
          <${Segmented} value=${headerVariant} onChange=${setHeaderVariant} options=${[
            { value: "minimal", label: "Minimal" }, { value: "contextual", label: "Contextual" },
          ]} />
        </div>
      </div>
      <${LiveApp} cardVariant=${cardVariant} headerVariant=${headerVariant} />
    </${GuideSection}>`;
}

// ---- 06: ticket card anatomy ----
function StateLabel({ children }) {
  return html`<div style=${{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)", marginBottom: 9, textTransform: "uppercase", letterSpacing: "0.05em" }}>${children}</div>`;
}
function CardStates({ variant, title, note }) {
  return html`
    <${DocCard} pad=${22} style=${{ background: "var(--surface-0)" }}>
      <div style=${{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <span style=${{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>${title}</span>
      </div>
      <p style=${{ margin: "0 0 20px", fontFamily: "var(--font-ui)", fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-3)", maxWidth: 280 }}>${note}</p>
      <div style=${{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div><${StateLabel}>Default</${StateLabel}><${TicketCard} ticket=${SAMPLE_TICKET} variant=${variant} /></div>
        <div><${StateLabel}>Hover</${StateLabel}><${TicketCard} ticket=${SAMPLE_TICKET} variant=${variant} forceHover /></div>
        <div><${StateLabel}>Selected</${StateLabel}><${TicketCard} ticket=${SAMPLE_TICKET} variant=${variant} selected /></div>
        <div>
          <${StateLabel}>No estimate — chip hidden</${StateLabel}>
          <p style=${{ margin: "0 0 10px", fontFamily: "var(--font-ui)", fontSize: 11.5, lineHeight: 1.5, color: "var(--fg-3)", maxWidth: 280 }}>
            When a ticket carries no real estimate (the dashboard read projection has none, ADR-0002), the <code>… pt</code> chip does not render — no dead space, no <code>— pt</code>. A real estimate still shows (above).
          </p>
          <${TicketCard} ticket=${SAMPLE_TICKET_NO_EST} variant=${variant} />
        </div>
        <div>
          <${StateLabel}>Corner action</${StateLabel}>
          <p style=${{ margin: "0 0 10px", fontFamily: "var(--font-ui)", fontSize: 11.5, lineHeight: 1.5, color: "var(--fg-3)", maxWidth: 280 }}>
            An optional quiet affordance in the bottom-right meta slot. The card owns its look + placement and isolates its click (it never opens the card); the consumer owns the behavior — here a copy-command button.
          </p>
          <${TicketCard} ticket=${SAMPLE_TICKET_NO_EST} variant=${variant} cornerAction=${() => html`<${DemoCornerButton} />`} />
        </div>
        ${variant === "rail" && html`
          <div>
            <${StateLabel}>Doing — ambient pulse · vs. static</${StateLabel}>
            <p style=${{ margin: "0 0 10px", fontFamily: "var(--font-ui)", fontSize: 11.5, lineHeight: 1.5, color: "var(--fg-3)", maxWidth: 280 }}>
              A doing card's ochre rail breathes (calm, low-amplitude, <code>--duration-ambient</code>) so the column reads as actively-worked; any other status rail stays still. Honored by <code>prefers-reduced-motion</code> — the pulse drops to a plain rail.
            </p>
            <div style=${{ display: "flex", flexDirection: "column", gap: 10 }}>
              <${TicketCard} ticket=${SAMPLE_TICKET} variant=${variant} />
              <${TicketCard} ticket=${SAMPLE_TICKET_STATIC} variant=${variant} />
            </div>
          </div>`}
        ${variant === "rail" && html`
          <div>
            <${StateLabel}>Dependency ring — waiting-on · holding-up · coexists with the pulse</${StateLabel}>
            <p style=${{ margin: "0 0 10px", fontFamily: "var(--font-ui)", fontSize: 11.5, lineHeight: 1.5, color: "var(--fg-3)", maxWidth: 280 }}>
              A third ambient signal (ADR-0034): while hovering a card, its dependencies get a quiet breathing ring around the card PERIMETER, not the rail — so it can coexist with either sibling cue. Direction rides line-style on one dedicated hue: <b>waiting-on</b> is solid, <b>holding-up</b> is dashed. The last row proves no collision with the doing rail pulse.
            </p>
            <div style=${{ display: "flex", flexDirection: "column", gap: 10 }}>
              <${TicketCard} ticket=${SAMPLE_TICKET_WAITING} variant=${variant} dependencyRelation="waiting-on" />
              <${TicketCard} ticket=${SAMPLE_TICKET_HOLDING} variant=${variant} dependencyRelation="holding-up" />
              <${TicketCard} ticket=${SAMPLE_TICKET} variant=${variant} dependencyRelation="waiting-on" />
            </div>
          </div>`}
      </div>
    </${DocCard}>`;
}
function CardSection() {
  return html`
    <${GuideSection} index="06" title="Ticket card"
      desc="Comfortable density: a ticket ID, a two-line title, and two meta chips with room to breathe. Two directions for signalling status — a quiet colored rail down the left edge, or an explicit status badge on top. Both share hover (a 1px lift) and a selected state (ochre ring).">
      <div style=${{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <${CardStates} variant="rail" title="Direction A — Status rail"
          note="Status reads from a 3px colored edge. Quietest option; lets the title lead. Ticket ID sits top-left in mono." />
        <${CardStates} variant="badge" title="Direction B — Status badge"
          note="Status is an explicit labeled pill. Most legible when columns are long or a card sits out of its column (search, filters)." />
      </div>
    </${GuideSection}>`;
}

// ---- 07: slide-over drawer ----
function HeaderFrame({ children, label, note }) {
  return html`
    <div>
      <${StateLabel}>${label}</${StateLabel}>
      <div style=${{ border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--surface-0)", boxShadow: "var(--shadow-sm)" }}>
        ${children}
        <div style=${{ padding: "18px 22px", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--fg-3)" }}>${note}</div>
      </div>
    </div>`;
}
// In-place expandable width (design-system-020). The body-top chevron widens the
// panel WHERE YOU ARE (distinct from the header's "promote out" maximize). Driven
// here controlled so the expand state is visible for the gate; the live dashboard
// supplies its own rail-aware expandedWidth (aw-074). Hosted in a contained,
// relatively-positioned frame so the absolute panel stays inside the specimen.
function ExpandSpecimen() {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  return html`
    <div>
      <${StateLabel}>In-place expandable width — body-top chevron</${StateLabel}>
      <div style=${{
        position: "relative", height: 320, overflow: "hidden",
        border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)",
        background: "var(--surface-1)", boxShadow: "var(--shadow-sm)",
      }}>
        <${Drawer}
          item=${open ? SAMPLE_DOC : null}
          headerVariant="contextual"
          onClose=${() => setOpen(false)}
          expanded=${expanded}
          onToggleExpand=${() => setExpanded((v) => !v)}
          expandedWidth="min(920px, 92%)" />
        ${!open && html`<div style=${{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <${Button} onClick=${() => setOpen(true)}>Reopen drawer<//>
        </div>`}
      </div>
      <p style=${{ margin: "10px 2px 0", fontFamily: "var(--font-ui)", fontSize: 12, lineHeight: 1.55, color: "var(--fg-3)" }}>
        The chevron above the body toggles the panel between <code>min(560px, 78%)</code> and the consumer-supplied <code>expandedWidth</code>, animating the width alongside the slide (stripped to instant under <code>prefers-reduced-motion</code>). The header's maximize "promote out" stays separate and untouched.
      </p>
    </div>`;
}

function DrawerSection() {
  return html`
    <${GuideSection} index="07" title="Slide-over drawer"
      desc="A document opens in a panel that animates in from the right over 180ms, dimming the board behind it — the same surface for a ticket's description and for any library document. Two header directions: a slim minimal bar, or a contextual band tinted in the content type's color with status and path metadata. A body-top chevron widens the panel in place (consumer-supplied width), distinct from the header's promote-to-full-screen maximize.">
      <div style=${{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <${HeaderFrame} label="Direction A — Minimal" note="Type pill, file path, and a quiet Open-in-full-screen action. The prose H1 below carries the title.">
          <${HeaderMinimal} info=${describeItem(SAMPLE_DOC)} onClose=${() => {}} onOpenFullScreen=${() => {}} />
        </${HeaderFrame}>
        <${HeaderFrame} label="Direction B — Contextual" note="Tinted by content type, with status and path metadata for tickets. Stronger sense of place.">
          <${HeaderContextual} info=${describeItem(SAMPLE_TICKET)} onClose=${() => {}} onOpenFullScreen=${() => {}} />
        </${HeaderFrame}>
      </div>
      <div style=${{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }}>
        <${DocCard} pad=${0} style=${{ overflow: "hidden" }}>
          <div style=${{ padding: "13px 18px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 8 }}>
            <${Icon} name="git-commit-horizontal" size=${15} color="var(--accent-ochre)" />
            <span style=${{ fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 500, color: "var(--fg-2)" }}>Entrance motion</span>
          </div>
          <div style=${{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
            ${[["Panel", "translateX(100%) → 0", "180ms"], ["Scrim", "opacity 0 → 0.40", "180ms"], ["Easing", "cubic-bezier(.4,0,.2,1)", "—"], ["Dismiss", "Esc · scrim click", "reverses"]].map(([k, v, d]) => html`
              <div key=${k} style=${{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 12, borderBottom: "1px solid var(--hairline)" }}>
                <span style=${{ width: 64, fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 500, color: "var(--fg-1)" }}>${k}</span>
                <span style=${{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-2)" }}>${v}</span>
                <span style=${{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>${d}</span>
              </div>`)}
            <div style=${{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5 }}>See it live in section 05 — click any card.</div>
          </div>
        </${DocCard}>
        <div>
          <${StateLabel}>Empty drawer</${StateLabel}>
          <div style=${{ height: 268, border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)", background: "var(--surface-0)", boxShadow: "var(--shadow-sm)" }}>
            <${EmptyDrawer} />
          </div>
        </div>
      </div>
      <div style=${{ marginTop: 24 }}>
        <${ExpandSpecimen} />
      </div>
    </${GuideSection}>`;
}

// ---- 08: markdown ----
function MarkdownSection() {
  return html`
    <${GuideSection} index="08" title="Markdown reading surface"
      desc="The surface ADRs and research notes are read through — the part that matters most. A wider reading scale, a comfortable measure near 68 characters, and tuned treatments for headings, links, inline code, code blocks, blockquotes, lists, and tables. Shown here rendering a full decision record.">
      <div style=${{ border: "1px solid var(--hairline-strong)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--surface-0)", boxShadow: "var(--shadow-md)", maxWidth: 720, margin: "0 auto" }}>
        <${HeaderContextual} info=${describeItem(SAMPLE_DOC)} onClose=${() => {}} />
        <div className="scroll-quiet" style=${{ maxHeight: 760, overflowY: "auto", padding: "30px 40px 48px" }}>
          <${Markdown} source=${MD_ADR} />
        </div>
      </div>
    </${GuideSection}>`;
}

// ---- 09: navigation / file tree ----
function TreeSpecimen() {
  const [sel, setSel] = useState("adr-0007");
  return html`
    <div style=${{ width: 280, flexShrink: 0, border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)", background: "var(--surface-0)", padding: "12px 8px", boxShadow: "var(--shadow-sm)" }}>
      <div style=${{ padding: "4px 8px 10px", fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fg-3)" }}>Workspace</div>
      ${LIBRARY.map((g) => html`
        <${TreeGroup} key=${g.group} group=${g.group} items=${g.items} selectedId=${sel} onOpen=${(it) => setSel(it.id)} defaultOpen=${g.group !== "Research"} />`)}
    </div>`;
}
// A row of demo cards standing in for a collapsible's arbitrary body — the
// primitive is body-agnostic (TreeItem rows in the tree, draggable TicketCards on
// the board), so the specimen reveals plain swatches to make that point.
function DemoBodyRow({ label }) {
  return html`
    <div style=${{
      display: "flex", alignItems: "center", gap: 8,
      padding: "7px 10px", borderRadius: "var(--radius-sm)",
      background: "var(--surface-1)", border: "1px solid var(--hairline)",
      fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--fg-2)",
    }}>
      <span style=${{ width: 6, height: 6, borderRadius: 99, background: "var(--accent-ochre)" }} />${label}
    </div>`;
}

// Documents the shared Collapsible primitive (design-system-005) in BOTH modes:
//   • UNCONTROLLED — `defaultOpen`, the primitive holds its own open state (the
//     TreeGroup behavior). Click the header; the primitive remembers.
//   • CONTROLLED — `open` + `onToggle` lifted into THIS specimen's React state
//     (the board's pattern: collapse persisted per (column, BC), ADR-0015). The
//     parent owns the truth; the primitive announces every toggle and stores none.
// Both wear the ONE canonical header: chevron → 90° when open, an ellipsis-
// truncating uppercase label that takes the row, a right-aligned mono count.
function CollapsibleSpecimen() {
  const [open, setOpen] = useState(true);
  return html`
    <${DocCard} style=${{ flex: 1, minWidth: 300 }}>
      <${SubHead}>Collapsible — controlled & uncontrolled</${SubHead}>
      <p style=${{ margin: "0 0 16px", fontFamily: "var(--font-ui)", fontSize: 12.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
        One section primitive, two ownership modes. It owns the open/close reveal and is body-agnostic; each consumer supplies its own body spacing via <code>bodyStyle</code>.
      </p>
      <${StateLabel}>Uncontrolled — owns its own state (defaultOpen)</${StateLabel}>
      <${Collapsible} label="design-system" count=${3} defaultOpen=${true}
        bodyStyle=${{ gap: 6, paddingLeft: 4 }} style=${{ marginBottom: 18 }}>
        ${["Styleguide source", "Tokens", "Collapsible primitive"].map((l) => html`<${DemoBodyRow} key=${l} label=${l} />`)}
      </${Collapsible}>
      <${StateLabel}>Controlled — parent owns open + onToggle (board, ADR-0015)</${StateLabel}>
      <${Collapsible} label="agentic-workflow" count=${2}
        open=${open} onToggle=${() => setOpen((o) => !o)}
        bodyStyle=${{ gap: 6, paddingLeft: 4 }}>
        ${["Dashboard board", "Slide-over reader"].map((l) => html`<${DemoBodyRow} key=${l} label=${l} />`)}
      </${Collapsible}>
      <div style=${{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>
        open = ${String(open)} (held in this specimen, not the primitive)
      </div>
    </${DocCard}>`;
}

// The "new item" attention cue (design-system-v8k2p) — the sibling of the
// doing-card breathe (section 06), here on the RAIL. An opt-in `attention` flag
// (default OFF) makes a freshly-arrived TreeItem row OR its (possibly collapsed)
// group header carry a quiet breathing left-edge dot drawn from the existing
// --st-todo "incoming" token — never the reserved selection ochre (ADR-0016).
// Shown beside an unflagged row/header for contrast; the cue strips to a steady
// static dot under prefers-reduced-motion (toggle your OS setting to compare).
// The consumer (agentic-workflow-n4h7q) owns which rows are new + the
// until-acknowledged lifecycle; the styleguide just renders the cue.
function AttentionCueSpecimen() {
  const rows = LIBRARY.find((g) => g.items.length >= 2)?.items.slice(0, 2) ?? [];
  return html`
    <${DocCard} style=${{ flex: 1, minWidth: 300 }}>
      <${SubHead}>New-item attention cue — flagged vs. quiet</${SubHead}>
      <p style=${{ margin: "0 0 16px", fontFamily: "var(--font-ui)", fontSize: 12.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
        A just-arrived artifact draws the eye with a quiet breathing dot until acknowledged — the rail sibling of the doing-card breathe. Opt-in (<code>attention</code>), default off; an unflagged row is identical to today. Drawn from the existing <code>--st-todo</code> token, never the selection ochre. Honours <code>prefers-reduced-motion</code> by falling back to a steady static dot.
      </p>
      <${StateLabel}>Tree row — flagged (top) vs. quiet (bottom)</${StateLabel}>
      <div style=${{ marginBottom: 18 }}>
        ${rows[0] && html`<${TreeItem} item=${rows[0]} selected=${false} onOpen=${() => {}} attention=${true} />`}
        ${rows[1] && html`<${TreeItem} item=${rows[1]} selected=${false} onOpen=${() => {}} />`}
      </div>
      <${StateLabel}>Group header — flagged (a new arrival under a collapsed group)</${StateLabel}>
      <${Collapsible} label="research" count=${3} defaultOpen=${false} attention=${true}
        bodyStyle=${{ gap: 6, paddingLeft: 4 }} style=${{ marginBottom: 14 }}>
        ${["New report"].map((l) => html`<${DemoBodyRow} key=${l} label=${l} />`)}
      </${Collapsible}>
      <${StateLabel}>Group header — quiet (no arrival)</${StateLabel}>
      <${Collapsible} label="decisions" count=${5} defaultOpen=${false}
        bodyStyle=${{ gap: 6, paddingLeft: 4 }}>
        ${["ADR-0014"].map((l) => html`<${DemoBodyRow} key=${l} label=${l} />`)}
      </${Collapsible}>
    </${DocCard}>`;
}

function NavSection() {
  return html`
    <${GuideSection} index="09" title="Navigation &amp; file tree"
      desc="The left rail browses the project's agent workspace. Collapsible groups hold each kind of document; the content-type icon carries its own color, so a README, an ADR, and a research note are distinguishable before you read a single word. Selected rows take a colored inset edge matching their type.">
      <div style=${{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
        <${TreeSpecimen} />
        <${DocCard} style=${{ flex: 1, minWidth: 280 }}>
          <${SubHead}>Type legend</${SubHead}>
          <div style=${{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            ${Object.entries(CONTENT_TYPES).map(([k, t]) => html`
              <div key=${k} style=${{ display: "flex", alignItems: "center", gap: 10 }}>
                <${Icon} name=${t.icon} size=${16} color=${t.color} />
                <span style=${{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-1)" }}>${t.label}</span>
              </div>`)}
          </div>
          <div style=${{ height: 1, background: "var(--hairline)", margin: "20px 0" }} />
          <p style=${{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 12.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
            Icons are the only chromatic element in the rail. Labels and chevrons stay neutral; color is doing one job — telling document kinds apart.
          </p>
        </${DocCard}>
      </div>
      <div style=${{ marginTop: 24, display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
        <${CollapsibleSpecimen} />
        <${AttentionCueSpecimen} />
      </div>
    </${GuideSection}>`;
}

// ---- 10: menu / popover ----
// Documents the shared Menu / Popover primitive (design-system-015) — the
// affordance the dashboard topbar's settings gear runs on (agentic-workflow-049,
// retired into this primitive). Shown in context: a neutral gear trigger that
// stays quiet when closed, and an anchored floating panel at --shadow-md holding
// arbitrary menu items (a theme toggle, a divider, an action row). The primitive
// owns the open/close truth, the panel placement + elevation, and dismissal on
// Esc / outside-click; the consumer composes the items (body-agnostic, the
// ds-005 / ds-006 seam). Documented in BOTH ownership modes:
//   • UNCONTROLLED — `defaultOpen` omitted; the primitive holds its own open
//     state (the board gear, which owns no menu state of its own).
//   • CONTROLLED — `open` + `onOpenChange` lifted into this specimen's React
//     state; the parent owns the truth and the primitive announces every change.
function DemoGearTrigger({ open, toggle }) {
  return html`
    <button
      type="button"
      className="focusable"
      aria-label="Settings"
      aria-haspopup="menu"
      aria-expanded=${open}
      onClick=${toggle}
      style=${{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: open ? "var(--fg-1)" : "var(--fg-2)",
        background: open ? "var(--surface-2)" : "transparent",
        border: `1px solid ${open ? "var(--hairline-strong)" : "var(--hairline)"}`,
        borderRadius: "var(--radius-sm)", padding: "5px 7px", cursor: "pointer",
        transition: "color var(--duration-fast) var(--ease-base), background var(--duration-fast) var(--ease-base), border-color var(--duration-fast) var(--ease-base)",
      }}>
      <${Icon} name="settings-2" size=${14.5} color=${open ? "var(--fg-1)" : "var(--fg-2)"} />
    </button>`;
}
// A quiet token-styled control standing in for an arbitrary menu item — the
// primitive is body-agnostic about its item content.
function DemoMenuButton({ icon, label, danger }) {
  return html`
    <button type="button" className="focusable"
      onClick=${() => {}}
      style=${{
        display: "inline-flex", alignItems: "center", gap: 8, width: "100%",
        padding: "6px 8px", border: "1px solid var(--hairline)", borderRadius: "var(--radius-sm)",
        background: "transparent", cursor: "pointer", textAlign: "left",
        fontFamily: "var(--font-ui)", fontSize: 12.5,
        color: danger ? "var(--obligation, var(--fg-1))" : "var(--fg-2)",
      }}>
      <${Icon} name=${icon} size=${13} color=${danger ? "var(--obligation, var(--fg-2))" : "var(--fg-3)"} />${label}
    </button>`;
}
function MenuSpecimen() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("dark");
  return html`
    <${DocCard} style=${{ flex: 1, minWidth: 320 }}>
      <${SubHead}>Menu / popover — controlled & uncontrolled</${SubHead}>
      <p style=${{ margin: "0 0 18px", fontFamily: "var(--font-ui)", fontSize: 12.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
        A trigger toggles an anchored, dismissible floating panel of arbitrary items. It owns the open/close truth, the panel placement + <code>--shadow-md</code> elevation, and dismissal on Esc / outside-click; the consumer composes the items. Keyboard-operable: the trigger is focusable (Enter/Space opens), items are focusable, Esc closes.
      </p>
      <div style=${{ display: "flex", gap: 40, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <${StateLabel}>Uncontrolled — owns its own open state</${StateLabel}>
          <${Menu} ariaLabel="Demo settings"
            trigger=${({ open: o, toggle }) => html`<${DemoGearTrigger} open=${o} toggle=${toggle} />`}>
            <${MenuItem}>
              <${ThemeToggle} value=${theme} onChange=${setTheme} options=${[
                { value: "dark", label: "Dark", icon: "moon" },
                { value: "light", label: "Light", icon: "sun" },
              ]} />
            </${MenuItem}>
            <${MenuDivider} />
            <${MenuItem}><${DemoMenuButton} icon="x" label="Stop" /></${MenuItem}>
          </${Menu}>
        </div>
        <div>
          <${StateLabel}>Controlled — parent owns open + onOpenChange</${StateLabel}>
          <${Menu} align="left" ariaLabel="Demo overflow"
            open=${open} onOpenChange=${setOpen}
            trigger=${({ open: o, toggle }) => html`<${DemoGearTrigger} open=${o} toggle=${toggle} />`}>
            <${MenuItem}><${DemoMenuButton} icon="copy" label="Copy command" /></${MenuItem}>
            <${MenuItem}><${DemoMenuButton} icon="arrow-right" label="Open" /></${MenuItem}>
          </${Menu}>
          <div style=${{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>
            open = ${String(open)} (held in this specimen)
          </div>
        </div>
      </div>
    </${DocCard}>`;
}
function MenuSection() {
  return html`
    <${GuideSection} index="10" title="Menu &amp; popover"
      desc="A trigger that toggles an anchored, dismissible floating panel of menu items — the dashboard topbar's settings gear runs on it. The primitive owns the open/close truth, the panel's placement and --shadow-md elevation, and dismissal on Esc / outside-click; the item area is body-agnostic, so each consumer composes its own controls (the ds-005 / ds-006 seam).">
      <div style=${{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
        <${MenuSpecimen} />
      </div>
    </${GuideSection}>`;
}

// ---- 11: search field + grouped results ----
// Documents the search-field + grouped-results combobox pattern (design-system-016)
// — the affordance the dashboard global search runs on (agentic-workflow-052, fed
// by the /api/search backend aw-050). Shown in context: a token-styled text input
// (the styleguide's first input control, search-scoped) that opens a STANDALONE
// floating panel at --shadow-md (the Menu's Popover elevation, matched by
// convention NOT composed on ds-015's Menu — a combobox keeps focus in the input
// and highlights rows via aria-activedescendant, whereas the Menu moves focus into
// its items). Results are partitioned into labelled category groups (Bounded
// contexts / Decisions / Research / Tickets); each row is a title + a matched-
// excerpt sub-line with the term marked. The pattern owns the look, placement and
// keyboard mechanics (up/down across all rows, Enter selects, Esc closes, outside-
// click dismisses); it is body-agnostic — the consumer supplies the grouped data +
// an onSelect (the ds-006 / ds-005 seam). Empty-query (no panel) and no-results
// (an explicit line, never a dead box) states are both defined.

// A small local index standing in for the consumer's ranked /api/search results.
// The styleguide does not fetch or rank — it is FED; this demo filters a fixed
// corpus by substring so the specimen is live without a backend.
const SEARCH_CORPUS = [
  { group: "Bounded contexts", title: "design-system", excerpt: "The visual language and reference components for the dashboard." },
  { group: "Bounded contexts", title: "agentic-workflow", excerpt: "The kanban board, slide-over reader and global search dashboard." },
  { group: "Decisions", title: "ADR-0003 — Styleguide as ES-module single source", excerpt: "One ES-module source of truth feeds the buildless canvas and the dashboard bundle." },
  { group: "Decisions", title: "ADR-0005 — Buildless view factory (htm)", excerpt: "Views are authored with htm tagged templates, no JSX shipped to the browser." },
  { group: "Research", title: "Combobox keyboard models", excerpt: "Active-descendant keeps focus in the input while a single highlight moves across rows." },
  { group: "Tickets", title: "aw-052 — Topbar global search UI", excerpt: "Wire the styleguide search pattern into the dashboard topbar with routing." },
];
function searchGroups(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits = SEARCH_CORPUS.filter(
    (r) => r.title.toLowerCase().includes(q) || r.excerpt.toLowerCase().includes(q),
  );
  const order = ["Bounded contexts", "Decisions", "Research", "Tickets"];
  return order
    .map((label) => ({ label, items: hits.filter((h) => h.group === label) }))
    .filter((g) => g.items.length > 0);
}
function SearchSpecimen() {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("—");
  return html`
    <${DocCard} style=${{ flex: 1, minWidth: 360 }}>
      <${SubHead}>Search field &amp; grouped results</${SubHead}>
      <p style=${{ margin: "0 0 18px", fontFamily: "var(--font-ui)", fontSize: 12.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
        Type to open a floating panel of results grouped by category, each row a title plus a matched-excerpt sub-line with the term marked. Focus stays in the input; <code>↑/↓</code> move a single highlight across all rows (spanning groups) via <code>aria-activedescendant</code>, <code>Enter</code> selects, <code>Esc</code> closes; hover + click select the same way. Standalone panel at <code>--shadow-md</code> — try <em>design</em>, <em>adr</em>, or <em>zzz</em> (no results).
      </p>
      <div style=${{ maxWidth: 420 }}>
        <${SearchField}
          value=${query}
          onChange=${setQuery}
          groups=${searchGroups(query)}
          onSelect=${(item) => { setPicked(item.title); setQuery(""); }}
          placeholder="Search the workspace…" />
      </div>
      <div style=${{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>
        last selected = ${picked}
      </div>
    </${DocCard}>`;
}
function SearchSection() {
  return html`
    <${GuideSection} index="11" title="Search &amp; grouped results"
      desc="A token-styled search field that opens a floating panel of results grouped by category — the dashboard's global search runs on it. The input is the system's first text-input control (search-scoped for now). Focus stays in the input while up/down move a single highlight across all rows via aria-activedescendant; Enter or click selects. The standalone panel matches the Menu's --shadow-md Popover elevation by convention. Body-agnostic: the consumer supplies the grouped data and an onSelect; the styleguide owns the look, placement and keyboard.">
      <div style=${{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
        <${SearchSpecimen} />
      </div>
    </${GuideSection}>`;
}

// ---- 12: modal / confirm dialog ----
// Documents the shared Button / Modal / ConfirmDialog family (design-system-018).
// The Modal is the CENTERED sibling of the Drawer (section 07): viewport-fixed,
// scrim-backed (the Drawer's exact rgba(8,9,12,0.40) dim), stacked above the
// Drawer, revealing with fade + scale-up (stripped under prefers-reduced-motion),
// with a full focus trap. The ConfirmDialog composes it with two Button controls
// (Cancel neutral, Confirm neutral OR destructive). Danger draws from the
// --obligation family, never the reserved accent (ADR-0016). Click a button below
// to open the dialog live — Esc, the scrim, and Cancel all dismiss; Confirm fires
// the callback. The visible addition reopens the design-system gate for re-review.
function ButtonRow() {
  return html`
    <div style=${{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <div>
        <${StateLabel}>Neutral (default)</${StateLabel}>
        <${Button} onClick=${() => {}}>Save changes<//>
      </div>
      <div>
        <${StateLabel}>Destructive (--obligation)</${StateLabel}>
        <${Button} variant="destructive" onClick=${() => {}}>Delete<//>
      </div>
    </div>`;
}
function ConfirmDialogSpecimen() {
  const [open, setOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [lastAction, setLastAction] = useState("—");
  return html`
    <${DocCard} style=${{ flex: 1, minWidth: 320 }}>
      <${SubHead}>Confirm dialog — neutral &amp; destructive</${SubHead}>
      <p style=${{ margin: "0 0 18px", fontFamily: "var(--font-ui)", fontSize: 12.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
        A centered, scrim-backed dialog over the <code>Modal</code> shell. The consumer owns the title, body and labels; the primitive owns placement, the fade + scale-up reveal, and dismissal. Esc, the scrim, and Cancel all dismiss without confirming; Confirm fires the callback. Focus is trapped within the panel and returns to the trigger on close. The <code>destructive</code> flag tints Confirm from <code>--obligation</code> (ADR-0016 keeps danger off the reserved accent).
      </p>
      <div style=${{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <${Button} onClick=${() => setOpen(true)}>Open confirm<//>
        <${Button} variant="destructive" onClick=${() => setDestructiveOpen(true)}>Dismiss ticket…<//>
      </div>
      <div style=${{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>
        last action = ${lastAction}
      </div>
      <${ConfirmDialog}
        open=${open}
        title="Save these changes?"
        onClose=${() => { setOpen(false); setLastAction("cancelled"); }}
        onConfirm=${() => { setOpen(false); setLastAction("confirmed"); }}
        confirmLabel="Save">
        Your edits will be written to the working copy. You can revert from history afterwards.
      </${ConfirmDialog}>
      <${ConfirmDialog}
        open=${destructiveOpen}
        destructive=${true}
        title="Dismiss this ticket?"
        onClose=${() => { setDestructiveOpen(false); setLastAction("cancelled"); }}
        onConfirm=${() => { setDestructiveOpen(false); setLastAction("dismissed"); }}
        confirmLabel="Dismiss"
        cancelLabel="Keep">
        Dismissing moves the ticket out of the board. This cannot be undone from here.
      </${ConfirmDialog}>
    </${DocCard}>`;
}
function ModalSection() {
  return html`
    <${GuideSection} index="12" title="Modal &amp; confirm dialog"
      desc="A centered, scrim-backed dialog — the Drawer's centered sibling. The Modal pins to the viewport (above the slide-over), dims the page behind it with the Drawer's exact backdrop, and reveals with a fade + slight scale-up that strips to a hard show under prefers-reduced-motion. Focus moves into the panel and stays trapped while open, returning to the trigger on close. The ConfirmDialog composes it with the new Button primitive — a neutral Cancel and a neutral-or-destructive Confirm, danger drawn from --obligation (never the reserved accent).">
      <div style=${{ marginBottom: 24 }}>
        <${SubHead} style=${{ marginBottom: 10 }}>Button — neutral &amp; destructive</${SubHead}>
        <${ButtonRow} />
      </div>
      <div style=${{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
        <${ConfirmDialogSpecimen} />
      </div>
    </${GuideSection}>`;
}

// ---- 13: empty states ----
function EmptySection() {
  return html`
    <${GuideSection} index="13" title="Empty states"
      desc="State the fact, then the action — never alarmist, never decorative. An empty column invites a ticket; an empty drawer waits quietly for a selection.">
      <div style=${{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <${StateLabel}>Empty column</${StateLabel}>
          <${DocCard} pad=${20} style=${{ background: "var(--surface-0)" }}>
            <${ColumnHeader} status="todo" count=${0} onAdd=${() => {}} />
            <${EmptyColumn} status="todo" />
          </${DocCard}>
        </div>
        <div>
          <${StateLabel}>Empty drawer</${StateLabel}>
          <div style=${{ height: 232, border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)", background: "var(--surface-0)" }}>
            <${EmptyDrawer} />
          </div>
        </div>
      </div>
    </${GuideSection}>`;
}

function Footer() {
  return html`
    <footer style=${{ borderTop: "1px solid var(--hairline)", padding: "32px 0 64px", marginTop: 32, display: "flex", alignItems: "center", gap: 12 }}>
      <${Glyph} size=${20} />
      <span style=${{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-2)" }}>Agentheim design system · v0.1</span>
      <div style=${{ flex: 1 }} />
      <span style=${{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>Inter Tight · JetBrains Mono · Lucide</span>
    </footer>`;
}

export function App() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.add("theme-fade");
    const t = setTimeout(() => document.documentElement.classList.remove("theme-fade"), 320);
    return () => clearTimeout(t);
  }, [theme]);

  return html`
    <${ThemeCtx.Provider} value=${theme}>
      <${TopBar} theme=${theme} setTheme=${setTheme} />
      <main style=${{ maxWidth: 1120, margin: "0 auto", padding: "0 28px" }}>
        <${Hero} />
        <${ColorSection} />
        <${TypographySection} />
        <${SpacingSection} />
        <${IconSection} />
        <${LiveSection} />
        <${CardSection} />
        <${DrawerSection} />
        <${MarkdownSection} />
        <${NavSection} />
        <${MenuSection} />
        <${SearchSection} />
        <${ModalSection} />
        <${EmptySection} />
        <${Footer} />
      </main>
    </${ThemeCtx.Provider}>`;
}

// ---- Bootstrap: mount into #root. Both consumers use this entry. ----
const rootEl = typeof document !== "undefined" && document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(html`<${App} />`);
}
