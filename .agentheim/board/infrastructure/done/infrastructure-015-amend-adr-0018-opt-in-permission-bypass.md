---
id: infrastructure-015
title: Amend ADR-0018 — permit an opt-in bridge permission-bypass
status: done
type: decision
context: infrastructure
created: 2026-06-14
completed: 2026-06-14
commit: 54c242a
depends_on: []
blocks: [infrastructure-016, agentic-workflow-021]
tags: [bridge, security, permissions, adr, dashboard]
related_adrs: [0018, 0002]
related_research: [vscode-dashboard-terminal-bridge-2026-06-09]
prior_art: []
---

## Why
ADR-0018 ("VS Code dashboard→terminal bridge") carries an explicit **"No
permission-bypass"** clause: the launch never hard-wires
`--dangerously-skip-permissions`, and the bridge runs `claude` with its normal
permission prompts intact. The builder now wants an **opt-in** setting that, when
activated, launches the Quick Capture / Modeling buttons with
`--dangerously-skip-permissions`. That overturns a frozen decision with a written
safety rationale (ADR-0018's trust-boundary section: anything that reaches the
loopback listener can make `claude` edit files and run shell commands; bypassing
permissions removes the last prompt-gate on that). Because it reverses a recorded
architectural stance, it deserves its own decision rather than being smuggled in as
an implementation detail of the feature.

## What
Decide and record (as an in-place amendment to ADR-0018) the terms under which the
bridge may carry a permission-bypass, and freeze the additive `POST /run` contract
field the downstream build tasks depend on.

## Decision direction (refined — architect, 2026-06-14)
Recommendations to be ratified by the ADR amendment when this task is worked:

1. **Amend ADR-0018 in place — no new ADR.** ADR-0018 is still `status: proposed`;
   the repo only *supersedes* `accepted` ADRs (0001→0017, 0006 supersedes-in-part).
   Rewrite its "No permission-bypass" section into **"Permission-bypass — opt-in, off
   by default"**, add a dated amendment banner under the title noting the reversal, and
   extend `related_tasks`. `status` stays `proposed`; no `supersedes`/`diverges_from`
   frontmatter change.
2. **Contract field: optional boolean `skipPermissions` on `POST /run`.** Body becomes
   `{ prompt: string, skipPermissions?: boolean }`. **Only literal `true`** yields
   `claude --dangerously-skip-permissions "<prompt>"`; anything else (absent, `false`,
   the string `"true"`, null) reproduces today's `claude "<prompt>"` verbatim. Intent-
   named (survives a CLI-flag rename) and strict-`true` so malformed input fails toward
   safety. *(Open builder veto: `skipPermissions` vs. the flag-spelled
   `dangerouslySkipPermissions` — recommendation is `skipPermissions`.)*
3. **Guardrails the amendment must mandate:** the `X-Agentheim-Bridge-Token` stays
   required and unchanged (401 byte-identical for bypass launches — the bypass widens
   what an *authenticated* request may do, never *who* is authenticated); a **required
   at-a-glance, per-launch indicator** that a launch will skip permissions (the conscious
   moment is each launch, not the one-time toggle flip — visual detail deferred to
   agentic-workflow-021 / design-system); and an explicit **residual-risk paragraph**
   stating plainly what the override accepts.
4. **Bridge-launch-only — clipboard cannot carry it.** The clipboard fallback copies a
   slash command to paste into a *running* session; `--dangerously-skip-permissions` is
   a startup-only flag. The ADR closes the "does clipboard append the flag" question by
   naming the bridge-present/absent asymmetry as **accepted, not a defect**.
5. **Stays frozen (additive amendment — does not reopen 013/014/aw-020):** loopback
   `127.0.0.1` bind, port `31425` + `31425→31426→31427` ladder, token header (401),
   load-bearing `OPTIONS` preflight, malformed/empty body → 400, absence-degrades-
   silently-to-clipboard, `bridge.json` shape `{ port, token, v }`, server-never-runs-
   `claude`, `POST /inject` deferred.

## Acceptance criteria
- [ ] ADR-0018's "No permission-bypass" clause is **rewritten in place** to "Permission-bypass — opt-in, off by default", with a dated amendment banner noting it reverses the original stance (no new ADR file; `status` stays `proposed`).
- [ ] The `POST /run` contract is frozen with the bypass field: name (`skipPermissions`, or builder-vetoed `dangerouslySkipPermissions`), type boolean, default/absent = false, plus the exact command construction for `true` vs `false/absent`, written into the ADR's "HTTP shape" section.
- [ ] The ADR states **only literal `true` activates the bypass**; absent / false / malformed all reproduce `claude "<prompt>"` verbatim (fail-safe default).
- [ ] The ADR mandates: token required and unchanged (401 identical for bypass launches); a required at-a-glance per-launch indicator that the launch will skip permissions (visual detail deferred to aw-021 / design-system); and an explicit residual-risk paragraph.
- [ ] The ADR records that the clipboard fallback does not and cannot carry the bypass (startup-only flag), naming the bridge-present/absent asymmetry as accepted.
- [ ] The ADR lists what stays frozen (loopback bind, port ladder, token header, OPTIONS preflight, 400/401 codes, absence-degrades-to-clipboard, `bridge.json` shape, `POST /inject` deferred) so infrastructure-013/014 and agentic-workflow-020 remain valid.
- [ ] ADR-0018 `related_tasks` is updated to include infrastructure-015, infrastructure-016, agentic-workflow-021; the infra BC README's Bridge entry (line ~84) is updated to drop the absolute "never hard-wires a bypass" wording.

