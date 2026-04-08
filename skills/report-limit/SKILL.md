---
name: report-limit
description: 'Max plan hit the wall? 💀 Report your 5h window data — we''re mapping the rate limit formula Anthropic won''t publish'
when_to_use: Use when user hits a rate limit and wants to contribute data. Triggers on "report limit", "limit report", "rate limit report".
---

Automatically find rate-limited 5-hour windows from cached timeline data and open a pre-filled GitHub Discussion with the raw data.

## Help

**ONLY show help if the user's argument literally contains the word "help" (e.g. `/report-limit help`). If no argument or any other argument is given, SKIP this section entirely and proceed to Step 1.**

If the user provides "help" as argument, show usage summary and stop:

```
/report-limit — Report your rate limit data

Got rate limited? This skill automatically finds your blocked
5-hour windows from cached timeline data and opens a pre-filled
GitHub Discussion to ww-w-ai/cc-token-saver.

No manual input needed. Just run it and confirm in your browser.

Options:
  (nothing)     Auto-detect and report all rate-limited windows
  help          Show this help
```

Do not run any analysis. Just display the help text and stop.

## Language

Detect the user's language from their message. All UI output MUST be in the detected language. Examples below are in English.

## Step 1: Run analyze-usage to ensure timeline CSVs exist

The analyze-usage script generates timeline CSVs as a side effect. Run it to ensure all sessions have cached timeline data:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/analyze-usage.js > /dev/null
```

If the user recently ran `/usage-view`, the cache is already warm and this completes instantly.

## Step 2: Find rate-limited windows from timeline CSVs

Scan all timeline CSVs for rows where `rl` starts with `limit_hit` (catches `limit_hit_5h`, `limit_hit_weekly`, `limit_hit_opus`, `limit_hit_sonnet`, `limit_hit_extra`, `limit_hit_unknown`, with or without `{reset}` suffix). Group by the `win` column (5-hour window start timestamp) to identify distinct rate-limited windows.

```bash
node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');
const CACHE_BASE = path.join(os.homedir(), '.claude', 'cc-token-saver');

// Find all YYMM directories
const yymms = fs.readdirSync(CACHE_BASE).filter(d => /^\d{4}$/.test(d));
const windowMap = new Map(); // winTs -> { rows: [...], sessions: Set }

for (const ym of yymms) {
  const dir = path.join(CACHE_BASE, ym);
  const csvs = fs.readdirSync(dir).filter(f => f.startsWith('timeline-') && f.endsWith('.csv'));
  for (const csv of csvs) {
    const sessionId = csv.replace('timeline-', '').replace('.csv', '');
    const lines = fs.readFileSync(path.join(dir, csv), 'utf8').trim().split('\n');
    let prevWin = '';
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 11) continue;
      const win = cols[9] !== '' ? cols[9] : prevWin;
      if (cols[9] !== '') prevWin = cols[9];
      const rl = cols[10] || '';
      if (rl.startsWith('limit_hit')) {
        if (!windowMap.has(win)) windowMap.set(win, { sessions: new Set() });
        windowMap.get(win).sessions.add(sessionId);
      }
    }
  }
}

// For each rate-limited window, collect ALL rows (not just limit_hit) from all sessions in that window
const results = [];
for (const [winTs, info] of windowMap) {
  const winStart = Number(winTs);
  const winEnd = winStart + 5 * 3600;
  const rows = [];

  for (const ym of yymms) {
    const dir = path.join(CACHE_BASE, ym);
    const csvs = fs.readdirSync(dir).filter(f => f.startsWith('timeline-') && f.endsWith('.csv'));
    for (const csv of csvs) {
      const sessionId = csv.replace('timeline-', '').replace('.csv', '');
      const lines = fs.readFileSync(path.join(dir, csv), 'utf8').trim().split('\n');
      let prevModel = '', prevWin = '';
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 11) continue;
        const ts = Number(cols[0]);
        if (ts < winStart || ts > winEnd) continue;
        const model = cols[1] || prevModel;
        if (cols[1]) prevModel = cols[1];
        rows.push(lines[i] + ',' + sessionId);
      }
    }
  }

  rows.sort((a, b) => Number(a.split(',')[0]) - Number(b.split(',')[0]));

  const startD = new Date(winStart * 1000);
  const endD = new Date(winEnd * 1000);
  const fmtD = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  const fmtT = d => String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  const totalCost = rows.reduce((s, r) => s + Number(r.split(',')[8]), 0);

  results.push({
    winTs,
    date: fmtD(startD),
    start: fmtT(startD),
    end: fmtT(endD),
    sessions: info.sessions.size,
    requests: rows.length,
    cost: Math.round(totalCost * 100) / 100,
    csvHeader: 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,session',
    csvRows: rows
  });
}

console.log(JSON.stringify(results, null, 2));
" 2>/dev/null
```

If no rate-limited windows found, tell the user: "No rate-limited windows found in cached data. Run `/usage-view` first to analyze all sessions, then try again."

## Step 3: Build GitHub Discussion for each window

For each rate-limited window, build a pre-filled GitHub Discussion.

Get the Claude Code version:
```bash
claude --version 2>/dev/null || echo "unknown"
```

### Discussion Title

```
[Usage Data] 💀 Window: {YYYY-MM-DD} {HH:MM}-{HH:MM} — ${cost}
```

### Discussion Body

The body contains the raw timeline CSV data. No aggregation, no metric calculation — raw data as-is.

```markdown
## Rate Limit Data Point

