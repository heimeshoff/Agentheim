/* ============================================================
   Agentheim — Search field + grouped-results combobox
   (design-system-016)

   The dashboard's global-search affordance: a token-styled text
   input that, as you type, opens a floating panel of results
   GROUPED by category (Bounded contexts → Decisions → Research →
   Tickets), each row a title plus a matched-text excerpt, walked by
   up/down arrows and chosen by Enter or click. Factored into the
   styleguide so the dashboard global-search UI (agentic-workflow-052)
   consumes it UNFORKED across the BC boundary (ADR-0003) instead of
   inventing token-drifting search chrome board-side.

   STANDALONE, not composed on ds-015's Menu (refine 2026-06-16): a
   combobox keeps focus IN THE INPUT and highlights rows via
   `aria-activedescendant`, whereas the Menu moves focus INTO its
   items — wholesale reuse would fight that primitive. So this owns
   its OWN floating panel + outside-click/Esc dismiss machinery. It
   matches ds-015's Popover elevation by CONVENTION — same
   `--shadow-md`, `--surface-1`, `--hairline`, `--radius-md` — so the
   two read identically WITHOUT sharing code. (If a third popover-ish
   consumer appears, the dismiss machinery becomes an extraction
   candidate — out of scope here.)

   The token-styled text INPUT is the styleguide's first input
   control. It stays SCOPED to this module (refine 2026-06-16): a
   general `Input` primitive waits for a SECOND consumer, per the
   BC's "promote when the second consumer appears" doctrine (ds-005
   Collapsible, ds-015 Menu).

   BODY-AGNOSTIC / data-driven (the ds-006 cornerAction / ds-005
   Collapsible "styleguide owns the look, consumer drives behavior"
   seam): the consumer supplies the grouped result data + a `term` to
   mark + an `onSelect` callback. The styleguide owns the look,
   placement, and keyboard mechanics; the consumer owns the data and
   what selection DOES. The pattern never calls /api/search itself —
   it is fed (agentic-workflow-050 is that backend, aw-052 the wiring).

   The load-bearing decisions are pure (search-state.js), testable
   under `node --test` without the canvas import map.

   Authored with htm tagged templates, no JSX (ADR-0005).
   ============================================================ */
import { useState, useEffect, useRef, useMemo, useCallback, useId } from "react";
import { html } from "./html.js";
import { Icon } from "./icons.js";
import {
  flattenGroups, resultCount, panelState,
  nextActiveIndex, activeDescendantId, arrowDirection,
  isDismissKey, isSelectKey, shouldDismissOnOutsideClick, markMatches,
} from "./search-state.js";

// Re-export the pure resolutions so consumers can import either entrypoint; the
// decisions themselves live React-free in search-state.js (testable without the
// canvas import map).
export {
  flattenGroups, resultCount, panelState,
  nextActiveIndex, activeDescendantId, arrowDirection,
  isDismissKey, isSelectKey, shouldDismissOnOutsideClick, markMatches,
};

// One excerpt line: the matched snippet with the term marked. Pure presentation
// over markMatches' segments — a styled <mark> for the hit, neutral text around.
function Excerpt({ excerpt, term }) {
  const segments = markMatches(excerpt, term);
  return html`
    <span style=${{
      display: "block", marginTop: 2,
      fontFamily: "var(--font-ui)", fontSize: 11.5, lineHeight: 1.45, color: "var(--fg-3)",
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    }}>
      ${segments.map((seg, i) => seg.marked
        ? html`<mark key=${i} style=${{
            background: "var(--accent-ochre-soft)", color: "var(--fg-1)",
            borderRadius: 2, padding: "0 1px",
          }}>${seg.text}</mark>`
        : html`<span key=${i}>${seg.text}</span>`)}
    </span>`;
}

