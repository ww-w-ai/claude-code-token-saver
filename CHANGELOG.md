# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-05-21

### Renamed to claude-code-token-saver

- Plugin renamed from `claude-code-upgrader` to `claude-code-token-saver` — clearer purpose ("token saver" vs generic "upgrader")
- Cache directory auto-migrates from `claude-code-upgrader-data/` → `claude-code-token-saver-data/`
- Legacy migration chain: `cc-token-saver` → `cc-token-saver-data` → `claude-code-upgrader-data` → `claude-code-token-saver-data`

## [2.0.0] - 2026-05-20

### Breaking: Renamed to claude-code-token-saver

- Plugin renamed from `claude-code-upgrader` to `claude-code-token-saver` (history: `cc-token-saver` → `claude-code-upgrader` → `claude-code-token-saver`)
- Cache directory auto-migrates from previous names (`claude-code-upgrader-data/`, `cc-token-saver-data/`) to `~/.claude/claude-code-token-saver-data/`
- Environment variable renamed: `CC_UPGRADER_TURN_IDLE_SEC` (old `CC_TOKEN_SAVER_TURN_IDLE_SEC` still works)
- Cross-platform path fix: Windows/Linux backslash paths now handled correctly in subagent detection and project name extraction

## [1.7.0] - 2026-05-06

### Fixed: 5h window minute-precision (post-2026-04-23)

- Anthropic switched 5h rate-limit window resets from hour-aligned to first-message+5h around 2026-04-23 — boundaries are now minute-precise (e.g. 13:20, 18:40)
- usage-view used hour-floor mapping for window assignment, causing boundary-hour activity and sessions to be miscounted in the wrong window
- Refactor: `window-utils.js` adds `buildGlobalTsMapper` (raw `ts` → window via merged ratelimit boundaries); `build-report.js` replaces hour-floor normalize with ts-precision mapping
- timeline CSV schema unchanged — automatic migration from existing data
- 4/23 이전 hour-aligned data is handled by the same algorithm naturally
- Verified on 52,671 timeline rows × 91 ratelimit windows: 781 boundary-hour reattributions, 0 invariant violations, 270/270 sessions within window boundary

## [1.6.2] - 2026-04-28

### New: Concise Mode (built-in response style)

- SessionStart hook now injects a response-style rule alongside the existing session architecture guidance — applies to **every session and every model**, no flags or setup
- Cuts preamble ("Let me check…", "I'll now…"), question restatements, and redundant summaries of work already shown in tool calls/diffs
- Picks bullets for lists, prose for reasoning (tradeoffs, causation, rationale) — neither forced
- Hard limits prevent over-compression: never drop content, skip verification, or collapse nuance into a single sentence ("Compress expression, not analysis")
- README updated in all 22 translated languages with a dedicated `🪶 Concise Mode` section

### `/usage-view` dashboard improvements

- **Efficiency chart**: denominator changed from `cc / output` to `cc / (input+output)` for fairer ratio interpretation; chart now ships with an in-place guide card explaining both Total/Output and Cache/(Input+Output) metrics
- **Context cost chart**: new in-place guide card explains CW / Non-CW / User Turn options and price-line semantics; dot/line color legend (red=Opus, blue=Sonnet, green=Haiku) added to Non-CW chart for parity with CW
- **Hourly / Day-of-Week**: new "Max" annotation describes single-day/single-week peak; "Partial" annotation now shows concrete normalization example (e.g., 20 min → ×3)
- **Per-user-turn model accuracy**: model attribution now reads from each call's row instead of the first row of the turn, fixing mixed-model turns
- **Cache write floor removed**: $0.05 minimum on CW dots removed so all calls render
- **Calendar cost filter**: new `💰 비용 ≥` slider hides cells below threshold for noise reduction
- **Daily token chart**: input tokens now tracked separately for finer-grained efficiency math
- **Plugin-installed marker**: label moved below the chart axis to avoid overlap with chart titles

### i18n

