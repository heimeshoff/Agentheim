---
description: Pointer to the zero-token dashboard CLI. Run `/setup` once per machine, then use `agentheim-dashboard` directly from a shell.
argument-hint: ""
---

# /dashboard — pointer only

`/dashboard` no longer launches anything itself (ADR-0079 §3: launching the
dashboard through a slash command cost two full-context model turns per
invocation to run a script that returns in milliseconds from a shell).

Say exactly this, and take no other action — no Bash tool call, no attempt to
launch, stop, or check status yourself:

> Run `agentheim-dashboard` (or `agentheim-dashboard stop` / `agentheim-dashboard status`) directly from a terminal. If that command isn't found, run `/setup` once to install it.
