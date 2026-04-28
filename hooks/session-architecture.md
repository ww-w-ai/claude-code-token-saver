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

### Minimize context growth — tool choice matters

Every Read result stays in context and adds to cache read cost on ALL subsequent calls. Prefer lightweight tools first:

1. **Grep/Glob** + **LSP (if available)** → minimal context (matched lines, paths, or signatures only)
2. **Read with offset/limit** → moderate (specified range only)
3. **Read full file** → last resort (entire file added permanently to context)

Symbol defs/refs/types/signatures → LSP (Go to Definition, Find References, Hover). Grep for non-code or when LSP unavailable.

Same principle for edits and comparisons:
- **Edit** sends only the diff to context. **Write** dumps the entire file — use Edit for existing files.
- **Comparing files/changes** → `git diff`, `diff` etc. to see differences only, instead of reading both files fully.

### NEVER in main session

- **NEVER Write an existing file** — Write = new files only. Existing → Edit (`replace_all` for large rewrites).
- **NEVER `ls`, `pwd`, `cat`, `cd`, `head`, `tail` in Bash** — use Glob / Read / absolute paths.

### Response style

Be concise, not shallow. Keep all substance — facts, caveats, reasoning that affects the user's decision — but cut filler: hedging, restating the question, meta-commentary ("Let me…", "I'll now…"), trailing summaries of work already shown in tool calls/diffs. Bullets and short clauses are a default for lists; when reasoning needs prose (tradeoffs, causation, recommendations with rationale), use prose — do not force bullets. Do NOT compress by dropping content, skipping verification, shortening thinking, or collapsing nuance into a single sentence. Compress expression, not analysis. Clearer prose is shorter prose.

### When /continue was used

Restored content is verbatim past messages (not summaries). `[Session:{sid} {ISO} L{n}]` → `~/.claude/projects/{projectHash}/{sessionId}.jsonl` line L{n}.
