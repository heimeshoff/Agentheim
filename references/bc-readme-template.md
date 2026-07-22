# Bounded context README template

Every `.agentheim/contexts/<bc-name>/README.md` uses this shape. It's the home of the BC's ubiquitous language and the first thing any specialist or worker reads before touching the BC.

````markdown
# [Context name]

## Purpose
One or two sentences. What happens inside this context that does not happen elsewhere.

## Classification
core | supporting | generic

Brief note on why. If the classification changes, update this and write an ADR.

## Actors
Who interacts with this context and in what role.

## Ubiquitous language
Terms and their definitions, in the language the domain uses.
Keep this in sync with how tasks, code, and ADRs inside this BC talk.

- **Term A** — definition
- **Term B** — definition, and how it differs from a similar term elsewhere

## Aggregates
Named aggregates with their invariants in one line each.
Detailed aggregate design lives in tactical modeling / tasks / code, not here.

- **Aggregate X** — protects invariant Y

## Key events
Domain events that leave this context. Past-tense, domain-language.

## Key commands
Intents that enter this context.

## Test command (optional)
The exact test invocation for this BC — e.g. `node --test lib/test/*.test.mjs`. Present this
section once the BC has a test suite: `work`'s per-batch pre-resolved-test-command step
(`skills/work/SKILL.md` ~:136-138, `agentic-workflow-g9s3w`) and the verifier's discovery
fallback (`agents/verifier.md`) both look at the BC README first, before falling back to
project-root `package.json`/`Makefile`/etc. TDD's runner-first rule
(`skills/test-driven-development/SKILL.md` ~:66-69) requires recording the invocation here as
part of a project's or ecosystem's first test-bearing task — get it right once and every later
task's verification reuses it for free. Omit this section entirely until the BC has tests to run.

## Runtime surface (optional)
Present only for a BC with something to boot and probe (a server, a long-running process).
Declares what to boot, how, and what "up" means, so the verifier's runtime-drive check
(`agents/verifier.md` check 8, ADR-0036) can resolve it once per batch and reuse it across
every re-dispatch iteration — mirroring the pre-resolved-test-command step above. Absent
entirely, a BC draws no runtime-drive check at all; present but untouched by a given diff
(no changed path matches `surfacePaths`) also draws no drive for that task. See this BC's own
`## Runtime surface` block (agentic-workflow) for a worked example.

```yaml
surfacePaths:
  - path/to/runtime/surface/**
launch: <command to start the surface>
stop: <command to stop it>
runfile: <path to a file recording the actual bound port/pid, if any>
probes:
  - path: /healthz
    method: GET
    status: 200
    bodyShape: '<shape description>'
renderPaths: []   # opt-in only via a task's `runtime_render: true`
```

## Relationships with other contexts
Brief note per relationship. Defer the full map to context-map.md.

- **Upstream of:** context A via event Z
- **Conformist to:** external system B

## Open questions
Things the team hasn't decided yet about this context.
````

## Writing guidance

- **Ubiquitous language is the core value of this document.** If you cut anything, don't cut that.
- **Don't duplicate the context map.** The relationships section should be one-liners pointing back to the map.
- **Don't put implementation details here.** File structure, library choices, database schema — those live in code and ADRs, not in the BC README.
- **Revisit it when the BC changes.** Out-of-date ubiquitous language is worse than none.
- **`## Test command` and `## Runtime surface` are optional, add-only-when-earned sections.** Every BC starts without either; add `## Test command` the moment the BC's first test-bearing task lands, and `## Runtime surface` only if the BC actually has something to boot and probe. A BC scaffolded by `brainstorm` with neither section is not incomplete — it just hasn't earned them yet.
