# Protocol

Chronological log of everything that happens in this project.
Newest entries on top.

---

## 2026-07-09 16:12 -- Modeling / Captured: agentic-workflow-aqyqd - Every prompt-bar mode requires a prompt — the decline-to-launch rule generalizes from Plain to all five

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** The builder used Plain's disabled-Enter-on-empty-prompt behavior (shipped 10 minutes earlier in `agentic-workflow-m3vhq`) and wants it for all five modes. This **reverses**, deliberately, the clause ADR-0050's second amendment had just written down — *"the four legacy modes always fire, empty prompt or not — their bare commands are meaningful."* Pressed on the consequence before capturing: the four bare-command constants (`QUICK_CAPTURE_COMMAND`, `MODELING_COMMAND`, `INQUIRE_COMMAND`, `RESEARCH_COMMAND`) are reachable from **exactly one** place — a mode's `commandFor('')` on an empty prompt — verified by grep to have no consumer outside `modeling-command.js`. So gating every mode makes the bare-skill launch **unreachable from the board**; bare sessions move to the terminal. Builder accepted that knowingly, over the alternative of preserving a second bare-launch affordance (which would have reopened `agentic-workflow-p8k4d`'s click-selects-only rule). Second decision settled at capture: `requiresPrompt` is **removed entirely**, not set `true` on all five entries — the flag existed only to mark Plain as *the exception*, so with no exception the per-mode axis is a fiction; "a prompt is required" is a property of the **bar**, not of a mode. `canFirePromptMode(index, prompt)` keeps its signature (call-site + test stability, and a cheap door back to a future per-mode exception) with `index` deliberately unread. Filed straight to `todo/` — both open questions were settled with the builder at capture time, leaving a deletion, one inverted predicate, and one ADR amendment. Flagged for the worker: two currently-passing tests encode the OLD rule *in their titles* (`prompt-mode.test.mjs`'s "canFirePromptMode is true for all four legacy modes…" and the module doc comment on Plain's uniqueness) — an AC forbids satisfying the suite by deleting them; they must be re-pinned to the reversed contract so the reversal stays visible.
**ADRs written:** none — ADR-0050 gains a **third** in-place `## Amendment` when the task is worked (the `p8k4d` / `m3vhq` precedent); no shipped decision is superseded by a new record.

---

## 2026-07-09 16:03 -- Work session ended

**Type:** Work / Session end
**Duration:** 22m (batch start 15:41 → 16:03)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-m3vhq: 1
**Commits:** 3 (batch-start + m3vhq completion + this session-end entry)
**Vision-conformance:** none — batch aligns with vision. The one shipped task was weighed against both named vision sections, and `agentic-workflow-m3vhq` is the batch where that weighing is *not* pro forma: a **Plain** mode is, by its own Why, "the escape hatch" from every Agentheim skill — the board's only text field can now talk to Claude with no skill, no slash command, no routing. That reads at first glance like a pull toward non-goal 2 (*"Not a general-purpose agent harness. It is opinionated DDD or nothing"*). It is not, and the distinction is worth recording rather than assuming. Non-goal 2 forbids Agentheim **presenting its method as optional** — offering DDD as one interchangeable framework among several. Plain offers no *rival* method; it offers *no* method, for a single one-off prompt, from a launcher textarea. Every method surface is untouched: `brainstorm`/`modeling`/`work`, the ADR + protocol + BC-README discipline, the lifecycle, and both adversarial gates all stand exactly as before — this task in fact *exercised* them (verifier PASS, ADR-0050 amended in place, README updated). Non-goal 3 (*"Not autonomous"*) holds tightest of all: a human types the prompt and clicks. And the "wrong work is caught by structure" criterion is untouched, because a Plain launch opens an interactive conversation, not a committed artifact — nothing it produces bypasses `work`'s verifier, which is the only path onto `main`. Zero flags; no whats-next advisory written (a clean batch must not clobber a genuine recommendation with an all-clear).
**Carry-over:** `inspiration/`: left behind (owner: builder reference material — the untracked UX-explorations folder; not project bookkeeping, never `work`'s to commit; same disposition as the 2026-07-09 15:29 session, builder-confirmed there). No stranded worktrees — `.worktrees/agentic-workflow-m3vhq` torn down at integration, `dashboard/node_modules` unlinked first, shared copy verified intact (10 entries) after removal.
**Notes:** One worker, one wave, one BC, first-try verified PASS. `agentic-workflow-m3vhq` appended a fifth mode, **Plain**, to `PROMPT_MODES` — `plainCommandFor` returns the trimmed prompt verbatim with **no command prefix**, making it deliberately the one builder with no bare-command constant (there is no skill to name). Its real weight is the property it forced into the model: **a mode may decline to launch.** The four legacy modes always fired because their bare commands (`/agentheim:modeling`, …) are meaningful on an empty prompt; Plain's command *is* the prompt, so an empty one has nothing to send. That is carried by a single new pure predicate, `canFirePromptMode(index, prompt)`, consulted by **both** decline paths rather than re-derived at each — `fire()`'s early return (the keyboard path: bare Enter still classifies as `launch`, so the classifier never learns about modes) and the Enter button's `disabled` prop (the click path, consuming `design-system-tfhn6`'s primitive unforked per ADR-0003). Neither AC is redundant: `disabled` blocks the click and leaves the tab order, but does nothing about a keystroke. **ADR-0050 amended in place** — no new ADR — following the `agentic-workflow-p8k4d` precedent, recording mode count 4→5, index bound `0..3`→`0..4`, the moved wrap targets, that the default/reset target (Quick Capture, index 0) is explicitly **unchanged**, and the decline-to-launch property its original text assumed away. **Three observations worth carrying forward.** (1) **Armed Plain is the one launch with no guardrail on either side.** When the board is armed, `fire()` threads `skipPermissions: true` for every mode, so an armed Plain launch runs an unconstrained prompt under `--dangerously-skip-permissions` — no skill behind it and no per-action permission prompt in front of it. The task's Notes name this as a deliberate non-change (the flag already reaches `/agentheim:work`, and it is human-clicked, so no non-goal is crossed) and it is recorded here so the choice stays visible rather than accidental. Not a defect; worth a builder's eye if the arming affordance is ever revisited. (2) The **`dist/app.js` EOL phantom vs. real-rebuild ambiguity** bit again and `git diff --numstat` again resolved it cleanly: `dashboard/dist/app.js` showed `228/226` (a genuine rebuild, required by AC 12 and committed), while `dashboard/dist/index.html` showed **zero changed lines** (pure phantom) and was reverted before the checkpoint rather than committed as noise. A `.gitattributes` decision task remains worthwhile — this is the third session to spend attention on it. (3) The **`claim` ENOENT on a git-pruned `doing/`** recurred: the mechanized `claim` threw `ENOENT` renaming into `.agentheim/contexts/agentic-workflow/doing/` because git had pruned the empty directory, leaving a partial mutation (task frontmatter rewritten, INDEX/protocol edited) that had to be reverted with `git checkout --` before `mkdir -p doing/` and a retry. Deterministic and recoverable, but it is a papercut every session with an empty `doing/` pays — `applyTaskMove` creating its destination directory would retire it. No bounces, no failures, no new backlog items, no concept candidates. `todo/` is empty across all three BCs.

---

## 2026-07-09 16:02 -- Task verified and completed: agentic-workflow-m3vhq - Prompt bar — add a "Plain" mode that runs the prompt directly on Claude

**Type:** Work / Task completion
**Task:** agentic-workflow-m3vhq - Prompt bar — add a "Plain" mode that runs the prompt directly on Claude
**Summary:** Prompt bar gains a fifth Plain mode that sends the prompt to Claude verbatim, and the first mode that can decline to launch
**Duration:** 20m
**Verification:** PASS (iteration 1)
**Files changed:** 9
**Tests added:** 14
**ADRs written:** none

---

## 2026-07-09 15:41 -- Batch started: [agentic-workflow-m3vhq]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-m3vhq - Prompt bar — add a "Plain" mode that runs the prompt directly on Claude
**Parallel:** no (1 worker — the full ready set; agentic-workflow-m3vhq is the only task in todo/ across all three BCs, all three depends_on satisfied. MAX_PARALLEL=3 not reached, nothing held back.)

---

## 2026-07-09 15:39 -- Modeling / Promoted: agentic-workflow-m3vhq - Prompt bar — add a "Plain" mode that runs the prompt directly on Claude

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-09 15:29 -- Work session ended

