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
                  - Current session with context-loss events appears as #0 [default]
                  - Press Enter to restore just #0, or add more numbers
  last          Quick restore:
                  - Current session if it had /compact or auto-compact
                  - Otherwise, most recent other session
  help          Show this help

Examples:
  /continue
  /continue last
```

Do not run any analysis or restoration. Just display the help text and stop.

## Language

Detect the user's language from their message accompanying the /continue invocation. If no message was provided (bare `/continue`), detect the dominant language from the session list's firstMsg/lastMsg content after Step 1 runs. All UI messages (session list header, selection prompt, progress updates, final reference note) MUST be in the detected language. The examples below are in English — translate naturally, don't transliterate.

## Quick Restore: `/continue last`

If the user invoked `/continue last`, skip the session list entirely. Run list-sessions with `--limit 3`. Then pick automatically based on the `isCurrent` and `hasContextLoss` fields:

- **If the current session has context-loss** (`isCurrent: true` AND `hasContextLoss: true`) → auto-pick the CURRENT session. Its pre-context-loss content is what needs restoration.
- **Otherwise** → auto-pick the most recent session where `isCurrent: false` (the previous session).
- **If no valid target** (current session has no context-loss AND no previous sessions exist) → print "No previous sessions found in this project." and stop.

Jump directly to Step 3 with the selected session. No user prompt needed.

## Step 1: List & Select

If `/continue last` was used, skip this step (see above).

Run the list-sessions script to get main sessions only (subtask/system-only sessions are filtered out). Requires Node.js.

```bash
PROJECT_HASH=$(echo "${PWD}" | sed 's/[^a-zA-Z0-9]/-/g')
TRANSCRIPTS_DIR="${HOME}/.claude/projects/${PROJECT_HASH}"
node ${CLAUDE_PLUGIN_ROOT}/scripts/list-sessions.js "${TRANSCRIPTS_DIR}" --limit 11 --offset 0
```

The script outputs JSON. If the script returns an empty array, display "No previous sessions found in this project." and stop.

**Current session identification**: The script sets `isCurrent: true` on the session whose JSONL is most recently modified (the one being actively written). This is reliable even after auto-compact (unlike firstMsg comparison, which fails because the LLM's first visible message becomes the summary).

**Case A/B/C/D list display**:
- Look at the session with `isCurrent: true`:
  - If `hasContextLoss: true` → **display it as #0 [default]** (with `📍` marker plus any `@@`/`+`/`++` event badges). #1..N are other sessions.
  - If `hasContextLoss: false` → **exclude it entirely from the list** (its full content is in live memory, nothing to restore). #1..N are other sessions.
- If no other sessions exist and current has context-loss → **auto-restore current session, skip list display** (Case C).
- If no other sessions exist and current has no context-loss → print "No previous sessions found in this project." and stop (Case D).

Format each session for display (preserve existing Case A/B/C/D logic — current session #0 with context-loss marker, etc.):

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
| ... | | | | | |

Enter:
  - numbers only (e.g., "1,3" or "1-4") — fast restore
  - numbers + ":" + topic (e.g., "1,3 : PDCA 구현") — topic-based restore (slower, more accurate)
  - "more" for pagination
  - (empty) for default

💡 Topic search adds an LLM step so it takes longer, but restores specific memories more accurately.
```

Use `--limit N` and `--offset N` for pagination. When the user types "more", re-run list-sessions with `--offset` increased by 10 (the limit). Numbers continue sequentially across pages.

Wait for user selection before proceeding. This avoids preprocessing sessions the user doesn't need.

## Step 2: Parse Input

Split user input on the first `:`:

