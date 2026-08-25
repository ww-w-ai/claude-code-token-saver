---
name: usage-view
description: 'Know exactly what you spent. Interactive HTML dashboard with cost breakdown, token usage, and 5-hour window timeline across all sessions'
when_to_use: Use when user wants to see token usage, cost breakdown, or 5-hour window timeline. Triggers on "usage view", "usage dashboard", "show usage", "usage report".
host: claude-code
---

> Claude Code only **today**. Codex records the same facts in its rollouts (`event_msg/token_count`), so this is a port that has not been done yet, not a limitation — see `docs/CODEX-PORT-BACKLOG.md`.

Parse user arguments, then launch a **single background Agent** that runs the entire pipeline (analyze → AI insights → build → open browser). The user can continue working while the dashboard is being generated.

## Help

**ONLY show help if the user's argument literally contains the word "help" (e.g. `/usage-view help`). If no argument or any other argument is given, SKIP this section entirely and proceed to launching the agent.**

If the user provides "help" as argument, show usage summary and stop:

```
/usage-view — Interactive HTML usage dashboard

Options:
  (nothing)       All projects, last ~1 month
  current         Current 5-hour window only (fast, no AI analysis by default)
  last N days     Analyze last N days only
  locale XX       Force language (e.g. locale ja). Default: system language → en fallback
  no ai           Skip AI analysis for faster rendering (no LLM cost)
  ai              Force AI analysis (use with "current" to override its default)
  private         Strip user prompt text from report (safe to share)
  help            Show this help

Supported locales:
  en ko ja zh es fr de pt it ru ar hi bn id ms th vi tr pl nl he sv no

Examples:
  /usage-view
  /usage-view current          (fast, no AI)
  /usage-view current ai       (current + AI analysis)
  /usage-view last 7 days
  /usage-view locale ja
  /usage-view current locale fr
  /usage-view private           (safe to share — no prompt text)
```

Do not run any analysis. Just display the help text and stop.

## Args (user-facing)

Users may provide these in natural language. Parse and map to script flags.

**⚠️ Default is NO FLAGS. Only add flags when the user explicitly provides arguments. Do NOT infer or assume arguments.**

