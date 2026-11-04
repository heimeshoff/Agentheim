/* ============================================================
   Agentheim — live re-fetch controller for open doc readers (agentic-workflow-es288)

   Pure, framework-free (unit-tested under `node --test`, no DOM). The two doc
   readers (SlideOver, MainPaneReader) wrap this in a useEffect. It never builds
   an EventSource and never imports the live-tree hub: board.js injects a
   hub-backed `subscribeTree(cb) -> unsubscribe` (ADR-0070). Read-only (ADR-0017).

   On EVERY delivered structural tree it re-fetches the open doc whole (ADR-0001
   — no diffing). It reacts to every update, not just one naming its own path:
   the watcher's debounce keeps only the LAST path of a burst, so a path match
   would miss edits. Fail-open (ADR-0070 §4): a failed re-fetch is swallowed and
   the last good content stays; byte-identical text causes no callback at all.
   ============================================================ */

/** Look up a task's current `path` by id in a /api/tree projection; null if absent. */
export function findTaskPath(tree, id) {
  const contexts = tree && Array.isArray(tree.contexts) ? tree.contexts : [];
  for (const bc of contexts) {
    const lifecycle = bc && bc.lifecycle ? bc.lifecycle : {};
    for (const folder of Object.keys(lifecycle)) {
      const tasks = Array.isArray(lifecycle[folder]) ? lifecycle[folder] : [];
      for (const t of tasks) if (t && t.id === id && t.path) return t.path;
    }
  }
  return null;
}

/**
 * @param {object} o
 * @param {(cb:(tree:object)=>void)=>(()=>void)} o.subscribeTree
 * @param {(path:string)=>Promise<string>} o.fetchDoc
 * @param {(tree:object)=>string|null} o.resolvePath — path to fetch for this tree; null = skip.
 * @param {(text:string, path:string)=>void} o.onFresh — called only when text or path changed.
 * @param {string} [o.initialPath] — path currently shown.
 * @returns {{ seed:(text:string, path?:string)=>void, stop:()=>void }}
 */
export function createLiveDocRefetch({ subscribeTree, fetchDoc, resolvePath, onFresh, initialPath }) {
  let active = true;
  let seq = 0;
  let lastText = null;
  let lastPath = initialPath ?? null;

  const unsubscribe = subscribeTree((tree) => {
    if (!active) return;
    const path = resolvePath(tree);
    if (!path) return;
    const mine = ++seq;
    Promise.resolve()
      .then(() => fetchDoc(path))
      .then((text) => {
        if (!active || mine !== seq) return; // last-started wins
        if (text === lastText && path === lastPath) return;
        lastText = text;
        lastPath = path;
        onFresh(text, path);
      })
      .catch(() => { /* keep last good content */ });
  });

  return {
    seed(text, path) { lastText = text; if (path) lastPath = path; },
    stop() {
      active = false;
      seq++;
      if (typeof unsubscribe === "function") unsubscribe();
    },
  };
}

/** Default subscription: a no-op, so mounts without a hub are unaffected. */
export const noopSubscribeTree = () => () => {};
