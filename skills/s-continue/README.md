# /s-continue

Restore context from previous sessions — smarter, cheaper alternative to `/compact`.

## Usage

```
/s-continue                    # show session list, pick which to restore
/s-continue last               # instantly restore the most recent session
/s-continue last --level 1     # restore only the user turns (~1-2K tokens)
```

## Restore Levels

`--level N` controls how deeply each selected session is read. Default 3.

| Level | User turns | Replies at each end | Replies in the middle | Measured (170-turn session) |
|---|---|---|---|---|
| 1 | last 30, 150 + 100 chars | first 6 + last 6, at 100 chars | 50 chars | 6.1 K tokens |
| 2 | last 30, as stored | first 12 + last 12, as stored | 50 chars | 9.3 K tokens |
| 3 | all | first 24 + last 24, as stored | 50 chars | 44.3 K tokens |

No reply is ever dropped — the middle of a long turn is shortened to 50 chars, not removed, so the
run still reads as a history. The `-> N AI responses at lines X-Y` pointer above each turn locates
the originals in the JSONL.

`compact.txt` is already a preview — the preprocessor cut user messages to 300 + 200 chars and
assistant replies to 100 + 100 when it was built. No level returns a full assistant answer; the only
path to original text is `--level 3` with a topic, which re-reads matched turns from the JSONL.

In an autonomous run one user turn can carry hundreds of replies, so levels 1 and 2 cap them per
turn, keep both ends, and say how many were skipped.

Every restored line keeps its `L{n}` marker, so a truncated turn is read back in full from the
original transcript on demand. Level 1 defers detail; it does not discard it.

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

- Location: `~/.claude/super-token-saver-data/{projectName}/{sessionId}/compact.txt` and `~/.claude/super-token-saver-data/{projectName}/{sessionId}/compact.aggressive.txt`
- Valid when: BOTH files must exist and both must have mtime >= transcript mtime
- Plain text format, instant preprocessing (< 1s even for 60MB+ transcripts)