**Type:** Work / Session end
**Duration:** 28m (batch start 15:01 → 15:29)
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-h4n2v: 1, design-system-tfhn6: 1
**Commits:** 4 (batch-start + h4n2v completion + tfhn6 completion + this session-end entry)
**Vision-conformance:** none — batch aligns with vision. Both tasks were weighed against the two named vision sections. `agentic-workflow-h4n2v` adds a *server write*, which is the one thing worth a second look: ADR-0053's "runtime self-lifecycle" category widens a boundary ADR-0017 drew. It does not diverge from any stated criterion or non-goal — the write is triggered by an explicit builder click (the "Not autonomous" non-goal holds: the human is the gate), touches only the dashboard's own runfile inside `.agentheim/` (the "Not a SaaS / all state lives in `.agentheim/`" non-goal holds), and it *serves* "knowledge is durable" by recording the reversal in an ADR that supersedes aw-028 by name rather than drifting silently. It also serves "wrong work is caught by structure": the verifier drove a real launched dashboard and confirmed the flush-before-exit ordering rather than trusting the test. `design-system-tfhn6` is a single prop on a primitive, painted per ADR-0016, with the BC README gate-reopen note — pulls toward no non-goal. Zero flags; no whats-next advisory written (a clean batch must not clobber a real recommendation with an all-clear).
**Carry-over:** `dashboard/dist/app.js`: committed-state restored via `git checkout --` (derived output, regenerated in the MAIN tree by the conductor's own post-merge suite run — see Notes; reverting honors design-system-tfhn6's AC 5, which defers the rebuild to the consuming task `agentic-workflow-m3vhq`, per the standing ds-021 / r4k8m / xr4sb precedent; builder confirmed the disposition). `inspiration/`: left behind (owner: builder reference material — the untracked UX-explorations folder the q7r3x task file names as untracked reference; not project bookkeeping, never `work`'s to commit; builder confirmed). No stranded worktrees — both torn down at integration, `dashboard/node_modules` unlinked first in each, shared copy verified intact (10 entries) after both removals.
**Notes:** One wave, two workers in parallel across two BCs, zero file overlap, both first-try verified PASS. `agentic-workflow-h4n2v` replaced the Stop-dashboard menu item's bridge-spawned Claude session with a scoped `POST /api/stop` dispatched ahead of `server.mjs`'s 405 gate (the ADR-0046 shape), wrote **ADR-0053** naming a third write category — *runtime self-lifecycle*, sibling to lifecycle (ADR-0017, forbidden) and advisory (ADR-0027/0043/0046) — amended ADR-0017 and ADR-0046, and superseded aw-028's "the server is never asked to stop itself" along with its bridge-present/absent asymmetry. Stop now works in a plain browser tab and the overlay is truthful on 2xx rather than optimistic on dispatch. Its verifier booted a real dashboard (port 41354 read from the runfile), confirmed `POST /api/stop` returns 204 with the body received *before* `ECONNREFUSED`, that `GET`/`DELETE` on `/api/stop` still 405/404 through the gate, that `DELETE /api/whats-next` still works, and that the `launch.mjs stop` CLI path is unchanged; `Origin`/`Sec-Fetch-Site` was added to neither endpoint, symmetric by decision. `design-system-tfhn6` gave `EnterButton` the styleguide's **first disabled state** on any primitive — a real `disabled` attribute (not a `pointer-events` a11y lie), painted opacity-only (0.55 / `cursor: default`) with `--accent-ochre` left literal, so xr4sb's five pre-existing guards stayed green unmodified. That unblocks `agentic-workflow-m3vhq`. **Three findings worth carrying forward.** (1) `dashboard/test/dist-build.test.mjs` shells out to `build.mjs`, which *writes* `dashboard/dist/app.js` — so **running the dashboard suite rebuilds the bundle in whatever tree it runs in**. This is the real mechanism behind the recurring "agents rebuild `dist/` despite the contract" observation: workers are very likely not calling `build.mjs` at all; the suite they are told to run does it for them. The conductor's own post-merge verification run on `main` dirtied `dist/app.js` the same way. (2) Consequently `design-system-tfhn6`'s AC 5 ("`dist/` is **not** rebuilt here") is in **structural tension** with its own AC 7 ("styleguide + dashboard suites green") — no worker can satisfy both, because satisfying the second violates the first. The conductor reverted the derived output in the worktree before checkpointing, so the shipped commit is AC-5-clean, but the AC pair should be reconciled in `modeling` rather than re-litigated by each worker. (3) `git status` on `dashboard/dist/app.js` is ambiguous: it flags the file both for the known EOL phantom (`core.autocrlf=true`, no `.gitattributes`, zero changed lines) *and* for a real suite-triggered rebuild. `git diff --numstat` is the only reliable discriminator — an empty result is the phantom, a `3 2` is a real rebuild. Both appeared this session. A `.gitattributes` decision task remains worthwhile. `todo/` is now empty across all three BCs; `agentic-workflow-m3vhq` has all three `depends_on` satisfied (`design-system-001-styleguide`, `agentic-workflow-q7r3x`, `design-system-tfhn6`) and is ready for `modeling` to promote. No bounces, no failures, no new backlog items, no concept candidates. `design-system-tfhn6`'s worker reported `TESTS_ADDED: 5`; its verifier reconciled the true count to **4** landed test blocks (styleguide 173 → 177) and the protocol entry records 4.

---

## 2026-07-09 15:25 -- Task verified and completed: design-system-tfhn6 - EnterButton gains a disabled state

**Type:** Work / Task completion
**Task:** design-system-tfhn6 - EnterButton gains a disabled state
**Summary:** EnterButton gains a disabled prop forwarded to the real button attribute, painted opacity-only per ADR-0016
**Duration:** 18m
**Verification:** PASS (iteration 1)
**Files changed:** 4
**Tests added:** 4
**ADRs written:** none

---

## 2026-07-09 15:24 -- Task verified and completed: agentic-workflow-h4n2v - Stop dashboard menu item calls the stop script, not the slash command

**Type:** Work / Task completion
**Task:** agentic-workflow-h4n2v - Stop dashboard menu item calls the stop script, not the slash command
**Summary:** Stop dashboard menu item POSTs a scoped /api/stop endpoint directly instead of spawning a bridge session
**Duration:** 19m
**Verification:** PASS (iteration 1)
**Files changed:** 13
**Tests added:** 6
**ADRs written:** 0053-runtime-self-lifecycle-dashboard-stop-endpoint.md

---

## 2026-07-09 15:01 -- Batch started: [agentic-workflow-h4n2v, design-system-tfhn6]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-h4n2v - Stop dashboard menu item calls the stop script, not the slash command, design-system-tfhn6 - EnterButton gains a disabled state
**Parallel:** yes (2 workers — the full ready set; agentic-workflow-h4n2v touches dashboard/ only, design-system-tfhn6 touches styleguide/ only, zero file overlap, separate BC READMEs, so no merge-order constraint. MAX_PARALLEL=3 not reached. agentic-workflow-m3vhq stays in backlog — it depends on design-system-tfhn6, which ships in this batch.)

---

## 2026-07-09 14:56 -- Modeling / Promoted: design-system-tfhn6 - EnterButton gains a disabled state

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-07-09 -- Modeling / Refined: agentic-workflow-m3vhq - Prompt bar — add a "Plain" mode that runs the prompt directly on Claude

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog — still blocked, but on a *new* dependency this pass created. `design-system-tfhn6` (promoted to `todo/` here) must ship first; `agentic-workflow-q7r3x`, the blocker that refused promotion last pass, is now `done/`.
**Summary:** A second refinement pass run against the code `agentic-workflow-q7r3x` actually landed — and it falsified one of the first pass's acceptance criteria. AC 6 ("the Enter button renders disabled") was written when board.js still owned a board-local Enter button it could dim freely. q7r3x then replaced that with the styleguide's `EnterButton` primitive, consumed unforked (ADR-0003), whose props are exactly `{ onClick, size, ariaLabel }`. **No styleguide primitive supports a disabled state at all** — the only `disabled` anywhere in the design system is a focus-trap selector in `modal.js`. So AC 6 was unimplementable without either forking the primitive (forbidden) or faking it consumer-side with a `pointer-events: none` wrapper (an a11y lie: the `<button>` stays focusable and announces as enabled). The first pass's note "no new glyph, so no `design-system` dependency" reasoned about the *glyph* and never reached the *button*. Builder chose to close the gap on the primitive, mirroring the `design-system-xr4sb` → `agentic-workflow-q7r3x` precedent verbatim (styleguide ships it, dashboard consumes it unforked) over the wrapper or dropping the affordance. Split off **design-system-tfhn6**; m3vhq gains it as a third `depends_on` and AC 6 now names the prop. Settled tfhn6's paint as **de-emphasis by opacity** (ADR-0016), never a fill swap: `--accent-ochre` and `--accent-ochre-fg` are a contrast-matched pair (xr4sb added the latter precisely because the ochre inverts lightness across themes), so dimming both together preserves legibility in both — and the shipped guard `enter-button.test.mjs` asserts `background: "var(--accent-ochre)"` as a *literal*, so a conditional fill would break a test written to protect ADR-0048's carve-out. Also verified the rest of the task against live code: the `bot` glyph really is in `icons.js` (AC 7 holds), `PromptModeTab`'s `divider` prop is already length-derived so five cells need no change there, and `requiresPrompt` being absent on the four legacy modes makes them falsy-fire by construction (AC 3 holds). Pinned two `prompt-mode.test.mjs` assertions that silently *flip meaning* once `4` becomes a valid index and must be re-pinned rather than merely re-run (`clampPromptModeIndex(4) === 0` → `(5) === 0`; `4` leaves the `invalid` array). Recorded the standing insight that `disabled` blocks only the click path while `fire()`'s guard blocks the keyboard path — two entry points, one `canFirePromptMode` predicate, neither AC redundant.
**Split into:** design-system-tfhn6
**ADRs written:** none — tfhn6 adds a prop within ADR-0048/0051's existing carve-out and paints per ADR-0016; no shipped decision is reversed. It does reopen the styleguide gate (visible canvas change), per the standing xr4sb precedent.

---

## 2026-07-09 15:02 -- Modeling / Captured: agentic-workflow-h4n2v - Stop dashboard menu item calls the stop script, not the slash command

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** The topbar settings menu's Stop dashboard item currently fires `launchOrCopy(STOP_DASHBOARD_COMMAND)`, booting a whole Claude session via the bridge just to kill a pid and delete a runfile — and in a bridge-less browser it can only copy a string, so "Stop" stops nothing. Replace it with a scoped `POST /api/stop` on the dashboard server, dispatched ahead of `server.mjs`'s 405 method gate exactly as ADR-0046's `DELETE /api/whats-next` is. Builder chose the server-self-stop seam over having the bridge shell out to `launch.mjs stop`; that reverses aw-028's "the server is never asked to stop itself" and needs an ADR naming a third write category — **runtime self-lifecycle** — sibling to lifecycle (ADR-0017, forbidden) and advisory (ADR-0027/0043/0046). The carve-out is narrower than ADR-0046's: the only file touched is `.agentheim/.dashboard/runtime.json`, which the dashboard's own launch path already wrote and no skill reads. Pinned the non-obvious constraint that `stopDashboard()` kills by pid and under `/api/stop` that pid is the process serving the request — the response must flush before the process dies or the stopped overlay never renders.

---

## 2026-07-09 14:25 -- Work session ended

**Type:** Work / Session end
**Duration:** 18m (batch start 14:07 → 14:25)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-q7r3x: 1
**Commits:** 4 (batch-start + q7r3x completion + this session-end entry + a correction to this entry's Carry-over line)
**Vision-conformance:** none — batch aligns with vision (agentic-workflow-q7r3x conformed the docked prompt console to the reviewed 1b direction while consuming the design-system primitives unforked per ADR-0003 and preserving p8k4d's settled affordances; it serves "knowledge is durable" — BC README updated, the existing ADR-0051 contract honored rather than a redundant new ADR — and "wrong work is caught by structure": a first-try adversarial PASS including a live runtime drive. Pulls toward no non-goal; the builder's own look-vs-affordances carve-out drove the acceptance criteria, so the human-in-the-loop gate held; all state remains in `.agentheim/`.)
**Carry-over:** `dashboard/dist/app.js`: left behind (owner: repo EOL configuration, not this session — the worktree copy is byte-identical to its committed blob and `git diff` reports zero changed lines; `git status` marks it modified only because `core.autocrlf=true` with no `.gitattributes` expects CRLF in the working copy of a committed-LF file. Committing it would churn a 500KB derived bundle to CRLF for no content change, and a repo-wide EOL policy is a `modeling` decision, not `work`'s to make unattended). `inspiration/`: left behind (owner: builder reference material — the untracked UX-explorations folder the q7r3x task file itself names as untracked reference; not project bookkeeping, never `work`'s to commit; same disposition as every prior session). No stranded worktrees (q7r3x's torn down at integration; `node_modules` unlinked first, shared copy verified intact).
**Notes:** One wave, one worker, one first-try verified PASS. agentic-workflow-q7r3x rebuilt the prompt console's tab row as four edge-to-edge hairline-divided cells with a filled-cell + full-width ochre underline on the highlighted tab (replacing the four-sided ochre box — a bug fix toward ADR-0051's existing contract, hence no new ADR), swapped the chevron to a bright ochre bold `❯`, took the fuller lowercased 1b subtitles, wired the four `design-system-xr4sb` glyphs (`plus` / `diamond` / `message-circle-question` / `circle-dot`) and the `EnterButton` icon-square unforked from the styleguide (ADR-0003), and rebuilt the derived `dashboard/dist/` that xr4sb deliberately left underived. p8k4d's interaction model untouched: bare Enter still launches, the hint chip still reads `↵`, the placeholder is unchanged. Suite 964/964 (+8 new tests); the verifier drove the live runtime surface clean (port 41116 read from the runfile, both read probes green, torn down via `stop`). Two integration hazards worth recording: (1) the verifier's `node build.mjs` ran against the MAIN tree rather than its worktree, leaving derived `dashboard/dist/` edits that blocked the squash-merge — reverted as pure derived output (the branch already carried a verifier-confirmed-reproducible rebuild), a main-tree sibling of the known "worker rebuilds dist despite contract" hazard; (2) `git status` persistently flags `dashboard/dist/app.js` as modified when its bytes are identical to HEAD — EOL noise under `core.autocrlf=true` with no `.gitattributes`; a `git checkout --` clears it only until git next touches the index, so it is recorded as left-behind carry-over above rather than falsely reported as resolved. Worth a `.gitattributes` decision task if it keeps recurring. No bounces, no failures, no new backlog items, no concept candidates. Todo now empty across all BCs; `agentic-workflow-m3vhq` has both `depends_on` satisfied and is ready for `modeling` to promote.

---

## 2026-07-09 14:23 -- Task verified and completed: agentic-workflow-q7r3x - Prompt area matches Section 1b of the UX explorations reference exactly

**Type:** Work / Task completion
**Task:** agentic-workflow-q7r3x - Prompt area matches Section 1b of the UX explorations reference exactly
**Summary:** Conform the docked prompt console to Section 1b — edge-to-edge tab cells, underline paint, xr4sb glyphs, unforked EnterButton
**Duration:** 14m
**Verification:** PASS (iteration 1)
**Files changed:** 8
**Tests added:** 8
**ADRs written:** none

---

## 2026-07-09 14:07 -- Batch started: [agentic-workflow-q7r3x]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-q7r3x - Prompt area matches Section 1b of the UX explorations reference exactly
**Parallel:** no (1 worker — agentic-workflow-q7r3x is the only ready task in todo across all BCs; agentic-workflow-m3vhq is blocked on it and stays in backlog)

---

## 2026-07-09 -- Modeling / Refined: agentic-workflow-m3vhq - Prompt bar — add a "Plain" mode that runs the prompt directly on Claude

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog — auto-promotion attempted and correctly refused. The task is fully refined, but `promote` rejected it `blocked-dependency`: `agentic-workflow-q7r3x` is in `todo/`, not `done/`. Worth recording that the CLI is **stricter than the skill's prose** — `modeling`'s readiness bullet reads "dependencies known and either met **or tracked**", while `applyTaskMove` requires every `depends_on` id to sit in a `done/` folder. Re-promote once q7r3x ships; no re-refinement needed.
**Summary:** Cornered four builder decisions the capture left open: label confirmed as **Plain** (over the voice transcript's "Plane"); position is a **fifth peer appended last**, leaving Quick Capture as index 0 / the mount default / the post-launch reset target; an **empty prompt is a no-op** (Plain is the first mode that can decline to launch — the other four degrade to a meaningful bare command, Plain would fire the empty string); glyph reuses the existing `bot` key, so no `design-system` dependency. Wrote 12 concrete ACs naming the exact call sites: `plainCommandFor` (verbatim passthrough, no command prefix, no bare-command constant), a new pure `canFirePromptMode(index, prompt)` predicate consulted by both the `fire()` guard and the Enter button's disabled state, `promptBarKeyIntent` explicitly untouched (the decline lives in `fire()`, not the classifier), a 5-cycle `clampPromptModeIndex`/`nextPromptModeIndex` bound, and the `dashboard/dist/` rebuild. Added `depends_on: agentic-workflow-q7r3x` (it hard-codes "four edge-to-edge equal-width cells" and rewrites the same `BoardPromptBar`/`PromptModeTab` pair — sequencing avoids a two-worker collision in one file) plus the styleguide-gate dep; set the reciprocal `blocks` edge on q7r3x. Backlinked ADR-0050/0003/0018/0016 and the two "add a tab" precedents (h7n2c, aw-036). Recorded the armed-launch inheritance as an explicit non-change: Plain is the one mode with no skill guardrail behind `--dangerously-skip-permissions`.
**Split into:** none
**ADRs written:** none — ADR-0050 gains an `## Amendment` section at implementation time (four → five modes; a mode may decline to launch), mirroring the precedent `agentic-workflow-p8k4d` set.

---

## 2026-07-09 -- Capture / Captured: agentic-workflow-m3vhq - Prompt bar — add a "Plain" mode that runs the prompt directly on Claude

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** A fifth prompt-card option, "Plain", that sends the prompt straight to Claude without routing through an Agentheim skill.

---

## 2026-07-06 20:35 -- Modeling / Promoted: agentic-workflow-q7r3x - Prompt area matches Section 1b of the UX explorations reference exactly

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-06 20:34 -- Modeling / Refined: agentic-workflow-q7r3x - Prompt area matches Section 1b of the UX explorations reference exactly

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (auto-promoted — cleared the readiness gate)
**Summary:** Both dependencies (`design-system-001-styleguide`, `design-system-xr4sb`) are now in `done/` — xr4sb shipped today, so the task is fully unblocked. Concretized the two hand-wavy criteria against the actual shipped primitives: the glyph AC now names the exact registry keys per tab (Quick Capture→`plus`, Modeling→`diamond`, Inquire→`message-circle-question`, Research→`circle-dot`), and the Enter AC names the `EnterButton` primitive (`styleguide/app/button.js`, `corner-down-left` glyph, `--accent-ochre-fg` token) consumed unforked. Added an explicit `dashboard/dist/` rebuild AC (q7r3x is the consumer that rebuilds dist for the xr4sb primitives — the hazard the 17:15 work session flagged). Backlinked ADR-0003. No new ADR (box→underline stays a bug-fix toward existing ADR-0051). No split.
**Split into:** none
**ADRs written:** none

---

## 2026-07-06 18:40 -- Work session ended

**Type:** Work / Session end
**Duration:** 17m (batch start 18:23 → 18:40)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** infrastructure-nz6k4: 1
**Commits:** 3 (batch-start + nz6k4 completion + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (infrastructure-nz6k4 restores deterministic agent-spawn resolution under the installed `agentheim` plugin — it serves the "independent work runs in parallel" and "wrong work caught by structure (adversarial gates)" success criteria that the bare-name defect had broken at dispatch, and pulls toward no non-goal; human gates intact, all state in `.agentheim/`).
**Carry-over:** 1b.png / inspiration/ / yours.png: left behind (owner: builder reference material — the untracked UX-exploration pngs + dir, same disposition as every prior session; not project bookkeeping, never `work`'s to commit). No stranded worktrees (nz6k4's torn down at integration).
**Notes:** One wave, one worker, one first-try verified PASS. infrastructure-nz6k4 qualified every internal agent-spawn identifier across `skills/` (work, research, modeling, brainstorm) and `agents/` (worker + orchestrator Signal→Specialist routing tables) with the `agentheim:` namespace, ending reliance on undocumented harness auto-qualification of bare names (the `Agent type 'worker' not found` failure class). Added a live-tree lint (`lib/agent-spawn-namespace.mjs` + 6 tests) that fails if a bare spawn identifier reappears; full suite 189/189 green. Recorded the convention in ADR-0052 (scope: global, cross-refs ADR-0035 / ADR-0031; bidirectional backlinks written). One recovery hiccup at batch-start: the mechanized `claim` threw ENOENT on the git-pruned empty `doing/` dir (known infrastructure issue) — reverted the partial `status:` frontmatter mutation, recreated `doing/`, retried cleanly. No bounces, no failures, no new backlog items, no concept candidates. Todo now empty across all BCs.

---

## 2026-07-06 18:38 -- Task verified and completed: infrastructure-nz6k4 - Skills spawn subagents by bare name — fails as installed plugin ("Agent type 'worker' not found")

**Type:** Work / Task completion
**Task:** infrastructure-nz6k4 - Skills spawn subagents by bare name — fails as installed plugin ("Agent type 'worker' not found")
**Summary:** Namespace every internal agent-spawn identifier with agentheim: across skills/ and agents/; add a live-tree lint guard; ADR-0052
**Duration:** 14m
**Verification:** PASS (iteration 1)
**Files changed:** 9
**Tests added:** 6
**ADRs written:** 0052-namespace-agent-spawn-identifiers-with-agentheim-prefix.md

---

## 2026-07-06 18:23 -- Batch started: [infrastructure-nz6k4]

**Type:** Work / Batch start
**Tasks:** infrastructure-nz6k4 - Skills spawn subagents by bare name — fails as installed plugin ("Agent type 'worker' not found")
**Parallel:** no (1 worker — infrastructure-nz6k4 is the only ready task in todo across all BCs)

---

## 2026-07-06 18:20 -- Modeling / Promoted: infrastructure-nz6k4 - Skills spawn subagents by bare name — fails as installed plugin ("Agent type 'worker' not found")

**Type:** Modeling / Promote
**BC:** infrastructure
**From → To:** backlog → todo

---

## 2026-07-06 18:19 -- Modeling / Refined: infrastructure-nz6k4 - Skills spawn subagents by bare name — fails as installed plugin

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo (auto-promoted — cleared the readiness gate)
**Summary:** Resolved the parked open decision → **qualify agent-spawn identifiers with `agentheim:` unconditionally** (builder call; the source repo itself resolves agents namespaced, so option 1's "bare source-run breaks" downside is hypothetical). Corrected the Why: the capture claimed the bug killed the 16:56 `design-system-xr4sb` run, but the protocol records that run as a clean first-try PASS (now in `done/`, no stranded worktree) — reframed as a *latent* fragility (bare spawns depend on undocumented harness auto-qualification). Dropped the void "resume stranded xr4sb" AC; added an AC to author a `type: decision` ADR on the namespacing convention (x-ref ADR-0035 / ADR-0031) when worked; backlinked related_adrs [0031, 0035]. No split.
**Split into:** none
**ADRs written:** none (the convention ADR is authored when the task is worked, not during REFINE)

---

## 2026-07-06 17:20 -- Modeling / Captured: infrastructure-nz6k4 - Skills spawn subagents by bare name — fails as installed plugin ("Agent type 'worker' not found")

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** backlog
**Summary:** Skills spawn subagents by bare name (`subagent_type: "worker"`, verifier, research-reviewer, orchestrator, and the worker/orchestrator specialist routing tables), but as the installed `agentheim` plugin the agents are registered namespaced (`agentheim:worker`, …) — bare names fail to resolve and killed the 16:56 design-system-xr4sb work run at worker dispatch. Fix is to qualify every internal spawn identifier with `agentheim:` across skills/work, skills/research, skills/modeling, agents/worker.md, agents/orchestrator.md; evals already use the qualified form. Held in backlog on one open decision: qualify unconditionally vs. bare-name fallback for source-runs.

---

## 2026-07-06 17:15 -- Work session ended

**Type:** Work / Session end
**Duration:** 19m (batch start 16:56 → 17:15)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** design-system-xr4sb: 1
**Commits:** 3 (batch-start + xr4sb completion + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (design-system-xr4sb is supporting styleguide-primitive work — three Lucide glyphs + a solid-ochre icon `EnterButton` variant, consumed unforked by the blocked dashboard task; it serves the "durable knowledge / conform to a single reviewed styleguide" posture and pulls toward no non-goal. Human gates intact, dashboard stays read-only, all state in `.agentheim/`.)
**Carry-over:** dashboard/dist/app.js: reconciled (CRLF-only phantom, content-identical — restored to clean via `git checkout --`, same disposition as the 13:29 session). 1b.png / inspiration/ / yours.png: left behind (owner: builder reference material — the untracked UX-explorations pngs + dir, same disposition as every prior session; not project bookkeeping, never `work`'s to commit). No stranded worktrees (xr4sb's torn down at integration).
**Notes:** One wave, one worker, one first-try verified PASS. design-system-xr4sb added `diamond` (Modeling, replaces the undeliberate `compass`), `circle-dot` (Research, replaces `search`), and `corner-down-left` (`↵`) to the shared `LUCIDE` icon set at verbatim upstream geometry, surfaced `diamond`/`circle-dot` in the section-04 gallery, and introduced a solid-ochre icon-square `EnterButton` variant (filled `--accent-ochre`, `--radius-sm`, compact square, ADR-0048 primed-primary-action carve-out) documented as its own section-12 canvas specimen. Glyph legibility on the ochre fill draws from a new dedicated fixed `--accent-ochre-fg` token pair (not a theming surface token) added to both theme blocks. Inquire deliberately keeps `message-circle-question` (no revert to 1b's bare "?"). 19 tests added; styleguide suite 173/173 green, dashboard 767/767 green. **Worker scope note:** the worker rebuilt `dashboard/dist/` (app.js + colors_and_type.css) despite the task's explicit "do NOT rebuild dist/" contract (ADR-0003; the consumer agentic-workflow-q7r3x rebuilds it) — the conductor reverted those files in the worktree before the checkpoint, so no `dist/` change reached `main`; the merged diff is styleguide-source-only as the task requires. Gate reopened (visible canvas change) per the r4k8m/017 precedent — builder confirmation PENDING. No bounces, no failures, no new backlog items, no concept candidates. This unblocks agentic-workflow-q7r3x (the dashboard consumer). Todo is now empty across all BCs.

---

## 2026-07-06 17:13 -- Task verified and completed: design-system-xr4sb - Prompt-mode tab glyphs + solid-ochre icon Enter-button variant, aligned to 1b

**Type:** Work / Task completion
**Task:** design-system-xr4sb - Prompt-mode tab glyphs + solid-ochre icon Enter-button variant, aligned to 1b
**Summary:** Prompt-mode tab glyphs (diamond/circle-dot) + solid-ochre icon-square EnterButton (corner-down-left) aligned to 1b
**Duration:** 14m
**Verification:** PASS (iteration 1)
**Files changed:** 9
**Tests added:** 19
**ADRs written:** none

---

## 2026-07-06 16:56 -- Batch started: [design-system-xr4sb]

**Type:** Work / Batch start
**Tasks:** design-system-xr4sb - Prompt-mode tab glyphs + solid-ochre icon Enter-button variant, aligned to 1b
**Parallel:** no (1 worker — design-system-xr4sb is the only ready task in todo across all BCs)

---

## 2026-07-06 16:43 -- Modeling / Promoted: design-system-xr4sb - Prompt-mode tab glyphs + solid-ochre icon Enter-button variant, aligned to 1b

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-07-06 16:43 -- Modeling / Refined: design-system-xr4sb - Prompt-mode tab glyphs + solid-ochre icon Enter-button variant, aligned to 1b

**Type:** Modeling / Refine
**BC:** design-system
**Status after:** todo (auto-promoted — cleared the readiness gate)
**Summary:** Pinned the four prompt-mode glyphs to exact keys against a 1b/live side-by-side and settled the task's carried open call. Net icon-set work collapses to THREE additions — `diamond` (Modeling, replaces the undeliberate `compass` default), `circle-dot` (Research, replaces `search`; builder-chosen over `target`/`circle`), and `corner-down-left` for the solid-ochre icon Enter button (`↵` shape, filled `--accent-ochre`, ~square, ADR-0048 primed-primary-action carve-out). **Inquire keeps `message-circle-question`** — builder ruled r4k8m's deliberate "ask the codebase" glyph the intended post-1b evolution, so 1b's bare "?" is superseded: no shipped decision reversed, no ADR written. Tightened ACs to name each glyph + a `node --test` guard per new glyph (r4k8m/017 shape); `dist/` stays a derived artifact rebuilt by the consumer (agentic-workflow-q7r3x). No split.
**Split into:** none
**ADRs written:** none (the Inquire supersession call resolved toward keeping the shipped glyph, so nothing to record beyond the task/README note)

---

## 2026-07-06 14:15 -- Modeling / Refined: agentic-workflow-q7r3x - Prompt area matches Section 1b of the UX explorations reference exactly

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog (not promoted — blocked on the new design-system child)
**Summary:** Diffed the live prompt console (`yours.png`) against Section 1b (`1b.png`) and enumerated the concrete visual deltas as acceptance criteria: edge-to-edge tab cells + vertical dividers, a tab/input horizontal divider, active-tab filled-cell + full-width ochre underline (replacing the current 4-sided box — a bug fix toward ADR-0051's intent, no new ADR), a bright-ochre bold chevron, lowercased/fuller subtitle copy, and consuming a new glyph set + solid-ochre icon Enter button. Builder decisions (2026-07-06): match 1b's *look* but keep p8k4d's affordances (hint chip stays `↵`, not 1b's stale `⌘↵`); placeholder unchanged. Split the styleguide-owned primitives (mode glyphs + icon Enter-button variant) into a new design-system child, which q7r3x now depends on alongside the styleguide gate.
**Split into:** design-system-xr4sb (Prompt-mode tab glyphs + solid-ochre icon Enter-button variant, aligned to 1b — filed to design-system/backlog)
**ADRs written:** none (active-tab box→underline is a fix toward the existing ADR-0051 contract; the glyph-supersession vs design-system-r4k8m call is carried by design-system-xr4sb)

---

## 2026-07-06 12:00 -- Capture / Captured: agentic-workflow-q7r3x - Prompt area matches Section 1b of the UX explorations reference exactly

**Type:** Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Make the bottom-of-page prompt area (BoardPromptBar) look exactly like Section 1b in `inspiration/Agentheim UX Explorations.html`.

---

## 2026-07-06 13:29 -- Work session ended

**Type:** Work / Session end
**Duration:** 19m (batch start 13:10 → 13:29)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-p8k4d: 1
**Commits:** 3 (batch-start + p8k4d + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (p8k4d is pure dashboard interaction wiring reshaping the prompt bar's keyboard model to a chat-console idiom, plus an in-place ADR-0050 amendment; it serves the "durable knowledge" criterion by amending the ADR in place and explicitly recording that aw-038's swallow + single-line rules are intentionally reversed — the done record no longer silently contradicts shipped behavior — and the "wrong work caught by structure" criterion via a first-try verified build that drove the read-only runtime surface clean. Every human gate intact, dashboard stays read-only, all state in `.agentheim/`; no pull toward any non-goal.)
**Carry-over:** inspiration/: left behind (owner: builder reference material — the untracked UX-explorations dir, same disposition as the 12:19, 11:45, and 10:41 sessions; not project bookkeeping, never `work`'s to commit). No stranded worktrees (p8k4d's torn down at integration).
**Notes:** One wave, one worker, one first-try PASS. p8k4d reshaped the board prompt console into a chat-input idiom: bare Enter and Ctrl+Enter both launch the highlighted mode through the same `fire(highlightedMode)` path, Shift+Enter inserts a native line break (retiring aw-038's `sanitizePromptLine` single-line collapse so the field is genuinely multi-line), a window-scoped Ctrl+Space `document` keydown listener focuses the textarea, and a mode-tab click only moves the committed highlight without launching. `promptBarKeyIntent` gained a `NEWLINE` intent and dropped `SWALLOW`; the classification stays disjoint. ADR-0050 amended in place (`## Amendment`, mirroring the qf945/ADR-0015 precedent) recording all four reversals. 3 tests added; full dashboard suite green (767 pass / 0 fail); verifier drove the runtime surface (booted port 41157 from the runfile, `/healthz` + `/api/tree` both 200, clean teardown via `stop`). Operational note: the empty `doing/` dir had been git-pruned again between sessions — pre-flight `mkdir` avoided the known `claim` ENOENT; a phantom CRLF-only dirty `dashboard/dist/app.js` on the main tree was restored (`git checkout --`) before the squash-merge could proceed. No bounces, no failures, no new backlog items, no concept candidates. Todo is now empty across all BCs.

---

## 2026-07-06 13:27 -- Task verified and completed: agentic-workflow-p8k4d - Prompt bar — Enter launches, Shift+Enter newlines, Ctrl+Space focuses, tab-click only selects

**Type:** Work / Task completion
**Task:** agentic-workflow-p8k4d - Prompt bar — Enter launches, Shift+Enter newlines, Ctrl+Space focuses, tab-click only selects
**Summary:** Prompt bar — bare/Ctrl+Enter launches, Shift+Enter newlines, Ctrl+Space focuses the field, tab-click only selects; ADR-0050 amended in place
**Duration:** 14m07s
**Verification:** PASS (iteration 1)
**Files changed:** 9
**Tests added:** 3
**ADRs written:** 0050-prompt-bar-keyboard-committed-selection-model.md (amendment)

---

## 2026-07-06 13:10 -- Batch started: [agentic-workflow-p8k4d]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-p8k4d - Prompt bar — Enter launches, Shift+Enter newlines, Ctrl+Space focuses, tab-click only selects
**Parallel:** no (1 worker — p8k4d is the only ready task in todo across all BCs)

---

## 2026-07-06 13:05 -- Modeling / Promoted: agentic-workflow-p8k4d - Prompt bar — Enter launches, Shift+Enter newlines, Ctrl+Space focuses, tab-click only selects

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-06 11:40 -- Modeling / Refined: agentic-workflow-p8k4d - Prompt bar — Enter launches, Shift+Enter newlines, Ctrl+Space focuses, tab-click only selects

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (auto-promoted — cleared the readiness gate)
**Summary:** Settled the three open questions and added a fourth requirement the builder raised. ADR-0050 → in-place amendment (builder-confirmed). Ctrl+Space → window-scoped document listener (builder-confirmed). NEW: Shift+Enter inserts a line break, turning the field genuinely multi-line and retiring aw-038's `sanitizePromptLine` single-line collapse; verified multi-line prompts survive launch end-to-end (bridge = raw argv no shell wrap, clipboard verbatim, `safePrompt` trims ends only). Ctrl+Enter kept as a harmless launch alias. `promptBarKeyIntent` gains a `newline` intent and drops `swallow`. No split; still one feature task producing code + the ADR-0050 amendment.
**Split into:** none
**ADRs written:** none (the ADR-0050 amendment is authored by the worker at execution)

---

## 2026-07-06 11:22 -- Modeling / Captured: agentic-workflow-p8k4d - Prompt bar — bare Enter launches, Ctrl+Space focuses the field, tab click only selects

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Reshape the board prompt bar's interaction model (ADR-0050): Ctrl+Space focuses the prompt field, bare Enter launches the highlighted mode (like the Enter button, reversing the aw-038 swallow rule), and a mode-tab click only selects instead of launching a session on contact. Backlog pending a refinement pass to settle the ADR-0050 amendment (Ctrl+Enter's fate, Ctrl+Space scope).

---

## 2026-07-05 12:19 -- Work session ended

**Type:** Work / Session end
**Duration:** 16m (batch start 12:03 → 12:19)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-c2ver: 1
**Commits:** 3 (batch-start + c2ver + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (c2ver is pure UI wiring to the pre-settled ADR-0015 amendment — the frozen v2 board-wide-lens contract — serving the "wrong work caught by structure" criterion via a first-try verified build; the persisted store stays bounded to presentation view-state per the ADR, dashboard stays read-only per ADR-0017, every human gate intact, all state in `.agentheim/`; no pull toward any non-goal)
**Carry-over:** inspiration/: left behind (owner: builder reference material — the untracked UX-explorations dir, same disposition as the 10:41 and 11:45 sessions; not project bookkeeping, never `work`'s to commit). No stranded worktrees (c2ver's torn down at integration).
**Notes:** One wave, one worker, one first-try PASS — the last dashboard-redesign build in the pipeline. c2ver replaced `ColumnSortControl`/`ColumnGroupToggle` (all four columns) with one board-wide `ViewChip` composed unforked on the ds-015 `Menu` primitive, added the "COLUMNS" uppercase label, and rewrote `dashboard/app/board-view-state.js` v1→v2 (`{ version: 2, lens: { grouped, sort }, columns: { [col]: { collapsed, peek } } }`; any non-v2 blob degrades to board-wide defaults, never a throw; dormant retention of `collapsed[]` across grouped toggles verified). Done-column peek wiring untouched; pipeline order preserved. 10 tests added; verifier drove the runtime surface (boot, /healthz + /api/tree 200, clean teardown) and attributed the only 2 suite failures to pre-existing port-binding flakes in `vscode-extension/` — a layer this task never touches. Operational note: the empty `doing/` dir had been git-pruned again between sessions — pre-flight `mkdir` avoided the known `claim` ENOENT this time; the `applyTaskMove` auto-create-missing-`doing/` guard remains worth landing. No bounces, no ADRs, no concept candidates, no new backlog items. Todo is now empty across all BCs.

---

## 2026-07-05 12:18 -- Task verified and completed: agentic-workflow-c2ver - Board columns — singular "View" chip replacing per-column Sort/Group; add "COLUMNS" label

**Type:** Work / Task completion
**Task:** agentic-workflow-c2ver - Board columns — singular "View" chip replacing per-column Sort/Group; add "COLUMNS" label
**Summary:** Replaced the four per-column Sort + Group-by-BC controls with one board-wide ViewChip composed unforked on the shared Menu primitive, added the COLUMNS uppercase label, and rewrote the persisted view-state store to the v2 board-wide-lens shape frozen by ADR-0015's amendment — per-column collapsed/peek retained unchanged
**Duration:** 14m
**Verification:** PASS (iteration 1)
**Files changed:** 8
**Tests added:** 10
**ADRs written:** none

---

## 2026-07-05 12:04 -- Batch started: [agentic-workflow-c2ver]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-c2ver - Board columns — singular "View" chip replacing per-column Sort/Group; add "COLUMNS" label
**Parallel:** no (1 worker — c2ver is the only ready task in todo across all BCs)
**Planning advisory:** whats-next (2026-07-05T09:02Z — stale, predates the 11:45 session end) named c2ver the natural follow-up after bz3az; consistent with the DAG, which has c2ver as the only ready task

---

## 2026-07-05 11:50 -- Modeling / Promoted: agentic-workflow-c2ver - Board columns — singular "View" chip replacing per-column Sort/Group; add "COLUMNS" label

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-05 11:49 -- Modeling / Refined: agentic-workflow-c2ver - Board columns — singular "View" chip replacing per-column Sort/Group; add "COLUMNS" label

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Reconciliation pass after qf945 landed its ADR-0015 amendment (10:38) and sibling bz3az landed the prompt-bar rebuild (11:44): verified the task's frozen v2 store shape against the amended ADR — exact match, no criteria changed. Cleared the stale "blocked on qf945" note and the board.js file-overlap sequencing caution (bz3az done; ColumnSortControl/ColumnGroupToggle untouched at board.js:136/165), re-verified premises against the tree (board-view-state.js still v1; ds-015 Menu primitive exports Menu/MenuItem/MenuDivider at styleguide/app/menu.js), added bz3az to prior_art. All four depends_on in done/ — passed the readiness gate and auto-promoted.
**Split into:** none
**ADRs written:** none

---

## 2026-07-05 11:45 -- Work session ended

**Type:** Work / Session end
**Duration:** 21m (batch start 11:24 → 11:45)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-bz3az: 1
**Commits:** 3 (batch-start + bz3az + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (bz3az builds the docked prompt console exactly to the three pre-settled contracts — ADR-0050 interaction, ADR-0051/0048 paint — serving the "wrong work caught by structure" and "knowledge is durable" criteria; dashboard stays read-only per ADR-0017, every human gate intact, all state in `.agentheim/`; no pull toward any non-goal)
**Carry-over:** inspiration/: left behind (owner: builder reference material — untracked UX-explorations dir, same disposition as the 10:41 session; not project bookkeeping, never `work`'s to commit). No stranded worktrees (bz3az's torn down at integration).
**Notes:** One wave, one worker, one first-try PASS. bz3az rebuilt `BoardPromptBar` into the 1b docked bottom-center console: new pure module `dashboard/app/prompt-mode.js` (PROMPT_MODES / nextPromptModeIndex / clampPromptModeIndex / promptBarKeyIntent, all four ADR-0050 invariants `node --test`-covered), ochre highlighted tab (ADR-0051) + ochre Enter button (ADR-0048), other tabs de-emphasized (ADR-0016). 20 tests added, suite 754 green; verifier also drove the runtime surface (boot, /healthz + /api/tree 200, teardown). Worker touched `whats-next-panel.test.mjs` alongside — the panel composes inside the rebuilt bar; verifier passed scope. No bounces, no ADRs written, no concept candidates, no new backlog items. Sibling c2ver (same board.js) remains in backlog — promote via `modeling` when ready.

---

## 2026-07-05 11:44 -- Task verified and completed: agentic-workflow-bz3az - Board prompt bar — 4-mode tabs row + Ctrl-arrow / Ctrl-Enter keyboard model + ochre active tab

**Type:** Work / Task completion
**Task:** agentic-workflow-bz3az - Board prompt bar — 4-mode tabs row + Ctrl-arrow / Ctrl-Enter keyboard model + ochre active tab
**Summary:** Rebuilt the board prompt bar into the ADR-0050/0051 docked bottom-center console — four keyboard-committed mode tabs with a new pure prompt-mode.js module (cycle/launch/swallow keyboard model) plus an ochre-licensed highlighted tab and Enter button, replacing the flat PromptLaunchCard row
**Duration:** 20m
**Verification:** PASS (iteration 1)
**Files changed:** 8
**Tests added:** 20
**ADRs written:** none

---

## 2026-07-05 11:24 -- Batch started: [agentic-workflow-bz3az]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-bz3az - Board prompt bar — 4-mode tabs row + Ctrl-arrow / Ctrl-Enter keyboard model + ochre active tab
**Parallel:** no (1 worker — bz3az is the only ready task; sibling c2ver still in backlog, sequenced after bz3az per the shared board.js caution)
**Planning advisory:** whats-next (2026-07-05T09:02Z — stale, predates the 10:41 session end) recommends leading with bz3az; consistent with the DAG, which has bz3az as the only ready task

---

## 2026-07-05 11:16 -- Modeling / Promoted: agentic-workflow-bz3az - Board prompt bar — 4-mode tabs row + Ctrl-arrow / Ctrl-Enter keyboard model + ochre active tab

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-05 11:16 -- Modeling / Refined: agentic-workflow-bz3az - Board prompt bar — 4-mode tabs + keyboard model + ochre active tab

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Reconciliation pass after design-system-rm2yv landed ADR-0051 (10:39): verified the task's paint criteria against ADR-0051's recorded four-tabs-plus-Enter contract — exact match, no criteria changed. Folded in the ADR-0051 pointer (related_adrs + prose, replacing the pending-rm2yv references), added ADR-0051's token guidance (reuse `--accent-ochre`, no new token), cleared the stale "blocked until rm2yv" note, and noted the board.js file-overlap sequencing caution vs sibling c2ver. All five depends_on now in done/ — passed the readiness gate and auto-promoted.
**Split into:** none
**ADRs written:** none (ADR-0051 was rm2yv's worked output; this task gains the backlink)

---

## 2026-07-05 10:41 -- Work session ended

**Type:** Work / Session end
**Duration:** 13m (first batch start 10:28 → 10:41)
**Completed:** 2 (first-try PASS: 1, re-dispatched: 0, skipped: 1)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-qf945: 1, design-system-rm2yv: 1
**Commits:** 4 (batch-start + qf945 + rm2yv + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (both completed tasks are `type: decision` ADR authorship serving the "durable knowledge / decisions don't get made-and-lost" success criterion; every human gate intact; all state in `.agentheim/`; no pull toward any non-goal)
**Carry-over:** inspiration/: left behind (owner: builder reference material — the untracked UX-explorations reference dir, present since before this session; not project bookkeeping, never `work`'s to commit). No stranded worktrees (both torn down at integration).
**Notes:** One wave, two decision tasks, zero bounces/failures/escalations — both ADR-only, zero file overlap, different BCs. **qf945** amended **ADR-0015** in place (per-column → single board-wide view lens for sort + group-by-BC; per-(column,BC) `collapsed[]` and Done `peek` retained column-scoped; `VIEW_STATE_VERSION` → 2 with a safe-reset degrade path and the dormant-retention rule pinned; reasoned amend-in-place from ADR-0015's `proposed` status per the ADR-0021 / infrastructure-015 precedent) — verification **auto-SKIPPED** (decision task, single ADR file). **rm2yv** wrote provisional **ADR-0051** amending **ADR-0048** (extends the bounded ochre wayfinding exception from one surface to two, adding the highlighted prompt-mode tab; keeps the discriminating test + fence intact — still exactly two enumerated surfaces, non-citable elsewhere; reuses `--accent-ochre`, no new token; records the full four-tabs-plus-Enter paint contract; reconciles ADR-0050's untouched interaction model) — first-try verifier **PASS**. Both freeze contracts that unblock downstream backlog builds: qf945 → agentic-workflow-c2ver (board columns View chip / store rewrite), rm2yv → agentic-workflow-bz3az (prompt-bar rebuild). **Operational note:** the mechanized `claim` verb threw **ENOENT** on the first attempt because git had pruned both empty `doing/` dirs between sessions — reverted the partial frontmatter mutation, `mkdir -p` both `doing/` dirs, retried clean (no INDEX/protocol touched on the failed attempt); the recurring `applyTaskMove` auto-create-missing-`doing/` guard is still worth landing. No concept candidates.

---

## 2026-07-05 10:39 -- Task verified and completed: design-system-rm2yv - Extend the ochre wayfinding exception to the highlighted prompt-mode tab

**Type:** Work / Task completion
**Task:** design-system-rm2yv - Extend the ochre wayfinding exception to the highlighted prompt-mode tab
**Summary:** Wrote provisional ADR-0051 amending ADR-0048 to extend the bounded ochre wayfinding exception from one surface to two, adding the highlighted prompt-mode tab; reconciled with ADR-0050 (interaction untouched) and recorded the full four-tabs-plus-Enter paint contract for the downstream build
**Duration:** 3m
**Verification:** PASS (iteration 1)
**Files changed:** 2
**Tests added:** 0
**ADRs written:** 0051-ochre-wayfinding-exception-extends-to-highlighted-prompt-mode-tab.md

---

## 2026-07-05 10:38 -- Task completed (verification skipped): agentic-workflow-qf945 - Reverse ADR-0015 per-column scope — one board-wide view lens, per-(column,BC) collapse/peek retained (amend in place)

**Type:** Work / Task completion
**Task:** agentic-workflow-qf945 - Reverse ADR-0015 per-column scope — one board-wide view lens, per-(column,BC) collapse/peek retained (amend in place)
**Summary:** Amended ADR-0015 in place: the board view lens (sort + group-by-BC) reverses from per-column to a single board-wide lens; per-(column,BC) collapsed[] and Done peek stay column-scoped; VIEW_STATE_VERSION bumps to 2 with a safe-reset degrade path and dormant-retention pinned
**Duration:** 1m51s
**Verification:** SKIPPED — decision-only task
**Files changed:** 1

---

## 2026-07-05 10:28 -- Batch started: [design-system-rm2yv, agentic-workflow-qf945]

**Type:** Work / Batch start
**Tasks:** design-system-rm2yv - Extend the ochre wayfinding exception to the highlighted prompt-mode tab, agentic-workflow-qf945 - Reverse ADR-0015 per-column scope — one board-wide view lens, per-(column,BC) collapse/peek retained (amend in place)
**Parallel:** yes (2 workers — agentic-workflow-qf945 amends ADR-0015 in place; design-system-rm2yv writes provisional ADR-0051 + pointer to ADR-0048; different BCs, zero file overlap)

---

## 2026-07-05 10:18 -- Modeling / Promoted: agentic-workflow-qf945 - Reverse ADR-0015 per-column scope — one board-wide view lens, per-(column,BC) collapse/peek retained (amend in place)

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-05 10:18 -- Modeling / Promoted: design-system-rm2yv - Extend the ochre wayfinding exception to the highlighted prompt-mode tab

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-07-05 10:10 -- Modeling / Refined: agentic-workflow-c2ver - Board columns — singular "View" chip replacing per-column Sort/Group

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Split the ADR-0015 scope-reversal out of c2ver's acceptance criteria into its own `type: decision` task (mirroring how the sibling prompt-bar rebuild bz3az got s7gev/ADR-0050 first); c2ver becomes pure UI wiring and now depends_on the decision. Architect ruling folded in: **amend ADR-0015 in place** (still `proposed`; supersession here is reserved for `accepted` ADRs) rather than write a superseding ADR. Froze the v2 store shape (board-wide `lens: { grouped, sort }` + retained per-(column,BC) `columns: { collapsed, peek }`, hard version-bump reset) and pinned the tactical-modeler's dormant-retention rule (grouping off→on must not clear `collapsed[]`). Collapse stays per-(column,BC) and Done `peek` stays per-column per the builder's call.
**Split into:** agentic-workflow-qf945 (decision — reverse ADR-0015 per-column scope, amend in place)
**ADRs written:** none (the ADR-0015 amendment is qf945's worked output, not written at refine)

---

## 2026-07-05 03:10 -- Modeling / Refined: agentic-workflow-bz3az - Board prompt bar — 4-mode tabs + keyboard model + ochre active tab

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Reconciled the task against the two decisions that landed after its capture. Interaction is now pinned to ADR-0050 (`prompt-mode.js` shape + four invariants); acceptance criteria rewritten to that contract, plus an explicit Enter-button-fires-highlighted-mode criterion and a docked-console geometry criterion. Resolved a load-bearing paint defect: the task cited [[design-system-vw12e]] as the authority for an "ochre active tab", but vw12e/ADR-0048/ADR-0050 had classified that exact surface as ochre-*forbidden* (de-emphasis). Builder chose to keep the ochre tab and reopen ADR-0048 → split out a design-system decision task ([[design-system-rm2yv]]) to record the amendment; bz3az now depends on it. Builder also confirmed the full 1b docked two-row console is in scope for this one task. Stays in backlog — now correctly gated behind rm2yv (fail-closed dependency, ADR-0038).
**Split into:** design-system-rm2yv (decision — extend ADR-0048's ochre wayfinding exception to the highlighted prompt-mode tab)
**ADRs written:** none (rm2yv authors provisional ADR-0051 when worked)

---

## 2026-07-05 02:08 -- Work session ended

**Type:** Work / Session end
**Duration:** 30m (first batch start 01:38 → 02:08)
**Completed:** 5 (first-try PASS: 4, re-dispatched: 0, skipped: 1)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-s7gev: 1, design-system-t896s: 1, agentic-workflow-vk6mc: 1, agentic-workflow-a2pm1: 1, agentic-workflow-wsfsk: 1
**Commits:** 8 (2 batch-start + s7gev + t896s + vk6mc + a2pm1 + wsfsk + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (all five are dashboard-redesign / styleguide UI-wiring tasks; s7gev's ADR-0050 directly serves the "durable knowledge" success criterion; every human gate stays intact — the styleguide gate re-review remains builder-PENDING for t896s — and all state stays in `.agentheim/` / `dashboard/` / `styleguide/`; no pull toward any non-goal)
**Carry-over:** inspiration/: left behind (owner: builder reference material — the untracked `inspiration/Agentheim UX Explorations.html` UX-explorations brief, present since before this session; not project bookkeeping, never `work`'s to commit)
**Notes:** Two waves, five tasks, zero bounces/failures/escalations. **Wave 1** (01:38): s7gev, t896s, vk6mc — a zero-file-overlap batch (ADR-only + design-system/styleguide + one board.js topbar task). s7gev recorded **ADR-0050** fixing the prompt-bar keyboard-committed selection model (single 0-based `highlightedMode` index, four invariants, hover/selection as orthogonal channels; supersedes PromptLaunchCard's "no selection model" stance; names `dashboard/app/prompt-mode.js` for the downstream build [[agentic-workflow-bz3az]]) — verification auto-SKIPPED (decision-only, single ADR). t896s introduced a **dedicated `--radius-card: 10px` token** (grepped every `--radius-md` consumer first; chose isolation over a shared-token bump so Menu/Modal/Drawer keep 8px) and reopened the styleguide gate (builder re-review PENDING). vk6mc recolored the topbar **What's-next button to the ochre `cta`** treatment (`--accent-ochre` on `--accent-ochre-soft`, ADR-0048 carve-out; armed `--obligation` red icon re-verified to win over the ochre, aw-041). **Wave 2** (01:55): a2pm1, wsfsk — both edit `dashboard/app/board.js` but different functions (WhatsNextPanel vs ShellRail), dispatched together with sequential merge-order. a2pm1 rebuilt **WhatsNextPanel into a numbered flight-plan stepper** (position-based circles + connectors, step 2 wearing the licensed `--emphasis-border` hero, dismiss/DELETE + `splitWhatsNextSections` loss-tolerance untouched). wsfsk gave **ShellRail its 1a shape** (236px, WORKSPACE header, a pure loss-tolerant `footerStatusLine` helper, and the active-nav ochre inset rail via a new `RailNavSlot`, ADR-0048 surface-5 wayfinding carve-out cited in-code). All four non-decision tasks first-try PASS; each verifier drove the live dashboard clean (check 8, ADR-0036) on its own bound port. **Shared derived-artifact discipline:** every dashboard task rebuilt `dashboard/dist/app.js`; where two tasks' rebuilds converged on `main` (t896s+vk6mc, then a2pm1+wsfsk) the bundle was **rebuilt from merged `main` source** rather than trusting the 3-way merge of minified output — final suites 734 (wave 1) and 747 (wave 2) green, both wave-2 markers confirmed present in the bundle. **Operational note:** the mechanized `claim` verb threw ENOENT twice because git had pruned the empty `doing/` directories between batches — recreated with `mkdir -p` and the partial frontmatter mutation reverted before re-running (no INDEX/protocol touched on the failed attempts); worth a future guard in `applyTaskMove` to auto-create a missing `doing/`. No concept candidates. The dashboard redesign's topbar, left-nav, and What's-next surfaces are now all landed; the prompt-bar rebuild [[agentic-workflow-bz3az]] and columns/condensed-card wiring [[agentic-workflow-c2ver]] remain in backlog awaiting promotion.

---

## 2026-07-05 02:07 -- Task verified and completed: agentic-workflow-wsfsk - Left nav — 1a single-panel shape (width, tree label, footer status line)

**Type:** Work / Task completion
**Task:** agentic-workflow-wsfsk - Left nav — 1a single-panel shape (width, tree label, footer status line)
**Summary:** ShellRail now matches the 1a single-panel shape — 236px width, WORKSPACE tree header, a loss-tolerant footer status line (all clear · N done via a pure footerStatusLine helper), and the active primary-nav item ochre inset rail (new RailNavSlot wrapper, ADR-0048 wayfinding carve-out cited in-code); tree-group mono counts unchanged
**Duration:** 16m
**Verification:** PASS (iteration 1)
**Files changed:** 7
**Tests added:** 8
**ADRs written:** none

---

## 2026-07-05 02:05 -- Task verified and completed: agentic-workflow-a2pm1 - What's Next panel — 3-step flight plan with ochre step-2 hero

**Type:** Work / Task completion
**Task:** agentic-workflow-a2pm1 - What's Next panel — 3-step flight plan with ochre step-2 hero
**Summary:** Rebuilt WhatsNextPanel into a numbered, connected flight-plan stepper (three position-numbered circles joined by horizontal connectors above the capped cards), step 2 wearing the licensed --emphasis-border hero; X-dismiss/DELETE wiring and splitWhatsNextSections loss-tolerance unchanged
**Duration:** 13m
**Verification:** PASS (iteration 1)
**Files changed:** 4
**Tests added:** 5
**ADRs written:** none

---

## 2026-07-05 01:53 -- Batch started: [agentic-workflow-a2pm1, agentic-workflow-wsfsk]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-a2pm1 - What's Next panel — 3-step flight plan with ochre step-2 hero, agentic-workflow-wsfsk - Left nav — 1a single-panel shape (width, tree label, footer status line)
**Parallel:** yes (2 workers — a2pm1 WhatsNextPanel + wsfsk ShellRail, both in dashboard/app/board.js but different functions; sequential merge-order at integration, dist rebuilt per-integration)

---

## 2026-07-05 01:52 -- Task verified and completed: agentic-workflow-vk6mc - Topbar — recolor What's-next to the ochre CTA; regression-guard the unchanged parts

**Type:** Work / Task completion
**Task:** agentic-workflow-vk6mc - Topbar — recolor What's-next to the ochre CTA; regression-guard the unchanged parts
**Summary:** Recolored the What's-next LaunchButton in BoardTopbar to a new ochre cta emphasis (--accent-ochre text on --accent-ochre-soft fill/border, ADR-0048 carve-out), left Work's primary treatment untouched, and regression-guarded search-leftmost, gear→What's-next→Work ordering, and the armed --obligation red icon cue
**Duration:** 15m
**Verification:** PASS (iteration 1)
**Files changed:** 5
**Tests added:** 6
**ADRs written:** none

---

## 2026-07-05 01:50 -- Task verified and completed: design-system-t896s - TicketCard — bump corner radius toward 1b's 10px

**Type:** Work / Task completion
**Task:** design-system-t896s - TicketCard — bump corner radius toward 1b's 10px
**Summary:** Introduced a dedicated --radius-card: 10px token so TicketCard bumps toward 1b's corner spec without re-rounding Menu/Modal/Drawer's shared --radius-md (8px); rebuilt dashboard/dist and reopened the styleguide gate for lightweight re-review
**Duration:** 12m
**Verification:** PASS (iteration 1)
**Files changed:** 8
**Tests added:** 2
**ADRs written:** none

---

## 2026-07-05 01:44 -- Task completed (verification skipped): agentic-workflow-s7gev - Prompt bar gains a keyboard-committed single-selection highlight model

**Type:** Work / Task completion
**Task:** agentic-workflow-s7gev - Prompt bar gains a keyboard-committed single-selection highlight model
**Summary:** Recorded ADR-0050 fixing the prompt bar keyboard-committed selection model (single 0-based highlightedMode index, four invariants, disjoint key-intent classification, hover/selection as orthogonal channels); supersedes PromptLaunchCard's no-selection-model stance and names dashboard/app/prompt-mode.js for the downstream build
**Duration:** 4m
**Verification:** SKIPPED — decision-only task
**Files changed:** 1

---

## 2026-07-05 01:38 -- Batch started: [agentic-workflow-s7gev, design-system-t896s, agentic-workflow-vk6mc]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-s7gev - Prompt bar gains a keyboard-committed single-selection highlight model, design-system-t896s - TicketCard — bump corner radius toward 1b's 10px, agentic-workflow-vk6mc - Topbar — recolor What's-next to the ochre CTA; regression-guard the unchanged parts
**Parallel:** yes (3 workers — s7gev ADR-only + t896s design-system/styleguide radius + vk6mc dashboard topbar recolor, zero file overlap this wave; wsfsk + a2pm1 held to next wave — both also edit dashboard/app/board.js like vk6mc, deferred to avoid a three-way board.js merge scramble)

---

## 2026-07-05 01:33 -- Modeling / Promoted: agentic-workflow-a2pm1 - What's Next panel — 3-step flight plan with ochre step-2 hero

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-05 01:33 -- Modeling / Promoted: agentic-workflow-wsfsk - Left nav — 1a single-panel shape (width, tree label, footer status line)

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-05 01:33 -- Modeling / Promoted: agentic-workflow-vk6mc - Topbar — recolor What's-next to the ochre CTA; regression-guard the unchanged parts

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-05 01:33 -- Modeling / Promoted: agentic-workflow-s7gev - Prompt bar gains a keyboard-committed single-selection highlight model

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-05 01:33 -- Modeling / Promoted: design-system-t896s - TicketCard — bump corner radius toward 1b's 10px

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-07-05 01:23 -- Work session ended

**Type:** Work / Session end
**Duration:** 16m (batch start 01:07 → 01:23)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** design-system-a31e0: 1
**Commits:** 3 (batch-start [c1bfdf5] + a31e0 integration [c3a93f7] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (the retokenization is design-system styleguide work serving the dashboard redesign under the builder-gated styleguide re-review; it rode ADR-0048/0049, updated the BC README with the full hex table + a consolidated gate note — durable knowledge — and passed the `verifier` adversarial gate; no pull toward any non-goal — all state stays in `.agentheim/` + `styleguide/`, the human review gate is intact, nothing shipped autonomously).
**Carry-over:** inspiration/: left behind (owner: builder reference material — the untracked `inspiration/Agentheim UX Explorations.html` dashboard-redesign brief, present since before this session; not project bookkeeping, never `work`'s to commit)
**Notes:** The redesign keystone shipped. **design-system-a31e0** retokenized both `[data-theme]` blocks of `styleguide/styles/colors_and_type.css` to the Command-deck 1b dark palette (surfaces `#090C12`/`#0D1119`/`#121826`, hairlines `#1C2330`/`#2B3548`, `--fg-1..4` `#F2F5F9`/`#AEB8C4`/`#7D8794`/`#48515C`, `--accent-ochre` `#E5A13C`) with a *derived* light counterpart per ADR-0049 §2 (light `--surface-0` held at the `#FAF8F4` anchor, the rest of the ramp computed by re-applying the dark stack's step sizes on the same cool blue-grey hue, inverted), re-pinned the frozen preview swatches per ADR-0049 §3 (`--swatch-dark` → `#090C12`, `--swatch-light` unchanged), and added the `--emphasis-border` token pair to `styleguide/styles/agentheim.css` per ADR-0048 (`color-mix(in oklab, var(--accent-ochre) 50%/40%, transparent)` light/dark — a border-suited softened alpha, not a bare accent alias; no consumer wired yet). One documented interpretation call: ADR-0049's 1b reference lists a 4-rung neutral stack but the system has 3 surface slots, so the intermediate `#0f141d` "panel-2" rung was dropped and `--surface-2` mapped to the ticket-card `#121826` — the verifier judged this a faithful, mechanical reading of the binding derivation method, durably documented in the README, not a separate ADR-worthy decision. `dashboard/dist/` rebuilt via `node build.mjs` (reproducible — second run byte-identical); `dist/app.js` + `dist/index.html` were byte-identical after the rebuild (CSS-values-only change, JS bundle unaffected — the ds-007 pattern, minus the component edit). First-try PASS iteration 1; 158 tests green (157 baseline + 1 added for the `--emphasis-border` presence, plus the re-pinned `--swatch-dark` lock updated). **The whole downstream redesign is now unblocked** — the five agentic-workflow wiring tasks (`vk6mc`/`wsfsk`/`bz3az`/`a2pm1`/`c2ver`) and the sibling radius task (`t896s`) all await `modeling` promotion out of backlog. **Styleguide gate re-review is builder-PENDING** — the biggest visual change the canvas has taken; the builder should eyeball `styleguide/index.html` before the wiring tasks consume it. No bounces, failures, escalations, or concept candidates.

---

## 2026-07-05 01:22 -- Task verified and completed: design-system-a31e0 - Retokenize the palette — Command-deck dark + derived light, across both token files

**Type:** Work / Task completion
**Task:** design-system-a31e0 - Retokenize the palette — Command-deck dark + derived light, across both token files
**Summary:** Retokenized both [data-theme] blocks of colors_and_type.css to the Command-deck 1b dark palette with a derived light counterpart (ADR-0049), re-pinned the frozen preview swatches, and added the --emphasis-border token pair to agentheim.css (ADR-0048); dashboard/dist rebuilt reproducibly
**Duration:** 11m30s
**Verification:** PASS (iteration 1)
**Files changed:** 6
**Tests added:** 1
**ADRs written:** none

---

## 2026-07-05 01:07 -- Batch started: [design-system-a31e0]

**Type:** Work / Batch start
**Tasks:** design-system-a31e0 - Retokenize the palette — Command-deck dark + derived light, across both token files
**Parallel:** no (1 worker — sole ready task; the redesign keystone, all other redesign tasks blocked on it)
**Planning advisory:** whats-next (current, generated 01:10 > 00:52 session-end): recommends design-system-a31e0 as the keystone unblocking five downstream wiring tasks

---

## 2026-07-05 01:03 -- Modeling / Promoted: design-system-a31e0 - Retokenize the palette — Command-deck dark + derived light, across both token files

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-07-05 00:52 -- Work session ended

**Type:** Work / Session end
**Duration:** 12m (batch start 00:40 → 00:52)
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** design-system-vw12e: 1, design-system-e9apx: 1
**Commits:** 4 (batch-start [d809783] + vw12e integration [5703f63] + e9apx integration [2801c24] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (both tasks are `type: decision` ADRs recording dashboard-redesign foundation decisions, serving "knowledge is durable — ADRs survive the conversation"; neither pulls toward a non-goal — builder-driven decisions, local `.agentheim/` state only, DDD-methodical).
**Carry-over:** inspiration/: left behind (owner: builder WIP, untracked directory present since before this session)
**Notes:** Two `type: decision` tasks shipped as a parallel batch, each in its own worktree (ADR-0032), both first-try PASS iteration 1 — the two dashboard-redesign foundation ADRs. **design-system-vw12e** wrote ADR-0048 (accent carve-out): a discriminating fires/commits-vs-passive-equivalent-state test refining (not superseding) ADR-0016, applied to all five tension surfaces; the single left-nav active item keeps 1a's ochre inset rail as a bounded wayfinding exception (explicitly non-precedential); a named `--emphasis-border` token specified by intent for the hero-border allowance (its CSS value deferred to design-system-a31e0). **design-system-e9apx** wrote ADR-0049 (Command-deck palette identity): a values-only shift (token names/roles frozen) superseding the Ledger warm-paper heritage, with explicit rulings that the light theme is *derived* from the 1b dark stack anchored at `--swatch-light` #FAF8F4, and that ADR-0016's frozen preview swatches re-pin to the new `--surface-0` values (the freeze was relative to `[data-theme]`, not to a palette generation); the design-system README's identity framing updated. No file overlap between the two (vw12e: ADR-0048 + ADR-0016 pointer; e9apx: ADR-0049 + README), so both squash-merged clean, no conflicts. Both verifiers ran the design-system regression suite green. Both foundation decisions now unblock the downstream backlog tasks (design-system-a31e0 retokenize, design-system-t896s radius, and the agentic-workflow wiring set) — none in todo yet; they await `modeling` promotion. **Windows friction (recurring):** autocrlf re-CRLF'd INDEX.md/protocol.md after each squash-merge — LF-normalized before each mechanized `complete`; and the stale `doing/` pathspec in vw12e's enumerated `git add` aborted the whole add (known `git mv` gotcha), captured only the squash-staged content in the first commit — caught it from `git status` and amended the bookkeeping in. No bounces, failures, escalations, or concept candidates.

---

## 2026-07-05 00:51 -- Task verified and completed: design-system-e9apx - Command-deck palette identity — cool neutrals supersede the warm-Ledger heritage

**Type:** Work / Task completion
**Task:** design-system-e9apx - Command-deck palette identity — cool neutrals supersede the warm-Ledger heritage
**Summary:** Wrote ADR-0049 recording the Command-deck cool-neutral palette identity superseding the Ledger warm-paper heritage (values-only, names/roles frozen); ruled that the light theme is derived from the 1b dark stack anchored at --swatch-light #FAF8F4 and that ADR-0016 frozen swatches re-pin to the new --surface-0 values; updated the design-system README identity framing
**Duration:** 9m
**Verification:** PASS (iteration 1)
**Files changed:** 2
**Tests added:** 0
**ADRs written:** 0049

---

## 2026-07-05 00:50 -- Task verified and completed: design-system-vw12e - Accent carve-out — ochre marks the primed primary action, not passive selection

**Type:** Work / Task completion
**Task:** design-system-vw12e - Accent carve-out — ochre marks the primed primary action, not passive selection
**Summary:** Wrote ADR-0048 refining ADR-0016 with a fires/commits-vs-passive-selection test applied to all five accent tension surfaces; the left-nav active item keeps 1a ochre inset rail as a bounded single-surface wayfinding exception; a named --emphasis-border token specified for the hero border
**Duration:** 6m
**Verification:** PASS (iteration 1)
**Files changed:** 2
**Tests added:** 0
**ADRs written:** 0048

---

## 2026-07-05 00:40 -- Batch started: [design-system-vw12e, design-system-e9apx]

**Type:** Work / Batch start
**Tasks:** design-system-vw12e - Accent carve-out — ochre marks the primed primary action, not passive selection, design-system-e9apx - Command-deck palette identity — cool neutrals supersede the warm-Ledger heritage
**Parallel:** yes (2 workers)

---

## 2026-07-05 00:37 -- Modeling / Promoted: design-system-e9apx - Command-deck palette identity — cool neutrals supersede the warm-Ledger heritage

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-07-05 00:37 -- Modeling / Promoted: design-system-vw12e - Accent carve-out — ochre marks the primed primary action, not passive selection

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-07-05 00:34 -- Modeling / Refined: dashboard nav active-item — ochre rail confirmed

**Type:** Modeling / Refine
**BC:** design-system, agentic-workflow
**Status after:** backlog (both)
**Summary:** Builder resolved the flagged nav-active-item conflict in favour of **1a's ochre inset rail** (over the architect's ADR-0016 de-emphasis default). Restated the accent carve-out `design-system-vw12e` (ADR-0048): ochre is now permitted for (a) primed primary actions and (b) the single primary-navigation active item, as a bounded wayfinding exception that does NOT reopen ADR-0016 for arbitrary peer selection. Flipped `agentic-workflow-wsfsk`'s acceptance criteria from de-emphasis to the ochre inset rail (`inset 2px 0 0 var(--accent-ochre)`, token-drawn). No status/title change; no split.

---

## 2026-07-05 00:19 -- Modeling / Captured: dashboard redesign — 10-task set across design-system + agentic-workflow

**Type:** Modeling / Capture
**BC:** design-system (4), agentic-workflow (6)
**Filed to:** backlog
**Summary:** Captured the builder's "overdo the dashboard design" cherry-pick from `inspiration/Agentheim UX Explorations.html` (directions 1a/1b/1c). Dark palette + condensed columns + condensed ticket card + singular View chip + 1b What's-Next flight-plan (X-only, no reload) + 1b bottom docked prompt bar with a new Ctrl+←/→ / Ctrl+Enter keyboard model, all taken from **1b**; the search bar's header-left position and the single-panel left nav from **1a**; light palette to be derived. Orchestrator decomposed component-level (architect + tactical-modeler consulted), splitting design-system *look* tasks from agentic-workflow *wiring* per ADR-0003 with gate-aware dependencies. Three foundation decisions surfaced as `type: decision` tasks (provisional ADR-0048 accent carve-out vs ADR-0016, ADR-0049 palette identity, ADR-0050 prompt-bar selection model). **Two open conflicts flagged for refine:** (1) the left-nav active-item color — the brief literally asked for 1a's ochre inset rail but the architect ruled it against ADR-0016; captured with the de-emphasis default pending builder sign-off; (2) the singular View chip reverses ADR-0015's per-column view-state scope (folded into that task's AC, not a separate decision). Tasks: design-system-vw12e/e9apx/a31e0/t896s; agentic-workflow-s7gev/vk6mc/wsfsk/bz3az/a2pm1/c2ver.

---

## 2026-07-04 22:30 -- Release shipped: v0.8.10

**Type:** Release
**Version:** 0.8.9 → 0.8.10 (patch — What's Next dismiss now deletes its advisory artifact server-side; INDEX done-list rotation wired into work session-end)
**Manifest:** `.claude-plugin/plugin.json` bumped, committed `ab4f653`
**Changelog:** `CHANGELOG.md` `[Unreleased]` → `[0.8.10]` section rolled (same commit)
**Pushed to main:** yes (`48fc064..ab4f653` on `origin/main`)
**Tag:** `v0.8.10` (annotated) → `ab4f653`, pushed to origin
**GitHub Release:** created via `gh` (from CHANGELOG)

---

## 2026-07-04 22:10 -- Work session ended

**Type:** Work / Session end
**Duration:** 32m (first batch start 21:38 → 22:10)
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-d4q7f: 1, agentic-workflow-vmk1z: 1
**Commits:** 5 (d4q7f batch-start [37a9c71] + d4q7f integration [4df4da8] + vmk1z batch-start [ef3f5ca] + vmk1z integration [b7fe495] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (d4q7f enforces the previously-trigger-less INDEX done-list cap-and-roll doctrine, serving "knowledge is durable… per-BC READMEs/INDEXes survive"; vmk1z is a builder-initiated explicit dismiss that removes only an advisory artifact under `.agentheim/state/` — human-in-the-loop [non-goal 3] and local-state-only [non-goal 5] both intact, the dashboard-write concern is an ADR-0046-ratified bounded exception, not a vision-level divergence).
**Carry-over:** none — working tree clean; no non-main worktrees.
**Notes:** Two tasks shipped sequentially (single-task batches), each in its own worktree (ADR-0032), both first-try PASS iteration 1. **d4q7f** wired `rotateAllIndexDoneLists` into `work`'s session-end flow (new step, sibling to ADR-0045's protocol-rotation check) and ran the first real INDEX done-list rotation on this repo: `agentic-workflow`'s 2026-06 done entries rolled verbatim to `contexts/agentic-workflow/done-archive/2026-06.md`, live done-list back under the ~30 cap; `design-system`/`infrastructure` were already under cap and correctly did not rotate. **ADR-numbering collision handled:** the task prose said "write ADR-0046", but 0046 had already been minted (vmk1z's What's-next delete decision) during d4q7f's own refinement window — the conductor caught this pre-dispatch and directed the worker to ADR-0047 instead; existing 0046 untouched, verifier confirmed. **vmk1z** (promoted mid-run by a concurrent `modeling` session, commit 9c4b185) shipped the dashboard's first write since ADR-0017: a delete-only `DELETE /api/whats-next` dispatched before the 405 gate, exact-equality allowlist (no client path) that provably can't touch the sibling `state/in-flight.json`, idempotent 204, localStorage dismiss store retired entirely; ADR-0046 flipped proposed→accepted; 14 tests added; verifier's runtime-drive check 8 booted the dashboard (port 41983), confirmed DELETE→204 / POST→405, clean teardown; dashboard suite 729/729, root lib 183/183. **Recurring Windows friction (9th session):** git pruned the empty `doing/` before vmk1z's claim (ENOENT on the todo→doing rename — reverted the half-written status frontmatter, recreated `doing/`, retried clean); autocrlf re-CRLF'd INDEX.md after each squash-merge — LF-normalized before each mechanized `complete`; the mandatory `unlinkDashboardNodeModules`-before-`worktree remove` order held (real shared node_modules verified intact, 10 entries). **Minor note (not a blocker):** ADR-0047's Outcome prose says the 2026-06 archive holds "37 entries" where it actually holds ~84 — a harmless reporting inaccuracy the verifier flagged; no AC hinges on the count. No bounces, failures, escalations, or concept candidates.

---

## 2026-07-04 22:08 -- Task verified and completed: agentic-workflow-vmk1z - Dismissing the What's next panel deletes its advisory artifact

**Type:** Work / Task completion
**Task:** agentic-workflow-vmk1z - Dismissing the What's next panel deletes its advisory artifact
**Summary:** Dismissing the What's next panel now issues DELETE /api/whats-next, which unlinks the advisory artifact state/whats-next.md via an exact-equality allowlist that provably cannot touch the sibling in-flight.json; the localStorage dismiss store is retired (ADR-0046 flipped proposed→accepted)
**Duration:** 12m
**Verification:** PASS (iteration 1)
**Files changed:** 11
**Tests added:** 14
**ADRs written:** none

---

## 2026-07-04 21:54 -- Batch started: [agentic-workflow-vmk1z]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-vmk1z - Dismissing the What's next panel deletes its advisory artifact
**Parallel:** no (1 worker — vmk1z promoted mid-run by a concurrent modeling session [commit 9c4b185], now the only ready task; dashboard feature runs solo)
**Planning advisory:** whats-next 2026-07-03 advisory stale; single ready task, no ordering choice

---

## 2026-07-04 21:51 -- Task verified and completed: agentic-workflow-d4q7f - Wire a trigger for INDEX done-list rotation — rotateIndexDoneList is never invoked

**Type:** Work / Task completion
**Task:** agentic-workflow-d4q7f - Wire a trigger for INDEX done-list rotation — rotateIndexDoneList is never invoked
**Summary:** Wired rotateAllIndexDoneLists into work session-end (ADR-0047, closing ADR-0045 sibling non-decision) and ran the first real INDEX done-list rotation on this repo — agentic-workflow 2026-06 entries rolled to done-archive/2026-06.md
**Duration:** 11m
**Verification:** PASS (iteration 1)
**Files changed:** 5
**Tests added:** 0
**ADRs written:** 0047-index-done-list-rotation-trigger-work-session-end-check.md

---

## 2026-07-04 21:39 -- Modeling / Promoted: agentic-workflow-vmk1z - Dismissing the What's next panel deletes its advisory artifact

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-04 21:38 -- Batch started: [agentic-workflow-d4q7f]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-d4q7f - Wire a trigger for INDEX done-list rotation — rotateIndexDoneList is never invoked
**Parallel:** no (1 worker — the only ready task in agentic-workflow; whats-next advisory 2026-07-03 stale, background-weighted)
**Planning advisory:** whats-next 2026-07-03 stale (older than 07-04 21:05 session-end); recommends t4x8p/p3v9k, neither in ready set — no weighting applied

---

## 2026-07-04 15:05 -- Modeling / Refined: agentic-workflow-vmk1z - Dismissing the What's next panel deletes its advisory artifact

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Builder locked direction A (delete-on-dismiss, not auto-hide). Architect round (via orchestrator) settled the contract and ratified ADR-0046: the dashboard gains its first write since ADR-0017 — a delete-only, advisory-only `DELETE /api/whats-next` that removes only `.agentheim/state/whats-next.md` (exact-equality allowlist, no client path, idempotent `204`, zero lifecycle side-effects); the `localStorage` dismiss store is retired. Task refined to concrete testable AC, kept single (no decision sub-task), ready to promote pending builder review of ADR-0046.
**Split into:** —
**ADRs written:** ADR-0046 (proposed)

---

## 2026-07-04 14:30 -- Modeling / Captured: agentic-workflow-vmk1z - Dismissing the What's next panel deletes its advisory artifact

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Builder wants the dashboard's What's next dismiss to delete the stale advisory artifact (`state/whats-next.md`), not just hide it client-side (aw-073's current localStorage behavior). Captured decision-gated: delete-on-dismiss reopens ADR-0027 §4.5 ("dashboard never deletes it") and ADR-0017 (no dashboard write path), so REFINE must route through the architect to settle direction A (narrow advisory-delete endpoint + ADR amendment) vs B (kill staleness with no dashboard write).

---

## 2026-07-04 21:12 -- Modeling / Promoted: agentic-workflow-d4q7f - Wire a trigger for INDEX done-list rotation — rotateIndexDoneList is never invoked

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-04 21:11 -- Modeling / Refined: agentic-workflow-d4q7f - Wire a trigger for INDEX done-list rotation

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Sharpened the sibling of v8n3t/ADR-0045 (INDEX done-list rotation is trigger-less). Settled the call site as `work` session-end (a second self-firing cap-and-roll check after the ADR-0045 protocol check, via `rotateAllIndexDoneLists`); resolved the "different seam for reachability?" open question as a read-side matter (modeling already reads `done-archive/`), not a trigger relocation; assigned ADR-0046; added a "run the first real rotation on this repo" AC (the gap vs v8n3t — the live done-list is ~120 entries against the ~30 cap); reframed AC to reflect a skill-prose call site with no new lib surface. No orchestrator pass — direct application of the ratified ADR-0045 pattern.

---

## 2026-07-04 21:05 -- Work session ended

**Type:** Work / Session end
**Duration:** 19m40s (batch start 20:45 → 21:05)
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-v8n3t: 1, agentic-workflow-g7p2x: 1
**Commits:** 4 (batch-start claim [284ae57] + v8n3t integration [9439efe] + g7p2x integration [0c79882] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (v8n3t enforces the previously-stated-but-unenforced protocol-rotation doctrine, serving "knowledge is durable: a chronological protocol log"; g7p2x makes ADR-0043's live in-flight observability actually fire in consumer plugin installs, not just dogfood — both pull toward success criteria, neither toward a non-goal).
**Carry-over:** none — working tree clean; no non-main worktrees.
**Notes:** Two ready tasks dispatched in parallel, each in its own worktree (ADR-0032); both touched `skills/work/SKILL.md` in disjoint regions (v8n3t session-end body prose, g7p2x frontmatter hook command) and merged back clean with no conflict — the merge-order advisory held. Both first-try PASS iteration 1. v8n3t wired `rotateProtocol` into `work`'s session-end flow (ADR-0045, closing ADR-0039's deferred "who invokes it" non-decision) and ran the first real rotation on this repo: 2026-06 rolled verbatim to `knowledge/protocol/2026-06.md`, live `protocol.md` from 7,161 → 1,468 lines (all current-month July, correctly never rolled); verifier byte-identity spot-checked the archive against pre-rotation git history. v8n3t also spun off backlog item **agentic-workflow-d4q7f** (the sibling INDEX-done-list rotation is likewise trigger-less — surfaced as a follow-up capture, not scope-crept). g7p2x fixed all three ADR-0043 hook registrations to locate `lib/hook-agent-signal.mjs` via the env-free homedir→cache→semver-max bootstrap; `${CLAUDE_PLUGIN_ROOT}` was investigated (claude-code-guide) and rejected for open upstream non-injection bugs (#43380/#66557/#24529), recorded as an ADR-0043 amendment; verifier independently reproduced the end-to-end fix through the real 0.8.9 plugin cache from a non-repo cwd (in-flight.json written to a scratch consumer project). Recurring friction (8th session): git pruned the empty `doing/` before session start (recreated before the claim); autocrlf re-CRLF'd `protocol.md` in the working tree after each squash-merge — LF-normalized before each mechanized `complete`. No bounces, failures, escalations, or concept candidates.

---

## 2026-07-04 21:03 -- Task verified and completed: agentic-workflow-g7p2x - Observability hook command path breaks in consumer plugin installs

**Type:** Work / Task completion
**Task:** agentic-workflow-g7p2x - Observability hook command path breaks in consumer plugin installs
**Summary:** Fixed all three ADR-0043 hook registrations (worker/verifier Stop hooks, work session heartbeat) to locate lib/hook-agent-signal.mjs via the env-free homedir-cache-semver bootstrap instead of the CLAUDE_PROJECT_DIR path that only resolved in the source repo; PLUGIN_ROOT rejected after investigation of open upstream bugs, ADR-0043 amended, 7 tests added.
**Duration:** 15m
**Verification:** PASS (iteration 1)
**Files changed:** 6
**Tests added:** 7
**ADRs written:** 0043-live-observability-hook-heartbeat-second-advisory-artifact.md (amendment)

---

## 2026-07-04 20:57 -- Task verified and completed: agentic-workflow-v8n3t - Wire a trigger for protocol rotation — rotateProtocol is never invoked

**Type:** Work / Task completion
**Task:** agentic-workflow-v8n3t - Wire a trigger for protocol rotation — rotateProtocol is never invoked
**Summary:** Wired rotateProtocol into works session-end flow (ADR-0045, closing ADR-0039s deferred non-decision) and ran the first real rotation on this repo: 2026-06 rolled to archive, live protocol.md down to 1,468 lines (current-month July never rolled).
**Duration:** 8m
**Verification:** PASS (iteration 1)
**Files changed:** 6
**Tests added:** 0
**ADRs written:** 0045-protocol-rotation-trigger-work-session-end-check.md

---

## 2026-07-04 20:45 -- Batch started: [agentic-workflow-v8n3t, agentic-workflow-g7p2x]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-v8n3t - Wire a trigger for protocol rotation — rotateProtocol is never invoked, agentic-workflow-g7p2x - Observability hook command path breaks in consumer plugin installs
**Parallel:** yes (2 workers — both ready in agentic-workflow; both touch skills/work/SKILL.md in different regions [g7p2x frontmatter hook path, v8n3t session-end rotation prose], annotated for sequential merge-back per ADR-0032; whats-next advisory stale 2026-07-03, no weighting)

---

## 2026-07-04 20:30 -- Modeling / Captured: agentic-workflow-g7p2x - Observability hook command path breaks in consumer plugin installs

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** The three ADR-0043 hook registrations (worker/verifier Stop hooks, work session heartbeat) invoke `node "${CLAUDE_PROJECT_DIR}/lib/hook-agent-signal.mjs"`, which only resolves in this source repo — in consumer plugin installs the script lives under the plugin root, so the hook fails silently and the in-flight lane never works outside dogfood. Fix the command path (`${CLAUDE_PLUGIN_ROOT}` if supported, else the resolve-plugin-file bootstrap); the script's internal `CLAUDE_PROJECT_DIR` write-target use stays. Flagged by the 2026-07-04 harness-audit follow-up.

---

## 2026-07-04 20:28 -- Modeling / Captured: agentic-workflow-v8n3t - Wire a trigger for protocol rotation

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** todo
**Summary:** ADR-0039's cap-and-roll mechanism (`lib/protocol-rotation.mjs`) is built and tested but nothing ever invokes it — the live protocol.md sits at 7,161 lines against the ~1,000 cap with no archive dir. Task decides the trigger (leading candidate: `work` session-end check), records it as an ADR closing 0039's deferred non-decision, and runs the first real rotation on this repo. Flagged by the 2026-07-04 harness-audit follow-up.

---

## 2026-07-04 18:33 -- Release shipped: v0.8.9

**Type:** Release
**Version:** 0.8.8 → 0.8.9 (patch — live in-flight lane, dependency-aware board, per-worker worktree isolation, lifecycle-bookkeeping mechanization + CRLF/BOM hardening)
**Manifest:** `.claude-plugin/plugin.json` bumped, committed `2e07f8a`
**Changelog:** `CHANGELOG.md` `[Unreleased]` → `[0.8.9]` section rolled (same commit)
**Pushed to main:** yes (`7f6411d..2e07f8a` on `origin/main`)
**Tag:** `v0.8.9` (annotated) → `2e07f8a`, pushed to origin
**GitHub Release:** created via `gh` (from CHANGELOG)

---

## 2026-07-04 18:25 -- Work session ended

**Type:** Work / Session end
**Duration:** 13m (batch start 18:12 → 18:25)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-q7x2k: 1
**Commits:** 3 (batch-start claim [45125c8] + task integration [926a04d] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (closing the verifier check-6 gate gap directly serves two success criteria: "wrong work is caught by structure, not luck" — the sharpened gate now catches decisions that were slipping through unrecorded — and "knowledge is durable" — a decision narrated only in an ephemeral task file must now be captured in a durable ADR; no pull toward any non-goal).
**Carry-over:** none — working tree clean; no non-main worktrees.
**Notes:** Single ready task (q7x2k, a bug), dispatched solo in its own worktree per ADR-0032; whats-next advisory stale (generated 2026-07-03, older than the newest Work entry, its named tasks t4x8p/p3v9k already resolved — no weighting), 7th session running with a stale advisory. Worker sharpened `agents/verifier.md` check 6 to close the task-file-prose-narration loophole surfaced by bx7k5's sonnet-arm A/B (a decision narrated only in a task's own Why/What prose is not a substitute for an ADR — task files are scoped/ephemeral, ADRs are durable), added a `widgets-mab1` worked example, and honored the over-flag constraint (did not lower the "would a maintainer ask why?" bar). **Empirical closure:** real opus-pinned verifier now FAILs `missing-adr-borderline` 3/3 citing check 6 — closing the reproducible 0/6 opus miss n7q4d found and bx7k5 traced to a tier-independent wording gap — with `clean` PASS 3/3 (the correct at-risk PASS fixture, since it narrates a non-ADR-worthy throw-vs-no-op tradeoff in its own prose). Verifier PASS iteration 1; independently confirmed the fixtures' `expected.json` ground truth, validated the stop-at-first-failing-check structural no-regression argument for the other 14 fixtures, and ran 176/176 project tests green. No ADR warranted (wording sharpen bringing check 6 in line with its own already-stated intent, not a new decision). **Recurring friction (7th session):** git pruned the empty `doing/` before session start — recreated before the claim, else the mechanized claim throws ENOENT. No bounces, failures, escalations, or concept candidates.

---

## 2026-07-04 18:24 -- Task verified and completed: agentic-workflow-q7x2k - Verifier check 6 gate gap — decisions narrated only in task-file prose are not flagged for an ADR

**Type:** Work / Task completion
**Task:** agentic-workflow-q7x2k - Verifier check 6 gate gap — decisions narrated only in task-file prose are not flagged for an ADR
**Summary:** Sharpen verifier check 6 to close the task-file-prose-narration loophole — a decision narrated only in a task file still requires an ADR; add a widgets-mab1 worked example; empirically confirm missing-adr-borderline now FAILs 3/3 citing check 6 (was 0/6) with no PASS-fixture regression
**Duration:** 10m33s
**Verification:** PASS (iteration 1)
**Files changed:** 4
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-04 18:12 -- Batch started: [agentic-workflow-q7x2k]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-q7x2k - Verifier check 6 gate gap — decisions narrated only in task-file prose are not flagged for an ADR
**Parallel:** no (1 worker — sole ready task; whats-next advisory stale 2026-07-03, its named tasks t4x8p/p3v9k already resolved, no weighting)

---

## 2026-07-04 18:10 -- Modeling / Promoted: agentic-workflow-q7x2k - Verifier check 6 gate gap — decisions narrated only in task-file prose are not flagged for an ADR

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-04 18:05 -- Modeling / Refined: agentic-workflow-q7x2k - Verifier check 6 gate gap

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Verified the gap diagnosis against the `missing-adr-borderline` fixture's own task file (`widgets-mab1`) on disk — its `## Why`/`## What` do narrate the silent-drop tradeoff and its downstream-analytics consequence, yet expect FAIL, so the task-file-narration loophole is real and the fix is aimed correctly. Added a false-positive/over-flag constraint to `## What` (the sharpen removes only the carve-out, must not lower the "would ask why?" bar) and a new **no-regression ceiling-fixture** acceptance criterion so the fix can't trade one false-negative for false-positives elsewhere; sharpened the worked-example AC to anchor on `widgets-mab1`. No split, no ADR (wording sharpen, not a routing change). Task is now worker-ready but left in backlog per the refine-only ask.
**Split into:** none
**ADRs written:** none

---

## 2026-07-04 17:58 -- Work session ended

**Type:** Work / Session end
**Duration:** 46m (batch start 17:12 → 17:58)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-bx7k5: 1
**Commits:** 3 (batch-start claim [99fbca0] + task integration [fd978a1] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (the sonnet-arm A/B empirically tested the verifier gate's judgment-density rationale and surfaced a real tier-independent check-6 gate gap — directly serving "wrong work is caught by structure, not luck"; no pull toward any non-goal, and the routing decision was correctly deferred to a human / superseding ADR, honoring "Not autonomous").
**Carry-over:** none — working tree clean; no non-main worktrees.
**Notes:** Single ready task (bx7k5), dispatched solo; whats-next advisory stale (generated 2026-07-03, older than the newest Work entry, its named tasks t4x8p/p3v9k already resolved — no weighting). **Standout result:** the sonnet-pinned verifier (per-spawn `model: "sonnet"` override, `agents/verifier.md` untouched) ran the full 16-fixture hardened corpus k≥3 (51 real spawns) and **caught the opus-floor `missing-adr-borderline` 6/6 where the opus-pinned incumbent misses it 0/6** — the "weaker tier outperformed" branch of the pre-registered decision rule. Scored (correctly, per contract) as evidence *against* ADR-0031's judgment-density pillar — reproducible across two independent k=3 batches — retiring that pillar on this corpus, but the worker **did not** move the verifier to sonnet: the decorrelation pillar (structurally unmeasurable by a catch-rate eval) independently holds the opus pin, and any routing change needs its own superseding ADR. The divergence traced to a **tier-independent wording gap in verifier check 6** (task-file-narrated decisions wrongly waived from needing an ADR), filed as new backlog item `agentic-workflow-q7x2k` (bug) rather than fixed under this spike. Verifier PASS iteration 1; 176/176 project tests green; it flagged one non-blocking labeling imprecision (51 real spawns vs 50 scored runs, transparently reconciled in the report) that did not affect any conclusion. **Recurring friction (6th session running):** git pruned the empty `doing/` before session start — recreated before the claim, else the mechanized claim throws ENOENT. No bounces, failures, escalations, or concept candidates.

---

## 2026-07-04 17:56 -- Task verified and completed: agentic-workflow-bx7k5 - A/B the verifier's model routing (opus vs sonnet) using the verifier-catch-rate fixtures

**Type:** Work / Task completion
**Task:** agentic-workflow-bx7k5 - A/B the verifier's model routing (opus vs sonnet) using the verifier-catch-rate fixtures
**Summary:** Ran the 16-fixture verifier-catch-rate set against a sonnet-pinned verifier (per-spawn model override, agents/verifier.md untouched); sonnet tied opus at ceiling on all 15 ceiling fixtures and caught the opus-floor missing-adr-borderline 6/6 where opus missed 0/6 — retiring ADR-0031 judgment-density on this corpus but licensing no routing change (decorrelation pillar holds); traced the divergence to a tier-independent verifier check-6 wording gap, filed as agentic-workflow-q7x2k.
**Duration:** 43m01s
**Verification:** PASS (iteration 1)
**Files changed:** 5
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-04 17:12 -- Batch started: [agentic-workflow-bx7k5]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-bx7k5 - A/B the verifier's model routing (opus vs sonnet) using the verifier-catch-rate fixtures
**Parallel:** no (1 worker — sole ready task; whats-next advisory stale 2026-07-03, its named tasks t4x8p/p3v9k already resolved, no weighting)

---

## 2026-07-04 17:06 -- Modeling / Promoted: agentic-workflow-bx7k5 - A/B the verifier's model routing (opus vs sonnet) using the verifier-catch-rate fixtures

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-04 17:06 -- Modeling / Refined: agentic-workflow-bx7k5 - A/B the verifier's model routing (opus vs sonnet)

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Blocker `n7q4d` completed 2026-07-04 and its *result* (not just status) clears bx7k5's readiness gate: it hardened the corpus 12→16 fixtures and produced `missing-adr-borderline` — a genuine, reproducible **opus MISS (0/6)** on uncontested ground truth, the hard-AND-unambiguous tier-discriminator bx7k5 was blocked waiting for, plus 3 opus-ceiling-but-argued fixtures. Folded the now-known unblocked state through Why/What/AC (concrete 16-fixture surface; the three opus-arm files-of-record named; readiness gate marked satisfied). **Key correction to the decision rule:** it was pre-registered assuming opus *ceilings* every fixture (tie = corpus-too-easy) and had **no branch for the weaker tier outperforming** — but `missing-adr-borderline` is the inverse (opus at the *floor*). Rewrote the rule to score **by fixture direction**: opus-ceiling fixtures (sonnet-drop → density vindicated; sonnet-tie → corpus-limited) vs the opus-floor fixture (sonnet-also-misses → tie-at-floor = density unsupported here + a surfaced gate gap; sonnet-CATCHES → weaker tier outperformed = evidence *against* density, flag + re-run at higher k). No result still licenses `verifier → sonnet` (decorrelation pillar independently holds). No split, no ADR. Promoted backlog → todo (gate satisfied).
**Split into:** none
**ADRs written:** none

---

## 2026-07-04 16:54 -- Work session ended

**Type:** Work / Session end
**Duration:** 28m (batch start 16:26 → 16:54)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-n7q4d: 1
**Commits:** 3 (batch-start claim [506cf06] + task integration [ffc03a8] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (hardening the verifier-catch-rate corpus and surfacing a genuine reproducible opus miss directly serves "wrong work is caught by structure, not luck" — it gives the model-routing A/B bx7k5 a real tier-discriminator instead of a ceilinged corpus; no pull toward any non-goal)
**Carry-over:** none — working tree clean; no non-main worktrees
**Notes:** Single ready task, dispatched solo (whats-next advisory stale — generated 2026-07-03, older than the newest Work entry, and its named tasks t4x8p/p3v9k already resolved; no weighting). Worker authored 4 new fixtures deliberately harder than the ceilinged 12-fixture corpus (targeting judgment checks 5/6/6b and objective check 8) and real-spawned the opus-pinned verifier k≥3 against each (21 spawns). **Standout result:** `missing-adr-borderline` is a genuine, reproducible opus MISS — 0/6 catch across two independent batches — with an uncontested-ground-truth argument (README documents PaintHistory feeding downstream analytics), exactly the hard-AND-unambiguous tier-discriminator bx7k5 was blocked waiting for; three ceiling fixtures retained under the methodology's explicit-argument clause. Worker correctly discarded a v1 variance observation as authoring contamination rather than retaining it on bare variance (the AC3 false-vindication trap this task exists to prevent). Verifier PASS iteration 1, 176/176 project tests; it specifically re-audited the false-vindication trap and confirmed no fixture retained on variance alone. Report extends (not replaces) fq2j8's dataset of record; README carries the new "what makes a valid tier-discriminator" methodology note. bx7k5 (depends_on n7q4d) is now unblocked. **Recurring friction (5th session running):** git pruned the empty `contexts/agentic-workflow/doing/` before session start — recreated it before the claim, else the mechanized claim throws ENOENT. No bounces, failures, escalations, or concept candidates.

---

## 2026-07-04 16:53 -- Task verified and completed: agentic-workflow-n7q4d - Harden the verifier-catch-rate corpus with discriminating fixtures (opus ceilings the current set)

**Type:** Work / Task completion
**Task:** agentic-workflow-n7q4d - Harden the verifier-catch-rate corpus with discriminating fixtures (opus ceilings the current set)
**Summary:** Authored 4 harder verifier-catch-rate fixtures (checks 5/6/6b/8), real-spawned the opus verifier k>=3 (21 spawns); found a reproducible opus miss on missing-adr-borderline (0/6) — the discriminator bx7k5 needs — plus 3 ceiling-but-argued fixtures, and tightened the retention methodology.
**Duration:** 24m54s
**Verification:** PASS (iteration 1)
**Files changed:** 34
**Tests added:** 10
**ADRs written:** none

---

## 2026-07-04 16:26 -- Batch started: [agentic-workflow-n7q4d]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-n7q4d - Harden the verifier-catch-rate corpus with discriminating fixtures (opus ceilings the current set)
**Parallel:** no (1 worker — sole ready task; whats-next advisory stale, no weighting)

---

## 2026-07-04 16:24 -- Modeling / Promoted: agentic-workflow-n7q4d - Harden the verifier-catch-rate corpus with discriminating fixtures (opus ceilings the current set)

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-04 16:22 -- Modeling / Refined: agentic-workflow-n7q4d - Harden the verifier-catch-rate corpus with discriminating fixtures

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Cornered a conflation in the fixture-retention bar: it treated "opus shows non-zero verdict variance" as an unqualified keep signal, but opus flip-flops for two structurally different reasons — (a) hard-but-unambiguous (near its reasoning ceiling on a fixture with one right answer → a weaker tier reliably does worse; a real discriminator) vs (b) contested ground truth (even opus can't settle it → a weaker tier flip-flopping measures noise, not tier). Retaining (b) is worse than the false tie bx7k5 already guards against: it's a **false vindication of the incumbent on noise** (bx7k5 could read "opus 2/3, sonnet 1/3" as vindicating judgment-density when both tiers merely guess). Tightened the bar to require **unambiguous ground truth AND a reasoning-depth strain** — variance alone no longer suffices to retain (What + AC 3). Extended AC 4 to require a "what makes a valid tier-discriminator" methodology note in the eval README. Added two Notes bullets: the (a)/(b) distinction, and that check 8 (objective probe-shape ground truth) is the ambiguity-safe discriminator while checks 5/6/6b are where "borderline" shades into "contested." No split, no ADR; stays backlog.
**Split into:** none
**ADRs written:** none

---

## 2026-07-04 16:11 -- Modeling / Refined: agentic-workflow-bx7k5 - A/B the verifier's model routing (opus vs sonnet)

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Cornered a conflation in the falsification contract: ADR-0031 pins verifier→opus on TWO independent pillars — judgment-density (catch-rate, measurable) and decorrelation (gate ≠ producer tier, load-bearing, and structurally unmeasurable by a catch-rate eval). The spike measures pillar 1 only, but its old branch-1 remedy ("sonnet ties → propose verifier→sonnet") would re-correlate the worker→verifier pair — exactly what ADR-0031 rejects outright. Rescoped the spike to pillar 1: a sonnet-tie retires the judgment-density claim but never licenses verifier→sonnet (decorrelation independently holds the pin; given worker=sonnet + never-weaken-the-judge, opus is essentially forced). Rewrote Why + What + all AC + decision-rule branch 1 accordingly; added an explicit "no result here moves the verifier to sonnet" AC and a PROMOTE-time readiness gate (bx7k5 needs n7q4d to actually yield ≥1 opus-straining fixture, else inconclusive-by-construction). Backlinks: added ADR-0036 (runtime check-8 now in scope) and prior_art fq2j8/hz9m3.
**Split into:** none
**ADRs written:** none

---

## 2026-07-04 16:05 -- Modeling / Refined: agentic-workflow-bx7k5 - A/B the verifier's model routing (opus vs sonnet)

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Blocker `fq2j8` (opus baseline) is done, but its result — 24/24 catch, 24/24 right-reason, 0/3 false-FAIL, **variance 0 across all 9**, including the three judgment checks (5/6/6b) — shows the existing 12-fixture corpus sits at a zero-variance opus ceiling and cannot discriminate model tiers. Split off a prerequisite corpus-hardening spike; rewrote bx7k5 to run the sonnet arm over the **hardened** surface (existing 12 + new fixtures), pre-register the ceiling caveat (a ~100% tie on a ceilinged fixture is corpus-limited, not a sonnet win), fix the opus-baseline pointer to the 2026-07-04 report, and bring hz9m3's 3 runtime fixtures in scope.
**Split into:** agentic-workflow-n7q4d (Harden the verifier-catch-rate corpus with discriminating fixtures — blocks bx7k5)
**ADRs written:** none

---

## 2026-07-04 15:41 -- Work session ended

**Type:** Work / Session end
**Duration:** ~11m (batch start 15:30 → 15:41)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** infrastructure-h8k2m: 1
**Commits:** 3 (batch-start claim [7fdaea0] + task integration [f80cb2d] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (the fix hardens the mechanized lifecycle-move bookkeeping so a task move can't strand a duplicate file — strengthening "independent work runs in parallel without two workers colliding on the same file" and "wrong work is caught by structure"; no pull toward any non-goal)
**Carry-over:** none — working tree clean; no non-main worktrees
**Notes:** Single ready task, dispatched solo. infrastructure-h8k2m root-caused the batch-start stale-`todo/`-copy bug (filed by the prior m3q7k session) to `applyTaskMove` never reporting its *pre-move* source path in the returned `state` — so all three layer-2 manifest builders (`promoteTask`, `claimBatch`, `completeTask`) omitted the vacated source path from `changed`, leaving the caller's scoped `git add` (ADR-0026/ADR-0038) unable to stage the deletion. Fix adds `state.fromPath` and threads it into all three verbs' `changed` arrays (`claimBatch` via `flatMap([fromPath, path])`); the idempotent `completeTask` branch correctly omits it (no `doing/` source to vacate in a worktree that already squash-merged the move). Worker audited all three verbs, not just the reported `claimBatch`. Verifier PASS iteration 1, 176/176 tests. **Live reproduction this session:** the conductor's own batch-start `claim` reproduced the exact bug — the manifest listed only the `doing/` destination, not the `todo/` source deletion; the conductor worked around it by manually staging the deletion so the batch-start commit ([7fdaea0]) stayed clean (a clean rename), then the fix landed in the integration commit. **Recurring friction (4th session running):** git had pruned the empty `contexts/infrastructure/doing/` before session start — recreated it before the claim, else the mechanized `claim` throws a rename ENOENT. **Verifier harness note:** under Node 25, `node --test lib/test/` needs an explicit `*.test.mjs` glob to discover the suite (`node --test lib/test/*.test.mjs`) — the bare-dir form the batch resolved found nothing; the verifier adapted and ran 176/176. No bounces, failures, escalations, or concept candidates.

---

## 2026-07-04 15:40 -- Task verified and completed: infrastructure-h8k2m - Mechanized batch-start leaves a stale duplicate file in todo/ after moving a task into doing/

**Type:** Work / Task completion
**Task:** infrastructure-h8k2m - Mechanized batch-start leaves a stale duplicate file in todo/ after moving a task into doing/
**Summary:** applyTaskMove reports state.fromPath; promote/claim/complete manifests now enumerate the vacated source path so a scoped git add stages a lifecycle move atomically (no stale duplicate)
**Duration:** 9m56s
**Verification:** PASS (iteration 1)
**Files changed:** 3
**Tests added:** 2
**ADRs written:** none

---

## 2026-07-04 15:30 -- Batch started: [infrastructure-h8k2m]

**Type:** Work / Batch start
**Tasks:** infrastructure-h8k2m - Mechanized batch-start leaves a stale duplicate file in todo/ after moving a task into doing/
**Parallel:** no (1 worker — sole ready task; whats-next advisory stale, no weighting)

---

## 2026-07-04 15:28 -- Modeling / Promoted: infrastructure-h8k2m - Mechanized batch-start leaves a stale duplicate file in todo/ after moving a task into doing/

**Type:** Modeling / Promote
**BC:** infrastructure
**From → To:** backlog → todo

---

## 2026-07-04 15:24 -- Work session ended

**Type:** Work / Session end
**Duration:** ~17m (first batch start 15:07 → 15:24)
**Completed:** 1 (first-try PASS: 1, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** infrastructure-m3q7k: 1
**Commits:** 3 (batch-start claim [0fea549] + task integration [f6cec0b] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (the fix hardens the task-id → BC-resolution lifecycle tooling that underpins "independent work runs in parallel, respecting the dependency DAG" and "wrong work is caught by structure, not luck"; no pull toward any non-goal)
**Carry-over:** none — working tree clean; no non-main worktrees
**Notes:** Single ready task, dispatched solo. infrastructure-m3q7k (Postel split): `deriveContext` loosened to tolerate a digit-leading 5-char token tail (unstranding the already-shipped out-of-spec id `infrastructure-5w5gs`), plus a new pure `lib/id-grammar.mjs` mint-time lint (`classifyTaskId`/`isWellFormedTaskId`/`findMalformedTaskIds` + `GRANDFATHERED_IDS` allowlist + `node --test` live-tree scan) that is *stricter* than the parser, backed by new global **ADR-0044** amending ADR-0028 §3–§4. Deliberately reversed the tested aw-078 refuse-to-parse choice (rewrote its test + doc comment). Verifier PASS iteration 1, 174/174 tests. **Batch-start bug surfaced (filed `infrastructure-h8k2m`, backlog):** the mechanized `claim`'s `applyTaskMove` renamed the task todo→doing in the working tree, but the manifest's `changed` list reported only the doing/ *destination* — not the todo/ *source* deletion — so the conductor's scoped `git add` of manifest paths left a **stale duplicate todo/ copy** tracked in the batch-start commit (confirmed present on `main`'s batch-start tree). The worker independently detected both copies in its worktree base, removed the stale one, and filed the bug; the squash-merge carried the deletion so `main`'s final state has the task only in done/. Root cause is either `claimBatch`'s manifest omitting the source-path deletion or the SKILL's scoped-add prose — worth the builder's attention (h8k2m needs a `modeling` PROMOTE to be picked up). **Recurring friction:** git had pruned the empty `contexts/infrastructure/doing/` before session start — recreated it before the claim, else the mechanized `claim` throws a rename ENOENT (same friction logged the prior two sessions). Worker also maintained the ADR↔task backlinks itself (correct values; the SKILL nominally assigns that to the conductor — no re-edit needed). No bounces, failures, escalations, or concept candidates.

---

## 2026-07-04 15:22 -- Task verified and completed: infrastructure-m3q7k - deriveContext can't parse a leading-digit token id — mechanized lifecycle verbs fail on an out-of-spec ADR-0028 token

**Type:** Work / Task completion
**Task:** infrastructure-m3q7k - deriveContext can't parse a leading-digit token id — mechanized lifecycle verbs fail on an out-of-spec ADR-0028 token
**Summary:** deriveContext tolerates digit-leading 5-char token tails; new id-grammar mint-time lint + grandfather allowlist (ADR-0044)
**Duration:** 11m
**Verification:** PASS (iteration 1)
**Files changed:** 9
**Tests added:** 15
**ADRs written:** 0044-derivecontext-digit-lead-tolerant-resolver-stricter-minter.md

---

## 2026-07-04 15:09 -- Batch started: [infrastructure-m3q7k]

**Type:** Work / Batch start
**Tasks:** infrastructure-m3q7k - deriveContext can't parse a leading-digit token id — mechanized lifecycle verbs fail on an out-of-spec ADR-0028 token
**Parallel:** no (1 worker — sole ready task; whats-next advisory stale, no weighting)

---

## 2026-07-04 15:06 -- Modeling / Promoted: infrastructure-m3q7k - deriveContext can't parse a leading-digit token id — mechanized lifecycle verbs fail on an out-of-spec ADR-0028 token

**Type:** Modeling / Promote
**BC:** infrastructure
**From → To:** backlog → todo

---

## 2026-07-04 14:40 -- Modeling / Refined: infrastructure-m3q7k - deriveContext can't parse a leading-digit token id

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** backlog (promotion-ready — offered to builder)
**Summary:** Cornered the embedded decision with the `architect`. Builder chose the **Postel split** (forgiving resolver + strict mint-time lint) with the **5-char-any-lead** resolver style — loosen only deriveContext's token branch to `[0-9a-hjkmnp-tv-z]{5}` (still rejects `uuuuu` / 6-char). Surfaced two findings that reshaped the task: (1) the current "return id unchanged on a leading-digit token" is a **deliberate, tested** aw-078 choice (test at task-lifecycle.test.mjs:352) — hardening reverses it, so the AC now calls to rewrite that test + the doc comment, not patch around them; (2) the old AC #3 was **factually wrong** — `duplicate-id-check.mjs` is charter-bound shape-agnostic (no tail parse), so `deriveContext` is the sole dual-shape regex and there is no sibling to keep in sync; AC #3 dropped. Fix #2 lands as a new pure `lib/id-grammar.mjs` (`classifyTaskId`/`isWellFormedTaskId`/`findMalformedTaskIds` + `node --test` live-tree scan, aw-080 shape) with a `GRANDFATHERED_IDS` allowlist for the un-renumberable `5w5gs`; reserved all-digit foundation ids need no entry. Rewrote Why/What/AC/Notes accordingly.
**Split into:** none
**ADRs written:** none yet — AC calls for a short ADR amending ADR-0028 §3–§4 as the first work commit (resolver now digit-lead-tolerant; minters stricter than the parser; grammar enforced by the lint).

---

## 2026-07-04 14:25 -- Work session ended

**Type:** Work / Session end
**Duration:** ~50m (first batch start ~13:35 → 14:25)
**Completed:** 2 (first-try PASS: 2, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-fq2j8: 1, agentic-workflow-hz9m3: 1
**Commits:** 5 (2 batch-start claims [0cb9d9c, ddfe96e] + 2 task integrations [fq2j8 e6ca8d3, hz9m3 e4b52b1] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (both tasks measure/strengthen the `verifier` adversarial gate, the central structural defense in "wrong work is caught by structure, not luck"; no pull toward any non-goal)
**Carry-over:** none — working tree clean; no non-main worktrees
**Notes:** Two verifier-eval spikes, run in two serial waves rather than one parallel batch — a deliberate merge-ordering call: both task files documented a near-certain collision on `evals/verifier-catch-rate/README.md` "Known gaps" + the eval report, and fq2j8 is the baseline hz9m3 extends. Serializing let hz9m3's worktree branch from a HEAD already carrying fq2j8's edits, so its squash-merge was clean (zero conflicts) — the "land one and rebase the other" path both tasks recommended. fq2j8: full 9-fixture × k=3 eval re-run (27 real opus-pinned verifier spawns), 100% catch / 100% right-reason / 0% false-FAIL / 0 variance; re-baselines the original 6 against the current verifier. hz9m3: 3 new additive check-8 fixtures (runtime-clean/boot-fail/probe-mismatch) with bootable stdlib servers; the verifier empirically booted all three (clean→PASS, boot-fail→boot failure, probe-mismatch→floor mismatch) and confirmed the existing 9 untouched. Both PASS iteration 1. **Recurring friction:** git pruned the empty `contexts/agentic-workflow/doing/` twice (once at session start, once after fq2j8's squash emptied it), each time crashing the mechanized `claim` with a raw rename ENOENT — recreated `doing/` before each claim. **Provenance note (fq2j8):** the worker's report carries a "Continuity note" describing the 27-run matrix as produced "earlier" within its own run then re-confirmed by 2 spot-checks; verifier PASSed on artifact/ground-truth consistency, but a claimed non-reproducible measurement is inherently un-re-runnable by the gate — surfaced for the builder's awareness, not a defect. Backlog `agentic-workflow-bx7k5` (opus-vs-sonnet verifier A/B) is now dependency-unblocked (its `depends_on: [fq2j8]` is satisfied) but sits in `backlog/` — it needs a `modeling` PROMOTE before a future `work` run picks it up. No bounces, no failures, no concept candidates.

---

## 2026-07-04 14:24 -- Task verified and completed: agentic-workflow-hz9m3 - Add a check-8 (runtime drive, ADR-0036) fixture to the verifier-catch-rate eval

**Type:** Work / Task completion
**Task:** agentic-workflow-hz9m3 - Add a check-8 (runtime drive, ADR-0036) fixture to the verifier-catch-rate eval
**Summary:** Add check-8 runtime-drive fixtures (runtime-clean/boot-fail/probe-mismatch) with bootable stdlib servers; real verifier k=3 each — check 8 now measured
**Duration:** 24m (dispatch 14:00 → verdict 14:24)
**Verification:** PASS (iteration 1)
**Files changed:** 33
**Tests added:** 8
**ADRs written:** none

---

## 2026-07-04 14:00 -- Batch started: [agentic-workflow-hz9m3]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-hz9m3 - Add a check-8 (runtime drive, ADR-0036) fixture to the verifier-catch-rate eval
**Parallel:** no (1 worker — sole remaining ready task; hz9m3 was held from the prior wave to land after fq2j8 baseline, now rebases cleanly on fq2j8 README/report edits already on main)

---

## 2026-07-04 13:59 -- Task verified and completed: agentic-workflow-fq2j8 - Complete the verifier-catch-rate eval — one coherent full 9-fixture pass against the current verifier

**Type:** Work / Task completion
**Task:** agentic-workflow-fq2j8 - Complete the verifier-catch-rate eval — one coherent full 9-fixture pass against the current verifier
**Summary:** Complete the verifier-catch-rate eval — full 9-fixture x k=3 opus pass: 100% catch, 100% right-reason, 0% false-FAIL, 0 variance
**Duration:** 23m (dispatch 13:36 → verdict 13:59)
**Verification:** PASS (iteration 1)
**Files changed:** 5
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-04 13:35 -- Batch started: [agentic-workflow-fq2j8]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-fq2j8 - Complete the verifier-catch-rate eval — one coherent full 9-fixture pass against the current verifier
**Parallel:** no (1 worker — hz9m3 held to next wave: documented near-certain collision with fq2j8 on evals/verifier-catch-rate/README.md Known-gaps + the eval report; hz9m3 rebases cleanly once fq2j8 baseline lands on main, per both task notes land-one-and-rebase-the-other)

---

## 2026-07-04 12:24 -- Modeling / Promoted: agentic-workflow-fq2j8 - Complete the verifier-catch-rate eval — one coherent full 9-fixture pass against the current verifier

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-04 12:25 -- Modeling / Refined: agentic-workflow-fq2j8 - Complete the verifier-catch-rate eval — one coherent full 9-fixture pass against the current verifier

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (promoted immediately — see Promoted entry above)
**Summary:** Reshaped from "run the 3 remaining fixtures" to a full 9-fixture re-run in one coherent pass. Grounded the scope in a methodology check: `agents/verifier.md` changed after the 2026-07-03 baseline (check-8/runtime-drive from y8b4q; ADR-0043 Stop-hook from m9w5c, commit edad0d5), so splicing the old 6-fixture numbers onto a fresh 3 would be apples-to-oranges. Builder chose re-run-all-9 (~27 opus spawns) over the cheaper 3-only combine for a single internally-consistent dataset that re-baselines the original 6. Sharpened AC (per-fixture planted-check targets, combined full-9 reporting, fixture-bug-correction rule, new dated results/report + README/2026-07-03 pointer updates), added related_adrs [0031,0036], folded in the runbook + Node v25 test-command gotcha. `blocks: [bx7k5]` (concurrent backlink) preserved — this pass is the A/B baseline. Promoted to todo.
**Split into:** none
**ADRs written:** none

---

## 2026-07-04 12:21 -- Modeling / Captured: infrastructure-m3q7k - deriveContext can't parse a leading-digit token id — mechanized lifecycle verbs fail on an out-of-spec ADR-0028 token

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** backlog
**Summary:** `deriveContext` (`lib/task-lifecycle.mjs:254`) can't parse a `<bc>-<token>` id whose token leads with a digit (e.g. `5w5gs`) — it matches neither the legacy all-digit tail nor the ADR-0028 leading-letter token, so it returns the whole id as the BC and the mechanized promote/claim/complete verbs fail with "not found in todo/" until a caller hand-passes a `context`/`contexts` override. Surfaced live 2026-07-04 while running `work` on `infrastructure-5w5gs`. Filed as a backlog bug with an embedded decision (harden the resolver vs. add a mint-time validation gate vs. both; resolve the legacy-digit-tail-vs-leading-digit-token ambiguity). related_adrs 0028/0038, prior_art infrastructure-5w5gs.

---

## 2026-07-04 12:18 -- Modeling / Refined: agentic-workflow-bx7k5 - A/B the verifier's model routing (opus vs sonnet) using the verifier-catch-rate fixtures

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Cornered three seams. (1) Signal: the opus baseline measured only the 6 mechanical fixtures (100%, at ceiling) — the discriminating judgment checks 5/6/6b sit in the unmeasured 3, so the A/B is only meaningful over the full 9-fixture surface. Added `depends_on: [agentic-workflow-fq2j8]` (+ reciprocal `blocks` on fq2j8) so the opus arm is completed to all 9 first. (2) Method: pin sonnet via a per-spawn `Agent(model: "sonnet")` override instead of editing `agents/verifier.md` — byte-identical prompt, zero revert risk, no hazard to a concurrent work session. (3) Falsification: fixed an explicit decision rule (ties→superseding ADR / worse→opus vindicated / ceiling→inconclusive) before the run. Rewrote Why/What/AC/Notes to match.
**Split into:** none
**ADRs written:** none

---

## 2026-07-04 12:18 -- Modeling / Promoted: agentic-workflow-hz9m3 - Add a check-8 (runtime drive, ADR-0036) fixture to the verifier-catch-rate eval

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-04 11:31 -- Modeling / Refined: agentic-workflow-hz9m3 - Add a check-8 (runtime drive, ADR-0036) fixture to the verifier-catch-rate eval

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Grounded the spike against the real harness (`evals/verifier-catch-rate/`, ADR-0036, the check-8 spec in `agents/verifier.md`). Sharpened from "extend widgets or add a BC" to four concrete traps the check-8 spec imposes: (1) new additive fixture dirs bearing a `## Runtime surface` manifest, existing 9 untouched; (2) a real stdlib launcher binding ephemeral `:0` + runfile + stop (ADR-0036 pt4 permits `:0`); (3) the `diff.patch` must touch a `surfacePath` or check 8 no-ops; (4) the fixture must pass checks 1–7 or the verifier never reaches check 8 (the v3h6p clean-fixture lesson). Set the target set to runtime-clean + both distinct FAIL paths (boot-fail, probe-mismatch). Added j7d4k to prior_art; flagged the fq2j8 shared-file collision (README Known-gaps + report) as a batching note, not a depends_on.
**Split into:** none
**ADRs written:** none

---

## 2026-07-04 11:29 -- Work session ended

**Type:** Work / Session end
**Duration:** ~16m (batch start 11:13 → 11:29)
**Completed:** 1 (first-try PASS: 1 — infrastructure-5w5gs; re-dispatched: 0; skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** infrastructure-5w5gs: 1 (no re-dispatches — passed on iteration 1)
**Commits:** 3 (1 batch-start claim [d9f3123] + 1 task integration [infrastructure-5w5gs 8175992] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (the CRLF/BOM fix + fail-closed atomicity guard directly serve "wrong work is caught by structure"; no pull toward any non-goal)
**Carry-over:** none — working tree clean; no non-main worktrees
**Notes:** Single-task session; the sole ready task was the very CRLF lifecycle bug that had broken prior sessions (protocol 2026-07-03 18:09), now fixed at the read/write boundary in `lib/task-lifecycle.mjs` (EOL+BOM detect-on-read / restore-on-write, plus a pre-move dry-validation guard across promoteTask/claimBatch/completeTask). Verifier PASS iter 1, full suite 161/161. **Blocker worked around (not the CRLF bug — a second, latent one): the task id `infrastructure-5w5gs` has a leading-DIGIT token (`5w5gs`), which violates ADR-0028's leading-letter rule `[a-hjkmnp-tv-z]`.** `deriveContext` (`lib/task-lifecycle.mjs:254`) therefore cannot parse it and returns the whole id as the BC, so the mechanized `claim` and `complete` both failed with "not found in todo/" until I passed an explicit `contexts`/`context` BC override in the CLI's JSON opts. This is a real go-forward defect worth its own backlog item — either the id-generator emitted an out-of-spec token, or `deriveContext` should tolerate a leading digit. Also recreated the git-pruned empty `contexts/infrastructure/doing/` before the claim (same empty-dir-pruning residue noted last session). No bounces, no failures, no concept candidates. Board fully drained.

---

## 2026-07-04 11:28 -- Task verified and completed: infrastructure-5w5gs - task-lifecycle bookkeeping breaks on CRLF .agentheim files — promote/claim/complete strand the board mid-operation

**Type:** Work / Task completion
**Task:** infrastructure-5w5gs - task-lifecycle bookkeeping breaks on CRLF .agentheim files — promote/claim/complete strand the board mid-operation
**Summary:** EOL/BOM boundary-normalization for task-lifecycle bookkeeping (promote/claim/complete) — CRLF & BOM INDEX.md/protocol.md no longer strand the board; fail-closed marker dry-validation before any move
**Duration:** ~11m
**Verification:** PASS (iteration 1)
**Files changed:** 2
**Tests added:** 19
**ADRs written:** none

---

## 2026-07-04 11:14 -- Batch started: [infrastructure-5w5gs]

**Type:** Work / Batch start
**Tasks:** infrastructure-5w5gs - task-lifecycle bookkeeping breaks on CRLF .agentheim files — promote/claim/complete strand the board mid-operation
**Parallel:** no (1 worker — sole ready task; board otherwise drained)

---

## 2026-07-04 11:09 -- Modeling / Promoted: infrastructure-5w5gs - task-lifecycle bookkeeping breaks on CRLF .agentheim files — promote/claim/complete strand the board mid-operation

**Type:** Modeling / Promote
**BC:** infrastructure
**From → To:** backlog → todo

---

## 2026-07-04 11:07 -- Modeling / Refined: infrastructure-5w5gs - task-lifecycle bookkeeping breaks on CRLF .agentheim files

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** todo
**Summary:** Verified every technical claim against `lib/task-lifecycle.mjs`. Corrected scope: the fix lives in the three shared helpers (`removeIndexLine`/`insertIndexLineAtTop`/`prependProtocolEntry`), so it must cover all three verbs — `promoteTask`, `claimBatch` (the verb that actually broke a live session), `completeTask` — not just promote. Noted `applyTaskMove` is already EOL-safe and the two rotation modules are already CRLF-safe (out of scope). Folded in (builder-confirmed) a fail-closed atomicity guard: dry-validate all markers before the move so a future mismatch strands nothing. Widened acceptance criteria + tests to match; promoted to todo.
**Split into:** none
**ADRs written:** none

---

## 2026-07-03 18:09 -- Work session ended

**Type:** Work / Session end
**Duration:** ~27m (batch start 17:42 → 18:09)
**Completed:** 3 (first-try PASS: 3 — r9k2p, c8j3w, m9w5c; re-dispatched: 0; skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** r9k2p: 1, c8j3w: 1, m9w5c: 1 (no re-dispatches — every task passed on iteration 1)
**Commits:** 5 (1 batch-start claim [4c260fa] + 3 task integrations [r9k2p 8e498cc, c8j3w d035fc2, m9w5c edad0d5] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (r9k2p/c8j3w/m9w5c all serve durable knowledge + visible parallel execution; m9w5c's hooks are observability-only and its lane is read-only — honoring ADR-0017 and the "Not autonomous" non-goal, not driving the workflow)
**Carry-over:** none — working tree clean; no non-main worktrees
**Notes:** Single wave of 3 under ADR-0032 worktree isolation, all agentic-workflow BC, all first-try PASS. **Blocker hit and worked around — infrastructure-5w5gs confirmed live:** the mechanized `claim` failed twice at batch start — first because the `doing/` directory had been pruned to empty by the prior session (recreated it), then the captured CRLF bug (`removeIndexLine`'s `-->\n` regex cannot match this Windows checkout's CRLF `INDEX.md`/`protocol.md`). Since `core.autocrlf=true` and the committed blobs are LF, normalized the two script-touched files to LF in the working tree — a content no-op to git (verified via empty `--stat`) — which unblocked the mechanized `claim` + all three `completeTask` runs. **infrastructure-5w5gs should be prioritized** — it breaks the entire mechanized lifecycle on any CRLF `.agentheim` checkout until fixed at the read/write boundary in `lib/task-lifecycle.mjs`. **Clean README 3-way-merge:** c8j3w and m9w5c both added additive ubiquitous-language bullets to the BC README; git auto-merged both cleanly at squash-merge (no conflict) — re-validating the demoted-to-advisory pre-scan (additive edits merge; only wholesale rewrites conflict). **Node v25 test-command form:** the resolved `node --test lib/test/ dashboard/test/` (bare-dir) errors on this machine's Node v25.2.0; the glob form `node --test "lib/test/*.test.mjs" "dashboard/test/*.test.mjs"` runs clean — flagged by c8j3w's verifier, corrected for m9w5c's. **New ADR:** 0043 (live-observability hook heartbeat, BC-local, extends ADR-0027/0017). **For builder review (non-blocking):** m9w5c's ADR-0043 / README / Outcome prose claims a "real-subprocess smoke test" for `lib/hook-agent-signal.mjs`, but the test file uses injected-dependency `runHook` tests (no actual subprocess spawn); the verifier judged it a prose inaccuracy, not a defect against any acceptance criterion — PASS stands, but the wording is worth correcting. No bounces, no failures, no concept candidates. Board fully drained (todo + doing empty across all BCs).

---

## 2026-07-03 18:07 -- Task verified and completed: agentic-workflow-m9w5c - Live observability — hooks write agent status to state/, dashboard renders an in-flight lane

**Type:** Work / Task completion
**Task:** agentic-workflow-m9w5c - Live observability — hooks write agent status to state/, dashboard renders an in-flight lane
**Summary:** Stop/SubagentStop hooks heartbeat advisory state/in-flight.json (ADR-0043); read-only InFlightLane renders live work-session activity, self-suppressing on stale heartbeat
**Duration:** ~22m
**Verification:** PASS (iteration 1)
**Files changed:** 15
**Tests added:** 36
**ADRs written:** 0043-live-observability-hook-heartbeat-second-advisory-artifact.md

---

## 2026-07-03 18:00 -- Task verified and completed: agentic-workflow-c8j3w - INDEX done-list rotation — cap the done-list and roll older entries to a dated archive

**Type:** Work / Task completion
**Task:** agentic-workflow-c8j3w - INDEX done-list rotation — cap the done-list and roll older entries to a dated archive
**Summary:** cap-and-roll INDEX done-list rotation (rotateIndexDoneList) mirroring ADR-0039 - archives older months verbatim to done-archive/YYYY-MM.md
**Duration:** ~15m
**Verification:** PASS (iteration 1)
**Files changed:** 5
**Tests added:** 17
**ADRs written:** none

---

## 2026-07-03 17:54 -- Task verified and completed: agentic-workflow-r9k2p - Hover a backlog/todo ticket to highlight its dependencies with a pulsing ring

**Type:** Work / Task completion
**Task:** agentic-workflow-r9k2p - Hover a backlog/todo ticket to highlight its dependencies with a pulsing ring
**Summary:** verify hover-dependency umbrella end-to-end - all five children compose, closed to done
**Duration:** ~9m
**Verification:** PASS (iteration 1)
**Files changed:** 0
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-03 17:42 -- Batch started: [agentic-workflow-c8j3w, agentic-workflow-r9k2p, agentic-workflow-m9w5c]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-c8j3w - INDEX done-list rotation — cap the done-list and roll older entries to a dated archive, agentic-workflow-r9k2p - Hover a backlog/todo ticket to highlight its dependencies with a pulsing ring, agentic-workflow-m9w5c - Live observability — hooks write agent status to state/, dashboard renders an in-flight lane
**Parallel:** yes (3 workers, MAX_PARALLEL=3 - all agentic-workflow BC; ready set = 3, full wave, none held)
**Planning advisory:** whats-next (generated 2026-07-03 09:20) is STALE - older than the 15:35 session-end entry and its picks (t4x8p, p3v9k) already shipped; background weighting only

---

## 2026-07-03 15:35 -- Work session ended

**Type:** Work / Session end
**Duration:** ~48m (batch start 14:47 → 15:35)
**Completed:** 3 (first-try PASS: 3 — t7m4c, q3n7k, w7q2m; re-dispatched: 0; skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** t7m4c: 1, q3n7k: 1, w7q2m: 1 (no re-dispatches — every task passed on iteration 1)
**Commits:** 5 (1 batch-start claim [60098a1] + 3 task integrations [t7m4c 5ca5eaf, q3n7k 63a0ece, w7q2m c115ec3] + this session-end entry)
**Vision-conformance:** none — batch aligns with vision (t7m4c mechanizes bookkeeping but keeps git+gates with the skill, honoring "Not autonomous"; w7q2m's CONSOLIDATE is builder-in-the-loop and never auto-rewrites; q3n7k is workflow docs)
**Carry-over:** none — working tree clean; no non-main worktrees
**Notes:** Single wave of 3 under ADR-0032 worktree isolation, all agentic-workflow BC. **Two notable events.** (1) **ADR-number collision (as predicted at batch start):** t7m4c and w7q2m each independently minted ADR-0041; the conductor kept w7q2m's at 0041 (the broader two-disciplines/CONSOLIDATE doctrine that the c8j3w family cites) and renumbered t7m4c's to 0042 in its worktree before verification, updating all internal references. New ADRs: 0041 (artifact-growth two-disciplines + CONSOLIDATE verb), 0042 (complete-script single-task carve-out). (2) **Merge-back conflict, resolved not escalated:** all three tasks touched the BC README; t7m4c + q3n7k (small additive edits) integrated clean first, then w7q2m's wholesale 1006→598 consolidation conflicted on README only (every other w7q2m file merged clean). Per ADR-0032 the conductor aborted (`git reset --hard HEAD`, main pristine, worktree preserved), surfaced the choice, and — with the builder away — deliberately folded t7m4c's `claimBatch`/`completeTask`+ADR-0042 entries and q3n7k's guide paragraph into w7q2m's consolidated README, re-verifying no term/invariant/backlink was lost (final 621 lines, Read-able; the fold-in is c115ec3's diff, flagged for builder review). This validated the demoted-to-advisory pre-scan's limit: additive same-README edits 3-way-merge cleanly, a wholesale rewrite against them does not. **Deliberate checkpoint, not an empty board:** 3 ready todo tasks remain (c8j3w — INDEX done-list rotation, now un-collided since t7m4c shipped; m9w5c — live observability hooks + in-flight lane; r9k2p — hover-dependency umbrella integration close), held for a fresh conductor context after a wave that included a manual merge resolution. Batch lib suite green throughout (t7m4c 108/108). No bounces, no failures, no concept candidates. Re-invoke `work` to continue with wave 2.

---

## 2026-07-03 15:32 -- Task verified and completed: agentic-workflow-w7q2m - BC README consolidation + CONSOLIDATE verb

**Type:** Work / Task completion
**Task:** agentic-workflow-w7q2m - BC README consolidation — size trigger + human-in-loop consolidation procedure
**Summary:** Established the artifact-growth two-disciplines doctrine (ADR-0041): **cap-and-roll** (protocol/INDEX — verbatim, scripted, archived) vs **flag-and-consolidate** (READMEs — judgment, human-in-loop, in-place). Added the `modeling` **CONSOLIDATE** verb (5th beside CAPTURE/REFINE/PROMOTE/DISMISS) with a ~600-line trigger `whats-next` surfaces as a recommended move (no unattended auto-rewrite), a "never silently drop a term/invariant/backlink" guarantee, and scoped-commit doctrine (references/commit-doctrine.md, skills/modeling + whats-next SKILL.md). Demonstrated live by consolidating this BC's own README ~1006→598 lines in place, a strict superset of every prior ubiquitous-language term/invariant.
**Duration:** ~45m (dispatched 14:47; ~22m worker + ~3m verifier, then serialized behind t7m4c/q3n7k integration + a merge-back conflict resolution)
**Verification:** PASS (iteration 1) — verifier ran the lib suite (93/93 green), confirmed all 6 acceptance criteria, and directly verified the load-bearing property: the new README's lead-term set is a strict superset of the pre-consolidation README (57→59 terms, nothing dropped) and every ADR-id / task-id backlink resolves.
**Merge-back conflict (ADR-0032) — RESOLVED, not escalated:** all three batch tasks touched the BC README; t7m4c and q3n7k (small additive entries) integrated first and clean, then w7q2m's wholesale 1006→598 rewrite conflicted with them on README only (every other w7q2m file merged clean). Per ADR-0032 the conductor first aborted (`git reset --hard HEAD`, main left pristine, worktree preserved) and surfaced the choice to the builder; with the builder away, the conductor resolved it deliberately (not auto-guessed): took w7q2m's consolidated README as the base and folded in t7m4c's `claimBatch`/`completeTask` + ADR-0042 ubiquitous-language entries (condensed to the consolidated density) and q3n7k's workflow-guide paragraph, then re-verified no term/invariant/backlink was lost. Final README 621 lines — Read-able in one pass (well under the ~718 un-Readable point), though now just over ADR-0041's own ~600 advisory trigger, since the two folded-in entries are net-new post-consolidation content; `whats-next` will surface it in the ordinary course. **For builder review:** the reconciled README fold-in is this commit's diff.
**Files changed:** 5
**Tests added:** 0 (pure doctrine/prose + in-place consolidation — TDD legitimately N/A)
**ADRs written:** 0041-artifact-growth-two-disciplines-consolidate-verb.md

---

## 2026-07-03 15:26 -- Task verified and completed: agentic-workflow-q3n7k - Update the workflow guide (inquire + whats-next)

**Type:** Work / Task completion
**Task:** agentic-workflow-q3n7k - Update the workflow guide to reflect new features like inquire and what's next
**Summary:** Updated the dashboard's built-in Workflow guide page (aw-057 three-segment explainer) to add `whats-next` (positioned at the planning moment — opening the Promote & Work segment's diagram before modeling PROMOTE) and `inquire` (a new "Any time" section outside the three segments, an any-time read-only lens), with a regression test asserting the guide names AND correctly positions both skills. Static page, styleguide-unforked (ADR-0025 mainView), dist rebuilt faithfully.
**Duration:** ~39m (dispatched 14:47; ~5m worker + ~2m verifier, then serialized behind t7m4c integration)
**Verification:** PASS (iteration 1) — verifier ran the dashboard suite (712/712 green incl. the new regression test), confirmed the two skills' one-line roles + correct flow positioning, styleguide conformance, dist consistency (`node build.mjs` produced no drift), and check-8 runtime drive: booted the dashboard from the worktree (port 41376 from the runfile), /healthz → 200, /api/tree → 200, clean teardown.
**Files changed:** 4
**Tests added:** 1
**ADRs written:** none

---

## 2026-07-03 15:24 -- Task verified and completed: agentic-workflow-t7m4c - Mechanize CLAIM + COMPLETE lifecycle scripts

**Type:** Work / Task completion
**Task:** agentic-workflow-t7m4c - Mechanize CLAIM + COMPLETE lifecycle scripts against the ADR-0032 worktree / squash-merge model
**Summary:** Landed `claimBatch` (batch CLAIM — claims a set of ids, groups per-BC INDEX edits, one protocol entry, git-free manifest) and `completeTask` (idempotent single-task COMPLETE — tolerates the worktree's already-done doing→done move: `stale-precondition` + resolves-in-target → no-op move, proceed to bookkeeping) in `lib/task-lifecycle.mjs`, wired both into `lib/task-lifecycle-cli.mjs` (`claim`/`complete` verbs), and rewrote `skills/work/SKILL.md` to delegate CLAIM/COMPLETE bookkeeping to the scripts. ADR-0042 records keeping `complete` single-task-shaped, with the trivial-squash carve-out composed by the conductor (run `complete` per task, collect N manifests, write one multi-`[task-id]` commit).
**Duration:** ~37m (dispatched 14:47; ~16m worker + ~2m verifier, then serialized behind ADR-0041→0042 renumber + integration)
**Verification:** PASS (iteration 1) — verifier ran the full lib suite from the worktree (108/108 green incl. 19 new tests), confirmed the handlers are git-free (no child_process/git), the idempotent-complete test genuinely fails without the production branch, work/SKILL.md delegation replaced the old prose (not duplicated), and clean scope (no INDEX/protocol tampering).
**Files changed:** 8
**Tests added:** 19
**ADRs written:** 0042-complete-script-single-task-carve-out-composed-by-caller.md (minted by the worker as 0041; conductor renumbered to 0042 to resolve an in-batch collision with w7q2m's ADR-0041, updating all internal references)

---

## 2026-07-03 14:47 -- Batch started: [agentic-workflow-t7m4c, agentic-workflow-w7q2m, agentic-workflow-q3n7k]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-t7m4c - Mechanize CLAIM + COMPLETE lifecycle scripts (ADR-0032 worktree/squash-merge model), agentic-workflow-w7q2m - BC README consolidation (size trigger + modeling CONSOLIDATE verb), agentic-workflow-q3n7k - Update dashboard Workflow guide page (add inquire + whats-next)
**Parallel:** yes (3 workers, MAX_PARALLEL=3 — all agentic-workflow BC; 6 ready, 3 held to next wave: c8j3w [would collide with t7m4c on lib/task-lifecycle.mjs — hold so its wave-2 worktree branches off t7m4c's merge], m9w5c, r9k2p [held by MAX_PARALLEL cap; keep only one dashboard task this wave to avoid dashboard-file collisions with q3n7k])
**Planning advisory:** whats-next (generated 09:20) is **stale** — older than the 14:42 session-end entry and its picks (t4x8p, p3v9k) already shipped; weighted as background only.
**Merge-order advisory:** file domains are largely disjoint — t7m4c→lib/task-lifecycle + work/SKILL.md, w7q2m→modeling/whats-next SKILL prose + new ADR, q3n7k→dashboard/** (Workflow guide page). Watch for a w7q2m/t7m4c ADR-0041 number collision (both may mint the next-free ADR — renumber one at integration, as with last session's 0039/0040).

---

## 2026-07-03 14:45 -- Modeling / Captured: infrastructure-5w5gs - task-lifecycle CLI breaks on CRLF .agentheim files

**Type:** Modeling / Capture
**BC:** infrastructure
**Filed to:** backlog
**Summary:** `lib/task-lifecycle.mjs` assumes LF line endings in its INDEX/protocol edit functions (`removeIndexLine` start-marker regex `-->\n`, `insertIndexLineAtTop` `indexOf('-->\n')`, `prependProtocolEntry` `indexOf('\n---\n\n')`), so on CRLF `.agentheim` files — the Windows norm — a `promote` throws *after* `applyTaskMove` has already moved the file, stranding the board in a half-promoted state. Discovered live promoting `design-system-pv3mq` in the Mediatheca consumer repo (that promote was reconciled by hand). Captured as a bug with a concrete fix map (normalize EOL+BOM on the read/write boundary, keep the regex logic unchanged) and acceptance criteria covering CRLF/LF/BOM round-trips + new `lib/test/` fixtures. Left under-refined in backlog; optional hardening noted (dry-validate markers before moving so it fails closed).

---

## 2026-07-03 14:42 -- Work session ended

**Type:** Work / Session end
**Duration:** ~22m (batch start 14:20 → 14:42)
**Completed:** 3 (first-try PASS: 3 — r2c7m, z2f7s, v6d4n; re-dispatched: 0; skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** r2c7m: 1, z2f7s: 1, v6d4n: 1 (no re-dispatches — every task passed on iteration 1)
**Commits:** 5 (1 batch-start claim [9af8477] + 3 task integrations [z2f7s 01c928b, r2c7m 4ca7303, v6d4n d667f58] + this session-end entry)
**Carry-over:** none — working tree clean; no non-main worktrees
**Notes:** Single parallel wave of 3 under ADR-0032 worktree isolation, all agentic-workflow BC. All three edited `skills/work/SKILL.md` in disjoint sections (z2f7s→Phase 3 fan-out + new nested-budget section + protocol note; r2c7m→protocol-read pointers; v6d4n→session-end step) and git's 3-way squash-merge auto-merged every one cleanly — no merge-back conflicts, validating the demoted-to-advisory pre-scan (ADR-0032). **ADR-number collision handled:** r2c7m and v6d4n each independently picked the next-free number and both drafted ADR-0039; the conductor kept r2c7m at 0039 (rotation doctrine — the decision-of-record c8j3w/w7q2m cite) and renumbered v6d4n's to 0040 in its worktree before verification, updating all ~10 references. New ADRs: 0039 (protocol rotation doctrine), 0040 (vision-conformance advisory). Integrated lib suite green (93/93). No bounces, no concept candidates. **Deliberate checkpoint, not an empty board:** 6 ready todo tasks remain (c8j3w — now unblocked by r2c7m; t7m4c, w7q2m, m9w5c, q3n7k, r9k2p) — held for a fresh conductor context, chiefly the two bookkeeping keystones t7m4c (CLAIM+COMPLETE lifecycle scripts) and c8j3w (INDEX done-list rotation, reuses ADR-0039). Re-invoke `work` to continue.

---

## 2026-07-03 14:39 -- Task verified and completed: agentic-workflow-v6d4n - Vision-conformance check

**Type:** Work / Task completion
**Task:** agentic-workflow-v6d4n - Vision-conformance check — flag in-flight work that drifts from vision success criteria / non-goals
**Summary:** Added a bounded, advisory vision-conformance pass to `work`'s session-end reporting (new step in `skills/work/SKILL.md`, extending d6q4h's carry-over reconciliation home): it reads only `vision.md`'s "What success looks like" + "Non-goals" sections plus the batch's completed-task summaries and flags drift via a session-end protocol line and, when warranted, the shared `whats-next.md` advisory (ADR-0027 family) — never a gate. Deterministic helpers in `lib/vision-conformance.mjs` (15 unit tests), plus a should-flag/should-not-flag eval runbook under `evals/vision-conformance-check/`. Mechanism recorded in ADR-0040.
**Duration:** ~19m (dispatched 14:20; ~9m worker + verifier, serialized behind r2c7m integration)
**Verification:** PASS (iteration 1) — verifier ran the lib suite (80/80 green incl. 15 new), confirmed advisory-only/never-blocks property, the two-section bounded read against the real vision.md headings, and the flag/no-flag eval pair; clean scope.
**Files changed:** 13
**Tests added:** 15
**ADRs written:** 0040-vision-conformance-check-session-end-advisory.md (renumbered from a 0039 draft to resolve an in-batch ADR-number collision with r2c7m)

---

## 2026-07-03 14:38 -- Task verified and completed: agentic-workflow-r2c7m - Protocol rotation

**Type:** Work / Task completion
**Task:** agentic-workflow-r2c7m - Protocol rotation — cap protocol.md and roll to monthly files
**Summary:** Shipped `rotateProtocol` (`lib/protocol-rotation.mjs`), a deterministic git-free k5n8f-family script that caps the live `protocol.md` at ~1,000 lines and rolls whole *older* months out verbatim to `knowledge/protocol/YYYY-MM.md` (current month never rolled; newest-on-top order preserved; month derived from entry headings, no `Date.now()`). Recorded the archive convention in ADR-0039 (the decision-of-record c8j3w/w7q2m reuse) and pointed the work/modeling/whats-next skill prose + index-template + BC README + `knowledge/index.md` Pointers at the new rollover location.
**Duration:** ~18m (dispatched 14:20; ~10m worker + verifier, serialized behind checkpoints)
**Verification:** PASS (iteration 1) — verifier ran the full lib suite (78/78 green incl. 13 new tests: cap boundary, verbatim move, ordering, live recency, current-month-never-rolls, idempotent re-run, missing-file no-op, CLI); confirmed verbatim/deterministic guarantees and clean scope (conductor-owned index/INDEX pointers correctly left to the conductor).
**Files changed:** 8
**Tests added:** 13
**ADRs written:** 0039-protocol-rotation-doctrine-verbatim-monthly-archive-live-cap.md

---

## 2026-07-03 14:29 -- Task verified and completed: agentic-workflow-z2f7s - Fan-out caps

**Type:** Work / Task completion
**Task:** agentic-workflow-z2f7s - Fan-out caps — MAX_PARALLEL as a knob, research cap, global nested-spawn ceiling
**Summary:** Named `MAX_PARALLEL` (default 3) as a user-settable knob in `skills/work/SKILL.md` Phase 3 with a merge-surface-vs-review-load rationale (and a b8x2v measured-basis pointer for future revisiting); gave `skills/research/SKILL.md` a matching default cap of 3 concurrent researchers, overridable by explicit ask; added a "Nested fan-out budget (worst case — documented, not enforced)" section stating `MAX_PARALLEL × (1 orchestrator + up to 4 specialists)` with n6r8j (ADR-0035) as the structural mitigation and an explicit non-enforcement disclaimer; codified the "cap triggered — never truncate silently" rule beside the Batch-started template.
**Duration:** ~9m (dispatched 14:20; worker ~3m + verifier ~1m, serialized behind checkpoint)
**Verification:** PASS (iteration 1) — verifier ran the lib suite (65 tests green via glob invocation) and confirmed all 4 acceptance criteria + honest "documented, not enforced" framing + clean scope (no INDEX/protocol/README/other-BC touched).
**Files changed:** 2
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-03 14:20 -- Batch started: [agentic-workflow-r2c7m, agentic-workflow-z2f7s, agentic-workflow-v6d4n]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-r2c7m - Protocol rotation (cap protocol.md, roll to monthly files), agentic-workflow-z2f7s - Fan-out caps (MAX_PARALLEL knob, research cap, nested-spawn budget), agentic-workflow-v6d4n - Vision-conformance check (session-end drift advisory)
**Parallel:** yes (3 workers, MAX_PARALLEL — all agentic-workflow BC)
**Planning advisory:** whats-next (generated 09:20) is **stale** — older than the 13:06 session-end entry, and its picks (t4x8p, p3v9k) already shipped; weighted as background only. Batch chosen for leverage (r2c7m unblocks c8j3w) + light preload; t7m4c held back to avoid a guaranteed lib/task-lifecycle.mjs self-conflict with r2c7m. **Cap note:** 6 ready todo tasks remain beyond this batch of 3 (m9w5c, q3n7k, r9k2p, t7m4c, w7q2m) — held to later waves by MAX_PARALLEL=3, not dropped.
**Merge-order advisory:** all three touch `skills/work/SKILL.md` in disjoint sections (z2f7s→Phase 3 fan-out, v6d4n→End-of-run session-end, r2c7m→Protocol-logging) — squash-merge sequentially; expect clean 3-way auto-merge (ADR-0032).

---

## 2026-07-03 13:06 -- Work session ended

**Type:** Work / Session end
**Duration:** ~1h17m (first batch start 11:49 → 13:06)
**Completed:** 6 (first-try PASS: 5 — t4x8p, y8b4q, q8m4t, v3h6p, k5n8f; skipped: 1 — p3v9k decision-only)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** t4x8p: 1, y8b4q: 1, p3v9k: 1, v3h6p: 1, q8m4t: 1, k5n8f: 1 (no re-dispatches — every task passed/skipped on iteration 1)
**Commits:** 10 (3 batch-start claims + 6 task integrations + this session-end entry)
**Carry-over:** none — working tree clean; no non-main worktrees
**Notes:** Three waves under ADR-0032 worktree isolation. Wave 1 = t4x8p / y8b4q (parallel); wave 2 = p3v9k / v3h6p / q8m4t (parallel, spanned agentic-workflow + infrastructure BCs); wave 3 = k5n8f (solo, the bookkeeping-chain keystone). No merge-back conflicts (disjoint file sets by construction). **Milestones:** y8b4q shipped the verifier's runtime-drive check 8 (ADR-0036), and k5n8f's verification was the **first live check-8 drive** — booted the dashboard, probed /healthz + /api/tree, clean teardown. p3v9k ratified ADR-0038 (fail-closed depends_on + 3-layer bookkeeping), which k5n8f then implemented on the PROMOTE path — now unblocking r2c7m / t7m4c / c8j3w. v3h6p gave the verifier gate its first measured catch rate (15/15 catch + right-reason). A concurrent `modeling` session promoted the full backlog (13 tasks) to todo mid-run; picked up as they became ready. New backlog items filed: agentic-workflow-fq2j8, hz9m3, bx7k5 (from v3h6p). ADRs written: 0038. No concept candidates. **Board still has ~8 ready todo tasks** (q3n7k, r9k2p, m9w5c, v6d4n, w7q2m, z2f7s + the newly-unblocked r2c7m, t7m4c) — session paused here as a deliberate checkpoint, not an empty board; re-invoke `work` to continue.

---

## 2026-07-03 13:04 -- Task verified and completed: agentic-workflow-k5n8f - Mechanize the bookkeeping (MVP)

**Type:** Work / Task completion
**Task:** agentic-workflow-k5n8f - Mechanize the bookkeeping (MVP) — generalized plugin-file resolver + git-free PROMOTE lifecycle script
**Summary:** Landed ADR-0038's pattern-MVP on the PROMOTE path: new `lib/resolve-plugin-file.mjs` (env-free plugin-file resolver; `dashboard/resolve-launcher.mjs` ported to delegate, behavior-preserving); `promoteTask` wired live into `lib/task-lifecycle.mjs` (calls `applyTaskMove`, does the INDEX/protocol/backlink surgery, returns a git-free enumerated manifest `{changed,message,verb,id}`); new `lib/task-lifecycle-cli.mjs`; `modeling`/`work` SKILL prose rewritten (PROMOTE delegates to the CLI, missing-`depends_on` now fail-closed per Ruling A). Unblocks r2c7m / t7m4c / c8j3w.
**Duration:** ~19m
**Verification:** PASS (iteration 1) — **first live check-8 runtime drive**: verifier booted `dashboard/launch.mjs` (port 41536 from the runfile), `/healthz` → 200, `/api/tree` → 200, torn down cleanly — the resolver port is behavior-preserving.
**Files changed:** 10
**Tests added:** 23
**ADRs written:** none

---

## 2026-07-03 12:44 -- Batch started: [agentic-workflow-k5n8f]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-k5n8f - Mechanize the bookkeeping (MVP) — generalized plugin-file resolver + git-free PROMOTE lifecycle script
**Parallel:** no (1 worker — run solo for a focused, low-risk integration; it's the keystone unblocking the k5n8f→r2c7m/t7m4c→c8j3w bookkeeping chain, and its contract ADR-0038 just landed)
**Planning advisory:** whats-next (12:00 modeling sweep is the newest planning input). k5n8f chosen for maximal unblock leverage now that p3v9k/ADR-0038 is accepted.

---

## 2026-07-03 12:40 -- Task verified and completed: agentic-workflow-v3h6p - Eval-harness the verifier

**Type:** Work / Task completion
**Task:** agentic-workflow-v3h6p - Eval-harness the verifier — measure its catch rate against planted defects
**Summary:** Built a 9-fixture verifier-catch-rate eval under `evals/verifier-catch-rate/` (each fixture carries the full verifier-input tuple + `expected.json` ground truth) and real-spawned the live opus-pinned `agentheim:verifier` (k=3) against 6 of them: **catch rate 15/15, right-reason 15/15 (zero lucky catches), false-FAIL 0/3, zero verdict variance**. Report at `.agentheim/knowledge/verifier-catch-rate-eval-2026-07-03.md`. Remaining 3 fixtures logged built-but-unmeasured; check 8 (runtime drive) named as a known gap. First real measurement of the load-bearing quality gate — it earns its keep on the checks exercised.
**Duration:** ~28m (dispatched 12:12; long spike with nested real-verifier spawns, serialized behind two integrations)
**Verification:** PASS (iteration 1)
**Files changed:** 81
**Tests added:** 0 (spike — fixtures are eval ground-truth data, not dashboard-suite tests)
**ADRs written:** none
**New backlog items:** agentic-workflow-fq2j8 (run remaining fixtures), agentic-workflow-hz9m3 (add a check-8 fixture), agentic-workflow-bx7k5 (A/B verifier opus-vs-sonnet)

---

## 2026-07-03 12:39 -- Task verified and completed: infrastructure-q8m4t - Support quotation marks (Gänsefüsschen) in prompts

**Type:** Work / Task completion
**Task:** infrastructure-q8m4t - Support quotation marks (Gänsefüsschen) in prompts
**Summary:** Added byte-for-byte typographic-quote (`„ " » «`) round-trip fixtures to `vscode-extension/test/bridge.test.mjs` (real node:http POST → readBody UTF-8 → JSON.parse → `{command:'claude', args:[prompt]}`) and `dashboard/test/bridge-launch.test.mjs` (POST /run body + clipboard fallback) — transport proved Unicode-clean; corrected 8 stale `claude "<prompt>"` shell-wrap doc comments across 3 dashboard/app files to the raw-argv reality. Residual risk localized to the terminal-launch codepage layer (extension.js createTerminal on win32), left as a documented manual builder follow-up (a worker can't drive a live launch).
**Duration:** ~25m (dispatched 12:12; serialized behind p3v9k integration)
**Verification:** PASS (iteration 1)
**Files changed:** 5
**Tests added:** 4
**ADRs written:** none

---

## 2026-07-03 12:35 -- Task completed (verification skipped): agentic-workflow-p3v9k - Decide the lifecycle-mechanization boundary

**Type:** Work / Task completion
**Task:** agentic-workflow-p3v9k - Decide the lifecycle-mechanization boundary — fail-closed depends_on ruling + 3-layer bookkeeping ADR
**Summary:** Ratified ADR-0038 — fail-closed `depends_on` (a dep id in no lifecycle folder = unsatisfied → refuse, matching `dependencySatisfied()`) + three concentric bookkeeping layers (mover / git-free CLI-emitting-manifest / skill-owns-judgment+git); builds on ADR-0007/0026/0032, supersedes the duplicated bookkeeping prose across the four skills, becomes k5n8f's contract. Filed as 0038 (0037 was already taken by the worktree-isolation spike-findings ADR).
**Duration:** ~2m30s
**Verification:** SKIPPED — decision-only task (single ADR file)
**Files changed:** 1

---

## 2026-07-03 12:10 -- Batch started: [agentic-workflow-p3v9k, agentic-workflow-v3h6p, infrastructure-q8m4t]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-p3v9k - Decide the lifecycle-mechanization boundary (fail-closed depends_on + 3-layer bookkeeping ADR), agentic-workflow-v3h6p - Eval-harness the verifier, infrastructure-q8m4t - Support quotation marks (Gänsefüsschen) in prompts
**Parallel:** yes (3 workers, MAX_PARALLEL — spans 2 BCs)
**Planning advisory:** whats-next (12:00 modeling sweep is the newest planning input; the 09:20 whats-next flagged p3v9k as the higher-leverage unblock). Picked p3v9k for leverage (unblocks the k5n8f→r2c7m/t7m4c→c8j3w chain), infrastructure-q8m4t as a clean separate-BC parallel, and v3h6p (spike) building on the just-shipped verifier/runtime work. Disjoint file surfaces (ADR / infra bridge+dashboard-app / evals harness).

---

## 2026-07-03 12:05 -- Task verified and completed: agentic-workflow-y8b4q - End-to-end verification step for tasks with a runtime surface

**Type:** Work / Task completion
**Task:** agentic-workflow-y8b4q - End-to-end verification step for tasks with a runtime surface
**Summary:** Implemented ADR-0036's runtime-drive check as doctrine — added the verifier's final check 8 (fires on a `surfacePath`-touching diff, boots via the BC manifest's `launch`, reads the actual bound port from the runfile, asserts stdlib-only HTTP-floor `probes`, always tears down via `stop`), narrowed the manual-exercise carve-out in both `agents/verifier.md` and the verification SKILL, wired `work`'s launch-descriptor resolution + `## Pre-resolved launch command` block beside the test-command seam, and gave the agentic-workflow BC README its `## Runtime surface` manifest for the dashboard.
**Duration:** ~13m
**Verification:** PASS (iteration 1)
**Files changed:** 4
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-03 12:04 -- Task verified and completed: agentic-workflow-t4x8p - Fix CRLF-sensitive byte-identical guard regexes

**Type:** Work / Task completion
**Task:** agentic-workflow-t4x8p - Fix CRLF-sensitive byte-identical guard regexes in intent-route rail-routing tests
**Summary:** The two `isTaskIntent` byte-identical guard regexes now use `\r?\n` instead of a bare `\n`, so they pass on a CRLF (Windows) checkout while still failing if `isTaskIntent`'s body changes — the ADR-0021/0025 decision-2 body-lock is preserved, only line-ending sensitivity was removed.
**Duration:** ~9m
**Verification:** PASS (iteration 1)
**Files changed:** 2
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-03 12:00 -- Modeling / Refined + Promoted: full backlog sweep (13 tasks → todo)

**Type:** Modeling / Refine + Promote
**BC:** agentic-workflow (12), infrastructure (1)
**From → To:** backlog → todo (all 13); backlog now empty across both BCs
**Summary:** Builder delegated best-default answers ("refine all tasks and backlog, promote to todo so the running worker picks them up — I don't want to be at the helm"). So every held builder-confirmation gate from the 09:34 sweep was resolved with best judgment and promoted. **Keystone:** confirmed **p3v9k Ruling A = fail-closed** `depends_on` (missing target ⇒ unsatisfied ⇒ refuse) — matches `dependencySatisfied()`, the vision's catch-wrong-work-by-structure ethos, and ADR-0022's dead-id stripping — which unblocks the bookkeeping chain **p3v9k → k5n8f → {r2c7m → c8j3w, t7m4c}** (t7m4c's other dep f6m2q is done; verified on disk). **Ratified best-judgment defaults:** w7q2m (5th modeling verb CONSOLIDATE signed off), v3h6p (all 4 eval-design calls), z2f7s (kept-as-one-task + documented-not-enforced spawn budget), m9w5c (dep design-system-001 styleguide is done → gate satisfied). **r9k2p** promoted as an end-to-end **integration close** — all five children (d8q3n / w4t9k / b7n2s / k5p8w / h9v3m) are done; worker boots via ADR-0036 runtime-drive, confirms composed hover behavior, closes. **Refined 3 under-specified tasks to concrete AC:** v6d4n (settled forks → `work` session-end home / advisory-only never-blocks / two-vision-section bounded read), q3n7k (target confirmed = dashboard Workflow guide page; added satisfied styleguide dep; cleaned malformed capture tail), infrastructure-q8m4t (reframed the manual reproduce-first gate — which a worker can't drive — into a code-layer round-trip regression fixture + do-regardless grep-anchored doc-drift rider; live-launch codepage confirmation demoted to a documented builder follow-up). Worker DAG-orders the 12 aw todo items via `depends_on` under the now-confirmed fail-closed gate.
**Split into:** none (v6d4n/q3n7k/q8m4t refined in place; m9w5c/r9k2p carry optional worker-discretion split notes)
**ADRs written:** none by modeling — p3v9k, r2c7m, w7q2m, v6d4n each write their ADR when worked

---

## 2026-07-03 11:49 -- Batch started: [agentic-workflow-t4x8p, agentic-workflow-y8b4q]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-t4x8p - Fix CRLF-sensitive byte-identical guard regexes in intent-route rail-routing tests, agentic-workflow-y8b4q - End-to-end verification step for tasks with a runtime surface
**Parallel:** yes (2 workers)
**Planning advisory:** whats-next (generated 2026-07-03T09:20:00Z, current — newer than last Work entry 09:14) recommends t4x8p first as the zero-deliberation quick win; ordered first within the batch.

---

## 2026-07-03 09:34 -- Modeling / Promoted: agentic-workflow-t4x8p, agentic-workflow-y8b4q

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo
**Summary:** Promoted t4x8p (CRLF byte-identity test fix — explicit builder request; refined to a closed two-file scope this session) and y8b4q (end-to-end runtime-surface verification — its blocker j7d4k / ADR-0036 ratification is done, 7 concrete AC, the task itself flagged "promote when ready"). Swept the rest of the backlog for "unblocked AND refined enough": **r9k2p** is an umbrella parent already complete-by-children (all five of d8q3n / w4t9k / b7n2s / k5p8w / h9v3m are done) — surfaced to the builder for closure to done rather than promoted. Held: p3v9k / v3h6p / z2f7s / w7q2m (builder-confirmation gates); infrastructure-q8m4t (refined but its reproduce-first round-trip is a manual human-at-the-dashboard step — flagged for the builder); k5n8f / r2c7m / c8j3w / t7m4c (unmet deps on the p3v9k bookkeeping chain); v6d4n / q3n7k / m9w5c (under-refined).

---

## 2026-07-03 09:28 -- Modeling / Refined: agentic-workflow-t4x8p - Fix CRLF-sensitive byte-identical guard regexes

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Resolved the task's one open item (the "grep the rest of the suite for the same fragility" hunt deferred to the worker). Swept `dashboard/test/` for the literal-char-then-bare-`\n` regex-literal signature and pinned the scope to exactly two lines — `about-rail-routing.test.mjs:187` and `workflow-rail-routing.test.mjs:161`, the identical `isTaskIntent` byte-identical guard — with no hidden third file (`[\s\S]`-class and dynamic `new RegExp` forms absorb `\r` and aren't affected). Tightened What/AC to the confirmed two-file scope, added related_adrs [0021, 0025] (the decisions the guard protects), recorded the fix locations. Now a closed, ready-to-work fix.
**Split into:** none
**ADRs written:** none

---

## 2026-07-03 09:14 -- Work session ended

**Type:** Work / Session end
**Duration:** ~34m
**Completed:** 4 (first-try PASS: 4, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-j7d4k: 1, agentic-workflow-s7d3k: 1, agentic-workflow-h9v3m: 1, agentic-workflow-x4t2g: 1
**Commits:** 7 (2 batch-start claims + 4 task integrations + this session-end entry)
**Carry-over:** none — working tree clean
**Notes:** Two waves under ADR-0032 worktree isolation. Wave 1 = j7d4k / s7d3k / h9v3m (parallel, MAX_PARALLEL=3); wave 2 = x4t2g (sequenced after s7d3k so it edited the post-relocation SKILL files). Every task passed verification on the first iteration; no merge-back conflicts (disjoint file sets by construction). New backlog item filed mid-run: agentic-workflow-t4x8p (pre-existing CRLF byte-identity test failures, noticed by the h9v3m worker). No concept candidates surfaced.

---

## 2026-07-03 09:12 -- Task verified and completed: agentic-workflow-x4t2g - whats-next feeds back into planning

**Type:** Work / Task completion
**Task:** agentic-workflow-x4t2g - whats-next feeds back into planning — modeling and work read the advisory at session start
**Summary:** `modeling` ("Before acting") and `work` (batch planning) now read `.agentheim/state/whats-next.md` when present and surface its recommended move + staleness age to the builder — modeling weighting REFINE/CAPTURE questions, work informing ordering among already-ready tasks. Strictly advisory per ADR-0027 §4: no auto-move/promote/pick, no DAG override; staleness (vs the newest Work protocol entry) softens weight only, missing/malformed degrades silently.
**Duration:** ~6m
**Verification:** PASS (iteration 1)
**Files changed:** 3
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-03 09:06 -- Batch started: [agentic-workflow-x4t2g]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-x4t2g - whats-next feeds back into planning — modeling and work read the advisory at session start
**Parallel:** no (1 worker — wave 2; the only remaining ready task, sequenced after s7d3k's doctrine relocation)

---

## 2026-07-03 09:04 -- Task verified and completed: agentic-workflow-h9v3m - Board wiring — collapsed-group markers and scroll-reactive off-viewport edge blinks

**Type:** Work / Task completion
**Task:** agentic-workflow-h9v3m - Board wiring — collapsed-group markers and scroll-reactive off-viewport edge blinks
**Summary:** Board now signals dependency targets k5p8w's on-card ring can't reach: a pure-data hidden-dependency marker on collapsed BC sections + the peeked Done collapse control, and a scroll-reactive off-viewport edge-blink driven by a hover-scoped IntersectionObserver rooted on the sole scroll container (ADR-0033 seam honored — pure derivation for the hidden case, DOM-only glue untested). Filed backlog t4x8p for the pre-existing CRLF byte-identity test failures noticed en route.
**Duration:** ~20m
**Verification:** PASS (iteration 1)
**Files changed:** 7
**Tests added:** 20
**ADRs written:** none

---

## 2026-07-03 09:00 -- Task verified and completed: agentic-workflow-s7d3k - Single-source the duplicated doctrine into references/ files

**Type:** Work / Task completion
**Task:** agentic-workflow-s7d3k - Single-source the duplicated doctrine into references/ files
**Summary:** Relocated the three duplicated doctrine blocks (id grammar, commit doctrine, worker return format) into repo-root `references/{id-grammar,commit-doctrine,worker-return-format}.md`, collapsing every inline copy across the four skills and two agents to a one-line summary + repo-relative pointer (the `references/modes.md` pattern). Grep-verified single authoritative home per block; the f7k2d drift cannot recur since `work`'s spawn template pastes the single return-format source at dispatch.
**Duration:** ~16m
**Verification:** PASS (iteration 1)
**Files changed:** 9
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-03 08:57 -- Task verified and completed: agentic-workflow-j7d4k - Ratify ADR-0036 — verifier runtime-drive end-to-end check

**Type:** Work / Task completion
**Task:** agentic-workflow-j7d4k - Ratify ADR-0036 — verifier runtime-drive end-to-end check
**Summary:** ADR-0036 ratified proposed → accepted — all three directional decisions (verifier drives / tiered HTTP-floor + opt-in render / diff-path allowlist trigger) confirmed; open questions settled (manifest = BC README fenced block, boot timeout = FAIL, render-tier shape deferred); one factual staleness (launcher port is deterministic-sticky per ADR-0002 §infra-018/019, not ephemeral) corrected and y8b4q re-synced to match.
**Duration:** ~13m
**Verification:** PASS (iteration 1)
**Files changed:** 2
**Tests added:** 0
**ADRs written:** 0036 (ratified)

---

## 2026-07-03 08:40 -- Batch started: [agentic-workflow-j7d4k, agentic-workflow-h9v3m, agentic-workflow-s7d3k]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-j7d4k - Ratify ADR-0036 — verifier runtime-drive end-to-end check, agentic-workflow-h9v3m - Board wiring — collapsed-group markers and scroll-reactive off-viewport edge blinks, agentic-workflow-s7d3k - Single-source the duplicated doctrine into references/ files
**Parallel:** yes (3 workers)

---

## 2026-07-03 08:35 -- Modeling / Promoted: agentic-workflow-j7d4k, agentic-workflow-h9v3m, agentic-workflow-s7d3k, agentic-workflow-x4t2g

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo
**Summary:** Batch promotion of every ready backlog task ("promote all that are ready"). j7d4k (ratify ADR-0036 — decision, no deps, k9t3w precedent), h9v3m (board wiring collapsed-group/off-viewport cues — deps k5p8w + design-system-b7n2s both done), s7d3k (single-source doctrine — unblocked since f7k2d shipped), x4t2g (whats-next read edge — flagged ready-to-promote at its 2026-07-02 refine). Held back, with reasons surfaced to the builder: p3v9k / v3h6p / z2f7s / w7q2m / infrastructure-q8m4t (explicit builder-confirmation gates), k5n8f / r2c7m / c8j3w / t7m4c / y8b4q / r9k2p (unmet dependencies), v6d4n / q3n7k / m9w5c (under-refined).

---

## 2026-07-03 00:31 -- Modeling / Refined: infrastructure-q8m4t - Support quotation marks (Gänsefüsschen) in prompts

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** backlog
**Summary:** Second refine pass (builder away — the three reproduction questions from the first pass went unanswered again, so the promote gate stays shut). Re-verified the task's code citations against the live tree: launch path unchanged (raw-argv descriptor in `bridge.js` ~176–191, `createTerminal` in `vscode-extension/extension.js` ~83–90). Found the doc-drift rider's citations had already drifted (`bridge-launch.js:24`→25/119/163, `modeling-command.js:41,47,58`→39/47/56/122) and missed `skip-permissions-state.js` — rewrote the rider to be **grep-anchored** (search for the literal `claude "<prompt>"` phrase) instead of line-pinned, with the current hit set and the legitimate `*CommandFor` placeholders excluded. Hypothesis and reproduction-first AC untouched.
**Split into:** none
**ADRs written:** none

---

## 2026-07-03 00:20 -- Modeling / Refined: agentic-workflow-k5n8f - Mechanize the bookkeeping

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Refined via architect consultation and split three ways. Settled the two open forks: the missing-`depends_on`-target divergence is ruled **fail-closed** (matches `dependencySatisfied()`; overrides `work/SKILL.md:25`), and the mechanized script is **git-free** — it emits an enumerated manifest, the caller commits. Re-cut k5n8f to a **PROMOTE-first pattern MVP** (generalized env-free plugin-file resolver + git-free promote handler + CLI skeleton) because ADR-0032 worktrees make COMPLETE/CLAIM entangled and they collide with the in-flight f6m2q.
**Split into:** agentic-workflow-p3v9k (type:decision — the fail-closed ruling + 3-layer boundary ADR, blocks k5n8f), agentic-workflow-t7m4c (CLAIM + COMPLETE against the worktree/squash-merge model, depends_on k5n8f + f6m2q).
**ADRs written:** none yet — the boundary ADR is p3v9k's worked output.

---

## 2026-07-03 00:14 -- Modeling / Refined: agentic-workflow-n6r8j - Flatten single-specialist consultations — worker spawns the specialist directly

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo (refined to ready, promoted in the same pass)
**Summary:** Sharpened the flatten-consultation refactor into a workable task: added the concrete Signal→Specialist routing hint to inline in `worker.md`, a minimum-context-block spec for AC-3 (so a directly-spawned specialist sees orchestrator-quality context), a verbatim single-vs-multi boundary rule for both agent docs, and AC-4 to fix `worker.md:14`'s stale "orchestrator passes these" (→ conductor). Wired `related_adrs: [0035]` and `prior_art: [agentic-workflow-h3z5b]`.
**Split into:** none
**ADRs written:** ADR-0035 (proposed) — worker spawns a single specialist directly; orchestrator reserved for multi-specialist aggregation

---

## 2026-07-03 00:08 -- Modeling / Refined: infrastructure-q8m4t - Support quotation marks (Gänsefüsschen) in prompts

**Type:** Modeling / Refine
**BC:** infrastructure
**Status after:** backlog
**Summary:** Traced the full dashboard→bridge→terminal prompt path; established infra-020 already closed the shell-*parsing* half (ASCII quotes as syntax survive via raw argv) and reframed the residual gap as a separable *encoding* dimension for non-ASCII German typographic quotes `„ " » «` (likely a Windows console codepage / mojibake issue at the `createTerminal` layer, or a stale pre-infra-020 `.vsix`). Rewrote Why/What, made AC reproduction-first, added a doc-drift rider for stale `claude "<prompt>"` comments, and linked related_adrs:[0018] + prior_art:[infrastructure-020]. Kept in backlog — three builder-confirmation questions (where / which quotes / symptom) went unanswered, and the reproduction AC is the promote gate.
**Split into:** none
**ADRs written:** none

## 2026-07-03 00:08 -- Modeling / Refined: agentic-workflow-s7d3k - Single-source the duplicated doctrine into references/ files

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Grounded the task against the actual skill/agent files: confirmed the three duplicated doctrine blocks and their exact definition sites (ID grammar → brainstorm/modeling/quick-capture; commit doctrine → work/modeling/quick-capture/brainstorm; worker `TESTS_*` return format → agents/worker.md + agents/verifier.md + work/SKILL.md). Its sequencing gate is now satisfied (f7k2d done → unblocked). Resolved the path-resolution caveat by reusing the proven repo-root `references/` convention already pointed at by both a skill (modeling→modes.md) and an agent (worker→concept-template.md) — plugin-install resolution ruled out of scope (pre-existing, shared with k5n8f). Scoped as a single relocation task; acceptance criteria sharpened to grep-checkable, no-behavior-change form (must not re-introduce the f7k2d drift). Populated related_adrs [0026, 0028] and prior_art [f7k2d].
**Split into:** none
**ADRs written:** none

## 2026-07-03 00:08 -- Modeling / Refined: agentic-workflow-w7q2m - BC README consolidation — size trigger + human-in-loop consolidation procedure

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Cornered the three "decide during work" forks (builder away — recommended defaults, flagged for revisit): (1) **procedure home** → a new `modeling` **CONSOLIDATE** sub-action (5th verb beside CAPTURE/REFINE/PROMOTE/DISMISS), mirroring how DISMISS/aw-046 added a verb with ADR-0022 falling out; (2) **trigger metric** → a **line-count** threshold (~600 lines), calibrated to the ~25k-token Read cap (this README is ~34.8 tok/line → un-Readable ~718 lines, flag at 600 for headroom), checkable without a tokenizer; (3) **flag mechanism** → a **whats-next advisory line** in its recommended-move section (rides ADR-0027's advisory write; no skill auto-rewrites prose). Framed the family split: cap-and-roll/verbatim (r2c7m, c8j3w) vs. flag-and-consolidate/judgment/in-place (this) — so it needs neither an archive convention nor a k5n8f dependency (`depends_on: []`). Rewrote acceptance criteria to be testable; added related_adrs 0022/0026/0027. **Left in backlog** — a 5th modeling verb is a doctrine change wanting builder sign-off before PROMOTE.
**Split into:** none
**ADRs written:** none (two ADR candidates noted for work: the CONSOLIDATE-verb contract, and a unifying two-disciplines artifact-growth ADR)

---

## 2026-07-03 -- Modeling / Refined: agentic-workflow-z2f7s - Fan-out caps — MAX_PARALLEL as a knob, research cap, global nested-spawn ceiling

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Sharpened the three fan-out surfaces into concrete edits across `work/SKILL.md` + `research/SKILL.md`. Reframed the "global nested-spawn ceiling" from an enforced count (the conductor cannot police spawns inside worker subagent contexts) to a **documented worst-case fan-out budget + mitigation** (low `MAX_PARALLEL` default + prefer-direct-consultation n6r8j). Noted blocker b8x2v is now **done**, so cap values can be data-informed. Kept as one task; linked prior_art b8x2v. Two decisions (scope-as-one, budget-not-ceiling) defaulted while builder away — left in backlog for ratification rather than promoted.
**Split into:** none
**ADRs written:** none

---

## 2026-07-03 00:08 -- Modeling / Refined: agentic-workflow-v3h6p - Eval-harness the verifier — measure its catch rate against planted defects

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Pinned the spike's shape. A fixture is now defined as the verifier's real input tuple (task file, BC README, diff, worker SUCCESS return block, pre-resolved test command, iteration number) + `expected.json` ground truth, under `evals/verifier-catch-rate/fixtures/`. Four design forks resolved on best-judgment defaults (builder away): (1) spawn the real opus-pinned verifier agent, not a scripted reproduction; (2) cover the full 7-check surface, not just the 4 originally listed; (3) score N runs → catch/false-FAIL/variance rates; (4) a catch must cite the check the defect was planted under (lucky catches logged apart). AC rewritten to five concrete criteria; added a right-reason-rate metric. Linked ADR-0031 (verifier opus pin) + prior art j4m6r/g9s3w/f7k2d (all shape the fixture format). depends_on stays empty — j4m6r/ADR-0031 already shipped. Kept in backlog for the builder to ratify the four calls before promote.
**Split into:** none
**ADRs written:** none

---

## 2026-07-03 00:07 -- Modeling / Refined: agentic-workflow-r2c7m - Protocol rotation — cap protocol.md and roll to monthly files

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Settled the four open questions (builder away — recommended defaults, flagged for revisit): (1) rotation is a k5n8f-family deterministic script → added `depends_on: k5n8f` (path resolution + atomic prepend closes the line-4 collision, symmetry with c8j3w); (2) trigger reconciled to cap-triggered / month-named (live cap N≈1,000, roll whole older months to `knowledge/protocol/YYYY-MM.md` verbatim, newest-on-top preserved); (3) a rotation-doctrine ADR is written during work so c8j3w/w7q2m cite a stable decision of record; (4) machine-readable `runs/` JSONL ruled out of scope (belongs with m9w5c). Bidirectional edge added to k5n8f (`blocks: +r2c7m`).
**Split into:** none
**ADRs written:** none yet (rotation-doctrine ADR deferred to work)

---

## 2026-07-03 00:00 -- Modeling / Refined: agentic-workflow-x4t2g - whats-next feeds back into planning

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Scoped x4t2g to the READ edge only (modeling + work consume the whats-next advisory at session start / batch planning). Decided three points: surface the advisory explicitly to the builder (never silent), compute staleness against the newest Work entry in protocol.md, and keep it strictly advisory (no lifecycle gate — ADR-0027/0017 hold). Rewrote acceptance criteria to be testable; now promote-ready, left in backlog for deliberate promotion.
**Split into:** agentic-workflow-v6d4n (the heavier session-end/verify-path vision-conformance check that lived in x4t2g's Notes — an independent sibling, no depends_on edge)
**ADRs written:** none (ADR-0027 already draws the advisory-write boundary; this task only adds consumers)

---

## 2026-07-02 23:59 -- Batch started: [agentic-workflow-f6m2q, design-system-b7n2s]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-f6m2q - Implement per-worker worktree isolation in work's git model, design-system-b7n2s - Hidden and off-viewport dependency presence markers
**Parallel:** yes (2 workers — file-independent across BCs: f6m2q edits skills/work/SKILL.md + .gitignore + an OS junction helper; b7n2s edits the design-system styleguide styles/app + canvas. k5p8w held to next wave — it conflicts with both, same agentic-workflow README as f6m2q and a build-input race with b7n2s's styleguide edits.)

---

## 2026-07-02 19:23 -- Modeling / Promoted: agentic-workflow-k5p8w - Board wiring — resolve hover dependencies and drive the on-card ring for visible targets

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo
**Deps satisfied:** agentic-workflow-d8q3n ✓, design-system-w4t9k ✓ (both completed this session)

---

## 2026-07-02 19:23 -- Modeling / Promoted: agentic-workflow-f6m2q - Implement per-worker worktree isolation in work's git model

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo
**Deps satisfied:** agentic-workflow-k9t3w ✓ (ADR-0032 ratified)

---

## 2026-07-02 19:23 -- Modeling / Promoted: design-system-b7n2s - Hidden and off-viewport dependency presence markers

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo
**Deps satisfied:** design-system-w4t9k ✓ (completed this session)

---

## 2026-07-02 19:10 -- Work session ended

**Type:** Work / Session end
**Duration:** ~14m (first Batch started 18:56 → now)
**Completed:** 2 (first-try PASS: 1, re-dispatched: 1, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** agentic-workflow-d8q3n: 1, design-system-w4t9k: 2
**Commits:** 2 (5a38757 d8q3n; e32e187 w4t9k)
**Carry-over:** none — working tree clean
**Notes:**
- One parallel batch of 2 (file-independent across agentic-workflow + design-system BCs); no cycles, no conflicts, no blocked tasks. Board fully cleared (todo + doing empty).
- d8q3n (server-side `/api/tree` `dependsOn`/`blocks` projection) passed verification first try.
- w4t9k (dependency-relation ring, third ambient signal) FAILED verification iteration 1 — the styleguide source was correct but the worker rebuilt `dashboard/dist/*.css`, violating AC-9 ("dist/ not rebuilt by this task"). Re-dispatched worker reverted dist; iteration 2 PASSED. (The iter-1 verifier also flagged design-system/INDEX.md as a worker violation — a false positive; that was the conductor's own Phase-4 todo→doing bookkeeping.)
- No new ADRs written this session: ADR-0034 (dependency-ring taxonomy) was pre-written during the r9k2p refine (56b325e); the w4t9k worker confirmed the implementation matches it.
- **Concept candidate:** `ambient-motion-taxonomy` — the design-system now carries three quiet ambient loops each keyed to a meaning: doing-pulse (ADR-0014), attention dot (ADR-0029), dependency ring (ADR-0034). Surfaced by the w4t9k worker as converging on 3 artifacts. Left for the builder to decide whether to create a concept page (`references/concept-template.md`); not auto-created.

---

## 2026-07-02 19:09 -- Task verified and completed: design-system-w4t9k - Dependency-highlight ring — a third ambient-motion signal on TicketCard

**Type:** Work / Task completion
**Task:** design-system-w4t9k - Dependency-highlight ring — a third ambient-motion signal on TicketCard
**Summary:** Third ambient-motion signal on `TicketCard` (ADR-0034): a card-perimeter dependency-relation ring — dedicated `--rel-dep` token, `--duration-relation: 2000ms`, `dependencyRingClass`/`TicketCard.dependencyRelation`, direction by line-style (solid waiting-on / dashed holding-up), reduced-motion keeps the ring static, coexists with the doing rail-pulse. `dist/` intentionally not rebuilt (ds-020/021 pattern).
**Duration:** ~13m (dispatch 18:56 → verdict 19:09; one re-dispatch)
**Verification:** PASS (iteration 2)
**Files changed:** 7
**Tests added:** 12
**ADRs written:** none (ADR-0034 pre-written during the r9k2p refine, committed 56b325e)

---

## 2026-07-02 19:06 -- Verification failed: design-system-w4t9k - Dependency-highlight ring — a third ambient-motion signal on TicketCard

**Type:** Work / Verification failure
**Task:** design-system-w4t9k - Dependency-highlight ring — a third ambient-motion signal on TicketCard
**Iteration:** 1 of 3
**Reasons:** `dist/` was rebuilt (dashboard/dist/agentheim.css + colors_and_type.css modified with the source additions) — violates AC-9 "dist/ is NOT rebuilt by this task"; contradicts the task's own Outcome/README "not rebuilt here". (Verifier also flagged design-system/INDEX.md — false positive: that is the conductor's own Phase-4 todo→doing bookkeeping.)
**Iteration hint:** likely-fixable
**Next:** re-dispatched worker

---

## 2026-07-02 19:01 -- Task verified and completed: agentic-workflow-d8q3n - Carry depends_on/blocks through the /api/tree per-task projection

**Type:** Work / Task completion
**Task:** agentic-workflow-d8q3n - Carry depends_on/blocks through the /api/tree per-task projection
**Summary:** `/api/tree`'s per-task projection now carries raw, unresolved `dependsOn`/`blocks` id-string arrays from task frontmatter (loss-tolerant `idList` helper, no server-side resolution or dedupe — ADR-0002 pointers+metadata contract), giving the board the pointer data to resolve dependency edges client-side.
**Duration:** ~5m (dispatch 18:56 → verdict 19:01)
**Verification:** PASS (iteration 1)
**Files changed:** 3
**Tests added:** 7
**ADRs written:** none

---

## 2026-07-02 18:56 -- Batch started: [agentic-workflow-d8q3n, design-system-w4t9k]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-d8q3n - Carry depends_on/blocks through the /api/tree per-task projection, design-system-w4t9k - Dependency-highlight ring — a third ambient-motion signal on TicketCard
**Parallel:** yes (2 workers — file-independent: d8q3n edits dashboard/tree.mjs + test; w4t9k edits design-system styleguide styles/app + writes ADR-0034)

---

## 2026-07-02 18:46 -- Modeling / Promoted: design-system-w4t9k - Dependency-highlight ring — a third ambient-motion signal on TicketCard

**Type:** Modeling / Promote
**BC:** design-system
**From → To:** backlog → todo

---

## 2026-07-02 18:46 -- Modeling / Promoted: agentic-workflow-d8q3n - Carry depends_on/blocks through the /api/tree per-task projection

**Type:** Modeling / Promote
**BC:** agentic-workflow
**From → To:** backlog → todo

---

## 2026-07-02 18:42 -- Modeling / Refined: agentic-workflow-r9k2p - Hover a backlog/todo ticket to highlight its dependencies with a pulsing ring

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog (umbrella)
**Summary:** Refined the under-refined capture against the builder's four settled decisions — **both** directions (`depends_on` solid ring / `blocks` dashed ring), a **dedicated** `--rel-dep` token (direction by line-style, not hue), **backlog/todo** hover trigger, and a rich off-screen behavior (pulse visible targets · mark collapsed BC sections / the Done peek that hide a target · viewport-edge blink for scrolled-off targets, resolving to a normal pulse on scroll-into-view). Decomposed via the orchestrator (architect + tactical-modeler) into an umbrella parent + five children spanning two BCs. The parent's placeholder `design-system-001` gate dependency is superseded by the real ds blockers `design-system-w4t9k`/`b7n2s`.
**Split into:** agentic-workflow-d8q3n (carry depends_on/blocks in /api/tree), design-system-w4t9k (on-card dependency ring — the real styleguide blocker), design-system-b7n2s (hidden & off-viewport presence markers), agentic-workflow-k5p8w (board wiring — resolve + ring visible targets), agentic-workflow-h9v3m (board wiring — collapsed-group markers + off-viewport edge blinks)
**ADRs written:** ADR-0033 (agentic-workflow — ephemeral hover-scoped DOM/viewport observation admissible board-side), ADR-0034 (design-system — dependency ring as a third ambient signal, dedicated token, direction by line-style, static under reduced motion)
**Note:** The task files + both ADRs + the design-system INDEX were committed in `56b325e` mid-refine (scoped to uniquely-owned files) because a concurrent work session (h3z5b) then held the shared agentic-workflow INDEX + this protocol; these two shared-file updates were deferred until that session ended (ADR-0026 scoped-add / concurrency safety) and committed separately.

---

## 2026-07-02 18:33 -- Work session ended

**Type:** Work / Session end
**Duration:** ~5m (first Batch started 18:28 → now)
**Completed:** 2 (first-try PASS: 1, re-dispatched: 0, skipped: 1)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** h3z5b: 1, k9t3w: 1
**Commits:** 3 (1dd3f27 pre-run reconciliation of a prior stranded modeling session; 3aaf08e k9t3w; a368c07 h3z5b)
**Carry-over:** .agentheim/contexts/agentic-workflow/backlog/agentic-workflow-r9k2p-*.md: left behind (owner: concurrent modeling session, in-flight refinement); .agentheim/contexts/agentic-workflow/backlog/agentic-workflow-d8q3n-*.md: left behind (owner: concurrent modeling session, r9k2p split child); .agentheim/contexts/agentic-workflow/backlog/agentic-workflow-h9v3m-*.md: left behind (owner: concurrent modeling session, r9k2p split child); .agentheim/contexts/agentic-workflow/backlog/agentic-workflow-k5p8w-*.md: left behind (owner: concurrent modeling session, r9k2p split child); .agentheim/contexts/design-system/backlog/: left behind (owner: concurrent modeling session, new BC backlog dir); .agentheim/knowledge/decisions/0033-*.md: left behind (owner: concurrent modeling session, ADR); .agentheim/knowledge/decisions/0034-*.md: left behind (owner: concurrent modeling session, ADR)
**Notes:**
- Started dirty: the working tree carried a *prior* completed-but-uncommitted modeling session (p4v9t/c8j3w/h3z5b refinement entries in INDEX/protocol + backlog files). Per user decision, reconciled it into one scoped commit (1dd3f27) before dispatching, giving a clean base.
- A **second, live** modeling session ran concurrently *during* this batch (refining r9k2p into the pulsing-ring dependency feature — d8q3n/h9v3m/k5p8w + ADR-0033/0034 + a design-system backlog dir) and even committed 0feeb82 mid-run. Its in-flight files are left untouched (scoped adds protected them); they are this session's carry-over, owned by that live session — not orphans to reconcile.
- Cleared the whole todo board (2 tasks). k9t3w ratified ADR-0032 (worktree isolation) proposed → accepted with a substantive ratification note; h3z5b renamed the work loop's "orchestrator" → "conductor" (grep-clean) and defined the term in both ubiquitous-language sections.
- Concept candidates: none this run.

---

## 2026-07-02 18:32 -- Task verified and completed: agentic-workflow-h3z5b - Resolve the two-orchestrators naming ambiguity

**Type:** Work / Task completion
**Task:** agentic-workflow-h3z5b - Resolve the two-orchestrators naming ambiguity
**Summary:** Renamed the `work` skill's driving-loop sense of "orchestrator" → **conductor** throughout `skills/work/SKILL.md` (all loop-sense refs incl. the "Git authority" / "Index updates" headings; grep-clean, 0 remain), and defined **conductor** distinct from the `orchestrator` agent in both ubiquitous-language sections (vision.md seed + agentic-workflow BC README). Prose-only; no agent-spawn identifier or file reference changed.
**Duration:** ~4m (dispatch 18:28 → verdict 18:32)
**Verification:** PASS (iteration 1)
**Files changed:** 3
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-02 18:31 -- Task completed (verification skipped): agentic-workflow-k9t3w - Ratify ADR-0032 — per-worker git worktree isolation model

**Type:** Work / Task completion
**Task:** agentic-workflow-k9t3w - Ratify ADR-0032 — per-worker git worktree isolation model
**Summary:** Ratified ADR-0032 (proposed → accepted): confirmed the batch-start claim commit is the single ADR-0026 amendment, every other ADR-0026 clause and ADR-0007's mover boundary + worker-never-runs-git survive intact; recorded a non-blocking observation that the trivial-squash carve-out is unaddressed (not precluded) by the new flow.
**Duration:** ~3m (dispatch 18:28 → SUCCESS 18:31)
**Verification:** SKIPPED — decision-only task (FILES_CHANGED == 1, single file is the ADR)
**Files changed:** 1

---

## 2026-07-02 18:28 -- Batch started: [agentic-workflow-h3z5b, agentic-workflow-k9t3w]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-h3z5b - Resolve the two-orchestrators naming ambiguity, agentic-workflow-k9t3w - Ratify ADR-0032 — per-worker git worktree isolation model
**Parallel:** yes (2 workers — file-independent: h3z5b edits work/SKILL.md + vision.md + BC README; k9t3w edits ADR-0032 only)

---

## 2026-07-02 -- Modeling / Refined: agentic-workflow-p4v9t - Worktree isolation per worker

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** split — parent retired
**Summary:** Ran the archaeology the task flagged: 0/5 historical verification failures were cross-task contamination (all own-work defects), ~14% of batches (16/98) ever ran parallel. Re-anchored the Why on a forward-looking structural/scaling bet (git as the real conflict detector; let MAX_PARALLEL rise) rather than contamination. Architect designed the full worktree git model; split the parent into a decision task (ratify the ADR) + an implementation task (rewrite work's git model), and wrote ADR-0032.
**Split into:** agentic-workflow-k9t3w (ratify ADR-0032, → todo), agentic-workflow-f6m2q (implement, → backlog, depends_on k9t3w)
**ADRs written:** ADR-0032 (scope: agentic-workflow, proposed — amends ADR-0026 with a batch-start claim commit)

---

## 2026-07-02 18:16 -- Modeling / Refined: agentic-workflow-c8j3w - INDEX done-list rotation

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Split the "Compaction policy for BC READMEs and the growing INDEX files" capture into two tasks — the two growth surfaces have different mechanisms (verbatim rotation vs. prose consolidation), owners (script vs. human-in-loop), and risk profiles. c8j3w now scopes to INDEX done-list rotation only: cap at N recent entries, roll older verbatim to a dated archive, with the load-bearing constraint that prior-art lookup + search corpus must still reach archived done tasks. Set depends_on: [k5n8f, r2c7m] (belongs to the lifecycle-script family; mirrors r2c7m's archive convention). No ADR — applies r2c7m's rotation decision to the INDEX artifact.
**Split into:** agentic-workflow-w7q2m (BC README consolidation — size trigger + human-in-loop procedure)
**ADRs written:** none

---

## 2026-07-02 18:15 -- Modeling / Refined: agentic-workflow-h3z5b - Resolve the two-orchestrators naming ambiguity

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** todo
**Summary:** Scoped the rename by scanning every "orchestrator" use across `skills/`. Found `work/SKILL.md` is the *only* file conflating the name (all ~14 refs mean the driving loop); every other file already uses it correctly for the agent. Fixed the term (loop → **conductor**, agent keeps "orchestrator" — already the audit doc's term), tightened the acceptance criteria to that scope, corrected the inaccurate "same files as n6r8j" coordination note (they're file-independent, no `depends_on`), and promoted to todo. No ADR (vocabulary hygiene, not a decision).
**Split into:** —
**ADRs written:** —

---

## 2026-07-02 18:12 -- Modeling / Captured: agentic-workflow-r9k2p - Hover a backlog/todo ticket to highlight its dependencies with a pulsing ring

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Dashboard board interaction — hovering a backlog/todo card pulses a ring around the card(s) it depends_on. Captured under-refined; anticipated three-way split (carry depends_on in the /api/tree projection · a new design-system pulsing-ring ambient cue on TicketCard · the board hover→dependency wiring). Read-only presentation, must dodge the reserved ochre accent (ADR-0016) and honor the reduced-motion strip (ADR-0014/0029).

---

## 2026-07-02 17:58 -- Work session ended

**Type:** Work / Session end
**Duration:** ~30m (first Batch started 17:28 → now)
**Completed:** 7 (first-try PASS: 7, re-dispatched: 0, skipped: 0)
**Bounced:** 0
**Failed:** 0
**Escalated after verification:** 0
**Dispatches:** f7k2d: 1, w3p8n: 1, e5t9c: 1, b8x2v: 1, j4m6r: 1, d6q4h: 1, g9s3w: 1
**Commits:** 7 (one per task)
**Carry-over:** none — working tree clean
**Notes:**
- Cleared the entire 2026-07-02 harness-audit todo set (6 agentic-workflow + 1 infrastructure). Dispatched in 4 waves to respect the shared-file constraint on `skills/work/SKILL.md` (four tasks touched it) and the `agents/verifier.md` overlap between g9s3w and j4m6r.
- One global ADR written: ADR-0031 (per-agent model routing), inserted into the global index and back-linked to j4m6r.
- **Orchestrator git correction (surfaced, not a task failure):** the f7k2d/w3p8n/e5t9c batch-1 commits were first built with `git commit` (no pathspec), which swept the e5t9c worker's pre-staged `git mv` renames into f7k2d's commit. Detected immediately, `git reset --mixed` to before the batch, and rebuilt all three with explicit scoped `git add` so each task's code landed in its own commit. Lesson for future runs: when a worker pre-stages via `git mv`, either `git commit -- <paths>` or reset-and-rebuild — a bare `git commit` is not scoped by the preceding `git add`.
- Concept candidates: none this run.

---

## 2026-07-02 17:57 -- Task verified and completed: agentic-workflow-g9s3w - Pre-load the test command into the verifier spawn prompt

**Type:** Work / Task completion
**Task:** agentic-workflow-g9s3w - Pre-load the test command into the verifier spawn prompt
**Summary:** `work` now resolves the test command once per batch (per BC) and pre-loads it into every verifier spawn via a new `## Pre-resolved test command` block; verifier check 2 uses the supplied command first, its own discovery only as fallback, preserving fail-closed and reusing the command across re-dispatch iterations.
**Duration:** ~2m (dispatch 17:55 → verdict 17:57)
**Verification:** PASS (iteration 1)
**Files changed:** 2
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-02 17:55 -- Batch started: [agentic-workflow-g9s3w]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-g9s3w - Pre-load the test command into the verifier spawn prompt
**Parallel:** no (1 worker — serialized behind d6q4h on skills/work/SKILL.md)

---

## 2026-07-02 17:54 -- Task verified and completed: agentic-workflow-d6q4h - Work session-end reconciliation of stranded working-tree carry-over

**Type:** Work / Task completion
**Task:** agentic-workflow-d6q4h - Work session-end reconciliation of stranded working-tree carry-over
**Summary:** Added an end-of-run step 5 + "Reconciling stranded working-tree carry-over" section to work/SKILL.md: detect via `git status --porcelain`, surface each stranded tracked-modified/untracked file to the user for an explicit per-file disposition (deliberate scoped commit, or leave-behind with a named owner), ask-don't-assume for concurrency safety, and record dispositions in the session-end entry's new **Carry-over:** line. Scoped-add rule unchanged. BC README updated.
**Duration:** ~3m (dispatch 17:51 → verdict 17:54)
**Verification:** PASS (iteration 1)
**Files changed:** 2
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-02 17:51 -- Batch started: [agentic-workflow-d6q4h]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-d6q4h - Work session-end reconciliation of stranded working-tree carry-over
**Parallel:** no (1 worker — serialized behind g9s3w on skills/work/SKILL.md)

---

## 2026-07-02 17:49 -- Task verified and completed: agentic-workflow-j4m6r - Pin model frontmatter on the eight agents

**Type:** Work / Task completion
**Task:** agentic-workflow-j4m6r - Pin model frontmatter on the eight agents
**Summary:** Pinned a `model:` tier on all eight agents (worker/researcher/orchestrator → sonnet; verifier/research-reviewer/architect/strategic-modeler/tactical-modeler → opus), decorrelating both producer→gate adversarial pairs across tiers and dropping the high-volume executor to mid-tier behind its opus judge. Recorded as global ADR-0031; updated the research-review doctrine's former "pins no model" admission.
**Duration:** ~7m (dispatch 17:42 → verdict 17:49)
**Verification:** PASS (iteration 1)
**Files changed:** 10
**Tests added:** 0
**ADRs written:** ADR-0031 (global)

---

## 2026-07-02 17:48 -- Task verified and completed: agentic-workflow-b8x2v - Work protocol entries carry Duration and verification Iterations

**Type:** Work / Task completion
**Task:** agentic-workflow-b8x2v - Work protocol entries carry Duration and verification Iterations
**Summary:** Added an "Observability fields — measure, never fabricate" section to work/SKILL.md and extended the protocol-entry templates: Duration (orchestrator-clock wall time) on task-completion and session-end entries, a mandatory verification-iteration count, and a per-task dispatch/re-dispatch tally; token cost explicitly declined as unmeasurable.
**Duration:** ~6m (dispatch 17:42 → verdict 17:48)
**Verification:** PASS (iteration 1)
**Files changed:** 1
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-02 17:42 -- Batch started: [agentic-workflow-b8x2v, agentic-workflow-j4m6r]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-b8x2v - Protocol entries carry Duration and verification Iterations, agentic-workflow-j4m6r - Pin model frontmatter on the eight agents
**Parallel:** yes (2 workers)

---

## 2026-07-02 17:37 -- Task verified and completed: infrastructure-e5t9c - Relocate capture-workspace eval debris

**Type:** Work / Task completion
**Task:** infrastructure-e5t9c - Relocate skills/capture-workspace eval debris out of the plugin payload
**Summary:** Moved the skill-creator eval workspace (fixture clone, grading script, iteration runs, ~89 KB review HTML — 209 files) from skills/capture-workspace/ to evals/capture-workspace/, repointed write_grades.py's hardcoded IT path, and confirmed no live manifest/discovery reference to the old path. skills/ now holds only real loadable skills.
**Verification:** PASS (iteration 1)
**Files changed:** 209 renames + 1 path fix
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-02 17:36 -- Task verified and completed: agentic-workflow-w3p8n - Fix stale README drag-to-promote claim

**Type:** Work / Task completion
**Task:** agentic-workflow-w3p8n - Fix stale README drag-to-promote claim
**Summary:** Corrected the root README Dashboard section — the board is fully read-only (ADR-0017); its action buttons fire bridge-launched Claude sessions (ADR-0018) with clipboard fallback. Removed the stale "one write-back is dragging a card backlog→todo" claim.
**Verification:** PASS (iteration 1)
**Files changed:** 1
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-02 17:35 -- Task verified and completed: agentic-workflow-f7k2d - Fix TESTS_* return-format drift

**Type:** Work / Task completion
**Task:** agentic-workflow-f7k2d - Fix TESTS_* return-format drift
**Summary:** Added TESTS_ADDED / TESTS_PASSING / TDD_SKIPPED to the worker SUCCESS return-block template in work/SKILL.md, byte-for-byte from agents/worker.md, so the verifier's test-execution gate and the protocol "Tests added" field finally have a real source.
**Verification:** PASS (iteration 1)
**Files changed:** 1
**Tests added:** 0
**ADRs written:** none

---

## 2026-07-02 17:28 -- Batch started: [agentic-workflow-f7k2d, agentic-workflow-w3p8n, infrastructure-e5t9c]

**Type:** Work / Batch start
**Tasks:** agentic-workflow-f7k2d - Fix TESTS_* return-format drift, agentic-workflow-w3p8n - Fix stale README drag-to-promote claim, infrastructure-e5t9c - Relocate capture-workspace eval debris
**Parallel:** yes (3 workers)

---

## 2026-07-02 -- Modeling / Refined: agentic-workflow-p4v9t - Worktree isolation per worker

**Type:** Modeling / Refine
**BC:** agentic-workflow
**Status after:** backlog
**Summary:** Appended the audit's uncertainty-section validation step to the Notes: run `git log --grep 'Verification failed'` archaeology on a consumer project during refinement to measure how often verifier contamination actually bites, so the task's priority rests on data rather than structural inference.

---

## 2026-07-02 -- Modeling / Captured: agentic-workflow-c8j3w - Compaction policy for BC READMEs and the growing INDEX files

**Type:** Modeling / Capture
**BC:** agentic-workflow
**Filed to:** backlog
**Summary:** Follow-up review of the 2026-07-02 harness audit against the captured batch found one gap-table finding that never made it into a task: no compaction policy for BC READMEs or the growing INDEX done-lists (the one named hole in the otherwise-good context/memory row). Sibling of protocol rotation (r2c7m), candidate for the k5n8f script family.

---

## 2026-07-02 -- Modeling / Captured (batch): 18 tasks from the 2026-07-02 harness self-audit

**Type:** Modeling / Capture
**BC:** agentic-workflow (17), infrastructure (1)
**Filed to:** todo (7), backlog (11)
**Summary:** Batch capture of every actionable finding in
`knowledge/harness-audit-2026-07-02-Fable.md` (cross-checked against the Opus
audit). Concrete, already-refined items went straight to todo; items needing a
design decision went to backlog.
**Todo:** agentic-workflow-f7k2d (TESTS_* return-format drift, bug) ·
agentic-workflow-w3p8n (stale README drag claim, bug) ·
agentic-workflow-j4m6r (pin model frontmatter on the 8 agents) ·
agentic-workflow-b8x2v (protocol Duration/Iterations) ·
agentic-workflow-d6q4h (session-end carry-over reconciliation) ·
agentic-workflow-g9s3w (pre-load test command into verifier) ·
infrastructure-e5t9c (relocate capture-workspace eval debris)
**Backlog:** agentic-workflow-k5n8f (mechanize bookkeeping / wire
lib/task-lifecycle.mjs — the audit's highest-leverage change) ·
agentic-workflow-p4v9t (worktree isolation per worker) ·
agentic-workflow-s7d3k (single-source duplicated doctrine) ·
agentic-workflow-r2c7m (protocol rotation) ·
agentic-workflow-v3h6p (eval-harness the verifier, spike) ·
agentic-workflow-y8b4q (end-to-end verification for runtime surfaces) ·
agentic-workflow-z2f7s (fan-out caps + spawn ceiling) ·
agentic-workflow-m9w5c (live observability hooks + dashboard in-flight lane) ·
agentic-workflow-x4t2g (whats-next feeds back into planning) ·
agentic-workflow-n6r8j (flatten single-specialist consultation) ·
agentic-workflow-h3z5b (resolve two-orchestrators naming)

---

