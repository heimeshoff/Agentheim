# Widgets — BC README (eval fixture)

## Purpose
Synthetic bounded context used only as fixture material for the
`verifier-catch-rate` eval harness's check-8 (runtime drive, ADR-0036) fixture
set. Not part of the real Agentheim product — do not treat as domain guidance
for any other task.

## Ubiquitous language
- **Widget** — the aggregate; a paintable unit with a `color`.
- **Widgets status endpoint** — a read-only HTTP surface (`GET /widgets`)
  reporting all known `Widget`s and their colors, for operational visibility.

## Runtime surface

The manifest the verifier's **runtime-drive check** (check 8, ADR-0036)
resolves once per batch and reuses across every re-dispatch iteration —
mirroring how the pre-resolved test command is resolved once and reused.

```yaml
surfacePaths:
  - src/**
launch: node src/launch.js
stop: node src/launch.js stop
runfile: .tmp/runtime.json   # read the ACTUAL bound port from here — never
                             # assume a derived value; launch.js binds a true
                             # ephemeral :0 port (ADR-0036 pt 4)
probes:
  - path: /healthz
    method: GET
    status: 200
    bodyShape: '{ status: string }'
  - path: /widgets
    method: GET
    status: 200
    bodyShape: '{ widgets: array }'
```

`launch`/`stop` delegate all spawn/kill logic to `src/launch.js`, a small
stdlib-only detached launcher (mirrors `dashboard/launch.mjs`'s pattern):
`cwd: tmpdir()` so a leaked server can't wedge worktree cleanup, and it reads
back the actual bound port from `runfile` after boot.
