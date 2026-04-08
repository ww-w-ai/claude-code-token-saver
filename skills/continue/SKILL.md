---
name: continue
description: 'Cheaper and faster than /compact. Restores previous session context by reading transcripts directly — no LLM calls, no token cost'
when_to_use: Use when starting a new session and want to pick up previous work. Triggers on "continue", "continue last", "restore context", "what was I doing", "pick up where I left off", "resume work", "previous session".
---

Restore context from previous sessions so the user can pick up where they left off — without the cost of /compact.

## Help

**ONLY show help if the user's argument literally contains the word "help" (e.g. `/continue help`). If no argument or any other argument is given, SKIP this section entirely and proceed to Step 1.**

If the user provides "help" as argument, show usage summary and stop:

```
/continue — Restore context from previous sessions (zero LLM calls)

Options:
  (nothing)     Show session list, pick which to restore
  last          Instantly restore the most recent session
  help          Show this help

Examples:
  /continue
  /continue last
```

Do not run any analysis or restoration. Just display the help text and stop.

## Language

Detect the user's language from their message accompanying the /continue invocation. If no message was provided (bare `/continue`), detect the dominant language from the session list's firstMsg/lastMsg content after Step 1 runs. All UI messages (session list header, selection prompt, progress updates, final reference note) MUST be in the detected language. The examples below are in English — translate naturally, don't transliterate.

## Quick Restore: `/continue last`

If the user invoked `/continue last`, skip the session list entirely. Run list-sessions with `--limit 2`, exclude the current session (same firstMsg matching logic), and automatically select the first remaining session (most recent). Jump directly to Step 2 with that single session. No user prompt needed.

## Step 1: Find and Preview Transcripts

If `/continue last` was used, skip this step (see above).

Run the list-sessions script to get main sessions only (subtask/system-only sessions are filtered out). Requires Node.js.

```bash
PROJECT_HASH=$(echo "${PWD}" | sed 's/[^a-zA-Z0-9]/-/g')
TRANSCRIPTS_DIR="${HOME}/.claude/projects/${PROJECT_HASH}"
node ${CLAUDE_PLUGIN_ROOT}/scripts/list-sessions.js "${TRANSCRIPTS_DIR}" --limit 11 --offset 0
```

The script outputs JSON. If the script returns an empty array, display "No previous sessions found in this project." and stop.

To exclude the current session: check the top 1-3 results' `firstMsg` against **this conversation's actual first user message**. The matching session is the current one — remove it from the results before displaying. In most cases the most recent (first result) will match. Display up to 10 sessions after exclusion.

Format each session for display:

```
📂 Found {N} previous sessions in this project.

Pick the ones you want to restore — Claude will read them and bring the
context into this session so you can continue where you left off.

💡 Tip: Selecting 1-2 sessions is fast (almost always faster than /compact).
   Selecting many sessions takes longer, but still no LLM summarization needed.

| # | Started | Last active | First message | Last message | Size |
|---|---------|-------------|---------------|--------------|------|
| 1 | Mar 31 09:00 | today 14:05 | "improve the skill..." | "ok go ahead..." | 122KB · 3 msgs |
| 2 | Mar 31 08:30 | today 13:59 | "local agent actually..." | "let me test the skill..." | 2.1MB · 82 msgs |
| 3 | Mar 30 15:00 | today 11:59 | "claude plugin install..." | "[interrupted]" | 251KB · 9 msgs |
| 4 | Mar 29 10:00 | Mar 31 22:10 | "fix the deploy script" | "LGTM merge it" | 95KB · 12 msgs |
| ... | | | | | |

Enter: numbers (1,3 or 1-4), or "more" to see older sessions
```

Use `--limit N` and `--offset N` for pagination. When the user types "more", re-run list-sessions with `--offset` increased by 10 (the limit). Numbers continue sequentially across pages.

Wait for user selection before proceeding. This avoids preprocessing sessions the user doesn't need.

## Step 2: Check Cache

For each session, check if a valid cache exists. Cache files are organized by year-month (YYMM) based on the session's first timestamp.

To determine YYMM, read the first 4KB of the transcript file and extract the first timestamp:

```bash
YYMM=$(head -c 4096 "${TRANSCRIPT_PATH}" | grep -o '"timestamp":"[0-9]\{4\}-[0-9]\{2\}' | head -1 | sed 's/.*"\([0-9]\{2\}\)\([0-9]\{2\}\)-\([0-9]\{2\}\)/\2\3/')
CACHE_DIR="${HOME}/.claude/cc-token-saver/${YYMM}"
CACHE_FILE="${CACHE_DIR}/compact-${SESSION_ID}.txt"
```

Cache is valid when: both `${CACHE_DIR}/compact-${SESSION_ID}.txt` and `${CACHE_DIR}/compact-${SESSION_ID}.aggressive.txt` exist, and both have `mtime >= transcript file mtime`.

