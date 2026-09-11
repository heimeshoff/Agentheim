/* ============================================================
   Agentheim — demo content
   Tickets, library documents, and markdown bodies used to
   show the system in context. Realistic agentic-dev content.
   ============================================================ */

// ---- Content-type registry: token + Lucide icon + label ----
export const CONTENT_TYPES = {
  ticket:   { label: "Ticket",          icon: "square-kanban", color: "var(--ct-ticket)",   tint: "var(--ct-ticket-tint)" },
  context:  { label: "Bounded context", icon: "box",           color: "var(--ct-context)",  tint: "var(--ct-context-tint)" },
  vision:   { label: "Vision",          icon: "compass",       color: "var(--ct-vision)",   tint: "var(--ct-vision-tint)" },
  map:      { label: "Context map",      icon: "git-fork",      color: "var(--ct-map)",      tint: "var(--ct-map-tint)" },
  research: { label: "Research",         icon: "flask-conical", color: "var(--ct-research)", tint: "var(--ct-research-tint)" },
  adr:      { label: "ADR",             icon: "scale",         color: "var(--ct-adr)",      tint: "var(--ct-adr-tint)" },
  concept:  { label: "Concept",         icon: "lightbulb",     color: "var(--ct-concept)",  tint: "var(--ct-concept-tint)" },
};

// ---- Status registry ----
export const STATUSES = {
  backlog: { label: "Backlog", color: "var(--st-backlog)", tint: "var(--st-backlog-tint)" },
  todo:    { label: "To do",   color: "var(--st-todo)",    tint: "var(--st-todo-tint)" },
  doing:   { label: "Doing",   color: "var(--st-doing)",   tint: "var(--st-doing-tint)" },
  done:    { label: "Done",    color: "var(--st-done)",    tint: "var(--st-done-tint)" },
};

export const COLUMN_ORDER = ["backlog", "todo", "doing", "done"];

// ============================================================
// Markdown bodies
// ============================================================

export const MD_ADR = `# ADR-0007 — Adopt event sourcing for the billing context

\`Accepted\` · supersedes \`ADR-0004\` · context: \`billing\` · 2026-05-28

## Context

The billing bounded context currently persists invoices as mutable rows. Three
recurring problems have surfaced as the agent workflow began writing to this
context directly:

- Reconstructing **why** an invoice reached its current state requires reading
  application logs that are rotated after 30 days.
- Concurrent writes from the agent runtime and the human dashboard occasionally
  clobber each other; last-write-wins is silently losing adjustments.
- Finance asked for an immutable audit trail to satisfy contractor tax records.

> Event sourcing stores the full history of state changes as an append-only log,
> rebuilding current state by replaying events. It trades read simplicity for a
> complete, queryable history.

## Decision

We will model the billing context as an **event-sourced aggregate**. Writes
append domain events; read models are projected asynchronously.

\`\`\`ts
type InvoiceEvent =
  | { kind: "InvoiceDrafted";  id: InvoiceId; amount: Money }   // initial
  | { kind: "LineItemAdded";   id: InvoiceId; item: LineItem }
  | { kind: "InvoiceIssued";   id: InvoiceId; at: Instant }
  | { kind: "PaymentReceived"; id: InvoiceId; amount: Money }

function project(events: InvoiceEvent[]): InvoiceView {
  return events.reduce(applyEvent, EMPTY_INVOICE) // fold over history
}
\`\`\`

The agent runtime emits events through the same command bus as the dashboard, so
both writers share one ordering guarantee.

## Consequences

| Area | Before | After |
|---|---|---|
| Audit trail | Logs, 30-day retention | Full, permanent |
| Concurrency | Last-write-wins | Optimistic, version-checked |
| Read latency | Direct row read | Projection lag (~120ms) |
| Storage | One row per invoice | Append-only event stream |

**Positive.** Complete history; natural fit for the agent's need to reason about
how state evolved. **Negative.** Read models are eventually consistent — the
dashboard must tolerate a short projection delay and show \`—\` until a projection
resolves.

### Follow-ups

- [x] Spike append-only store on Postgres \`LISTEN/NOTIFY\`
- [x] Define the six \`InvoiceEvent\` variants above
- [ ] Migrate \`ADR-0004\` read paths behind the projection
- [ ] Backfill historical invoices as \`InvoiceDrafted\` events

See the [billing context README](#) and the [context map](#) for how this
aggregate relates to **Identity** and **Catalog**.`;

