---
id: infrastructure-x56qm
title: `/setup` installs the zero-token dashboard CLI into `<home>/.local/bin` and `/dashboard` becomes a pointer, so a consumer's daily dashboard launch costs no model turn
status: doing
type: feature
context: infrastructure
created: 2026-09-12
completed:
depends_on: [infrastructure-r4mzp]
blocks: [infrastructure-js62b]
tags: [dashboard, commands, setup, cli, context-budget]
related_adrs: [0002, 0018, 0053, 0068, 0079]
related_research: []
prior_art: [infrastructure-010, infrastructure-k9t2v, infrastructure-rgknz]
---

## Why

Launching the dashboard through `/dashboard` costs two full-context model turns
(~120k input tokens, transcript-measured in infrastructure-k9t2v) to run a script
that returns in milliseconds from a terminal. The builder escapes that in the
Agentheim repo with three personal scripts in `~/.local/bin`; a consumer has no
such path, because a Claude Code plugin cannot put anything on `PATH`. ADR-0079
(infrastructure-r4mzp) settled the answer: ship the CLI verbatim, install it once
per machine through a re-runnable `/setup` command, and demote `/dashboard` to a
pointer. This task builds the CLI half of that — the whole token win. The VS Code
bridge half is split out (infrastructure-js62b, blocked on the `.vsix` first
shipping to consumers at all — infrastructure-j3rsn).

## What

Everything ADR-0079 settles is closed and not re-litigated here: install surface
`/setup` (second process-launcher exception to ADR-0002, prose-only allowlist
`{ /dashboard, /setup }`); install target `<home>/.local/bin` via `os.homedir()`
on every platform, never a project tree; `/dashboard` pointer-only; the three CLI
files shipped verbatim and plain-copied; update trigger = user-prompted re-run.
This refinement settles the *how*:

**1. The shipped CLI — `dashboard/cli/`, exactly three files.**
`agentheim-dashboard.mjs`, `agentheim-dashboard.cmd`, `agentheim-dashboard`
(bash shim), byte-for-byte the builder's reference implementation at
`~/.local/bin/agentheim-dashboard{.mjs,.cmd,}` (same repo-local-first /
newest-cached-semver resolver walk as `dashboard/resolve-launcher.mjs`, never
`$CLAUDE_PLUGIN_ROOT`). Nothing else lives in that directory — its entire
contents are what lands in a user's `PATH`. A `.gitattributes` pins
`dashboard/cli/** text eol=lf` (the repo has `autocrlf=true` and no
`.gitattributes`; a CRLF shebang breaks the shim on macOS/Linux with
`bad interpreter: ^M`, which no Windows test would ever catch).

**2. The install logic — `lib/setup-cli.mjs`, not inside `dashboard/cli/`.**
Stdlib-only, git-free (ADR-0038 shape: a `lib/` module with `main(argv)`,
reached from the card through the env-independent homedir → cache → semver-max
bootstrap, resolving its source files via `lib/resolve-plugin-file.mjs`). The
card never prompts on stdin — a Claude Code Bash tool-call is non-interactive —
so the *model* presents the menu conversationally and calls the script with an
explicit verb:

| Verb | Effect | Exit |
|---|---|---|
| `status` | read-only; prints exactly one line of JSON, nothing else | `0` |
| `install cli` | `mkdir -p <home>/.local/bin`, `copyFileSync` the three files, `chmod 0755` on POSIX only; detect and **print** the PATH remedy | `0` / `1` |
| `remove cli` | delete exactly those three filenames if present; never remove the directory | `0` / `1` |
| other | usage on stderr, no filesystem write | `2` |

No `install both` verb and no default choice — infrastructure-js62b adds the
bridge verbs later, and the model issues two calls when the user picks both, so
each verb fails loud independently. The copy is `copyFileSync` (raw bytes), never
read-as-utf8-then-write, or EOL translation makes every fresh install report stale.

**`status` JSON contract** (`schema: 1`, single line on stdout, no side effects —
it must not even create `<home>/.local/bin`):

