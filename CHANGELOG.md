# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-04-09

### Fixed

- Marker system: session markers now accumulate instead of overwriting (e.g., `/clear` + `/model` → `@@!`)
- Marker system: rate limit path now flushes pending session markers
- Marker system: prevent `+++` edge case when `+` and `++` co-occur
- analyze-usage: `/continue` detection updated for new compact file path structure
- analyze-usage: `/continue` detection string aligned with preprocess.js (`cc-token-saver:continue`)
- analyze-usage: context threshold events now fire on first crossing only (matches preprocess.js)
- build-report: `matchAlertWithTimeline` no longer skips usage rows with cost/ctx event annotations
- build-report: session-marker-only alerts kept in REPORT_DATA (with `isInfoOnly` flag), filtered in UI only
- build-report: alert count in UI excludes info-only alerts
- template: cost diagnostic now sorts by estimated cost instead of token count (was using token count)
- template: cache write cost split by 1h/5m tier rates for accurate ranking
- Dead code removed: unreachable `isFirstUserMessage` resets in preprocess.js

### Added

- analyze-usage: session event detection (`/clear`, `/resume`, `/reload-plugins`, `/model`) → timeline evt column
- Compact timestamp now includes seconds (`MM-DDThh:mm:ss`) for precise alert-timeline matching
- Cost diagnostic: dedicated messages for output-dominated and input-dominated alerts (23 locales)
- Cost diagnostic: cache-read-dominated alerts fall back to generic label when ctx < 35%
- i18n: `costOutputReason`, `costInputReason` added to all 23 locales
- i18n: `ctxWarn`/`ctxDanger` updated to "cache write/read cost" across all 23 locales

## [1.2.0] - 2026-04-09

### Fixed

- Subagent timeline path resolution: `agent-` prefix mismatch in `_sessionProjectMap`
- 5m cache tier showing $0: resolved by fixing subagent token aggregation
- 5h window overlap: refactored from per-session `hourFloor` to library-based window assembly

### Added

- window-utils library: `collectActiveHours`, `buildFiveHourWindows`, `buildHourToWindowMap`
- report-limit: model indexing (`models.csv`), per-window analysis metrics, unified table

## [1.1.2] - 2026-04-09

### Fixed

- Calendar window boundary bug: partial end hours (e.g., 18:30) were excluded from the grid, causing blank cells

## [1.1.1] - 2026-04-09

### Changed

- Data storage folder renamed: `~/.claude/cc-token-saver/` → `~/.claude/cc-token-saver-data/` (avoids confusion with plugin name)
- Auto-migration: existing data folder is renamed automatically on first run

## [1.0.4] - 2026-04-09

### Added

- Shared lib modules: plan-info, constants, format, locale, pricing, window-utils (DRY across scripts)
- SessionStart hook: auto-patch statusline path on plugin update (`statusline-version-check.sh`)
- report-limit: window merging (overlapping 5h windows → single continuous period)
- report-limit: per-window token breakdown table (input, output, cache write, cache read)
- report-limit: sessions.csv index (numeric IDs + parent mapping, privacy-safe)
- report-limit: zip compression + gist upload (window + ratelimit CSVs)
- report-limit: gh auth failure guidance (`gh auth login`)
- usage-view: plan badge in HTML template title
- usage-view: monthly extrapolation only when ≤15 days
- Numbered plan selection in report-limit and usage-view skills

### Changed

- RUN indicator threshold: 🟡 ≥$0.50 → ≥$0.30 (all 23 READMEs + SKILL.md)
- report-limit: Discussion title shortened (`💀 Rate Limit Report (N windows) — $X`)
- report-limit: Discussion body uses per-window table instead of flat field list
- Plan question wording: "subscription plan" → "current plan" (inclusive of non-subscribers)

### Fixed

- Statusline path not updating on plugin version upgrade (settings.json pointed to old cache)
- Gist upload failing on zip (binary not supported) — now uploads text CSVs

## [1.0.3] - 2026-04-09

### Added

- `--plan` parameter for report-limit.js and run-usage-view.js (pro/max100/max200/team/team_premium/enterprise/bedrock/foundry/vertex)
- Plan-aware AI analysis: flat-rate plans get rate limit management advice, usage-based plans get cost optimization guidance
- Plan comparison table in AI prompt for upgrade/downgrade recommendations
- Weekly rate limit display in statusline: `[W🟡] 65% ⏳1d3h30m` (shown at ≥60%, danger at ≥90%)

### Changed

- report-limit.js: standalone Node script replacing inline SKILL.md code (zero LLM involvement)
- report-limit: filter to `limit_hit_5h` + `limit_hit_unknown` only (skip weekly)
- Discussion category target: `rate-limits`
- SKILL.md for report-limit and usage-view: ask user's plan before execution

## [1.0.2] - 2026-04-09

### Fixed

- Rate limit count: count blocked windows instead of individual hours (skulls now match AI analysis count)
- Renamed `blockedHours` → `blockedWindows` for clarity

## [1.0.1] - 2026-04-09

### Added

- Rate limit markers in preprocess.js (`%%`/`%5`/`%W`/`%O`/`%S`/`%X`) with reset time parsing
- `evt` column in timeline CSV (cost/context/session events, pipe-separated)
- Win correction using ratelimit CSV boundaries in build-report.js
- Skull (💀) rendering on calendar for rate-limited hours
- Gist-based data upload in report-limit skill

### Changed

- analyze-usage.js: 1-pass refactor (removed 2-pass win assignment)
- ALERT_LINE_RE simplified to single-group capture
- report-limit: `startsWith('limit_hit')` matching for new rl format

### Fixed

- CSV comma collision in reset info: `{2am,Asia/Seoul}` → `{2am@Asia/Seoul}`

## [1.0.0] - 2026-04-08

### Added

- **/usage-view** — Interactive HTML dashboard showing token usage, costs, and 5-hour window timeline
  - AI-powered cost analysis and work pattern insights
  - Daily cost calendar with rate limit detection
  - Session detail cards with token breakdown and donut charts
  - 23-language support (auto-detected from system locale)
  - RTL support for Arabic and Hebrew
  - `current` mode for live 5-hour window analysis
- **/continue** — Zero-cost session context restoration from previous sessions
  - Preprocessed transcript caching with line-number markers
  - Default (200/100) and aggressive (50/20) truncation modes
  - Multi-session selection with size-aware variant switching
- **/setup-statusline** — Real-time token counter in Claude Code status bar
  - Input/output/cache token counts per turn
  - Cumulative session cost and 5-hour window cost
  - Context size percentage indicator
- **/report-limit** — Rate limit data collection for community research
  - Automatic 5-hour window snapshot extraction
  - Privacy-safe data sanitization
  - GitHub Discussion submission with pre-filled template
- **Token Guardian hook** — Cache expiry detection on every prompt
  - 23-language warning messages
  - Actionable options: /compact, /clear + /continue, or ignore
- **model-pricing.json** — Token cost data for all Claude models
  - Input, output, cache write (5m/1h), cache read prices
  - Auto-fallback for unknown models

[1.0.1]: https://github.com/ww-w-ai/cc-token-saver/releases/tag/v1.0.1
[1.0.0]: https://github.com/ww-w-ai/cc-token-saver/releases/tag/v1.0.0
