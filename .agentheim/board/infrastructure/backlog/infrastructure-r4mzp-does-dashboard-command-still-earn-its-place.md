---
id: infrastructure-r4mzp
title: Does `/dashboard` still earn its place as a slash command, now that launching the dashboard costs ~120k tokens across two turns while a shell invocation costs zero?
status: backlog
type: decision
context: infrastructure
created: 2026-09-11
completed:
depends_on: []
blocks: []
tags: [dashboard, commands, context-budget, surface]
related_adrs: [0002]
related_research: []
prior_art: [infrastructure-008, infrastructure-010]
---

## Why

`commands/dashboard.md` opens by calling itself "a deliberate, documented
slash-command exception to Agentheim's phrasing-not-slash-commands principle:
the dashboard is a process-launcher, not a Socratic dialogue, so a literal
command is the right surface."

That argument justified a *slash command over a phrasing*. It never examined the
third option — **no model in the loop at all**. Launching through the agent costs
two full-context turns (~120k input tokens billed, measured — see
infrastructure-k9t2v's Notes) to run a script that returns in milliseconds when
invoked directly. The model contributes nothing to the launch: it reads a verb,
pastes a fixed string, and reads back two lines of output.

The builder raised this after watching a launch cost 60k.

## What

Decide the disposition of `/dashboard` and record it as an ADR. The load-bearing
asymmetry to resolve:

- **In the Agentheim repo**, the builder already has personal
  `agentheim-dashboard` scripts in `~/.local/bin`. Zero tokens. This is why
  "starting the script by hand runs immediately."
- **In a consumer install**, those scripts do not exist — they are personal, not
  shipped, and an in-project shim variant was deliberately tried and reverted.
  For a consumer, `/dashboard` is currently the *only* surface there is.

So the honest question is not "command or CLI" but "what does the plugin ship to
a consumer, and does the repo-local case deserve a cheaper path alongside it?"

Candidate dispositions (not exhaustive — the decision is the deliverable):

1. **Keep as-is.** The command is a consumer's only entry point; the cost is
   paid once per session and is mostly session baseline anyway.
2. **Keep, and document the cheap path.** Command stays for consumers; the
   README names a shell alias / npm script for anyone working in a repo, so the
   expensive route stops being the default for daily use.
3. **Ship a real CLI and demote the command to a pointer.** Revisit *why* the
   in-project shim was reverted before proposing this — that reversal was
   deliberate and its reasoning has to be answered, not ignored.
4. **Retire the command.** Only viable if consumers get a shipped alternative.

## Acceptance criteria

- [ ] An ADR in `.agentheim/knowledge/decisions/` records the disposition and its reasoning, and is linked from this task and from ADR-0002.
- [ ] The ADR states explicitly what launch surface a **consumer install** has, separately from what the Agentheim repo has — the two cases must not be collapsed.
- [ ] The ADR engages with the reverted in-project shim: why it was reverted, and whether that reasoning still holds.
- [ ] The ADR carries the measured token cost (infrastructure-k9t2v's Notes table) as its evidence base, not a remembered figure.
- [ ] If the disposition is anything other than "keep as-is", a follow-up task exists implementing it.

## Notes

Deliberately **not** blocked on infrastructure-k9t2v, and does not block it: the
slim-down is worth having whether or not the command survives, and it is cheap
enough that losing it to a retirement decision costs little.

Open question this needs the builder for: is the `~/.local/bin` script path
something other Agentheim users should get, or is it a personal convenience that
should stay personal? That answer largely picks between dispositions 2 and 3.
