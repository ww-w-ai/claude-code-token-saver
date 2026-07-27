# Claude Code Transcript Reference

> Status: LIVING — background reference on Claude Code's own transcript format. Describes CC, not this plugin, so it changes only when CC changes.

How Claude Code transcripts work — for any skill or tool that needs to analyze session data.

## File Location

```
~/.claude/projects/{PROJECT_HASH}/{SESSION_ID}.jsonl
```

- `PROJECT_HASH`: working directory path with non-alphanumeric chars replaced by `-`
  - e.g., `/Users/kim/Documents/DEV/my-project` → `-Users-kim-Documents-DEV-my-project`
- `SESSION_ID`: UUID v4 (e.g., `d33768ff-cddd-4cae-9545-86dc22c5381d`)
- Each file is append-only JSONL (one JSON object per line)

Generate PROJECT_HASH:

```bash
echo "${PWD}" | sed 's/[^a-zA-Z0-9]/-/g'
```

## Line Format

Each line is a JSON object. Key fields:

```jsonc
{
  "type": "user" | "assistant" | "summary",
  "message": {
    "role": "user" | "assistant",
    "content": "string" | [ { "type": "text", "text": "..." }, { "type": "tool_use", ... }, ... ],
    "timestamp": "2025-04-04T10:16:00.000Z"
  },
  "timestamp": "2025-04-04T10:16:00.000Z",
  // assistant messages include:
  "usage": {
    "input_tokens": 3,
    "cache_creation_input_tokens": 250,
    "cache_read_input_tokens": 86444,
    "output_tokens": 207
  },
  "costUSD": 0.0052
}
```

## Message Types

### `type: "user"`

User-submitted messages. `content` can be:

- Plain string: direct user input
- Array of content blocks: when attachments, images, or system-inserted content is included

Special user messages:

- `<command-name>/foo</command-name>` — slash command invocation
- `<command-message>...</command-message>` — command content
- `<local-command-stdout>...</local-command-stdout>` — output from local commands like `/context`
- `<system-reminder>...</system-reminder>` — system-injected context (skills list, tool reminders, etc.)

### `type: "assistant"`

Assistant responses. `content` is always an array of content blocks:

```jsonc
[
  { "type": "text", "text": "Here is my response..." },
  { "type": "tool_use", "id": "toolu_...", "name": "Read", "input": { "file_path": "/..." } },
  { "type": "text", "text": "Based on the file..." }
]
```

**Tool use blocks** (`type: "tool_use"`):

- `name`: tool name (Read, Write, Edit, Bash, Grep, Glob, Agent, etc.)
- `input`: tool parameters
- `id`: unique ID linking to the corresponding tool_result

**Usage data** is inside `message.usage` (not at the root level):

```jsonc
{
  "type": "assistant",
  "requestId": "req_011CZfm2...",
  "message": {
    "id": "msg_...",
    "usage": {
      "input_tokens": 168,
      "cache_creation_input_tokens": 686539,
      "cache_read_input_tokens": 7210415,
      "output_tokens": 1803
    },
    "content": [...]
  }
}
```

Note: `costUSD` is NOT present in transcripts. Calculate it manually using the cost formula below.

**CRITICAL: Streaming deduplication.** A single API call (one `requestId`) produces multiple assistant lines in the transcript - one per streaming chunk (text block, tool_use block, etc.). Each line carries the same `requestId` but usage grows incrementally. **Only the last line per `requestId` has the final usage.** Summing all lines without deduplication inflates costs by ~30%. Always group by `requestId` and take the last entry.

### `type: "summary"`

Appears after `/compact`. Contains the compacted conversation summary. Previous messages before this point were replaced.

### Tool Results

Tool results appear as user messages with content blocks:

```jsonc
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_...",
        "content": "file contents or command output..."
      }
    ]
  }
}
```

## Extracting Specific Data

### Errors and Failures

Look for these patterns in assistant text and tool results:

- Tool results with `is_error: true`
- Text containing `error`, `Error`, `failed`, `FAILED`, `exception`
- Bash tool results with non-zero exit codes
- `[Request interrupted by user]` — user cancelled mid-response

