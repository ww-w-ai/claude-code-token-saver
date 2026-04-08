# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
