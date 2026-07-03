/* ============================================================
   Agentheim — dashboard board view (agentic-workflow-006)

   The dashboard's home view: the FLAT Kanban board rendered over
   live project data. It fetches the read projection (/api/tree,
   aw-005), pools every bounded context's tasks into the four
   lifecycle columns (board-data.treeToColumns), and renders them
   through the APPROVED styleguide components imported from the
   design-system single source (ADR-0003) — Column / TicketCard /
   ColumnHeader / EmptyColumn — AS-IS, no fork, no new pattern.

   Clicking a card emits an "open this task" intent (onOpen(ticket))
   the slide-over (aw-007) consumes. The shell below (DashboardApp)
   lays out the styleguide §05 left-rail chrome (aw-026): a full-height
   ShellRail (brand → Board → the live Workspace tree → a footer with
   the theme + skip-permissions toggles) beside a main column (a topbar
   carrying the Work launch over this scrollable board).

   The board is READ-ONLY (ADR-0017): it never writes lifecycle
   state. The dashboard has no write path at all — skills (`modeling`
   / `work`) are the sole owners of task-lifecycle transitions. The
   board's single interactivity concern is staying current:
   - LIVE-UPDATE: the board subscribes to the SSE stream (GET
     /api/events) via createLiveUpdate; every tree-changed frame
     (or reconnect) just RE-FETCHES /api/tree and re-projects — the
     raw event is never interpreted as a transition. As skills move
     files on disk, the board reflects it within a frame.
   ============================================================ */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// Styleguide single source (ADR-0003): import the approved Kanban components
// across the BC boundary. They are CONSUMED, never copied — the design-system
// styleguide remains the one source of UI truth, the dashboard is a consumer.
import confetti from "canvas-confetti";

import { html } from "../../.agentheim/contexts/design-system/styleguide/app/html.js";
import { Markdown } from "../../.agentheim/contexts/design-system/styleguide/app/primitives.js";
import { ColumnHeader, TicketCard } from "../../.agentheim/contexts/design-system/styleguide/app/kanban.js";
import { EmptyColumn } from "../../.agentheim/contexts/design-system/styleguide/app/empty.js";
import { Icon } from "../../.agentheim/contexts/design-system/styleguide/app/icons.js";
import { Glyph, ThemeCtx } from "../../.agentheim/contexts/design-system/styleguide/app/foundations.js";
import { RailItem, TreeItem } from "../../.agentheim/contexts/design-system/styleguide/app/library.js";
import { Collapsible } from "../../.agentheim/contexts/design-system/styleguide/app/collapsible.js";
import { dependencyPresentClass, edgeBlinkClass } from "../../.agentheim/contexts/design-system/styleguide/app/motion.js";
import { Menu, MenuItem, MenuDivider } from "../../.agentheim/contexts/design-system/styleguide/app/menu.js";
import { ThemeToggle } from "../../.agentheim/contexts/design-system/styleguide/app/live.js";
import { ConfirmDialog } from "../../.agentheim/contexts/design-system/styleguide/app/confirm-dialog.js";
import { SearchField } from "../../.agentheim/contexts/design-system/styleguide/app/search.js";

import { COLUMN_ORDER, treeToColumns } from "./board-data.js";
import { resolveTheme, saveTheme } from "./theme-state.js";
import { loadSkipPermissions, saveSkipPermissions } from "./skip-permissions-state.js";
import { SORT_OPTIONS, DEFAULT_SORT, sortTickets } from "./board-sort.js";
import { refineCommandFor, promoteCommandFor, dismissCommandFor, quickCaptureCommandFor, modelingCommandFor, researchCommandFor, inquireCommandFor, WORK_COMMAND, WHATS_NEXT_COMMAND, STOP_DASHBOARD_COMMAND } from "./modeling-command.js";
import { launchOrCopy } from "./bridge-launch.js";
import { groupTickets } from "./board-group.js";
import { resolveHoverDependencies } from "./board-dependencies.js";
import { annotateSectionHiddenDependency, donePeekHasHiddenDependency, unionTargetIds, classifyEdge } from "./board-dependency-groups.js";
import { loadViewState, saveViewState, defaultColumnState, peekClampStyle, PEEK_MAX_HEIGHT_PX } from "./board-view-state.js";
import { SlideOver } from "./slide-over.js";
import { MainPaneReader } from "./main-pane-reader.js";
import { treeToLibrary } from "./library-data.js";
import { railMtimeIndex, flaggedPaths, annotateGroups } from "./rail-attention.js";
import { resolveConfettiColors } from "./confetti-palette.js";
import { confettiFireSequence } from "./confetti-launch.js";
import { isTaskIntent } from "./intent-route.js";
import { searchResultsToGroups } from "./search-results.js";
import { createLiveUpdate } from "./live-update.js";
import { docUrl } from "./slide-over-data.js";
import { parseFrontmatter } from "./frontmatter.js";
import {
  WHATS_NEXT_DOC_PATH,
  isDismissed,
  saveDismissed,
  formatStaleness,
  splitWhatsNextSections,
} from "./whats-next-state.js";

/**
 * React hook: subscribe to the SSE live-update stream and call `onResync` on
 * connect and every tree-changed frame. The board passes a /api/tree re-fetch;
 * the consumer never interprets the raw event (ADR-0001). `onResync` is held in a
 * ref so the subscription is established ONCE, not re-built on every render.
 */
function useLiveTree(onResync) {
  const cb = useRef(onResync);
  cb.current = onResync;
  useEffect(() => {
    if (typeof EventSource === "undefined") return undefined;
    const live = createLiveUpdate({ onResync: (evt) => cb.current && cb.current(evt) });
    return () => live.close();
  }, []);
}

const EMPTY_COLUMNS = (() => {
  const c = {};
  for (const k of COLUMN_ORDER) c[k] = [];
  return c;
})();

// A quiet board header strip — sized off the styleguide tokens, no new pattern.
function BoardHeader({ count }) {
  return html`
    <header style=${{
      display: "flex", alignItems: "center", gap: 12,
      padding: "0 4px 18px",
    }}>
      <span style=${{
        fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600,
        letterSpacing: "-0.01em", color: "var(--fg-1)",
      }}>Board</span>
      <span style=${{
        fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-3)",
        fontFeatureSettings: '"tnum"',
      }}>${count} ${count === 1 ? "task" : "tasks"}</span>
    </header>`;
}

function LoadState({ children }) {
  return html`
    <div style=${{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 10, padding: "80px 16px",
      fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--fg-3)",
    }}>${children}</div>`;
}

// The per-column sort control. A board-only affordance rendered as a SIBLING of
// the styleguide ColumnHeader (the board composes the styleguide sub-components and
// adds its own controls beside them): the styleguide kanban.js is consumed
// unmodified, never forked (ADR-0003). A plain native <select> styled off the
// design-system tokens —
// no new styleguide pattern. Changing it lifts the column's choice into board
// view-state via onChange; it never reorders anything itself (the pure
// board-sort.sortTickets does that, board-side, after the projection).
function ColumnSortControl({ status, value, onChange }) {
  return html`
    <label style=${{
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      <span style=${{
        fontFamily: "var(--font-ui)", fontSize: 10.5, color: "var(--fg-4)",
      }}>Sort</span>
      <select
        aria-label=${`Sort ${status} column`}
        value=${value}
        onChange=${(e) => onChange(e.target.value)}
        className="focusable"
        style=${{
          fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--fg-2)",
          background: "var(--surface-1)", border: "1px solid var(--hairline)",
          borderRadius: "var(--radius-sm)", padding: "3px 6px", cursor: "pointer",
        }}>
        ${SORT_OPTIONS.map((o) => html`<option key=${o.value} value=${o.value}>${o.label}</option>`)}
      </select>
    </label>`;
}

// The per-column group-by-BC toggle (aw-014). A board-only affordance, SIBLING of
// the sort control — same precedent: the styleguide kanban.js is consumed
// unmodified (ADR-0003), the control is native and token-styled, no new styleguide
// pattern. Flipping it lifts the column's grouped choice into persisted board
// view-state; the pure board-group.groupTickets does the partitioning at render
// time, so a live re-projection re-applies the choice rather than resetting it.
function ColumnGroupToggle({ status, grouped, onToggle }) {
  return html`
    <button
      type="button"
      className="focusable"
      aria-pressed=${grouped}
      aria-label=${`Group ${status} column by bounded context`}
      onClick=${() => onToggle(!grouped)}
      style=${{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontFamily: "var(--font-ui)", fontSize: 11.5,
        color: grouped ? "var(--fg-1)" : "var(--fg-2)",
        background: grouped ? "var(--surface-2)" : "var(--surface-1)",
        border: `1px solid ${grouped ? "var(--hairline-strong)" : "var(--hairline)"}`,
        borderRadius: "var(--radius-sm)", padding: "3px 7px", cursor: "pointer",
        transition: "background var(--duration-fast) var(--ease-base)",
      }}>
      <${Icon} name="box" size=${12.5} color=${grouped ? "var(--fg-1)" : "var(--fg-3)"} />
      <span>Group</span>
    </button>`;
}

// The per-column COLLAPSE / PEEK control (agentic-workflow-m2v8d). REPLACES aw-072's
// hide control: instead of dropping the column from the layout, it collapses the
// column body to a short, height-clamped PEEK of the most-recent completions (a
// bottom-faded ≈3.5-card window) and toggles back to the full list. A board-only
// affordance rendered in the HEADER ROW, right-aligned beside the column title (refine
// 2026-06-19) — same precedent (aw-012/aw-014): the styleguide kanban.js is consumed
// UNFORKED (ADR-0003), the control is native and token-styled, no new design-system
// primitive. It is rendered ONLY when the column
// opts in (the `onToggleCollapse` prop is supplied) — today that is the Done column
// alone (Done is the one column that grows unbounded). Clicking it lifts the column's
// `peek` boolean into persisted board view-state (ADR-0015); the pure `peekClampStyle`
// height-clamps the body at render time, so a live SSE re-projection re-applies the
// choice rather than resetting it. Presentation-only: no /api write, no lifecycle move
// (ADR-0017/0001). The chevron is a GLYPH-NAME SWAP (not a CSS rotate) consuming both
// glyphs design-system-c3p9k ships: `chevrons-up` when expanded (will-collapse) ⇄
// `chevrons-down` when collapsed (will-expand), each consumed unforked (ADR-0003).
// hasHiddenDependency (agentic-workflow-h9v3m, design-system-b7n2s): the Done
// column's peek clamp is board-local CSS, not a Collapsible, so this control
// carries the standalone `rel-present` class directly (Consumption 2 of the
// hidden-dependency marker) instead of a Collapsible prop. Detection (whether
// a hover target sits below the clamp's visible window) lives in
// DashboardBoard; this only renders the boolean.
function ColumnCollapseButton({ status, peek, onToggleCollapse, hasHiddenDependency = false }) {
  return html`
    <button
      type="button"
      className=${["focusable", dependencyPresentClass(hasHiddenDependency)].filter(Boolean).join(" ")}
      aria-pressed=${peek}
      aria-label=${peek ? `Expand ${status} column` : `Collapse ${status} column to a peek`}
      title=${peek
        ? `Expand the ${status} column — show the full list`
        : `Collapse the ${status} column to a short peek of the most-recent completions`}
      onClick=${() => onToggleCollapse(!peek)}
      style=${{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: 5,
        fontFamily: "var(--font-ui)", fontSize: 11.5,
        color: peek ? "var(--fg-1)" : "var(--fg-2)",
        background: peek ? "var(--surface-2)" : "var(--surface-1)",
        border: `1px solid ${peek ? "var(--hairline-strong)" : "var(--hairline)"}`,
        borderRadius: "var(--radius-sm)", padding: "3px 7px", cursor: "pointer",
        transition: "background var(--duration-fast) var(--ease-base)",
      }}>
      <${Icon} name=${peek ? "chevrons-down" : "chevrons-up"} size=${12.5}
        color=${peek ? "var(--fg-1)" : "var(--fg-3)"} />
      <span>${peek ? "Expand" : "Collapse"}</span>
    </button>`;
}

// The board-only control strip beneath the styleguide ColumnHeader: sort (left) +
// group (right). All are board view-state affordances; none forks the styleguide
// (ADR-0003). The group toggle is pushed to the column's right edge by an auto left
// margin, mirroring the collapse control above it (refine 2026-06-19). The
// collapse/peek control is NOT here — it lives up in the header row (BoardColumn),
// right-aligned beside the column title, so it sits ABOVE the sort + group controls.
function ColumnControls({ status, sort, onSortChange, grouped, onGroupToggle }) {
  return html`
    <div style=${{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "0 4px 12px", marginTop: -4,
    }}>
      <${ColumnSortControl} status=${status} value=${sort} onChange=${onSortChange} />
      <div style=${{ marginLeft: "auto" }}>
        <${ColumnGroupToggle} status=${status} grouped=${grouped} onToggle=${onGroupToggle} />
      </div>
    </div>`;
}

// Write `text` to the system clipboard with a graceful, no-throw fallback. The
// board's copy affordance is a convenience — a blocked/absent clipboard API (no
// secure context, denied permission, an old browser) must NEVER crash the board
// or surface an error (aw-016 AC). Returns a Promise<boolean> that resolves to
// whether the write succeeded; the caller only uses it for the transient
// "copied" feedback, so a false (or a rejection swallowed here) just means no
// feedback flashes — never a thrown error.
function copyToClipboard(text) {
  try {
    const clip = typeof navigator !== "undefined" ? navigator.clipboard : null;
    if (clip && typeof clip.writeText === "function") {
      return clip.writeText(text).then(() => true, () => false);
    }
  } catch {
    // navigator access itself threw (exotic sandbox) — fall through.
  }
  return Promise.resolve(false);
}

