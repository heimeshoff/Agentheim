// Shared pure helpers for the hook-command-path regression guards
// (agentic-workflow-g7p2x). Mirrors dashboard/test/helpers/card.mjs's shape for the
// analogous problem: extract a runnable invocation out of a markdown frontmatter
// block, then classify it. Lives outside *.test.mjs so importing it elsewhere does
// NOT re-register these helpers' own tests under `node --test`.

/**
 * Extract the single-line, double-quoted YAML scalar value of the first
 * `command:` key found in a markdown file's frontmatter (or anywhere in the
 * text — the three sites this task touches each declare exactly one `command:`
 * hook line). Returns the DECODED string (YAML double-quote escapes undone), or
 * null if no such line is found.
 */
export function extractHookCommand(markdown) {
  const match = markdown.match(/^\s*command:\s*"((?:[^"\\]|\\.)*)"\s*$/m);
  if (!match) return null;
  return unescapeYamlDoubleQuoted(match[1]);
}

/**
 * Undo YAML double-quoted-scalar escaping for the narrow subset this repo's hook
 * commands actually use: `\"` -> `"` and `\\` -> `\` (which also correctly
 * resolves `\\d` -> `\d` and `\\.` -> `\.`, restoring the original JS regex
 * literals). Any other backslash sequence passes through unchanged.
 */
export function unescapeYamlDoubleQuoted(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length && (s[i + 1] === '"' || s[i + 1] === '\\')) {
      out += s[i + 1];
      i++;
      continue;
    }
    out += s[i];
  }
  return out;
}

/** True iff the command is the OLD, buggy form: a bare node invocation whose
 * script path is rooted at `${CLAUDE_PROJECT_DIR}` — resolves only when the
 * project IS the plugin (agentic-workflow-g7p2x's bug). */
export function isLegacyProjectDirForm(cmd) {
  return /\$\{CLAUDE_PROJECT_DIR\}\/lib\/hook-agent-signal\.mjs/.test(cmd);
}

/**
 * True iff the command is the env-INDEPENDENT bootstrap (homedir -> plugin cache
 * -> semver-max version dir -> hook-agent-signal.mjs), the same pattern
 * infrastructure-010 established and the claim/complete verbs reuse. Does not
 * depend on `${CLAUDE_PLUGIN_ROOT}` (documented but unreliably injected in hook
 * contexts, per the g7p2x investigation) or on `${CLAUDE_PROJECT_DIR}` for
 * locating the SCRIPT (only for the write target, inside the script itself).
 */
export function isEnvIndependentBootstrap(cmd) {
  if (typeof cmd !== 'string') return false;
  if (!/^node\s+-e\b/.test(cmd)) return false;
  if (!/os\.homedir\(\)/.test(cmd)) return false;
  if (!/hook-agent-signal\.mjs/.test(cmd)) return false;
  if (/\$\{CLAUDE_PLUGIN_ROOT/.test(cmd)) return false;
  if (isLegacyProjectDirForm(cmd)) return false;
  return true;
}
