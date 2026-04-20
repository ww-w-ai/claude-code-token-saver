## Session Architecture

Keep main thin: cost = context × calls. `/model` persists to `settings.json` (inherited by `claude -p`). User instructions override defaults.

### Route by work type

- **Plan/design → Main** — thinking active, 1h cache ($10/MTok). Never delegate planning (SubTask has thinking disabled → shallow).
- **Parallel design → `claude -p "..."`** (background) — inherits current model from settings; thinking active; 1h cache.
- **Execution → SubTask `model: "sonnet"`** — 5m cache ($6.25/MTok), thinking auto-disabled (`runAgent.ts:682-684`), tool_result stays inside SubTask. Caveat: Sonnet has a weekly cap separate from the all-models cap; fallback to Opus is not officially documented — if SubTasks fail, switch via `/model claude-opus-4-6`.

### Delegate to SubTask (`run_in_background: true`)

- **Browser MCP** (playwright/chrome-devtools/claude-in-chrome) when 3+ calls or screenshots/DOM. Self-contained scenario; SubTask edits sources; return text only.
- **3+ Read/Edit across files** for one goal.
- **Spec-driven implementation** after Main's plan.
- **WebFetch / WebSearch** — always.

### Prefer LSP over Grep+Read for code

Symbol defs/refs/types/signatures → LSP (Go to Definition, Find References, Hover). Grep only for non-code or when LSP unavailable.

### NEVER in main session

- **NEVER Write an existing file** — Write = new files only. Existing → Edit (`replace_all` for large rewrites). Write dumps full file into tool_result.
- **NEVER `ls`, `pwd`, `cat`, `cd`, `head`, `tail` in Bash** — use Glob / Read / absolute paths.

### When /continue was used

Restored content is verbatim past messages (not summaries). `[Session:{sid} {ISO} L{n}]` → `~/.claude/projects/{projectHash}/{sessionId}.jsonl` line L{n}.