```json
{ "schema": 1,
  "source": { "kind": "cache" | "repo-local", "version": "0.9.3" | null, "root": "<abs>" },
  "binDir": "<abs>",
  "cli": { "state": "not-installed" | "installed-current" | "installed-stale",
           "files": [{ "name": "agentheim-dashboard.mjs", "present": true, "matchesSource": true }],
           "path": { "onPath": true, "scope": "user" | "process" | "none", "remedy": "<exact text>" | null } },
  "warnings": [] }
```

`bridge` is a sibling key infrastructure-js62b adds additively; this task omits it.

**3. Install-state detection — byte-compare, not a version stamp.** The
reference files carry no version constant, and stamping one would need the
generator ADR-0079 §4 rejected. `installed-current` = all three present and
`Buffer.equals` the resolved source; `installed-stale` = all present, ≥1 differs;
`not-installed` = ≥1 absent. `source.version` (the cache semver the files came
from, or `null` for repo-local) answers "installed at which version" alongside.

**4. PATH — detect and print, never write.** Windows: the verdict comes from the
registry-backed *user* PATH (`reg query "HKCU\Environment" /v Path`), matched
case-insensitively, tolerating a trailing `\` and the unexpanded
`%USERPROFILE%\.local\bin` form; never from `process.env.Path` (process scope,
includes machine PATH, yields a false "already on PATH"). If only the process env
has it: `onPath: true, scope: "process"` plus a warning. Machine scope is never
read for a remedy and never written. POSIX: split `$PATH`, compare resolved
entries; print the rc line keyed off `basename($SHELL)` (zsh → `~/.zshrc`, bash →
`~/.bashrc` on Linux / `~/.bash_profile` on macOS, fish → `fish_add_path`,
unknown → `~/.profile`). The Windows remedy is the PowerShell
`[Environment]::SetEnvironmentVariable(..., 'User')` snippet carrying both
warnings inline: never source it from `$env:Path` (flattens `REG_EXPAND_SZ`
entries and duplicates machine PATH into user PATH) and never use `setx`
(truncates at 1024 chars). Why print-only: consent cannot reach a non-interactive
script (vision non-goal 3 — a PATH write is a gate), the failure mode is famous
and asymmetric, a printed command the user declines costs nothing, and ADR-0079
§5 already chose a passive prompt over a self-healing mechanism. A source guard
mechanizes the ban (AC 16). A `path fix` verb was considered and rejected.

**5. `/dashboard` demotion is substance, not cleanup.** `commands/dashboard.md`
becomes the pointer ADR-0079 §3 fixes (`run agentheim-dashboard; run /setup if it
isn't installed`) with zero `node` invocations. That removes the bootstrap four
test files read *from the card*: `dashboard/test/command-card.test.mjs`,
`dashboard/test/foreign-launch.test.mjs`,
`dashboard/test/foreign-launch-version-skew.test.mjs`, and
`lib/test/dashboard-command-bootstrap-dedup.test.mjs`'s live-tree gate. Retarget
them onto the installed CLI (strictly stronger — the real daily path end-to-end):
a `cliCommandFor()` beside `cardCommandFor()` in `dashboard/test/helpers/card.mjs`,
sourcing `node <fakeHome>/.local/bin/agentheim-dashboard.mjs <verb>`. The dedup
lint generalizes rather than siblings (ADR-0068 single-source): `git mv` to
`lib/command-bootstrap-dedup.mjs`, `countBootstrapOccurrences(root, cardName)`,
live-tree gate asserting `setup.md → 1` **and** `dashboard.md → 0` — the second
assertion is what mechanizes pointer-only.