| Field | Value |
|-------|-------|
| Window | {YYYY-MM-DD} {HH:MM}-{HH:MM} (local time, UTC+9) |
| Total Cost | ${cost} |
| API Requests | {count} |
| Sessions | {count} |

## Timeline Data

Raw timeline CSV for this 5-hour window. Each row is one API call.

Columns: `ts` (unix), `model`, `input` (tokens), `cc` (cache creation), `cc5m` (5min tier), `cc1h` (1hr tier), `cr` (cache read), `out` (output), `cost` (USD), `win` (window start), `rl` (rate limit status), `evt` (context/cost events, pipe-separated: startup, compact, cost_warn, cost_danger, ctx_warn, ctx_danger, etc.), `session` (id)

```csv
ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,session
{raw CSV rows joined by newline}
```

## Context
- Plan: Max ($200/mo)
- Claude Code version: {version}
- Date: {YYYY-MM-DD}
```

## Step 4: Sanitize

Before building the URL, strip sensitive data from the body:

```bash
node -e "
let body = process.argv[1];
const home = require('os').homedir();
body = body.replace(new RegExp(home.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\\\$&'), 'g'), '~');
body = body.replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, '[REDACTED]');
body = body.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]');
body = body.replace(/(API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*\S+/gi, '\$1=[REDACTED]');
console.log(body);
" '\$ISSUE_BODY'
```

## Step 5: Upload data and open GitHub Discussion

Target repo:
```
REPO="ww-w-ai/cc-token-saver"
```

### Step 5a: Prepare files

Copy the relevant timeline and ratelimit CSV files to a temp directory:

```bash
REPORT_DIR="/tmp/report-limit-$(date +%Y%m%d%H%M%S)"
mkdir -p "$REPORT_DIR"
```

For each rate-limited window, copy:
- All timeline CSVs that have data in that window
- All ratelimit CSVs from sessions in that window

### Step 5b: Try gist upload

```bash
# Check if gh is authenticated
if gh auth status >/dev/null 2>&1; then
  GIST_URL=$(gh gist create --public "$REPORT_DIR"/*.csv 2>/dev/null)
fi
```

### Step 5c: Build Discussion URL

Build the Discussion body depending on whether gist upload succeeded.

If gist succeeded, the Discussion body includes the gist URL:

```markdown
## Rate Limit Data Point

| Field | Value |
|-------|-------|
| Window(s) | {list of windows with dates/times} |
| Total Cost | ${total_cost} |
| Sessions | {count} |

## Raw Data
📎 ${GIST_URL}

## Context
- Plan: Max ($200/mo)
- Claude Code version: {version}
- Date: {YYYY-MM-DD}
```

If gist failed, include file path info instead:

```markdown
## Rate Limit Data Point

| Field | Value |
|-------|-------|
| Window(s) | {list of windows with dates/times} |
| Total Cost | ${total_cost} |
| Sessions | {count} |

## Raw Data
📎 Please attach CSV files from: ${REPORT_DIR}/
Files prepared:
- timeline-xxx.csv
- ratelimit-xxx.csv

## Context
- Plan: Max ($200/mo)
- Claude Code version: {version}
- Date: {YYYY-MM-DD}
```

### Step 5d: Open Discussion + Finder

Build the pre-filled Discussion URL using the sanitized body and open in browser:

```bash
open "${ISSUE_URL}"  # macOS
```

If gist failed, also open the temp folder so the user can drag files into the Discussion:

```bash
open "$REPORT_DIR"  # macOS
```

If `open` fails, print the URL and file path as a fallback.

## Step 6: Report

Show a brief summary:

```
💀 Found {N} rate-limited window(s).

| Window | Cost | Requests |
|--------|------|----------|
| {date} {start}-{end} | ${cost} | {n} |

{If gist: "📎 Data uploaded: ${GIST_URL}"}
{If no gist: "📎 Files ready at: ${REPORT_DIR}/ — drag into the Discussion"}

Discussion opened in browser. Review and submit.
```

If multiple windows found, open each one in a separate browser tab.

## Error Handling

- **No timeline CSVs**: Tell user to run `/usage-view` first to generate cached data.
- **No rate-limited windows**: "No rate-limited windows found. You can still report a non-rate-limited window as a data point by providing a date/time."
- **Gist upload fails**: If `gh` is not installed or not authenticated, fall back to opening the temp folder. Instruct the user to drag CSV files into the Discussion manually.

## Important Notes

- Timeline CSVs live at `~/.claude/cc-token-saver/{YYMM}/timeline-{SESSION_ID}.csv`
- The `rl` column values: `limit_hit_5h{reset}` (5h window limit), `limit_hit_weekly` (weekly limit), `limit_hit_opus` (Opus model limit), `limit_hit_sonnet` (Sonnet model limit), `limit_hit_extra` (extra credits exhausted), `limit_hit_unknown` (unknown type), empty (normal)
- The `win` column is the 5-hour window start as unix timestamp
- All times displayed in local timezone
- Session IDs in the CSV are safe to share — they contain no personal data
- The user confirms and submits the Discussion manually in the browser. They can edit anything before submitting.
