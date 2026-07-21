# /cc-continue

Restore context from previous sessions — smarter, cheaper alternative to `/compact`.

## Usage

```
/cc-continue                    # show session list, pick which to restore
/cc-continue last               # instantly restore the most recent session
```

## How It Works

1. Lists main sessions in a table (subtask/system-only filtered out) — current session auto-excluded
2. User selects sessions by number (e.g., `1,3` or `1-4`). Type `more` for older sessions
3. Checks cache validity (both default and aggressive variants must exist with fresh mtime)
4. Uncached sessions: preprocessed to compact text (no LLM call needed)
5. Total ≤ 150KB: default cache used. > 150KB: aggressive truncation (50/20) kicks in automatically
6. Appends git history for the time range
7. Shows **Last 5 user messages** (verbatim) + **Session summary** so you instantly recall where you left off

All UI messages (session list, prompts, summary) are displayed in the user's detected language.

## Preprocessing

- `scripts/preprocess.js` — Node.js
- `scripts/list-sessions.js` — Node.js

Requires Node.js (Claude Code already requires it).

| Content | Treatment |
|---|---|
| User messages | First 200 + last 100 chars (configurable via CLI args) |
| Assistant messages | First 200 + last 100 chars |
| Consecutive tool calls | Merged into `[Tools: A, B, C]` |
| Tool results | Dropped entirely |
| Boilerplate | Stripped (bkit usage, insight blocks, system tags) |
| Short confirmations | Skipped (Done, Updated, etc.) |

Each turn header includes `[Session:{sid} {ISO} L{n}]` — the session ID, timestamp, and original JSONL line number for direct seek.

## Caching

- Location: `~/.claude/claude-code-token-saver-data/{projectName}/{sessionId}/compact.txt` and `~/.claude/claude-code-token-saver-data/{projectName}/{sessionId}/compact.aggressive.txt`
- Valid when: BOTH files must exist and both must have mtime >= transcript mtime
- Plain text format, instant preprocessing (< 1s even for 60MB+ transcripts)