// A backlog LAUNCH button (agentic-workflow-020, extended aw-022). Clicking it
// tries to open a REAL, interactive Claude session seeded with `command` through
// the VS Code bridge (ADR-0018); if the bridge is unavailable for ANY reason — not
// in VS Code's Simple Browser, listener unreachable, timeout, CORS rejection — it
// SILENTLY falls back to copying `command` to the clipboard (the aw-016 behavior),
// flashing the same quiet "Copied" feedback. The whole try-bridge-then-copy
// decision is the pure `launchOrCopy` (bridge-launch.js); this is thin glue that
// supplies window.fetch + the no-throw copyToClipboard and renders the feedback.
// The board stays a projection of disk (ADR-0001): launching is an external
// side-effect, never a lifecycle write.
//
// `emphasis` (aw-022): "default" (the column pair's look) | "primary" (filled,
// emphasised — the expected card default) | "quiet" (text-weight, de-emphasised —
// the rarer/committing card action). All three stay within the styleguide's
// quiet-by-default law: token-styled, no new hue (the flash is the existing
// --st-done). When this button sits inside the styleguide card's cornerAction slot
// (aw-022) the slot already stops propagation; `isolateClick` adds a defensive
// stopPropagation here too so a future change to that wrapper can't re-open the
// card from this button (mirrors CopyCommandButton's belt-and-suspenders).
// `skipPermissions` (aw-021): when ARMED (true), each launch threads
// `skipPermissions: true` into launchOrCopy so the bridge seeds
// `claude --dangerously-skip-permissions`. When armed, the button ALSO carries an
// at-a-glance per-launch DANGER indicator (a "skips permissions" cue) so the
// conscious moment is each launch, not the one-time arm (amended ADR-0018). The
// indicator reflects the armed TOGGLE state, not a live bridge probe — it never
// probes /api/bridge on render (that would break the silent-absence contract and
// add a probe to every paint); it signals armed INTENT.
// `onResult` (aw-023): an optional callback invoked with the `launchOrCopy`
// resolution ({ via: "bridge" } | { via: "clipboard", copied }) AFTER the button's
// own quiet flash is scheduled. The board prompt bar uses it to clear its textarea
// and fire confetti only on a successful launch/landed-copy; a fully-silent action
// (clipboard blocked too) passes { via: "clipboard", copied: false } so the caller
// can stay silent. Default no-op keeps every existing caller (column pair, per-card
// pair) unchanged.
function LaunchButton({ label, command, icon, emphasis = "default", isolateClick = false, skipPermissions = false, onResult, trailingIcon = false, liftOnHover = false, large = false }) {
  // feedback: "idle" | "launched" | "copied". A transient label/colour swap, same
  // quiet treatment as CopyCommandButton — never an error state (absence is normal).
  const [feedback, setFeedback] = useState("idle");
  const timer = useRef(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onClick = useCallback((e) => {
    if (isolateClick && e && typeof e.stopPropagation === "function") e.stopPropagation();
    const fetchImpl = typeof window !== "undefined" && typeof window.fetch === "function"
      ? window.fetch.bind(window)
      : undefined;
    launchOrCopy({ prompt: command, fetchImpl, copy: copyToClipboard, skipPermissions: skipPermissions === true }).then((res) => {
      // Bridge launched -> a real terminal opened (flash "Launched"). Bridge absent
      // -> the command was copied (flash "Copied" only if the copy actually landed,
      // matching CopyCommandButton's quiet contract). Either way: never an error.
      // Hand the raw result to any onResult listener first (aw-023's prompt bar
      // clears + celebrates off it) — the button's own flash is unchanged.
      if (typeof onResult === "function") onResult(res);
      if (res.via === "bridge") setFeedback("launched");
      else if (res.copied) setFeedback("copied");
      else return; // clipboard blocked too — stay silent.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFeedback("idle"), 1100);
    });
  }, [command, isolateClick, skipPermissions, onResult]);

  const flashed = feedback !== "idle";
  const labelText = feedback === "launched" ? "Launched" : feedback === "copied" ? "Copied" : label;
  const primary = emphasis === "primary";
  const quiet = emphasis === "quiet";
  // `inverse` (aw-026): the §05 "New ticket" look — a FILLED inverse button
  // (background + border var(--fg-1), text var(--surface-0)). It is the topbar's
  // primary action (the Work launch); the styleguide section-05 BoardTopbar uses
  // exactly this treatment. Consumed by emphasis, not forked from the styleguide.
  const inverse = emphasis === "inverse";
  // Idle treatment by emphasis (all token-styled, no new hue):
  //   inverse -> filled --fg-1 + --surface-0 text (the §05 topbar action);
  //   primary -> filled surface-2 + stronger hairline + fg-1 (draws the eye);
  //   quiet   -> transparent, no border, fg-3 (recedes — text-weight);
  //   default -> the column pair's bordered surface-1 chip.
  let idleColor = inverse ? "var(--surface-0)" : primary ? "var(--fg-1)" : quiet ? "var(--fg-3)" : "var(--fg-2)";
  let idleBg = inverse ? "var(--fg-1)" : primary ? "var(--surface-2)" : quiet ? "transparent" : "var(--surface-1)";
  let idleBorder = inverse ? "1px solid var(--fg-1)" : quiet ? "1px solid transparent" : `1px solid ${primary ? "var(--hairline-strong)" : "var(--hairline)"}`;
  // aw-068: liftOnHover NORMALISES the resting chrome to the quiet/default look
  // (--surface-1 / --fg-2 / plain --hairline) regardless of `emphasis`, then borrows
  // the former primary highlight (--surface-2 / --fg-1 / --hairline-strong) only on
  // HOVER (below) plus an inverse PRESS flash (--fg-1 / --surface-0). It lets the
  // topbar "What's next" + "Work" launches rest like the quiet prompt-bar cards and
  // light up on interaction — matching PromptLaunchCard. `emphasis` is kept for
  // call-site/test parity (e.g. Work stays primary) but no longer drives the resting
  // body when liftOnHover is set. NO ochre (ADR-0016).
  if (liftOnHover) {
    idleColor = "var(--fg-2)";
    idleBg = "var(--surface-1)";
    idleBorder = "1px solid var(--hairline)";
  }
  // ARMED per-launch indicator (aw-021, narrowed by aw-030, narrowed again by
  // aw-041; amended ADR-0019). When the toggle is on, each launch button signals
  // "skips permissions" by tinting its EXISTING icon --obligation (red) — the
  // at-a-glance per-launch cue mandated by amended ADR-0018. aw-030 first toned
  // the cue DOWN from the original button-wide red (--obligation border + label)
  // to a separate dot; aw-041 drops the dot entirely (no glyph swap) and moves the
  // signal onto the icon's COLOR. The icon is now ALWAYS rendered; only its hue
  // changes when armed. The armed button body (border + label color) stays
  // IDENTICAL to an unarmed one. The tint uses the EXISTING --obligation token
  // (the styleguide's negative/red family) — consumed unforked (ADR-0003), and
  // deliberately NOT the reserved selection accent --accent-ochre-soft (ADR-0016).
  // The flash (launched/copied) still wins so feedback reads (armed clears while
  // flashed). The SkipPermissionsToggle remains the single control wearing the
  // full --obligation danger treatment.
  const armed = skipPermissions === true && !flashed;
  // aw-064: the glyph is ALWAYS rendered (aw-041) — `trailingIcon` only flips its DOM
  // order relative to the label <span>. The Icon element is built ONCE here so the
  // order swap never gates whether it renders.
  const iconEl = html`<${Icon} name=${icon} size=${large ? 15 : 12.5}
        color=${flashed
          ? "var(--st-done)"
          : armed
            ? "var(--obligation)"
            : (inverse ? "var(--surface-0)" : primary ? "var(--fg-2)" : "var(--fg-3)")} />`;
  const labelEl = html`<span>${labelText}</span>`;
  return html`
    <button
      type="button"
      className="focusable"
      title=${armed
        ? `${label} — launch ${command} with --dangerously-skip-permissions (armed; copies to clipboard if the bridge is unavailable — the clipboard copy does NOT skip permissions)`
        : `${label} — launch ${command} (copies to clipboard if the bridge is unavailable)`}
      aria-label=${armed
        ? `${label} — launch ${command} (skips permissions)`
        : `${label} — launch ${command}`}
      onClick=${onClick}
      style=${{
        display: "inline-flex", alignItems: "center", gap: large ? 7 : 5,
        fontFamily: "var(--font-ui)", fontSize: large ? 13.5 : 11.5,
        fontWeight: primary || inverse ? 600 : 500,
        color: flashed ? "var(--st-done)" : idleColor,
        background: flashed ? "var(--surface-1)" : idleBg,
        border: flashed ? "1px solid var(--st-done)" : idleBorder,
        borderRadius: large ? "var(--radius-md)" : "var(--radius-sm)",
        padding: large ? "9px 16px" : "4px 9px", cursor: "pointer",
        boxShadow: "none",
        transition: "color var(--duration-fast) var(--ease-base), box-shadow var(--duration-fast) var(--ease-base), background var(--duration-fast) var(--ease-base)",
      }}
      ${/* Hover RAISE (aw-030): a stronger box-shadow off the styleguide --shadow
            scale (ADR-0003) plus a background highlight — the same "clearly hovered"
            feel the cards get, WITHOUT shifting content (no vertical nudge,
            no transform).
            Skipped while flashed (the launched/copied treatment owns the surface).
            The :focus affordance is the focusable class, untouched. */ ""}
      ${/* aw-068 (press de-inverted): when liftOnHover is set, hover brightens the text +
            border to the highlight chrome, and PRESS keeps that SAME in-theme chrome
            (--surface-2 / --fg-1 / --hairline-strong) while dropping the lift shadow, so
            the click reads as a press-in. The press NEVER swaps text↔fill (the old
            --fg-1 bg + --surface-0 text read as a theme inversion). mouseup restores the
            raised hover look (the pointer is still over). Non-lift buttons keep the
            box-shadow + surface-2 hover only. */ ""}
      onMouseEnter=${(e) => { if (!flashed) { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.background = "var(--surface-2)"; if (liftOnHover) { e.currentTarget.style.color = "var(--fg-1)"; e.currentTarget.style.borderColor = "var(--hairline-strong)"; } } }}
      onMouseLeave=${(e) => { if (!flashed) { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = inverse ? "var(--fg-1)" : idleBg; if (liftOnHover) { e.currentTarget.style.color = idleColor; e.currentTarget.style.borderColor = "var(--hairline)"; } } }}
      onMouseDown=${(e) => { if (!flashed && liftOnHover) { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--fg-1)"; e.currentTarget.style.borderColor = "var(--hairline-strong)"; } }}
      onMouseUp=${(e) => { if (!flashed && liftOnHover) { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--fg-1)"; e.currentTarget.style.borderColor = "var(--hairline-strong)"; } }}>
      ${/* aw-064: trailingIcon places the glyph AFTER the label (the Work ↗ read).
            The Icon primitive is consumed unchanged (ADR-0003) — it is always
            rendered (aw-041); trailingIcon only reorders icon vs. label. */ ""}
      ${trailingIcon ? [labelEl, iconEl] : [iconEl, labelEl]}
    </button>`;
}

// Fire the celebration burst via canvas-confetti (agentic-workflow-034, amends
// ADR-0020). The hand-rolled CSS-keyframe burst (the injected style rule + the
// DOM-span pieces) is GONE; canvas-confetti gives the real
// particle physics the builder wanted ("way better"). It is the dashboard's first
// BUNDLED frontend runtime dependency — `import`ed above so esbuild folds it into
// the committed dist/app.js (no CDN; the board runs offline on 127.0.0.1).
//
// canvas-confetti's default global confetti() paints a fixed FULL-VIEWPORT canvas
// (pointer-events: none, above content, auto-cleared). aw-042 retires aw-037's single
// AIMED burst: the celebration is now canvas-confetti's canonical "realistic look"
// demo — a LAYERED MULTI-FIRE burst of FIVE overlaid shots (different spreads,
// velocities, decays and scalars) — fired from a CENTERED origin (origin.x = 0.5, the
// demo's origin.y = 0.7) with NO angle aim. The realistic preset is a symmetric
// upward spray, so aw-037's textarea-aim geometry (the live-rect read, the aim
// helper and the textarea-ref-to-confetti plumbing) is GONE. The five-shot profile
// lives in the pure confettiFireSequence (confetti-launch.js); this walks it and
// issues one confetti() call per shot, each shot's particleCount =
// Math.floor(count * particleRatio). The exact y is the open aw-025 replay-loop dial.
// It stays a board-OWNED, board-local transient ACK (ADR-0020): the board injects
// the calls, they are consumed within the BC, and they are NOT promoted to a
// design-system motion primitive — "board-local" was always about ownership.
//
// Colors are resolved at FIRE TIME (resolveConfettiColors, confetti-palette.js) off
// the document root — the four status bases (--st-done/--st-todo/--st-doing/
// --st-backlog), so the burst tracks the active light/dark theme and stays a true
// projection of the styleguide tokens (ADR-0003). Each of the five shots draws from
// the SAME resolved color set. Never the reserved selection accent
// --accent-ochre-soft (ADR-0016) nor the --obligation skip-permissions hue
// (aw-021) — both excluded by construction (neither is a status base).
function fireConfetti() {
  if (typeof document === "undefined" || typeof confetti !== "function") return;
  const colors = resolveConfettiColors(getComputedStyle(document.documentElement));
  const { count, defaults, shots } = confettiFireSequence();
  // One confetti() call per overlaid shot, all sharing the centered origin defaults
  // and the same resolved palette. Each shot's particle budget is its ratio of the
  // shared count (the canvas-confetti "realistic look" fire() helper, inlined).
  for (const { particleRatio, ...opts } of shots) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
      ...(colors.length ? { colors } : {}),
    });
  }
}

// A board-local confetti burst (agentic-workflow-023, reimplemented aw-034) marking
// the prompt bar's clearance after a successful launch/copy. It is keyed by a
// monotonic `fireKey` from the parent: each successful action bumps the key,
// remounting a fresh BoardConfetti that fires once on mount. aw-042 fires the
// celebration from a CENTERED origin (no textarea aim), so the aw-035/aw-037
// textarea ref it once read is gone — BoardConfetti takes no DOM ref. Under
// `prefers-reduced-motion: reduce` it renders NOTHING and never invokes confetti()
// — the matchMedia guard wraps the WHOLE five-shot sequence, so none of the shots
// fire (ADR-0014 strip-to-plain).
function BoardConfetti({ fireKey }) {
  const reduce = typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    // The matchMedia guard wraps the canvas-confetti calls: under reduce none of the
    // five shots are invoked (ADR-0014), and a falsy fireKey (initial mount) fires
    // nothing.
    if (reduce || !fireKey) return;
    fireConfetti();
  }, [fireKey, reduce]);
  // canvas-confetti owns its own full-viewport canvas; BoardConfetti renders no DOM.
  return null;
}

// The board-level PROMPT BAR (agentic-workflow-023, field reshaped aw-038). aw-020's
// bare Quick Capture / Modeling buttons are RELOCATED out of the backlog column to
// sit beneath a board-level prompt field, rendered on the board view only (between
// the shell header and the columns). The builder authors a prompt once and hands it
// to whichever skill they pick: clicking a button seeds the matching command WITH the
// typed prompt appended (quickCaptureCommandFor / modelingCommandFor) — or the bare
// command when the field is empty (byte-identical to aw-020). On a successful
// launch (bridge) or landed clipboard copy, the field is CLEARED and a confetti
// burst plays; a fully-silent action (clipboard blocked too) clears nothing and
// fires no confetti.
//
// THE FIELD IS A SINGLE-LOGICAL-LINE, AUTO-GROWING CONTROL (aw-038). It is a
// <textarea> constrained to author ONE line of text: it soft-wraps with NO horizontal
// scrollbar (overflowX hidden), AUTO-GROWS in height to fit the wrapped content
// (autoGrowField measures scrollHeight) up to PROMPT_FIELD_MAX_PX then scrolls
// vertically (overflowY auto). Enter is SWALLOWED (onKeyDown preventDefault — no
// newline, no launch; Shift+Enter is no special case), and every change is run
// through sanitizePromptLine so the stored value can NEVER hold a newline — a
// multi-line PASTE collapses to one line. The builders read this sanitized value, so
// the seeded-command contract and the empty/whitespace bare fallback are unchanged.
//
// The field is a board-local, token-matched control: the styleguide has no
// text-input primitive, and the board-control precedent (the sort <select>, the
// group toggle) keeps the styleguide consumed UNFORKED (ADR-0003) — this is a
// native control beside the primitives, flagged as a design-system follow-up (a
// shared TextArea/prompt-input). The board stays a projection of disk (ADR-0001):
// launching is an external side-effect, never a lifecycle write.
//
// `skipPermissions` (aw-021 preserved): threaded through to both relocated buttons
// so an armed launch from the prompt bar still posts `skipPermissions: true`.
//
// aw-026: the right-side Work button (aw-024) was REMOVED from the prompt bar and
// relocated to the main-column topbar (BoardTopbar) — one Work entry point. The
// aw-024 two-thirds/one-third split collapses back: the prompt bar is now just a
// full-width auto-growing single-line field above the Quick Capture / Modeling pair.
// Collapse a prompt string to a SINGLE LOGICAL LINE (agentic-workflow-038). Any
// run of newline characters (\r\n / \n / \r, in any mix) becomes a single space,
// so the prompt-bar value can NEVER hold a newline regardless of how it arrived —
// a multi-line PASTE collapses to one line, the same as an Enter keystroke being
// swallowed. Pure + total: a non-string degrades to "" (mirrors the builders'
// trim-then-bare contract; an empty value still yields the bare command). It does
// NOT trim — the builders own trimming (aw-023/aw-036) — it only kills newlines, so
// the visible text keeps its spaces while the value stays single-line.
function sanitizePromptLine(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n]+/g, " ");
}

// Grow a <textarea> to fit its wrapped content up to a max, then let it scroll
// (agentic-workflow-038). Reset height to "auto" first so it can SHRINK back as
// text is deleted, then set it to scrollHeight clamped at maxPx. The field renders
// a single logical line that wraps to multiple visual lines (overflowX hidden, no
// horizontal scrollbar); once the wrapped content exceeds maxPx the field scrolls
// vertically (overflowY auto) instead of growing without bound. No-throw / no-op
// when the element is absent (defensive — never break typing).
function autoGrowField(el, maxPx) {
  if (!el || typeof el.style === "undefined") return;
  el.style.height = "auto";
  const next = Math.min(el.scrollHeight, maxPx);
  el.style.height = `${next}px`;
}

// The prompt-bar field's growth band (agentic-workflow-038): it starts at one line
// of height and grows to fit wrapped content up to PROMPT_FIELD_MAX_PX, after which
// it scrolls vertically.
const PROMPT_FIELD_MIN_PX = 40;
const PROMPT_FIELD_MAX_PX = 168;

// A board-local PROMPT-BAR LAUNCH CARD (agentic-workflow-065). A VISUAL restyle of the
// three flat prompt-bar chips (aw-023/aw-036) into richer icon-tile + title/subtitle
// cards, so the "type a prompt, then choose how to file it" intent reads at a glance.
// The INTERACTION is byte-identical to LaunchButton: it runs the same pure
// `launchOrCopy` (bridge-launch.js) with the silent clipboard fallback, threads the
// armed `skipPermissions` flag (aw-021), hands the raw result to `onResult` (the bar's
// clear-textarea + confetti path, aw-023), and shows the same transient launched/copied
// flash. It deliberately stays a board-LOCAL token-styled composite beside the
// styleguide primitives (the sort <select>, the prompt textarea precedent) — the
// styleguide is consumed UNFORKED (ADR-0003), no primitive forked, no new token minted.
//
// Layout: a square icon TILE on the left (a registry glyph — `plus` / `compass` /
// `search`) over a two-line label (bold title + quiet subtitle). The tile is NEUTRAL
// (token --surface-2 / --fg, never a coloured fill).
//
// `emphasis` (the settled aw-065/aw-064 decision): "primary" wears the aw-033 Work
// chrome — `--surface-2` fill, `--fg-1` text, `--hairline-strong` border (theme-
// following: light fill+dark text in light mode, the inverse in dark). "default" stays
// quiet/secondary — `--surface-1` on a plain `--hairline` border. This is EMPHASIS, not
// a selected state (there is no selection model here), and it deliberately leaves the
// reserved selection accent `--accent-ochre-soft` UNTOUCHED — NO ochre anywhere
// (ADR-0016). The armed `skipPermissions` cue reuses LaunchButton's law: the icon hue
// shifts to `--obligation` while armed (consumed unforked, never the reserved accent).
function PromptLaunchCard({ label, subtitle, command, icon, skipPermissions = false, onResult }) {
  const [feedback, setFeedback] = useState("idle");
  // aw-068: hover + press are React state so the WHOLE card (body, title, subtitle,
  // and the tile glyph — an Icon prop, not a CSS rule) recolours together. The
  // earlier emphasis-driven resting variants are gone: every card reads identically.
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onClick = useCallback(() => {
    const fetchImpl = typeof window !== "undefined" && typeof window.fetch === "function"
      ? window.fetch.bind(window)
      : undefined;
    launchOrCopy({ prompt: command, fetchImpl, copy: copyToClipboard, skipPermissions: skipPermissions === true }).then((res) => {
      // Same contract as LaunchButton: hand the raw result to onResult first (the bar
      // clears + celebrates off it), then flash launched/copied; stay silent if the
      // clipboard was blocked too. Never an error (absence is normal).
      if (typeof onResult === "function") onResult(res);
      if (res.via === "bridge") setFeedback("launched");
      else if (res.copied) setFeedback("copied");
      else return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFeedback("idle"), 1100);
    });
  }, [command, skipPermissions, onResult]);

  const flashed = feedback !== "idle";
  const armed = skipPermissions === true && !flashed;

  // aw-068 (press de-inverted): ONE resting chrome for every card — the quiet look
  // (--surface-1 fill / --fg-2 text / plain --hairline border). HOVER and PRESS share
  // ONE bright chrome (--surface-2 / --fg-1 / --hairline-strong) so the card NEVER
  // swaps text↔fill — the earlier press "inverse fill" (--fg-1 bg + --surface-0 text)
  // read as a THEME INVERSION (dark-on-press in light mode, light-on-press in dark).
  // Text always stays an --fg token, fill always a --surface token. Hover RAISES the
  // card (the bright chrome + a --shadow-md lift); PRESS keeps the same bright chrome
  // but DROPS the lift, so a click reads as the card pressing IN. Precedence keeps the
  // launched/copied flash on top. NO ochre (ADR-0016).
  const active = (hover || pressed) && !flashed;     // bright hover/press chrome (in-theme)
  const lifted = hover && !pressed && !flashed;      // raised --shadow-md only while hovering, not pressing

  // Body chrome by state precedence: flashed > active(hover/press) > rest.
  const bodyColor = flashed ? "var(--st-done)" : active ? "var(--fg-1)" : "var(--fg-2)";
  const bodyBg = flashed ? "var(--surface-1)" : active ? "var(--surface-2)" : "var(--surface-1)";
  const bodyBorder = `1px solid ${flashed ? "var(--st-done)" : active ? "var(--hairline-strong)" : "var(--hairline)"}`;
  // The icon tile is NEUTRAL — a quiet --surface-2 square, never a coloured (ochre)
  // fill. The glyph hue follows the card state, and turns --obligation while armed
  // (the aw-021/aw-041 per-launch skip-permissions cue).
  const tileGlyphColor = flashed
    ? "var(--st-done)"
    : armed
      ? "var(--obligation)"
      : active ? "var(--fg-1)" : "var(--fg-2)";
  // The subtitle stays quiet (--fg-3) — legible on both the resting --surface-1 and the
  // hover/press --surface-2 (no inverse fill to contend with anymore).
  const subtitleColor = flashed ? "var(--st-done)" : "var(--fg-3)";

  const titleText = flashed ? (feedback === "launched" ? "Launched" : "Copied") : label;
  return html`
    <button
      type="button"
      className="focusable"
      title=${armed
        ? `${label} — launch ${command} with --dangerously-skip-permissions (armed; copies to clipboard if the bridge is unavailable — the clipboard copy does NOT skip permissions)`
        : `${label} — launch ${command} (copies to clipboard if the bridge is unavailable)`}
      aria-label=${armed
        ? `${label} — ${subtitle} — launch ${command} (skips permissions)`
        : `${label} — ${subtitle} — launch ${command}`}
      onClick=${onClick}
      onMouseEnter=${() => setHover(true)}
      onMouseLeave=${() => { setHover(false); setPressed(false); }}
      onMouseDown=${() => setPressed(true)}
      onMouseUp=${() => setPressed(false)}
      style=${{
        display: "inline-flex", alignItems: "center", gap: 10, textAlign: "left",
        color: bodyColor,
        background: bodyBg,
        border: bodyBorder,
        borderRadius: "var(--radius-md)", padding: "9px 12px", cursor: "pointer",
        boxShadow: lifted ? "var(--shadow-md)" : "none",
        transition: "color var(--duration-fast) var(--ease-base), box-shadow var(--duration-fast) var(--ease-base), background var(--duration-fast) var(--ease-base), border-color var(--duration-fast) var(--ease-base)",
      }}>
      ${/* Square NEUTRAL icon tile — token --surface-2, never ochre. */ ""}
      <span aria-hidden="true" style=${{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, flexShrink: 0,
        background: "var(--surface-2)", border: "1px solid var(--hairline)",
        borderRadius: "var(--radius-sm)",
      }}>
        <${Icon} name=${icon} size=${15} color=${tileGlyphColor} />
      </span>
      ${/* Two-line label: bold title over a quiet subtitle. */ ""}
      <span style=${{ display: "inline-flex", flexDirection: "column", gap: 1, lineHeight: 1.25 }}>
        <span style=${{
          fontFamily: "var(--font-ui)", fontSize: 12.5,
          fontWeight: 550,
          color: bodyColor,
        }}>${titleText}</span>
        <span style=${{
          fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 400,
          color: subtitleColor,
        }}>${subtitle}</span>
      </span>
    </button>`;
}

