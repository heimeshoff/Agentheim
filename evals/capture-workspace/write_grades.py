import os, json
IT = r"C:/src/heimeshoff/agentic/agentheim/evals/capture-workspace/iteration-1"

def g(text, passed, ev): return {"text": text, "passed": passed, "evidence": ev}

DATA = {
 "eval-0-single-route-no-bc": {
  "with_skill": ([
    g("Exactly one new task .md file is created", True, "1 file: backlog/agentic-workflow-012-dashboard-remember-scrolled-column.md"),
    g("The task is in a backlog/ folder, not todo/doing/done/", True, "folder=backlog; todo/doing empty"),
    g("Routed to the agentic-workflow BC", True, "context=agentic-workflow (board/dashboard frontend app owns scroll/UI state)"),
    g("Frontmatter has status: backlog and context: agentic-workflow", True, "status: backlog, context: agentic-workflow"),
    g("id matches <bc>-NNN and filename is <id>-<slug>.md", True, "id=agentic-workflow-012; filename agentic-workflow-012-dashboard-remember-scrolled-column.md"),
    g("type is feature", True, "type: feature"),
    g("agentic-workflow INDEX backlog-list has the id and Backlog count incremented to 1", True, "INDEX ids=[agentic-workflow-012], Backlog: 1"),
    g("protocol.md has a new capture entry at top referencing the task", True, "entry present referencing agentic-workflow-012"),
    g("The agent asked the user NO clarifying questions before filing", True, "QUESTIONS_ASKED: No -- filed immediately"),
    g("Task is tagged captured (refinement-handoff marker), not ad-hoc keyword tags", True, "tags: [captured]"),
    g("Protocol entry uses the standard spec header -- Capture / Captured: <id> - <title> with Type/BC/Filed-to fields", True, "'-- Capture / Captured: agentic-workflow-012 - ...' + Type: Capture / BC: / Filed to: backlog"),
  ], 15, 44690, 55.3),
  "without_skill": ([
    g("Exactly one new task .md file is created", True, "1 file: backlog/agentic-workflow-012-dashboard-remember-scroll-column.md"),
    g("The task is in a backlog/ folder, not todo/doing/done/", True, "folder=backlog"),
    g("Routed to the agentic-workflow BC", True, "context=agentic-workflow"),
    g("Frontmatter has status: backlog and context: agentic-workflow", True, "status: backlog, context: agentic-workflow"),
    g("id matches <bc>-NNN and filename is <id>-<slug>.md", True, "id=agentic-workflow-012; filename matches"),
    g("type is feature", True, "type: feature"),
    g("agentic-workflow INDEX backlog-list has the id and Backlog count incremented to 1", True, "INDEX ids=[agentic-workflow-012], Backlog: 1"),
    g("protocol.md has a new capture entry at top referencing the task", True, "'## ... Idea captured (agentic-workflow)' references agentic-workflow-012"),
    g("The agent asked the user NO clarifying questions before filing", True, "QUESTIONS_ASKED: No -- acted immediately"),
    g("Task is tagged captured (refinement-handoff marker), not ad-hoc keyword tags", False, "tags: [dashboard, ui, frontend, board, ux] -- no captured marker; refiner cannot tell it is a raw dump from tags"),
    g("Protocol entry uses the standard spec header -- Capture / Captured: <id> - <title> with Type/BC/Filed-to fields", False, "freeform '## 2026-06-08 14:32 -- Idea captured (agentic-workflow)' with prose, no Type/Filed-to fields"),
  ], 15, 40990, 73.7),
 },
 "eval-1-multi-idea-split": {
  "with_skill": ([
    g("Exactly three new task .md files are created (split, not bundled)", True, "3 files: infrastructure-007, agentic-workflow-012, agentic-workflow-013"),
    g("All three tasks are in backlog/; none in todo/", True, "all folder=backlog; todo empty"),
    g("Plugin-version-bump idea routed to the infrastructure BC", True, "infrastructure-007-bump-plugin-version-before-release (globally-true release concern)"),
    g("Dark-mode and copy-id routed to a UI-bearing BC (agentic-workflow or design-system), not infrastructure", True, "dark-mode->agentic-workflow-012, copy-id->agentic-workflow-013"),
    g("Each created task has valid frontmatter (status backlog, matching context, id pattern)", True, "all status backlog; contexts match folders; ids well-formed"),
    g("Each affected BC INDEX backlog-list and count updated", True, "agentic-workflow Backlog:2 ids[012,013]; infrastructure Backlog:2 id[007]"),
    g("protocol.md has a Capture entry for EACH of the three tasks", True, "3 spec entries: aw-013, aw-012, infrastructure-007"),
    g("The agent asked the user NO clarifying questions", True, "QUESTIONS_ASKED: No"),
    g("All three tasks tagged captured", True, "every task tags: [captured]"),
    g("Protocol entries use the standard spec header format", True, "each '-- Capture / Captured: <id> - <title>' + Type/BC/Filed-to"),
  ], 18, 47408, 86.1),
  "without_skill": ([
    g("Exactly three new task .md files are created (split, not bundled)", True, "3 files: infrastructure-007, design-system-004, agentic-workflow-012"),
    g("All three tasks are in backlog/; none in todo/", True, "all folder=backlog"),
    g("Plugin-version-bump idea routed to the infrastructure BC", True, "infrastructure-007-bump-plugin-version-before-release"),
    g("Dark-mode and copy-id routed to a UI-bearing BC (agentic-workflow or design-system), not infrastructure", True, "dark-mode->design-system-004 (owns theming), copy-id->agentic-workflow-012"),
    g("Each created task has valid frontmatter (status backlog, matching context, id pattern)", True, "all valid"),
    g("Each affected BC INDEX backlog-list and count updated", True, "agentic-workflow Backlog:1, design-system Backlog:1, infrastructure Backlog:2"),
    g("protocol.md has a Capture entry for EACH of the three tasks", False, "ONE lumped entry '## ... Idea captured (quick dump, 3 items -> 3 BCs)' covers all three; not one entry per task per spec"),
    g("The agent asked the user NO clarifying questions", True, "QUESTIONS_ASKED: No"),
    g("All three tasks tagged captured", False, "ad-hoc keyword tags (e.g. [plugin, release, versioning,...]); no captured marker on any"),
    g("Protocol entries use the standard spec header format", False, "freeform header + prose, no Type/BC/Filed-to fields"),
  ], 27, 53570, 142.2),
 },
 "eval-2-infra-routing": {
  "with_skill": ([
    g("Exactly one new task .md file is created", True, "1 file: infrastructure-007-throttle-dashboard-file-watcher.md"),
    g("Routed to the infrastructure BC (file-watcher/live-update transport is infrastructure, not agentic-workflow)", True, "context=infrastructure; cites ADR-0006 live-update transport"),
    g("Task is in backlog/ with status backlog and context infrastructure", True, "folder=backlog, status: backlog, context: infrastructure"),
    g("id matches <bc>-NNN and filename is <id>-<slug>.md", True, "id=infrastructure-007; filename matches"),
    g("infrastructure INDEX backlog-list and Backlog count updated", True, "INDEX ids=[infrastructure-007, infrastructure-006], Backlog: 2"),
    g("protocol.md has a new capture entry referencing the task", True, "spec entry referencing infrastructure-007"),
    g("The agent asked the user NO clarifying questions before filing", True, "QUESTIONS_ASKED: No"),
    g("Task is tagged captured", True, "tags: [captured]"),
    g("Protocol entry uses the standard spec header format", True, "'-- Capture / Captured: infrastructure-007 - ...' + Type/BC/Filed-to"),
  ], 14, 41703, 55.3),
  "without_skill": ([
    g("Exactly one new task .md file is created", True, "1 file: infrastructure-007-dashboard-watcher-throttle-burst-changes.md"),
    g("Routed to the infrastructure BC (file-watcher/live-update transport is infrastructure, not agentic-workflow)", True, "context=infrastructure; cites infrastructure-003/ADR-0006"),
    g("Task is in backlog/ with status backlog and context infrastructure", True, "folder=backlog, status: backlog, context: infrastructure"),
    g("id matches <bc>-NNN and filename is <id>-<slug>.md", True, "id=infrastructure-007; filename matches"),
    g("infrastructure INDEX backlog-list and Backlog count updated", True, "INDEX count Backlog: 2, id present"),
    g("protocol.md has a new capture entry referencing the task", True, "'## ... Idea captured (infrastructure)' references infrastructure-007"),
    g("The agent asked the user NO clarifying questions before filing", True, "QUESTIONS_ASKED: none"),
    g("Task is tagged captured", False, "tags: [dashboard, sse, file-watcher, live-update, throttle, debounce, performance] -- no captured marker"),
    g("Protocol entry uses the standard spec header format", False, "freeform '## ... Idea captured (infrastructure)' with prose, no Type/BC/Filed-to fields"),
  ], 17, 41971, 83.3),
 },
}

