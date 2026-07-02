# Protocol

Chronological log of everything that happens in this project.
Newest entries on top.

---

## 2026-06-08 14:32 — Idea captured (infrastructure)

**Task created:** infrastructure-007 — Throttle the dashboard file-watcher so a burst of
tree changes (e.g. a large git checkout) collapses into few tree-changed events (feature,
status: backlog).

Captured from the builder: "throttle the dashboard's file-watcher so a huge git checkout
doesn't fire a thousand tree-changed events at once." Routed to **infrastructure** — the
`.agentheim/` file-watcher and `tree-changed` SSE channel are this BC's transport
(infrastructure-003 / ADR-0006); read-only test passes (the watcher fires on any disk change
independent of UI writes). Filed to `backlog/` for later refinement (exact throttle window /
leading-vs-trailing semantics still open). INDEX backlog count 1→2.

---