## Notes
- **Output is the ADR amendment, not code** (decision task). The extension code that
  honours the field is infrastructure-016; the dashboard toggle is agentic-workflow-021.
- **Blocks** infrastructure-016 and agentic-workflow-021 — both build against the field
  frozen here.
- Open builder veto (decision-only): wire field name `skipPermissions` (recommended) vs.
  `dangerouslySkipPermissions`.
- Bridge research backing: `knowledge/research/vscode-dashboard-terminal-bridge-2026-06-09.md`.

## Outcome
ADR-0018 amended in place (still `status: proposed`, no new ADR, no `supersedes`/`diverges_from`
change). Its "No permission-bypass" section is rewritten to **"Permission-bypass — opt-in, off by
default"** under a dated amendment banner. The `POST /run` contract is frozen with an optional
boolean **`skipPermissions`** (builder veto `dangerouslySkipPermissions` not exercised; recommended
intent-name used): body is `{ prompt: string, skipPermissions?: boolean }`, and **only** strict
`=== true` seeds `claude --dangerously-skip-permissions "<prompt>"` — absent/false/null/`"true"`
string/malformed all seed `claude "<prompt>"` verbatim. Guardrails mandated: token unchanged
(byte-identical 401), required per-launch at-a-glance indicator (visual deferred to aw-021 /
design-system), and an explicit residual-risk paragraph. The clipboard fallback is recorded as
unable to carry the bypass (startup-only flag), with the bridge-present/absent asymmetry accepted,
not a defect. A new "What stays frozen" subsection enumerates the unchanged seams (loopback bind,
port ladder, token header, OPTIONS preflight, 400/401, absence→clipboard, `bridge.json` shape,
`POST /inject` deferred) so infrastructure-013/014 and agentic-workflow-020 remain valid.
`related_tasks` extended with infrastructure-015/016 and agentic-workflow-021. Infra BC README
Bridge entry updated to drop the absolute "never hard-wires a bypass" wording.

Key files:
- `.agentheim/knowledge/decisions/0018-vscode-dashboard-terminal-bridge.md` (amended)
- `.agentheim/contexts/infrastructure/README.md` (Bridge entry + ADR-0018 Decisions summary)

**Iteration 2 fix (2026-06-14):** the iteration-1 verifier flagged a stale, self-contradictory line
in the infra README's ADR-0018 Decisions-section summary (`...malformed body → 400; no permission-bypass
flag is ever wired in.`) — an absolute present-tense claim contradicting the same README's amended ADR.
Replaced it with the optional, off-by-default `skipPermissions` wording (only literal `true` seeds
`claude --dangerously-skip-permissions "<prompt>"`; absent/false/malformed seeds `claude "<prompt>"`
verbatim; bridge-launch-only; per-launch indicator), matching the already-updated Bridge entry. The
ADR-0018 amendment itself was left untouched (it passed verification). README is now internally
consistent on the reversed clause.

## Verifier note (iteration 1)
**REASONS:**
- The infra BC README still asserts the reversed stance as current. `.agentheim/contexts/infrastructure/README.md:222` (the ADR-0018 Decisions-section summary bullet) reads "...malformed body → 400; no permission-bypass flag is ever wired in." This is an absolute present-tense claim that directly contradicts the amended ADR-0018 ("Permission-bypass — opt-in, off by default") recorded in the very same README. The worker updated the Bridge ubiquitous-language entry (line ~84) per the criteria but left the ADR-0018 summary bullet stale, leaving the README internally self-contradictory on the exact clause this task reverses (verifier check 5: BC README sync — README is now stale on the changed decision).

**SUGGESTED_FIX:** In `.agentheim/contexts/infrastructure/README.md` line ~222, replace "no permission-bypass flag is ever wired in" with wording consistent with the amendment (e.g. note the optional, off-by-default `skipPermissions` bypass), so the ADR-0018 summary bullet matches the amended ADR and the already-updated Bridge entry. No ADR change needed — the ADR amendment itself is correct and complete.

**ITERATION_HINT:** likely-fixable
