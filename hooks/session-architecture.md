## Session Architecture — Design/Judge in Main, Implement in SubTask

Main session: design, judgment, planning, coordination ONLY.
ALL implementation → SubTask(or Task).

### Why

1. Prevents main session bloat (output stays out of context).
2. SubTask uses 5m cache tier ($6.25/MTok) vs Main/`claude -p` 1h tier ($10/MTok) — 37.5% cheaper cache writes.

### Rules

1. **Main session**: plan, review, decide, coordinate. NO bulk file writing.
2. **SubTask**: implementation, code generation, multi-file changes. Inherits all tools and MCP servers from main session.
3. **Do NOT use `claude -p`**: same 1h cache tier as main session. SubTask is strictly cheaper for the same result.
4. Keep SubTask results concise.
5. Before writing code in main, STOP: "Should this be delegated?"
6. **SubTask MUST run in background** (`run_in_background: true`). Foreground ONLY when the result is required before the next step can proceed. Default is background — do not block the user unnecessarily.

### Delegate these to SubTask

WebFetch, WebSearch, Skill, Read (3+ files), Write/Edit (3+ files), Bash (long output), MCP tools
