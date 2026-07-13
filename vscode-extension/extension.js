// Agentheim VS Code bridge extension — activation glue (ADR-0018).
//
// This file is the ONLY part that touches the `vscode` API. All contractual
// logic (loopback bind, fallback ladder, per-activation token, bridge.json
// discovery file, body/CORS handling) lives in ./src/bridge.js, which is pure
// and unit-tested without the editor. Here we just wire the injected
// terminal-launch action to `vscode.window.createTerminal`.

const vscode = require('vscode');
const path = require('node:path');
const { existsSync, statSync } = require('node:fs');
const { startBridge } = require('./src/bridge.js');

/**
 * Resolve a bare command name to a concrete executable. VS Code's
 * `createTerminal({ shellPath })` does NOT apply Windows PATHEXT, so a bare
 * `'claude'` can fail to find `claude.cmd`/`claude.exe`. On win32 we walk
 * PATH × PATHEXT (stdlib only, no new dependency) and return the first match as
 * an absolute path; everywhere else we hand `'claude'` back unchanged and let
 * the OS resolve it. This keeps the OS wart localized in the one impure file
 * (ADR-0018, amended 2026-06-16); the pure core stays platform-agnostic.
 */
function resolveExecutable(command) {
  if (process.platform !== 'win32') return command;
  if (command.includes(path.sep) || command.includes('/')) return command;
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const exts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .filter(Boolean);
  for (const dir of dirs) {
    // A bare name may itself already carry an extension on PATH.
    const direct = path.join(dir, command);
    if (existsSync(direct) && statSync(direct).isFile()) return direct;
    for (const ext of exts) {
      const candidate = path.join(dir, command + ext);
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
  }
  // Nothing matched: hand the bare name back and let createTerminal try.
  return command;
}

/**
 * Recover the session name from the launch descriptor's `args` — the core
 * always prepends `-n <name>` (ADR-0018, amended by infrastructure-c6fzb), so
 * `createTerminal`'s own tab title (and the `/resume` picker entry the `-n`
 * flag itself sets inside the spawned `claude` process) agree. `'Claude'`
 * survives only as the last-resort fallback should `args` ever arrive without
 * a `-n` pair — the core is contracted to always derive a name, so this is
 * defensive, not a customary path.
 */
function nameFromArgs(args) {
  if (!Array.isArray(args)) return null;
  const i = args.indexOf('-n');
  const candidate = i !== -1 ? args[i + 1] : undefined;
  return typeof candidate === 'string' && candidate ? candidate : null;
}

/** Walk up from a start dir to the nearest `.agentheim/` holder (ADR-0002). */
function discoverRoot(startDir) {
  let dir = path.resolve(startDir);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = path.join(dir, '.agentheim');
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Resolve the Agentheim project root from the open workspace, if any. */
function resolveRoot() {
  const folders = vscode.workspace.workspaceFolders || [];
  for (const f of folders) {
    const root = discoverRoot(f.uri.fsPath);
    if (root) return root;
  }
  return null;
}

let bridge = null;

async function activate(context) {
  const root = resolveRoot();
  if (!root) {
    // No Agentheim project open: nothing to bridge. The frontend treats an
    // absent bridge as a normal mode (clipboard fallback), so we stay quiet.
    return;
  }

  // The single editor seam: make the terminal BE the `claude` process. The pure
  // core hands us a structured descriptor `{ command, args }` with the prompt as
  // a raw argv element — no shell, no quoting (ADR-0018, amended 2026-06-16). We
  // spawn `claude` directly via shellPath/shellArgs so the OS delivers each arg
  // verbatim; no character the builder typed can be re-parsed by a shell. The
  // optional `--dangerously-skip-permissions` flag arrives already in `args`
  // when (and only when) the launch armed it — we never hard-wire it here.
  // The session name (ADR-0018, amended by infrastructure-c6fzb) is recovered
  // from the `-n <name>` pair the core always prepends, so the terminal tab
  // and the `/resume` picker entry (which `-n` itself names inside the
  // spawned process) agree — 'Claude' is only the last-resort fallback.
  const launchClaude = ({ command, args }) => {
    vscode.window
      .createTerminal({
        name: nameFromArgs(args) || 'Claude',
        cwd: root,
        shellPath: resolveExecutable(command),
        shellArgs: args,
      })
      .show();
    // No sendText — the terminal IS the claude process. When claude exits the
    // terminal shows an exit notice rather than dropping to a shell prompt.
  };

  try {
    bridge = await startBridge({ root, launchClaude });
    context.subscriptions.push({ dispose: () => bridge && bridge.close() });
    console.log(`[agentheim-bridge] listening on 127.0.0.1:${bridge.port}`);
  } catch (err) {
    vscode.window.showWarningMessage(
      `Agentheim bridge could not start (ports 31425-31427 busy?): ${err && err.message}`
    );
  }
}

function deactivate() {
  // Remove/invalidate bridge.json and close the listener so a dead host leaves
  // no live discovery file behind (ADR-0018 deactivation contract).
  if (bridge) {
    bridge.close();
    bridge = null;
  }
}

module.exports = { activate, deactivate };