- New keys across all 23 locales: `effLabelTotal`, `effLabelCache`, `effGuideLine1/2/3`, `hourlyNoteMax`, `dowNoteMax`, `ctxGuideLine1/2`, `ctxCostCWNote4`, `ctxCostNonCWNote3/4`, `costFilterLabel`, `costFilterCount`
- Refined `hourlyNotePartial` / `dowNotePartial` with normalization examples in all 23 languages

## [1.6.1] - 2026-04-24

### New: Prompt Cache Guide (23 languages)

- New `guides/prompt-cache-guide.md` (+ 22 translations) explaining why cache dominates Claude Code costs, how Claude Code / Codex / Gemini CLI differ in caching behavior, and concrete strategies to cut cache spend with claude-code-token-saver features
- Linked from README documentation section

### `/usage-view` private mode

- New private mode strips raw prompt text from generated reports so dashboards can be shared without leaking prompt content
- 29 new i18n keys across all 23 locales (dashboard buttons, axis labels, descriptions)

### `totalCost` dedup fix

- Sum from `tokenBreakdown` instead of the `analyze-usage.js` rolled-up value — eliminates double-counting when parent/subtask sessions share replayed rows
- Removed the dedup-unsafe `totalCost` field from `analyze-usage.js` output with an inline comment explaining why

### Hook architecture: context-growth minimization

- `session-architecture.md` gains a guide on tool choice impact (Grep/Glob/LSP → Read partial → Read full as last resort, Edit > Write, `git diff` > dual Read)

### Repo housekeeping

- `research/` docs moved to `guides/` to match documentation structure

## [1.6.0] - 2026-04-22

### `/setup-git-lite` simplification

- Dropped the `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` env var and shell-profile marker block — `settings.json` alone is sufficient since CC reads `includeGitInstructions` natively
- `dismiss` / `undismiss` renamed to `dismiss-banner` / `undismiss-banner` for clarity
- Default no-arg invocation now runs `status` (was `help`) — first-time users see actionable diagnostic
- SKILL.md gains an i18n translation directive
- All 23 README translations + 23 locale files updated to match

## [1.5.0] - 2026-04-20

### New: `/setup-git-lite` skill

- Skips Claude Code's built-in git instructions (~2,200 tok/session + ~1,700 tok/commit) and injects a compact, locale-aware replacement via SessionStart hook
- Adoption tip surfaces at ~20% sampling rate in SessionStart only (single owner — removed from `/usage-view` and other commands to avoid duplicate nagging)
- New helper: `scripts/lib/git-lite-state.js` (`getRecommendationTip()` is locale-aware)
- Pricing fail-fast: unknown models now error out instead of silently assuming costs

### Full i18n for `/setup-git-lite`

- All 22 translated READMEs updated with the new Feature 5 section
- All 23 `locales/*.json` files gain a `gitLite.tip` key
- SessionStart hook now detects `LANG` and loads the localized tip from the JSON — no hard-coded translations in Bash

### Hook architecture: `session-architecture.md` redesign

- Restored `claude -p` guidance (removed in 1.4.0) — parallel design work goes through `claude -p` (1h cache tier, thinking active), execution work goes through SubTask (5m cache tier, Sonnet default)
- Sonnet weekly-limit caveat softened (not confirmed by Anthropic; likely falls back to Opus based on prior source evidence)
- Tighter size budget: 29 lines / 1.8KB despite added content

### Research report: Opus 4.7 vs 4.6 cost analysis

- New `research/opus-4-7-vs-4-6-cost-analysis.md` (EN) and `.ko.md` (KO)
- Based on 8,563 real API calls across two projects + 100-turn simulation
- Key finding: 4.7 costs ~1.43x of 4.6 on English/code workloads (23% on mixed, 12% on Korean-heavy), driven by tokenizer shift, 3.5× thinking frequency in main sessions, and 27~34% verbosity increase
- Includes methodology, simulation scripts, CC source analysis, and recommended mitigation (`/model claude-opus-4-6[1m]`)

### usage-view refactor