If all sessions are cached and valid, skip to Step 4.

## Step 3: Preprocess Transcripts

### 3a: Preprocess and Cache

Preprocess uncached sessions with both default (200/100) and aggressive (50/20) truncation:

```bash
mkdir -p "${CACHE_DIR}"
node ${CLAUDE_PLUGIN_ROOT}/scripts/preprocess.js \
  "${TRANSCRIPT_PATH}" > "${CACHE_DIR}/compact-${SESSION_ID}.txt"
node ${CLAUDE_PLUGIN_ROOT}/scripts/preprocess.js \
  "${TRANSCRIPT_PATH}" 50 20 > "${CACHE_DIR}/compact-${SESSION_ID}.aggressive.txt"
```

Then calculate total size of all selected sessions' default cache files (`.txt`):

```bash
TOTAL_SIZE=0
for f in ${CACHE_FILES[@]}; do
  TOTAL_SIZE=$((TOTAL_SIZE + $(wc -c < "$f")))
done
```

If total > 100KB, use `.aggressive.txt` files instead in Step 4.

The `[L{n}]` markers remain intact so the user can always trace back to the original transcript for full detail.

The preprocessor outputs a compact text transcript with line number references:

- User messages: first HEAD + last TAIL chars
- Assistant messages: first HEAD + last TAIL chars
- Consecutive tool uses merged into single `[Tools: ...]` line
- Tool results: dropped entirely
- Boilerplate stripped (bkit usage, insight blocks, system tags, command tags)
- Short confirmations skipped
- Truncated text shows: `{head} [...N chars omitted...] {tail}`

Preprocessing is instant (< 1 second even for 60MB+ transcripts).

## Step 4: Read and Output

If total size of default caches (`.txt`) exceeds 100KB, use `.aggressive.txt` files instead.

Read all cached preprocessed files and output directly to the current conversation. No LLM summarization needed — the preprocessed text preserves important context verbatim.

**Large file handling:** Each cache file starts with a meta header: `# {lines} lines, {bytes} bytes`. Read this first line to determine the file size, then plan chunks accordingly. The Read tool has a ~10K token limit per call (~200 lines of preprocessed text). For files that exceed this, read in chunks using offset/limit parameters (e.g., `offset: 0, limit: 200` then `offset: 200, limit: 200`). Always read the ENTIRE file — never skip sections or "read only key parts".

### Git history

If git is available, append commit history for the time range:

Use the earliest `firstActive` among selected sessions as FROM, and the latest `lastActive` as TO.

```bash
git log --since="${FROM}" --until="${TO}" --format="%h %aI %s" --stat --no-merges 2>/dev/null
```

### Final output

Do NOT re-output the full content you just read. The Read tool already loaded everything into the conversation context.

**However, you MUST review the last 5-10 messages from the restored context and provide a "Last active context" section.** This is critical — without it, the user has to ask "what was I doing?" separately, which defeats the purpose of /continue.

The Last active context has two parts:

1. **Last 5 messages (where you left off):** Show the last 5 **USER messages ONLY** (lines starting with `[L{n} User`) with [L{n}] markers, sorted **chronologically (oldest first → newest last)** so the conversation reads top-to-bottom naturally. Do NOT include assistant messages. Copy the VERBATIM text from the preprocessed transcript — do NOT paraphrase, summarize, or rewrite. If a message exceeds ~100 chars, hard-cut at 100 chars and append `...` — never rephrase to fit. This lets the user instantly recall the flow of their final conversation.

2. **Session summary (2-4 bullets):** What was accomplished during the session, any pending decisions, background agents/tasks in progress.

Show the completion message with the active context:

```
---
[Context restored by /continue]
- {N} session(s) loaded ({date range})
- [L{n}] markers → original transcript at ~/.claude/projects/{PROJECT_HASH}/{SESSION_ID}.jsonl
- Preprocessed caches: ~/.claude/cc-token-saver/{YYMM}/compact-{SESSION_ID}.txt
- Git commit details: run `git show {commit_hash}` for any commit above
- 💡 Next session: run `/clear` first, then `/continue` to restore context cheaply

**Last 5 messages:**
- [L{n}] "{user message, truncated to ~100 chars}..."
- [L{n}] "{user message}..."
- [L{n}] "{user message}..."
- [L{n}] "{user message}..."
- [L{n}] "{user message}..."

**Session summary:**
{2-4 bullet points — what was accomplished, open items, pending decisions or in-progress tasks.}
```

## Output Rules

- Do NOT add any summary beyond the format specified in Step 4 above.
- Do NOT output emoji status lines, cost calculations, token counts, or savings estimates.
- Do NOT improvise additional statistics like "Restored context: X tokens" or "Estimated /compact cost".
- The Step 4 format is the ONLY permitted final output. Follow it exactly.
