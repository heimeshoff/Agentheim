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
   - LIVE-UPDATE: the board subscribes to the shared live-tree hub
     (live-tree-hub.js, agentic-workflow-mvt8x / ADR-0070) — the tab's ONE
     `/api/events` source and ONE `/api/tree` fetch. A STRUCTURAL
     tree-changed frame (or reconnect) re-projects the board; an ADVISORY
     frame (`.agentheim/state/**`) re-syncs only the panel that reads that
     exact artifact (WhatsNextPanel / InFlightLane below), never the board;
     a RUNTIME frame re-syncs nobody. The raw event is never interpreted as
     a transition — routing selects the audience, never the meaning
     (ADR-0070 §3). As skills move files on disk, the board reflects it
     within a frame.
   ============================================================ */
import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, memo } from "react";

// Styleguide single source (ADR-0003): import the approved Kanban components
// across the BC boundary. They are CONSUMED, never copied — the design-system
// styleguide remains the one source of UI truth, the dashboard is a consumer.
import confetti from "canvas-confetti";

import { html } from "../../.agentheim/contexts/design-system/styleguide/app/html.js";
import { Markdown } from "../../.agentheim/contexts/design-system/styleguide/app/primitives.js";
import { ColumnHeader, TicketCard } from "../../.agentheim/contexts/design-system/styleguide/app/kanban.js";
import { EmptyColumn } from "../../.agentheim/contexts/design-system/styleguide/app/empty.js";
import { Icon } from "../../.agentheim/contexts/design-system/styleguide/app/icons.js";
import { ModelSplitButton } from "../../.agentheim/contexts/design-system/styleguide/app/button.js";
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
import { refineCommandFor, promoteCommandFor, dismissCommandFor, workCommandFor, WORK_COMMAND, WHATS_NEXT_COMMAND } from "./modeling-command.js";
import { PROMPT_MODES, DEFAULT_PROMPT_MODE_INDEX, clampPromptModeIndex, nextPromptModeIndex, promptBarKeyIntent, PROMPT_KEY_INTENT, canFirePromptMode, nameForPromptMode } from "./prompt-mode.js";
import { PROMPT_MODELS, DEFAULT_PROMPT_MODEL_INDEX, nextPromptModelIndex, isModelLockedForMode, modelForMode, shouldWindowCtrlMHandle } from "./prompt-model.js";
import { launchOrCopy, probeBridge, KNOWN_CAPABILITIES } from "./bridge-launch.js";
import { groupTickets } from "./board-group.js";
import { resolveHoverDependencies } from "./board-dependencies.js";
import { annotateSectionHiddenDependency, donePeekHasHiddenDependency, unionTargetIds, classifyEdge } from "./board-dependency-groups.js";
import { loadViewState, saveViewState, defaultColumnState, peekClampStyle, PEEK_MAX_HEIGHT_PX } from "./board-view-state.js";
import { SlideOver } from "./slide-over.js";
import { MainPaneReader } from "./main-pane-reader.js";
import { treeToLibrary, footerStatusLine } from "./library-data.js";
import { railMtimeIndex, flaggedPaths, annotateGroups } from "./rail-attention.js";
import { resolveConfettiColors } from "./confetti-palette.js";
import { confettiFireSequence } from "./confetti-launch.js";
import { isTaskIntent } from "./intent-route.js";
import { searchResultsToGroups } from "./search-results.js";
import { createLiveTreeHub } from "./live-tree-hub.js";
import { docUrl } from "./slide-over-data.js";
import { parseFrontmatter } from "./frontmatter.js";
import {
  WHATS_NEXT_DOC_PATH,
  formatStaleness,
  splitWhatsNextSections,
} from "./whats-next-state.js";
import { IN_FLIGHT_DOC_PATH, deriveInFlightView } from "./in-flight-state.js";

// The tab's ONE live-tree hub (agentic-workflow-mvt8x, ADR-0070). A single
// module-level instance — every useLiveTree call below SUBSCRIBES to it; none
// of them construct their own createLiveUpdate/EventSource (enforced by
// live-tree-source-guard.test.mjs). Production code passes no options, so the
// hub's own defaults hit the real EventSource + the real fetch.
const liveTreeHub = createLiveTreeHub();

/**
 * React hook: subscribe to the shared live-tree hub.
 *
 * STRUCTURAL form (default, no options) — `useLiveTree(onTree)`: `onTree` is
 * called with the current tree on subscribe (fetched once, shared across
 * every concurrent structural subscriber) and again on every structural
 * tree-changed frame / reconnect. Used by the board and the rail, each
 * applying its own projection (treeToColumns / treeToLibrary) to the same
 * payload — one fetch, two projections.
 *
 * ADVISORY form — `useLiveTree(onResync, { artifactPath })`: `onResync` is
 * called with no payload only when a frame names EXACTLY `artifactPath` (or
 * on reconnect) — never on a structural frame, never on another artifact's
 * advisory frame. Used by WhatsNextPanel / InFlightLane, which already fetch
 * their own artifact via /api/doc (fetchDoc) on being notified.
 *
 * Either form never interprets the raw event as a Task transition (ADR-0001)
 * — routing selects the audience, never the meaning (ADR-0070 §3). `onResync`
 * is held in a ref so the subscription is established ONCE, not re-built on
 * every render.
 */
function useLiveTree(onResync, { artifactPath } = {}) {
  const cb = useRef(onResync);
  cb.current = onResync;
  useEffect(() => {
    if (typeof EventSource === "undefined") return undefined;
    if (artifactPath) {
      return liveTreeHub.subscribeAdvisory(artifactPath, () => { cb.current && cb.current(); });
    }
    return liveTreeHub.subscribeStructural((tree) => { cb.current && cb.current(tree); });
  }, [artifactPath]);
}

const EMPTY_COLUMNS = (() => {
  const c = {};
  for (const k of COLUMN_ORDER) c[k] = [];
  return c;
})();

// A test-only render-count PROBE, injected exactly like WhatsNextPanel's/
// InFlightLane's `fetchDoc` (agentic-workflow-rw6ck): an optional prop,
// default a no-op, threaded DashboardBoard -> BoardColumn -> BoardCard.
// Production code (DashboardApp below) never passes one, so this NOOP object
// is what every real mount uses — there is no test-only IMPORT anywhere in
// this file (dist-build.test.mjs-style assertion), only an inert default
// object. A test supplies its own `{ card, column }` recorder to observe
// exactly which BoardCard/BoardColumn instances React actually re-invoked, a
// direct measurement a DOM-mutation check cannot make: an unmemoized card
// that re-renders to IDENTICAL output mutates nothing observable in the DOM.
const NOOP_RENDER_PROBE = { card() {}, column() {} };

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

// The board-wide "View" chip (agentic-workflow-c2ver) — see its definition
// below (ViewChip), which replaces the per-column ColumnSortControl +
// ColumnGroupToggle + ColumnControls strip this comment used to introduce. One
// chip now drives sort + group identically for all four columns instead of
// each column carrying its own independent affordance.

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