for ev, cfgs in DATA.items():
    for cfg, (exps, tools, tokens, secs) in cfgs.items():
        passed = sum(1 for e in exps if e["passed"]); total = len(exps)
        grading = {
            "expectations": exps,
            "summary": {"passed": passed, "failed": total - passed, "total": total,
                        "pass_rate": round(passed / total, 4)},
            "execution_metrics": {"total_tool_calls": tools, "errors_encountered": 0},
        }
        timing = {"total_tokens": tokens, "duration_ms": int(secs * 1000), "total_duration_seconds": secs}
        cfgdir = os.path.join(IT, ev, cfg)
        with open(os.path.join(cfgdir, "grading.json"), "w", encoding="utf-8") as f:
            json.dump(grading, f, indent=2)
        run1 = os.path.join(cfgdir, "run-1"); os.makedirs(run1, exist_ok=True)
        with open(os.path.join(run1, "grading.json"), "w", encoding="utf-8") as f:
            json.dump(grading, f, indent=2)
        with open(os.path.join(run1, "timing.json"), "w", encoding="utf-8") as f:
            json.dump(timing, f, indent=2)
        meta_path = os.path.join(cfgdir, "eval_metadata.json")
        try:
            meta = json.load(open(meta_path, encoding="utf-8"))
            meta["assertions"] = [{"text": e["text"]} for e in exps]
            json.dump(meta, open(meta_path, "w", encoding="utf-8"), indent=2)
        except Exception as ex:
            print("meta skip", ev, cfg, ex)

print("grading written. Pass rates:")
for ev in DATA:
    for cfg in DATA[ev]:
        gr = json.load(open(os.path.join(IT, ev, cfg, "grading.json")))
        print(f"  {ev:30s} {cfg:14s} {gr['summary']['passed']}/{gr['summary']['total']} = {gr['summary']['pass_rate']}")
