# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Claude Code plugin (claude-code-token-saver) that automates token/cache management, cost tracking, session control, and research-backed thinking patterns. Zero dependencies, zero config. Pure Node.js + Bash.

## Architecture

```
hooks/          → Lifecycle hooks (Bash). Run on UserPromptSubmit & SessionStart.
skills/         → 4 SKILL.md-based skills invoked via /continue, /usage-view, /setup-statusline, /report-limit
scripts/        → Node.js processing pipeline (no npm, no build step)
scripts/lib/    → Shared utilities (pricing, cache paths, locale, window calculations)
locales/        → 23 language JSON files for dashboard UI strings
```

**Data flow**: CC transcripts (JSONL) → `preprocess.js` / `analyze-usage.js` → cached artifacts → skills consume them.

**Cache location**: `~/.claude/claude-code-token-saver-data/{projectHash}/{sessionId}/` — stores `compact.txt`, `timeline.csv`, `summary.json`.

## No Build System

Zero-dependency project. No package.json, no npm, no build step. Scripts run directly with Node.js. Test by invoking skills in Claude Code.

## Critical Rules

### Hooks are latency-sensitive
- `cache-expiry-check.sh` runs on every user prompt (10s timeout). Must stay fast.
- All hooks receive JSON via stdin, output JSON decision to stdout.
- Hook stderr goes to user; stdout is parsed by CC. Never mix them.

### preprocess.js and analyze-usage.js parse transcripts independently
No cross-dependency between these two. Each reads JSONL from `~/.claude/projects/` on its own.

### Pricing lives in model-pricing.json
All model rates (input, cacheCreate5m, cacheCreate1h, cacheRead, output, contextWindow) in `scripts/model-pricing.json`. When a new model appears, add it there — `pricing.js` auto-resolves aliases and warns on unknown models via stderr.

### i18n
- Bash hooks: hardcoded `case` statements per locale (23 languages).
- JS dashboard: loads `locales/{xx}.json` via `resolveLocale()`.
- Charts/graphs/tables must remain LTR even for RTL locales (ar, he).
- Calendar tooltips are intentionally English-only.

### Plugin installation paths
- Source repo: this directory (editable).
- Plugin cache: `~/.claude/plugin-cache/claude-code-token-saver/` (read-only, overwritten on `plugin install`). **Always edit source repo, never plugin cache.**
- Dev mode symlink may exist — check with `ls -la ~/.claude/plugin-cache/claude-code-token-saver`.

### Skills execute via LLM instruction
Skills have no runtime code — `SKILL.md` files contain the full execution plan that Claude follows. The LLM is the runtime.

### /usage-view runs as background agent
`/usage-view` launches a background Agent (SubTask) so the user can keep working. The agent runs `analyze-usage.js` → `build-report.js` → opens browser. Agent prompt is in `skills/usage-view/agent-prompt-template.txt`.

### /continue restores sessions at zero LLM cost
Reads preprocessed `compact.txt` directly — no summarization, no token expenditure. Topic matching (`/continue : topic`) loads only relevant sessions to save context size.

## Key Constants

- Prompt cache TTL: 3600s (1 hour). Warning threshold: 3590s (10s buffer).
- SubTask cache: 5 min, $6.25/MTok write. Main session: 1 hour, $10/MTok write.
- Statusline turn idle timeout: 60s.
- Gate flag: `$TMPDIR/claude-cache-warn-{SESSION_ID}` (one-time block per idle period).

## File Relationships

```
skills/usage-view/SKILL.md
  → calls scripts/run-usage-view.js
    → calls scripts/analyze-usage.js (per-session JSONL → timeline.csv)
    → calls scripts/build-report.js  (timeline CSVs → HTML via template.html)

skills/continue/SKILL.md
  → calls scripts/list-sessions.js   (enumerate sessions)
  → calls scripts/preprocess.js      (JSONL → compact.txt)

hooks/cache-expiry-check.sh
  → reads CC transcript JSONL directly (last assistant timestamp)

scripts/statusline-logger.sh
  → registered by /setup-statusline into user's settings.json
```