// Pull the `generated` frontmatter stamp out of a fetched recommendation body.
// parseFrontmatter is the SAME pure parser the render path uses (aw-043), so the
// stamp the dismiss store keys off cannot drift from what renders. A body with no
// (or partial) frontmatter yields "" — the panel then shows no staleness cue and is
// never dismissible-by-stamp, but still renders what is parseable (never throws).
function generatedStamp(body) {
  const { fields } = parseFrontmatter(body);
  const hit = fields.find(([k]) => k === "generated");
  return hit ? hit[1] : "";
}

// The WHAT'S-NEXT advisory recommendation panel (agentic-workflow-073 / ADR-0027).
//
// The `whats-next` skill writes a single-latest advisory artifact at
// `.agentheim/state/whats-next.md` (an ADVISORY write, ADR-0027 — distinct from a
// lifecycle write; the dashboard stays read-only over it). This panel READS it via
// the existing GET /api/doc body carrier (ADR-0021/0023 — never /api/tree, which is
// pointers/metadata only). Unlike the slide-over / main-pane reader, this is a
// GLANCEABLE advisory card, not a document: the leading YAML is STRIPPED (not folded
// into a "Front matter" <details>, aw-q7m4k) and the three body sections (Where things
// stand / Recommended move / Next) lay out as three side-by-side COLUMNS instead of one
// stacked stream. Each column's content still renders through the unforked styleguide
// Markdown primitive (ADR-0003) — board-local token-matched layout, NO bespoke renderer,
// no new design-system child. Consumed unforked; light/dark aware for free. The body is
// split by splitWhatsNextSections (whats-next-state.js) — LOSS-TOLERANT: a degraded body
// yields whatever columns are parseable, never throws.
//
// Behaviour:
//   - ABSENT artifact (404 / fetch failure) → renders NOTHING (no shell, no error).
//   - MALFORMED / partial artifact → renders what is parseable, never throws.
//   - LIVE: it re-fetches on every SSE tree-changed frame (the existing consumer,
//     ADR-0006) — a new/overwritten artifact triggers a `.agentheim/` mutation frame.
//   - STALENESS CUE derived from the `generated` stamp (rendering only, ADR-0027 §4).
//   - DISMISS persists across reload (whats-next-state.js, keyed by `generated`); a
//     NEWER recommendation re-shows. Read-only over the artifact (ADR-0017): dismiss
//     touches localStorage only, never the file.
//
// fetchDoc is overridable for tests. It sits ABOVE the BoardPromptBar's "Prompt"
// title on the board view only (composed by BoardPromptBar).
function WhatsNextPanel({ fetchDoc = defaultFetchWhatsNext }) {
  const [body, setBody] = useState(null); // null = nothing to show (absent / dismissed-by-fetch)
  // Bump to force a dismiss re-evaluation after the user dismisses (localStorage is
  // not reactive). The fetched body is the source of the `generated` stamp.
  const [, force] = useState(0);

  const reload = useCallback(() => {
    let alive = true;
    fetchDoc()
      .then((md) => { if (alive) setBody(typeof md === "string" ? md : null); })
      // Absent artifact / any fetch failure → render nothing (absence is normal).
      .catch(() => { if (alive) setBody(null); });
    return () => { alive = false; };
  }, [fetchDoc]);

  useEffect(() => reload(), [reload]);
  // Re-fetch on every SSE frame (ADR-0006): a newer advisory write surfaces live.
  useLiveTree(reload);

  if (typeof body !== "string" || body.trim() === "") return null;

  const generated = generatedStamp(body);
  const storage = typeof window !== "undefined" ? window.localStorage : null;
  if (isDismissed(storage, generated)) return null;

  const staleness = formatStaleness(generated, Date.now());

  // Strip the leading frontmatter and cut the body into its named sections (aw-q7m4k).
  // LOSS-TOLERANT: a degraded body yields fewer/empty columns, a non-matching body still
  // renders what is parseable, an empty body yields []. The dismiss/staleness reads above
  // come from the SAME parseFrontmatter, so they are independent of this render split.
  const columns = splitWhatsNextSections(body);

  const onDismiss = () => {
    saveDismissed(storage, generated);
    force((n) => n + 1); // re-render so the now-dismissed stamp hides the panel.
  };

  return html`
    <section aria-label="What's next — the latest advisory recommendation" style=${{
      display: "flex", flexDirection: "column", gap: 8,
      margin: "0 4px 18px", padding: "12px 14px 6px",
      background: "var(--surface-1)", border: "1px solid var(--hairline)",
      borderRadius: "var(--radius-md)",
    }}>
      <header style=${{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style=${{
          display: "inline-flex", alignItems: "center", gap: 7,
          fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600,
          letterSpacing: "-0.01em", color: "var(--fg-1)",
        }}>
          <${Icon} name="compass" size=${14} color="var(--fg-2)" /> What's next
        </span>
        ${staleness && html`<span title=${`Recommendation generated ${generated}`} style=${{
          fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--fg-4)",
        }}>${staleness}</span>`}
        <button
          type="button"
          className="focusable"
          aria-label="Dismiss the What's next recommendation"
          title="Dismiss — a newer recommendation will re-show this panel"
          onClick=${onDismiss}
          style=${{
            marginLeft: "auto", display: "inline-flex", alignItems: "center",
            color: "var(--fg-3)", background: "transparent",
            border: "1px solid var(--hairline)", borderRadius: "var(--radius-sm)",
            padding: "3px 5px", cursor: "pointer",
            transition: "color var(--duration-fast) var(--ease-base), border-color var(--duration-fast) var(--ease-base)",
          }}
          onMouseEnter=${(e) => { e.currentTarget.style.color = "var(--fg-1)"; e.currentTarget.style.borderColor = "var(--hairline-strong)"; }}
          onMouseLeave=${(e) => { e.currentTarget.style.color = "var(--fg-3)"; e.currentTarget.style.borderColor = "var(--hairline)"; }}>
          <${Icon} name="x" size=${14} color="currentColor" />
        </button>
      </header>
      ${/* THREE-COLUMN advisory layout (aw-q7m4k), each column now its own CAPPED CARD
            (aw-c4t8m): the leading YAML is stripped (no folded "Front matter" section),
            and each named body section becomes a column with its heading. Each column's
            content renders through the UNFORKED styleguide Markdown primitive (ADR-0003).
            Responsive fallback: auto-fit columns with a min track collapse to a single
            column on a narrow board so the card stays legible.

            aw-c4t8m — CARD CHROME + HEIGHT CAP: each column is wrapped in board-local,
            token-matched card chrome (a --surface-1 fill on a --hairline border, a token
            radius + padding) — the board-control precedent, styleguide consumed UNFORKED,
            NO new design-system primitive (ADR-0003). The card is height-bounded to a
            compact ~two-ticket-card cap (maxHeight) so the advisory strip never grows to a
            quarter of the viewport regardless of recommendation length; content past the
            cap scrolls vertically INSIDE the card (overflowY: auto) wearing the existing
            quiet styleguide scrollbar (the `scroll-quiet` class, agentheim.css) — the card
            itself never grows past the cap and never pushes the board down. The cap is a
            sizing INTENT, not a hard spec: 196px is roughly two compact cards tall. The
            loss-tolerant contract (aw-q7m4k / aw-073) is untouched — fewer/empty/absent
            columns still render without throwing. */ ""}
      <div style=${{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "14px",
        alignItems: "start",
      }}>
        ${columns.map((col, i) => html`
          <div key=${i} className="scroll-quiet" style=${{
            display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
            maxHeight: 196, overflowY: "auto",
            background: "var(--surface-1)", border: "1px solid var(--hairline)",
            borderRadius: "var(--radius-md)", padding: "10px 12px",
          }}>
            ${col.heading && html`<div style=${{
              fontFamily: "var(--font-ui)", fontSize: 11.5, fontWeight: 600,
              letterSpacing: "0.04em", textTransform: "uppercase",
              color: "var(--fg-4)",
            }}>${col.heading}</div>`}
            <${Markdown} source=${col.content} />
          </div>`)}
      </div>
    </section>`;
}

/** Default fetch for the advisory artifact: GET /api/doc → raw markdown (client-side). */
async function defaultFetchWhatsNext() {
  const res = await fetch(docUrl(WHATS_NEXT_DOC_PATH));
  if (!res.ok) throw new Error(`/api/doc ${res.status}`);
  return res.text();
}

function BoardPromptBar({ skipPermissions = false }) {
  const [prompt, setPrompt] = useState("");
  const [confettiKey, setConfettiKey] = useState(0);
  // The single-line auto-grow (aw-038) holds a ref to the textarea so the field can
  // measure its own scrollHeight to grow/shrink to fit. (Before aw-042 this ref ALSO
  // fed the confetti origin/aim; the celebration now fires from a centered origin
  // with no textarea geometry, so the ref serves auto-grow only.)
  const textareaRef = useRef(null);

  // Fire only on a successful launch / landed copy (aw-023). A fully-silent action
  // (clipboard blocked too) leaves the textarea and plays no confetti. The field is
  // re-measured after the clear so it shrinks back to one line (aw-038).
  const onResult = useCallback((res) => {
    const succeeded = res && (res.via === "bridge" || res.copied === true);
    if (!succeeded) return;
    setPrompt("");
    autoGrowField(textareaRef.current, PROMPT_FIELD_MAX_PX);
    setConfettiKey((k) => k + 1);
  }, []);

  // Single-line input: sanitize newlines OUT of every change (a multi-line paste
  // collapses to one line), store the result, then re-measure for auto-grow.
  const onPromptChange = useCallback((e) => {
    setPrompt(sanitizePromptLine(e.target.value));
    autoGrowField(e.currentTarget, PROMPT_FIELD_MAX_PX);
  }, []);

  // Swallow Enter (aw-038): the field authors ONE logical line, so Enter (and
  // Shift+Enter — no special case) must insert no newline and trigger no launch.
  // preventDefault stops the newline; the bar has no submit-on-Enter, so nothing
  // launches.
  const onPromptKeyDown = useCallback((e) => {
    if (e.key === "Enter") e.preventDefault();
  }, []);

  return html`
    <section aria-label="Author a prompt, then launch a capture or modeling session" style=${{
      position: "relative",
      display: "flex", flexDirection: "column", gap: 10,
      padding: "0 4px 20px",
    }}>
      ${/* aw-073: the What's next advisory recommendation panel sits ABOVE the
            "Prompt" title (board view only). It self-suppresses when the artifact is
            absent or the current recommendation was dismissed, so it composes cleanly
            with the prompt field + the three PromptLaunchCards below. */ ""}
      <${WhatsNextPanel} />
      <span style=${{
        fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600,
        letterSpacing: "-0.01em", color: "var(--fg-1)",
      }}>Prompt</span>
      <textarea
        ref=${textareaRef}
        className="focusable"
        aria-label="Prompt for the launched session"
        placeholder="Type a prompt, then choose how to file it — Quick Capture or Modeling…"
        rows=${1}
        value=${prompt}
        onChange=${onPromptChange}
        onKeyDown=${onPromptKeyDown}
        style=${{
          resize: "none", minHeight: PROMPT_FIELD_MIN_PX, maxHeight: PROMPT_FIELD_MAX_PX,
          overflowX: "hidden", overflowY: "auto",
          fontFamily: "var(--font-ui)", fontSize: 13, lineHeight: 1.5,
          color: "var(--fg-1)", background: "var(--surface-1)",
          border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)",
          padding: "10px 12px",
          transition: "border-color var(--duration-fast) var(--ease-base)",
        }}
        onFocus=${(e) => { e.currentTarget.style.borderColor = "var(--hairline-strong)"; }}
        onBlur=${(e) => { e.currentTarget.style.borderColor = "var(--hairline)"; }} />
      <div role="group" aria-label="Start a session seeded with the prompt above" style=${{
        position: "relative",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        ${/* aw-068: all three cards share ONE resting chrome and HIGHLIGHT on hover +
              flash on press (the interaction lives in PromptLaunchCard). Quick Capture
              no longer wears a per-button emphasis — the three read identically. */ ""}
        <${PromptLaunchCard} label="Quick Capture" subtitle="File it fast"
          command=${quickCaptureCommandFor(prompt)} icon="plus"
          skipPermissions=${skipPermissions} onResult=${onResult} />
        <${PromptLaunchCard} label="Modeling" subtitle="Shape into structure"
          command=${modelingCommandFor(prompt)} icon="compass"
          skipPermissions=${skipPermissions} onResult=${onResult} />
        ${/* aw-h7n2c: Inquire sits BETWEEN Modeling and Research — same quiet/secondary
              card treatment, the new message-circle-question glyph (design-system-r4k8m),
              no per-card emphasis. Asks the codebase a question via the inquire skill. */ ""}
        <${PromptLaunchCard} label="Inquire" subtitle="Ask the codebase"
          command=${inquireCommandFor(prompt)} icon="message-circle-question"
          skipPermissions=${skipPermissions} onResult=${onResult} />
        <${PromptLaunchCard} label="Research" subtitle="Dig deeper"
          command=${researchCommandFor(prompt)} icon="search"
          skipPermissions=${skipPermissions} onResult=${onResult} />
        ${/* aw-068: the decorative right-of-row helper + keyboard chip (aw-065) is
              removed — the textarea placeholder already states the flow. */ ""}
        <${BoardConfetti} fireKey=${confettiKey} />
      </div>
    </section>`;
}

// The per-CARD backlog launch group (agentic-workflow-022). The single per-card
// Copy affordance (aw-016) is REPLACED by TWO launch buttons composed INTO the
// styleguide TicketCard's existing single `cornerAction` render-prop slot
// (design-system-006): cornerAction's contract is "consumer owns what renders", so
// the board hands it a two-button group rather than one icon button — consuming the
// primitive UNFORKED (ADR-0003), not extending it. The styleguide keeps owning the
// slot's placement + its propagation-stopping wrapper; the board owns the group's
// internal layout and each button's launch behavior.
//
// A backlog card invites two real actions, so the pair is:
//   - Refine  (PRIMARY, emphasised) -> `/agentheim:modeling refine <id>` — the full
//     Socratic refinement; the expected default, since most backlog items need
//     deepening before they're ready.
//   - Promote (QUIET, de-emphasised) -> `/agentheim:modeling promote <id>` — the
//     readiness check + backlog → todo move; the rarer, more committing action.
// Each opens a real seeded terminal through the bridge, with the silent clipboard
// fallback (reusing aw-020's LaunchButton/launchOrCopy unchanged). Promote only
// ever runs backlog → todo, so this group belongs on backlog cards only.
function BacklogCardLaunchPair({ id, skipPermissions = false }) {
  return html`
    <div role="group" aria-label="Refine or promote this backlog item" style=${{
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      ${/* aw-068: both card actions follow the SAME hover+press scheme as the prompt-bar
            cards and the topbar launches — liftOnHover normalises the resting chrome and
            brightens (in-theme, never inverted) on hover/press. */ ""}
      <${LaunchButton} label="Refine" command=${refineCommandFor(id)}
        icon="compass" emphasis="primary" liftOnHover=${true} isolateClick=${true} skipPermissions=${skipPermissions} />
      <${LaunchButton} label="Promote" command=${promoteCommandFor(id)}
        icon="arrow-right" emphasis="quiet" liftOnHover=${true} isolateClick=${true} skipPermissions=${skipPermissions} />
    </div>`;
}

// The board's per-BC section now COMPOSES the shared styleguide Collapsible
// primitive (design-system-005), CONTROLLED: the board owns each (column, BC)
// collapse state in its persisted view-state store (ADR-0015), so it supplies
// `open` + `onToggle` and the primitive writes no internal state of its own. The
// former board-local section header (a token-matched clone) is retired — the
// header look now lives once, in the styleguide, consumed unforked (ADR-0003).

// The per-card DISMISS affordance (agentic-workflow-048): a hover-revealed red
// trash can in the card's TOP-RIGHT corner. It does NOT delete anything itself —
// the board is read-only over disk (ADR-0017). Clicking opens the shared styleguide
// ConfirmDialog (ds-018, consumed UNFORKED — ADR-0003) with destructive=true; on
// confirm it fires `/agentheim:modeling dismiss <id>` (dismissCommandFor) through the
// existing VS Code bridge (launchOrCopy, ADR-0018), with the silent clipboard
// fallback. The agent then runs the CASCADE dismiss (ADR-0022): the spawned session
// LISTS and RE-CONFIRMS the full transitive dependent subtree before deleting
// anything, so this button — which can only name the card it sits on — makes that
// explicit in the dialog body and is a seed-and-fire, never the final say.
//
// Placement is a board-local OVERLAY (the styleguide TicketCard exposes no top-right
// slot — `cornerAction` is its BOTTOM-right meta row, where the backlog
// Refine/Promote pair lives, aw-022): BoardCard wraps the card in its own
// `position: relative` host and absolutely positions this button at the host's
// top-right, OUTSIDE the card's overflow, as a SIBLING. So the styleguide card is
// consumed unforked, no new prop, no styleguide edit for placement.
//
// REVEAL: the card's own hover state lives inside TicketCard and does not surface to
// the board, so the host wrapper drives the reveal via its own
// onMouseEnter/onMouseLeave (`hostHover`); the button is ALWAYS in the DOM at
// opacity 0 and rises to opacity 1 on host hover OR its own keyboard focus, so it is
// keyboard-reachable without a pointer. On its OWN hover it highlights (intensified
// --obligation fill).
//
// ARMED skip-permissions (aw-051, reversing aw-048): the dismiss now honours the
// armed toggle like every other launch — when armed it threads `skipPermissions:
// true` into launchOrCopy (strict-`true` check), so the bridge seeds
// `claude --dangerously-skip-permissions`; OFF, it omits the field byte-identically
// to aw-048. The armed value arrives as a PROP threaded down from DashboardApp (the
// single skip-permissions-state store — no second source, no /api/bridge probe on
// render, ADR-0017/0019). Dropping the permission prompt on a hard-deleting cascade
// is acceptable because the spawned `modeling` session LISTS and RE-CONFIRMS the full
// dependent subtree INSIDE the session before deleting (ADR-0022) — that in-session
// guard survives even under --dangerously-skip-permissions. No distinct per-launch cue
// is needed (the trash glyph is ALREADY --obligation-tinted because it is destructive,
// aw-048): under aw-041 doctrine "the toggle is the single control wearing the danger
// hue", so dismiss satisfies ADR-0018's per-launch mandate trivially.
//
// The click is propagation-isolated (stopPropagation on the button) so dismissing
// never opens the slide-over; the dialog (rendered as a sibling) likewise stops
// propagation on its host so confirm/cancel clicks never bubble to the card.
function CardTrashCan({ ticket, hostHover, skipPermissions = false }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const shown = hostHover || focused || open;

  const fire = useCallback(() => {
    const fetchImpl = typeof window !== "undefined" && typeof window.fetch === "function"
      ? window.fetch.bind(window)
      : undefined;
    // Thread the armed signal exactly like the launch buttons (aw-051): strict-`true`
    // so the bridge POST omits the field unless armed (never sends `false`). The
    // clipboard fallback carries NO bypass (--dangerously-skip-permissions is
    // startup-only; the slash command pastes into a running session) — launchOrCopy
    // handles that asymmetry and never throws when the bridge is absent.
    launchOrCopy({ prompt: dismissCommandFor(ticket.id), fetchImpl, copy: copyToClipboard, skipPermissions: skipPermissions === true });
    setOpen(false);
  }, [ticket.id, skipPermissions]);

  const onTrashClick = useCallback((e) => {
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    setOpen(true);
  }, []);

  const title = ticket && ticket.title ? ticket.title : ticket.id;

  return html`
    <span
      onClick=${(e) => { if (e && typeof e.stopPropagation === "function") e.stopPropagation(); }}>
      <button
        type="button"
        className="focusable"
        aria-label=${`Dismiss ${title}`}
        title=${`Dismiss ${title} — fires /agentheim:modeling dismiss ${ticket.id} (the agent lists + re-confirms the full cascade set before deleting)`}
        onClick=${onTrashClick}
        onFocus=${() => setFocused(true)}
        onBlur=${() => setFocused(false)}
        onMouseEnter=${() => setHover(true)}
        onMouseLeave=${() => setHover(false)}
        style=${{
          position: "absolute", top: 6, right: 6, zIndex: 2,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: 5, cursor: "pointer",
          borderRadius: "var(--radius-sm)",
          color: "var(--obligation)",
          background: hover ? "var(--obligation-soft)" : "transparent",
          border: `1px solid ${hover ? "var(--obligation)" : "transparent"}`,
          opacity: shown ? 1 : 0,
          pointerEvents: shown ? "auto" : "none",
          transition: "opacity var(--duration-fast) var(--ease-base), background var(--duration-fast) var(--ease-base), border-color var(--duration-fast) var(--ease-base)",
        }}>
        <${Icon} name="trash-2" size=${13} color="var(--obligation)" />
      </button>
      <${ConfirmDialog}
        open=${open}
        title=${`Dismiss '${title}'?`}
        onClose=${() => setOpen(false)}
        onConfirm=${fire}
        confirmLabel="Dismiss"
        destructive=${true}>
        <p style=${{ margin: "0 0 10px" }}>
          This fires the <code style=${{ fontFamily: "var(--font-mono)" }}>modeling</code> <strong>dismiss</strong> on
          <code style=${{ fontFamily: "var(--font-mono)" }}>${ticket.id}</code>.
        </p>
        <p style=${{ margin: 0 }}>
          Dismiss <strong>cascades</strong>: it can delete this task and everything queued behind it (its
          dependent subtree). The spawned session will <strong>list and re-confirm the full set</strong> before
          deleting anything — and refuses entirely if any task in the set is already in progress or done.
        </p>
      </${ConfirmDialog}>
    </span>`;
}

