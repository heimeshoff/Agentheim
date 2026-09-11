/* ============================================================
   Agentheim — dashboard frontend entry (agentic-workflow-006)

   The esbuild bundler entrypoint for the LIVE dashboard (ADR-0002
   /ADR-0003 + ADR-0009): the dashboard frontend app lives here, in
   dashboard/app/, and CONSUMES the design-system styleguide source
   across the BC boundary (it never forks it). esbuild bundles this
   tree — including the imported styleguide modules — into the
   committed dashboard/dist/ the static handler serves.

   This replaces the styleguide CANVAS (the demo page with SAMPLE
   data) as the dashboard entry: dist/ now serves the real board
   over /api/tree, not the design-system showcase.
   ============================================================ */
import { createRoot } from "react-dom/client";
import { html } from "../../.agentheim/knowledge/contexts/design-system/styleguide/app/html.js";
import { DashboardApp } from "./board.js";

const rootEl = typeof document !== "undefined" && document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(html`<${DashboardApp} />`);
}
