/* ============================================================
   Agentheim — JSX-less view factory (buildless, no Babel)

   The styleguide is the single source of truth for two consumers
   (ADR-0003): a buildless reviewable canvas (this file's `html`
   tag, parsed at runtime by htm — no @babel/standalone, no
   toolchain to open the canvas) and the esbuild-bundled dashboard
   dist (esbuild consumes the very same `html` tagged templates as
   plain function calls). One source, two consumers, no JSX shipped
   to the browser.

   Authoring note: components are written with htm's tagged-template
   syntax — `html`<Tag prop=${x}>...</Tag>`` — instead of JSX, so the
   modules run natively in the browser without a compile step while
   staying readable. See ADR-0005.
   ============================================================ */
import { createElement } from "react";
import htm from "htm";

export const html = htm.bind(createElement);