**6. Docs.** README's `/dashboard` table becomes the pointer description plus an
`agentheim-dashboard` / `stop` / `status` table naming `/setup` as the install
path; the bridge `<details>` block is **not** touched (js62b owns it — this task
writes no promise it doesn't keep). The infrastructure BC README's "Launch / Stop"
entry describes the three launch surfaces (repo-local, `/dashboard` pointer,
installed CLI) and says which one a consumer uses daily; its existing `/setup`
entry is updated to what actually shipped (print-only PATH, byte-compare).

## Acceptance criteria

**Shipped CLI files**
- [ ] `dashboard/cli/` contains exactly three entries — `agentheim-dashboard.mjs`, `agentheim-dashboard.cmd`, `agentheim-dashboard` — asserted by a `readdirSync().sort()` equality test; a fourth file fails the suite.
- [ ] `dashboard/cli/agentheim-dashboard.mjs` resolves the launcher through the repo-local-first / newest-cached-semver walk and contains no `CLAUDE_PLUGIN_ROOT` reference — asserted with the `isEnvIndependentResolver`-shaped predicates from `dashboard/test/helpers/card.mjs` against the file's source.
- [ ] None of the three committed files contains a `\r` byte, and `.gitattributes` pins `dashboard/cli/** text eol=lf` — both asserted by a live-tree test.

**`/setup` card and lint**
- [ ] `commands/setup.md` exists, carries the env-independent `node -e` resolver bootstrap exactly once targeting `lib/setup-cli.mjs`, forwards `$ARGUMENTS`, issues no `cd`, and inlines no install logic (no `copyFileSync` / `mkdir` / `chmod` literal in the card).
- [ ] `lib/dashboard-command-bootstrap-dedup.mjs` is renamed (`git mv`) to `lib/command-bootstrap-dedup.mjs`, takes a card name, and its live-tree gate asserts `commands/setup.md → 1` and `commands/dashboard.md → 0`; the existing fixture-based unit tests survive against the generalized signature.
- [ ] `commands/dashboard.md` contains zero `node` invocations and names both the literal `agentheim-dashboard` and the literal `/setup`; `dashboard/test/command-card.test.mjs`'s five resolver-shape assertions are retargeted onto `commands/setup.md` and `dashboard/cli/agentheim-dashboard.mjs`, not deleted.

**Install behaviour** (all against a fake `HOME`/`USERPROFILE` and fake plugin cache — the `foreign-launch.test.mjs` fixture pattern; no test reads the builder's real home)
- [ ] `install cli` exits `0` and leaves all three files under `<fakeHome>/.local/bin`, byte-identical to source; on POSIX the shim and `.mjs` have `mode & 0o111` set, on win32 no `chmod` is attempted.
- [ ] After `install cli`, the installed `agentheim-dashboard.mjs` with each verb (empty, `stop`, `status`) from a foreign project with `CLAUDE_PLUGIN_ROOT` deleted from the child env behaves as today's card path: runfile under the foreign project, `status` reports running, `stop` removes the runfile. `foreign-launch.test.mjs` and `foreign-launch-version-skew.test.mjs` are retargeted to this path via a new `cliCommandFor()` helper.
- [ ] `install cli` with cwd set to a fixture project writes nothing under that project tree — a recursive listing + mtime snapshot is identical before and after (in particular nothing under `.agentheim/`).
- [ ] `status` is side-effect-free: against a fake home with no `.local/bin`, a recursive snapshot of the fake home is unchanged afterwards and `<fakeHome>/.local/bin` was not created.
- [ ] `status` prints exactly one line of valid JSON matching the contract above (asserted field-by-field, including `schema: 1`), exits `0` in all three CLI states, and reports `not-installed` → `installed-current` → `installed-stale` across a fixture sequence (install; mutate one installed byte; re-run).
- [ ] Running inside the Agentheim repo, `status` reports `source.kind === "repo-local"` and `source.version === null` — covered by a fixture.
- [ ] `remove cli` deletes exactly the three filenames and leaves `<home>/.local/bin` itself, plus an unrelated file the fixture placed there, untouched.
- [ ] A newer semver directory added to the fixture cache makes `status` report `installed-stale`; a subsequent `install cli` restores `installed-current` with bytes from the newer directory.
- [ ] With `<home>/.local/bin` absent from the detected PATH, `install cli` still exits `0` and stdout contains the platform-correct remedy: on win32 the `SetEnvironmentVariable(..., 'User')` snippet with both the "never source from `$env:Path`" and "never `setx`" warnings; on POSIX the `export PATH="$HOME/.local/bin:$PATH"` line naming the rc file derived from `$SHELL` (zsh / bash / fish / unknown each covered by a fixture).
- [ ] A source guard over `lib/setup-cli.mjs` (the `vscode-extension/test/bridge.test.mjs` source-scan shape) asserts the module contains no PATH-write call — no `setx`, no `SetEnvironmentVariable`, no `reg add`, no write to `HKCU\Environment`.
- [ ] PATH detection on win32 derives its verdict from the registry read, not `process.env.Path`: a fixture where the registry value lacks the directory but the process env contains it yields `path.onPath === true`, `path.scope === "process"` and a non-empty `warnings` entry.
- [ ] An unknown verb exits `2` with a usage line on stderr and performs no filesystem write.

**Docs and suite**
- [ ] README's `/dashboard` table is replaced by the pointer description plus an `agentheim-dashboard` / `agentheim-dashboard stop` / `agentheim-dashboard status` table naming `/setup` as the install path — asserted by a literal-substring doc check in the existing doc-guard style. The bridge `<details>` block is unchanged.
- [ ] The infrastructure BC README's "Launch / Stop" entry describes all three launch surfaces and states which one a consumer uses daily; its `/setup` entry is updated to the print-only PATH ruling and the byte-compare staleness rule.
- [ ] `npm test` (dashboard) and `node --test lib/test/*.test.mjs` are green, excluding the two known-environmental failures: the fixed-port `bridge.test.mjs` cases while the builder's live bridge holds `:31425`, and `foreign-launch.test.mjs`'s EPERM teardown race on Windows.
- [ ] On the builder's own machine, `/setup` → `status` reports `cli.state: installed-current` against the existing `~/.local/bin` scripts, and `agentheim-dashboard status` works from a foreign project. [human-eye]

## Notes

**Settled by ADR-0079 (infrastructure-r4mzp, 2026-09-12)** — install surface
`/setup` (allowlist `{ /dashboard, /setup }`, prose-only per ADR-0059); target
`<home>/.local/bin` on every platform via `os.homedir()`, never a project tree;
`/dashboard` pointer-only, no launch attempt; the three CLI files ship verbatim
and `/setup` plain-copies them; update trigger is a user-prompted re-run (skew
banner + `/dashboard` card name `/setup`), no self-detection. Do not re-litigate.

**Settled by this refinement (2026-09-12, architect via orchestrator):**
script location `lib/setup-cli.mjs` (so `dashboard/cli/` stays exactly the
shipped three); byte-compare staleness; print-only PATH with a source guard;
generalize-and-rename the bootstrap-dedup lint; test retargeting onto the
installed CLI is in scope; no `install both` verb, no default choice;
`brainstorm` does **not** point at `/setup` (its closing act is domain artifacts
only; ADR-0064/vision non-goal 3 — if onboarding is wanted, capture it separately
against `whats-next`); `/setup status` is not reachable from the dashboard
(ADR-0017 read-only). Rejected: a `path fix` verb with conversational consent —
if ever adopted it must read user scope raw from the registry, append only, and
print the prior value before writing.

**Split (2026-09-12):** the bridge half is infrastructure-js62b (`install bridge`
/ `remove bridge`, `status.bridge`, skew-banner copy, README bridge block),
depending on this task and on infrastructure-j3rsn (the `.vsix` is gitignored
today — no consumer cache contains one; builder ruled: commit the built artifact,
mirroring `dashboard/dist/`). Do not batch js62b in parallel with this task —
both touch `commands/setup.md`, `lib/setup-cli.mjs`, README and the BC README.

**Worker/verifier briefing:** do not run `node build.mjs` (this task does not
touch `dashboard/app/`, so `dist/` stays as-is). Two `bridge.test.mjs` cases
fail `EADDRINUSE` on `:31425` while the builder's real bridge runs — not a
regression. `foreign-launch.test.mjs` has a pre-existing EPERM teardown race on
Windows. Test fixtures must pin the CLI bytes themselves — no test may read the
builder's home directory. Reference implementation for the three files:
`~/.local/bin/agentheim-dashboard{.mjs,.cmd,}` (copy them; do not rewrite).

Do **not** revive the in-project shim (`.agentheim/.dashboard/` script
deployment, reverted 2026-07-09) — user-level only; ADR-0079 answers both
plausible objections to it structurally.