// A read-only lifecycle column that COMPOSES the approved styleguide
// sub-components (ColumnHeader, TicketCard, EmptyColumn) exactly as the styleguide
// `Column` does — same pattern, no fork. The board carries NO drag affordances
// (ADR-0017): columns are inert projections of disk, never drop targets, and the
// dashboard never writes a lifecycle move. It hosts the board-only per-column sort
// control (aw-012) as a sibling of ColumnHeader; `tickets` arrives already ordered
// (the board sorts before passing it in).
// One TicketCard. Factored out so the flat list and the grouped sections render
// cards identically (same selection ring).
function BoardCard({ ticket, status, selectedId, onOpen, skipPermissions = false, dependencyRelation, onCardHover }) {
  // Backlog cards carry a Refine / Promote launch pair (aw-022) in the styleguide
  // card's bottom-right cornerAction slot (design-system-006), replacing aw-016's
  // single Copy affordance: Refine (primary) seeds `/agentheim:modeling refine
  // <id>` and Promote (quiet) seeds `/agentheim:modeling promote <id>`, each
  // opening a real seeded terminal through the bridge (clipboard fallback). The
  // board hands the slot's consumer-owned render-prop a two-button GROUP — unforked
  // consumption (ADR-0003), not an extension of the slot. Other columns pass no
  // cornerAction, so their cards render the slot empty (and, since ds-006, no dead
  // estimate chip either). The slot is click-isolated by the styleguide, so
  // launching never opens the slide-over.
  const cornerAction = status === "backlog"
    ? () => html`<${BacklogCardLaunchPair} id=${ticket.id} skipPermissions=${skipPermissions} />`
    : undefined;
  // The TOP-RIGHT dismiss trash can (aw-048) sits on BACKLOG + TODO cards only —
  // doing/done never show it (DISMISS itself refuses those states, ADR-0022). It is a
  // board-local OVERLAY (the styleguide TicketCard has no top-right slot), so the card
  // is wrapped in a `position: relative` host and the trash is absolutely positioned
  // at the host's top-right as a SIBLING of the card (outside the card's overflow).
  // The host drives the hover reveal (the card's own hover stays inside TicketCard and
  // does not surface to the board). On backlog cards the trash (top-right) coexists
  // cleanly with the Refine/Promote cornerAction pair (bottom-right); on todo cards it
  // stands alone (todo passes no cornerAction). No TicketCard prop is added.
  const showTrash = status === "backlog" || status === "todo";
  const [hostHover, setHostHover] = useState(false);
  const card = html`
    <${TicketCard} key=${ticket.id} ticket=${ticket} variant="rail"
      selected=${selectedId === ticket.id} onClick=${() => onOpen(ticket)}
      cornerAction=${cornerAction} dependencyRelation=${dependencyRelation} />`;
  // agentic-workflow-h9v3m: EVERY card, any status, is a potential dependency
  // TARGET — a backlog/todo card's dependsOn/blocks can point at a doing or
  // done ticket just as easily as another backlog/todo one — so every card
  // needs a `data-ticket-id` host node for the IntersectionObserver wiring
  // below to find. Only backlog/todo cards are additionally a HOVER SOURCE
  // (agentic-workflow-k5p8w) and get the trash-can overlay + onCardHover lift;
  // that status gate is unchanged.
  if (!showTrash) return html`<div data-ticket-id=${ticket.id}>${card}</div>`;
  return html`
    <div
      data-ticket-id=${ticket.id}
      style=${{ position: "relative" }}
      onMouseEnter=${() => { setHostHover(true); if (typeof onCardHover === "function") onCardHover(ticket.id); }}
      onMouseLeave=${() => { setHostHover(false); if (typeof onCardHover === "function") onCardHover(null); }}>
      ${card}
      <${CardTrashCan} ticket=${ticket} hostHover=${hostHover} skipPermissions=${skipPermissions} />
    </div>`;
}

function BoardColumn({
  status, tickets, sort, onSortChange, grouped, onGroupToggle,
  collapsed, onToggleSection, peek = false, onToggleCollapse,
  selectedId, onOpen, skipPermissions = false,
  waitingOn, holdingUp, onCardHover,
  targetIds, doneMarker = false, bodyRef,
}) {
  // Pipeline: tickets arrive ALREADY sorted (the board sorts before passing them
  // in); group them into sections here (board-group.groupTickets, pure). A flat
  // column yields one null-bc section; the toggle re-shapes presentation only.
  // agentic-workflow-h9v3m: annotateSectionHiddenDependency (also pure) then
  // flags every section that is CURRENTLY COLLAPSED and holds a resolved
  // dependency target id (targetIds, the union of waitingOn/holdingUp) — a
  // data-layer answer, since a closed Collapsible has no body/DOM node to
  // find a rendered position for (ADR-0033 pt. 3).
  const sections = annotateSectionHiddenDependency(
    groupTickets(tickets, { grouped, collapsed }),
    targetIds,
  );

  // agentic-workflow-k5p8w: a card rings when its own id is a resolved hover
  // target — waitingOn (solid) beats holdingUp (dashed) on the rare malformed
  // overlap, matching resolveHoverDependencies' own precedence. Both sets are
  // empty (no throw, just no match) when nothing is hovered.
  const renderCard = (t) => html`
    <${BoardCard} key=${t.id} ticket=${t} status=${status}
      selectedId=${selectedId} onOpen=${onOpen} skipPermissions=${skipPermissions}
      dependencyRelation=${waitingOn && waitingOn.has(t.id) ? "waiting-on" : (holdingUp && holdingUp.has(t.id) ? "holding-up" : undefined)}
      onCardHover=${onCardHover} />`;

  // aw-m2v8d: when collapsed (peek), the WHOLE column body is height-clamped with a
  // bottom fade — the pure peekClampStyle. The clamp is ONE max-height on the body
  // wrapper, ORTHOGONAL to grouping: section headers + cards fall where they may
  // inside the clamped/faded region; the clamp never runs per-section. Expanded → an
  // empty fragment, so the full list renders.
  const bodyClamp = peekClampStyle(peek === true);

  return html`
    <div style=${{
      flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column",
      borderRadius: "var(--radius-md)",
    }}>
      ${typeof onToggleCollapse === "function"
        ? html`
          <div style=${{ display: "flex", alignItems: "flex-start" }}>
            <div style=${{ flex: "1 1 0", minWidth: 0 }}>
              <${ColumnHeader} status=${status} count=${tickets.length} />
            </div>
            <${ColumnCollapseButton} status=${status} peek=${peek} onToggleCollapse=${onToggleCollapse}
              hasHiddenDependency=${doneMarker} />
          </div>`
        : html`<${ColumnHeader} status=${status} count=${tickets.length} />`}
      <${ColumnControls} status=${status} sort=${sort} onSortChange=${onSortChange}
        grouped=${grouped} onGroupToggle=${onGroupToggle} />
      ${tickets.length === 0
        ? html`<div style=${{ paddingBottom: 8 }}><${EmptyColumn} status=${status} /></div>`
        : html`
          <div ref=${bodyRef} style=${{ paddingBottom: 8, ...bodyClamp }}>
            ${grouped
              ? html`
                <div style=${{ display: "flex", flexDirection: "column", gap: 6 }}>
                  ${sections.map((sec) => html`
                    <${Collapsible} key=${sec.bc} label=${sec.bc} count=${sec.count}
                      open=${!sec.collapsed} onToggle=${() => onToggleSection(sec.bc)}
                      bodyStyle=${{ gap: 10, paddingLeft: 2 }}
                      hasHiddenDependency=${sec.hasHiddenDependency}>
                      ${sec.tickets.map(renderCard)}
                    </${Collapsible}>`)}
                </div>`
              : html`
                <div style=${{ display: "flex", flexDirection: "column", gap: 10 }}>
                  ${sections[0].tickets.map(renderCard)}
                </div>`}
          </div>`}
    </div>`;
}

// The off-viewport edge-blink INDICATOR (agentic-workflow-h9v3m, ADR-0003's
// "styleguide owns look/mechanics, consumer owns placement" seam per
// design-system-b7n2s: design-system ships only `.rel-edge-blink` + the
// direction helper; the board builds and places the actual element using its
// own scroll geometry). One small `--rel-dep`-tinted chevrons icon per edge,
// `position: fixed` against the sole scroll container's OWN measured rect —
// fixed rather than absolute/sticky so it never moves as that container's
// content scrolls underneath it. Untested DOM/browser-only glue (ADR-0033;
// matches the autoGrowField/fireConfetti precedent) — no marker to place when
// nothing is off-viewport.
function EdgeBlinkOverlay({ scrollContainerRef, top, bottom }) {
  if (!top && !bottom) return null;
  const el = scrollContainerRef && scrollContainerRef.current;
  if (!el || typeof el.getBoundingClientRect !== "function") return null;
  const rect = el.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  return html`
    <div style=${{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 40 }}>
      ${top && html`
        <div className=${edgeBlinkClass("top")} style=${{ position: "fixed", top: rect.top + 8, left: centerX, transform: "translateX(-50%)" }}>
          <${Icon} name="chevrons-up" size=${18} color="var(--rel-dep)" />
        </div>`}
      ${bottom && html`
        <div className=${edgeBlinkClass("bottom")} style=${{ position: "fixed", top: rect.bottom - 26, left: centerX, transform: "translateX(-50%)" }}>
          <${Icon} name="chevrons-down" size=${18} color="var(--rel-dep)" />
        </div>`}
    </div>`;
}

/**
 * The dashboard board. Self-contained: fetches /api/tree, transforms it into the
 * four flat columns, renders a read-only column per lifecycle, and (aw-009) stays
 * live via the SSE stream. It is READ-ONLY (ADR-0017): the dashboard never writes
 * lifecycle state — skills are the sole owners.
 *
 * Live-update: subscribes to GET /api/events; every tree-changed frame (or
 * reconnect) re-fetches /api/tree and re-projects — the raw event is never
 * interpreted as a transition. As skills move files on disk the board reflects it.
 *
 * @param {(ticket: object) => void} [onOpen] — open-intent sink (aw-007 wires it).
 * @param {string} [treeUrl] — overridable for tests / alternate mounts.
 * @param {{current: (HTMLElement|null)}} [scrollContainerRef] — a ref onto the
 *        app's SOLE vertical scroll container (DashboardApp's outer
 *        `scroll-quiet` region), threaded down so agentic-workflow-h9v3m's
 *        IntersectionObserver can root itself there (ADR-0033 pt. 1) instead
 *        of the browser viewport.
 */
export function DashboardBoard({ onOpen, treeUrl = "/api/tree", skipPermissions = false, scrollContainerRef }) {
  const [columns, setColumns] = useState(EMPTY_COLUMNS);
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [selectedId, setSelectedId] = useState(null);
  // agentic-workflow-k5p8w: transient, client-side hover view-state only
  // (ADR-0017 — no disk write, never persisted). Hovering a backlog/todo card
  // lifts its id here; every rendered card (any column, any BC) checks whether
  // it is a resolved dependency target of the hovered card and rings if so.
  const [hoveredId, setHoveredId] = useState(null);

  // agentic-workflow-h9v3m: the Done column's height-clamped peek body — the
  // one column body that needs its own rect (PEEK_MAX_HEIGHT_PX below its
  // top) to tell "genuinely clipped below the clamp" from "still within the
  // visible clamp window" (ADR-0033's Notes; the clamp is a height clamp, not
  // a node-count cut, so classifyEdge against the outer scroll root alone
  // would misclassify a clamp-clipped-but-in-viewport card as visible).
  const doneBodyRef = useRef(null);

  // Off-viewport edge-blink state: ticket id -> "above" | "below", for every
  // hover-target id currently off the sole scroll container's visible
  // window. Empty whenever nothing is hovered or nothing is off-viewport.
  const [edgeBlinks, setEdgeBlinks] = useState({});
  // Whether the Done column's peek collapse control should carry the
  // hidden-dependency marker (a target sits in Done, Done is peeked, AND the
  // target is genuinely below the clamp's visible window).
  const [donePeekMarker, setDonePeekMarker] = useState(false);

  // Per-column VIEW LENS — { grouped, sort, collapsed } per column, independent
  // per column. PERSISTED across reloads via the single versioned localStorage
  // store (aw-014, reversing ADR-0009's no-localStorage clause; supersedes
  // aw-012's in-session-only sort). It is VIEW-STATE ONLY: the board's CONTENT
  // stays a projection of disk, re-fetched on every SSE frame. A column with no
  // stored state defaults to flat + default sort + all-expanded. The order and
  // grouping are DERIVED below at render time, so every loadTree re-projection
  // (SSE tree-changed / reconnect) re-applies the current choice — never resets.
  const [view, setView] = useState(() => {
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    const stored = loadViewState(storage);
    const v = {};
    for (const c of COLUMN_ORDER) v[c] = { ...defaultColumnState(), ...(stored[c] || {}) };
    return v;
  });

  // Persist on every change. A failed preference write is swallowed by the store;
  // it must never surface as a board error.
  useEffect(() => {
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    saveViewState(storage, view);
  }, [view]);

  const setColumnSort = useCallback((status, value) => {
    setView((prev) => (prev[status].sort === value
      ? prev
      : { ...prev, [status]: { ...prev[status], sort: value } }));
  }, []);

  const setColumnGrouped = useCallback((status, grouped) => {
    setView((prev) => (prev[status].grouped === grouped
      ? prev
      : { ...prev, [status]: { ...prev[status], grouped } }));
  }, []);

  // Collapse / expand one column to a peek (aw-m2v8d, replacing aw-072's hide).
  // Presentation-only: it flips persisted view-state `peek`, which peekClampStyle reads
  // to height-clamp the column body at render time. The column stays in the layout. No
  // /api write, no lifecycle move (ADR-0017/0001).
  const setColumnPeek = useCallback((status, peek) => {
    setView((prev) => (prev[status].peek === peek
      ? prev
      : { ...prev, [status]: { ...prev[status], peek } }));
  }, []);

  // Toggle one (column, BC) section's collapse state. Stored as the list of
  // COLLAPSED BC names per column — absent = expanded (the all-expanded default).
  const toggleSection = useCallback((status, bc) => {
    setView((prev) => {
      const col = prev[status];
      const has = col.collapsed.includes(bc);
      const collapsed = has ? col.collapsed.filter((x) => x !== bc) : [...col.collapsed, bc];
      return { ...prev, [status]: { ...col, collapsed } };
    });
  }, []);

  // The single board re-projection: re-fetch /api/tree and rebuild the columns.
  // Called on mount and on every SSE tree-changed frame / reconnect — the board
  // is always rebuilt from disk, never mutated in place.
  const loadTree = useCallback(() => {
    let alive = true;
    fetch(treeUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`/api/tree ${r.status}`);
        return r.json();
      })
      .then((tree) => {
        if (!alive) return;
        setColumns(treeToColumns(tree));
        setPhase("ready");
      })
      .catch(() => {
        if (!alive) return;
        setColumns(EMPTY_COLUMNS);
        setPhase("error");
      });
    return () => { alive = false; };
  }, [treeUrl]);

  // Initial load.
  useEffect(() => { setPhase("loading"); return loadTree(); }, [loadTree]);

  // Live-update: re-sync the board on connect and every tree-changed frame. The
  // move's own SSE echo is just another tree-changed frame → one more re-fetch,
  // idempotent, no double-apply (ADR-0001).
  useLiveTree(loadTree);

  // Card click → emit the open intent (aw-007 consumes it). Selection state is
  // tracked here so the clicked card shows the styleguide selected ring.
  const handleOpen = useCallback((ticket) => {
    setSelectedId(ticket.id);
    if (typeof onOpen === "function") onOpen(ticket);
  }, [onOpen]);

  const total = COLUMN_ORDER.reduce((n, c) => n + columns[c].length, 0);

  // agentic-workflow-k5p8w: the pooled cross-BC, cross-column ticket universe
  // resolveHoverDependencies resolves against — a target rendered ANYWHERE on
  // the board rings, regardless of which column/BC it lives in or its scroll
  // position (no IntersectionObserver here; that gap is agentic-workflow-h9v3m).
  const allTickets = useMemo(
    () => COLUMN_ORDER.flatMap((c) => columns[c]),
    [columns],
  );
  const hoveredTicket = useMemo(
    () => (hoveredId ? allTickets.find((t) => t.id === hoveredId) || null : null),
    [hoveredId, allTickets],
  );
  const { waitingOn, holdingUp } = useMemo(
    () => resolveHoverDependencies(hoveredTicket, allTickets),
    [hoveredTicket, allTickets],
  );
  const handleCardHover = useCallback((id) => setHoveredId(id), []);

  // agentic-workflow-h9v3m: the direction-agnostic id universe the group/Done
  // markers test membership against (design-system-b7n2s: "one marker meaning
  // 'expand to see' is enough — direction stays on the on-card ring").
  const targetIds = useMemo(
    () => unionTargetIds(waitingOn, holdingUp),
    [waitingOn, holdingUp],
  );
  // The pure narrowing candidate (board-dependency-groups.js): is it even
  // worth running the Done-peek clamp rect check below? False whenever Done
  // isn't peeked or holds no target at all.
  const donePeekCandidate = donePeekHasHiddenDependency(columns.done, targetIds, view.done.peek);

  // Ephemeral, hover-scoped DOM/viewport observation (ADR-0033): mounted only
  // while a backlog/todo hover session is active, disconnected on hover-end —
  // no always-on global observer. For every resolved target id that IS
  // currently rendered (has a data-ticket-id DOM node — a target hidden
  // inside a collapsed group has none, ADR-0033 pt. 3), classify it against
  // the sole scroll container: intersecting -> already pulsing (nothing to
  // do); not intersecting -> above/below drives the edge-blink. Scroll-
  // reactivity is free: IntersectionObserver re-fires as the target scrolls
  // through the root, so off-viewport -> visible replaces the blink with the
  // normal pulse live, no manual scroll listener, no re-hover needed. The
  // Done column's peeked target ids are resolved with a one-time bounded rect
  // check against the clamp's own visible window instead (the clamp doesn't
  // move relative to its own body on outer scroll, so no observer needed
  // there) — genuinely below the clamp routes to the Done marker instead of
  // an edge-blink or a live observer.
  useEffect(() => {
    const root = scrollContainerRef && scrollContainerRef.current;

    if (!hoveredTicket || targetIds.size === 0 || !root) {
      setEdgeBlinks({});
      setDonePeekMarker(false);
      return undefined;
    }

    const clampedIds = new Set();
    if (donePeekCandidate && doneBodyRef.current) {
      const bodyRect = doneBodyRef.current.getBoundingClientRect();
      const clampWindow = { top: bodyRect.top, bottom: bodyRect.top + PEEK_MAX_HEIGHT_PX };
      let peekHidden = false;
      for (const t of columns.done) {
        if (!t || !targetIds.has(t.id)) continue;
        const node = root.querySelector(`[data-ticket-id="${t.id}"]`);
        if (!node) continue;
        if (classifyEdge(node.getBoundingClientRect(), clampWindow) === "below") {
          peekHidden = true;
          clampedIds.add(t.id);
        }
      }
      setDonePeekMarker(peekHidden);
    } else {
      setDonePeekMarker(false);
    }

    if (typeof IntersectionObserver !== "function") {
      setEdgeBlinks({});
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      setEdgeBlinks((prev) => {
        const next = { ...prev };
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-ticket-id");
          if (!id) continue;
          if (entry.isIntersecting) {
            delete next[id];
            continue;
          }
          const rootBounds = entry.rootBounds || root.getBoundingClientRect();
          const edge = classifyEdge(entry.boundingClientRect, rootBounds);
          if (edge === "above" || edge === "below") next[id] = edge;
          else delete next[id];
        }
        return next;
      });
    }, { root, threshold: 0 });

    for (const id of targetIds) {
      if (clampedIds.has(id)) continue; // resolved by the Done-peek check above.
      const node = root.querySelector(`[data-ticket-id="${id}"]`);
      if (node) observer.observe(node);
    }

    return () => {
      observer.disconnect();
      setEdgeBlinks({});
    };
  }, [hoveredTicket, targetIds, donePeekCandidate, columns.done, scrollContainerRef]);

  if (phase === "loading") {
    return html`<${LoadState}><${Icon} name="loader" size=${15} color="var(--fg-4)" /> Loading board…</${LoadState}>`;
  }
  if (phase === "error") {
    return html`<${LoadState}><${Icon} name="triangle-alert" size=${15} color="var(--st-doing)" /> Could not load the board. Is the dashboard server running?</${LoadState}>`;
  }

  // aw-m2v8d: every lifecycle column is always rendered (the aw-072 drop-from-layout
  // is gone). Only Done carries the collapse/peek control; its `peek` boolean
  // height-clamps the body at render time (peekClampStyle), derived so it survives
  // every SSE re-projection — a task completing into a collapsed Done just slots into
  // the still-clamped overflow, never auto-expanding.
  return html`
    <div>
      <${BoardPromptBar} skipPermissions=${skipPermissions} />
      <div style=${{ paddingTop: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <${BoardHeader} count=${total} />
      </div>
      <div className="scroll-quiet" style=${{ overflowX: "auto", paddingBottom: 8 }}>
        <div style=${{ minWidth: 880 }}>
          <div style=${{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            ${COLUMN_ORDER.map((status) => html`
              <${BoardColumn} key=${status} status=${status}
                tickets=${sortTickets(columns[status], view[status].sort)}
                sort=${view[status].sort} onSortChange=${(v) => setColumnSort(status, v)}
                grouped=${view[status].grouped} onGroupToggle=${(g) => setColumnGrouped(status, g)}
                collapsed=${view[status].collapsed} onToggleSection=${(bc) => toggleSection(status, bc)}
                peek=${view[status].peek}
                onToggleCollapse=${status === "done" ? (p) => setColumnPeek(status, p) : undefined}
                selectedId=${selectedId} onOpen=${handleOpen} skipPermissions=${skipPermissions}
                waitingOn=${waitingOn} holdingUp=${holdingUp} onCardHover=${handleCardHover}
                targetIds=${targetIds}
                doneMarker=${status === "done" ? donePeekMarker : false}
                bodyRef=${status === "done" ? doneBodyRef : undefined} />`)}
          </div>
        </div>
      </div>
      <${EdgeBlinkOverlay} scrollContainerRef=${scrollContainerRef}
        top=${Object.values(edgeBlinks).includes("above")}
        bottom=${Object.values(edgeBlinks).includes("below")} />
    </div>`;
}