- Split into `analyze-usage.js` (per-session CSV) and `build-report.js` (HTML) with cleaner dependency boundary
- Unknown model detection surfaces as hard error with guidance to update `model-pricing.json`
- `--days all` support for full-history reports
- Plugin install-date detection fixed: now uses oldest cached version's birthtime instead of latest (which got overwritten on updates)

## [1.4.0] - 2026-04-13

### /continue skill improvements

- Current session with context-loss events (`/clear`, `/compact`, auto-compact) now appears as **#0 [default]** in session list
- `/continue last` auto-restores current session when it has context-loss events (recovers lost earlier content after auto-compact)
- New `hasContextLoss` + `contextLossEvents` fields in `list-sessions.js` output
- Event badges in session list: `📍` (current), `@@` (`/clear`), `+` (manual compact), `++` (auto-compact)
- Additive input parsing: empty = #0, `1,3` = #0 + #1 + #3
- Global-index pagination: browse via "more", select any number from any page
- Large selection confirmation (>=10 sessions or >500KB)
- 150KB threshold (up from 100KB) for default/aggressive mode switching

### preprocess.js v3 format — Signal-weighted truncation

- **4-category tag system** replaces bulk content with compact tags:
  - `[C{n} | {N}L | {N}KB]` — code blocks (>5 lines or >200B)
  - `[T{n} | {R}R | "{name}"]` — markdown tables
  - `[B{n} | {N}# | "{name}"]` — numbered lists (`#`) / bullet lists (`*`)
  - `[I{n} | {format} | {W}x{H}]` — images with parsed dimensions
- **Context Window truncation** for assistant messages: preserves URLs, inline code, attention-emoji lines, and keyword lines with natural +/-60 char context windows (no `[...]` markers, blank-line separated)
- **Meta footer** with full indexes (TOC at end for LLM attention weight): Code Blocks -> Tables -> Lists -> Images -> Attention Signals -> Table of Contents
- **Name extraction heuristic** for T/B tags: header / colon label / bold prefix
- **Image dimension parsing**: PNG, GIF, WebP (with signature check), JPEG (SOF0/1/2/3 for progressive support, 8KB scan window for EXIF-heavy images)
- **Attention emoji set** (20): red-X, red-circle, warning, siren, fire, target, bug, wrench, bulb, collision, party, trophy, rocket, test-tube, robot, money-wings, money, chart-up, chart-down, pin, yellow-circle (check-mark excluded as status marker noise)
- **Keyword detection**: `root cause`, `TL;DR`, `breakthrough`, `bug found`, `wrong`, `CRITICAL`, `CONFIRMED`, `FATAL`, `fixed`, `verified`, `finding`
- **Short code block protection**: <=5 lines or <=200B blocks kept in-place but masked during table/list/TOC scanning to prevent shell-pipe/italic/comment false positives
- **Tag-aware smartTruncate**: head/tail/snippet boundaries snap to tag edges, preventing tag splitting
- **Unified user/assistant HEAD/TAIL**: default 300/200, aggressive 100/100
- **Last-10 turn boost**: 1.5x head/tail for recent context
- **CACHE_VERSION 12 -> 13** (auto-invalidates old caches)
- **COMPACT_FORMAT_VERSION 2 -> 3**

### Memory retention comparison

- Session-level comparison between auto-compact summary and `/continue` raw restoration informed the design
- Validated that auto-compact requires "All user messages: List ALL user messages" per CC source prompt (`services/compact/prompt.ts:73`)

### usage-view: Context Size Distribution chart

- New bar chart showing API call distribution across 4 context size buckets (~250K, 250~350K, 350~500K, 500K+)
- Tooltip shows count, percentage, total cost, and avg cost per call for each bucket
- AI section2 prompt includes context distribution data for efficiency analysis
- Chart renders in all modes (not gated by days >= 3)

### report-limit: Date-specific reporting

- New `--date YYYY-MM-DD` flag: report all 5h windows overlapping a specific date (not just rate-limited ones)
- Scans `dayStart - 5h` to `dayEnd` to catch windows crossing midnight boundaries
- SKILL.md updated with date argument support (e.g. `/report-limit 2026-04-01`)