/**
 * The search-field + grouped-results combobox.
 *
 * @param {object} props
 * @param {Array<{label: string, items: any[]}>} props.groups — the result groups
 *        (e.g. Bounded contexts / Decisions / Research / Tickets). Each item is
 *        opaque; `getTitle` / `getExcerpt` read it. The consumer supplies these,
 *        already ranked/filtered for the current query (the styleguide does not
 *        fetch or rank — it is fed; ds-006 / ds-005 seam).
 * @param {string} props.value — the controlled input value (the query).
 * @param {(next: string) => void} props.onChange — fired on every keystroke with
 *        the next query (the consumer refetches / refilters and feeds new groups).
 * @param {(item: any, ctx: {groupLabel: string, index: number}) => void} props.onSelect
 *        — fired when a row is chosen (Enter on the highlight, or a click). The
 *        consumer owns what selection DOES (routing, etc.).
 * @param {(item: any) => string} [props.getTitle] — read a row's title line.
 * @param {(item: any) => string} [props.getExcerpt] — read a row's matched
 *        excerpt sub-line (optional per row).
 * @param {string} [props.placeholder="Search…"] — input placeholder.
 * @param {string} [props.ariaLabel="Search"] — accessible label for the input.
 * @param {string} [props.noResultsLabel] — the no-results line text.
 * @param {object} [props.style] — style overrides merged onto the root wrapper.
 * @param {object} [props.panelStyle] — style overrides merged onto the panel.
 */
