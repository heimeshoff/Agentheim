---
id: infrastructure-q8m4t
title: Support quotation marks (Gänsefüsschen) in prompts
status: backlog
type: bug
context: infrastructure
created: 2026-06-23
completed:
depends_on: []
blocks: []
tags: [captured, bridge, i18n]
related_adrs: [0018]
related_research: []
prior_art: [infrastructure-020]
---

## Why
The builder writes German and reaches for German typographic quotation marks —
Gänsefüsschen `„ "` and guillemets `» «` — as naturally as ASCII quotes. A prompt
seeded through the dashboard (or typed at Claude) that contains them should carry
those exact characters into the launched session. The capture came in on 2026-06-23,
*after* infra-020 had already shipped raw-argv quote handling — so whatever the builder
hit is **not** the ASCII-quote-as-shell-syntax bug infra-020 closed. Something in the
non-ASCII / typographic dimension still bites, or the builder was running a stale
extension build. Refinement below narrows it to a concrete hypothesis but leaves the
last confirmation to the builder.

## What
Make German typographic quotation marks — `„` `"` (Gänsefüsschen) and `»` `«`
(guillemets) — survive a dashboard-seeded prompt end-to-end, exactly as ASCII quotes
already do since infra-020.

**Two separable dimensions — infra-020 only closed the first:**

1. **Shell parsing** (infra-020, DONE) — a quote read as *syntax* by a shell. Closed: the
   bridge hands the prompt to `createTerminal` as a raw argv element (`bridge.js:185-191`,
   `extension.js:83-91`), so no shell parses it. ASCII `"` `'` `` ` `` `$` `&` survive verbatim.
2. **Character encoding** (this task, OPEN hypothesis) — a *non-ASCII* character corrupted
   in transit (Windows console codepage / OEM cp850 mojibake, or a `?` substitution). The
   JSON transport (`POST /run` → `readBody` UTF-8 → `JSON.parse`) is Unicode-clean, and
   VS Code's argv→command-line quoter escapes only ASCII `"`/`\`, leaving `„ " » «` untouched
   — so on paper the bridge path *should* already carry them. The residual risk lives at the
   **terminal-launch layer** (`extension.js` `createTerminal`), the one place Windows-specific
   surprises already surface (see `resolveExecutable`'s PATH×PATHEXT wart on win32).

## Acceptance criteria
- [ ] **Reproduce first.** With the *current* (infra-020) bridge `.vsix` installed, seed a
      dashboard prompt containing each style — `„Titel"`, `»Titel«`, and a plain `"x"` —
      and record what actually reaches the launched `claude` session (verbatim / mojibake /
      dropped / `?`). Confirm whether the failure is real on today's build or was a stale
      pre-infra-020 install.
- [ ] If it reproduces: the launched session receives `„ " » «` **byte-for-byte** identical
      to what was typed in the dashboard prompt-bar (no mojibake, no `?`, no dropped chars).
- [ ] The clipboard-fallback path (bridge absent) copies the same characters verbatim.
- [ ] A regression test at the layer that broke — extend the bridge/handler tests
      (`vscode-extension/test/…`, `dashboard/test/bridge-*.test.mjs`) with a non-ASCII
      typographic-quote fixture so the round-trip is guarded, mirroring how infra-020 guarded
      ASCII metacharacters.
- [ ] **Doc-drift rider (do regardless):** the stale `claude "<prompt>"` comments — which
      describe the pre-infra-020 shell-wrap that no longer exists — are corrected to the
      raw-argv reality. Known sites: `dashboard/app/bridge-launch.js:24`,
      `dashboard/app/modeling-command.js:41,47,58` (and any sibling `*CommandFor` doc that
      repeats the phrase).

## Notes
Captured via `quick-capture` on 2026-06-23 — raw, unrefined. Refined 2026-07-03.

**Full path traced (all Unicode-clean on paper):**
dashboard textarea → `safePrompt` (trims ends only, no sanitizing —
`modeling-command.js:115-117`) → `POST /run { prompt }` JSON → bridge `readBody` (UTF-8) →
`JSON.parse` → `.trim()` → descriptor `{ command, args:[prompt] }` (`bridge.js:176-191`) →
`createTerminal({ shellPath, shellArgs })` (`extension.js:83-91`). No shell in the chain;
no ASCII-only assumption in the code. So the most likely real-world causes, in order:

1. **Stale installed `.vsix`** predating infra-020/infra-017 — reinstall closes it, no code change.
2. **Windows console/terminal codepage** rendering or delivering `„ " » «` as OEM mojibake
   even though the argv bytes are correct — a genuine encoding gap infra-020 never touched.
3. A path the trace missed (needs the builder's repro to surface).

**Still needs the builder to confirm before this can promote** (asked during refine, unanswered):
- *Where* it broke — dashboard prompt-bar / Claude terminal directly / a skill-command argument
  / the clipboard-paste fallback.
- *Which* quotes — German `„ "` / guillemets `» «` / straight ASCII `" '` / all.
- *Symptom* — dropped, mangled, wrong characters (mojibake/`?`), command errored, or nothing launched.

One builder answer away from `todo`: the reproduction AC is the gate. If it turns out to be
a stale-install (cause 1), this closes as "reinstall + doc-drift rider only" and the
regression fixture still lands so it can't silently regress.

Related: `infrastructure-020` (raw-argv `createTerminal` launch, ADR-0018) is the direct
predecessor that closed the shell-parsing half of this problem.
