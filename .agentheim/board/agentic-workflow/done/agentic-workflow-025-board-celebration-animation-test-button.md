---
id: agentic-workflow-025
title: Add a temporary board button that fires the celebration animation
status: done
type: feature
context: agentic-workflow
created: 2026-06-15
completed: 2026-06-15
commit: 8694491
depends_on: [design-system-001]
blocks: []
tags: [dashboard, frontend, temporary]
related_adrs: [ADR-0020, ADR-0014, ADR-0003]
related_research: []
prior_art: [agentic-workflow-023]
---

## Why
The celebration animation — the board-local **confetti burst** (`BoardConfetti` /
`ensureConfettiStyle` in `dashboard/app/board.js`, ADR-0020, introduced by aw-023) —
today only fires as a side-effect of a *successful* launch or landed clipboard copy
in the board prompt bar. That makes it slow and awkward to iterate on: to see one
burst you have to author a prompt and actually launch a session. The builder wants a
**replay-on-demand** trigger so the animation can be watched and improved over many
iterations until it's satisfactory. The button is **temporary** scaffolding and will
be deleted once the animation is good enough.

## What
Add a **temporary test button** to the board **prompt bar** (`BoardPromptBar`),
rendered beside the existing **Quick Capture** / **Modeling** launch buttons — the
same row over which the confetti already renders. Clicking it **replays the confetti
burst** and does nothing else.

Mechanically this reuses the existing wiring unchanged: the button bumps the
`confettiKey` state (`setConfettiKey((k) => k + 1)`) that already drives
`BoardConfetti`'s remount. It must **not**:
- launch a session, hit the bridge, or copy to the clipboard,
- clear the textarea (only a real successful action does that),
- write any lifecycle state — the board stays a projection of disk (ADR-0001).

The button is a **board-local, token-matched** control (the board-control precedent:
the sort `<select>`, the group toggle, the prompt textarea) consumed **unforked**
(ADR-0003) — **no** new design-system primitive and **no** design-system child task.
`BoardConfetti`, `ensureConfettiStyle`, the keyframes, the status-palette token set,
and the reduced-motion guard are all reused **exactly as they are** — this task adds
a trigger, it does not touch the animation itself (improving the animation is the
follow-on iteration this button enables, not part of this task).

It reopens no doctrine: it replays ADR-0020's existing confetti, adds no new motion
vocabulary, and makes no architectural decision — **no ADR**.

### Removal-friendliness (it's throwaway)
Because the button will be removed later, it must be trivially deletable: confine it
to a **single, clearly-commented fenced block** inside `BoardPromptBar` (a
`// TEMP (aw-025): …` / `// END TEMP` comment pair, or equivalent), so removal is
deleting one contiguous block with no other edits. Give it a distinct, obviously-temporary
label (e.g. `🎉 Test` / "Replay celebration") so it never reads as a permanent feature.

## Acceptance criteria
- [ ] A temporary button appears in the board prompt bar (`BoardPromptBar`), in the
      same button row as Quick Capture / Modeling, on the board view.
- [ ] Clicking it replays the confetti burst by bumping the existing `confettiKey`
      (reusing `BoardConfetti` and `ensureConfettiStyle` unchanged).
- [ ] Clicking it performs **no** launch, **no** bridge call, **no** clipboard copy,
      **no** textarea clear, and **no** lifecycle write.
- [ ] Under `prefers-reduced-motion: reduce` the button still renders, but firing it
      shows nothing — `BoardConfetti`'s `matchMedia` guard already strips to silence
      (ADR-0014's strip-to-plain contract). This is acceptable, not a defect.
- [ ] The animation code (`BoardConfetti`, `ensureConfettiStyle`, keyframes, palette
      tokens, reduced-motion guard) is unchanged — only a trigger is added.
- [ ] The styleguide source is untouched: the button is a board-local token-matched
      control, consumed unforked (ADR-0003); no design-system child task is filed.
- [ ] The button is confined to a single clearly-commented temporary block so it can
      be removed in one deletion.
- [ ] The dashboard app is rebuilt (`dashboard/dist/`) so the static handler serves
      the change, and the existing dashboard test suite stays green.

## Notes
Captured via `quick-capture` on 2026-06-15, refined 2026-06-15. Builder confirmed the
"celebration animation" is the prompt-bar confetti (ADR-0020) and chose the prompt-bar
placement (beside the existing buttons, where the confetti already renders) over a
topbar or floating button — it reuses `BoardConfetti` with zero re-homing.

- The current trigger path: `BoardPromptBar` owns `const [confettiKey, setConfettiKey]
  = useState(0)`; its `onResult` callback bumps the key only on a successful launch/copy.
  The temp button shares that exact state — a second, unconditional caller of
  `setConfettiKey`.
- No `pt` estimate (the board dropped the estimate chip; this BC doesn't size tasks).
- This button is the deliberate, explicit scaffold that makes ADR-0020's "promote a
  shared celebration-motion primitive once a *second* surface needs it" decision
  cheaper to reach later — but this task adds no second *surface*, only a replay
  trigger for the one existing surface, so it does **not** itself trip that promotion.

## Outcome
Added a temporary "🎉 Replay celebration" button to `BoardPromptBar` in
`dashboard/app/board.js`, in the same button row as Quick Capture / Modeling (where
`BoardConfetti` already renders). Its `onClick` is a second, unconditional caller of the
existing `setConfettiKey((k) => k + 1)` — it reuses `BoardConfetti` / `ensureConfettiStyle`
/ the keyframes / the status-palette tokens / the reduced-motion guard **unchanged**, and
performs no launch, no bridge call, no clipboard copy, no textarea clear, and no lifecycle
write. Under `prefers-reduced-motion: reduce` the burst stays silent (ADR-0014) — accepted.

The control is throwaway scaffolding: it is confined to a single fenced
`TEMP (aw-025)` … `END TEMP (aw-025)` block inside `BoardPromptBar`, removable in one
contiguous deletion. It is a board-local token-matched `<button>` (dashed border to read
as obviously temporary), consumed unforked (ADR-0003) — no styleguide edit, no
design-system child task, no ADR.

Static board-glue guards added to `dashboard/test/board-prompt-bar.test.mjs` (the temp
block exists; it bumps `confettiKey` via the existing setter; it does not launch / copy /
clear). Bundle rebuilt (`dashboard/dist/app.js` carries the button). Full dashboard suite
287/287 green.

Key files:
- `dashboard/app/board.js` — `BoardPromptBar` TEMP (aw-025) block
- `dashboard/test/board-prompt-bar.test.mjs` — two new guards
- `dashboard/dist/app.js`, `dashboard/dist/index.html` (rebuilt artifacts)
