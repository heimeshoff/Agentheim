// Shared pure helpers for the command-card guards.
// infrastructure-009 introduced these for the plugin-rooted card; infrastructure-010
// reshapes them for the env-INDEPENDENT resolver bootstrap (the `${CLAUDE_PLUGIN_ROOT}`
// form was empty in the field, so the card now uses a `node -e` bootstrap that derives
// the launcher from os.homedir()). infrastructure-k9t2v collapses the card from three
// pasted bootstrap copies (one per verb) to ONE, with the verb forwarded at runtime via
// `$ARGUMENTS` — `verbOf` (which classified a line by a verb baked into its own text)
// no longer applies to that single line, so this revision adds `forwardsArguments` /
// `substituteArguments` for the pass-through shape and keeps `verbOf` only for the
// meta Red-proof fixtures that still construct old-shape per-verb lines by hand. Lives
// outside *.test.mjs so importing it from another test file does NOT re-register the
// guard's tests under `node --test`.

/**
 * Extract every runnable launcher invocation line from a command-card markdown
 * source. The card puts each runnable command inside a fenced block. The resolver
 * bootstrap is a `node -e "..."` one-liner; we also still recognize the legacy
 * `node ...launch.mjs` form so the Red-proof meta-tests can feed it the old card.
 */
export function extractLauncherInvocations(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^node\b/.test(line) && /(launch\.mjs|resolve-launcher\.mjs)/.test(line));
}

/**
 * Classify an extracted invocation by its trailing verb (launch is the empty verb).
 * The verb is the bare token AFTER the command body. For the `node -e "..."` form
 * the body ends at the closing double quote; for the legacy form it follows
 * launch.mjs. In both cases the verb is the last whitespace-separated bare word
 * (stop | status), or 'launch' when absent.
 */
export function verbOf(line) {
  // node -e "..." [verb]  → verb is whatever follows the closing quote of the -e arg.
  const evalMatch = line.match(/node\s+-e\s+(["'])(?:\\.|(?!\1).)*\1\s*(\w+)?\s*$/);
  if (evalMatch) return evalMatch[2] || 'launch';
  // legacy: node ...launch.mjs[ "] [verb]
  const m = line.match(/launch\.mjs(?:["'])?\s*(\w+)?/);
  return (m && m[1]) || 'launch';
}

/** True iff the invocation reaches the launcher via the legacy ${CLAUDE_PLUGIN_ROOT...}. */
export function isPluginRooted(line) {
  return /\$\{CLAUDE_PLUGIN_ROOT(?:[:\-].*?)?\}/.test(line);
}

/**
 * True iff the invocation is the env-INDEPENDENT resolver bootstrap: a `node -e`
 * one-liner that derives the cache path from os.homedir() and reaches the resolver
 * module — and does NOT depend on $CLAUDE_PLUGIN_ROOT for correctness.
 * This is the infrastructure-010 contract the card must satisfy.
 */
export function isEnvIndependentResolver(line) {
  if (!/^node\s+-e\b/.test(line)) return false;
  if (!/os\.homedir\(\)/.test(line)) return false;
  if (!/resolve-launcher\.mjs/.test(line)) return false;
  // The bootstrap must not lean on $CLAUDE_PLUGIN_ROOT for correctness. Referencing
  // it ONLY as an optional fast-path would be acceptable, but the regression class we
  // guard against is a bare ${CLAUDE_PLUGIN_ROOT:-.} path with no env-free fallback —
  // reject any mention to keep the guard strict (the resolver, not the card, owns any
  // future fast-path).
  if (/CLAUDE_PLUGIN_ROOT/.test(line)) return false;
  return true;
}

/**
 * True iff the invocation forwards the slash-command argument verbatim via the
 * literal `$ARGUMENTS` placeholder, rather than baking a specific verb (or no
 * verb) into the card text. This is the infrastructure-k9t2v contract: ONE
 * bootstrap line covering all three verbs (empty / stop / status) by
 * pass-through, replacing the old shape of three near-identical lines each
 * hardcoding its own trailing verb.
 */
export function forwardsArguments(line) {
  return /\$ARGUMENTS\b/.test(line);
}

/**
 * Simulate Claude Code's slash-command argument substitution: replace the
 * literal `$ARGUMENTS` placeholder in `line` with `verbArg` (`''` for the
 * no-argument launch verb, `'stop'`, or `'status'`), producing the exact
 * shell command Claude Code would run for that verb. Used by
 * foreign-launch.test.mjs so the integration test still exercises a real,
 * per-verb invocation even though the card itself carries only one line.
 */
export function substituteArguments(line, verbArg) {
  return line.replace(/\$ARGUMENTS\b/, verbArg);
}