```bash
# Find error lines in a transcript
node -e "
const fs = require('fs');
const lines = fs.readFileSync(process.argv[1],'utf8').trim().split('\n');
lines.forEach((line, i) => {
  try {
    const obj = JSON.parse(line);
    const content = obj.message?.content;
    if (Array.isArray(content)) {
      content.forEach(b => {
        if (b.is_error) console.log('L'+(i+1), 'TOOL_ERROR:', (b.content||'').slice(0,200));
        if (b.type === 'text' && /error|fail|exception/i.test(b.text))
          console.log('L'+(i+1), obj.type, b.text.slice(0,200));
      });
    }
  } catch {}
});
" "\$TRANSCRIPT_PATH"
```

### Usage / Cost Data

Usage is in `message.usage`. **Must deduplicate by `requestId`** - streaming produces multiple lines per API call; only the last per requestId has final usage.

```bash
node -e "
const fs = require('fs');
const lines = fs.readFileSync(process.argv[1],'utf8').trim().split('\n');
const reqMap = new Map();
lines.forEach(line => {
  try {
    const obj = JSON.parse(line);
    if (obj.type !== 'assistant') return;
    const usage = obj.message?.usage;
    const reqId = obj.requestId || obj.message?.id;
    if (!usage || !reqId) return;
    reqMap.set(reqId, {
      input: usage.input_tokens || 0,
      cc: usage.cache_creation_input_tokens || 0,
      cr: usage.cache_read_input_tokens || 0,
      output: usage.output_tokens || 0,
    });
  } catch {}
});
let input=0, cc=0, cr=0, output=0;
for (const u of reqMap.values()) { input+=u.input; cc+=u.cc; cr+=u.cr; output+=u.output; }
const cost = (input*15 + cc*3.75 + cr*0.30 + output*75) / 1e6;
console.log(JSON.stringify({input, cache_creation:cc, cache_read:cr, output, costUSD: cost.toFixed(4)}));
" "\$TRANSCRIPT_PATH"
```

### Session Metadata

```bash
# First and last timestamp, message count
node -e "
const fs = require('fs');
const lines = fs.readFileSync(process.argv[1],'utf8').trim().split('\n');
let first, last, userMsgs=0, asstMsgs=0;
lines.forEach(line => {
  try {
    const obj = JSON.parse(line);
    const ts = obj.timestamp || obj.message?.timestamp;
    if (ts) { if (!first) first = ts; last = ts; }
    if (obj.type === 'user') userMsgs++;
    if (obj.type === 'assistant') asstMsgs++;
  } catch {}
});
console.log(JSON.stringify({first, last, userMsgs, asstMsgs, totalLines: lines.length}));
" "\$TRANSCRIPT_PATH"
```

### Subagent/Subtask Sessions

When Agent tool is used, subtask sessions are created as separate JSONL files in the same directory. The parent transcript contains `tool_use` blocks with `name: "Agent"` — the agent's session ID can be found in the tool result or in `~/.claude/projects/{HASH}/` by matching timestamps.

## What Local Commands Record

| Command                 | Recorded in transcript?      | Content recorded?                             |
| ----------------------- | ---------------------------- | --------------------------------------------- |
| `/context`              | Yes (as user message)        | Yes — full output in `<local-command-stdout>` |
| `/usage`                | Yes (as user message)        | No — only `"Status dialog dismissed"`         |
| `/compact`              | Yes (creates `summary` type) | Yes — the compacted summary                   |
| `/clear`                | Creates new session file     | N/A                                           |
| Slash commands (`/foo`) | Yes — `<command-name>` tag   | Yes                                           |

## Cost Calculation

API pricing (as of 2025-04):

| Token type     | Price per 1M tokens |
| -------------- | ------------------- |
| input (new)    | $15.00              |
| cache_creation | $3.75               |
| cache_read     | $0.30               |
| output         | $75.00              |

```
cost = (input * 15 + cache_creation * 3.75 + cache_read * 0.30 + output * 75) / 1_000_000
```

Note: `costUSD` field on assistant messages may already have this calculated.

## Size Considerations

- Transcript files can be very large (60MB+ for long sessions)
- Use streaming (readline) for large files, not `fs.readFileSync` for production tools
- The preprocess.js script in `/scripts/` handles large files efficiently
- `MAX_TRANSCRIPT_READ_BYTES` in CC source is used to guard against OOM when reading raw transcripts
