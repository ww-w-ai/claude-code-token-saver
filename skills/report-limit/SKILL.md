---
name: report-limit
description: 'Max plan hit the wall? 💀 Report your 5h window data — we''re mapping the rate limit formula Anthropic won''t publish'
when_to_use: Use when user hits a rate limit and wants to contribute data. Triggers on "report limit", "limit report", "rate limit report".
---

Report rate-limited 5-hour windows to GitHub Discussions. Pure rule-based — no LLM reasoning needed.

## Help

**ONLY show help if the user's argument literally contains the word "help" (e.g. `/report-limit help`). If no argument or any other argument is given, SKIP this section entirely and proceed to execution.**

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

## Execution

Run the standalone script. It handles everything: CSV scan, gist upload, Discussion URL, browser open.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/report-limit.js
```

The script outputs JSON to stdout. Parse the result and show the user a brief summary:

```
💀 Found {N} rate-limited window(s).

| Window | Cost | Requests |
|--------|------|----------|
| {date} {start}-{end} | ${cost} | {n} |

{If gistUrl: "📎 Data uploaded: {gistUrl}"}
{If no gistUrl: "📎 Files ready at: {reportDir}/ — drag into the Discussion"}

Discussion opened in browser. Review and submit.
```

## Error Handling

- If the script exits with code 1: "No cached data found. Run `/usage-view` first."
- If the script exits with code 0 but `windows` is empty: "No rate-limited windows found."

## Prerequisites

- GitHub Discussion category "Rate Limits" must exist on ww-w-ai/cc-token-saver
- `gh` CLI authenticated for gist upload (optional — falls back to local files)
