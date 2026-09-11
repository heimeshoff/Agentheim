---
id: infrastructure-q8m4t
title: Support quotation marks (Gänsefüsschen) in prompts
status: done
type: bug
context: infrastructure
created: 2026-06-23
completed: 2026-07-03
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

**Reframed 2026-07-03 for autonomous work.** The original AC#1 was a manual
human-at-the-dashboard reproduce step (seed a prompt in VS Code, watch the live
`claude` launch) — a worker cannot drive a live terminal launch. Since the whole
transport path is Unicode-clean on paper and the most likely cause is a **stale
`.vsix`** (cause 1 below), the meaningful automated reproduction lives at the **code
layer**, and the live-launch codepage confirmation becomes a documented builder
follow-up rather than a blocking gate.

- [ ] **Regression fixture = the code-layer reproduction.** Extend the bridge/handler
      tests (`dashboard/test/bridge-*.test.mjs` and/or `vscode-extension/test/…`) with a
      non-ASCII typographic-quote fixture — `„Titel"`, `»Titel«`, and a plain `"x"` —
      asserting the prompt survives the transport round-trip (`readBody` UTF-8 →
      `JSON.parse` → `.trim()` → descriptor `{ command, args:[prompt] }`) **byte-for-byte**,
      mirroring how infra-020 guarded ASCII metacharacters. This is the layer any real bug
      would live at, and the durable guard against silent regression.
- [ ] **On green, localize + document the residual.** If the round-trip fixture passes,
      the transport layer is proven Unicode-clean; record (in the task's completion note /
      protocol) that the residual risk is confined to the **terminal-launch codepage layer**
      (`extension.js` `createTerminal` on win32) and leave a **manual builder follow-up**:
      confirm on a live VS Code launch with the current `.vsix` that `„ " » «` arrive
      verbatim. If the fixture instead **fails**, fix at the failing layer and keep the
      fixture as the guard.
- [ ] The clipboard-fallback path (bridge absent) copies `„ " » «` verbatim — covered by
      the same or a sibling fixture.
- [ ] **Doc-drift rider (do regardless):** the stale `claude "<prompt>"` comments — which
      describe the pre-infra-020 shell-wrap that no longer exists — are corrected to the
      raw-argv reality (the extension passes the prompt as a **raw argv element**; no shell
      wraps it). **Grep, don't trust line numbers** — they have already drifted since this
      task was written. Search `dashboard/app/` for the literal shell-wrap phrasing
      `claude "<prompt>"` and its skip-permissions variant
      `claude --dangerously-skip-permissions "<prompt>"`. Current hits (re-verified
      2026-07-03): `bridge-launch.js` (3×: the wrap phrase + 2 skip-variant docstrings),
      `modeling-command.js` (4×), `skip-permissions-state.js` (1×) — the last was **missing**
      from the original site list. **Exclude** the legitimate `"/agentheim:… <prompt>"`
      return-value placeholders in `modeling-command.js` (the `*CommandFor` docs) — those
      describe the command string, not a shell wrap, and are correct.

## Notes
Captured via `quick-capture` on 2026-06-23 — raw, unrefined. Refined 2026-07-03 (twice).
Second refine (2026-07-03) re-verified the code citations against the live tree while the
builder was away: the launch path is unchanged (`bridge.js` builds the raw-argv descriptor
around lines 176–191; `extension.js` — at `vscode-extension/extension.js`, *not* `src/` —
spawns it via `createTerminal` around lines 83–90). The hypothesis and promote gate are
untouched; the only substantive edit was making the doc-drift rider **grep-anchored** after
finding its line-number citations had already drifted and it had missed
`skip-permissions-state.js`.

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

**Promoted 2026-07-03** under the builder's autonomous-refinement authorization. The
three questions the earlier refine wanted from the builder (*where* it broke, *which*
quotes, *symptom*) are **not** promote gates anymore — the reframed AC lands the
autonomous value (the code-layer round-trip fixture + the do-regardless doc-drift
rider) without needing them, and localizes the residual to a documented manual
follow-up. If the round-trip fixture passes, this closes as "transport proven clean +
doc-drift rider landed", with the live-launch codepage check left as a builder
follow-up note; if the builder later reports a real live-launch failure, that becomes a
fresh, sharply-scoped capture at the terminal-launch layer.

Related: `infrastructure-020` (raw-argv `createTerminal` launch, ADR-0018) is the direct
predecessor that closed the shell-parsing half of this problem.

## Outcome

**Round-trip proved clean.** Added a byte-for-byte regression fixture —
`„Titel"`, `»Titel«`, `"x"` — to `vscode-extension/test/bridge.test.mjs`
(`typographic-quote survival (infrastructure-q8m4t)`), driving the real
`readBody`(UTF-8)→`JSON.parse`→`.trim()`→`{ command:'claude', args:[prompt] }`
seam in `vscode-extension/src/bridge.js` over an actual `node:http` request
(not just JSON.stringify/parse in isolation). All three fixtures round-trip
verbatim: the JSON transport is Unicode-clean, exactly as ADR-0018 predicted.
Mirrored the same three fixtures into `dashboard/test/bridge-launch.test.mjs`
for (a) the `POST /run` body built by `launchOrCopy`/`runOnBridge` in
`dashboard/app/bridge-launch.js`, and (b) the clipboard-fallback path — both
carry `„ " » «` byte-for-byte.

**Doc-drift rider landed.** Corrected every stale `claude "<prompt>"` /
`claude --dangerously-skip-permissions "<prompt>"` shell-wrap comment (the
pre-infra-020 description) to the raw-argv reality (a single argv element,
no shell, no quoting): `dashboard/app/bridge-launch.js` (3 sites),
`dashboard/app/modeling-command.js` (4 sites), `dashboard/app/skip-permissions-state.js`
(1 site). Left the legitimate `"/agentheim:… <prompt>"` `*CommandFor` return-value
docs in `modeling-command.js` untouched (those describe the command string, not
a shell wrap). Also confirmed `dashboard/app/board.js`'s 3 references to
`claude --dangerously-skip-permissions` (without the `"<prompt>"` shell-wrap
suffix) are accurate as-is and out of scope.

**Residual risk localized.** With the transport proven Unicode-clean at the
code layer, any real-world mojibake the builder hit is confined to the
**terminal-launch codepage layer** — `vscode-extension/extension.js`
`createTerminal` on win32 (VS Code's argv→command-line quoting / Windows
console codepage), the one layer a worker cannot drive live. **Manual builder
follow-up (not a gate):** on the current `.vsix`, seed a dashboard prompt
containing `„ " » «` and confirm the launched `claude` terminal displays them
verbatim; if it doesn't, capture a fresh, sharply-scoped task at the
terminal-launch layer.

**Test note:** two pre-existing, unrelated `vscode-extension/test/bridge.test.mjs`
tests (`binds 127.0.0.1 on the preferred fixed port...`, `falls back along
31425→31426→31427...`) fail in this environment because real, live VS Code
processes on this machine are already bound to ports 31425-31427 (confirmed via
`Get-NetTCPConnection` → `Get-Process`, all three owning PIDs are `Code.exe`).
This is environmental port contention predating this task (those tests bind
literal fixed ports and don't touch anything this task changed); all other
tests, including every new fixture, pass. Full `dashboard` suite: 711/711 green.

Files: `vscode-extension/test/bridge.test.mjs`, `dashboard/test/bridge-launch.test.mjs`,
`dashboard/app/bridge-launch.js`, `dashboard/app/modeling-command.js`,
`dashboard/app/skip-permissions-state.js`.
