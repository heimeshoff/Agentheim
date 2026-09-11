---
name: inquire
description: Answer a question about the codebase of an Agentheim-managed project — how a feature works, where something lives, what was decided and why, or whether something is built yet — by reading the project's own structure (the index, the bounded-context READMEs, the ADRs, the task boards) and verifying against the actual source. Read-only. Invoke it directly when you want a thorough, code-grounded answer that separates what's decided from what's actually implemented.
---

# Inquire — Answer a Codebase Question from the Agentheim Structure

Answer a question about the project's code the way someone who built it would — by using the project's own memory instead of searching the repo cold, then confirming what that memory says against the source.

An Agentheim project documents itself: a pointer **index**, a **README per bounded context** recording what each context does and in what language, **ADRs** capturing each real decision with its rationale and status, **research** reports, and **task boards** showing what's done versus planned. Read those to orient, then verify the load-bearing parts in the code. That's faster than a blind search and more trustworthy, because you can tell shipped behaviour from intention and you cite real decisions and real files.

**This skill is read-only.** It reads `.agentheim/` and the source and produces an answer — it never edits code, moves a task, writes to the protocol, or commits.

## The method

0. If `.agentheim/contexts/` exists the tree has not been migrated; run any writing skill first (ADR-0078 §4) — `inquire` never runs `migrate` itself (it is read-only).
1. **Orient on the pointer layer (cheap).** Read `.agentheim/knowledge/index.md` to find the relevant bounded context(s), then that BC's `README.md` and the ADRs/tasks it cites. This usually gives you the shape of the answer and names the exact source files to check. Skim `vision.md` only for framing (open questions, non-goals).
2. **Verify against the code.** Open the specific files the README/ADR point at and confirm the load-bearing claims actually hold. The READMEs are dense and usually accurate, but they're documentation — when prose and code disagree, the code wins, and that gap is often the most valuable thing in your answer.
3. **Place it on the lifecycle.** `done/` = shipped, `todo/`/`backlog/` = planned, `doing/` = in flight; an ADR is `accepted`, `proposed`, or `superseded`. State which.

**Be proportional.** Investigate just enough to answer correctly and ground your claims — the BC README plus the handful of files it points at is almost always enough. Don't read the whole tree or fan out a swarm of searches; the structure exists precisely so you don't have to. If `.agentheim/` is missing or thin, say so, read the code directly, and note the answer isn't backed by the usual decision record.

## Two distinctions to get right

- **Decided/planned vs. implemented.** An `accepted` ADR documented in a README with a `done/` task and code that exists is *implemented*. A `proposed` ADR, a `todo/`/`backlog/` task, or a vision open question is *intended but not built*. Never present the second as the first; when something is half-built, say where on that line it sits.
- **Docs vs. code.** For any claim the user will act on, confirm it in the source rather than trusting the prose alone.

## Answering

- **Lead with the direct answer** — one or two sentences that actually answer the question (including "that isn't built yet" or "the README says X but the code does Y" when that's the truth).
- **Substantiate it** — cite the ADR by number, the BC README, and the real source as `path:line`, with enough mechanism that the user could find it themselves.
- **Mark the status** when the thing is partial, planned, or decided-but-not-built.
- **Flag gaps and caveats** — docs-vs-code mismatches, a `proposed` ADR that hasn't landed, anything you had to assume.
- **Point to where to look next** — the key file(s) and the governing ADR.

Write prose by default; match the length to the question. Tone: a colleague who built the thing — confident where the evidence is solid, candid where it isn't, never bluffing.

## Examples

**A "what did we decide / is it built" question:**

> Rate limiting isn't live — it's decided but not built. ADR-0002 specifies a per-IP token bucket, but it's marked `proposed`, the task (`shortener-003`) is still in `todo/`, and `src/server.js` has no throttling path at all (its `POST /shorten` branch always returns 200). So: designed, not implemented — the next step would be working `shortener-003`.

**A docs-vs-code gap (the high-value case):**

> Two URLs can't get the same code, but not for the reason the README gives. The README claims each code is "checked against the store before insert... regenerated on collision" — that check doesn't exist. `src/store.js` `insert()` is a plain `map.set` with no guard. Uniqueness actually comes from the monotonic counter (ADR-0001): every code is fresh by construction, so a check would be dead code. Worth knowing the README is stale here, and that `insert()` would silently overwrite if a duplicate code were ever passed in.