// The shell-header SKIP-PERMISSIONS armed toggle (aw-021). It lives in the
// ShellRail header next to the theme toggle (the aw-017 persisted-control
// precedent) — NOT a settings panel, since there is one setting today. It carries
// an ARMED / DANGER visual treatment so it never reads as a neutral preference:
// when on, it is filled with the existing --obligation token (the styleguide's
// negative/red family), consumed UNFORKED (ADR-0003) — deliberately NOT the
// reserved selection accent --accent-ochre-soft (ADR-0016). Off, it is a quiet,
// recessed control. Toggling it flips the persisted store (skip-permissions-state.js)
// in DashboardApp, which threads the armed flag into every launchOrCopy.
function SkipPermissionsToggle({ armed, onToggle }) {
  return html`
    <button
      type="button"
      className="focusable"
      role="switch"
      aria-checked=${armed}
      aria-label="Arm skip-permissions for bridge launches"
      title=${armed
        ? "Skip-permissions ARMED — every bridge launch starts claude --dangerously-skip-permissions. Click to disarm."
        : "Skip-permissions off — bridge launches prompt for permissions normally. Click to arm (launches will skip permission prompts)."}
      onClick=${() => onToggle(!armed)}
      style=${{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: "var(--font-ui)", fontSize: 11.5, fontWeight: armed ? 600 : 500,
        color: armed ? "var(--obligation)" : "var(--fg-3)",
        background: armed ? "var(--obligation-soft)" : "transparent",
        border: `1px solid ${armed ? "var(--obligation)" : "var(--hairline)"}`,
        borderRadius: "var(--radius-sm)", padding: "4px 9px", cursor: "pointer",
        transition: "color var(--duration-fast) var(--ease-base), border-color var(--duration-fast) var(--ease-base), background var(--duration-fast) var(--ease-base)",
      }}>
      <span aria-hidden="true" style=${{
        width: 7, height: 7, borderRadius: 99,
        background: armed ? "var(--obligation)" : "transparent",
        border: `1.5px solid ${armed ? "var(--obligation)" : "var(--fg-4)"}`,
        flexShrink: 0,
      }} />
      <span>${armed ? "Skips permissions" : "Skip permissions"}</span>
    </button>`;
}

// ── Workflow diagram primitives (agentic-workflow-060) ──────────────────────
// Board-local helpers (NOT a design-system primitive — single consumer, content-
// bound shapes; the seam test failed at refinement). The hand-authored flow visuals
// for the three workflow segments are built from these. RULES (from aw-060):
//   • HTML + CSS boxes laid out with flexbox; connectors are CSS-drawn (token-styled
//     borders / pseudo-edges) — NO inline SVG, NO diagramming library, NO new bundled
//     runtime dependency.
//   • Every color / border / fill is a design-system CSS var (ADR-0003, consumed
//     UNFORKED) so the diagrams track the active light/dark theme automatically.
//   • Nodes are SKILLS + ARTIFACTS only. Gates / human-in-the-loop checks render as a
//     marked CHECKPOINT on an edge (WCheckpoint) — never as separate orchestrator /
//     specialist / verifier / research-reviewer boxes.
//   • Static (read-only, ADR-0017): no motion by default; any motion added would be
//     wrapped behind prefers-reduced-motion. There is none today.

// A diagram NODE: a skill or an artifact. `kind` tints the box from tokens —
//   skill    → accent-ochre outline on accent-tint fill (the verbs that act),
//   artifact → hairline outline on surface fill (the things produced/moved).
// `verb` is an optional small mono sub-label (e.g. CAPTURE / REFINE / PROMOTE).
function WNode({ kind = "skill", label, verb }) {
  const skill = kind === "skill";
  return html`
    <span style=${{
      display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 1,
      padding: "5px 9px", borderRadius: "var(--radius-sm)",
      fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.25, whiteSpace: "nowrap",
      color: skill ? "var(--accent-ochre)" : "var(--fg-2)",
      background: skill ? "var(--accent-ochre-tint)" : "var(--surface-1)",
      border: `1px solid ${skill ? "var(--accent-ochre)" : "var(--hairline-strong)"}`,
    }}>
      <span>${label}</span>
      ${verb ? html`<span style=${{
        fontSize: 9, letterSpacing: "0.04em", color: "var(--fg-3)",
      }}>${verb}</span>` : ""}
    </span>`;
}

// A CHECKPOINT marker pinned on an edge — the adversarial gate / human-in-the-loop
// review. NOT a node: it is rendered ON a connector, styled distinctly (dashed
// outline, no fill) so it reads as "a check the flow must pass", not "an actor".
// `tone` = "human" (builder review) or "guard" (verifier / research-reviewer).
function WCheckpoint({ label, tone = "guard" }) {
  const human = tone === "human";
  return html`
    <span aria-hidden="true" style=${{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 99,
      fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.03em",
      color: human ? "var(--accent-ochre)" : "var(--fg-3)",
      background: "transparent",
      border: `1px dashed ${human ? "var(--accent-ochre)" : "var(--hairline-strong)"}`,
    }}>
      <span style=${{
        width: 5, height: 5, borderRadius: 99, flexShrink: 0,
        background: human ? "var(--accent-ochre)" : "var(--fg-4)",
      }} />
      <span>${label}</span>
    </span>`;
}

// A CSS-drawn connector. `dir` = "down" | "right". `tone` "default" | "fail"
// (the verifier FAIL loop) colors the line. `dashed` marks a loop-back edge.
// The arrowhead is a rotated bordered pseudo-box (no SVG). Optional `mid` slot
// hosts an edge checkpoint / loop label centered on the line.
function WArrow({ dir = "down", tone = "default", dashed = false, mid, label }) {
  const color = tone === "fail" ? "var(--obligation)" : "var(--hairline-strong)";
  const down = dir === "down";
  const line = down
    ? { width: 0, minHeight: 18, borderLeft: `1.5px ${dashed ? "dashed" : "solid"} ${color}` }
    : { height: 0, minWidth: 26, borderTop: `1.5px ${dashed ? "dashed" : "solid"} ${color}` };
  const head = {
    width: 5, height: 5, borderRight: `1.5px solid ${color}`, borderBottom: `1.5px solid ${color}`,
    transform: down ? "rotate(45deg)" : "rotate(-45deg)", flexShrink: 0,
    marginTop: down ? -3 : 0, marginLeft: down ? 0 : -3,
  };
  return html`
    <span aria-hidden="true" style=${{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      flexDirection: down ? "column" : "row", gap: mid || label ? 4 : 0,
    }}>
      <span style=${{ display: "inline-flex", alignItems: "center", flexDirection: down ? "column" : "row" }}>
        <span style=${line} />
        <span style=${head} />
      </span>
      ${mid ? mid : ""}
      ${label ? html`<span style=${{
        fontFamily: "var(--font-mono)", fontSize: 9, color:
          tone === "fail" ? "var(--obligation)" : "var(--fg-3)",
      }}>${label}</span>` : ""}
    </span>`;
}

// A row of nodes that a single parent fans out to — used for Preparation's four
// foundation outputs. Each child sits under its own short down-connector.
function WFanRow({ children }) {
  return html`
    <span style=${{
      display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10,
    }}>${children}</span>`;
}

// One numbered WORKFLOW SEGMENT (agentic-workflow-059; diagram filled by aw-060): a
// labelled section that frames the segment's title + ordinal, hosts the hand-authored
// flow DIAGRAM (passed as `diagram`, with a faithful `diagramLabel` describing the real
// flow), and renders the supporting caption beneath. Presentation only — the honest,
// skill-accurate copy lives inline in WorkflowPage's children, so the verifier can
// check the prose there. Composed from styleguide tokens consumed UNFORKED (ADR-0003);
// honors light/dark by token.
//
// `gate` is the segment's explicit human-in-the-loop marker (ADR-0017 / vision
// non-goal 3: the human stays in the loop at every gate). The diagram is a static
// HTML+CSS visual (aw-060) inside a `role="img"` frame — inert and read-only (no
// fetch, no write). Its `aria-label` summarizes the real flow (the visual is
// decorative-structural; the prose remains the captions beneath).
function WorkflowSegment({ ordinal, title, gate, diagram, diagramLabel, children }) {
  return html`
    <section aria-label=${`${title} segment`} style=${{
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <header style=${{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style=${{
          fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)",
          fontFeatureSettings: '"tnum"',
        }}>${String(ordinal).padStart(2, "0")}</span>
        <h2 style=${{
          margin: 0, fontFamily: "var(--font-ui)", fontSize: 17, fontWeight: 600,
          letterSpacing: "-0.01em", color: "var(--fg-1)",
        }}>${title}</h2>
      </header>
      <div
        role="img"
        aria-label=${diagramLabel}
        style=${{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: 132, padding: "24px 16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--hairline)",
          background: "var(--surface-1)",
          overflowX: "auto",
        }}>
        ${diagram}
      </div>
      <div style=${{ display: "flex", flexDirection: "column", gap: 10 }}>
        ${children}
      </div>
      <p style=${{
        margin: 0, fontFamily: "var(--font-ui)", fontSize: 12.5, lineHeight: 1.55,
        color: "var(--fg-3)",
        paddingLeft: 12, borderLeft: "2px solid var(--hairline-strong)",
      }}>
        <strong style=${{ color: "var(--fg-2)" }}>Gate.</strong> ${gate}
      </p>
    </section>`;
}

// A caption paragraph inside a segment — the supporting prose beneath the (later)
// diagram. Token-styled, unforked (ADR-0003), comfortable reading measure.
function WorkflowCaption({ children }) {
  return html`
    <p style=${{
      margin: 0, fontFamily: "var(--font-ui)", fontSize: 13.5, lineHeight: 1.65,
      color: "var(--fg-2)",
    }}>${children}</p>`;
}

// A monospace inline token for naming a skill / verb / artifact in the captions
// (e.g. `brainstorm`, `verifier`, vision.md). Keeps the named things visually
// distinct from prose without forking the styleguide — just the --font-mono token.
function Wcode({ children }) {
  return html`<code style=${{
    fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-1)",
  }}>${children}</code>`;
}

// ── The three hand-authored segment diagrams (agentic-workflow-060) ─────────
// Each takes the HONEST shape of its real flow — the three topologies differ on
// purpose (not a uniform left-to-right lane). Built from WNode / WCheckpoint /
// WArrow / WFanRow above: skills + artifacts as nodes, gates as edge checkpoints.

// Segment 1 — PREPARATION: linear, then fan-out. brainstorm → (vision.md +
// context-map) → fan-out into the four foundation outputs. The whole segment
// carries the no-code human checkpoint (the builder reviews before anything is
// stood up).
function PreparationDiagram() {
  return html`
    <span style=${{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      fontFamily: "var(--font-ui)",
    }}>
      <${WNode} kind="skill" label="brainstorm" />
      <${WArrow} dir="down" mid=${html`<${WCheckpoint} label="no-code review" tone="human" />`} />
      <span style=${{ display: "flex", gap: 10 }}>
        <${WNode} kind="artifact" label="vision.md" />
        <${WNode} kind="artifact" label="context-map" />
      </span>
      <${WArrow} dir="down" label="fan-out" />
      <${WFanRow}>
        <${WNode} kind="artifact" label="infrastructure BC" />
        <${WNode} kind="artifact" label="foundation tasks" />
        <${WNode} kind="artifact" label="walking skeleton" />
        <${WNode} kind="skill" label="styleguide gate" />
      </${WFanRow}>
    </span>`;
}

// Segment 2 — CAPTURING: a backlog HUB with loops, not a line. Two intake doors
// (quick-capture + modeling CAPTURE) converge on the central backlog node; three
// operations loop back on it — modeling REFINE, research (carrying the review
// checkpoint), and modeling DISMISS. The human-in-the-loop checkpoint marks the
// refine / promote-readiness edge.
function CapturingDiagram() {
  return html`
    <span style=${{
      display: "flex", alignItems: "center", gap: 14, fontFamily: "var(--font-ui)",
    }}>
      <span style=${{ display: "flex", flexDirection: "column", gap: 8 }}>
        <${WNode} kind="skill" label="quick-capture" />
        <${WNode} kind="skill" label="modeling" verb="CAPTURE" />
      </span>
      <${WArrow} dir="right" label="intake" />
      <${WNode} kind="artifact" label="backlog" />
      <span style=${{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style=${{ display: "flex", alignItems: "center", gap: 6 }}>
          <${WArrow} dir="right" dashed=${true} mid=${html`<${WCheckpoint} label="human review" tone="human" />`} />
          <${WNode} kind="skill" label="modeling" verb="REFINE" />
        </span>
        <span style=${{ display: "flex", alignItems: "center", gap: 6 }}>
          <${WArrow} dir="right" dashed=${true} mid=${html`<${WCheckpoint} label="reviewer" tone="guard" />`} />
          <${WNode} kind="skill" label="research" />
        </span>
        <span style=${{ display: "flex", alignItems: "center", gap: 6 }}>
          <${WArrow} dir="right" dashed=${true} label="loop" />
          <${WNode} kind="skill" label="modeling" verb="DISMISS" />
        </span>
      </span>
    </span>`;
}

// Segment 3 — PROMOTE & WORK: a pipeline with a retry loop, opening with the
// PLANNING moment. whats-next (advisory only — it recommends, never moves a
// task) sits before modeling PROMOTE, at the where-do-I-pick-up decision point
// (agentic-workflow-q3n7k). Then modeling PROMOTE (backlog → todo) → work
// (parallel TDD workers) → verifier checkpoint on the edge → commit. The
// checkpoint shows the FAIL → re-dispatch (×2) → escalate loop back to work;
// the user-reviews-before-work checkpoint sits on the entry edge.
function PromoteWorkDiagram() {
  return html`
    <span style=${{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      fontFamily: "var(--font-ui)",
    }}>
      <${WNode} kind="skill" label="whats-next" verb="advisory" />
      <${WArrow} dir="down" label="recommends" />
      <span style=${{ display: "flex", alignItems: "center", gap: 8 }}>
        <${WNode} kind="skill" label="modeling" verb="PROMOTE" />
        <${WArrow} dir="right" label="backlog → todo" />
        <${WNode} kind="artifact" label="todo" />
      </span>
      <${WArrow} dir="down" mid=${html`<${WCheckpoint} label="user reviews todo" tone="human" />`} />
      <${WNode} kind="skill" label="work" verb="parallel TDD" />
      <span style=${{ display: "flex", alignItems: "center", gap: 8 }}>
        <${WArrow} dir="down" mid=${html`<${WCheckpoint} label="verifier" tone="guard" />`} />
        <span style=${{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--obligation)",
        }}>
          <${WArrow} dir="down" tone="fail" dashed=${true} />
          <span>FAIL → re-dispatch ×2 → escalate</span>
        </span>
      </span>
      <${WNode} kind="artifact" label="commit" verb="one task = one commit" />
    </span>`;
}

