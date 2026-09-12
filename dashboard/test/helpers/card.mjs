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
export function extractLauncherInvocations(markdown, targetPattern = /(launch\.mjs|resolve-launcher\.mjs)/) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^node\b/.test(line) && targetPattern.test(line));
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
 *
 * infrastructure-x56qm: generalized with an optional `targetPattern` so the SAME
 * predicate covers both `/dashboard`'s original `resolve-launcher.mjs` target and
 * `/setup`'s `lib/setup-cli.mjs` target — the shape (os.homedir()-derived, no
 * $CLAUDE_PLUGIN_ROOT) is identical; only the resolved file differs. Default is
 * unchanged for any existing call site that doesn't pass a second argument.
 */
export function isEnvIndependentResolver(line, targetPattern = /resolve-launcher\.mjs/) {
  if (!/^node\s+-e\b/.test(line)) return false;
  if (!/os\.homedir\(\)/.test(line)) return false;
  if (!targetPattern.test(line)) return false;
  // The bootstrap must not lean on $CLAUDE_PLUGIN_ROOT for correctness. Referencing
  // it ONLY as an optional fast-path would be acceptable, but the regression class we
  // guard against is a bare ${CLAUDE_PLUGIN_ROOT:-.} path with no env-free fallback —
  // reject any mention to keep the guard strict (the resolver, not the card, owns any
  // future fast-path).
  if (/CLAUDE_PLUGIN_ROOT/.test(line)) return false;
  return true;
}

/**
 * Source-shaped variant of `isEnvIndependentResolver`, for a file that IS a
 * resolver (a full module, not a `node -e` one-liner) rather than a card
 * invocation OF one — `dashboard/cli/agentheim-dashboard.mjs` (infrastructure-x56qm),
 * shipped verbatim from the builder's own `~/.local/bin` reference. Same two
 * checks, without the `node -e` one-liner shape assumption. Line comments are
 * stripped before the $CLAUDE_PLUGIN_ROOT check: the reference file's own
 * header PROSE documents, in a comment, that it never depends on that var —
 * that documentation is the opposite of the regression this guards against,
 * so only a live code reference (an actual read) fails the predicate.
 */
export function isEnvIndependentResolverSource(source) {
  if (!/os\.homedir\(\)/.test(source)) return false;
  const codeOnly = source.replace(/\/\/.*$/gm, '');
  if (/CLAUDE_PLUGIN_ROOT/.test(codeOnly)) return false;
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

/**
 * Build the daily-path shell command for a given verb, straight against the
 * INSTALLED CLI under a fake home's `<home>/.local/bin` — infrastructure-x56qm's
 * retarget of the foreign-launch integration seam onto `/setup`'s actual install
 * target, now that `/dashboard` itself is a pointer with no `node` invocation of
 * its own (ADR-0079 §3). This is a strictly stronger guard than sourcing the
 * card's own bootstrap line: it exercises the real daily path a consumer who
 * already ran `/setup` uses, end to end.
 * @param {string} fakeHome  the fake `HOME`/`USERPROFILE` root the CLI was
 *   installed under (its `.local/bin/agentheim-dashboard.mjs` must exist)
 * @param {'launch'|'stop'|'status'} verb
 * @returns {string} a shell command, quoted for `bash -c`
 */
export function cliCommandFor(fakeHome, verb) {
  const cliPath = `${fakeHome}/.local/bin/agentheim-dashboard.mjs`.replace(/\\/g, '/');
  const verbArg = verb === 'launch' ? '' : ` ${verb}`;
  return `node "${cliPath}"${verbArg}`;
}
