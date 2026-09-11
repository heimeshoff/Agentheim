---
id: agentic-workflow-044
title: Remove the temporary "Replay celebration" button
status: done
type: chore
context: agentic-workflow
created: 2026-06-16
completed: 2026-06-16
commit: c3b77a4
depends_on: []
blocks: []
tags: [dashboard, frontend, temporary, cleanup]
related_adrs: [ADR-0020]
related_research: []
prior_art: [agentic-workflow-025]
---

## Why
The "🎉 Replay celebration" button was added by agentic-workflow-025 as **explicitly
temporary** scaffolding — a replay-on-demand trigger so the confetti burst could be
watched and tuned over many iterations without launching a session. The animation has
since been iterated (aw-034 canvas-confetti, aw-042 realistic multi-fire preset) and
the builder is satisfied, so the throwaway trigger has served its purpose and should
be deleted. aw-025 designed it to be removable in one contiguous deletion precisely
for this moment.

## What
Remove the temporary button from `BoardPromptBar` in `dashboard/app/board.js`. It lives
in a single, clearly-fenced `// TEMP (aw-025): …` … `// END TEMP (aw-025)` block
(around `board.js:543–561`), so removal is deleting that one contiguous block.

The deletion must leave the real confetti machinery intact: `BoardConfetti`,
`ensureConfettiStyle` (or the canvas-confetti wiring), the `confettiKey` state and its
**legitimate** caller (the successful-launch/landed-copy path in `onResult`), the
status-palette tokens, and the reduced-motion guard all stay. Only the second,
unconditional `setConfettiKey` caller — the temp button — goes away. After removal the
confetti still fires on a successful launch or clipboard copy exactly as before.

The aw-025 test guards in `dashboard/test/board-prompt-bar.test.mjs` assert the temp
block **exists**; those guards must be removed (or inverted) so the suite reflects the
button's removal rather than failing on it.

This is a pure removal — it adds no UI, touches no styleguide source (ADR-0003 stays
satisfied), files no design-system child task, and makes no architectural decision, so
**no ADR** and **no styleguide gate** (nothing new to conform).

## Acceptance criteria
- [ ] The `TEMP (aw-025)` … `END TEMP (aw-025)` block is deleted from `BoardPromptBar`
      in `dashboard/app/board.js`; no "Replay celebration" button renders on the board.
- [ ] The confetti still fires on a **successful launch / landed clipboard copy** —
      `BoardConfetti`, `confettiKey`, and its legitimate `onResult` caller are unchanged.
- [ ] The aw-025 "temp block exists" guards in
      `dashboard/test/board-prompt-bar.test.mjs` are removed (or inverted to assert the
      block is gone), so they no longer reference the deleted block.
- [ ] No other behaviour changes — no styleguide edit, no design-system child task, no
      ADR, no lifecycle write.
- [ ] The dashboard app is rebuilt (`dashboard/dist/app.js` / `index.html`) so the
      static handler serves the change, and the full dashboard test suite stays green.

## Notes
Captured via `modeling` on 2026-06-16. This is the planned teardown of aw-025's
throwaway scaffold — see that task's "Removal-friendliness (it's throwaway)" section.

- Current location: `dashboard/app/board.js:543–561` (the `🎉 Replay celebration`
  `<button>` inside the TEMP fence). Built artifact mirror at `dashboard/dist/app.js`
  (rebuild rather than hand-edit).
- The BC README's confetti paragraph still refers to "the open aw-025 replay-loop dial"
  as the tuning surface (README "Board prompt bar" / confetti section). With the button
  removed, the worker may want to drop that clause from this BC's README so it doesn't
  point at a control that no longer exists.
</content>
</invoke>

## Outcome
Removed the throwaway aw-025 "🎉 Replay celebration" scaffold from the board. The single
contiguous `// TEMP (aw-025)` … `// END TEMP (aw-025)` fence in `BoardPromptBar`
(`dashboard/app/board.js`) was deleted, taking the dashed temporary button and its
unconditional `setConfettiKey` caller with it. The real confetti machinery is untouched:
`BoardConfetti` still mounts off `confettiKey`, and its sole legitimate caller — the
successful-launch / landed-clipboard-copy path inside `onResult` (`board.js`) — still
fires the burst exactly as before. The two aw-025 "temp block exists" guards in
`dashboard/test/board-prompt-bar.test.mjs` were inverted into aw-044 guards that assert
the block is gone while `BoardConfetti`/`confettiKey` survive. The BC README confetti
paragraph's stale "open aw-025 replay-loop dial" clause was dropped. Bundle rebuilt
(`dist/app.js` confirmed free of the button); full dashboard suite green at 393.

Key files:
- dashboard/app/board.js — TEMP (aw-025) fence deleted from BoardPromptBar
- dashboard/test/board-prompt-bar.test.mjs — aw-025 guards inverted to aw-044 removal guards
- dashboard/dist/app.js, dashboard/dist/index.html — rebuilt artifacts
- .agentheim/contexts/agentic-workflow/README.md — dropped stale replay-loop clause