export function SearchField({
  groups = [],
  value = "",
  onChange,
  onSelect,
  getTitle = (it) => (it && (it.title ?? it.label ?? it.id)) || "",
  getExcerpt = (it) => (it && it.excerpt) || "",
  placeholder = "Search…",
  ariaLabel = "Search",
  noResultsLabel,
  style,
  panelStyle,
}) {
  const reactId = useId();
  const idPrefix = `agh-search-${reactId.replace(/[:]/g, "")}`;
  const listboxId = `${idPrefix}-listbox`;

  const flat = useMemo(() => flattenGroups(groups, idPrefix), [groups, idPrefix]);
  const count = flat.length;
  const state = panelState(value, count); // "closed" | "no-results" | "results"
  const open = state !== "closed";

  const [active, setActive] = useState(-1);
  const rootRef = useRef(null);

  const reduce = typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(false);

  // When the query (and so the result set) changes, the old highlight index can
  // point at a vanished row — reset it. The combobox opens with NO row
  // pre-highlighted; the first ArrowDown lands on the first row.
  useEffect(() => { setActive(-1); }, [value]);

  const close = useCallback(() => {
    setActive(-1);
    onChange && onChange("");
  }, [onChange]);

  const select = useCallback((row) => {
    if (!row) return;
    onSelect && onSelect(row.item, { groupLabel: row.groupLabel, index: row.index });
  }, [onSelect]);

  // The combobox keyboard model: focus STAYS in the input. Up/down move a single
  // highlight across the whole flat track; Enter selects the highlighted row;
  // Esc closes + clears. All delegated to the pure predicates.
  const onKeyDown = useCallback((e) => {
    if (!open) return;
    const dir = arrowDirection(e.key);
    if (dir) {
      e.preventDefault(); // keep the caret put; we move the highlight, not focus
      setActive((cur) => nextActiveIndex(cur, count, dir));
      return;
    }
    if (isSelectKey(e.key, active, count)) {
      e.preventDefault();
      select(flat[active]);
      return;
    }
    if (isDismissKey(e.key)) {
      e.preventDefault();
      close();
    }
  }, [open, count, active, flat, select, close]);

  // Standalone dismissal — the panel owns its own Esc (handled in onKeyDown
  // while focused) + outside-click. Matches the Menu's predicate by convention.
  // Listeners attach only while open; reveal transitions on the next frame
  // (hard show under reduced motion).
  useEffect(() => {
    if (!open) { setShown(false); return undefined; }
    const onDocDown = (e) => {
      const inside = !!(rootRef.current && rootRef.current.contains(e.target));
      if (shouldDismissOnOutsideClick(true, inside)) close();
    };
    document.addEventListener("mousedown", onDocDown);
    let raf = 0;
    if (reduce || typeof requestAnimationFrame !== "function") {
      setShown(true);
    } else {
      raf = requestAnimationFrame(() => setShown(true));
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDocDown);
    };
  }, [open, reduce, close]);

  const activeDesc = activeDescendantId(flat, active);
  const resolvedNoResults = noResultsLabel || `No matches for “${(value || "").trim()}”`;

  return html`
    <div ref=${rootRef} style=${{ position: "relative", ...style }}>
      <div style=${{
        display: "flex", alignItems: "center", gap: 8,
        height: 36, padding: "0 10px", boxSizing: "border-box",
        background: "var(--surface-1)", border: "1px solid var(--hairline-strong)",
        borderRadius: "var(--radius-md)",
        transition: "border-color var(--duration-fast) var(--ease-base), box-shadow var(--duration-fast) var(--ease-base)",
      }}
        onFocusCapture=${(e) => {
          e.currentTarget.style.borderColor = "var(--accent-ochre)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-ochre-soft)";
        }}
        onBlurCapture=${(e) => {
          e.currentTarget.style.borderColor = "var(--hairline-strong)";
          e.currentTarget.style.boxShadow = "none";
        }}>
        <${Icon} name="search" size=${15} color="var(--fg-3)" />
        <input
          type="text"
          role="combobox"
          aria-label=${ariaLabel}
          aria-expanded=${open}
          aria-controls=${listboxId}
          aria-autocomplete="list"
          aria-activedescendant=${activeDesc || undefined}
          autoComplete="off"
          spellCheck=${false}
          placeholder=${placeholder}
          value=${value}
          onChange=${(e) => onChange && onChange(e.target.value)}
          onKeyDown=${onKeyDown}
          style=${{
            flex: 1, minWidth: 0, height: "100%",
            border: "none", outline: "none", background: "transparent",
            fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--fg-1)",
          }} />
        ${value && html`
          <button type="button" className="focusable" aria-label="Clear search"
            onClick=${() => { onChange && onChange(""); setActive(-1); }}
            style=${{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 20, height: 20, borderRadius: "var(--radius-sm)",
              border: "none", background: "transparent", color: "var(--fg-3)", cursor: "pointer",
              transition: "background var(--duration-fast) var(--ease-base), color var(--duration-fast) var(--ease-base)",
            }}
            onMouseEnter=${(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--fg-1)"; }}
            onMouseLeave=${(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-3)"; }}>
            <${Icon} name="x" size=${13} />
          </button>`}
      </div>

      ${open ? html`
        <div
          id=${listboxId}
          role="listbox"
          aria-label=${`${ariaLabel} results`}
          style=${{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
            maxHeight: 360, overflowY: "auto", padding: 6, boxSizing: "border-box",
            background: "var(--surface-1)", border: "1px solid var(--hairline)",
            borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)",
            transformOrigin: "top",
            opacity: shown ? 1 : 0,
            transform: shown ? "translateY(0)" : "translateY(-4px)",
            transition: reduce ? "none"
              : "opacity var(--duration-fast) var(--ease-base), transform var(--duration-fast) var(--ease-base)",
            ...panelStyle,
          }}>
          ${state === "no-results"
            ? html`<div style=${{
                padding: "12px 10px", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--fg-3)",
              }}>${resolvedNoResults}</div>`
            : groups.map((group) => {
                const rows = flat.filter((r) => r.groupLabel === group.label);
                if (rows.length === 0) return null; // empty groups don't render a header
                return html`
                  <div key=${group.label} role="group" aria-label=${group.label}>
                    <div style=${{
                      padding: "8px 8px 4px", fontFamily: "var(--font-ui)", fontSize: 10.5, fontWeight: 600,
                      letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fg-2)",
                    }}>${group.label}</div>
                    ${rows.map((row) => {
                      const isActive = row.index === active;
                      const excerpt = getExcerpt(row.item);
                      return html`
                        <div
                          key=${row.id}
                          id=${row.id}
                          role="option"
                          aria-selected=${isActive}
                          onMouseEnter=${() => setActive(row.index)}
                          onMouseDown=${(e) => { e.preventDefault(); /* keep focus in the input */ }}
                          onClick=${() => select(row)}
                          style=${{
                            padding: "6px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer",
                            background: isActive ? "var(--surface-2)" : "transparent",
                            transition: "background var(--duration-fast) var(--ease-base)",
                          }}>
                          <span style=${{
                            display: "block",
                            fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-1)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>${getTitle(row.item)}</span>
                          ${excerpt && html`<${Excerpt} excerpt=${excerpt} term=${value} />`}
                        </div>`;
                    })}
                  </div>`;
              })}
        </div>` : null}
    </div>`;
}
