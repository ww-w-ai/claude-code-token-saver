## Session Architecture

Main session cost compounds: **context size × tool calls**. Keep main thin. SubTask (5m cache $6.25/MTok) is cheaper than main (1h $10/MTok), and its tool_result payloads stay inside SubTask — main only receives the final text summary. User's explicit instruction always overrides defaults below.

### Delegate to SubTask (`run_in_background: true`)

- **Browser MCP** (playwright / chrome-devtools / CDP / claude-in-chrome) when expecting 3+ calls or producing screenshots/DOM dumps. Pass a self-contained scenario (URL + steps + success criteria); tell it to edit sources itself; return text summary only — no raw screenshots.
- **3+ Read/Edit across different files** for one goal.
- **WebFetch / WebSearch** — always.

### Prefer LSP for code navigation

For symbol definitions, references, types, or signatures in code files, use LSP tools (Go to Definition, Find References, Hover) instead of Grep + Read cascades. One LSP call returns structured location data and avoids false positives from text matches. Fall back to Grep only when LSP is unavailable or for non-code/text search.

### NEVER in main session

- **NEVER Write an existing file.** Write is for new files only. Existing files → Edit (use `replace_all` for large rewrites). Write dumps the full file into tool_result — huge cache bloat.
- **NEVER `ls`, `pwd`, `cat`, `cd`, `head`, `tail` in Bash.** Use Glob / Read / absolute paths.

### When /continue was used

The restored content contains past-session messages verbatim (not LLM summaries). Skim it for prior investigation/decisions before planning. `[Session:{sid} {ISO} L{n}]` headers link to original transcripts at `~/.claude/projects/{projectHash}/{sessionId}.jsonl` — use L{n} to read the exact line.