// The built-in WORKFLOW guide page (agentic-workflow-058 routing scaffold; real
// three-segment layout + caption copy added by agentic-workflow-059; diagrams by
// aw-060; whats-next + inquire added by agentic-workflow-q3n7k). Governed by
// ADR-0025.
//
// It explains Agentheim's workflow as THREE named segments, in order — Preparation,
// Capturing, Promote & Work — each a labelled section carried by a hand-authored
// HTML+CSS flow diagram (aw-060: PreparationDiagram / CapturingDiagram /
// PromoteWorkDiagram, honest per-segment topology) above HONEST, skill-accurate
// caption copy: it names the real skills/verbs (brainstorm, quick-capture, modeling,
// research, work) and the real adversarial gates (verifier, research-reviewer), shows
// quick-capture AND modeling as two distinct intake doors, includes DISMISS, and
// marks the human-in-the-loop gates (no-code brainstorm, user review before work,
// escalation to the builder after repeated verification failure). Promote & Work
// opens with `whats-next` (advisory-only, agentic-workflow-q3n7k) at the planning
// moment, before modeling PROMOTE. A fourth, un-numbered "Any time" note below the
// three segments names `inquire` — a read-only lens that sits outside the flow and
// is usable at any point, never appended into a segment's skill list.
//
// It is a STATIC page built into the bundle: NOT an open-intent (no lifecycle
// `status`, no on-disk `path`), so it never enters isTaskIntent (ADR-0021,
// byte-unchanged) and never fetches /api/doc. It is read-only over .agentheim/
// (ADR-0017) and composed from styleguide tokens consumed UNFORKED (ADR-0003) — no
// styleguide edit, no new bundled dependency. It keeps the main-pane reader's
// centered reading measure (maxWidth 760, margin "0 auto" — aw-040). The shell
// selects it via the dedicated onSelectWorkflow handler (NOT the rail's onOpen
// machinery) and renders it per the workflow → about → document → board precedence.
function WorkflowPage() {
  return html`
    <section aria-label="Workflow guide" style=${{
      display: "flex", flexDirection: "column", gap: 36,
      maxWidth: 760, margin: "0 auto", padding: "0 4px",
    }}>
      <header style=${{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 style=${{
          margin: 0, fontFamily: "var(--font-ui)", fontSize: 22, fontWeight: 600,
          letterSpacing: "-0.01em", color: "var(--fg-1)",
        }}>Workflow</h1>
        <p style=${{
          margin: 0, fontFamily: "var(--font-ui)", fontSize: 13.5, lineHeight: 1.65,
          color: "var(--fg-3)",
        }}>
          Agentheim turns a raw idea into a vision, a vision into a modeled backlog of
          bounded contexts, and a backlog into parallel, dependency-aware execution. The
          workflow has three segments — and the human stays in the loop at every gate.
        </p>
      </header>

      <${WorkflowSegment}
        ordinal=${1}
        title="Preparation"
        diagram=${html`<${PreparationDiagram} />`}
        diagramLabel="Preparation flow: the brainstorm skill — past a no-code human review checkpoint — produces the vision.md and context-map artifacts, which fan out into four foundation outputs: the infrastructure bounded context, the foundation decision tasks, the walking-skeleton spike, and the styleguide gate."
        gate=${html`No code is written in Preparation. The whole segment is a no-code Socratic dialogue with the builder, who reviews the vision and the bounded contexts before anything is stood up.`}>
        <${WorkflowCaption}>
          <${Wcode}>brainstorm</${Wcode}> is a no-code Socratic dialogue — six conversational
          modes pressing on the idea until it holds — that produces <${Wcode}>vision.md</${Wcode}>
          and <${Wcode}>context-map.md</${Wcode}>.
        </${WorkflowCaption}>
        <${WorkflowCaption}>
          A foundation pass then stands up the <strong>infrastructure</strong> bounded
          context, the <strong>foundation decision tasks</strong>, and a
          <strong>walking-skeleton spike</strong> — plus, if the vision implies a frontend,
          the <strong>design-system styleguide gate</strong>.
        </${WorkflowCaption}>
      </${WorkflowSegment}>

      <${WorkflowSegment}
        ordinal=${2}
        title="Capturing"
        diagram=${html`<${CapturingDiagram} />`}
        diagramLabel="Capturing flow: two intake doors — the quick-capture skill and the modeling CAPTURE skill — converge on a central backlog hub. Three operations loop back on the backlog: modeling REFINE past a human-review checkpoint, research past a reviewer checkpoint, and modeling DISMISS."
        gate=${html`Refinement is human-in-the-loop. The builder drives the Socratic dialogue; nothing is promoted to <${Wcode}>todo</${Wcode}> from here, and research is not citable until the <${Wcode}>research-reviewer</${Wcode}> passes it.`}>
        <${WorkflowCaption}>
          Two distinct intake doors land tasks in <${Wcode}>backlog/</${Wcode}>:
          <${Wcode}>quick-capture</${Wcode}> (fast, no questions, raw) and
          <${Wcode}>modeling</${Wcode}> CAPTURE (a Socratic dialogue that corners ambiguity
          as it captures).
        </${WorkflowCaption}>
        <${WorkflowCaption}>
          <${Wcode}>modeling</${Wcode}> REFINE deepens an existing task; <${Wcode}>research</${Wcode}>
          feeds external knowledge mid-model and is gated by the <${Wcode}>research-reviewer</${Wcode}>
          (a fresh-context skeptic) before it can be cited.
        </${WorkflowCaption}>
        <${WorkflowCaption}>
          <${Wcode}>modeling</${Wcode}> DISMISS cascade-deletes an abandoned task and its
          dependent subtree under a single re-confirmation, so the backlog never silently
          rots.
        </${WorkflowCaption}>
      </${WorkflowSegment}>

      <${WorkflowSegment}
        ordinal=${3}
        title="Promote & Work"
        diagram=${html`<${PromoteWorkDiagram} />`}
        diagramLabel="Promote and Work flow: the whats-next skill recommends the next sensible task, advisory only; then modeling PROMOTE moves a task from backlog to todo; past a user-reviews-todo checkpoint the work skill runs parallel TDD workers; a verifier checkpoint on the edge guards the commit, with a FAIL re-dispatch loop (up to twice, then escalate) back to work. Every passing task becomes exactly one commit."
        gate=${html`The builder reviews the <${Wcode}>todo</${Wcode}> tasks before <${Wcode}>work</${Wcode}> runs; the <${Wcode}>verifier</${Wcode}> guards every commit; a verification that keeps failing escalates to the builder rather than committing plausible-but-wrong work.`}>
        <${WorkflowCaption}>
          <${Wcode}>whats-next</${Wcode}> opens this segment at the planning moment: it reads
          the boards, the vision, and the recent protocol, then recommends the single next
          sensible move — advisory only, it never moves a task itself.
        </${WorkflowCaption}>
        <${WorkflowCaption}>
          <${Wcode}>modeling</${Wcode}> PROMOTE runs a readiness check and moves a task
          <${Wcode}>backlog → todo</${Wcode}>. <${Wcode}>work</${Wcode}> then resolves the
          dependency DAG and dispatches <strong>parallel TDD workers</strong> — independent
          work runs at once, without two workers colliding on the same file.
        </${WorkflowCaption}>
        <${WorkflowCaption}>
          Each worker's SUCCESS passes a fresh-context <${Wcode}>verifier</${Wcode}> gate
          before anything is committed. A FAIL re-dispatches the task (up to twice); if it
          still fails, it escalates to the builder. Every passing task becomes exactly one
          commit — <strong>one task = one commit</strong>.
        </${WorkflowCaption}>
      </${WorkflowSegment}>

      <section aria-label="Available any time" style=${{
        display: "flex", flexDirection: "column", gap: 10,
        paddingTop: 20, borderTop: "1px solid var(--hairline)",
      }}>
        <h2 style=${{
          margin: 0, fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600,
          letterSpacing: "-0.01em", color: "var(--fg-2)",
        }}>Any time</h2>
        <p style=${{
          margin: 0, fontFamily: "var(--font-ui)", fontSize: 13.5, lineHeight: 1.65,
          color: "var(--fg-3)",
        }}>
          <${Wcode}>inquire</${Wcode}> sits outside these three segments — a read-only,
          code-grounded lens over the project, usable at any point in the workflow. Ask it
          how something works or what was decided and it answers from the project's own
          memory (index, READMEs, ADRs, boards), verified against the source; it never
          edits code, moves a task, or commits.
        </p>
      </section>
    </section>`;
}

// A token-styled external-link CHIP (agentic-workflow-062; About-page visual polish).
// Every off-app destination on the About page (contact links, the GitHub link) opens in
// a NEW TAB with a safe `rel="noopener noreferrer"` — never in-app navigation (ADR-0021's
// routing is for on-disk docs/tasks only; the About page is static chrome). It is a
// bordered pill drawn entirely from neutral surface / hairline / fg tokens — consumed
// UNFORKED (ADR-0003), no ochre (ADR-0016) — that lifts on hover (border + fg darken, a
// 1px rise, shadow-sm). It carries the styleguide's existing "leaves the app" icon.
function AboutLink({ href, label, icon = "square-arrow-out-up-right" }) {
  const [hover, setHover] = useState(false);
  return html`
    <a
      className="focusable"
      href=${href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter=${() => setHover(true)}
      onMouseLeave=${() => setHover(false)}
      style=${{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "9px 13px", borderRadius: "var(--radius-md)",
        border: "1px solid",
        borderColor: hover ? "var(--hairline-strong)" : "var(--hairline)",
        background: "var(--surface-0)",
        fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500,
        color: hover ? "var(--fg-1)" : "var(--fg-2)", textDecoration: "none",
        transform: hover ? "translateY(-1px)" : "none",
        boxShadow: hover ? "var(--shadow-sm)" : "none",
        transition: "color var(--duration-fast) var(--ease-base), border-color var(--duration-fast) var(--ease-base), transform var(--duration-fast) var(--ease-base), box-shadow var(--duration-fast) var(--ease-base)",
      }}>
      <${Icon} name=${icon} size=${13.5} color=${hover ? "var(--fg-2)" : "var(--fg-3)"} />
      <span>${label}</span>
    </a>`;
}

// The board-local Ko-fi "buy me a coffee" gradient button (agentic-workflow-062).
// The styleguide has NO gradient-button primitive, so — following the StoppedOverlay
// / board-control precedent (ADR-0003) — this is a board-local, token-matched control
// composed BESIDE the styleguide, never a styleguide fork. WhisperHeim's Ko-fi button
// uses a blue gradient (#25abfe → #005FAA); here it is adapted to the Agentheim palette
// as a flat, opaque fill drawn from the styleguide's own status-accent token
// (--st-doing), so it tracks the active light/dark theme. It is an external
// link (an <a>, not a write) that opens Ko-fi in a new tab with a safe rel.
function KofiButton() {
  const [hover, setHover] = useState(false);
  return html`
    <a
      className="focusable"
      href="https://ko-fi.com/heimeshoff"
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter=${() => setHover(true)}
      onMouseLeave=${() => setHover(false)}
      style=${{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "11px 22px", borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-ui)", fontSize: 14.5, fontWeight: 600,
        color: "var(--surface-0)", textDecoration: "none",
        background: "var(--st-doing)",
        opacity: hover ? 0.88 : 1,
        boxShadow: hover ? "var(--shadow-md)" : "none",
        transition: "opacity var(--duration-fast) var(--ease-base), box-shadow var(--duration-fast) var(--ease-base)",
      }}>
      <${Icon} name="box" size=${15} color="var(--surface-0)" />
      <span>Buy me a coffee on Ko-fi</span>
    </a>`;
}

// A token-styled About card surface (agentic-workflow-062; About-page visual polish).
// Cards share the styleguide's surface + hairline tokens — consumed UNFORKED (ADR-0003),
// honoring light/dark by construction — now with the REAL --radius-md (the original
// --radius-lg is undefined in the token set, so the corners rendered square) and a quiet
// shadow-sm lift. Each card carries the shared `about-rise` entrance reveal (defined in
// AboutPage's board-local <style>) and accepts a `style` override so the page can stagger
// each card's animation-delay; the reveal is stripped under prefers-reduced-motion.
function AboutCard({ children, style }) {
  return html`
    <div className="about-rise" style=${{
      background: "var(--surface-1)", border: "1px solid var(--hairline)",
      borderRadius: "var(--radius-md)", padding: 32,
      boxShadow: "var(--shadow-sm)",
      animation: "aboutRise 0.5s var(--ease-base) both",
      ...style,
    }}>${children}</div>`;
}