### Changed

- usage-view: Replaced "Top 20 user prompts" with "Autonomous Runs" list (>=20 min runs)
- usage-view: Per-API-call cost chart now uses square aspect ratio
- usage-view: Long-runs section moved above calendar
- usage-view: AI section2 now analyzes autonomous runs + per-call scatter (expanded length)
- **Marker semantics rename (breaking)**: `+` marker now means manual `/compact` (was: `/resume`, which was dead code due to CC's `display:'skip'`). `++` marker now means auto-compact (via `compact_boundary.trigger='auto'`).
- **alertType strings renamed**: `resume` → `compact-manual`, `compact` → `compact-auto`.
- **i18n keys renamed** (23 locales): `resume`/`resumeReason`/`compact`/`compactReason` removed, `compactManual`/`compactAuto`/`compactManualReason`/`compactAutoReason` added.
- **Marker ownership separated** (compact-timeline-separation):
  - `compact.txt` (preprocess.js) now holds ONLY user-side markers: `@ @@ + ++ ~ ! ^ ^^`.
  - `timeline.csv` (analyze-usage.js) now owns assistant-side markers: `* ** # ## ?` and rate-limit `%` markers, written into new `line,markers` columns.
  - `build-report.js` joins the two streams by JSONL line number via `buildAlertsFromUserTurns` and aggregates cost per user turn.
- **CACHE_VERSION bumped**: 8 → 9. Existing caches auto-invalidate on next `analyze-usage.js` run; no migration required.
- **Statusline cost display** now shows accumulated cost per user turn instead of per-call delta. Turn boundary detected via idle timeout (`CC_TOKEN_SAVER_TURN_IDLE_SEC`, default 60s). A $1.43 spike no longer flashes away on the next cheap tool call.

### Fixed

- **ISO date parsing bug in build-report.js**: v6 compact.txt uses full `YYYY-MM-DDTHH:MM:SSZ` timestamps, but the alert parser only handled `MM-DDTHH:MM` format — parsed year as month, placing all alerts in 2194. This caused calendar dots (alert indicators) to disappear entirely. Now handles both `YYYY-MM-DD` and `MM-DD` date formats.
- **Chart.js hardcoded colors**: All 6 charts (bar, hourly, dow, efficiency, ctxCost, ctxDist) now use CSS variable-derived `GRID_COLOR`/`TICK_COLOR` constants instead of hardcoded `#21262d`/`#8b949e`. Enables future theme support.
- **$0 window filter blocking alerts**: `finalSessions.length === 0` check was placed before alertMessages construction, causing windows with cost data but no "final sessions" to skip alert building entirely. Moved filter to after alert construction.
- `/resume` detection was never working (CC uses `display:'skip'` for resume command, so no transcript entry is ever written). `?` heuristic marker continues to detect 1h-inside cache_creation as the intended resume proxy.
- `preprocess.js`: removed legacy `+ → ++` dedup replace logic (no longer needed after semantic rename).
- **`****` cost marker accumulation bug**: the retroactive regex `$1${markers}` in `preprocess.js` kept re-marking the same user line on each of N assistant turns in a tool-heavy chain, producing literal `****` / `##**##` artefacts. Cost markers are now emitted once per API call into `timeline.csv` instead.
- **Cost underreporting on multi-turn prompts**: dashboard previously showed one random assistant row per user line via nearest-timestamp 1:1 matching. Now aggregates ALL assistant rows in the user turn, so a 7-turn $3.41 prompt reports as $3.41 total with per-turn breakdown.
- **Stale `compact.txt` during mid-session runs**: `generateMissingCompacts` in `build-report.js` only checked file existence. It now compares JSONL mtime against compact.txt mtime and regenerates when the transcript is newer.

### Removed

- Dead code: `resume`, `resumeReason`, `compact`, `compactReason` i18n keys and their rendering paths.
- Dead code: `5h-warn`/`5h-danger` alertType handlers and i18n keys (no source emits them).
- `preprocess.js` cost/ctx/heuristic/rate-limit marker emission (moved to `analyze-usage.js`).
- `preprocess.js` now no longer imports `model-pricing.json` or computes `calcCost` — all pricing logic lives in `analyze-usage.js`.

## [1.4.4] - 2026-04-14

### Changed

- Translated hardcoded Korean text to English in preprocess.js, continue/SKILL.md, report-limit/SKILL.md
- LLM prompt: enforced "context size" terminology across all 3 sections
- LLM prompt: detailed resume/compact cost explanation (re-cache vs read+summarize+re-cache)
- LLM prompt: praise mode when entire period is post-plugin-install
- LLM prompt: corrected cost warning thresholds ($0.80/$2.50)
- LLM prompt: each data section annotated with corresponding chart name

## [1.4.3] - 2026-04-14

### Added

- Hourly/DOW charts: dual average toggle — Avg (active days) / Avg (all days) / Max
- Partial-hour normalization at data boundaries (≤14 days)
- DOW: first+last day same DOW merged as one in calendar count

### Changed

- Cost thresholds (TURN_COST_WARN/DANGER, DEFAULT_COST_FILTER) centralized at file top
- costThresholds injected into REPORT_DATA for template and AI prompt use
- Default cutoff: exact time (not midnight) for 1-month-ago
- Month boundary fix: 3/31 → 2/28 via setDate(0)
- Context distribution: returns "NO DATA" when empty to prevent LLM fabrication

## [1.4.2] - 2026-04-13

### Added

- Bubble chart: grid-based density clustering (50×50) replaces scatter plot
- Model-based colors: Opus (red), Sonnet (blue), Haiku (green) with z-ordering
- CW/Non-CW/User Turn 3-mode toggle with per-model datasets
- Theoretical pricing lines per model with 3 dash styles (1h/5m/CR)
- CW mode: model checkboxes to toggle price lines on/off
- User Turn: $50 cap with red star markers for exceeded turns
- Cluster tooltip: top 3 entries with token breakdown + call count
- API pricing table added to AI prompt for accurate cost references

### Changed

- ASST_COST_FLOOR=0.05 for CW, no floor for Non-CW
- USER_TURN_COST_FLOOR=0 (include all turns)
- AI prompt section1 scoped to summary numbers only
- AI prompt section2 CW/Non-CW/Distribution consolidated

## [1.4.1] - 2026-04-13

### Fixed

- report-limit: --date filter now only includes windows for specified date
- report-limit: ratelimit.csv collected account-wide from all projects
- report-limit: ratelimit.csv filtered by window time range
- report-limit: dedup '0' falsy bug fixed in ratelimit processing
- report-limit: 7d_reset first row fill logic improved
- report-limit: window CSV header corrected (13→15 columns)
- hourlyStats avg: divide by actual active days per hour (not total days)

### Added

- Cache read alert: descriptive i18n message with context size and API call count (23 locales)
- report-limit: directory name includes milliseconds to prevent collision
- Alert: peak context size and apiCallCount per user turn
- Alert text: preserve up to 300 chars (was 120)

## [1.3.0] - 2026-04-09

### Fixed

- Marker system: session markers now accumulate instead of overwriting (e.g., `/clear` + `/model` → `@@!`)
- Marker system: rate limit path now flushes pending session markers
- Marker system: prevent `+++` edge case when `+` and `++` co-occur
- analyze-usage: `/continue` detection updated for new compact file path structure
- analyze-usage: `/continue` detection string aligned with preprocess.js (`claude-code-token-saver:continue`)
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

- Data storage folder renamed: `~/.claude/claude-code-token-saver/` → `~/.claude/claude-code-token-saver-data/` (avoids confusion with plugin name)
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

[1.0.1]: https://github.com/ww-w-ai/claude-code-token-saver/releases/tag/v1.0.1
[1.0.0]: https://github.com/ww-w-ai/claude-code-token-saver/releases/tag/v1.0.0