- Left side → numbers part. Parse using existing Case A/B/C/D logic (additive with #0, ranges, comma lists).
- Right side (optional) → topic string (trim whitespace). May be absent.

Examples:
- `1,3` → sessions [1, 3], no topic
- `1-4 : PDCA 구현` → sessions [1, 2, 3, 4], topic = "PDCA 구현"
- `: error handling` → only #0 (default), topic = "error handling"
- `` (empty) → default selection, no topic

## Step 3: Ensure Cache & Preprocess

preprocess.js is self-managing: it derives the cache path from the JSONL path, checks format version + mtime, and skips if fresh. Just call it for each selected session.

```bash
# For each selected session: ensure compact.txt cache is fresh
node ${CLAUDE_PLUGIN_ROOT}/scripts/preprocess.js "${TRANSCRIPT_PATH}"
```

The cache file is at:
```bash
PROJECT_HASH=$(echo "${PWD}" | sed 's/[^a-zA-Z0-9]/-/g')
CACHE_FILE="${HOME}/.claude/claude-code-token-saver-data/${PROJECT_HASH}/${SESSION_ID}/compact.txt"
```

**Current session with context-loss**: The compact.txt contains the FULL session. When reading it, use `lastContextLossLine` from list-sessions.js to filter: only read entries where `L{n} < lastContextLossLine`. Content after the last context-loss event is already in live LLM memory.

To extract just the pre-boundary portion without LLM parsing:
```bash
awk "/\[Session:.*L${LAST_LOSS_LINE}\]/{exit} 1" "${CACHE_FILE}"
```

**Current session WITHOUT context-loss**: Skip — entire session is in live memory.

**Past sessions**: Read the full compact.txt (none of their content is in live memory).

The preprocessor (v6) outputs a compact text transcript with `[Session:{sid} {ISO} L{n}]` headers. The `L{n}` is the JSONL line number of the user message — this enables direct seek into the original transcript for topic-based restoration.

Preprocessing is instant (< 1 second even for 60MB+ transcripts).

## Step 4: Load Compact

No size threshold. Always load all selected compact.txt files.

- **No topic** → Read all compact.txt files directly using the Read tool. Content is loaded into conversation context as-is. For files exceeding ~10K tokens, read in chunks using offset/limit parameters. Always read the ENTIRE file — never skip sections. Proceed to Step 6.

- **Topic provided** → Do NOT Read compact.txt yet. Proceed to Step 5 (topic-based restoration).

## Step 5: Topic-Based Original Restoration

**Goal**: Load compact.txt with the top 20 most topic-relevant truncated turns replaced by their full JSONL originals. The original compact.txt files are never modified — the assembled result is written to a temp file.

### Step 5a: Extract user turn list

Extract all user message headers from compact.txt files programmatically (no LLM Read needed):

```bash
python3 << 'PYEOF'
import json, os, re

sessions = [
    # (session_id, compact_path) — dynamically populated
]

results = []
for sid, path in sessions:
    with open(os.path.expanduser(path)) as f:
        content = f.read()
    for m in re.finditer(
        r'\[Session:([a-f0-9]+) (\S+) L(\d+)\].*?User: "(.*?)"',
        content
    ):
        results.append({
            "sid": m.group(1),
            "ts": m.group(2),
            "line": int(m.group(3)),
            "msg": m.group(4)[:300]
        })

print(json.dumps(results, ensure_ascii=False))
PYEOF
```

### Step 5b: LLM selects top 20

Read the JSON output from Step 5a. For each user turn, judge topic relevance. Select the **top 20 most relevant** turns (by topic match strength). Output a list of `(sid, line)` pairs.

If fewer than 20 turns match, include only those that match. If zero match, skip to Step 4 no-topic path (load compact as-is).

### Step 5c: Batch extract originals

Extract all 20 matched turns' originals from JSONL files in **a single python script** (one pass per JSONL file):

```bash
python3 << 'PYEOF'
import json, sys

# Dynamically populated: { "sid": { "jsonl_path": "...", "lines": [40, 83, ...] } }
extractions = {}

results = {}
for sid, info in extractions.items():
    target_lines = set(info["lines"])
    all_lines = {}
    with open(info["jsonl_path"]) as f:
        for i, raw in enumerate(f, 1):
            if i in target_lines or any(i > t for t in target_lines):
                all_lines[i] = raw

    for target_line in info["lines"]:
        d = json.loads(all_lines.get(target_line, '{}'))
        # Extract user content
        content = d.get("message", {}).get("content", "")
        if isinstance(content, list):
            user_text = " ".join(
                b["text"] for b in content
                if isinstance(b, dict) and b.get("type") == "text"
            )[:3000]
        else:
            user_text = str(content)[:3000]

        # Find assistant responses until next user turn
        assistants = []
        for j in range(target_line + 1, target_line + 100):
            if j not in all_lines:
                continue
            row = json.loads(all_lines[j])
            if row.get("type") == "user":
                break
            msg = row.get("message", {})
            if msg.get("role") == "assistant":
                texts = []
                for b in (msg.get("content", []) if isinstance(msg.get("content"), list) else []):
                    if isinstance(b, dict) and b.get("type") == "text" and b.get("text", "").strip():
                        texts.append(b["text"][:3000])
                if texts:
                    assistants.append("\n".join(texts))

        key = f"{sid}_L{target_line}"
        results[key] = {"user": user_text, "assistants": assistants}

# Write to temp file
output_path = "/tmp/continue-originals.json"
with open(output_path, "w") as f:
    json.dump(results, f, ensure_ascii=False)
print(f"Extracted {len(results)} turns to {output_path}")
PYEOF
```

### Step 5d: Assemble temp file

Build the restored document by iterating compact.txt in order, replacing matched turns inline:

```bash
python3 << 'PYEOF'
import json, re, os

# Inputs (dynamically populated)
compact_paths = []  # ordered list of compact.txt paths
originals_path = "/tmp/continue-originals.json"
output_path = "/tmp/continue-restored.txt"

with open(originals_path) as f:
    originals = json.load(f)

matched_keys = set(originals.keys())

with open(output_path, "w") as out:
    for cpath in compact_paths:
        with open(os.path.expanduser(cpath)) as f:
            lines = f.readlines()

        i = 0
        while i < len(lines):
            line = lines[i]
            # Check if this is a user turn header
            m = re.match(
                r'\[Session:([a-f0-9]+) \S+ L(\d+)\]',
                line
            )
            if m:
                key = f"{m.group(1)}_L{m.group(2)}"
                if key in matched_keys:
                    orig = originals[key]
                    # Write header line as-is
                    out.write(line)
                    i += 1
                    # Write "-> N AI responses" line as-is
                    if i < len(lines) and lines[i].startswith("->"):
                        out.write(lines[i])
                        i += 1
                    # Replace numbered AI response lines with originals
                    ai_idx = 0
                    while i < len(lines) and re.match(r'\d+\.', lines[i]):
                        if ai_idx < len(orig["assistants"]):
                            out.write(f'{ai_idx + 1}. "{orig["assistants"][ai_idx]}"\n')
                        else:
                            out.write(lines[i])
                        ai_idx += 1
                        i += 1
                    continue
            out.write(line)
            i += 1

print(f"Assembled to {output_path} ({os.path.getsize(output_path)} bytes)")
PYEOF
```

### Step 5e: Read restored file

Read the temp file (`/tmp/continue-restored.txt`) into conversation context using the Read tool. Use offset/limit chunks for large files. Then proceed to Step 6.

**Important**: The temp file is ephemeral — it may differ each time `/continue` is invoked with a different topic. The original compact.txt files remain unchanged.

## Step 6: Final Completion Message

After restoration (whether 5A or 5B), produce the completion message.

### Git history (optional)

If git is available, append commit history for the time range. Use the earliest `firstActive` among selected sessions as FROM, and the latest `lastActive` as TO:

```bash
git log --since="${FROM}" --until="${TO}" --format="%h %aI %s" --stat --no-merges 2>/dev/null
```

### Last active context

You MUST review the last 5 messages from the restored context and provide a "Last 5 messages" section. Without it, the user has to ask "what was I doing?" separately, which defeats the purpose of /continue.

1. **Last 5 messages (where you left off):** Show the last 5 **USER messages ONLY** (lines starting with `[Session:`) with `[Session:{sid} L{n}]` markers, sorted **chronologically (oldest first → newest last)**. Do NOT include assistant messages. Copy the VERBATIM text from the preprocessed transcript — do NOT paraphrase or rewrite. If a message exceeds ~100 chars, hard-cut at 100 chars and append `...`.

2. **Session summary (2-4 bullets):** What was accomplished, any pending decisions, background agents/tasks in progress.

### Completion message format

```
---
[Context restored by /continue]
- {N} session(s) loaded ({date range})
- [Session:{sid} {ISO} L{n}] headers link to original transcripts at ~/.claude/projects/{PROJECT_HASH}/{SESSION_ID}.jsonl — use L{n} to read the exact line.
- Preprocessed caches: ~/.claude/claude-code-token-saver-data/{PROJECT_HASH}/{SESSION_ID}/compact.txt
- 💡 Next session: run `/clear` first, then `/continue` to restore context cheaply

**Last 5 messages:**
- [Session:{sid} L{n}] "{user message, truncated to ~100 chars}..."
- [Session:{sid} L{n}] "{user message}..."
- [Session:{sid} L{n}] "{user message}..."
- [Session:{sid} L{n}] "{user message}..."
- [Session:{sid} L{n}] "{user message}..."

**Session summary:**
{2-4 bullet points — what was accomplished, open items, pending decisions or in-progress tasks.}

---
💡 **Memory search prompt**: If your memory of a specific topic is vague, try this:
> There should be a previous conversation about ___. Find related messages in the text, and if any parts are truncated, use the session ID and line number to retrieve the full text from the original transcript.
```

The Memory search prompt block goes at the VERY END (after Last messages and Session summary), so it's the last thing the LLM/user sees.

## Output Rules

- Do NOT add any summary beyond the format specified in Step 6 above.
- Do NOT output emoji status lines, cost calculations, token counts, or savings estimates.
- Do NOT improvise additional statistics like "Restored context: X tokens" or "Estimated /compact cost".
- The Step 6 format is the ONLY permitted final output. Follow it exactly.
- The Memory search prompt block must appear exactly as specified above.
