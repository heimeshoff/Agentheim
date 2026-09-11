/* ============================================================
   Agentheim — dashboard universal slide-over (agentic-workflow-007)

   The right-hand detail panel that opens for ANY artifact — a board
   task or a non-task artifact (BC README, vision, context map,
   research, ADR). It is a thin React wrapper around the APPROVED
   styleguide `Drawer` (ADR-0003: imported across the BC boundary,
   never forked) plus the styleguide `Markdown` renderer the Drawer
   already uses internally.

   Behaviour (acceptance criteria aw-007):
   1. Opens on an open-intent (the board's onOpen, aw-006), animating
      in from the right; Esc + scrim-click close it — all inherited
      AS-IS from the styleguide Drawer.
   2. On open it fetches GET /api/doc?path= and the Drawer renders the
      markdown CLIENT-SIDE (styleguide Markdown → marked). No SSR.
   3. Uniform for tasks AND every non-task artifact — only the fetched
      path differs (intentToDrawerItem shapes both identically).
   4. The Drawer itself is the approved styleguide pattern, loaded from
      the committed dist bundle.

   Navigation/library (aw-008), SSE live-update + Promote (aw-009) are
   out of scope; this builds only the panel and wires it to the board's
   existing open-intent seam.
   ============================================================ */
import { useState, useEffect, useCallback } from "react";

import { html } from "../../.agentheim/knowledge/contexts/design-system/styleguide/app/html.js";
import { Drawer } from "../../.agentheim/knowledge/contexts/design-system/styleguide/app/drawer.js";

import { docUrl, intentToDrawerItem } from "./slide-over-data.js";
import { withFrontmatterSection } from "./frontmatter.js";

// The Drawer renders position:absolute inside its nearest positioned ancestor
// (in the styleguide demo, the framed app). On the live dashboard the panel must
// slide over the WHOLE viewport, so this wrapper is a fixed, full-viewport,
// positioned, pointer-transparent layer; the Drawer's own scrim re-enables
// pointer events when open. zIndex sits above the board chrome.
const OVERLAY_STYLE = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  pointerEvents: "none",
};

// Rail-aware expanded width (aw-074). The expand chevron widens the slide-over to
// FILL THE MAIN CONTENT AREA — everything right of the fixed-width ShellRail (248px,
// board.js). Rail-awareness is a DASHBOARD fact, not the Drawer primitive's (ds-020
// keeps no `248` / `calc(100vw - …)`): the consumer supplies the value, the primitive
// only selects it. The collapsed-width default stays inside the Drawer primitive.
const RAIL_WIDTH_PX = 248;
const EXPANDED_WIDTH = `calc(100vw - ${RAIL_WIDTH_PX}px)`;

/**
 * The universal detail slide-over.
 *
 * @param {object|null} intent — the open-intent (clicked task/artifact). Null = closed.
 * @param {() => void} onClose — close sink; the parent clears `intent`.
 * @param {() => void} [onOpenFullScreen] — ACCEPTED but no longer forwarded to the Drawer
 *   (aw-074). board.js still passes its promote handler (the aw-039/aw-052 main-pane path
 *   stays live for global search), but the slide-over header's "Open in full screen"
 *   maximize button is GONE: with the callback absent on the Drawer, the ds-009 callback-
 *   guard hides the action, leaving a Close-only header. In-place widening (the ds-020
 *   body-top chevron) replaces "promote out" as the slide-over's enlargement affordance.
 * @param {(path: string) => Promise<string>} [fetchDoc] — overridable doc fetcher (tests).
 */
export function SlideOver({ intent, onClose, onOpenFullScreen, fetchDoc = defaultFetchDoc }) {
  // `phase` drives the body the Drawer shows while the markdown is in flight.
  const [item, setItem] = useState(null);
  // In-place expand state (aw-074), driving the ds-020 controlled seam. The slide-over
  // OWNS the truth (controlled) and resets it to COLLAPSED on every (re)open below — no
  // persisted expand state (decided in refine: reopening a task always starts narrow; no
  // view-state store, no ADR-0015). Esc still closes the slide-over outright (inherited
  // from the Drawer's keydown handler — the chevron is the only collapse affordance).
  const [expanded, setExpanded] = useState(false);
  const onToggleExpand = useCallback(() => setExpanded((v) => !v), []);

  useEffect(() => {
    if (!intent) {
      // Closing: hand the Drawer a null item so it plays its exit animation.
      setItem(null);
      return;
    }
    // (Re)opening on a task always starts collapsed — no persisted expand state.
    setExpanded(false);
    let alive = true;
    // Show an immediate, quiet loading body so the panel opens without waiting
    // on the network — the Drawer animates in, then the body swaps to the doc.
    setItem(intentToDrawerItem(intent, "_Loading…_"));
    fetchDoc(intent.path)
      // Fold the fetched body's YAML frontmatter into a quiet collapsible section
      // BEFORE it becomes the Drawer item's body (aw-043). The _Loading…_ / error
      // bodies above carry no frontmatter, so only the success path is transformed.
      .then((md) => { if (alive) setItem(intentToDrawerItem(intent, withFrontmatterSection(md))); })
      .catch(() => {
        if (alive) {
          setItem(intentToDrawerItem(
            intent,
            `# Could not load this document\n\nFailed to fetch \`${intent.path}\` from /api/doc.`,
          ));
        }
      });
    return () => { alive = false; };
  }, [intent, fetchDoc]);

  return html`
    <div style=${OVERLAY_STYLE}>
      <div style=${{ position: "absolute", inset: 0, pointerEvents: item ? "auto" : "none" }}>
        <${Drawer}
          item=${item}
          headerVariant="contextual"
          onClose=${onClose}
          expanded=${expanded}
          onToggleExpand=${onToggleExpand}
          expandedWidth=${EXPANDED_WIDTH} />
      </div>
    </div>`;
}

/** Default doc fetcher: GET /api/doc?path= → raw markdown text (client-side). */
async function defaultFetchDoc(path) {
  const res = await fetch(docUrl(path));
  if (!res.ok) throw new Error(`/api/doc ${res.status}`);
  return res.text();
}