// The built-in About page (agentic-workflow-062, the second built-in static page
// ADR-0025 anticipated; About-page visual polish). It gives Agentheim a face — who built
// it and how to support it. Layout: a masthead (eyebrow + title + subtitle over a hairline
// rule), a profile card (an identity row of framed photo + name + role; a full-width bio
// with a pull-quote callout; a divider; a wrap of "Get in touch" link chips), and a
// support card (the board-local Ko-fi gradient button between a pitch and a thank-you,
// plus the GitHub chip).
//
// It is a built-in STATIC view, NOT an open-intent: it carries no lifecycle `status`
// and no on-disk `path`, so it never enters isTaskIntent (ADR-0021, byte-unchanged)
// and never fetches /api/doc. It is read-only over .agentheim/ (ADR-0017) and composed
// from styleguide tokens consumed UNFORKED (ADR-0003) — no styleguide edit, no new
// bundled dependency, and deliberately NO ochre (the reserved selection accent, ADR-0016)
// and no content-type / status hues repurposed as decoration: the page draws only on the
// neutral surface / fg / hairline / shadow / radius / type tokens, leaving the Ko-fi
// gradient (itself built from status tokens) as the single splash of color. The page's
// one motion is a gentle staggered entrance reveal, defined in a board-local <style>
// (ADR-0020: "board-local" is ownership, not footprint) and stripped under
// prefers-reduced-motion. The shell selects it via the dedicated onSelectAbout handler
// (NOT the rail's onOpen machinery) and renders it per the workflow → about → document
// → board precedence. The profile photo is a committed served asset (/heimeshoff.jpg),
// referenced by URL, never a filesystem path.
function AboutPage() {
  // Eyebrow label — the styleguide .t-label role rendered in the MONO face (the
  // ledger system's display/meta voice) so it rhymes with the mono wordmark below.
  const eyebrow = (text) => html`
    <span style=${{
      fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 500,
      letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
    }}>${text}</span>`;

  return html`
    <section aria-label="About Agentheim" style=${{
      display: "flex", flexDirection: "column", gap: 32,
      maxWidth: 720, margin: "0 auto", padding: "12px 4px 24px",
    }}>
      <!-- Board-local entrance motion. A single gentle rise, staggered per surface,
           stripped entirely under prefers-reduced-motion (the quiet-by-default law). -->
      <style>${`
        @keyframes aboutRise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .about-rise { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      <!-- Masthead — the wordmark is set in the mono display face (the ledger
           system's --t-display voice), giving the page a quiet "built for Claude
           Code" terminal character without reaching for a non-system font. -->
      <header className="about-rise" style=${{
        display: "flex", flexDirection: "column", gap: 12,
        animation: "aboutRise 0.5s var(--ease-base) both",
      }}>
        ${eyebrow("About")}
        <h1 style=${{
          margin: 0, fontFamily: "var(--font-mono)", fontSize: 46, fontWeight: 500,
          letterSpacing: "-0.03em", lineHeight: 1.0, color: "var(--fg-1)",
        }}>Agentheim</h1>
        <p style=${{
          margin: "2px 0 0", maxWidth: 540, fontFamily: "var(--font-ui)", fontSize: 15.5,
          lineHeight: 1.65, color: "var(--fg-3)",
        }}>
          A domain-driven agentic harness for Claude Code — and the person who built it.
        </p>
        <div style=${{
          marginTop: 10, height: 1,
          background: "linear-gradient(90deg, var(--hairline-strong) 0%, var(--hairline) 42%, transparent 100%)",
        }} />
      </header>

      <!-- Card 1: Profile & contact -->
      <${AboutCard} style=${{ animationDelay: "80ms" }}>
        <!-- Identity row: framed photo + name + role -->
        <div style=${{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
          <img
            src="/heimeshoff.jpg"
            alt="Marco Heimeshoff"
            width=${104} height=${104}
            style=${{
              width: 104, height: 104, borderRadius: "50%", objectFit: "cover",
              flexShrink: 0, border: "1px solid var(--hairline-strong)",
              boxShadow: "0 0 0 4px var(--surface-0), var(--shadow-md)",
            }} />
          <div style=${{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
            <h2 style=${{
              margin: 0, fontFamily: "var(--font-ui)", fontSize: 23, fontWeight: 600,
              letterSpacing: "-0.015em", color: "var(--fg-1)",
            }}>Marco Heimeshoff</h2>
            <p style=${{
              margin: 0, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 400,
              letterSpacing: "0.01em", color: "var(--fg-3)",
            }}>Trainer · Consultant · Conference organiser</p>
          </div>
        </div>

        <!-- Bio. NOTE: htm strips whitespace where a newline separates a text run
             from an inline <strong>/<em>, so every such seam carries an explicit
             ${" "} — otherwise "focused on" + "Domain-Driven Design" render glued. -->
        <div style=${{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
          <p style=${{
            margin: 0, fontFamily: "var(--font-ui)", fontSize: 15.5, lineHeight: 1.7, color: "var(--fg-2)",
          }}>
            Hi, I'm Marco — focused on${" "}
            <strong style=${{ color: "var(--fg-1)", fontWeight: 600 }}>Domain-Driven Design</strong>${" "}
            and <strong style=${{ color: "var(--fg-1)", fontWeight: 600 }}>collaborative modeling</strong>.
          </p>
          <blockquote style=${{
            margin: 0, paddingLeft: 18, borderLeft: "2px solid var(--hairline-strong)",
            fontFamily: "var(--font-ui)", fontSize: 15, fontStyle: "italic",
            lineHeight: 1.65, color: "var(--fg-2)",
          }}>
            DDD is all about creating a <em>ubiquitous language</em> within${" "}
            <em>bounded contexts</em> — and Agentheim brings that same discipline to
            building software with Claude Code, so the model corners ambiguity instead
            of producing plausible-looking mush.
          </blockquote>
          <p style=${{
            margin: 0, fontFamily: "var(--font-ui)", fontSize: 13.5, lineHeight: 1.65, color: "var(--fg-3)",
          }}>
            When I'm not helping teams design meaningful software, I enjoy building
            open-source tools like this one to make life a little smoother.
          </p>
        </div>

        <div style=${{ height: 1, background: "var(--hairline)", margin: "24px 0" }} />

        <!-- Get in touch -->
        <div style=${{ display: "flex", flexDirection: "column", gap: 12 }}>
          ${eyebrow("Get in touch")}
          <div style=${{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <${AboutLink} href="https://heimeshoff.de" label="heimeshoff.de" />
            <${AboutLink} href="https://bsky.app/profile/heimeshoff.de" label="Bluesky · @Heimeshoff.de" />
            <${AboutLink} href="https://linkedin.com/in/heimeshoff" label="linkedin.com/in/heimeshoff" />
          </div>
        </div>
      </${AboutCard}>

      <!-- Card 2: Support & GitHub -->
      <${AboutCard} style=${{ animationDelay: "160ms" }}>
        <div style=${{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
          ${eyebrow("Support")}
          <h2 style=${{
            margin: 0, fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)",
          }}>Enjoying Agentheim?</h2>
          <p style=${{
            margin: 0, fontFamily: "var(--font-ui)", fontSize: 14, lineHeight: 1.6, color: "var(--fg-3)", maxWidth: 440,
          }}>
            If it's making your work with Claude Code a little smoother and you'd like to
            support my open-source work, you can buy me a coffee.
          </p>
          <${KofiButton} />
          <p style=${{
            margin: 0, fontFamily: "var(--font-ui)", fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-3)", maxWidth: 440,
          }}>
            Otherwise, just${" "}
            <strong style=${{ color: "var(--fg-2)", fontWeight: 600 }}>enjoy using Agentheim for free</strong>${" "}
            — and thanks for giving it a try!
          </p>
          <div style=${{ marginTop: 4 }}>
            <${AboutLink} href="https://github.com/heimeshoff/Agentheim" label="View on GitHub" />
          </div>
        </div>
      </${AboutCard}>
    </section>`;
}

// The full-height LEFT RAIL (agentic-workflow-026). It replaces aw-008's horizontal
// top header with the styleguide §05 "Components in context" layout: a vertical,
// full-height nav composed from styleguide PRIMITIVES (Glyph / RailItem / TreeGroup
// / TreeItem) — consumed UNFORKED (ADR-0003), NOT the styleguide AppRail (which is
// hardwired to the demo LIBRARY constant). Top-to-bottom:
//   brand (Glyph + "Agentheim" + live projectName)
//   → a single Board RailItem (the only nav item — the always-visible tree below IS
//     the library, so there is NO separate Library RailItem; ADR-0011)
//   → divider → "Workspace" label
//   → the LIVE library tree, fed by treeToLibrary(/api/tree) (never the demo data)
//   → a footer holding the theme toggle + the skip-permissions armed toggle
//     (relocated out of the retired horizontal header; the footer gives the
//     skip-permissions danger treatment a stable home, ADR-0019).
//
// The rail is a discovery surface, so it stays LIVE the same way the board does: it
// fetches /api/tree on mount and re-fetches on every SSE tree-changed frame /
// reconnect (useLiveTree), re-projecting via treeToLibrary. Read-only throughout
// (ADR-0017): clicking a non-task row emits the open-intent the shell routes — a
// non-task document now opens in the MAIN PANE (aw-027), so the rail's selected
// edge follows the selected DOCUMENT (`selectedId`, fed from selectedDoc), and the
// Board RailItem returns the main pane to the board (onSelectBoard) and is `active`
// exactly when no document is selected.
function ShellRail({ projectName, selectedId, onOpen, onSelectBoard, mainView, onSelectWorkflow, onSelectAbout }) {
  const [groups, setGroups] = useState([]);

  // --- "new item" attention cue state (agentic-workflow-n4h7q) -----------------
  // The rail blinks research reports / ADRs that are NEW or UPDATED during the
  // current page session, until clicked or reloaded. The detection/clearing brain
  // is the pure rail-attention.js; here we hold the in-memory, presentation-only
  // session state (ADR-0017 — no /api write, no localStorage, no disk):
  //   - baselineRef — the railMtimeIndex captured ONCE on the first projection. A
  //     page reload remounts the rail and re-captures it, so nothing is "new" on a
  //     fresh page (acknowledgement-by-reload). null until the first load lands.
  //   - currentIndex — the live railMtimeIndex, recomputed every re-projection.
  //   - cleared — path → mtime the user acknowledged by clicking. mtime-versioned
  //     so a still-newer edit of the same doc re-flags (rail-attention.flaggedPaths).
  const baselineRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState({});
  const [cleared, setCleared] = useState({});

  // Re-project the rail tree from /api/tree (the non-task half, treeToLibrary). A
  // failed fetch leaves the tree empty rather than crashing the rail — the board's
  // own error state already reports an unreachable server. On every (re)projection
  // we ALSO recompute the research/ADR mtime index (aw-t3b9k) and, on the FIRST
  // landed projection, freeze it as the session baseline — so the very docs present
  // at load never blink, only ones that arrive/change afterwards do.
  const loadTree = useCallback(() => {
    let alive = true;
    fetch("/api/tree")
      .then((r) => (r.ok ? r.json() : null))
      .then((tree) => {
        if (!alive) return;
        setGroups(tree ? treeToLibrary(tree) : []);
        const index = tree ? railMtimeIndex(tree) : {};
        // Capture the baseline exactly once, off the first projection that lands
        // (even an empty one — a fresh page has no "new" artifacts by definition).
        if (baselineRef.current === null) baselineRef.current = index;
        setCurrentIndex(index);
      })
      .catch(() => {
        if (!alive) return;
        setGroups([]);
        if (baselineRef.current === null) baselineRef.current = {};
        setCurrentIndex({});
      });
    return () => { alive = false; };
  }, []);
  useEffect(() => loadTree(), [loadTree]);
  useLiveTree(loadTree);

  // The flagged set is always the intersection of "created-or-modified vs baseline,
  // not cleared at this mtime" with "present in the current projection" (so a
  // vanished flagged doc drops out cleanly — no orphaned blink), with NO cap.
  const flagged = flaggedPaths({ index: currentIndex, baseline: baselineRef.current || {}, cleared });
  // Thread the cue onto each research/ADR leaf and DERIVE each group header's cue
  // from its leaves (so an arrival under the collapsed Decisions group still shows).
  const cuedGroups = annotateGroups(groups, flagged);

  // Clicking a flagged entry clears ONLY that entry, recording the mtime it was
  // cleared at (mtime-versioned: a later edit re-flags). It opens in the main pane
  // anyway (ADR-0021), so this wraps the shell's open-intent — no new open path.
  const openAndClear = useCallback((item) => {
    if (item && item.path) {
      const at = currentIndex[item.path];
      setCleared((prev) => ({ ...prev, [item.path]: at === undefined ? null : at }));
    }
    if (onOpen) onOpen(item);
  }, [onOpen, currentIndex]);

  return html`
    <nav style=${{
      width: 248, flexShrink: 0, alignSelf: "stretch", boxSizing: "border-box",
      background: "var(--surface-0)", borderRight: "1px solid var(--hairline)",
      display: "flex", flexDirection: "column",
    }}>
      <!-- Brand -->
      <div style=${{ display: "flex", alignItems: "center", gap: 9, padding: "16px 16px 14px" }}>
        <${Glyph} size=${22} />
        <span style=${{
          display: "flex", alignItems: "baseline", gap: 7, minWidth: 0,
          fontFamily: "var(--font-ui)", letterSpacing: "-0.01em",
        }}>
          <span style=${{ fontSize: 15, fontWeight: 600, color: "var(--fg-1)" }}>Agentheim</span>
          ${projectName ? html`
            <span aria-hidden="true" style=${{ color: "var(--fg-4)", fontSize: 13 }}>·</span>
            <span style=${{
              fontSize: 13.5, fontWeight: 500, color: "var(--fg-3)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>${projectName}</span>` : null}
        </span>
      </div>

      <!-- Primary nav: the Board item and, directly below it, the built-in Workflow
           guide item (aw-058) and the built-in About item (aw-062) — both governed by
           ADR-0025. The tree below IS the library, so there is still no separate Library
           item. Board is active ONLY when the main pane shows the board itself
           (mainView === "board") and no document is selected — so it never highlights
           alongside the Workflow OR the About page. Workflow / About are each active when
           their third-main-pane-state value is on. All are mutually exclusive by
           construction (each onSelect* handler clears the others; every board/doc handler
           resets mainView to "board"), so at most one rail row highlights at once. -->
      <div style=${{ padding: "4px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        <${RailItem} icon="square-kanban" label="Board"
          active=${mainView === "board" && !selectedId}
          onClick=${() => onSelectBoard && onSelectBoard()} />
        <${RailItem} icon="compass" label="Workflow"
          active=${mainView === "workflow"}
          onClick=${() => onSelectWorkflow && onSelectWorkflow()} />
        <${RailItem} icon="bot" label="About"
          active=${mainView === "about"}
          onClick=${() => onSelectAbout && onSelectAbout()} />
      </div>

      <div style=${{ height: 1, background: "var(--hairline)", margin: "12px 16px" }} />

      <!-- Live file tree (the library) -->
      <div className="scroll-quiet" style=${{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
        <div style=${{
          padding: "0 8px 8px", fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600,
          letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fg-3)",
        }}>Workspace</div>
        ${/* aw-n4h7q: the rail no longer renders the styleguide TreeGroup convenience
              (which has no attention seam); it composes the SAME two styleguide
              primitives TreeGroup composes — Collapsible (group header) + TreeItem
              (rows) — directly, consumed UNFORKED (ADR-0003), so it can thread the
              design-system-v8k2p `attention` flag the cue needs. Group header cue is
              DERIVED (g.attention) — visible even while Decisions is collapsed; each
              flagged research/ADR leaf carries its own `attention`. Body spacing
              (gap 1 / paddingLeft 8) and the Decisions-collapsed-by-default (aw-066)
              are preserved byte-for-byte. */ ""}
        ${cuedGroups.map((g) => html`
          <${Collapsible} key=${g.group} label=${g.group} count=${g.items.length}
            defaultOpen=${g.group !== "Decisions"} attention=${g.attention}
            bodyStyle=${{ gap: 1, paddingLeft: 8 }}>
            ${g.items.map((it) => html`
              <${TreeItem} key=${it.id} item=${it} selected=${selectedId === it.id}
                onOpen=${openAndClear} attention=${it.attention} />`)}
          </${Collapsible}>`)}
      </div>
    </nav>`;
}

// The post-stop "Dashboard stopped" overlay (agentic-workflow-028). A board-local,
// token-matched full-pane cover over the MAIN CONTENT AREA (absolutely filling the
// relatively-positioned content wrapper) — NOT a styleguide primitive: there is no
// full-screen modal in the styleguide and the Drawer is a side panel, so this is
// composed from existing tokens (ADR-0003, consumed unforked). It is the honest end
// state: the page is now talking to a server that is shutting down, so the board below
// is covered and the only message is that it is safe to close the tab. Rendered ONLY on
// a bridge dispatch (the clipboard fallback stopped nothing and never mounts this).
function StoppedOverlay() {
  return html`
    <div
      role="status"
      aria-live="polite"
      style=${{
        position: "absolute", inset: 0, zIndex: 5,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 14, padding: 32, textAlign: "center",
        background: "var(--surface-0)",
      }}>
      <${Icon} name="x" size=${30} color="var(--fg-3)" />
      <div style=${{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, color: "var(--fg-1)" }}>
        Dashboard stopped — safe to close this tab
      </div>
      <div style=${{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--fg-3)", maxWidth: 360, lineHeight: 1.5 }}>
        The dashboard server is shutting down. Reopen it any time with
        <span style=${{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}> /dashboard</span> from a session.
      </div>
    </div>`;
}

// The topbar SETTINGS MENU (agentic-workflow-049, retired into the shared
// Menu/Popover primitive by design-system-015). Collapses the three utility
// controls — Stop dashboard (aw-028), the theme toggle (aw-017) and the
// skip-permissions armed toggle (aw-021) — behind a single settings GEAR. Only the
// Work launch stays a standing topbar button; the gear sits immediately to its left.
//
// PRIMITIVE (ds-015): the board no longer carries its own popover machinery. The
// anchored floating panel at --shadow-md, dismissal on Esc / outside-click, the
// reduced-motion-aware reveal, and the open/close truth all live in the shared
// styleguide `Menu` (consumed unforked across the BC boundary, ADR-0003). The board
// is now a pure CONSUMER: it owns the trigger's look (the neutral gear) and composes
// the menu items — the "styleguide owns the look/placement, consumer owns the
// behavior" seam (ds-005 Collapsible, ds-006 cornerAction). The aw-014 → ds-005
// sequencing, repeated: board-local control first, promoted to a shared primitive
// once a second consumer is worth unifying.
//
// The three relocated controls keep their behavior + persistence AS-IS: ThemeToggle
// still feeds theme-state.js, SkipPermissionsToggle still wears its --obligation
// armed/danger treatment + skip-permissions-state.js persistence, and Stop dashboard
// still runs STOP_DASHBOARD_COMMAND via launchOrCopy with its post-stop
// StoppedOverlay onResult.
//
// DECISION 3 (preserved) — the CLOSED gear carries NO armed cue: it stays neutral
// even when skip-permissions is armed. The --obligation danger hue lives ONLY on the
// skip-permissions toggle INSIDE the open menu (amended ADR-0019).
//
// DECISION 4 (preserved) — the theme + skip-permissions toggles KEEP the menu open
// (an in-panel click is scoped out by the primitive's root ref). The menu closes on:
// selecting Stop dashboard (the board drives the Menu CONTROLLED so it can close it
// programmatically after a successful stop), Esc, and an outside click.
//
// Keyboard: the gear is focusable (Enter/Space opens via native <button> activation),
// the menu items are themselves focusable controls, and Esc closes — all delivered by
// the shared primitive, which also honors prefers-reduced-motion on its reveal.
function SettingsMenu({ theme, setTheme, skipPermissions = false, setSkipPermissions, onStopped }) {
  // The board drives the Menu CONTROLLED (it owns the open truth) so it can close the
  // popover programmatically when Stop dashboard fires on the bridge. Esc / outside-
  // click dismissal still come from the primitive via onOpenChange.
  const [open, setOpen] = useState(false);

  // Selecting Stop dashboard closes the menu, THEN flips the shell-stopped overlay on a
  // bridge dispatch (a clipboard fallback stopped nothing → no overlay). Closing first
  // keeps the popover from lingering over the overlay that replaces the board.
  const onStopResult = useCallback((res) => {
    setOpen(false);
    if (res && res.via === "bridge" && typeof onStopped === "function") onStopped();
  }, [onStopped]);

  // The shared Menu panel has symmetric padding, but each MenuItem is a left-aligned
  // flex row that does NOT stretch in the panel's flex column, so a content-sized
  // control hugs the LEFT and the slack collects on the RIGHT (off-center, aw-055).
  // CENTER each item's content so the left/right whitespace reads equal. One shared
  // style applied to every MenuItem keeps the fix UNIFORM across all three controls
  // (theme / skip-permissions / Stop), and keeps the shared Menu/MenuItem primitive a
  // body-agnostic, left-aligning generic — centering is THIS consumer's choice
  // (ADR-0003, consumed unforked), not a styleguide default.
  const centeredItem = { justifyContent: "center" };

  return html`
    <${Menu}
      ariaLabel="Dashboard settings"
      open=${open}
      onOpenChange=${setOpen}
      trigger=${({ open: isOpen, toggle }) => html`
        <!-- The settings GEAR — the reused settings-2 glyph. Neutral at all times: the
             closed gear carries NO armed cue (decision 3). -->
        <button
          type="button"
          className="focusable"
          aria-label="Settings"
          aria-haspopup="menu"
          aria-expanded=${isOpen}
          title="Settings — theme, skip-permissions, stop dashboard"
          onClick=${toggle}
          style=${{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: isOpen ? "var(--fg-1)" : "var(--fg-2)",
            background: isOpen ? "var(--surface-2)" : "transparent",
            border: `1px solid ${isOpen ? "var(--hairline-strong)" : "var(--hairline)"}`,
            borderRadius: "var(--radius-sm)", padding: "5px 7px", cursor: "pointer",
            transition: "color var(--duration-fast) var(--ease-base), background var(--duration-fast) var(--ease-base), border-color var(--duration-fast) var(--ease-base)",
          }}>
          <${Icon} name="settings-2" size=${14.5} color=${isOpen ? "var(--fg-1)" : "var(--fg-2)"} />
        </button>`}>
      <!-- Theme (light/dark) — keeps the menu open (decision 4). -->
      <${MenuItem} style=${centeredItem}>
        <${ThemeToggle} value=${theme} onChange=${setTheme} options=${[
          { value: "dark", label: "Dark", icon: "moon" },
          { value: "light", label: "Light", icon: "sun" },
        ]} />
      </${MenuItem}>
      <!-- Skip-permissions armed toggle — keeps its --obligation armed/danger hue
           INSIDE the menu (decision 3); keeps the menu open (decision 4). -->
      <${MenuItem} style=${centeredItem}>
        <${SkipPermissionsToggle} armed=${skipPermissions} onToggle=${setSkipPermissions} />
      </${MenuItem}>
      <${MenuDivider} />
      <!-- Stop dashboard — selecting it CLOSES the menu (controlled), then shows the
           stopped overlay on a bridge dispatch. -->
      <${MenuItem} style=${centeredItem}>
        <${LaunchButton} label="Stop dashboard" command=${STOP_DASHBOARD_COMMAND}
          icon="x" emphasis="quiet" onResult=${onStopResult} />
      </${MenuItem}>
    </${Menu}>`;
}

// The main-column TOPBAR (agentic-workflow-026) — the styleguide §05 board topbar.
// The topbar GLOBAL SEARCH (agentic-workflow-052). Replaces the dead breadcrumb
// (aw-049's `Board` label + the mono project/tickets path line, which carried no function — the
// project name lives in the rail brand). It is the wiring half over two shipped
// dependencies: the content-search backend GET /api/search (aw-050 / ADR-0023) and
// the reviewed styleguide search-field + grouped-results combobox (design-system-016,
// SearchField), CONSUMED UNFORKED across the BC boundary (ADR-0003). This forks NO
// search chrome and does NO corpus walking/ranking/excerpting — both live in the
// dependencies. Its job is the wiring:
//
//   - SearchField is a CONTROLLED combobox: this owns the raw query `value` + the
//     `onChange` handler, and feeds `groups` + `onSelect`; ds-016 owns the input
//     chrome, the floating panel, the keyboard mechanics (active-descendant up/down +
//     Enter), and the no-results panel. ds-016's getTitle/getExcerpt DEFAULTS read
//     item.title/item.excerpt and markMatches marks the term against `value`, so NO
//     custom getters and NO board-side term-marking are written here.
//   - The query is DEBOUNCED ~200ms and GATED at min length 2 BEFORE the
//     /api/search fetch — the field still displays every typed char (the gate
//     suppresses the network call, not the input). An empty/whitespace query clears
//     the result groups and runs no fetch (ds-016's panelState "closed" — no panel).
//     A sub-min (1-char) query the backend never walks shows ds-016's honest "No
//     matches" line (REFINE 2026-06-16: ds-016 has no force-closed prop, so the
//     consumer accepts the styleguide no-results panel rather than forking it).
//   - The FLAT → GROUPED transform is the pure searchResultsToGroups (search-results.js):
//     aw-050 returns a flat ranked `results: [{ category, title, excerpt, path,
//     ...intent }]`; ds-016 wants `groups: [{ label, items }]` in fixed order
//     (Bounded contexts → Decisions → Research → Tickets), within-category order
//     preserved (so aw-050's title-hits-first ranking survives).
//   - SELECTION routing: ds-016's onSelect hands back the full aw-050 result row
//     (carrying `...intent`, ADR-0023), which is handed UP to the shell's open-intent
//     sink (onOpen) UNCHANGED. The shell already routes on the unchanged isTaskIntent
//     (ADR-0021): non-task docs → setSelectedDoc (main pane, aw-027); tickets → the
//     aw-039 full-screen path (setSelectedDoc + setOpenIntent(null)), NOT the
//     slide-over. Esc closes + clears (ds-016's close() fires onChange("")).
//
// READ-ONLY (ADR-0017): the search performs no write; /api/search is a pure read.
const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_MIN_LENGTH = 2;

function TopbarSearch({ onOpen }) {
  const [value, setValue] = useState("");
  const [groups, setGroups] = useState([]);
  // The debounce timer + an alive guard so a stale in-flight fetch never clobbers a
  // newer query's results (the field re-fires on every keystroke past the gate).
  const timer = useRef(null);
  const seq = useRef(0);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // onChange owns the controlled value + the debounce + the min-length-2 FETCH gate.
  // The field always displays the typed value; the gate only suppresses the network
  // call. An empty/whitespace query clears the groups and runs no fetch (panelState
  // "closed"); a 1-char query clears the groups too (ds-016 then shows "No matches"
  // for the non-empty value — accepted unforked, REFINE 2026-06-16).
  const onChange = useCallback((next) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    const trimmed = (next || "").trim();
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      // Below the gate (incl. empty/whitespace): clear results, run no fetch.
      setGroups([]);
      return;
    }
    const mySeq = ++seq.current;
    timer.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (mySeq !== seq.current) return; // a newer query superseded this one
          const results = data && Array.isArray(data.results) ? data.results : [];
          setGroups(searchResultsToGroups(results));
        })
        .catch(() => { if (mySeq === seq.current) setGroups([]); });
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  // ds-016 hands back the full aw-050 result row (carrying `...intent`); route it
  // through the shell's open-intent sink UNCHANGED, then close + clear the field.
  const onSelect = useCallback((item) => {
    if (typeof onOpen === "function") onOpen(item);
    if (timer.current) clearTimeout(timer.current);
    seq.current++;            // invalidate any in-flight fetch
    setValue("");
    setGroups([]);
  }, [onOpen]);

  return html`
    <${SearchField}
      value=${value}
      onChange=${onChange}
      groups=${groups}
      onSelect=${onSelect}
      placeholder="Search everything…"
      ariaLabel="Search the project"
      style=${{ flex: 1, maxWidth: 520 }} />`;
}

// A ~52px strip over the scrollable board carrying a board title / breadcrumb and a
// single primary action that FOLLOWS the active theme (aw-033 — the primary emphasis,
// light fill+dark text in light mode and dark fill+light text in dark mode; it earlier
// wore the §05 inverse/opposite-scheme treatment, which read as the wrong theme). That
// button IS the WORK launch (relocated here from the prompt bar, aw-024): a read-only launch of the
// bare /agentheim:work via launchOrCopy (WORK_COMMAND, ADR-0017/0018), threading
// skipPermissions (aw-021) and passing NO onResult (Work never consumed a prompt).
// NO Search box is rendered — the dashboard is read-only with no search backend.
//
// aw-049 COLLAPSED the three utility controls (Stop dashboard, theme, skip-permissions)
// behind a single settings GEAR (SettingsMenu) that sits immediately LEFT of the Work
// launch — the topbar read, left → right: [ breadcrumb ] … [ ⚙ ] [ Work ]. The
// three controls are no longer rendered inline; they live only inside the gear's
// dropdown. Work remains the sole STANDING action (the one primary worth permanent bar
// real estate). The toggles + Stop keep all their existing behavior + persistence —
// SettingsMenu just relocates them into a popover (relocation, not rewrite).
//
// aw-052 REPLACES the dead breadcrumb (`Board` label + the mono project/tickets path, which
// carried no function — the project name lives in the rail brand) with the topbar
// GLOBAL SEARCH (TopbarSearch over the ds-016 SearchField, ADR-0003). The topbar now
// reads, left → right: [ search field ] … [ ⚙ ] [ Work ]. The settings gear + Work
// launch are untouched. The shell threads its open-intent sink down as `onOpen` so a
// selected result routes through the unchanged isTaskIntent (ADR-0021).
function BoardTopbar({ theme, setTheme, skipPermissions = false, setSkipPermissions, onStopped, onOpen }) {
  return html`
    <div style=${{
      display: "flex", alignItems: "center", gap: 12,
      padding: "0 18px", minHeight: 52, flexShrink: 0,
      borderBottom: "1px solid var(--hairline)", background: "var(--surface-0)",
    }}>
      <${TopbarSearch} onOpen=${onOpen} />
      <!-- The settings gear (collapsing Stop / theme / skip-perms), then the standing
           "What's next" launch, then the standing Work launch — left to right:
           [ gear ] [ What's next ] [ Work ↗ ] (aw-049 + aw-064). The marginLeft:auto
           pushes this group FLUSH against the topbar's right edge (aw-053): the
           bounded search field stays left-anchored and all unconsumed free space
           collects here, ahead of the group — so the bar reads
           [ search field ] … [ gear ] [ What's next ] [ Work ↗ ] across any width,
           gracefully shrinking the search side first on narrow viewports. -->
      <div style=${{ display: "flex", alignItems: "center", gap: 9, marginLeft: "auto" }}>
        <${SettingsMenu}
          theme=${theme} setTheme=${setTheme}
          skipPermissions=${skipPermissions} setSkipPermissions=${setSkipPermissions}
          onStopped=${onStopped} />
        ${/* aw-064: the "What's next" standing launch — a bordered SECONDARY chip
              (default LaunchButton emphasis) sitting between the quiet gear and the
              primary Work. It fires the interim raw WHATS_NEXT_COMMAND prompt through
              the same launchOrCopy path (bridge → terminal; silent clipboard
              fallback, ADR-0018), threading the armed skipPermissions cue, passing NO
              onResult — a read-only next-steps overview, no lifecycle write
              (ADR-0017). The sun glyph is consumed unforked from the styleguide
              registry (ADR-0003). NO ochre (ADR-0016). */ ""}
        <${LaunchButton} label="What's next" command=${WHATS_NEXT_COMMAND}
          icon="sun" liftOnHover=${true} large=${true} skipPermissions=${skipPermissions} />
        ${/* aw-064: Work keeps its primary-surface fill (no ochre, ADR-0016 untouched
              — the aw-033 --surface-2 / --fg-1 / --hairline-strong chrome) and now
              reads "Work ↗": the glyph moves to the RIGHT of the label (trailingIcon)
              and becomes the up-right diagonal `square-arrow-out-up-right` (the glyph
              aw-062 used, present in the registry). Launch behaviour + theme-following
              are byte-unchanged apart from the glyph + its side. */ ""}
        <${LaunchButton} label="Work" command=${WORK_COMMAND}
          icon="square-arrow-out-up-right" emphasis="primary" trailingIcon=${true}
          liftOnHover=${true} large=${true} skipPermissions=${skipPermissions} />
      </div>
    </div>`;
}

/**
 * The dashboard application shell. Minimal and composable: it owns the theme + the
 * skip-permissions arm state, and lays out the styleguide §05 "Components in
 * context" chrome — a full-height left RAIL (ShellRail) beside a MAIN COLUMN (a
 * topbar over the scrollable board), all in one bordered, elevated frame (aw-026).
 *
 * The rail's always-visible Workspace tree IS the library (aw-008's full-pane
 * library surface + the board↔library toggle are retired). Both the rail's tree
 * rows and the board's cards emit the SAME open-intent shape; the shell ROUTES it
 * on artifact KIND (aw-027, pure intent-route.isTaskIntent):
 *   - a board TASK intent (carries a lifecycle `status`) opens in the right-hand
 *     SlideOver (aw-007) — a transient detail panel beside the board, unchanged;
 *   - a non-task DOCUMENT intent (a rail row — vision, context map, BC README,
 *     ADR, research) opens in the MAIN PANE (MainPaneReader), where there is room
 *     to read. Both render targets share ONE /api/doc fetch mechanism (docUrl).
 * The shell holds TWO selection states: `openIntent` (task → SlideOver; drives the
 * board card ring) and `selectedDoc` (non-task doc → main pane; drives the rail
 * row's selected edge). The main pane shows EITHER the selected document OR the
 * board (the default); the Board RailItem returns it to the board by clearing
 * `selectedDoc`, and is `active` exactly when `selectedDoc` is null. The dashboard
 * stays read-only (ADR-0017): opening a doc performs no write.
 */
export function DashboardApp() {
  // agentic-workflow-h9v3m: a ref onto the SOLE vertical scroll container (the
  // inner `scroll-quiet` region below, per the BC README's shell layout — the
  // outer shell frame is `overflow: hidden`, the window itself never
  // scrolls). Threaded down to DashboardBoard so its hover-scoped
  // IntersectionObserver can root itself there (ADR-0033 pt. 1) instead of
  // the browser viewport.
  const scrollContainerRef = useRef(null);

  // Theme is owned here and fed to the ThemeCtx.Provider + the data-theme effect.
  // First paint resolves from a persisted override (versioned localStorage) or,
  // on a first visit, the OS prefers-color-scheme — mirroring the styleguide's
  // "dark-first with a light toggle". The resolution is pure (theme-state.js) and
  // safe-degrades a malformed/stale/absent blob to the system default. The lazy
  // initializer keeps it a ONE-TIME read on mount, so an SSE re-projection of
  // /api/tree (a re-render of the surfaces below) never resets the chosen theme.
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return resolveTheme(window.localStorage, window.matchMedia);
  });
  // Reflect the theme onto the documentElement and animate the flip with the
  // styleguide's theme-fade transition, matching the styleguide App() behaviour.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.add("theme-fade");
    const t = setTimeout(() => document.documentElement.classList.remove("theme-fade"), 320);
    return () => clearTimeout(t);
  }, [theme]);
  // The user's explicit toggle is the only thing we persist — once set, it
  // overrides the system preference on the next reload.
  const onThemeChange = useCallback((next) => {
    setTheme(next);
    if (typeof window !== "undefined") saveTheme(window.localStorage, next);
  }, []);

  // The SKIP-PERMISSIONS armed toggle (aw-021), owned here and threaded down to
  // every launch button so each bridge launch posts `skipPermissions: true` when
  // armed (else omits it). DEFAULT OFF, and a malformed/stale/absent persisted
  // blob degrades to OFF (the bypass is never silently on — skip-permissions-state.js).
  // The lazy initializer keeps it a one-time read on mount, so an SSE re-projection
  // never resets the armed choice. It is presentation view-state only — never a
  // disk lifecycle write — so the dashboard stays read-only over .agentheim/.
  const [skipPermissions, setSkipPermissions] = useState(() => {
    if (typeof window === "undefined") return false;
    return loadSkipPermissions(window.localStorage);
  });
  const onSkipPermissionsChange = useCallback((next) => {
    const armed = next === true;
    setSkipPermissions(armed);
    if (typeof window !== "undefined") saveSkipPermissions(window.localStorage, armed);
  }, []);

  // .agentheim is being viewed (Agentheim is installed across many repos). It
  // rides the existing /api/tree projection (project.name, parsed server-side
  // from vision.md's `# Vision:` heading). The vision name is static within a
  // session, so a one-time read on mount suffices — no SSE re-read needed.
  const [projectName, setProjectName] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/tree")
      .then((r) => (r.ok ? r.json() : null))
      .then((tree) => { if (alive && tree && tree.project) setProjectName(tree.project.name); })
      .catch(() => {}); // header name is non-essential; failure leaves "Agentheim" alone
    return () => { alive = false; };
  }, []);

  // TWO open-intent sinks, split on artifact KIND (aw-027, pure isTaskIntent):
  //   - openIntent  — the clicked TASK, or null when the slide-over is closed. It
  //     drives the board card selection ring (DashboardBoard tracks its own ring
  //     off the click; the SlideOver consumes this).
  //   - selectedDoc — the selected non-task DOCUMENT, or null when the main pane
  //     shows the board (the default). It drives the rail row's selected edge and
  //     the MainPaneReader.
  // A board card emits a task intent → SlideOver; a rail row emits a doc intent →
  // main pane. The two are mutually exclusive: opening one clears the other so the
  // selection ring and the rail edge never both show.
  const [openIntent, setOpenIntent] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  // The THIRD main-pane view state (aw-058 / aw-062, ADR-0025): "board" | "workflow" |
  // "about", default "board". A built-in STATIC page (the Workflow guide, the About
  // page) is neither a task nor a disk-fetched document, so it does not fit openIntent
  // or selectedDoc — it gets its own shell flag, NOT a fourth field on any intent shape.
  // Main-pane render precedence is workflow → about → document → board. The states are
  // mutually exclusive BY CONSTRUCTION: each onSelect* handler clears the other selections
  // (and sets its own value), and every handler that lands something else in the main pane
  // (onSelectBoard, onOpen task + doc branches, onOpenSearch, onOpenFullScreen) resets
  // mainView to "board" — so a built-in page can never linger under a later board/doc
  // click. The enum is deliberately easy to extend: aw-062's "about" page is exactly the
  // one-line extension ADR-0025 anticipated.
  const [mainView, setMainView] = useState("board");
  const onOpen = useCallback((item) => {
    if (typeof window !== "undefined") window.__agentheimLastOpen = item;
    setMainView("board");     // a task or doc takes the main pane/slide-over; leave the workflow page.
    if (isTaskIntent(item)) {
      setSelectedDoc(null);   // a task takes the slide-over; clear any open doc.
      setOpenIntent(item);
    } else {
      setOpenIntent(null);    // a doc takes the main pane; close any open slide-over.
      setSelectedDoc(item);
    }
  }, []);
  const onClose = useCallback(() => setOpenIntent(null), []);
  // The Board RailItem returns the main pane to the board: clear the selected doc and
  // leave the workflow page (ADR-0025 reset obligation).
  const onSelectBoard = useCallback(() => { setSelectedDoc(null); setMainView("board"); }, []);
  // The Workflow RailItem selects the built-in static page (aw-058, ADR-0025). It is
  // its OWN handler, not the rail's onOpen machinery: it sets the third main-pane
  // state and clears BOTH the selected doc and the open task so no two surfaces (or
  // two rail rows) show at once.
  const onSelectWorkflow = useCallback(() => {
    setMainView("workflow");
    setSelectedDoc(null);
    setOpenIntent(null);
  }, []);
  // The About RailItem selects the second built-in static page (aw-062, ADR-0025) —
  // the one-line enum extension the ADR anticipated. Like onSelectWorkflow it is its
  // OWN handler (not the rail's onOpen machinery): it sets the third main-pane state to
  // "about" and clears BOTH the selected doc and the open task, so no two surfaces (or
  // two rail rows) show at once. The About page is static — no isTaskIntent, no
  // /api/doc fetch, no write (ADR-0021 / ADR-0017).
  const onSelectAbout = useCallback(() => {
    setMainView("about");
    setSelectedDoc(null);
    setOpenIntent(null);
  }, []);

  // The TOPBAR SEARCH open-intent sink (aw-052). A search result is loaded into the
  // MAIN content pane for BOTH kinds (builder's choice, ADR-0023): non-task docs as
  // aw-027 does, AND tickets via the aw-039 "open in full screen" path (NOT the
  // slide-over). The result already carries the existing intent shape from
  // /api/search (ADR-0023), so this routes on the UNCHANGED isTaskIntent (ADR-0021):
  //   - non-task doc → setSelectedDoc (main pane reader), close any slide-over;
  //   - ticket → setSelectedDoc + setOpenIntent(null) — the aw-039 full-screen path.
  // Both branches land in the main pane and close the slide-over, so structurally
  // they collapse to one move; the isTaskIntent split is kept explicit for parity
  // with the documented routing. No write (ADR-0017).
  const onOpenSearch = useCallback((item) => {
    if (typeof window !== "undefined") window.__agentheimLastOpen = item;
    setMainView("board");     // a search result lands in the main pane; leave the workflow page (ADR-0025).
    if (isTaskIntent(item)) {
      // aw-039 full-screen path: promote the ticket into the main pane, not the slide-over.
      setOpenIntent(null);
      setSelectedDoc(item);
    } else {
      setOpenIntent(null);
      setSelectedDoc(item);
    }
  }, []);
  // "Open in full screen" (slide-over header, ds-009 callback): promote the OPEN TASK
  // out of the cramped slide-over and into the main content pane — the same surface
  // non-task docs render in (MainPaneReader, aw-027). A deliberate per-action override
  // of the ADR-0021 split (which routes tasks → slide-over): the task carries a real
  // on-disk `path` + `id`, so MainPaneReader consumes it directly — no shape adapter.
  // The Drawer callback is bare; the shell already owns the open task in `openIntent`,
  // so this is just the two mutually-exclusive states swapping. No write (ADR-0017).
  const onOpenFullScreen = useCallback(() => {
    setMainView("board");        // the promoted task takes the main pane; leave the workflow page (ADR-0025).
    setSelectedDoc(openIntent);  // promote the open task into the main pane
    setOpenIntent(null);         // and close the slide-over
  }, [openIntent]);

  // The shell-level "stopped" state (aw-028). The topbar's quiet Stop dashboard launch
  // calls onStopped ONLY when launchOrCopy returned `via: "bridge"` — i.e. POST /run
  // dispatched the `/agentheim:dashboard stop` session, so the server this page talks to
  // is shutting down. We then render a full-pane "Dashboard stopped — safe to close this
  // tab" overlay over the main content area. It is OPTIMISTIC on dispatch (the spawned
  // session still has to run `/dashboard stop`); the SSE stream dropping a moment later
  // (live-update already tracks connection state) naturally corroborates it. A clipboard
  // fallback stopped nothing, so it never reaches here — no overlay, just the button's
  // own quiet "Copied" flash. The overlay is board-local and token-matched (ADR-0003);
  // there is no full-screen modal primitive and the Drawer is a side panel, not used here.
  const [stopped, setStopped] = useState(false);
  const onStopped = useCallback(() => setStopped(true), []);

  return html`
    <${ThemeCtx.Provider} value=${theme}>
      <div style=${{
        display: "flex", flexDirection: "row",
        height: "100dvh", overflow: "hidden", background: "var(--surface-0)",
      }}>
        <${ShellRail} projectName=${projectName}
          selectedId=${selectedDoc ? selectedDoc.id : null}
          onOpen=${onOpen} onSelectBoard=${onSelectBoard}
          mainView=${mainView} onSelectWorkflow=${onSelectWorkflow}
          onSelectAbout=${onSelectAbout} />
        <div style=${{
          flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
          background: "var(--surface-0)",
        }}>
          <${BoardTopbar}
            theme=${theme} setTheme=${onThemeChange}
            skipPermissions=${skipPermissions} setSkipPermissions=${onSkipPermissionsChange}
            onStopped=${onStopped} onOpen=${onOpenSearch} />
          <div style=${{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column" }}>
            <div ref=${scrollContainerRef} className="scroll-quiet" style=${{ flex: 1, overflowY: "auto", padding: "22px 24px 40px" }}>
              ${mainView === "workflow"
                ? html`<${WorkflowPage} />`
                : mainView === "about"
                  ? html`<${AboutPage} />`
                  : selectedDoc
                    ? html`<${MainPaneReader} doc=${selectedDoc} />`
                    : html`<${DashboardBoard} onOpen=${onOpen} skipPermissions=${skipPermissions} scrollContainerRef=${scrollContainerRef} />`}
            </div>
            ${stopped ? html`<${StoppedOverlay} />` : null}
          </div>
        </div>
      </div>
      <${SlideOver} intent=${openIntent} onClose=${onClose} onOpenFullScreen=${onOpenFullScreen} />
    </${ThemeCtx.Provider}>`;
}
