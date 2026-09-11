/* ============================================================
   Agentheim — dashboard main-pane document reader (agentic-workflow-027)

   The MAIN-PANE reader for a non-task DOCUMENT (a rail/library row —
   vision, context map, BC README, ADR, research). Through aw-026 every
   clicked artifact opened in the right-hand slide-over (ADR-0010);
   aw-027 splits that — tasks keep the slide-over, non-task documents
   render HERE, in the main content area, where there is room to read.

   It is a thin React wrapper around the APPROVED styleguide `Markdown`
   primitive (imported across the BC boundary, never forked — ADR-0003 /
   ADR-0009). It REUSES the existing one fetch mechanism — docUrl from
   slide-over-data.js — so there is ONE way to fetch a doc and TWO render
   targets (the slide-over Drawer and this reader). Read-only throughout
   (ADR-0017): opening a document performs no write and never alters the
   board projection — it only GETs /api/doc and renders the markdown
   client-side (no SSR), exactly as the slide-over does.

   The pure routing decision (which target a given intent reaches) lives
   in intent-route.isTaskIntent and is unit-tested without a DOM.
   ============================================================ */
import { useState, useEffect } from "react";

import { html } from "../../.agentheim/knowledge/contexts/design-system/styleguide/app/html.js";
import { Markdown } from "../../.agentheim/knowledge/contexts/design-system/styleguide/app/primitives.js";
import { Icon } from "../../.agentheim/knowledge/contexts/design-system/styleguide/app/icons.js";

import { docUrl } from "./slide-over-data.js";
import { withFrontmatterSection } from "./frontmatter.js";

function ReaderState({ children }) {
  return html`
    <div style=${{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 10, padding: "80px 16px",
      fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--fg-3)",
    }}>${children}</div>`;
}

/**
 * The main-pane document reader.
 *
 * @param {object|null} doc — the selected non-task document open-intent. It carries
 *   a styleguide content `type`, a `title`, and the real in-root `path`
 *   (library-data.js item shape). Null = nothing selected (the parent then renders
 *   the board instead — this component only mounts when a doc is selected).
 * @param {(path: string) => Promise<string>} [fetchDoc] — overridable fetcher (tests).
 */
export function MainPaneReader({ doc, fetchDoc = defaultFetchDoc }) {
  // phase: loading | ready | error. The body swaps in once /api/doc resolves.
  const [phase, setPhase] = useState("loading");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!doc || !doc.path) {
      setPhase("ready");
      setBody("");
      return undefined;
    }
    let alive = true;
    setPhase("loading");
    fetchDoc(doc.path)
      .then((md) => { if (alive) { setBody(md); setPhase("ready"); } })
      .catch(() => { if (alive) { setBody(""); setPhase("error"); } });
    return () => { alive = false; };
  }, [doc, fetchDoc]);

  if (!doc) return null;

  if (phase === "loading") {
    return html`<${ReaderState}><${Icon} name="loader" size=${15} color="var(--fg-4)" /> Loading document…</${ReaderState}>`;
  }
  if (phase === "error") {
    return html`<${ReaderState}><${Icon} name="triangle-alert" size=${15} color="var(--st-doing)" /> Could not load <span style=${{ fontFamily: "var(--font-mono)", marginLeft: 4 }}>${doc.path}</span> from /api/doc.</${ReaderState}>`;
  }

  // A quiet reading column: a title header that LEADS with doc.title (--fg-1,
  // --font-ui) over a demoted quiet mono path sub-line (aw-047), then the
  // styleguide Markdown primitive (its `.prose` class carries the typography),
  // constrained to a comfortable measure. Consumed unforked (ADR-0003) — same
  // primitive the slide-over reaches through the Drawer.
  return html`
    <article style=${{ maxWidth: 760, margin: "0 auto" }}>
      <header style=${{ padding: "0 0 14px" }}>
        <h1 style=${{
          margin: 0,
          fontFamily: "var(--font-ui)", fontSize: 21, fontWeight: 600,
          lineHeight: 1.25, color: "var(--fg-1)",
        }}>${doc.title || doc.path}</h1>
        ${doc.title && html`
          <div style=${{
            marginTop: 6,
            fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-3)",
          }}>${doc.path}</div>`}
      </header>
      <${Markdown} source=${withFrontmatterSection(body)} />
    </article>`;
}

/** Default doc fetcher: GET /api/doc?path= → raw markdown text (client-side). */
async function defaultFetchDoc(path) {
  const res = await fetch(docUrl(path));
  if (!res.ok) throw new Error(`/api/doc ${res.status}`);
  return res.text();
}