export const MD_TICKET = `# Implement the ticket drawer markdown renderer

Render a ticket's full markdown description inside the right-hand slide-over,
tuned for comfortable long reading. This is the surface ADRs and research notes
are read through, so typography quality matters more than feature count.

## Acceptance criteria

- [x] Drawer animates in from the right over \`180ms\`
- [x] Headings, body, links, inline \`code\` and code blocks styled
- [x] Blockquotes, lists, and tables render with the reading scale
- [ ] \`Esc\` and the scrim both close the drawer
- [ ] Long bodies scroll independently of the board behind

## Notes

The renderer reads markdown straight from the agent workspace folder — no
database. Each file maps to one drawer view.

\`\`\`bash
workspace/
  tickets/AGH-128.md      # this ticket
  contexts/billing.md     # bounded-context README
  decisions/ADR-0007.md   # decision record
\`\`\`

> Keep the measure near \`68ch\`. Past that, line tracking gets tiring on the
> long ADRs.`;

export const MD_VISION = `# Product vision

**Agentheim** is the control panel for an agentic software-development workflow.
It reads a project's agent workspace folder and surfaces it through one calm,
content-first interface.

## What it is for

A developer hands a body of work to a fleet of agents and needs to stay oriented:
what is queued, what is in flight, what was decided and why. Agentheim makes that
legible without becoming another system to maintain — it is a **read-first lens**
over files the agents already write.

## Principles

1. **The folder is the source of truth.** Tickets, contexts, and decisions are
   markdown on disk. Agentheim never owns the data.
2. **Quiet by default.** Color marks status and content type and nothing else.
3. **Reading is a first-class activity.** ADRs and research notes get long;
   the reading surface is tuned for them.

> A developer should be able to open Agentheim cold and, within a minute, know
> where the work stands and where the important decisions live.`;

export const MD_CONTEXT = `# Billing — bounded context

Owns invoices, payments, and contractor tax records. Event-sourced as of
\`ADR-0007\`.

## Responsibilities

- Drafting, issuing, and reconciling **invoices**
- Recording **payments** received against issued invoices
- Producing the immutable audit trail finance depends on

## Boundaries

Billing does **not** own client identity (that is **Identity**) or the catalog of
billable services (that is **Catalog**). It references them by ID only.

| Collaborator | Relationship | Direction |
|---|---|---|
| Identity | Customer / supplier | upstream |
| Catalog | Conformist | upstream |
| Agent runtime | Partnership | shared |

## Ubiquitous language

- \`invoice\` — a billable document in one of: drafted, issued, paid.
- \`line item\` — a single billable entry on an invoice.
- \`reconciliation\` — matching a received payment to an issued invoice.`;

export const MD_RESEARCH = `# Retrieval strategies for the agent runtime

A comparison of retrieval approaches for grounding the agent's edits in
project context. Bench run on the Agentheim workspace corpus (1,240 documents).

## Approaches evaluated

1. **Naive full-text** — \`tsvector\` over all markdown.
2. **Chunked embeddings** — 512-token chunks, cosine similarity.
3. **Hybrid** — full-text recall, embedding re-rank.

## Results

| Strategy | Recall@10 | p95 latency | Index size |
|---|---|---|---|
| Full-text | 0.61 | 22ms | 18 MB |
| Embeddings | 0.78 | 140ms | 320 MB |
| Hybrid | 0.86 | 96ms | 338 MB |

> Hybrid wins on recall at acceptable latency, but the index is ~19× larger than
> full-text. For a local-only tool that cost is the deciding factor.

## Recommendation

Ship **hybrid** behind a flag; default to full-text for workspaces under ~500
documents where the recall gap is negligible. Revisit once the corpus grows.`;

export const MD_MAP = `# Context map

How Agentheim's bounded contexts relate. Read top-down: upstream contexts
constrain the contexts below them.

## Relationships

- **Identity → Billing** — customer/supplier. Billing conforms to Identity's
  notion of a contractor.
- **Catalog → Billing** — conformist. Billing takes Catalog's service
  definitions as-is.
- **Agent runtime ↔ Billing** — partnership. Both write through one command bus
  (see \`ADR-0007\`).

> The agent runtime is deliberately a *partner*, not an upstream owner. It writes
> through the same guarded commands a human does — no privileged back door.`;