| User input       | Script flag           | Example                    |
| ---------------- | --------------------- | -------------------------- |
| _(nothing)_      | _(no flags)_          | all projects, last ~1 month |
| a number of days | `--days N`            | "last 7 days" → `--days 7` |
| "all time"       | `--days all`          | no time limit, load all available data (see note below) |
| "current"        | `--days 1 --current`  | current 5H window only (implies `--no-ai` for speed) |
| "locale XX"      | `--locale XX`         | "locale ja" → `--locale ja` |
| plan name        | `--plan XX`           | "max200" → `--plan max200` |
| "project X"      | `--project X`         | specific project only (X = hashed CWD, e.g. `-Users-foo-myproject`. Derive via `echo "$PWD" \| sed 's/[^a-zA-Z0-9]/-/g'`) |
| "all"            | `--all`               | aggregate all projects     |
| "no ai"          | `--no-ai`             | skip AI analysis (fast)    |
| "ai"             | `--ai`                | force AI analysis (override current's default) |
| "private"        | `--private`           | strip user prompt text from report |

**Note on `--days all`**: Claude Code deletes transcripts older than ~1 month. Data beyond that range comes from previously cached timeline CSVs and session summaries at `~/.claude/super-token-saver-data/`. Original transcripts cannot be recovered — only already-analyzed sessions are available. Tell the user: "Transcripts older than ~1 month are deleted by Claude Code. This loads previously cached analysis data — sessions that were never analyzed won't appear."

**Note on `current`**: Defaults to no AI analysis because the main purpose is a quick snapshot. If the user explicitly says "current ai" or "current with analysis", add `--ai` to re-enable it.

### Plan parameter

If the user does NOT provide a plan, ask before launching:

> What's your current Claude plan?
>
> | # | Plan | Price |
> |---|------|-------|
> | 1 | Pro | $20/mo |
> | 2 | Max 5x | $100/mo |
> | 3 | Max 20x | $200/mo |
> | 4 | Team Standard | $20/seat/mo |
> | 5 | Team Premium | $100/seat/mo |
> | 6 | Enterprise | custom |
> | 7 | Amazon Bedrock | usage-based |
> | 8 | Microsoft Foundry | usage-based |
> | 9 | Google Vertex AI | usage-based |
>
> Enter number or name (e.g. "3" or "max200"):

Map user input to `--plan` values: 1=pro, 2=max100, 3=max200, 4=team, 5=team_premium, 6=enterprise, 7=bedrock, 8=foundry, 9=vertex

If the user doesn't know or skips, run without `--plan`.

## Launch: Background Agent

Launch a **single background Agent** (run_in_background: true). Tell the user: "Usage dashboard is being generated in the background. You can continue working — the browser will open automatically when ready."

The agent prompt should be exactly this (replace `[parsed flags]` with the actual flags parsed from user args):

"Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/run-usage-view.js --gen-agent-prompt [parsed flags] 2>/dev/null`, parse the JSON output to get `agentPromptFile`, then Read that file and follow the instructions exactly. Output ONLY the final summary at the very end: scope, file path, sessions analyzed, date range, total cost."

---

## Main Session: Final Output

After launching the background agent, immediately tell the user (do NOT wait for the agent to finish):

```
Usage dashboard is being generated in the background. Browser will open automatically when ready.
You can continue working.
```

When the background agent completes, report:

```
Usage dashboard opened in browser.

- Scope: {all projects OR current folder name}
- File: {path}
- Sessions analyzed: {N}
- Date range: {from} ~ {to}
- Total cost: ${total}

The HTML file is self-contained -- you can share it or re-open it anytime.
💡 Tip: `/usage-view no ai` — skip AI analysis for a faster dashboard (no LLM cost).
💡 Tip: `/usage-view current` — quick snapshot of your 5H window (no AI by default). Add "ai" to include analysis.
```

## Important Notes

1. **Large files**: The analyze-usage.js script uses streaming (`readline`) internally. Do not read JSONL files with `fs.readFileSync`.
2. **Caching**: The script caches per-session JSON at `~/.claude/super-token-saver-data/{projectName}/{sessionId}/summary.json` and timeline CSV at `~/.claude/super-token-saver-data/{projectName}/{sessionId}/timeline.csv`. Use `--force` to force re-analysis.
3. **Build script**: `scripts/build-report.js` reads timeline CSVs and constructs the REPORT_DATA object. The template at `skills/usage-view/template.html` contains the viewer (HTML/CSS/JS) with sample data that gets replaced.
4. **Timezone**: All displayed dates/times use the user's local timezone via `new Date()`.
5. **Cost formula**: Per-model pricing from `scripts/model-pricing.json`. Falls back to default model if unknown.
6. **Self-contained HTML**: The output file works standalone -- inline CSS/JS, CDN for Chart.js, no external dependencies.
7. **stderr**: The analyze script writes progress to stderr. Always use `2>/dev/null` when redirecting stdout to a file, never `2>&1`. Exception: Tool Call 1 in the background agent captures stderr to a logfile so `ERROR:UNKNOWN_MODEL` (exit code 2) can be inspected on failure.
8. **Runner script**: `scripts/run-usage-view.js` consolidates all deterministic steps. The agent should NEVER run analyze-usage.js or build-report.js directly.
9. **Unknown model handling**: When `scripts/analyze-usage.js` encounters a model missing from `scripts/model-pricing.json`, it fails fast with exit code 2 and emits `ERROR:UNKNOWN_MODEL` on stderr. The background agent handles this inline — WebFetch the Anthropic pricing page, Edit the JSON with exact values (no guessing), and re-run Tool Call 1. If the page lacks required fields, the agent guides the user to update the plugin instead of patching with derived values. Full procedure lives in `agent-prompt-template.txt` Tool Call 1.