// The single BOARD-WIDE "View" chip (agentic-workflow-c2ver, replacing the
// per-column ColumnSortControl + ColumnGroupToggle + ColumnControls strip this
// comment used to sit above). ONE choice — { grouped, sort } — now drives ALL
// FOUR columns identically (the ADR-0015 amendment's board-wide lens, landed by
// agentic-workflow-qf945). Composed on the shared Menu primitive (ds-015)
// UNFORKED — the same trigger-render-prop + floating-panel seam SettingsMenu
// (below) already uses: the board owns the trigger's look and the panel's
// contents, the primitive owns the open/close truth, outside-click/Esc
// dismissal, and the reduced-motion-aware reveal (ADR-0003). The trigger
// SUMMARIZES the current lens ("Recently modified" or "Recently modified ·
// grouped by context") so the choice reads at a glance without opening the
// panel. Neither the sort <select> nor the group toggle button forks the
// styleguide beyond the unforked Icon glyph already used by the retired
// per-column controls (aw-012/aw-014 precedent, now board-wide) — same
// native-control-beside-the-primitives idiom, just one instance instead of four.
function ViewChip({ sort, onSortChange, grouped, onGroupToggle }) {
  const sortLabel = (SORT_OPTIONS.find((o) => o.value === sort) || SORT_OPTIONS[0]).label;
  const summary = grouped ? `${sortLabel} · grouped by context` : sortLabel;
  return html`
    <${Menu}
      ariaLabel="Board view"
      align="right"
      trigger=${({ open, toggle }) => html`
        <button
          type="button"
          className="focusable"
          aria-haspopup="menu"
          aria-expanded=${open}
          aria-label=${`View — ${summary}`}
          title="View — sort and group the board"
          onClick=${toggle}
          style=${{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "var(--font-ui)", fontSize: 11.5,
            color: open ? "var(--fg-1)" : "var(--fg-2)",
            background: open ? "var(--surface-2)" : "var(--surface-1)",
            border: `1px solid ${open ? "var(--hairline-strong)" : "var(--hairline)"}`,
            borderRadius: "var(--radius-sm)", padding: "4px 9px", cursor: "pointer",
            transition: "background var(--duration-fast) var(--ease-base), color var(--duration-fast) var(--ease-base), border-color var(--duration-fast) var(--ease-base)",
          }}>
          <${Icon} name="box" size=${12.5} color=${open ? "var(--fg-1)" : "var(--fg-3)"} />
          <span>${summary}</span>
          <span aria-hidden="true" style=${{ fontSize: 9, color: "var(--fg-4)" }}>▾</span>
        </button>`}>
      <${MenuItem}>
        <label style=${{ display: "inline-flex", alignItems: "center", gap: 6, width: "100%" }}>
          <span style=${{ fontFamily: "var(--font-ui)", fontSize: 10.5, color: "var(--fg-4)" }}>Sort</span>
          <select
            aria-label="Sort the board"
            value=${sort}
            onChange=${(e) => onSortChange(e.target.value)}
            className="focusable"
            style=${{
              fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--fg-2)",
              background: "var(--surface-1)", border: "1px solid var(--hairline)",
              borderRadius: "var(--radius-sm)", padding: "3px 6px", cursor: "pointer",
              flex: "1 1 auto",
            }}>
            ${SORT_OPTIONS.map((o) => html`<option key=${o.value} value=${o.value}>${o.label}</option>`)}
          </select>
        </label>
      </${MenuItem}>
      <${MenuItem}>
        <button
          type="button"
          className="focusable"
          aria-pressed=${grouped}
          aria-label="Group the board by bounded context"
          onClick=${() => onGroupToggle(!grouped)}
          style=${{
            display: "inline-flex", alignItems: "center", gap: 5, width: "100%",
            fontFamily: "var(--font-ui)", fontSize: 11.5,
            color: grouped ? "var(--fg-1)" : "var(--fg-2)",
            background: grouped ? "var(--surface-2)" : "var(--surface-1)",
            border: `1px solid ${grouped ? "var(--hairline-strong)" : "var(--hairline)"}`,
            borderRadius: "var(--radius-sm)", padding: "3px 7px", cursor: "pointer",
            transition: "background var(--duration-fast) var(--ease-base)",
          }}>
          <${Icon} name="box" size=${12.5} color=${grouped ? "var(--fg-1)" : "var(--fg-3)"} />
          <span>Group by context</span>
        </button>
      </${MenuItem}>
    </${Menu}>`;
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
  // `cta` (aw-vk6mc): the ochre "primed primary action" treatment licensed by
  // ADR-0048's accent carve-out (a discriminating exception to ADR-0016's
  // "no ochre for peer selection" rule — this button FIRES the whats-next skill,
  // it does not record a passive equivalent-state selection). Orange text on
  // the warm accent fill/border, all three from the reserved --accent-ochre
  // family (never a raw hex) — do not "fix" this back to de-emphasis.
  const cta = emphasis === "cta";
  // Idle treatment by emphasis (all token-styled, no new hue):
  //   inverse -> filled --fg-1 + --surface-0 text (the §05 topbar action);
  //   primary -> filled surface-2 + stronger hairline + fg-1 (draws the eye);
  //   quiet   -> transparent, no border, fg-3 (recedes — text-weight);
  //   cta     -> the ADR-0048 ochre CTA: --accent-ochre text on an
  //              --accent-ochre-soft fill with an --accent-ochre border;
  //   default -> the column pair's bordered surface-1 chip.
  let idleColor = inverse ? "var(--surface-0)" : primary ? "var(--fg-1)" : quiet ? "var(--fg-3)" : cta ? "var(--accent-ochre)" : "var(--fg-2)";
  let idleBg = inverse ? "var(--fg-1)" : primary ? "var(--surface-2)" : quiet ? "transparent" : cta ? "var(--accent-ochre-soft)" : "var(--surface-1)";
  let idleBorder = inverse ? "1px solid var(--fg-1)" : quiet ? "1px solid transparent" : cta ? "1px solid var(--accent-ochre)" : `1px solid ${primary ? "var(--hairline-strong)" : "var(--hairline)"}`;
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
            // aw-041 + ADR-0048 re-verified: the armed --obligation red cue wins over
            // EVERY idle treatment, including the new ochre `cta` fill — the danger
            // signal must never be masked by the accent.
            ? "var(--obligation)"
            : cta
              ? "var(--accent-ochre)"
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
        fontWeight: primary || inverse || cta ? 600 : 500,
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
// THE FIELD IS A GENUINELY MULTI-LINE, AUTO-GROWING CONTROL (aw-038's original
// single-logical-line framing is RETIRED by agentic-workflow-p8k4d — see ADR-0050's
// "## Amendment" section). It is a <textarea> that soft-wraps with NO horizontal
// scrollbar (overflowX hidden) and AUTO-GROWS in height to fit its content
// (autoGrowField measures scrollHeight) up to PROMPT_FIELD_MAX_PX, after which it
// scrolls vertically (overflowY auto) — the aw-038 growth band is unchanged, only
// what it grows to fit has changed. Bare Enter now LAUNCHES the highlighted mode
// (promptBarKeyIntent's LAUNCH branch — p8k4d reverses aw-038's swallow rule), and
// Shift+Enter inserts a real line break (the NEWLINE branch does not preventDefault,
// so the textarea's native newline insertion runs) — so the field authentically
// holds multi-line text. `sanitizePromptLine` is RETIRED: onChange stores the raw
// textarea value verbatim, no collapsing of interior newlines. Multi-line prompts are
// safe end-to-end: the bridge passes the seeded command as a raw argv element with no
// shell wrap (ADR-0018 / infrastructure-020), the clipboard fallback copies verbatim,
// and `safePrompt` (modeling-command.js) trims only the leading/trailing ends.
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
// full-width auto-growing field above the Quick Capture / Modeling pair.
//
// `sanitizePromptLine` (aw-038's single-logical-line collapse) is RETIRED by
// agentic-workflow-p8k4d — see the doc comment above BoardPromptBar and ADR-0050's
// "## Amendment" section. The field now stores the textarea's raw value verbatim, so
// an authored Shift+Enter line break (or a multi-line paste) survives intact.

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

// agentic-workflow-n4qte: the capability-skew banner's copy is deliberately
// GENERIC — it names no specific field, so it stays true the day a fifth
// capability arrives and a bridge advertises everything today's
// KNOWN_CAPABILITIES names but still lacks that one (builder's ruling, see
// the task's Notes: the banner fires on ANY missing capability, not on
// 'model' specifically).
const BRIDGE_SKEW_BANNER_TEXT =
  "Your VS Code bridge is running an older version. Some launch options are unavailable until you reload the window.";

// A board-local PROMPT-MODE TAB (agentic-workflow-bz3az — rebuilds aw-065/aw-068's
// PromptLaunchCard into the ADR-0050 docked console's top row of four mode tabs;
// conformed to Section 1b's edge-to-edge cell layout by agentic-workflow-q7r3x).
// One entry of PROMPT_MODES (dashboard/app/prompt-mode.js): name + one-line meaning
// (icon + label + subtitle).
//
// `highlighted` is the SINGLE committed selection channel (ADR-0050's
// `highlightedMode`) — never a per-tab boolean the board tracks independently.
// Paint follows the settled contract:
//   - highlighted -> the bounded ochre wayfinding exception ADR-0051 grants this
//     ONE additional surface (beside the nav rail, ADR-0048 surface 1): a filled
//     CELL background + a full-width ochre bottom underline (ADR-0051's
//     inset-underline intent) + --accent-ochre text. This replaces the earlier
//     rounded-pill-with-gaps look, which read as a four-sided ochre box rather
//     than a wayfinding underline (agentic-workflow-q7r3x, Section 1b).
//   - the other three -> ADR-0016's unchanged de-emphasis default: dimmed via
//     opacity, --fg-2 text, no ring, no new hue.
// `hover` is a SEPARATE, transient, presentation-only pointer-feedback channel
// (ADR-0050 "two orthogonal channels") — it nudges a NON-highlighted tab's opacity
// up for affordance, but it NEVER reads or writes `highlighted` and never launches.
// Clicking the tab does both at once: it commits the highlight to this tab AND
// launches it (the click-to-launch contract carried over unchanged from
// PromptLaunchCard, now additionally updating the highlight before it fires).
//
// Cell layout (agentic-workflow-q7r3x, Section 1b): each tab is one of FOUR
// edge-to-edge, equal-width cells (`flex: "1 1 0"`, no gap between cells, no
// rounding of its own — the console shell alone owns the rounded corners at the
// row's two ends via its `overflow: hidden`). A thin `--hairline` divider sits
// on the trailing edge of every cell but the last, so the row reads as four
// bordered cells rather than a gapped row of independent pill buttons.
//
// `flashed` (agentic-workflow-spv0k) is passed in by the parent, keyed to the
// mode index that actually FIRED — never derived here from `highlighted`. The
// two used to be conflated (`flashed = highlighted && feedback !== "idle"`),
// which broke the moment ADR-0050's success-reset moved `highlightedMode` back
// to Quick Capture before this component's next render: the flash relocated to
// tab 0 regardless of which mode launched. `feedback` still carries the
// launched/copied word choice (a value shared across tabs), but WHICH tab
// paints it is the parent's `firedMode === index` decision, not this
// component's.
function PromptModeTab({ mode, highlighted, flashed, feedback, onClick, divider = true }) {
  const [hover, setHover] = useState(false);
  const titleText = flashed ? (feedback === "launched" ? "Launched" : "Copied") : mode.label;

  const color = flashed ? "var(--st-done)" : highlighted ? "var(--accent-ochre)" : "var(--fg-2)";
  const subtitleColor = flashed ? "var(--st-done)" : highlighted ? "var(--fg-2)" : "var(--fg-3)";
  const background = highlighted ? "var(--surface-2)" : "transparent";
  // De-emphasis by opacity (ADR-0016): a non-highlighted tab rests dimmed and
  // brightens slightly on hover (pointer feedback only); the highlighted tab (and
  // a flash) always render at full strength.
  const opacity = highlighted || flashed ? 1 : hover ? 0.85 : 0.55;

  return html`
    <button
      type="button"
      role="tab"
      aria-selected=${highlighted}
      className="focusable"
      title=${`${mode.label} — ${mode.subtitle}`}
      aria-label=${`${mode.label} — ${mode.subtitle}`}
      onClick=${onClick}
      onMouseEnter=${() => setHover(true)}
      onMouseLeave=${() => setHover(false)}
      style=${{
        display: "inline-flex", alignItems: "center", gap: 8, textAlign: "left",
        flex: "1 1 0", minWidth: 0,
        color,
        background,
        borderTop: "none", borderLeft: "none",
        borderRight: divider ? "1px solid var(--hairline)" : "none",
        borderBottom: "none",
        borderRadius: 0,
        padding: "10px 12px", cursor: "pointer",
        opacity,
        // ADR-0051's ochre wayfinding mark on the highlighted tab only — a
        // full-width bottom inset underline (the nav-rail inset idiom, turned
        // into a bottom border for this horizontal row). NO ochre on a
        // non-highlighted tab (ADR-0016).
        boxShadow: highlighted && !flashed ? "inset 0 -2px 0 var(--accent-ochre)" : "none",
        transition: "color var(--duration-fast) var(--ease-base), background var(--duration-fast) var(--ease-base), opacity var(--duration-fast) var(--ease-base), box-shadow var(--duration-fast) var(--ease-base)",
      }}>
      <${Icon} name=${mode.icon} size=${13} color=${color} />
      <span style=${{ display: "inline-flex", flexDirection: "column", gap: 0, lineHeight: 1.2, minWidth: 0 }}>
        <span style=${{
          fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>${titleText}</span>
        <span style=${{
          fontFamily: "var(--font-ui)", fontSize: 10.5, fontWeight: 400, color: subtitleColor,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>${mode.subtitle}</span>
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

// The WHAT'S-NEXT advisory recommendation panel (agentic-workflow-073 / ADR-0027;
// dismiss rewired to a bounded on-disk delete by agentic-workflow-vmk1z / ADR-0046).
//
// The `whats-next` skill writes a single-latest advisory artifact at
// `.agentheim/state/whats-next.md` (an ADVISORY write, ADR-0027 — distinct from a
// lifecycle write). This panel READS it via the existing GET /api/doc body carrier
// (ADR-0021/0023 — never /api/tree, which is pointers/metadata only), and — since
// ADR-0046 — may issue exactly one write on explicit dismiss: `DELETE
// /api/whats-next`, which removes this one file and nothing else. Unlike the
// slide-over / main-pane reader, this is a
// GLANCEABLE advisory card, not a document: the leading YAML is STRIPPED (not folded
// into a "Front matter" <details>, aw-q7m4k) and the three body sections (Where things
// stand / Recommended move / Next) lay out as three NUMBERED, CONNECTED steps — a
// flight plan (agentic-workflow-a2pm1) — rather than three plain side-by-side columns
// (aw-q7m4k's original framing). Step 2 (Recommended move, by position) wears the
// licensed `--emphasis-border` hero carve-out (ADR-0048). Each step's content still
// renders through the unforked styleguide Markdown primitive (ADR-0003) — board-local
// token-matched layout, NO bespoke renderer, no new design-system child. Consumed
// unforked; light/dark aware for free. The body is split by splitWhatsNextSections
// (whats-next-state.js) — LOSS-TOLERANT: a degraded body yields whatever steps are
// parseable, never throws.
//
// Behaviour:
//   - ABSENT artifact (404 / fetch failure) → renders NOTHING (no shell, no error).
//   - MALFORMED / partial artifact → renders what is parseable, never throws.
//   - LIVE: it re-fetches on every SSE tree-changed frame (the existing consumer,
//     ADR-0006) — a new/overwritten artifact triggers a `.agentheim/` mutation frame.
//   - STALENESS CUE derived from the `generated` stamp (rendering only, ADR-0027 §4).
//   - DISMISS deletes the artifact (agentic-workflow-vmk1z / ADR-0046): clicking
//     dismiss calls `DELETE /api/whats-next` — the dashboard's one bounded write
//     exception to ADR-0017 — and optimistically clears the local body so the panel
//     vanishes immediately. Disk convergence (unlink → SSE tree-changed → re-fetch
//     404s → renders nothing) is the durable truth behind that optimistic hide; no
//     client-side dismiss store is kept (the former localStorage dismiss, aw-073,
//     is retired).
//
// fetchDoc is overridable for tests. It sits ABOVE the BoardPromptBar's "Prompt"
// title on the board view only (composed by BoardPromptBar).
function WhatsNextPanel({ fetchDoc = defaultFetchWhatsNext }) {
  const [body, setBody] = useState(null); // null = nothing to show (absent / dismissed)

  const reload = useCallback(() => {
    let alive = true;
    fetchDoc()
      .then((md) => { if (alive) setBody(typeof md === "string" ? md : null); })
      // Absent artifact / any fetch failure → render nothing (absence is normal).
      .catch(() => { if (alive) setBody(null); });
    return () => { alive = false; };
  }, [fetchDoc]);

  useEffect(() => reload(), [reload]);
  // Re-fetch ONLY on a frame naming this exact artifact (agentic-workflow-mvt8x,
  // ADR-0070 §2 — the advisory routing form): a newer advisory write surfaces
  // live, and a dismiss-triggered delete surfaces as an absent artifact (404 →
  // nothing). A structural frame (a task moving, e.g.) no longer re-fetches this
  // panel at all — nothing here changed.
  useLiveTree(reload, { artifactPath: WHATS_NEXT_DOC_PATH });

  if (typeof body !== "string" || body.trim() === "") return null;

  const generated = generatedStamp(body);
  const staleness = formatStaleness(generated, Date.now());

  // Strip the leading frontmatter and cut the body into its named sections (aw-q7m4k).
  // LOSS-TOLERANT: a degraded body yields fewer/empty columns, a non-matching body still
  // renders what is parseable, an empty body yields []. The staleness read above comes
  // from the SAME parseFrontmatter, so it is independent of this render split.
  const columns = splitWhatsNextSections(body);

  // Dismiss deletes the artifact on disk (ADR-0046) instead of hiding it locally.
  // Optimistic setBody(null) hides the panel immediately; the DELETE result is not
  // otherwise awaited — a failed delete still surfaces on the next SSE re-fetch,
  // which re-shows the (still-present) recommendation rather than losing it silently.
  const onDismiss = () => {
    setBody(null);
    fetch("/api/whats-next", { method: "DELETE" }).catch(() => {});
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
      ${/* FLIGHT-PLAN STEPPER (agentic-workflow-a2pm1, ADR-0048 hero carve-out): the
            advisory's sections now read as CONNECTED, NUMBERED steps instead of three
            plain columns (superseding aw-q7m4k's plain-column framing). One numbered
            circle renders per parsed column, joined by a horizontal connector line
            between consecutive circles. Both the numbering and the step-2 hero below are
            POSITION-based (the Nth column becomes step N), never keyed to section text —
            the loss-tolerant splitWhatsNextSections contract (aw-q7m4k / aw-073) still
            holds: a degraded body just yields fewer circles/lines, never an invented
            step. */ ""}
      <div style=${{ display: "flex", alignItems: "center", padding: "0 2px" }}>
        ${columns.flatMap((col, i) => {
          const circle = html`<span key=${`step-circle-${i}`} aria-hidden="true" style=${{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
            fontFamily: "var(--font-ui)", fontSize: 11.5, fontWeight: 700,
            color: "var(--fg-3)", border: "1px solid var(--hairline-strong)",
            background: "var(--surface-1)",
          }}>${i + 1}</span>`;
          const connector = i < columns.length - 1
            ? html`<span key=${`step-line-${i}`} aria-hidden="true" style=${{
                flex: 1, height: 1, minWidth: 12, margin: "0 6px",
                background: "var(--hairline)",
              }}></span>`
            : null;
          return connector ? [circle, connector] : [circle];
        })}
      </div>
      ${/* Each step's own CAPPED CARD (aw-c4t8m unchanged): the leading YAML is
            stripped (no folded "Front matter" section), and each named body section
            becomes a card with its heading. Each card's content renders through the
            UNFORKED styleguide Markdown primitive (ADR-0003). Responsive fallback:
            auto-fit columns with a min track collapse to a single column on a narrow
            board so the card stays legible. Card chrome unchanged from aw-c4t8m: a
            board-local, token-matched --surface-1 fill on a --hairline border, a token
            radius + padding, height-bounded (maxHeight) and internally scrollable
            (overflowY: auto, the `scroll-quiet` class) — NO new design-system primitive
            (ADR-0003).

            STEP 2 HERO (agentic-workflow-a2pm1 / ADR-0048): the SECOND parsed column —
            positionally, not text-matched, so a degraded body that still yields at least
            two columns keeps the hero on its second one — wears the licensed emphasis-
            border carve-out: a NAMED `--emphasis-border` token border + a matching
            token-driven shadow (never a raw rgba/hex). No other surface in this region
            references `--emphasis-border` — exactly one hero at a time. */ ""}
      <div style=${{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "14px",
        alignItems: "start",
        marginTop: 6,
      }}>
        ${columns.map((col, i) => html`
          <div key=${i} className="scroll-quiet" style=${{
            display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
            maxHeight: 196, overflowY: "auto",
            background: "var(--surface-1)",
            border: i === 1 ? "1px solid var(--emphasis-border)" : "1px solid var(--hairline)",
            borderRadius: "var(--radius-md)", padding: "10px 12px",
            boxShadow: i === 1 ? "0 2px 10px var(--emphasis-border)" : "none",
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

// The live IN-FLIGHT LANE (agentic-workflow-m9w5c / ADR-0043).
//
// Two Claude Code `Stop`/`SubagentStop` hooks (lib/hook-agent-signal.mjs) write a
// session-liveness heartbeat + recent worker/verifier completions to
// `.agentheim/state/in-flight.json` — a SECOND advisory artifact (ADR-0027's
// category, extended by ADR-0043) alongside `state/whats-next.md`. This lane READS
// it via the SAME GET /api/doc body carrier the WhatsNextPanel above uses
// (ADR-0021/0023 — never /api/tree, which is pointers/metadata only, ADR-0002).
//
// Behaviour:
//   - ABSENT artifact (404 / fetch failure) → renders NOTHING.
//   - STALE heartbeat (past the ADR-0043 staleness window) → renders NOTHING —
//     the crash-safety mechanism (work-session-presence-lock research): there is
//     no reliable "session ended" hook, so a heartbeat that stops updating just
//     ages out rather than leaving a zombie "in flight" lane once the session
//     that wrote it has crashed or been killed (AC3).
//   - LIVE: shows how many workers/verifiers have run this session and since
//     when the session started (AC1), and re-fetches on every SSE frame (the
//     existing consumer, ADR-0006) so it advances/reaps live as the board watches.
//
// Read-only over the artifact (ADR-0017): this component never writes it — only
// the two hooks do. fetchDoc is overridable for tests.
function InFlightLane({ fetchDoc = defaultFetchInFlight }) {
  const [raw, setRaw] = useState(null);

  const reload = useCallback(() => {
    let alive = true;
    fetchDoc()
      .then((text) => { if (alive) setRaw(typeof text === "string" ? text : null); })
      // Absent artifact / any fetch failure → render nothing (absence is normal).
      .catch(() => { if (alive) setRaw(null); });
    return () => { alive = false; };
  }, [fetchDoc]);

  useEffect(() => reload(), [reload]);
  // Re-fetch ONLY on a frame naming this exact artifact (agentic-workflow-mvt8x,
  // ADR-0070 §2 — the advisory routing form): a fresher heartbeat, or the window
  // going stale after the tab has sat idle, both need re-evaluating live. A
  // structural frame no longer re-fetches this lane at all — nothing here changed.
  useLiveTree(reload, { artifactPath: IN_FLIGHT_DOC_PATH });

  const view = deriveInFlightView(raw, Date.now());
  if (!view) return null;

  const since = formatStaleness(view.startedAt, Date.now());

  return html`
    <section aria-label="Work in flight this session" style=${{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      margin: "10px 4px 0", padding: "6px 12px",
      background: "var(--surface-1)", border: "1px solid var(--hairline)",
      borderRadius: "var(--radius-md)",
    }}>
      <span aria-hidden="true" style=${{
        width: 7, height: 7, borderRadius: "50%",
        background: "var(--st-doing)", flex: "0 0 auto",
      }} />
      <span style=${{
        fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600,
        letterSpacing: "-0.01em", color: "var(--fg-1)",
      }}>Work in flight</span>
      <span style=${{
        fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--fg-4)",
      }}>
        ${view.workerCount} worker${view.workerCount === 1 ? "" : "s"}, ${view.verifierCount} verifier${view.verifierCount === 1 ? "" : "s"} this session${since ? ` · running since ${since}` : ""}
      </span>
    </section>`;
}

/** Default fetch for the in-flight artifact: GET /api/doc → raw JSON text (client-side). */
async function defaultFetchInFlight() {
  const res = await fetch(docUrl(IN_FLIGHT_DOC_PATH));
  if (!res.ok) throw new Error(`/api/doc ${res.status}`);
  return res.text();
}

// The board prompt bar — REBUILT (agentic-workflow-bz3az) from aw-065/aw-068's
// "Prompt" title + row of flat launch cards into the 1b DOCKED two-row console:
// a top row of five mode tabs (PromptModeTab, name + one-line meaning) and a
// bottom row of a `❯` chevron + a genuinely multi-line auto-growing prompt field +
// the styleguide's `ModelSplitButton` (design-system-r9dtm), consumed unforked
// (ADR-0003), as the ONE launch affordance — the old bordered `↵` hint span is
// GONE (agentic-workflow-m2vkp): its "Enter launches · Shift+Enter for a new
// line" affordance now lives in the split button's tooltip/aria-label. It docks
// bottom-center over the board (position: fixed, ~780px, a raised surface +
// --shadow-lg, above the board in z-order) rather than sitting in the normal
// document flow — so it never pushes the board content, and (being fixed to the
// VIEWPORT, not the aw-067 `scroll-quiet` content region) it stays put while the
// board scrolls beneath it.
//
// The keyboard model is ADR-0050's, AMENDED by agentic-workflow-p8k4d, then
// agentic-workflow-tkq7v, then agentic-workflow-m2vkp (see ADR-0050's
// "## Amendment" sections) — carried by the pure `prompt-mode.js`
// (PROMPT_MODES / clampPromptModeIndex / nextPromptModeIndex / promptBarKeyIntent):
// a single committed `highlightedMode` index (never five independent booleans),
// defaulting to Quick Capture (0) on mount. Every trigger that can fire a mode's
// command — bare Enter, Ctrl+Enter, or the split button's primary region —
// routes through the ONE `fire(modeIndex)` function below, so all three are
// behaviourally identical: the same seeded command, the same `launchOrCopy`
// bridge-or-clipboard path, the same armed `skipPermissions` thread, the same
// `onResult` clear-textarea + confetti. Clicking a mode tab ONLY moves the
// committed highlight — it no longer launches (p8k4d reverses bz3az's
// click-to-launch). Ctrl+Space focuses the field from anywhere on the board (a
// window-scoped `document` listener below). Shift+Enter inserts a real line
// break instead of launching.
//
// agentic-workflow-m2vkp adds a SECOND, orthogonal axis — which MODEL the
// launched session runs on (`prompt-model.js`) — carried by its own
// `selectedModel` index, cycled by Ctrl+M (the FIFTH disjoint
// `promptBarKeyIntent` label, CYCLE_MODEL) from anywhere on the board: the
// field's own `onPromptKeyDown` owns it while the field has focus, the
// window-scoped `document` listener owns it everywhere else, and
// `shouldWindowCtrlMHandle` (prompt-model.js) keeps the two MUTUALLY
// EXCLUSIVE — one keystroke, one cycle, never both handlers at once (a
// double-dispatch bug caught by verification on iteration 1, since a
// keydown dispatched on the field still bubbles to `document` under React's
// `createRoot`). Quick Capture PINS the resolved model to Haiku as a
// read-time projection (`modelForMode`) — the stored `selectedModel` is never
// overwritten, so switching away from and back to Quick Capture always
// restores whatever was selected. With no bridge reachable (`probeBridge`,
// checked on mount), a clipboard-copied command can never carry a `--model`
// flag, so the button renders `locked`, names no model ("Default"), and Ctrl+M
// is a no-op — the launch itself still works via the clipboard fallback.
// BOTH the mode highlight and the model selection now SURVIVE a successful
// launch (this task reverses ADR-0050's original reset-to-Quick-Capture rule
// on both axes) — only the textarea clears; a reload (no persistence, ADR-0017)
// starts fresh at Quick Capture + Opus.
//
// Preserved unchanged from aw-023/aw-036/aw-h7n2c: `autoGrowField` (auto-grow
// band), the four seeded commands' trimmed-or-bare-fallback contract (reached via
// `PROMPT_MODES[i].commandFor`), and the silent clipboard fallback.
// `sanitizePromptLine` (aw-038) is RETIRED (p8k4d) — the field now holds raw,
// genuinely multi-line text.
export function BoardPromptBar({ skipPermissions = false }) {
  const [prompt, setPrompt] = useState("");
  const [confettiKey, setConfettiKey] = useState(0);
  // ADR-0050's single committed selection channel — one index into PROMPT_MODES,
  // never a per-tab boolean set. Defaults to Quick Capture (0) on mount.
  const [highlightedMode, setHighlightedMode] = useState(DEFAULT_PROMPT_MODE_INDEX);
  // The launched/copied flash, shared across every trigger (tab click, Enter
  // button, Ctrl+Enter). `feedback` carries the word ("launched"/"copied"/
  // "idle"); `firedMode` (agentic-workflow-spv0k) records WHICH tab it paints
  // on — the mode index `fire()` actually launched, captured at fire time.
  // agentic-workflow-m2vkp retires the ADR-0050 success-reset this comment
  // used to describe (`onResult` no longer calls `setHighlightedMode`) —
  // `firedMode` still anchors the flash independently of `highlightedMode`,
  // now simply because they are two channels tracking two different things,
  // not because a reset would otherwise conflate them. The two channels
  // ADR-0050 names — committed selection vs. transient feedback — are read
  // out independently: `highlightedMode` for the ochre underline/fill,
  // `firedMode` for the flash.
  const [feedback, setFeedback] = useState("idle");
  const [firedMode, setFiredMode] = useState(null);
  // agentic-workflow-m2vkp: the SECOND, orthogonal selection channel — which
  // model the launched session runs on. Defaults to Opus on mount; unlike the
  // superseded ADR-0050 rule, this NEVER resets after a launch (see onResult
  // below) — persistence is in-page only (ADR-0017), so a reload is what
  // returns it to Opus, not a successful launch.
  const [selectedModel, setSelectedModel] = useState(DEFAULT_PROMPT_MODEL_INDEX);
  // Ambient bridge-presence + capability signal (infrastructure-h5wnq's
  // probeBridge, grown by infrastructure-v8r3q). Stores the WHOLE
  // `{ present, capabilities }` result — not a bare boolean — because
  // "is a bridge there at all" and "is a bridge there that supports what
  // I'm about to send it" are two different facts (agentic-workflow-n4qte):
  // a clipboard-copied command can never carry --model (bridge absent), and
  // neither can a POST to a listener that never advertised 'model' (bridge
  // present but too old — the wire-level omission infrastructure-v8r3q
  // already guarantees; this state is what lets the UI say so honestly
  // instead of rendering a locked button that still claims a model name).
  const [bridge, setBridge] = useState({ present: false, capabilities: [] });
  // Session-local dismiss for the capability-skew banner below (ADR-0017 —
  // no persistence). A fresh mount always re-probes and re-derives
  // bridgeSkewed from scratch, so the banner reappears on the next mount if
  // the skew is still there; it just does not re-appear on every re-render
  // of an already-mounted board.
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // The single-line auto-grow (aw-038) holds a ref to the textarea so the field can
  // measure its own scrollHeight to grow/shrink to fit.
  const textareaRef = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Shrink-to-fit is a property of the FIELD'S VALUE, not of any one call site
  // that happens to change it (agentic-workflow-vsg9d, fixing the sibling
  // regression aw-038's Notes flagged). A direct `autoGrowField` call made
  // from `onResult` right after `setPrompt("")` measures the STALE DOM: React
  // batches the state update, so the textarea's real `value` (and therefore
  // its `scrollHeight`) has not yet been committed when the synchronous
  // measurement runs — the inline height stays pinned to the old, tall
  // reading, and only the next keystroke (which re-measures a now-correct
  // DOM) snaps it back. `useLayoutEffect` keyed on `prompt` re-measures AFTER
  // React has committed the DOM for whatever value `prompt` now holds, but
  // still before the browser paints — so ANY path that changes `prompt`
  // (typing, pasting, or `onResult`'s clear) shrinks/grows the field
  // correctly, without a per-call-site `autoGrowField` invocation to keep in
  // sync by hand.
  useLayoutEffect(() => {
    autoGrowField(textareaRef.current, PROMPT_FIELD_MAX_PX);
  }, [prompt]);

  // Probe the bridge once on mount (agentic-workflow-m2vkp, grown to carry
  // capabilities by agentic-workflow-n4qte). Never throws, never rejects
  // (probeBridge's own contract) — a probe that never resolves leaves the
  // initial { present: false, capabilities: [] } in place, which locks the
  // model selector, the safe default. Mount-only cadence is deliberate
  // (agentic-workflow-n4qte's Notes): the remedy for a skewed bridge is
  // reloading the VS Code window, which reloads this Simple Browser tab
  // along with it, so re-probing on focus would buy nothing.
  useEffect(() => {
    let cancelled = false;
    const fetchImpl = typeof window !== "undefined" && typeof window.fetch === "function"
      ? window.fetch.bind(window)
      : undefined;
    probeBridge(fetchImpl).then((res) => {
      if (cancelled) return;
      setBridge(res && typeof res === "object"
        ? { present: !!res.present, capabilities: Array.isArray(res.capabilities) ? res.capabilities : [] }
        : { present: false, capabilities: [] });
    });
    return () => { cancelled = true; };
  }, []);

  // Two distinct facts off the ONE probe (agentic-workflow-n4qte's table in
  // the task's `What`): `bridgeSupportsModel` gates the ONE control a
  // grey-out CAN cover (the model selector); `bridgeSkewed` is the GENERAL
  // "this extension as a whole is stale" signal the banner below announces,
  // covering launch paths (session naming) that have no control to grey
  // out. They coincide today — the only bridge in the wild missing 'model'
  // misses 'name' too — but are derived separately on purpose: a future
  // bridge that ships 'model' but lacks a not-yet-invented fifth capability
  // must still raise the banner.
  const bridgeSupportsModel = bridge.present && bridge.capabilities.includes("model");
  const bridgeSkewed = bridge.present && KNOWN_CAPABILITIES.some((c) => !bridge.capabilities.includes(c));

  // The model selector is locked — no caret, Ctrl+M a no-op — whenever the
  // bridge can't honour a model choice (unreachable, OR present but too old
  // to have advertised 'model' — infrastructure-v8r3q's exact stale-host
  // scenario) OR the highlighted mode is Quick Capture (its model is pinned
  // to Haiku). Absent and present-but-too-old render IDENTICALLY locked —
  // from the selector's point of view, "can't reach a bridge that supports
  // this" and "no bridge at all" are the same fact.
  const modelLocked = !bridgeSupportsModel || isModelLockedForMode(highlightedMode);

  // Ctrl+Space focuses the prompt field, and Ctrl+M cycles the selected model,
  // from ANYWHERE on the board (p8k4d settled Ctrl+Space; agentic-workflow-m2vkp
  // adds Ctrl+M alongside it, the same window-scoped pattern) — a `document`
  // keydown listener, registered and torn down here. Ctrl+Space preventDefault()s
  // the browser default and focuses the textarea via `textareaRef`. Ctrl+M
  // preventDefault()s too, but only mutates `selectedModel` when the model is
  // NOT locked — on Quick Capture, or with no bridge reachable, it is a true
  // no-op: no state change, no visible feedback.
  //
  // MUTUAL EXCLUSION (fixed in agentic-workflow-m2vkp iteration 2, after the
  // verifier caught the double-dispatch on iteration 1): Ctrl+Space is safe to
  // handle unconditionally here because `promptBarKeyIntent` classifies it
  // 'pass' — the field's own `onPromptKeyDown` never touches it, so this is
  // its ONLY handler. Ctrl+M is different: `promptBarKeyIntent` classifies it
  // CYCLE_MODEL, so `onPromptKeyDown` ALSO owns it whenever the field has
  // focus. Because React (createRoot) dispatches its own delegated keydown at
  // the field AND the native event still bubbles on to `document`, a Ctrl+M
  // pressed while the field is focused would otherwise be handled TWICE —
  // once here, once in `onPromptKeyDown` — stepping `selectedModel` by two
  // instead of one. `shouldWindowCtrlMHandle` (prompt-model.js) is the guard:
  // it refuses whenever the event's `target` is the prompt field itself,
  // leaving that case entirely to `onPromptKeyDown`. Ctrl+M pressed anywhere
  // else on the board (nothing focused, or focus elsewhere) still reaches
  // this listener and is handled here, same as before.
  useEffect(() => {
    function onWindowKeyDown(e) {
      if (e.ctrlKey === true && e.key === " ") {
        e.preventDefault();
        if (textareaRef.current) textareaRef.current.focus();
        return;
      }
      if (e.ctrlKey === true && !e.altKey && (e.key === "m" || e.key === "M")) {
        if (!shouldWindowCtrlMHandle(e, textareaRef.current)) return;
        e.preventDefault();
        if (modelLocked) return;
        setSelectedModel((current) => nextPromptModelIndex(current, 1));
      }
    }
    document.addEventListener("keydown", onWindowKeyDown);
    return () => document.removeEventListener("keydown", onWindowKeyDown);
  }, [modelLocked]);

  // Fire only on a successful launch / landed copy (aw-023). A fully-silent action
  // (clipboard blocked too) leaves the textarea and plays no confetti. The clear
  // (setPrompt("")) shrinks the field back to one line via the `useLayoutEffect`
  // above, keyed on `prompt` — NOT via a direct `autoGrowField` call here, which
  // used to measure the DOM before React had committed the clear (agentic-workflow-
  // vsg9d fixed the resulting "field stays tall after a launch" bug).
  // agentic-workflow-m2vkp REVERSES ADR-0050's original default/reset rule: the
  // highlighted mode and the selected model both SURVIVE a successful launch —
  // only the textarea clears (confetti still fires). Firing three Modeling
  // prompts in a row no longer means re-selecting Modeling three times.
  const onResult = useCallback((res) => {
    const succeeded = res && (res.via === "bridge" || res.copied === true);
    if (!succeeded) return;
    setPrompt("");
    setConfettiKey((k) => k + 1);
  }, []);

  // The ONE launch path every trigger (tab click / Enter button / Ctrl+Enter)
  // calls — so "identical to clicking the highlighted tab" (ADR-0050) is true by
  // construction, not by keeping three call sites in sync by hand.
  //
  // agentic-workflow-m3vhq introduced the decline-to-launch guard for Plain
  // alone; agentic-workflow-aqyqd (third ADR-0050 amendment) generalizes it
  // to every mode — an empty/whitespace-only prompt declines regardless of
  // which mode is highlighted. The shared canFirePromptMode predicate
  // (prompt-mode.js) is consulted FIRST, before anything else runs — a
  // decline is a true no-op: no bridge call, no clipboard write, no
  // confetti, no highlight/model change, no feedback chip.
  //
  // agentic-workflow-m2vkp: the resolved model (modelForMode — Quick
  // Capture's Haiku pin, or the selected model otherwise) rides the launch
  // via launchOrCopy's `model` field (infrastructure-h5wnq). The clipboard
  // fallback never sees a `--model` flag regardless (launchOrCopy's own
  // contract), so passing it unconditionally here is safe.
  const fire = useCallback((modeIndex) => {
    const idx = clampPromptModeIndex(modeIndex);
    if (!canFirePromptMode(idx, prompt)) return;
    const command = PROMPT_MODES[idx].commandFor(prompt);
    const name = nameForPromptMode(idx, prompt);
    const model = PROMPT_MODELS[modelForMode(idx, selectedModel)].id;
    const fetchImpl = typeof window !== "undefined" && typeof window.fetch === "function"
      ? window.fetch.bind(window)
      : undefined;
    return launchOrCopy({ prompt: command, fetchImpl, copy: copyToClipboard, skipPermissions: skipPermissions === true, name, model }).then((res) => {
      onResult(res);
      // Record WHICH tab fired before (or alongside) onResult's highlight
      // reset — the flash must anchor to `idx`, never to wherever
      // `highlightedMode` lands after the reset (agentic-workflow-spv0k).
      if (res.via === "bridge") { setFiredMode(idx); setFeedback("launched"); }
      else if (res.copied) { setFiredMode(idx); setFeedback("copied"); }
      else return; // clipboard blocked too — stay silent.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFeedback("idle"), 1100);
    });
  }, [prompt, skipPermissions, onResult, selectedModel]);

  // Clicking a tab ONLY moves the committed highlight (p8k4d reverses bz3az/
  // ADR-0050's click-to-launch contract — see ADR-0050's "## Amendment" section).
  // The launch is deliberately deferred to a real commit act: Enter, Ctrl+Enter, or
  // the Enter button (all three share the ONE `fire()` below).
  const onTabClick = useCallback((index) => {
    setHighlightedMode(index);
  }, []);

  // Store the textarea's value RAW (p8k4d retires aw-038's `sanitizePromptLine`
  // collapse) so an authored Shift+Enter line break (or a multi-line paste) survives.
  // Re-measure for auto-grow is no longer done here directly — the
  // `useLayoutEffect` keyed on `prompt` (declared above, near `textareaRef`)
  // re-measures after EVERY `prompt` change, this one included (agentic-workflow-vsg9d).
  const onPromptChange = useCallback((e) => {
    setPrompt(e.target.value);
  }, []);

  // The prompt field's ONE keydown classifier (ADR-0050 invariant 4, amended by
  // p8k4d, then by agentic-workflow-tkq7v, then by agentic-workflow-m2vkp —
  // `promptBarKeyIntent` returns exactly one of FIVE disjoint labels, so no
  // keystroke can ever be double-handled):
  //   newline      -> Shift+Enter. No preventDefault — the textarea inserts its
  //                   own line break natively (p8k4d, retires aw-038's swallow
  //                   + single-line rule).
  //   cycle        -> Tab / Shift+Tab (agentic-workflow-tkq7v reverses the
  //                   original Ctrl+ArrowLeft/ArrowRight trigger, freeing
  //                   native word-jump/word-select inside the now-multi-line
  //                   field). Moves the highlight (nextPromptModeIndex, total
  //                   wraparound), launches nothing. preventDefault()s so Tab
  //                   does not move focus out of the textarea.
  //   cycle_model  -> Ctrl+M (agentic-workflow-m2vkp, ADR-0050's fifth
  //                   amendment). Moves the SELECTED MODEL, a second axis
  //                   entirely separate from the mode highlight above — a
  //                   true no-op when the model is locked (Quick Capture, or
  //                   no bridge reachable).
  //   launch       -> bare Enter OR Ctrl+Enter — fires the highlighted mode
  //                   exactly as a click on the split button's primary region
  //                   would (p8k4d: bare Enter now launches).
  //   pass         -> ordinary typing / unmodified navigation — no interception.
  // Escape (agentic-workflow-tkq7v) is handled OUTSIDE promptBarKeyIntent's five
  // labels — it classifies 'pass' there, same as before — but is checked first
  // here to blur the textarea: the WCAG 2.1.2 keyboard-trap mitigation for
  // hijacking Tab while the field has focus. It never touches the typed prompt.
  const onPromptKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      e.currentTarget.blur();
      return;
    }
    const intent = promptBarKeyIntent(e);
    if (intent === PROMPT_KEY_INTENT.NEWLINE) {
      return;
    }
    if (intent === PROMPT_KEY_INTENT.CYCLE) {
      e.preventDefault();
      const direction = e.shiftKey ? -1 : 1;
      setHighlightedMode((current) => nextPromptModeIndex(current, direction));
      return;
    }
    if (intent === PROMPT_KEY_INTENT.CYCLE_MODEL) {
      e.preventDefault();
      if (modelLocked) return;
      setSelectedModel((current) => nextPromptModelIndex(current, 1));
      return;
    }
    if (intent === PROMPT_KEY_INTENT.LAUNCH) {
      e.preventDefault();
      fire(highlightedMode);
    }
  }, [fire, highlightedMode, modelLocked]);

  const activeMode = PROMPT_MODES[highlightedMode];
  // The ONE predicate both the Enter button's disabled state and fire()'s
  // guard consult — never re-derived independently. Since
  // agentic-workflow-aqyqd generalized the decline from Plain alone to every
  // mode, `canFire` is false whenever the prompt is blank, whichever mode is
  // highlighted; the hint text then names the decline rather than rendering
  // an (in the legacy modes' case, bare-command) or empty command string.
  const canFire = canFirePromptMode(highlightedMode, prompt);
  const enterHint = canFire
    ? `Launch ${activeMode.label} — ${activeMode.commandFor(prompt)}`
    : `Type a prompt to launch ${activeMode.label}`;

  // agentic-workflow-m2vkp: the resolved model this launch will actually run
  // on — the ONE resolver (modelForMode) both this label and fire()'s launch
  // payload consult. With no bridge reachable, a clipboard-copied command can
  // never carry --model, so the label names none ("Default") regardless of
  // mode/selection — the button is locked either way (modelLocked, above).
  const resolvedModel = PROMPT_MODELS[modelForMode(highlightedMode, selectedModel)];
  // agentic-workflow-n4qte: BOTH key off bridgeSupportsModel, not merely
  // bridge.present — this is the subtle half of the fix. Against a stale
  // bridge, bridge.present is TRUE, so a lock keyed on presence alone would
  // still render a locked button reading "Opus" and claiming "Running on
  // Opus — Ctrl+M cycles", naming a model infrastructure-v8r3q's wire
  // guarantee has already omitted from the request. "Default" is the SAME
  // word the absent-bridge case already used, deliberately: in both, no
  // model choice reaches the CLI, so the dashboard genuinely does not know
  // what the session will run on.
  const modelLabel = bridgeSupportsModel ? resolvedModel.label : "Default";
  const modelHint = !bridge.present
    ? "No bridge reachable — the launch will copy to the clipboard, which cannot carry a model choice"
    : !bridgeSupportsModel
      ? "Your VS Code bridge is running an older version — reload your VS Code window to pick up model selection."
      : isModelLockedForMode(highlightedMode)
        ? "Quick Capture always runs on Haiku"
        : `Running on ${resolvedModel.label} — Ctrl+M cycles`;
  const splitButtonTitle = `${enterHint} · ${modelHint} · Enter launches · Shift+Enter for a new line`;
  const onSelectModel = useCallback((label) => {
    const idx = PROMPT_MODELS.findIndex((m) => m.label === label);
    if (idx >= 0) setSelectedModel(idx);
  }, []);

  return html`
    <section aria-label="Author a prompt, then choose a mode to launch" style=${{
      position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)",
      width: 780, maxWidth: "calc(100vw - 40px)", zIndex: 40,
      display: "flex", flexDirection: "column",
      background: "var(--surface-1)", border: "1px solid var(--hairline-strong)",
      borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)",
    }}>
      ${/* Row 1 (agentic-workflow-q7r3x, Section 1b): the four mode tabs as
            EDGE-TO-EDGE, equal-width cells filling the panel width — no
            inter-tab gap, no horizontal panel padding on this row (the cells'
            own padding carries the breathing room). design-system-k3f7q: the
            clip that rounds the row's two end cells to the shell's corners
            lives HERE, on the tab row itself, not on the console `<section>`
            — the section used to carry `overflow: hidden` for exactly this
            reason, but that also sheared off anything absolutely positioned
            elsewhere in the section (the ModelSplitButton's open menu). The
            single committed highlight (ADR-0050) is painted per ADR-0051
            (highlighted = filled cell + ochre underline) / ADR-0016 (the rest
            dimmed). */ ""}
      <div role="tablist" aria-label="Choose how to launch the prompt" style=${{
        display: "flex", alignItems: "stretch",
        overflow: "hidden",
        borderTopLeftRadius: "var(--radius-md)", borderTopRightRadius: "var(--radius-md)",
      }}>
        ${PROMPT_MODES.map((mode, index) => html`
          <${PromptModeTab} key=${mode.id} mode=${mode}
            highlighted=${highlightedMode === index}
            flashed=${firedMode === index && feedback !== "idle"}
            feedback=${feedback}
            divider=${index < PROMPT_MODES.length - 1}
            onClick=${() => onTabClick(index)} />`)}
      </div>
      ${/* A horizontal --hairline divider separates the tab row from the input
            row (agentic-workflow-q7r3x, Section 1b). */ ""}
      <div aria-hidden="true" style=${{ height: 1, background: "var(--hairline)", flexShrink: 0 }}></div>
      ${/* Row 2: chevron + genuinely multi-line auto-growing field + the ochre
            ModelSplitButton (ADR-0048's already-licensed primed-primary-action
            carve-out, design-system-r9dtm's unforked primitive, ADR-0003). The
            old bordered ↵ hint span is GONE (agentic-workflow-m2vkp) — its
            affordance now lives in the split button's tooltip/aria-label. */ ""}
      <div style=${{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 12px" }}>
        <span aria-hidden="true" style=${{
          fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 700, color: "var(--accent-ochre)", flexShrink: 0,
        }}>❯</span>
        <textarea
          ref=${textareaRef}
          className="focusable"
          aria-label="Prompt for the launched session"
          placeholder="Type a prompt, then choose a mode to launch it…"
          rows=${1}
          value=${prompt}
          onChange=${onPromptChange}
          onKeyDown=${onPromptKeyDown}
          style=${{
            flex: 1, resize: "none", minHeight: PROMPT_FIELD_MIN_PX, maxHeight: PROMPT_FIELD_MAX_PX,
            overflowX: "hidden", overflowY: "auto",
            fontFamily: "var(--font-ui)", fontSize: 13, lineHeight: 1.5,
            color: "var(--fg-1)", background: "var(--surface-0)",
            border: "1px solid var(--hairline)", borderRadius: "var(--radius-md)",
            padding: "8px 10px",
            transition: "border-color var(--duration-fast) var(--ease-base)",
          }}
          onFocus=${(e) => { e.currentTarget.style.borderColor = "var(--hairline-strong)"; }}
          onBlur=${(e) => { e.currentTarget.style.borderColor = "var(--hairline)"; }} />
        <span title=${splitButtonTitle}>
          <${ModelSplitButton}
            label=${modelLabel}
            onClick=${() => fire(highlightedMode)}
            ariaLabel=${enterHint}
            options=${PROMPT_MODELS.map((m) => m.label)}
            value=${modelLabel}
            onSelect=${onSelectModel}
            locked=${modelLocked}
            disabled=${!canFire} />
        </span>
      </div>
      ${/* agentic-workflow-n4qte: a dismissible, session-local (ADR-0017,
            no persistence) skew banner — the general "this extension is
            stale" announcement, distinct from and broader than the model
            selector's own lock above (see bridgeSkewed's derivation). A
            builder who never opens the model selector would otherwise never
            learn his extension is stale at all: the skew silently affects
            EVERY launch's session naming too, not just the one control a
            grey-out can cover. Built board-local (no styleguide
            Banner/Alert primitive exists yet, and this is a first-time
            consumer — design-system-015's promote-on-second-consumer
            precedent), token-styled from the --obligation / --obligation-
            soft advisory-tint family (ADR-0016) rather than a hand-rolled
            color. */ ""}
      ${bridgeSkewed && !bannerDismissed ? html`
        <div role="alert" style=${{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          padding: "8px 14px",
          background: "var(--obligation-soft)", color: "var(--obligation)",
          fontFamily: "var(--font-ui)", fontSize: 12,
          borderTop: "1px solid var(--hairline)",
        }}>
          <span>${BRIDGE_SKEW_BANNER_TEXT}</span>
          <button type="button" aria-label="Dismiss" onClick=${() => setBannerDismissed(true)} style=${{
            background: "transparent", border: "none", color: "var(--obligation)",
            cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 15,
            lineHeight: 1, padding: 0, flexShrink: 0,
          }}>×</button>
        </div>` : ""}
      <${BoardConfetti} fireKey=${confettiKey} />
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

// The per-CARD todo launch (agentic-workflow-g4zce). The board's only way to start
// execution was the topbar Work button (aw-024), which launches the BARE
// `/agentheim:work` and therefore dispatches the whole ready set — that command has
// no way to name a single task. This adds the symmetric per-card affordance the
// backlog Refine/Promote pair (aw-022) already has: ONE Work launch button in the
// styleguide TicketCard's existing cornerAction render-prop slot (design-system-006),
// consumed UNFORKED (ADR-0003), seeding the SCOPED-RUN grammar ADR-0071 gives `work`
// — `/agentheim:work <id>` runs exactly that task, never the whole ready set.
//
// Styled to read like the topbar Work button (agentic-workflow-064): PRIMARY
// emphasis with a trailing up-right glyph (`Work ↗`), not the backlog pair's
// primary/quiet TWO-button group — a todo card invites exactly one action.
// Reuses launchOrCopy (bridge launch, silent clipboard fallback, ADR-0018)
// unchanged and threads the armed skipPermissions cue exactly like the backlog
// pair (aw-021/ADR-0019). The board stays a projection of disk (ADR-0001/ADR-0017)
// — this adds a launch side-effect only, no lifecycle write.
function TodoCardLaunch({ id, skipPermissions = false }) {
  return html`
    <${LaunchButton} label="Work" command=${workCommandFor(id)}
      icon="square-arrow-out-up-right" emphasis="primary" trailingIcon=${true}
      liftOnHover=${true} isolateClick=${true} skipPermissions=${skipPermissions} />`;
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
function BoardCard({ ticket, status, selectedId, onOpen, skipPermissions = false, dependencyRelation, onCardHover, renderProbe = NOOP_RENDER_PROBE }) {
  // agentic-workflow-rw6ck render probe — see NOOP_RENDER_PROBE's own comment.
  // Called unconditionally, first, so every branch below (including the early
  // doing/done return) is counted exactly once per actual React invocation.
  renderProbe.card(ticket.id);
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
  //
  // Todo cards (agentic-workflow-g4zce) carry the SYMMETRIC single-action Work
  // launch in the same slot — seeded with the scoped-run grammar ADR-0071 gives
  // `work` (`/agentheim:work <id>`, exactly that task). Doing/done cards pass no
  // cornerAction, unchanged.
  const cornerAction = status === "backlog"
    ? () => html`<${BacklogCardLaunchPair} id=${ticket.id} skipPermissions=${skipPermissions} />`
    : status === "todo"
      ? () => html`<${TodoCardLaunch} id=${ticket.id} skipPermissions=${skipPermissions} />`
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

// Memoized (agentic-workflow-rw6ck): the varying props a hover or an ordinary
// re-projection actually change are `ticket`, `selectedId`, and
// `dependencyRelation` — `onCardHover`/`onOpen` are already useCallback-stable
// board-root callbacks and `status`/`skipPermissions` are effectively static.
// Combined with board-data.js's identity-stable projection (an unchanged task
// keeps its prior `ticket` object across a re-fetch), a shallow prop compare
// is enough to skip a card whose data genuinely didn't change.
const BoardCardMemo = memo(BoardCard);

function BoardColumn({
  status, tickets, grouped,
  collapsed, onToggleSection, peek = false, onToggleCollapse,
  selectedId, onOpen, skipPermissions = false,
  waitingOn, holdingUp, onCardHover,
  targetIds, doneMarker = false, bodyRef,
  renderProbe = NOOP_RENDER_PROBE,
}) {
  // agentic-workflow-rw6ck render probe — see NOOP_RENDER_PROBE's own comment.
  renderProbe.column(status);
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
    <${BoardCardMemo} key=${t.id} ticket=${t} status=${status}
      selectedId=${selectedId} onOpen=${onOpen} skipPermissions=${skipPermissions}
      dependencyRelation=${waitingOn && waitingOn.has(t.id) ? "waiting-on" : (holdingUp && holdingUp.has(t.id) ? "holding-up" : undefined)}
      onCardHover=${onCardHover} renderProbe=${renderProbe} />`;

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

// `onToggleSection`/`onToggleCollapse` are built at the column call site
// below as inline `(x) => fn(status, x)` arrows — a FRESH function on every
// DashboardBoard render, not useCallback-wrapped there (onToggleCollapse's
// exact literal, `status === "done" ? (p) => setColumnPeek(status, p) :
// undefined`, is asserted verbatim by board-done-collapse.test.mjs AC1 and
// board-view-chip.test.mjs AC4 — this task does not touch it). A plain
// shallow-prop `React.memo` would therefore re-render EVERY column on every
// re-projection purely because of this incidental prop, regardless of
// whether that column's own tickets changed. Both closures are, in practice,
// referentially-fresh but BEHAVIORALLY IDENTICAL across renders: `status` is
// fixed for the lifetime of a given column instance (React keys it by
// `status`), and `toggleSection`/`setColumnPeek` are themselves
// useCallback-stable (empty deps) — so an "older" closure calls the exact
// same function with the exact same arguments as a "newer" one. Excluding
// just these two keys from the equality check is therefore safe, and is what
// actually lets the "two untouched columns render 0 times" criterion hold.
function boardColumnPropsEqual(prev, next) {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of keys) {
    if (key === "onToggleSection" || key === "onToggleCollapse") continue;
    if (prev[key] !== next[key]) return false;
  }
  return true;
}

// Memoized (agentic-workflow-rw6ck): a column legitimately re-renders on hover
// (it needs the fresh waitingOn/holdingUp/targetIds sets to recompute which of
// its OWN cards' dependencyRelation/section markers changed) — that cascade is
// four cheap `groupTickets`/`annotateSectionHiddenDependency` passes, not 255
// card re-renders. What this memo buys is the OTHER case: an ordinary
// structural re-projection where a column's own props (tickets included,
// via board-data.js's identity-stable projection + the board's own per-column
// sorted-array memo) are unchanged — that column, and every card inside it,
// is skipped entirely.
const BoardColumnMemo = memo(BoardColumn, boardColumnPropsEqual);

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
 * @param {{current: (HTMLElement|null)}} [scrollContainerRef] — a ref onto the
 *        app's SOLE vertical scroll container (DashboardApp's outer
 *        `scroll-quiet` region), threaded down so agentic-workflow-h9v3m's
 *        IntersectionObserver can root itself there (ADR-0033 pt. 1) instead
 *        of the browser viewport.
 */
export function DashboardBoard({ onOpen, skipPermissions = false, scrollContainerRef, renderProbe = NOOP_RENDER_PROBE }) {
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

  // BOARD-WIDE VIEW LENS — { grouped, sort } — ONE choice for the whole board
  // (agentic-workflow-c2ver, the ADR-0015 amendment landed by
  // agentic-workflow-qf945), plus the per-`(column, BC)` `collapsed[]` section
  // state and the Done column's `peek` boolean, RETAINED at their original
  // column-scoped granularity under `columns`. Both PERSIST across reloads via
  // the single versioned localStorage store (aw-014, reversing ADR-0009's
  // no-localStorage clause; supersedes aw-012's in-session-only sort). It is
  // VIEW-STATE ONLY: the board's CONTENT stays a projection of disk, re-fetched
  // on every SSE frame. A board with no stored lens defaults to flat + default
  // sort; a column with no stored state defaults to all-expanded. The order and
  // grouping are DERIVED below at render time, so every applyTree re-projection
  // (SSE structural frame / reconnect) re-applies the current choice — never resets.
  const [view, setView] = useState(() => {
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    const stored = loadViewState(storage);
    const columns = {};
    for (const c of COLUMN_ORDER) columns[c] = { ...defaultColumnState(), ...(stored.columns[c] || {}) };
    return { lens: stored.lens, columns };
  });

  // Persist on every change. A failed preference write is swallowed by the store;
  // it must never surface as a board error.
  useEffect(() => {
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    saveViewState(storage, view);
  }, [view]);

  // The ViewChip's board-wide sort choice. Drives sortTickets identically for
  // all four columns (below) — no column keeps an independent sort.
  const setLensSort = useCallback((value) => {
    setView((prev) => (prev.lens.sort === value
      ? prev
      : { ...prev, lens: { ...prev.lens, sort: value } }));
  }, []);

  // The ViewChip's board-wide group-by-context choice. Drives BoardColumn's
  // grouped prop identically for all four columns (below) — no column keeps an
  // independent grouping toggle. Flipping it never clears any column's
  // persisted `collapsed[]` (dormant retention, ADR-0015 amendment): that state
  // lives entirely under `view.columns`, untouched by this setter.
  const setLensGrouped = useCallback((grouped) => {
    setView((prev) => (prev.lens.grouped === grouped
      ? prev
      : { ...prev, lens: { ...prev.lens, grouped } }));
  }, []);

  // Collapse / expand one column to a peek (aw-m2v8d, replacing aw-072's hide).
  // Presentation-only: it flips persisted view-state `peek`, which peekClampStyle reads
  // to height-clamp the column body at render time. The column stays in the layout. No
  // /api write, no lifecycle move (ADR-0017/0001). Unaffected by the lens becoming
  // board-wide — still per-column, just re-homed under view.columns.
  const setColumnPeek = useCallback((status, peek) => {
    setView((prev) => (prev.columns[status].peek === peek
      ? prev
      : { ...prev, columns: { ...prev.columns, [status]: { ...prev.columns[status], peek } } }));
  }, []);

  // Toggle one (column, BC) section's collapse state. Stored as the list of
  // COLLAPSED BC names per column — absent = expanded (the all-expanded default).
  // Unaffected by the lens becoming board-wide — still per-column, just
  // re-homed under view.columns.
  const toggleSection = useCallback((status, bc) => {
    setView((prev) => {
      const col = prev.columns[status];
      const has = col.collapsed.includes(bc);
      const collapsed = has ? col.collapsed.filter((x) => x !== bc) : [...col.collapsed, bc];
      return { ...prev, columns: { ...prev.columns, [status]: { ...col, collapsed } } };
    });
  }, []);

  // The single board re-projection: rebuild the columns from the shared
  // live-tree hub's payload (agentic-workflow-mvt8x, ADR-0070) — the hub owns
  // the ONE /api/tree fetch for the whole tab; the board never fetches it
  // itself. Delivered once on subscribe (initial load) and again on every
  // STRUCTURAL tree-changed frame / reconnect — the board is always rebuilt
  // from disk, never mutated in place. The move's own SSE echo is just another
  // structural frame → one more re-fetch, idempotent, no double-apply
  // (ADR-0001). A fetch failure delivers `null` (hub contract) → error phase.
  //
  // agentic-workflow-rw6ck: the re-projection is a FUNCTIONAL update —
  // `treeToColumns(tree, prev)` — so the identity-stable reconcile
  // (board-data.js) sees the previous columns without a ref. An unchanged
  // tree then yields the SAME columns object (setColumns is a no-op commit);
  // a single task move yields fresh objects for only the one ticket and the
  // (at most two) columns its move touches — the mechanism the memoized
  // BoardColumn/BoardCard below depend on to skip everything else.
  const applyTree = useCallback((tree) => {
    if (!tree) {
      setColumns(EMPTY_COLUMNS);
      setPhase("error");
      return;
    }
    setColumns((prev) => treeToColumns(tree, prev));
    setPhase("ready");
  }, []);

  useLiveTree(applyTree);

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
  const donePeekCandidate = donePeekHasHiddenDependency(columns.done, targetIds, view.columns.done.peek);

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

  // agentic-workflow-rw6ck: the four sorted arrays, memoized on EACH column's
  // OWN array identity + the board-wide sort choice — not the outer `columns`
  // object's identity (which changes even when only ONE column's array
  // actually changed, since board-data.js's reconcile allocates a fresh
  // top-level object whenever any column differs). An inline
  // `sortTickets(columns[status], view.lens.sort)` computed at the
  // BoardColumn call site would hand every column a FRESH array on every
  // board render regardless of the underlying column's own identity,
  // defeating BoardColumnMemo's shallow prop compare entirely.
  //
  // A single useMemo whose dependency array is the whole `columns` object (or
  // even all four `columns[status]` arrays at once) is NOT sufficient on its
  // own: when ANY one column's array changes, the whole memo body re-runs and
  // `sortTickets` — which always returns a brand-new `.slice().sort()` array,
  // even for unchanged input — would reallocate a FRESH array for every
  // column, including the three that didn't change. `sortedColumnsRef` is a
  // small per-status cache (sourceArray + sort -> result) that survives
  // across that re-run, so a column whose underlying array/sort didn't change
  // keeps the EXACT SAME sorted-array reference even when a sibling column's
  // did — the one useMemo call the AC5 static guard (board-view-chip.test.mjs)
  // already asserts calls `sortTickets(columns[status], view.lens.sort)`.
  const sortedColumnsRef = useRef({});
  const sortedColumns = useMemo(() => {
    const prevMap = sortedColumnsRef.current;
    const nextMap = {};
    for (const status of COLUMN_ORDER) {
      const prevEntry = prevMap[status];
      nextMap[status] = (prevEntry && prevEntry.source === columns[status] && prevEntry.sort === view.lens.sort)
        ? prevEntry
        : { source: columns[status], sort: view.lens.sort, result: sortTickets(columns[status], view.lens.sort) };
    }
    sortedColumnsRef.current = nextMap;
    const out = {};
    for (const status of COLUMN_ORDER) out[status] = nextMap[status].result;
    return out;
  }, [columns.backlog, columns.todo, columns.doing, columns.done, view.lens.sort]);

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
      ${/* agentic-workflow-bz3az: BoardPromptBar is now the 1b DOCKED bottom-center
            console (position: fixed) — it no longer hosts WhatsNextPanel internally
            (that would float it inside a fixed overlay). WhatsNextPanel renders here
            instead, in-flow, above the BoardHeader count strip, exactly where the old
            "Prompt" title used to sit — unchanged DELETE-dismiss wiring (aw-vmk1z) and
            SSE re-fetch (aw-073). */ ""}
      <${WhatsNextPanel} />
      <div style=${{ paddingTop: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <${BoardHeader} count=${total} />
      </div>
      ${/* agentic-workflow-m9w5c: the live in-flight lane sits below the board header,
            above the columns. Read-only (ADR-0017) over the ADR-0043 advisory heartbeat
            artifact; self-suppresses (renders null) when absent or stale — no zombie
            lane surviving a crashed/killed work session. */ ""}
      <${InFlightLane} />
      ${/* agentic-workflow-c2ver: the "COLUMNS" section label + the single
            board-wide ViewChip that replaces the four columns' independent
            Sort + Group-by-BC controls — driving sort + group identically for
            every column below (the ADR-0015 amendment's board-wide lens). */ ""}
      <div style=${{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 4px 10px",
      }}>
        <span style=${{
          fontFamily: "var(--font-ui)", fontSize: 10.5, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)",
        }}>Columns</span>
        <${ViewChip} sort=${view.lens.sort} onSortChange=${setLensSort}
          grouped=${view.lens.grouped} onGroupToggle=${setLensGrouped} />
      </div>
      <div className="scroll-quiet" style=${{ overflowX: "auto", paddingBottom: 8 }}>
        <div style=${{ minWidth: 880 }}>
          <div style=${{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            ${COLUMN_ORDER.map((status) => html`
              <${BoardColumnMemo} key=${status} status=${status}
                tickets=${sortedColumns[status]}
                grouped=${view.lens.grouped}
                collapsed=${view.columns[status].collapsed} onToggleSection=${(bc) => toggleSection(status, bc)}
                peek=${view.columns[status].peek}
                onToggleCollapse=${status === "done" ? (p) => setColumnPeek(status, p) : undefined}
                selectedId=${selectedId} onOpen=${handleOpen} skipPermissions=${skipPermissions}
                waitingOn=${waitingOn} holdingUp=${holdingUp} onCardHover=${handleCardHover}
                targetIds=${targetIds}
                doneMarker=${status === "done" ? donePeekMarker : false}
                bodyRef=${status === "done" ? doneBodyRef : undefined}
                renderProbe=${renderProbe} />`)}
          </div>
        </div>
      </div>
      <${EdgeBlinkOverlay} scrollContainerRef=${scrollContainerRef}
        top=${Object.values(edgeBlinks).includes("above")}
        bottom=${Object.values(edgeBlinks).includes("below")} />
      ${/* The 1b docked bottom-center console (position: fixed) — rendered as a
            sibling anywhere in this tree since its own fixed positioning takes it
            out of the document flow regardless of DOM order. */ ""}
      <${BoardPromptBar} skipPermissions=${skipPermissions} />
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

// The settings-menu STOP DASHBOARD control (agentic-workflow-h4n2v, ADR-0053 —
// superseding aw-028's bridge-reuse seam). Purely presentational: it renders the
// quiet button chrome (mirroring LaunchButton's `emphasis="quiet"` idle look) and
// fires `onClick` — SettingsMenu owns the POST /api/stop call + the close-menu/
// flip-overlay sequencing (see SettingsMenu below). Unlike the old bridge-launch
// button this has no `command`, no launchOrCopy, no bridge/clipboard branching —
// POST /api/stop works identically in any browser tab, bridge present or not,
// which is the whole point of the reversal: the bridge-present/absent asymmetry
// aw-028 accepted for Stop is gone. No armed/danger cue (a stop carries no
// skip-permissions risk, unchanged from aw-028).
function StopDashboardButton({ onClick }) {
  return html`
    <button
      type="button"
      className="focusable"
      title="Stop dashboard — ends this server; safe to close the tab afterward"
      aria-label="Stop dashboard"
      onClick=${onClick}
      style=${{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontFamily: "var(--font-ui)", fontSize: 11.5, fontWeight: 500,
        color: "var(--fg-3)", background: "transparent", border: "1px solid transparent",
        borderRadius: "var(--radius-sm)", padding: "4px 9px", cursor: "pointer",
        transition: "color var(--duration-fast) var(--ease-base), background var(--duration-fast) var(--ease-base)",
      }}
      onMouseEnter=${(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--fg-1)"; }}
      onMouseLeave=${(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-3)"; }}>
      <${Icon} name="x" size=${12.5} color="var(--fg-3)" />
      <span>Stop dashboard</span>
    </button>`;
}

// ── Workflow guide visual grammar (agentic-workflow-060; reworked for clarity) ──
// Board-local helpers (NOT a design-system primitive — single consumer, content-
// bound shapes; the seam test failed at refinement). The page speaks a TWO-VOICE
// grammar — every OCHRE element is the builder's move (a phrase you say, a call
// you make); everything NEUTRAL is Agentheim's machinery or its artifacts:
//   • WNode kind="skill"    → ochre-outlined box: a skill YOU invoke by saying so.
//   • WNode kind="artifact" → neutral box: a thing Agentheim writes or moves.
//   • WYou                  → filled ochre pill ON an edge: a decision only you make.
//   • WGuard                → dashed pill ON an edge: an adversarial check by a
//                             fresh agent (verifier / research-reviewer) — never
//                             drawn as an actor box.
// RULES (from aw-060, unchanged by the rework):
//   • HTML + CSS boxes laid out with flexbox; connectors are CSS-drawn (token-styled
//     borders / pseudo-edges) — NO inline SVG, NO diagramming library, NO new bundled
//     runtime dependency.
//   • Every color / border / fill is a design-system CSS var (ADR-0003, consumed
//     UNFORKED) so the diagrams track the active light/dark theme automatically.
//   • Gates render ON edges (WYou / WGuard pills mid-connector) — never as separate
//     orchestrator / specialist / verifier / research-reviewer boxes.
//   • Static (read-only, ADR-0017): no motion by default; any motion added would be
//     wrapped behind prefers-reduced-motion. There is none today.

// A diagram NODE. `kind` tints the box from tokens — skill (ochre, the moves you
// invoke) / artifact (neutral, the things produced). `icon` names a styleguide
// Icon; `verb` is a small mono operation chip (CAPTURE / REFINE / PROMOTE /
// DISMISS); `note` is a tiny plain-language strapline under the label — the
// one-line answer to "what does this box do?".
function WNode({ kind = "skill", icon, label, verb, note }) {
  const skill = kind === "skill";
  const ink = skill ? "var(--accent-ochre)" : "var(--fg-2)";
  return html`
    <span style=${{
      display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2,
      padding: "7px 12px", borderRadius: "var(--radius-md)",
      background: skill ? "var(--accent-ochre-tint)" : "var(--surface-0)",
      border: `1px solid ${skill ? "var(--accent-ochre)" : "var(--hairline-strong)"}`,
      boxShadow: "var(--shadow-sm)",
    }}>
      <span style=${{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        ${icon ? html`<${Icon} name=${icon} size=${13} color=${ink} />` : ""}
        <span style=${{
          fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500,
          lineHeight: 1.3, whiteSpace: "nowrap", color: ink,
        }}>${label}</span>
        ${verb ? html`<span style=${{
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
          padding: "1px 5px", borderRadius: 99, whiteSpace: "nowrap", color: ink,
          border: `1px solid ${skill ? "var(--accent-ochre-soft)" : "var(--hairline)"}`,
        }}>${verb}</span>` : ""}
      </span>
      ${note ? html`<span style=${{
        fontFamily: "var(--font-ui)", fontSize: 10.5, color: "var(--fg-3)",
        whiteSpace: "nowrap",
      }}>${note}</span>` : ""}
    </span>`;
}

// The BUILDER's move, pinned ON an edge — a filled ochre pill. The one loud
// element of the page: everywhere it appears, the flow stops until you speak
// (an opening phrase) or decide (a review / an approval). There is exactly one
// human in this system, and the pill is their color.
function WYou({ children }) {
  return html`
    <span style=${{
      display: "inline-flex", alignItems: "baseline", gap: 6,
      padding: "4px 11px", borderRadius: 99,
      background: "var(--accent-ochre)", color: "var(--accent-ochre-fg)",
      fontFamily: "var(--font-mono)", fontSize: 10.5, lineHeight: 1.4,
      whiteSpace: "nowrap", boxShadow: "var(--shadow-sm)",
    }}>
      <span style=${{ fontWeight: 700, letterSpacing: "0.1em" }}>YOU</span>
      <span>${children}</span>
    </span>`;
}

// An adversarial CHECK pinned ON an edge — a fresh-context agent (verifier /
// research-reviewer) judging the work before it may pass. Dashed outline, scale
// icon, no accent: it reads as "a bar the flow must clear", never as an actor.
function WGuard({ label }) {
  return html`
    <span style=${{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 99,
      border: "1px dashed var(--hairline-strong)", color: "var(--fg-3)",
      fontFamily: "var(--font-mono)", fontSize: 10, whiteSpace: "nowrap",
      background: "var(--surface-1)",
    }}>
      <${Icon} name="scale" size=${11} color="var(--fg-3)" />
      <span>${label}</span>
    </span>`;
}

// A CSS-drawn connector. `dir` = "down" | "right"; `tone` "default" | "fail"
// (the re-dispatch loop) colors the line; `dashed` marks a loop-back edge. When
// a `mid` slot (a WYou / WGuard pill) or a `label` is given, the line SPLITS
// around it — the pill sits mid-edge, which is the whole grammar: gates live on
// edges, not in boxes. The arrowhead is a rotated bordered pseudo-box (no SVG).
function WArrow({ dir = "down", tone = "default", dashed = false, mid, label }) {
  const color = tone === "fail" ? "var(--obligation)" : "var(--hairline-strong)";
  const down = dir === "down";
  const stroke = `1.5px ${dashed ? "dashed" : "solid"} ${color}`;
  const seg = (len) => down
    ? { width: 0, minHeight: len, borderLeft: stroke }
    : { height: 0, minWidth: len, borderTop: stroke };
  const head = {
    width: 6, height: 6, borderRight: `1.5px solid ${color}`, borderBottom: `1.5px solid ${color}`,
    transform: down ? "rotate(45deg)" : "rotate(-45deg)", flexShrink: 0,
    marginTop: down ? -4 : 0, marginLeft: down ? 0 : -4,
  };
  const midContent = mid || (label ? html`<span style=${{
    fontFamily: "var(--font-mono)", fontSize: 9.5, whiteSpace: "nowrap",
    color: tone === "fail" ? "var(--obligation)" : "var(--fg-3)",
  }}>${label}</span>` : null);
  return html`
    <span aria-hidden="true" style=${{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      flexDirection: down ? "column" : "row", gap: midContent ? 5 : 0,
    }}>
      ${midContent ? html`
        <span style=${seg(down ? 10 : 14)} />
        ${midContent}
      ` : ""}
      <span style=${{ display: "inline-flex", alignItems: "center", flexDirection: down ? "column" : "row" }}>
        <span style=${seg(midContent ? (down ? 10 : 14) : (down ? 18 : 26))} />
        <span style=${head} />
      </span>
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
// labelled section that frames the segment's title + ordinal + `when` cadence chip
// (once per project / any time / when tasks are ready — the newcomer's "when do I
// do this?" answered in the header), hosts the hand-authored flow DIAGRAM (passed
// as `diagram`, with a faithful `diagramLabel` describing the real flow), and
// renders the supporting caption beneath. Presentation only — the honest,
// skill-accurate copy lives inline in WorkflowPage's children, so the verifier can
// check the prose there. Composed from styleguide tokens consumed UNFORKED
// (ADR-0003); honors light/dark by token.
//
// `gate` is the segment's explicit human-in-the-loop marker (ADR-0017 / vision
// non-goal 3: the human stays in the loop at every gate). The diagram is a static
// HTML+CSS visual (aw-060) inside a `role="img"` frame — inert and read-only (no
// fetch, no write). Its `aria-label` summarizes the real flow (the visual is
// decorative-structural; the prose remains the captions beneath).
function WorkflowSegment({ ordinal, title, when, gate, diagram, diagramLabel, children }) {
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
        ${when ? html`<span style=${{
          marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9.5,
          letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-3)",
          padding: "3px 9px", borderRadius: 99, border: "1px solid var(--hairline)",
          whiteSpace: "nowrap",
        }}>${when}</span>` : ""}
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

// ── The three hand-authored segment diagrams (agentic-workflow-060; reworked) ──
// Each takes the HONEST shape of its real flow — the three topologies differ on
// purpose (not a uniform left-to-right lane). Built from WNode / WYou / WGuard /
// WArrow / WFanRow above. Every diagram OPENS with a WYou pill quoting the phrase
// that starts the phase — a newcomer reads each one as "I say this → this happens".

// Segment 1 — PREPARE: linear, then fan-out. You say what you want to build;
// brainstorm runs the no-code Socratic dialogue and writes vision.md +
// context-map.md; after you approve the vision, the foundation pass fans out
// into the four foundation outputs.
function PreparationDiagram() {
  return html`
    <span style=${{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      fontFamily: "var(--font-ui)",
    }}>
      <${WYou}>"I want to build …"</${WYou}>
      <${WArrow} dir="down" />
      <${WNode} kind="skill" icon="lightbulb" label="brainstorm" note="a Socratic dialogue — no code" />
      <${WArrow} dir="down" />
      <span style=${{ display: "flex", gap: 10 }}>
        <${WNode} kind="artifact" icon="file-text" label="vision.md" />
        <${WNode} kind="artifact" icon="file-text" label="context-map.md" />
      </span>
      <${WArrow} dir="down" mid=${html`<${WYou}>approve the vision</${WYou}>`} />
      <${WFanRow}>
        <${WNode} kind="artifact" label="infrastructure BC" />
        <${WNode} kind="artifact" label="foundation tasks" />
        <${WNode} kind="artifact" label="walking skeleton" />
        <${WNode} kind="artifact" label="styleguide" />
      </${WFanRow}>
    </span>`;
}

// Segment 2 — CAPTURE & REFINE: two intake doors converge on the backlog; the
// shaping operations (modeling REFINE, research past the research-reviewer
// check, modeling DISMISS) live in a dashed "while it waits" panel attached
// under the backlog node — an in-place loop, not a forward edge.
function CapturingDiagram() {
  return html`
    <span style=${{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      fontFamily: "var(--font-ui)",
    }}>
      <${WYou}>"I have an idea" · "there's a bug"</${WYou}>
      <${WArrow} dir="down" />
      <span style=${{ display: "flex", gap: 12 }}>
        <${WNode} kind="skill" icon="inbox" label="quick-capture" note="fast — files it raw" />
        <${WNode} kind="skill" icon="message-circle-question" label="modeling" verb="CAPTURE" note="asks questions as it writes" />
      </span>
      <${WArrow} dir="down" />
      <${WNode} kind="artifact" icon="folder" label="backlog/" />
      <span style=${{
        marginTop: 12, display: "flex", flexDirection: "column", gap: 8,
        padding: "10px 14px", borderRadius: "var(--radius-md)",
        border: "1px dashed var(--hairline-strong)",
      }}>
        <span style=${{
          fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "var(--fg-3)", textAlign: "center",
        }}>⟲ while it waits — shape it, as often as needed</span>
        <span style=${{
          display: "flex", flexWrap: "wrap", justifyContent: "center",
          alignItems: "flex-start", gap: 10,
        }}>
          <${WNode} kind="skill" icon="message-circle-question" label="modeling" verb="REFINE" note="a dialogue with you" />
          <span style=${{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <${WNode} kind="skill" icon="flask-conical" label="research" note="imports outside knowledge" />
            <${WGuard} label="research-reviewer" />
          </span>
          <${WNode} kind="skill" icon="trash-2" label="modeling" verb="DISMISS" note="deletes dead ideas + subtree" />
        </span>
      </span>
    </span>`;
}

// Segment 3 — PROMOTE & WORK: a pipeline with a retry loop, opening with the
// PLANNING moment. whats-next (advisory only — it recommends, never moves a
// task) sits before modeling PROMOTE, at the where-do-I-pick-up decision point
// (agentic-workflow-q3n7k). Then modeling PROMOTE (backlog → todo) → the
// review-then-launch WYou pill → work (parallel TDD workers) → verifier pill on
// the edge → commit. The FAIL → re-dispatch (×2) → escalate loop sits beside
// the verifier edge.
function PromoteWorkDiagram() {
  return html`
    <span style=${{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      fontFamily: "var(--font-ui)",
    }}>
      <${WYou}>"what's next?"</${WYou}>
      <${WArrow} dir="down" />
      <${WNode} kind="skill" icon="compass" label="whats-next" note="recommends — never moves a task" />
      <${WArrow} dir="down" />
      <span style=${{ display: "flex", alignItems: "center", gap: 8 }}>
        <${WNode} kind="skill" icon="message-circle-question" label="modeling" verb="PROMOTE" note="readiness check" />
        <${WArrow} dir="right" label="backlog → todo" />
        <${WNode} kind="artifact" icon="square-kanban" label="todo/" />
      </span>
      <${WArrow} dir="down" mid=${html`<${WYou}>review todo · "start working"</${WYou}>`} />
      <${WNode} kind="skill" icon="bot" label="work" note="parallel TDD workers" />
      <span style=${{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <${WArrow} dir="down" mid=${html`<${WGuard} label="verifier" />`} />
        <span style=${{
          position: "absolute", left: "100%", top: "50%", transform: "translateY(-50%)",
          marginLeft: 10, fontFamily: "var(--font-mono)", fontSize: 9.5,
          color: "var(--obligation)", whiteSpace: "nowrap",
        }}>FAIL → re-dispatch ×2 → escalate to you</span>
      </span>
      <${WNode} kind="artifact" icon="git-commit-horizontal" label="commit" note="one task = one commit" />
    </span>`;
}

// ── The at-a-glance loop map (workflow-page rework) ─────────────────────────
// The hero of the guide: three equal phase cards — 01 runs once, 02/03 are the
// standing loop — joined left-to-right, with a CSS-drawn dashed return edge from
// 03 back under 02 ("ship, then capture the next idea"). Pure orientation: a
// newcomer reads the whole system here before any detail. Same rules as the
// segment diagrams (tokens unforked, no SVG, no motion, read-only).
function WorkflowMapCard({ ordinal, icon, title, when, summary }) {
  return html`
    <span style=${{
      flex: "1 1 0", minWidth: 168, display: "flex", flexDirection: "column", gap: 5,
      padding: "12px 14px", borderRadius: "var(--radius-md)",
      background: "var(--surface-0)", border: "1px solid var(--hairline-strong)",
      boxShadow: "var(--shadow-sm)",
    }}>
      <span style=${{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style=${{
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)",
          fontFeatureSettings: '"tnum"',
        }}>${ordinal}</span>
        <${Icon} name=${icon} size=${13} color="var(--accent-ochre)" />
        <span style=${{
          fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600,
          color: "var(--fg-1)", whiteSpace: "nowrap",
        }}>${title}</span>
      </span>
      <span style=${{
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--fg-3)",
      }}>${when}</span>
      <span style=${{
        fontFamily: "var(--font-ui)", fontSize: 11.5, lineHeight: 1.5, color: "var(--fg-2)",
      }}>${summary}</span>
    </span>`;
}

function WorkflowMap() {
  return html`
    <span style=${{ display: "flex", flexDirection: "column", minWidth: 620, width: "100%" }}>
      <span style=${{ display: "flex", alignItems: "stretch", gap: 8 }}>
        <${WorkflowMapCard} ordinal="01" icon="lightbulb" title="Prepare"
          when="once per project"
          summary="Talk the idea into a vision and bounded contexts — before any code." />
        <span style=${{ alignSelf: "center" }}><${WArrow} dir="right" /></span>
        <${WorkflowMapCard} ordinal="02" icon="inbox" title="Capture & refine"
          when="any time"
          summary="Drop every idea into the backlog; shape it until it's buildable." />
        <span style=${{ alignSelf: "center" }}><${WArrow} dir="right" /></span>
        <${WorkflowMapCard} ordinal="03" icon="bot" title="Promote & work"
          when="when tasks are ready"
          summary="Promote to todo, launch parallel workers, ship checked commits." />
      </span>
      <span aria-hidden="true" style=${{ display: "flex", height: 30, marginTop: 2 }}>
        <span style=${{ flex: "1 1 0", minWidth: 168 }} />
        <span style=${{ flex: "2 1 0", position: "relative", margin: "0 70px 8px 70px" }}>
          <span style=${{
            position: "absolute", inset: 0,
            borderLeft: "1.5px dashed var(--hairline-strong)",
            borderRight: "1.5px dashed var(--hairline-strong)",
            borderBottom: "1.5px dashed var(--hairline-strong)",
            borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
          }} />
          <span style=${{
            position: "absolute", left: -3.5, top: -2, width: 6, height: 6,
            borderLeft: "1.5px solid var(--hairline-strong)",
            borderTop: "1.5px solid var(--hairline-strong)",
            transform: "rotate(45deg)",
          }} />
          <span style=${{
            position: "absolute", left: "50%", bottom: -7, transform: "translateX(-50%)",
            background: "var(--surface-1)", padding: "0 8px",
            fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)",
            whiteSpace: "nowrap",
          }}>ship, then capture the next idea</span>
        </span>
      </span>
    </span>`;
}

// The how-to-read key under the map — one live sample of each grammar element
// with a plain-language label. This legend is what makes the ochre-vs-neutral
// two-voice encoding legible without being explained in prose.
function WorkflowLegend() {
  const item = (sample, text) => html`
    <span style=${{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      ${sample}
      <span style=${{
        fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--fg-3)",
        whiteSpace: "nowrap",
      }}>${text}</span>
    </span>`;
  return html`
    <div aria-label="How to read the diagrams" style=${{
      display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center",
      columnGap: 20, rowGap: 8,
    }}>
      ${item(html`<${WNode} kind="skill" label="skill" />`, "you invoke it by saying so")}
      ${item(html`<${WNode} kind="artifact" label="artifact" />`, "Agentheim writes it")}
      ${item(html`<${WYou}>decide</${WYou}>`, "a call only you make")}
      ${item(html`<${WGuard} label="check" />`, "a fresh agent judges the work")}
    </div>`;
}

// The built-in WORKFLOW guide page (agentic-workflow-058 routing scaffold; real
// three-segment layout + caption copy added by agentic-workflow-059; diagrams by
// aw-060; whats-next + inquire added by agentic-workflow-q3n7k; reworked for
// first-time comprehension — at-a-glance loop map + legend + two-voice diagrams
// + cut-down captions). Governed by ADR-0025.
//
// The page answers a newcomer's three questions in order: WHAT IS THE SHAPE
// (the WorkflowMap hero: 01 Prepare once, then the 02↔03 standing loop), HOW DO
// I READ THE DETAIL (the WorkflowLegend key), and WHAT HAPPENS IN EACH PHASE
// (three named segments — Prepare, Capture & refine, Promote & work — each a
// hand-authored HTML+CSS diagram that OPENS with the phrase you say, above one
// or two short honest captions and an explicit Gate line). The copy names the
// real skills/verbs (brainstorm, quick-capture, modeling, research, work) and
// the real adversarial gates (verifier, research-reviewer), shows quick-capture
// AND modeling as two distinct intake doors, includes DISMISS, and marks the
// human-in-the-loop gates (no-code brainstorm, review before work, escalation
// to the builder after repeated verification failure). Promote & work opens
// with `whats-next` (advisory-only, agentic-workflow-q3n7k) at the planning
// moment, before modeling PROMOTE. A fourth, un-numbered "Any time" note below
// the three segments names `inquire` — a read-only lens that sits outside the
// flow and is usable at any point, never appended into a segment's skill list.
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
          You describe what you want and make every call that matters; Agentheim's
          agents model, build, and check the work in between. Phase 01 runs once per
          project — 02 and 03 are the loop you live in.
        </p>
      </header>

      <div style=${{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          role="img"
          aria-label="The Agentheim loop at a glance: phase 01 Prepare runs once per project; phase 02 Capture and refine, and phase 03 Promote and work, repeat as a standing loop — ship, then capture the next idea."
          style=${{
            display: "flex", padding: "20px 16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-1)",
            overflowX: "auto",
          }}>
          <${WorkflowMap} />
        </div>
        <${WorkflowLegend} />
      </div>

      <${WorkflowSegment}
        ordinal=${1}
        title="Prepare"
        when="once per project"
        diagram=${html`<${PreparationDiagram} />`}
        diagramLabel="Prepare flow: you say what you want to build; the brainstorm skill runs a no-code Socratic dialogue and writes the vision.md and context-map.md artifacts; after you approve the vision, a foundation pass fans out into the infrastructure bounded context, the foundation decision tasks, a walking-skeleton spike, and the styleguide."
        gate=${html`No code is written here. You approve the vision and the bounded contexts before anything is stood up.`}>
        <${WorkflowCaption}>
          <${Wcode}>brainstorm</${Wcode}> questions the idea until it holds, then writes
          <${Wcode}> vision.md</${Wcode}> and <${Wcode}>context-map.md</${Wcode}>. A
          foundation pass stands up the <strong>infrastructure</strong> bounded context,
          the first decision tasks, a <strong>walking-skeleton spike</strong> — and, for
          frontends, the styleguide.
        </${WorkflowCaption}>
      </${WorkflowSegment}>

      <${WorkflowSegment}
        ordinal=${2}
        title="Capture & refine"
        when="any time"
        diagram=${html`<${CapturingDiagram} />`}
        diagramLabel="Capture and refine flow: your ideas enter through two doors — quick-capture, which files the raw thought, and modeling CAPTURE, which asks questions as it writes — both landing in the backlog. While a task waits there, modeling REFINE shapes it with you, research imports outside knowledge past the research-reviewer check, and modeling DISMISS deletes dead ideas."
        gate=${html`Nothing leaves the backlog on its own. You drive refinement, and only you decide what gets promoted.`}>
        <${WorkflowCaption}>
          Two doors into <${Wcode}>backlog/</${Wcode}>: <${Wcode}>quick-capture</${Wcode}> files
          the raw thought and gets out of your way; <${Wcode}>modeling</${Wcode}> CAPTURE
          asks questions while it writes.
        </${WorkflowCaption}>
        <${WorkflowCaption}>
          While a task waits, <${Wcode}>modeling</${Wcode}> REFINE shapes it until it is
          buildable, <${Wcode}>research</${Wcode}> imports outside knowledge — citable only
          after the <${Wcode}>research-reviewer</${Wcode}> passes it — and
          <${Wcode}> modeling</${Wcode}> DISMISS deletes dead ideas with their dependent
          subtree.
        </${WorkflowCaption}>
      </${WorkflowSegment}>

      <${WorkflowSegment}
        ordinal=${3}
        title="Promote & work"
        when="when tasks are ready"
        diagram=${html`<${PromoteWorkDiagram} />`}
        diagramLabel="Promote and work flow: whats-next recommends the next move, advisory only; modeling PROMOTE moves a task from backlog to todo; you review todo and say start working; the work skill dispatches parallel TDD workers; a verifier judges every result before commit — a FAIL is re-dispatched up to twice, then escalates to you. Every passing task becomes exactly one commit."
        gate=${html`You review <${Wcode}>todo</${Wcode}> before launching; the <${Wcode}>verifier</${Wcode}> guards every commit — a task that keeps failing escalates to you instead of shipping plausible-but-wrong work.`}>
        <${WorkflowCaption}>
          <${Wcode}>whats-next</${Wcode}> reads the boards and recommends one next move —
          advisory only. <${Wcode}>modeling</${Wcode}> PROMOTE runs a readiness check and
          moves the task <${Wcode}>backlog → todo</${Wcode}>.
        </${WorkflowCaption}>
        <${WorkflowCaption}>
          <${Wcode}>work</${Wcode}> resolves dependencies and dispatches <strong>parallel
          TDD workers</strong>. Every SUCCESS faces a fresh-context
          <${Wcode}> verifier</${Wcode}> before commit — <strong>one task = one
          commit</strong>.
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
          <${Wcode}>inquire</${Wcode}> works at any point, outside the three phases: ask
          how something works, what was decided, or whether it's built yet, and it answers
          from the project's own memory (index, READMEs, ADRs, boards), checked against
          the source. Read-only — it never edits code, moves a task, or commits.
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
//   → divider → "Workspace" label (uppercased to read WORKSPACE, the 1a tree header)
//   → the LIVE library tree, fed by treeToLibrary(/api/tree) (never the demo data)
//   → a FOOTER STATUS LINE (agentic-workflow-wsfsk, 1a shape) — a compact
//     "all clear · N done" summary below the tree, computed by the pure
//     library-data.footerStatusLine off the same cuedGroups projection (the
//     theme + skip-permissions toggles that USED to live in this footer moved
//     into the topbar settings menu, aw-029 → aw-049; this is a fresh footer).
//
// The rail is 236px wide — the 1a single-panel shape (a wider 1b split
// icon-rail + tree was considered and not chosen).
//
// The rail is a discovery surface, so it stays LIVE the same way the board does: it
// fetches /api/tree on mount and re-fetches on every SSE tree-changed frame /
// reconnect (useLiveTree), re-projecting via treeToLibrary. Read-only throughout
// (ADR-0017): clicking a non-task row emits the open-intent the shell routes — a
// non-task document now opens in the MAIN PANE (aw-027), so the rail's selected
// edge follows the selected DOCUMENT (`selectedId`, fed from selectedDoc), and the
// Board RailItem returns the main pane to the board (onSelectBoard) and is `active`
// exactly when no document is selected.
function RailNavSlot({ active, children }) {
  // ADR-0048 CARVE-OUT (surface 5, "left-nav active item"): primary-nav "you
  // are here" is, by the fires/commits test, a PASSIVE equivalent-state
  // selection — exactly the case ADR-0016 forbids ochre on. ADR-0048 grants
  // this ONE surface a bounded wayfinding exception (the builder's 1a ochre
  // inset rail, 2026-07-05) specifically because primary nav is scanned far
  // more often and far more peripherally than any other peer-selection
  // surface in the app. Do NOT read this as license to "fix" it back to
  // de-emphasis, and do NOT copy this pattern onto any other selection
  // surface (tabs, segmented controls, list rows) — each of those stays
  // governed by ADR-0016's de-emphasis default unless it earns its own
  // fresh ADR.
  return html`
    <div style=${{
      borderRadius: "var(--radius-sm)",
      boxShadow: active ? "inset 2px 0 0 var(--accent-ochre)" : "none",
    }}>${children}</div>`;
}

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

  // Re-project the rail tree from the shared live-tree hub's payload
  // (agentic-workflow-mvt8x, ADR-0070 — the non-task half, treeToLibrary). A
  // failed fetch (hub delivers `null`) leaves the tree empty rather than
  // crashing the rail — the board's own error state already reports an
  // unreachable server. On every (re)projection we ALSO recompute the
  // research/ADR mtime index (aw-t3b9k) and, on the FIRST landed projection,
  // freeze it as the session baseline — so the very docs present at load
  // never blink, only ones that arrive/change afterwards do. The rail is a
  // STRUCTURAL subscriber, so it is delivered the tree on subscribe (initial
  // load) and again on every structural frame / reconnect — never on an
  // advisory or runtime frame, so a heartbeat write no longer re-projects it.
  const applyTree = useCallback((tree) => {
    setGroups(tree ? treeToLibrary(tree) : []);
    const index = tree ? railMtimeIndex(tree) : {};
    // Capture the baseline exactly once, off the first projection that lands
    // (even an empty one — a fresh page has no "new" artifacts by definition).
    if (baselineRef.current === null) baselineRef.current = index;
    setCurrentIndex(index);
  }, []);
  useLiveTree(applyTree);

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

  // The footer status line (agentic-workflow-wsfsk): a compact "all clear · N
  // done" summary rendered below the tree, computed by the pure
  // library-data.footerStatusLine off the SAME cuedGroups projection the tree
  // already renders — no separate fetch, and loss-tolerant by construction (a
  // missing Decisions group / empty groups degrades to "all clear", never a
  // throw or an empty footer).
  const footerStatus = footerStatusLine(cuedGroups);

  return html`
    <nav style=${{
      width: 236, flexShrink: 0, alignSelf: "stretch", boxSizing: "border-box",
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
        <${RailNavSlot} active=${mainView === "board" && !selectedId}>
          <${RailItem} icon="square-kanban" label="Board"
            active=${mainView === "board" && !selectedId}
            onClick=${() => onSelectBoard && onSelectBoard()} />
        </${RailNavSlot}>
        <${RailNavSlot} active=${mainView === "workflow"}>
          <${RailItem} icon="compass" label="Workflow"
            active=${mainView === "workflow"}
            onClick=${() => onSelectWorkflow && onSelectWorkflow()} />
        </${RailNavSlot}>
        <${RailNavSlot} active=${mainView === "about"}>
          <${RailItem} icon="bot" label="About"
            active=${mainView === "about"}
            onClick=${() => onSelectAbout && onSelectAbout()} />
        </${RailNavSlot}>
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

      <!-- Footer status line (1a shape) — see footerStatus above; pinned below the
           scrollable tree region (a sibling, not part of its overflow: auto), so it
           never scrolls out of view. -->
      <div style=${{
        padding: "9px 16px", borderTop: "1px solid var(--hairline)",
        fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)",
      }}>${footerStatus}</div>
    </nav>`;
}

// The post-stop "Dashboard stopped" overlay (agentic-workflow-028, truthful-on-2xx
// as of agentic-workflow-h4n2v / ADR-0053). A board-local, token-matched full-pane
// cover over the MAIN CONTENT AREA (absolutely filling the relatively-positioned
// content wrapper) — NOT a styleguide primitive: there is no full-screen modal in
// the styleguide and the Drawer is a side panel, so this is composed from existing
// tokens (ADR-0003, consumed unforked). It is the honest end state: the page is now
// talking to a server that is shutting down, so the board below is covered and the
// only message is that it is safe to close the tab. Rendered on a 2xx from
// POST /api/stop — no bridge involved any more, so it renders identically in ANY
// browser tab, with or without the bridge (the aw-028 bridge-present/absent
// asymmetry for Stop is gone).
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
// controls — Stop dashboard (aw-028, reversed to a direct server call by
// aw-h4n2v / ADR-0053), the theme toggle (aw-017) and the skip-permissions armed
// toggle (aw-021) — behind a single settings GEAR. Only the Work launch stays a
// standing topbar button; the gear sits immediately to its left.
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
// armed/danger treatment + skip-permissions-state.js persistence. Stop dashboard is
// the one EXCEPTION to "as-is" — aw-h4n2v reverses aw-028's bridge-reuse seam
// (superseded): it now POSTs the scoped runtime self-lifecycle endpoint
// POST /api/stop (ADR-0053, amending ADR-0017/ADR-0046) directly, no spawned
// session, no bridge/clipboard branching — a click stops the dashboard in ANY
// browser tab, and the post-stop StoppedOverlay flips truthfully on the 2xx
// response rather than optimistically on bridge dispatch.
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
  // popover programmatically when Stop dashboard succeeds. Esc / outside-click
  // dismissal still come from the primitive via onOpenChange.
  const [open, setOpen] = useState(false);

  // Selecting Stop dashboard POSTs /api/stop directly (ADR-0053 — no bridge, no
  // spawned session), closes the menu, THEN flips the shell-stopped overlay ONLY on
  // a truthful 2xx (a failed/unreachable POST stopped nothing → no overlay). Closing
  // first keeps the popover from lingering over the overlay that replaces the board.
  const onStopClick = useCallback(() => {
    const fetchImpl = typeof window !== "undefined" && typeof window.fetch === "function"
      ? window.fetch.bind(window)
      : undefined;
    if (!fetchImpl) { setOpen(false); return; }
    fetchImpl("/api/stop", { method: "POST" }).then(
      (res) => {
        setOpen(false);
        if (res && res.ok && typeof onStopped === "function") onStopped();
      },
      () => { setOpen(false); }, // network error / server already gone: close quietly, no overlay lie.
    );
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
      <!-- Stop dashboard (ADR-0053) — POSTs /api/stop directly; selecting it CLOSES
           the menu (controlled), then shows the stopped overlay on a truthful 2xx. -->
      <${MenuItem} style=${centeredItem}>
        <${StopDashboardButton} onClick=${onStopClick} />
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
        ${/* aw-064/aw-vk6mc: the "What's next" standing launch sits between the quiet
              gear and the primary Work. It fires the interim raw WHATS_NEXT_COMMAND
              prompt through the same launchOrCopy path (bridge → terminal; silent
              clipboard fallback, ADR-0018), threading the armed skipPermissions cue,
              passing NO onResult — a read-only next-steps overview, no lifecycle
              write (ADR-0017). The sun glyph is consumed unforked from the styleguide
              registry (ADR-0003). Recolored to the ochre CTA treatment (emphasis
              "cta") per ADR-0048's accent carve-out: this button FIRES the
              whats-next skill (a primed primary action), which is exactly the case
              ADR-0048 distinguishes from the passive equivalent-state selection
              ADR-0016 forbids ochre on — this is NOT a reopening of ADR-0016. No
              liftOnHover here: the ochre CTA fill is a persistent idle treatment,
              not the quiet-until-hover chrome liftOnHover normalises everything
              else to. */ ""}
        <${LaunchButton} label="What's next" command=${WHATS_NEXT_COMMAND}
          icon="sun" emphasis="cta" large=${true} skipPermissions=${skipPermissions} />
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

  // The shell-level "stopped" state (aw-028, reversed to a direct server call by
  // aw-h4n2v / ADR-0053). The topbar's quiet Stop dashboard control calls onStopped
  // ONLY when POST /api/stop resolved 2xx — the server this page talks to has ended
  // its own process (runtime self-lifecycle write, ADR-0053) and removed its own
  // runfile. We then render a full-pane "Dashboard stopped — safe to close this tab"
  // overlay over the main content area. This is TRUTHFUL-ON-2xx, not optimistic: the
  // request/response round-trip IS the confirmation, no bridge dispatch to trust. A
  // failed/unreachable POST stopped nothing, so it never reaches here — no overlay,
  // menu just closes quietly. The overlay is board-local and token-matched
  // (ADR-0003); there is no full-screen modal primitive and the Drawer is a side
  // panel, not used here. It also now renders identically with NO bridge present
  // (the aw-028 bridge-present/absent asymmetry for Stop is gone).
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