// ============================================================
// Tickets
// ============================================================

export const TICKETS = [
  // ---- Doing ----
  { id: "AGH-128", status: "doing", title: "Implement the ticket drawer markdown renderer",
    context: "platform", est: "3", agent: true, updated: "2h ago", body: MD_TICKET },
  { id: "AGH-124", status: "doing", title: "Wire the agent workspace folder watcher",
    context: "platform", est: "2", agent: true, updated: "5h ago", body: MD_TICKET },

  // ---- To do ----
  { id: "AGH-129", status: "todo", title: "Extract the billing module from the monolith",
    context: "billing", est: "5", agent: false, updated: "1d ago", body: MD_TICKET },
  { id: "AGH-133", status: "todo", title: "Add idempotency keys to the webhook handler",
    context: "billing", est: "2", agent: true, updated: "1d ago", body: MD_TICKET },
  { id: "AGH-135", status: "todo", title: "Project invoice read model from the event stream",
    context: "billing", est: "3", agent: false, updated: "2d ago", body: MD_TICKET },

  // ---- Backlog ----
  { id: "AGH-142", status: "backlog", title: "Define payment bounded-context boundaries",
    context: "billing", est: "—", agent: false, updated: "3d ago", body: MD_TICKET },
  { id: "AGH-138", status: "backlog", title: "Spike: vector store options for retrieval",
    context: "research", est: "?", agent: true, updated: "3d ago", body: MD_TICKET },
  { id: "AGH-151", status: "backlog", title: "Draft ADR for event-sourcing adoption",
    context: "billing", est: "1", agent: false, updated: "4d ago", body: MD_TICKET },

  // ---- Done ----
  { id: "AGH-119", status: "done", title: "Kanban column virtualization",
    context: "platform", est: "3", agent: true, updated: "1d ago", body: MD_TICKET },
  { id: "AGH-115", status: "done", title: "Context map v1",
    context: "docs", est: "2", agent: false, updated: "2d ago", body: MD_TICKET },
];

// ============================================================
// Library — documents by group, each opens in the drawer
// ============================================================

export const LIBRARY = [
  {
    group: "Product",
    items: [
      { id: "doc-vision", type: "vision", title: "Product vision", meta: "vision.md", body: MD_VISION },
      { id: "doc-map", type: "map", title: "Context map", meta: "context-map.md", body: MD_MAP },
    ],
  },
  {
    group: "Bounded contexts",
    items: [
      { id: "ctx-billing", type: "context", title: "Billing", meta: "contexts/billing.md", body: MD_CONTEXT },
      { id: "ctx-identity", type: "context", title: "Identity", meta: "contexts/identity.md", body: MD_CONTEXT },
      { id: "ctx-runtime", type: "context", title: "Agent runtime", meta: "contexts/agent-runtime.md", body: MD_CONTEXT },
      { id: "ctx-catalog", type: "context", title: "Catalog", meta: "contexts/catalog.md", body: MD_CONTEXT },
    ],
  },
  {
    group: "Decisions",
    items: [
      { id: "adr-0007", type: "adr", title: "ADR-0007 — Adopt event sourcing", meta: "decisions/ADR-0007.md", body: MD_ADR },
      { id: "adr-0005", type: "adr", title: "ADR-0005 — Postgres over Dynamo", meta: "decisions/ADR-0005.md", body: MD_ADR },
      { id: "adr-0003", type: "adr", title: "ADR-0003 — Monorepo layout", meta: "decisions/ADR-0003.md", body: MD_ADR },
    ],
  },
  {
    group: "Research",
    items: [
      { id: "res-retrieval", type: "research", title: "Retrieval strategies", meta: "research/retrieval.md", body: MD_RESEARCH },
      { id: "res-caching", type: "research", title: "Prompt caching benchmarks", meta: "research/caching.md", body: MD_RESEARCH },
    ],
  },
  {
    group: "Concepts",
    items: [
      { id: "concept-event-sourcing", type: "concept", title: "Event sourcing", meta: "concepts/event-sourcing.md", body: MD_ADR },
      { id: "concept-bounded-context", type: "concept", title: "Bounded context", meta: "concepts/bounded-context.md", body: MD_CONTEXT },
    ],
  },
];
